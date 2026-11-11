import { h, shuffle, pick, sample } from './ui.js?v=9';
import { WORD_SETS } from './words.js?v=9';

// Каждая игра: start(root, finish), где finish({ score, total, ... }) вызывается в конце.
// group: 'left' — задания из программы (левое полушарие), 'focus' — внимание, скорость, память.

export const GAMES = {
  diff: { title: 'Найди отличия', icon: '🔍', group: 'left', start: startDiff },
  odd: { title: 'Четвёртый лишний', icon: '🧩', group: 'left', start: startOdd },
  spatial: { title: 'Пространство', icon: '🧭', group: 'left', start: startSpatial },
  words: { title: 'Слова из букв', icon: '🔤', group: 'left', start: startWords },
  color: { title: 'Цвет в узоре', icon: '🎨', group: 'focus', start: startColor },
  order: { title: 'Запомни порядок', icon: '🔢', group: 'focus', start: startOrder },
  dual: { title: 'Двойное внимание', icon: '👁️', group: 'focus', start: startDual },
};

// ---------- таймеры (гасятся при уходе с экрана) ----------

const active = new Set();
function later(fn, ms) {
  const id = setTimeout(() => { active.delete(id); fn(); }, ms);
  active.add(id);
  return id;
}
function cancel(id) { clearTimeout(id); active.delete(id); }
export function stopGame() { active.forEach(clearTimeout); active.clear(); }

// Убывающая полоска времени. onTimeout вызывается, если время вышло.
function timeBar(secs, onTimeout) {
  const fill = h('div', { class: 'timebar-fill', style: { animationDuration: secs + 's' } });
  const el = h('div', { class: 'timebar' }, fill);
  const id = later(onTimeout, secs * 1000);
  return { el, stop() { cancel(id); fill.style.animationPlayState = 'paused'; } };
}

// ---------- данные ----------

// Категории объединены в «семьи»: лишний предмет берётся из близкой категории, чтобы было труднее.
const FAMILIES = [
  [
    { name: 'фрукты', items: [['🍎', 'яблоко'], ['🍐', 'груша'], ['🍌', 'банан'], ['🍊', 'апельсин'], ['🍋', 'лимон'], ['🍑', 'персик']] },
    { name: 'овощи', items: [['🥕', 'морковь'], ['🥔', 'картофель'], ['🍅', 'помидор'], ['🥒', 'огурец'], ['🌽', 'кукуруза'], ['🍆', 'баклажан']] },
    { name: 'сладости', items: [['🍰', 'торт'], ['🍬', 'конфета'], ['🍫', 'шоколад'], ['🍪', 'печенье'], ['🍩', 'пончик'], ['🍦', 'мороженое']] },
  ],
  [
    { name: 'домашние животные', items: [['🐶', 'собака'], ['🐱', 'кошка'], ['🐴', 'лошадь'], ['🐄', 'корова'], ['🐑', 'овца'], ['🐖', 'свинья']] },
    { name: 'дикие звери', items: [['🐺', 'волк'], ['🦊', 'лиса'], ['🐻', 'медведь'], ['🐘', 'слон'], ['🦁', 'лев'], ['🐯', 'тигр']] },
    { name: 'птицы', items: [['🦆', 'утка'], ['🦉', 'сова'], ['🦅', 'орёл'], ['🐓', 'петух'], ['🦢', 'лебедь'], ['🐧', 'пингвин']] },
    { name: 'морские обитатели', items: [['🐟', 'рыба'], ['🐬', 'дельфин'], ['🐙', 'осьминог'], ['🦀', 'краб'], ['🐋', 'кит'], ['🦈', 'акула']] },
    { name: 'насекомые', items: [['🐝', 'пчела'], ['🐜', 'муравей'], ['🦋', 'бабочка'], ['🐞', 'божья коровка'], ['🦗', 'кузнечик']] },
  ],
  [
    { name: 'одежда', items: [['👕', 'футболка'], ['👖', 'брюки'], ['👗', 'платье'], ['🧥', 'пальто'], ['🧦', 'носки'], ['🧣', 'шарф']] },
    { name: 'обувь', items: [['👟', 'кроссовки'], ['👢', 'сапоги'], ['👠', 'туфли'], ['🥾', 'ботинки'], ['👡', 'босоножки']] },
    { name: 'посуда', items: [['🥄', 'ложка'], ['🍴', 'вилка'], ['☕', 'чашка'], ['🍽️', 'тарелка'], ['🥣', 'миска'], ['🔪', 'нож']] },
  ],
  [
    { name: 'транспорт', items: [['🚗', 'машина'], ['🚌', 'автобус'], ['🚂', 'поезд'], ['✈️', 'самолёт'], ['🚲', 'велосипед'], ['🚢', 'корабль']] },
    { name: 'музыкальные инструменты', items: [['🎸', 'гитара'], ['🎹', 'пианино'], ['🎺', 'труба'], ['🎻', 'скрипка'], ['🥁', 'барабан']] },
    { name: 'спортивный инвентарь', items: [['⚽', 'футбольный мяч'], ['🏀', 'баскетбольный мяч'], ['🎾', 'теннисный мяч'], ['🏓', 'ракетка'], ['⛸️', 'коньки'], ['🎿', 'лыжи']] },
  ],
];
const CATEGORIES = FAMILIES.flat();
const ALL_EMOJI = CATEGORIES.flatMap((c) => c.items.map((i) => i[0]));

