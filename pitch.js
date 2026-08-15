/* ===== Sing Song – tonhöjdsdetektering via mikrofon ===== */
/* Autokorrelation (ACF2+) på tidsdomänsbufferten från en AnalyserNode. */

const PitchDetector = (() => {
  let analyser = null;
  let mediaStream = null;
  let buf = null;

  async function init() {
    if (analyser) return;
    const ac = AudioEngine.getCtx();
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const src = ac.createMediaStreamSource(mediaStream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    buf = new Float32Array(analyser.fftSize);
  }

  function stop() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    analyser = null;
  }

  /* Returnerar frekvens i Hz, eller -1 om ingen tydlig ton hörs. */
  function autoCorrelate(buffer, sampleRate) {
    let SIZE = buffer.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.015) return -1; // för tyst

    // Trimma tysta kanter för stabilare korrelation.
    const thres = 0.2;
    let r1 = 0, r2 = SIZE - 1;
    for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    const b = buffer.slice(r1, r2);
    SIZE = b.length;
    if (SIZE < 64) return -1;

    const c = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
      let sum = 0;
      for (let j = 0; j < SIZE - i; j++) sum += b[j] * b[j + i];
      c[i] = sum;
    }

    let d = 0;
    while (d < SIZE - 1 && c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
      if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    if (maxpos <= 0) return -1;
    let T0 = maxpos;

    // Parabolisk interpolation kring toppen.
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    if (x3 !== undefined) {
      const a = (x1 + x3 - 2 * x2) / 2;
      const bb = (x3 - x1) / 2;
      if (a) T0 = T0 - bb / (2 * a);
    }

    const freq = sampleRate / T0;
    if (freq < 60 || freq > 1600) return -1; // utanför sångröst-området
    return freq;
  }

  /* Läser en frame och returnerar { freq, midi } eller null. */
  function getPitch() {
    if (!analyser) return null;
    const ac = AudioEngine.getCtx();
    analyser.getFloatTimeDomainData(buf);
    const freq = autoCorrelate(buf, ac.sampleRate);
    if (freq < 0) return null;
    const midi = 69 + 12 * Math.log2(freq / 440);
    return { freq, midi };
  }

  return { init, stop, getPitch, get ready() { return !!analyser; } };
})();
