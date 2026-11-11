import { h, shuffle, pick, sample } from './ui.js?v=4';
import { WORD_SETS } from './words.js?v=4';

// Каждая игра: start(root, finish), где finish({ score, total }) вызывается в конце.

export const GAMES = {
  diff: { title: 'Найди отличия', icon: '🔍', start: startDiff },
  odd: { title: 'Четвёртый лишний', icon: '🧩', start: startOdd },
  spatial: { title: 'Пространство', icon: '🧭', start: startSpatial },
  words: { title: 'Слова из букв', icon: '🔤', start: startWords },
};

const CATEGORIES = [
  { name: 'фрукты', items: [['🍎', 'яблоко'], ['🍐', 'груша'], ['🍌', 'банан'], ['🍊', 'апельсин'], ['🍋', 'лимон'], ['🍇', 'виноград']] },
  { name: 'овощи', items: [['🥕', 'морковь'], ['🥔', 'картофель'], ['🍅', 'помидор'], ['🥒', 'огурец'], ['🌽', 'кукуруза'], ['🍆', 'баклажан']] },
  { name: 'домашние животные', items: [['🐶', 'собака'], ['🐱', 'кошка'], ['🐴', 'лошадь'], ['🐄', 'корова'], ['🐑', 'овца'], ['🐖', 'свинья']] },
  { name: 'дикие животные', items: [['🐺', 'волк'], ['🦊', 'лиса'], ['🐻', 'медведь'], ['🐘', 'слон'], ['🦁', 'лев'], ['🐯', 'тигр']] },
  { name: 'птицы', items: [['🦆', 'утка'], ['🦉', 'сова'], ['🦅', 'орёл'], ['🐓', 'петух'], ['🦢', 'лебедь'], ['🐧', 'пингвин']] },
  { name: 'транспорт', items: [['🚗', 'машина'], ['🚌', 'автобус'], ['🚂', 'поезд'], ['✈️', 'самолёт'], ['🚲', 'велосипед'], ['🚢', 'корабль']] },
  { name: 'одежда', items: [['👕', 'футболка'], ['👖', 'брюки'], ['👗', 'платье'], ['🧥', 'пальто'], ['🧦', 'носки'], ['🧣', 'шарф']] },
  { name: 'посуда', items: [['🥄', 'ложка'], ['🍴', 'вилка'], ['☕', 'чашка'], ['🍽️', 'тарелка'], ['🥣', 'миска'], ['🔪', 'нож']] },
  { name: 'музыкальные инструменты', items: [['🎸', 'гитара'], ['🎹', 'пианино'], ['🎺', 'труба'], ['🎻', 'скрипка'], ['🥁', 'барабан']] },
  { name: 'цветы', items: [['🌹', 'роза'], ['🌷', 'тюльпан'], ['🌻', 'подсолнух'], ['🌼', 'ромашка']] },
];
const ALL_EMOJI = CATEGORIES.flatMap((c) => c.items.map((i) => i[0]));

// ---------- общий экран вопроса с вариантами ----------

