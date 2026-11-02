// Muzică de fundal, în buclă. Chrome nu pornește sunetul înainte de prima interacțiune cu pagina,
// așa că se încearcă pornirea la încărcare și, dacă e blocată, la prima tastă apăsată sau la primul click.
const Music = (function () {
  'use strict';

  const audio = new Audio(CONFIG.music.src);
  audio.loop = true;
  audio.volume = CONFIG.music.volume;
  audio.preload = 'auto';

  let unlocked = false;

  function tryPlay() {
    const p = audio.play();
    if (p && p.then) {
      p.then(function () { unlocked = true; }, function () { /* blocat până la prima interacțiune */ });
    }
  }

  function onFirstGesture() {
    if (unlocked) return;
    tryPlay();
  }

  tryPlay();
  window.addEventListener('keydown', onFirstGesture);
  window.addEventListener('pointerdown', onFirstGesture);

  // Ctrl+Shift+M: oprește / pornește sunetul (scurtătură de organizator; nu se salvează)
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === 'KeyM') {
      e.preventDefault();
      if (!e.repeat) audio.muted = !audio.muted;
    }
  });

  return { audio: audio };
})();
