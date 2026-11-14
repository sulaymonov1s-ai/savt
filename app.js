'use strict';
const $ = s => document.querySelector(s);
const view = $('#view');
const bottombar = $('#bottombar');
const DATA_RU = window.EAVT_DATA || {};
let DATA_UZ = window.EAVT_DATA_UZ || {};
function ensureUz(cb){
  if(Object.keys(DATA_UZ).length) return cb();
  const s = document.createElement('script');
  s.src = 'data_uz.js?v=202611141230';
  s.onload = ()=>{ DATA_UZ = window.EAVT_DATA_UZ || {}; cb(); };
  s.onerror = ()=> cb();
  document.body.appendChild(s);
}
const LS_KEY = 'eavt_progress_v1';
const LS_WRONG = 'eavt_wrong_v1';
const LS_THEME = 'eavt_theme';
const LS_SRS = 'eavt_srs_v1';
const LS_LANG = 'eavt_lang';
const LS_MSAVE = 'eavt_marathon_save_v1';
const LS_TIME = 'eavt_time_v1';
/* ---- УЧЁТ ВРЕМЕНИ: сколько минут идёт билет и где пользователь дольше всего думает ---- */
function loadTime(){ try{ return JSON.parse(localStorage.getItem(LS_TIME)||'{}'); }catch(e){ return {}; } }
function saveTime(t){ try{ localStorage.setItem(LS_TIME, JSON.stringify(t)); }catch(e){} }
/* ---- АРХИВ: результаты сброшенного прогресса сохраняются навсегда ---- */
const LS_ARCHIVE = 'eavt_archive_v1';
function loadArchive(){ try{ return JSON.parse(localStorage.getItem(LS_ARCHIVE)||'[]'); }catch(e){ return []; } }
function archiveProgress(){
  const prog = loadProgress();
  const ids = Object.keys(prog);
  if(!ids.length) return;
  const T = loadTime();
  const D = data();
  const items = ids.map(id=>{
    const p = prog[id];
    const tt = D[id];
    const tm = T[id];
    return { n: tt ? String(tt.name) : id,
             p: Math.round(p.correct/p.total*100),
             min: tm && tm.wall ? Math.round(tm.wall/60000) : null,
             think: tm && tm.cnt ? Math.round(tm.think/tm.cnt/1000) : null };
  });
  const avg = Math.round(items.reduce((s,x)=>s+x.p,0)/items.length);
  const arr = loadArchive();
  arr.push({ ts: Date.now(), avg: avg, items: items });
  try{ localStorage.setItem(LS_ARCHIVE, JSON.stringify(arr.slice(-20))); }catch(e){}
}
const MSAVE_V = 1;
const EXAM_MINUTES = 25;
const IS_MOBILE = matchMedia('(max-width:640px)').matches;

/* ---------- i18n ---------- */

/* ---------- AI CONFIG ---------- */
// Worker endpoint — замените на свой после деплоя: https://savt-ai.ваш-никнейм.workers.dev
const AI_ENDPOINT = 'https://savt-ai.sulaymonov1s.workers.dev';
const AI_MODEL = 'nvidia/nemotron-3.5-super-vl-120b-a12b';
const AI_MAX_TOKENS = 3000;
const AI_TEMPERATURE = 0.6;

/* ---------- ICONS (Material Line / lucide-style, inline SVG) ---------- */
const ICONS = {
  home: '<path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  brain: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  sync: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  robot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  cross: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  traffic: '<rect width="10" height="20" x="7" y="2" rx="5"/><path d="M12 6.5h.01"/><path d="M12 12h.01"/><path d="M12 17.5h.01"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'
};
/* убирает ведущие эмодзи/символы из i18n-строк для рендера с SVG-иконкой */
function stripEmo(s){ return String(s).replace(/^[^\p{L}\p{N}]+/u, ''); }
function icon(name, cls){
  return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
}

const I18N = {
  ru: {
    nav_home: 'Главная', nav_marathon: 'Марафон вопросов', nav_wrong: 'Работа над ошибками',
    nav_stats: 'Успеваемость', nav_settings: 'Настройки', theme_day: 'День', theme_night: 'Ночь',
    cancel: 'Отмена', yes: 'Да',
    back: '← Назад',
    roadmap: 'Дорожная карта',
    marathon: '🏃 Марафон', srs_btn: '🧠 Повторить', wrong_btn: '🛠 Ошибки', reset: 'Сброс',
    best: 'Лучший результат сохранён', not_done: 'Ещё не пройден',
    reset_title: 'Сброс прогресса', reset_text: 'Прогресс по билетам будет сброшен. Результаты заархивируются в раздел «Архив», копилка ошибок останется.', reset_ok: 'Сбросить и архивировать',
    archive: '🗄 Архив', archive_empty: 'Архив пуст. Сбросьте прогресс после прохождения — результаты (проценты, время) сохранятся сюда навсегда.',
    archive_sub: n => 'Сбросов прогресса: ' + n + ' · ошибки и время сохранены',
    archive_back: 'На главную',
    q_count: 'вопросов', details: 'Детали теста',
    wrong_desc: 'Собраны все вопросы, на которые вы отвечали неправильно. Ответите верно — вопрос уйдёт из списка.',
    settings: '⚙ Настройки теста',
    shuf_q: 'Перемешать вопросы', shuf_qd: 'Вопросы в разном порядке каждый раз',
    shuf_a: 'Перемешать ответы', shuf_ad: 'Варианты ответов меняются местами',
    start_test: '▶ Начать тест',
    total_q: 'вопросов всего', repeat_label: 'к повторению',
    srs_title: '🧠 Умное повторение',
    marathon_title: '🏃 Марафон',
    srs_desc: 'Метод интервальных повторений: вопросы возвращаются через 10 мин → 1 день → 3 дня → 7 дней → 30 дней. Так мозг запоминает надолго.',
    marathon_desc: 'Вопросы из всех шаблонов. Слабые вопросы показываются чаще. Выберите сколько решить.',
    amount: 'Количество вопросов',
    start_repeat: '▶ Начать повторение', start_marathon: '▶ Начать марафон',
    wrong_title: '🛠 Работа над ошибками',
    finish: 'Завершить',
    exit_title: 'Выйти из теста?', exit_text: 'Прогресс этой попытки не сохранится.', exit_ok: 'Выйти',
    finish_title: 'Завершить тест?',
    pick: 'Выберите ответ', answered: 'Ответ дан', next: 'Далее →', to_result: 'К результату →',
    expl_good: '✓ Верно.', expl_bad: '✗ Неверно.',
    timeout: 'Время вышло', pass: 'Зачёт', fail: 'Незачёт (нужно ≥70%)',
    home_btn: 'К шаблонам', retry: 'Ещё раз', next_tpl: 'Следующий шаблон →',
    review: 'Разбор ответов', expl_lbl: 'Пояснение:',
    stats_title: '📊 Успеваемость', right_ans: 'верных ответов',
    no_wrong: 'ошибок нет',
    badges_ttl: 'Достижения', by_tpl: 'По шаблонам',
    badge_first: 'Первый тест', badge_10: '10 зачётов', badge_clean: 'Чистые ошибки',
    badge_3days: 'Серия 3 дня', badge_all: 'Все 64 шаблона',
    time_res: (m, s) => '⏱ Время: ' + m + ' мин · в среднем ' + s + ' с размышлений на вопрос',
    no_data: 'Файл <b>data.js</b> не найден или пуст.<br>Положите его рядом с index.html',
    streak_days: n => n + ' ' + (n === 1 ? 'день' : n < 5 ? 'дня' : 'дней') + ' подряд',
    sub: (n, q) => n + ' шаблона · ' + q + ' вопросов',
    footer: '𝑐𝑟𝑒𝑎𝑡 𝑏𝑦 𝑆𝑢𝑙𝑎𝑦𝑚𝑜𝑛𝑜𝑣.1𝑠',
    tpl_name: n => /^\d+$/.test(String(n)) ? 'Шаблон №' + n : n,
    q_of: (x, y) => 'Вопрос ' + x + ' из ' + y,
    q_num: x => 'Вопрос ' + x,
    roadmap_sub: n => n + ' шаблонов · прогресс сохраняется локально',
    right_chip: (c, t) => c + ' верных из ' + t,
    wrong_work: n => n + ' в работе над ошибками',
    weak: n => n + ' слабых вопросов',
    of_total: n => 'из ' + n,
    due: n => '🧠 ' + n + ' к повторению',
    unanswered: n => 'Осталось без ответа: ' + n + '.',
    setup_desc: n => 'Тест состоит из ' + n + ' вопросов. Таймер 25 минут. Правильность ответов видна при возврате к вопросу и в разборе в конце.',
    letters: 'АБВГДЕЖЗ',
    pause_btn: 'Пауза и сохранить',
    fs_btn: 'Полноэкранный режим',
    m_short: 'Марафон', s_short: 'Повтор', w_short: 'Ошибки', r_short: 'Сброс',
    pause_title: 'Поставить на паузу?',
    pause_text: 'Прогресс марафона сохранится, вы сможете продолжить позже с этого же места.',
    pause_ok: 'Сохранить и выйти',
    pause_saved: '✓ Марафон сохранён — продолжите позже',
    pause_failed: '✗ Не удалось сохранить: нет места в хранилище',
    resume_title: 'Есть сохранённый марафон',
    resume_btn: '▶ Продолжить сохранённый',
    restart_btn: 'Начать заново',
    resume_discard_title: 'Начать марафон заново?',
    resume_discard_text: 'Сохранённый марафон будет удалён без возможности восстановления.',
    resume_discard_ok: 'Удалить и начать',
    resume_lang_warn: 'Сохранение сделано на другом языке — вопросы будут показаны на нём.',
    resume_stale: 'Сохранение устарело и было удалено.',
    saved_meta: (a, n, left) => 'Отвечено ' + a + ' из ' + n + ' · осталось ' + left,
    saved_when: s => 'Сохранено ' + s,
    ago_now: 'только что',
    ago_min: n => n + ' мин назад',
    ago_hour: n => n + ' ' + (n === 1 ? 'час' : n < 5 ? 'часа' : 'часов') + ' назад',
    ago_day: n => n + ' ' + (n === 1 ? 'день' : n < 5 ? 'дня' : 'дней') + ' назад',
    offline: 'офлайн',
    stage_locked: 'Ещё не пройден',
    stage_current: 'Следующий этап',
    stage_perfect: 'Пройден на 100%',
    modes: 'Режимы',
    ai_btn: '🤖 ИИ-помощник', ai_title: 'Чат с ИИ', ai_placeholder: 'Спросите про этот вопрос...', ai_thinking: 'ИИ думает...', ai_error: 'Ошибка ИИ, попробуйте позже', ai_context_q: 'Вопрос:', ai_context_a: 'Ваш ответ:', ai_context_correct: 'Правильный ответ:', ai_prompt_hint: 'Можете спросить: почему это правильный ответ, разбор ошибки, похожие ситуации, просто объяснить проще.', ai_fab_title: 'ИИ-помощник по ПДД', ai_general_title: 'ИИ-помощник по ПДД', ai_general_placeholder: 'Спросите что угодно про ПДД...', ai_send: '➤', ai_timeout: 'ИИ не ответил (таймаут). Попробуйте ещё раз.', aa_title: 'ИИ-анализ слабых мест', aa_morning: 'утренний', aa_evening: 'вечерний', aa_loading: 'ИИ изучает ваш прогресс…', aa_weak: 'Слабые места', aa_plan: 'План на сегодня', aa_train: '▶ Тренировать слабые места', aa_error: 'Не удалось получить анализ', aa_fresh: 'Обновить анализ', aa_login_cta: 'Войдите в аккаунт, чтобы 2 раза в день получать персональный ИИ-анализ слабых мест.',
    auth_title: 'Аккаунт', login: 'Войти', register: 'Регистрация', email: 'Email', password: 'Пароль', logout: 'Выйти', sync: 'Синхронизировать', sync_ok: '✓ Прогресс синхронизирован', sync_fail: '✗ Ошибка синхронизации', auth_err_email: 'Некорректный email', auth_err_pass: 'Пароль от 6 символов', auth_err: 'Ошибка: проверьте данные', auth_exists: 'Такой email уже зарегистрирован', auth_bad: 'Неверный email или пароль', auth_login_tab: 'Вход', auth_reg_tab: 'Регистрация', auth_signed: '✓ Вход выполнен', auth_bye: 'Вы вышли из аккаунта', auth_net: 'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.', auth_confirm_title: 'Подтвердите вход', auth_confirm_hint: 'Для защиты прогресса подтвердите вход — введите пароль. Это раз в неделю.', auth_skip: 'Продолжить без аккаунта', splash_tagline: 'Тренажёр экзамена ПДД', mistakes_focus: n => 'Фокус на повторных ошибках: ' + n, repeated_mistakes: n => 'Повторные ошибки: ' + n, marathon_focus_note: 'Вопросы, в которых вы ошибались, показываются чаще и в начале.'
  },
  uz: {
    nav_home: 'Bosh sahifa', nav_marathon: 'Savollar marafoni', nav_wrong: 'Xatolar ustida ishlash',
    nav_stats: 'Natijalar', nav_settings: 'Sozlamalar', theme_day: 'Kun', theme_night: 'Tun',
    cancel: 'Bekor qilish', yes: 'Ha',
    back: '← Orqaga',
    roadmap: "Yo'l xaritasi",
    marathon: '🏃 Marafon', srs_btn: '🧠 Takrorlash', wrong_btn: '🛠 Xatolar', reset: 'Tozalash',
    best: 'Eng yaxshi natija saqlandi', not_done: 'Hali bajarilmagan',
    reset_title: 'Progressni tozalash', reset_text: "Biletlar bo'yicha progress tozalanadi. Natijalar «Arxiv» bo'limiga arxivlanadi, xatolar to'plami qoladi.", reset_ok: 'Tozalash va arxivlash',
    archive: '🗄 Arxiv', archive_empty: 'Arxiv bo\u2018sh. Progressni tozalagach natijalar (foiz, vaqt) bu yerda abadiy saqlanadi.',
    archive_sub: n => 'Progress tozalashlar: ' + n + ' · xatolar va vaqt saqlangan',
    archive_back: 'Bosh sahifa',
    q_count: 'savol', details: 'Test tafsilotlari',
    wrong_desc: "Barcha noto'g'ri javob berilgan savollar yig'iladi. To'g'ri javob bersangiz — savol ro'yxatdan o'chadi.",
    settings: '⚙ Test sozlamalari',
    shuf_q: 'Savollarni aralashtirish', shuf_qd: 'Har safar savollar turli tartibda',
    shuf_a: 'Javoblarni aralashtirish', shuf_ad: 'Javob variantlari almashinadi',
    start_test: '▶ Testni boshlash',
    total_q: 'jami savol', repeat_label: 'takrorlashga',
    srs_title: '🧠 Aqlli takrorlash',
    marathon_title: '🏃 Marafon',
    srs_desc: "Interval takrorlash metodika: savollar 10 daqiqa → 1 kun → 3 kun → 7 kun → 30 kun keyin qaytadi. Shunday miya uzoq eslaydi.",
    marathon_desc: "Barcha shablonlardagi savollar. Zaif savollar tez-tez ko'rsatiladi. Nechta savol meni tanlashni tanlang.",
    amount: 'Savollar soni',
    start_repeat: '▶ Takrorlashni boshlash', start_marathon: '▶ Marafonni boshlash',
    wrong_title: '🛠 Xatolar ustida ishlash',
    finish: 'Yakunlash',
    exit_title: 'Testdan chiqilsinmi?', exit_text: 'Bu urinish natijasi saqlanmaydi.', exit_ok: 'Chiqish',
    finish_title: 'Test yakunlansinmi?',
    pick: 'Javobni tanlang', answered: 'Javob berildi', next: 'Keyingi →', to_result: 'Natijaga →',
    expl_good: "✓ To'g'ri.", expl_bad: "✗ Noto'g'ri.",
    timeout: 'Vaqt tugadi', pass: "O'tdi", fail: "O'tmadi (≥70% kerak)",
    home_btn: 'Shablonlarga', retry: 'Yana bir bor', next_tpl: 'Keyingi shablon →',
    review: 'Javoblar tahlili', expl_lbl: 'Izoh:',
    stats_title: '📊 Natijalar', right_ans: "to'g'ri javoblar",
    no_wrong: "xatolar yo'q",
    badges_ttl: 'Yutuqlar', by_tpl: 'Shablonlar bo‘yicha',
    badge_first: 'Birinchi test', badge_10: "10 o'tish", badge_clean: 'Xatolarsiz',
    badge_3days: '3 kun seriya', badge_all: 'Barcha 64 shablon',
    time_res: (m, s) => '⏱ Vaqt: ' + m + ' daqiqa · o\u2018rtacha ' + s + ' s bitta savolga',
    no_data: "Fayl <b>data.js</b> topilmadi yoki bo'sh.<br>Uni index.html yoniga qo'ying",
    streak_days: n => n + ' kun ketma-ket',
    sub: (n, q) => n + ' shablon · ' + q + ' savol',
    footer: '𝑐𝑟𝑒𝑎𝑡 𝑏𝑦 𝑆𝑢𝑙𝑎𝑦𝑚𝑜𝑛𝑜𝑣.1𝑠',
    tpl_name: n => /^\d+$/.test(String(n)) ? n + '-shablon' : n,
    q_of: (x, y) => x + '-savol / ' + y,
    q_num: x => x + '-savol',
    roadmap_sub: n => n + ' shablon · progress lokal saqlanadi',
    right_chip: (c, t) => t + ' tadan ' + c + " to'g'ri",
    wrong_work: n => n + ' xato ustida ishlanmoqda',
    weak: n => n + ' zaif savol',
    of_total: n => n + ' dan',
    due: n => '🧠 ' + n + ' takrorlashga',
    unanswered: n => 'Javobsiz qoldi: ' + n + '.',
    setup_desc: n => 'Test ' + n + " savoldan iborat. Taymer 25 daqiqa. Javoblar to'g'riligi savolga qaytganda va oxiridagi tahlilda ko'rinadi.",
    letters: 'ABCDEFGH',
    pause_btn: 'Pauza va saqlash',
    fs_btn: 'Butun ekran rejimi',
    m_short: 'Marafon', s_short: 'Takror', w_short: 'Xato', r_short: 'Tozalash',
    pause_title: 'Pauzaga qo‘yilsinmi?',
    pause_text: 'Marafon progressi saqlanadi, keyinroq shu joydan davom ettirishingiz mumkin.',
    pause_ok: 'Saqlash va chiqish',
    pause_saved: '✓ Marafon saqlandi — keyinroq davom eting',
    pause_failed: '✗ Saqlab bo‘lmadi: xotirada joy yo‘q',
    resume_title: 'Saqlangan marafon bor',
    resume_btn: '▶ Saqlanganini davom ettirish',
    restart_btn: 'Boshidan boshlash',
    resume_discard_title: 'Marafon boshidan boshlansinmi?',
    resume_discard_text: 'Saqlangan marafon tiklab bo‘lmaydigan tarzda o‘chiriladi.',
    resume_discard_ok: 'O‘chirish va boshlash',
    resume_lang_warn: 'Saqlash boshqa tilda qilingan — savollar o‘sha tilda ko‘rsatiladi.',
    resume_stale: 'Saqlash eskirgan va o‘chirildi.',
    saved_meta: (a, n, left) => n + ' tadan ' + a + ' javob berilgan · ' + left + ' qoldi',
    saved_when: s => s + ' saqlangan',
    ago_now: 'hozirgina',
    ago_min: n => n + ' daqiqa oldin',
    ago_hour: n => n + ' soat oldin',
    ago_day: n => n + ' kun oldin',
    offline: 'oflayn',
    stage_locked: 'Hali bajarilmagan',
    stage_current: 'Keyingi bosqich',
    stage_perfect: '100% bajarilgan',
    modes: 'Rejimlar',
    ai_btn: "🤖 AI yordamchi", ai_title: "AI bilan chat", ai_placeholder: "Bu savol haqida so'rang...", ai_thinking: "AI o'ylayapti...", ai_error: "AI xatosi, keyinroq urinib ko'ring", ai_context_q: "Savol:", ai_context_a: "Sizning javobingiz:", ai_context_correct: "To'g'ri javob:", ai_prompt_hint: "So'rishingiz mumkin: nima uchun bu to'g'ri javob, xato tahlili, o'xshash holatlar, soddalashtirib tushuntirish.", ai_fab_title: "PPD bo'yicha AI yordamchi", ai_general_title: "PPD bo'yicha AI yordamchi", ai_general_placeholder: "PPD haqida istalgan narsani so'rang...", ai_send: "➤", ai_timeout: "AI javob bermadi (timeout). Yana urinib ko'ring.", aa_title: "AI zaif joylar tahlili", aa_morning: "ertalabki", aa_evening: "kechki", aa_loading: "AI progressingizni o'rganmoqda…", aa_weak: "Zaif joylar", aa_plan: "Bugungi reja", aa_train: "▶ Zaif joylarni mashq qilish", aa_error: "Tahlil olib bo'lmadi", aa_fresh: "Tahlilni yangilash", aa_login_cta: "Zaif joylaringizni kuniga 2 marta AI tahlil qilishi uchun akkauntga kiring.",
    auth_title: "Akkaunt", login: "Kirish", register: "Ro'yxatdan o'tish", email: "Email", password: "Parol", logout: "Chiqish", sync: "Sinxronlash", sync_ok: "✓ Progress sinxronlandi", sync_fail: "✗ Sinxronlashda xato", auth_err_email: "Email noto'g'ri", auth_err_pass: "Parol 6 belgidan kamida", auth_err: "Xato: ma'lumotlarni tekshiring", auth_exists: "Bu email allaqachon ro'yxatdan o'tgan", auth_bad: "Email yoki parol noto'g'ri", auth_login_tab: "Kirish", auth_reg_tab: "Ro'yxatdan o'tish", auth_signed: "✓ Kirish bajarildi", auth_bye: "Akkauntdan chiqdingiz", auth_net: "Server bilan aloqa yo'q. Internetni tekshirib, yana urinib ko'ring.", auth_confirm_title: "Kirishni tasdiqlash", auth_confirm_hint: "Progress himoyasi uchun kirishni tasdiqlang — parolni kiriting. Bu haftada bir marta.", auth_skip: "Akkauntsiz davom etish", splash_tagline: "PPD imtihoni treningi", mistakes_focus: n => "Takroriy xatolarga fokus: " + n, repeated_mistakes: n => "Takroriy xatolar: " + n, marathon_focus_note: "Xato qilgan savollaringiz ko'proq va boshida ko'rsatiladi."
  },
};
let LANG = localStorage.getItem(LS_LANG) || 'ru';
function ln(){ return I18N[LANG] || I18N.ru; }
function t(k){ return ln()[k]; }
function data(){
  return (LANG === 'uz' && Object.keys(DATA_UZ).length) ? DATA_UZ : DATA_RU;
}
function letters(){ return t('letters'); }
function updateChrome(){
  const D = data();
  const ids = Object.keys(D);
  const qTotal = Object.values(D).reduce((s, v) => s + v.questions.length, 0);
  $('#subLbl').textContent = ln().sub(ids.length, qTotal);
  $('#foot').textContent = t('footer');
  $('#navHome').textContent = t('nav_home');
  $('#navMarathon').textContent = t('nav_marathon');
  $('#navWrong').textContent = t('nav_wrong');
  $('#navStats').textContent = t('nav_stats');
  $('#navSettings').textContent = t('nav_settings');
  $('#langsw').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.lang === LANG));
  $('#offlineLbl').textContent = t('offline');
  const stl = $('#splashTagline');
  if(stl) stl.textContent = t('splash_tagline');
  const auth = authInfo();
  $('#navAuth').textContent = auth ? auth.email : t('login');
  $('#navSync').hidden = !auth;
  $('#navLogout').hidden = !auth;
  $('#navSyncLbl').textContent = t('sync');
  $('#navLogoutLbl').textContent = t('logout');
  const authLbl = $('#authLbl');
  if(authLbl){ authLbl.textContent = auth ? auth.email : ''; authLbl.hidden = !auth; }
  moveLangSlider();
}

