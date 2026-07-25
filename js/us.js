// Same Sky — us: stats, milestone timeline, bucket list, daily question.

import { store, photoStore, recordDeletion } from './store.js';
import { getProfile } from './settings.js';
import { toast, uid, fmtDate, todayISO, localISO, daysBetween } from './app.js';
import { html, render } from './dom.js';
import { distanceKm } from './map.js';

const QUESTIONS = [
  "What's a tiny thing I do that you secretly love?",
  'Where should we travel together next, and why there?',
  'What song feels like us right now?',
  'What was your first thought the morning after we met?',
  "What's your favorite photo of us, and what do you remember about that moment?",
  'If we lived in the same city tomorrow, what would our first ordinary Tuesday look like?',
  "What's something you've never told me you're proud of?",
  'Which meal do you most want to cook together?',
  "What's the best gift I've ever given you — not the fanciest, the best?",
  'When did you last miss me at a really inconvenient moment?',
  'What smell reminds you of me?',
  "What's a fear you've been carrying lately?",
  'If we had a whole weekend with no plans and no phones, what would we do?',
  "What's one habit of mine you find weirdly adorable?",
  'What do you want us to be doing five years from today?',
  "What's the funniest thing that happened to you this week?",
  'Which fictional couple are we most like?',
  "What's something small I could do that would make your day tomorrow?",
  'What did you almost text me today but didn’t?',
  "What's your favorite way I say goodnight?",
  'If you could teleport to me for one hour today, which hour would you pick?',
  "What's a dream you had (sleeping or awake) that I was in?",
  'What are you most looking forward to about our next visit?',
  "What's one thing you want to learn together?",
  'Which of my clothes would you steal forever?',
  'What does home feel like to you?',
  "What's a question you wish I asked you more often?",
  'What tiny tradition should we start, just the two of us?',
  "What's the hardest part of the distance this week?",
  'What made you smile today before this question did?',
  'If our love story were a movie, what would this chapter be called?',
  "What's your favorite memory of us that cost zero money?",
  'What are you most proud of us for?',
  'Which city should we grow old in?',
  "What's one thing about me you hope never changes?",
  'What would you whisper to me right now if I were next to you?',
  'What snack should we absolutely not share (because you want it all)?',
  "What's a song lyric that made you think of me recently?",
  'When do you feel closest to me, even from far away?',
  'What are we celebrating first when the distance is over for good?',
];

