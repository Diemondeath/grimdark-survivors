/** Grimdark Survivors — main game state & loop */
const Game = (() => {
  const ISO_SCALE = 0.85;
  const STATE = { MENU: 'menu', HERO: 'hero', PLAY: 'play', CHOICE: 'choice', PAUSE: 'pause', DEAD: 'dead', WIN: 'win', ALTAR: 'altar' };

  let canvas, ctx;
  let state = STATE.MENU;
  let heroVar = null;
  let hero = null;
  let loadout = null;
  let world = null;
  let floorIdx = 0;
  let cam = { x: 0, y: 0 };
  let grid = new SpatialGrid(96);
  let qtmp = [];

  // pools
  let enemies, bullets, pickups, pools, fx, ebullets;
  let drones = [];

  let waveT = 0, waveN = 0, aggression = 1;
  let kills = 0, timer = 0, xp = 0, level = 1, xpToNext = 20;
  let passiveUsed = false;
  let vibrateOn = true, dmgNumOn = true;
  let choiceKind = null; // 'item' | 'upgrade' | 'relic'
  let choices = [];
  let altarPending = null;
  let bossSpawned = false;
  let pausedBuild = false;
  let itemPanelOpen = false;
  let lastTs = 0;
  let stats = { damageDealt: 0, timeAlive: 0 };
  let orbitAngle = 0;
  let fireTrailT = 0;
  let portraitOverlay = false;

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d');
    Input.bind(c);
    resize();
    window.addEventListener('resize', resize);
    enemies = new Pool(() => ({}), resetEnemy, 256);
    bullets = new Pool(() => ({}), resetBullet, 256);
    ebullets = new Pool(() => ({}), resetBullet, 64);
    pickups = new Pool(() => ({}), resetPickup, 128);
    pools = new Pool(() => ({}), resetPool, 64);
    fx = new Pool(() => ({}), resetFx, 64);
    requestAnimationFrame(frame);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = (w * dpr) | 0;
    canvas.height = (h * dpr) | 0;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Input.layout();
    portraitOverlay = Input.isPortrait();
  }

  function resetEnemy(e, def, x, y, eliteType) {
    Object.assign(e, def);
    e.x = x; e.y = y;
    e.maxHp = def.hp; e.hp = def.hp;
    e.flash = 0; e.cd = 0; e.vx = 0; e.vy = 0;
    e.burnT = 0; e.burnDps = 0;
    e.eliteType = eliteType || null;
    e.shield = 0; e.shieldMax = 0;
    if (eliteType && DATA_ENEMIES.elites[eliteType]) {
      const el = DATA_ENEMIES.elites[eliteType];
      e.maxHp = e.hp = def.hp * el.hpMul;
      e.speed = def.speed * (el.speedMul || 1);
      if (el.shield) { e.shieldMax = e.maxHp * el.shield; e.shield = e.shieldMax; }
      e.color = el.colorMul;
      e.isElite = e.isElite || true;
    }
    e.hitPlayerCd = 0;
  }
  function resetBullet(b, x, y, vx, vy, dmg, opts) {
    b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    b.dmg = dmg; b.life = 1.8; b.size = (opts && opts.size) || 5;
    b.pierce = (opts && opts.pierce) || 0;
    b.ricochet = (opts && opts.ricochet) || 0;
    b.homing = (opts && opts.homing) || 0;
    b.burn = (opts && opts.burn) || 0;
    b.explode = (opts && opts.explode) || 0;
    b.chain = (opts && opts.chain) || 0;
    b.poison = (opts && opts.poison) || 0;
    b.bloodheal = (opts && opts.bloodheal) || 0;
    b.lifesteal = (opts && opts.lifesteal) || 0;
    b.holy = (opts && opts.holy) || false;
    b.color = (opts && opts.color) || '#fc6';
    b.fromPlayer = !opts || opts.fromPlayer !== false;
    b.hitSet = null;
  }
  function resetPickup(p, x, y, type, val) {
    p.x = x; p.y = y; p.type = type; p.val = val || 1; p.t = 0; p.rare = !!val && type === 'chest' && val > 1;
  }
  function resetPool(p, x, y, r, color, dps, heal, life) {
    p.x = x; p.y = y; p.r = r; p.color = color; p.dps = dps || 0; p.heal = heal || 0; p.life = life || 4;
  }
  function resetFx(f, x, y, kind, life) {
    f.x = x; f.y = y; f.kind = kind; f.life = life || 0.3; f.t = f.life; f.r = 20;
  }

  function startRun(variantId) {
    heroVar = DATA_HEROES.variants.find(v => v.id === variantId);
    if (!heroVar || heroVar.locked) return;
    const race = DATA_HEROES.races[heroVar.race];
    floorIdx = 0;
    loadout = createLoadout();
    kills = 0; timer = 0; xp = 0; level = 1; xpToNext = 20;
    stats = { damageDealt: 0, timeAlive: 0 };
    beginFloor();
    state = STATE.PLAY;
    SFX.ui();
  }

  function beginFloor() {
    const fd = DATA_FLOORS[floorIdx];
    world = World.generate(fd, (Math.random() * 1e9) | 0);
    const pal = heroVar.palette.floor[floorIdx + 1];
    world.palette = pal;
    aggression = fd.aggressionBase;
    waveT = 1; waveN = 0; bossSpawned = false; passiveUsed = false;
    enemies.clear(); bullets.clear(); ebullets.clear(); pickups.clear(); pools.clear(); fx.clear();
    drones = [];
    const cx = world.w * 0.5, cy = world.h * 0.5;
    hero = {
      x: cx, y: cy, r: 14,
      hp: heroVar.stats.hp + loadout.stats.maxHpAdd,
      maxHp: Math.floor((heroVar.stats.hp + loadout.stats.maxHpAdd) * loadout.stats.maxHpMul),
      facing: 1, flash: 0,
      fireCd: 0, burstLeft: 0, burstCd: 0,
      activeCd: 0, leaping: false, leapT: 0, leapVx: 0, leapVy: 0,
      invuln: 0, speed: heroVar.stats.speed,
      damage: heroVar.stats.damage,
      fireRate: heroVar.stats.fireRate,
      palette: heroVar.palette
    };
    hero.hp = hero.maxHp;
    // spawn objective elites later when near / on start
    for (const o of world.objectives) {
      if (o.type === 'elite') {
        const ed = DATA_ENEMIES.floors[floorIdx + 1].elite;
        const e = enemies.alloc(ed, o.x, o.y, null);
        e.objectiveElite = true;
        o.spawned = true;
        o.enemyRef = e;
      }
    }
    // drones from items
    syncDrones();
  }

  function syncDrones() {
    const n = loadout.mods.drone | 0;
    while (drones.length < n) drones.push({ angle: Math.random() * Math.PI * 2, fireCd: 0 });
    drones.length = n;
  }

  function xpForLevel(lv) { return 16 + lv * 10; }

  function addXp(n) {
    xp += n;
    while (xp >= xpToNext) {
      xp -= xpToNext;
      level++;
      xpToNext = xpForLevel(level);
      openChoice('upgrade');
      SFX.levelup();
    }
  }

  function openChoice(kind) {
    choiceKind = kind;
    const n = 3 + (loadout.stats.extraChoice | 0);
    if (kind === 'item') {
      choices = pickChoices(DATA_ITEMS, n);
    } else if (kind === 'upgrade') {
      choices = pickChoices(DATA_UPGRADES, n);
    } else if (kind === 'relic') {
      const left = DATA_RELICS.filter(r => !loadout.relics.includes(r.id));
      choices = pickChoices(left.length ? left : DATA_RELICS, Math.min(n, left.length || 3));
    }
    state = STATE.CHOICE;
  }

  function selectChoice(i) {
    if (i < 0 || i >= choices.length) return;
    const c = choices[i];
    if (choiceKind === 'item') {
      grantItem(loadout, c.id);
      syncDrones();
      SFX.pickup();
    } else if (choiceKind === 'upgrade') {
      applyUpgrade(loadout, hero, c);
      SFX.ui();
    } else if (choiceKind === 'relic') {
      grantRelic(loadout, c.id);
      SFX.pickup();
    }
    choices = [];
    // after relic -> next floor or win
    if (choiceKind === 'relic') {
      if (floorIdx >= 2) {
        state = STATE.WIN;
        SFX.win();
        return;
      }
      floorIdx++;
      beginFloor();
      state = STATE.PLAY;
      return;
    }
    state = STATE.PLAY;
  }

  function rerollChoices() {
    if (loadout.stats.rerolls <= 0) return;
    loadout.stats.rerolls--;
    openChoice(choiceKind);
  }

  function completeObjective(obj) {
    if (obj.done) return;
    obj.done = true;
    aggression += 0.25;
    openChoice('item');
    SFX.levelup();
    // after 3 objectives — lift + boss
    if (world.objectives.every(o => o.done)) {
      world.lift = { x: world.w * 0.5, y: world.h * 0.5, r: 40 };
      spawnBoss();
    }
  }

  function spawnBoss() {
    if (bossSpawned) return;
    bossSpawned = true;
    const bd = DATA_ENEMIES.floors[floorIdx + 1].boss;
    enemies.alloc(bd, world.w * 0.5 + 80, world.h * 0.5, null);
    SFX.explode();
    Render.addShake(0.6);
  }

  function frame(ts) {
    const dt = Math.min(0.05, (ts - (lastTs || ts)) / 1000);
    lastTs = ts;
    portraitOverlay = Input.isPortrait();
    if (state === STATE.PLAY && !portraitOverlay) updatePlay(dt);
    else if (state === STATE.PLAY) { /* paused by portrait */ }
    Render.update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function updatePlay(dt) {
    timer += dt;
    stats.timeAlive += dt;
    const L = loadout;
    const st = L.stats;
    const mods = L.mods;

    // overcharge relic
    if (L.relics.includes('overcharge')) {
      L.overchargeCd -= dt;
      if (L.overchargeCd <= 0) { L.overchargeT = 3; L.overchargeCd = 20; }
      if (L.overchargeT > 0) L.overchargeT -= dt;
    }

    // movement / leap
    if (hero.leaping) {
      hero.leapT -= dt;
      hero.x += hero.leapVx * dt;
      hero.y += hero.leapVy * dt;
      const r = World.resolveCircle(hero.x, hero.y, hero.r, world.obstacles, world);
      hero.x = r.x; hero.y = r.y;
      if (hero.leapT <= 0) {
        hero.leaping = false;
        // slam
        const act = heroVar.active;
        slam(hero.x, hero.y, act.slamRadius, act.slamDamage * st.dmgMul * mods.dmgMul);
        SFX.slam();
        Render.addShake(0.45);
        if (L.relics.includes('second_wind')) hero.invuln = Math.max(hero.invuln, 1.2);
      }
    } else {
      const mv = Input.moveAxis();
      const spd = hero.speed * st.speedMul;
      hero.x += mv.x * spd * dt;
      hero.y += mv.y * spd * dt;
      if (mv.x) hero.facing = mv.x >= 0 ? 1 : -1;
      const r = World.resolveCircle(hero.x, hero.y, hero.r, world.obstacles, world);
      hero.x = r.x; hero.y = r.y;
      if (Input.consumeAbility() && hero.activeCd <= 0) {
        let dx = mv.x, dy = mv.y;
        if (Math.abs(dx) + Math.abs(dy) < 0.1) { dx = hero.facing; dy = 0; }
        const len = Math.hypot(dx, dy) || 1;
        const act = heroVar.active;
        hero.leaping = true;
        hero.leapT = act.leapDuration;
        hero.leapVx = (dx / len) * act.leapSpeed;
        hero.leapVy = (dy / len) * act.leapSpeed;
        hero.activeCd = act.cooldown;
        hero.invuln = Math.max(hero.invuln, act.leapDuration);
        SFX.jump();
      }
    }
    if (hero.activeCd > 0) hero.activeCd -= dt;
    if (hero.invuln > 0) hero.invuln -= dt;
    if (hero.flash > 0) hero.flash -= dt;

    // fire trail
    if (mods.fireTrail) {
      fireTrailT -= dt;
      if (fireTrailT <= 0) {
        fireTrailT = 0.15;
        pools.alloc(hero.x, hero.y, 22, '#f63', 12, 0, 1.2);
      }
    }

    // auto fire
    hero.fireCd -= dt;
    if (hero.burstLeft > 0) {
      hero.burstCd -= dt;
      if (hero.burstCd <= 0) {
        fireBolter();
        hero.burstLeft--;
        hero.burstCd = heroVar.weapon.burstGap;
      }
    } else if (hero.fireCd <= 0) {
      const rate = hero.fireRate * st.fireRateMul * mods.fireRateMul * (L.overchargeT > 0 ? 2 : 1);
      hero.fireCd = 1 / Math.max(0.3, rate);
      hero.burstLeft = heroVar.weapon.burst - 1;
      hero.burstCd = heroVar.weapon.burstGap;
      fireBolter();
    }

    // orbit shards
    orbitAngle += dt * 3;
    if (mods.orbit > 0) {
      const n = mods.orbit;
      for (let i = 0; i < n; i++) {
        const a = orbitAngle + (i / n) * Math.PI * 2;
        const ox = hero.x + Math.cos(a) * 48;
        const oy = hero.y + Math.sin(a) * 48;
        // damage nearby
        grid.queryRadius(ox, oy, 14, qtmp);
        for (const en of qtmp) {
          hurtEnemy(en, hero.damage * 0.35 * st.dmgMul * mods.dmgMul * dt * 8, false);
        }
      }
    }

    // drones
    for (const d of drones) {
      d.angle += dt * 1.5;
      d.fireCd -= dt;
      if (d.fireCd <= 0) {
        const dx = hero.x + Math.cos(d.angle) * 36;
        const dy = hero.y + Math.sin(d.angle) * 36;
        const tgt = grid.nearest(dx, dy, 280, qtmp);
        if (tgt) {
          shootAt(dx, dy, tgt.x, tgt.y, hero.damage * 0.55 * st.dmgMul, { size: 4, color: '#aad' });
          d.fireCd = 0.55;
        }
      }
    }

    // thorns
    if (L.relics.includes('thorns')) {
      grid.queryRadius(hero.x, hero.y, 36, qtmp);
      for (const en of qtmp) hurtEnemy(en, 18 * st.dmgMul * dt, false);
    }

    // rebuild spatial
    grid.clear();
    for (const e of enemies.alive) if (e._alive) grid.insert(e);

    updateEnemies(dt);
    updateBullets(dt, bullets, true);
    updateBullets(dt, ebullets, false);
    updatePickups(dt);
    updatePools(dt);
    updateObjectives(dt);
    updateAltars();
    updateLift();

    enemies.collect(); bullets.collect(); ebullets.collect();
    pickups.collect(); pools.collect(); fx.collect();

    // waves
    waveT -= dt;
    if (waveT <= 0 && !bossSpawned) {
      spawnWave();
      const fd = DATA_FLOORS[floorIdx];
      waveT = Math.max(1.2, 4.5 / aggression);
      waveN++;
    }

    // camera follow iso
    const hp = Render.W2S(hero.x, hero.y, { x: 0, y: 0 }, ISO_SCALE);
    const vw = canvas.clientWidth, vh = canvas.clientHeight;
    cam.x = hp.x - vw / 2;
    cam.y = hp.y - vh / 2;

    if (hero.hp <= 0) {
      state = STATE.DEAD;
      SFX.death();
    }
  }

  function fireBolter() {
    const tgt = grid.nearest(hero.x, hero.y, 420, qtmp);
    let tx = hero.x + hero.facing * 100, ty = hero.y;
    if (tgt) { tx = tgt.x; ty = tgt.y; }
    const mods = loadout.mods;
    const splits = 1 + (mods.split > 0 ? 2 : 0);
    const baseAng = Math.atan2(ty - hero.y, tx - hero.x);
    for (let i = 0; i < splits; i++) {
      let ang = baseAng;
      if (splits > 1) ang += (i - 1) * 0.22;
      shootDir(hero.x, hero.y, ang, hero.damage * loadout.stats.dmgMul * mods.dmgMul, {});
    }
    SFX.shoot();
    loadout.shotCount++;
    if (loadout.relics.includes('orbital') && loadout.shotCount % 10 === 0) {
      orbitalStrike(tx, ty);
    }
  }

  function shootAt(x, y, tx, ty, dmg, extra) {
    const ang = Math.atan2(ty - y, tx - x);
    shootDir(x, y, ang, dmg, extra || {});
  }

  function shootDir(x, y, ang, dmg, extra) {
    const mods = loadout.mods;
    const spd = 420 * mods.projSpeed * (extra.spdMul || 1);
    const opts = {
      size: 5 * mods.size * (extra.sizeMul || 1),
      pierce: mods.pierce,
      ricochet: mods.ricochet ? 2 + mods.ricochet : 0,
      homing: mods.homing,
      burn: mods.burn,
      explode: mods.explode,
      chain: mods.chain,
      poison: mods.poison,
      bloodheal: mods.bloodheal,
      lifesteal: mods.lifesteal,
      holy: mods.holy > 0 || mods.holyShots,
      color: mods.holyShots || mods.holy ? '#ffd700' : (extra.color || '#fc6'),
      fromPlayer: true
    };
    Object.assign(opts, extra);
    bullets.alloc(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd, dmg, opts);
  }

  function orbitalStrike(x, y) {
    fx.alloc(x, y, 'orbital', 0.5);
    grid.queryRadius(x, y, 100, qtmp);
    for (const en of qtmp) hurtEnemy(en, 80 * loadout.stats.dmgMul, true);
    SFX.explode();
    Render.addShake(0.35);
  }

  function slam(x, y, r, dmg) {
    fx.alloc(x, y, 'slam', 0.35);
    grid.queryRadius(x, y, r, qtmp);
    for (const en of qtmp) hurtEnemy(en, dmg, true);
  }

  function updateBullets(dt, pool, playerSide) {
    for (const b of pool.alive) {
      if (!b._alive) continue;
      // homing
      if (playerSide && b.homing > 0) {
        const t = grid.nearest(b.x, b.y, 180, qtmp);
        if (t) {
          const ang = Math.atan2(t.y - b.y, t.x - b.x);
          const spd = Math.hypot(b.vx, b.vy);
          const tx = Math.cos(ang) * spd, ty = Math.sin(ang) * spd;
          b.vx += (tx - b.vx) * Math.min(1, 4 * b.homing * dt);
          b.vy += (ty - b.vy) * Math.min(1, 4 * b.homing * dt);
        }
      }
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      // obstacle block
      if (World.segmentHitsObstacle(b.x, b.y, nx, ny, world.obstacles)) {
        pool.release(b); continue;
      }
      b.x = nx; b.y = ny;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > world.w || b.y > world.h) {
        pool.release(b); continue;
      }
      if (playerSide) {
        grid.queryRadius(b.x, b.y, b.size + 16, qtmp);
        for (const en of qtmp) {
          const dx = en.x - b.x, dy = en.y - b.y;
          if (dx * dx + dy * dy > (en.radius + b.size) * (en.radius + b.size)) continue;
          onBulletHitEnemy(b, en, pool);
          if (!b._alive) break;
        }
      } else {
        const dx = hero.x - b.x, dy = hero.y - b.y;
        if (dx * dx + dy * dy < (hero.r + b.size) * (hero.r + b.size)) {
          hurtHero(b.dmg);
          pool.release(b);
        }
      }
    }
  }

  function onBulletHitEnemy(b, en, pool) {
    let dmg = b.dmg;
    if (b.holy && DATA_ENEMIES.floors[floorIdx + 1].faction === 'chaos') dmg *= 1.4;
    hurtEnemy(en, dmg, true);
    if (b.lifesteal && !loadout.stats.noHeal) {
      hero.hp = Math.min(hero.maxHp, hero.hp + dmg * b.lifesteal);
    }
    if (b.burn) { en.burnT = Math.max(en.burnT, 2.5); en.burnDps = 8 * b.burn; }
    if (b.explode) {
      SFX.hit();
      grid.queryRadius(en.x, en.y, 40 + 10 * b.explode, qtmp);
      for (const o of qtmp) if (o !== en) hurtEnemy(o, b.dmg * 0.45, false);
      fx.alloc(en.x, en.y, 'boom', 0.25);
    }
    if (b.chain > 0) {
      const others = [];
      grid.queryRadius(en.x, en.y, 90, others);
      let left = 2 + b.chain;
      for (const o of others) {
        if (o === en || left <= 0) continue;
        hurtEnemy(o, b.dmg * 0.5, false);
        if (b.poison) pools.alloc(o.x, o.y, 28, '#6f3', 10, 0, 3);
        left--;
      }
    }
    if (b.pierce > 0) { b.pierce--; return; }
    if (b.ricochet > 0) {
      b.ricochet--;
      const t = grid.nearest(b.x, b.y, 160, qtmp);
      if (t && t !== en) {
        const ang = Math.atan2(t.y - b.y, t.x - b.x);
        const spd = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(ang) * spd; b.vy = Math.sin(ang) * spd;
        return;
      }
    }
    // death pools
    if (!en._alive || en.hp <= 0) {
      if (b.poison) pools.alloc(en.x, en.y, 32, '#6f3', 14, 0, 4);
      if (b.bloodheal) pools.alloc(en.x, en.y, 30, '#a22', 0, 6, 5);
    }
    pool.release(b);
  }

  function hurtEnemy(en, dmg, showNum) {
    if (!en._alive || en.hp <= 0) return;
    if (en.shield > 0) {
      const abs = Math.min(en.shield, dmg);
      en.shield -= abs; dmg -= abs;
      if (dmg <= 0) { en.flash = 0.08; return; }
    }
    en.hp -= dmg;
    en.flash = 0.1;
    stats.damageDealt += dmg;
    if (showNum) Render.addDmgNum(en.x, en.y - 20, dmg, dmg > 40);
    if (en.hp <= 0) killEnemy(en);
  }

  function killEnemy(en) {
    if (!en._alive) return;
    enemies.release(en);
    kills++;
    addXp(en.xp || 3);
    // drop
    if (Math.random() < 0.12 + loadout.stats.luck) {
      const rare = Math.random() < 0.15 + loadout.stats.luck;
      pickups.alloc(en.x, en.y, 'chest', rare ? 2 : 1);
    } else if (Math.random() < 0.55) {
      pickups.alloc(en.x, en.y, 'xp', en.xp || 3);
    }
    if (en.eliteType === 'burning' || (en.onDeath === 'burn_pool')) {
      pools.alloc(en.x, en.y, 40, '#f63', 16, 0, 3);
    }
    if (en.eliteType === 'splitting') {
      const fd = DATA_ENEMIES.floors[floorIdx + 1];
      for (let i = 0; i < 2; i++) {
        enemies.alloc(fd.swarm, en.x + (i ? 12 : -12), en.y, null);
      }
    }
    // objective elite
    if (en.objectiveElite) {
      for (const o of world.objectives) {
        if (o.type === 'elite' && !o.done) completeObjective(o);
      }
    }
    if (en.isBoss) {
      // boss dead -> relic choice (lift already there)
      openChoice('relic');
    }
    SFX.hit();
  }

  function hurtHero(dmg) {
    if (hero.invuln > 0 || hero.leaping) return;
    dmg *= loadout.stats.dmgTakenMul;
    hero.hp -= dmg;
    hero.flash = 0.15;
    hero.invuln = 0.45;
    SFX.hurt();
    Render.addShake(0.25);
    if (vibrateOn && navigator.vibrate) navigator.vibrate(30);
    if (hero.hp <= 0 && !passiveUsed) {
      passiveUsed = true;
      hero.hp = 1;
      hero.invuln = 1.5;
    }
  }

  function updateEnemies(dt) {
    const fd = DATA_ENEMIES.floors[floorIdx + 1];
    for (const e of enemies.alive) {
      if (!e._alive) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.burnT > 0) {
        e.burnT -= dt;
        hurtEnemy(e, e.burnDps * dt, false);
        if (!e._alive) continue;
      }
      e.hitPlayerCd -= dt;
      e.cd -= dt;
      const dx = hero.x - e.x, dy = hero.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      let spd = e.speed * (0.85 + 0.15 * aggression);

      if (e.ai === 'charge' || e.ai === 'dash') {
        if (e.cd <= 0 && dist < 220) {
          e.vx = (dx / dist) * spd * 3.2;
          e.vy = (dy / dist) * spd * 3.2;
          e.cd = e.chargeCd || e.dashCd || 2;
          e.dashT = 0.35;
        }
        if (e.dashT > 0) {
          e.dashT -= dt;
          e.x += e.vx * dt; e.y += e.vy * dt;
        } else {
          e.x += (dx / dist) * spd * dt;
          e.y += (dy / dist) * spd * dt;
        }
      } else if (e.ai === 'shooter' || e.ai === 'acid_shooter') {
        if (dist > 140) {
          e.x += (dx / dist) * spd * 0.7 * dt;
          e.y += (dy / dist) * spd * 0.7 * dt;
        } else if (dist < 100) {
          e.x -= (dx / dist) * spd * dt;
          e.y -= (dy / dist) * spd * dt;
        }
        if (e.cd <= 0) {
          const ang = Math.atan2(dy, dx);
          const ps = e.ai === 'acid_shooter' ? 180 : 220;
          ebullets.alloc(e.x, e.y, Math.cos(ang) * ps, Math.sin(ang) * ps, e.damage, {
            size: 6, color: e.ai === 'acid_shooter' ? '#6f3' : '#f66', fromPlayer: false
          });
          e.cd = e.shootCd || 1.5;
        }
      } else if (e.ai && e.ai.startsWith('boss')) {
        e.x += (dx / dist) * spd * dt;
        e.y += (dy / dist) * spd * dt;
        if (e.cd <= 0) {
          // ring shot
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + timer;
            ebullets.alloc(e.x, e.y, Math.cos(a) * 160, Math.sin(a) * 160, e.damage * 0.7, {
              size: 7, color: '#f48', fromPlayer: false
            });
          }
          e.cd = 2.2;
        }
      } else {
        // swarm — slight separation
        e.x += (dx / dist) * spd * dt;
        e.y += (dy / dist) * spd * dt;
      }

      const r = World.resolveCircle(e.x, e.y, e.radius, world.obstacles, world);
      e.x = r.x; e.y = r.y;

      // contact damage
      if (e.hitPlayerCd <= 0) {
        const ddx = hero.x - e.x, ddy = hero.y - e.y;
        if (ddx * ddx + ddy * ddy < (hero.r + e.radius) * (hero.r + e.radius)) {
          hurtHero(e.damage);
          e.hitPlayerCd = 0.6;
        }
      }
    }
  }

  function spawnWave() {
    const fd = DATA_ENEMIES.floors[floorIdx + 1];
    const floorDef = DATA_FLOORS[floorIdx];
    let n = Math.floor(floorDef.waveBase * Math.pow(floorDef.waveRamp, waveN * 0.5) * aggression);
    n = Math.min(n, 40);
    const types = [fd.swarm, fd.swarm, fd.swarm, fd.charger];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 280 + Math.random() * 200;
      let x = hero.x + Math.cos(ang) * dist;
      let y = hero.y + Math.sin(ang) * dist;
      x = World.clamp(x, 40, world.w - 40);
      y = World.clamp(y, 40, world.h - 40);
      const def = types[(Math.random() * types.length) | 0];
      let elite = null;
      if (Math.random() < 0.06 * aggression) {
        const keys = Object.keys(DATA_ENEMIES.elites);
        elite = keys[(Math.random() * keys.length) | 0];
      }
      enemies.alloc(def, x, y, elite);
    }
  }

  function updatePickups(dt) {
    const range = 80 * loadout.stats.pickupMul;
    for (const p of pickups.alive) {
      if (!p._alive) continue;
      p.t += dt;
      const dx = hero.x - p.x, dy = hero.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < range * range) {
        const d = Math.sqrt(d2) || 1;
        p.x += (dx / d) * 220 * dt;
        p.y += (dy / d) * 220 * dt;
      }
      if (d2 < 20 * 20) {
        if (p.type === 'xp') addXp(p.val);
        else if (p.type === 'heal' && !loadout.stats.noHeal) hero.hp = Math.min(hero.maxHp, hero.hp + 15);
        else if (p.type === 'chest') {
          if (p.rare) openChoice('item');
          else addXp(8 + ((Math.random() * 8) | 0));
        }
        SFX.pickup();
        pickups.release(p);
      }
    }
  }

  function updatePools(dt) {
    for (const p of pools.alive) {
      if (!p._alive) continue;
      p.life -= dt;
      if (p.life <= 0) { pools.release(p); continue; }
      const dx = hero.x - p.x, dy = hero.y - p.y;
      if (dx * dx + dy * dy < (p.r + hero.r) * (p.r + hero.r)) {
        if (p.heal && !loadout.stats.noHeal) hero.hp = Math.min(hero.maxHp, hero.hp + p.heal * dt);
      }
      if (p.dps) {
        grid.queryRadius(p.x, p.y, p.r, qtmp);
        for (const en of qtmp) hurtEnemy(en, p.dps * dt, false);
      }
    }
  }

  function updateObjectives(dt) {
    for (const o of world.objectives) {
      if (o.done) continue;
      if (o.type === 'capture') {
        const dx = hero.x - o.x, dy = hero.y - o.y;
        if (dx * dx + dy * dy < o.r * o.r) {
          o.progress += dt / o.duration;
          if (o.progress >= 1) completeObjective(o);
        }
      } else if (o.type === 'nest') {
        // nest damaged by bullets — check proximity of player bullets
        for (const b of bullets.alive) {
          if (!b._alive) continue;
          const dx = b.x - o.x, dy = b.y - o.y;
          if (dx * dx + dy * dy < (o.r + b.size) * (o.r + b.size)) {
            o.hp -= b.dmg;
            bullets.release(b);
            Render.addDmgNum(o.x, o.y - 20, b.dmg);
            if (o.hp <= 0) completeObjective(o);
          }
        }
      }
    }
  }

  function updateAltars() {
    for (const a of world.altars) {
      if (a.used) continue;
      const dx = hero.x - a.x, dy = hero.y - a.y;
      if (dx * dx + dy * dy < a.r * a.r) {
        altarPending = a;
        state = STATE.ALTAR;
        break;
      }
    }
  }

  function acceptAltar() {
    if (!altarPending) return;
    applyAltar(loadout, hero, altarPending);
    altarPending.used = true;
    altarPending = null;
    state = STATE.PLAY;
    SFX.ui();
  }
  function declineAltar() {
    if (altarPending) {
      // nudge player away
      const a = altarPending;
      const dx = hero.x - a.x, dy = hero.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      hero.x = a.x + (dx / len) * (a.r + 40);
      hero.y = a.y + (dy / len) * (a.r + 40);
    }
    altarPending = null;
    state = STATE.PLAY;
  }

  function updateLift() {
    if (!world.lift || !bossSpawned) return;
    // lift used after boss via relic choice already
  }

  // ——— Drawing & UI hit testing ———
  let uiHits = [];

  function draw() {
    uiHits = [];
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const fog = (world && world.palette && world.palette.fog) || '#0a0a0f';
    Render.clear(ctx, w, h, fog);

    if (state === STATE.MENU) return drawMenu(w, h);
    if (state === STATE.HERO) return drawHeroSelect(w, h);
    if (state === STATE.DEAD) { drawWorld(w, h); return drawDeath(w, h); }
    if (state === STATE.WIN) { drawWorld(w, h); return drawWin(w, h); }

    drawWorld(w, h);
    drawHUD(w, h);
    Input.draw && 0;
    Render.drawJoystick(ctx);
    if (hero) {
      const cd = heroVar ? Math.max(0, hero.activeCd / heroVar.active.cooldown) : 0;
      Render.drawAbilityBtn(ctx, cd, hero.activeCd <= 0);
    }

    if (portraitOverlay) drawPortrait(w, h);
    if (state === STATE.CHOICE) drawChoice(w, h);
    if (state === STATE.PAUSE) drawPause(w, h);
    if (state === STATE.ALTAR) drawAltarModal(w, h);
    if (itemPanelOpen) drawItemPanel(w, h);
  }

  function drawWorld(w, h) {
    if (!world || !hero) return;
    const pal = world.palette;
    const scale = ISO_SCALE;
    // ground tiles sparse
    const step = 64;
    const viewPad = 200;
    // approximate visible world AABB via inverse is hard; draw around hero
    const x0 = Math.max(0, ((hero.x - 500) / step) | 0) * step;
    const y0 = Math.max(0, ((hero.y - 500) / step) | 0) * step;
    const x1 = Math.min(world.w, hero.x + 500);
    const y1 = Math.min(world.h, hero.y + 500);
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        Render.drawObstacle; // noop keep ref
        const p = Render.W2S(x, y, cam, scale);
        if (p.x < -40 || p.y < -40 || p.x > w + 40 || p.y > h + 40) continue;
        ctx.fillStyle = ((x + y) / step) % 2 === 0 ? pal.ground : Render.shade(pal.ground, 0.9);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 8 * scale);
        ctx.lineTo(p.x + 16 * scale, p.y);
        ctx.lineTo(p.x, p.y + 8 * scale);
        ctx.lineTo(p.x - 16 * scale, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // depth sort entities
    const drawList = [];
    for (const o of world.obstacles) drawList.push({ z: o.x + o.y, kind: 'obs', o });
    for (const o of world.objectives) drawList.push({ z: o.x + o.y, kind: 'obj', o });
    for (const a of world.altars) drawList.push({ z: a.x + a.y, kind: 'altar', o: a });
    if (world.lift) drawList.push({ z: world.lift.x + world.lift.y, kind: 'lift', o: world.lift });
    for (const p of pools.alive) if (p._alive) drawList.push({ z: p.x + p.y - 1, kind: 'pool', o: p });
    for (const p of pickups.alive) if (p._alive) drawList.push({ z: p.x + p.y, kind: 'pick', o: p });
    for (const e of enemies.alive) if (e._alive) drawList.push({ z: e.x + e.y, kind: 'en', o: e });
    for (const b of bullets.alive) if (b._alive) drawList.push({ z: b.x + b.y, kind: 'bol', o: b });
    for (const b of ebullets.alive) if (b._alive) drawList.push({ z: b.x + b.y, kind: 'bol', o: b });
    drawList.push({ z: hero.x + hero.y, kind: 'hero', o: hero });
    // orbit visuals
    if (loadout && loadout.mods.orbit) {
      const n = loadout.mods.orbit;
      for (let i = 0; i < n; i++) {
        const a = orbitAngle + (i / n) * Math.PI * 2;
        const ox = hero.x + Math.cos(a) * 48;
        const oy = hero.y + Math.sin(a) * 48;
        drawList.push({ z: ox + oy, kind: 'shard', o: { x: ox, y: oy } });
      }
    }
    for (const d of drones) {
      const ox = hero.x + Math.cos(d.angle) * 36;
      const oy = hero.y + Math.sin(d.angle) * 36;
      drawList.push({ z: ox + oy, kind: 'drone', o: { x: ox, y: oy } });
    }
    drawList.sort((a, b) => a.z - b.z);
    for (const it of drawList) {
      if (it.kind === 'obs') Render.drawObstacle(ctx, it.o, cam, scale, pal);
      else if (it.kind === 'obj') Render.drawObjective(ctx, it.o, cam, scale);
      else if (it.kind === 'altar') Render.drawAltar(ctx, it.o, cam, scale);
      else if (it.kind === 'lift') Render.drawLift(ctx, it.o, cam, scale);
      else if (it.kind === 'pool') Render.drawPool(ctx, it.o, cam, scale);
      else if (it.kind === 'pick') Render.drawPickup(ctx, it.o, cam, scale);
      else if (it.kind === 'en') Render.drawEnemy(ctx, it.o, cam, scale);
      else if (it.kind === 'bol') Render.drawProjectile(ctx, it.o, cam, scale);
      else if (it.kind === 'hero') {
        const p = Render.W2S(hero.x, hero.y, cam, scale);
        Render.drawMarine(ctx, p, hero.facing, hero.palette, hero.flash > 0, loadout.mods, scale);
      } else if (it.kind === 'shard') {
        const p = Render.W2S(it.o.x, it.o.y, cam, scale);
        ctx.fillStyle = '#c9f';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
      } else if (it.kind === 'drone') {
        const p = Render.W2S(it.o.x, it.o.y, cam, scale);
        ctx.fillStyle = '#aad';
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.stroke();
      }
    }
    // fx
    for (const f of fx.alive) {
      if (!f._alive) continue;
      f.t -= 1 / 60;
      if (f.t <= 0) { fx.release(f); continue; }
      const p = Render.W2S(f.x, f.y, cam, scale);
      ctx.globalAlpha = f.t / f.life;
      ctx.strokeStyle = f.kind === 'orbital' ? '#4af' : '#fc6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, (1 - f.t / f.life) * 60, (1 - f.t / f.life) * 30, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    Render.drawDmgNums(ctx, cam, scale);
    // objective arrows
    for (const o of world.objectives) {
      if (o.done) continue;
      const label = DATA_OBJECTIVES[o.type] ? DATA_OBJECTIVES[o.type].icon : '?';
      Render.drawArrowTo(ctx, w / 2, h / 2, o.x, o.y, cam, scale, '#4af', label);
    }
  }

  function drawHUD(w, h) {
    // HP
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(10, 8, 160, 14);
    ctx.fillStyle = '#c33';
    ctx.fillRect(10, 8, 160 * (hero.hp / hero.maxHp), 14);
    ctx.strokeStyle = '#000'; ctx.strokeRect(10, 8, 160, 14);
    ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('HP ' + (hero.hp | 0) + '/' + hero.maxHp, 14, 19);
    // XP
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(10, 26, 160, 8);
    ctx.fillStyle = '#4c4';
    ctx.fillRect(10, 26, 160 * (xp / xpToNext), 8);
    ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif';
    ctx.fillText('Ур.' + level, 174, 34);
    // objectives
    let ox = w / 2 - 60;
    for (let i = 0; i < world.objectives.length; i++) {
      const o = world.objectives[i];
      const def = DATA_OBJECTIVES[o.type];
      ctx.fillStyle = o.done ? '#2a4a2a' : 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.arc(ox + i * 44, 22, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = o.done ? '#4f4' : '#8af'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '12px sans-serif';
      ctx.fillText(def.icon, ox + i * 44, 26);
      if (o.type === 'capture' && !o.done) {
        ctx.strokeStyle = '#8cf';
        ctx.beginPath();
        ctx.arc(ox + i * 44, 22, 14, -Math.PI / 2, -Math.PI / 2 + o.progress * Math.PI * 2);
        ctx.stroke();
      }
    }
    // timer & kills
    ctx.textAlign = 'right'; ctx.fillStyle = '#ccc'; ctx.font = '11px sans-serif';
    const m = (timer / 60) | 0, s = (timer % 60) | 0;
    ctx.fillText(m + ':' + String(s).padStart(2, '0') + '  Убийства: ' + kills, w - 12, 20);
    ctx.fillText(DATA_FLOORS[floorIdx].fullName, w - 12, 36);
    // item icons
    const items = loadout.items;
    for (let i = 0; i < items.length; i++) {
      const def = itemDef(items[i]);
      if (!def) continue;
      const ix = 12 + i * 28, iy = h - 36;
      ctx.fillStyle = def.color;
      ctx.fillRect(ix, iy, 24, 24);
      ctx.strokeStyle = '#000'; ctx.strokeRect(ix, iy, 24, 24);
      ctx.fillStyle = '#000'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(def.icon, ix + 12, iy + 16);
      uiHits.push({ x: ix, y: iy, w: 24, h: 24, action: 'items' });
    }
    // pause btn
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(w - 44, 44, 32, 24);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '12px sans-serif';
    ctx.fillText('❚❚', w - 28, 60);
    uiHits.push({ x: w - 44, y: 44, w: 32, h: 24, action: 'pause' });
  }

  function drawMenu(w, h) {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9a227';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GRIMDARK SURVIVORS', w / 2, h * 0.28);
    ctx.fillStyle = '#888';
    ctx.font = '13px sans-serif';
    ctx.fillText('Некоммерческий чиби-фан 40K', w / 2, h * 0.28 + 28);
    ctx.fillStyle = '#aaa';
    ctx.fillText('Улей атакован. Поднимайся к поверхности.', w / 2, h * 0.28 + 50);
    btn(w / 2 - 90, h * 0.55, 180, 44, 'ИГРАТЬ', 'start');
    ctx.fillStyle = '#666'; ctx.font = '11px sans-serif';
    ctx.fillText('Стик слева · Способность справа · WASD + Пробел', w / 2, h * 0.55 + 70);
  }

  function drawHeroSelect(w, h) {
    ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Выбор героя', w / 2, 36);
    const vars = DATA_HEROES.variants;
    const bw = 140, gap = 16;
    const total = vars.length * bw + (vars.length - 1) * gap;
    let x = w / 2 - total / 2;
    for (const v of vars) {
      ctx.fillStyle = v.locked ? '#1a1a22' : '#1a2a4a';
      roundRectFill(x, 70, bw, h - 140, 8);
      if (v.locked) {
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.ellipse(x + bw / 2, 140, 30, 40, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#666'; ctx.font = '12px sans-serif';
        ctx.fillText(v.name, x + bw / 2, 200);
        ctx.fillText('Скоро', x + bw / 2, 220);
      } else {
        Render.drawMarine(ctx, { x: x + bw / 2, y: 160 }, 1, v.palette, false, {}, 1.2);
        ctx.fillStyle = '#c9a227'; ctx.font = 'bold 13px sans-serif';
        ctx.fillText(v.name, x + bw / 2, 220);
        ctx.fillStyle = '#aaa'; ctx.font = '10px sans-serif';
        ctx.fillText(v.active.name, x + bw / 2, 238);
        ctx.fillText(v.passive.name, x + bw / 2, 252);
        btn(x + 20, h - 90, bw - 40, 36, 'ВЫБРАТЬ', 'pick:' + v.id);
      }
      x += bw + gap;
    }
    btn(20, 20, 80, 28, '← Назад', 'menu');
  }

  function drawChoice(w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, w, h);
    const title = choiceKind === 'item' ? 'Выбери реликвию поля боя' :
      choiceKind === 'upgrade' ? 'Повышение уровня' : 'Выбери РЕЛИКВИЮ';
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, 40);
    const n = choices.length;
    const cw = Math.min(160, (w - 40) / n - 10);
    const total = n * cw + (n - 1) * 12;
    let x = w / 2 - total / 2;
    for (let i = 0; i < n; i++) {
      const c = choices[i];
      ctx.fillStyle = '#1a1a28';
      roundRectFill(x, 70, cw, h - 160, 10);
      ctx.strokeStyle = c.color || '#c9a227'; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = c.color || '#fff';
      ctx.font = '28px sans-serif';
      ctx.fillText(c.icon || '?', x + cw / 2, 120);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
      wrapText(c.name, x + cw / 2, 150, cw - 12);
      ctx.fillStyle = '#aaa'; ctx.font = '10px sans-serif';
      wrapText(c.desc || '', x + cw / 2, 180, cw - 12);
      if (c.tags) {
        ctx.fillStyle = '#6af';
        ctx.fillText(c.tags.join(' · '), x + cw / 2, 230);
        const hint = synergyHint(loadout, c);
        if (hint) {
          ctx.fillStyle = '#fc6';
          wrapText(hint, x + cw / 2, 250, cw - 12);
        }
      }
      uiHits.push({ x, y: 70, w: cw, h: h - 160, action: 'choice:' + i });
      x += cw + 12;
    }
    if (loadout.stats.rerolls > 0) {
      btn(w / 2 - 70, h - 50, 140, 32, 'Реролл (' + loadout.stats.rerolls + ')', 'reroll');
    }
  }

  function drawPause(w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Пауза', w / 2, 50);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#ccc';
    ctx.fillText('Сборка:', w / 2, 80);
    let y = 100;
    for (const id of loadout.items) {
      const d = itemDef(id);
      ctx.fillText((d ? d.icon + ' ' + d.name : id) + ' x' + loadout.stacks[id], w / 2, y);
      y += 16;
    }
    for (const id of loadout.relics) {
      const d = relicDef(id);
      ctx.fillText('◆ ' + (d ? d.name : id), w / 2, y); y += 16;
    }
    for (const tid of Object.keys(loadout.transforms)) {
      const t = DATA_TRANSFORMATIONS.find(x => x.id === tid);
      if (t) { ctx.fillStyle = t.color; ctx.fillText('★ ' + t.name, w / 2, y); y += 16; }
    }
    btn(w / 2 - 80, h - 120, 160, 40, 'Продолжить', 'resume');
    btn(w / 2 - 80, h - 70, 160, 36, vibrateOn ? 'Вибрация: ВКЛ' : 'Вибрация: ВЫКЛ', 'vib');
    btn(w / 2 - 80, h - 30, 160, 28, dmgNumOn ? 'Цифры урона: ВКЛ' : 'Цифры урона: ВЫКЛ', 'dmgnum');
  }

  function drawDeath(w, h) {
    ctx.fillStyle = 'rgba(40,0,0,0.75)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f44'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ПАЛ ЗА ИМПЕРИУМ', w / 2, h * 0.3);
    ctx.fillStyle = '#ccc'; ctx.font = '14px sans-serif';
    ctx.fillText('Убийства: ' + kills + '  Время: ' + (timer | 0) + 'с  Уровень: ' + level, w / 2, h * 0.3 + 36);
    ctx.fillText('Урон: ' + (stats.damageDealt | 0) + '  Этаж: ' + (floorIdx + 1), w / 2, h * 0.3 + 56);
    btn(w / 2 - 90, h * 0.55, 180, 44, 'Заново', 'restart');
    btn(w / 2 - 90, h * 0.55 + 56, 180, 36, 'В меню', 'menu');
  }

  function drawWin(w, h) {
    ctx.fillStyle = 'rgba(0,20,40,0.8)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ПОВЕРХНОСТЬ ЗАЧИЩЕНА', w / 2, h * 0.3);
    ctx.fillStyle = '#cfc'; ctx.font = '14px sans-serif';
    ctx.fillText('Улей стоит. Пока что.', w / 2, h * 0.3 + 30);
    ctx.fillText('Убийства: ' + kills + '  Время: ' + (timer | 0) + 'с', w / 2, h * 0.3 + 56);
    btn(w / 2 - 90, h * 0.55, 180, 44, 'В меню', 'menu');
  }

  function drawAltarModal(w, h) {
    const a = altarPending;
    if (!a) return;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = a.color; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(a.name, w / 2, h * 0.28);
    ctx.fillStyle = '#8f8'; ctx.font = '14px sans-serif';
    ctx.fillText('▲ ' + a.buff, w / 2, h * 0.28 + 36);
    ctx.fillStyle = '#f88';
    ctx.fillText('▼ ' + a.debuff, w / 2, h * 0.28 + 58);
    btn(w / 2 - 160, h * 0.55, 140, 40, 'Принять', 'altar_yes');
    btn(w / 2 + 20, h * 0.55, 140, 40, 'Отказаться', 'altar_no');
  }

  function drawPortrait(w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('поверни телефон', w / 2, h / 2);
  }

  function drawItemPanel(w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Предметы', w / 2, 40);
    let y = 70;
    for (const id of loadout.items) {
      const d = itemDef(id);
      if (!d) continue;
      ctx.fillStyle = d.color; ctx.textAlign = 'left'; ctx.font = '13px sans-serif';
      ctx.fillText(d.icon + ' ' + d.name + ' x' + loadout.stacks[id], 40, y);
      ctx.fillStyle = '#aaa'; ctx.font = '11px sans-serif';
      ctx.fillText(d.desc + ' [' + d.tags.join(',') + ']', 40, y + 14);
      y += 36;
    }
    btn(w / 2 - 60, h - 50, 120, 36, 'Закрыть', 'closeitems');
  }

  function btn(x, y, bw, bh, label, action) {
    ctx.fillStyle = '#1a3a6a';
    roundRectFill(x, y, bw, bh, 6);
    ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + bw / 2, y + bh / 2);
    ctx.textBaseline = 'alphabetic';
    uiHits.push({ x, y, w: bw, h: bh, action });
  }

  function roundRectFill(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function wrapText(text, x, y, maxW) {
    const words = String(text).split(' ');
    let line = '', ly = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, x, ly); line = word; ly += 13;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, ly);
  }

  function handleTap(x, y) {
    SFX.resume();
    for (let i = uiHits.length - 1; i >= 0; i--) {
      const u = uiHits[i];
      if (x >= u.x && x <= u.x + u.w && y >= u.y && y <= u.y + u.h) {
        doAction(u.action);
        return true;
      }
    }
    return false;
  }

  function doAction(a) {
    if (a === 'start') { state = STATE.HERO; SFX.ui(); }
    else if (a === 'menu') { state = STATE.MENU; SFX.ui(); }
    else if (a.startsWith('pick:')) startRun(a.slice(5));
    else if (a.startsWith('choice:')) selectChoice(+a.slice(7));
    else if (a === 'reroll') rerollChoices();
    else if (a === 'pause') { state = STATE.PAUSE; SFX.ui(); }
    else if (a === 'resume') { state = STATE.PLAY; SFX.ui(); }
    else if (a === 'restart') { if (heroVar) startRun(heroVar.id); }
    else if (a === 'vib') vibrateOn = !vibrateOn;
    else if (a === 'dmgnum') { dmgNumOn = !dmgNumOn; Render.setShowDmg(dmgNumOn); }
    else if (a === 'altar_yes') acceptAltar();
    else if (a === 'altar_no') declineAltar();
    else if (a === 'items') itemPanelOpen = true;
    else if (a === 'closeitems') itemPanelOpen = false;
  }

  // pointer for UI
  function onPointer(e) {
    if (e.type !== 'pointerdown') return;
    const x = e.offsetX, y = e.offsetY;
    if (state !== STATE.PLAY || itemPanelOpen) {
      if (handleTap(x, y)) { e.stopPropagation(); }
    } else {
      // pause button etc
      if (handleTap(x, y)) { e.stopPropagation(); }
    }
  }

  return {
    init,
    onPointer,
    get state() { return state; },
    STATE,
    // test helpers
    _testStart() { state = STATE.HERO; startRun('ultramarine'); },
    _testState: () => state,
    _testHero: () => hero,
    _testKills: () => kills
  };
})();
