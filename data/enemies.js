/** Enemy archetypes per floor + elites + bosses (sprite paths/scale for Unity port) */
window.DATA_ENEMIES = {
  elites: {
    burning: { name: 'Пылающий', colorMul: '#f63', hpMul: 1.3, speedMul: 1.1, onDeath: 'burn_pool' },
    shielded: { name: 'Щитовой', colorMul: '#6cf', hpMul: 1.5, shield: 0.4 },
    splitting: { name: 'Дробящийся', colorMul: '#c9f', hpMul: 1.2, onDeath: 'split2' }
  },
  floors: {
    1: {
      faction: 'genestealer',
      // cultist = small ranged
      swarm: {
        id: 'cultist', name: 'Культист',
        hp: 18, speed: 62, damage: 6, radius: 10, xp: 3, color: '#6a4a5a',
        ai: 'shooter', shootCd: 1.7,
        sprite: 'cultist', drawHeight: 40, scale: 1
      },
      // hybrid = medium melee
      charger: {
        id: 'hybrid', name: 'Гибрид',
        hp: 45, speed: 130, damage: 12, radius: 13, xp: 8, color: '#8a3a6a',
        ai: 'charge', chargeCd: 2.5,
        sprite: 'hybrid', drawHeight: 56, scale: 1
      },
      // brute = large slow melee hammer
      elite: {
        id: 'brute', name: 'Брут Культа',
        hp: 180, speed: 48, damage: 20, radius: 20, xp: 40, color: '#4a2a4a',
        ai: 'tank', isElite: true,
        sprite: 'brute', drawHeight: 80, scale: 1
      },
      // patriarch = huge four-armed boss
      boss: {
        id: 'patriarch', name: 'Патриарх Культа',
        hp: 2200, speed: 70, damage: 22, radius: 32, xp: 200, color: '#5a1a4a',
        ai: 'boss_patriarch', isBoss: true,
        sprite: 'patriarch', drawHeight: 128, scale: 1
      }
    },
    2: {
      faction: 'chaos',
      swarm: { id: 'chaos_cultist', name: 'Хаосит', hp: 22, speed: 75, damage: 7, radius: 10, xp: 4, color: '#6a2a2a', ai: 'swarm', sprite: null, drawHeight: 36 },
      charger: { id: 'daemonette', name: 'Демонетка', hp: 38, speed: 160, damage: 14, radius: 11, xp: 10, color: '#c46a9a', ai: 'dash', dashCd: 1.8, sprite: null, drawHeight: 42 },
      elite: { id: 'chaos_marine', name: 'Космодесантник Хаоса', hp: 200, speed: 50, damage: 16, radius: 16, xp: 40, color: '#4a1010', ai: 'shooter', shootCd: 1.4, isElite: true, sprite: null, drawHeight: 56 },
      boss: { id: 'chaos_lord', name: 'Лорд Хаоса', hp: 2800, speed: 65, damage: 26, radius: 26, xp: 250, color: '#3a0808', ai: 'boss_lord', isBoss: true, sprite: null, drawHeight: 90 }
    },
    3: {
      faction: 'tyranid',
      swarm: { id: 'termagant', name: 'Термагант', hp: 16, speed: 85, damage: 6, radius: 9, xp: 3, color: '#4a6a3a', ai: 'swarm', sprite: null, drawHeight: 34 },
      charger: { id: 'hormagaunt', name: 'Хормагант', hp: 32, speed: 175, damage: 13, radius: 11, xp: 9, color: '#3a8a4a', ai: 'dash', dashCd: 1.5, sprite: null, drawHeight: 42 },
      elite: { id: 'warrior', name: 'Воин Тиранидов', hp: 240, speed: 60, damage: 20, radius: 17, xp: 45, color: '#2a5a2a', ai: 'acid_shooter', shootCd: 1.6, isElite: true, sprite: null, drawHeight: 60 },
      boss: { id: 'carnifex', name: 'Карнифекс', hp: 3600, speed: 55, damage: 30, radius: 32, xp: 300, color: '#1a4a1a', ai: 'boss_beast', isBoss: true, sprite: null, drawHeight: 110 }
    }
  }
};

// Attach shared sprite packs onto floor-1 defs (and any matching sprite id)
(function bindEnemySprites() {
  const packs = window.DATA_SPRITES || {};
  const roleFallback = { swarm: 'cultist', charger: 'hybrid', elite: 'brute', boss: 'patriarch' };
  for (const floor of Object.values(DATA_ENEMIES.floors)) {
    for (const key of ['swarm', 'charger', 'elite', 'boss']) {
      const def = floor[key];
      if (!def) continue;
      if (!def.sprite) def.sprite = roleFallback[key];
      if (def.sprite && packs[def.sprite]) {
        def.sprites = packs[def.sprite];
        if (def.drawHeight == null) def.drawHeight = packs[def.sprite].drawHeight;
      }
    }
  }
})();