// ---------- общий экран вопроса с вариантами ----------

function choiceRound(root, { prompt, visual, options, explain, optionsClass = 'options', secs }, done) {
  let answered = false;
  let result = false;
  const note = h('p', { class: 'note' });
  const next = h('button', { class: 'btn primary', hidden: true, onclick: () => done(result) }, 'Дальше');
  const reveal = (text) => {
    answered = true;
    bar && bar.stop();
    buttons.forEach((b, i) => { if (options[i].correct) b.classList.add('right'); });
    note.textContent = text + (explain || '');
    next.hidden = false;
    next.scrollIntoView({ block: 'nearest' });
  };
  const buttons = options.map((o) =>
    h('button', {
      class: 'option',
      onclick: (e) => {
        if (answered) return;
        result = !!o.correct;
        e.currentTarget.classList.add(o.correct ? 'right' : 'wrong');
        reveal(o.correct ? 'Верно! ' : 'Неверно. ');
      },
    }, o.content));
  const bar = secs ? timeBar(secs, () => { if (!answered) reveal('Время вышло. '); }) : null;
  root.replaceChildren(
    bar ? bar.el : '',
    h('h2', { class: 'prompt' }, prompt),
    visual || '',
    h('div', { class: optionsClass }, buttons),
    note,
    next,
  );
}

// Прогоняет список раундов по очереди и считает верные ответы.
function runRounds(root, rounds, finish) {
  let i = 0;
  let score = 0;
  const step = () => {
    if (i >= rounds.length) return finish({ score, total: rounds.length });
    const counter = h('p', { class: 'counter' }, `${i + 1} из ${rounds.length}`);
    const area = h('div');
    root.replaceChildren(counter, area);
    rounds[i](area, (ok) => { if (ok) score++; i++; step(); });
  };
  step();
}

// ---------- Четвёртый лишний ----------

function startOdd(root, finish) {
  const rounds = Array.from({ length: 12 }, () => (area, done) => {
    const [main, other] = sample(pick(FAMILIES), 2);
    const odd = pick(other.items);
    const items = shuffle([...sample(main.items, 3).map((it) => ({ it })), { it: odd, correct: true }]);
    choiceRound(area, {
      prompt: 'Что здесь лишнее?',
      secs: 10,
      optionsClass: 'options grid2',
      options: items.map(({ it, correct }) => ({
        correct,
        content: [h('span', { class: 'emoji' }, it[0]), h('span', {}, it[1])],
      })),
      explain: `Лишнее — ${odd[1]}. Остальное — ${main.name}.`,
    }, done);
  });
  runRounds(root, rounds, finish);
}

// ---------- Найди отличия ----------

