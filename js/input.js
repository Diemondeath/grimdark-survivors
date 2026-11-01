/** Floating joystick (left half) + ability button + WASD/arrows/Space */
const Input = (() => {
  const keys = Object.create(null);
  let joyActive = false, joyId = null;
  let joyOrigin = { x: 0, y: 0 };
  let joyVec = { x: 0, y: 0 };
  let abilityPressed = false, abilityHeld = false;
  let abilityBtn = { x: 0, y: 0, r: 44 };
  let canvas = null, portrait = false;
  let firstTapDone = false;

  function setCanvas(c) { canvas = c; layout(); }
  function layout() {
    if (!canvas) return;
    abilityBtn.x = canvas.clientWidth - 70;
    abilityBtn.y = canvas.clientHeight - 70;
    abilityBtn.r = Math.max(40, Math.min(56, canvas.clientWidth * 0.07));
  }
  function isPortrait() {
    return window.innerHeight > window.innerWidth;
  }
  function tryLockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) {}
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }

  function onKey(e, down) {
    keys[e.code] = down;
    if (down && (e.code === 'Space' || e.code === 'KeyE')) {
      abilityPressed = true;
      abilityHeld = true;
      e.preventDefault();
    }
    if (!down && (e.code === 'Space' || e.code === 'KeyE')) abilityHeld = false;
  }

  function touchPos(t) {
    const r = canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function onPointerDown(e) {
    if (!firstTapDone) {
      firstTapDone = true;
      tryLockLandscape();
      SFX.resume();
    }
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const id = e.pointerId;
    const p = { x: e.offsetX, y: e.offsetY };
    // ability button
    const dx = p.x - abilityBtn.x, dy = p.y - abilityBtn.y;
    if (dx * dx + dy * dy <= abilityBtn.r * abilityBtn.r) {
      abilityPressed = true;
      abilityHeld = true;
      try { canvas.setPointerCapture(id); } catch (_) {}
      e.preventDefault();
      return;
    }
    // left half = joystick
    if (p.x < canvas.clientWidth * 0.55) {
      joyActive = true;
      joyId = id;
      joyOrigin.x = p.x;
      joyOrigin.y = p.y;
      joyVec.x = 0; joyVec.y = 0;
      try { canvas.setPointerCapture(id); } catch (_) {}
      e.preventDefault();
    }
  }
  function onPointerMove(e) {
    if (!joyActive || e.pointerId !== joyId) return;
    const p = { x: e.offsetX, y: e.offsetY };
    let dx = p.x - joyOrigin.x, dy = p.y - joyOrigin.y;
    const max = 54;
    const len = Math.hypot(dx, dy) || 1;
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    joyVec.x = dx / max;
    joyVec.y = dy / max;
  }
  function onPointerUp(e) {
    if (e.pointerId === joyId) {
      joyActive = false; joyId = null;
      joyVec.x = 0; joyVec.y = 0;
    }
    abilityHeld = false;
  }

  window.addEventListener('keydown', e => onKey(e, true));
  window.addEventListener('keyup', e => onKey(e, false));

  function bind(c) {
    setCanvas(c);
    c.addEventListener('pointerdown', onPointerDown);
    c.addEventListener('pointermove', onPointerMove);
    c.addEventListener('pointerup', onPointerUp);
    c.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', () => setTimeout(layout, 100));
  }

  function moveAxis() {
    let x = joyVec.x, y = joyVec.y;
    if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) x += 1;
    if (keys['KeyW'] || keys['ArrowUp']) y -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  function consumeAbility() {
    if (abilityPressed) { abilityPressed = false; return true; }
    return false;
  }

  return {
    bind, layout, moveAxis, consumeAbility,
    get abilityHeld() { return abilityHeld; },
    get joyActive() { return joyActive; },
    get joyOrigin() { return joyOrigin; },
    get joyVec() { return joyVec; },
    get abilityBtn() { return abilityBtn; },
    isPortrait, tryLockLandscape,
    get firstTapDone() { return firstTapDone; }
  };
})();
