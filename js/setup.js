// Same Sky — first-run setup, and the shorter "who's on this device?" picker.
//
// Everything the couple sees is entered here: both names, avatars, cities (with real
// coordinates and time zones), the date they count from, an optional next visit, the
// colour of the app and its title. Nothing is pre-filled with example data.

import { store, defaultProfile, deviceTimeZone } from './store.js';
import { toast, todayISO, fmtDate, applyTitle } from './app.js';
import { coupleCode, setCoupleCode, newCoupleCode, inviteLink, freeSlot } from './couple.js';
import { html, render, clear } from './dom.js';

export const ACCENTS = {
  rose: { label: 'Rose', dot: '#D9576E' },
  lavender: { label: 'Lavender', dot: '#9B7EDE' },
  ocean: { label: 'Ocean', dot: '#3E8EA8' },
  sunset: { label: 'Sunset', dot: '#E8804F' },
};

const AVATARS = ['🐻', '🐰', '🦊', '🐼', '🐨', '🐧', '🦋', '🌙', '⭐', '🍓', '🌸', '🐥', '🦖', '🐙'];

export function applyAccent(accent) {
  document.documentElement.dataset.accent = ACCENTS[accent] ? accent : 'rose';
}

// ————— city lookup (Open-Meteo geocoding, no API key) —————

async function searchCities(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('lookup failed');
  const json = await res.json();
  return (json.results || []).map(r => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    city: r.name + (r.country ? `, ${r.country}` : ''),
    lat: r.latitude,
    lng: r.longitude,
    tz: r.timezone || '',
  }));
}

// ————— wizard —————

const draft = { a: {}, b: {} };

export function runSetup(onDone) {
  const existing = store.get('profile', null);
  const base = existing && existing.setupComplete ? existing : defaultProfile();
  Object.assign(draft, JSON.parse(JSON.stringify(base)));
  draft.a.tz = draft.a.tz || deviceTimeZone();
  applyAccent(draft.accent);
  step1(onDone);
}

function shell(bodyFragment, { index, total = 6 }) {
  const root = document.getElementById('overlay-root');
  render(root, html`
    <div class="firstrun">
      <div class="wizard">
        <div class="wizard-dots">
          ${Array.from({ length: total }, (_, i) => html`<span class="${i === index ? 'on' : i < index ? 'done' : ''}"></span>`)}
        </div>
        ${bodyFragment}
      </div>
    </div>`);
  return root;
}

function step1(onDone) {
  const root = shell(html`
    <div class="wizard-hero">
      <div class="wizard-mark">💌</div>
      <h1 class="firstrun-title">Same Sky</h1>
      <p class="firstrun-sub">a little home for the two of you,<br>however many time zones apart</p>
      <button class="btn" id="go" style="min-width:200px">let's set it up ✨</button>
      <p class="wizard-fine">takes about a minute · everything stays on your devices</p>
      <button class="linky" id="restore">I already have a backup file</button>
    </div>`, { index: 0 });

  root.querySelector('#go').addEventListener('click', () => step2(onDone));
  root.querySelector('#restore').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await store.importAll(JSON.parse(await file.text()));
        toast('Restored 💞');
        location.reload();
      } catch {
        toast('That file doesn’t look like a Same Sky backup');
      }
    });
    inp.click();
  });
}

