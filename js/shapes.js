// Air drawing: stroke capture plus the $1 Unistroke Recognizer
// (Wobbrock, Wilson and Li, 2007).
const N = 64;
const SIZE = 250;
const HALF_DIAG = 0.5 * Math.sqrt(2 * SIZE * SIZE);
const ANGLE = 45 * Math.PI / 180;
const PRECISION = 2 * Math.PI / 180;
const PHI = 0.5 * (-1 + Math.sqrt(5));
const ONE_D_RATIO = 0.3;

export const MATCH_THRESHOLD = 0.78;
export const SHAPE_LABELS = { line: 'Line', circle: 'Circle', zigzag: 'Zigzag', triangle: 'Triangle', vee: 'V' };
export const SPELLS = { line: 'Severing Slash', circle: 'Binding Circle', zigzag: 'Lightning Hex', triangle: 'Warding Sigil', vee: 'Raven Mark' };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i]);
  return d;
}

function resample(points, n) {
  const pts = points.map(p => ({ x: p.x, y: p.y }));
  const I = pathLength(pts) / (n - 1);
  const out = [pts[0]];
  let D = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (D + d >= I && d > 0) {
      const t = (I - D) / d;
      const q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y) };
      out.push(q);
      pts.splice(i, 0, q);
      D = 0;
    } else {
      D += d;
    }
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out.slice(0, n);
}

function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

