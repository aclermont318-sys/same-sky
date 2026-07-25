// Same Sky — map view: two heart pins, dashed connection, distance, live geolocation.

import { store } from './store.js';
import { getProfile } from './settings.js';
import { toast, relTime, showView } from './app.js';
import { html, render, escapeHTML } from './dom.js';

let map = null;

export function teardownMap() {
  if (map) { map.remove(); map = null; }
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
        <span class="chip">${p[me].emoji} you</span>
        <span class="chip sky">${p[you].emoji} ${p[you].name}</span>
      </div>
      <div class="loc-caption">
        ${p.a.emoji} ${p.a.name}: ${p.a.lastLocAt ? `live · ${relTime(p.a.lastLocAt)}` : `home city (${p.a.city})`}
        &nbsp;·&nbsp;
        ${p.b.emoji} ${p.b.name}: ${p.b.lastLocAt ? `live · ${relTime(p.b.lastLocAt)}` : `home city (${p.b.city})`}
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
  L.marker(A, { icon: pinIcon(p.a.emoji) }).addTo(map).bindPopup(`${escapeHTML(p.a.name)} · ${escapeHTML(p.a.city)}`);
  L.marker(B, { icon: pinIcon(p.b.emoji) }).addTo(map).bindPopup(`${escapeHTML(p.b.name)} · ${escapeHTML(p.b.city)}`);
  L.polyline([A, B], { dashArray: '6 10', weight: 2.5, color: '#D9576E', opacity: .8 }).addTo(map);
  map.fitBounds([A, B], { padding: [56, 56] });
  setTimeout(() => map && map.invalidateSize(), 60);

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