/* скользящий индикатор сегментированного переключателя языка */
function moveLangSlider(){
  const sw = $('#langsw'), sl = $('#langSlider');
  if(!sw || !sl) return;
  const act = sw.querySelector('button.on');
  if(!act) return;
  sl.style.width = act.offsetWidth + 'px';
  sl.style.transform = 'translateX(' + (act.offsetLeft - 3) + 'px)';
}
addEventListener('resize', moveLangSlider);
function setLang(l){
  if(l === 'uz' && !Object.keys(DATA_UZ).length){
    view.innerHTML = '<div class="glass empty">Yuklanmoqda…</div>';
    ensureUz(()=> applyLang(l));
    return;
  }
  applyLang(l);
}
function applyLang(l){
  LANG = l;
  localStorage.setItem(LS_LANG, l);
  updateChrome();
  go('home');
}

function loadProgress(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||'{}'); }catch(e){ return {}; } }
function saveProgress(p){ try{ localStorage.setItem(LS_KEY, JSON.stringify(p)); }catch(e){} }
function loadWrong(){ try{ return JSON.parse(localStorage.getItem(LS_WRONG)||'{}'); }catch(e){ return {}; } }
function saveWrong(w){ try{ localStorage.setItem(LS_WRONG, JSON.stringify(w)); }catch(e){} }
function markWrong(tplId, origIdx){
  const w = loadWrong();
  (w[tplId] = w[tplId] || {})[origIdx] = 1;
  saveWrong(w);
}
function markRight(tplId, origIdx){
  const w = loadWrong();
  if(w[tplId] && w[tplId][origIdx] !== undefined){
    delete w[tplId][origIdx];
    if(!Object.keys(w[tplId]).length) delete w[tplId];
    saveWrong(w);
  }
}
function wrongCount(){
  const w = loadWrong();
  return Object.values(w).reduce((n,o)=>n+Object.keys(o).length, 0);
}

/* ---------- MISTAKES (счётчик повторных ошибок) ---------- */
const LS_MISTAKES = 'eavt_mistakes_v1';
function loadMistakes(){ try{ return JSON.parse(localStorage.getItem(LS_MISTAKES)||'{}'); }catch(e){ return {}; } }
function saveMistakes(m){ try{ localStorage.setItem(LS_MISTAKES, JSON.stringify(m)); }catch(e){} }
function markMistake(tplId, orig){
  const m = loadMistakes();
  const k = tplId + ':' + orig;
  const e = m[k] || { c: 0, t: 0 };
  e.c = (e.c||0) + 1;
  e.t = Date.now();
  m[k] = e;
  saveMistakes(m);
}
function repeatedMistakes(){
  const m = loadMistakes();
  return Object.keys(m).filter(k=> (m[k].c||0) >= 2).length;
}

/* ---------- AUTH / PROGRESS SYNC ---------- */
const LS_AUTH = 'eavt_auth_v1';
/* повторное подтверждение входа паролем — раз в неделю */
const AUTH_CONFIRM_TTL = 7*24*3600*1000;
const LS_SKIPPED = 'eavt_skipped_v1';
function authInfo(){
  try{
    const a = JSON.parse(localStorage.getItem(LS_AUTH)||'null');
    return (a && a.token && a.email) ? a : null;
  }catch(e){ return null; }
}
function authHeaders(){
  const a = authInfo();
  return a ? { 'Authorization': 'Bearer ' + a.token } : {};
}
function clearAuth(){ try{ localStorage.removeItem(LS_AUTH); }catch(e){} }

function buildProgress(){
  let history = [];
  try{ history = JSON.parse(localStorage.getItem('eavt_history')||'[]'); }catch(e){}
  return { prog: loadProgress(), wrong: loadWrong(), srs: loadSRS(), mistakes: loadMistakes(), history: history };
}

/* Слияние пришедшего с сервера прогресса с локальным:
   prog — лучшая попытка (correct, при равенстве — свежее ts);
   wrong — объединение ключей; srs — больший stage (при равенстве — поздний next);
   mistakes — max c (при равенстве — поздний t); history — union по ts, свежие сверху, cap 200. */
function saveMergedProgress(p){
  if(!p || typeof p !== 'object') return;
  if(p.prog && typeof p.prog === 'object'){
    const local = loadProgress();
    Object.keys(p.prog).forEach(id=>{
      const r = p.prog[id], l = local[id];
      if(!l || (r.correct||0) > l.correct || ((r.correct||0) === l.correct && (r.ts||0) > (l.ts||0))) local[id] = r;
    });
    saveProgress(local);
  }
  if(p.wrong && typeof p.wrong === 'object'){
    const w = loadWrong();
    Object.keys(p.wrong).forEach(tid=>{
      w[tid] = w[tid] || {};
      const src = p.wrong[tid];
      if(src && typeof src === 'object') Object.keys(src).forEach(oi=>{ w[tid][oi] = 1; });
    });
    saveWrong(w);
  }
  if(p.srs && typeof p.srs === 'object'){
    const s = loadSRS();
    Object.keys(p.srs).forEach(k=>{
      const r = p.srs[k], l = s[k];
      if(!l || (r.stage||0) > (l.stage||0) || ((r.stage||0) === (l.stage||0) && (r.next||0) > (l.next||0))) s[k] = r;
    });
    saveSRS(s);
  }
  if(p.mistakes && typeof p.mistakes === 'object'){
    const m = loadMistakes();
    Object.keys(p.mistakes).forEach(k=>{
      const r = p.mistakes[k], l = m[k];
      if(!l || (r.c||0) > (l.c||0) || ((r.c||0) === (l.c||0) && (r.t||0) > (l.t||0))) m[k] = r;
    });
    saveMistakes(m);
  }
  if(Array.isArray(p.history)){
    let h = [];
    try{ h = JSON.parse(localStorage.getItem('eavt_history')||'[]'); }catch(e){}
    const seen = {};
    h = h.concat(p.history).filter(x=>{ if(x && x.ts && !seen[x.ts]){ seen[x.ts] = 1; return true; } return false; });
    h.sort((a,b)=> b.ts - a.ts);
    try{ localStorage.setItem('eavt_history', JSON.stringify(h.slice(0,200))); }catch(e){}
  }
}

