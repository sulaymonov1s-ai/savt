export interface Env {
  AI_API_KEY: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  ALLOWED_ORIGIN?: string;
  AUTH_SECRET: string;
  PROGRESS: KVNamespace;
}

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'nvidia/nemotron-3.5-super-vl-120b-a12b';
const DEFAULT_ORIGIN = 'https://sulaymonov1s.github.io';
const TOKEN_TTL = 30 * 24 * 3600 * 1000;

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function handleOptions(origin: string) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function json(data: unknown, status = 200, origin: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function err(message: string, status = 400, origin: string) {
  return json({ error: message }, status, origin);
}

/* ---------- crypto helpers ---------- */
function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return decodeURIComponent(Array.from(bin).map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
}

function b64urlEncode(s: string): string {
  const bin = Array.from(new TextEncoder().encode(s)).map(c => String.fromCharCode(c)).join('');
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return hex(sig);
}

async function pbkdf2Hash(password: string, saltHex: string, iterations = 100000): Promise<string> {
  const salt = new Uint8Array((saltHex.match(/../g) || []).map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return hex(bits);
}

function eqHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ---------- tokens ---------- */
async function generateToken(email: string, secret: string): Promise<string> {
  const payload = b64urlEncode(JSON.stringify({ e: email, exp: Date.now() + TOKEN_TTL }));
  const sig = await hmacHex(payload, secret);
  return payload + '.' + sig;
}

async function verifyToken(token: string, secret: string): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = await hmacHex(parts[0], secret);
  if (!eqHex(parts[1], expected)) return null;
  let data: { e?: string; exp?: number };
  try {
    data = JSON.parse(b64urlDecode(parts[0]));
  } catch {
    return null;
  }
  if (!data.e || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
  return data.e;
}

/* ---------- auth/sync handlers ---------- */
function validEmail(email: string): boolean {
  return email.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handleRegister(req: Request, env: Env, origin: string): Promise<Response> {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON', 400, origin);
  }
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!validEmail(email)) return err('bad_email', 400, origin);
  if (password.length < 6 || password.length > 100) return err('bad_password', 400, origin);

  const existing = await env.PROGRESS.get('user:' + email);
  if (existing) return err('exists', 409, origin);

  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await pbkdf2Hash(password, salt);
  await env.PROGRESS.put('user:' + email, JSON.stringify({ salt, hash, created: Date.now() }));
  await env.PROGRESS.put('progress:' + email, '{}');
  return json({ token: await generateToken(email, env.AUTH_SECRET) }, 200, origin);
}

async function handleLogin(req: Request, env: Env, origin: string): Promise<Response> {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON', 400, origin);
  }
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const raw = await env.PROGRESS.get('user:' + email);
  if (!raw) return err('bad_credentials', 401, origin);
  const user = JSON.parse(raw) as { salt: string; hash: string };
  const hash = await pbkdf2Hash(password, user.salt);
  if (!eqHex(hash, user.hash)) return err('bad_credentials', 401, origin);
  return json({ token: await generateToken(email, env.AUTH_SECRET), email }, 200, origin);
}

function bearer(req: Request): string {
  const h = req.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

async function handleSyncPull(req: Request, env: Env, origin: string): Promise<Response> {
  const email = await verifyToken(bearer(req), env.AUTH_SECRET);
  if (!email) return err('bad_token', 401, origin);
  const raw = await env.PROGRESS.get('progress:' + email);
  return json({ progress: raw ? JSON.parse(raw) : null }, 200, origin);
}

async function handleSyncPush(req: Request, env: Env, origin: string): Promise<Response> {
  const email = await verifyToken(bearer(req), env.AUTH_SECRET);
  if (!email) return err('bad_token', 401, origin);
  let body: { progress?: unknown };
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON', 400, origin);
  }
  if (!body.progress || typeof body.progress !== 'object') return err('bad_progress', 400, origin);
  const serialized = JSON.stringify(body.progress);
  if (serialized.length > 500000) return err('too_large', 413, origin);
  await env.PROGRESS.put('progress:' + email, serialized);
  return json({ ok: true }, 200, origin);
}

