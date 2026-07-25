// Same Sky — settings view + first-run partner picker.

import { store, defaultProfile, photosAvailable, wipeAll } from './store.js';
import { toast, applyTitle } from './app.js';
import { ACCENTS, applyAccent } from './setup.js';
import { syncEnabled, syncReady } from './sync.js';
import { inviteLink, deviceLink, freeSlot } from './couple.js';
import { notificationsAllowed, askForNotifications } from './notify.js';
import { html, render } from './dom.js';

function zones() {
  try { return Intl.supportedValuesOf('timeZone'); }
  catch {
    return ['Europe/Zurich', 'Europe/Berlin', 'Europe/London', 'Europe/Paris', 'Europe/Madrid', 'Europe/Rome',
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto',
      'America/Sao_Paulo', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Dubai',
      'Asia/Kolkata', 'Asia/Manila', 'Australia/Sydney', 'Pacific/Auckland', 'Africa/Cairo', 'UTC'];
  }
}

export function getProfile() {
  const p = store.get('profile', null);
  if (p) return p;
  const fresh = defaultProfile();
  store.set('profile', fresh);
  return fresh;
}

async function geocode(city) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  const json = await res.json();
  const hit = json.results?.[0];
  if (!hit) throw new Error('not found');
  return { lat: hit.latitude, lng: hit.longitude, tz: hit.timezone, label: `${hit.name}${hit.country ? ', ' + hit.country : ''}` };
}

function partnerFields(p, slot) {
  const q = p[slot];
  return html`
    <div class="card">
      <div class="partner-head">
        <span class="stamp-frame"><span class="stamp">${q.emoji}</span></span>
        <h3>${slot === 'a' ? 'Partner A' : 'Partner B'}</h3>
        ${p.activePartner === slot ? html`<span class="chip">this device 📱</span>` : ''}
      </div>
      <div class="field"><label>Name</label><input data-f="${slot}.name" value="${q.name}" maxlength="24"></div>
      <div class="field"><label>Emoji avatar</label><input data-f="${slot}.emoji" value="${q.emoji}" maxlength="4"></div>
      <div class="field"><label>City</label>
        <div style="display:flex;gap:8px">
          <input data-f="${slot}.city" value="${q.city}" style="flex:1">
          <button class="btn-ghost btn-small" data-geo="${slot}">📍 find</button>
        </div>
      </div>
      <div class="field"><label>Time zone</label>
        <select data-f="${slot}.tz">
          ${/* An unset zone must stay unset. Without this placeholder the browser
                would show the first zone in the list and the next Save would write
                it in — a clock that looks right and lies. */ ''}
          <option value="" ${!q.tz ? 'selected' : ''}>— not set yet —</option>
          ${!q.tz || zones().includes(q.tz) ? '' : html`<option value="${q.tz}" selected>${q.tz.replace(/_/g, ' ')}</option>`}
          ${zones().map(z => html`<option value="${z}" ${z === q.tz ? 'selected' : ''}>${z.replace(/_/g, ' ')}</option>`)}
        </select>
      </div>
      <div class="loc-caption" style="text-align:left">
        ${q.lat == null ? 'no location yet — type a city and press find'
          : html`lat ${q.lat.toFixed(3)} · lng ${q.lng.toFixed(3)} ${q.lastLocAt ? '· live location saved' : '· from city'}`}
      </div>
    </div>`;
}

