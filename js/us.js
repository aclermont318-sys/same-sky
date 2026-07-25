// Same Sky — us: stats, milestone timeline, bucket list, daily question.

import { store, photoStore } from './store.js';
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

export function questionOfToday() {
  return QUESTIONS[Math.floor(Date.now() / 864e5) % QUESTIONS.length];
}

function autoMilestones(startDate) {
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
  const answers = store.get('answers', {});
  const today = todayISO();
  const todaysA = answers[today] || {};
  const el = document.getElementById('view-us');

  const days = Math.max(0, daysBetween(p.startDate, today));
  const km = Math.round(distanceKm(p.a, p.b));

  const miles = [...autoMilestones(p.startDate), ...custom.map(m => ({ ...m, auto: false }))]
    .sort((x, y) => x.date.localeCompare(y.date));
  const nextIdx = miles.findIndex(m => m.date > today);

  render(el, html`
    <div class="stats-grid">
      <div class="stat-tile"><div class="stat-num">${days.toLocaleString('en')}</div><div class="stat-label">days together</div></div>
      <div class="stat-tile"><div class="stat-num">${km.toLocaleString('en')}</div><div class="stat-label">km apart</div></div>
      <div class="stat-tile"><div class="stat-num" id="stat-photos">…</div><div class="stat-label">memories</div></div>
      <div class="stat-tile"><div class="stat-num">${notes.length}</div><div class="stat-label">notes</div></div>
    </div>

    <div class="card" style="margin-top:24px">
      <h2 class="card-title">Daily question <span class="hint">same question, both hearts</span></h2>
      <div class="qa-question">“${questionOfToday()}”</div>
      <div class="qa-bubbles">
        ${['a', 'b'].map(slot => html`
          <div class="qa-bubble ${slot}">
            <div class="qa-who">${p[slot].emoji} ${p[slot].name}</div>
            ${todaysA[slot]
              ? html`<div class="qa-text">${todaysA[slot]}</div>`
              : slot === me
                ? html`<textarea id="qa-input" placeholder="your answer…" maxlength="600"></textarea>
                       <button class="btn btn-small" id="qa-save" style="margin-top:8px">save answer</button>`
                : html`<div class="qa-empty">no answer yet — the suspense! 🫣</div>`}
          </div>`)}
      </div>
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

  el.querySelector('#qa-save')?.addEventListener('click', () => {
    const v = el.querySelector('#qa-input').value.trim();
    if (!v) { toast('Write your answer first 💭'); return; }
    const a = store.get('answers', {});
    a[today] = { ...(a[today] || {}), [me]: v };
    store.set('answers', a);
    toast('Answer saved 💬💕');
    renderUs();
  });

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
    store.set('bucket', store.get('bucket', []).filter(x => x.id !== b.dataset.delbucket));
    renderUs();
  }));
}
