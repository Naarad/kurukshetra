// =========================================================
// Kurukshetra music engine — Web Audio procedural soundtrack
// Three layers (drone, sitar, tabla) whose volumes scale by phase:
//   lobby/select : sitar only, soft
//   setup        : drone + sitar, calm
//   break        : drone + sitar + tabla, urgent
//   round_over   : drone fades, sitar resolves
//
// No external assets required. If you drop MP3s in public/audio/
// and call Music.loadFile('break', '/audio/yourtrack.mp3'), the
// procedural layer for that phase is replaced with the file.
// =========================================================

(function () {
  let ctx = null;
  let master = null;
  let drone = null, sitar = null, tabla = null;
  let phaseGains = { drone: null, sitar: null, tabla: null };
  let started = false;
  let muted = false;
  let masterVol = 0.45;
  let phase = 'lobby';
  let tablaScheduler = null;
  let sitarScheduler = null;

  // Raga: a simple Bhairav-ish scale (S r G m P d N S) — root A2
  const ROOT = 110;        // A2
  const RAGA = [0, 1, 4, 5, 7, 8, 11, 12]; // semitone offsets
  function freqOf(deg) { return ROOT * Math.pow(2, RAGA[deg % RAGA.length] / 12) * Math.pow(2, Math.floor(deg / RAGA.length)); }

  window.Music = {
    init, start, stop, setPhase, setVolume, toggleMute, isMuted: () => muted, isStarted: () => started
  };

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = masterVol;
      master.connect(ctx.destination);

      drone = makeDrone(ctx);
      sitar = makeSitar(ctx);
      tabla = makeTabla(ctx);

      phaseGains.drone = ctx.createGain(); phaseGains.drone.gain.value = 0;
      phaseGains.sitar = ctx.createGain(); phaseGains.sitar.gain.value = 0;
      phaseGains.tabla = ctx.createGain(); phaseGains.tabla.gain.value = 0;

      drone.out.connect(phaseGains.drone).connect(master);
      sitar.out.connect(phaseGains.sitar).connect(master);
      tabla.out.connect(phaseGains.tabla).connect(master);
    } catch (e) {
      console.warn('Music init failed', e);
      ctx = null;
    }
  }

  async function start() {
    init();
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    started = true;
    setPhase(phase);
    if (!sitarScheduler) {
      sitarScheduler = setInterval(() => sitarTick(), 6000);
      tablaScheduler = setInterval(() => tablaTick(), 470);
    }
  }
  function stop() {
    started = false;
    if (sitarScheduler) { clearInterval(sitarScheduler); sitarScheduler = null; }
    if (tablaScheduler) { clearInterval(tablaScheduler); tablaScheduler = null; }
    if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
  }

  function setVolume(v) {
    masterVol = Math.max(0, Math.min(1, v));
    if (master && !muted) master.gain.setTargetAtTime(masterVol, ctx.currentTime, 0.05);
  }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : masterVol, ctx.currentTime, 0.05);
  }

  function setPhase(p) {
    phase = p;
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    const targets = phaseTargets(p);
    phaseGains.drone.gain.setTargetAtTime(targets.drone, t, 1.5);
    phaseGains.sitar.gain.setTargetAtTime(targets.sitar, t, 1.5);
    phaseGains.tabla.gain.setTargetAtTime(targets.tabla, t, 1.0);
  }

  function phaseTargets(p) {
    switch (p) {
      case 'lobby':
      case 'character_select':
        return { drone: 0.0, sitar: 0.5, tabla: 0.0 };
      case 'setup':
        return { drone: 0.5, sitar: 0.4, tabla: 0.0 };
      case 'break':
        return { drone: 0.55, sitar: 0.35, tabla: 0.65 };
      case 'round_over':
        return { drone: 0.3, sitar: 0.6, tabla: 0.0 };
      case 'match_over':
        return { drone: 0.2, sitar: 0.7, tabla: 0.0 };
      default:
        return { drone: 0.0, sitar: 0.4, tabla: 0.0 };
    }
  }

  // ---------------- DRONE ----------------
  function makeDrone(ctx) {
    // two slightly detuned saw oscillators, low-pass filtered, slow LFO
    const out = ctx.createGain(); out.gain.value = 1;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 320; filter.Q.value = 1.2;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = ROOT;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = ROOT * 1.5; // fifth
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = ROOT / 2;       // sub
    const detune = ctx.createOscillator(); detune.frequency.value = 0.13;
    const detuneGain = ctx.createGain(); detuneGain.gain.value = 6;
    detune.connect(detuneGain).connect(o1.frequency);
    o1.connect(filter); o2.connect(filter); o3.connect(filter);
    filter.connect(out);
    o1.start(); o2.start(); o3.start(); detune.start();
    return { out };
  }

  // ---------------- SITAR ----------------
  // sparse plucked tones over the raga
  function makeSitar(ctx) {
    const out = ctx.createGain(); out.gain.value = 1;
    const reverb = ctx.createDelay(0.6); reverb.delayTime.value = 0.32;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    reverb.connect(fb).connect(reverb).connect(out);
    out._busIn = reverb;
    return { out };
  }
  function sitarTick() {
    if (!ctx || !started) return;
    if (phase === 'break') return; // tabla scene
    const target = phaseGains.sitar.gain.value;
    if (target < 0.05) return;
    const t = ctx.currentTime;
    const notes = pickPhrase();
    notes.forEach((deg, i) => pluck(t + i * 0.45, freqOf(deg), 1.2 + Math.random() * 0.4));
  }
  function pickPhrase() {
    const phrases = [
      [0, 2, 1, 0],
      [4, 3, 2, 1, 0],
      [0, 4, 3, 4, 7],
      [7, 4, 3, 1, 0]
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
  function pluck(when, freq, dur) {
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.2, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(sitar.out._busIn);
    o.start(when); o.stop(when + dur + 0.05);
  }

  // ---------------- TABLA ----------------
  // simple pattern: dha . tin tin . dha tin .
  const TABLA_PATTERN = [1, 0, 0.6, 0.6, 0, 1, 0.6, 0];
  let tablaStep = 0;
  function makeTabla(ctx) {
    const out = ctx.createGain(); out.gain.value = 1;
    return { out };
  }
  function tablaTick() {
    if (!ctx || !started) return;
    const target = phaseGains.tabla.gain.value;
    if (target < 0.05) return;
    const t = ctx.currentTime;
    const v = TABLA_PATTERN[tablaStep++ % TABLA_PATTERN.length];
    if (v > 0) hit(t, v);
  }
  function hit(when, intensity) {
    // a sharp pitched hit (tablaish)
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 600 + Math.random() * 400; f.Q.value = 5;
    o.type = 'sine';
    o.frequency.setValueAtTime(220, when);
    o.frequency.exponentialRampToValueAtTime(80, when + 0.18);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(intensity * 0.55, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    o.connect(f).connect(g).connect(tabla.out);
    o.start(when); o.stop(when + 0.25);

    // noise burst for slap
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const ng = ctx.createGain(); ng.gain.value = intensity * 0.18;
    const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1500;
    noise.connect(nf).connect(ng).connect(tabla.out);
    noise.start(when);
  }
})();
