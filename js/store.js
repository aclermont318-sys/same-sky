// Same Sky — the single persistence seam.
// Views never touch localStorage/indexedDB directly; a future sync backend
// (e.g. Supabase) replaces the internals of this file only.

import { uid } from './app.js';

const PREFIX = 'samesky:';

export function defaultProfile() {
  return {
    a: { name: 'Me', emoji: '🐻', city: 'Zürich', tz: 'Europe/Zurich', lat: 47.3769, lng: 8.5417, lastLocAt: null },
    b: { name: 'You', emoji: '🐰', city: 'New York', tz: 'America/New_York', lat: 40.7128, lng: -74.006, lastLocAt: null },
    startDate: '2025-11-20',
    nextVisit: null,
    title: 'Same Sky',
    activePartner: null,
  };
}

export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
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

export const photoStore = {
  async add({ blob, caption = '', date }) {
    const id = uid();
    await idbPut({ id, blob, caption, date, fav: false, addedAt: Date.now() });
    return id;
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
