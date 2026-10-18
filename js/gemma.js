// Gemma 4 through the Gemini API, called on single images only (webcam snapshots or a file you ask about).
const API = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 10000;
const MAX_QUEUE = 3;

const pick = a => a[Math.floor(Math.random() * a.length)];

const FALLBACK_NAMES = ['Grimbold the Unzipped', 'Lady Corrupta', 'Sir Bitrot', 'The Null Pointer', 'Malware Malachai',
  'Hexadecimus', 'Old Man Segfault', 'Countess Cache', 'Baron von Bytes', 'The Pale Pixel', 'Glitchwick',
  'Mother Murk', 'The Dread Defrag', 'Spooky Sudo', 'Wailing Wendigo'];
const FALLBACK_TAUNTS = ['Your file is mine now. You are next.', 'I can smell your fear through the screen.', 'Nice room. I will enjoy it after you are gone.',
  'Your hands are shaking. Good.', 'This file tastes like your secrets.', 'Your cauldron is cold and so is your grave.',
  'I have been watching you longer than you think.', 'Grab faster. I can wait. I have forever.', 'Every byte belongs to the dark now.',
  'Do not look behind you.', 'I can hear your heartbeat from in here.', 'Turn off the lights. I dare you.',
  'I see you squinting at me.', 'Back up your files? Too late.', 'When you sleep tonight, I will still be here.'];
const FALLBACK_RANKS = [
  ['Apprentice of the Third Crypt', 'Your wand hand is shaky but your heart is brave.'],
  ['Keeper of the Cold Cauldron', 'The files are safe, mostly. Move those hands faster.'],
  ['Hexbreaker of the Hollow', 'Clean work. The demons will whisper your name with fear.'],
  ['Grand Exorcist of Folders', 'Few have banished so many so quickly. I am impressed.'],
  ['Moonlit Spellwright', 'Your pinch was sharp and your nerves were sharper.'],
];

function readStore(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
function writeStore(key, val) { try { localStorage.setItem(key, val); } catch { /* storage blocked */ } }
const tidy = s => s?.replace(/[*_#"]/g, '').replace(/\s+/g, ' ').trim();

export class Gemma {
  constructor(video) {
    this.video = video;
    this.key = readStore('hf_gemini_key');
    this.model = readStore('hf_gemma_model');
    this.busy = false;
    this.queue = [];
    this.status = this.ready ? 'idle' : 'nokey';
    this.onStatus = () => {};
    this.canvas = document.createElement('canvas');
    this.canvas.width = 384;
    this.canvas.height = 288;
  }

  get ready() { return !!(this.key && this.model); }

  save(key, model) {
    this.key = key.trim();
    this.model = model.trim();
    writeStore('hf_gemini_key', this.key);
    writeStore('hf_gemma_model', this.model);
    this.setStatus(this.ready ? 'idle' : 'nokey');
  }

  setStatus(s) { this.status = s; this.onStatus(s); }

  // Lists Gemma 4 models the key can call, largest first.
  async findModels(key) {
    const res = await fetch(`${API}/models?pageSize=1000&key=${encodeURIComponent(key.trim())}`);
    if (!res.ok) throw new Error(`Gemini API returned ${res.status}`);
    const data = await res.json();
    const size = n => parseFloat(n.match(/(\d+(?:\.\d+)?)b/i)?.[1] || '0');
    return (data.models || [])
      .filter(m => m.name.includes('gemma-4') && (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''))
      .sort((a, b) => size(b) - size(a));
  }

  snapshot() {
    const v = this.video;
    if (!v || v.readyState < 2 || !v.videoWidth) return null;
    const ctx = this.canvas.getContext('2d');
    ctx.save();
    ctx.translate(this.canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    return this.canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
  }

  // Queued request. Resolves to text, or null when skipped or failed.
  // Pass `image` (base64 JPEG, or null for none) to send something other than the webcam.
  request(prompt, { important = false, image } = {}) {
    if (!this.ready) return Promise.resolve(null);
    if (this.busy && this.queue.length >= MAX_QUEUE && !important) return Promise.resolve(null);
    if (image === undefined) {
      // Take the snapshot now, at the moment the event happened.
      image = this.snapshot();
      if (!image) prompt += '\n(No webcam photo is available, so invent a spooky detail instead of describing one.)';
    }
    return new Promise(resolve => {
      this.queue.push({ prompt, image, resolve });
      this.pump();
    });
  }

  async pump() {
    if (this.busy || !this.queue.length) return;
    this.busy = true;
    const job = this.queue.shift();
    try {
      job.resolve(await this.call(job.prompt, job.image));
      this.setStatus('live');
    } catch (err) {
      console.warn('Gemma call failed:', err.message);
      this.setStatus('offline');
      job.resolve(null);
    }
    this.busy = false;
    this.pump();
  }

  async call(prompt, image) {
    const parts = [{ text: prompt }];
    if (image) parts.push({ inline_data: { mime_type: 'image/jpeg', data: image } });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 150 },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts || [])
        .filter(p => !p.thought && p.text)
        .map(p => p.text).join('').trim();
      if (!text) throw new Error('empty response');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  async possession(monster, file) {
    const text = await this.request(
      `You are a ${monster.label} demon that just possessed a file named '${file.name}' on this person's computer. ` +
      `Study their webcam photo. Pick ONE concrete thing you can really see: clothing, glasses, headphones, a hat, an object, a poster, a lamp, the room behind them. ` +
      `Threaten them about it in a creepy, horror-movie way, for example "Nice hoodie. It will look good on your corpse." ` +
      `Only mention things that are actually in the photo. Never comment on their body, face, skin, weight, age, race or gender. No gore, no slurs.\n` +
      `Reply in exactly this format:\n` +
      `NAME: <a dread demon name, 2 to 4 words, can pun on the file name>\n` +
      `TAUNT: <max 18 words, the creepy threat about the thing you see>\nNo emojis.`);
    const name = tidy(text?.match(/NAME:\s*(.+)/i)?.[1]);
    const taunt = tidy(text?.match(/TAUNT:\s*(.+)/i)?.[1]);
    return { name: name || pick(FALLBACK_NAMES), taunt: taunt || pick(FALLBACK_TAUNTS), live: !!(name && taunt) };
  }

  async judge(stats) {
    const text = await this.request(
      `You are Morwen, a wise old mage judging an apprentice exorcist after level ${stats.level}. ` +
      `Stats: ${stats.banished} demons banished, ${stats.lost} files lost, ${stats.hops} times a demon hopped away, ` +
      `${stats.spells} hand-sign spells cast, fastest save ${stats.fastestCleanseMs} ms${stats.boss ? ', and they beat the Mimic King boss' : ''}. Look at their photo. Reply in exactly this format:\n` +
      `RANK: <witch or wizard title, max 6 words>\n` +
      `VERDICT: <max 30 words, ominous but kind underneath, mention one thing visible in the photo (not their body or appearance)>`, { important: true });
    const rank = tidy(text?.match(/RANK:\s*(.+)/i)?.[1]);
    const verdict = tidy(text?.match(/VERDICT:\s*([\s\S]+)/i)?.[1]);
    if (rank || verdict) return { rank: rank || 'Mysterious Apprentice', verdict: verdict || tidy(text) };
    if (text) return { rank: 'Mysterious Apprentice', verdict: tidy(text) };
    const [r, v] = pick(FALLBACK_RANKS);
    return { rank: r, verdict: v };
  }
}
