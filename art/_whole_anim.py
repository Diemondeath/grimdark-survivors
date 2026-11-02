#!/usr/bin/env python3
"""Whole-sprite transform animations (no cut-outs). Idle/walk/attack/hit via feet-anchored transforms + VFX."""
from __future__ import annotations
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import cv2

ART = Path('/workspace/grimdark-survivors/art')
BG = (0x28, 0x2c, 0x34)
CHARS = {
    'cultist': {'kind': 'ranged', 'walk': 'normal'},
    'hybrid': {'kind': 'claw', 'walk': 'normal'},
    'brute': {'kind': 'hammer', 'walk': 'heavy'},
    'patriarch': {'kind': 'lunge', 'walk': 'heavy'},
}

def save_rgba(arr, path):
    Image.fromarray(np.ascontiguousarray(arr.astype(np.uint8)), 'RGBA').save(path)

def bbox_of(mask):
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1

def crop_rgba(arr, box, pad=2):
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(arr.shape[1], x1 + pad), min(arr.shape[0], y1 + pad)
    return arr[y0:y1, x0:x1].copy(), (x0, y0)

def place(canvas, src, ox, oy):
    px, py = int(round(ox)), int(round(oy))
    ph, pw = src.shape[:2]
    ch, cw = canvas.shape[:2]
    x0, y0 = max(0, px), max(0, py)
    x1, y1 = min(cw, px + pw), min(ch, py + ph)
    if x0 >= x1 or y0 >= y1:
        return
    sx0, sy0 = x0 - px, y0 - py
    s = src[sy0:sy0 + (y1 - y0), sx0:sx0 + (x1 - x0)]
    d = canvas[y0:y1, x0:x1]
    sa = s[:, :, 3:4].astype(np.float32) / 255.0
    da = d[:, :, 3:4].astype(np.float32) / 255.0
    out_a = sa + da * (1 - sa)
    out_rgb = s[:, :, :3].astype(np.float32) * sa + d[:, :, :3].astype(np.float32) * da * (1 - sa)
    out_rgb = np.where(out_a > 1e-6, out_rgb / np.maximum(out_a, 1e-6), 0)
    canvas[y0:y1, x0:x1, :3] = np.clip(out_rgb, 0, 255).astype(np.uint8)
    canvas[y0:y1, x0:x1, 3] = np.clip(out_a.reshape(y1 - y0, x1 - x0) * 255, 0, 255).astype(np.uint8)

