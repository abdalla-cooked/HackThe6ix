// The one place to swap art. Sprites are Kenney Tiny Dungeon tiles (CC0),
// drawn pixelated. If a PNG fails to load, the inline SVG named by `art` is
// drawn instead, so the game never shows a broken image.
const K = n => `assets/kenney/tile_${String(n).padStart(4, '0')}.png`;

export const ASSETS = {
  monsters: [
    { id: 'ghost',   label: 'Ghost',   sprite: K(121), art: 'wraith' },
    { id: 'slime',   label: 'Slime',   sprite: K(108), art: 'wraith' },
    { id: 'bat',     label: 'Bat',     sprite: K(120), art: 'bat' },
    { id: 'spider',  label: 'Spider',  sprite: K(122), art: 'imp' },
    { id: 'demon',   label: 'Demon',   sprite: K(110), art: 'imp' },
    { id: 'cultist', label: 'Cultist', sprite: K(111), art: 'skull' },
    { id: 'cyclops', label: 'Cyclops', sprite: K(109), art: 'pumpkin' },
  ],
  boss: { id: 'king', label: 'Mimic King', sprite: K(92), art: 'king' },
  mage: { id: 'mage', label: 'Morwen', sprite: K(84), art: 'mage', name: 'Morwen the Mage' },
  folder: K(89),
  lost: K(65),
  background: 'assets/kenney/dungeon-bg.png',
};

// ---- monsters ----
const ART = {
  skull: `<svg viewBox="0 0 100 100" class="art skull">
    <path d="M50 8C24 8 13 27 13 45c0 13 7 21 15 25v16h44V70c8-4 15-12 15-25C87 27 76 8 50 8z" fill="#efe9dc" stroke="#2a2233" stroke-width="3"/>
    <circle cx="35" cy="46" r="11" fill="#1b1033"/><circle cx="65" cy="46" r="11" fill="#1b1033"/>
    <circle class="eye" cx="35" cy="46" r="4" fill="#6dff6d"/><circle class="eye" cx="65" cy="46" r="4" fill="#6dff6d"/>
    <path d="M50 56l-6 11h12z" fill="#1b1033"/>
    <path d="M36 76v10M44 76v10M52 76v10M60 76v10" stroke="#2a2233" stroke-width="3"/></svg>`,
  wraith: `<svg viewBox="0 0 100 100" class="art wraith">
    <path d="M18 92V44a32 32 0 0164 0v48l-11-9-10 9-11-9-11 9-10-9z" fill="#e9fff0" stroke="#7dffa0" stroke-width="2"/>
    <ellipse cx="37" cy="44" rx="7" ry="10" fill="#1b1033"/><ellipse cx="63" cy="44" rx="7" ry="10" fill="#1b1033"/>
    <ellipse cx="50" cy="68" rx="8" ry="10" fill="#1b1033"/>
    <path d="M18 60q-14 2-12 16M82 60q14 2 12 16" stroke="#e9fff0" stroke-width="7" stroke-linecap="round" fill="none"/></svg>`,
  pumpkin: `<svg viewBox="0 0 100 100" class="art pumpkin">
    <path d="M48 20q2-12 12-14" stroke="#3e7a2a" stroke-width="6" fill="none" stroke-linecap="round"/>
    <ellipse cx="30" cy="57" rx="22" ry="31" fill="#d9661a"/><ellipse cx="70" cy="57" rx="22" ry="31" fill="#d9661a"/>
    <ellipse cx="50" cy="57" rx="25" ry="34" fill="#ff8c2a"/>
    <path class="glow" d="M28 48l10-12 10 12zM52 48l10-12 10 12zM46 58h8l-4 6z" fill="#ffe46b"/>
    <path class="glow" d="M26 68q24 20 48 0l-7 2-5 6-6-5-6 6-6-6-6 5-5-6z" fill="#ffe46b"/></svg>`,
  imp: `<svg viewBox="0 0 100 100" class="art imp">
    <path d="M24 34L28 6l16 22zM76 34L72 6 56 28z" fill="#2b0d12"/>
    <circle cx="50" cy="56" r="33" fill="#d8323f" stroke="#2b0d12" stroke-width="3"/>
    <path class="glow" d="M30 46l14 7-14 5zM70 46l-14 7 14 5z" fill="#ffe46b"/>
    <path d="M30 70q20 18 40 0q-20 7-40 0z" fill="#2b0d12"/>
    <path d="M39 72l3 7 3-6M55 72l3 6 3-7" fill="#fff"/></svg>`,
  bat: `<svg viewBox="0 0 100 100" class="art bat">
    <g class="wing wing-l"><path d="M50 50C36 30 16 28 2 40c9 2 11 9 9 15 6-4 13-2 15 5 4-7 13-7 18-2z" fill="#3b2a5c"/></g>
    <g transform="translate(100 0) scale(-1 1)"><g class="wing wing-r"><path d="M50 50C36 30 16 28 2 40c9 2 11 9 9 15 6-4 13-2 15 5 4-7 13-7 18-2z" fill="#3b2a5c"/></g></g>
    <ellipse cx="50" cy="54" rx="13" ry="17" fill="#2a1d44"/>
    <path d="M40 42l4-12 5 9zM60 42l-4-12-5 9z" fill="#2a1d44"/>
    <circle class="glow" cx="45" cy="50" r="3.5" fill="#ff5c6c"/><circle class="glow" cx="55" cy="50" r="3.5" fill="#ff5c6c"/>
    <path d="M45 60l2 4 2-4M51 60l2 4 2-4" fill="#fff"/></svg>`,
  king: `<svg viewBox="0 0 100 100" class="art pumpkin king">
    <path d="M30 22l8-16 7 12 5-14 5 14 7-12 8 16z" fill="#ffd36b" stroke="#a8771b" stroke-width="2"/>
    <ellipse cx="28" cy="60" rx="22" ry="30" fill="#c95514"/><ellipse cx="72" cy="60" rx="22" ry="30" fill="#c95514"/>
    <ellipse cx="50" cy="60" rx="27" ry="34" fill="#ff7a1a"/>
    <path class="glow" d="M26 50l13-10 9 13zM74 50l-13-10-9 13z" fill="#ff3b2f"/>
    <path class="glow" d="M24 70q26 22 52 0l-8 2-5 7-7-6-6 7-6-7-7 6-5-7z" fill="#ff3b2f"/></svg>`,
  mage: `<svg viewBox="0 0 100 120" class="art mage">
    <path d="M18 118l17-58h30l17 58z" fill="#4b2a85"/><path d="M35 60h30l3 10H32z" fill="#3a1f6b"/>
    <circle cx="50" cy="52" r="14" fill="#f2c9a0"/>
    <path d="M36 56q14 36 28 0q-6 7-14 7t-14-7z" fill="#f4f1ff"/>
    <circle cx="44" cy="50" r="2.2" fill="#1b1033"/><circle cx="56" cy="50" r="2.2" fill="#1b1033"/>
    <path d="M18 44h64l-7-7H25z" fill="#2d1857"/><path d="M28 40L54 0l18 40z" fill="#5b33a0"/>
    <path d="M30 37h41" stroke="#ffd36b" stroke-width="4"/><path d="M52 18l2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5z" fill="#ffd36b"/>
    <path d="M86 40v78" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>
    <circle class="orb" cx="86" cy="34" r="8" fill="#6dff6d"/></svg>`,
};

