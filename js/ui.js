// Маленький помощник для создания элементов: h('div', {class:'x', onclick: fn}, ...дети)
export function h(tag, props = {}, ...children) {
  const svgTags = ['svg', 'line', 'circle', 'rect', 'text', 'g', 'path'];
  const el = svgTags.includes(tag)
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && !svgTags.includes(tag)) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const sample = (arr, n) => shuffle(arr).slice(0, n);

export const fmtMin = (secs) => {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m ? `${m} мин ${s ? s + ' с' : ''}`.trim() : `${s} с`;
};
