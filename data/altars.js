window.DATA_ALTARS = [
  { id: 'blood_oath', name: 'Кровавая клятва',
    buff: '+50% урон', debuff: 'Нет лечения',
    apply: { dmgMul: 1.5, noHeal: true }, color: '#a22' },
  { id: 'warp_gaze', name: 'Взгляд Варпа',
    buff: '+40% скорость стрельбы', debuff: '−20% макс. HP',
    apply: { fireRateMul: 1.4, maxHpMul: 0.8 }, color: '#a4f' },
  { id: 'iron_vow', name: 'Железный обет',
    buff: '+30% макс. HP', debuff: '−15% скорость',
    apply: { maxHpMul: 1.3, speedMul: 0.85 }, color: '#888' },
  { id: 'swarm_pact', name: 'Пакт Роя',
    buff: '+1 выбор на уровне', debuff: '+20% входящий урон',
    apply: { extraChoice: 1, dmgTakenMul: 1.2 }, color: '#3a6a3a' }
];
