#!/usr/bin/env python3
"""Shared cut-out rigging + animation for grimdark cult enemies."""
from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import cv2

SRC = Path('/workspace/grimdark-survivors/art/cult_sizes.png')
ART = Path('/workspace/grimdark-survivors/art')
BG = (0x28, 0x2c, 0x34)
SCALE = 2

# ---------- utils ----------
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

def dilate(mask, k=5):
    k = max(1, int(k))
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    return cv2.dilate(mask.astype(np.uint8), ker).astype(bool)

def poly_mask(h, w, pts):
    m = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m.astype(bool)

def clean_magenta(arr):
    out = arr.copy()
    for _ in range(3):
        r = out[:, :, 0].astype(np.int16)
        g = out[:, :, 1].astype(np.int16)
        b = out[:, :, 2].astype(np.int16)
        a = out[:, :, 3]
        kill = (
            ((r > 140) & (g < 70) & (b > 60) & (a > 0)) |
            ((r > 150) & (g < 95) & (b > 100) & ((r - g) > 45) & (a > 0)) |
            ((r > 70) & (r < 200) & (g < 45) & (b > 50) & ((r - g) > 35) & ((b - g) > 25) & (a > 0))
        )
        near = (a > 0) & (cv2.erode((a > 0).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2) == 0)
        edge_kill = near & ((r - g) > 35) & ((b - g) > 15) & (g < 110) & (r > 85)
        out[kill | edge_kill, 3] = 0
        a = out[:, :, 3]
        edge = (a > 0) & (cv2.erode((a > 0).astype(np.uint8), np.ones((3, 3), np.uint8)) == 0)
        r = out[:, :, 0].astype(np.int16); g = out[:, :, 1].astype(np.int16); b = out[:, :, 2].astype(np.int16)
        tint = edge & (((r > g + 18) & (r > 75)) | ((b > g + 12) & (r > 55)))
        if tint.any():
            out[tint, :3] = cv2.inpaint(out[:, :, :3].copy(), tint.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)[tint]
    a = (out[:, :, 3] > 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(a, 8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 8:
            out[lab == i, 3] = 0
    return out

def keep_largest(mask, min_area=30, keep_n=3):
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    if n <= 1:
        return mask
    areas = sorted([(st[i, cv2.CC_STAT_AREA], i) for i in range(1, n)], reverse=True)
    keep = np.zeros_like(mask)
    for area, i in areas[:keep_n]:
        if area >= min_area:
            keep |= lab == i
    return keep

def hband(h, w, yc, t, x0=0, x1=None):
    m = np.zeros((h, w), dtype=bool)
    m[max(0, yc - t):min(h, yc + t + 1), x0:(w if x1 is None else x1)] = True
    return m

def build_part(full, mask, claim=4, smear=3):
    alpha = full[:, :, 3] > 0
    mask = mask & alpha
    m = dilate(mask, claim) & alpha
    part = np.zeros_like(full)
    part[m] = full[m]
    empty = dilate(mask, smear) & (full[:, :, 3] == 0)
    if empty.any():
        inp = cv2.inpaint(part[:, :, :3].copy(), empty.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
        part[empty, :3] = inp[empty]
        part[empty, 3] = 120
    return clean_magenta(part)

def place_on_canvas(canvas, part_rgba, offset_xy):
    px, py = int(round(offset_xy[0])), int(round(offset_xy[1]))
    ph, pw = part_rgba.shape[:2]
    ch, cw = canvas.shape[:2]
    x0, y0 = max(0, px), max(0, py)
    x1, y1 = min(cw, px + pw), min(ch, py + ph)
    if x0 >= x1 or y0 >= y1:
        return
    sx0, sy0 = x0 - px, y0 - py
    srcp = part_rgba[sy0:sy0 + (y1 - y0), sx0:sx0 + (x1 - x0)]
    dst = canvas[y0:y1, x0:x1]
    sa = srcp[:, :, 3:4].astype(np.float32) / 255.0
    da = dst[:, :, 3:4].astype(np.float32) / 255.0
    out_a = sa + da * (1 - sa)
    out_rgb = srcp[:, :, :3].astype(np.float32) * sa + dst[:, :, :3].astype(np.float32) * da * (1 - sa)
    out_rgb = np.where(out_a > 1e-6, out_rgb / np.maximum(out_a, 1e-6), 0)
    canvas[y0:y1, x0:x1, :3] = np.clip(out_rgb, 0, 255).astype(np.uint8)
    canvas[y0:y1, x0:x1, 3] = np.clip(out_a.reshape(y1 - y0, x1 - x0) * 255, 0, 255).astype(np.uint8)

# ---------- extract ----------
def extract_characters():
    src = np.array(Image.open(SRC).convert('RGBA'))
    a, r, g, b = src[:, :, 3], src[:, :, 0], src[:, :, 1], src[:, :, 2]
    fg = (a > 0) & ~((r < 8) & (g < 8) & (b < 8))
    num, labels, stats, centroids = cv2.connectedComponentsWithStats(fg.astype(np.uint8), 8)
    items = []
    for i in range(1, num):
        x, y, w, h, area = stats[i]
        if area < 5000:
            continue
        items.append((centroids[i][0], i, stats[i]))
    items.sort()
    names = ['cultist', 'hybrid', 'brute', 'patriarch']
    out = {}
    for name, (cx, idx, st) in zip(names, items):
        x, y, w, h, area = st
        pad = 4
        x0, y0 = max(0, x - pad), max(0, y - pad)
        x1, y1 = min(src.shape[1], x + w + pad), min(src.shape[0], y + h + pad)
        comp = cv2.dilate((labels == idx).astype(np.uint8), np.ones((3, 3), np.uint8))
        sprite = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
        region = src[y0:y1, x0:x1]
        m = comp[y0:y1, x0:x1] > 0
        sprite[m] = region[m]
        sprite = clean_magenta(sprite)
        bb = bbox_of(sprite[:, :, 3] > 0)
        sprite, _ = crop_rgba(sprite, bb, pad=1)
        H0, W0 = sprite.shape[:2]
        full = cv2.resize(sprite, (W0 * SCALE, H0 * SCALE), interpolation=cv2.INTER_NEAREST)
        full = clean_magenta(full)
        bb = bbox_of(full[:, :, 3] > 0)
        full, _ = crop_rgba(full, bb, pad=2)
        out[name] = full
        print(f'extract {name}: {full.shape[1]}x{full.shape[0]} px={(full[:,:,3]>0).sum()}')
    return out

# ---------- cutting (per archetype) ----------
def leg_valley(alpha, y0, y1):
    FH, FW = alpha.shape
    band = alpha[y0:y1]
    cols = band.sum(axis=0)
    xs = np.where(cols > 0)[0]
    if len(xs) == 0:
        return FW // 2
    c0, c1 = int(xs[0]), int(xs[-1])
    center = (c0 + c1) // 2
    win = cols[max(c0, center - 40):min(c1 + 1, center + 41)]
    return max(c0, center - 40) + int(np.argmin(win + 1))

def cut_biped(full, kind='cultist'):
    """Generic biped cut: head, torso, arms_weapon, back_leg, front_leg."""
    FH, FW = full.shape[:2]
    alpha = full[:, :, 3] > 0
    rr, gg, bb = [full[:, :, i].astype(np.int16) for i in range(3)]
    Y = np.arange(FH)[:, None]
    X = np.arange(FW)[None, :]
    ys = np.where(alpha.any(axis=1))[0]
    xs = np.where(alpha.any(axis=0))[0]
    top, bot = int(ys[0]), int(ys[-1])
    left, right = int(xs[0]), int(xs[-1])
    H = bot - top + 1
    W = right - left + 1

    # Character-specific fractions
    if kind == 'cultist':
        head_y = top + int(0.28 * H)
        hip_y = top + int(0.55 * H)
        shoulder_y = top + int(0.30 * H)
        neck_y = top + int(0.27 * H)
        weapon_name = 'arms_rifle'
    elif kind == 'hybrid':
        head_y = top + int(0.26 * H)
        hip_y = top + int(0.52 * H)
        shoulder_y = top + int(0.28 * H)
        neck_y = top + int(0.24 * H)
        weapon_name = 'arms_claws'
    elif kind == 'brute':
        head_y = top + int(0.22 * H)
        hip_y = top + int(0.55 * H)
        shoulder_y = top + int(0.26 * H)
        neck_y = top + int(0.20 * H)
        weapon_name = 'arm_hammer'
    else:  # patriarch
        head_y = top + int(0.22 * H)
        hip_y = top + int(0.55 * H)
        shoulder_y = top + int(0.28 * H)
        neck_y = top + int(0.20 * H)
        weapon_name = 'arms_claws'

    valley = leg_valley(alpha, hip_y, min(FH, hip_y + int(0.2 * H)))

    # HEAD: upper portion
    head = alpha & (Y < head_y + int(0.04 * H))
    # include hanging head bits by color for purple-ish
    purpleish = alpha & (bb > 40) & (rr > 30) & ((bb + rr) > gg + 20) & (gg < 140) & (Y < head_y + int(0.12 * H))
    if kind in ('cultist', 'hybrid', 'patriarch'):
        head |= purpleish
    head = keep_largest(head, 40, 2)

    # LEGS
    back_leg = alpha & (Y >= hip_y - int(0.02 * H)) & (X <= valley + 3)
    front_leg = alpha & (Y >= hip_y - int(0.02 * H)) & (X >= valley - 3)
    # strip upper weapon from legs
    back_leg &= ~(Y < hip_y + int(0.08 * H)) | (X < valley - int(0.05 * W))  # messy
    # cleaner: legs below hip_y+small
    back_leg = alpha & (Y >= hip_y) & (X <= valley + 3)
    front_leg = alpha & (Y >= hip_y) & (X >= valley - 3)
    back_leg = keep_largest(back_leg, 40, 2)
    front_leg = keep_largest(front_leg, 40, 2)

    # ARMS / WEAPON: side protrusions + mid band excluding torso core
    arms_y0 = top + int(0.18 * H)
    arms_y1 = hip_y + int(0.08 * H)
    mid = alpha & (Y >= arms_y0) & (Y <= arms_y1) & ~head
    # torso core = central column
    cx0 = left + int(0.28 * W)
    cx1 = left + int(0.72 * W)
    core = mid & (X >= cx0) & (X <= cx1)
    # arms = mid minus deep core, PLUS anything far left/right in band
    arms = mid & ~((X >= cx0 + int(0.05 * W)) & (X <= cx1 - int(0.05 * W)))
    # for cultist/brute include more of mid for weapon across body
    if kind == 'cultist':
        # rifle tan
        tan = alpha & (rr > 120) & (gg > 95) & (bb > 70) & (np.abs(rr - gg) < 55) & ((rr + gg + bb) > 300)
        flesh = alpha & (rr > 55) & (rr < 150) & (gg > 25) & (gg < 100) & (bb < 95) & (rr > gg + 5)
        ochre = alpha & (gg > 50) & (rr > 65) & (gg > bb + 15) & (rr > bb + 10) & (bb < 100) & ~tan
        arms = ((tan | flesh) & alpha & (Y > arms_y0) & (Y < arms_y1 + int(0.1 * H)) & ~head)
        dark = alpha & (rr < 100) & (gg < 95) & (bb < 95) & ((rr + gg + bb) > 35)
        arms |= dark & dilate(tan, 14) & (Y > arms_y0) & (Y < arms_y1 + int(0.12 * H))
        arms &= ~back_leg & ~front_leg
        arms &= ~ochre  # clothing stays on torso
        torso = ochre & (Y > head_y - int(0.02 * H)) & (Y < hip_y + int(0.05 * H)) & ~head
        torso |= alpha & (Y >= head_y - int(0.02 * H)) & (Y < hip_y) & ~head & ~arms & ~back_leg & ~front_leg
    elif kind == 'hybrid':
        # purple body; claws are extremities — take left/right of mid + lower arm reach
        arms = mid & ~((X >= left + int(0.32 * W)) & (X <= left + int(0.68 * W)))
        # claws often extend below hip a bit
        claws_extra = alpha & (Y > arms_y0) & (Y < hip_y + int(0.15 * H)) & (
            (X < left + int(0.28 * W)) | (X > left + int(0.72 * W))
        )
        arms |= claws_extra
        arms &= ~head & ~back_leg & ~front_leg
        torso = alpha & (Y >= head_y - int(0.02 * H)) & (Y < hip_y + int(0.04 * H)) & ~head & ~arms & ~back_leg & ~front_leg
        # ensure chest core
        torso |= alpha & (Y > head_y) & (Y < hip_y) & (X > left + int(0.30 * W)) & (X < left + int(0.70 * W)) & ~head
        torso &= ~arms
    elif kind == 'brute':
        # hammer typically on one side (often left of viewer = character right)
        # take left extremity + mid weapon colors (dark metal / stone)
        metal = alpha & (rr < 120) & (gg < 110) & (bb < 110) & ((rr + gg + bb) > 60) & (Y > arms_y0) & (Y < hip_y + int(0.2 * H))
        # left side arm+hammer
        left_arm = alpha & (X < left + int(0.35 * W)) & (Y > arms_y0) & (Y < hip_y + int(0.25 * H)) & ~head
        # right claw hand
        right_arm = alpha & (X > left + int(0.70 * W)) & (Y > arms_y0) & (Y < hip_y + int(0.1 * H)) & ~head
        arms = left_arm | right_arm | (metal & (X < left + int(0.45 * W)))
        arms &= ~back_leg & ~front_leg
        # hammer head may be high — include top-left blob
        hammer_top = alpha & (Y < arms_y0 + int(0.15 * H)) & (X < left + int(0.40 * W)) & ~head
        arms |= hammer_top
        torso = alpha & (Y >= head_y - int(0.02 * H)) & (Y < hip_y + int(0.04 * H)) & ~head & ~arms & ~back_leg & ~front_leg
        torso |= alpha & (Y > head_y) & (Y < hip_y) & (X > left + int(0.28 * W)) & (X < left + int(0.75 * W)) & ~head & ~arms
    else:  # patriarch — 4 arms as one piece
        arms = mid & ~((X >= left + int(0.34 * W)) & (X <= left + int(0.66 * W)))
        arms |= alpha & (Y > arms_y0) & (Y < hip_y + int(0.12 * H)) & (
            (X < left + int(0.30 * W)) | (X > left + int(0.70 * W))
        )
        arms &= ~head & ~back_leg & ~front_leg
        torso = alpha & (Y >= head_y - int(0.02 * H)) & (Y < hip_y + int(0.04 * H)) & ~head & ~arms & ~back_leg & ~front_leg
        torso |= alpha & (Y > head_y) & (Y < hip_y) & (X > left + int(0.30 * W)) & (X < left + int(0.70 * W)) & ~head
        torso &= ~arms

    arms = keep_largest(arms, 30, 5)
    torso = keep_largest(torso, 40, 4)

    # Joint overlaps
    neck = hband(FH, FW, neck_y, max(6, int(0.02 * H)), left + int(0.2 * W), left + int(0.8 * W))
    share = (head | torso) & neck & alpha
    head = head | (share & (Y <= neck_y + 4))
    torso = torso | (share & (Y >= neck_y - 4))

    sh = hband(FH, FW, shoulder_y, max(6, int(0.025 * H)), left + int(0.05 * W), left + int(0.95 * W))
    arms = arms | (torso & sh & ~((X > left + int(0.35 * W)) & (X < left + int(0.65 * W))))
    torso = torso | (arms & sh & (X > left + int(0.32 * W)) & (X < left + int(0.68 * W)))

    hip = hband(FH, FW, hip_y, max(8, int(0.025 * H)), left + int(0.1 * W), left + int(0.9 * W))
    back_leg = back_leg | (torso & hip & (X < valley + 10))
    front_leg = front_leg | (torso & hip & (X > valley - 10))
    torso = torso | ((back_leg | front_leg) & hip)

    # Remove weapon intrusion from upper legs
    back_leg = back_leg & ~(arms & (Y < hip_y + int(0.1 * H)))
    front_leg = front_leg & ~(arms & (Y < hip_y + int(0.1 * H)))
    # re-add hip overlap
    back_leg = back_leg | (torso & hip & (X < valley + 8) & alpha)
    front_leg = front_leg | (torso & hip & (X > valley - 8) & alpha)

    pivots = {
        'head': (left + W // 2, neck_y),
        'torso': (left + W // 2, neck_y),
        weapon_name: (left + int(0.42 * W), shoulder_y),
        'back_leg': (valley - max(12, int(0.06 * W)), hip_y),
        'front_leg': (valley + max(12, int(0.06 * W)), hip_y),
    }

    masks = {
        'head': head,
        'torso': torso,
        weapon_name: arms,
        'back_leg': back_leg,
        'front_leg': front_leg,
    }
    draw_order = ['back_leg', 'torso', 'front_leg', weapon_name, 'head']
    ground_y = bot  # for foot planting
    return masks, pivots, draw_order, weapon_name, dict(
        neck_y=neck_y, shoulder_y=shoulder_y, hip_y=hip_y, valley=valley,
        ground_y=ground_y, top=top, bot=bot, left=left, right=right, kind=kind,
    )

# ---------- export parts ----------
def export_parts(full, masks, pivots, draw_order, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    FH, FW = full.shape[:2]
    save_rgba(full, out_dir / 'full.png')
    parts_full = {n: build_part(full, m, claim=5, smear=3) for n, m in masks.items()}

    # fill uncovered
    alpha = full[:, :, 3] > 0
    covered = np.zeros((FH, FW), dtype=bool)
    for p in parts_full.values():
        covered |= p[:, :, 3] > 0
    uncovered = alpha & ~covered
    if uncovered.any():
        dists = []
        names = list(parts_full.keys())
        for name in names:
            inv = (parts_full[name][:, :, 3] == 0).astype(np.uint8)
            dists.append(cv2.distanceTransform(inv, cv2.DIST_L2, 5))
        D = np.stack(dists, 0)
        nearest = np.argmin(D, axis=0)
        for i, name in enumerate(names):
            add = uncovered & (nearest == i)
            parts_full[name][add] = full[add]

    meta = {'_meta': {'full_size': [FW, FH], 'draw_order': draw_order, 'scale': SCALE}}
    part_crops = {}
    for name, part in parts_full.items():
        bb = bbox_of(part[:, :, 3] > 0)
        if bb is None:
            continue
        crop, (px, py) = crop_rgba(part, bb, pad=2)
        crop = clean_magenta(crop)
        save_rgba(crop, out_dir / f'{name}.png')
        piv = pivots[name]
        meta[name] = {
            'file': f'{name}.png',
            'offset': [int(px), int(py)],
            'size': [int(crop.shape[1]), int(crop.shape[0])],
            'pivot': [int(piv[0] - px), int(piv[1] - py)],
            'pivot_full': [int(piv[0]), int(piv[1])],
        }
        part_crops[name] = (crop, px, py)
        print(f'  {name}: {crop.shape[1]}x{crop.shape[0]} px={(crop[:,:,3]>0).sum()}')

    with open(out_dir / 'parts.json', 'w') as f:
        json.dump(meta, f, indent=2)

    # parts sheet
    labels = ['full'] + draw_order
    thumbs = [full] + [part_crops[n][0] for n in draw_order if n in part_crops]
    max_h = max(t.shape[0] for t in thumbs)
    pad, label_h = 16, 24
    sheet_w = sum(t.shape[1] + pad for t in thumbs) + pad
    sheet_h = max_h + pad * 2 + label_h
    sheet = Image.new('RGBA', (sheet_w, sheet_h), BG + (255,))
    d = ImageDraw.Draw(sheet)
    x = pad
    for lab, th in zip(labels, thumbs):
        im = Image.fromarray(th)
        y = pad + label_h + (max_h - th.shape[0]) // 2
        sheet.paste(im, (x, y), im)
        d.text((x, 6), lab, fill=(220, 220, 220, 255))
        x += th.shape[1] + pad
    sheet.save(out_dir / 'parts_sheet.png')
    return meta, part_crops, (FH, FW)

# ---------- animation core ----------
class RigAnimator:
    def __init__(self, meta, part_crops, full_size, ground_y, weapon_name, walk_style='normal'):
        self.meta = meta
        self.part_crops = part_crops
        self.FH, self.FW = full_size
        self.ground_y = ground_y
        self.weapon_name = weapon_name
        self.walk_style = walk_style  # normal | heavy
        self.draw_order = meta['_meta']['draw_order']

    def rotate_part(self, name, angle_deg, extra_offset=(0, 0), shear_x=0.0):
        crop, px, py = self.part_crops[name]
        m = self.meta[name]
        piv_local = m['pivot']
        piv_full = m['pivot_full']
        pad = int(max(crop.shape[0], crop.shape[1]) * 0.55) + 14
        buf = np.zeros((crop.shape[0] + 2 * pad, crop.shape[1] + 2 * pad, 4), dtype=np.uint8)
        buf[pad:pad + crop.shape[0], pad:pad + crop.shape[1]] = crop
        piv_buf = (float(piv_local[0] + pad), float(piv_local[1] + pad))

        # optional horizontal shear about pivot (more grounded leg motion)
        if abs(shear_x) > 1e-4:
            M_sh = np.array([[1, shear_x, -shear_x * piv_buf[1]],
                             [0, 1, 0]], dtype=np.float32)
            # adjust so pivot stays
            # shear keeps y, shifts x by shear_x*(y-py)
            buf = cv2.warpAffine(buf, M_sh, (buf.shape[1], buf.shape[0]),
                                 flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT,
                                 borderValue=(0, 0, 0, 0))

        if abs(angle_deg) < 0.05:
            rot = buf
        else:
            M = cv2.getRotationMatrix2D(piv_buf, angle_deg, 1.0)
            rot = cv2.warpAffine(buf, M, (buf.shape[1], buf.shape[0]),
                                 flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT,
                                 borderValue=(0, 0, 0, 0))

        # Foot plant: for legs, shift so lowest opaque pixel stays near ground_y + body_bob
        # (handled via extra_offset from caller mostly)

        canvas = np.zeros((self.FH, self.FW, 4), dtype=np.uint8)
        place_on_canvas(canvas, rot, (
            piv_full[0] + extra_offset[0] - piv_buf[0],
            piv_full[1] + extra_offset[1] - piv_buf[1],
        ))
        return canvas

    def compose(self, angles, offsets, shears=None, flash_white=0.0, order=None):
        shears = shears or {}
        order = order or self.draw_order
        canvas = np.zeros((self.FH, self.FW, 4), dtype=np.uint8)
        for name in order:
            if name not in self.part_crops:
                continue
            layer = self.rotate_part(name, angles.get(name, 0.0),
                                     offsets.get(name, (0, 0)),
                                     shears.get(name, 0.0))
            sa = layer[:, :, 3:4].astype(np.float32) / 255.0
            da = canvas[:, :, 3:4].astype(np.float32) / 255.0
            out_a = sa + da * (1 - sa)
            out_rgb = layer[:, :, :3].astype(np.float32) * sa + canvas[:, :, :3].astype(np.float32) * da * (1 - sa)
            out_rgb = np.where(out_a > 1e-6, out_rgb / np.maximum(out_a, 1e-6), 0)
            canvas[:, :, :3] = np.clip(out_rgb, 0, 255).astype(np.uint8)
            canvas[:, :, 3] = np.clip(out_a.reshape(self.FH, self.FW) * 255, 0, 255).astype(np.uint8)
        if flash_white > 0:
            a = canvas[:, :, 3] > 0
            rgb = canvas[:, :, :3].astype(np.float32)
            canvas[a, :3] = np.clip(rgb[a] * (1 - flash_white) + 255 * flash_white, 0, 255).astype(np.uint8)
        return canvas

    def foot_plant_offset(self, name, angle_deg, shear_x, body_y):
        """Compute dy so the lowest pixel of the transformed leg sits on ground_y+body_y."""
        # Render leg alone on canvas then measure
        layer = self.rotate_part(name, angle_deg, (0, 0), shear_x)
        ys = np.where(layer[:, :, 3] > 0)[0]
        if len(ys) == 0:
            return 0
        foot = int(ys.max())
        target = min(self.FH - 1, self.ground_y + int(round(body_y)))
        return target - foot

    # ----- clips -----
    def frame_idle(self, i, n=8):
        t = i / n * 2 * math.pi
        bob = math.sin(t) * 2.0
        w = self.weapon_name
        return self.compose(
            {'head': math.sin(t) * 1.2, w: math.sin(t) * 0.7},
            {'torso': (0, bob), 'head': (0, bob - math.sin(t) * 0.25), w: (0, bob)},
        )

    def frame_walk(self, i, n=8):
        """Grounded 8-frame walk with contact/passing, modest swing, foot plant."""
        # phase: 0,4 = contact; 2,6 = passing
        t = i / n * 2 * math.pi
        heavy = self.walk_style == 'heavy'
        amp = 12 if heavy else 17          # degrees — modest
        shear_amp = 0.10 if heavy else 0.14  # horizontal shear for grounded feel
        # Legs: combine small rotation + shear (shear does most of the stride look)
        back_a = math.sin(t) * amp * 0.55
        front_a = math.sin(t + math.pi) * amp * 0.55
        back_sh = math.sin(t) * shear_amp
        front_sh = math.sin(t + math.pi) * shear_amp

        # Contact bob: down when |cos| high (frames 0 & 4)
        contact = abs(math.cos(t))
        bob = contact * (3.0 if heavy else 2.5)  # down on contact
        # slight rise on passing
        bob -= (1.0 - contact) * 0.8

        lean = 3.0 if heavy else 4.0  # torso forward lean (degrees)
        # arms counter to legs (opposite of back_leg phase)
        w = self.weapon_name
        arms_a = -math.sin(t) * (5.0 if heavy else 7.0)
        head_lag = math.sin(t - 0.5) * 2.0

        # Horizontal foot slide compensation (small)
        back_x = math.sin(t) * (3 if heavy else 4)
        front_x = math.sin(t + math.pi) * (3 if heavy else 4)

        # Plant feet
        body_y = bob
        back_dy = self.foot_plant_offset('back_leg', back_a, back_sh, body_y)
        front_dy = self.foot_plant_offset('front_leg', front_a, front_sh, body_y)
        # Soften plant (don't fully snap — avoid jitter); blend 70%
        back_dy = int(round(back_dy * 0.75))
        front_dy = int(round(front_dy * 0.75))

        # Draw order: when back_leg is forward (sin>0 for our convention), draw it in front of front_leg during passing
        # sin(t)>0 => back_leg swinging one way
        order = list(self.draw_order)
        # swap legs around passing when they cross
        # passing near t=pi/2 and 3pi/2 when sin near ±1 and cos near 0
        if abs(math.cos(t)) < 0.4:
            # which leg is more forward (positive shear toward +x for front of character facing right)
            # front_sh > back_sh means front_leg more to the right
            if back_sh > front_sh:
                # back_leg visually more forward — draw after torso before front? 
                # order: farther leg first
                order = [n for n in order if n not in ('back_leg', 'front_leg')]
                # insert: more-back first
                # if back_leg has higher shear toward +x it's more forward → draw later
                idx = order.index('torso') + 1
                order[idx:idx] = ['front_leg', 'back_leg']
            else:
                order = [n for n in order if n not in ('back_leg', 'front_leg')]
                idx = order.index('torso') + 1
                order[idx:idx] = ['back_leg', 'front_leg']

        return self.compose(
            {
                'back_leg': back_a,
                'front_leg': front_a,
                'torso': lean * 0.15 * math.sin(t),  # tiny sway
                'head': head_lag,
                w: arms_a,
            },
            {
                'torso': (0, bob),
                'head': (0, bob + math.sin(t - 0.5) * 0.4),
                w: (0, bob),
                'back_leg': (back_x, back_dy),
                'front_leg': (front_x, front_dy),
            },
            shears={'back_leg': back_sh, 'front_leg': front_sh, 'torso': 0.0},
            order=order,
        )

    def frame_attack(self, i, n=6):
        w = self.weapon_name
        kind = self.walk_style  # reuse? better pass attack type — use weapon name
        if w == 'arms_rifle':
            phases = [
                {'a': -8, 'off': (3, 1), 'h': -3},
                {'a': -14, 'off': (5, 2), 'h': -5},
                {'a': 14, 'off': (-7, -3), 'h': 5},
                {'a': 7, 'off': (-3, -1), 'h': 2},
                {'a': -2, 'off': (1, 0), 'h': 0},
                {'a': 0, 'off': (0, 0), 'h': 0},
            ]
        elif w == 'arm_hammer':
            # overhead smash
            phases = [
                {'a': -25, 'off': (2, -8), 'h': -8},   # wind up up
                {'a': -40, 'off': (0, -14), 'h': -12},
                {'a': 35, 'off': (-4, 6), 'h': 8},      # smash down
                {'a': 20, 'off': (-2, 4), 'h': 4},
                {'a': 5, 'off': (0, 1), 'h': 1},
                {'a': 0, 'off': (0, 0), 'h': 0},
            ]
        else:
            # claw swipe / lunge
            phases = [
                {'a': 12, 'off': (-4, 0), 'h': -2},     # pull back
                {'a': 18, 'off': (-7, -2), 'h': -4},
                {'a': -22, 'off': (10, 2), 'h': 6},     # swipe/lunge out
                {'a': -10, 'off': (5, 1), 'h': 2},
                {'a': 2, 'off': (1, 0), 'h': 0},
                {'a': 0, 'off': (0, 0), 'h': 0},
            ]
        p = phases[i]
        torso_a = p['a'] * (0.2 if w == 'arm_hammer' else 0.12)
        return self.compose(
            {w: p['a'], 'head': p['h'], 'torso': torso_a,
             'back_leg': -p['a'] * 0.06, 'front_leg': p['a'] * 0.04},
            {w: p['off'],
             'torso': (p['off'][0] * 0.2, p['off'][1] * 0.15),
             'head': (p['off'][0] * 0.15, p['off'][1] * 0.1)},
        )

    def frame_hit(self, i, n=4):
        w = self.weapon_name
        flashes = [0.85, 0.5, 0.22, 0.0]
        knocks = [(6, -2), (11, -1), (7, 0), (2, 0)]
        tilts = [-8, -12, -6, -2]
        return self.compose(
            {'head': tilts[i] * 1.2, 'torso': tilts[i], w: tilts[i] * 0.7,
             'back_leg': 5, 'front_leg': -7},
            {'torso': knocks[i], 'head': knocks[i], w: knocks[i],
             'back_leg': (knocks[i][0] * 0.2, 0), 'front_leg': (knocks[i][0] * 0.2, 0)},
            flash_white=flashes[i],
        )


def to_preview_frame(rgba, target_h=256):
    bb = bbox_of(rgba[:, :, 3] > 0)
    if bb is None:
        return Image.new('RGB', (target_h // 2, target_h), BG)
    cropped, _ = crop_rgba(rgba, bb, pad=4)
    h, w = cropped.shape[:2]
    nw, nh = max(1, int(w * target_h / h)), target_h
    im = Image.fromarray(cropped).resize((nw, nh), Image.Resampling.NEAREST)
    bg = Image.new('RGBA', (nw, nh), BG + (255,))
    bg.paste(im, (0, 0), im)
    return bg.convert('RGB')


def make_anim(anim: RigAnimator, name, frame_fn, n, out_dir, duration_ms=80):
    frames = [frame_fn(i, n) for i in range(n)]
    bbs = [bbox_of(f[:, :, 3] > 0) for f in frames]
    max_w = max(b[2] - b[0] for b in bbs)
    max_h = max(b[3] - b[1] for b in bbs)
    cell_w, cell_h = max_w + 8, max_h + 8
    sheet = np.zeros((cell_h, cell_w * n, 4), dtype=np.uint8)
    for i, f in enumerate(frames):
        crop, _ = crop_rgba(f, bbs[i], pad=0)
        place_on_canvas(sheet, crop, (i * cell_w + (cell_w - crop.shape[1]) // 2,
                                      (cell_h - crop.shape[0]) // 2))
    save_rgba(sheet, out_dir / f'{name}_sheet.png')
    gif_frames = [to_preview_frame(f) for f in frames]
    gw = max(im.size[0] for im in gif_frames)
    gh = max(im.size[1] for im in gif_frames)
    padded = []
    for im in gif_frames:
        canvas = Image.new('RGB', (gw, gh), BG)
        canvas.paste(im, ((gw - im.size[0]) // 2, (gh - im.size[1]) // 2))
        padded.append(canvas)
    padded[0].save(out_dir / f'{name}.gif', save_all=True, append_images=padded[1:],
                   duration=duration_ms, loop=0)
    print(f'  {name}: {n}f')
    return frames, padded


def process_character(name, full, out_dir, walk_style='normal'):
    print(f'\n=== {name} ===')
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    masks, pivots, draw_order, weapon_name, info = cut_biped(full, kind=name)
    # overlay debug
    FH, FW = full.shape[:2]
    dbg = np.zeros((FH, FW, 4), dtype=np.uint8)
    cols = {'head': (255, 60, 60), 'torso': (60, 220, 60), weapon_name: (70, 120, 255),
            'back_leg': (240, 220, 40), 'front_leg': (240, 70, 240)}
    for n, c in cols.items():
        if n in masks:
            dbg[masks[n], :3] = c
            dbg[masks[n], 3] = 170
    sa = dbg[:, :, 3:4].astype(np.float32) / 255.0
    ov = full.copy()
    ov[:, :, :3] = (full[:, :, :3].astype(np.float32) * (1 - sa * 0.5) +
                    dbg[:, :, :3].astype(np.float32) * sa * 0.5).astype(np.uint8)
    save_rgba(ov, out_dir / '_overlay.png')

    meta, part_crops, size = export_parts(full, masks, pivots, draw_order, out_dir)
    anim = RigAnimator(meta, part_crops, size, info['ground_y'], weapon_name, walk_style=walk_style)

    idle_f, idle_g = make_anim(anim, 'idle', anim.frame_idle, 8, out_dir, 100)
    walk_f, walk_g = make_anim(anim, 'walk', anim.frame_walk, 8, out_dir, 110 if walk_style == 'heavy' else 90)
    attack_f, attack_g = make_anim(anim, 'attack', anim.frame_attack, 6, out_dir, 80)
    hit_f, hit_g = make_anim(anim, 'hit', anim.frame_hit, 4, out_dir, 80)

    # combined preview for this char
    anims = [('idle', idle_g), ('walk', walk_g), ('attack', attack_g), ('hit', hit_g)]
    max_len = max(len(g) for _, g in anims)
    widths = [max(fr.size[0] for fr in g) for _, g in anims]
    heights = [max(fr.size[1] for fr in g) for _, g in anims]
    cell_h = max(heights)
    gap, label_h = 12, 22
    total_w = sum(widths) + gap * (len(anims) + 1)
    total_h = cell_h + gap * 2 + label_h
    out_frames = []
    for fi in range(max_len):
        canvas = Image.new('RGB', (total_w, total_h), BG)
        d = ImageDraw.Draw(canvas)
        x = gap
        for (lab, g), wcell in zip(anims, widths):
            fr = g[fi % len(g)]
            d.text((x, 4), lab, fill=(200, 200, 200))
            canvas.paste(fr, (x + (wcell - fr.size[0]) // 2,
                              label_h + gap + (cell_h - fr.size[1]) // 2))
            x += wcell + gap
        out_frames.append(canvas)
    out_frames[0].save(out_dir / 'preview.gif', save_all=True, append_images=out_frames[1:],
                       duration=90, loop=0)

    # save walk frames for QA
    for i, f in enumerate(walk_f):
        to_preview_frame(f, 256).save(out_dir / f'_walk_qa_{i}.png')

    return {
        'name': name,
        'walk_g': walk_g,
        'attack_g': attack_g,
        'full': full,
        'weapon': weapon_name,
        'size': size,
    }


def main():
    chars = extract_characters()
    results = []
    # cultist: reuse existing full if good, else re-extract
    results.append(process_character('cultist', chars['cultist'], ART / 'cultist', walk_style='normal'))
    results.append(process_character('hybrid', chars['hybrid'], ART / 'hybrid', walk_style='normal'))
    results.append(process_character('brute', chars['brute'], ART / 'brute', walk_style='heavy'))
    results.append(process_character('patriarch', chars['patriarch'], ART / 'patriarch', walk_style='heavy'))

    # Combined walk preview — relative sizes
    # Scale each so cultist ~180px, others proportional by native height
    base_h = results[0]['size'][0]  # FH of cultist
    # Actually size is (FH, FW) — wait we stored (FH,FW)
    heights_nat = [r['size'][0] for r in results]
    target_cultist = 180
    scales = [target_cultist / heights_nat[0] * (h / heights_nat[0]) for h in heights_nat]
    # relative: scale_i = target_cultist * (h_i / h_cultist) / h_i = target_cultist / h_cultist
    # so all use same px-per-source-pixel → relative sizes preserved
    px_scale = target_cultist / heights_nat[0]
    target_hs = [max(32, int(h * px_scale)) for h in heights_nat]
    print('combined target heights', target_hs)

    def scale_gif_frames(gif_frames, th):
        out = []
        for im in gif_frames:
            # im is RGB on BG already at ~256; re-render from? use resize of content
            # Better: these are already preview frames at 256 tall. Resize to th.
            w, h = im.size
            nw = max(1, int(w * th / h))
            out.append(im.resize((nw, th), Image.Resampling.NEAREST))
        return out

    # Walk combined
    walk_sets = [scale_gif_frames(r['walk_g'], th) for r, th in zip(results, target_hs)]
    # Attack combined
    attack_sets = [scale_gif_frames(r['attack_g'], th) for r, th in zip(results, target_hs)]

    def side_by_side(sets, labels, path, duration=90):
        max_len = max(len(s) for s in sets)
        widths = [max(fr.size[0] for fr in s) for s in sets]
        heights = [max(fr.size[1] for fr in s) for s in sets]
        cell_h = max(heights)
        gap, label_h = 16, 24
        total_w = sum(widths) + gap * (len(sets) + 1)
        total_h = cell_h + gap * 2 + label_h
        frames = []
        for fi in range(max_len):
            canvas = Image.new('RGB', (total_w, total_h), BG)
            d = ImageDraw.Draw(canvas)
            x = gap
            for lab, s, wcell, hcell in zip(labels, sets, widths, heights):
                fr = s[fi % len(s)]
                d.text((x, 4), lab, fill=(200, 200, 200))
                canvas.paste(fr, (x + (wcell - fr.size[0]) // 2,
                                  label_h + gap + (cell_h - fr.size[1]) // 2))
                x += wcell + gap
            frames.append(canvas)
        frames[0].save(path, save_all=True, append_images=frames[1:], duration=duration, loop=0)
        print('wrote', path, frames[0].size)

    labels = ['cultist', 'hybrid', 'brute', 'patriarch']
    side_by_side(walk_sets, labels, ART / 'cult_all_preview.gif', 100)
    side_by_side(attack_sets, labels, ART / 'cult_all_attack.gif', 80)
    print('ALL DONE')


if __name__ == '__main__':
    main()