function personStep({ slot, index, title, hint, onNext, onBack, total = 6 }) {
  const who = draft[slot];
  const root = shell(html`
    <h2 class="wizard-title">${title}</h2>
    <p class="wizard-hint">${hint}</p>

    <div class="field">
      <label>Name</label>
      <input id="name" value="${who.name || ''}" maxlength="24" placeholder="how they call you" autocomplete="off">
    </div>

    <div class="field">
      <label>Pick an avatar</label>
      <div class="avatar-grid">
        ${AVATARS.map(a => html`<button class="avatar ${a === who.emoji ? 'selected' : ''}" data-av="${a}">${a}</button>`)}
      </div>
    </div>

    <div class="field">
      <label>City</label>
      <div class="city-row">
        <input id="city" value="${who.city || ''}" placeholder="type a city and press search" autocomplete="off">
        <button class="btn-ghost btn-small" id="find">search</button>
      </div>
      <div id="city-results"></div>
      <p class="wizard-fine" id="city-state">${who.lat != null ? `📍 ${who.city} · ${who.tz}` : 'we use this for the map, the clock and the weather'}</p>
    </div>

    <div class="wizard-actions">
      ${onBack ? html`<button class="btn-ghost" id="back">back</button>` : ''}
      <button class="btn" id="next">continue</button>
    </div>
    <button class="linky" id="skip">skip the city for now</button>
  `, { index, total });

  const nameInput = root.querySelector('#name');
  const cityInput = root.querySelector('#city');
  const results = root.querySelector('#city-results');
  const state = root.querySelector('#city-state');

  root.querySelectorAll('[data-av]').forEach(b => b.addEventListener('click', () => {
    who.emoji = b.dataset.av;
    root.querySelectorAll('[data-av]').forEach(x => x.classList.toggle('selected', x === b));
  }));

  const doSearch = async () => {
    const q = cityInput.value.trim();
    if (!q) { toast('Type a city first 🌍'); return; }
    state.textContent = 'looking…';
    try {
      const hits = await searchCities(q);
      if (!hits.length) { state.textContent = 'no city by that name — try another spelling'; return; }
      state.textContent = 'pick the right one:';
      render(results, html`
        ${hits.map((h, i) => html`<button class="city-hit" data-hit="${i}">${h.label}</button>`)}
      `);
      results.querySelectorAll('[data-hit]').forEach(btn => btn.addEventListener('click', () => {
        const hit = hits[+btn.dataset.hit];
        who.city = hit.city;
        who.lat = hit.lat;
        who.lng = hit.lng;
        who.tz = hit.tz || who.tz || deviceTimeZone();
        cityInput.value = hit.city;
        clear(results);
        state.textContent = `📍 ${hit.city} · ${who.tz}`;
      }));
    } catch {
      state.textContent = 'couldn’t reach the city lookup — you can add it later in Settings';
    }
  };

  root.querySelector('#find').addEventListener('click', doSearch);
  cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

  const commit = () => {
    const name = nameInput.value.trim();
    if (!name) { toast('A name, please 💛'); nameInput.focus(); return false; }
    who.name = name;
    if (!who.city) who.city = cityInput.value.trim();
    return true;
  };

  root.querySelector('#next').addEventListener('click', () => { if (commit()) onNext(); });
  root.querySelector('#skip').addEventListener('click', () => {
    if (!commit()) return;
    who.lat = null; who.lng = null;
    // Only this device's owner can safely borrow the device time zone. Guessing the
    // other person's would show two identical clocks, which is the one thing this
    // app must never get wrong.
    // Reset outright: a zone left over from a city they just abandoned would tick
    // in the wrong place forever. (No `||` here — that kept the stale value.)
    who.tz = slot === 'a' ? deviceTimeZone() : '';
    onNext();
  });
  root.querySelector('#back')?.addEventListener('click', onBack);
  nameInput.focus();
}

function step2(onDone) {
  personStep({
    slot: 'a',
    index: 1,
    title: 'First, you 💛',
    hint: 'this is the person holding this device',
    onNext: () => step3(onDone),
    onBack: () => step1(onDone),
  });
}

function step3(onDone) {
  // Only their name here: the rest of their character is theirs to choose when they
  // open the invite. Anything more and the app would be putting words in their mouth.
  const root = shell(html`
    <h2 class="wizard-title">And your person 💞</h2>
    <p class="wizard-hint">just their name for now</p>

    <div class="field">
      <label>What do you call them?</label>
      <input id="pname" value="${draft.b.name || ''}" maxlength="24" placeholder="their name" autocomplete="off">
    </div>

    <div class="wizard-summary" style="background:var(--sky-soft);color:#4A7396">
      🔗 At the end you'll get an invite link to send them. When they open it they
      pick their own avatar, their own city and join your family — you don't have to
      fill anything in for them.
    </div>

    <div class="wizard-actions">
      <button class="btn-ghost" id="back">back</button>
      <button class="btn" id="next">continue</button>
    </div>
  `, { index: 2, total: 6 });

  const input = root.querySelector('#pname');
  root.querySelector('#back').addEventListener('click', () => step2(onDone));
  root.querySelector('#next').addEventListener('click', () => {
    const name = input.value.trim();
    if (!name) { toast('What should I call them? 💛'); input.focus(); return; }
    draft.b.name = name;
    step4(onDone);
  });
  input.focus();
}

