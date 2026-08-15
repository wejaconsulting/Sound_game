/* ===== Sing Song – spellogik ===== */

/* ---------- Nivåer ---------- */
/* Melodierna hämtas ur songboken (songs.js) per nivå.
   startNotes = så många toner av låten runda 1 börjar med.
   toleranceCents = hur nära man måste sjunga (oktav-oberoende).
   misses = tillåtna missar per tur. replays = "hör igen" per tur. */
const LEVELS = {
  latt: {
    label: 'Lätt',
    startNotes: 3, noteMs: 620,
    toleranceCents: 75, misses: 2, replays: 2, beat: false,
  },
  medium: {
    label: 'Medium',
    startNotes: 4, noteMs: 540,
    toleranceCents: 60, misses: 1, replays: 1, beat: true,
  },
  svar: {
    label: 'Svår',
    startNotes: 5, noteMs: 480,
    toleranceCents: 45, misses: 1, replays: 1, beat: true,
  },
  hardcore: {
    label: 'Hardcore 🔥',
    startNotes: 6, noteMs: 430,
    toleranceCents: 35, misses: 0, replays: 0, beat: true,
  },
};

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const MAX_PLAYERS = 8;

/* ---------- Speltillstånd ---------- */
const game = {
  levelKey: null,
  level: null,
  round: 1,
  players: [],       // [{ name, avatarId, alive, score, roundsCleared }]
  currentIdx: -1,    // index i players på den som sjunger
  turnQueue: [],     // spelarindex kvar i nuvarande runda
  streak: 0,
  melody: [],        // [{ midi, beats }]
  songTitle: '',
  lastSongId: null,
  results: [],       // 'hit' | 'miss' per ton, för återritning efter replay
  noteIndex: 0,
  missesLeft: 0,
  replaysLeft: 0,
  phase: 'idle', // idle | intro | listen | sing | between | over
  cancelPlayback: null,
  pitchLoop: null,
  frames: [],
  noteStartedAt: 0,
};

function currentPlayer() {
  return game.players[game.currentIdx];
}
function alivePlayers() {
  return game.players.filter((p) => p.alive);
}

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const screens = {
  start: $('screen-start'),
  game: $('screen-game'),
  over: $('screen-gameover'),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

/* ---------- Flytande bakgrundsnoter ---------- */
(function spawnFloaters() {
  const host = document.querySelector('.floaters');
  const glyphs = ['♪', '♫', '♩', '♬', '✦', '★'];
  const colors = ['#ff3ec9', '#2ff3ff', '#ffd166', '#7b2ff7', '#3ddc84'];
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.textContent = glyphs[i % glyphs.length];
    s.style.left = `${(i * 61) % 100}%`;
    s.style.color = colors[i % colors.length];
    s.style.fontSize = `${1.2 + (i % 4) * 0.5}rem`;
    s.style.animationDuration = `${9 + (i % 6) * 2.4}s`;
    s.style.animationDelay = `${(i * 1.37) % 12}s`;
    host.appendChild(s);
  }
})();

/* ---------- Spelare & avatarer (startskärmen) ---------- */
let party = [];            // [{ name, avatarId }]
let selectedAvatar = AVATARS[0].id;

function loadParty() {
  try {
    const saved = JSON.parse(localStorage.getItem('singsong-party') || '[]');
    if (Array.isArray(saved)) party = saved.filter((p) => p && p.name).slice(0, MAX_PLAYERS);
  } catch { party = []; }
}
function saveParty() {
  localStorage.setItem('singsong-party', JSON.stringify(party));
}

function renderAvatarGrid() {
  const grid = $('avatar-grid');
  grid.innerHTML = '';
  AVATARS.forEach((a) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-choice' + (a.id === selectedAvatar ? ' selected' : '');
    btn.innerHTML = avatarSVG(a);
    btn.title = 'Välj avatar';
    btn.addEventListener('click', () => {
      selectedAvatar = a.id;
      renderAvatarGrid();
    });
    grid.appendChild(btn);
  });
}

