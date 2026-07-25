// Same Sky — telling you when your person did something.
//
// Two levels, both driven by the sync layer:
//   · in-app: a soft banner plus a dot on the tab that changed
//   · system: a real desktop/phone notification, once you allow it
//
// Nothing is announced for your own actions, and nothing is announced on the first
// load (otherwise opening the app would replay everything that ever happened).

import { store } from './store.js';
import { showView, toast } from './app.js';
import { onRemoteChange, syncEnabled } from './sync.js';

const SEEN_KEY = 'notifySeen';
let primed = false;

const DESCRIBE = {
  notes: { view: 'notes', icon: '💌', verb: 'left you a note' },
  letters: { view: 'notes', icon: '🕯️', verb: 'sealed a letter for you' },
  questions: { view: 'us', icon: '💭', verb: 'asked you something' },
  affection: { view: 'home', icon: '🤗', verb: 'sent you love' },
  moods: { view: 'home', icon: '🫧', verb: 'checked in with a mood' },
  bucket: { view: 'us', icon: '💫', verb: 'added to your bucket list' },
  milestonesCustom: { view: 'us', icon: '⭐', verb: 'added a milestone' },
  profile: { view: 'map', icon: '📍', verb: 'moved on the map' },
};

export function notificationsAllowed() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export async function askForNotifications() {
  if (typeof Notification === 'undefined') { toast('This browser has no notifications'); return false; }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    toast('Notifications are blocked in your browser settings');
    return false;
  }
  const res = await Notification.requestPermission();
  if (res === 'granted') { toast('You’ll hear about it now 🔔'); return true; }
  toast('No notifications — the app still shows a dot');
  return false;
}

function partnerName() {
  const p = store.get('profile', null);
  if (!p) return 'Your person';
  const you = p.activePartner === 'a' ? 'b' : 'a';
  return p[you]?.name || 'Your person';
}

/** What changed, from this device's point of view, in one short line. */
function describe(key, value) {
  const spec = DESCRIBE[key];
  if (!spec) return null;
  const p = store.get('profile', null);
  const me = p?.activePartner;
  const you = me === 'a' ? 'b' : 'a';

  // For the record-list keys, only speak up if the newest record is theirs.
  if (Array.isArray(value)) {
    const newest = [...value].sort((x, y) => (y.createdAt || y.at || 0) - (x.createdAt || x.at || 0))[0];
    if (!newest || newest.from === me || newest.author === me) return null;
    if (key === 'notes') return { ...spec, body: newest.text?.slice(0, 90) };
    if (key === 'letters') return { ...spec, body: newest.title };
    if (key === 'questions') return { ...spec, body: newest.text?.slice(0, 90) };
    if (key === 'affection') return { ...spec, verb: `sent you ${newest.type === 'kiss' ? 'a kiss' : newest.type === 'cuddle' ? 'cuddles' : 'a hug'}`, icon: newest.type === 'kiss' ? '😘' : newest.type === 'cuddle' ? '🫂' : '🤗' };
    return { ...spec, body: newest.text || '' };
  }
  if (key === 'moods' && value?.[you]) return { ...spec, body: `${value[you].emoji} right now` };
  if (key === 'profile' && value?.[you]?.lastLocAt) return spec;
  return null;
}

function badge(view) {
  document.querySelectorAll(`[data-nav="${view}"]`).forEach(b => b.classList.add('has-news'));
}

export function clearBadge(view) {
  document.querySelectorAll(`[data-nav="${view}"]`).forEach(b => b.classList.remove('has-news'));
}

function banner(text, view) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('button');
  el.className = 'news-banner';
  el.textContent = text;
  el.addEventListener('click', () => { showView(view); el.remove(); });
  root.appendChild(el);
  setTimeout(() => { el.classList.add('bye'); setTimeout(() => el.remove(), 350); }, 7000);
}

export function initNotifications() {
  if (!syncEnabled()) return;

  onRemoteChange((key, value) => {
    // The very first burst is the initial pull — that is history, not news.
    if (!primed) return;
    const what = describe(key, value);
    if (!what) return;

    const who = partnerName();
    const line = `${what.icon} ${who} ${what.verb}`;
    badge(what.view);
    banner(what.body ? `${line}: ${what.body}` : line, what.view);

    if (notificationsAllowed() && document.visibilityState !== 'visible') {
      try {
        new Notification(`${who} ${what.verb}`, {
          body: what.body || 'Open Same Sky 💌',
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          tag: `same-sky-${key}`,
        });
      } catch { /* some browsers only allow this from a service worker */ }
    }
    store.set(SEEN_KEY, Date.now());
  });

  // Give the initial pull a moment to land before anything counts as news.
  setTimeout(() => { primed = true; }, 4000);
}