function step4(onDone) {
  const root = shell(html`
    <h2 class="wizard-title">Your story</h2>
    <p class="wizard-hint">the app counts every second from this day</p>

    <div class="field">
      <label>Together since</label>
      <input type="date" id="start" value="${draft.startDate || ''}" max="${todayISO()}">
    </div>

    <div class="field">
      <label>Next time you see each other <span class="opt">(optional)</span></label>
      <input type="date" id="visit" value="${draft.nextVisit || ''}" min="${todayISO()}">
      <p class="wizard-fine">no date yet? leave it empty — you can add it any time</p>
    </div>

    <div class="wizard-actions">
      <button class="btn-ghost" id="back">back</button>
      <button class="btn" id="next">continue</button>
    </div>
  `, { index: 3 });

  root.querySelector('#back').addEventListener('click', () => step3(onDone));
  root.querySelector('#next').addEventListener('click', () => {
    const start = root.querySelector('#start').value;
    const visit = root.querySelector('#visit').value;
    if (!start) { toast('When did it start? 🥺'); return; }
    if (start > todayISO()) { toast('That day hasn’t happened yet 💭'); return; }
    if (visit && visit < todayISO()) { toast('The next visit should be in the future ✈️'); return; }
    draft.startDate = start;
    draft.nextVisit = visit || null;
    step5(onDone);
  });
}

function step5(onDone) {
  const root = shell(html`
    <h2 class="wizard-title">Make it yours</h2>
    <p class="wizard-hint">last bit, promise</p>

    <div class="field">
      <label>Name of your app</label>
      <input id="title" value="${draft.title || 'Same Sky'}" maxlength="30">
    </div>

    <div class="field">
      <label>Colour</label>
      <div class="accent-row">
        ${Object.entries(ACCENTS).map(([key, a]) => html`
          <button class="accent ${key === draft.accent ? 'selected' : ''}" data-accent="${key}">
            <span class="accent-dot" style="background:${a.dot}"></span>${a.label}
          </button>`)}
      </div>
    </div>

    <div class="wizard-summary">
      <div><span>${draft.a.emoji}</span> ${draft.a.name}${draft.a.city ? html` · ${draft.a.city}` : ''}</div>
      <div><span>${draft.b.emoji}</span> ${draft.b.name}${draft.b.city ? html` · ${draft.b.city}` : ''}</div>
      <div>💞 together since ${fmtDate(draft.startDate)}</div>
      ${draft.nextVisit ? html`<div>✈️ next visit ${fmtDate(draft.nextVisit)}</div>` : ''}
    </div>

    <div class="wizard-actions">
      <button class="btn-ghost" id="back">back</button>
      <button class="btn" id="finish">start our story 💞</button>
    </div>
  `, { index: 4 });

  root.querySelectorAll('[data-accent]').forEach(b => b.addEventListener('click', () => {
    draft.accent = b.dataset.accent;
    applyAccent(draft.accent);
    root.querySelectorAll('[data-accent]').forEach(x => x.classList.toggle('selected', x === b));
  }));

  root.querySelector('#back').addEventListener('click', () => step4(onDone));
  root.querySelector('#finish').addEventListener('click', () => {
    draft.title = root.querySelector('#title').value.trim() || 'Same Sky';
    draft.activePartner = 'a';       // whoever ran setup is on this device
    draft.setupComplete = true;
    draft.a.claimed = true;          // this half of the family is filled in
    draft.b.claimed = false;         // ...the other half is theirs to complete
    if (!coupleCode()) setCoupleCode(newCoupleCode());
    store.set('profile', JSON.parse(JSON.stringify(draft)));
    applyTitle(draft.title);
    applyAccent(draft.accent);
    step6(onDone);
  });
}

