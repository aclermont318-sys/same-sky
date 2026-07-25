// Same Sky — keeps this device's location fresh on its own.
//
// While the app is open and the setting is on, the browser reports movement and we
// save it. Writes are throttled: only when you've actually moved a meaningful
// distance, or once every few minutes, so storage (and later, sync) stays quiet.

import { store } from './store.js';
import { toast, rerender } from './app.js';
import { refreshMapPositions } from './map.js';

const MIN_METRES = 120;          // ignore GPS jitter while sitting still
const MIN_GAP_MS = 3 * 60e3;     // ...but do refresh the timestamp now and then
const TZ_RECHECK_METRES = 75000; // only look up a time zone after a real journey

let watchId = null;
let lastTzCheck = null;          // { lat, lng } of the last successful lookup

export function autoLocationOn() {
  return store.get('autoLocation', false);
}

function metresBetween(a, b) {
  const R = 6371e3, toRad = x => x * Math.PI / 180;
  const s = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Which IANA zone is at these coordinates? Open-Meteo answers this for free with
 *  `timezone=auto`; the device's own zone is the fallback when we're offline. */
async function zoneAt(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('timezone lookup failed');
  const json = await res.json();
  if (!json.timezone) throw new Error('no timezone in response');
  return json.timezone;
}

/** Follow the person: if they've genuinely travelled, move their clock with them. */
async function maybeUpdateZone(me, coords) {
  const prof0 = store.get('profile', null);
  if (!prof0) return;
  const knownZone = prof0[me]?.tz;
  const farEnough = !lastTzCheck || metresBetween(lastTzCheck, coords) >= TZ_RECHECK_METRES;
  if (knownZone && !farEnough) return;

  let zone;
  try {
    zone = await zoneAt(coords.lat, coords.lng);
  } catch {
    return;   // offline: keep the zone we have rather than guessing a wrong one
  }
  lastTzCheck = { ...coords };

  const prof = store.get('profile', null);   // re-read: the await gave others a turn
  if (!prof || prof[me]?.tz === zone) return;
  const before = prof[me].tz;
  prof[me].tz = zone;
  store.set('profile', prof);
  if (before) toast(`Your clock moved with you — ${zone.replace(/_/g, ' ')} 🌍`);

  const homeOpen = document.getElementById('view-home')?.classList.contains('active');
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (homeOpen && !typing) rerender();
}

function savePosition(pos, { auto = true } = {}) {
  const prof = store.get('profile', null);
  if (!prof) return;
  const me = prof.activePartner;
  if (!me) return;
  const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  const prev = prof[me];

  // A deliberate tap always counts; only the background watcher is throttled.
  if (auto) {
    const moved = prev.lat == null || metresBetween(prev, next) >= MIN_METRES;
    const stale = !prev.lastLocAt || Date.now() - prev.lastLocAt >= MIN_GAP_MS;
    if (!moved && !stale) return;
  }

  prof[me].lat = next.lat;
  prof[me].lng = next.lng;
  prof[me].lastLocAt = Date.now();
  prof[me].auto = auto;
  store.set('profile', prof);
  maybeUpdateZone(me, next);

  // Nudge the pins in place if the map is on screen. Never a full re-render: that
  // would rebuild the map and re-zoom it while someone is looking at it.
  const mapOpen = document.getElementById('view-map')?.classList.contains('active');
  if (mapOpen) refreshMapPositions();
}

export function startAutoLocation({ announce = false } = {}) {
  if (!navigator.geolocation) {
    if (announce) toast('This browser has no location support');
    return false;
  }
  stopAutoLocation();
  watchId = navigator.geolocation.watchPosition(
    savePosition,
    err => {
      // Permission revoked or unavailable: switch the setting off rather than
      // silently pretending the location is still fresh.
      if (err.code === err.PERMISSION_DENIED) {
        store.set('autoLocation', false);
        stopAutoLocation();
        if (announce) toast('Location permission denied — auto-update is off');
      }
    },
    { enableHighAccuracy: false, maximumAge: 60e3, timeout: 30e3 },
  );
  return true;
}

export function stopAutoLocation() {
  if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

/** Called once at boot. */
export function initAutoLocation() {
  if (autoLocationOn()) startAutoLocation();
  document.addEventListener('visibilitychange', () => {
    if (!autoLocationOn()) return;
    if (document.visibilityState === 'visible') startAutoLocation();
    else stopAutoLocation();   // no point watching a hidden tab
  });
}

/** The manual "update my location" button goes through here too, so a one-off
 *  update also brings the clock along. */
export function applyManualPosition(coords) {
  savePosition({ coords: { latitude: coords.lat, longitude: coords.lng } }, { auto: false });
}

/** Settings/Map toggle. Returns the new state. */
export function setAutoLocation(on) {
  store.set('autoLocation', !!on);
  if (on) {
    const ok = startAutoLocation({ announce: true });
    if (ok) toast('Your location will keep itself up to date 📍');
    return ok;
  }
  stopAutoLocation();
  toast('Auto-update off — your pin stays where it is');
  return false;
}
