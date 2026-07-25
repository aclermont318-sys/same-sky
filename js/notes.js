// Same Sky — notes: pastel sticky wall + sealed "open when…" letters.

import { store } from './store.js';
import { getProfile } from './settings.js';
import { toast, uid, fmtDate, todayISO, localISO, rotFor } from './app.js';
import { html, render, clear } from './dom.js';

const COLORS = { butter: '#FFF3C4', blush: '#FFE0E5', mint: '#DFF2E1', sky: '#E3ECFA' };
let pickedColor = 'butter';

export function renderNotes() {
  const p = getProfile();
  const me = p.activePartner || 'a';
  const notes = store.get('notes', []);
  const letters = store.get('letters', []);
  const el = document.getElementById('view-notes');

  const sorted = [...notes].sort((x, y) => (y.pinned - x.pinned) || (y.createdAt - x.createdAt));

  render(el, html`
    <div class="card airmail-top composer">
      <h2 class="card-title">Leave a note <span class="hint">a little something for ${p[me === 'a' ? 'b' : 'a'].name}</span></h2>
      <textarea id="note-text" placeholder="write something cute…" maxlength="500"></textarea>
      <div class="composer-row">
        <div class="swatches">
          ${Object.entries(COLORS).map(([name, hex]) => html`
            <button class="swatch ${name === pickedColor ? 'selected' : ''}" data-swatch="${name}" style="background:${hex}" title="${name}"></button>`)}
        </div>
        <button class="btn" id="btn-post" style="margin-left:auto">stick it 💌</button>
      </div>
    </div>

    <div class="notes-wall" id="wall">
      ${sorted.length ? sorted.map(n => html`
        <div class="sticky ${n.pinned ? 'pinned' : ''}" style="background:${COLORS[n.color] || COLORS.butter};--rot:${rotFor(n.id)}deg">
          ${n.text}
          <div class="sticky-foot">
            <span class="who">${p[n.author]?.emoji || '💌'} ${p[n.author]?.name || '?'} · ${fmtDate(localISO(new Date(n.createdAt)))}</span>
            <button class="sticky-btn" data-pin="${n.id}" title="pin">📌</button>
            <button class="sticky-btn" data-del="${n.id}" title="delete">🗑</button>
          </div>
        </div>`) : html`
        <div class="card empty" style="column-span:all"><span class="empty-emoji">💌</span>the wall is empty — leave the first note!</div>`}
    </div>

    <div class="card" style="margin-top:24px">
      <h2 class="card-title">Sealed letters <span class="hint">"open when…" — sealed until the moment is right</span></h2>
      <div class="letters-grid" id="letters">
        ${letters.length ? [...letters].sort((x, y) => y.createdAt - x.createdAt).map(L => letterCard(L, p)) : ''}
      </div>
      ${!letters.length ? html`<div class="empty"><span class="empty-emoji">🕯️</span>no letters yet — seal one for a rainy day</div>` : ''}
      <div style="text-align:center;margin-top:14px"><button class="btn-ghost" id="btn-letter">✒️ write a sealed letter</button></div>
    </div>
  `);

  el.querySelectorAll('[data-swatch]').forEach(b => b.addEventListener('click', () => {
    pickedColor = b.dataset.swatch;
    el.querySelectorAll('[data-swatch]').forEach(x => x.classList.toggle('selected', x === b));
  }));

  el.querySelector('#btn-post').addEventListener('click', () => {
    const text = el.querySelector('#note-text').value.trim();
    if (!text) { toast('Write a little something first ✍️'); return; }
    notes.push({ id: uid(), author: me, text, color: pickedColor, pinned: false, createdAt: Date.now() });
    store.set('notes', notes);
    toast('Note stuck to the wall 💕');
    renderNotes();
  });

  el.querySelectorAll('[data-pin]').forEach(b => b.addEventListener('click', () => {
    const n = notes.find(x => x.id === b.dataset.pin);
    n.pinned = !n.pinned;
    store.set('notes', notes);
    renderNotes();
  }));
  el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Peel this note off forever?')) return;
    store.set('notes', notes.filter(x => x.id !== b.dataset.del));
    renderNotes();
  }));

  el.querySelector('#btn-letter').addEventListener('click', () => composeLetter(me));

  el.querySelectorAll('[data-openletter]').forEach(b => b.addEventListener('click', () => {
    const L = letters.find(x => x.id === b.dataset.openletter);
    if (L.openAt && L.openAt > todayISO()) {
      toast(`Not yet! This one opens ${fmtDate(L.openAt)} 🔒`);
      return;
    }
    L.openedAt = Date.now();
    store.set('letters', letters);
    renderNotes();
    const card = document.querySelector(`[data-letter="${L.id}"]`);
    card?.classList.add('opening');
    toast('Sealed with love, opened with love 💗');
  }));
}

function letterCard(L, p) {
  const sealed = !L.openedAt;
  return html`
    <div class="letter ${sealed ? 'sealed' : ''}" data-letter="${L.id}">
      ${sealed ? html`<button class="wax" data-openletter="${L.id}" title="break the seal">💌</button>` : ''}
      <div class="letter-title">${L.title}</div>
      <div class="letter-body">${L.body}</div>
      <div class="letter-foot">
        <span>${p[L.author]?.emoji || '💌'} ${p[L.author]?.name || '?'}</span>
        ${sealed && L.openAt ? html`<span class="chip sky">🔒 opens ${fmtDate(L.openAt)}</span>` :
          sealed ? html`<span class="chip">sealed 💋</span>` :
          html`<span class="chip">opened ${fmtDate(localISO(new Date(L.openedAt)))}</span>`}
      </div>
    </div>`;
}

function composeLetter(me) {
  const root = document.getElementById('overlay-root');
  render(root, html`
    <div class="modal-scrim" id="scrim">
      <div class="modal-card">
        <h2 class="card-title">Seal a letter <span class="hint">they'll only read it when it's time</span></h2>
        <div class="field"><label>Open when…</label><input id="lt-title" placeholder="Open when you miss me" maxlength="60"></div>
        <div class="field"><label>Your letter</label><textarea id="lt-body" style="min-height:130px;font-family:var(--font-hand);font-size:18px" placeholder="my love…" maxlength="4000"></textarea></div>
        <div class="field"><label>Earliest open date (optional)</label><input id="lt-date" type="date"></div>
        <div class="settings-actions" style="justify-content:flex-end">
          <button class="btn-ghost" id="lt-cancel">cancel</button>
          <button class="btn" id="lt-seal">seal it 🕯️</button>
        </div>
      </div>
    </div>`);

  const close = () => clear(root);
  root.querySelector('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim') close(); });
  root.querySelector('#lt-cancel').addEventListener('click', close);
  root.querySelector('#lt-seal').addEventListener('click', () => {
    const title = root.querySelector('#lt-title').value.trim() || 'Open when you miss me';
    const body = root.querySelector('#lt-body').value.trim();
    if (!body) { toast('The letter is empty ✍️'); return; }
    const letters = store.get('letters', []);
    letters.push({ id: uid(), author: me, title, body, openAt: root.querySelector('#lt-date').value || null, openedAt: null, createdAt: Date.now() });
    store.set('letters', letters);
    close();
    toast('Letter sealed with a wax kiss 💋');
    renderNotes();
  });
}