async function syncPull(showFeedback){
  if(!authInfo()) return;
  try{
    const resp = await fetch(AI_ENDPOINT + '/sync/pull', { method: 'POST', headers: authHeaders() });
    if(resp.status === 401){
      clearAuth();
      updateChrome();
      toast(t('sync_fail'));
      /* токен истёк — на страницу входа, если мы уже не на ней */
      if(!document.querySelector('#authPage')) go('auth', { confirm: false });
      return;
    }
    if(!resp.ok){ if(showFeedback) toast(t('sync_fail')); return; }
    let data = null;
    try{ data = await resp.json(); }catch(e){}
    if(data && data.progress && typeof data.progress === 'object'){
      saveMergedProgress(data.progress);
      updateChrome();
      if(showFeedback) toast(t('sync_ok'));
      syncPush(false);
    } else {
      /* в облаке ещё ничего нет — заливаем локальный прогресс (двусторонняя синхронизация) */
      syncPush(false);
      if(showFeedback) toast(t('sync_ok'));
    }
  }catch(e){ if(showFeedback) toast(t('sync_fail')); }
}

async function syncPush(showFeedback){
  if(!authInfo()) return;
  try{
    const resp = await fetch(AI_ENDPOINT + '/sync/push', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ progress: buildProgress() })
    });
    if(resp.status === 401){ clearAuth(); updateChrome(); if(showFeedback) toast(t('sync_fail')); return; }
    if(showFeedback) toast(resp.ok ? t('sync_ok') : t('sync_fail'));
  }catch(e){ if(showFeedback) toast(t('sync_fail')); }
}

/* ---------- ИИ-АНАЛИЗ СЛАБЫХ МЕСТ (2 раза в день) ---------- */
function buildAnalysisSummary(){
  const prog = loadProgress();
  const wrong = loadWrong();
  const mistakes = loadMistakes();
  const D = data();
  const ids = sortedIds();
  let correct = 0, total = 0;
  Object.values(prog).forEach(p=>{ correct += p.correct||0; total += p.total||0; });
  let hist = [];
  try{ hist = JSON.parse(localStorage.getItem('eavt_history')||'[]'); }catch(e){}
  const timeData = loadTime();
  const templates = ids.map(id=>{
    const p = prog[id];
    const tt = D[id];
    const tm = timeData[id];
    return { n: t('tpl_name')(tt.name), p: p ? Math.round(p.correct/p.total*100) : null, q: tt.questions.length,
             min: tm && tm.wall ? Math.round(tm.wall/60000) : null,
             think: tm && tm.cnt ? Math.round(tm.think/tm.cnt/1000) : null };
  });
  const byTpl = {};
  Object.keys(mistakes).forEach(k=>{
    const tid = k.split(':')[0];
    const e = mistakes[k];
    byTpl[tid] = byTpl[tid] || { m: 0, rep: 0 };
    byTpl[tid].m += e.c || 1;
    if((e.c||0) >= 2) byTpl[tid].rep += 1;
  });
  Object.keys(wrong).forEach(tid=>{
    byTpl[tid] = byTpl[tid] || { m: 0, rep: 0 };
    byTpl[tid].m += Object.keys(wrong[tid]).length;
  });
  const topMistakes = Object.entries(byTpl)
    .sort((a,b)=> b[1].m - a[1].m).slice(0, 10)
    .map(e=> ({ n: D[e[0]] ? t('tpl_name')(D[e[0]].name) : ('№' + e[0]), m: e[1].m, rep: e[1].rep }));
  const repeatedQuestions = Object.entries(mistakes)
    .filter(e=> (e[1].c||0) >= 2)
    .sort((a,b)=> (b[1].c||0) - (a[1].c||0)).slice(0, 5)
    .map(e=>{
      const parts = e[0].split(':');
      const tt = D[parts[0]];
      const q = tt ? tt.questions[+parts[1]] : null;
      return { t: tt ? t('tpl_name')(tt.name) : ('№' + parts[0]), c: e[1].c, q: q ? plainBody(q.body).slice(0, 60) : '' };
    });
  return {
    answeredTotal: total, correctTotal: correct, pct: total ? Math.round(correct/total*100) : 0,
    wrongCount: wrongCount(), dueCount: srsDueCount(),
    repeatedCount: Object.values(mistakes).filter(m=> (m.c||0) >= 2).length,
    templates: templates, topMistakes: topMistakes, repeatedQuestions: repeatedQuestions,
    recent: hist.slice(-7).map(h=> ({ p: Math.round(h.c/h.t*100), ts: h.ts }))
  };
}

async function fetchAnalysis(force){
  if(!authInfo()) return { guest: true };
  try{
    const resp = await fetch(AI_ENDPOINT + '/analysis/get', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ summary: buildAnalysisSummary(), lang: LANG, force: !!force })
    });
    if(resp.status === 401){ clearAuth(); updateChrome(); return { expired: true }; }
    if(!resp.ok) return { error: true };
    return { data: await resp.json() };
  }catch(e){ return { error: true }; }
}

