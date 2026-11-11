// Хранилище данных. Сейчас — на устройстве (localStorage + IndexedDB для файлов).
// Все функции асинхронные, чтобы позже заменить этот файл на облачный вариант,
// не трогая остальное приложение.

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

export function currentUser() {
  const id = localStorage.getItem(K_CURRENT);
  return read(K_USERS, []).find((u) => u.id === id) || null;
}

export async function login(rawName) {
  const name = normName(rawName);
  const users = read(K_USERS, []);
  let user = users.find((u) => u.name.toLowerCase() === name.toLowerCase());
  if (!user) {
    user = { id: newId(), name, created: Date.now() };
    users.push(user);
    write(K_USERS, users);
  }
  localStorage.setItem(K_CURRENT, user.id);
  return user;
}

export function logout() {
  localStorage.removeItem(K_CURRENT);
}

export async function listUsers() {
  return read(K_USERS, []);
}

// type: exercise_open | exercise_watch | exercise_done | exercise_video
//       game | music_listen | music_sing
export async function log(type, ref, data = {}) {
  const user = currentUser();
  if (!user) return;
  const events = read(K_EVENTS, []);
  const ts = Date.now();
  events.push({ id: newId(), userId: user.id, ts, day: dayKey(ts), type, ref, data });
  write(K_EVENTS, events);
}

export async function listEvents(userId) {
  const events = read(K_EVENTS, []);
  return userId ? events.filter((e) => e.userId === userId) : events;
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

export async function saveFile(blob) {
  const id = newId();
  const d = await db();
  await new Promise((resolve, reject) => {
    const tx = d.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return id;
}

export async function getFile(id) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction('files').objectStore('files').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