function startDiff(root, finish) {
  const rounds = [4, 5, 6].map((nDiffs) => (area, done) => {
    const N = 25;
    const base = Array.from({ length: N }, () => pick(ALL_EMOJI));
    const changed = base.map((e) => ({ e, mod: '' }));
    const diffCells = new Set(sample([...Array(N).keys()], nDiffs));
    for (const i of diffCells) {
      const kind = pick(['replace', 'replace', 'remove', 'flip', 'turn', 'small']);
      if (kind === 'replace') {
        // подменяем на предмет из той же категории — так заметить труднее
        const cat = CATEGORIES.find((c) => c.items.some((it) => it[0] === base[i]));
        changed[i].e = pick(cat.items.map((it) => it[0]).filter((x) => x !== base[i]));
      } else if (kind === 'remove') changed[i].e = '';
      else changed[i].mod = kind;
    }
    const found = new Set();
    let mistakes = 0;
    let over = false;
    const status = h('p', { class: 'note' }, 'Найдено: 0');
    const cellsA = [];
    const cellsB = [];
    const tap = (i) => {
      if (over || found.has(i)) return;
      if (diffCells.has(i)) {
        found.add(i);
        cellsA[i].classList.add('found');
        cellsB[i].classList.add('found');
        status.textContent = `Найдено: ${found.size}`;
      } else {
        mistakes++;
        for (const c of [cellsA[i], cellsB[i]]) {
          c.classList.add('miss');
          later(() => c.classList.remove('miss'), 500);
        }
      }
    };
    const panel = (cells, data) => h('div', { class: 'scene' }, data.map((d, i) => {
      const c = h('button', { class: 'cell ' + d.mod, onclick: () => tap(i) }, h('span', {}, d.e));
      cells.push(c);
      return c;
    }));
    const next = h('button', { class: 'btn primary', hidden: true, onclick: () => done(found.size === nDiffs && mistakes <= 2) }, 'Дальше');
    const end = (timeout) => {
      if (over) return;
      over = true;
      bar.stop();
      check.hidden = true;
      next.hidden = false;
      for (const i of diffCells) {
        if (!found.has(i)) { cellsA[i].classList.add('missed'); cellsB[i].classList.add('missed'); }
      }
      status.textContent = (timeout ? 'Время вышло. ' : '') + (found.size === nDiffs
        ? `Верно! Отличий было ${nDiffs}, вы нашли все.`
        : `Отличий было ${nDiffs}, вы нашли ${found.size}. Остальные обведены.`);
    };
    const check = h('button', { class: 'btn', onclick: () => end(false) }, 'Больше отличий нет');
    const bar = timeBar(90, () => end(true));
    area.replaceChildren(
      bar.el,
      h('h2', { class: 'prompt' }, 'Найдите все отличия и нажмите на них'),
      h('div', { class: 'scenes' },
        panel(cellsA, base.map((e) => ({ e, mod: '' }))),
        panel(cellsB, changed)),
      status, check, next,
    );
  });
  runRounds(root, rounds, finish);
}

// ---------- Пространственные задания ----------

function startSpatial(root, finish) {
  const makers = [clockRound, mirrorRound, positionRound, patternRound];
  const rounds = shuffle([...makers, ...makers]).map((m) => m());
  runRounds(root, rounds, finish);
}

const fmtTime = (hh, mm) => `${hh}:${String(mm).padStart(2, '0')}`;
const polar = (angle, len) => {
  const r = (angle - 90) * Math.PI / 180;
  return [100 + len * Math.cos(r), 100 + len * Math.sin(r)];
};

function clockSvg(hh, mm) {
  const hand = (angle, len, w) => {
    const [x2, y2] = polar(angle, len);
    return h('line', { x1: 100, y1: 100, x2, y2, stroke: 'currentColor', 'stroke-width': w, 'stroke-linecap': 'round' });
  };
  const marks = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    if (n % 3 === 0) {
      const [x, y] = polar(n * 30, 72);
      return h('text', { x, y: y + 8, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: 'currentColor' }, n);
    }
    const [x1, y1] = polar(n * 30, 78);
    const [x2, y2] = polar(n * 30, 88);
    return h('line', { x1, y1, x2, y2, stroke: 'currentColor', 'stroke-width': 4, 'stroke-linecap': 'round' });
  });
  return h('svg', { viewBox: '0 0 200 200', class: 'clock' },
    h('circle', { cx: 100, cy: 100, r: 94, fill: 'var(--card)', stroke: 'currentColor', 'stroke-width': 4 }),
    marks,
    hand((hh % 12) * 30 + mm * 0.5, 44, 7),
    hand(mm * 6, 66, 4),
    h('circle', { cx: 100, cy: 100, r: 6, fill: 'currentColor' }));
}

