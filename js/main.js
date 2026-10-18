// Boot, the main loop, gesture dispatch and the settings dialog.
import { Tracker } from './tracker.js';
import { Input } from './input.js';
import { StrokeCapture, SHAPES, SHAPE_LABELS, shapeSVG } from './shapes.js';
import { FS } from './fs.js';
import { Desktop } from './desktop.js';
import { Infection } from './infection.js';
import { Levels } from './levels.js';
import { Mage } from './mage.js';
import { Gemma } from './gemma.js';
import { fx } from './fx.js';

const $ = s => document.querySelector(s);
const DWELL_MS = 600;
const PAUSE_HOLD_MS = 1200;
const DEBUG_SHAPES = new URLSearchParams(location.search).get('debug') === 'shapes';

const bus = {
  handlers: {},
  on(name, fn) { (this.handlers[name] ||= []).push(fn); },
  emit(name, data) { for (const fn of this.handlers[name] || []) fn(data); },
};

const video = $('#cam video');
const tracker = new Tracker(video, $('#cam canvas'));
const input = new Input(tracker);
fx.init($('#fx'));
const fs = new FS();
const gemma = new Gemma(video);
const mage = new Mage($('#mage'));
const desktop = new Desktop({ el: $('#desktop'), fs, bus });
const capture = new StrokeCapture();
const infection = new Infection({ fs, desktop, gemma, bus, ritualEl: $('#ritual') });
const hud = { level: $('#hud-level'), lost: $('#hud-lost'), banished: $('#hud-banished'), skip: $('#skip-tut') };
const levels = new Levels({ fs, desktop, infection, mage, gemma, bus, hud });
fx.addLayer((ctx, now) => capture.draw(ctx, now));

let started = false;
let paused = false;
let dwell = { el: null, ms: 0, fired: false };
let pauseFired = false;
const scream = { held: 0, cooldown: 0 };

const actions = {
  close: el => desktop.closeWindow(+el.closest('.win').dataset.win),
  open: el => desktop.open(+el.closest('.file').dataset.id),
  settings: () => openSettings(),
  'skip-tutorial': () => levels.start(1),
  'mage-skip': () => mage.skip(),
  'mage-next': () => levels.advance(),
};
function dispatch(name, el) { actions[name]?.(el); }

function setPaused(p) {
  paused = p;
  $('#pause').hidden = !p;
}

// ---- cursor ----
const cursor = $('#cursor');
function drawCursor(s, progress) {
  cursor.style.transform = `translate(${s.x}px, ${s.y}px)`;
  cursor.dataset.g = s.gesture;
  cursor.style.setProperty('--p', progress.toFixed(3));
  $('#gesture-label').textContent = tracker.running && s.source === 'mouse'
    ? 'No hand seen. Raise your hand into view.'
    : `${s.source}: ${s.gesture.replace('_', ' ')}${tracker.fps ? ` (${tracker.fps.toFixed(0)} fps)` : ''}`;
}

// ---- gemma badge ----
const badge = $('#gemma-badge');
function showGemmaStatus(st) {
  const text = {
    nokey: 'Gemma offline: add a key in Settings',
    idle: 'Gemma 4 ready',
    live: 'Gemma 4 live',
    offline: 'Gemma offline, using backup scrolls',
  }[st];
  badge.textContent = text;
  badge.dataset.state = st;
}
gemma.onStatus = showGemmaStatus;
showGemmaStatus(gemma.status);