export function renderSettings() {
  const p = getProfile();
  const el = document.getElementById('view-settings');
  render(el, html`
    <div class="card airmail-top">
      <h2 class="card-title">Settings <span class="hint">make it yours</span></h2>
      <div class="settings-grid">
        <div class="field"><label>App title</label><input data-f="title" value="${p.title}" maxlength="30"></div>
        <div class="field"><label>Whose device is this?</label>
          <select data-f="activePartner">
            <option value="a" ${p.activePartner === 'a' ? 'selected' : ''}>${p.a.emoji} ${p.a.name}</option>
            <option value="b" ${p.activePartner === 'b' ? 'selected' : ''}>${p.b.emoji} ${p.b.name}</option>
          </select>
        </div>
        <div class="field"><label>Together since 💞</label><input type="date" data-f="startDate" value="${p.startDate || ''}"></div>
        <div class="field"><label>Next visit ✈️</label><input type="date" data-f="nextVisit" value="${p.nextVisit || ''}"></div>
      </div>
      <div class="field" style="margin-top:8px">
        <label>Colour</label>
        <div class="accent-row">
          ${Object.entries(ACCENTS).map(([key, a]) => html`
            <button class="accent ${key === (p.accent || 'rose') ? 'selected' : ''}" data-accent="${key}">
              <span class="accent-dot" style="background:${a.dot}"></span>${a.label}
            </button>`)}
        </div>
      </div>
    </div>
    <div class="duo-grid">
      ${partnerFields(p, 'a')}
      ${partnerFields(p, 'b')}
    </div>
    <div class="card">
      <h2 class="card-title">Backup <span class="hint">a love letter of data 💌</span></h2>
      <p class="danger-note">Download everything (photos included) as one file. Import it on your partner's phone to share your world — and every now and then to stay in sync, until real-time sync is wired up.</p>
      <div class="settings-actions">
        <button class="btn" id="btn-export">⬇️ Export backup</button>
        <label class="btn-ghost" style="cursor:pointer">📂 Import backup<input type="file" id="inp-import" accept=".json,application/json" style="display:none"></label>
      </div>
    </div>
    <div class="card">
      <h2 class="card-title">Sharing <span class="hint">the two of you, one world</span></h2>
      ${syncEnabled() ? html`
        <div class="sync-state"><span class="sync-dot ${syncReady() ? 'on' : ''}"></span>
          ${syncReady() ? 'connected — everything you write reaches them in about a second' : 'connecting…'}
        </div>
        <p class="danger-note" style="margin-top:10px">Notes, letters, questions, moods, hugs and your location travel both ways. Photos stay on the device that added them for now.</p>
        <div class="settings-actions">
          <button class="btn" id="btn-notify">${notificationsAllowed() ? '🔔 notifications on' : '🔔 turn on notifications'}</button>
        </div>
        <h3 style="margin-top:22px;font-size:16px">${freeSlot(p) ? `Invite ${p[freeSlot(p)].name || 'them'}` : 'Family invite link'}</h3>
        <p class="danger-note">${freeSlot(p)
          ? `${p[freeSlot(p)].name || 'They'} hasn't joined yet. Send this link — they set up their own character when they open it.`
          : 'Both of you have joined. Only re-send this if one of you needs to set up a new device.'}</p>
        <div class="invite-box" id="invite-box">${inviteLink()}</div>
        <div class="settings-actions"><button class="btn-ghost" id="btn-copy-invite">📋 copy invite link</button></div>
        <h3 style="margin-top:22px;font-size:16px">Your own other phone</h3>
        <p class="danger-note">Putting the app on a second device of your own? Use this one instead — it asks who you are rather than offering the free seat.</p>
        <div class="invite-box" id="device-box">${deviceLink()}</div>
        <div class="settings-actions"><button class="btn-ghost" id="btn-copy-device">📋 copy my device link</button></div>
        <p class="danger-note">Either link opens your world — keep both between you two.</p>` : html`
        <p class="danger-note">Right now this app lives only on this device — nothing you write reaches ${p[p.activePartner === 'a' ? 'b' : 'a'].name || 'your partner'} automatically. Turning on sharing takes about ten minutes and stays free; the steps are in <strong>docs/SETUP-SYNC.md</strong> in the app folder.</p>
        <p class="danger-note">Until then, use the backup file below to hand your world over.</p>`}
    </div>
    <div class="card">
      <h2 class="card-title">Start fresh <span class="hint">handing this to someone new?</span></h2>
      <p class="danger-note">Erases everything on this device — notes, letters, photos, both profiles — and runs the setup again from scratch. Export a backup first if you want to keep any of it.</p>
      <div class="settings-actions"><button class="btn-ghost" id="btn-reset">🧹 Erase and set up again</button></div>
    </div>
    <div style="text-align:center"><button class="btn" id="btn-save" style="min-width:220px">Save settings 💾</button></div>
  `);

  el.querySelectorAll('[data-accent]').forEach(b => b.addEventListener('click', () => {
    const prof = getProfile();
    prof.accent = b.dataset.accent;
    store.set('profile', prof);
    applyAccent(prof.accent);
    el.querySelectorAll('[data-accent]').forEach(x => x.classList.toggle('selected', x === b));
  }));

  el.querySelector('#btn-copy-invite')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(inviteLink());
      toast('Invite link copied 💌');
    } catch {
      const box = el.querySelector('#invite-box');
      const range = document.createRange();
      range.selectNodeContents(box);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      toast('Selected — long-press to copy');
    }
  });

  el.querySelector('#btn-copy-device')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(deviceLink());
      toast('Device link copied 📱');
    } catch {
      const box = el.querySelector('#device-box');
      const range = document.createRange();
      range.selectNodeContents(box);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      toast('Selected — long-press to copy');
    }
  });

  el.querySelector('#btn-notify')?.addEventListener('click', async () => {
    await askForNotifications();
    renderSettings();
  });

  el.querySelector('#btn-reset').addEventListener('click', async () => {
    if (!confirm('Erase everything on this device and start the setup again?\n\nNotes, letters, photos and both profiles will be gone.')) return;
    if (!confirm('Really sure? This cannot be undone.')) return;
    await wipeAll();
    location.reload();
  });

  el.querySelectorAll('[data-geo]').forEach(btn => btn.addEventListener('click', async () => {
    const slot = btn.dataset.geo;
    const cityInput = el.querySelector(`[data-f="${slot}.city"]`);
    btn.textContent = '…';
    try {
      const g = await geocode(cityInput.value.trim());
      const prof = getProfile();
      prof[slot].city = g.label; prof[slot].lat = g.lat; prof[slot].lng = g.lng; prof[slot].tz = g.tz; prof[slot].lastLocAt = null;
      store.set('profile', prof);
      toast(`Found ${g.label} ✨`);
      renderSettings();
    } catch {
      toast('City not found — check the spelling?');
      btn.textContent = '📍 find';
    }
  }));

  el.querySelector('#btn-save').addEventListener('click', () => {
    const prof = getProfile();
    el.querySelectorAll('[data-f]').forEach(inp => {
      const path = inp.dataset.f.split('.');
      let v = inp.value;
      // "— not set yet —" means leave it alone; never turn an honest blank into a
      // guessed time zone just because someone saved an unrelated field.
      if (path[1] === 'tz' && v === '') return;
      if (path[0] === 'nextVisit' && !v) v = null;
      if (path[0] === 'startDate' && !v) return;
      if (path.length === 1) prof[path[0]] = v;
      else prof[path[0]][path[1]] = v;
    });
    store.set('profile', prof);
    applyTitle(prof.title);
    toast('Saved 💾💕');
    renderSettings();
  });

  el.querySelector('#btn-export').addEventListener('click', async () => {
    try {
      const blob = new Blob([JSON.stringify(await store.exportAll())], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `same-sky-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('Backup downloaded 💌');
    } catch { toast('Export failed — try again?'); }
  });

  el.querySelector('#inp-import').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await store.importAll(JSON.parse(await file.text()));
      toast('Imported! Reloading… 💞');
      setTimeout(() => location.reload(), 900);
    } catch {
      toast('That file doesn’t look like a Same Sky backup');
    }
  });

  if (!photosAvailable) toast('Heads-up: photo storage unavailable in this browser mode');
}
