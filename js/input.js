// One pointer for the whole app: the tracked hand, or the mouse when no hand is visible.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const PINCH_ON = 0.25;
const PINCH_OFF = 0.40;
const STABLE_FRAMES = 3;
const HAND_TIMEOUT_MS = 400;

// Map the central 70% of the camera frame to the full screen.
const toScreen = p => ({
  x: clamp((p.x - 0.15) / 0.7, 0, 1) * innerWidth,
  y: clamp((p.y - 0.15) / 0.7, 0, 1) * innerHeight,
});

// Index finger out, middle/ring/pinky curled. More reliable than the model's
// Pointing_Up when the finger points sideways while drawing.
function isPointing(lm) {
  const w = lm[0];
  const ext = (tip, pip) => dist(lm[tip], w) > dist(lm[pip], w) * 1.1;
  const curled = (tip, pip) => dist(lm[tip], w) < dist(lm[pip], w) * 1.05;
  return ext(8, 6) && curled(12, 10) && curled(16, 14) && curled(20, 18);
}

export class Input {
  constructor(tracker) {
    this.tracker = tracker;
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, left: false, right: false };
    this.keys = new Set();
    this.p = { x: innerWidth / 2, y: innerHeight / 2 };
    this.tip = { ...this.p };
    this.prev = { ...this.p };
    this.v = { x: 0, y: 0 };
    this.pinchOn = false;
    this.prevPinch = false;
    this.cand = 'None';
    this.candN = 0;
    this.handGesture = 'None';
    this.lastHandTs = -1;
    this.stable = 'None';
    this.since = performance.now();
    this.source = 'mouse';

    const native = e => e.target?.closest?.('.native');
    addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    addEventListener('mousedown', e => {
      if (native(e)) return;
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    addEventListener('contextmenu', e => { if (!native(e)) e.preventDefault(); });
    addEventListener('keydown', e => {
      if (native(e) || e.target?.tagName === 'INPUT') return;
      this.keys.add(e.key.toLowerCase());
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
  }

  read(now, dt) {
    const h = this.tracker?.hand;
    const useHand = h?.present && now - h.ts < HAND_TIMEOUT_MS;
    let gesture, pinch;

    if (useHand) {
      this.source = 'hand';
      const lm = h.landmarks;
      const mid = toScreen({ x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 });
      const tip = toScreen(lm[8]);
      const k = 1 - Math.exp(-dt * 18);
      this.p.x += (mid.x - this.p.x) * k;
      this.p.y += (mid.y - this.p.y) * k;
      this.tip.x += (tip.x - this.tip.x) * k;
      this.tip.y += (tip.y - this.tip.y) * k;

      const ratio = dist(lm[4], lm[8]) / Math.max(1e-4, dist(lm[0], lm[9]));
      if (this.pinchOn ? ratio > PINCH_OFF : ratio < PINCH_ON) this.pinchOn = !this.pinchOn;
      pinch = this.pinchOn;

      // Debounce once per new detection, not per render frame.
      if (h.ts !== this.lastHandTs) {
        this.lastHandTs = h.ts;
        let label = h.score > 0.6 ? h.label : 'None';
        if (isPointing(lm)) label = 'Pointing_Up';
        if (label === this.cand) this.candN++;
        else { this.cand = label; this.candN = 1; }
        if (this.candN >= STABLE_FRAMES) this.handGesture = label;
      }
      gesture = pinch ? 'Pinch' : this.handGesture;
    } else {
      this.source = 'mouse';
      this.pinchOn = false;
      this.p.x = this.tip.x = this.mouse.x;
      this.p.y = this.tip.y = this.mouse.y;
      pinch = this.mouse.left;
      const k = this.keys;
      gesture = pinch ? 'Pinch'
        : (this.mouse.right || k.has('d')) ? 'Pointing_Up'
        : k.has('p') ? 'Open_Palm'
        : k.has('f') ? 'Closed_Fist'
        : k.has('t') ? 'Thumb_Up'
        : k.has('v') ? 'Victory'
        : 'None';
    }

    if (gesture !== this.stable) { this.stable = gesture; this.since = now; }

    // Smoothed velocity, tau about 80 ms.
    if (dt > 0) {
      const a = 1 - Math.exp(-dt / 0.08);
      this.v.x += ((this.p.x - this.prev.x) / dt - this.v.x) * a;
      this.v.y += ((this.p.y - this.prev.y) / dt - this.v.y) * a;
    }
    this.prev.x = this.p.x;
    this.prev.y = this.p.y;

    const state = {
      x: this.p.x, y: this.p.y, vx: this.v.x, vy: this.v.y,
      tipX: this.tip.x, tipY: this.tip.y,
      gesture, gestureMs: now - this.since,
      pinch, pinchStart: pinch && !this.prevPinch, pinchEnd: !pinch && this.prevPinch,
      source: this.source,
      face: this.tracker?.face?.present ? this.tracker.face : null,
    };
    this.prevPinch = pinch;
    return state;
  }
}
