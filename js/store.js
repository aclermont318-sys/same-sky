// Same Sky — the single persistence seam.
// Views never touch localStorage/indexedDB directly; a future sync backend
// (e.g. Supabase) replaces the internals of this file only.

import { uid } from './app.js';

const PREFIX = 'samesky:';

// A blank slate. Nothing here is a stand-in for real data — every field the couple
// cares about is filled in by the setup wizard on first run (js/setup.js), so a fresh
// install never shows someone else's names, cities or dates.
export function deviceTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
  catch { return ''; }
}

export function defaultProfile() {
  return {
    a: { name: '', emoji: '🐻', city: '', tz: deviceTimeZone(), lat: null, lng: null, lastLocAt: null },
    b: { name: '', emoji: '🐰', city: '', tz: '', lat: null, lng: null, lastLocAt: null },
    startDate: null,
    nextVisit: null,
    title: 'Same Sky',
    accent: 'rose',
    activePartner: null,
    setupComplete: false,
  };
}

// Anything that wants to mirror writes elsewhere (the sync backend) registers here.
// Writes that arrived FROM the backend pass { fromRemote: true } so they are not
// echoed straight back out again.
let writeHook = null;
export function onWrite(fn) { writeHook = fn; }

export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value, { fromRemote = false } = {}) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    if (writeHook && !fromRemote) {
      try { writeHook(key, value); } catch { /* sync is best-effort, never block a save */ }
    }
  },

  async exportAll() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(PREFIX)) data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
    }
    const photos = [];
    if (photosAvailable) {
      for (const p of await photoStore.all()) {
        photos.push({ id: p.id, caption: p.caption, date: p.date, fav: p.fav, type: p.blob.type, b64: await blobToB64(p.blob) });
      }
    }
    return { app: 'same-sky', version: 1, exportedAt: new Date().toISOString(), data, photos };
  },

  async importAll(obj) {
    if (!obj || obj.app !== 'same-sky' || obj.version !== 1 || typeof obj.data !== 'object') {
      throw new Error('invalid backup');
    }
    for (const [k, v] of Object.entries(obj.data)) store.set(k, v);
    // The backup came from the other person's device, so this one must say who is
    // holding it before anything gets filed under the wrong name.
    const p = store.get('profile', null);
    if (p) {
      p.activePartner = null;
      store.set('profile', p);
    }
    if (photosAvailable && Array.isArray(obj.photos)) {
      for (const p of obj.photos) {
        const blob = await (await fetch(p.b64)).blob();
        await idbPut({ id: p.id, caption: p.caption, date: p.date, fav: p.fav, blob, addedAt: Date.now() });
      }
    }
  },
};

// ————— photos (IndexedDB) —————

export let photosAvailable = true;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open('samesky', 1); }
    catch (e) { photosAvailable = false; return reject(e); }
    req.onupgradeneeded = () => {
      req.result.createObjectStore('photos', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { photosAvailable = false; reject(req.error); };
  });
  return dbPromise;
}

function idbOp(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('photos', mode);
    const os = tx.objectStore('photos');
    const out = fn(os);
    tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    tx.onerror = () => reject(tx.error);
  }));
}

const idbPut = rec => idbOp('readwrite', os => os.put(rec));

/** Remember that a record was deleted, so the other device doesn't hand it back
 *  on the next merge. Kept small and pruned; a year is far longer than any sync gap. */
export function recordDeletion(id) {
  if (!id) return;
  const YEAR = 365 * 864e5;
  const now = Date.now();
  const kept = store.get('deletedIds', []).filter(d => now - (d.at || 0) < YEAR);
  if (!kept.some(d => d.id === id)) kept.push({ id, at: now });
  store.set('deletedIds', kept.slice(-500));
}

/** Wipe everything — used by "start fresh" in Settings. */
export async function wipeAll() {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  }
  if (photosAvailable) {
    try {
      for (const p of await photoStore.all()) await photoStore.remove(p.id);
    } catch { /* nothing to clear */ }
  }
}

export const photoStore = {
  async add({ blob, caption = '', date }) {
    const id = uid();
    await idbPut({ id, blob, caption, date, fav: false, addedAt: Date.now() });
    return id;
  },
  /** Store a photo that arrived from the other device, keeping its id. */
  async put({ id, blob, caption = '', date, fav = false, addedAt }) {
    await idbPut({ id, blob, caption, date, fav, addedAt: addedAt || Date.now() });
    return id;
  },
  async has(id) {
    const rec = await idbOp('readonly', os => os.get(id));
    return Boolean(rec);
  },
  async all() {
    const rows = await idbOp('readonly', os => os.getAll());
    return (rows || []).sort((x, y) => y.addedAt - x.addedAt);
  },
  async update(id, patch) {
    const rec = await idbOp('readonly', os => os.get(id));
    if (rec) await idbPut({ ...rec, ...patch });
  },
  async remove(id) {
    await idbOp('readwrite', os => os.delete(id));
  },
  async count() {
    try { return (await idbOp('readonly', os => os.count())) || 0; }
    catch { return 0; }
  },
};

// probe availability early so views can branch synchronously
openDB().catch(() => { photosAvailable = false; });

function blobToB64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