function clockRound() {
  return (area, done) => {
    const hh = 1 + Math.floor(Math.random() * 12);
    const mm = 5 * Math.floor(Math.random() * 12);
    const right = fmtTime(hh, mm);
    const hourPlus = (d) => ((hh - 1 + d + 12) % 12) + 1;
    // правдоподобные ошибки: перепутаны стрелки, соседний час, соседние пять минут
    const candidates = shuffle([
      fmtTime(mm / 5 || 12, (hh % 12) * 5),
      fmtTime(hourPlus(1), mm),
      fmtTime(hourPlus(-1), mm),
      fmtTime(hh, (mm + 5) % 60),
      fmtTime(hh, (mm + 55) % 60),
    ]);
    const wrong = [...new Set(candidates)].filter((t) => t !== right).slice(0, 3);
    choiceRound(area, {
      prompt: 'Который час?',
      secs: 20,
      visual: clockSvg(hh, mm),
      optionsClass: 'options grid2',
      options: shuffle([{ content: right, correct: true }, ...wrong.map((t) => ({ content: t }))]),
      explain: `На часах ${right}.`,
    }, done);
  };
}

function mirrorRound() {
  return (area, done) => {
    const letters = sample([...'БВГЕЗИКРСУЧЯЭЮЦЩЛЬ'], 6);
    const bad = Math.floor(Math.random() * letters.length);
    choiceRound(area, {
      prompt: 'Какая буква написана неправильно?',
      secs: 12,
      optionsClass: 'options grid3',
      options: letters.map((l, i) => ({
        correct: i === bad,
        content: h('span', { class: 'letter' + (i === bad ? ' mirrored' : '') }, l),
      })),
      explain: `Буква «${letters[bad]}» перевёрнута зеркально.`,
    }, done);
  };
}

const SHAPES = [
  { id: 'circle', gen: 'круга', ins: 'кругом', color: '#e8833a' },
  { id: 'square', gen: 'квадрата', ins: 'квадратом', color: '#0f766e' },
  { id: 'triangle', gen: 'треугольника', ins: 'треугольником', color: '#8e24aa' },
  { id: 'star', gen: 'звезды', ins: 'звездой', color: '#d64545' },
];

