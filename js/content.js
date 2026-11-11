// Всё содержимое приложения. Менять можно только этот файл.
//
// Видео и музыка задаются одним из двух способов:
//   file: 'media/video/hodba.mp4'      — файл, лежащий в папке приложения
//   youtube: 'dQw4w9WgXcQ'             — код ролика YouTube (то, что после v= в ссылке)
// Пока ничего не указано, пациент видит «Видео скоро появится».

export const COORDINATOR_PIN = '2026';

// Сколько подходов в день считается выполненной нормой
export const DAILY_GOALS = { exercise: 1, left: 2, music: 3 };

export const EXERCISES = [
  { id: 'ex1', title: 'Упражнение 1', minutes: 5 },
  { id: 'ex2', title: 'Упражнение 2', minutes: 5 },
  { id: 'ex3', title: 'Упражнение 3', minutes: 5 },
  { id: 'ex4', title: 'Упражнение 4', minutes: 5 },
  { id: 'ex5', title: 'Упражнение 5', minutes: 5 },
  { id: 'ex6', title: 'Упражнение 6', minutes: 5 },
];

export const MUSIC = [
  { id: 'm1', title: 'Пример мелодии', file: 'media/music/primer.wav' },
];
