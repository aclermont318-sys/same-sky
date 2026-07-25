// Same Sky — map view: two heart pins, dashed connection, distance, live geolocation.

import { store } from './store.js';
import { getProfile } from './settings.js';
import { toast, relTime, showView } from './app.js';
import { autoLocationOn, setAutoLocation } from './location.js';
import { html, render, escapeHTML } from './dom.js';

let map = null;
let markers = {};
let line = null;

export function teardownMap() {
  if (map) { map.remove(); map = null; }
  markers = {};
  line = null;
}

/** Move the pins without rebuilding the map — used when a location auto-updates,
 *  so the map never flickers or re-zooms under someone who is looking at it. */
export function refreshMapPositions() {
  if (!map || !markers.a || !markers.b) return false;
  const p = getProfile();
  if (!hasCoords(p.a) || !hasCoords(p.b)) return false;

  const A = [p.a.lat, p.a.lng], B = [p.b.lat, p.b.lng];
  markers.a.setLatLng(A);
  markers.b.setLatLng(B);
  line?.setLatLngs([A, B]);

  const el = document.getElementById('view-map');
  const num = el?.querySelector('.distance-num');
  if (num) num.textContent = Math.round(distanceKm(p.a, p.b)).toLocaleString('en');
  const cap = el?.querySelector('.loc-caption');
  if (cap) {
    cap.textContent = ['a', 'b'].map(slot => `${p[slot].emoji} ${p[slot].name}: ${
      p[slot].lastLocAt
        ? `${p[slot].auto ? 'auto' : 'live'} · ${relTime(p[slot].lastLocAt)}`
        : `home city (${p[slot].city || 'not set'})`}`).join(' · ');
  }
  return true;
}

export function hasCoords(q) {
  return q && q.lat != null && q.lng != null;
}

export function distanceKm(a, b) {
  if (!hasCoords(a) || !hasCoords(b)) return null;
  const R = 6371, toRad = x => x * Math.PI / 180;
  const s = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function pinIcon(emoji) {
  return L.divIcon({
    className: 'pin',
    html: `<div class="pin-heart"><b>${escapeHTML(emoji)}</b></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
  });
}

export function renderMap() {
  const p = getProfile();
  const me = p.activePartner || 'a';
  const you = me === 'a' ? 'b' : 'a';
  const el = document.getElementById('view-map');
  const dist = distanceKm(p.a, p.b);

  if (dist === null) {
    render(el, html`
      <div class="card empty">
        <span class="empty-emoji">🗺️</span>
        add both your cities in Settings and your hearts will show up here
        <div style="margin-top:16px"><button class="btn" id="to-settings">open Settings ⚙️</button></div>
      </div>`);
    el.querySelector('#to-settings').addEventListener('click', () => showView('settings'));
    return;
  }
  const km = Math.round(dist);

  render(el, html`
    <div class="card airmail-top distance-banner">
      <div>
        <span class="distance-num">${km.toLocaleString('en')}</span>
        <span class="distance-sub"> km apart</span>
      </div>
      <div class="distance-sub">…but under the same sky 💫</div>
    </div>
    <div class="card" style="padding:14px">
      <div id="leaflet-holder"></div>
      <div class="map-actions">
        <button class="btn" id="btn-locate">📍 update my location</button>
        <label class="auto-toggle">
          <input type="checkbox" id="auto-loc" ${autoLocationOn() ? 'checked' : ''}>
          keep it updating on its own
        </label>
      </div>
      <div class="map-actions" style="margin-top:8px">
        <span class="chip">${p[me].emoji} you</span>
        <span class="chip sky">${p[you].emoji} ${p[you].name}</span>
      </div>
      <div class="loc-caption">
        ${['a', 'b'].map((slot, i) => html`${i ? ' · ' : ''}${p[slot].emoji} ${p[slot].name}: ${
          p[slot].lastLocAt
            ? `${p[slot].auto ? 'auto' : 'live'} · ${relTime(p[slot].lastLocAt)}`
            : `home city (${p[slot].city || 'not set'})`}`)}
      </div>
    </div>
  `);

  if (typeof L === 'undefined') {
    render(el.querySelector('#leaflet-holder'), html`<div class="empty"><span class="empty-emoji">🗺️</span>map couldn't load — are you offline?</div>`);
    return;
  }

  if (map) { map.remove(); map = null; }
  map = L.map(el.querySelector('#leaflet-holder'), { zoomControl: true, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  const A = [p.a.lat, p.a.lng], B = [p.b.lat, p.b.lng];
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#D9576E';
  markers.a = L.marker(A, { icon: pinIcon(p.a.emoji) }).addTo(map).bindPopup(`${escapeHTML(p.a.name)} · ${escapeHTML(p.a.city)}`);
  markers.b = L.marker(B, { icon: pinIcon(p.b.emoji) }).addTo(map).bindPopup(`${escapeHTML(p.b.name)} · ${escapeHTML(p.b.city)}`);
  line = L.polyline([A, B], { dashArray: '6 10', weight: 2.5, color: accent, opacity: .8 }).addTo(map);
  map.fitBounds([A, B], { padding: [56, 56] });
  setTimeout(() => map && map.invalidateSize(), 60);

  el.querySelector('#auto-loc').addEventListener('change', e => {
    const on = setAutoLocation(e.target.checked);
    e.target.checked = on;
  });

  el.querySelector('#btn-locate').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('This browser has no location support'); return; }
    const btn = el.querySelector('#btn-locate');
    btn.textContent = '⏳ finding you…';
    navigator.geolocation.getCurrentPosition(
      pos => {
        const prof = getProfile();
        prof[me].lat = pos.coords.latitude;
        prof[me].lng = pos.coords.longitude;
        prof[me].lastLocAt = Date.now();
        store.set('profile', prof);
        toast('Location updated — your heart moved on the map 💘');
        renderMap();
      },
      () => {
        toast(`Location unavailable — using ${p[me].city} instead`);
        btn.textContent = '📍 update my location';
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
