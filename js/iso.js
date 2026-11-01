/** Isometric helpers */
const Iso = {
  // world (x,y) flat top-down -> screen
  // classic 2:1 iso
  TILE_W: 64,
  TILE_H: 32,
  toScreen(wx, wy) {
    return {
      x: (wx - wy) * (this.TILE_W / 2) / 32,
      y: (wx + wy) * (this.TILE_H / 2) / 32
    };
  },
  // We use a softer iso: screenX = wx - wy*0.5-ish? Better: pure projection
  // Use: sx = (wx - wy), sy = (wx + wy) * 0.5  scaled
  project(wx, wy, scale) {
    const s = scale || 1;
    return {
      x: (wx - wy) * s,
      y: (wx + wy) * 0.5 * s
    };
  },
  depth(wx, wy) {
    return wx + wy;
  }
};
