// Particles, floating text and custom draw layers on the overlay canvas.
export const fx = {
  canvas: null,
  ctx: null,
  parts: [],
  texts: [],
  rings: [],
  bolts: [],
  layers: [],

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    addEventListener('resize', resize);
    resize();
  },

  // Register fn(ctx, now) to draw every frame.
  addLayer(fn) { this.layers.push(fn); },

  burst(x, y, { color = '#6dff6d', n = 24, speed = 220, life = 0.9, size = 5, gravity = -60 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life, max: life, size: size * (0.5 + Math.random()), color, gravity,
      });
    }
    if (this.parts.length > 1500) this.parts.splice(0, this.parts.length - 1500);
  },

  // Expanding shockwave ring.
  ring(x, y, color = '#6dff6d', max = 240) {
    this.rings.push({ x, y, color, max, life: 0.6, t: 0 });
  },

  // A few sparks at the cursor every frame.
  trail(x, y, color) {
    for (let i = 0; i < 2; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 60, vy: 20 + Math.random() * 40,
        life: 0.5, max: 0.5, size: 1.5 + Math.random() * 2.5, color, gravity: 60,
      });
    }
  },

  // Jagged lightning bolt from (x, y) down to the floor line.
  bolt(x, y, toY) {
    const pts = [[x, y]];
    let cx = x;
    for (let py = y; py < toY;) {
      py += 30 + Math.random() * 50;
      cx += (Math.random() - 0.5) * 90;
      pts.push([cx, Math.min(py, toY)]);
    }
    this.bolts.push({ pts, life: 0.35, max: 0.35 });
  },

  // One particle with explicit motion, for bubbles, embers and trails.
  spark(p) {
    this.parts.push({ size: 3, gravity: 0, color: '#6dff6d', vx: 0, vy: 0, ...p, max: p.life });
  },

  // Full-screen color flash.
  flash(color = 'rgba(255,255,255,0.8)', ms = 350) {
    const el = document.getElementById('flash');
    if (!el) return;
    el.style.background = color;
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
  },

  shake(el, ms = 450, amp = 14) {
    const k = [];
    for (let i = 0; i <= 8; i++) {
      const a = amp * (1 - i / 8);
      k.push({ transform: `translate(${(Math.random() - 0.5) * 2 * a}px, ${(Math.random() - 0.5) * 2 * a}px)` });
    }
    k[k.length - 1] = { transform: 'translate(0, 0)' };
    el.animate(k, { duration: ms, easing: 'linear' });
  },

  text(x, y, str, color = '#f3eaff', size = 28) {
    this.texts.push({ x, y, str, color, size, life: 1.4, max: 1.4 });
  },

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.98; p.vy *= 0.98;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 40 * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter(b => b.life > 0);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < r.life);
  },

  draw(now) {
    const { ctx } = this;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const fn of this.layers) fn(ctx, now);
    for (const b of this.bolts) {
      ctx.save();
      ctx.globalAlpha = Math.random() < 0.3 ? 0.3 : b.life / b.max;
      ctx.strokeStyle = '#e8f0ff';
      ctx.shadowColor = '#9fb8ff';
      ctx.shadowBlur = 24;
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    }
    for (const r of this.rings) {
      const f = r.t / r.life;
      ctx.save();
      ctx.globalAlpha = 1 - f;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 10 * (1 - f) + 2;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.max * (0.2 + 0.8 * Math.sqrt(f)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
      ctx.font = `${t.size}px Creepster, system-ui`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  },
};