let aaBusy = false;
async function renderAnalysisCard(force){
  const box = $('#aiAnalysis');
  if(!box || aaBusy) return;
  if(!authInfo()){
    box.innerHTML = '<div class="glass panel aacard">' +
      '<div class="aacard-head">' + icon('robot') + esc(t('aa_title')) + '</div>' +
      '<div class="aacard-hint">' + esc(t('aa_login_cta')) + '</div></div>';
    return;
  }
  aaBusy = true;
  box.innerHTML = '<div class="glass panel aacard">' +
    '<div class="aacard-head">' + icon('robot') + esc(t('aa_title')) +
      '<span class="aa-spacer"></span>' +
      '<button class="aacard-refresh" id="aaRefresh" title="' + esc(t('aa_fresh')) + '" aria-label="' + esc(t('aa_fresh')) + '">' + icon('sync') + '</button></div>' +
    '<div class="aacard-body" id="aaBody"><span class="aa-loading">' + esc(t('aa_loading')) + '</span></div></div>';
  $('#aaRefresh').addEventListener('click', ()=> rerenderAnalysis(true));
  const res = await fetchAnalysis(force);
  aaBusy = false;
  const body = $('#aaBody');
  if(!body) return;
  if(res.guest){ body.innerHTML = esc(t('aa_login_cta')); return; }
  if(res.expired || res.error){
    body.innerHTML = esc(t('aa_error')) + ' <button class="btn ghost" id="aaRetry" style="padding:4px 10px;font-size:12px;margin-left:6px">' + esc(t('retry')) + '</button>';
    const rb = $('#aaRetry');
    if(rb) rb.addEventListener('click', ()=> rerenderAnalysis(true));
    return;
  }
  const d = res.data;
  let html = '';
  if(d.headline) html += '<div class="aa-headline">' + esc(d.headline) + '</div>';
  if(d.weak && d.weak.length){
    html += '<div class="aa-sec"><b>' + icon('cross') + esc(t('aa_weak')) + '</b><ul>' + d.weak.map(x=> '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  }
  if(d.plan && d.plan.length){
    html += '<div class="aa-sec"><b>' + icon('check') + esc(t('aa_plan')) + '</b><ul>' + d.plan.map(x=> '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  }
  html += '<button class="btn primary" id="aaTrain">' + esc(t('aa_train')) + '</button>';
  html += '<div class="aa-when">' + esc((d.window === 'am' ? t('aa_morning') : t('aa_evening')) + ' · ' + agoText(d.generatedAt || Date.now())) + '</div>';
  body.innerHTML = html;
  const tb = $('#aaTrain');
  if(tb) tb.addEventListener('click', ()=> startSession({ marathon: true, srs: false, count: 20, shufQ: true, shufA: true }));
}
function rerenderAnalysis(force){
  const box = $('#aiAnalysis');
  if(box) box.innerHTML = '';
  aaBusy = false;
  renderAnalysisCard(force);
}

/* ---------- AUTH MODAL ---------- */
function closeAuthModal(){
  const m = $('#authModal');
  if(m) m.remove();
}

/* ---------- AUTH PAGE (гостям вместо модалки) ---------- */
/* имя сохранено: вызывающие (sidemenu data-nav="auth") продолжают работать */
function openAuthModal(){
  go('auth');
}

/* Общая логика входа/регистрации/еженедельного подтверждения.
   mode: 'login' | 'register' | 'confirm' (confirm — только пароль, без валидации email).
   Успех: сохраняем {token, email, lastConfirm} → home → syncPull().
   Ошибка сети (fetch throw — CORS/DNS/нет интернета): t('auth_net') + подсказка
   «Ещё раз», значения формы сохранены, кнопка снова активна. */
async function submitAuth(mode, email, pass, errEl, submitEl){
  if(mode !== 'confirm' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ errEl.textContent = t('auth_err_email'); return; }
  if(pass.length < 6){ errEl.textContent = t('auth_err_pass'); return; }
  errEl.textContent = '';
  submitEl.disabled = true;
  try{
    const resp = await fetch(AI_ENDPOINT + (mode === 'register' ? '/auth/register' : '/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass })
    });
    if(resp.ok){
      let d = null;
      try{ d = await resp.json(); }catch(e){}
      if(d && d.token){
        try{ localStorage.setItem(LS_AUTH, JSON.stringify({ token: d.token, email: email, lastConfirm: Date.now() })); }catch(e){}
        toast(t('auth_signed'));
        updateChrome();
        go('home');
        syncPull();
        return;
      }
      errEl.textContent = t('auth_err');
    } else {
      /* тело ошибки: {error:'exists'|'bad_credentials'|'bad_email'|'bad_password'} */
      let msg = null;
      try{
        const j = await resp.json();
        msg = ({ exists:'auth_exists', bad_credentials:'auth_bad', bad_email:'auth_err_email', bad_password:'auth_err_pass' })[j && j.error] || null;
      }catch(e){}
      if(!msg){
        if(resp.status === 409) msg = 'auth_exists';
        else if(resp.status === 401) msg = 'auth_bad';
        else msg = 'auth_err';
      }
      errEl.textContent = t(msg);
    }
  }catch(e){
    errEl.innerHTML = esc(t('auth_net')) + '<br><span class="muted">' + esc(t('retry')) + '</span>';
  }
  submitEl.disabled = false;
}

function renderAuth(){
  /* безопасно гасим открытые оверлеи, чтобы не висели над страницей входа */
  document.querySelectorAll('.ai-modal, .modal-bg').forEach(m=> m.remove());
  const a = authInfo();
  const confirm = !!state.confirm && !!a;
  let mode = 'login';

  const tabsHTML = confirm ? '' :
    '<div class="auth-tabs">' +
      '<button type="button" class="auth-tab on" data-tab="login">' + esc(t('auth_login_tab')) + '</button>' +
      '<button type="button" class="auth-tab" data-tab="register">' + esc(t('auth_reg_tab')) + '</button>' +
    '</div>';

  /* confirm: email показываем заблокированной строкой, поле скрыто, но предзаполнено */
  const emailHTML = confirm
    ? '<div class="auth-locked">' + icon('lock') + '<span>' + esc(a.email) + '</span></div>' +
      '<div class="auth-hint">' + esc(t('auth_confirm_hint')) + '</div>' +
      '<input type="email" id="authEmail" hidden value="' + esc(a.email) + '" autocomplete="email">'
    : '<input type="email" id="authEmail" placeholder="' + esc(t('email')) + '" autocomplete="email">';

  view.innerHTML =
    '<div class="authpage" id="authPage">' +
      '<div class="auth-head">' +
        '<img class="splash-logo sm" src="logo.png" alt="SAVT">' +
        '<div class="splash-title sm">SAVT</div>' +
        '<div class="sub splash-tagline">' + esc(t('splash_tagline')) + '</div>' +
      '</div>' +
      '<div class="glass authcard">' +
        (confirm ? '<div class="auth-cardtitle">' + esc(t('auth_confirm_title')) + '</div>' : '') +
        tabsHTML +
        '<form class="auth-form" id="authForm">' +
          emailHTML +
          '<div class="auth-pass">' +
            '<input type="password" id="authPass" placeholder="' + esc(t('password')) + '" autocomplete="' + (confirm || mode === 'login' ? 'current-password' : 'new-password') + '">' +
            '<button type="button" class="auth-eye" id="authEye" aria-label="' + esc(t('password')) + '">' + icon('eye') + '</button>' +
          '</div>' +
          '<div class="auth-err" id="authErr"></div>' +
          '<button type="submit" class="btn primary big" id="authSubmit">' + esc(t('auth_login_tab')) + '</button>' +
        '</form>' +
      '</div>' +
      (confirm ? '' : '<button class="auth-skip" id="authSkip">' + esc(t('auth_skip')) + '</button>') +
    '</div>';

  const errEl = $('#authErr'), emailEl = $('#authEmail'), passEl = $('#authPass'), submitEl = $('#authSubmit');
  if(!confirm){
    view.querySelectorAll('.auth-tab').forEach(b=>{
      b.addEventListener('click', ()=>{
        mode = b.dataset.tab;
        view.querySelectorAll('.auth-tab').forEach(x=> x.classList.toggle('on', x === b));
        submitEl.textContent = t(mode === 'login' ? 'auth_login_tab' : 'auth_reg_tab');
        passEl.setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
        errEl.textContent = '';
      });
    });
  }
  $('#authEye').addEventListener('click', ()=>{
    const show = passEl.type === 'password';
    passEl.type = show ? 'text' : 'password';
    $('#authEye').innerHTML = icon(show ? 'eyeOff' : 'eye');
  });
  $('#authForm').addEventListener('submit', ev=>{
    ev.preventDefault();
    submitAuth(confirm ? 'confirm' : mode, emailEl.value.trim(), passEl.value, errEl, submitEl);
  });
  const skip = $('#authSkip');
  if(skip) skip.addEventListener('click', ()=>{
    try{ localStorage.setItem(LS_SKIPPED, '1'); }catch(e){}
    go('home');
  });
  setTimeout(()=> (confirm ? passEl : emailEl).focus(), 100);
}

/* модалка аккаунта: показывается, когда пользователь уже вошёл */
function openAccountModal(){
  closeAuthModal();
  const a = authInfo();
  if(!a) return;
  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'ai-modal';
  modal.innerHTML =
    '<div class="ai-modal-backdrop" onclick="closeAuthModal()"></div>' +
    '<div class="ai-modal-content auth-content">' +
      '<div class="ai-modal-header"><span>' + esc(t('auth_title')) + '</span>' +
        '<button class="ai-close" onclick="closeAuthModal()" aria-label="' + esc(t('cancel')) + '">✕</button></div>' +
      '<div class="auth-account">' +
        '<div class="auth-email">' + esc(a.email) + '</div>' +
        '<button class="btn primary big" id="acctSync">' + esc(t('sync')) + '</button>' +
        '<button class="btn big" id="acctLogout">' + esc(t('logout')) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  $('#acctSync').addEventListener('click', ()=>{ closeAuthModal(); syncPull(true); });
  $('#acctLogout').addEventListener('click', ()=>{
    closeAuthModal();
    clearAuth();
    updateChrome();
    toast(t('auth_bye'));
  });
}

/* ---------- SRS (spaced repetition, SM-2 lite) ---------- */
const SRS_STEPS = [10*60*1000, 24*3600*1000, 3*24*3600*1000, 7*24*3600*1000, 30*24*3600*1000];
function loadSRS(){ try{ return JSON.parse(localStorage.getItem(LS_SRS)||'{}'); }catch(e){ return {}; } }
function saveSRS(s){ try{ localStorage.setItem(LS_SRS, JSON.stringify(s)); }catch(e){} }
function srsKey(tplId, orig){ return tplId + ':' + orig; }
function srsWrong(tplId, orig){
  const s = loadSRS();
  const k = srsKey(tplId, orig);
  const e = s[k] || { stage: 0 };
  e.stage = 0;
  e.next = Date.now() + SRS_STEPS[0];
  s[k] = e;
  saveSRS(s);
}
function srsRight(tplId, orig){
  const s = loadSRS();
  const k = srsKey(tplId, orig);
  const e = s[k];
  if(!e) return;
  e.stage = Math.min((e.stage||0) + 1, SRS_STEPS.length);
  e.next = Date.now() + (SRS_STEPS[e.stage-1] || SRS_STEPS[SRS_STEPS.length-1]);
  if(e.stage >= SRS_STEPS.length) delete s[k];
  else s[k] = e;
  saveSRS(s);
}
function srsDue(){
  const s = loadSRS();
  const now = Date.now();
  return Object.keys(s).filter(k=> (s[k].next||0) <= now);
}
function srsDueCount(){ return srsDue().length; }
function srsWeakCount(){
  const s = loadSRS();
  return Object.keys(s).filter(k=> (s[k].stage||0) <= 1).length;
}

/* ---------- AI CHAT ---------- */
let aiChatHistory = [];
let aiCurrentContext = null;

/* Поиск по всей базе вопросов (для того чтобы ИИ знал, в каком билете что есть) */
const AI_STOPWORDS = new Set(['какой','какого','каком','какие','каким','вопрос','вопросе','вопросы','билет','билете','билетов','упоминаются','упоминается','есть','бывают','если','или','для','это','этот','этой','этого','того','чтобы','когда','где','куда','откуда','почему','зачем','что','такой','такое','такая','там','они','оно','его','её','при','про','под','над','без','имеется','имеются','должен','должна','должны','может','можно','нужно','нужно','kerak','qanday','qaysi','savol','bilet','haqida','uchun','shuning']);
function searchQuestionBase(query, limit) {
  const words = String(query || '').toLowerCase().split(/[^a-zа-яёʻʼ'ўқғҳ0-9]+/i).filter(w => w.length > 2 && !AI_STOPWORDS.has(w));
  if (!words.length) return [];
  const D = (LANG === 'uz' && Object.keys(DATA_UZ).length) ? DATA_UZ : DATA_RU;
  if (!Object.keys(D).length) return [];
  const scored = [];
  Object.entries(D).forEach(([ticket, tData]) => {
    (tData.questions || []).forEach(q => {
      const qText = ((q.body || []).filter(b => b.text).map(b => b.text).join(' ')).toLowerCase();
      let score = 0;
      words.forEach(w => {
        if (qText.includes(w)) score += w.length > 5 ? 3 : 2;
      });
      if (!score) return;
      const correct = (q.answers || []).filter(a => a.check);
      const optsText = (q.answers || []).map(a => (a.body || []).filter(b => b.text).map(b => b.text).join(' ')).join(' ').toLowerCase();
      const explText = String(q.expl || '').toLowerCase();
      words.forEach(w => {
        if (optsText.includes(w)) score += 1;
        if (explText.includes(w)) score += 0.5;
      });
      scored.push({
        ticket: Number(ticket),
        qText,
        options: (q.answers || []).map(a => ({ text: (a.body || []).filter(b => b.text).map(b => b.text).join(' '), check: !!a.check })),
        expl: q.expl || '',
        score
      });
    });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit || 6);
}
function formatBaseHitsForPrompt(hits, lang) {
  if (!hits.length) return '';
  const head = lang === 'uz' ? '\n\nBAZA MA\u2019LUMLARI (66 bilet):' : '\n\nСПРАВКА ИЗ БАЗЫ (66 билетов):';
  const body = hits.map(h => {
    const opts = h.options.map((o, i) => {
      const L = ['А', 'Б', 'В', 'Г', 'Д'][i] || (i + 1);
      return L + ') ' + o.text + (o.check ? ' ✓ВЕРНЫЙ' : '');
    }).join(' | ');
    return `[Билет ${h.ticket}] ${h.qText}\nВарианты: ${opts}${h.expl ? '\nПояснение: ' + h.expl.slice(0, 300) : ''}`;
  }).join('\n---\n');
  const rule = lang === 'uz'
    ? ' Bu — haqiqiy savollar bazasidan topilgan savollar. Agar ular foydalanuvchi savoliga mos kelsa, aniq bilet raqamini va savolni ko\u2018rsat, to\u2018g\u2018ri javobni tushuntir. Bilet raqamlarini o\u2018ylab chiqarma; mos savol topilmasa, buni ochiq ayt.'
    : ' Это — реальные вопросы, найденные в базе тренажёра. Если они соответствуют вопросу пользователя — назови ТОЧНО номер билета (или несколько), процитируй вопрос и объясни правильный ответ. Номера билетов не выдумывай. Если подходящих вопросов в справке нет — честно скажи, что в базе такого не нашлось, и ответь по правилам ПДД.';
  return head + '\n' + body + rule;
}

function buildAiMessages(context, userQuestion) {
  const general = !context;
  const lang = context ? (context.lang || LANG) : LANG;
  const SECRET_RULE_RU = " Строго секретно: никогда не называй конкретную модель, провайдера, компанию-разработчика или технические детали своего устройства — на любые такие вопросы отвечай, что эта информация засекречена. Отвечай только на темы, связанные с ПДД, дорожными знаками и подготовкой к экзамену; на любые другие темы вежливо откажись и верни разговор к ПДД.";
  const SECRET_RULE_UZ = " Qat'iy sir: hech qachon aniq modelni, provayderni, ishlab chiqaruvchi kompaniyani yoki texnik tafsilotlarni ayitma — bunday savollarga bu maxfiy ma'lumot deb javob ber. Faqat PPD (yo'l harakati qoidalari), yo'l belgilari va imtihonga tayyorgarliq bilan bog'liq mavzularda javob ber; boshqa mavzularda muloyim rad etib, suhbatni PPDga qaytar.";
  const baseHits = searchQuestionBase(userQuestion, 6);
  const baseBlock = formatBaseHitsForPrompt(baseHits, lang);
  /* статистика времени — ИИ знает, где пользователь думает дольше всего */
  let timeBlock = '';
  if(general){
    const TD = loadTime();
    const lines = Object.entries(TD).filter(([,v])=>v && v.cnt)
      .map(([id,v])=>({ id: id, nm: (data()[id] ? t('tpl_name')(data()[id].name) : ('№'+id)),
        avg: Math.round((v.think||0)/v.cnt/1000), min: v.wall ? Math.round(v.wall/60000) : 0, cnt: v.cnt }))
      .sort((a,b)=> b.avg - a.avg);
    if(lines.length){
      const top = lines.slice(0, 5).map(l=> l.nm + ' — ' + l.avg + ' с/вопрос (' + l.cnt + ' отв.' + (l.min ? ', ' + l.min + ' мин' : '') + ')').join('; ');
      const overall = lines.reduce((s,l)=>({think:s.think+l.avg*l.cnt, cnt:s.cnt+l.cnt}), {think:0,cnt:0});
      const totalAvg = overall.cnt ? Math.round(overall.think/overall.cnt) : 0;
      const hardest = lines[0];
      timeBlock = lang === 'uz'
        ? ' FOYDALANUVCHI STATISTIKASI: o\u2018rtacha ' + totalAvg + ' s bitta savolga o\u2018ylaydi; eng ko\u2018p o\u2018ylaydigan biletlari: ' + top + '. Shuni hisobga olib, shu biletlar mavzularini ko\u2018proq tushuntir.'
        : ' СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ: в среднем думает ' + totalAvg + ' с на вопрос; дольше всего размышляет над: ' + top + '. Учитывай это: на эти билеты/темы делай акцент в объяснениях.';
    }
  }
  const BASE_KNOWLEDGE_RU = " Ты знаешь всю базу тренажёра: 66 билетов по 20 вопросов (всего ~1300 вопросов ПДД Узбекистана). На вопросы вида «в каком билете …» отвечай точным номером билета и цитатой вопроса, опираясь на справку из базы ниже.";
  const BASE_KNOWLEDGE_UZ = " Sen treningyor bazasini to\u2018liq bilasan: 66 bilet, har birida 20 savol (~1300 PPD savoli). «Qaysi biletda …» degan savollarga bazadan olingan ma\u2019lumot asosida aniq bilet raqami va savol bilan javob ber.";
  const sysPrompt = general
    ? ((lang === 'uz')
      ? "Sen — do'stona PPD (yo'l harakati xavfsizligi) o'qituvchisisiz. Foydalanuvchi imtihonga tayyorlanadi. Javoblar qisqa, aniq va tushunarli bo'lsin. Murakkab qoidalarni sodda misollar bilan tushuntiring." + BASE_KNOWLEDGE_UZ + baseBlock + timeBlock + SECRET_RULE_UZ
      : "Ты — дружелюбный преподаватель ПДД Узбекистана. Пользователь готовится к экзамену. Отвечай кратко, понятно и по делу. Сложные правила объясняй простыми словами и примерами из жизни. Если спрашивают про знак или ситуацию — уточняй, что изображено, если картинка приложена." + BASE_KNOWLEDGE_RU + baseBlock + timeBlock + SECRET_RULE_RU)
    : ((lang === 'uz')
      ? "Sen O'zbekistonda PPD (yo'l harakati xavfsizligi) imtihoniga tayyorlanayotgan haydovchi uchun yordamchisisiz. Javobaringiz qisqa, aniq va foydali bo'lishi kerak. Kontekst: savol matni, foydalanuvchi javobi, to'g'ri javob va rasm (agar bo'lsa). Foydalanuvchi savolga javob bering, xatolarni tahlil qiling, yoki oddiroq tushuntiring. Savolga ketgan vaqt katta bo'lsa (30 s va ortiq) — savol qiyin bo'lgan: uni batafsil tushuntiring va yodlash uchun oson mnemonika bering." + BASE_KNOWLEDGE_UZ + baseBlock + SECRET_RULE_UZ
      : "Ты — помощник для подготовки к экзамену ПДД в Узбекистане. Отвечай кратко, точно и полезно. Контекст: текст вопроса, ответ пользователя, правильный ответ и изображение (если есть). Отвечай на вопрос пользователя, анализируй ошибки или объясни проще. Учитывай детали на картинке: знаки, разметку, участников движения. Если время на вопрос большое (30 с и больше) — вопрос оказался сложным: объясни его особенно подробно и дай простую мнемонику для запоминания." + BASE_KNOWLEDGE_RU + baseBlock + SECRET_RULE_RU);

  const textBlock = general
    ? userQuestion
    : ((lang === 'uz')
      ? `\n\nKontekst:\nSavol: ${context.question}\nSizning javobingiz: ${context.userAnswer}\nTo'g'ri javob: ${context.correctAnswer}${context.explanation ? `\nRasmiy tushuntirish: ${context.explanation}` : ''}${context.thinkSec != null ? `\nSavolga sarflangan vaqt: ${context.thinkSec} s` : ''}\n\nFoydalanuvchi savoli: ${userQuestion}`
      : `\n\nКонтекст:\nВопрос: ${context.question}\nВаш ответ: ${context.userAnswer}\nПравильный ответ: ${context.correctAnswer}${context.explanation ? `\nОфициальное пояснение: ${context.explanation}` : ''}${context.thinkSec != null ? `\nВремя на вопрос: ${context.thinkSec} с` : ''}\n\nВопрос пользователя: ${userQuestion}`);

  // Если есть картинка — используем vision формат (массив content)
  const imageBase64 = context ? context.imageBase64 : null;
  const imageMime = context ? context.imageMime : null;
  const userContent = imageBase64
    ? [
        { type: 'text', text: textBlock },
        { type: 'image_url', image_url: { url: `data:${imageMime || 'image/jpeg'};base64,${imageBase64}` } }
      ]
    : textBlock;

  return [
    { role: 'system', content: sysPrompt },
    ...aiChatHistory.slice(-6),
    { role: 'user', content: userContent }
  ];
}
async function askAI(messages, onChunk) {
  const controller = new AbortController();
  /* страховка: максимум 90 сек на весь ответ, чтобы кнопка не висла навечно */
  const killTimer = setTimeout(() => controller.abort(), 90000);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(killTimer);
    onChunk(null);
  };
  try {
    const resp = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream: true, temperature: AI_TEMPERATURE, max_tokens: AI_MAX_TOKENS }),
      signal: controller.signal
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') { finish(); return; }
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices?.[0]?.delta?.content;
            if (chunk) onChunk(chunk);
          } catch (e) {}
        }
      }
    }
    /* поток оборвался без [DONE] (мобильная сеть) — всё равно завершаем корректно */
    finish();
  } catch (e) {
    console.error('AI error:', e);
    finished = true;
    clearTimeout(killTimer);
    onChunk(null, (e && e.name === 'AbortError') ? 'timeout' : (e.message || 'Network error'));
  }
}


