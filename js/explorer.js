// The Crypt Explorer: a real Files app in the haunted style. Browse a folder
// from your computer (or the built-in demo crypt) with the same gestures.
// Read-only: moving files and the Graveyard only change this view, never the disk.
import { fileIconEl } from './assets.js';
import { fx } from './fx.js';

const TYPES = [
  ['image', /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/i],
  ['audio', /\.(mp3|wav|ogg|oga|m4a|flac|aac)$/i],
  ['video', /\.(mp4|webm|mov|m4v|ogv)$/i],
  ['pdf', /\.pdf$/i],
  ['code', /\.(js|mjs|cjs|ts|tsx|jsx|py|java|c|cc|cpp|h|hpp|cs|go|rs|rb|php|html|css|scss|json|sh|bat|ps1|yml|yaml|toml|sql|swift|kt|lua|r)$/i],
  ['text', /\.(txt|md|csv|tsv|log|ini|cfg|conf|xml|rtf|tex)$/i],
];
// File type to the icon color family in assets.js.
const ICON_KIND = { image: 'image', audio: 'potion', video: 'orb', pdf: 'book', code: 'tomb', text: 'text', other: 'text' };
const MAX_ITEMS = 500;
const TEXT_PREVIEW = 20000;
const TAP_PX = 14;

