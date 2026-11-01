/** 15 items with tags — stackable shot modifiers */
window.DATA_ITEMS = [
  { id: 'homing', name: 'Самонаведение', tags: ['Тех'], icon: '◎', color: '#6cf',
    desc: 'Снаряды наводятся на врагов', hint: 'Синергия с Тройным залпом' },
  { id: 'split', name: 'Тройной залп', tags: ['Взрыв','Огонь'], icon: 'Ⅲ', color: '#fc6',
    desc: 'Выстрел делится на 3', hint: 'Синергия с Самонаведением' },
  { id: 'ricochet', name: 'Рикошет', tags: ['Тех'], icon: '↺', color: '#9f9',
    desc: 'Отскок от врагов (до 3)', hint: 'Синергия с Поджигом' },
  { id: 'pierce', name: 'Бронебой', tags: ['Тех','Кровь'], icon: '⇉', color: '#ccc',
    desc: 'Пробивает врагов', hint: 'Синергия со Взрывом' },
  { id: 'burn', name: 'Поджиг', tags: ['Огонь'], icon: '🔥', color: '#f63',
    desc: 'Поджог со временем', hint: 'Синергия с Рикошетом' },
  { id: 'poison', name: 'Кислота', tags: ['Рой','Варп'], icon: '☣', color: '#6f3',
    desc: 'Кислотные лужи при убийстве', hint: 'Синергия с Цепью молний' },
  { id: 'orbit', name: 'Осколки орбиты', tags: ['Тех','Взрыв'], icon: '✧', color: '#c9f',
    desc: 'Орбитальные осколки вокруг героя' },
  { id: 'chain', name: 'Цепь молний', tags: ['Варп','Тех'], icon: '⚡', color: '#8ff',
    desc: 'Молния перескакивает на соседей', hint: 'Синергия с Кислотой' },
  { id: 'bigshot', name: 'Тяжёлые снаряды', tags: ['Взрыв'], icon: '●', color: '#fa0',
    desc: 'Крупнее, медленнее, больше урона' },
  { id: 'rapid', name: 'Скорострел', tags: ['Огонь','Тех'], icon: '»', color: '#ff6',
    desc: 'Ускоряет темп стрельбы' },
  { id: 'explode', name: 'Разрывной', tags: ['Взрыв','Огонь'], icon: '💥', color: '#f44',
    desc: 'Взрыв при попадании', hint: 'Синергия с Бронебоем' },
  { id: 'lifesteal', name: 'Кровосос', tags: ['Кровь'], icon: '♥', color: '#f36',
    desc: 'Часть урона лечит героя' },
  { id: 'drone', name: 'Сервочереп', tags: ['Тех'], icon: '◉', color: '#aad',
    desc: 'Дрон-спутник стреляет сам' },
  { id: 'holy', name: 'Святые болты', tags: ['Вера'], icon: '✝', color: '#ffd700',
    desc: 'Бонусный урон против Хаоса' },
  { id: 'bloodheal', name: 'Кровавая купель', tags: ['Кровь','Вера'], icon: '🩸', color: '#a22',
    desc: 'Лужи крови лечат при касании' }
];

window.DATA_TRANSFORMATIONS = [
  { id: 'salamander', tagsNeed: { 'Огонь': 3 }, name: 'Саламандра',
    desc: 'Огненный след и оранжевый облик', color: '#f63',
    bonus: { fireTrail: true, paletteShift: '#e85a20', dmgMul: 1.15 } },
  { id: 'faithful', tagsNeed: { 'Вера': 3 }, name: 'Благословенный',
    desc: 'Нимб и святые выстрелы', color: '#ffd700',
    bonus: { halo: true, holyShots: true, dmgMul: 1.1 } }
];