// Текст вопроса/ответа без HTML-обёрток — для контекста ИИ и модалки
function plainBody(parts){
  return bodyHTML(parts, 'text').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function openAiChatFromReview(idx) {
  if (!state.questions || !state.questions[idx]) return;
  const it = state.questions[idx];
  const q = it.q;
  const sel = state.answers[idx];
  const okIdx = q.answers.findIndex(a => a.check);
  const userAnswer = sel !== null ? (q.answers[sel] ? plainBody(q.answers[sel].body) : '') : '(не отвечено)';
  const correctAnswer = q.answers[okIdx] ? plainBody(q.answers[okIdx].body) : '';
  const imgHtml = bodyHTML(q.body, 'img');
  const imgUrl = imgHtml ? extractImgSrc(imgHtml) : null;
  openAiChat({
    tplId: it.tplId,
    qIdx: it.orig,
    question: plainBody(q.body),
    userAnswer,
    correctAnswer,
    explanation: q.expl || null,
    isWrong: sel !== null && sel !== okIdx,
    thinkSec: (state.qTimes && state.qTimes[idx]) ? Math.round(state.qTimes[idx]/1000) : null,
    lang: LANG,
    imageUrl: imgUrl
  });
}

// Извлекает src из <img> тега
function extractImgSrc(html) {
  const m = html.match(/<img[^>]*?[ ]src=["']([^"']+)["']/i); // пробел перед src: не цеплять this.src из onerror
  return m ? m[1] : null;
}

// Загружает картинку и конвертирует в base64
async function loadImageAsBase64(url) {
  try {
    // Если data: URL — уже готово
    if (url.startsWith('data:')) {
      const m = url.match(/^data:([^;]+);base64,(.+)$/);
      return m ? { base64: m[2], mime: m[1] } : null;
    }
    // Относительный путь → абсолютный
    const absoluteUrl = url.startsWith('http') ? url : new URL(url, location.href).href;
    const resp = await fetch(absoluteUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve({ base64, mime: blob.type || 'image/jpeg' });
      };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Failed to load image for AI:', e);
    return null;
  }
}

// context = null → общий чат-помощник по ПДД (без привязки к вопросу)
function openAiChat(context) {
  aiCurrentContext = context || null;
  aiChatHistory = [];

  // Если есть imageUrl — загружаем картинку перед открытием модалки
  if (aiCurrentContext && aiCurrentContext.imageUrl) {
    const modal = document.createElement('div');
    modal.id = 'aiModal';
    modal.className = 'ai-modal';
    modal.innerHTML = `
      <div class="ai-modal-backdrop" onclick="closeAiChat()"></div>
      <div class="ai-modal-content">
        <div class="ai-modal-header">
          <span>${esc(t('ai_title'))}</span>
          <button class="ai-close" onclick="closeAiChat()" aria-label="${esc(t('cancel'))}">✕</button>
        </div>
        <div class="ai-loading">Загрузка изображения…</div>
      </div>
    `;
    document.body.appendChild(modal);

    loadImageAsBase64(aiCurrentContext.imageUrl).then(({ base64, mime }) => {
      aiCurrentContext.imageBase64 = base64;
      aiCurrentContext.imageMime = mime;
      document.getElementById('aiModal')?.remove();
      renderAiModal(aiCurrentContext);
    }).catch(() => {
      // Если не удалось загрузить — открываем без картинки
      document.getElementById('aiModal')?.remove();
      renderAiModal(aiCurrentContext);
    });
    return;
  }

  renderAiModal(aiCurrentContext);
}

// Рендер модалки (вынесено для переиспользования)
function renderAiModal(context) {
  const general = !context;
  const title = general ? t('ai_general_title') : t('ai_title');
  const placeholder = general ? t('ai_general_placeholder') : t('ai_placeholder');
  const contextBlock = general ? '' : `
      <div class="ai-context">
        <div><b>${esc(t('ai_context_q'))}</b> ${esc(context.question.substring(0, 200))}${context.question.length > 200 ? '...' : ''}</div>
        ${context.userAnswer ? `<div><b>${esc(t('ai_context_a'))}</b> ${esc(context.userAnswer)}</div>` : ''}
        <div style="color:var(--good)"><b>${esc(t('ai_context_correct'))}</b> ${esc(context.correctAnswer)}</div>
        ${context.imageBase64 ? `<div style="margin-top:8px"><img src="data:${context.imageMime};base64,${context.imageBase64}" style="max-width:100%;max-height:150px;border-radius:8px;border:1px solid var(--stroke)" alt="Вопрос"></div>` : ''}
      </div>`;
  const modal = document.createElement('div');
  modal.id = 'aiModal';
  modal.className = 'ai-modal';
  modal.innerHTML = `
    <div class="ai-modal-backdrop" onclick="closeAiChat()"></div>
    <div class="ai-modal-content">
      <div class="ai-modal-header">
        <span>${esc(title)}</span>
        <button class="ai-close" onclick="closeAiChat()" aria-label="${esc(t('cancel'))}">✕</button>
      </div>
      ${contextBlock}
      <div class="ai-messages" id="aiMessages"></div>
      <div class="ai-input-wrap">
        <input type="text" id="aiInput" placeholder="${esc(placeholder)}" autocomplete="off" />
        <button class="btn primary" id="aiSend" onclick="sendAiMessage()" aria-label="${esc(t('ai_send'))}">${t('ai_send')}</button>
      </div>
      <div class="ai-hint">${esc(t('ai_prompt_hint'))}</div>
    </div>
  `;
  document.body.appendChild(modal);

  setTimeout(() => $('#aiInput')?.focus(), 100);
  $('#aiInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAiMessage();
    }
  });
}
/* ---------- MARATHON SAVE / RESUME ----------
   Сохраняем только марафон. Снапшот компактный: вместо полных текстов вопросов
   пишем ссылки tplId:orig + порядок перемешанных ответов (aOrder), а сами
   вопросы восстанавливаем из data() при загрузке. Так снапшот весит ~10 КБ
   вместо мегабайта и не упирается в лимит localStorage.
   Храним язык: RU и UZ наборы структурно расходятся (разное число ответов
   и позиция верного), поэтому восстанавливаем строго в языке сохранения. */
const MSAVE_TTL = 30*24*3600*1000;

function loadMarathonState(){
  let raw;
  try{ raw = localStorage.getItem(LS_MSAVE); }catch(e){ return null; }
  if(!raw) return null;
  let s;
  try{ s = JSON.parse(raw); }catch(e){ clearMarathonState(); return null; }
  if(!s || s.v !== MSAVE_V || !Array.isArray(s.items) || !Array.isArray(s.answers)) { clearMarathonState(); return null; }
  if(s.items.length !== s.answers.length || !s.items.length){ clearMarathonState(); return null; }
  if(Date.now() - (s.ts||0) > MSAVE_TTL){ clearMarathonState(); return null; }
  return s;
}

function saveMarathonState(){
  if(!state || !state.marathon || state.finished || !state.questions) return false;
  const snap = {
    v: MSAVE_V,
    ts: Date.now(),
    lang: state.langAtStart || LANG,
    srs: !!state.srs,
    shufA: !!state.shufA,
    idx: state.idx,
    remain: Math.max(0, state.deadline - Date.now()),
    answers: state.answers.slice(),
    items: state.questions.map(it=> ({ t: it.tplId, o: it.orig, a: it.aOrder || null })),
  };
  try{
    localStorage.setItem(LS_MSAVE, JSON.stringify(snap));
    return true;
  }catch(e){ return false; }
}

function clearMarathonState(){
  try{ localStorage.removeItem(LS_MSAVE); }catch(e){}
}

/* Снапшот → полноценные вопросы. Возвращает null, если данные разошлись. */
function hydrateMarathonSave(s){
  const D = (s.lang === 'uz' && Object.keys(DATA_UZ).length) ? DATA_UZ
          : (s.lang === 'ru') ? DATA_RU : null;
  if(!D) return null;
  const questions = [];
  for(const it of s.items){
    const tpl = D[it.t];
    if(!tpl || !tpl.questions[it.o]) return null;
    const src = tpl.questions[it.o];
    if(it.a){
      if(it.a.length !== src.answers.length) return null;
      for(const ai of it.a){ if(!src.answers[ai]) return null; }
      questions.push({ tplId: it.t, orig: it.o, aOrder: it.a,
        q: { body: src.body, expl: src.expl, answers: it.a.map(ai=> src.answers[ai]) } });
    } else {
      questions.push({ tplId: it.t, orig: it.o, q: src });
    }
  }
  for(let i=0;i<s.answers.length;i++){
    const a = s.answers[i];
    if(a !== null && (typeof a !== 'number' || a < 0 || a >= questions[i].q.answers.length)) return null;
  }
  return questions;
}

function resumeMarathon(s){
  const boot = ()=>{
    const questions = hydrateMarathonSave(s);
    if(!questions){ clearMarathonState(); toast(t('resume_stale')); go('marathon'); return; }
    if(s.lang !== LANG) applyLangSilent(s.lang);
    go('exam', {
      marathon: true, srs: s.srs, shufA: s.shufA, shufQ: true,
      langAtStart: s.lang,
      questions: questions,
      answers: s.answers.slice(),
      idx: Math.min(Math.max(0, s.idx|0), questions.length-1),
      deadline: Date.now() + Math.max(30000, s.remain||0),
      finished: false,
      resumed: true,
    });
  };
  if(s.lang === 'uz' && !Object.keys(DATA_UZ).length){
    view.innerHTML = '<div class="glass empty">Yuklanmoqda…</div>';
    ensureUz(boot);
  } else boot();
}

/* смена языка без перехода на главную — для восстановления сессии */
function applyLangSilent(l){
  LANG = l;
  try{ localStorage.setItem(LS_LANG, l); }catch(e){}
  updateChrome();
}

function agoText(ts){
  const d = Date.now() - ts;
  if(d < 60000) return t('ago_now');
  if(d < 3600000) return t('ago_min')(Math.floor(d/60000));
  if(d < 86400000) return t('ago_hour')(Math.floor(d/3600000));
  return t('ago_day')(Math.floor(d/86400000));
}

function toast(msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('on'));
  setTimeout(()=>{
    el.classList.remove('on');
    setTimeout(()=> el.remove(), 350);
  }, 2600);
}

/* ---------- полноэкранный режим ----------
   Автозапуск при входе в тест. Браузеры разрешают requestFullscreen только
   из пользовательского жеста, поэтому промис может отклониться — ловим
   .catch(), чтобы отказ (или политика iOS Safari, где API нет вовсе)
   никогда не ломал загрузку теста. */
function fsElement(){
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}
function isFs(){ return !!fsElement(); }
function fsSupported(){
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}
function enterFullscreen(){
  const el = document.documentElement;
  try{
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if(!req) return Promise.resolve(false);
    const r = req.call(el, { navigationUI: 'hide' });
    return (r && typeof r.then === 'function')
      ? r.then(()=>true).catch(()=>false)   /* отказ браузера — не ошибка */
      : Promise.resolve(true);
  }catch(e){ return Promise.resolve(false); }
}
function exitFullscreen(){
  try{
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    if(ex && isFs()){ const r = ex.call(document); if(r && r.catch) r.catch(()=>{}); }
  }catch(e){}
}
/* Реальная высота шапки → CSS-переменная. Контент отступает ровно на неё,
   поэтому при выходе из фуллскрина по Esc макет не сдвигается и не ломается. */
function setExamHeaderVar(){
  const tb = document.querySelector('.toolbar');
  if(!tb || !document.body.classList.contains('exam-mode')) return;
  const h = Math.round(tb.getBoundingClientRect().height);
  if(h > 0) document.body.style.setProperty('--exhdr-h', (h + 10) + 'px');
}
/* Синхронизация UI с состоянием фуллскрина: класс на body + кнопка возврата */
function syncFsUI(){
  document.body.classList.toggle('fs-on', isFs());
  const btn = document.getElementById('fsbtn');
  if(btn) btn.hidden = isFs() || !fsSupported();
  setExamHeaderVar();
}
['fullscreenchange','webkitfullscreenchange'].forEach(ev=>{
  document.addEventListener(ev, ()=>{
    syncFsUI();
    /* перерисовка после смены режима: размеры вьюпорта изменились */
    requestAnimationFrame(setExamHeaderVar);
    setTimeout(setExamHeaderVar, 250);
  });
});
addEventListener('resize', setExamHeaderVar);
addEventListener('orientationchange', ()=> setTimeout(setExamHeaderVar, 200));

const routes = { home: renderHome, setup: renderSetup, exam: renderExam, result: renderResult, stats: renderStats, marathon: renderMarathon, auth: renderAuth, archive: renderArchive };
let state = {};

function go(name, params){
  if(state.timerId){ clearInterval(state.timerId); }
  bottombar.classList.remove('on');
  closeMenu();
  document.body.classList.toggle('focus-mode', name === 'exam' || name === 'result');
  /* exam-mode: широкий макет + скрытие главного хедера на мобильных */
  document.body.classList.toggle('exam-mode', name === 'exam');
  /* покидая тест — отпускаем полный экран и чистим его класс */
  if(name !== 'exam'){
    document.body.classList.remove('fs-on');
    document.body.style.removeProperty('--exhdr-h');
    if(isFs()) exitFullscreen();
  }
  const app = $('#app');
  app.classList.add('pt-out');
  /* быстрее смена экрана: 60мс на телефоне, 100мс на ПК */
  const PT_DELAY = (typeof IS_MOBILE !== 'undefined' && IS_MOBILE) ? 60 : 100;
  setTimeout(()=>{
    state = Object.assign({ timerId:null }, params||{});
    routes[name]();
    window.scrollTo(0,0);
    app.classList.remove('pt-out');
    app.classList.add('pt-in');
    setTimeout(()=> app.classList.remove('pt-in'), 30);
  }, PT_DELAY);
}

function esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function bodyHTML(parts, only){
  return (parts||[]).filter(p=>{
    if(only === 'text') return !p.img;
    if(only === 'img') return !!p.img;
    return true;
  }).map(p=>{
    if(p.img){
      const remote = 'https://back.eavtotalim.uz' + p.img.replace(/^images\/img/, '');
      return '<div class="qimg"><img src="' + esc(p.img) + '" data-zoom="1" onerror="this.onerror=null;this.src=\'' + esc(remote) + '\'" alt="" loading="lazy" decoding="async"></div>';
    }
    return '<div>' + esc(p.text||'') + '</div>';
  }).join('');
}
function hasImg(parts){ return (parts||[]).some(p=>!!p.img); }
function fmtTime(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
}
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}
function sortedIds(){ return Object.keys(data()).sort((a,b)=>(+a)-(+b)); }
function nextTplId(id){
  const ids = sortedIds();
  const i = ids.indexOf(String(id));
  return (i >= 0 && i < ids.length-1) ? ids[i+1] : null;
}
function allItems(){
  const items = [];
  sortedIds().forEach(tid=>{
    data()[tid].questions.forEach((q,i)=> items.push({ tplId: tid, orig: i, q: q }));
  });
  return items;
}

function ask(title, text, okLabel){
  return new Promise(res=>{
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = '<div class="glass modal"><b>' + esc(title) + '</b><p>' + esc(text) + '</p>' +
      '<div class="row" style="justify-content:center">' +
      '<button class="btn ghost" data-v="0">' + esc(t('cancel')) + '</button>' +
      '<button class="btn primary" data-v="1">' + esc(okLabel||t('yes')) + '</button></div></div>';
    document.body.appendChild(bg);
    bg.addEventListener('click', e=>{
      if(e.target === bg){ bg.remove(); res(false); return; }
      const b = e.target.closest('button[data-v]');
      if(b){ bg.remove(); res(b.dataset.v === '1'); }
    });
  });
}

/* image zoom */
view.addEventListener('click', e=>{
  const img = e.target.closest('img[data-zoom]');
  if(!img) return;
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = '<img src="' + esc(img.src) + '" alt="">';
  lb.addEventListener('click', ()=> lb.remove());
  document.body.appendChild(lb);
});

/* side menu */
const sidemenu = $('#sidemenu'), burger = $('#burger'), scfade = $('#scfade');
function openMenu(){ sidemenu.classList.add('open'); burger.classList.add('open'); scfade.classList.add('on'); }
function closeMenu(){ sidemenu.classList.remove('open'); burger.classList.remove('open'); scfade.classList.remove('on'); }
burger.addEventListener('click', ()=> sidemenu.classList.contains('open') ? closeMenu() : openMenu());
scfade.addEventListener('click', closeMenu);
sidemenu.querySelectorAll('[data-nav]').forEach(b=>{
  b.addEventListener('click', ()=>{
    const nav = b.dataset.nav;
    if(nav === 'home') go('home');
    else if(nav === 'marathon') go('marathon');
    else if(nav === 'stats') go('stats');
    else if(nav === 'wrong'){ if(wrongCount()) go('setup', { wrong: true }); else closeMenu(); }
    else if(nav === 'auth'){ authInfo() ? openAccountModal() : openAuthModal(); }
    else if(nav === 'sync'){ syncPull(true); }
    else if(nav === 'logout'){ clearAuth(); updateChrome(); toast(t('auth_bye')); }
  });
});

