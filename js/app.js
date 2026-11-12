import { h, fmtMin } from './ui.js?v=11';
import * as store from './store.js?v=11';
import { EXERCISES, BRAIN_VIDEOS, MUSIC, DAILY_GOALS } from './content.js?v=11';
import { GAMES, stopGame } from './games.js?v=11';
import { createPlayer, startVoiceRecording } from './player.js?v=11';

const app = document.getElementById('app');
let cleanup = null; // вызывается при уходе с экрана
let coordinatorOk = false;

const go = (path) => { location.hash = '#' + path; };

function leave() {
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
}

async function render() {
  leave();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const user = store.currentUser();
  window.scrollTo(0, 0);

  if (parts[0] === 'coordinator') return parts[1] ? patientScreen(parts[1]) : coordinatorScreen();
  if (!user) return loginScreen();

  switch (parts[0]) {
    case 'exercises': return exercisesScreen();
    case 'exercise': return exerciseScreen(parts[1]);
    case 'cognitive': return cognitiveScreen();
    case 'game': return gameScreen(parts[1]);
    case 'music': return parts[1] ? musicScreen(parts[1]) : musicListScreen();
    default: return homeScreen(user);
  }
}

function screen(title, back, ...content) {
  app.replaceChildren(
    h('header', { class: 'top' },
      back != null && h('button', { class: 'back', onclick: () => go(back), 'aria-label': 'Назад' }, '‹ Назад'),
      h('h1', {}, title)),
    h('main', {}, content),
  );
}

async function todayStats(userId, all) {
  const today = store.dayKey();
  const ev = (all || await store.listEvents(userId)).filter((e) => e.userId === userId && e.day === today);
  const done = (type) => ev.filter((e) => e.type === type);
  return {
    exerciseDone: new Set(done('exercise_done').map((e) => e.ref)),
    exercise: done('exercise_done').filter((e) => EXERCISES.some((x) => x.id === e.ref)).length,
    left: done('game').length,
    music: done('music_sing').length,
    videos: done('exercise_video').length,
  };
}

// ---------- вход ----------

function loginScreen() {
  const input = h('input', { type: 'text', placeholder: 'Имя и отчество', autocomplete: 'name', class: 'field' });
  const submit = async (e) => {
    e.preventDefault();
    if (input.value.trim().length < 2) return input.focus();
    await store.login(input.value);
    go('/');
    render();
  };
  app.replaceChildren(h('main', { class: 'login' },
    h('img', { class: 'logo', src: 'icons/icon-192.png?v=11', alt: '' }),
    h('h1', {}, 'Пробуждение'),
    h('form', { onsubmit: submit },
      input,
      h('button', { class: 'btn primary', type: 'submit' }, 'Войти')),
    h('a', { class: 'quiet', href: '#/coordinator' }, 'Координатор'),
  ));
}

// ---------- главная ----------

async function homeScreen(user) {
  const s = await todayStats(user.id);
  const line = (label, n, goal) => h('div', { class: 'today-line' + (n >= goal ? ' ok' : '') },
    h('span', {}, label),
    h('b', {}, n >= goal ? '✓' : `${n} из ${goal}`));
  app.replaceChildren(h('main', {},
    h('p', { class: 'hello' }, 'Здравствуйте,'),
    h('h1', { class: 'name' }, user.name),
    h('button', { class: 'card big', onclick: () => go('/exercises') },
      h('span', { class: 'emoji' }, '🤸'), h('span', {}, 'Упражнения')),
    h('button', { class: 'card big', onclick: () => go('/cognitive') },
      h('span', { class: 'emoji' }, '🧠'), h('span', {}, 'Когнитивная стимуляция')),
    h('section', { class: 'today' },
      h('h2', {}, 'Сегодня'),
      line('Упражнения', s.exercise, DAILY_GOALS.exercise),
      line('Задания', s.left, DAILY_GOALS.left),
      line('Музыка и пение', s.music, DAILY_GOALS.music)),
    h('button', { class: 'quiet', onclick: () => { store.logout(); render(); } }, 'Выйти'),
  ));
}

// ---------- упражнения ----------

async function exercisesScreen() {
  const s = await todayStats(store.currentUser().id);
  screen('Упражнения', '/',
    EXERCISES.map((ex) => h('button', { class: 'card', onclick: () => go('/exercise/' + ex.id) },
      h('span', { class: 'card-title' }, ex.title),
      h('span', { class: 'card-sub' }, s.exerciseDone.has(ex.id) ? '✓ выполнено' : `${ex.minutes} мин`))));
}

