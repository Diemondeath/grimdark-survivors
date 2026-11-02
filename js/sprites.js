/** Sprite sheet loader + animator (whole-sprite frames, Unity-portable meta in data) */
const Sprites = (() => {
  const images = new Map();
  const ready = new Set();
  let failed = new Set();
  let loadPromise = null;

  function loadImage(src) {
    if (images.has(src)) return images.get(src);
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    images.set(src, img);
    img.onload = () => { ready.add(src); };
    img.onerror = () => { failed.add(src); console.error('[Sprites] failed', src); };
    return img;
  }

  function collectPaths() {
    const paths = new Set();
    const enemies = (window.DATA_ENEMIES && DATA_ENEMIES.floors) || {};
    for (const floor of Object.values(enemies)) {
      for (const key of ['swarm', 'charger', 'elite', 'boss']) {
        const def = floor[key];
        if (!def || !def.sprites) continue;
        for (const anim of Object.values(def.sprites.anims || {})) {
          if (anim && anim.sheet) paths.add(anim.sheet);
        }
        if (def.sprites.full) paths.add(def.sprites.full);
      }
    }
    const heroes = (window.DATA_HEROES && DATA_HEROES.races) || {};
    for (const race of Object.values(heroes)) {
      if (race.sprites && race.sprites.full) paths.add(race.sprites.full);
      if (race.sprites && race.sprites.anims) {
        for (const anim of Object.values(race.sprites.anims)) {
          if (anim && anim.sheet) paths.add(anim.sheet);
        }
      }
    }
    if (window.DATA_SPRITES) {
      for (const pack of Object.values(DATA_SPRITES)) {
        if (pack.full) paths.add(pack.full);
        if (pack.anims) {
          for (const anim of Object.values(pack.anims)) {
            if (anim.sheet) paths.add(anim.sheet);
          }
        }
      }
    }
    return [...paths];
  }

  function preload() {
    if (loadPromise) return loadPromise;
    const paths = collectPaths();
    paths.forEach(loadImage);
    loadPromise = Promise.all(paths.map((src) => new Promise((resolve) => {
      const img = images.get(src);
      if (img.complete && img.naturalWidth) { ready.add(src); resolve(); return; }
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    }))).then(() => {
      console.log('[Sprites] loaded', ready.size, '/', paths.length, 'failed', failed.size);
    });
    return loadPromise;
  }

  function get(src) {
    const img = images.get(src) || loadImage(src);
    if (!img.complete || !img.naturalWidth) return null;
    return img;
  }

  function isReady() {
    return ready.size > 0 && failed.size === 0;
  }

  /** Pick anim frame index from elapsed time */
  function frameIndex(anim, t, loop) {
    if (!anim || !anim.frames) return 0;
    const fps = anim.fps || 10;
    const idx = Math.floor(t * fps);
    if (loop === false) return Math.min(anim.frames - 1, Math.max(0, idx));
    return ((idx % anim.frames) + anim.frames) % anim.frames;
  }

  /**
   * Draw a whole-sprite sheet frame feet-anchored at (x,y).
   * facing < 0 flips horizontally. flash tints white.
   */
  function drawSheet(ctx, sprites, animName, animT, x, y, drawH, facing, flash, loop) {
    if (!sprites || !sprites.anims) return false;
    const anim = sprites.anims[animName] || sprites.anims.idle;
    if (!anim) return false;
    const img = get(anim.sheet);
    if (!img) return false;
    const fi = frameIndex(anim, animT, loop !== false && animName !== 'attack' && animName !== 'hit');
    const fw = anim.frameW, fh = anim.frameH;
    const sx = fi * fw;
    const scale = drawH / fh;
    const dw = fw * scale;
    const dh = drawH;
    ctx.save();
    ctx.translate(x, y);
    if (facing < 0) ctx.scale(-1, 1);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 2, dw * 0.28, Math.max(3, dh * 0.06), 0, 0, Math.PI * 2);
    ctx.fill();
    if (flash) {
      ctx.filter = 'brightness(2.2) saturate(0.3)';
    }
    ctx.drawImage(img, sx, 0, fw, fh, -dw / 2, -dh, dw, dh);
    ctx.filter = 'none';
    ctx.restore();
    return true;
  }

  /** Static full sprite (hero marine) */
  function drawFull(ctx, sprites, x, y, drawH, facing, flash) {
    if (!sprites || !sprites.full) return false;
    const img = get(sprites.full);
    if (!img) return false;
    const iw = sprites.fullSize ? sprites.fullSize[0] : img.naturalWidth;
    const ih = sprites.fullSize ? sprites.fullSize[1] : img.naturalHeight;
    const scale = drawH / ih;
    const dw = iw * scale;
    const dh = drawH;
    ctx.save();
    ctx.translate(x, y);
    if (facing < 0) ctx.scale(-1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 2, dw * 0.3, Math.max(3, dh * 0.07), 0, 0, Math.PI * 2);
    ctx.fill();
    if (flash) ctx.filter = 'brightness(2.2) saturate(0.3)';
    ctx.drawImage(img, -dw / 2, -dh, dw, dh);
    ctx.filter = 'none';
    ctx.restore();
    return true;
  }

  return { preload, get, isReady, drawSheet, drawFull, frameIndex, loadImage };
})();
