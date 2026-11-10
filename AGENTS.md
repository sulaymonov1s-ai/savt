# SAVT — офлайн тренажёр ПДД (Узбекистан)

SPA без сборки: `index.html` + `app.js` + `data.js` + `data_uz.js`.
Зависимостей нет вообще: ни npm, ни CDN (мешал бы CSP `script-src 'self'` и офлайн).
Данные: `eavt_63_final.json` → `build_data.py` → `data.js` (RU, 63 шаблона, 1255 вопросов);
`eavt_uz.json` → `data_uz.js` (UZ, тоже 63/1255).
Картинки: `images/` (870 JPEG, офлайн). `unpack_images.py` / `fetch_images.js`.

## Деплой
Прод: https://sulaymonov1s-ai.github.io/savt/ (GitHub Pages, ветка master, корень).
Репо: https://github.com/sulaymonov1s-ai/savt
Push: `git push origin master` — Pages пересобирается сам (~1 мин).

## AI-помощник
- Worker: https://savt-ai.sulaymonov1s.workers.dev (Cloudflare, `worker/`, wrangler deploy).
- Провайдер: NVIDIA build.nvidia.com, модель `nvidia/nemotron-3.5-super-vl-120b-a12b` (vision + reasoning).
- Секрет AI_API_KEY — в Cloudflare (wrangler secret put), в коде ключей нет.
- CORS: ALLOWED_ORIGIN в wrangler.toml = https://sulaymonov1s-ai.github.io (точное совпадение).
- CSP index.html: connect-src включает worker + back.eavtotalim.uz (картинки для vision качаются fetch'ем).
- UI: FAB-кнопка 🤖 на главной (renderHome, .ai-fab) — общий чат по ПДД; кнопка в карточках разбора (renderResult) — разбор вопроса с картинкой. Внутри теста кнопки ИИ нет (не мешает). Модалка .ai-modal, стриминг SSE, контекст без HTML-тегов (plainBody).
- Подробности: DEPLOY_AI.md.

## Запуск локально
```bash
cd /workspace/project
python3 -m http.server 12000   # work-1 host
python3 -m http.server 12001   # work-2 host
```

## Фичи
Двуязычие RU/UZ (переключатель в шапке, `eavt_lang`, словарь I18N в app.js);
серпантин 63 шаблона; тест 20 воп./25 мин; разбор; ошибки (eavt_wrong_v1);
марафон (20–1260) с паузой/возобновлением (eavt_marathon_save_v1);
SRS SM-2 (eavt_srs_v1); статистика (eavt_progress_v1, eavt_history);
день/ночь (eavt_theme); клавиши 1-8/←/→.

## UI / редизайн
Three.js-фон (дорога с машинами) удалён: -592 КБ, -1 WebGL-контекст.
Паттерны современных реестров (Aceternity / Magic UI / 21st.dev) воспроизведены
нативно на CSS — React-компоненты сюда не подключить (нет сборки + CSP).

- **Aurora Background** — `#aurora` с тремя размытыми градиентными пятнами,
  анимация только `transform` (композитор GPU, без reflow).
- **Dot Pattern** — `#dotgrid`, точечная сетка с radial-маской.
- **Animated Beam** — по трассе роадмапа бежит светящийся сегмент
  (`stroke-dasharray` + `--beam-len`); пройденный участок заливается
  градиентом через `stroke-dashoffset`.
- **Border Beam** — у карточек со 100% по рамке вращается луч
  (`@property --beam-angle` + conic-gradient; есть `@supports`-фолбэк).
- **Floating Glass Dock** — `header#topdock` sticky, класс `.scrolled` при скролле.
- **Glass Segmented Control** — `.langsw` со скользящим `.slider` (`moveLangSlider()`).
- **Mode Dock** — `.modedock` с `.glide`, подсветка едет за курсором.
- Статусы узлов: `.done` / `.fail` / `.current` (первый непройденный) / `.perfect` (100%).

### Макет (full-screen, двухколоночный тест)
- `#app` — 1080px на главной; `body.exam-mode #app` — 1720px (1860px с 1900px),
  класс `exam-mode` вешает роутер в `app.js` рядом с `focus-mode`.
- **Экран теста** `.qcard.split` — grid `minmax(0,1fr) / minmax(340px,44%)`
  (с 1500px — `minmax(440px,48%)`): слева `.qmain` (номер, вопрос, ответы,
  `.qnav` прижат `margin-top:auto`), справа `.qaside` с крупной картинкой.
  На `<768px` — одна колонка, картинка поднимается над вопросом (`order:-1`).
- `bodyHTML(parts, only)` + `hasImg(parts)` в `app.js` делят тело вопроса
  на текст и изображение; без картинки карточка рендерится обычной колонкой.
- **Нижняя панель** `.bottombar` — на всех экранах во всю ширину, `z-index:34`,
  точки 36×36, активная `.d.cur` со свечением, автоскролл к текущему вопросу.
  Старый ряд `#dots` внутри карточки удалён.
- **Шапка теста** `.exambar` — `flex-nowrap`; `.toolbar` поднят до `z-index:32`
  (перекрывал `header#topdock` с `z-index:30`). На `<640px` главный хедер
  скрыт целиком (`body.exam-mode header{display:none}`), «Назад» сжимается
  до стрелки `.ic-back`, счётчик `.excounter` прячется.
- **Дорожная карта** — `.modedock` строго `flex-nowrap` в один ряд на всех
  разрешениях, при нехватке места — горизонтальная прокрутка без видимой
  полосы. На `<640px` подписи переключаются на короткие `.mshort`
  (i18n `m_short/s_short/w_short/r_short`). Заголовок: `column` → `row` с 768px.
- Кнопки размера шрифта A−/A+ и вся система `--fsm` удалены полностью.

### Экран теста: мобильная раскладка и полный экран
- **Бренд-хедер** (`header#topdock`) скрыт на экране теста на ВСЕХ размерах
  (`body.exam-mode header#topdock{display:none}`) — остаётся только рабочая
  панель управления шаблоном.
- **Мобильная шапка (<768px)** — `position:fixed;top:0;z-index:100`, фон
  `transparent` (у `.toolbar` и у вложенной `.glass`), `flex-wrap:nowrap` +
  `overflow:hidden`. Под ней псевдоэлемент `::before` с градиентом от `--bg`,
  чтобы контент при скролле не просвечивал сквозь текст.
- Высоту шапки меряет `setExamHeaderVar()` и пишет в `--exhdr-h`;
  `body.exam-mode #app{padding-top:var(--exhdr-h)}`. Пересчёт — на
  `fullscreenchange`, `resize`, `orientationchange` и в `renderQuestion()`.
- **Порядок в карточке на <768px**: текст вопроса → изображение → ответы →
  навигация. Реализовано через `.qmain{display:contents}` + `order` у детей,
  так `.qaside` вклинивается между `.qtext` и `.answers`.
- **Нижняя пагинация 1..20** — только `>=768px`; на мобильных удалена.
- **Fullscreen API**: `enterFullscreen()` вызывается при входе в тест, промис
  всегда с `.catch()` (отказ браузера не ломает загрузку; на iOS Safari API
  нет — `fsSupported()` вернёт false). Слушатели `fullscreenchange` /
  `webkitfullscreenchange` зовут `syncFsUI()`: класс `body.fs-on` и кнопка
  возврата `#fsbtn` (иконка `.ic-fs`), видимая только вне полного экрана.
  Выход с экрана теста (`go()`) снимает фуллскрин и чистит `--exhdr-h`.

### Производительность
Мобильный профиль, CPU x4 throttling: **14 FPS → 45 FPS** при скролле.
Главный тормоз был не в фоне, а в 196 элементах с `backdrop-filter`
(каждая из 63 карточек = свой слой размытия). В `@media(max-width:640px)`
у карточек/узлов/чипов размытие заменено плотной заливкой, halo отключены,
третье пятно ауроры скрыто. Учитывается `prefers-reduced-motion`.
Правило: не добавлять `backdrop-filter` элементам, которые повторяются 60+ раз.

## Пауза марафона (eavt_marathon_save_v1)
Только для марафона и SRS-повторения — обычный тест и работа над ошибками не сохраняются.

- Кнопка «Пауза и сохранить» рендерится в тулбаре при `state.marathon`.
- Выход по «← Назад» из марафона тоже предлагает сохранить (раньше терял прогресс).
- Автосохранение на `pagehide` / `beforeunload` / `visibilitychange:hidden`.
- Возобновление: карточка на экране марафона → «Продолжить» / «Начать заново».
- Снапшот чистится при финише, «Начать заново» и старте нового марафона.

Формат снапшота (`MSAVE_V = 1`), ~1.5 КБ на 40 вопросов:
```
{ v, ts, lang, srs, shufA, idx, remain, answers:[…], items:[{t:tplId, o:orig, a:aOrder|null}] }
```
Тексты вопросов НЕ сохраняются — только ссылки `tplId:orig` + порядок перемешанных
ответов `aOrder`; всё остальное восстанавливается из `data()` в `hydrateMarathonSave()`.
Поэтому снапшот не упирается в лимит localStorage (иначе было бы ~1 МБ).

Важно: RU и UZ наборы структурно расходятся (35 вопросов с разным числом ответов,
73 с другой позицией верного), поэтому снапшот хранит `lang` и восстанавливается
строго в языке сохранения — `resumeMarathon()` сам переключает язык.
`remain` хранит остаток времени, а не абсолютный дедлайн: пауза не «съедает» таймер.
Снапшот инвалидируется при чужой версии, битом JSON, возрасте > 30 дней и
рассинхроне с данными (`hydrateMarathonSave` → null).

Тесты: `node testrig/test_marathon.js` (63 проверки на jsdom, вне репозитория).

## Правки
- После изменений пересобирать `data.js` нужно только при правке `eavt_63_final.json`.
- Сервер должен отвечать на обоих портах.
- Все localStorage ключи с префиксом `eavt_` — не переименовывать без миграции.
- Защита: CSP + nosniff + no-referrer в index.html (мета-теги); взломать статику нельзя — только скопировать.