/** A random prompt, only ever offered as inspiration — never posted on its own. */
export function inspirationQuestion(exclude = '') {
  const pool = QUESTIONS.filter(q => q !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Questions the other person asked that this partner hasn't answered yet. */
export function unansweredFor(slot) {
  return store.get('questions', []).filter(q => q.from !== slot && !q.answers?.[slot]);
}

function autoMilestones(startDate) {
  if (!startDate) return [];
  const start = new Date(startDate + 'T00:00:00');
  const out = [];
  for (const d of [100, 200, 365, 500, 730, 1000]) {
    const dt = new Date(start); dt.setDate(start.getDate() + d);
    out.push({ label: d === 365 ? '1 year' : d === 730 ? '2 years' : `${d} days`, date: localISO(dt), auto: true });
  }
  for (let y = 3; y <= 5; y++) {
    const dt = new Date(start); dt.setFullYear(start.getFullYear() + y);
    out.push({ label: `${y} years`, date: localISO(dt), auto: true });
  }
  return out;
}

export function renderUs() {
  const p = getProfile();
  const me = p.activePartner || 'a';
  const notes = store.get('notes', []);
  const bucket = store.get('bucket', []);
  const custom = store.get('milestonesCustom', []);
  const questions = store.get('questions', []);
  const today = todayISO();
  const you = me === 'a' ? 'b' : 'a';
  const el = document.getElementById('view-us');

  const days = p.startDate ? Math.max(0, daysBetween(p.startDate, today)) : 0;
  const dist = distanceKm(p.a, p.b);
  const km = dist === null ? null : Math.round(dist);

  const miles = [...autoMilestones(p.startDate), ...custom.map(m => ({ ...m, auto: false }))]
    .sort((x, y) => x.date.localeCompare(y.date));
  const nextIdx = miles.findIndex(m => m.date > today);

  render(el, html`
    <div class="stats-grid">
      <div class="stat-tile"><div class="stat-num">${days.toLocaleString('en')}</div><div class="stat-label">days together</div></div>
      <div class="stat-tile"><div class="stat-num">${km === null ? '—' : km.toLocaleString('en')}</div><div class="stat-label">km apart</div></div>
      <div class="stat-tile"><div class="stat-num" id="stat-photos">…</div><div class="stat-label">memories</div></div>
      <div class="stat-tile"><div class="stat-num">${notes.length}</div><div class="stat-label">notes</div></div>
    </div>

    <div class="card" style="margin-top:24px">
      <h2 class="card-title">Questions <span class="hint">ask them anything, any time</span></h2>
      <div class="composer">
        <textarea id="q-text" placeholder="what do you want to ask ${p[you].name}?" maxlength="300"></textarea>
        <div class="composer-row">
          <button class="btn-ghost btn-small" id="q-inspire">🎲 inspire me</button>
          <button class="btn" id="q-ask" style="margin-left:auto">ask ${p[you].name} 💭</button>
        </div>
      </div>

      ${questions.length ? html`
        <div class="q-list">
          ${[...questions].sort((x, y) => y.createdAt - x.createdAt).map(q => html`
            <div class="q-item ${q.from !== me && !q.answers?.[me] ? 'needs-you' : ''}">
              <div class="q-head">
                <span class="q-who">${p[q.from]?.emoji || '💭'} ${p[q.from]?.name || '?'} asked</span>
                <span class="q-when">${fmtDate(localISO(new Date(q.createdAt)))}</span>
                ${q.from === me ? html`<button class="sticky-btn" data-delq="${q.id}" title="delete">🗑</button>` : ''}
              </div>
              <div class="qa-question q-text">“${q.text}”</div>
              <div class="qa-bubbles">
                ${['a', 'b'].map(slot => html`
                  <div class="qa-bubble ${slot}">
                    <div class="qa-who">${p[slot].emoji} ${p[slot].name}</div>
                    ${q.answers?.[slot]
                      ? html`<div class="qa-text">${q.answers[slot].text}</div>`
                      : slot === me
                        ? html`<textarea data-ans="${q.id}" placeholder="your answer…" maxlength="600"></textarea>
                               <button class="btn btn-small" data-saveans="${q.id}" style="margin-top:8px">save answer</button>`
                        : html`<div class="qa-empty">${slot === q.from ? 'they asked — over to you 💭' : 'no answer yet — the suspense! 🫣'}</div>`}
                  </div>`)}
              </div>
            </div>`)}
        </div>` : html`
        <div class="empty"><span class="empty-emoji">💭</span>no questions yet — ask ${p[you].name} the first one</div>`}
    </div>

    <div class="card">
      <h2 class="card-title">Milestones <span class="hint">every little forever</span></h2>
      <div class="milestones">
        ${miles.map((m, i) => html`
          <div class="milestone ${m.date <= today ? 'past' : ''} ${i === nextIdx ? 'next-up' : ''}">
            <span class="m-label">${m.label}</span>
            <span class="m-date">${m.date <= today ? html`✓ ${fmtDate(m.date)}` : html`${fmtDate(m.date)} · in ${daysBetween(today, m.date)} days`}</span>
            ${i === nextIdx ? html`<span class="m-badge">⭐ next up</span>` : ''}
            ${!m.auto ? html`<button class="sticky-btn" data-delmile="${m.id}" title="remove">🗑</button>` : ''}
          </div>`)}
      </div>
      <div class="bucket-add">
        <input id="mile-label" placeholder="our own milestone (first concert, adopted a plant…)" style="flex:2;min-width:120px">
        <input id="mile-date" type="date">
        <button class="btn-ghost btn-small" id="mile-add">add ⭐</button>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">Bucket list <span class="hint">for when we're together</span></h2>
      ${bucket.length ? html`
        <ul class="bucket-list">
          ${[...bucket].sort((x, y) => (x.done - y.done) || (y.createdAt - x.createdAt)).map(b => html`
            <li class="bucket-item ${b.done ? 'done' : ''}">
              <input type="checkbox" class="bucket-check" data-check="${b.id}" ${b.done ? 'checked' : ''}>
              <span class="bucket-text">${b.text}</span>
              <button class="sticky-btn" data-delbucket="${b.id}" title="remove">🗑</button>
            </li>`)}
        </ul>` : html`<div class="empty"><span class="empty-emoji">🎡</span>nothing yet — what's the first thing we'll do?</div>`}
      <div class="bucket-add">
        <input id="bucket-text" placeholder="watch the sunrise from your rooftop…" maxlength="140">
        <button class="btn" id="bucket-add-btn">add 💫</button>
      </div>
    </div>
  `);

  photoStore.count().then(n => {
    const t = el.querySelector('#stat-photos');
    if (t) t.textContent = n.toLocaleString('en');
  });

  el.querySelector('#q-inspire').addEventListener('click', () => {
    const box = el.querySelector('#q-text');
    box.value = inspirationQuestion(box.value.trim());
    box.focus();
  });

  el.querySelector('#q-ask').addEventListener('click', () => {
    const box = el.querySelector('#q-text');
    const text = box.value.trim();
    if (!text) { toast('Type a question first 💭'); return; }
    const fresh = store.get('questions', []);
    fresh.push({ id: uid(), from: me, text, createdAt: Date.now(), answers: {} });
    store.set('questions', fresh);
    toast(`Asked ${p[you].name} 💭`);
    renderUs();
  });

  el.querySelectorAll('[data-saveans]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.saveans;
    const v = el.querySelector(`[data-ans="${id}"]`).value.trim();
    if (!v) { toast('Write your answer first 💭'); return; }
    const fresh = store.get('questions', []);
    const q = fresh.find(x => x.id === id);
    if (q) {
      q.answers = { ...(q.answers || {}), [me]: { text: v, at: Date.now() } };
      store.set('questions', fresh);
      toast('Answer saved 💬💕');
    }
    renderUs();
  }));

  el.querySelectorAll('[data-delq]').forEach(btn => btn.addEventListener('click', () => {
    if (!confirm('Delete this question and its answers?')) return;
    recordDeletion(btn.dataset.delq);
    store.set('questions', store.get('questions', []).filter(q => q.id !== btn.dataset.delq));
    renderUs();
  }));

  // As in notes.js: re-read before every write so a second open window can't be
  // clobbered by this view's older in-memory copy.
  el.querySelector('#mile-add').addEventListener('click', () => {
    const label = el.querySelector('#mile-label').value.trim();
    const date = el.querySelector('#mile-date').value;
    if (!label || !date) { toast('Milestone needs a name and a date ⭐'); return; }
    const fresh = store.get('milestonesCustom', []);
    fresh.push({ id: uid(), label, date });
    store.set('milestonesCustom', fresh);
    toast('Milestone added ⭐');
    renderUs();
  });
  el.querySelectorAll('[data-delmile]').forEach(b => b.addEventListener('click', () => {
    recordDeletion(b.dataset.delmile);
    store.set('milestonesCustom', store.get('milestonesCustom', []).filter(m => m.id !== b.dataset.delmile));
    renderUs();
  }));

  el.querySelector('#bucket-add-btn').addEventListener('click', () => {
    const text = el.querySelector('#bucket-text').value.trim();
    if (!text) { toast('Dream a little first 💭'); return; }
    const fresh = store.get('bucket', []);
    fresh.push({ id: uid(), text, done: false, createdAt: Date.now() });
    store.set('bucket', fresh);
    renderUs();
  });
  el.querySelectorAll('[data-check]').forEach(c => c.addEventListener('change', () => {
    const fresh = store.get('bucket', []);
    const b = fresh.find(x => x.id === c.dataset.check);
    if (b) { b.done = c.checked; store.set('bucket', fresh); }
    if (c.checked) toast('One dream down 🎉');
    renderUs();
  }));
  el.querySelectorAll('[data-delbucket]').forEach(b => b.addEventListener('click', () => {
    recordDeletion(b.dataset.delbucket);
    store.set('bucket', store.get('bucket', []).filter(x => x.id !== b.dataset.delbucket));
    renderUs();
  }));
}