/* ---------- AI proxy (стриминг к NVIDIA, как раньше) ---------- */
function validateMessages(messages: unknown[]): boolean {
  for (const m of messages) {
    if (!m || typeof m !== 'object') return false;
    const msg = m as Record<string, unknown>;
    if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role as string)) return false;
    const content = msg.content;
    if (typeof content === 'string') continue;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== 'object') return false;
        const p = part as Record<string, unknown>;
        if (!p.type || !['text', 'image_url'].includes(p.type as string)) return false;
        if (p.type === 'image_url' && (!p.image_url || typeof p.image_url !== 'object')) return false;
      }
      continue;
    }
    return false;
  }
  return true;
}

async function handleAIProxy(req: Request, env: Env, origin: string): Promise<Response> {
  const baseUrl = env.AI_BASE_URL || DEFAULT_BASE;
  const model = env.AI_MODEL || DEFAULT_MODEL;
  const apiKey = env.AI_API_KEY;

  if (!apiKey) {
    return err('Server misconfigured: AI_API_KEY not set', 500, origin);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON', 400, origin);
  }

  const { messages, stream = true, temperature = 0.6, max_tokens = 3000 } = body as {
    messages?: unknown[];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return err('Missing or invalid messages array', 400, origin);
  }

  if (!validateMessages(messages)) {
    return err('Invalid message format (vision: use {type: "text"/"image_url"})', 400, origin);
  }

  const upstreamRes = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream, temperature, max_tokens }),
  });

  if (!upstreamRes.ok) {
    const errText = await upstreamRes.text().catch(() => '');
    console.error('Upstream error:', upstreamRes.status, errText);
    return err(`AI provider error: ${upstreamRes.status}`, 502, origin);
  }

  if (stream) {
    return new Response(upstreamRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders(origin),
      },
    });
  }

  const data = await upstreamRes.json();
  return json(data, 200, origin);
}

