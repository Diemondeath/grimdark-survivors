/** Hero race + variants (data-driven for Unity port) */
window.DATA_HEROES = {
  races: {
    space_marine: {
      id: 'space_marine',
      name: 'Космический десант',
      proportions: { head: 1.35, body: 0.85, pauldron: 1.4 },
      base: {
        hp: 100, speed: 145, damage: 12, fireRate: 2.2, burst: 3, burstGap: 0.08,
        pickupRange: 80, projectileSpeed: 420, projectileSize: 5
      }
    }
  },
  variants: [
    {
      id: 'ultramarine',
      race: 'space_marine',
      name: 'Ультрамарин',
      locked: false,
      chapter: 'Ультрамарины',
      palette: {
        armor: '#1a3a8a', armorDark: '#0d1f4a', trim: '#c9a227',
        skin: '#e8c4a0', glow: '#4af', floor: {
          1: { ground: '#2a2430', wall: '#3d3548', accent: '#5a4a6a', fog: '#1a1520' },
          2: { ground: '#2a2220', wall: '#4a3530', accent: '#6a4030', fog: '#1a1210' },
          3: { ground: '#243028', wall: '#354a38', accent: '#4a6a50', fog: '#101810' }
        }
      },
      stats: { hp: 100, speed: 145, damage: 12, fireRate: 2.2 },
      weapon: { name: 'Болтер', type: 'burst', burst: 3, burstGap: 0.08 },
      active: {
        id: 'jumppack',
        name: 'Прыжковый ранец',
        cooldown: 6,
        leapSpeed: 520,
        leapDuration: 0.45,
        slamRadius: 90,
        slamDamage: 55,
        desc: 'Прыжок в направлении стика с ударной волной'
      },
      passive: {
        id: 'emperor_protects',
        name: 'Император защищает',
        desc: 'Первый летальный удар за этаж оставляет 1 HP'
      }
    },
    {
      id: 'salamanders_preview',
      race: 'space_marine',
      name: 'Саламандра',
      locked: true,
      chapter: 'Саламандры',
      silhouette: true
    },
    {
      id: 'tau_preview',
      race: 'tau',
      name: 'Тау',
      locked: true,
      silhouette: true
    },
    {
      id: 'ork_preview',
      race: 'ork',
      name: 'Орк',
      locked: true,
      silhouette: true
    }
  ]
};
