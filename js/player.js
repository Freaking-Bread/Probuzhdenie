import { h } from './ui.js?v=9';

// Плеер для файла или YouTube. Считает, сколько секунд реально проигрывалось.
// Возвращает { el, seconds(), stop() }.
export function createPlayer(item, kind /* 'video' | 'audio' */) {
  let played = 0;
  let isPlaying = () => false;
  let stopFn = () => {};
  const timer = setInterval(() => { if (isPlaying()) played += 1; }, 1000);
  let el;

  if (item.file) {
    const media = h(kind, { src: item.file, controls: true, playsInline: true, preload: 'metadata', class: 'media' });
    isPlaying = () => !media.paused && !media.ended;
    stopFn = () => media.pause();
    el = media;
  } else if (item.youtube) {
    const holder = h('div');
    el = h('div', { class: 'yt' }, holder);
    loadYouTube().then((YT) => {
      let state = -1;
      const p = new YT.Player(holder, {
        videoId: item.youtube,
        playerVars: { rel: 0, playsinline: 1 },
        events: { onStateChange: (e) => { state = e.data; } },
      });
      isPlaying = () => state === 1;
      stopFn = () => p.pauseVideo && p.pauseVideo();
    });
  } else {
    el = h('div', { class: 'media-empty' }, kind === 'video' ? 'Видео скоро появится' : 'Музыка скоро появится');
  }

  return {
    el,
    seconds: () => played,
    stop() { clearInterval(timer); stopFn(); },
  };
}

let ytPromise;
function loadYouTube() {
  ytPromise ||= new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    document.head.append(h('script', { src: 'https://www.youtube.com/iframe_api' }));
  });
  return ytPromise;
}

// Запись голоса с микрофона. Возвращает { stop(): Promise<Blob> }.
export async function startVoiceRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start();
  return {
    stop: () => new Promise((resolve) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: rec.mimeType }));
      };
      rec.stop();
    }),
  };
}
