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
  marine: {
    id: 'marine',
    full: 'art/marine_game.png',
    fullSize: [52, 72],
    drawHeight: 52,
    // whole-sprite static pose; bob/flash handled in renderer
    anims: null
  }
};
