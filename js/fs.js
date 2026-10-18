// In-memory file system for the haunted desktop.
export const FILE_POOL = [
  { name: 'last_will.txt', kind: 'text', content: 'I leave my cauldron to whoever can lift it.\nThe cat gets everything else.' },
  { name: 'grandmas_potion.brew', kind: 'potion', content: '3 newt eyes, 1 cup of moonlight, stir widdershins. Do NOT drink on Tuesdays.' },
  { name: 'uncle_vlad.coffin', kind: 'tomb', content: 'Do not open before sunset. Do not open after sunset either.' },
  { name: 'moon_photo.png', kind: 'image', content: 'A blurry photo of the full moon. Something is waving from it.' },
  { name: 'spellbook.pdf', kind: 'book', content: 'Chapter 1: Banishing demons with a cauldron and bare hands.\nChapter 2: Getting ink out of robes.' },
  { name: 'cat_familiar.jpg', kind: 'image', content: 'Mr. Whiskers, 300 years old, still judging you.' },
  { name: 'pumpkin_recipe.txt', kind: 'text', content: 'Carve face. Add candle. Whisper its true name. Serve warm.' },
  { name: 'crypt_keys.zip', kind: 'tomb', content: '13 keys, none of them fit anything.' },
  { name: 'seance_notes.md', kind: 'text', content: '- Ghost said "boo"\n- Ghost said "boo" again\n- Ghost has limited vocabulary' },
  { name: 'crystal_ball.orb', kind: 'orb', content: 'You will meet a tall, dark file. It will be corrupted.' },
  { name: 'bat_wings.svg', kind: 'image', content: 'Vector bat wings. Infinitely scalable. Infinitely creepy.' },
  { name: 'love_potion.brew', kind: 'potion', content: 'Side effects include: sudden interest in poetry.' },
  { name: 'haunted_taxes.xls', kind: 'text', content: 'Deductions: 1 haunted house (depreciating), 4 cats (dependents).' },
  { name: 'wolf_howls.mp3', kind: 'potion', content: 'Track 1: Awoo. Track 2: Awooo (remix).' },
  { name: 'necronomicon.epub', kind: 'book', content: 'Reading this aloud is against the terms of service.' },
  { name: 'tombstone_draft.txt', kind: 'tomb', content: 'Here lies a file that was not exorcised in time.' },
];
export const FOLDER_NAMES = ['Crypt', 'Attic', 'Graveyard', 'Basement', 'Coven'];

export class FS {
  constructor() {
    this.listeners = new Set();
    this.reset();
  }

  reset() {
    this.uid = 0;
    this.root = { id: 0, name: 'Desktop', kind: 'folder', children: [] };
    this.index = new Map([[0, this.root]]);
    this.emit();
  }

  on(fn) { this.listeners.add(fn); }
  emit() { for (const fn of this.listeners) fn(); }

  add(props, parentId = 0) {
    const node = { id: ++this.uid, state: 'clean', health: 100, ...props };
    if (node.kind === 'folder') node.children = node.children || [];
    this.index.set(node.id, node);
    this.find(parentId).children.push(node);
    return node;
  }

  find(id) { return this.index.get(id); }

  parentOf(id) {
    for (const n of this.index.values()) {
      if (n.children?.some(c => c.id === id)) return n;
    }
    return null;
  }

  // True when `id` is `ancestorId` or lives somewhere inside it.
  isDescendant(id, ancestorId) {
    for (let n = this.find(id); n; n = this.parentOf(n.id)) {
      if (n.id === ancestorId) return true;
    }
    return false;
  }

  move(id, folderId) {
    const node = this.find(id), dest = this.find(folderId);
    if (!node || !dest || dest.kind !== 'folder' || this.isDescendant(folderId, id)) return false;
    const parent = this.parentOf(id);
    if (parent === dest) return true;
    parent.children = parent.children.filter(c => c.id !== id);
    dest.children.push(node);
    this.emit();
    return true;
  }

  files() { return [...this.index.values()].filter(n => n.id !== 0 && n.kind !== 'folder'); }
  folders() { return [...this.index.values()].filter(n => n.id !== 0 && n.kind === 'folder'); }
  byState(state) { return this.files().filter(n => n.state === state); }
}