function shapeEl(id, cx, cy, r, color) {
  if (id === 'circle') return h('circle', { cx, cy, r, fill: color });
  if (id === 'square') return h('rect', { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, rx: 4, fill: color });
  const star = id === 'star';
  const n = star ? 10 : 3;
  const pts = Array.from({ length: n }, (_, i) => {
    const rad = star && i % 2 ? r * 0.5 : r * 1.15;
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a) + (star ? 0 : r * 0.2)}`;
  }).join(' ');
  return h('polygon', { points: pts, fill: color });
}
const shapeIcon = (s) => h('svg', { viewBox: '0 0 60 60', class: 'shape-icon' }, shapeEl(s.id, 30, 30, 20, s.color));

function positionRound() {
  return (area, done) => {
    const dirs = [
      ['справа от', 1, 0], ['слева от', -1, 0], ['над', 0, -1], ['под', 0, 1],
    ];
    let layout;
    // подбираем расположение, в котором ответ однозначен
    for (;;) {
      const [a, b, c, d] = shuffle(SHAPES);
      const [label, dx, dy] = pick(dirs);
      const ax = Math.floor(Math.random() * 3);
      const ay = Math.floor(Math.random() * 3);
      const bx = ax + dx;
      const by = ay + dy;
      if (bx < 0 || bx > 2 || by < 0 || by > 2) continue;
      // остальные фигуры — не в том же ряду (или столбце), что и первая
      const free = shuffle([...Array(9).keys()].map((k) => [k % 3, Math.floor(k / 3)])
        .filter(([x, y]) => (dx ? y !== ay : x !== ax)));
      layout = { label, dy, a, b, others: [c, d], cells: [[a, ax, ay], [b, bx, by], [c, ...free[0]], [d, ...free[1]]] };
      break;
    }
    const visual = h('svg', { viewBox: '0 0 300 300', class: 'board' },
      h('rect', { x: 2, y: 2, width: 296, height: 296, rx: 14, fill: 'var(--card)', stroke: 'var(--line)', 'stroke-width': 3 }),
      layout.cells.map(([s, x, y]) => shapeEl(s.id, 50 + x * 100, 50 + y * 100, 30, s.color)));
    choiceRound(area, {
      prompt: `Что находится ${layout.label} ${layout.dy ? layout.a.ins : layout.a.gen}?`,
      secs: 15,
      visual,
      optionsClass: 'options grid3',
      options: shuffle([layout.b, ...layout.others]).map((s) => ({ content: shapeIcon(s), correct: s === layout.b })),
    }, done);
  };
}

// Рисунок показывается несколько секунд, затем его нужно повторить по памяти.
function patternRound() {
  return (area, done) => {
    const SIZE = 16;
    const target = new Set(sample([...Array(SIZE).keys()], pick([5, 6])));
    const mine = new Set();
    let over = false;
    const grid = (set, interactive) => h('div', { class: 'pattern' }, [...Array(SIZE).keys()].map((i) =>
      h('button', {
        class: 'pcell' + (set.has(i) ? ' on' : ''),
        disabled: !interactive,
        onclick: (e) => {
          if (over) return;
          if (mine.has(i)) mine.delete(i); else mine.add(i);
          e.currentTarget.classList.toggle('on');
        },
      })));
    const ok = () => mine.size === target.size && [...target].every((i) => mine.has(i));

    const recall = () => {
      const note = h('p', { class: 'note' });
      const next = h('button', { class: 'btn primary', hidden: true, onclick: () => done(ok()) }, 'Дальше');
      const answer = h('div', { class: 'patterns', hidden: true }, grid(target, false));
      const end = (timeout) => {
        if (over) return;
        over = true;
        bar.stop();
        check.hidden = true;
        next.hidden = false;
        answer.hidden = ok();
        note.textContent = (timeout ? 'Время вышло. ' : '') + (ok() ? 'Верно!' : 'Неверно. Правильный рисунок — ниже.');
      };
      const check = h('button', { class: 'btn', onclick: () => end(false) }, 'Проверить');
      const bar = timeBar(30, () => end(true));
      area.replaceChildren(
        bar.el,
        h('h2', { class: 'prompt' }, 'Повторите рисунок по памяти'),
        h('div', { class: 'patterns' }, grid(mine, true)),
        note, check, next, answer);
    };

    const bar = timeBar(5, recall);
    area.replaceChildren(
      bar.el,
      h('h2', { class: 'prompt' }, 'Запомните рисунок'),
      h('div', { class: 'patterns' }, grid(target, false)));
  };
}

// ---------- Слова из букв ----------

function startWords(root, finish) {
  const GOAL = 6;
  const base = pick(Object.keys(WORD_SETS));
  const valid = new Set(WORD_SETS[base]);
  const found = [];
  let current = []; // индексы выбранных плиток
  let over = false;
  const letters = [...base.toUpperCase()];

  const word = h('div', { class: 'word' });
  const note = h('p', { class: 'note' });
  const list = h('div', { class: 'found-words' });
  const count = h('p', { class: 'counter' });
  const tiles = letters.map((l, i) => h('button', {
    class: 'tile',
    onclick: () => {
      if (current.includes(i)) return;
      current.push(i);
      refresh();
    },
  }, l));

  const refresh = () => {
    word.textContent = current.map((i) => letters[i]).join('') || ' ';
    tiles.forEach((t, i) => t.classList.toggle('used', current.includes(i)));
    count.textContent = `Найдено слов: ${found.length}`;
    list.replaceChildren(...found.map((w) => h('span', { class: 'chip' }, w)));
  };

  const check = () => {
    const w = current.map((i) => letters[i]).join('').toLowerCase().replace(/ё/g, 'е');
    if (w.length < 3) note.textContent = 'Нужно слово хотя бы из трёх букв.';
    else if (found.includes(w)) note.textContent = 'Это слово уже найдено.';
    else if (!valid.has(w)) note.textContent = 'Такого слова нет в словаре. Попробуйте другое.';
    else { found.push(w); note.textContent = 'Верно!'; }
    current = [];
    refresh();
  };
  const end = () => {
    if (over) return;
    over = true;
    bar.stop();
    finish({ score: found.length, total: GOAL, words: found, base });
  };
  const bar = timeBar(180, end);

  root.replaceChildren(
    bar.el,
    h('h2', { class: 'prompt' }, 'Составьте слова из букв слова'),
    h('p', { class: 'base-word' }, base.toUpperCase()),
    count,
    word,
    h('div', { class: 'tiles' }, tiles),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => { current.pop(); note.textContent = ''; refresh(); } }, 'Стереть'),
      h('button', { class: 'btn primary', onclick: check }, 'Проверить')),
    note,
    list,
    h('button', { class: 'btn', onclick: end }, 'Закончить'),
  );
  refresh();
}

// ---------- Цвет в узоре (внимание и скорость) ----------
// Нужно быстро найти узор, в котором есть показанный цвет. Чем точнее ответы, тем меньше времени.

const PALETTE = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#6d4c41', '#263238'];

function startColor(root, finish) {
  const ROUNDS = 15;
  let limit = 6; // секунд на ответ
  let best = limit;
  let i = 0;
  let score = 0;

  const mosaic = (colors) => h('div', { class: 'mosaic' },
    shuffle([...colors, ...Array.from({ length: 12 - colors.length }, () => pick(colors))])
      .map((c) => h('i', { style: { background: c } })));

  const step = () => {
    if (i >= ROUNDS) return finish({ score, total: ROUNDS, bestSecs: Math.round(best * 10) / 10 });
    const target = pick(PALETTE);
    const rest = PALETTE.filter((c) => c !== target);
    const options = shuffle([
      { colors: [target, ...sample(rest, 3)], correct: true },
      ...Array.from({ length: 3 }, () => ({ colors: sample(rest, 4) })),
    ]);
    let answered = false;
    const answer = (ok, btn) => {
      if (answered) return;
      answered = true;
      bar.stop();
      if (btn) btn.classList.add(ok ? 'right' : 'wrong');
      buttons.forEach((b, k) => { if (options[k].correct) b.classList.add('right'); });
      if (ok) { score++; best = Math.min(best, limit); limit = Math.max(1.5, limit * 0.85); }
      else limit = Math.min(8, limit * 1.2);
      i++;
      later(step, ok ? 600 : 1300);
    };
    const buttons = options.map((o) => h('button', { class: 'option', onclick: (e) => answer(!!o.correct, e.currentTarget) }, mosaic(o.colors)));
    const bar = timeBar(limit, () => answer(false));
    root.replaceChildren(
      h('p', { class: 'counter' }, `${i + 1} из ${ROUNDS}`),
      bar.el,
      h('h2', { class: 'prompt' }, 'В каком узоре есть этот цвет?'),
      h('div', { class: 'swatch', style: { background: target } }),
      h('div', { class: 'options grid2' }, buttons));
  };
  step();
}

// ---------- Запомни порядок (память) ----------
// Предметы показываются по одному; затем нужно вспомнить, каким по счёту был каждый.

const ORDINALS = ['Первым', 'Вторым', 'Третьим', 'Четвёртым', 'Пятым', 'Шестым', 'Седьмым'];

function startOrder(root, finish) {
  const ROUNDS = 5;
  let n = 3; // длина ряда
  let maxOk = 0;
  let round = 0;
  let score = 0;

  const play = () => {
    if (round >= ROUNDS) return finish({ score, total: ROUNDS, span: maxOk });
    const items = sample(ALL_EMOJI, n);
    const head = h('p', { class: 'counter' }, `${round + 1} из ${ROUNDS}`);
    const stage = h('div', { class: 'stage' });
    root.replaceChildren(head, h('h2', { class: 'prompt' }, 'Запоминайте порядок'), stage);

    let k = 0;
    const show = () => {
      if (k >= items.length) return ask();
      stage.replaceChildren(h('span', { class: 'flash' }, items[k]));
      k++;
      later(() => { stage.replaceChildren(); later(show, 250); }, 1300);
    };

    const ask = () => {
      const questions = sample([...items.keys()], 2);
      let q = 0;
      let allOk = true;
      const one = () => {
        if (q >= questions.length) {
          if (allOk) { score++; maxOk = Math.max(maxOk, n); n = Math.min(7, n + 1); }
          else n = Math.max(3, n - 1);
          round++;
          return play();
        }
        const idx = questions[q];
        const area = h('div');
        root.replaceChildren(head, area);
        choiceRound(area, {
          prompt: 'Каким по счёту был этот предмет?',
          secs: 12,
          visual: h('div', { class: 'stage' }, h('span', { class: 'flash' }, items[idx])),
          optionsClass: 'options grid2',
          options: items.map((_, p) => ({ content: ORDINALS[p], correct: p === idx })),
        }, (ok) => { if (!ok) allOk = false; q++; one(); });
      };
      one();
    };
    later(show, 600);
  };
  play();
}

// ---------- Двойное внимание (скорость и поле зрения) ----------
// На мгновение показывается машина в центре и звезда на краю. Нужно заметить и то, и другое.
// После верных ответов время показа сокращается.

function startDual(root, finish) {
  const ROUNDS = 12;
  const CARS = [['🚗', 'Легковая'], ['🚌', 'Автобус']];
  let ms = 1500;
  let best = ms;
  let i = 0;
  let score = 0;

  const spot = (k, rad = 40) => {
    const a = -Math.PI / 2 + (Math.PI * 2 * k) / 8;
    return { left: 50 + rad * Math.cos(a) + '%', top: 50 + rad * Math.sin(a) + '%' };
  };

  const step = () => {
    if (i >= ROUNDS) return finish({ score, total: ROUNDS, bestMs: best });
    const car = pick(CARS);
    const starAt = Math.floor(Math.random() * 8);
    const withDistractors = i >= 3;
    const arena = h('div', { class: 'arena' }, h('span', { class: 'arena-item center' }, '+'));
    const head = h('p', { class: 'counter' }, `${i + 1} из ${ROUNDS}`);
    const prompt = h('h2', { class: 'prompt' }, 'Смотрите в центр');
    root.replaceChildren(head, prompt, arena);

    const flash = () => {
      arena.replaceChildren(
        h('span', { class: 'arena-item center' }, car[0]),
        ...[...Array(8).keys()].map((k) => (k === starAt
          ? h('span', { class: 'arena-item', style: spot(k) }, '⭐')
          : withDistractors && h('span', { class: 'arena-item', style: spot(k) }, '🔶'))).filter(Boolean));
      later(mask, ms);
    };
    const mask = () => {
      arena.replaceChildren(h('div', { class: 'arena-mask' }));
      later(askCar, 350);
    };
    let carOk = false;
    const askCar = () => {
      prompt.textContent = 'Что было в центре?';
      arena.replaceChildren(h('div', { class: 'arena-choice' }, CARS.map((c) =>
        h('button', { class: 'option', onclick: () => { carOk = c === car; askStar(); } },
          h('span', { class: 'emoji' }, c[0]), h('span', {}, c[1])))));
    };
    const askStar = () => {
      prompt.textContent = 'Где была звезда?';
      let answered = false;
      const dots = [...Array(8).keys()].map((k) => h('button', {
        class: 'arena-dot', style: spot(k), 'aria-label': 'Место ' + (k + 1),
        onclick: (e) => {
          if (answered) return;
          answered = true;
          const ok = carOk && k === starAt;
          e.currentTarget.classList.add(k === starAt ? 'right' : 'wrong');
          dots[starAt].classList.add('right');
          dots[starAt].textContent = '⭐';
          prompt.textContent = ok ? 'Верно!' : carOk ? 'Звезда была в другом месте' : `В центре: ${car[1].toLowerCase()}`;
          if (ok) { score++; best = Math.min(best, ms); ms = Math.max(100, Math.round(ms * 0.75)); }
          else ms = Math.min(3000, Math.round(ms * 1.3));
          i++;
          later(step, ok ? 900 : 1800);
        },
      }));
      arena.replaceChildren(...dots);
    };
    later(flash, 900);
  };
  step();
}