// Имя файла на Диске: дата, пациент, к чему относится
function fileName(title, ext) {
  return `${store.dayKey()} ${store.currentUser().name} — ${title}.${ext || 'webm'}`;
}

function exerciseScreen(id) {
  const backTo = BRAIN_VIDEOS.some((x) => x.id === id) ? '/cognitive' : '/exercises';
  const ex = [...EXERCISES, ...BRAIN_VIDEOS].find((x) => x.id === id);
  if (!ex) return go('/exercises');
  store.log('exercise_open', ex.id);
  const player = createPlayer(ex, 'video');
  cleanup = () => {
    player.stop();
    if (player.seconds() >= 5) store.log('exercise_watch', ex.id, { secs: player.seconds() });
  };

  const note = h('p', { class: 'note' });
  const doneBtn = h('button', {
    class: 'btn primary',
    onclick: async () => {
      await store.log('exercise_done', ex.id);
      doneBtn.disabled = true;
      doneBtn.textContent = '✓ Отмечено';
    },
  }, 'Я выполнил(а) упражнение');

  const fileInput = h('input', {
    type: 'file', accept: 'video/*', hidden: true,
    onchange: async () => {
      const file = fileInput.files[0];
      if (!file) return;
      note.textContent = 'Отправляем видео…';
      try {
        const saved = await store.saveFile(file, {
          name: fileName(ex.title, file.name.split('.').pop()),
          onProgress: (p) => { note.textContent = `Отправляем видео… ${Math.round(p * 100)}%`; },
        });
        await store.log('exercise_video', ex.id, { ...saved, size: file.size });
        note.textContent = '✓ Видео отправлено';
      } catch (e) {
        console.error(e);
        note.textContent = 'Не получилось отправить видео. Попробуйте ещё раз.';
      }
      fileInput.value = '';
    },
  });

  screen(ex.title, backTo,
    player.el,
    doneBtn,
    h('button', { class: 'btn', onclick: () => fileInput.click() }, '🎥 Отправить своё видео'),
    fileInput,
    note);
}

// ---------- когнитивная стимуляция ----------

async function cognitiveScreen() {
  const s = await todayStats(store.currentUser().id);
  const tiles = (group) => h('div', { class: 'grid2' }, Object.entries(GAMES)
    .filter(([, g]) => g.group === group)
    .map(([id, g]) => h('button', { class: 'card tile-card', onclick: () => go('/game/' + id) },
      h('span', { class: 'emoji' }, g.icon), h('span', {}, g.title))));
  screen('Когнитивная стимуляция', '/',
    h('h2', { class: 'section' }, 'Левое полушарие'),
    tiles('left'),
    h('h2', { class: 'section' }, 'Внимание и память'),
    tiles('focus'),
    h('h2', { class: 'section' }, 'Упражнения для мозга'),
    BRAIN_VIDEOS.map((ex) => h('button', { class: 'card', onclick: () => go('/exercise/' + ex.id) },
      h('span', { class: 'card-title' }, ex.title),
      h('span', { class: 'card-sub' }, s.exerciseDone.has(ex.id) ? '✓ выполнено' : `${ex.minutes} мин`))),
    h('h2', { class: 'section' }, 'Правое полушарие'),
    h('button', { class: 'card big', onclick: () => go('/music') },
      h('span', { class: 'emoji' }, '🎵'), h('span', {}, 'Музыка и пение')));
}

function gameScreen(id) {
  const game = GAMES[id];
  if (!game) return go('/cognitive');
  const root = h('div', { class: 'game' });
  screen(game.title, '/cognitive', root);
  cleanup = stopGame;
  const play = () => {
    stopGame();
    const started = Date.now();
    game.start(root, async (result) => {
      const secs = Math.round((Date.now() - started) / 1000);
      await store.log('game', id, { ...result, secs });
      root.replaceChildren(
        h('div', { class: 'result' },
          h('div', { class: 'emoji' }, '👏'),
          h('h2', {}, id === 'words' ? `Найдено слов: ${result.score}` : `Верно ${result.score} из ${result.total}`)),
        h('button', { class: 'btn primary', onclick: play }, 'Ещё раз'),
        h('button', { class: 'btn', onclick: () => go('/cognitive') }, 'Готово'));
    });
  };
  play();
}

