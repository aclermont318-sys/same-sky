// Same Sky — memories: photo gallery on IndexedDB with polaroid styling.

import { photoStore, photosAvailable } from './store.js';
import { toast, fmtDate, todayISO, rotFor } from './app.js';
import { html, render, clear } from './dom.js';

let urls = [];
let favOnly = false;

function freshURL(blob) {
  const u = URL.createObjectURL(blob);
  urls.push(u);
  return u;
}

export function renderMemories() {
  const el = document.getElementById('view-memories');
  urls.forEach(u => URL.revokeObjectURL(u));
  urls = [];

  if (!photosAvailable) {
    render(el, html`
      <div class="card empty"><span class="empty-emoji">🙈</span>
        Photos need IndexedDB, which this browser mode blocks (private tab?).<br>Everything else still works!
      </div>`);
    return;
  }

  render(el, html`
    <div class="card airmail-top">
      <h2 class="card-title">Add a memory <span class="hint">little moments, kept forever</span></h2>
      <label class="dropzone" id="dropzone">
        📸 tap to choose photos — or drop them here
        <input type="file" id="inp-photos" accept="image/*" multiple>
      </label>
      <div class="composer-row" style="margin-top:12px">
        <input id="inp-caption" placeholder="caption (optional, applies to all)" style="flex:1;min-width:150px;font-family:var(--font-hand);font-size:17px">
        <input id="inp-date" type="date" value="${todayISO()}">
      </div>
    </div>
    <div class="composer-row" style="margin-bottom:16px">
      <h2 style="font-size:20px">Our gallery</h2>
      <button class="btn-ghost btn-small" id="btn-fav" style="margin-left:auto">${favOnly ? '♥ favorites only' : '♡ all photos'}</button>
    </div>
    <div class="gallery" id="gallery"></div>
  `);

  const dz = el.querySelector('#dropzone');
  const input = el.querySelector('#inp-photos');

  const addFiles = async files => {
    const imgs = [...files].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) { toast('No images in that drop'); return; }
    const caption = el.querySelector('#inp-caption').value.trim();
    const date = el.querySelector('#inp-date').value || todayISO();
    for (const f of imgs) await photoStore.add({ blob: f, caption, date });
    toast(`${imgs.length} ${imgs.length === 1 ? 'memory' : 'memories'} saved 📸💕`);
    renderMemories();
  };

  input.addEventListener('change', e => addFiles(e.target.files));
  ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => addFiles(e.dataTransfer.files));

  el.querySelector('#btn-fav').addEventListener('click', () => { favOnly = !favOnly; renderMemories(); });

  (async () => {
    const all = await photoStore.all();
    const shown = favOnly ? all.filter(p => p.fav) : all;
    const gal = el.querySelector('#gallery');
    if (!gal) return;
    if (!shown.length) {
      render(gal, html`<div class="card empty" style="column-span:all"><span class="empty-emoji">🌷</span>${favOnly ? 'no favorites yet — tap a ♥ on a photo' : 'no memories yet — add your first 📸'}</div>`);
      return;
    }
    render(gal, html`
      ${shown.map(ph => html`
        <figure class="polaroid" style="--rot:${rotFor(ph.id)}deg" data-open="${ph.id}">
          <img src="${freshURL(ph.blob)}" alt="${ph.caption || 'memory'}" loading="lazy">
          <figcaption class="polaroid-cap">
            <span>${ph.caption || fmtDate(ph.date)}</span>
            <button class="polaroid-fav" data-fav="${ph.id}" title="favorite">${ph.fav ? '💗' : '🤍'}</button>
          </figcaption>
        </figure>`)}
    `);

    gal.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', async e => {
      e.stopPropagation();
      const ph = all.find(x => x.id === b.dataset.fav);
      await photoStore.update(ph.id, { fav: !ph.fav });
      renderMemories();
    }));
    gal.querySelectorAll('[data-open]').forEach(fig => fig.addEventListener('click', () => {
      const ph = all.find(x => x.id === fig.dataset.open);
      if (ph) openLightbox(ph);
    }));
  })();
}

function openLightbox(ph) {
  const root = document.getElementById('overlay-root');
  render(root, html`
    <div class="lightbox" id="lightbox">
      <div class="lightbox-card">
        <img src="${freshURL(ph.blob)}" alt="${ph.caption || 'memory'}">
        <div class="lightbox-row">
          <input id="lb-caption" value="${ph.caption}" placeholder="write a caption…">
          <span class="chip">${fmtDate(ph.date)}</span>
        </div>
        <div class="lightbox-row" style="justify-content:space-between">
          <button class="btn-ghost btn-small" id="lb-fav">${ph.fav ? '💗 favorited' : '🤍 favorite'}</button>
          <div style="display:flex;gap:8px">
            <button class="btn-ghost btn-small" id="lb-delete">🗑 delete</button>
            <button class="btn btn-small" id="lb-close">done</button>
          </div>
        </div>
      </div>
    </div>`);

  const close = () => { clear(root); document.removeEventListener('keydown', onKey); renderMemories(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  root.querySelector('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') close(); });
  root.querySelector('#lb-close').addEventListener('click', close);
  root.querySelector('#lb-caption').addEventListener('change', async e => {
    await photoStore.update(ph.id, { caption: e.target.value.trim() });
    toast('Caption saved ✍️');
  });
  root.querySelector('#lb-fav').addEventListener('click', async () => {
    await photoStore.update(ph.id, { fav: !ph.fav });
    close();
  });
  root.querySelector('#lb-delete').addEventListener('click', async () => {
    if (!confirm('Delete this memory forever?')) return;
    await photoStore.remove(ph.id);
    toast('Memory deleted');
    close();
  });
}
