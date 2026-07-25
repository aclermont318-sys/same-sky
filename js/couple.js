// Same Sky — the couple code: the one secret that pairs two devices.
//
// It deliberately does NOT live in the source. It is created when the first person
// sets up, kept in that device's own storage, and travels to the other person only
// inside the invite link. That way the app itself can be hosted publicly while your
// world stays private — the link is the key.

import { store } from './store.js';

const KEY = 'coupleCode';

export function coupleCode() {
  return store.get(KEY, '') || '';
}

export function setCoupleCode(code) {
  if (code) store.set(KEY, String(code).trim());
}

export function newCoupleCode() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `samesky-${hex.slice(0, 24)}`;
}

/** The link the first person sends: "come join the family". */
export function inviteLink() {
  const base = `${location.origin}${location.pathname}`.replace(/index\.html$/, '');
  return `${base}#join=${coupleCode()}`;
}

/** If this page was opened from an invite, take the code and tidy the address bar
 *  so the secret isn't left sitting in the URL of a shared screen. */
export function consumeJoinLink() {
  const found = (location.hash || '').match(/[#&]join=([A-Za-z0-9_-]{8,})/);
  if (!found) return false;
  setCoupleCode(found[1]);
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  return true;
}

/** Which partner slot is still free for someone to claim. */
export function freeSlot(profile) {
  if (!profile) return null;
  if (!profile.a?.claimed) return 'a';
  if (!profile.b?.claimed) return 'b';
  return null;
}
