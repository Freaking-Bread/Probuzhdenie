// Хранилище данных.
// Всё сначала записывается на устройстве (чтобы работать и без интернета), а затем
// отправляется на сервер (Google-таблица + Диск), если в content.js указан API_URL.

import { API_URL } from './content.js?v=8';

const K_USERS = 'med.users';
const K_EVENTS = 'med.events';
const K_CURRENT = 'med.current';

const read = (k, d) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const dayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const normName = (s) => s.trim().replace(/\s+/g, ' ');
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function api(req) {
  const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(req) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const out = await res.json();
  if (out.error) throw new Error(out.error);
  return out;
}

// ---------- пациент ----------

export function currentUser() {
  const id = localStorage.getItem(K_CURRENT);
  return read(K_USERS, []).find((u) => u.id === id) || null;
}

// Пациент узнаётся по имени и отчеству, поэтому на любом телефоне это один и тот же человек.
export async function login(rawName) {
  const name = normName(rawName);
  const id = name.toLowerCase().replace(/ё/g, 'е');
  const users = read(K_USERS, []);
  let user = users.find((u) => u.id === id);
  if (!user) {
    user = { id, name, created: Date.now() };
    users.push(user);
    write(K_USERS, users);
  }
  localStorage.setItem(K_CURRENT, user.id);
  return user;
}

export function logout() {
  localStorage.removeItem(K_CURRENT);
}

// ---------- события ----------

let describer = () => ({});
// Приложение сообщает, как описать событие словами (для таблицы координатора).
export function setDescriber(fn) { describer = fn; }

// type: exercise_open | exercise_watch | exercise_done | exercise_video
//       game | music_listen | music_sing
export async function log(type, ref, data = {}) {
  const user = currentUser();
  if (!user) return;
  const events = read(K_EVENTS, []);
  const ts = Date.now();
  events.push({ id: newId(), userId: user.id, ts, day: dayKey(ts), type, ref, data });
  write(K_EVENTS, events);
  flush();
}

export async function listEvents(userId) {
  const events = read(K_EVENTS, []);
  return userId ? events.filter((e) => e.userId === userId) : events;
}

// Отправляет на сервер всё, что ещё не отправлено. Безопасно вызывать сколько угодно раз.
let flushing = false;
export async function flush() {
  if (!API_URL || flushing) return;
  flushing = true;
  try {
    const users = read(K_USERS, []);
    const pending = read(K_EVENTS, []).filter((e) => !e.sent);
    for (const user of users) {
      const mine = pending.filter((e) => e.userId === user.id).slice(0, 100);
      if (!mine.length) continue;
      const { saved } = await api({
        action: 'log',
        user: { id: user.id, name: user.name },
        events: mine.map((e) => ({
          id: e.id, ts: e.ts, day: e.day, type: e.type, ...describer(e), data: { ...e.data, ref: e.ref },
        })),
      });
      const done = new Set(saved);
      // перечитываем: за время запроса могли появиться новые события
      write(K_EVENTS, read(K_EVENTS, []).map((e) => (done.has(e.id) ? { ...e, sent: true } : e)));
    }
  } catch (e) {
    console.warn('Не удалось отправить данные, попробуем позже', e);
  } finally {
    flushing = false;
  }
}

// ---------- файлы (видео и аудио пациентов) ----------

let dbPromise;
function db() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('med-files', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Сохраняет файл и возвращает { fileId, url? }. С сервером файл уходит на Google Диск.
export async function saveFile(blob, { name = 'файл', onProgress } = {}) {
  if (API_URL) {
    const user = currentUser();
    const mime = (blob.type || 'application/octet-stream').split(';')[0];
    const { uploadUrl } = await api({
      action: 'upload', user: { id: user.id, name: user.name }, name, mime, size: blob.size, origin: location.origin,
    });
    const fileId = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.upload.onprogress = (e) => { if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        try {
          if (xhr.status >= 300) throw new Error('HTTP ' + xhr.status);
          resolve(JSON.parse(xhr.responseText).id);
        } catch (e) { reject(e); }
      };
      xhr.onerror = () => reject(new Error('network'));
      xhr.send(blob);
    });
    return { fileId, url: `https://drive.google.com/file/d/${fileId}/view` };
  }
  const id = newId();
  const d = await db();
  await new Promise((resolve, reject) => {
    const tx = d.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return { fileId: id };
}

export async function getFile(id) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction('files').objectStore('files').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// ---------- координатор ----------

let remote = null; // { users, events, sheetUrl } с сервера

// Проверяет код и загружает данные всех пациентов. Возвращает 'ok' | 'pin' | 'offline'.
export async function openCoordinator(pin) {
  if (!API_URL) { remote = null; return 'ok'; } // режим разработки без сервера
  try {
    const out = await api({ action: 'coordinator', pin });
    remote = {
      ...out,
      events: out.events.map((e) => ({ ...e, ref: e.data && e.data.ref })),
    };
    return 'ok';
  } catch (e) {
    return e.message === 'pin' ? 'pin' : 'offline';
  }
}

export const coordUsers = async () => (remote ? remote.users : read(K_USERS, []));
export const coordEvents = async (userId) => {
  const events = remote ? remote.events : read(K_EVENTS, []);
  return userId ? events.filter((e) => e.userId === userId) : events;
};
export const sheetUrl = () => (remote && remote.sheetUrl) || null;
