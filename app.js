const STORAGE_KEY = 'wony_pomo_state_v1';
const STATS_KEY = 'wony_pomo_stats_v1';

const MODE = {
  pomodoro: { label: '집중할 시간', defaultMin: 25, color: 'var(--pomodoro)', soft: 'var(--pomodoro-soft)' },
  short:    { label: '짧게 쉬어가기', defaultMin: 5,  color: 'var(--short)',    soft: 'var(--short-soft)'    },
  long:     { label: '길게 쉬어가기', defaultMin: 15, color: 'var(--long)',     soft: 'var(--long-soft)'     },
};

const RING_CIRC = 2 * Math.PI * 92;

const settings = {
  pomodoro: 25,
  short: 5,
  long: 15,
  rounds: 4,
  auto: true,
  sound: true,
};

const state = {
  mode: 'pomodoro',
  running: false,
  startedAt: null,
  accumulatedMs: 0,
  completedThisCycle: 0,
};

const stats = {
  date: todayStr(),
  count: 0,
};

const els = {
  card: document.getElementById('card'),
  timeText: document.getElementById('timeText'),
  modeLabel: document.getElementById('modeLabel'),
  startBtn: document.getElementById('startBtn'),
  resetBtn: document.getElementById('resetBtn'),
  skipBtn: document.getElementById('skipBtn'),
  ringProgress: document.getElementById('ringProgress'),
  modeTabs: document.querySelectorAll('.mode-tab'),
  tomatoRow: document.getElementById('tomatoRow'),
  completedCount: document.getElementById('completedCount'),
  totalToday: document.getElementById('totalToday'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  setPomo: document.getElementById('setPomo'),
  setShort: document.getElementById('setShort'),
  setLong: document.getElementById('setLong'),
  setRounds: document.getElementById('setRounds'),
  setAuto: document.getElementById('setAuto'),
  setSound: document.getElementById('setSound'),
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      Object.assign(settings, obj.settings || {});
      Object.assign(state, obj.state || {});
    }
  } catch (e) {}
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj.date === todayStr()) Object.assign(stats, obj);
    }
  } catch (e) {}
  state.running = false;
  state.startedAt = null;
}

function saveAll() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, state }));
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {}
}

function totalMs() {
  return settings[state.mode] * 60 * 1000;
}

function elapsedMs() {
  return state.accumulatedMs + (state.running && state.startedAt ? Date.now() - state.startedAt : 0);
}

function remainingMs() {
  return Math.max(0, totalMs() - elapsedMs());
}

function fmt(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function applyModeStyles() {
  const css = MODE[state.mode];
  document.documentElement.style.setProperty('--accent', css.color);
  document.documentElement.style.setProperty('--accent-soft', css.soft);
  els.card.classList.toggle('mode-short', state.mode === 'short');
  els.card.classList.toggle('mode-long', state.mode === 'long');
  els.modeLabel.textContent = MODE[state.mode].label;
  els.modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === state.mode));
}

function renderTime() {
  const remain = remainingMs();
  els.timeText.textContent = fmt(remain);
  const progress = totalMs() ? (totalMs() - remain) / totalMs() : 0;
  els.ringProgress.style.strokeDashoffset = String(RING_CIRC * (1 - progress));
  els.startBtn.textContent = state.running ? 'PAUSE' : (state.accumulatedMs > 0 ? 'RESUME' : 'START');
  els.startBtn.classList.toggle('running', state.running);
  els.card.classList.toggle('running', state.running);

  document.title = state.running
    ? `${fmt(remain)} · ${MODE[state.mode].label}`
    : "Wony's Pomo";
}

function renderRounds() {
  els.tomatoRow.innerHTML = '';
  const total = settings.rounds;
  for (let i = 0; i < total; i++) {
    const t = document.createElement('span');
    t.className = 'tomato' + (i < state.completedThisCycle ? ' done' : '');
    t.textContent = '🍅';
    els.tomatoRow.appendChild(t);
  }
  els.completedCount.textContent = String(stats.count);
  els.totalToday.textContent = '∞';
}

function renderSettingsInputs() {
  els.setPomo.value = settings.pomodoro;
  els.setShort.value = settings.short;
  els.setLong.value = settings.long;
  els.setRounds.value = settings.rounds;
  els.setAuto.checked = settings.auto;
  els.setSound.checked = settings.sound;
}

let tickHandle = null;
function startTicking() {
  stopTicking();
  tickHandle = setInterval(() => {
    if (!state.running) return;
    if (remainingMs() <= 0) {
      finishCurrent();
      return;
    }
    renderTime();
  }, 250);
}
function stopTicking() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  state.startedAt = Date.now();
  ensureAudio();
  renderTime();
  saveAll();
  startTicking();
}