function renderPlayerChips() {
  const host = $('player-chips');
  host.innerHTML = '';
  party.forEach((p, i) => {
    const chip = document.createElement('span');
    chip.className = 'player-chip';
    chip.innerHTML = `${avatarSVG(avatarById(p.avatarId))}<span>${escapeHtml(p.name)}</span>`;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = '✕';
    rm.setAttribute('aria-label', `Ta bort ${p.name}`);
    rm.addEventListener('click', () => {
      party.splice(i, 1);
      saveParty();
      renderPlayerChips();
    });
    chip.appendChild(rm);
    host.appendChild(chip);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function addPlayerFromForm() {
  if (party.length >= MAX_PLAYERS) return;
  const input = $('player-name');
  const name = input.value.trim() || `Spelare ${party.length + 1}`;
  party.push({ name, avatarId: selectedAvatar });
  input.value = '';
  // Föreslå en oanvänd avatar till nästa spelare
  const used = new Set(party.map((p) => p.avatarId));
  const free = AVATARS.find((a) => !used.has(a.id));
  if (free) selectedAvatar = free.id;
  saveParty();
  renderPlayerChips();
  renderAvatarGrid();
}

/* ---------- Scenen ---------- */
function renderStage() {
  const host = $('stage-avatars');
  host.innerHTML = '';
  game.players.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'avatar';
    el.dataset.index = i;
    if (!p.alive) el.classList.add('out');
    if (i === game.currentIdx && p.alive) el.classList.add('front');
    el.innerHTML = avatarSVG(avatarById(p.avatarId), { withMic: i === game.currentIdx && p.alive })
      + `<span class="avatar-name">${escapeHtml(p.name)}</span>`;
    host.appendChild(el);
  });
}

function stageAvatarEl(i) {
  return document.querySelector(`.stage-avatars .avatar[data-index="${i}"]`);
}

/* Kör en kort animationsklass på en avatar. */
function animateAvatar(i, cls, ms = 1000) {
  const el = stageAvatarEl(i);
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // starta om animationen
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

function cheerAll() {
  game.players.forEach((p, i) => { if (p.alive) animateAvatar(i, 'hop', 1100); });
}

/* ---------- Notpapper (SVG) ---------- */
const STAFF = { top: 60, gap: 18, left: 90, right: 770 };

function staffY(step) {
  // step 0 = E4 (nedersta linjen), varje steg = halvt linjeavstånd uppåt
  return STAFF.top + 4 * STAFF.gap - step * (STAFF.gap / 2);
}

function midiToStaff(midi) {
  // Diatoniskt steg relativt E4 + ev. höjning (♯)
  const diatonic = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C..B -> C D E F G A B
  const sharp =    [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  const pc = midi % 12;
  const octave = Math.floor(midi / 12) - 1; // MIDI 60 = C4
  const stepFromC0 = octave * 7 + diatonic[pc];
  const E4 = 4 * 7 + 2; // E i oktav 4
  return { step: stepFromC0 - E4, sharp: !!sharp[pc] };
}

function renderStaff(melody, { hidden = false } = {}) {
  const svg = $('staff');
  const NS = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', 30); line.setAttribute('x2', 790);
    const y = STAFF.top + i * STAFF.gap;
    line.setAttribute('y1', y); line.setAttribute('y2', y);
    line.setAttribute('class', 'staff-line');
    svg.appendChild(line);
  }

  const clef = document.createElementNS(NS, 'text');
  clef.textContent = '𝄞';
  clef.setAttribute('x', 38);
  clef.setAttribute('y', STAFF.top + 4 * STAFF.gap + 6);
  clef.setAttribute('font-size', '92');
  clef.setAttribute('class', 'clef');
  svg.appendChild(clef);

  const n = melody.length;
  const span = STAFF.right - STAFF.left;
  melody.forEach((note, i) => {
    const { midi, beats } = note;
    const { step, sharp } = midiToStaff(midi);
    const x = STAFF.left + span * ((i + 0.5) / n);
    const y = staffY(step);

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', beats >= 2 ? 'note half' : 'note'); // halvnot ritas ihålig
    g.dataset.index = i;

    // Hjälplinjer under (C4) och över notsystemet
    for (let s = -2; s >= step; s -= 2) {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x - 16); l.setAttribute('x2', x + 16);
      l.setAttribute('y1', staffY(s)); l.setAttribute('y2', staffY(s));
      l.setAttribute('class', 'ledger-line');
      g.appendChild(l);
    }
    for (let s = 10; s <= step; s += 2) {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x - 16); l.setAttribute('x2', x + 16);
      l.setAttribute('y1', staffY(s)); l.setAttribute('y2', staffY(s));
      l.setAttribute('class', 'ledger-line');
      g.appendChild(l);
    }

    if (sharp && !hidden) {
      const acc = document.createElementNS(NS, 'text');
      acc.textContent = '♯';
      acc.setAttribute('x', x - 30);
      acc.setAttribute('y', y + 9);
      acc.setAttribute('class', 'note-acc');
      g.appendChild(acc);
    }

    const head = document.createElementNS(NS, 'ellipse');
    head.setAttribute('cx', x); head.setAttribute('cy', y);
    head.setAttribute('rx', 11); head.setAttribute('ry', 8.5);
    head.setAttribute('transform', `rotate(-18 ${x} ${y})`);
    head.setAttribute('class', 'note-head');
    g.appendChild(head);

    const stem = document.createElementNS(NS, 'line');
    const up = step < 4; // skaft uppåt under mittlinjen
    stem.setAttribute('x1', up ? x + 10 : x - 10);
    stem.setAttribute('x2', up ? x + 10 : x - 10);
    stem.setAttribute('y1', y);
    stem.setAttribute('y2', up ? y - 52 : y + 52);
    stem.setAttribute('class', 'note-stem');
    g.appendChild(stem);

    if (hidden) g.style.opacity = '0';
    svg.appendChild(g);
  });
}