// ---- main loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const s = input.read(now, dt);
  let progress = 0;

  if (started) {
    const target = document.elementFromPoint(s.x, s.y);
    if (s.pinchStart) {
      const a = target?.closest('[data-action]');
      if (a) dispatch(a.dataset.action, a);
      else if (!paused) desktop.pinchStart(s, target);
    }
    desktop.update(s, target);
    if (s.pinchEnd) desktop.pinchEnd(s, target);

    // Open-palm dwell on anything with data-dwell.
    if (s.gesture === 'Open_Palm' && !desktop.drag) {
      const t = target?.closest('[data-dwell]') || null;
      if (t !== dwell.el) dwell = { el: t, ms: 0, fired: false };
      else if (t && !dwell.fired) {
        dwell.ms += dt * 1000;
        if (dwell.ms >= DWELL_MS) { dwell.fired = true; dispatch(t.dataset.dwell, t); }
      }
      if (dwell.el && !dwell.fired) progress = dwell.ms / DWELL_MS;
    } else {
      dwell = { el: null, ms: 0, fired: false };
    }

    // Thumb up held: pause or resume.
    if (s.gesture === 'Thumb_Up') {
      if (!pauseFired) progress = Math.min(1, s.gestureMs / PAUSE_HOLD_MS);
      if (s.gestureMs >= PAUSE_HOLD_MS && !pauseFired) { pauseFired = true; setPaused(!paused); }
    } else {
      pauseFired = false;
    }

    const stroke = capture.update(s, now);
    if (stroke) {
      if (DEBUG_SHAPES) showDebugStroke(stroke);
      else if (!paused) bus.emit('stroke', stroke);
    }

    if (!paused && !DEBUG_SHAPES) {
      // Scream: mouth open for 1 s knocks every infection back by 10.
      scream.cooldown = Math.max(0, scream.cooldown - dt);
      if (s.face && s.face.jawOpen > 0.5 && scream.cooldown === 0 && levels.playing) {
        scream.held += dt;
        if (scream.held >= 1) {
          scream.held = 0;
          scream.cooldown = 20;
          infection.scream();
          fx.text(innerWidth / 2, innerHeight / 2, 'AAAAAH!', '#6dff6d', 64);
          mage.say('A banshee scream! The demons flinch.', { priority: 'high', mood: 'proud' });
        }
      } else {
        scream.held = 0;
      }
      infection.update(dt);
      levels.update(dt);
      desktop.updateFolderGlow();
    }
    mage.update(dt);
  }

  drawCursor(s, progress);
  fx.update(dt);
  fx.draw(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- shape debug mode (?debug=shapes) ----
function showDebugStroke(r) {
  const el = $('#debug-shapes');
  const rows = Object.entries(r.scores).sort((a, b) => b[1] - a[1])
    .map(([n, sc]) => `<div class="${n === r.name ? 'best' : ''}">${SHAPE_LABELS[n]}: ${(sc * 100).toFixed(0)}%</div>`).join('');
  el.innerHTML = `<h3>${SHAPE_LABELS[r.name]} ${(r.score * 100).toFixed(0)}%</h3>${rows}`;
  fx.text(r.center.x, r.center.y, `${SHAPE_LABELS[r.name]} ${(r.score * 100).toFixed(0)}%`, r.score >= 0.78 ? '#6dff6d' : '#ff6b6b');
}

// ---- start overlay ----
function begin() {
  $('#start').hidden = true;
  started = true;
  if (DEBUG_SHAPES) {
    const el = $('#debug-shapes');
    el.hidden = false;
    el.innerHTML = `<h3>Shape debug</h3><p>Point one finger (or right-drag) and draw.</p>
      <div class="debug-glyphs">${Object.keys(SHAPES).map(n => `<span>${shapeSVG(n)}${SHAPE_LABELS[n]}</span>`).join('')}</div>`;
    mage.say('Debug mode: draw shapes and watch the scores.');
    return;
  }
  levels.start($('#chk-skip').checked ? 1 : 0);
}

$('#btn-camera').addEventListener('click', async () => {
  const status = $('#start-status');
  $('#btn-camera').disabled = true;
  try {
    await tracker.start(msg => { status.textContent = msg; });
    $('#cam').classList.add('on');
    begin();
  } catch (err) {
    console.error(err);
    status.textContent = `Camera or model failed (${err.message}). You can still play with the mouse.`;
    $('#btn-camera').disabled = false;
  }
});
$('#btn-mouse').addEventListener('click', begin);

// ---- settings dialog ----
const dialog = $('#settings');
const keyInput = $('#set-key');
const modelSelect = $('#set-model');
const setStatus = $('#set-status');

function fillModels(models, selected) {
  modelSelect.replaceChildren(...(models.length ? models : ['']).map(m => {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = m || '(no Gemma 4 models found)';
    return o;
  }));
  if (selected && models.includes(selected)) modelSelect.value = selected;
}

function openSettings() {
  keyInput.value = gemma.key;
  if (gemma.model) fillModels([gemma.model], gemma.model);
  setStatus.textContent = '';
  if (!dialog.open) dialog.showModal();
}
$('#btn-settings-start').addEventListener('click', openSettings);

$('#btn-find').addEventListener('click', async () => {
  const key = keyInput.value.trim();
  if (!key) { setStatus.textContent = 'Paste a key first.'; return; }
  setStatus.textContent = 'Asking the Gemini API...';
  try {
    const models = await gemma.findModels(key);
    fillModels(models, gemma.model || models[0]);
    setStatus.textContent = models.length
      ? `Found ${models.length} Gemma 4 model${models.length > 1 ? 's' : ''}.`
      : 'No Gemma 4 models are available for this key.';
  } catch (err) {
    setStatus.textContent = `Could not list models: ${err.message}`;
  }
});

dialog.addEventListener('close', () => {
  if (dialog.returnValue === 'save') gemma.save(keyInput.value, modelSelect.value);
});

window.app = { fs, desktop, infection, levels, mage, gemma, input, tracker, bus };
