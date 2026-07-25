// Same Sky — boot, routing, shared helpers.
// Views live in their own modules and render into #view-<name>.

import { renderHome } from './home.js';
import { renderMap, teardownMap } from './map.js';
import { renderMemories } from './memories.js';
import { renderNotes } from './notes.js';
import { renderUs } from './us.js';
import { renderSettings, maybeFirstRun } from './settings.js';
import { store } from './store.js';

const RENDERERS = {
  home: renderHome,
  map: renderMap,
  memories: renderMemories,
  notes: renderNotes,
  us: renderUs,
  settings: renderSettings,
};

let current = 'home';

export function showView(name) {
  if (!RENDERERS[name]) return;
  if (name !== 'map') teardownMap();
  current = name;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
  RENDERERS[name]();
  window.scrollTo({ top: 0 });
}

export function rerender() { RENDERERS[current](); }

export function toast(msg) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('bye'); setTimeout(() => el.remove(), 350); }, 2600);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO() {
  return localISO(new Date());
}

export function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00'), b = new Date(isoB + 'T00:00:00');
  return Math.round((b - a) / 864e5);
}

export function relTime(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// deterministic tiny rotation from an id, for stickies/polaroids
export function rotFor(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return ((h % 5) - 2) * 0.9; // -1.8 … 1.8 deg
}

// If a second window of the app changes something, refresh this one so it never
// shows (or writes back) a stale picture. Skipped while typing, so a note in
// progress is never yanked out from under the cursor.
function watchOtherWindows() {
  window.addEventListener('storage', e => {
    if (!e.key || !e.key.startsWith('samesky:')) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    rerender();
  });
}

function boot() {
  const p = store.get('profile', null);
  document.querySelector('.wordmark-title').textContent = p?.title || 'Same Sky';
  document.querySelectorAll('[data-nav]').forEach(b =>
    b.addEventListener('click', () => showView(b.dataset.nav)));
  watchOtherWindows();
  maybeFirstRun(() => showView('home'));
  showView('home');
}

boot();