def transform_sprite(full, *, scale_x=1.0, scale_y=1.0, angle=0.0, dx=0.0, dy=0.0,
                     flash=0.0, outline=False, canvas_pad=80):
    """Transform whole sprite anchored at feet center. Returns RGBA on padded canvas."""
    H, W = full.shape[:2]
    a = full[:, :, 3] > 0
    ys, xs = np.where(a)
    foot_x = float((xs.min() + xs.max()) / 2)
    foot_y = float(ys.max())

    pad = canvas_pad + int(max(H, W) * 0.15)
    ch, cw = H + 2 * pad, W + 2 * pad
    canvas = np.zeros((ch, cw, 4), dtype=np.uint8)
    place(canvas, full, pad, pad)
    ax, ay = pad + foot_x, pad + foot_y

    if abs(scale_x - 1.0) > 1e-4 or abs(scale_y - 1.0) > 1e-4:
        M = np.array([
            [scale_x, 0, ax * (1 - scale_x)],
            [0, scale_y, ay * (1 - scale_y)],
        ], dtype=np.float32)
        canvas = cv2.warpAffine(canvas, M, (cw, ch), flags=cv2.INTER_LINEAR,
                                borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))

    if abs(angle) > 0.05:
        M = cv2.getRotationMatrix2D((ax, ay), angle, 1.0)
        canvas = cv2.warpAffine(canvas, M, (cw, ch), flags=cv2.INTER_LINEAR,
                                borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))

    if abs(dx) > 0.01 or abs(dy) > 0.01:
        M = np.array([[1, 0, dx], [0, 1, dy]], dtype=np.float32)
        canvas = cv2.warpAffine(canvas, M, (cw, ch), flags=cv2.INTER_LINEAR,
                                borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))

    if flash > 0:
        m = canvas[:, :, 3] > 0
        rgb = canvas[:, :, :3].astype(np.float32)
        canvas[m, :3] = np.clip(rgb[m] * (1 - flash) + 255 * flash, 0, 255).astype(np.uint8)

    if outline:
        alpha = (canvas[:, :, 3] > 0).astype(np.uint8)
        dil = cv2.dilate(alpha, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        ring = (dil > 0) & (alpha == 0)
        canvas[ring, :3] = (255, 255, 255)
        canvas[ring, 3] = 230

    return canvas, (ax, ay)

# ---------- VFX ----------
def draw_slash_arc(canvas, cx, cy, radius, start_deg, end_deg, color=(255, 210, 160), width=10, alpha=220):
    """Bright bone/red slash arc with glow trail."""
    overlay = np.zeros_like(canvas)
    n = 28
    pts = []
    for i in range(n + 1):
        t = i / n
        ang = math.radians(start_deg + (end_deg - start_deg) * t)
        x = int(cx + radius * math.cos(ang))
        y = int(cy + radius * 0.5 * math.sin(ang))
        pts.append((x, y))
    for i in range(len(pts) - 1):
        fade = 0.35 + 0.65 * (i / max(1, len(pts) - 2))
        a = int(alpha * fade)
        cv2.line(overlay, pts[i], pts[i + 1], (*color[:3], a), thickness=width, lineType=cv2.LINE_AA)
        cv2.line(overlay, pts[i], pts[i + 1], (255, 80, 60, int(a * 0.5)),
                 thickness=max(2, width // 3), lineType=cv2.LINE_AA)
    glow = cv2.GaussianBlur(overlay, (0, 0), 4)
    glow[:, :, 3] = (glow[:, :, 3].astype(np.float32) * 0.5).astype(np.uint8)
    place(canvas, glow, 0, 0)
    place(canvas, overlay, 0, 0)
    if pts:
        cv2.circle(canvas, pts[-1], width, (*color[:3], 255), -1, cv2.LINE_AA)
        cv2.circle(canvas, pts[-1], width + 4, (255, 100, 80, 160), 2, cv2.LINE_AA)
    return canvas

def draw_dust_burst(canvas, cx, cy, strength=1.0):
    """Ground crack + dust cloud + impact flash for hammer smash."""
    overlay = np.zeros_like(canvas)
    rng = np.random.RandomState(7)
    for i in range(9):
        ang = math.radians(-40 + i * 10 + rng.uniform(-4, 4))
        length = int((25 + i * 8) * strength)
        x2 = int(cx + length * math.cos(ang))
        y2 = int(cy + length * 0.4 * abs(math.sin(ang)) + 2)
        cv2.line(overlay, (int(cx), int(cy)), (x2, y2), (90, 75, 55, 230), 3, cv2.LINE_AA)
        if i % 2 == 0:
            mx, my = (int(cx) + x2) // 2, (int(cy) + y2) // 2
            cv2.line(overlay, (mx, my),
                     (mx + int(12 * math.cos(ang + 0.9)), my + 4),
                     (70, 60, 45, 180), 2, cv2.LINE_AA)
    for i in range(20):
        ang = rng.uniform(-math.pi, 0)
        dist = rng.uniform(8, 40) * strength
        x = int(cx + dist * math.cos(ang))
        y = int(cy - abs(dist * 0.5 * math.sin(ang)) - rng.uniform(0, 15))
        r = int(rng.uniform(3, 9) * strength)
        sh = int(rng.uniform(100, 160))
        cv2.circle(overlay, (x, y), r, (sh, sh - 15, sh - 30, int(170 * strength)), -1, cv2.LINE_AA)
    cv2.ellipse(overlay, (int(cx), int(cy)), (int(35 * strength), int(12 * strength)), 0, 0, 360,
                (200, 180, 120, 200), 3, cv2.LINE_AA)
    cv2.ellipse(overlay, (int(cx), int(cy)), (int(18 * strength), int(6 * strength)), 0, 0, 360,
                (255, 240, 180, 160), -1, cv2.LINE_AA)
    place(canvas, overlay, 0, 0)
    return canvas

def draw_muzzle_flash(canvas, full, pad):
    """Find gun barrel tip and draw bright star muzzle flash."""
    H, W = full.shape[:2]
    a = full[:, :, 3] > 0
    ys = np.where(a.any(1))[0]; xs = np.where(a.any(0))[0]
    top, bot = int(ys[0]), int(ys[-1]); left, right = int(xs[0]), int(xs[-1])
    mid_y0 = top + int(0.35 * (bot - top))
    mid_y1 = top + int(0.65 * (bot - top))
    band = a & (np.arange(H)[:, None] >= mid_y0) & (np.arange(H)[:, None] <= mid_y1)
    row = band.any(0)
    if not row.any():
        tip_x, tip_y = right - 5, (mid_y0 + mid_y1) // 2
    else:
        tip_x = int(np.where(row)[0].max())
        col = band[:, tip_x]
        tip_y = int(np.where(col)[0].mean()) if col.any() else (mid_y0 + mid_y1) // 2
    cx, cy = pad + tip_x, pad + tip_y
    overlay = np.zeros_like(canvas)
    for ang in range(0, 360, 30):
        rad = math.radians(ang)
        x2 = int(cx + 18 * math.cos(rad))
        y2 = int(cy + 12 * math.sin(rad))
        cv2.line(overlay, (cx, cy), (x2, y2), (255, 230, 120, 230), 3, cv2.LINE_AA)
    cv2.circle(overlay, (cx, cy), 8, (255, 250, 200, 250), -1, cv2.LINE_AA)
    cv2.circle(overlay, (cx, cy), 14, (255, 180, 60, 140), 3, cv2.LINE_AA)
    # smoke puff
    cv2.circle(overlay, (cx + 10, cy - 4), 5, (180, 170, 150, 100), -1, cv2.LINE_AA)
    place(canvas, overlay, 0, 0)
    return canvas

# ---------- clips ----------
def make_idle(full, n=8):
    frames = []
    for i in range(n):
        t = i / n * 2 * math.pi
        sy = 1.0 + 0.03 * math.sin(t)   # 1.0 .. 1.03 breathing
        sx = 1.0 - 0.012 * math.sin(t)
        fr, _ = transform_sprite(full, scale_x=sx, scale_y=sy)
        frames.append(fr)
    return frames

def make_walk(full, n=8, heavy=False):
    frames = []
    hop = 7 if heavy else 11
    tilt = 5 if heavy else 7
    for i in range(n):
        t = i / n * 2 * math.pi
        phase = math.cos(t)
        if phase > 0:
            sy = 1.0 - 0.08 * phase
            sx = 1.0 + 0.05 * phase
            dy = 0
        else:
            sy = 1.0 - 0.04 * phase
            sx = 1.0 + 0.025 * phase
            dy = phase * hop
        ang = math.sin(t) * tilt
        wobble = math.sin(t * 2) * (2.0 if heavy else 2.8)
        fr, _ = transform_sprite(full, scale_x=sx, scale_y=sy, angle=ang, dx=wobble, dy=dy)
        frames.append(fr)
    return frames

def make_attack_ranged(full, n=9):
    specs = [
        dict(sx=1.0, sy=1.0, ang=3, dx=2, dy=0, flash=0, muzzle=False),
        dict(sx=0.97, sy=1.04, ang=5, dx=3, dy=2, flash=0, muzzle=False),
        dict(sx=1.06, sy=0.94, ang=-6, dx=-12, dy=0, flash=0.35, muzzle=True),
        dict(sx=1.05, sy=0.95, ang=-5, dx=-10, dy=0, flash=0.15, muzzle=True),
        dict(sx=1.02, sy=0.98, ang=-2, dx=-5, dy=0, flash=0, muzzle=False),
        dict(sx=1.0, sy=1.0, ang=0, dx=-2, dy=0, flash=0, muzzle=False),
        dict(sx=1.0, sy=1.0, ang=1, dx=0, dy=0, flash=0, muzzle=False),
        dict(sx=1.0, sy=1.0, ang=0, dx=0, dy=0, flash=0, muzzle=False),
        dict(sx=1.0, sy=1.0, ang=0, dx=0, dy=0, flash=0, muzzle=False),
    ]
    frames = []
    H, W = full.shape[:2]
    for sp in specs[:n]:
        fr, _ = transform_sprite(full, scale_x=sp['sx'], scale_y=sp['sy'],
                                 angle=sp['ang'], dx=sp['dx'], dy=sp['dy'], flash=sp['flash'],
                                 canvas_pad=90)
        if sp['muzzle']:
            pad = 90 + int(max(H, W) * 0.15)
            fr = draw_muzzle_flash(fr, full, pad)
        frames.append(fr)
    return frames

def make_attack_claw(full, n=10):
    H, W = full.shape[:2]
    specs = [
        dict(sx=1.05, sy=0.90, ang=10, dx=-8, dy=4, flash=0, outline=False, slash=0),
        dict(sx=1.07, sy=0.88, ang=12, dx=-10, dy=5, flash=0, outline=False, slash=0),
        dict(sx=0.92, sy=1.10, ang=-10, dx=16, dy=-2, flash=0.2, outline=True, slash=1),
        dict(sx=0.94, sy=1.06, ang=-8, dx=14, dy=0, flash=0.08, outline=False, slash=1),
        dict(sx=1.03, sy=0.95, ang=6, dx=2, dy=2, flash=0, outline=False, slash=0),
        dict(sx=0.90, sy=1.12, ang=-12, dx=22, dy=-3, flash=0.3, outline=True, slash=2),
        dict(sx=0.93, sy=1.07, ang=-7, dx=16, dy=-1, flash=0.1, outline=False, slash=2),
        dict(sx=1.04, sy=0.94, ang=-2, dx=8, dy=2, flash=0, outline=False, slash=0),
        dict(sx=1.01, sy=0.98, ang=1, dx=3, dy=0, flash=0, outline=False, slash=0),
        dict(sx=1.0, sy=1.0, ang=0, dx=0, dy=0, flash=0, outline=False, slash=0),
    ]
    frames = []
    for sp in specs[:n]:
        fr, (ax, ay) = transform_sprite(full, scale_x=sp['sx'], scale_y=sp['sy'],
                                        angle=sp['ang'], dx=sp['dx'], dy=sp['dy'],
                                        flash=sp['flash'], outline=sp['outline'], canvas_pad=110)
        if sp['slash'] == 1:
            fr = draw_slash_arc(fr, ax + W * 0.2, ay - H * 0.35, W * 0.6, -55, 55,
                                color=(255, 215, 170), width=11)
            fr = draw_slash_arc(fr, ax + W * 0.12, ay - H * 0.28, W * 0.5, -30, 65,
                                color=(220, 50, 40), width=5, alpha=180)
        elif sp['slash'] == 2:
            fr = draw_slash_arc(fr, ax + W * 0.25, ay - H * 0.30, W * 0.65, 60, -55,
                                color=(255, 220, 175), width=12)
            fr = draw_slash_arc(fr, ax + W * 0.15, ay - H * 0.22, W * 0.52, 45, -40,
                                color=(230, 40, 35), width=6, alpha=190)
        frames.append(fr)
    return frames

def make_attack_hammer(full, n=10):
    H, W = full.shape[:2]
    specs = [
        dict(sx=1.04, sy=0.92, ang=8, dx=-3, dy=3, flash=0, dust=0, shake=0),
        dict(sx=1.0, sy=1.04, ang=14, dx=-5, dy=-3, flash=0, dust=0, shake=0),
        dict(sx=0.95, sy=1.08, ang=20, dx=-6, dy=-6, flash=0, dust=0, shake=0),
        dict(sx=0.94, sy=1.10, ang=18, dx=-5, dy=-7, flash=0, dust=0, shake=0),
        dict(sx=0.98, sy=1.02, ang=4, dx=2, dy=-1, flash=0, dust=0, shake=0),
        dict(sx=1.10, sy=0.88, ang=-14, dx=10, dy=4, flash=0.4, dust=1.4, shake=7),
        dict(sx=1.08, sy=0.90, ang=-10, dx=8, dy=3, flash=0.18, dust=0.9, shake=3),
        dict(sx=1.04, sy=0.95, ang=-5, dx=5, dy=2, flash=0, dust=0.4, shake=1),
        dict(sx=1.01, sy=0.98, ang=-2, dx=2, dy=0, flash=0, dust=0, shake=0),
        dict(sx=1.0, sy=1.0, ang=0, dx=0, dy=0, flash=0, dust=0, shake=0),
    ]
    frames = []
    for i, sp in enumerate(specs[:n]):
        shx = sp['shake'] * (1 if i % 2 == 0 else -1)
        fr, (ax, ay) = transform_sprite(full, scale_x=sp['sx'], scale_y=sp['sy'],
                                        angle=sp['ang'], dx=sp['dx'] + shx, dy=sp['dy'],
                                        flash=sp['flash'], outline=sp['dust'] >= 1.0, canvas_pad=120)
        if sp['dust'] > 0:
            fr = draw_dust_burst(fr, ax + sp['dx'], ay + 6, strength=sp['dust'])
        frames.append(fr)
    return frames

def make_attack_lunge(full, n=10):
    H, W = full.shape[:2]
    # Scale stroke width with sprite size so arcs survive downscale
    w_base = max(12, int(W * 0.018))
    specs = [
        dict(sx=1.08, sy=0.85, ang=6, dx=-6, dy=6, flash=0, outline=False, slash=False),
        dict(sx=1.10, sy=0.82, ang=7, dx=-8, dy=7, flash=0, outline=False, slash=False),
        dict(sx=0.90, sy=1.12, ang=-4, dx=24, dy=-3, flash=0.15, outline=True, slash=True),
        dict(sx=0.88, sy=1.14, ang=-6, dx=36, dy=-4, flash=0.35, outline=True, slash=True),
        dict(sx=0.92, sy=1.08, ang=-5, dx=32, dy=-2, flash=0.12, outline=False, slash=True),
        dict(sx=1.0, sy=1.0, ang=-2, dx=24, dy=1, flash=0, outline=False, slash=False),
        dict(sx=1.04, sy=0.94, ang=2, dx=14, dy=2, flash=0, outline=False, slash=False),
        dict(sx=1.02, sy=0.97, ang=2, dx=7, dy=1, flash=0, outline=False, slash=False),
        dict(sx=1.0, sy=1.0, ang=1, dx=2, dy=0, flash=0, outline=False, slash=False),
        dict(sx=1.0, sy=1.0, ang=0, dx=0, dy=0, flash=0, outline=False, slash=False),
    ]
    frames = []
    for sp in specs[:n]:
        fr, (ax, ay) = transform_sprite(full, scale_x=sp['sx'], scale_y=sp['sy'],
                                        angle=sp['ang'], dx=sp['dx'], dy=sp['dy'],
                                        flash=sp['flash'], outline=sp['outline'], canvas_pad=160)
        if sp['slash']:
            fr = draw_slash_arc(fr, ax + W * 0.2 + sp['dx'] * 0.2, ay - H * 0.42,
                                W * 0.5, -60, 50, color=(255, 220, 175), width=w_base + 4)
            fr = draw_slash_arc(fr, ax + W * 0.08, ay - H * 0.28,
                                W * 0.45, 50, -55, color=(230, 45, 40), width=w_base, alpha=200)
            fr = draw_slash_arc(fr, ax + W * 0.15, ay - H * 0.35,
                                W * 0.38, -15, 80, color=(240, 180, 140), width=max(5, w_base - 4), alpha=160)
        frames.append(fr)
    return frames

def make_hit(full, n=8):
    frames = []
    specs = [
        dict(sx=1.06, sy=0.92, ang=-8, dx=8, dy=-2, flash=0.9, outline=True),
        dict(sx=1.08, sy=0.90, ang=-12, dx=14, dy=-1, flash=0.7, outline=True),
        dict(sx=1.05, sy=0.93, ang=-10, dx=12, dy=0, flash=0.4, outline=False),
        dict(sx=1.03, sy=0.96, ang=-6, dx=8, dy=0, flash=0.2, outline=False),
        dict(sx=1.01, sy=0.98, ang=-3, dx=4, dy=0, flash=0.08, outline=False),
        dict(sx=1.0, sy=1.0, ang=-1, dx=2, dy=0, flash=0, outline=False),
        dict(sx=1.0, sy=1.0, ang=0, dx=1, dy=0, flash=0, outline=False),
        dict(sx=1.0, sy=1.0, ang=0, dx=0, dy=0, flash=0, outline=False),
    ]
    for sp in specs[:n]:
        fr, _ = transform_sprite(full, scale_x=sp['sx'], scale_y=sp['sy'],
                                 angle=sp['ang'], dx=sp['dx'], dy=sp['dy'],
                                 flash=sp['flash'], outline=sp['outline'])
        frames.append(fr)
    return frames

def to_preview(rgba, target_h=256):
    bb = bbox_of(rgba[:, :, 3] > 0)
    if bb is None:
        return Image.new('RGB', (target_h // 2, target_h), BG)
    cropped, _ = crop_rgba(rgba, bb, pad=6)
    h, w = cropped.shape[:2]
    nw, nh = max(1, int(w * target_h / h)), target_h
    im = Image.fromarray(cropped).resize((nw, nh), Image.Resampling.NEAREST)
    bg = Image.new('RGBA', (nw, nh), BG + (255,))
    bg.paste(im, (0, 0), im)
    return bg.convert('RGB')

def make_sheet_and_gif(frames, out_dir, name, duration_ms=90):
    bbs = [bbox_of(f[:, :, 3] > 0) for f in frames]
    max_w = max(b[2] - b[0] for b in bbs)
    max_h = max(b[3] - b[1] for b in bbs)
    cell_w, cell_h = max_w + 10, max_h + 10
    n = len(frames)
    sheet = np.zeros((cell_h, cell_w * n, 4), dtype=np.uint8)
    for i, f in enumerate(frames):
        crop, _ = crop_rgba(f, bbs[i], pad=0)
        ox = i * cell_w + (cell_w - crop.shape[1]) // 2
        oy = (cell_h - crop.shape[0]) // 2
        place(sheet, crop, ox, oy)
    save_rgba(sheet, out_dir / f'{name}_sheet.png')
    gif_frames = [to_preview(f) for f in frames]
    gw = max(im.size[0] for im in gif_frames)
    gh = max(im.size[1] for im in gif_frames)
    padded = []
    for im in gif_frames:
        canvas = Image.new('RGB', (gw, gh), BG)
        canvas.paste(im, ((gw - im.size[0]) // 2, (gh - im.size[1]) // 2))
        padded.append(canvas)
    padded[0].save(out_dir / f'{name}.gif', save_all=True, append_images=padded[1:],
                   duration=duration_ms, loop=0)
    print(f'  {name}: {n}f sheet={sheet.shape[1]}x{sheet.shape[0]} gif={gw}x{gh}')
    return padded

def process_char(name, cfg):
    out_dir = ART / name
    full = np.array(Image.open(out_dir / 'full.png').convert('RGBA'))
    print(f'\n=== {name} ({full.shape[1]}x{full.shape[0]}) ===')
    heavy = cfg['walk'] == 'heavy'
    kind = cfg['kind']

    idle = make_idle(full, 8)
    walk = make_walk(full, 8, heavy=heavy)
    if kind == 'ranged':
        attack = make_attack_ranged(full, 9); atk_dur = 70
    elif kind == 'claw':
        attack = make_attack_claw(full, 10); atk_dur = 65
    elif kind == 'hammer':
        attack = make_attack_hammer(full, 10); atk_dur = 85
    else:
        attack = make_attack_lunge(full, 10); atk_dur = 70
    hit = make_hit(full, 8)

    idle_g = make_sheet_and_gif(idle, out_dir, 'idle', 100)
    walk_g = make_sheet_and_gif(walk, out_dir, 'walk', 120 if heavy else 95)
    attack_g = make_sheet_and_gif(attack, out_dir, 'attack', atk_dur)
    hit_g = make_sheet_and_gif(hit, out_dir, 'hit', 80)

    anims = [('idle', idle_g), ('walk', walk_g), ('attack', attack_g), ('hit', hit_g)]
    max_len = max(len(g) for _, g in anims)
    widths = [max(fr.size[0] for fr in g) for _, g in anims]
    heights = [max(fr.size[1] for fr in g) for _, g in anims]
    cell_h = max(heights); gap, label_h = 12, 22
    total_w = sum(widths) + gap * (len(anims) + 1)
    total_h = cell_h + gap * 2 + label_h
    out_frames = []
    for fi in range(max_len):
        canvas = Image.new('RGB', (total_w, total_h), BG)
        d = ImageDraw.Draw(canvas); x = gap
        for (lab, g), wcell in zip(anims, widths):
            fr = g[fi % len(g)]
            d.text((x, 4), lab, fill=(200, 200, 200))
            canvas.paste(fr, (x + (wcell - fr.size[0]) // 2, label_h + gap + (cell_h - fr.size[1]) // 2))
            x += wcell + gap
        out_frames.append(canvas)
    out_frames[0].save(out_dir / 'preview.gif', save_all=True, append_images=out_frames[1:],
                       duration=90, loop=0)

    qa = out_dir / '_atk_qa'
    qa.mkdir(exist_ok=True)
    for i, fr in enumerate(attack_g):
        fr.save(qa / f'f{i}.png')
    # strip
    h = max(f.size[1] for f in attack_g)
    strip = Image.new('RGB', (sum(f.size[0] for f in attack_g) + 4 * (len(attack_g) + 1), h + 22), BG)
    d = ImageDraw.Draw(strip); x = 4
    for i, f in enumerate(attack_g):
        d.text((x, 2), f'f{i}', fill=(220, 220, 220))
        strip.paste(f, (x, 20)); x += f.size[0] + 4
    strip.save(qa / 'strip.png')

    return dict(name=name, walk_g=walk_g, attack_g=attack_g, full_h=full.shape[0])

def side_by_side(sets, labels, path, duration=90):
    max_len = max(len(s) for s in sets)
    widths = [max(fr.size[0] for fr in s) for s in sets]
    heights = [max(fr.size[1] for fr in s) for s in sets]
    cell_h = max(heights); gap, label_h = 16, 24
    total_w = sum(widths) + gap * (len(sets) + 1)
    total_h = cell_h + gap * 2 + label_h
    frames = []
    for fi in range(max_len):
        canvas = Image.new('RGB', (total_w, total_h), BG)
        d = ImageDraw.Draw(canvas); x = gap
        for lab, s, wcell in zip(labels, sets, widths):
            fr = s[fi % len(s)]
            d.text((x, 4), lab, fill=(200, 200, 200))
            canvas.paste(fr, (x + (wcell - fr.size[0]) // 2, label_h + gap + (cell_h - fr.size[1]) // 2))
            x += wcell + gap
        frames.append(canvas)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=duration, loop=0)
    print('wrote', path, frames[0].size, 'frames', len(frames))

def main():
    results = []
    for name, cfg in CHARS.items():
        results.append(process_char(name, cfg))

    base_h = results[0]['full_h']
    px_scale = 180 / base_h
    target_hs = [max(32, int(r['full_h'] * px_scale)) for r in results]

    def scale_set(gif_frames, th):
        return [im.resize((max(1, int(im.size[0] * th / im.size[1])), th), Image.Resampling.NEAREST)
                for im in gif_frames]

    labels = [r['name'] for r in results]
    walk_sets = [scale_set(r['walk_g'], th) for r, th in zip(results, target_hs)]
    attack_sets = [scale_set(r['attack_g'], th) for r, th in zip(results, target_hs)]
    side_by_side(walk_sets, labels, ART / 'cult_all_preview.gif', 100)
    side_by_side(attack_sets, labels, ART / 'cult_all_attack.gif', 75)
    side_by_side(attack_sets, labels, ART / 'cult_all_attack_slow.gif', 170)
    print('ALL DONE')

if __name__ == '__main__':
    main()
