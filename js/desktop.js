// Renders the haunted desktop: files, folder windows, drag and drop, cauldron.
import { fileIconEl, spriteEl, eyesEl } from './assets.js';

const TOP = 80;
const BOTTOM_RESERVED = 230;

function cracksSVG() {
  let d = '';
  for (let i = 0; i < 5; i++) {
    let a = Math.random() * Math.PI * 2, x = 50, y = 46;
    d += `M${x} ${y}`;
    for (let j = 0; j < 4; j++) {
      a += (Math.random() - 0.5) * 1.3;
      const r = 7 + Math.random() * 9;
      x += Math.cos(a) * r;
      y += Math.sin(a) * r;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return `<svg class="cracks" viewBox="0 0 100 100"><path d="${d}"/></svg>`;
}

export class Desktop {
  constructor({ el, fs, bus }) {
    this.el = el;
    this.fs = fs;
    this.bus = bus;
    this.filesEl = el.querySelector('#files');
    this.windowsEl = el.querySelector('#windows');
    this.cauldron = el.querySelector('#cauldron');
    this.slot = el.querySelector('.cauldron-slot');
    this.els = new Map();
    this.windows = new Map();
    this.drag = null;
    this.winDrag = null;
    this.hovered = null;
    this.dropEl = null;
    this.z = 10;
    this.onCauldronDrop = () => false;
    fs.on(() => this.render());
  }

  width() { return this.el.clientWidth; }

  // Random free cell for a root-level file, keeping the area above the cauldron clear.
  freeSpot() {
    const W = this.width(), H = innerHeight;
    const cw = 150, ch = 140;
    const taken = this.fs.root.children.filter(n => n.pos).map(n => n.pos);
    const free = [];
    for (let y = TOP; y <= H - BOTTOM_RESERVED - 60; y += ch) {
      for (let x = 70; x <= W - 170; x += cw) {
        if (Math.abs(x + 52 - W / 2) < 210 && y > H - 680) continue;
        if (taken.some(p => Math.abs(p.x - x) < cw * 0.7 && Math.abs(p.y - y) < ch * 0.7)) continue;
        free.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 20 });
      }
    }
    if (free.length) return free[Math.floor(Math.random() * free.length)];
    return { x: 40 + Math.random() * (W - 160), y: TOP + Math.random() * 200 };
  }

  clampPos(x, y) {
    return {
      x: Math.max(10, Math.min(this.width() - 110, x)),
      y: Math.max(TOP - 20, Math.min(innerHeight - 200, y)),
    };
  }

  makeEl(node) {
    const el = document.createElement('div');
    el.className = 'file';
    el.dataset.id = node.id;
    el.dataset.dwell = 'open';
    el.innerHTML = `${cracksSVG()}
      <svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="46" r="40" pathLength="100"/></svg>
      <div class="demon"></div>
      <div class="label"></div><div class="tag">Possessed!</div><div class="say"></div>`;
    el.prepend(fileIconEl(node.kind, node.name));
    el.dataset.kindShown = node.kind;
    return el;
  }

  sync(node, el) {
    const shownKind = node.state === 'lost' ? 'lost' : node.kind;
    if (el.dataset.kindShown !== shownKind) {
      el.querySelector('.icon').replaceWith(fileIconEl(shownKind, node.name));
      el.dataset.kindShown = shownKind;
    }
    el.querySelector('.label').textContent = node.name;
    el.classList.toggle('folder', node.kind === 'folder');
    el.classList.toggle('boss', !!node.boss);
    for (const s of ['infected', 'lost']) el.classList.toggle(s, node.state === s);
    const demon = el.querySelector('.demon');
    el.querySelector('.tag').textContent = node.boss ? `Boss: ${node.bossHp} hit${node.bossHp > 1 ? 's' : ''} left` : 'Possessed!';
    if (node.state === 'infected' && node.inf) {
      if (demon.dataset.monster !== node.inf.monster.id) {
        const sprite = spriteEl(node.inf.monster, 'demon-sprite');
        sprite.style.animationDelay = `${(-Math.random() * 3).toFixed(2)}s`;
        demon.replaceChildren(sprite, eyesEl(node.inf.monster));
        demon.dataset.monster = node.inf.monster.id;
      }
      el.style.setProperty('--inf', (node.inf.corruption / 100).toFixed(3));
    } else {
      demon.replaceChildren();
      demon.dataset.monster = '';
      el.style.setProperty('--inf', '0');
    }
  }

  render() {
    const visible = new Set();
    for (const node of this.fs.root.children) {
      if (node.state === 'cleansing') continue;
      if (!node.pos) node.pos = this.freeSpot();
      const el = this.place(node, this.filesEl);
      el.style.left = `${node.pos.x}px`;
      el.style.top = `${node.pos.y}px`;
      visible.add(node.id);
    }
    for (const [key, win] of [...this.windows]) {
      const node = this.fs.find(win.id);
      if (!node) { win.el.remove(); this.windows.delete(key); continue; }
      if (win.kind !== 'folder') continue;
      const body = win.el.querySelector('.win-body');
      for (const child of node.children) {
        if (child.state === 'cleansing') continue;
        const el = this.place(child, body);
        el.style.left = el.style.top = '';
        visible.add(child.id);
      }
      body.classList.toggle('empty', !node.children.length);
    }
    for (const [id, el] of this.els) {
      if (!visible.has(id)) el.remove();
      if (!this.fs.find(id)) this.els.delete(id);
    }
    this.updateFolderGlow();
  }

  place(node, container) {
    let el = this.els.get(node.id);
    if (!el) { el = this.makeEl(node); this.els.set(node.id, el); }
    if (el.parentElement !== container) container.append(el);
    this.sync(node, el);
    return el;
  }

  materialize(ids) {
    for (const id of ids) {
      const el = this.els.get(id);
      if (!el) continue;
      el.classList.remove('materialize');
      void el.offsetWidth;
      el.classList.add('materialize');
    }
  }

  updateFolderGlow() {
    for (const folder of this.fs.folders()) {
      const el = this.els.get(folder.id);
      if (!el) continue;
      const haunted = this.fs.files().some(f => f.state === 'infected' && this.fs.isDescendant(f.id, folder.id));
      el.classList.toggle('haunted', haunted);
    }
  }

  setInfection(node) {
    const el = this.els.get(node.id);
    if (el?.isConnected) el.style.setProperty('--inf', (node.inf.corruption / 100).toFixed(3));
  }

  // Screen center of a file, or of the closed folder that holds it.
  centerOf(id) {
    const node = this.fs.find(id);
    if (!node) return null;
    if (node.state === 'cleansing') return this.cauldronCenter();
    const el = this.els.get(id);
    if (el?.isConnected) {
      const r = el.querySelector('.icon').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    const parent = this.fs.parentOf(id);
    return parent && parent.id !== 0 ? this.centerOf(parent.id) : null;
  }

  cauldronCenter() {
    const r = this.cauldron.querySelector('.pot').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.3 };
  }

  visibleEl(id) {
    for (let n = this.fs.find(id); n && n.id !== 0; n = this.fs.parentOf(n.id)) {
      const el = this.els.get(n.id);
      if (el?.isConnected) return el;
    }
    return null;
  }

  say(id, text, ms = 4000) {
    const el = this.visibleEl(id);
    if (!el) return;
    const bubble = el.querySelector('.say');
    bubble.textContent = text;
    el.classList.add('saying');
    clearTimeout(el._sayTimer);
    el._sayTimer = setTimeout(() => el.classList.remove('saying'), ms);
  }

  showInCauldron(node) {
    this.slot.replaceChildren(node ? fileIconEl(node.kind, node.name) : '');
    this.cauldron.classList.toggle('full', !!node);
  }

  // ---- windows ----
  open(id) {
    const node = this.fs.find(id);
    if (!node) return;
    if (node.state === 'lost') { this.bus.emit('open-lost', node); return; }
    if (node.state === 'infected') { this.bus.emit('open-infected', node); return; }
    const key = `w${id}`;
    if (this.windows.has(key)) {
      this.windows.get(key).el.style.zIndex = ++this.z;
      return;
    }
    const n = this.windows.size;
    const el = document.createElement('div');
    el.className = `win ${node.kind === 'folder' ? 'win-folder' : 'win-text'}`;
    el.dataset.win = id;
    el.style.left = `${Math.round(this.width() * 0.42) + n * 30}px`;
    el.style.top = `${150 + n * 30}px`;
    el.style.zIndex = ++this.z;
    el.innerHTML = `<div class="win-title"><span></span><button class="win-close" data-action="close">x</button></div>
      <div class="win-body"></div>`;
    el.querySelector('.win-title span').textContent = node.name;
    const body = el.querySelector('.win-body');
    if (node.kind === 'folder') body.dataset.folder = id;
    else {
      const pre = document.createElement('pre');
      pre.textContent = node.content || '(empty)';
      body.append(pre);
    }
    this.windowsEl.append(el);
    this.windows.set(key, { id, kind: node.kind === 'folder' ? 'folder' : 'text', el });
    this.render();
    if (node.kind === 'folder') this.bus.emit('open-folder', node);
  }

  closeWindow(id) {
    const key = `w${id}`;
    const win = this.windows.get(key);
    if (!win) return;
    win.el.remove();
    this.windows.delete(key);
    this.render();
  }

  closeAll() {
    for (const w of this.windows.values()) w.el.remove();
    this.windows.clear();
  }

  // ---- pointer handling ----
  pinchStart(s, target) {
    const title = target?.closest('.win-title');
    if (title) {
      const win = title.closest('.win');
      const r = win.getBoundingClientRect();
      win.style.zIndex = ++this.z;
      this.winDrag = { win, dx: s.x - r.left, dy: s.y - r.top };
      return;
    }
    const fileEl = target?.closest('.file');
    if (!fileEl) return;
    const node = this.fs.find(+fileEl.dataset.id);
    if (!node) return;
    if (node.state === 'lost') { this.bus.emit('open-lost', node); return; }
    const r = fileEl.getBoundingClientRect();
    const ghost = fileEl.cloneNode(true);
    ghost.classList.add('ghost');
    ghost.classList.remove('saying', 'materialize');
    ghost.style.left = ghost.style.top = '0px';
    ghost.style.width = `${r.width}px`;
    document.body.append(ghost);
    fileEl.classList.add('dragging');
    this.drag = { id: node.id, el: fileEl, ghost, dx: s.x - r.left, dy: s.y - r.top };
    this.update(s, target);
    this.bus.emit('drag-start', node);
  }

  dropTarget(target) {
    if (!target) return { type: 'desktop' };
    const c = target.closest('#cauldron');
    if (c) return { type: 'cauldron', el: c };
    const f = target.closest('.file');
    if (f && +f.dataset.id !== this.drag.id) {
      const node = this.fs.find(+f.dataset.id);
      if (node?.kind === 'folder' && !this.fs.isDescendant(node.id, this.drag.id)) return { type: 'folder', id: node.id, el: f };
    }
    const body = target.closest('.win-body[data-folder]');
    if (body && !this.fs.isDescendant(+body.dataset.folder, this.drag.id)) return { type: 'folder', id: +body.dataset.folder, el: body };
    return { type: 'desktop' };
  }

  update(s, target) {
    const fileEl = target?.closest('.file') || null;
    if (fileEl !== this.hovered) {
      this.hovered?.classList.remove('hover');
      fileEl?.classList.add('hover');
      this.hovered = fileEl;
    }
    if (this.winDrag) {
      const { win, dx, dy } = this.winDrag;
      win.style.left = `${Math.max(0, s.x - dx)}px`;
      win.style.top = `${Math.max(50, s.y - dy)}px`;
    }
    if (this.drag) {
      this.drag.ghost.style.transform = `translate(${s.x - this.drag.dx}px, ${s.y - this.drag.dy}px)`;
      const t = this.dropTarget(target);
      if (t.el !== this.dropEl) {
        this.dropEl?.classList.remove('drop-target');
        t.el?.classList.add('drop-target');
        this.dropEl = t.el;
      }
    }
  }

  pinchEnd(s, target) {
    this.winDrag = null;
    if (!this.drag) return;
    const { id, el, ghost, dx, dy } = this.drag;
    const t = this.dropTarget(target);
    this.drag = null;
    ghost.remove();
    el.classList.remove('dragging');
    this.dropEl?.classList.remove('drop-target');
    this.dropEl = null;
    const node = this.fs.find(id);
    if (!node) return;

    if (t.type === 'cauldron') {
      if (!this.onCauldronDrop(node)) this.bounce(el);
      this.render();
      return;
    }
    if (t.type === 'folder' && !node.boss) {
      this.fs.move(id, t.id);
      this.bus.emit('moved', node);
    } else {
      this.fs.move(id, 0);
      node.pos = this.clampPos(s.x - dx, s.y - dy);
    }
    this.render();
  }

  // The demon squeezes into the file and the icon convulses.
  possessAnim(id) {
    const el = this.els.get(id);
    if (!el) return;
    el.classList.remove('possessing');
    void el.offsetWidth;
    el.classList.add('possessing');
    setTimeout(() => el.classList.remove('possessing'), 800);
  }

  hopAnim(id) {
    const el = this.els.get(id);
    if (!el) return;
    el.classList.remove('hopped');
    void el.offsetWidth;
    el.classList.add('hopped');
  }

  bounce(el) {
    el.classList.remove('bounce');
    void el.offsetWidth;
    el.classList.add('bounce');
  }
}