// ---- files ----
const FILE_COLORS = { text: '#7a4fd1', image: '#2f9e6b', potion: '#c2185b', tomb: '#5d5d73', book: '#b23a3a', orb: '#2b6cb0', boss: '#ff7a1a' };

function fileSVG(kind, ext) {
  if (kind === 'folder') {
    return `<svg viewBox="0 0 80 64" class="art folder"><path d="M4 8h24l6 6h42v46H4z" fill="#4a2d78"/>
      <path d="M4 20h72v40H4z" fill="#7b52b8" stroke="#2d1857" stroke-width="2"/>
      <path d="M33 32a7 7 0 0114 0v4h-3v4h-8v-4h-3z" fill="#e8deff" opacity=".85"/>
      <circle cx="37.5" cy="33" r="1.8" fill="#4a2d78"/><circle cx="42.5" cy="33" r="1.8" fill="#4a2d78"/></svg>`;
  }
  if (kind === 'lost') {
    return `<svg viewBox="0 0 64 80" class="art lost"><path d="M10 74V30a22 22 0 0144 0v44z" fill="#7d7d8a" stroke="#3b3b44" stroke-width="2"/>
      <text x="32" y="46" font-family="Creepster, system-ui" font-size="15" text-anchor="middle" fill="#2a2a33">RIP</text>
      <path d="M2 74h60v6H2z" fill="#2f4a22"/></svg>`;
  }
  const color = FILE_COLORS[kind] || FILE_COLORS.text;
  return `<svg viewBox="0 0 64 80" class="art doc"><path d="M8 3h34l15 15v58H8z" fill="#efe3c6" stroke="#3a2a14" stroke-width="2"/>
    <path d="M42 3v15h15" fill="#cbb98f" stroke="#3a2a14" stroke-width="2"/>
    <path d="M15 28h30M15 36h26M15 44h30" stroke="#a08a63" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="2" y="52" width="50" height="19" rx="4" fill="${color}" stroke="#1b1033" stroke-width="1.5"/>
    <text x="27" y="65.5" font-family="system-ui, sans-serif" font-size="11" font-weight="800" text-anchor="middle" fill="#fff">${ext}</text></svg>`;
}

export function fileIconEl(kind, name = '') {
  const el = document.createElement('span');
  el.className = 'icon';
  const ext = (name.split('.').pop() || 'FILE').slice(0, 4).toUpperCase();
  const tile = kind === 'folder' ? ASSETS.folder : kind === 'lost' ? ASSETS.lost : null;
  if (tile) {
    const img = document.createElement('img');
    img.className = 'pixel';
    img.alt = '';
    img.src = tile;
    img.onerror = () => { el.innerHTML = fileSVG(kind, ext); };
    el.append(img);
  } else {
    el.innerHTML = fileSVG(kind, ext);
  }
  return el;
}

// Sprite for a monster or the mage: a pixelated <img> when `sprite` is set, SVG otherwise.
export function spriteEl(entry, cls = 'sprite') {
  const svg = () => {
    const el = document.createElement('span');
    el.className = `${cls} svg-sprite`;
    el.innerHTML = ART[entry.art || entry.id] || ART.skull;
    return el;
  };
  if (!entry.sprite) return svg();
  const img = document.createElement('img');
  img.className = `${cls} pixel`;
  img.alt = entry.label || entry.name || '';
  img.src = entry.sprite;
  img.onerror = () => img.replaceWith(svg());
  return img;
}
