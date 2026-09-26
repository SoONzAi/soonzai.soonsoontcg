/**
 * SoonSoonTCG Background Music (BGM) Player.
 * Plays ./assets/bgm.mp3 with soft fade-in, user controls, volume slider, and localStorage persistence.
 */
export function setup(appContext){
  const localStorage = appContext.localStorage || window.localStorage;

  // Prevent duplicate initialization
  if (document.getElementById('bgmContainer')) return;

  const BGM_SRC = './assets/bgm.mp3';
  const STORAGE_KEY_DISABLED = 'soonsoon_bgm_disabled';
  const STORAGE_KEY_VOL = 'soonsoon_bgm_volume';

  // Create Audio instance
  const audio = new Audio(BGM_SRC);
  audio.loop = true;
  audio.preload = 'auto';

  // Read saved volume (default 0.35)
  let savedVol = 0.35;
  try {
    const rawVol = localStorage.getItem(STORAGE_KEY_VOL);
    if (rawVol !== null) {
      const parsed = parseFloat(rawVol);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) savedVol = parsed;
    }
  } catch {}
  audio.volume = savedVol;

  let isPlaying = false;
  let userMuted = false;
  try {
    userMuted = localStorage.getItem(STORAGE_KEY_DISABLED) === '1';
  } catch {}

  // Create floating BGM widget
  const container = document.createElement('div');
  container.id = 'bgmContainer';
  container.className = 'bgm-floating-container';
  container.innerHTML = `
    <div class="bgm-widget" id="bgmWidget" title="SoonSoonTCG BGM Player">
      <button type="button" class="bgm-btn" id="bgmToggleBtn" aria-label="Toggle background music">
        <span id="bgmBtnIcon" aria-hidden="true">▶</span>
      </button>
      <div class="bgm-equalizer" id="bgmEqualizer" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <div class="bgm-info" id="bgmInfo" role="button" tabindex="0" aria-label="Toggle BGM playback">
        <span class="bgm-title">SoonSoon BGM</span>
        <span class="bgm-status" id="bgmStatusText">Click to Play</span>
      </div>
      <div class="bgm-volume-wrap" title="Volume">
        <input type="range" class="bgm-volume-slider" id="bgmVolumeSlider" min="0" max="1" step="0.05" value="${savedVol}" aria-label="BGM Volume">
      </div>
    </div>
  `;
  document.body.appendChild(container);

  const widget = document.getElementById('bgmWidget');
  const toggleBtn = document.getElementById('bgmToggleBtn');
  const btnIcon = document.getElementById('bgmBtnIcon');
  const statusText = document.getElementById('bgmStatusText');
  const info = document.getElementById('bgmInfo');
  const volSlider = document.getElementById('bgmVolumeSlider');

  function updateUI(playing) {
    isPlaying = playing;
    if (playing) {
      widget.classList.add('is-playing');
      btnIcon.textContent = '❚❚';
      statusText.textContent = 'Playing';
      toggleBtn.setAttribute('aria-label', 'Pause background music');
    } else {
      widget.classList.remove('is-playing');
      btnIcon.textContent = '▶';
      statusText.textContent = userMuted ? 'Muted' : 'Paused';
      toggleBtn.setAttribute('aria-label', 'Play background music');
    }
  }

  async function playBGM(fadeIn = true) {
    try {
      if (fadeIn) {
        audio.volume = 0;
        await audio.play();
        updateUI(true);
        // Soft fade in
        let current = 0;
        const target = savedVol;
        const step = target / 15;
        const interval = setInterval(() => {
          current = Math.min(target, current + step);
          audio.volume = current;
          if (current >= target) clearInterval(interval);
        }, 60);
      } else {
        audio.volume = savedVol;
        await audio.play();
        updateUI(true);
      }
      userMuted = false;
      try { localStorage.setItem(STORAGE_KEY_DISABLED, '0'); } catch {}
    } catch (e) {
      updateUI(false);
    }
  }

  function pauseBGM() {
    audio.pause();
    updateUI(false);
    userMuted = true;
    try { localStorage.setItem(STORAGE_KEY_DISABLED, '1'); } catch {}
  }

  function toggleBGM() {
    if (isPlaying) {
      pauseBGM();
    } else {
      playBGM(false);
    }
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleBGM();
  });

  info.addEventListener('click', () => {
    toggleBGM();
  });
  info.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleBGM();
    }
  });

  volSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    savedVol = val;
    audio.volume = val;
    try { localStorage.setItem(STORAGE_KEY_VOL, String(val)); } catch {}
    if (val === 0 && isPlaying) {
      statusText.textContent = 'Muted';
    } else if (isPlaying) {
      statusText.textContent = 'Playing';
    }
  });

  // Autoplay on first user interaction if not explicitly disabled by user
  if (!userMuted) {
    const onFirstUserInteraction = () => {
      document.removeEventListener('pointerdown', onFirstUserInteraction);
      document.removeEventListener('keydown', onFirstUserInteraction);
      if (!isPlaying && !userMuted) {
        playBGM(true);
      }
    };
    document.addEventListener('pointerdown', onFirstUserInteraction, { once: true });
    document.addEventListener('keydown', onFirstUserInteraction, { once: true });
  } else {
    updateUI(false);
  }
}