function noteEl(i) {
  return document.querySelector(`#staff .note[data-index="${i}"]`);
}

function setNoteState(i, state) {
  const el = noteEl(i);
  if (!el) return;
  el.style.opacity = '1';
  el.classList.remove('playing', 'current', 'hit', 'miss');
  if (state) el.classList.add(state);
}

/* ---------- Melodival – hämta en bit av en riktig låt ---------- */
function pickMelody(levelKey, level, round) {
  const pool = songsForLevel(levelKey);
  let candidates = pool.filter((s) => s.id !== game.lastSongId);
  if (candidates.length === 0) candidates = pool;
  const song = candidates[Math.floor(Math.random() * candidates.length)];

  const len = Math.min(song.notes.length, level.startNotes + (round - 1) * 2);
  game.lastSongId = song.id;
  game.songTitle = song.title;
  return song.notes.slice(0, len).map(([midi, beats]) => ({ midi, beats: beats || 1 }));
}

function roundTempo(level, round) {
  return Math.max(320, Math.round(level.noteMs * Math.pow(0.96, round - 1)));
}

/* ---------- HUD ---------- */
function updateHud() {
  const p = currentPlayer();
  $('hud-player').textContent = p ? p.name : '–';
  $('hud-round').textContent = game.round;
  $('hud-score').textContent = p ? p.score : 0;
  $('hud-lives').textContent = game.missesLeft > 0 ? '❤️'.repeat(game.missesLeft) : '💀';
  $('replay-count').textContent = game.replaysLeft;
  $('btn-replay').disabled = game.replaysLeft <= 0 || game.phase !== 'sing';
}

function setStatus(text, pulse = false) {
  const el = $('status-text');
  el.textContent = text;
  el.classList.toggle('pulse', pulse);
}

/* ---------- Tonjämförelse (oktav-oberoende) ---------- */
function centsOffOctaveFree(sungMidi, targetMidi) {
  let diff = ((sungMidi - targetMidi) % 12 + 12) % 12; // 0..12 halvtoner
  if (diff > 6) diff -= 12;                            // -6..+6
  return diff * 100;                                   // cent
}

