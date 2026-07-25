// Same Sky — cross-device sync.
//
// Off by default. When js/config.js is filled in, every save is mirrored to a tiny
// Supabase table and the partner's device receives it in about a second, which is
// what turns this from a diary into something two people share.
//
// Model: one row per (couple, key). Values are the same JSON blobs the app already
// keeps in localStorage, so no data shape changes. Arrays of {id,...} records are
// MERGED by id on arrival rather than overwritten, so two people writing at the
// same moment can't erase each other's note.

import { SUPABASE_URL, SUPABASE_ANON_KEY, COUPLE_CODE, syncConfigured } from './config.js';
import { store, onWrite } from './store.js';

const SYNCED_KEYS = [
  'profile', 'notes', 'letters', 'questions', 'moods',
  'affection', 'bucket', 'milestonesCustom',
];

// Keys whose value is an array of records carrying a stable `id`.
const MERGE_BY_ID = new Set(['notes', 'letters', 'questions', 'bucket', 'milestonesCustom', 'affection']);

let client = null;
let ready = false;
const remoteListeners = [];
let pushTimers = new Map();

export const syncEnabled = () => syncConfigured();
export const syncReady = () => ready;

export function onRemoteChange(fn) { remoteListeners.push(fn); }

function announce(key, value, meta) {
  for (const fn of remoteListeners) {
    try { fn(key, value, meta); } catch { /* a bad listener must not stop the rest */ }
  }
}

/** Merge an incoming array onto the local one by record id, newest wins. */
function mergeById(localArr, remoteArr) {
  const byId = new Map();
  for (const rec of Array.isArray(localArr) ? localArr : []) if (rec?.id) byId.set(rec.id, rec);
  for (const rec of Array.isArray(remoteArr) ? remoteArr : []) {
    if (!rec?.id) continue;
    const mine = byId.get(rec.id);
    // Prefer whichever copy was touched last; fall back to the remote one.
    const mineAt = mine ? (mine.openedAt || mine.createdAt || mine.at || 0) : -1;
    const theirsAt = rec.openedAt || rec.createdAt || rec.at || 0;
    byId.set(rec.id, theirsAt >= mineAt ? rec : mine);
  }
  return [...byId.values()];
}

function applyRemote(key, remoteValue) {
  if (!SYNCED_KEYS.includes(key)) return;
  let next = remoteValue;

  if (MERGE_BY_ID.has(key)) {
    next = mergeById(store.get(key, []), remoteValue);
  } else if (key === 'profile') {
    // Never let the other device dictate who is sitting in front of this one,
    // nor overwrite this device's own live location with its older copy.
    const mine = store.get('profile', null);
    if (!mine) return;
    const me = mine.activePartner;
    next = { ...remoteValue, activePartner: me, accent: mine.accent, title: mine.title };
    if (me && mine[me]?.lastLocAt && (!remoteValue[me]?.lastLocAt || mine[me].lastLocAt > remoteValue[me].lastLocAt)) {
      next[me] = mine[me];
    }
  }

  store.set(key, next, { fromRemote: true });
  announce(key, next, { remote: true });
}

async function loadClient() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

/** Send one key upward, debounced so rapid edits become a single write. */
function schedulePush(key, value) {
  if (!ready || !SYNCED_KEYS.includes(key)) return;
  clearTimeout(pushTimers.get(key));
  pushTimers.set(key, setTimeout(async () => {
    try {
      await client.from('couple_data').upsert(
        { couple_code: COUPLE_CODE, key, value, updated_at: new Date().toISOString() },
        { onConflict: 'couple_code,key' },
      );
    } catch { /* offline: the next save will carry it up */ }
  }, 400));
}

export async function initSync() {
  if (!syncConfigured()) return false;
  try {
    client = await loadClient();
    const { data } = await client.auth.getSession();
    if (!data?.session) await client.auth.signInAnonymously();

    // 1. Pull everything that already exists, so a new device fills up instantly.
    const { data: rows, error } = await client
      .from('couple_data').select('key,value').eq('couple_code', COUPLE_CODE);
    if (error) throw error;
    for (const row of rows || []) applyRemote(row.key, row.value);

    // 2. Listen for anything the other device writes from now on.
    client.channel(`couple:${COUPLE_CODE}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'couple_data', filter: `couple_code=eq.${COUPLE_CODE}` },
        payload => {
          const row = payload.new;
          if (row?.key) applyRemote(row.key, row.value);
        })
      .subscribe();

    // 3. Mirror every future local save upward.
    onWrite(schedulePush);
    ready = true;

    // 4. Push what this device already has, so an existing app seeds the shared row.
    for (const key of SYNCED_KEYS) {
      const val = store.get(key, null);
      if (val !== null) schedulePush(key, val);
    }
    return true;
  } catch (err) {
    console.warn('[same-sky] sync unavailable:', err?.message || err);
    ready = false;
    return false;
  }
}
