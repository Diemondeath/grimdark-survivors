/** Object pool */
class Pool {
  constructor(factory, reset, size = 64) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    this.alive = [];
    for (let i = 0; i < size; i++) this.free.push(factory());
  }
  alloc(...args) {
    const o = this.free.length ? this.free.pop() : this.factory();
    this.reset(o, ...args);
    o._alive = true;
    this.alive.push(o);
    return o;
  }
  release(o) {
    if (!o._alive) return;
    o._alive = false;
  }
  collect() {
    const alive = this.alive;
    let w = 0;
    for (let i = 0; i < alive.length; i++) {
      const o = alive[i];
      if (o._alive) alive[w++] = o;
      else this.free.push(o);
    }
    alive.length = w;
  }
  clear() {
    for (const o of this.alive) { o._alive = false; this.free.push(o); }
    this.alive.length = 0;
  }
}
