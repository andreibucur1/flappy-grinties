// Muzică de fundal, în buclă. Chrome nu pornește sunetul înainte de prima interacțiune cu pagina,
// așa că se încearcă pornirea la încărcare și, dacă e blocată, la prima tastă apăsată sau la primul click.
// Butonul din colțul dreapta-jos deschide un slider de volum; volumul ales se ține minte în browser.
const Music = (function () {
  'use strict';

  const VOLUME_KEY = 'grinties_flappy_volume_v1';

  const audio = new Audio(CONFIG.music.src);
  audio.loop = true;
  audio.volume = savedVolume();
  audio.muted = audio.volume === 0;
  audio.preload = 'auto';

  let unlocked = false;

  // 0..1; implicit CONFIG.music.volume
  function savedVolume() {
    try {
      const v = parseFloat(localStorage.getItem(VOLUME_KEY));
      if (v >= 0 && v <= 1) return v;
    } catch (e) { /* fără localStorage: volumul implicit */ }
    return CONFIG.music.volume;
  }

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

  // Tab ascuns (alt tab, altă aplicație, ecran blocat pe telefon): muzica se oprește și pornește din nou la întoarcere
  let pausedByHide = false;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (!audio.paused) { audio.pause(); pausedByHide = true; }
    } else if (pausedByHide) {
      pausedByHide = false;
      tryPlay();
    }
  });

  // Ctrl+Shift+M: oprește / pornește sunetul (scurtătură de organizator; nu se salvează)
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === 'KeyM') {
      e.preventDefault();
      if (!e.repeat) audio.muted = !audio.muted;
    }
  });

  // ---------------------------------------------------------------- butonul și sliderul
  const ui = document.getElementById('music-ui');
  const btn = document.getElementById('music-btn');
  const panel = document.getElementById('music-panel');
  const slider = document.getElementById('music-volume');

  // Iconița arată difuzorul tăiat când sunetul e oprit (volum 0 sau Ctrl+Shift+M)
  function refreshIcon() {
    ui.classList.toggle('muted', audio.muted || audio.volume === 0);
  }

  function setOpen(open) {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  slider.value = String(Math.round(audio.volume * 100));
  refreshIcon();
  audio.addEventListener('volumechange', refreshIcon);

  btn.addEventListener('click', function () {
    setOpen(panel.hidden);
    btn.blur(); // altfel Space (săritura) ar apăsa din nou butonul
  });

  // Pe iPhone volumul nu se poate seta din pagină (doar din butoanele telefonului); 0 tot oprește sunetul, prin muted
  slider.addEventListener('input', function () {
    const v = Number(slider.value) / 100;
    audio.volume = v;
    audio.muted = v === 0;
    try { localStorage.setItem(VOLUME_KEY, String(v)); } catch (e) { /* volumul nu se ține minte */ }
  });

  // Un click în afara butonului și a sliderului închide sliderul
  document.addEventListener('pointerdown', function (e) {
    if (!panel.hidden && !ui.contains(e.target)) setOpen(false);
  });

  return { audio: audio, closePanel: function () { setOpen(false); } };
})();