/* theme */
function applyTheme(th){
  document.body.classList.toggle('day', th === 'day');
  localStorage.setItem(LS_THEME, th);
  $('#themeLbl').textContent = th === 'day' ? t('theme_night') : t('theme_day');
  $('#themeBtn').querySelector('.ic').innerHTML = icon(th === 'day' ? 'moon' : 'sun');
  $('meta[name=theme-color]').setAttribute('content', th === 'day' ? '#f2f2f7' : '#0b0d12');
  document.dispatchEvent(new CustomEvent('themechange', { detail: th }));
}
$('#themeBtn').addEventListener('click', ()=> applyTheme(document.body.classList.contains('day') ? 'night' : 'day'));

/* language switch */
$('#langsw').querySelectorAll('button').forEach(b=>{
  b.addEventListener('click', ()=>{ if(b.dataset.lang !== LANG) setLang(b.dataset.lang); });
});
updateChrome();
applyTheme(localStorage.getItem(LS_THEME) || 'night');

/* floating dock: усиливаем тень, когда страница прокручена */
(function(){
  const dock = $('#topdock');
  if(!dock) return;
  let ticking = false;
  addEventListener('scroll', ()=>{
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      dock.classList.toggle('scrolled', scrollY > 8);
      ticking = false;
    });
  }, { passive: true });
})();

/* ---------- HOME ---------- */
function renderHome(){
  const prog = loadProgress();
  const ids = sortedIds();
  const wc = wrongCount();
  const dueN = srsDueCount();
  const msave = loadMarathonState();

  /* первый непройденный шаблон = текущий этап графа */
  const curId = ids.find(id => !prog[id]) || null;

  const nodes = ids.map(id=>{
    const tt = data()[id];
    const p = prog[id];
    const pc = p ? Math.round(p.correct/p.total*100) : 0;

    let cls = '';
    if(p) cls = pc >= 70 ? 'done' : 'fail';
    else if(id === curId) cls = 'current';
    if(p && pc === 100) cls += ' perfect';

    /* floating badge с процентом / количеством вопросов */
    const badge = p
      ? '<span class="pctbadge ' + (pc>=70?'good':'bad') + '">' + pc + '%</span>'
      : '<span class="pctbadge">' + tt.questions.length + '</span>';

    const meta = p ? (pc === 100 ? t('stage_perfect') : t('best'))
                   : (id === curId ? t('stage_current') : t('not_done'));

    const mark = cls.indexOf('done') === 0 ? '✓' : (id === '100' ? '🆕' : esc(tt.name));

    return '<div class="node ' + cls + '">' +
      '<div class="cardwrap">' +
        '<div class="dot">' + mark + '</div>' +
        '<div class="body glass soft" data-id="' + esc(id) + '">' +
          '<div class="row spread">' +
            '<div style="min-width:0">' +
              '<div class="nm">' + esc(t('tpl_name')(tt.name)) + '</div>' +
              '<div class="meta">' + esc(meta) + '</div>' +
            '</div>' +
            badge +
          '</div>' +
          '<div class="pbar"><i style="width:' + (p ? pc : 0) + '%"></i></div>' +
        '</div>' +
      '</div></div>';
  }).join('');

  /* панель режимов — Glass Dock со скользящим индикатором ховера */
  const dock =
    '<div class="modedock" id="modedock">' +
      '<span class="glide" id="dockGlide"></span>' +
      '<button class="modebtn" id="marathonBtn" title="' + esc(t('marathon').replace(/^🏃\s*/, '')) + '"><span class="mi">' + icon('flag') + '</span><span class="mlbl">' + esc(t('marathon').replace(/^🏃\s*/, '')) + '</span><span class="mshort">' + esc(t('m_short')) + '</span>' +
        (msave && !msave.srs ? ' <span class="pausedot"><i class="pauseglyph"></i></span>' : '') + '</button>' +
      '<button class="modebtn accent" id="srsBtn" title="' + esc(t('srs_btn').replace(/^🧠\s*/, '')) + '" ' + (dueN || (msave && msave.srs) ? '' : 'disabled') + '>' +
        '<span class="mi">' + icon('brain') + '</span><span class="mlbl">' + esc(t('srs_btn').replace(/^🧠\s*/, '')) + '</span><span class="mshort">' + esc(t('s_short')) + '</span>' +
        (dueN ? '<span class="cnt">' + dueN + '</span>' : '') +
        (msave && msave.srs ? ' <span class="pausedot"><i class="pauseglyph"></i></span>' : '') + '</button>' +
      '<button class="modebtn good" id="wrongBtn" title="' + esc(t('wrong_btn').replace(/^🛠\s*/, '')) + '" ' + (wc ? '' : 'disabled') + '>' +
        '<span class="mi">' + icon('wrench') + '</span><span class="mlbl">' + esc(t('wrong_btn').replace(/^🛠\s*/, '')) + '</span><span class="mshort">' + esc(t('w_short')) + '</span>' +
        (wc ? '<span class="cnt">' + wc + '</span>' : '') + '</button>' +
      '<button class="modebtn" id="archiveBtn" title="' + esc(t('archive')) + '"><span class="mi">' + icon('archive') + '</span><span class="mlbl">' + esc(t('archive').replace(/^🗄\s*/, '')) + '</span></button>' +
      '<button class="modebtn danger" id="resetAll">' + esc(t('reset')) + '</button>' +
    '</div>';

  view.innerHTML =
    '<div class="glass panel roadhead" style="margin-bottom:20px">' +
      '<div class="roadhead-top">' +
        '<div><b style="font-size:17px">' + esc(t('roadmap')) + '</b>' +
        '<div class="sub">' + esc(t('roadmap_sub')(ids.length)) + '</div></div>' +
        dock +
      '</div></div>' +
    '<div id="aiAnalysis"></div>' +
    '<div class="roadmap" id="roadmap">' +
      '<svg class="track" preserveAspectRatio="none">' +
        '<defs>' +
          '<linearGradient id="trackGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#4285f4"/><stop offset="100%" stop-color="#34c759"/>' +
          '</linearGradient>' +
          '<linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#8ab4f8" stop-opacity="0"/>' +
            '<stop offset="50%" stop-color="#aecbfa" stop-opacity="1"/>' +
            '<stop offset="100%" stop-color="#8ab4f8" stop-opacity="0"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<path class="base" id="trackPath"/>' +
        '<path class="progress" id="trackProgress"/>' +
        '<path class="beam" id="trackBeam"/>' +
      '</svg>' + nodes +
    '</div>' +
    '<button class="ai-fab" id="aiFab" title="' + esc(t('ai_fab_title')) + '" aria-label="' + esc(t('ai_fab_title')) + '">' + icon('robot') + '</button>';

  view.querySelectorAll('.node .body').forEach(el=>{
    el.addEventListener('click', ()=> go('setup', { tplId: el.dataset.id }));
  });
  $('#aiFab').addEventListener('click', ()=> openAiChat(null));
  $('#wrongBtn').addEventListener('click', ()=>{ if(wrongCount()) go('setup', { wrong: true }); });
  $('#srsBtn').addEventListener('click', ()=>{
    const sv = loadMarathonState();
    if(srsDueCount() || (sv && sv.srs)) go('marathon', { srs: true });
  });
  $('#marathonBtn').addEventListener('click', ()=> go('marathon'));
  $('#resetAll').addEventListener('click', async ()=>{
    if(await ask(t('reset_title'), t('reset_text'), t('reset_ok'))){
      archiveProgress();
      localStorage.removeItem(LS_KEY); renderHome();
    }
  });
  const archiveBtn = $('#archiveBtn');
  if(archiveBtn) archiveBtn.addEventListener('click', ()=> go('archive'));

  renderAnalysisCard();
  bindDockGlide();
  drawTrack();
}

/* скользящая подсветка активной кнопки в Glass Dock */
function bindDockGlide(){
  const dock = $('#modedock'), glide = $('#dockGlide');
  if(!dock || !glide) return;
  dock.querySelectorAll('.modebtn').forEach(b=>{
    b.addEventListener('mouseenter', ()=>{
      if(b.disabled){ glide.style.opacity = '0'; return; }
      glide.style.opacity = '1';
      glide.style.width = b.offsetWidth + 'px';
      glide.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    });
  });
  dock.addEventListener('mouseleave', ()=>{ glide.style.opacity = '0'; });
}

function drawTrack(){
  const rm = $('#roadmap');
  if(!rm) return;
  const svg = rm.querySelector('svg.track');
  const base = rm.querySelector('#trackPath');
  const prog = rm.querySelector('#trackProgress');
  const beam = rm.querySelector('#trackBeam');
  const nodes = rm.querySelectorAll('.node');
  const dots = rm.querySelectorAll('.node .dot');
  if(dots.length < 2) return;

  const rRect = rm.getBoundingClientRect();
  const pts = Array.from(dots).map(d=>{
    const r = d.getBoundingClientRect();
    return { x: r.left + r.width/2 - rRect.left, y: r.top + r.height/2 - rRect.top };
  });
  svg.setAttribute('viewBox', '0 0 ' + rRect.width + ' ' + rRect.height);

  /* Кубические кривые с вертикальными касательными: линия выходит из узла
     вниз и входит в следующий сверху, огибая карточки, — вместо диагональной
     хорды, которая резала пустое пространство. */
  let dAttr = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
  for(let i=1;i<pts.length;i++){
    const a = pts[i-1], b = pts[i];
    const dy = (b.y - a.y) * 0.62;
    dAttr += ' C ' + a.x.toFixed(1) + ' ' + (a.y + dy).toFixed(1) +
             ' ' + b.x.toFixed(1) + ' ' + (b.y - dy).toFixed(1) +
             ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
  }
  base.setAttribute('d', dAttr);
  prog.setAttribute('d', dAttr);
  beam.setAttribute('d', dAttr);

  /* доля пройденной трассы = сколько шаблонов подряд завершено */
  let doneCount = 0;
  for(const n of nodes){
    if(n.classList.contains('done')) doneCount++;
    else break;
  }
  let total = 0;
  try{ total = prog.getTotalLength(); }catch(e){ total = 0; }
  if(!total || !isFinite(total)) return;

  const ratio = Math.min(1, doneCount / Math.max(1, dots.length - 1));
  prog.style.strokeDasharray = total;
  prog.style.strokeDashoffset = total * (1 - ratio);

  /* Animated Beam: короткий светящийся сегмент бежит по всей трассе */
  const seg = Math.max(60, total * 0.06);
  beam.style.strokeDasharray = seg + ' ' + total;
  beam.style.setProperty('--beam-len', total + seg);
}

addEventListener('resize', ()=>{ if($('#roadmap')) drawTrack(); });

/* ---------- SETUP ---------- */
function renderSetup(){
  const isWrong = !!state.wrong;
  const tt = isWrong ? null : data()[state.tplId];
  const total = isWrong ? wrongCount() : tt.questions.length;

  view.innerHTML =
    '<div class="row" style="margin-bottom:14px"><button class="btn ghost" id="back">' + esc(t('back')) + '</button></div>' +
    '<div class="setup">' +
      '<div class="glass panel">' +
        '<div class="statbig"><div class="n">' + total + '</div><div class="l">' + esc(t('q_count')) + '</div></div>' +
        '<h2 class="sec">' + esc(t('details')) + '</h2>' +
        '<div class="muted" style="font-size:14px">' +
          esc(isWrong ? t('wrong_desc') : t('setup_desc')(total)) +
        '</div>' +
      '</div>' +
      '<div class="glass panel">' +
        '<h2 class="sec" style="margin-top:0">' + esc(t('settings')) + '</h2>' +
        '<div class="setrow"><div><div class="t">' + esc(t('shuf_q')) + '</div><div class="d">' + esc(t('shuf_qd')) + '</div></div>' +
          '<label class="switch"><input type="checkbox" id="swQ"><span class="tr"></span><span class="th"></span></label></div>' +
        '<div class="setrow"><div><div class="t">' + esc(t('shuf_a')) + '</div><div class="d">' + esc(t('shuf_ad')) + '</div></div>' +
          '<label class="switch"><input type="checkbox" id="swA"><span class="tr"></span><span class="th"></span></label></div>' +
        '<div style="height:18px"></div>' +
        '<button class="btn good big" id="start">' + esc(t('start_test')) + '</button>' +
      '</div>' +
    '</div>';

  $('#back').addEventListener('click', ()=> go('home'));
  $('#start').addEventListener('click', ()=>{
    startSession({
      wrong: isWrong, tplId: state.tplId,
      shufQ: $('#swQ').checked, shufA: $('#swA').checked,
    });
  });
}

