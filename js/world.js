/** Arena generation, obstacles, objectives */
const World = (() => {
  const SCREEN = 360; // world units per "screen"

  function generate(floorDef, seed) {
    const rng = mulberry32(seed || (Date.now() & 0xffff));
    const W = floorDef.arenaW * SCREEN;
    const H = floorDef.arenaH * SCREEN;
    const obstacles = [];
    // border walls as thick obstacles? use bounds instead
    const templates = ['cross', 'rooms', 'columns', 'maze'];
    const tpl = templates[(rng() * templates.length) | 0];

    if (tpl === 'cross') {
      addRect(obstacles, W * 0.45, H * 0.2, 40, H * 0.6);
      addRect(obstacles, W * 0.2, H * 0.45, W * 0.6, 40);
      // gaps
      obstacles.length = 0;
      // segmented cross
      for (let i = 0; i < 3; i++) {
        addRect(obstacles, W * 0.48, H * (0.15 + i * 0.28), 36, 60);
        addRect(obstacles, W * (0.15 + i * 0.28), H * 0.48, 60, 36);
      }
    } else if (tpl === 'rooms') {
      for (let i = 0; i < 8; i++) {
        const x = 80 + rng() * (W - 200);
        const y = 80 + rng() * (H - 200);
        addRect(obstacles, x, y, 40 + rng() * 50, 40 + rng() * 50);
      }
    } else if (tpl === 'columns') {
      for (let i = 0; i < 14; i++) {
        addRect(obstacles, 100 + rng() * (W - 200), 100 + rng() * (H - 200), 28, 28);
      }
    } else {
      for (let i = 0; i < 10; i++) {
        addRect(obstacles, 60 + rng() * (W - 160), 60 + rng() * (H - 160), 50 + rng() * 40, 24);
      }
    }

    // objectives in different thirds
    const zones = [
      { x: W * 0.2, y: H * 0.25 },
      { x: W * 0.75, y: H * 0.4 },
      { x: W * 0.45, y: H * 0.78 }
    ];
    shuffle(zones, rng);
    const objectives = [];
    const types = floorDef.objectives.slice();
    for (let i = 0; i < 3; i++) {
      const t = types[i];
      const z = zones[i];
      const pos = findClear(z.x, z.y, obstacles, W, H, rng);
      if (t === 'capture') {
        objectives.push({ type: 'capture', x: pos.x, y: pos.y, r: 55, progress: 0, done: false, duration: DATA_OBJECTIVES.capture.duration });
      } else if (t === 'elite') {
        objectives.push({ type: 'elite', x: pos.x, y: pos.y, done: false, spawned: false });
      } else if (t === 'nest') {
        objectives.push({ type: 'nest', x: pos.x, y: pos.y, hp: DATA_OBJECTIVES.nest.hp, maxHp: DATA_OBJECTIVES.nest.hp, r: 28, done: false });
      }
    }

    // 4 altars
    const altars = [];
    const altarDefs = DATA_ALTARS.slice();
    shuffle(altarDefs, rng);
    for (let i = 0; i < 4; i++) {
      const ax = 120 + rng() * (W - 240);
      const ay = 120 + rng() * (H - 240);
      const pos = findClear(ax, ay, obstacles, W, H, rng);
      // keep away from objectives
      altars.push({ ...altarDefs[i], x: pos.x, y: pos.y, used: false, r: 30 });
    }

    return {
      w: W, h: H, obstacles, objectives, altars,
      lift: null, template: tpl, seed
    };
  }

  function addRect(arr, x, y, w, h) {
    // store as top-left AABB; draw uses center
    arr.push({ x, y, w, h, hw: w / 2, hh: h / 2, cx: x + w / 2, cy: y + h / 2 });
  }

  function findClear(x, y, obs, W, H, rng) {
    for (let tries = 0; tries < 40; tries++) {
      const px = clamp(x + (rng() - 0.5) * 80, 80, W - 80);
      const py = clamp(y + (rng() - 0.5) * 80, 80, H - 80);
      if (!hitsObstacle(px, py, 24, obs)) return { x: px, y: py };
    }
    return { x: clamp(x, 80, W - 80), y: clamp(y, 80, H - 80) };
  }

  function hitsObstacle(x, y, r, obs) {
    for (const o of obs) {
      const dx = Math.abs(x - (o.x + o.hw)) - o.hw;
      const dy = Math.abs(y - (o.y + o.hh)) - o.hh;
      const cx = Math.max(dx, 0), cy = Math.max(dy, 0);
      // treat o.x,o.y as top-left
      const nearestX = clamp(x, o.x, o.x + o.w);
      const nearestY = clamp(y, o.y, o.y + o.h);
      const ddx = x - nearestX, ddy = y - nearestY;
      if (ddx * ddx + ddy * ddy < r * r) return true;
    }
    return false;
  }

  function resolveCircle(x, y, r, obs, bounds) {
    // push out of obstacles AABB
    for (const o of obs) {
      const nearestX = clamp(x, o.x, o.x + o.w);
      const nearestY = clamp(y, o.y, o.y + o.h);
      let ddx = x - nearestX, ddy = y - nearestY;
      let d2 = ddx * ddx + ddy * ddy;
      if (d2 < r * r) {
        if (d2 < 0.0001) { ddx = 1; ddy = 0; d2 = 1; }
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += ddx * push;
        y += ddy * push;
      }
    }
    x = clamp(x, r, bounds.w - r);
    y = clamp(y, r, bounds.h - r);
    return { x, y };
  }

  function segmentHitsObstacle(x0, y0, x1, y1, obs) {
    for (const o of obs) {
      if (segAabb(x0, y0, x1, y1, o.x, o.y, o.x + o.w, o.y + o.h)) return true;
    }
    return false;
  }

  function segAabb(x0, y0, x1, y1, minX, minY, maxX, maxY) {
    // Liang-Barsky-ish
    let dx = x1 - x0, dy = y1 - y0;
    let t0 = 0, t1 = 1;
    const clip = (p, q) => {
      if (Math.abs(p) < 1e-8) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    if (!clip(-dx, x0 - minX)) return false;
    if (!clip(dx, maxX - x0)) return false;
    if (!clip(-dy, y0 - minY)) return false;
    if (!clip(dy, maxY - y0)) return false;
    return t0 < t1 && t0 < 1 && t1 > 0;
  }

  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, rng) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  return { generate, hitsObstacle, resolveCircle, segmentHitsObstacle, SCREEN, clamp };
})();
