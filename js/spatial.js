/** Uniform grid for broadphase */
class SpatialGrid {
  constructor(cell = 96) {
    this.cell = cell;
    this.map = new Map();
  }
  key(cx, cy) { return cx + ',' + cy; }
  clear() { this.map.clear(); }
  insert(obj) {
    const c = this.cell;
    const cx = (obj.x / c) | 0, cy = (obj.y / c) | 0;
    obj._sx = cx; obj._sy = cy;
    const k = this.key(cx, cy);
    let b = this.map.get(k);
    if (!b) { b = []; this.map.set(k, b); }
    b.push(obj);
  }
  queryRadius(x, y, r, out) {
    out.length = 0;
    const c = this.cell;
    const r2 = r * r;
    const minX = ((x - r) / c) | 0, maxX = ((x + r) / c) | 0;
    const minY = ((y - r) / c) | 0, maxY = ((y + r) / c) | 0;
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const b = this.map.get(this.key(cx, cy));
        if (!b) continue;
        for (let i = 0; i < b.length; i++) {
          const o = b[i];
          if (!o._alive) continue;
          const dx = o.x - x, dy = o.y - y;
          if (dx * dx + dy * dy <= r2) out.push(o);
        }
      }
    }
    return out;
  }
  nearest(x, y, maxR, out) {
    this.queryRadius(x, y, maxR, out);
    let best = null, bestD = maxR * maxR;
    for (let i = 0; i < out.length; i++) {
      const o = out[i];
      const dx = o.x - x, dy = o.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }
}