function rotateBy(pts, a) {
  const c = centroid(pts), cos = Math.cos(a), sin = Math.sin(a);
  return pts.map(p => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function bbox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Uniform scaling for 1D strokes (lines), non-uniform otherwise.
function scaleTo(pts, size) {
  const b = bbox(pts);
  const big = Math.max(b.w, b.h) || 1;
  const oneD = Math.min(b.w, b.h) / big < ONE_D_RATIO;
  const sx = oneD ? size / big : size / (b.w || 1);
  const sy = oneD ? size / big : size / (b.h || 1);
  return pts.map(p => ({ x: p.x * sx, y: p.y * sy }));
}

function translateToOrigin(pts) {
  const c = centroid(pts);
  return pts.map(p => ({ x: p.x - c.x, y: p.y - c.y }));
}

function normalize(points) {
  let pts = resample(points, N);
  const c = centroid(pts);
  pts = rotateBy(pts, -Math.atan2(c.y - pts[0].y, c.x - pts[0].x));
  return translateToOrigin(scaleTo(pts, SIZE));
}

function pathDistance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += dist(a[i], b[i]);
  return d / a.length;
}

function distanceAtBestAngle(pts, tpl) {
  let a = -ANGLE, b = ANGLE;
  let x1 = PHI * a + (1 - PHI) * b, f1 = pathDistance(rotateBy(pts, x1), tpl);
  let x2 = (1 - PHI) * a + PHI * b, f2 = pathDistance(rotateBy(pts, x2), tpl);
  while (Math.abs(b - a) > PRECISION) {
    if (f1 < f2) {
      b = x2; x2 = x1; f2 = f1;
      x1 = PHI * a + (1 - PHI) * b; f1 = pathDistance(rotateBy(pts, x1), tpl);
    } else {
      a = x1; x1 = x2; f1 = f2;
      x2 = (1 - PHI) * a + PHI * b; f2 = pathDistance(rotateBy(pts, x2), tpl);
    }
  }
  return Math.min(f1, f2);
}

// Template polylines. The recognizer adds reversed and mirrored variants so
// players can draw in either direction.
const poly = (...xy) => { const out = []; for (let i = 0; i < xy.length; i += 2) out.push({ x: xy[i], y: xy[i + 1] }); return out; };
const circlePts = () => Array.from({ length: 33 }, (_, i) => {
  const a = -Math.PI / 2 + (i / 32) * Math.PI * 2;
  return { x: 100 + Math.cos(a) * 100, y: 100 + Math.sin(a) * 100 };
});
export const SHAPES = {
  line: poly(0, 100, 200, 100),
  circle: circlePts(),
  zigzag: poly(0, 40, 40, 160, 80, 40, 120, 160, 160, 40, 200, 160),
  triangle: poly(100, 0, 200, 170, 0, 170, 100, 0),
  vee: poly(0, 0, 100, 170, 200, 0),
};

// Extra drawings accepted for a shape, e.g. a zigzag with 4 or 3 strokes.
const ALTERNATES = [
  ['zigzag', poly(0, 40, 50, 160, 100, 40, 150, 160, 200, 40)],
  ['zigzag', poly(0, 40, 65, 160, 135, 40, 200, 160)],
];

const TEMPLATES = [];
for (const [name, pts] of [...Object.entries(SHAPES), ...ALTERNATES]) {
  const mirror = pts.map(p => ({ x: p.x, y: -p.y }));
  for (const variant of [pts, [...pts].reverse(), mirror, [...mirror].reverse()]) {
    TEMPLATES.push({ name, points: normalize(variant) });
  }
}

export function recognize(points) {
  const pts = normalize(points);
  const best = {};
  for (const t of TEMPLATES) {
    const score = 1 - distanceAtBestAngle(pts, t.points) / HALF_DIAG;
    if (!(t.name in best) || score > best[t.name]) best[t.name] = score;
  }
  const ranked = Object.entries(best).sort((a, b) => b[1] - a[1]);
  return { name: ranked[0][0], score: ranked[0][1], scores: best };
}

// Inline SVG of a shape. With `trace`, a bright stroke keeps redrawing the
// shape from its start dot so players can see how to draw it.
export function shapeSVG(name, cls = 'glyph-svg', { trace = false } = {}) {
  const pts = SHAPES[name];
  const b = bbox(pts);
  const s = 80 / Math.max(b.w, b.h);
  const ox = (100 - b.w * s) / 2, oy = (100 - b.h * s) / 2;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(ox + (p.x - b.x) * s).toFixed(1)} ${(oy + (p.y - b.y) * s).toFixed(1)}`).join(' ');
  const sx = (ox + (pts[0].x - b.x) * s).toFixed(1), sy = (oy + (pts[0].y - b.y) * s).toFixed(1);
  const traceEls = trace
    ? `<path class="trace" pathLength="100" d="${d}"/><text x="${sx}" y="${Math.max(8, sy - 9)}" class="start-label">start</text>`
    : '';
  return `<svg class="${cls}${trace ? ' traced' : ''}" viewBox="0 0 100 100"><path class="base" d="${d}"/>${traceEls}<circle cx="${sx}" cy="${sy}" r="5"/></svg>`;
}

// Captures strokes while the gesture is Pointing_Up.
export class StrokeCapture {
  constructor() {
    this.active = false;
    this.points = [];
    this.trail = [];
    this.endedAt = 0;
    this.startedAt = 0;
  }

  update(s, now) {
    const drawing = s.gesture === 'Pointing_Up';
    if (drawing && !this.active) {
      this.active = true;
      this.points = [];
      this.trail = [];
      this.startedAt = now;
    }
    if (this.active && drawing) {
      const p = { x: s.tipX, y: s.tipY };
      const last = this.points[this.points.length - 1];
      if (!last || dist(last, p) > 2) { this.points.push(p); this.trail.push(p); }
      if (now - this.startedAt > 3000) return this.finish(now);
      return null;
    }
    if (this.active && !drawing) return this.finish(now);
    return null;
  }

  finish(now) {
    this.active = false;
    this.endedAt = now;
    const b = bbox(this.points.length ? this.points : [{ x: 0, y: 0 }]);
    if (this.points.length < 15 || Math.max(b.w, b.h) < 80) return null;
    const result = recognize(this.points);
    return { ...result, center: { x: b.x + b.w / 2, y: b.y + b.h / 2 } };
  }

  // Glowing trail. Solid while drawing, fades for 0.6 s after.
  draw(ctx, now) {
    if (!this.trail.length) return;
    const alpha = this.active ? 1 : Math.max(0, 1 - (now - this.endedAt) / 600);
    if (alpha <= 0) { this.trail = []; return; }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.shadowColor = '#b48cff';
    ctx.shadowBlur = 18;
    for (const [w, c] of [[10, 'rgba(180,140,255,0.5)'], [4, '#f3eaff']]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.beginPath();
      this.trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.stroke();
    }
    ctx.restore();
  }
}
