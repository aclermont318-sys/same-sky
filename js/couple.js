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

const appBase = () => `${location.origin}${location.pathname}`.replace(/index\.html$/, '');

/** The link the first person sends: "come join the family". */
export function inviteLink() {
  return `${appBase()}#join=${coupleCode()}`;
}

/** The link you send yourself, to put the app on your own phone as well. */
export function deviceLink() {
  return `${appBase()}#device=${coupleCode()}`;
}

/** If this page was opened from an invite, take the code.
 *
 *  The hash deliberately STAYS in the address bar until the person has actually
 *  joined. On iPhone, "Add to Home Screen" saves whatever URL is showing, and an
 *  installed web app gets its own storage — so if the code were stripped first, the
 *  icon on her home screen would open an empty app with no way back to the family. */
export function consumeJoinLink() {
  const hash = location.hash || '';
  const asNewPerson = hash.match(/[#&]join=([A-Za-z0-9_-]{8,})/);
  const asOwnDevice = hash.match(/[#&]device=([A-Za-z0-9_-]{8,})/);
  const found = asNewPerson || asOwnDevice;
  if (!found) return false;
  setCoupleCode(found[1]);
  // Two different arrivals: someone joining the family for the first time, versus
  // one of you adding another of your own devices. The second must not be offered
  // the empty seat — it belongs to the partner who hasn't joined yet.
  store.set('linkIntent', asOwnDevice ? 'device' : 'join');
  return true;
}

export const linkIntent = () => store.get('linkIntent', 'join');

/** Called once someone is safely in: tidy the secret out of the address bar. */
export function clearJoinHash() {
  if (location.hash.includes('join=')) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
}

/** Running from a home-screen icon rather than a browser tab? */
export const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Which partner slot is still free for someone to claim. */
export function freeSlot(profile) {
  if (!profile) return null;
  if (!profile.a?.claimed) return 'a';
  if (!profile.b?.claimed) return 'b';
  return null;
}