function midiToName(midi) {
  const m = Math.round(midi);
  return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

/* ---------- Skärmlås (mobil) – håll skärmen vaken medan man spelar ---------- */
let wakeLock = null;
async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* stöds inte – ofarligt */ }
}
function releaseWake() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ['intro', 'listen', 'sing', 'between'].includes(game.phase)) {
    keepAwake();
    AudioEngine.getCtx(); // väck AudioContext igen om mobilen pausade den
  }
});

/* ---------- Spelflöde ---------- */
function micErrorText(err) {
  if (err.name === 'InsecureContextError') {
    return '🔒 Mikrofonen kan bara användas när appen körs via https eller localhost. Öppna appen från en säker adress och försök igen.';
  }
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return '😕 Mikrofonen blockerades. Tillåt mikrofon för den här sidan i webbläsarens inställningar och tryck på nivån igen.';
  }
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return '🎙️ Ingen mikrofon hittades. Koppla in eller aktivera en mikrofon och försök igen.';
  }
  return '😕 Kunde inte starta mikrofonen. Testa att ladda om sidan och tillåta mikrofon när webbläsaren frågar.';
}

async function startGame(levelKey) {
  AudioEngine.getCtx(); // skapa/väck AudioContext i klickgesten (krav på mobil)
  try {
    await PitchDetector.init();
  } catch (err) {
    const el = $('mic-error');
    el.hidden = false;
    el.textContent = micErrorText(err);
    return;
  }
  $('mic-error').hidden = true;
  keepAwake();

  if (party.length === 0) {
    party.push({ name: 'Spelare 1', avatarId: selectedAvatar });
    saveParty();
    renderPlayerChips();
  }

  game.levelKey = levelKey;
  game.level = LEVELS[levelKey];
  game.phase = 'idle';
  game.round = 1;
  game.streak = 0;
  game.lastSongId = null;
  game.players = party.map((p) => ({
    name: p.name, avatarId: p.avatarId,
    alive: true, score: 0, roundsCleared: 0,
  }));
  game.currentIdx = -1;
  game.turnQueue = [];
  showScreen('game');
  renderStage();
  nextTurn();
}

/* Nästa spelare i tur – fyller på kön och höjer rundan när alla sjungit. */
function nextTurn() {
  if (game.phase === 'over') return;

  if (game.turnQueue.length === 0) {
    const alive = game.players.map((p, i) => (p.alive ? i : -1)).filter((i) => i >= 0);
    if (alive.length === 0) return; // hanteras av playerOut
    if (game.currentIdx >= 0) game.round++; // ny runda när kön fyllts på igen (ej första)
    game.turnQueue = alive;
  }

  game.currentIdx = game.turnQueue.shift();
  game.phase = 'intro';
  renderStage();
  updateHud();

  const p = currentPlayer();
  const solo = game.players.length === 1;
  setStatus(solo ? `Runda ${game.round} – gör dig redo! 🎤` : `🎤 Nu sjunger ${p.name}!`, true);
  AudioEngine.playBlip(880, 0.12, 0.2);
  setTimeout(startRound, solo ? 900 : 1600);
}

function startRound() {
  if (game.phase === 'over') return;
  const lvl = game.level;
  game.melody = pickMelody(game.levelKey, lvl, game.round);
  game.results = [];
  game.noteIndex = 0;
  game.missesLeft = lvl.misses;
  game.replaysLeft = lvl.replays;
  game.streak = 0;
  game.phase = 'listen';
  updateHud();

  renderStaff(game.melody, { hidden: true });
  setStatus(`Runda ${game.round} – lyssna! 🎧`, true);
  $('meter-wrap').classList.remove('live');

  playMelodyWithUI({ withBeat: lvl.beat, then: startSinging });
}

function playMelodyWithUI({ withBeat, then }) {
  const tempo = roundTempo(game.level, game.round);
  game.cancelPlayback = AudioEngine.playMelody(game.melody, tempo, {
    withBeat,
    onNote: (i) => {
      if (i > 0) restingState(i - 1);
      setNoteState(i, 'playing');
    },
    onDone: () => {
      restingState(game.melody.length - 1);
      game.cancelPlayback = null;
      if (then) then();
    },
  });
}

