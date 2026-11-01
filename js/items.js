/** Runtime item/relic/upgrade helpers over DATA_* */
function defaultShotMods() {
  return {
    homing: 0, split: 0, ricochet: 0, pierce: 0,
    burn: 0, poison: 0, orbit: 0, chain: 0,
    size: 1, projSpeed: 1, dmgMul: 1, fireRateMul: 1,
    explode: 0, lifesteal: 0, drone: 0, holy: 0, bloodheal: 0,
    fireTrail: false, halo: false, holyShots: false
  };
}

function createLoadout() {
  return {
    items: [],
    stacks: Object.create(null),
    transforms: Object.create(null),
    relics: [],
    mods: defaultShotMods(),
    tagCounts: Object.create(null),
    stats: {
      dmgMul: 1, fireRateMul: 1, speedMul: 1, maxHpAdd: 0, maxHpMul: 1,
      pickupMul: 1, luck: 0, rerolls: 0, extraChoice: 0,
      noHeal: false, dmgTakenMul: 1
    },
    shotCount: 0,
    overchargeT: 0,
    overchargeCd: 0
  };
}

function itemDef(id) { return DATA_ITEMS.find(d => d.id === id); }
function relicDef(id) { return DATA_RELICS.find(d => d.id === id); }

function recalcLoadout(L) {
  const m = defaultShotMods();
  const tags = Object.create(null);
  for (const id of L.items) {
    const n = L.stacks[id] || 1;
    const def = itemDef(id);
    if (def) for (const t of def.tags) tags[t] = (tags[t] || 0) + 1;
    switch (id) {
      case 'homing': m.homing += n; break;
      case 'split': m.split += n; break;
      case 'ricochet': m.ricochet += n; break;
      case 'pierce': m.pierce += n; break;
      case 'burn': m.burn += n; break;
      case 'poison': m.poison += n; break;
      case 'orbit': m.orbit = Math.min(6, m.orbit + n * 2); break;
      case 'chain': m.chain += n; break;
      case 'bigshot': m.size += 0.35 * n; m.projSpeed *= Math.pow(0.85, n); m.dmgMul *= Math.pow(1.35, n); break;
      case 'rapid': m.fireRateMul *= Math.pow(1.2, n); break;
      case 'explode': m.explode += n; break;
      case 'lifesteal': m.lifesteal += 0.045 * n; break;
      case 'drone': m.drone += n; break;
      case 'holy': m.holy += n; break;
      case 'bloodheal': m.bloodheal += n; break;
    }
  }
  L.tagCounts = tags;
  L.transforms = Object.create(null);
  for (const t of DATA_TRANSFORMATIONS) {
    let ok = true;
    for (const [tag, need] of Object.entries(t.tagsNeed)) {
      if ((tags[tag] || 0) < need) { ok = false; break; }
    }
    if (ok) {
      L.transforms[t.id] = true;
      if (t.bonus.dmgMul) m.dmgMul *= t.bonus.dmgMul;
      if (t.bonus.fireTrail) m.fireTrail = true;
      if (t.bonus.halo) m.halo = true;
      if (t.bonus.holyShots) m.holyShots = true;
      if (t.bonus.paletteShift) m.paletteShift = t.bonus.paletteShift;
    }
  }
  L.mods = m;
}

function grantItem(L, id) {
  if (!L.stacks[id]) { L.stacks[id] = 0; L.items.push(id); }
  L.stacks[id]++;
  recalcLoadout(L);
}

function grantRelic(L, id) {
  if (!L.relics.includes(id)) L.relics.push(id);
  if (id === 'xp_magnet') L.stats.pickupMul *= 1.5;
}

function applyUpgrade(L, hero, up) {
  const a = up.apply;
  if (a.dmgMul) L.stats.dmgMul *= a.dmgMul;
  if (a.fireRateMul) L.stats.fireRateMul *= a.fireRateMul;
  if (a.speedMul) L.stats.speedMul *= a.speedMul;
  if (a.maxHpAdd) { L.stats.maxHpAdd += a.maxHpAdd; hero.maxHp += a.maxHpAdd; if (a.heal) hero.hp = Math.min(hero.maxHp, hero.hp + a.heal); }
  if (a.pickupMul) L.stats.pickupMul *= a.pickupMul;
  if (a.reroll) L.stats.rerolls += a.reroll;
  if (a.extraChoice) L.stats.extraChoice += a.extraChoice;
  if (a.luckAdd) L.stats.luck += a.luckAdd;
}

function applyAltar(L, hero, altar) {
  const a = altar.apply;
  if (a.dmgMul) L.stats.dmgMul *= a.dmgMul;
  if (a.fireRateMul) L.stats.fireRateMul *= a.fireRateMul;
  if (a.maxHpMul) {
    L.stats.maxHpMul *= a.maxHpMul;
    hero.maxHp = Math.max(1, Math.floor(hero.maxHp * a.maxHpMul));
    hero.hp = Math.min(hero.hp, hero.maxHp);
  }
  if (a.speedMul) L.stats.speedMul *= a.speedMul;
  if (a.extraChoice) L.stats.extraChoice += a.extraChoice;
  if (a.noHeal) L.stats.noHeal = true;
  if (a.dmgTakenMul) L.stats.dmgTakenMul *= a.dmgTakenMul;
}

function pickChoices(pool, n, ownedSet) {
  const arr = pool.slice();
  // shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

function synergyHint(L, item) {
  if (!item.hint) return '';
  const owned = L.items.map(itemDef).filter(Boolean);
  const tags = item.tags || [];
  for (const o of owned) {
    for (const t of tags) {
      if (o.tags.includes(t) && o.id !== item.id) return 'Синергия с: ' + o.name;
    }
  }
  // check known combo partners by hint text keywords
  return item.hint || '';
}
