/** Drawing: iso world, chibi entities, HUD chrome overlays drawn on canvas */
const Render = (() => {
  let shakeX = 0, shakeY = 0, shakeT = 0;
  const dmgNums = [];
  let showDmg = true;

  function setShowDmg(v) { showDmg = v; }
  function addShake(a) { shakeT = Math.max(shakeT, a); }
  function addDmgNum(x, y, n, crit) {
    if (!showDmg) return;
    dmgNums.push({ x, y, n: Math.round(n), t: 0.7, crit: !!crit, vy: -40 });
  }

  function update(dt) {
    if (shakeT > 0) {
      shakeT -= dt;
      shakeX = (Math.random() - 0.5) * shakeT * 18;
      shakeY = (Math.random() - 0.5) * shakeT * 18;
    } else shakeX = shakeY = 0;
    for (let i = dmgNums.length - 1; i >= 0; i--) {
      const d = dmgNums[i];
      d.t -= dt; d.y += d.vy * dt; d.vy += 30 * dt;
      if (d.t <= 0) dmgNums.splice(i, 1);
    }
  }

  function clear(ctx, w, h, fog) {
    ctx.fillStyle = fog || '#0a0a0f';
    ctx.fillRect(0, 0, w, h);
  }

  /** Project world to screen with camera */
  function W2S(wx, wy, cam, scale) {
    const s = scale || 1;
    return {
      x: (wx - wy) * s - cam.x + shakeX,
      y: (wx + wy) * 0.5 * s - cam.y + shakeY
    };
  }

  function drawDiamond(ctx, x, y, w, h, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x - w, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  function drawObstacle(ctx, o, cam, scale, pal) {
    const p = W2S(o.cx != null ? o.cx : o.x + o.w / 2, o.cy != null ? o.cy : o.y + o.h / 2, cam, scale);
    const hw = o.w * scale * 0.35, hh = o.h * scale * 0.2;
    // box extruded
    const elev = 18 * scale;
    ctx.beginPath();
    ctx.moveTo(p.x - hw, p.y);
    ctx.lineTo(p.x, p.y + hh);
    ctx.lineTo(p.x, p.y + hh - elev);
    ctx.lineTo(p.x - hw, p.y - elev);
    ctx.closePath();
    ctx.fillStyle = pal.wall;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x + hw, p.y);
    ctx.lineTo(p.x, p.y + hh);
    ctx.lineTo(p.x, p.y + hh - elev);
    ctx.lineTo(p.x + hw, p.y - elev);
    ctx.closePath();
    ctx.fillStyle = shade(pal.wall, 0.7);
    ctx.fill();
    drawDiamond(ctx, p.x, p.y - elev, hw, hh, shade(pal.accent, 1.1), '#000');
  }

  function shade(hex, m) {
    const c = parseInt(hex.slice(1), 16);
    let r = ((c >> 16) & 255) * m | 0;
    let g = ((c >> 8) & 255) * m | 0;
    let b = (c & 255) * m | 0;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawFloorTile(ctx, wx, wy, cam, scale, pal, solid) {
    const p = W2S(wx, wy, cam, scale);
    const hw = 16 * scale, hh = 8 * scale;
    drawDiamond(ctx, p.x, p.y, hw, hh, solid ? pal.ground : shade(pal.ground, 0.85), shade(pal.ground, 0.6));
  }

  /** Chibi Space Marine */
  function drawMarine(ctx, p, facing, pal, flash, mods, scale) {
    const s = 1.15 * (scale || 1);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (facing < 0) ctx.scale(-1, 1);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 4, 14 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    // legs
    ctx.fillStyle = flash ? '#fff' : pal.armorDark;
    ctx.fillRect(-7 * s, -2 * s, 5 * s, 10 * s);
    ctx.fillRect(2 * s, -2 * s, 5 * s, 10 * s);
    // body
    ctx.fillStyle = flash ? '#fff' : (mods && mods.paletteShift) || pal.armor;
    roundRect(ctx, -10 * s, -18 * s, 20 * s, 18 * s, 3 * s);
    ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    // pauldrons (big)
    ctx.fillStyle = flash ? '#fff' : pal.trim;
    ctx.beginPath(); ctx.ellipse(-12 * s, -14 * s, 8 * s, 6 * s, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(12 * s, -14 * s, 8 * s, 6 * s, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // head / helmet (big)
    ctx.fillStyle = flash ? '#fff' : pal.armor;
    ctx.beginPath(); ctx.ellipse(0, -28 * s, 12 * s, 13 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.stroke();
    // visor
    ctx.fillStyle = flash ? '#fff' : pal.glow;
    roundRect(ctx, -8 * s, -30 * s, 16 * s, 5 * s, 2 * s);
    ctx.fill();
    // trim crest
    ctx.fillStyle = pal.trim;
    ctx.fillRect(-2 * s, -42 * s, 4 * s, 8 * s);
    // bolter
    ctx.fillStyle = '#333';
    roundRect(ctx, 8 * s, -14 * s, 18 * s, 5 * s, 1);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.fillRect(22 * s, -16 * s, 6 * s, 4 * s);
    // halo
    if (mods && mods.halo) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -44 * s, 14 * s, 5 * s, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // fire trail mark
    if (mods && mods.fireTrail) {
      ctx.fillStyle = 'rgba(255,100,30,0.5)';
      ctx.beginPath(); ctx.arc(-4 * s, 6 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawEnemy(ctx, e, cam, scale) {
    const p = W2S(e.x, e.y, cam, scale);
    const s = (e.radius / 10) * scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 3, 10 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
    const col = e.flash > 0 ? '#fff' : e.color;
    // body blob chibi
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, -6 * s, 9 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.stroke();
    // head
    ctx.beginPath();
    ctx.ellipse(0, -16 * s, 7 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // eyes
    ctx.fillStyle = e.isBoss ? '#f00' : '#ff0';
    ctx.beginPath(); ctx.arc(-3 * s, -17 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3 * s, -17 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
    if (e.eliteType === 'shielded' && e.shield > 0) {
      ctx.strokeStyle = 'rgba(100,200,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -8 * s, 14 * s, 0, Math.PI * 2); ctx.stroke();
    }
    if (e.eliteType === 'burning') {
      ctx.fillStyle = 'rgba(255,80,20,0.6)';
      ctx.beginPath(); ctx.arc(0, -20 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
    }
    // hp bar for elites/boss
    if (e.isElite || e.isBoss) {
      const pct = e.hp / e.maxHp;
      ctx.fillStyle = '#000';
      ctx.fillRect(-12 * s, -28 * s, 24 * s, 3);
      ctx.fillStyle = e.isBoss ? '#f44' : '#fa0';
      ctx.fillRect(-12 * s, -28 * s, 24 * s * pct, 3);
    }
    ctx.restore();
  }

  function drawProjectile(ctx, b, cam, scale) {
    const p = W2S(b.x, b.y, cam, scale);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = b.color || '#fc6';
    ctx.beginPath();
    ctx.arc(0, 0, b.size * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    if (b.holy) {
      ctx.strokeStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(0, 0, b.size * scale + 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPickup(ctx, pk, cam, scale) {
    const p = W2S(pk.x, pk.y, cam, scale);
    ctx.save();
    ctx.translate(p.x, p.y - Math.sin(pk.t * 6) * 3);
    if (pk.type === 'xp') {
      ctx.fillStyle = '#6f6';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke();
    } else if (pk.type === 'chest') {
      ctx.fillStyle = pk.rare ? '#fc6' : '#a84';
      roundRect(ctx, -8, -8, 16, 12, 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.stroke();
      ctx.fillStyle = pk.rare ? '#ff0' : '#ca6';
      ctx.fillRect(-8, -3, 16, 3);
    } else if (pk.type === 'heal') {
      ctx.fillStyle = '#f36';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    }
    ctx.restore();
  }

  function drawPool(ctx, pl, cam, scale) {
    const p = W2S(pl.x, pl.y, cam, scale);
    ctx.globalAlpha = Math.min(1, pl.life / 0.5) * 0.55;
    ctx.fillStyle = pl.color;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, pl.r * scale, pl.r * 0.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawObjective(ctx, obj, cam, scale) {
    const p = W2S(obj.x, obj.y, cam, scale);
    if (obj.type === 'capture') {
      ctx.strokeStyle = obj.done ? '#4f4' : '#4af';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, obj.r * scale, obj.r * 0.5 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (obj.progress > 0 && !obj.done) {
        ctx.strokeStyle = '#8cf';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, obj.r * scale, obj.r * 0.5 * scale, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * obj.progress);
        ctx.stroke();
      }
    } else if (obj.type === 'nest') {
      ctx.fillStyle = obj.done ? '#444' : '#5a3a2a';
      drawDiamond(ctx, p.x, p.y - 10, 22 * scale, 12 * scale, ctx.fillStyle, '#000');
      if (!obj.done) {
        const pct = obj.hp / obj.maxHp;
        ctx.fillStyle = '#000'; ctx.fillRect(p.x - 16, p.y - 36, 32, 4);
        ctx.fillStyle = '#f84'; ctx.fillRect(p.x - 16, p.y - 36, 32 * pct, 4);
      }
    } else if (obj.type === 'elite' && !obj.done) {
      ctx.strokeStyle = '#f44';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 20, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawAltar(ctx, a, cam, scale) {
    if (a.used) return;
    const p = W2S(a.x, a.y, cam, scale);
    ctx.fillStyle = a.color || '#888';
    drawDiamond(ctx, p.x, p.y - 8, 14, 8, a.color, '#000');
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✝', p.x, p.y - 18);
  }

  function drawLift(ctx, L, cam, scale) {
    if (!L) return;
    const p = W2S(L.x, L.y, cam, scale);
    const pulse = 0.7 + Math.sin(performance.now() / 200) * 0.3;
    ctx.strokeStyle = `rgba(100,200,255,${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 28 * scale, 14 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(80,160,255,${0.25 * pulse})`;
    ctx.fill();
    ctx.fillStyle = '#cff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ЛИФТ', p.x, p.y + 4);
  }

  function drawDmgNums(ctx, cam, scale) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px sans-serif';
    for (const d of dmgNums) {
      const p = W2S(d.x, d.y, cam, scale);
      ctx.globalAlpha = Math.min(1, d.t * 2);
      ctx.fillStyle = d.crit ? '#ff0' : '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText(String(d.n), p.x, p.y);
      ctx.fillText(String(d.n), p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawJoystick(ctx) {
    if (!Input.joyActive) return;
    const o = Input.joyOrigin, v = Input.joyVec;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(o.x, o.y, 54, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(o.x + v.x * 54, o.y + v.y * 54, 22, 0, Math.PI * 2); ctx.fill();
  }

  function drawAbilityBtn(ctx, cdFrac, ready) {
    const b = Input.abilityBtn;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = ready ? 'rgba(70,120,220,0.55)' : 'rgba(40,40,60,0.55)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9bf'; ctx.lineWidth = 2; ctx.stroke();
    if (cdFrac > 0 && cdFrac < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cdFrac);
      ctx.closePath(); ctx.fill();
    }
    // ring
    ctx.strokeStyle = ready ? '#4af' : '#668';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cdFrac));
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ПРЫЖОК', b.x, b.y);
    ctx.restore();
  }

  function drawArrowTo(ctx, fromX, fromY, toWX, toWY, cam, scale, color, label) {
    const p = W2S(toWX, toWY, cam, scale);
    const w = ctx.canvas.clientWidth, h = ctx.canvas.clientHeight;
    // if on screen, skip arrow tip at edge
    if (p.x > 40 && p.x < w - 40 && p.y > 60 && p.y < h - 40) return;
    const cx = w / 2, cy = h / 2;
    let dx = p.x - cx, dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    // intersect with margin rect
    const margin = 36;
    let t = Infinity;
    if (dx > 0) t = Math.min(t, (w - margin - cx) / dx);
    if (dx < 0) t = Math.min(t, (margin - cx) / dx);
    if (dy > 0) t = Math.min(t, (h - margin - cy) / dy);
    if (dy < 0) t = Math.min(t, (margin - cy) / dy);
    const ax = cx + dx * t, ay = cy + dy * t;
    ctx.fillStyle = color || '#4af';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - dx * 14 - dy * 8, ay - dy * 14 + dx * 8);
    ctx.lineTo(ax - dx * 14 + dy * 8, ay - dy * 14 - dx * 8);
    ctx.closePath();
    ctx.fill();
    if (label) {
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, ax - dx * 22, ay - dy * 22);
    }
  }

  return {
    update, clear, W2S, drawObstacle, drawMarine, drawEnemy, drawProjectile,
    drawPickup, drawPool, drawObjective, drawAltar, drawLift, drawDmgNums,
    drawJoystick, drawAbilityBtn, drawArrowTo, addShake, addDmgNum, setShowDmg,
    shade, drawDiamond, get showDmg() { return showDmg; }
  };
})();
