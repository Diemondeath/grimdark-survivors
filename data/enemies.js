/** Enemy archetypes per floor + elites + bosses */
window.DATA_ENEMIES = {
  elites: {
    burning: { name: 'Пылающий', colorMul: '#f63', hpMul: 1.3, speedMul: 1.1, onDeath: 'burn_pool' },
    shielded: { name: 'Щитовой', colorMul: '#6cf', hpMul: 1.5, shield: 0.4 },
    splitting: { name: 'Дробящийся', colorMul: '#c9f', hpMul: 1.2, onDeath: 'split2' }
  },
  floors: {
    1: {
      faction: 'genestealer',
      swarm: { id: 'cultist', name: 'Культист', hp: 18, speed: 70, damage: 6, radius: 10, xp: 3, color: '#6a4a5a', ai: 'swarm' },
      charger: { id: 'hybrid', name: 'Гибрид', hp: 45, speed: 130, damage: 12, radius: 12, xp: 8, color: '#8a3a6a', ai: 'charge', chargeCd: 2.5 },
      elite: { id: 'abrofan', name: 'Абоминант', hp: 160, speed: 55, damage: 18, radius: 18, xp: 35, color: '#4a2a4a', ai: 'tank', isElite: true },
      boss: { id: 'patriarch', name: 'Патриарх Культа', hp: 2200, speed: 75, damage: 22, radius: 28, xp: 200, color: '#5a1a4a', ai: 'boss_patriarch', isBoss: true }
    },
    2: {
      faction: 'chaos',
      swarm: { id: 'chaos_cultist', name: 'Хаосит', hp: 22, speed: 75, damage: 7, radius: 10, xp: 4, color: '#6a2a2a', ai: 'swarm' },
      charger: { id: 'daemonette', name: 'Демонетка', hp: 38, speed: 160, damage: 14, radius: 11, xp: 10, color: '#c46a9a', ai: 'dash', dashCd: 1.8 },
      elite: { id: 'chaos_marine', name: 'Космодесантник Хаоса', hp: 200, speed: 50, damage: 16, radius: 16, xp: 40, color: '#4a1010', ai: 'shooter', shootCd: 1.4, isElite: true },
      boss: { id: 'chaos_lord', name: 'Лорд Хаоса', hp: 2800, speed: 65, damage: 26, radius: 26, xp: 250, color: '#3a0808', ai: 'boss_lord', isBoss: true }
    },
    3: {
      faction: 'tyranid',
      swarm: { id: 'termagant', name: 'Термагант', hp: 16, speed: 85, damage: 6, radius: 9, xp: 3, color: '#4a6a3a', ai: 'swarm' },
      charger: { id: 'hormagaunt', name: 'Хормагант', hp: 32, speed: 175, damage: 13, radius: 11, xp: 9, color: '#3a8a4a', ai: 'dash', dashCd: 1.5 },
      elite: { id: 'warrior', name: 'Воин Тиранидов', hp: 240, speed: 60, damage: 20, radius: 17, xp: 45, color: '#2a5a2a', ai: 'acid_shooter', shootCd: 1.6, isElite: true },
      boss: { id: 'carnifex', name: 'Карнифекс', hp: 3600, speed: 55, damage: 30, radius: 32, xp: 300, color: '#1a4a1a', ai: 'boss_beast', isBoss: true }
    }
  }
};
