# SAVT + AI (NVIDIA Nemotron) — Инструкция по деплою

## Архитектура

```
Пользователь → GitHub Pages (статика) → Cloudflare Worker (Edge) → NVIDIA API (GPU кластеры)
                                                    ↓
                                           Vision модель (если есть картинка)
```

**Важно:** Ваш ноутбук/ПК **не участвует** — всё в облаке 24/7.

---

## 1. Получите NVIDIA API Key

1. Зайдите на **[build.nvidia.com](https://build.nvidia.com)**
2. Sign in / Register
3. **API Keys** → **Create Key** → скопируйте `nvapi-...`
4. Проверьте доступ к модели **Nemotron 3.5 Super VL 120B** (Vision + Reasoning)

> Если VL недоступна — используйте `nvidia/nemotron-3-ultra` (текст, 1M контекст, максимальный IQ)

---

## 2. Деплой Cloudflare Worker

```bash
cd /путь/к/репо/savt/worker

# Установите Wrangler CLI
npm i -g wrangler

# Авторизация в Cloudflare
wrangler login

# Секреты (ключ НЕ в коде, а в зашифрованном хранилище CF)
wrangler secret put AI_API_KEY
# Вставьте ваш nvapi-... ключ

wrangler secret put AI_BASE_URL
# Вставьте: https://integrate.api.nvidia.com/v1

wrangler secret put AI_MODEL
# Vision: nvidia/nemotron-3.5-super-vl-120b
# Или текст: nvidia/nemotron-3-ultra

# Деплой
wrangler deploy
```

**Результат:** `https://savt-ai.ВАШ-ПОДДОМЕН.workers.dev`

---

## 3. Обновите 2 файла с вашим поддоменом

**`app.js`** (строка ~29):
```js
const AI_ENDPOINT = 'https://savt-ai.ВАШ-ПОДДОМЕН.workers.dev';
```

**`index.html`** (строка 7, CSP):
```html
connect-src 'self' https://savt-ai.ВАШ-ПОДДОМЕН.workers.dev
```

---

## 4. Пуш на GitHub Pages

```bash
git add .
git commit -m "feat: AI assistant with NVIDIA Nemotron Vision"
git push origin master
```

---

## Как работает Vision в тестах

1. В разборе теста пользователь нажимает **🤖 ИИ-помощник** в карточке вопроса (на главной — плавающая кнопка **🤖** открывает общий чат по ПДД)
2. Фронтенд находит `<img>` в вопросе → загружает → конвертирует в **base64**
3. Отправляет в Worker как `image_url` (OpenAI Vision format):
   ```json
   {
     "role": "user",
     "content": [
       {"type": "text", "text": "Контекст вопроса..."},
       {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,/9j/..."}}
     ]
   }
   ```
4. Worker проксирует на **Nemotron 3.5 Super VL 120B**
5. Модель «видит» схему/знак/разметку → даёт разбор с учётом визуальных деталей

---

## Модели NVIDIA (публичный API)

| Модель | Vision | Reasoning | Контекст | Скорость | Best for |
|--------|--------|-----------|----------|----------|----------|
| **Nemotron 3.5 Super VL 120B** | ✅ | ✅ | 128K | ~2.3s | **Вопросы с картинками** |
| **Nemotron 3 Ultra** | ❌ | ✅ Сильное | 1M | ~1.3s | Текст, сложные рассуждения |
| **Nemotron 3.5 Ultra** | ❌ | ✅ | 1M | ~1.3s | Общий |
| **Nemotron 3 Nano Omni** | ✅ | ✅ | — | ~3.4s | OCR, документы |
| **Nemotron 3.5 Lightning** | ❌ | ⚠️ Базовое | — | ~1s | Только скорость |

---

## Лимиты (бесплатно навсегда)

| Ресурс | Cloudflare Workers Free | NVIDIA API |
|--------|------------------------|------------|
| Запросов/день | 100 000 | Зависит от модели |
| CPU/запрос | 10 ms (30k для vision) | — |
| Ваш трафик | Годы хватит | Проверьте на build.nvidia.com |

---

## Troubleshooting

### «Network error» / «Failed to fetch»
- Проверьте `AI_ENDPOINT` в `app.js` = URL из `wrangler deploy`
- CSP в `index.html` — домен в `connect-src`
- DevTools → Network → запрос к Worker'у

### Worker 401/403
- `wrangler secret list` — проверьте `AI_API_KEY`
- На build.nvidia.com — валиден ли ключ, есть ли доступ к модели

### CORS ошибка
- `ALLOWED_ORIGIN` в `wrangler.toml` = **точно** ваш GitHub Pages URL (`https://...` без слеша)

### Картинка не грузится в чат
- Консоль браузера: `Failed to load image for AI`
- Проверьте CSP: `img-src 'self' data: https://back.eavtotalim.uz` — добавьте `https://ваш-worker.workers.dev` если нужно
- Картинки с `back.eavtotalim.uz` должны быть доступны (CORS там настроен)

### Vision модель отвечает «I cannot see images»
- Убедитесь, что `AI_MODEL = nvidia/nemotron-3.5-super-vl-120b`
- Проверьте логи Worker: `wrangler tail` → запрос содержит `image_url`

---

## Структура файлов

```
savt/
├── index.html          # + CSP, + CSS модалки
├── app.js              # + Vision: base64, image_url, NVIDIA константы
├── worker/
│   ├── src/index.ts    # Vision-прокси, валидация image_url
│   ├── wrangler.toml   # NVIDIA дефолты, 30s CPU limit
│   └── package.json
├── data.js / data_uz.js
└── DEPLOY_AI.md        # Этот файл
```

---

## Что дальше (идеи)

- [ ] Кэширование ответов в Cloudflare KV (экономия API)
- [ ] Предустановленные промпты: «Разбор ошибки», «Почему правильно?», «Аналогия»
- [ ] Мульти-턴 диалог с сохранением истории в localStorage
- [ ] Переключение модели в настройках (VL / Ultra / Lightning)
- [ ] Аналитика: какие вопросы со схемами чаще спрашивают → улучшать data.js

---

## Контакты

При проблемах:
1. F12 → Console → ошибки
2. `wrangler tail` — логи Worker в реальном времени
3. Cloudflare Dashboard → Workers → savt-ai → Logs
4. build.nvidia.com → API Keys → Usage
