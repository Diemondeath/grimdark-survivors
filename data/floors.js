window.DATA_FLOORS = [
  {
    id: 1, name: 'Подhive', fullName: 'Подземный улей',
    subtitle: 'Культ Генокрадов',
    arenaW: 9, arenaH: 8, // screens
    objectives: ['capture', 'elite', 'nest'],
    waveBase: 8, waveRamp: 1.15, aggressionBase: 1
  },
  {
    id: 2, name: 'Мануфакторум', fullName: 'Мануфакторум',
    subtitle: 'Силы Хаоса',
    arenaW: 9, arenaH: 9,
    objectives: ['capture', 'elite', 'nest'],
    waveBase: 10, waveRamp: 1.2, aggressionBase: 1.15
  },
  {
    id: 3, name: 'Поверхность', fullName: 'Поверхность улья',
    subtitle: 'Тираниды',
    arenaW: 10, arenaH: 9,
    objectives: ['capture', 'elite', 'nest'],
    waveBase: 12, waveRamp: 1.25, aggressionBase: 1.3
  }
];

window.DATA_OBJECTIVES = {
  capture: { name: 'Захват', desc: 'Удерживай точку', icon: '◎', duration: 5 },
  elite: { name: 'Элита', desc: 'Убей элиту', icon: '☠' },
  nest: { name: 'Гнездо', desc: 'Уничтожь гнездо', icon: '⌂', hp: 400 }
};

window.DATA_UPGRADES = [
  { id: 'damage', name: 'Урон', icon: '⚔', desc: '+12% урон', apply: { dmgMul: 1.12 } },
  { id: 'firerate', name: 'Скорострельность', icon: '»', desc: '+10% темп огня', apply: { fireRateMul: 1.1 } },
  { id: 'speed', name: 'Скорость', icon: '≫', desc: '+8% скорость', apply: { speedMul: 1.08 } },
  { id: 'maxhp', name: 'Живучесть', icon: '♥', desc: '+15 макс. HP и лечение', apply: { maxHpAdd: 15, heal: 15 } },
  { id: 'pickup', name: 'Магнит', icon: '◉', desc: '+25% радиус подбора', apply: { pickupMul: 1.25 } },
  { id: 'reroll', name: 'Реролл', icon: '🎲', desc: '+1 реролл выбора', apply: { reroll: 1 } },
  { id: 'choice', name: 'Выбор', icon: '+', desc: '+1 вариант на экране выбора', apply: { extraChoice: 1 } },
  { id: 'luck', name: 'Удача', icon: '★', desc: '+10% удача (редкие сундуки)', apply: { luckAdd: 0.1 } }
];
