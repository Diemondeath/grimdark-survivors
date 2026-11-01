/** WebAudio synthesis SFX — no external assets */
const SFX = (() => {
  let ctx = null, master = null, enabled = true;
  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  function beep(freq, dur, type, vol, slide) {
    if (!enabled) return;
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    if (!enabled) return;
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    const n = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource();
    const g = ctx.createGain();
    s.buffer = buf;
    g.gain.value = vol || 0.12;
    s.connect(g); g.connect(master);
    s.start();
  }
  return {
    setEnabled(v) { enabled = v; },
    resume() { ensure(); if (ctx.state === 'suspended') ctx.resume(); },
    shoot() { beep(220, 0.05, 'square', 0.08, 90); },
    hit() { beep(140, 0.04, 'sawtooth', 0.1, 60); },
    explode() { noise(0.18, 0.18); beep(80, 0.15, 'triangle', 0.12, 40); },
    levelup() { beep(440, 0.08, 'sine', 0.12); setTimeout(() => beep(660, 0.1, 'sine', 0.12), 80); },
    pickup() { beep(660, 0.06, 'sine', 0.1, 990); },
    hurt() { beep(90, 0.12, 'sawtooth', 0.16, 50); noise(0.08, 0.1); },
    jump() { beep(180, 0.2, 'triangle', 0.14, 320); },
    slam() { noise(0.22, 0.2); beep(60, 0.2, 'sine', 0.15, 30); },
    ui() { beep(520, 0.04, 'sine', 0.08); },
    win() { beep(523, 0.12, 'sine', 0.12); setTimeout(() => beep(659, 0.12, 'sine', 0.12), 120); setTimeout(() => beep(784, 0.2, 'sine', 0.14), 240); },
    death() { beep(200, 0.3, 'sawtooth', 0.15, 40); noise(0.3, 0.15); }
  };
})();
