// The one place to swap art. Set `sprite` (PNG) or `svg` (white-on-transparent
// icon, recolored with CSS masks) to a path under assets/. Anything left null,
// or any file that fails to load, falls back to the emoji.
export const ASSETS = {
  monsters: [
    // `spell` is the shape that banishes this monster (see SPELLS in shapes.js).
    { id: 'skull',   label: 'Skull',   spell: 'line',     sprite: null, emoji: '💀', tint: '#e8e8e8' },
    { id: 'wraith',  label: 'Wraith',  spell: 'circle',   sprite: null, emoji: '👻', tint: '#9effa0' },
    { id: 'pumpkin', label: 'Pumpkin', spell: 'zigzag',   sprite: null, emoji: '🎃', tint: '#ff9a3c' },
    { id: 'imp',     label: 'Imp',     spell: 'triangle', sprite: null, emoji: '😈', tint: '#ff5c5c' },
    { id: 'bat',     label: 'Bat',     spell: 'vee',      sprite: null, emoji: '🦇', tint: '#b48cff' },
  ],
  mage: { sprite: null, emoji: '🧙', name: 'Morwen the Mage' },
  fileIcons: {
    folder: { svg: null, emoji: '⚰️' },
    text:   { svg: null, emoji: '📜' },
    image:  { svg: null, emoji: '🖼️' },
    potion: { svg: null, emoji: '🧪' },
    tomb:   { svg: null, emoji: '⚱️' },
    lost:   { svg: null, emoji: '🪦' },   // a file the demons destroyed
    book:   { svg: null, emoji: '📕' },
    orb:    { svg: null, emoji: '🔮' },
  },
  cauldron: { svg: null },
};

function emojiEl(emoji, cls) {
  const el = document.createElement('span');
  el.className = `${cls} emoji`;
  el.textContent = emoji;
  return el;
}

// Icon for a file kind: an SVG mask when set, emoji otherwise.
export function fileIconEl(kind) {
  const a = ASSETS.fileIcons[kind] || ASSETS.fileIcons.text;
  if (!a.svg) return emojiEl(a.emoji, 'icon');
  const el = document.createElement('span');
  el.className = 'icon mask';
  el.style.maskImage = el.style.webkitMaskImage = `url("${a.svg}")`;
  const probe = new Image();
  probe.onerror = () => el.replaceWith(emojiEl(a.emoji, 'icon'));
  probe.src = a.svg;
  return el;
}

// Sprite for a monster or the mage: a pixelated <img> when set, emoji otherwise.
export function spriteEl(entry, cls = 'sprite') {
  if (!entry.sprite) return emojiEl(entry.emoji, cls);
  const img = document.createElement('img');
  img.className = `${cls} pixel`;
  img.alt = entry.label || entry.name || '';
  img.src = entry.sprite;
  img.onerror = () => img.replaceWith(emojiEl(entry.emoji, cls));
  return img;
}