/* Återställ en not till "vilande" utseende men behåll hit/miss-färg. */
function restingState(i) {
  const el = noteEl(i);
  if (!el) return;
  el.classList.remove('playing', 'current');
}

function startSinging() {
  if (game.phase === 'over') return;
  game.phase = 'sing';
  game.noteIndex = 0;
  updateHud();
  $('meter-wrap').classList.add('live');
  stageAvatarEl(game.currentIdx)?.classList.add('sing');
  countdown(3, () => armNote());
}

function countdown(n, done) {
  if (game.phase !== 'sing') return;
  if (n === 0) {
    setStatus('SJUNG! 🎤', true);
    done();
    return;
  }
  setStatus(`Sjung om ${n}…`);
  AudioEngine.playBlip(n === 1 ? 990 : 660, 0.09);
  setTimeout(() => countdown(n - 1, done), 700);
}

function armNote() {
  if (game.phase !== 'sing') return;
  game.frames = [];
  game.noteStartedAt = performance.now();
  setStatus(`Ton ${game.noteIndex + 1} av ${game.melody.length} – sjung och håll ut tonen 🎤`, true);
  setNoteState(game.noteIndex, 'current');
  runPitchLoop();
}

function runPitchLoop() {
  cancelAnimationFrame(game.pitchLoop);
  const target = game.melody[game.noteIndex].midi;

  const tick = () => {
    if (game.phase !== 'sing') return;

    const p = PitchDetector.getPitch();
    const now = performance.now();

    if (p) {
      game.frames.push({ t: now, midi: p.midi });
      updateMeter(p.midi, target);
    } else {
      updateMeter(null, target);
    }

    // Behåll bara de senaste 500 ms
    game.frames = game.frames.filter((f) => now - f.t < 500);

    const stable = findStablePitch(game.frames, now);
    if (stable !== null) {
      evaluateNote(stable, target);
      return;
    }

    if (now - game.noteStartedAt > 7000) {
      evaluateNote(null, target); // timeout = miss
      return;
    }

    game.pitchLoop = requestAnimationFrame(tick);
  };
  game.pitchLoop = requestAnimationFrame(tick);
}

/* Stabil ton = minst 350 ms röstade frames vars spridning < ±35 cent kring medianen. */
function findStablePitch(frames, now) {
  const recent = frames.filter((f) => now - f.t < 450);
  if (recent.length < 8) return null;
  const span = now - recent[0].t;
  if (span < 350) return null;
  const midis = recent.map((f) => f.midi).sort((a, b) => a - b);
  const median = midis[Math.floor(midis.length / 2)];
  const allClose = midis.every((m) => Math.abs(m - median) * 100 < 35);
  return allClose ? median : null;
}

function updateMeter(sungMidi, targetMidi) {
  const needle = $('meter-needle');
  const zone = $('meter-zone');
  const tol = game.level.toleranceCents;
  zone.style.width = `${Math.min(90, (tol / 150) * 100)}%`;

  if (sungMidi === null) {
    $('meter-note').textContent = '…';
    needle.style.background = 'rgba(255,255,255,.35)';
    needle.style.boxShadow = 'none';
    return;
  }
  const cents = centsOffOctaveFree(sungMidi, targetMidi);
  const clamped = Math.max(-150, Math.min(150, cents));
  needle.style.left = `${50 + (clamped / 150) * 50}%`;
  const inTune = Math.abs(cents) <= tol;
  needle.style.background = inTune ? 'var(--green)' : 'var(--cyan)';
  needle.style.boxShadow = `0 0 12px ${inTune ? 'var(--green)' : 'var(--cyan)'}`;
  $('meter-note').textContent = midiToName(sungMidi);
}