/** The pay-off: the link that brings the other person into the family. */
function step6(onDone) {
  const link = inviteLink();
  const root = shell(html`
    <div class="wizard-hero">
      <div class="wizard-mark">💌</div>
      <h2 class="wizard-title">Invite ${draft.b.name}</h2>
      <p class="wizard-hint">send this link — it's the key to your family</p>
    </div>

    <div class="invite-box" id="invite-box">${link}</div>

    <div class="wizard-actions" style="justify-content:center">
      <button class="btn" id="copy" style="min-width:180px">📋 copy the link</button>
    </div>

    <div class="wizard-summary" style="margin-top:18px">
      <div>1 · send it to ${draft.b.name} however you like</div>
      <div>2 · they open it and set up their own character</div>
      <div>3 · from then on everything you write reaches each other</div>
    </div>
    <p class="wizard-fine">Keep this link private — anyone who opens it can see your world.
      You can find it again any time in Settings.</p>

    <div class="wizard-actions">
      <button class="btn-ghost" id="done" style="margin:0 auto">take me in ✨</button>
    </div>
  `, { index: 5, total: 6 });

  root.querySelector('#copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied — go send it 💌');
    } catch {
      // Clipboard blocked (common on a phone): select it so one tap copies.
      const box = root.querySelector('#invite-box');
      const range = document.createRange();
      range.selectNodeContents(box);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast('Selected — long-press to copy');
    }
  });

  root.querySelector('#done').addEventListener('click', () => {
    clear(document.getElementById('overlay-root'));
    toast(`Welcome, ${draft.a.name} 💕`);
    onDone();
  });
}

/** What the invited person sees: the family already exists, they add themselves. */
export function joinFamily(onDone) {
  const p = store.get('profile', null);
  if (!p) return;
  const slot = freeSlot(p) || 'b';
  const other = slot === 'a' ? 'b' : 'a';
  Object.assign(draft, JSON.parse(JSON.stringify(p)));
  draft.a.tz = draft.a.tz || '';
  applyAccent(draft.accent);
  applyTitle(draft.title);

  const root = shell(html`
    <div class="wizard-hero" style="padding-bottom:0">
      <div class="wizard-mark">💌</div>
      <h2 class="wizard-title">${p[other]?.name || 'Someone'} invited you</h2>
      <p class="wizard-hint">welcome to the family — now make yourself at home</p>
    </div>
  `, { index: 0, total: 2 });

  setTimeout(() => {
    personStep({
      slot,
      index: 1,
      total: 2,
      title: 'Your character 💛',
      hint: `${p[other]?.name || 'They'} already set up their side`,
      onNext: () => {
        draft[slot].claimed = true;
        draft.activePartner = slot;
        draft.setupComplete = true;
        store.set('profile', JSON.parse(JSON.stringify(draft)));
        clear(document.getElementById('overlay-root'));
        toast(`You're in, ${draft[slot].name} 💕`);
        onDone();
      },
    });
  }, 1600);
  return root;
}

// ————— short picker, used after restoring a backup on the other device —————

export function askWhoIsHere(onDone) {
  const p = store.get('profile', null);
  if (!p) return;
  const root = document.getElementById('overlay-root');
  render(root, html`
    <div class="firstrun">
      <div class="firstrun-card">
        <div class="firstrun-title">${p.title || 'Same Sky'} 💌</div>
        <div class="firstrun-sub">welcome back — who's holding this device?</div>
        <div class="firstrun-choices">
          <button class="firstrun-choice" data-pick="a"><span class="big">${p.a.emoji}</span>${p.a.name || 'Partner A'}</button>
          <button class="firstrun-choice" data-pick="b"><span class="big">${p.b.emoji}</span>${p.b.name || 'Partner B'}</button>
        </div>
        <p class="wizard-fine">notes, moods and your location get filed under whoever you pick</p>
      </div>
    </div>`);
  root.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', () => {
    const prof = store.get('profile', null);
    prof.activePartner = btn.dataset.pick;
    store.set('profile', prof);
    clear(root);
    toast(`Hi ${prof[btn.dataset.pick].name} 💕`);
    onDone();
  }));
}
