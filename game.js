/* ===== TonJakten – spellogik ===== */

/* ---------- Nivåer ---------- */
/* scale = MIDI-toner melodin byggs av. maxStep = max hopp i skalsteg.
   toleranceCents = hur nära man måste sjunga (oktav-oberoende).
   misses = tillåtna missar per runda. replays = "hör igen" per runda. */
const LEVELS = {
  latt: {
    label: 'Lätt',
    scale: [60, 62, 64, 67, 69, 72],       // C-dur pentatonisk
    startNotes: 3, maxStep: 1, noteMs: 700,
    toleranceCents: 75, misses: 2, replays: 2, beat: false,
  },
  medium: {
    label: 'Medium',
    scale: [60, 62, 64, 65, 67, 69, 71, 72], // C-durskalan
    startNotes: 4, maxStep: 2, noteMs: 600,
    toleranceCents: 60, misses: 1, replays: 1, beat: true,
  },
  svar: {
    label: 'Svår',
    scale: [60, 62, 64, 65, 67, 69, 71, 72, 74, 76], // C-dur upp till E5
    startNotes: 4, maxStep: 4, noteMs: 520,
    toleranceCents: 45, misses: 1, replays: 1, beat: true,
  },
  hardcore: {
    label: 'Hardcore 🔥',
    scale: Array.from({ length: 17 }, (_, i) => 60 + i), // kromatiskt C4–E5
    startNotes: 5, maxStep: 7, noteMs: 460,
    toleranceCents: 35, misses: 0, replays: 0, beat: true,
  },
};

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/* ---------- Speltillstånd ---------- */
const game = {
  levelKey: null,
  level: null,
  round: 1,
  score: 0,
  streak: 0,
  melody: [],
  noteIndex: 0,
  missesLeft: 0,
  replaysLeft: 0,
  phase: 'idle', // idle | listen | sing | between | over
  cancelPlayback: null,
  pitchLoop: null,
  frames: [],
  noteStartedAt: 0,
};

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
  melody.forEach((midi, i) => {
    const { step, sharp } = midiToStaff(midi);
    const x = STAFF.left + span * ((i + 0.5) / n);
    const y = staffY(step);

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'note');
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

/* ---------- Melodigenerator ---------- */
function generateMelody(level, round) {
  const len = level.startNotes + (round - 1);
  const scale = level.scale;
  const melody = [];
  let idx = Math.floor(scale.length / 2) + Math.floor(Math.random() * 3) - 1;
  idx = Math.max(0, Math.min(scale.length - 1, idx));

  for (let i = 0; i < len; i++) {
    melody.push(scale[idx]);
    let next = idx;
    let guard = 0;
    do {
      const step = Math.floor(Math.random() * (2 * level.maxStep + 1)) - level.maxStep;
      next = Math.max(0, Math.min(scale.length - 1, idx + step));
      guard++;
    } while (guard < 12 && (next === idx && Math.random() < 0.7)); // undvik för mycket tonupprepning
    idx = next;
  }
  return melody;
}

function roundTempo(level, round) {
  return Math.max(320, Math.round(level.noteMs * Math.pow(0.96, round - 1)));
}

/* ---------- HUD ---------- */
function updateHud() {
  $('hud-level').textContent = game.level.label;
  $('hud-round').textContent = game.round;
  $('hud-score').textContent = game.score;
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

/* ---------- Spelflöde ---------- */
async function startGame(levelKey) {
  AudioEngine.getCtx(); // skapa/väck AudioContext i klickgesten
  try {
    await PitchDetector.init();
  } catch (err) {
    const el = $('mic-error');
    el.hidden = false;
    el.textContent = '😕 Kunde inte nå mikrofonen. Tillåt mikrofon i webbläsaren och testa igen. (Appen måste köras via https eller localhost.)';
    return;
  }

  game.levelKey = levelKey;
  game.level = LEVELS[levelKey];
  game.phase = 'idle';
  game.round = 1;
  game.score = 0;
  game.streak = 0;
  showScreen('game');
  startRound();
}

function startRound() {
  if (game.phase === 'over') return;
  const lvl = game.level;
  game.melody = generateMelody(lvl, game.round);
  game.noteIndex = 0;
  game.missesLeft = lvl.misses;
  game.replaysLeft = lvl.replays;
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
  const target = game.melody[game.noteIndex];

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
    game.score += points;
    setNoteState(game.noteIndex, 'hit');
    setStatus(`✨ ${targetName}! +${points} poäng`);
    AudioEngine.playBlip(1320, 0.12, 0.2);
  } else {
    game.streak = 0;
    game.missesLeft--;
    setNoteState(game.noteIndex, 'miss');
    const why = sungMidi === null
      ? 'Ingen ton hördes 😶'
      : (cents > 0 ? `För högt! Det skulle vara ${targetName}` : `För lågt! Det skulle vara ${targetName}`);
    setStatus(`❌ ${why}`);
    AudioEngine.playBlip(180, 0.25, 0.3);
  }
  updateHud();

  if (!hit && game.missesLeft < 0) {
    setTimeout(() => gameOver('Tonerna satt inte den här gången.'), 900);
    return;
  }

  game.noteIndex++;
  if (game.noteIndex >= game.melody.length) {
    setTimeout(roundClear, 900);
  } else {
    setTimeout(() => armNote(), 1000);
  }
}

function roundClear() {
  if (game.phase === 'over') return;
  game.phase = 'between';
  updateHud();
  $('meter-wrap').classList.remove('live');
  const bonus = 100 * game.round;
  game.score += bonus;
  updateHud();
  setStatus(`🎉 Runda ${game.round} klarad! +${bonus} bonus – hör melodin igen, helt ren:`);
  AudioEngine.playSuccessJingle();
  spawnConfetti();

  // Uppspelning UTAN musik efter avklarad runda.
  setTimeout(() => {
    if (game.phase === 'over') return;
    game.melody.forEach((_, i) => setNoteState(i, null));
    playMelodyWithUI({
      withBeat: false,
      then: () => {
        game.round++;
        setTimeout(startRound, 1200);
      },
    });
  }, 1600);
}

function gameOver(reason) {
  if (game.phase === 'over') return;
  game.phase = 'over';
  if (game.cancelPlayback) { game.cancelPlayback(); game.cancelPlayback = null; }
  cancelAnimationFrame(game.pitchLoop);
  AudioEngine.playFailSound();

  const key = `tonjakten-best-${game.levelKey}`;
  const best = Math.max(game.score, Number(localStorage.getItem(key) || 0));
  localStorage.setItem(key, String(best));

  $('gameover-reason').textContent = reason;
  $('res-level').textContent = game.level.label;
  $('res-rounds').textContent = game.round - 1;
  $('res-score').textContent = game.score;
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
      const b = Number(localStorage.getItem(`tonjakten-best-${k}`) || 0);
      return b > 0 ? `${l.label}: ${b}` : null;
    })
    .filter(Boolean);
  $('highscore-text').textContent = parts.length ? `🏆 Rekord – ${parts.join('  ·  ')}` : '';
}

document.querySelectorAll('.level-card').forEach((btn) => {
  btn.addEventListener('click', () => startGame(btn.dataset.level));
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
      // Återställ markeringen på noten man står på
      armNote();
    },
  });
});

$('btn-quit').addEventListener('click', () => gameOver('Du hoppade av – discot väntar på revansch!'));
$('btn-retry').addEventListener('click', () => { showHighscores(); startGame(game.levelKey); });
$('btn-menu').addEventListener('click', () => { showHighscores(); showScreen('start'); });

showHighscores();