function evaluateNote(sungMidi, targetMidi) {
  cancelAnimationFrame(game.pitchLoop);
  const tol = game.level.toleranceCents;
  const targetName = midiToName(targetMidi);
  const player = currentPlayer();

  let hit = false;
  let cents = null;
  if (sungMidi !== null) {
    cents = centsOffOctaveFree(sungMidi, targetMidi);
    hit = Math.abs(cents) <= tol;
  }

  if (hit) {
    game.streak++;
    const accuracy = 1 - Math.abs(cents) / tol;
    const points = Math.round(60 + 60 * accuracy) + game.streak * 5;
    player.score += points;
    setNoteState(game.noteIndex, 'hit');
    game.results[game.noteIndex] = 'hit';
    setStatus(`✨ ${targetName}! +${points} poäng`);
    AudioEngine.playBlip(1320, 0.12, 0.2);
    animateAvatar(game.currentIdx, 'hop', 950);
  } else {
    game.streak = 0;
    game.missesLeft--;
    setNoteState(game.noteIndex, 'miss');
    game.results[game.noteIndex] = 'miss';
    const why = sungMidi === null
      ? 'Ingen ton hördes 😶'
      : (cents > 0 ? `För högt! Det skulle vara ${targetName}` : `För lågt! Det skulle vara ${targetName}`);
    setStatus(`❌ ${why}`);
    AudioEngine.playBlip(180, 0.25, 0.3);
    animateAvatar(game.currentIdx, 'wiggle', 500);
  }
  updateHud();

  if (!hit && game.missesLeft < 0) {
    setTimeout(playerOut, 900);
    return;
  }

  game.noteIndex++;
  if (game.noteIndex >= game.melody.length) {
    setTimeout(turnClear, 900);
  } else {
    setTimeout(() => armNote(), 1000);
  }
}

/* Spelarens tur klarad – publiken jublar: WOOOW! */
function turnClear() {
  if (game.phase === 'over') return;
  game.phase = 'between';
  stageAvatarEl(game.currentIdx)?.classList.remove('sing');
  updateHud();
  $('meter-wrap').classList.remove('live');
  const player = currentPlayer();
  const bonus = 100 * game.round;
  player.score += bonus;
  player.roundsCleared = game.round;
  updateHud();
  setStatus(`🎉 WOOOW! Det var "${game.songTitle}"! +${bonus} bonus`);
  AudioEngine.playCheer();
  AudioEngine.playApplause(1.6);
  cheerAll();
  spawnConfetti();

  // Uppspelning UTAN musik efter avklarad tur.
  setTimeout(() => {
    if (game.phase === 'over') return;
    setStatus(`Så här lät "${game.songTitle}", helt rent:`);
    game.melody.forEach((_, i) => setNoteState(i, null));
    playMelodyWithUI({
      withBeat: false,
      then: () => setTimeout(nextTurn, 1000),
    });
  }, 2000);
}

/* Spelaren missade för mycket och åker ut. */
function playerOut() {
  if (game.phase === 'over') return;
  const player = currentPlayer();
  player.alive = false;
  stageAvatarEl(game.currentIdx)?.classList.remove('sing');
  $('meter-wrap').classList.remove('live');
  AudioEngine.playAww();
  AudioEngine.playFailSound();
  renderStage();
  setStatus(`💀 ${player.name} åkte ut! Det var "${game.songTitle}".`);

  const alive = alivePlayers();
  const multi = game.players.length > 1;
  if ((multi && alive.length <= 1) || (!multi && alive.length === 0)) {
    setTimeout(endGame, 2000);
  } else {
    setTimeout(nextTurn, 2200);
  }
}

