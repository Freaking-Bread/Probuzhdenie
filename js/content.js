// Всё содержимое приложения. Менять можно только этот файл.
//
// Видео и музыка задаются одним из двух способов:
//   youtube: '0b4AL6PVfiU'             — код ролика YouTube (то, что после youtu.be/ в ссылке)
//   file: 'media/music/pesnya.mp3'     — файл, лежащий в папке приложения
// minutes — примерная длительность, показывается на карточке.

// Адрес сервера (Google Apps Script). Пустая строка — данные остаются только на устройстве.
export const API_URL = 'https://script.google.com/macros/s/AKfycbyTxLjkmhCVlGrCRkkcJRky69qp9dNVviNnCfJwPc5sxL3gpf-CgZ0tNZsyt56gY00n/exec';

// Сколько подходов в день считается выполненной нормой
export const DAILY_GOALS = { exercise: 1, left: 2, music: 3 };

// Раздел «Упражнения» (физические)
export const EXERCISES = [
  { id: 'ex-main-kz', title: 'Основной сет упражнений (на казахском языке)', youtube: '0b4AL6PVfiU', minutes: 4 },
  { id: 'ex-set1-a', title: 'Первый сет: упражнения 1–5', youtube: '_7Nyqdy1pvU', minutes: 2 },
  { id: 'ex-set1-b', title: 'Первый сет: упражнения 6–10', youtube: 'UToj3Ixli90', minutes: 3 },
  { id: 'ex-set1-c', title: 'Первый сет: упражнения 11–13', youtube: 'Aov6Zc-cEq8', minutes: 1 },
  { id: 'ex-set2', title: 'Второй сет упражнений', youtube: '8TZ9Nj0ZDoE', minutes: 2 },
];

// Раздел «Когнитивная стимуляция» → видео-упражнения для мозга
export const BRAIN_VIDEOS = [
  { id: 'brain-a', title: 'Упражнения для мозга 1–3', youtube: '3gu-WzZ_Qjw', minutes: 2 },
  { id: 'brain-b', title: 'Упражнения для мозга 4–7', youtube: 'zfpjd5OEJI8', minutes: 4 },
];

export const MUSIC = [
  { id: 'm1', title: 'Пример мелодии', file: 'media/music/primer.wav' },
];
