// Same Sky — home dashboard: counter, clocks, weather, countdown, moods, hugs.

import { store } from './store.js';
import { getProfile } from './settings.js';
import { showView, toast, fmtDate, todayISO, daysBetween, relTime } from './app.js';
import { html, render } from './dom.js';
import { questionOfToday } from './us.js';

let timer = null;

const WMO = [
  [[0, 1], ['☀️', 'Clear']], [[2, 2], ['⛅', 'Partly cloudy']], [[3, 3], ['☁️', 'Cloudy']],
  [[45, 48], ['🌫️', 'Foggy']], [[51, 67], ['🌧️', 'Rainy']], [[71, 77], ['❄️', 'Snowy']],
  [[80, 82], ['🌦️', 'Showers']], [[85, 86], ['🌨️', 'Snow showers']], [[95, 99], ['⛈️', 'Stormy']],
];
function wmoIcon(code) {
  for (const [[lo, hi], out] of WMO) if (code >= lo && code <= hi) return out;
  return ['🌡️', ''];
}

const weatherCache = new Map(); // key -> {at, temp, code}
async function weatherFor(lat, lng) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = weatherCache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60e3) return hit;
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`);
  const json = await res.json();
  const out = { at: Date.now(), temp: Math.round(json.current.temperature_2m), code: json.current.weather_code };
  weatherCache.set(key, out);
  return out;
}

const MOODS = ['🥰', '😊', '🥺', '😴', '😤', '🤒'];

function clockBits(tz) {
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const hr = +new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hour12: false }).format(now);
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long' }).format(now);
  return { time, icon: hr >= 6 && hr < 18 ? '☀️' : '🌙', weekday: wd };
}

function greetingFor(name) {
  const h = new Date().getHours();
  const word = h < 5 ? 'Sweet dreams' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${word}, ${name} 💕`;
}