/* Spelet slut – visa vinnare/poängtavla. */
function endGame({ aborted = false } = {}) {
  if (game.phase === 'over') return;
  game.phase = 'over';
  if (game.cancelPlayback) { game.cancelPlayback(); game.cancelPlayback = null; }
  cancelAnimationFrame(game.pitchLoop);
  releaseWake();

  const multi = game.players.length > 1;
  const winner = !aborted && multi ? alivePlayers()[0] || null : null;

  // Rekord: bästa poängen i sällskapet
  const key = `singsong-best-${game.levelKey}`;
  const topScore = Math.max(...game.players.map((p) => p.score));
  const best = Math.max(topScore, Number(localStorage.getItem(key) || 0));
  localStorage.setItem(key, String(best));

  if (winner) {
    $('gameover-title').textContent = `${winner.name} VANN! 🏆`;
    $('gameover-reason').textContent = 'Sista sångfågeln kvar på scenen!';
    $('podium').hidden = false;
    $('podium').innerHTML = `<div class="avatar hop">${avatarSVG(avatarById(winner.avatarId), { withMic: true })}</div>`;
    AudioEngine.playCheer();
    AudioEngine.playApplause(2.2);
    spawnConfetti();
    setTimeout(spawnConfetti, 900);
  } else if (aborted) {
    $('gameover-title').textContent = 'AVSLUTAT';
    $('gameover-reason').textContent = 'Ni hoppade av – discot väntar på revansch!';
    $('podium').hidden = true;
  } else {
    $('gameover-title').textContent = 'DU ÅKTE UT!';
    $('gameover-reason').textContent = multi
      ? 'Alla åkte ut – discot vann den här gången!'
      : `Tonerna satt inte – det var "${game.songTitle}".`;
    $('podium').hidden = true;
  }

  const board = $('scoreboard');
  board.innerHTML = '';
  [...game.players]
    .sort((a, b) => b.score - a.score)
    .forEach((p) => {
      const row = document.createElement('div');
      row.className = 'score-row' + (winner && p === winner ? ' winner' : '');
      row.innerHTML = `${avatarSVG(avatarById(p.avatarId))}
        <span class="score-name">${escapeHtml(p.name)}</span>
        ${p.alive ? '' : '<span class="score-out">💀 utslagen</span>'}
        <span class="score-points">${p.score} p</span>`;
      board.appendChild(row);
    });

  $('res-level').textContent = game.level.label;
  $('res-rounds').textContent = Math.max(...game.players.map((p) => p.roundsCleared));
  $('res-best').textContent = best;
  showScreen('over');
}

/* ---------- Konfetti ---------- */
function spawnConfetti() {
  const colors = ['#ff3ec9', '#2ff3ff', '#ffd166', '#3ddc84', '#7b2ff7', '#fff'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
    c.style.animationDelay = `${Math.random() * 0.4}s`;
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }
}

/* ---------- Startskärm & knappar ---------- */
function showHighscores() {
  const parts = Object.entries(LEVELS)
    .map(([k, l]) => {
      const b = Number(localStorage.getItem(`singsong-best-${k}`) || 0);
      return b > 0 ? `${l.label}: ${b}` : null;
    })
    .filter(Boolean);
  $('highscore-text').textContent = parts.length ? `🏆 Rekord – ${parts.join('  ·  ')}` : '';
}

document.querySelectorAll('.level-card').forEach((btn) => {
  btn.addEventListener('click', () => startGame(btn.dataset.level));
});

$('btn-add-player').addEventListener('click', addPlayerFromForm);
$('player-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addPlayerFromForm();
});

$('btn-replay').addEventListener('click', () => {
  if (game.phase !== 'sing' || game.replaysLeft <= 0) return;
  game.replaysLeft--;
  cancelAnimationFrame(game.pitchLoop);
  const resumeIndex = game.noteIndex;
  game.phase = 'listen';
  updateHud();
  setStatus('Lyssna en gång till… 🎧');
  playMelodyWithUI({
    withBeat: false,
    then: () => {
      game.phase = 'sing';
      game.noteIndex = resumeIndex;
      updateHud();
      // Rita tillbaka hur det gått hittills och markera noten man står på
      game.results.forEach((r, i) => setNoteState(i, r));
      armNote();
    },
  });
});

$('btn-quit').addEventListener('click', () => endGame({ aborted: true }));
$('btn-retry').addEventListener('click', () => { showHighscores(); startGame(game.levelKey); });
$('btn-menu').addEventListener('click', () => {
  showHighscores();
  renderPlayerChips();
  renderAvatarGrid();
  showScreen('start');
});

loadParty();
renderAvatarGrid();
renderPlayerChips();
showHighscores();
