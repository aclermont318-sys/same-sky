// Same Sky — settings view + first-run partner picker.

import { store, defaultProfile, photosAvailable } from './store.js';
import { toast } from './app.js';
import { html, render, clear } from './dom.js';

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

export function maybeFirstRun(onDone) {
  const p = getProfile();
  if (p.activePartner) return;
  const root = document.getElementById('overlay-root');
  render(root, html`
    <div class="firstrun">
      <div class="firstrun-card">
        <div class="firstrun-title">Same Sky 💌</div>
        <div class="firstrun-sub">one little app, two hearts.<br>Who's holding this device?</div>
        <div class="firstrun-choices">
          <button class="firstrun-choice" data-pick="a"><span class="big">${p.a.emoji}</span>${p.a.name}</button>
          <button class="firstrun-choice" data-pick="b"><span class="big">${p.b.emoji}</span>${p.b.name}</button>
        </div>
        <p class="firstrun-sub" style="margin-top:18px">you can rename both of you in Settings ⚙️</p>
      </div>
    </div>`);
  root.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', () => {
    const prof = getProfile();
    prof.activePartner = btn.dataset.pick;
    store.set('profile', prof);
    clear(root);
    toast(`Welcome, ${prof[btn.dataset.pick].name} 💕`);
    onDone();
  }));
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
          ${zones().map(z => html`<option value="${z}" ${z === q.tz ? 'selected' : ''}>${z.replace(/_/g, ' ')}</option>`)}
        </select>
      </div>
      <div class="loc-caption" style="text-align:left">lat ${q.lat.toFixed(3)} · lng ${q.lng.toFixed(3)} ${q.lastLocAt ? '· live location saved' : '· from city'}</div>
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
        <div class="field"><label>Together since 💞</label><input type="date" data-f="startDate" value="${p.startDate}"></div>
        <div class="field"><label>Next visit ✈️</label><input type="date" data-f="nextVisit" value="${p.nextVisit || ''}"></div>
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
    <div style="text-align:center"><button class="btn" id="btn-save" style="min-width:220px">Save settings 💾</button></div>
  `);

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
      if (path[0] === 'nextVisit' && !v) v = null;
      if (path.length === 1) prof[path[0]] = v;
      else prof[path[0]][path[1]] = v;
    });
    store.set('profile', prof);
    document.querySelector('.wordmark-title').textContent = prof.title || 'Same Sky';
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