const typeOf = name => (TYPES.find(([, re]) => re.test(name)) || ['other'])[0];
const fmtSize = b => b == null ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(1)} GB`;
const fmtDate = ms => ms ? new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const byName = (a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

export class Explorer {
  constructor({ el, desktop, mage, gemma }) {
    Object.assign(this, { el, desktop, mage, gemma });
    this.uid = 0;
    this.nodes = new Map();
    this.root = null;
    this.cwd = null;
    this.view = 'files';
    this.graveyard = [];
    this.drag = null;
    this.previewing = null;
    this.crumbsEl = el.querySelector('.x-crumbs');
    this.gridEl = el.querySelector('.x-grid');
    this.countEl = el.querySelector('.x-count');
    this.graveBtn = el.querySelector('[data-action="x-graveyard"]');
    this.prevEl = el.querySelector('.x-preview');
    this.input = el.querySelector('.x-input');
    el.querySelector('.x-pick').addEventListener('click', () => this.pickFolder());
    this.input.addEventListener('change', () => this.loadFromInput([...this.input.files]));
  }

  // ---- tree ----
  dir(name, parent, handle = null) {
    const n = { id: ++this.uid, name, dir: true, parent, handle, children: handle ? null : [] };
    this.nodes.set(n.id, n);
    if (parent) parent.children.push(n);
    return n;
  }

  file(f, parent) {
    const n = { id: ++this.uid, name: f.name, dir: false, parent, file: f, size: f.size, modified: f.lastModified, type: typeOf(f.name) };
    this.nodes.set(n.id, n);
    parent.children.push(n);
    return n;
  }

  setRoot(root, label) {
    this.root = root;
    this.graveyard = [];
    this.view = 'files';
    this.closePreview();
    this.mage.say(`${label} Hold an open palm on a chest to open it, or pinch a file to carry it.`, { priority: 'high', mood: 'proud' });
    return this.openDir(root);
  }

  // Real folders load lazily, one level at a time.
  async load(node) {
    if (node.children) return;
    node.children = [];
    let count = 0;
    for await (const [name, h] of node.handle.entries()) {
      if (name.startsWith('.')) continue;
      if (++count > MAX_ITEMS) { node.truncated = true; break; }
      if (h.kind === 'directory') this.dir(name, node, h);
      else {
        try { this.file(await h.getFile(), node); } catch { /* unreadable file, skip it */ }
      }
    }
  }

  isInside(node, ancestor) {
    for (let n = node; n; n = n.parent) if (n === ancestor) return true;
    return false;
  }

  // ---- sources ----
  async pickFolder() {
    if (!window.showDirectoryPicker) { this.input.click(); return; }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      await this.setRoot(this.dir(handle.name, null, handle), `Opened your folder "${handle.name}". These are your real files, and I will not change any of them.`);
    } catch (err) {
      if (err.name !== 'AbortError') this.mage.say(`The folder would not open (${err.message}).`, { priority: 'high', mood: 'alarm' });
    }
  }

  loadFromInput(files) {
    if (!files.length) return;
    const top = files[0].webkitRelativePath.split('/')[0] || 'Folder';
    const root = this.dir(top, null);
    const dirs = new Map([['', root]]);
    const dirFor = path => {
      if (dirs.has(path)) return dirs.get(path);
      const cut = path.lastIndexOf('/');
      const d = this.dir(path.slice(cut + 1), dirFor(cut < 0 ? '' : path.slice(0, cut)));
      dirs.set(path, d);
      return d;
    };
    for (const f of files.slice(0, 3000)) {
      const parts = f.webkitRelativePath.split('/').slice(1, -1);
      if (parts.some(p => p.startsWith('.')) || f.name.startsWith('.')) continue;
      this.file(f, dirFor(parts.join('/')));
    }
    this.input.value = '';
    this.setRoot(root, `Opened your folder "${top}". These are your real files, and I will not change any of them.`);
  }

  async loadDemo() {
    const root = this.dir('Demo Crypt', null);
    const day = d => new Date(d).getTime();
    const text = (dir, name, body, d, type = 'text/plain') => this.file(new File([body], name, { type, lastModified: day(d) }), dir);
    const fetched = async (dir, name, url, d) => {
      try {
        const blob = await (await fetch(url)).blob();
        this.file(new File([blob], name, { type: blob.type || 'image/png', lastModified: day(d) }), dir);
      } catch { /* offline: skip the picture */ }
    };
    const spells = this.dir('Spellbook', root);
    const portraits = this.dir('Portraits', root);
    const sounds = this.dir('Recordings', root);
    const code = this.dir('Rituals', root);
    this.dir('Empty Coffin', root);
    text(root, 'README_FIRST.md', '# Welcome to the Demo Crypt\n\nThis is a pretend folder so you can try the Files app.\nClick "Open a real folder" to browse your own files instead.\n\nNothing you do here changes anything on your disk.\n', '2026-10-18');
    text(root, 'last_will.txt', 'I leave my cauldron to whoever can lift it.\nThe cat gets everything else.\n', '2025-10-31');
    text(root, 'grocery_list.txt', '- eye of newt (x3)\n- one cup of moonlight\n- pumpkin spice (the cursed kind)\n- batteries for the crystal ball\n', '2026-10-13');
    text(spells, 'fireball_scroll.txt', 'FIREBALL\nMake these hand signs in order, half a second each:\n  1. Fist\n  2. Point\n  3. Palm\n  4. Horns\nEvery demon on the screen burns.\n', '2026-10-17');
    text(spells, 'freeze_scroll.txt', 'FREEZE\nThe fireball signs, backwards:\n  Horns, Palm, Point, Fist\nEvery demon stops for 8 seconds.\n', '2026-10-17');
    text(spells, 'banishing.md', '## How to banish a demon\n\nPinch the possessed file, carry it to the cauldron and let go.\nThe Mimic King needs three trips.\n', '2026-10-16');
    this.file(new File([makePdf(['Certificate of Exorcism', '', 'This certifies that the bearer', 'banished the Mimic King', 'on Halloween night.', '', 'Signed, Morwen the Mage'])], 'exorcism_certificate.pdf', { type: 'application/pdf', lastModified: day('2026-10-31') }), spells);
    this.file(new File([makeHowl()], 'ghost_howl.wav', { type: 'audio/wav', lastModified: day('2026-10-02') }), sounds);
    text(code, 'summon_demon.js', "// Do not run after midnight.\nfunction summon(name) {\n  const circle = drawPentagram({ candles: 5 });\n  return circle.call(name.toUpperCase(), { politely: true });\n}\n\nsummon('Glitchwick');\n", '2026-09-30', 'text/javascript');
    await Promise.all([
      fetched(portraits, 'morwen.png', 'assets/kenney/tile_0084.png', '2026-10-01'),
      fetched(portraits, 'mimic_king.png', 'assets/kenney/tile_0092.png', '2026-10-03'),
      fetched(portraits, 'ghost.png', 'assets/kenney/tile_0121.png', '2026-10-05'),
      fetched(portraits, 'the_dungeon.png', 'assets/kenney/dungeon-bg.png', '2026-10-07'),
    ]);
    return this.setRoot(root, 'Welcome to the Demo Crypt, a pretend folder. Click "Open a real folder" to browse your own files.');
  }

  // ---- navigation ----
  async openDir(node) {
    this.view = 'files';
    this.cwd = node;
    if (!node.children) {
      this.gridEl.innerHTML = '<p class="x-empty">Summoning the files...</p>';
      try { await this.load(node); } catch (err) { this.mage.say(`That folder is sealed (${err.message}).`, { priority: 'high', mood: 'alarm' }); }
    }
    this.render();
    this.mage.setTask('Hold an open palm on a chest to open it. Pinch a file to drag it into a chest or the cauldron. Thumbs up goes back.');
  }

  openGraveyard() {
    this.closePreview();
    this.view = this.view === 'graveyard' ? 'files' : 'graveyard';
    this.render();
    if (this.view === 'graveyard') {
      this.mage.say(this.graveyard.length ? 'The Graveyard. Pinch or hold a palm on a file to bring it back to life.' : 'The Graveyard is empty. Drop a file in the cauldron to bury it.', { priority: 'high' });
    }
  }

  // Thumbs up: close the preview, leave the Graveyard, or go up a folder.
  back() {
    if (this.previewing) return this.closePreview();
    if (this.view === 'graveyard') return this.openGraveyard();
    if (this.cwd?.parent) return this.openDir(this.cwd.parent);
    this.mage.say('This is the top of the crypt. There is nowhere higher to climb.', { priority: 'high' });
  }

  // Palm or tap on an item: open a chest, preview a file, or restore from the Graveyard.
  activate(id) {
    const node = this.nodes.get(+id);
    if (!node) return;
    if (this.view === 'graveyard') return this.restore(node);
    if (node.dir) return this.openDir(node);
    return this.preview(node);
  }

  // ---- rendering ----
  render() {
    const grave = this.view === 'graveyard';
    const list = grave ? this.graveyard.map(g => g.node) : [...(this.cwd?.children || [])].sort(byName);
    const path = [];
    for (let n = this.cwd; n; n = n.parent) path.unshift(n);
    this.crumbsEl.replaceChildren(...path.map(n => this.crumb(n.name, n.id)), ...(grave ? [this.crumb('Graveyard', 'grave')] : []));
    this.gridEl.replaceChildren(...list.map(n => this.itemEl(n, grave)));
    if (!list.length) this.gridEl.innerHTML = `<p class="x-empty">${grave ? 'No files rest here yet.' : 'This chest is empty.'}</p>`;
    const files = list.filter(n => !n.dir).length;
    this.countEl.textContent = `${list.length - files} folders, ${files} files${this.cwd?.truncated && !grave ? ` (first ${MAX_ITEMS} shown)` : ''}`;
    this.graveBtn.textContent = grave ? 'Back to files' : `Graveyard (${this.graveyard.length})`;
    this.el.classList.toggle('grave', grave);
  }

  crumb(name, id) {
    const b = document.createElement('button');
    b.className = 'x-crumb';
    b.textContent = name;
    b.dataset.action = b.dataset.dwell = 'x-crumb';
    b.dataset.xid = id;
    return b;
  }

  itemEl(n, grave) {
    const el = document.createElement('div');
    el.className = `x-item${n.dir ? ' dir' : ''}`;
    el.dataset.xid = n.id;
    el.dataset.dwell = 'x-open';
    if (n.type === 'image' && n.size < 8e6) {
      const wrap = document.createElement('span');
      wrap.className = 'icon x-thumb';
      const img = document.createElement('img');
      img.alt = '';
      img.src = this.url(n);
      img.onload = () => img.naturalWidth < 128 && img.classList.add('pixel');
      wrap.append(img);
      el.append(wrap);
    } else {
      el.append(fileIconEl(n.dir ? 'folder' : ICON_KIND[n.type], n.name));
    }
    const name = document.createElement('div');
    name.className = 'x-name';
    name.textContent = n.name;
    const meta = document.createElement('div');
    meta.className = 'x-meta';
    meta.textContent = grave ? 'tap to restore'
      : n.dir ? (n.children ? `${n.children.length} ${n.children.length === 1 ? 'item' : 'items'}` : 'folder')
      : `${fmtSize(n.size)}, ${fmtDate(n.modified)}`;
    el.append(name, meta);
    return el;
  }

  url(n) { return n.url ||= URL.createObjectURL(n.file); }

  // ---- preview ----
  async preview(n) {
    this.previewing = n;
    const p = this.prevEl;
    p.hidden = false;
    p.querySelector('.x-p-name').textContent = n.name;
    p.querySelector('.x-p-meta').textContent = `${n.type === 'other' ? 'file' : n.type}, ${fmtSize(n.size)}, ${fmtDate(n.modified)}`;
    p.querySelector('.x-p-says').hidden = true;
    const body = p.querySelector('.x-p-body');
    body.replaceChildren();
    if (n.type === 'image') {
      const img = document.createElement('img');
      img.src = this.url(n);
      img.onload = () => img.naturalWidth < 128 && img.classList.add('pixel', 'tiny');
      body.append(img);
    } else if (n.type === 'text' || n.type === 'code') {
      const pre = document.createElement('pre');
      pre.textContent = await n.file.slice(0, TEXT_PREVIEW).text() + (n.size > TEXT_PREVIEW ? '\n\n(the rest of the scroll is too long to show)' : '');
      body.append(pre);
    } else if (n.type === 'pdf') {
      const frame = document.createElement('iframe');
      frame.src = this.url(n);
      frame.title = n.name;
      body.append(frame);
    } else if (n.type === 'audio' || n.type === 'video') {
      const media = document.createElement(n.type);
      media.src = this.url(n);
      media.controls = true;
      media.autoplay = true;
      media.className = 'native';
      body.append(media);
    } else {
      body.innerHTML = '<p class="x-empty">I cannot read this kind of file, but it is safe in its chest.</p>';
    }
    this.mage.say(`Behold, ${n.name}. Pinch "Ask Morwen" and I will read its aura. Thumbs up closes it.`, { priority: 'high' });
  }

  closePreview() {
    if (!this.previewing) return;
    this.previewing = null;
    this.prevEl.hidden = true;
    this.prevEl.querySelector('.x-p-body').replaceChildren();
  }

  // Gemma 4 reads the file itself: the picture for images, the first lines for text.
  async ask() {
    const n = this.previewing;
    if (!n) return;
    const says = this.prevEl.querySelector('.x-p-says');
    says.hidden = false;
    if (!this.gemma.ready) {
      says.textContent = 'My crystal ball is dark. Add a Gemini key in Settings and I will read this file for real.';
      return;
    }
    says.textContent = 'Morwen gazes into the file...';
    let prompt = `You are Morwen, a spooky but kind witch who lives inside a haunted file explorer. Describe the file "${n.name}" in one or two sentences, max 35 words, in a playful spooky voice. Mention something specific from its contents. No emojis.`;
    let image = null;
    if (n.type === 'image') image = await this.thumbB64(n);
    else if (n.type === 'text' || n.type === 'code') prompt += `\n\nThe file starts like this:\n"""\n${await n.file.slice(0, 1500).text()}\n"""`;
    else prompt += ` You cannot see inside it. It is a ${n.type} file of ${fmtSize(n.size)}.`;
    const text = await this.gemma.request(prompt, { important: true, image });
    if (this.previewing !== n) return;
    const line = text ? text.replace(/[*_#]/g, '').trim() : 'The spirits are quiet. Try again in a moment.';
    says.textContent = line;
    this.mage.say(line, { priority: 'high', mood: 'proud' });
  }

  async thumbB64(n) {
    try {
      const bmp = await createImageBitmap(n.file);
      const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * k));
      c.height = Math.max(1, Math.round(bmp.height * k));
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = k < 1;
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.8).split(',')[1];
    } catch {
      return null;
    }
  }

  // ---- moving, burying, restoring (in this view only) ----
  async move(n, dest) {
    if (n === dest || dest === n.parent) return;
    if (n.dir && this.isInside(dest, n)) {
      this.mage.say('A chest cannot swallow itself.', { priority: 'high' });
      return;
    }
    if (!dest.children) await this.load(dest);
    n.parent.children.splice(n.parent.children.indexOf(n), 1);
    dest.children.push(n);
    n.parent = dest;
    this.mage.say(`Moved ${n.name} into ${dest.name}. (Only in this view, your disk is untouched.)`, { priority: 'high', mood: 'proud' });
    this.render();
  }

  bury(n) {
    const from = n.parent;
    if (!from) return;
    from.children.splice(from.children.indexOf(n), 1);
    this.graveyard.push({ node: n, from });
    const c = this.desktop.cauldronCenter();
    fx.burst(c.x, c.y - 20, { color: '#6dff6d', n: 70, speed: 420, gravity: 200 });
    fx.burst(c.x, c.y - 20, { color: '#b48cff', n: 30, speed: 260 });
    fx.ring(c.x, c.y - 20, '#6dff6d', 200);
    fx.text(c.x, c.y - 160, 'BURIED!', '#c6ff9e', 52);
    fx.shake(this.desktop.el, 300, 8);
    this.mage.say(`${n.name} rests in the Graveyard now. Open the Graveyard to bring it back.`, { priority: 'high' });
    this.render();
  }

  restore(n) {
    const i = this.graveyard.findIndex(g => g.node === n);
    if (i < 0) return;
    const { from } = this.graveyard.splice(i, 1)[0];
    const home = this.nodes.has(from.id) && this.isInside(from, this.root) ? from : this.root;
    home.children.push(n);
    n.parent = home;
    const el = this.gridEl.querySelector(`[data-xid="${n.id}"]`)?.getBoundingClientRect();
    if (el) fx.burst(el.left + el.width / 2, el.top + el.height / 2, { color: '#ffd36b', n: 40, speed: 260 });
    this.mage.say(`${n.name} rises from the grave and goes home to ${home.name}.`, { priority: 'high', mood: 'proud' });
    if (!this.graveyard.length) this.view = 'files';
    this.render();
  }

  // ---- pinch: tap to open, drag to move ----
  // A hand pinch is not a real click, and browsers only open the folder picker on one.
  pickHint() {
    this.mage.say('Browsers only open the folder picker on a real click. Click "Open a real folder" with your mouse once.', { priority: 'high', mood: 'alarm' });
  }

  pinchStart(s, target) {
    const el = target?.closest('.x-item');
    if (!el || this.previewing) return;
    const r = el.getBoundingClientRect();
    this.drag = { id: +el.dataset.xid, el, x0: s.x, y0: s.y, dx: s.x - r.left, dy: s.y - r.top, ghost: null, drop: null };
  }

  dropTarget(target) {
    const d = this.drag, n = this.nodes.get(d.id);
    if (target?.closest('#cauldron') && this.view === 'files') return { type: 'grave', el: this.desktop.cauldron };
    const item = target?.closest('.x-item.dir');
    if (item && +item.dataset.xid !== d.id) {
      const dest = this.nodes.get(+item.dataset.xid);
      if (dest && !(n.dir && this.isInside(dest, n))) return { type: 'move', dest, el: item };
    }
    const crumb = target?.closest('.x-crumb');
    if (crumb && crumb.dataset.xid !== 'grave') {
      const dest = this.nodes.get(+crumb.dataset.xid);
      if (dest && dest !== n.parent && !(n.dir && this.isInside(dest, n))) return { type: 'move', dest, el: crumb };
    }
    return null;
  }

  update(s, target) {
    const over = target?.closest('.x-item') || null;
    if (over !== this.hovered) {
      this.hovered?.classList.remove('hover');
      over?.classList.add('hover');
      this.hovered = over;
    }
    // Hovering near the top or bottom edge of the grid scrolls it.
    const g = this.gridEl.getBoundingClientRect();
    if (s.x > g.left && s.x < g.right && !this.previewing) {
      if (s.y > g.bottom - 50 && s.y < g.bottom + 30) this.gridEl.scrollTop += 8;
      else if (s.y < g.top + 40 && s.y > g.top - 10) this.gridEl.scrollTop -= 8;
    }
    const d = this.drag;
    if (!d) return;
    if (!d.ghost && Math.hypot(s.x - d.x0, s.y - d.y0) > TAP_PX && this.view === 'files') {
      d.ghost = d.el.cloneNode(true);
      d.ghost.classList.add('ghost', 'x-ghost');
      d.ghost.style.left = d.ghost.style.top = '0px';
      document.body.append(d.ghost);
      d.el.classList.add('dragging');
    }
    if (!d.ghost) return;
    d.ghost.style.transform = `translate(${s.x - d.dx}px, ${s.y - d.dy}px)`;
    if (Math.random() < 0.5) fx.trail(s.x, s.y, '#b48cff');
    const t = this.dropTarget(target);
    if (t?.el !== d.drop?.el) {
      d.drop?.el.classList.remove('drop-target');
      t?.el.classList.add('drop-target');
    }
    d.drop = t;
  }

  pinchEnd() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.drop?.el.classList.remove('drop-target');
    d.el.classList.remove('dragging');
    if (!d.ghost) return this.activate(d.id);
    d.ghost.remove();
    const n = this.nodes.get(d.id);
    if (!d.drop || !n) return;
    if (d.drop.type === 'grave') this.bury(n);
    else this.move(n, d.drop.dest);
  }
}

// A minimal one-page PDF with a few centered lines, for the demo crypt.
function makePdf(lines) {
  const esc = s => s.replace(/[\\()]/g, '\\$&');
  const content = `BT /F1 26 Tf 0.35 0.1 0.55 rg 72 700 Td ${lines.map((l, i) => `${i ? '0 -36 Td ' : ''}(${esc(l)}) Tj`).join(' ')} ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-BoldItalic >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = objs.map((o, i) => { const at = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return out;
}

// A wobbly two-second ghost howl as a 16-bit mono WAV.
function makeHowl(seconds = 2.2, rate = 22050) {
  const n = Math.floor(seconds * rate);
  const v = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const f = 360 + 240 * Math.sin(t * 1.7) + 14 * Math.sin(t * 36);
    phase += 2 * Math.PI * f / rate;
    const env = Math.min(1, t * 4) * Math.min(1, (seconds - t) * 3);
    v.setInt16(44 + i * 2, Math.sin(phase) * env * 0.35 * 32767, true);
  }
  return v.buffer;
}