/* ---------- MARATHON ---------- */
function renderMarathon(){
  const total = allItems().length;
  const isSrs = !!state.srs;
  const dueN = srsDueCount();
  const weakN = srsWeakCount();
  const repN = repeatedMistakes();

  /* сохранённая сессия показывается только в своём режиме (марафон / повторение) */
  const saved = loadMarathonState();
  const hasSaved = !!saved && (!!saved.srs === isSrs);
  let resumeHTML = '';
  if(hasSaved){
    const n = saved.items.length;
    const answered = saved.answers.filter(a=> a !== null).length;
    resumeHTML =
      '<div class="glass panel resume" style="margin-bottom:18px">' +
        '<div class="row spread">' +
          '<div>' +
            '<h4><i class="pauseglyph"></i>' + esc(t('resume_title')) + '</h4>' +
            '<div class="sub">' + esc(t('saved_meta')(answered, n, fmtTime(saved.remain||0))) + '</div>' +
            '<div class="sub">' + esc(t('saved_when')(agoText(saved.ts))) + '</div>' +
            (saved.lang !== LANG ? '<div class="sub warnline">⚠ ' + esc(t('resume_lang_warn')) + '</div>' : '') +
          '</div>' +
          '<div class="row">' +
            '<button class="btn ghost" id="restartM">' + esc(t('restart_btn')) + '</button>' +
            '<button class="btn good" id="resumeM">' + esc(t('resume_btn')) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  const rMax = Math.max(1, isSrs ? dueN : total);
  const rMin = Math.min(20, rMax);
  const rVal = Math.max(rMin, Math.min(rMax, isSrs ? Math.min(dueN, 50) : 100));

  view.innerHTML =
    '<div class="row" style="margin-bottom:14px"><button class="btn ghost" id="back">' + esc(t('back')) + '</button></div>' +
    resumeHTML +
    '<div class="setup">' +
      '<div class="glass panel">' +
        '<div class="statbig"><div class="n">' + (isSrs ? dueN : total) + '</div><div class="l">' + esc(isSrs ? t('repeat_label') : t('total_q')) + '</div></div>' +
        '<h2 class="sec">' + icon(isSrs ? 'brain' : 'flag') + esc(stripEmo(isSrs ? t('srs_title') : t('marathon_title'))) + '</h2>' +
        '<div class="muted" style="font-size:14px">' +
          esc(isSrs ? t('srs_desc') : t('marathon_desc') + ' ' + t('marathon_focus_note')) +
        '</div>' +
        (weakN ? '<div class="chip bad" style="margin-top:12px;display:inline-block">🔴 ' + esc(t('weak')(weakN)) + '</div>' : '') +
        '<div class="chip ' + (repN ? 'bad' : 'good') + '" style="margin-top:12px;display:inline-block;' + (weakN ? 'margin-left:6px' : '') + '">' + esc(t('mistakes_focus')(repN)) + '</div>' +
      '</div>' +
      '<div class="glass panel">' +
        '<h2 class="sec" style="margin-top:0">' + esc(t('amount')) + '</h2>' +
        '<input type="range" id="mRange" min="' + rMin + '" max="' + rMax + '" step="5" value="' + rVal + '">' +
        '<div class="row spread" style="margin-top:8px">' +
          '<input type="number" id="mNum" min="' + rMin + '" max="' + rMax + '" value="' + rVal + '">' +
          '<span class="muted">' + esc(t('of_total')(rMax)) + '</span>' +
        '</div>' +
        '<div class="setrow" style="margin-top:10px"><div><div class="t">' + esc(t('shuf_a')) + '</div><div class="d">' + esc(t('shuf_ad')) + '</div></div>' +
          '<label class="switch"><input type="checkbox" id="swA" checked><span class="tr"></span><span class="th"></span></label></div>' +
        '<div style="height:14px"></div>' +
        '<button class="btn good big" id="start">' + esc(isSrs ? t('start_repeat') : t('start_marathon')) + '</button>' +
      '</div>' +
    '</div>';

  const range = $('#mRange'), num = $('#mNum');
  const sync = v=>{
    v = Math.max(rMin, Math.min(rMax, Math.round(v)||rMin));
    range.value = v; num.value = v;
  };
  range.addEventListener('input', ()=> sync(+range.value));
  num.addEventListener('change', ()=> sync(+num.value));

  $('#back').addEventListener('click', ()=> go('home'));
  $('#start').addEventListener('click', async ()=>{
    if(hasSaved && !await ask(t('resume_discard_title'), t('resume_discard_text'), t('resume_discard_ok'))) return;
    clearMarathonState();
    startSession({ marathon: true, srs: isSrs, count: +num.value, shufQ: true, shufA: $('#swA').checked });
  });

  if(hasSaved){
    $('#resumeM').addEventListener('click', ()=> resumeMarathon(saved));
    $('#restartM').addEventListener('click', async ()=>{
      if(await ask(t('resume_discard_title'), t('resume_discard_text'), t('resume_discard_ok'))){
        clearMarathonState();
        go('marathon', { srs: isSrs });
      }
    });
  }
}

/* ---------- SESSION ---------- */
function startSession(opts){
  let items;
  if(opts.wrong){
    const w = loadWrong();
    items = [];
    Object.keys(w).sort((a,b)=>(+a)-(+b)).forEach(tid=>{
      Object.keys(w[tid]).sort((a,b)=>(+a)-(+b)).forEach(oi=>{
        items.push({ tplId: tid, orig: +oi, q: data()[tid].questions[+oi] });
      });
    });
  } else if(opts.marathon){
    const pool = allItems();
    const s = loadSRS();
    const m = loadMistakes();
    const now = Date.now();
    /* вес вопроса: повторные ошибки (c>=2) — 3, одна ошибка — 1.5, остальные — 1 */
    const wOf = it =>{ const e = m[it.tplId + ':' + it.orig]; const c = e ? (e.c||0) : 0; return c >= 2 ? 3 : c === 1 ? 1.5 : 1; };
    /* взвешенный порядок: перемешанный — weight * random desc;
       если shufQ выключен — только сортировка по весу desc, без случайности */
    const weighted = arr => opts.shufQ
      ? arr.map(it=>({ it: it, k: wOf(it) * Math.random() })).sort((a,b)=> b.k - a.k).map(x=>x.it)
      : arr.slice().sort((a,b)=> wOf(b) - wOf(a));
    const due = pool.filter(it=>{ const e = s[srsKey(it.tplId, it.orig)]; return e && (e.next||0) <= now; });
    const rest = pool.filter(it=> !s[srsKey(it.tplId, it.orig)] || (s[srsKey(it.tplId, it.orig)].next||0) > now);
    items = weighted(due).concat(weighted(rest)).slice(0, opts.count || 100);
  } else {
    items = data()[opts.tplId].questions.map((q,i)=>({ tplId: opts.tplId, orig: i, q: q }));
  }
  if(opts.shufQ && !opts.marathon) shuffle(items);
  items = items.map(it=>{
    if(!opts.shufA) return it;
    const aOrder = shuffle(it.q.answers.map((_,i)=>i));
    return { tplId: it.tplId, orig: it.orig, aOrder: aOrder, q: { body: it.q.body, expl: it.q.expl, answers: aOrder.map(ai=>it.q.answers[ai]) } };
  });
  const minutes = opts.marathon ? Math.ceil(items.length * 1.25) : EXAM_MINUTES;
  if(opts.marathon) clearMarathonState();
  go('exam', {
    wrong: opts.wrong, marathon: opts.marathon, srs: opts.srs, tplId: opts.tplId,
    shufQ: opts.shufQ, shufA: opts.shufA,
    langAtStart: LANG,
    questions: items,
    answers: new Array(items.length).fill(null),
    qTimes: new Array(items.length).fill(0),
    startedAt: Date.now(),
    idx: 0,
    deadline: Date.now() + minutes*60*1000,
    finished: false,
  });
}

/* ---------- EXAM ---------- */
function renderExam(){
  const total = state.questions.length;
  const title = state.wrong ? stripEmo(t('wrong_title')) : state.marathon ? stripEmo(t('marathon_title')) : t('tpl_name')(data()[state.tplId].name);

  /* Шапка теста: один компактный ряд без переносов.
     Порядок: Назад · название · [гибкий зазор] · счётчик · таймер · пауза · Завершить */
  view.innerHTML =
    '<div class="toolbar"><div class="glass">' +
      '<div class="exambar">' +
        '<button class="btn ghost ebtn-back" id="back" aria-label="' + esc(t('back')) + '">' +
          '<span class="ic-back">←</span><span class="lbl">' + esc(t('back')).replace('← ','') + '</span>' +
        '</button>' +
        '<b class="extitle">' + esc(title) + '</b>' +
        '<span class="exspacer"></span>' +
        '<span class="muted excounter" id="counter"></span>' +
        '<span class="timer" id="timer">--:--</span>' +
        (state.marathon ? '<button class="btn pausebtn" id="pause" title="' + esc(t('pause_btn')) + '" aria-label="' + esc(t('pause_btn')) + '"><i class="pauseglyph"></i><span class="lbl">' + esc(t('pause_btn')) + '</span></button>' : '') +
        '<button class="btn ghost ebtn-fs" id="fsbtn" title="' + esc(t('fs_btn')) + '" aria-label="' + esc(t('fs_btn')) + '" hidden><i class="ic-fs"></i></button>' +
        '<button class="btn primary ebtn-fin" id="finish">' + esc(t('finish')) + '</button>' +
      '</div>' +
      '<div class="progressbar"><div id="pbar"></div></div>' +
    '</div></div>' +
    '<div id="qwrap"></div>';

  const tick = ()=>{
    const left = state.deadline - Date.now();
    const el = $('#timer');
    if(!el) return;
    el.textContent = fmtTime(left);
    el.className = 'timer' + (left < 60000 ? ' danger' : left < 300000 ? ' warn' : '');
    if(left <= 0){ finishExam(true); }
  };
  state.timerId = setInterval(tick, 500); tick();

  $('#back').addEventListener('click', async ()=>{
    if(state.marathon){
      /* в марафоне выход = сохранение, терять длинную сессию нельзя */
      if(state.timerId){ clearInterval(state.timerId); state.timerId = null; }
      const frozenLeft = state.deadline - Date.now();
      const ok = await ask(t('pause_title'), t('pause_text'), t('pause_ok'));
      state.deadline = Date.now() + frozenLeft;
      if(!ok){
        if(!state.finished){ state.timerId = setInterval(tick, 500); tick(); }
        return;
      }
      const saved = saveMarathonState();
      state.paused = true;
      go('home');
      toast(saved ? t('pause_saved') : t('pause_failed'));
      return;
    }
    if(await ask(t('exit_title'), t('exit_text'), t('exit_ok'))) go('home');
  });
  $('#finish').addEventListener('click', async ()=>{
    const left = state.answers.filter(a=>a===null).length;
    if(left && !await ask(t('finish_title'), t('unanswered')(left), t('finish'))) return;
    finishExam(false);
  });

  if(state.marathon){
    $('#pause').addEventListener('click', async ()=>{
      /* замораживаем таймер на время диалога, чтобы раздумья не съедали время */
      if(state.timerId){ clearInterval(state.timerId); state.timerId = null; }
      const frozenLeft = state.deadline - Date.now();
      const ok = await ask(t('pause_title'), t('pause_text'), t('pause_ok'));
      state.deadline = Date.now() + frozenLeft;
      if(!ok){
        if(!state.finished){ state.timerId = setInterval(tick, 500); tick(); }
        return;
      }
      const saved = saveMarathonState();
      if(saved){ state.paused = true; go('home'); toast(t('pause_saved')); }
      else {
        toast(t('pause_failed'));
        if(!state.finished){ state.timerId = setInterval(tick, 500); tick(); }
      }
    });
  }
  /* кнопка возврата в полноэкранный режим (видна, только когда он выключен) */
  const fsb = $('#fsbtn');
  if(fsb) fsb.addEventListener('click', ()=>{ enterFullscreen().then(syncFsUI); });

  /* нижняя панель навигации — только десктоп/планшет, CSS прячет её <768px */
  bottombar.classList.add('on');
  renderQuestion();

  /* автозапуск полного экрана; отказ браузера гасится в .catch() внутри */
  enterFullscreen().then(syncFsUI);
  syncFsUI();
  requestAnimationFrame(setExamHeaderVar);
  setTimeout(setExamHeaderVar, 200);
}

function renderDots(){
  const html = state.questions.map((it,i)=>{
    let cls = 'd';
    const sel = state.answers[i];
    if(sel !== null){
      /* ответ дан: зелёный = верно, красный = неверно */
      const okIdx = it.q.answers.findIndex(a=>a.check);
      cls += (sel === okIdx) ? ' ok' : ' no';
    } else {
      /* не отвечен: жёлтый */
      cls += ' pend';
    }
    if(i === state.idx) cls += ' cur';
    return '<div class="' + cls + '" data-i="' + i + '">' + (i+1) + '</div>';
  }).join('');
  const d = $('#dots');
  if(d) d.innerHTML = html;
  $('#dotsMobile').innerHTML = html;
  const bind = root => root.querySelectorAll('.d').forEach(el=>{
    el.addEventListener('click', ()=>{ state.idx = +el.dataset.i; renderQuestion(); });
  });
  if(d) bind(d);
  bind($('#dotsMobile'));
  const cur = $('#dotsMobile .d.cur');
  if(cur) cur.scrollIntoView({ block:'nearest', inline:'center' });
}

function renderQuestion(){
  const q = state.questions[state.idx].q;
  if(!state.qTimes) state.qTimes = new Array(state.questions.length).fill(0);
  state.qShownAt = Date.now();
  const total = state.questions.length;
  const sel = state.answers[state.idx];
  const answered = sel !== null;
  const okIdx = q.answers.findIndex(a=>a.check);

  $('#counter').textContent = t('q_of')(state.idx+1, total);
  $('#pbar').style.width = ((state.idx+1)/total*100) + '%';

  const answersHTML = q.answers.map((a,i)=>{
    let cls = 'ans locked';
    if(answered){
      if(i === okIdx) cls += ' ok';
      else if(i === sel) cls += ' no';
    }
    if(!answered) cls = 'ans';
    return '<div class="' + cls + '" data-i="' + i + '">' +
      '<div class="letter">' + (letters()[i]||i+1) + '</div>' +
      '<div>' + bodyHTML(a.body) + '</div></div>';
  }).join('');

  let explHTML = '';
  if(answered && q.expl){
    const good = sel === okIdx;
    explHTML = '<div class="expl" style="border-left-color:' + (good?'var(--good)':'var(--bad)') + '">' +
      '<b>' + esc(good ? t('expl_good') : t('expl_bad')) + '</b> ' + esc(q.expl) + '</div>';
  }

  /* Двухколоночная раскладка: слева номер, текст и ответы, справа — крупная
     картинка дорожной ситуации. Если картинки нет, колонка не создаётся
     и текст занимает всю ширину. */
  const withImg = hasImg(q.body);

  $('#qwrap').innerHTML =
    '<div class="glass qcard' + (withImg ? ' split' : '') + '">' +
      '<div class="qmain">' +
        '<div class="qnum">' + esc(t('q_of')(state.idx+1, total)) + '</div>' +
        '<div class="qtext">' + bodyHTML(q.body, 'text') + '</div>' +
        '<div class="answers">' + answersHTML + '</div>' +
        explHTML +
        '<div class="row spread qnav">' +
          '<button class="btn" id="prev" ' + (state.idx===0?'disabled':'') + '>' + esc(t('back')) + '</button>' +
          '<span class="muted">' + esc(answered ? t('answered') : t('pick')) + '</span>' +
          '<button class="btn" id="next">' + esc(state.idx===total-1 ? t('to_result') : t('next')) + '</button>' +
        '</div>' +
      '</div>' +
      (withImg ? '<div class="qaside">' + bodyHTML(q.body, 'img') + '</div>' : '') +
    '</div>';

  if(!answered){
    $('#qwrap').querySelectorAll('.ans').forEach(el=>{
      el.addEventListener('click', ()=>{
        state.answers[state.idx] = +el.dataset.i;
        state.qTimes[state.idx] += Date.now() - (state.qShownAt || Date.now());
        renderQuestion();
        if(state.idx < total-1) setTimeout(()=>{ state.idx++; renderQuestion(); }, 220);
      });
    });
  }
  setExamHeaderVar();
  $('#prev').addEventListener('click', ()=>{ if(state.idx>0){ state.idx--; renderQuestion(); } });
  $('#next').addEventListener('click', ()=>{
    if(state.idx<total-1){ state.idx++; renderQuestion(); }
    else finishExam(false);
  });

  renderDots();
}

function touchHistory(correct, total){
  let h = [];
  try{ h = JSON.parse(localStorage.getItem('eavt_history')||'[]'); }catch(e){}
  h.push({ c: correct, t: total, ts: Date.now() });
  if(h.length > 200) h = h.slice(-200);
  try{ localStorage.setItem('eavt_history', JSON.stringify(h)); }catch(e){}
}

function finishExam(timeout){
  if(state.finished) return;
  state.finished = true;
  if(state.timerId){ clearInterval(state.timerId); state.timerId=null; }
  if(state.marathon) clearMarathonState();
  let correct = 0;
  state.questions.forEach((it, i)=>{
    const sel = state.answers[i];
    const ok = sel !== null && it.q.answers[sel] && it.q.answers[sel].check;
    if(ok) correct++;
    if(sel !== null){
      if(ok){ markRight(it.tplId, it.orig); srsRight(it.tplId, it.orig); }
      else { markWrong(it.tplId, it.orig); srsWrong(it.tplId, it.orig); markMistake(it.tplId, it.orig); }
    }
  });
  const total = state.questions.length;
  if(!state.wrong && !state.marathon){
    const prog = loadProgress();
    const prev = prog[state.tplId];
    if(!prev || correct > prev.correct){
      prog[state.tplId] = { correct: correct, total: total, ts: Date.now() };
      saveProgress(prog);
    }
  }
  if(!state.wrong) touchHistory(correct, total);
  /* учёт времени: раздумья по каждому билету + длительность сессии билета */
  state.qTimes = state.qTimes || new Array(state.questions.length).fill(0);
  const T = loadTime();
  state.questions.forEach((it, i)=>{
    const e = T[it.tplId] = T[it.tplId] || { think: 0, wall: 0, cnt: 0, sess: 0 };
    e.think += state.qTimes[i] || 0;
    if(state.answers[i] !== null) e.cnt += 1;
  });
  if(!state.wrong && !state.marathon && state.tplId && T[state.tplId]){
    T[state.tplId].wall += Date.now() - (state.startedAt || Date.now());
    T[state.tplId].sess += 1;
  }
  saveTime(T);
  state.spentMs = state.startedAt ? Date.now() - state.startedAt : 0;
  try{ if(authInfo()) syncPush(false); }catch(e){}
  go('result', Object.assign({}, state, { timeout: timeout }));
}

/* ---------- RESULT ---------- */
function renderResult(){
  let correct = 0;
  state.questions.forEach((it, i)=>{
    const sel = state.answers[i];
    if(sel !== null && it.q.answers[sel] && it.q.answers[sel].check) correct++;
  });
  const total = state.questions.length;
  const pc = Math.round(correct/total*100);
  const pass = pc >= 70;
  const nxt = (state.wrong || state.marathon) ? null : nextTplId(state.tplId);

  /* строка времени на результате */
  let timeHTML = '';
  const spentMin = state.spentMs ? Math.max(1, Math.round(state.spentMs/60000)) : 0;
  const thinkSum = (state.qTimes||[]).reduce((s,x)=>s+(x||0),0);
  const answeredN = state.answers.filter(a=>a!==null).length;
  if(answeredN){
    const avgSec = Math.round(thinkSum/answeredN/1000);
    timeHTML = '<div class="muted" style="margin-top:4px">' + esc(t('time_res')(spentMin || '<1', avgSec)) + '</div>';
  }

  /* среднее время на отвеченный вопрос — чтобы пометить «долгие» (сложные) */
  const qTimesArr = state.qTimes || [];
  const answeredTimes = qTimesArr.filter(x=>x>0);
  const avgThinkMs = answeredTimes.length ? answeredTimes.reduce((s,x)=>s+x,0)/answeredTimes.length : 0;
  const reviewHTML = state.questions.map((it, i)=>{
    const q = it.q;
    const sel = state.answers[i];
    const okIdx = q.answers.findIndex(a=>a.check);
    const qtSec = Math.round((qTimesArr[i]||0)/1000);
    const slowQ = qtSec > 0 && (qtSec >= 30 || qTimesArr[i] > 2*avgThinkMs);
    const answersHTML = q.answers.map((a,j)=>{
      let cls = 'ans locked';
      if(j === okIdx) cls += ' ok';
      else if(j === sel) cls += ' no';
      return '<div class="' + cls + '"><div class="letter">' + ((letters()[j])||j+1) + '</div><div>' + bodyHTML(a.body) + '</div></div>';
    }).join('');
    const expl = q.expl ? '<div class="expl"><b>' + esc(t('expl_lbl')) + '</b> ' + esc(q.expl) + '</div>' : '';
    return '<div class="glass qcard">' +
      '<div class="qnum">' + esc(t('q_num')(i+1)) + ' ' + (sel===okIdx ? '<span style="color:var(--good)">✓</span>' : '<span style="color:var(--bad)">✗</span>') +
      (qtSec > 0 ? '<span class="qtime' + (slowQ ? ' slow' : '') + '">⏱ ' + qtSec + ' с' + (slowQ ? ' 🐢' : '') + '</span>' : '') + '</div>' +
      '<div class="qtext">' + bodyHTML(q.body) + '</div>' +
      '<div class="answers">' + answersHTML + '</div>' +
      expl + '<div class="row" style="margin-top:10px;justify-content:flex-end"><button class="btn ai-btn" onclick="openAiChatFromReview(' + i + ')">' + esc(t('ai_btn')) + '</button></div></div>';
  }).join('');

  view.innerHTML =
    '<div class="glass result">' +
      (state.timeout ? '<div class="chip bad" style="display:inline-block">' + esc(t('timeout')) + '</div>' : '') +
      '<div class="score ' + (pass?'bigok':'bigbad') + '">' + correct + '<small> / ' + total + '</small></div>' +
      '<div class="muted">' + pc + '% · ' + esc(pass ? t('pass') : t('fail')) + '</div>' +
      timeHTML +
      '<div class="row" style="justify-content:center;margin-top:22px">' +
        '<button class="btn" id="home">' + esc(t('home_btn')) + '</button>' +
        '<button class="btn" id="retry">' + esc(t('retry')) + '</button>' +
        (nxt ? '<button class="btn primary" id="nextTpl">' + esc(t('next_tpl')) + '</button>' : '') +
      '</div>' +
    '</div>' +
    '<h2 class="sec">' + esc(t('review')) + '</h2>' +
    '<div class="review">' + reviewHTML + '</div>';

  $('#retry').addEventListener('click', ()=> startSession({
    wrong: state.wrong, marathon: state.marathon, tplId: state.tplId,
    count: state.marathon ? total : undefined,
    shufQ: state.shufQ, shufA: state.shufA,
  }));
  $('#home').addEventListener('click', ()=> go('home'));
  if(nxt) $('#nextTpl').addEventListener('click', ()=> go('setup', { tplId: nxt }));
}

/* ---------- STATS ---------- */
function renderArchive(){
  const arr = loadArchive().slice().reverse();
  const listHTML = arr.length ? arr.map(r=>{
    const d = new Date(r.ts);
    const when = d.toLocaleDateString(LANG === 'uz' ? 'uz-UZ' : 'ru-RU') + ' ' + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const rows = r.items.map(it=>{
      const tt = data()[it.n];
      const nm = tt ? t('tpl_name')(tt.name) : (String(it.n).match(/^\d+$/) ? t('tpl_name')(it.n) : it.n);
      return '<div class="ar-row"><span>' + esc(nm) + '</span><span class="' + (it.p>=70?'good':'bad') + '">' + it.p + '%</span><span class="muted">' + (it.min !== null ? it.min + ' мин' : '—') + '</span></div>';
    }).join('');
    return '<div class="glass panel" style="margin-bottom:14px">' +
      '<div class="row spread" style="align-items:center;margin-bottom:8px">' +
        '<b>' + esc(when) + '</b>' +
        '<span class="chip ' + (r.avg>=70?'good':'bad') + '">' + r.avg + '%</span>' +
      '</div>' +
      '<div class="muted" style="margin-bottom:8px">' + r.items.length + ' ' + (LANG==='uz' ? 'bilet' : 'билетов') + '</div>' +
      rows +
    '</div>';
  }).join('') : '<div class="glass panel">' + esc(t('archive_empty')) + '</div>';

  view.innerHTML =
    '<div class="glass panel roadhead" style="margin-bottom:20px">' +
      '<div class="roadhead-top">' +
        '<div><b style="font-size:17px">' + esc(t('archive')) + '</b>' +
        '<div class="sub">' + esc(t('archive_sub')(arr.length)) + '</div></div>' +
        '<button class="btn" id="arBack">' + esc(t('archive_back')) + '</button>' +
      '</div></div>' + listHTML;
  $('#arBack').addEventListener('click', ()=> go('home'));
}

function renderStats(){
  const prog = loadProgress();
  const wc = wrongCount();
  const repN = repeatedMistakes();
  let hist = [];
  try{ hist = JSON.parse(localStorage.getItem('eavt_history')||'[]'); }catch(e){}

  let correct = 0, total = 0;
  Object.values(prog).forEach(p=>{ correct += p.correct; total += p.total; });
  const pct = total ? Math.round(correct/total*100) : 0;

  let streak = 0;
  if(hist.length){
    const days = [...new Set(hist.map(h=> new Date(h.ts).toDateString()))].sort((a,b)=> new Date(b)-new Date(a));
    const cur = new Date(); cur.setHours(0,0,0,0);
    if(days[0] !== cur.toDateString()) cur.setDate(cur.getDate()-1);
    for(const d of days){
      if(d === cur.toDateString()){ streak++; cur.setDate(cur.getDate()-1); }
      else break;
    }
  }

  const doneCnt = Object.values(prog).filter(p=> p.correct/p.total >= .7).length;
  const badges = [
    { ico:'traffic', lbl:t('badge_first'), on: hist.length >= 1 },
    { ico:'shield', lbl:t('badge_10'), on: doneCnt >= 10 },
    { ico:'wrench', lbl:t('badge_clean'), on: total > 0 && wc === 0 },
    { ico:'flame', lbl:t('badge_3days'), on: streak >= 3 },
    { ico:'trophy', lbl:t('badge_all'), on: doneCnt >= 64 },
  ].map(b=> '<div class="badge ' + (b.on?'':'off') + '"><span class="bi">' + icon(b.ico) + '</span><span class="bl">' + b.lbl + '</span></div>').join('');

  const rows = sortedIds().map(id=>{
    const p = prog[id];
    const pc = p ? Math.round(p.correct/p.total*100) : 0;
    const color = !p ? 'rgba(128,128,128,.4)' : pc >= 70 ? 'var(--good)' : 'var(--bad)';
    return '<div class="trow"><span class="muted">№' + esc(data()[id].name) + '</span>' +
      '<div class="bar"><div style="width:' + pc + '%;background:' + color + '"></div></div>' +
      '<span class="muted" style="text-align:right">' + (p ? pc + '%' : '—') + '</span></div>';
  }).join('');

  view.innerHTML =
    '<div class="row" style="margin-bottom:14px"><button class="btn ghost" id="back">' + esc(t('back')) + '</button></div>' +
    '<div class="glass panel" style="text-align:center">' +
      '<h2 class="sec" style="margin-top:0">' + icon('chart') + esc(stripEmo(t('stats_title'))) + '</h2>' +
      '<div class="ring" style="--pct:' + pct + '%"><div class="hole">' +
        '<div><div class="big">' + pct + '%</div><div class="muted">' + esc(t('right_ans')) + '</div></div>' +
      '</div></div>' +
      '<div class="row" style="justify-content:center;margin-top:16px">' +
        '<span class="chip">' + esc(t('right_chip')(correct, total)) + '</span>' +
        '<span class="chip ' + (wc?'bad':'good') + '">' + esc(wc ? t('wrong_work')(wc) : t('no_wrong')) + '</span>' +
        '<span class="chip ' + (repN?'bad':'good') + '">' + esc(t('repeated_mistakes')(repN)) + '</span>' +
        '<span class="streak">🔥 ' + esc(t('streak_days')(streak)) + '</span>' +
        (srsDueCount() ? '<span class="chip" style="border-color:rgba(138,180,248,.4);color:var(--accent)">' + esc(t('due')(srsDueCount())) + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<h2 class="sec">' + esc(t('badges_ttl')) + '</h2>' +
    '<div class="row">' + badges + '</div>' +
    '<h2 class="sec">' + esc(t('by_tpl')) + '</h2>' +
    '<div class="glass panel"><div class="trows">' + rows + '</div></div>';

  $('#back').addEventListener('click', ()=> go('home'));
}

/* ---------- автосохранение марафона при уходе со страницы ---------- */
function autosaveMarathon(){
  if(state && state.marathon && !state.finished && !state.paused && state.questions) saveMarathonState();
}
addEventListener('pagehide', autosaveMarathon);
addEventListener('beforeunload', autosaveMarathon);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'hidden') autosaveMarathon(); });

