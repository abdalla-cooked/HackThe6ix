// Boot, the main loop, gesture dispatch and the settings dialog.
import { Tracker } from './tracker.js';
import { Input } from './input.js';
import { FS } from './fs.js';
import { Desktop } from './desktop.js';
import { Infection } from './infection.js';
import { Levels } from './levels.js';
import { Mage } from './mage.js';
import { Gemma } from './gemma.js';
import { fx } from './fx.js';

const $ = s => document.querySelector(s);
const DWELL_MS = 600;
const NEXT_HOLD_MS = 1000;
const PAUSE_HOLD_MS = 1200;
const TRAIL_COLORS = { Pinch: '#e4d4ff', Open_Palm: '#6dff6d', Thumb_Up: '#ffd36b', Victory: '#9fb8ff' };

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
const infection = new Infection({ fs, desktop, gemma, bus });
const hud = { level: $('#hud-level'), lost: $('#hud-lost'), banished: $('#hud-banished'), skip: $('#skip-tut') };
const lu = $('#levelup');
const overlay = {
  el: lu, title: lu.querySelector('.lu-title'), sub: lu.querySelector('.lu-sub'), verdict: lu.querySelector('.lu-verdict'),
  btn: lu.querySelector('.lu-btn'), hint: lu.querySelector('.lu-hint'), thumb: lu.querySelector('.lu-thumb'),
};
const levels = new Levels({ fs, desktop, infection, mage, gemma, bus, hud, overlay });

let started = false;
let paused = false;
let dwell = { el: null, ms: 0, fired: false };
let pauseFired = false;
let nextFired = false;
let lightningIn = 8;
let bubbleT = 0;
const scream = { held: 0, cooldown: 0 };

const actions = {
  close: el => desktop.closeWindow(+el.closest('.win').dataset.win),
  open: el => desktop.open(+el.closest('.file').dataset.id),
  settings: () => openSettings(),
  'skip-tutorial': () => levels.start(1),
  'mage-skip': () => mage.skip(),
  'mage-next': () => nextLevel(),
};
function dispatch(name, el) { actions[name]?.(el); }

function setPaused(p) {
  paused = p;
  $('#pause').hidden = !p;
}

function nextLevel() {
  if (!levels.waiting) return;
  const c = overlay.thumb.getBoundingClientRect();
  fx.burst(c.left + c.width / 2, c.top + c.height / 2, { color: '#ffd36b', n: 80, speed: 500, gravity: 200 });
  fx.flash('rgba(255, 211, 107, 0.3)');
  levels.advance();
}

// Lightning: a bolt, a double flicker and a small shake.
function strike() {
  const W = desktop.width();
  fx.bolt(W * (0.1 + Math.random() * 0.8), 0, innerHeight * (0.25 + Math.random() * 0.35));
  $('#lightning').animate([{ opacity: 0 }, { opacity: 0.8 }, { opacity: 0.1 }, { opacity: 0.6 }, { opacity: 0 }], { duration: 450 });
  fx.shake(desktop.el, 300, 5);
}

// Bubbles over the brew and embers under the pot.
function brew(dt, busy) {
  bubbleT += dt;
  const step = busy ? 0.015 : 0.04;
  if (bubbleT < step) return;
  const c = desktop.cauldronCenter();
  for (; bubbleT >= step; bubbleT -= step) {
    fx.spark({ x: c.x + (Math.random() - 0.5) * 120, y: c.y - 6, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 70,
      life: 0.9 + Math.random() * 0.6, size: 2 + Math.random() * 4, color: Math.random() < 0.8 ? '#6dff6d' : '#b48cff', gravity: -20 });
    fx.spark({ x: c.x + (Math.random() - 0.5) * 90, y: c.y + 95, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 60,
      life: 0.5, size: 2 + Math.random() * 3, color: Math.random() < 0.6 ? '#ff8a2a' : '#ffd36b', gravity: -40 });
  }
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

    // Thumbs up held for 1 s starts the next level (or retries).
    if (s.gesture === 'Thumb_Up' && levels.waiting) {
      // Count only the time held since the level-up screen appeared, so an early thumb does not skip it.
      const p = Math.max(0, Math.min(1, Math.min(s.gestureMs, now - levels.waitSince) / NEXT_HOLD_MS));
      if (!nextFired) progress = p;
      overlay.thumb.style.setProperty('--p', nextFired ? 1 : p);
      if (p >= 1 && !nextFired) { nextFired = true; nextLevel(); }
    } else {
      nextFired = false;
      overlay.thumb.style.setProperty('--p', 0);
    }

    // Peace sign held: pause or resume.
    if (s.gesture === 'Victory') {
      if (!pauseFired) progress = Math.min(1, s.gestureMs / PAUSE_HOLD_MS);
      if (s.gestureMs >= PAUSE_HOLD_MS && !pauseFired) { pauseFired = true; setPaused(!paused); }
    } else {
      pauseFired = false;
    }

    if (Math.hypot(s.vx, s.vy) > 60 || desktop.drag) fx.trail(s.x, s.y, desktop.drag ? '#6dff6d' : TRAIL_COLORS[s.gesture] || '#ff8a2a');

    if (!paused) {
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
      if (!levels.waiting) brew(dt, !!desktop.drag && fs.find(desktop.drag.id)?.state === 'infected');
      lightningIn -= dt;
      if (lightningIn <= 0) { strike(); lightningIn = 7 + Math.random() * 7; }
    }
    mage.update(dt);
  }

  drawCursor(s, progress);
  fx.update(dt);
  fx.draw(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- start overlay ----
function begin() {
  $('#start').hidden = true;
  started = true;
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
