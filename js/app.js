// Same Sky — boot, routing, shared helpers.
// Views live in their own modules and render into #view-<name>.

import { renderHome } from './home.js';
import { renderMap, teardownMap } from './map.js';
import { renderMemories } from './memories.js';
import { renderNotes } from './notes.js';
import { renderUs } from './us.js';
import { renderSettings } from './settings.js';
import { runSetup, askWhoIsHere, joinFamily, applyAccent } from './setup.js';
import { consumeJoinLink, coupleCode, freeSlot } from './couple.js';
import { initAutoLocation } from './location.js';
import { initSync, syncEnabled, onRemoteChange } from './sync.js';
import { initNotifications, clearBadge } from './notify.js';
import { initPhotoSync } from './photosync.js';
import { store } from './store.js';
import { html, render } from './dom.js';

// Lets a browser tell you exactly which build it is running — stale caches on a
// phone are otherwise indistinguishable from a code bug.
export const BUILD = '2026-07-25T19:45Z';
window.SAME_SKY_BUILD = BUILD;

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
  clearBadge(name);
  current = name;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
  RENDERERS[name]();
  window.scrollTo({ top: 0 });
}

export function rerender() { RENDERERS[current](); }

/** Keep the wordmark and the window/tab title in step with a renamed app. */
export function applyTitle(title) {
  const name = title || 'Same Sky';
  document.querySelector('.wordmark-title').textContent = name;
  document.title = `${name} 💌`;
}

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
  // Tapping an invite while the app is already open only changes the hash — the page
  // never reloads — so catch that and start again properly.
  window.addEventListener('hashchange', () => {
    if (consumeJoinLink()) location.reload();
  });

  // An invite link carries the couple code; take it before anything else reads it.
  const invited = consumeJoinLink();
  const p = store.get('profile', null);
  if (invited && p?.setupComplete && !freeSlot(p)) {
    // Opening an invite on a device that is already fully set up would be confusing.
    toast('This device is already part of a family 💌');
  }
  applyTitle(p?.title);
  applyAccent(p?.accent);
  document.querySelectorAll('[data-nav]').forEach(b =>
    b.addEventListener('click', () => showView(b.dataset.nav)));
  watchOtherWindows();
  initAutoLocation();

  const startFlow = () => {
    const now = store.get('profile', null);
    applyTitle(now?.title);
    applyAccent(now?.accent);
    if (!now?.setupComplete) {
      runSetup(() => showView('home'));            // first person: build the family
    } else if (!now.activePartner) {
      // The family exists on this device but nobody here has said who they are.
      // If a place at the table is still free, this is the invited person arriving.
      if (freeSlot(now)) joinFamily(() => showView('home'));
      else askWhoIsHere(() => showView('home'));
    } else {
      rerender();
    }
  };

  if (syncEnabled()) {
    initNotifications();
    // Redraw whatever is on screen when the other device sends something,
    // unless a sentence is mid-flight in an input.
    onRemoteChange(() => {
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (!typing) rerender();
    });

    if (p?.setupComplete) {
      startFlow();
      initSync().then(() => initPhotoSync(() => {
        if (current === 'memories') rerender();
      }));
    } else {
      // A device opening the app for the first time: give sync a moment to hand
      // over the couple's world, so it asks "who's holding this?" instead of
      // making the second person set everything up from scratch again.
      showConnecting();
      initSync().finally(async () => {
        // Someone arriving on an invite must never be dropped into "start a new
        // family" just because the first connection was slow — that would look like
        // their partner's world doesn't exist. Try again, then say so plainly.
        if (coupleCode() && !store.get('profile', null)?.setupComplete) {
          await new Promise(r => setTimeout(r, 1500));
          await initSync();
        }
        hideConnecting();
        if (coupleCode() && !store.get('profile', null)?.setupComplete) {
          showJoinFailed();
          return;
        }
        startFlow();
        initPhotoSync(() => { if (current === 'memories') rerender(); });
      });
    }
  } else {
    startFlow();
  }
  showView('home');
}

function showConnecting() {
  const root = document.getElementById('overlay-root');
  render(root, html`
    <div class="firstrun">
      <div class="firstrun-card">
        <div class="wizard-mark">💌</div>
        <div class="firstrun-sub">finding your person…</div>
      </div>
    </div>`);
}

function hideConnecting() {
  const root = document.getElementById('overlay-root');
  if (root.querySelector('.wizard-mark')) root.replaceChildren();
}

function showJoinFailed() {
  const root = document.getElementById('overlay-root');
  render(root, html`
    <div class="firstrun">
      <div class="firstrun-card">
        <div class="wizard-mark">🌙</div>
        <div class="firstrun-title">Couldn't reach your family</div>
        <div class="firstrun-sub">the invite is fine — the connection wasn't.<br>Have another go in a moment.</div>
        <div class="firstrun-choices" style="margin-top:18px">
          <button class="btn" id="retry-join">try again</button>
        </div>
        <button class="linky" id="fresh-start">or start a new family on this device</button>
      </div>
    </div>`);
  root.querySelector('#retry-join').addEventListener('click', () => location.reload());
  root.querySelector('#fresh-start').addEventListener('click', () => {
    if (!confirm('Start a brand-new family here instead of joining?')) return;
    store.set('coupleCode', '');
    location.reload();
  });
}

boot();
