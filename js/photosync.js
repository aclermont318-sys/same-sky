// Same Sky — photos that survive.
//
// A picture lives in three places once this is on: the device that added it, the
// couple's private storage bucket, and the other person's device (downloaded the
// moment they open the app). Losing a phone shouldn't lose a memory.
//
// The image bytes go to Supabase Storage; only small metadata rows travel through
// the normal sync table.

import { store, photoStore, recordDeletion } from './store.js';
import { syncClient, syncReady, syncEnabled } from './sync.js';
import { coupleCode } from './couple.js';

const BUCKET = 'photos';

const pathFor = id => `${coupleCode()}/${id}`;

/** Called after a photo is saved locally: put it where the other person can get it. */
export async function uploadPhoto({ id, blob, caption = '', date, fav = false }) {
  const meta = store.get('photoMeta', []);
  if (!meta.some(m => m.id === id)) {
    meta.push({ id, caption, date, fav, path: pathFor(id), at: Date.now() });
    store.set('photoMeta', meta);          // syncs immediately; the file follows
  }
  const client = syncClient();
  if (!client || !syncReady()) return false;
  try {
    const { error } = await client.storage.from(BUCKET)
      .upload(pathFor(id), blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
    return !error;
  } catch {
    return false;   // offline: pullMissingPhotos on either device will retry later
  }
}

/** Fetch anything in the shared album this device hasn't got yet. */
export async function pullMissingPhotos() {
  const client = syncClient();
  if (!client || !syncReady()) return 0;
  const meta = store.get('photoMeta', []);
  let fetched = 0;
  for (const m of meta) {
    try {
      if (await photoStore.has(m.id)) continue;
      const { data, error } = await client.storage.from(BUCKET).download(m.path || pathFor(m.id));
      if (error || !data) continue;
      await photoStore.put({ id: m.id, blob: data, caption: m.caption, date: m.date, fav: m.fav, addedAt: m.at });
      fetched++;
    } catch { /* try again next time the app opens */ }
  }
  return fetched;
}

/** Push up any local photo that predates sync (or failed to upload before). */
export async function backfillPhotos() {
  const client = syncClient();
  if (!client || !syncReady()) return 0;
  let sent = 0;
  for (const p of await photoStore.all()) {
    const meta = store.get('photoMeta', []);
    const known = meta.find(m => m.id === p.id);
    if (known) {
      // Metadata exists, but make sure the file itself really made it up.
      const { data } = await client.storage.from(BUCKET).list(coupleCode(), { search: p.id });
      if (data && data.length) continue;
    }
    if (await uploadPhoto(p)) sent++;
  }
  return sent;
}

export async function updatePhotoMeta(id, patch) {
  const meta = store.get('photoMeta', []);
  const m = meta.find(x => x.id === id);
  if (!m) return;
  Object.assign(m, patch, { at: Date.now() });
  store.set('photoMeta', meta);
}

export async function deletePhotoEverywhere(id) {
  recordDeletion(id);
  store.set('photoMeta', store.get('photoMeta', []).filter(m => m.id !== id));
  await photoStore.remove(id);
  const client = syncClient();
  if (!client || !syncReady()) return;
  try { await client.storage.from(BUCKET).remove([pathFor(id)]); } catch { /* row is gone either way */ }
}

/** Keep the local album in step with the shared one. */
export function initPhotoSync(onChange) {
  if (!syncEnabled()) return;
  const settle = async () => {
    const got = await pullMissingPhotos();
    await backfillPhotos();
    if (got && onChange) onChange(got);
  };
  setTimeout(settle, 4000);              // after the first pull has landed
  return settle;
}