// ---------- музыка ----------

async function musicListScreen() {
  if (MUSIC.length === 1) return musicScreen(MUSIC[0].id, '/cognitive');
  screen('Музыка и пение', '/cognitive',
    MUSIC.map((m) => h('button', { class: 'card', onclick: () => go('/music/' + m.id) },
      h('span', { class: 'card-title' }, m.title))));
}

function musicScreen(id, back = '/music') {
  const m = MUSIC.find((x) => x.id === id);
  if (!m) return go('/cognitive');
  const player = createPlayer(m, 'audio');
  let recording = null;
  cleanup = () => {
    player.stop();
    if (recording) recording.stop();
    if (player.seconds() >= 5) store.log('music_listen', m.id, { secs: player.seconds() });
  };

  const note = h('p', { class: 'note' });
  const sung = async (data) => {
    await store.log('music_sing', m.id, { ...data, listened: player.seconds() });
    const s = await todayStats(store.currentUser().id);
    note.textContent = `✓ Записано. Сегодня: ${s.music} из ${DAILY_GOALS.music}`;
  };
  const recBtn = h('button', {
    class: 'btn primary',
    onclick: async () => {
      if (!recording) {
        try {
          player.stop();
          recording = await startVoiceRecording();
          recBtn.textContent = '⏹ Остановить запись';
          recBtn.classList.add('recording');
          note.textContent = 'Идёт запись…';
        } catch (e) {
          console.error(e);
          note.textContent = 'Нет доступа к микрофону.';
        }
        return;
      }
      const rec = recording;
      recording = null;
      recBtn.textContent = '🎤 Записать, как я пою';
      recBtn.classList.remove('recording');
      const blob = await rec.stop();
      note.textContent = 'Отправляем запись…';
      try {
        const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        await sung(await store.saveFile(blob, { name: fileName('пение, ' + m.title, ext) }));
      } catch (e) {
        console.error(e);
        note.textContent = 'Не получилось отправить запись. Попробуйте ещё раз.';
      }
    },
  }, '🎤 Записать, как я пою');

  screen(m.title, back,
    h('h2', { class: 'prompt' }, 'Послушайте, затем пропойте'),
    player.el,
    recBtn,
    h('button', { class: 'btn', onclick: () => sung({}) }, 'Я пропел(а) без записи'),
    note);
}

// ---------- координатор ----------

const refTitle = (e) =>
  (EXERCISES.find((x) => x.id === e.ref) || BRAIN_VIDEOS.find((x) => x.id === e.ref) || MUSIC.find((x) => x.id === e.ref) || GAMES[e.ref] || {}).title || e.ref;

function describe(e) {
  const t = refTitle(e);
  const d = e.data || {};
  switch (e.type) {
    case 'exercise_open': return `Открыл(а) упражнение «${t}»`;
    case 'exercise_watch': return `Смотрел(а) видео «${t}» — ${fmtMin(d.secs)}`;
    case 'exercise_done': return `Выполнил(а) упражнение «${t}»`;
    case 'exercise_video': return `Прислал(а) видео к упражнению «${t}»`;
    case 'game': {
      const extra = d.bestMs ? `, лучший показ ${d.bestMs} мс`
        : d.bestSecs ? `, лучшее время ${d.bestSecs} с`
        : d.span ? `, ряд до ${d.span} предметов`
        : d.mistakes != null ? `, нажатий мимо: ${d.mistakes}` : '';
      return e.ref === 'words'
        ? `Задание «${t}»: найдено слов — ${d.score}, ${fmtMin(d.secs)}`
        : `Задание «${t}»: ${d.score} из ${d.total}${extra}, ${fmtMin(d.secs)}`;
    }
    case 'music_listen': return `Слушал(а) «${t}» — ${fmtMin(d.secs)}`;
    case 'music_sing': return `Пропел(а) «${t}»`;
    default: return e.type;
  }
}

function pinGate(then) {
  const input = h('input', { type: 'password', inputMode: 'numeric', placeholder: 'Код', class: 'field' });
  const note = h('p', { class: 'note' });
  screen('Координатор', '/',
    h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        note.textContent = 'Загрузка…';
        const res = await store.openCoordinator(input.value);
        if (res === 'ok') { coordinatorOk = true; then(); }
        else note.textContent = res === 'pin' ? 'Неверный код' : 'Нет связи с сервером. Попробуйте ещё раз.';
      },
    }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Открыть')),
    note);
}