/* ---------- keyboard ---------- */
addEventListener('keydown', e=>{
  if(!state || !state.questions || state.finished) return;
  if(!$('#qwrap')) return;
  const total = state.questions.length;
  if(e.key === 'ArrowRight'){ if(state.idx < total-1){ state.idx++; renderQuestion(); } }
  else if(e.key === 'ArrowLeft'){ if(state.idx > 0){ state.idx--; renderQuestion(); } }
  else if(/^[1-8]$/.test(e.key) || /^F[1-8]$/.test(e.key)){
    const i = +e.key.replace('F','') - 1;
    if(state.answers[state.idx] === null && i < state.questions[state.idx].q.answers.length){
      state.answers[state.idx] = i;
      renderQuestion();
      if(state.idx < total-1) setTimeout(()=>{ state.idx++; renderQuestion(); }, 220);
    }
  }
});

/* ---------- boot ---------- */
/* Решение при старте: подтвердить вход / домой / страница входа */
function decideAuthAndBoot(){
  const a = authInfo();
  if(a){
    if(Date.now() - (a.lastConfirm || Date.now()) > AUTH_CONFIRM_TTL){
      go('auth', { confirm: true });
    } else {
      go('home');
      syncPull(false);
    }
  } else if(localStorage.getItem(LS_SKIPPED) === '1'){
    go('home');
  } else {
    go('auth');
  }
}

function bootApp(){
  /* заставка: плавно гасим и убираем из DOM */
  const sp = $('#splash');
  if(sp){
    sp.classList.add('gone');
    setTimeout(()=> sp.remove(), 500);
  }
  if(!Object.keys(DATA_RU).length){
    view.innerHTML = '<div class="glass empty">' + t('no_data') + '</div>';
  } else if(LANG === 'uz' && !Object.keys(DATA_UZ).length){
    view.innerHTML = '<div class="glass empty">Yuklanmoqda…</div>';
    ensureUz(()=>{ updateChrome(); decideAuthAndBoot(); });
  } else {
    decideAuthAndBoot();
  }
}
setTimeout(bootApp, 1800);

function closeAiChat() {
  const modal = $('#aiModal');
  if (modal) modal.remove();
  aiCurrentContext = null;
}

function appendAiMessage(role, content) {
  const container = $('#aiMessages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'ai-message ' + role;
  div.textContent = content;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function sendAiMessage() {
  const input = $('#aiInput');
  const sendBtn = $('#aiSend');
  const text = input?.value?.trim();
  if (!text) return; // контекст может быть null — это общий чат

  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;
  sendBtn.textContent = t('ai_thinking');

  appendAiMessage('user', text);

  const messages = buildAiMessages(aiCurrentContext, text);
  const botMsg = appendAiMessage('assistant', '');
  let fullText = '';

  askAI(messages, (chunk, err) => {
    if (err) {
      botMsg.textContent = (err === 'timeout') ? t('ai_timeout') : t('ai_error');
      botMsg.style.color = 'var(--bad)';
      input.disabled = false;
      sendBtn.disabled = false;
      sendBtn.textContent = t('ai_send');
      return;
    }
    if (chunk !== null) {
      fullText += chunk;
      botMsg.textContent = fullText;
      const container = $('#aiMessages');
      if (container) container.scrollTop = container.scrollHeight;
    } else {
      // Done
      aiChatHistory.push({ role: 'user', content: text });
      aiChatHistory.push({ role: 'assistant', content: fullText });
      input.disabled = false;
      sendBtn.disabled = false;
      sendBtn.textContent = t('ai_send');
      input.focus();
    }
  });
}

// Global exposure for onclick handlers
window.openAiChat = openAiChat;
window.closeAiChat = closeAiChat;
window.sendAiMessage = sendAiMessage;
window.openAiChatFromReview = openAiChatFromReview;
window.closeAuthModal = closeAuthModal;
