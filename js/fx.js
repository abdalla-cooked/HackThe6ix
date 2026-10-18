// Particles, floating text and custom draw layers on the overlay canvas.
export const fx = {
  canvas: null,
  ctx: null,
  parts: [],
  texts: [],
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
  },

  draw(now) {
    const { ctx } = this;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const fn of this.layers) fn(ctx, now);
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
