/* ===== Sing Song – ljudmotor (Web Audio) ===== */
/* Spelar upp melodier med ett keyboard-liknande syntljud och en valfri discotakt. */

const AudioEngine = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* Ett mjukt e-piano/keyboard-ljud: triangel + oktavsinus genom lågpass. */
  function playNote(midi, when, dur, volume = 0.5) {
    const ac = getCtx();
    const freq = midiToFreq(midi);
    const t = when;

    const master = ac.createGain();
    master.gain.value = 0;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(freq * 6, 9000);
    master.connect(lp).connect(ac.destination);

    const o1 = ac.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = freq;

    const o2 = ac.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    const g2 = ac.createGain();
    g2.gain.value = 0.28;

    o1.connect(master);
    o2.connect(g2).connect(master);

    const peak = volume;
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(peak, t + 0.015);
    master.gain.exponentialRampToValueAtTime(peak * 0.55, t + 0.18);
    master.gain.setValueAtTime(peak * 0.55, t + dur - 0.1);
    master.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.15);

    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
  }

  function playKick(when) {
    const ac = getCtx();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(48, when + 0.12);
    g.gain.setValueAtTime(0.5, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.16);
    o.connect(g).connect(ac.destination);
    o.start(when); o.stop(when + 0.2);
  }

  function playHat(when) {
    const ac = getCtx();
    const len = Math.floor(ac.sampleRate * 0.05);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ac.createGain();
    g.gain.value = 0.12;
    src.connect(hp).connect(g).connect(ac.destination);
    src.start(when);
  }

  /* Kort "blipp" för nedräkning och feedback. */
  function playBlip(freq = 880, dur = 0.1, volume = 0.25) {
    const ac = getCtx();
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function playSuccessJingle() {
    const ac = getCtx();
    const t = ac.currentTime;
    [72, 76, 79, 84].forEach((m, i) => playNote(m, t + i * 0.12, 0.25, 0.35));
  }

  function playFailSound() {
    const ac = getCtx();
    const t = ac.currentTime;
    [50, 44].forEach((m, i) => playNote(m, t + i * 0.28, 0.45, 0.4));
  }

  function noiseBuffer(seconds) {
    const ac = getCtx();
    const len = Math.max(1, Math.floor(ac.sampleRate * seconds));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* Publikens "WOOOW!" – körade sågtandsröster med formantsvep + jubelbrus. */
  function playCheer() {
    const ac = getCtx();
    const t = ac.currentTime;

    for (let v = 0; v < 5; v++) {
      const base = 130 + v * 35 + Math.random() * 12;
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 0.8, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.7, t + 0.35);
      o.frequency.exponentialRampToValueAtTime(base * 0.85, t + 1.0);

      const formant = ac.createBiquadFilter();
      formant.type = 'bandpass';
      formant.Q.value = 2.2;
      formant.frequency.setValueAtTime(380, t);            // "w–oo"
      formant.frequency.exponentialRampToValueAtTime(950, t + 0.4); // "–ooo"
      formant.frequency.exponentialRampToValueAtTime(480, t + 1.0); // "–ow"

      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.08 + v * 0.02);
      g.gain.setValueAtTime(0.09, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.15);

      o.connect(formant).connect(g).connect(ac.destination);
      o.start(t); o.stop(t + 1.2);
    }

    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(1.4);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.7;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    src.connect(bp).connect(g).connect(ac.destination);
    src.start(t);
  }

  /* Applåder – många korta bruspuffar, tätast i början. */
  function playApplause(seconds = 1.5) {
    const ac = getCtx();
    const t = ac.currentTime;
    const claps = Math.floor(seconds * 34);
    for (let i = 0; i < claps; i++) {
      const when = t + Math.pow(Math.random(), 0.7) * seconds;
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer(0.025);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500 + Math.random() * 1500;
      bp.Q.value = 1.4;
      const g = ac.createGain();
      const fade = 1 - (when - t) / (seconds * 1.15);
      g.gain.value = (0.05 + Math.random() * 0.09) * Math.max(0.2, fade);
      src.connect(bp).connect(g).connect(ac.destination);
      src.start(when);
    }
  }

  /* Publikens besvikna "aaaw..." – fallande röster. */
  function playAww() {
    const ac = getCtx();
    const t = ac.currentTime;
    for (let v = 0; v < 4; v++) {
      const base = 230 + v * 28 + Math.random() * 10;
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 1.0);

      const formant = ac.createBiquadFilter();
      formant.type = 'bandpass';
      formant.Q.value = 1.8;
      formant.frequency.setValueAtTime(820, t);   // "aa–"
      formant.frequency.exponentialRampToValueAtTime(420, t + 1.0); // "–ww"

      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.1);
      g.gain.setValueAtTime(0.07, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

      o.connect(formant).connect(g).connect(ac.destination);
      o.start(t); o.stop(t + 1.15);
    }
  }

  /**
   * Spelar upp en melodi med rytm. notes = [{ midi, beats }], beatMs = ms per
   * taktslag. onNote(i) anropas när not i börjar ljuda, onDone() när allt är
   * klart. withBeat lägger en discotakt under.
   */
  function playMelody(notes, beatMs, { withBeat = false, onNote = null, onDone = null } = {}) {
    const ac = getCtx();
    const start = ac.currentTime + 0.15;
    const beatSec = beatMs / 1000;

    const starts = [];
    let t = 0;
    notes.forEach((n) => {
      starts.push(t);
      playNote(n.midi, start + t, Math.max(0.18, n.beats * beatSec * 0.92));
      t += n.beats * beatSec;
    });
    const total = t;

    if (withBeat) {
      const step = Math.max(beatSec, 0.3);
      for (let b = 0; b < total + 0.01; b += step) {
        playKick(start + b);
        playHat(start + b + step / 2);
      }
    }

    /* UI-synk via timeouts relativt AudioContext-klockan. */
    const timers = [];
    starts.forEach((s, i) => {
      const delay = (start + s - ac.currentTime) * 1000;
      if (onNote) timers.push(setTimeout(() => onNote(i), Math.max(0, delay)));
    });
    const endDelay = (start + total - ac.currentTime) * 1000 + 150;
    timers.push(setTimeout(() => { if (onDone) onDone(); }, endDelay));

    return () => timers.forEach(clearTimeout); // avbryt-funktion
  }

  return {
    getCtx, midiToFreq, playNote, playMelody, playBlip,
    playSuccessJingle, playFailSound, playCheer, playApplause, playAww,
  };
})();