export function renderHome() {
  const p = getProfile();
  const me = p.activePartner || 'a';
  const you = me === 'a' ? 'b' : 'a';
  const moods = store.get('moods', {});
  const hugs = store.get('hugs', []);
  const lastHugFromYou = [...hugs].reverse().find(h => h.from === you);
  const el = document.getElementById('view-home');

  const visitDays = p.nextVisit ? daysBetween(todayISO(), p.nextVisit) : null;

  render(el, html`
    <div class="greeting">${greetingFor(p[me].name)}</div>

    <div class="card airmail-top hero-counter">
      <div class="hero-label">together for</div>
      <div class="counter-row" id="counter-row"></div>
      <div class="hero-since">since ${fmtDate(p.startDate)} 💞</div>
    </div>

    <div class="duo-grid">
      ${[me, you].map(slot => html`
        <div class="card clock-card">
          <span class="stamp-frame"><span class="stamp">${p[slot].emoji}</span></span>
          <div class="clock-info">
            <div class="clock-city">${p[slot].name} · ${p[slot].city} <span data-dn="${slot}"></span></div>
            <div class="clock-time" data-clock="${slot}">--:--</div>
            <div class="clock-meta"><span data-wd="${slot}"></span> · <span data-weather="${slot}">…</span></div>
          </div>
        </div>`)}
    </div>

    ${visitDays !== null && visitDays >= 0 ? html`
      <div class="card countdown-card">
        <div class="countdown-num">${visitDays === 0 ? '💛 today!' : visitDays}</div>
        <div class="countdown-label">${visitDays === 0 ? 'the wait is over — go hug for real' : `day${visitDays === 1 ? '' : 's'} until we're together again ✈️`}</div>
        <div class="loc-caption">${fmtDate(p.nextVisit)}</div>
      </div>` : html`
      <div class="card countdown-card">
        <div class="countdown-label">when do we see each other next? 🥺</div>
        <button class="btn-ghost" id="btn-set-visit" style="margin-top:8px">set the date ✈️</button>
      </div>`}

    <div class="duo-grid">
      <div class="card">
        <h2 class="card-title">My mood <span class="hint">how are you feeling?</span></h2>
        <div class="mood-row">
          ${MOODS.map(m => html`<button class="mood-btn ${moods[me]?.emoji === m ? 'selected' : ''}" data-mood="${m}">${m}</button>`)}
          <div class="mood-partner">
            ${moods[you] ? html`<span class="big">${moods[you].emoji}</span>${p[you].name} · ${relTime(moods[you].at)}` : html`${p[you].name} hasn't checked in yet`}
          </div>
        </div>
      </div>
      <div class="card hug-card">
        <h2 class="card-title">Missing them? <span class="hint">send love across the sky</span></h2>
        <button class="hug-btn" id="btn-hug">🤗 send a hug</button>
        <div class="hug-log">${lastHugFromYou ? `last hug from ${p[you].name} · ${relTime(lastHugFromYou.at)}` : 'no hugs yet — be the first 💌'}</div>
      </div>
    </div>

    <div class="card qteaser">
      <div>
        <div class="loc-caption" style="text-align:left">today's question</div>
        <div class="qteaser-q">“${questionOfToday()}”</div>
      </div>
      <button class="btn" id="btn-answer">answer it →</button>
    </div>
  `);

  // ——— live ticking counter + clocks (textContent updates only; no DOM churn) ———
  const row = el.querySelector('#counter-row');
  render(row, html`
    ${[['d', 'days'], ['h', 'hours'], ['m', 'min'], ['s', 'sec']].map(([k, u]) => html`
      <div class="counter-tile"><div class="counter-num" data-cnt="${k}">–</div><div class="counter-unit">${u}</div></div>`)}
  `);
  const tick = () => {
    const view = document.getElementById('view-home');
    if (!view.classList.contains('active')) { clearInterval(timer); timer = null; return; }
    const ms = Date.now() - new Date(p.startDate + 'T00:00:00').getTime();
    const abs = Math.abs(ms);
    const vals = {
      d: Math.floor(abs / 864e5),
      h: Math.floor(abs / 36e5) % 24,
      m: Math.floor(abs / 6e4) % 60,
      s: Math.floor(abs / 1e3) % 60,
    };
    for (const [k, v] of Object.entries(vals)) {
      const t = view.querySelector(`[data-cnt="${k}"]`);
      if (t) t.textContent = v.toLocaleString('en');
    }
    for (const slot of [me, you]) {
      const bits = clockBits(p[slot].tz);
      const t = view.querySelector(`[data-clock="${slot}"]`);
      if (t) t.textContent = bits.time;
      const dn = view.querySelector(`[data-dn="${slot}"]`);
      if (dn) dn.textContent = bits.icon;
      const wd = view.querySelector(`[data-wd="${slot}"]`);
      if (wd) wd.textContent = bits.weekday;
    }
  };
  if (timer) clearInterval(timer);
  tick();
  timer = setInterval(tick, 1000);

  // ——— weather chips ———
  for (const slot of [me, you]) {
    weatherFor(p[slot].lat, p[slot].lng)
      .then(w => {
        const span = el.querySelector(`[data-weather="${slot}"]`);
        if (!span) return;
        const [icon, label] = wmoIcon(w.code);
        span.textContent = `${icon} ${w.temp}°C ${label}`;
      })
      .catch(() => {
        const span = el.querySelector(`[data-weather="${slot}"]`);
        if (span) span.textContent = '—';
      });
  }

  // ——— interactions ———
  el.querySelectorAll('[data-mood]').forEach(b => b.addEventListener('click', () => {
    const moodsNow = store.get('moods', {});
    moodsNow[me] = { emoji: b.dataset.mood, at: Date.now() };
    store.set('moods', moodsNow);
    toast(`Mood saved ${b.dataset.mood}`);
    renderHome();
  }));

  el.querySelector('#btn-hug').addEventListener('click', () => {
    const hugsNow = store.get('hugs', []);
    hugsNow.push({ from: me, at: Date.now() });
    store.set('hugs', hugsNow.slice(-50));
    heartBurst(p[me].emoji);
    toast(`Hug sent to ${p[you].name} 🤗💕`);
  });

  el.querySelector('#btn-set-visit')?.addEventListener('click', () => showView('settings'));
  el.querySelector('#btn-answer').addEventListener('click', () => showView('us'));
}

function heartBurst(emoji) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const burst = document.createElement('div');
  burst.className = 'heart-burst';
  const picks = ['💕', '💗', '💖', '💘', '💝', '❤️', emoji];
  for (let i = 0; i < 26; i++) {
    const it = document.createElement('i');
    it.textContent = picks[i % picks.length];
    it.style.left = `${Math.random() * 100}%`;
    it.style.fontSize = `${16 + Math.random() * 22}px`;
    it.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
    it.style.animationDelay = `${Math.random() * 0.5}s`;
    burst.appendChild(it);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 3800);
}