function choiceRound(root, { prompt, visual, options, explain, optionsClass = 'options' }, done) {
  let answered = false;
  const note = h('p', { class: 'note' });
  const next = h('button', { class: 'btn primary', hidden: true, onclick: () => done(result) }, 'Дальше');
  let result = false;
  const buttons = options.map((o) =>
    h('button', {
      class: 'option',
      onclick: (e) => {
        if (answered) return;
        answered = true;
        result = !!o.correct;
        e.currentTarget.classList.add(o.correct ? 'right' : 'wrong');
        buttons.forEach((b, i) => { if (options[i].correct) b.classList.add('right'); });
        note.textContent = (o.correct ? 'Верно! ' : 'Неверно. ') + (explain || '');
        next.hidden = false;
        next.scrollIntoView({ block: 'nearest' });
      },
    }, o.content));
  root.replaceChildren(
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
  const rounds = Array.from({ length: 10 }, () => (area, done) => {
    const [main, other] = sample(CATEGORIES, 2);
    const odd = pick(other.items);
    const items = shuffle([...sample(main.items, 3).map((it) => ({ it })), { it: odd, correct: true }]);
    choiceRound(area, {
      prompt: 'Что здесь лишнее?',
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
  const rounds = [3, 4, 5].map((nDiffs) => (area, done) => {
    const N = 16;
    const base = Array.from({ length: N }, () => pick(ALL_EMOJI));
    const changed = base.map((e) => ({ e, flip: false }));
    const diffCells = new Set(sample([...Array(N).keys()], nDiffs));
    for (const i of diffCells) {
      const kind = pick(['replace', 'replace', 'remove', 'flip']);
      if (kind === 'replace') changed[i].e = pick(ALL_EMOJI.filter((x) => x !== base[i]));
      else if (kind === 'remove') changed[i].e = '';
      else changed[i].flip = true;
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
          setTimeout(() => c.classList.remove('miss'), 500);
        }
      }
    };
    const panel = (cells, data) => h('div', { class: 'scene' }, data.map((d, i) => {
      const c = h('button', { class: 'cell' + (d.flip ? ' flip' : ''), onclick: () => tap(i) }, h('span', {}, d.e));
      cells.push(c);
      return c;
    }));
    const next = h('button', { class: 'btn primary', hidden: true, onclick: () => done(found.size === nDiffs && mistakes <= 2) }, 'Дальше');
    const check = h('button', {
      class: 'btn',
      onclick: () => {
        over = true;
        check.hidden = true;
        next.hidden = false;
        for (const i of diffCells) {
          if (!found.has(i)) { cellsA[i].classList.add('missed'); cellsB[i].classList.add('missed'); }
        }
        status.textContent = found.size === nDiffs
          ? `Верно! Отличий было ${nDiffs}, вы нашли все.`
          : `Отличий было ${nDiffs}, вы нашли ${found.size}. Остальные обведены.`;
      },
    }, 'Больше отличий нет');
    area.replaceChildren(
      h('h2', { class: 'prompt' }, 'Найдите все отличия и нажмите на них'),
      h('div', { class: 'scenes' },
        panel(cellsA, base.map((e) => ({ e, flip: false }))),
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

function clockSvg(hh, mm) {
  const hand = (angle, len, w) => {
    const r = (angle - 90) * Math.PI / 180;
    return h('line', {
      x1: 100, y1: 100, x2: 100 + len * Math.cos(r), y2: 100 + len * Math.sin(r),
      stroke: 'currentColor', 'stroke-width': w, 'stroke-linecap': 'round',
    });
  };
  const marks = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const r = (n * 30 - 90) * Math.PI / 180;
    return h('text', {
      x: 100 + 74 * Math.cos(r), y: 100 + 74 * Math.sin(r) + 7,
      'text-anchor': 'middle', 'font-size': 20, 'font-weight': 600, fill: 'currentColor',
    }, n);
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
    const mm = pick([0, 15, 30, 45]);
    const right = fmtTime(hh, mm);
    const wrong = new Set();
    // типичная ошибка — перепутать стрелки
    if (mm) wrong.add(fmtTime(mm / 5, (hh % 12) * 5));
    while (wrong.size < 3) {
      const t = fmtTime(1 + Math.floor(Math.random() * 12), pick([0, 15, 30, 45]));
      if (t !== right) wrong.add(t);
    }
    wrong.delete(right);
    choiceRound(area, {
      prompt: 'Который час?',
      visual: clockSvg(hh, mm),
      optionsClass: 'options grid2',
      options: shuffle([{ content: right, correct: true }, ...[...wrong].slice(0, 3).map((t) => ({ content: t }))]),
      explain: `На часах ${right}.`,
    }, done);
  };
}

function mirrorRound() {
  return (area, done) => {
    const letters = sample([...'БВГЕЗИКРСУЧЯЭЮЦЩЛЬ'], 4);
    const bad = Math.floor(Math.random() * 4);
    choiceRound(area, {
      prompt: 'Какая буква написана неправильно?',
      optionsClass: 'options grid2',
      options: letters.map((l, i) => ({
        correct: i === bad,
        content: h('span', { class: 'letter' + (i === bad ? ' mirrored' : '') }, l),
      })),
      explain: `Буква «${letters[bad]}» перевёрнута зеркально.`,
    }, done);
  };
}

function positionRound() {
  return (area, done) => {
    const sides = [
      ['Слева', 30, 100], ['Справа', 170, 100], ['Сверху', 100, 30], ['Снизу', 100, 170],
    ];
    const s = pick(sides);
    const visual = h('svg', { viewBox: '0 0 200 200', class: 'clock' },
      h('rect', { x: 62, y: 62, width: 76, height: 76, rx: 6, fill: 'var(--accent)' }),
      h('circle', { cx: s[1], cy: s[2], r: 20, fill: 'var(--warm)' }));
    choiceRound(area, {
      prompt: 'Где находится круг относительно квадрата?',
      visual,
      optionsClass: 'options grid2',
      options: sides.map((x) => ({ content: x[0], correct: x === s })),
      explain: `Круг — ${s[0].toLowerCase()} от квадрата.`,
    }, done);
  };
}

function patternRound() {
  return (area, done) => {
    const target = new Set(sample([...Array(9).keys()], pick([3, 4])));
    const mine = new Set();
    let over = false;
    const grid = (set, interactive) => h('div', { class: 'pattern' }, [...Array(9).keys()].map((i) =>
      h('button', {
        class: 'pcell' + (set.has(i) ? ' on' : ''),
        disabled: !interactive,
        onclick: (e) => {
          if (over) return;
          if (mine.has(i)) mine.delete(i); else mine.add(i);
          e.currentTarget.classList.toggle('on');
        },
      })));
    const note = h('p', { class: 'note' });
    const ok = () => mine.size === target.size && [...target].every((i) => mine.has(i));
    const next = h('button', { class: 'btn primary', hidden: true, onclick: () => done(ok()) }, 'Дальше');
    const check = h('button', {
      class: 'btn',
      onclick: () => {
        over = true;
        check.hidden = true;
        next.hidden = false;
        note.textContent = ok() ? 'Верно!' : 'Неверно. Сравните рисунки.';
      },
    }, 'Проверить');
    area.replaceChildren(
      h('h2', { class: 'prompt' }, 'Повторите рисунок на нижнем поле'),
      h('div', { class: 'patterns' }, grid(target, false), grid(mine, true)),
      note, check, next,
    );
  };
}

// ---------- Слова из букв ----------

function startWords(root, finish) {
  const GOAL = 5;
  const base = pick(Object.keys(WORD_SETS));
  const valid = new Set(WORD_SETS[base]);
  const found = [];
  let current = []; // индексы выбранных плиток
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

  root.replaceChildren(
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
    h('button', { class: 'btn', onclick: () => finish({ score: found.length, total: GOAL, words: found }) }, 'Закончить'),
  );
  refresh();
}
