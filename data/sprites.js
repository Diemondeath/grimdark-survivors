/** Shared sprite packs (paths + frame meta) — portable to Unity */
window.DATA_SPRITES = {
  cultist: {
    id: 'cultist',
    full: 'art/cultist/full.png',
    fullSize: [55, 96],
    drawHeight: 40,
    anims: {
      idle:   { sheet: 'art/cultist/idle_sheet.png',   frames: 8, frameW: 54, frameH: 96, fps: 8 },
      walk:   { sheet: 'art/cultist/walk_sheet.png',   frames: 8, frameW: 58, frameH: 96, fps: 10 },
      attack: { sheet: 'art/cultist/attack_sheet.png', frames: 9, frameW: 59, frameH: 96, fps: 14 },
      hit:    { sheet: 'art/cultist/hit_sheet.png',    frames: 8, frameW: 66, frameH: 96, fps: 16 }
    }
  },
  hybrid: {
    id: 'hybrid',
    full: 'art/hybrid/full.png',
    fullSize: [85, 128],
    drawHeight: 56,
    anims: {
      idle:   { sheet: 'art/hybrid/idle_sheet.png',   frames: 8, frameW: 84, frameH: 128, fps: 8 },
      walk:   { sheet: 'art/hybrid/walk_sheet.png',   frames: 8, frameW: 87, frameH: 128, fps: 10 },
      attack: { sheet: 'art/hybrid/attack_sheet.png', frames: 10, frameW: 100, frameH: 128, fps: 14 },
      hit:    { sheet: 'art/hybrid/hit_sheet.png',    frames: 8, frameW: 93, frameH: 128, fps: 16 }
    }
  },
  brute: {
    id: 'brute',
    full: 'art/brute/full.png',
    fullSize: [122, 168],
    drawHeight: 80,
    anims: {
      idle:   { sheet: 'art/brute/idle_sheet.png',   frames: 8, frameW: 120, frameH: 168, fps: 8 },
      walk:   { sheet: 'art/brute/walk_sheet.png',   frames: 8, frameW: 123, frameH: 168, fps: 10 },
      attack: { sheet: 'art/brute/attack_sheet.png', frames: 10, frameW: 120, frameH: 168, fps: 14 },
      hit:    { sheet: 'art/brute/hit_sheet.png',    frames: 8, frameW: 131, frameH: 168, fps: 16 }
    }
  },
  patriarch: {
    id: 'patriarch',
    full: 'art/patriarch/full.png',
    fullSize: [227, 256],
    drawHeight: 128,
    anims: {
      idle:   { sheet: 'art/patriarch/idle_sheet.png',   frames: 8, frameW: 223, frameH: 256, fps: 8 },
      walk:   { sheet: 'art/patriarch/walk_sheet.png',   frames: 8, frameW: 229, frameH: 256, fps: 10 },
      attack: { sheet: 'art/patriarch/attack_sheet.png', frames: 10, frameW: 221, frameH: 256, fps: 14 },
      hit:    { sheet: 'art/patriarch/hit_sheet.png',    frames: 8, frameW: 242, frameH: 256, fps: 16 }
    }
  },
  chaos_cultist: {
    id: 'chaos_cultist',
    full: 'art/chaos_cultist/full.png',
    fullSize: [66, 96],
    drawHeight: 40,
    anims: {
      idle: { sheet: 'art/chaos_cultist/idle_sheet.png', frames: 8, frameW: 66, frameH: 96, fps: 8 },
      walk: { sheet: 'art/chaos_cultist/walk_sheet.png', frames: 8, frameW: 69, frameH: 96, fps: 10 },
      attack: { sheet: 'art/chaos_cultist/attack_sheet.png', frames: 10, frameW: 76, frameH: 96, fps: 14 },
      hit: { sheet: 'art/chaos_cultist/hit_sheet.png', frames: 8, frameW: 70, frameH: 96, fps: 16 }
    }
  },
  traitor: {
    id: 'traitor',
    full: 'art/traitor/full.png',
    fullSize: [85, 128],
    drawHeight: 56,
    anims: {
      idle: { sheet: 'art/traitor/idle_sheet.png', frames: 8, frameW: 84, frameH: 128, fps: 8 },
      walk: { sheet: 'art/traitor/walk_sheet.png', frames: 8, frameW: 88, frameH: 128, fps: 10 },
      attack: { sheet: 'art/traitor/attack_sheet.png', frames: 9, frameW: 86, frameH: 128, fps: 14 },
      hit: { sheet: 'art/traitor/hit_sheet.png', frames: 8, frameW: 96, frameH: 128, fps: 16 }
    }
  },
  possessed: {
    id: 'possessed',
    full: 'art/possessed/full.png',
    fullSize: [126, 168],
    drawHeight: 80,
    anims: {
      idle: { sheet: 'art/possessed/idle_sheet.png', frames: 8, frameW: 125, frameH: 168, fps: 8 },
      walk: { sheet: 'art/possessed/walk_sheet.png', frames: 8, frameW: 128, frameH: 168, fps: 10 },
      attack: { sheet: 'art/possessed/attack_sheet.png', frames: 10, frameW: 143, frameH: 168, fps: 14 },
      hit: { sheet: 'art/possessed/hit_sheet.png', frames: 8, frameW: 135, frameH: 168, fps: 16 }
    }
  },
  daemon_prince: {
    id: 'daemon_prince',
    full: 'art/daemon_prince/full.png',
    fullSize: [244, 256],
    drawHeight: 128,
    anims: {
      idle: { sheet: 'art/daemon_prince/idle_sheet.png', frames: 8, frameW: 240, frameH: 256, fps: 8 },
      walk: { sheet: 'art/daemon_prince/walk_sheet.png', frames: 8, frameW: 248, frameH: 256, fps: 10 },
      attack: { sheet: 'art/daemon_prince/attack_sheet.png', frames: 10, frameW: 240, frameH: 256, fps: 14 },
      hit: { sheet: 'art/daemon_prince/hit_sheet.png', frames: 8, frameW: 275, frameH: 256, fps: 16 }
    }
  },
  marine: {
    id: 'marine',
    full: 'art/marine_game.png',
    fullSize: [52, 72],
    drawHeight: 52,
    // whole-sprite static pose; bob/flash handled in renderer
    anims: null
  }
};
