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

import { SUPABASE_URL, SUPABASE_ANON_KEY, syncConfigured } from './config.js';
import { store, onWrite } from './store.js';
import { coupleCode } from './couple.js';
import { roomId, sealJSON, openJSON } from './crypto.js';

let room = null;   // hash of the couple code: what the server sees

const SYNCED_KEYS = [
  'profile', 'notes', 'letters', 'questions', 'moods',
  'affection', 'bucket', 'milestonesCustom', 'deletedIds', 'photoMeta',
];

// Keys whose value is an array of records carrying a stable `id`.
const MERGE_BY_ID = new Set(['notes', 'letters', 'questions', 'bucket', 'milestonesCustom', 'affection', 'photoMeta']);

let client = null;
let ready = false;
const remoteListeners = [];
let pushTimers = new Map();

export const syncEnabled = () => syncConfigured() && Boolean(coupleCode());
export const syncReady = () => ready;
/** The photo store needs the same authenticated client for Storage uploads. */
export const syncClient = () => client;

export function onRemoteChange(fn) { remoteListeners.push(fn); }

function announce(key, value, meta) {
  for (const fn of remoteListeners) {
    try { fn(key, value, meta); } catch { /* a bad listener must not stop the rest */ }
  }
}

/** Merge an incoming array onto the local one by record id, newest wins.
 *  Anything either device has deleted stays deleted — without this, a merge would
 *  hand the note straight back and it would appear to rise from the dead. */
function mergeById(localArr, remoteArr) {
  const gone = new Set(store.get('deletedIds', []).map(d => d.id || d));
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
  return [...byId.values()].filter(rec => !gone.has(rec.id));
}

function applyRemote(key, remoteValue) {
  if (!SYNCED_KEYS.includes(key)) return;
  // Symmetrically: never let a blank profile from a wiped device overwrite a good one.
  if (key === 'profile' && !remoteValue?.setupComplete && store.get('profile', null)?.setupComplete) return;
  let next = remoteValue;

  if (MERGE_BY_ID.has(key)) {
    next = mergeById(store.get(key, []), remoteValue);
  } else if (key === 'profile') {
    const mine = store.get('profile', null);
    if (!mine || !mine.setupComplete) {
      // A brand-new device (her phone, opening the link for the first time): take
      // the couple's world as it is, but let this device say who is holding it.
      store.set('profile', { ...remoteValue, activePartner: null }, { fromRemote: true });
      announce(key, remoteValue, { remote: true, firstPull: true });
      return;
    }
    // Otherwise: never let the other device dictate who is sitting in front of this
    // one, nor overwrite this device's own live location with its older copy.
    const me = mine.activePartner;
    next = { ...remoteValue, activePartner: me, accent: mine.accent, title: mine.title };
    if (me && mine[me]?.lastLocAt && (!remoteValue[me]?.lastLocAt || mine[me].lastLocAt > remoteValue[me].lastLocAt)) {
      next[me] = mine[me];
    }
  }

  store.set(key, next, { fromRemote: true });

  // Tombstones can arrive after the list they refer to, so whenever the deleted
  // set lands, sweep it across everything again. Without this, whether a deleted
  // note stays deleted would depend on which message happened to arrive first.
  if (key === 'deletedIds') sweepDeleted();

  announce(key, next, { remote: true });
}

function sweepDeleted() {
  const gone = new Set(store.get('deletedIds', []).map(d => d.id || d));
  if (!gone.size) return;
  for (const key of MERGE_BY_ID) {
    const list = store.get(key, null);
    if (!Array.isArray(list)) continue;
    const kept = list.filter(rec => !gone.has(rec?.id));
    if (kept.length !== list.length) store.set(key, kept, { fromRemote: true });
  }
}

async function loadClient() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

/** Send one key upward, debounced so rapid edits become a single write.
 *
 *  A device only ever speaks once it has a real, set-up profile. Without this, a
 *  device that was just wiped (or is mid-setup) would push its blank defaults over
 *  the couple's shared world and erase both their names from the other phone. */
function schedulePush(key, value) {
  if (!ready || !SYNCED_KEYS.includes(key)) return;
  const local = store.get('profile', null);
  if (!local?.setupComplete) return;
  if (key === 'profile' && !value?.setupComplete) return;
  if (key === 'moods' && value && Object.keys(value).length === 0) return;
  clearTimeout(pushTimers.get(key));
  pushTimers.set(key, setTimeout(async () => {
    try {
      const sealed = await sealJSON(coupleCode(), value);
      await client.from('couple_data').upsert(
        { couple_code: room, key, value: sealed, updated_at: new Date().toISOString() },
        { onConflict: 'couple_code,key' },
      );
    } catch { /* offline: the next save will carry it up */ }
  }, 400));
}

export async function initSync() {
  if (!syncConfigured() || !coupleCode()) return false;
  try {
    client = await loadClient();
    room = await roomId(coupleCode());
    const { data } = await client.auth.getSession();
    if (!data?.session) await client.auth.signInAnonymously();

    // 1. Pull everything that already exists, so a new device fills up instantly.
    const { data: rows, error } = await client
      .from('couple_data').select('key,value').eq('couple_code', room);
    if (error) throw error;
    for (const row of rows || []) {
      try { applyRemote(row.key, await openJSON(coupleCode(), row.value)); }
      catch { /* not ours to read — wrong code */ }
    }

    // 2. Listen for anything the other device writes from now on.
    client.channel(`couple:${room}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'couple_data', filter: `couple_code=eq.${room}` },
        async payload => {
          const row = payload.new;
          if (!row?.key) return;
          try { applyRemote(row.key, await openJSON(coupleCode(), row.value)); }
          catch { /* can't open it, so it isn't for us */ }
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