/* ---------- AI-анализ слабых мест (2 раза в день, кэш в KV) ---------- */
async function handleAnalysis(req: Request, env: Env, origin: string): Promise<Response> {
  const email = await verifyToken(bearer(req), env.AUTH_SECRET);
  if (!email) return err('bad_token', 401, origin);

  let body: { summary?: unknown; lang?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON', 400, origin);
  }
  if (!body.summary || typeof body.summary !== 'object') return err('bad_summary', 400, origin);
  const summaryStr = JSON.stringify(body.summary);
  if (summaryStr.length > 30000) return err('too_large', 413, origin);
  const lang = body.lang === 'uz' ? 'uz' : 'ru';

  /* окно: утро/вечер по Ташкенту (UTC+5), до 15:00 — утренний анализ */
  const t = new Date(Date.now() + 5 * 3600 * 1000);
  const date = t.toISOString().slice(0, 10);
  const win = t.getUTCHours() < 15 ? 'am' : 'pm';
  const cacheKey = `analysis:${email}:${date}:${win}`;

  const cachedRaw = await env.PROGRESS.get(cacheKey);
  if (cachedRaw) {
    const cached = JSON.parse(cachedRaw) as { generatedAt?: number };
    const freshEnough = body.force !== true || (Date.now() - (cached.generatedAt || 0)) < 15 * 60 * 1000;
    if (freshEnough) {
      return json(Object.assign({}, cached, { cached: true }), 200, origin);
    }
  }

  const baseUrl = env.AI_BASE_URL || DEFAULT_BASE;
  const model = env.AI_MODEL || DEFAULT_MODEL;
  const apiKey = env.AI_API_KEY;
  if (!apiKey) return err('Server misconfigured: AI_API_KEY not set', 500, origin);

  const sys = lang === 'uz'
    ? "Sen — O'zbekiston PPD bo'yicha shaxsiy AI murabbiysisan. O'quvchi imtihonga tayyorlanmoqda. Uning statistikasini tahlil qilib, zaif joylarini tahlil qilib ber. Qat'iy sir: model, provayder va kompaniya nomini hech qachon aytma. Faqat PPD mavzusida javob ber."
    : "Ты — персональный ИИ-тренер по ПДД Узбекистана. Ученик готовится к экзамену. Проанализируй его статистику и дай персональный разбор слабых мест. Строго секретно: никогда не называй модель, провайдера и компанию. Отвечай только по теме ПДД.";

  const askRetry = lang === 'uz'
    ? ' FAQAT JSON qaytar, izohsiz: {"headline":"asosiy xulosa bir jumlada","weak":["3-5 aniq zaif joy, shablon raqamlari bilan"],"plan":["bugun uchun 3-5 aniq harakat"]}. O\'zbek tilida yoz.'
    : ' Верни ТОЛЬКО JSON, без пояснений: {"headline":"главный вывод одним предложением","weak":["3-5 конкретных слабых мест с номерами шаблонов"],"plan":["3-5 конкретных действий на сегодня"]}. Пиши по-русски.';

  async function callModel(maxTokens: number): Promise<Response> {
    return fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: (lang === 'uz' ? 'Statistika (JSON): ' : 'Статистика (JSON): ') + summaryStr + askRetry },
        ],
        stream: false,
        temperature: 0.4,
        max_tokens: maxTokens,
      }),
    });
  }

  let upstream = await callModel(2500);
  if (!upstream.ok) {
    const e1 = await upstream.text().catch(() => '');
    console.error('Analysis upstream error:', upstream.status, e1);
    return err('ai_error', 502, origin);
  }
  let data = (await upstream.json()) as { choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }> };
  let choice = data.choices && data.choices[0];
  /* reasoning-модель могла съесть токены на рассуждения — повтор с большим лимитом */
  if ((!choice || !choice.message || !choice.message.content) && choice && choice.finish_reason === 'length') {
    upstream = await callModel(4000);
    if (upstream.ok) {
      data = (await upstream.json()) as typeof data;
      choice = data.choices && data.choices[0];
    }
  }
  const content = (choice && choice.message && choice.message.content) || '';

  /* устойчивый парсинг JSON из ответа модели */
  let parsed: { headline?: string; weak?: unknown; plan?: unknown } | null = null;
  try {
    const cleaned = content.replace(/```json/gi, '').replace(/```/g, '');
    const a = cleaned.indexOf('{');
    const b = cleaned.lastIndexOf('}');
    if (a >= 0 && b > a) parsed = JSON.parse(cleaned.slice(a, b + 1));
  } catch {
    parsed = null;
  }
  const headline = parsed && typeof parsed.headline === 'string' ? parsed.headline : content.trim().slice(0, 300);
  const toList = (v: unknown): string[] => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 6) as string[] : [];
  const result = {
    headline,
    weak: parsed ? toList(parsed.weak) : [] as string[],
    plan: parsed ? toList(parsed.plan) : [] as string[],
    window: win,
    generatedAt: Date.now(),
  };

  try {
    await env.PROGRESS.put(cacheKey, JSON.stringify(result), { expirationTtl: 259200 });
  } catch (e) {
    console.error('Analysis cache write failed:', e);
  }
  return json(Object.assign({}, result, { cached: false }), 200, origin);
}

/* ---------- dispatcher ---------- */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;

    if (req.method === 'OPTIONS') {
      return handleOptions(origin);
    }

    if (req.method !== 'POST') {
      return err('Method not allowed', 405, origin);
    }

    const path = new URL(req.url).pathname;

    if (path === '/auth/register') return handleRegister(req, env, origin);
    if (path === '/auth/login') return handleLogin(req, env, origin);
    if (path === '/sync/pull') return handleSyncPull(req, env, origin);
    if (path === '/sync/push') return handleSyncPush(req, env, origin);
    if (path === '/analysis/get') return handleAnalysis(req, env, origin);

    return handleAIProxy(req, env, origin);
  },
} satisfies ExportedHandler<Env>;