async function coordinatorScreen() {
  if (!coordinatorOk) return pinGate(coordinatorScreen);
  const users = await store.coordUsers();
  const events = await store.coordEvents();
  const rows = await Promise.all(users.map(async (u) => {
    const s = await todayStats(u.id, events);
    const mine = events.filter((e) => e.userId === u.id);
    const last = mine.length ? mine[mine.length - 1].ts : null;
    const days = new Set(mine.map((e) => e.day)).size;
    return h('button', { class: 'card', onclick: () => go('/coordinator/' + u.id) },
      h('span', { class: 'card-title' }, u.name),
      h('span', { class: 'card-sub' },
        `Сегодня: упражнения ${s.exercise}, видео ${s.videos}, задания ${s.left}, пение ${s.music}`),
      h('span', { class: 'card-sub' },
        last ? `Дней с занятиями: ${days} · был(а) ${new Date(last).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}` : 'Ещё не занимал(ась)'));
  }));
  screen('Пациенты', '/',
    rows.length ? rows : h('p', { class: 'note' }, 'Пока никого нет'),
    store.sheetUrl() && h('a', { class: 'btn link', href: store.sheetUrl(), target: '_blank', rel: 'noopener' }, 'Открыть Google-таблицу'),
    rows.length > 0 && h('button', { class: 'btn', onclick: () => exportCsv(users, events) }, 'Скачать таблицу (CSV)'));
}

async function patientScreen(userId) {
  if (!coordinatorOk) return pinGate(() => patientScreen(userId));
  const user = (await store.coordUsers()).find((u) => u.id === userId);
  if (!user) return go('/coordinator');
  const events = [...await store.coordEvents(userId)].sort((a, b) => b.ts - a.ts);
  const urls = [];
  cleanup = () => urls.forEach((u) => URL.revokeObjectURL(u));

  const byDay = new Map();
  for (const e of events) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day).push(e);
  }
  const mediaButton = (e) => {
    const isVideo = e.type === 'exercise_video';
    // файл на Google Диске — открывается в аккаунте координатора
    if (e.data.url) return h('a', { class: 'btn small link', href: e.data.url, target: '_blank', rel: 'noopener' }, isVideo ? '▶ Смотреть' : '▶ Слушать');
    const holder = h('div');
    const btn = h('button', {
      class: 'btn small',
      onclick: async () => {
        const blob = await store.getFile(e.data.fileId);
        if (!blob) { btn.textContent = 'Файл не найден'; return; }
        const url = URL.createObjectURL(blob);
        urls.push(url);
        holder.replaceChildren(h(isVideo ? 'video' : 'audio', { src: url, controls: true, autoplay: true, playsInline: true, class: 'media' }));
      },
    }, isVideo ? '▶ Смотреть' : '▶ Слушать');
    holder.append(btn);
    return holder;
  };
  const fmtDay = (day) => new Date(day + 'T00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });

  screen(user.name, '/coordinator',
    events.length === 0 && h('p', { class: 'note' }, 'Занятий пока не было'),
    [...byDay].map(([day, list]) => h('section', { class: 'day' },
      h('h2', {}, fmtDay(day)),
      list.map((e) => h('div', { class: 'event' },
        h('time', {}, new Date(e.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })),
        h('div', {}, describe(e), e.data && e.data.fileId && mediaButton(e)))))));
}

function exportCsv(users, events) {
  const name = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Пациент', 'Дата', 'Время', 'Событие', 'Баллы', 'Из', 'Секунд'].map(q).join(';')];
  for (const e of events) {
    const d = e.data || {};
    lines.push([
      name[e.userId], e.day, new Date(e.ts).toLocaleTimeString('ru-RU'),
      describe(e), d.score, d.total, d.secs,
    ].map(q).join(';'));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `пациенты-${store.dayKey()}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

store.setDescriber((e) => ({ text: describe(e), section: refTitle(e) }));
window.addEventListener('online', () => store.flush());
document.addEventListener('visibilitychange', () => store.flush());
store.flush();

window.addEventListener('hashchange', render);
window.addEventListener('pagehide', leave);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
render();
