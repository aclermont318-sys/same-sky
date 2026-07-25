// Same Sky — keeps this device's location fresh on its own.
//
// While the app is open and the setting is on, the browser reports movement and we
// save it. Writes are throttled: only when you've actually moved a meaningful
// distance, or once every few minutes, so storage (and later, sync) stays quiet.

import { store } from './store.js';
import { toast } from './app.js';
import { refreshMapPositions } from './map.js';

const MIN_METRES = 120;        // ignore GPS jitter while sitting still
const MIN_GAP_MS = 3 * 60e3;   // ...but do refresh the timestamp now and then

let watchId = null;

export function autoLocationOn() {
  return store.get('autoLocation', false);
}

function metresBetween(a, b) {
  const R = 6371e3, toRad = x => x * Math.PI / 180;
  const s = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function savePosition(pos) {
  const prof = store.get('profile', null);
  if (!prof) return;
  const me = prof.activePartner;
  if (!me) return;
  const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  const prev = prof[me];

  const moved = prev.lat == null || metresBetween(prev, next) >= MIN_METRES;
  const stale = !prev.lastLocAt || Date.now() - prev.lastLocAt >= MIN_GAP_MS;
  if (!moved && !stale) return;

  prof[me].lat = next.lat;
  prof[me].lng = next.lng;
  prof[me].lastLocAt = Date.now();
  prof[me].auto = true;
  store.set('profile', prof);

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