function pauseTimer() {
  if (!state.running) return;
  state.accumulatedMs += Date.now() - state.startedAt;
  state.startedAt = null;
  state.running = false;
  renderTime();
  saveAll();
}

function resetTimer() {
  state.running = false;
  state.startedAt = null;
  state.accumulatedMs = 0;
  renderTime();
  saveAll();
}

function setMode(mode) {
  state.mode = mode;
  state.running = false;
  state.startedAt = null;
  state.accumulatedMs = 0;
  applyModeStyles();
  renderTime();
  renderRounds();
  saveAll();
}

function nextMode() {
  let nextModeName;
  if (state.mode === 'pomodoro') {
    state.completedThisCycle += 1;
    stats.count += 1;
    stats.date = todayStr();
    if (state.completedThisCycle >= settings.rounds) {
      nextModeName = 'long';
      state.completedThisCycle = 0;
    } else {
      nextModeName = 'short';
    }
  } else {
    nextModeName = 'pomodoro';
  }
  return nextModeName;
}

function finishCurrent() {
  playAlarm();
  notify(`${MODE[state.mode].label} 끝!`);
  const next = nextMode();
  state.mode = next;
  state.running = false;
  state.startedAt = null;
  state.accumulatedMs = 0;
  applyModeStyles();
  renderTime();
  renderRounds();
  saveAll();
  if (settings.auto) {
    setTimeout(startTimer, 600);
  }
}

function skipMode() {
  if (state.mode === 'pomodoro') {
    state.completedThisCycle = Math.min(state.completedThisCycle + 1, settings.rounds);
  }
  const next = state.mode === 'pomodoro'
    ? (state.completedThisCycle >= settings.rounds ? 'long' : 'short')
    : 'pomodoro';
  if (state.mode === 'pomodoro' && state.completedThisCycle >= settings.rounds) state.completedThisCycle = 0;
  state.mode = next;
  state.running = false;
  state.startedAt = null;
  state.accumulatedMs = 0;
  applyModeStyles();
  renderTime();
  renderRounds();
  saveAll();
}

// === Audio ===

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) audioCtx = new Ctor();
    } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function playTone(freq, duration, when, gainPeak = 0.18) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const t0 = audioCtx.currentTime + when;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function playAlarm() {
  if (!settings.sound) return;
  ensureAudio();
  if (!audioCtx) return;
  const isBreakIncoming = state.mode === 'pomodoro';
  const seq = isBreakIncoming
    ? [659.25, 783.99, 1046.50]
    : [523.25, 659.25, 783.99];
  seq.forEach((f, i) => playTone(f, 0.45, i * 0.18));
}

function notify(text) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification("Wony's Pomo 🍅", { body: text }); } catch (e) {}
  }
}

// === Wire UI ===

els.startBtn.addEventListener('click', () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
  state.running ? pauseTimer() : startTimer();
});

els.resetBtn.addEventListener('click', resetTimer);
els.skipBtn.addEventListener('click', skipMode);

els.modeTabs.forEach(tab => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

function openSettings() {
  renderSettingsInputs();
  els.settingsPanel.hidden = false;
}
function closeSettings() {
  const newVals = {
    pomodoro: clampInt(els.setPomo.value, 1, 120, 25),
    short: clampInt(els.setShort.value, 1, 60, 5),
    long: clampInt(els.setLong.value, 1, 60, 15),
    rounds: clampInt(els.setRounds.value, 2, 12, 4),
    auto: !!els.setAuto.checked,
    sound: !!els.setSound.checked,
  };
  const wasDifferent = JSON.stringify(newVals) !== JSON.stringify({
    pomodoro: settings.pomodoro, short: settings.short, long: settings.long,
    rounds: settings.rounds, auto: settings.auto, sound: settings.sound,
  });
  Object.assign(settings, newVals);
  if (wasDifferent && !state.running && state.accumulatedMs === 0) {
    renderTime();
  }
  saveAll();
  renderRounds();
  els.settingsPanel.hidden = true;
}
function clampInt(v, lo, hi, fallback) {
  const n = parseInt(v, 10);
  if (!isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

els.settingsBtn.addEventListener('click', () => {
  if (els.settingsPanel.hidden) openSettings();
  else closeSettings();
});
els.closeSettingsBtn.addEventListener('click', closeSettings);

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    state.running ? pauseTimer() : startTimer();
  } else if (e.key === 'r' || e.key === 'R') {
    resetTimer();
  } else if (e.key === 's' || e.key === 'S') {
    skipMode();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') renderTime();
});

setInterval(() => {
  const today = todayStr();
  if (stats.date !== today) {
    stats.date = today;
    stats.count = 0;
    saveAll();
    renderRounds();
  }
}, 60000);

// === Init ===

loadAll();
applyModeStyles();
renderRounds();
renderTime();
els.ringProgress.setAttribute('stroke-dasharray', String(RING_CIRC));
startTicking();
