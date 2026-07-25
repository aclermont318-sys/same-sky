# Same Sky Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Same Sky local-first LDR couple web app per the 2026-07-25 design spec: photos, notes, live-location map, together-counter, dual clocks, countdown, weather, milestones, bucket list, daily question, moods/hugs.

**Architecture:** Vanilla-JS SPA, no build step. `index.html` holds all view containers; `js/app.js` routes between them by toggling visibility and calling each view module's `render()`. All persistence goes through `js/store.js` (localStorage JSON + IndexedDB blobs). Views re-render themselves after their own writes.

**Tech Stack:** HTML/CSS/JS (ES modules), Leaflet 1.9.4 CDN + OpenStreetMap tiles, Open-Meteo API (no key), Google Fonts, Python http.server for dev.

## Global Constraints

- App name default: **Same Sky** (user-editable via Settings `title`).
- Two partners exactly, slots `a` and `b`; every authored artifact records its author slot.
- No frameworks, no bundler, no npm dependencies; CDN allowed for Leaflet + fonts only.
- All storage behind `store.js`; views MUST NOT touch `localStorage`/`indexedDB` directly.
- Time zones via `Intl` APIs with IANA names only — never manual UTC offsets.
- Network failures (weather, tiles) must degrade to placeholders, never block render.
- Mobile-first: bottom tab bar ≤700px, top nav above; all views usable at 375px wide.
- Testing = manual browser verification per task (spec §Testing: no automated suite in v1).
- Visual system governed by frontend-design skill at Task 1; cute-but-organized per spec.
- Commit after every task with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Shell, theme, router, dev server

**Files:**
- Create: `index.html`, `css/theme.css`, `css/app.css`, `js/app.js`, `.claude/launch.json`, `.gitignore`
- Test: manual (browser)

**Interfaces:**
- Produces: `index.html` sections `<section id="view-home|map|memories|notes|us|settings" class="view">`; nav buttons `[data-nav="home|map|memories|notes|us|settings"]`; `app.js` exports `showView(name)`, `toast(msg)`, `fmtDate(iso)` (→ "20 Nov 2025"), `uid()` (→ random 8-char id), `daysBetween(isoA, isoB)`; global CSS tokens `--bg --card --ink --muted --accent --accent-soft --radius --shadow`; `.card`, `.btn`, `.btn-ghost`, `.chip`, `.toast` component classes.
- Consumes: nothing.

- [ ] **Step 1: Invoke frontend-design skill; fix palette/fonts as CSS tokens in `theme.css`** (romantic display serif + clean body font from Google Fonts; blush/cream/rose light theme).
- [ ] **Step 2: Write `index.html`** — header (app title + settings gear), six `.view` sections with placeholder `<h2>`s, nav (`.tabbar`), module script tag `js/app.js`.
- [ ] **Step 3: Write `js/app.js`** — `showView` toggles `.view.active` + `[data-nav].active`, wires nav clicks, exports helpers above; boot → `showView('home')`.
- [ ] **Step 4: Write `.claude/launch.json`**:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "same-sky", "runtimeExecutable": "python", "runtimeArgs": ["-m", "http.server", "4173", "--directory", "C:/Users/andre/Projects/same-sky"], "port": 4173 }
  ]
}
```

- [ ] **Step 5: Verify** — preview_start `same-sky`; all six tabs switch views; zero console errors; 375px viewport shows bottom tabbar.
- [ ] **Step 6: Commit** `feat: app shell, theme tokens, router, dev server`.

### Task 2: store.js — persistence seam

**Files:**
- Create: `js/store.js`
- Test: manual (console smoke in preview)

**Interfaces:**
- Produces (exact):

```js
export const store = {
  get(key, fallback),          // JSON from localStorage 'samesky:'+key
  set(key, value),             // JSON to localStorage
  exportAll(),                 // -> Promise<{app:'same-sky',version:1,data:{...},photos:[{id,caption,date,fav,b64,type}]}>
  importAll(obj),              // -> Promise<void>; throws Error('invalid backup') unless obj.app==='same-sky' && obj.version===1
};
export const photoStore = {
  add({blob, caption, date}),  // -> Promise<id>
  all(),                       // -> Promise<[{id, caption, date, fav, blob}]> newest-first
  update(id, patch),           // -> Promise<void>  (caption/fav/date only)
  remove(id),                  // -> Promise<void>
  count(),                     // -> Promise<number>
};
export function defaultProfile(); // seeds on first run via store.get('profile', defaultProfile())
```

- `defaultProfile()` returns `{a:{name:'Me',emoji:'🐻',city:'Zürich',tz:'Europe/Zurich',lat:47.3769,lng:8.5417,lastLocAt:null}, b:{name:'You',emoji:'🐰',city:'New York',tz:'America/New_York',lat:40.7128,lng:-74.006,lastLocAt:null}, startDate:'2025-11-20', nextVisit:null, title:'Same Sky', activePartner:null}`
- IndexedDB: db `samesky`, v1, object store `photos` keyPath `id`; graceful `photosAvailable` boolean when IDB throws (private mode).
- Consumes: `uid()` from `js/app.js`.

- [ ] **Step 1: Implement, including base64⇄blob conversion for export/import** (FileReader/ fetch data-URL).
- [ ] **Step 2: Verify in preview console** — `store.set/get` round-trip; `photoStore.add` a canvas-generated blob, `all()` returns it, `remove` clears; `exportAll()` then `importAll()` round-trips.
- [ ] **Step 3: Commit** `feat: storage layer (localStorage + IndexedDB photos, export/import)`.

### Task 3: Settings + first-run partner picker

**Files:**
- Create: `js/settings.js`; Modify: `index.html`, `js/app.js` (import + render hook, first-run overlay)
- Test: manual

**Interfaces:**
- Consumes: `store`, `defaultProfile`, `toast`, `fmtDate`.
- Produces: `renderSettings()`; profile edits write `store.set('profile', p)`; app.js calls each view's render on nav; first-run overlay (when `activePartner===null`) asks "Who's using this device?" with the two partner buttons → sets `activePartner`.

- [ ] **Step 1: Build form** — per-partner name/emoji/city/tz (IANA `<select>` from curated ~40-zone list + current value), start date `<input type=date>`, next visit date, app title, active-partner switcher, Export backup (download `same-sky-backup.json`) / Import (file input → `importAll` → reload).
- [ ] **Step 2: Verify** — first-run overlay appears once; edits persist across reload; export downloads; import of exported file restores after a manual localStorage clear; bad file → toast, data intact.
- [ ] **Step 3: Commit** `feat: settings, first-run partner picker, backup export/import`.

### Task 4: Home dashboard

**Files:**
- Create: `js/home.js`; Modify: `index.html`, `js/app.js`
- Test: manual

**Interfaces:**
- Consumes: `store`, `toast`; profile shape from Task 2.
- Produces: `renderHome()`; 1s interval (cleared/re-armed on re-render) drives counter + clocks; `weatherFor(lat,lng)` fetch helper (module-local, 30-min memo); moods write `store.set('moods',…)`; hugs append `store.set('hugs',…)`.

Core algorithms (exact):

```js
// together counter
const ms = Date.now() - new Date(p.startDate + 'T00:00:00').getTime();
const d = Math.floor(ms/864e5), h = Math.floor(ms/36e5)%24, m = Math.floor(ms/6e4)%60, s = Math.floor(ms/1e3)%60;
// per-partner clock + day/night
const parts = new Intl.DateTimeFormat('en-GB', {timeZone: tz, hour:'2-digit', minute:'2-digit', hour12:false}).format(now);
const hr = +new Intl.DateTimeFormat('en-GB', {timeZone: tz, hour:'numeric', hour12:false}).format(now);
const icon = hr >= 6 && hr < 18 ? '☀️' : '🌙';
// weather (no key): https://api.open-meteo.com/v1/forecast?latitude=L&longitude=G&current=temperature_2m,weather_code
// WMO code map: 0-1 ☀️ Clear, 2 ⛅ Partly cloudy, 3 ☁️ Cloudy, 45/48 🌫️ Foggy, 51-67 🌧️ Rainy, 71-77 ❄️ Snowy, 80-82 🌦️ Showers, 95-99 ⛈️ Stormy; fetch fail -> '—'
// next-visit countdown: daysBetween(todayISO, p.nextVisit); null -> CTA linking to settings
```

- [ ] **Step 1: Build sections** — greeting ("Good morning/afternoon/evening, {activeName} 💕" by local hour), hero counter card (D/H/M/S tiles), two clock cards (emoji avatar, city, time, day/night), weather chips, countdown card, mood row (6 emoji buttons per active partner + partner's last mood with relative time), hug button → full-screen floating-hearts animation (CSS keyframes, 1.5s) + logs hug, "Today's question" teaser linking to Us tab.
- [ ] **Step 2: Verify** — counter ticks every second; clocks differ per configured tz; weather chips populate (or '—' offline); mood saves + survives reload; hug animates; countdown correct for a test date; no console errors.
- [ ] **Step 3: Commit** `feat: home dashboard (counter, clocks, weather, countdown, moods, hugs)`.

### Task 5: Map view

**Files:**
- Create: `js/map.js`; Modify: `index.html` (Leaflet CSS/JS CDN tags), `js/app.js`
- Test: manual

**Interfaces:**
- Consumes: `store`, `toast`; Leaflet global `L`.
- Produces: `renderMap()` (idempotent: creates map once, then `invalidateSize()` + repositions layers); "📍 Update my location" writes `{lat,lng,lastLocAt}` to active partner slot.

Core (exact):

```js
// haversine km
const R = 6371, toRad = x => x*Math.PI/180;
const dKm = 2*R*Math.asin(Math.sqrt(Math.sin(toRad(lat2-lat1)/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(toRad(lng2-lng1)/2)**2));
// pins: L.divIcon({className:'pin', html:`<span class="pin-heart">${partner.emoji}</span>`, iconSize:[44,44], iconAnchor:[22,40]})
// connection: L.polyline([[a.lat,a.lng],[b.lat,b.lng]], {dashArray:'6 10', weight:2, color:'var resolved accent'}) + fitBounds with padding
// geolocation: navigator.geolocation.getCurrentPosition(ok, err, {enableHighAccuracy:true, timeout:10000}); err -> toast('Location unavailable — using your city instead') and keep city coords
```

- [ ] **Step 1: Build** — full-height map card, distance banner ("{d} km apart · hearts connected"), last-updated captions per pin ("live" vs "home city"), update-my-location button.
- [ ] **Step 2: Verify** — two pins + dashed line + sensible fitBounds; distance plausible (Zürich–NYC ≈ 6,300 km); geolocation grant moves my pin (browser prompt) and deny path toasts; tab away/back → map still sized right.
- [ ] **Step 3: Commit** `feat: map with heart pins, distance, live geolocation`.

### Task 6: Memories (photos)

**Files:**
- Create: `js/memories.js`; Modify: `index.html`, `js/app.js`
- Test: manual

**Interfaces:**
- Consumes: `photoStore`, `toast`, `fmtDate`, `uid`.
- Produces: `renderMemories()`; object URLs created per render and revoked on re-render.

- [ ] **Step 1: Build** — upload card (file input `accept="image/*"` multiple + drag-drop zone + optional caption applied to batch, date defaults today), masonry-ish CSS grid, tile hover/tap → lightbox modal (photo, caption editable inline, date, ♥ fav toggle, delete with confirm), fav filter toggle, empty state ("No memories yet — add your first 📸"), `photosAvailable===false` → friendly notice card.
- [ ] **Step 2: Verify** — upload 2+ images incl. drag-drop; captions save; fav filter works; delete works; reload persists (IndexedDB); lightbox keyboard-escape closes; no console errors.
- [ ] **Step 3: Commit** `feat: photo memories gallery (IndexedDB, lightbox, favorites)`.

### Task 7: Notes wall + sealed letters

**Files:**
- Create: `js/notes.js`; Modify: `index.html`, `js/app.js`
- Test: manual

**Interfaces:**
- Consumes: `store`, `uid`, `toast`, `fmtDate`.
- Produces: `renderNotes()`; data per spec: `notes` `[{id,author,text,color,pinned,createdAt}]`, `letters` `[{id,author,title,body,openAt,openedAt}]`.

- [ ] **Step 1: Build notes wall** — composer (textarea, 4 pastel color swatches, post as active partner), sticky-note cards (slight per-note rotation via `style="--rot:-2deg"` etc. seeded from id hash, author chip with emoji, pin toggle sorts pinned first, delete), newest-first.
- [ ] **Step 2: Build sealed letters** — compose ("Open when…" title, body, optional open date); sealed card shows 💌 + title + blur overlay; if `openAt` future → locked with "opens {date}"; open action sets `openedAt`, reveals body with a gentle unfold animation; opened letters stay readable.
- [ ] **Step 3: Verify** — note post/pin/delete persists; author colors/chips correct for both partners (switch active partner in settings); sealed letter blurred until opened; future-dated letter refuses to open early (toast); reload persists all.
- [ ] **Step 4: Commit** `feat: sticky-note wall and sealed 'open when' letters`.

### Task 8: Us view (stats, milestones, bucket list, daily question)

**Files:**
- Create: `js/us.js`; Modify: `index.html`, `js/app.js`
- Test: manual

**Interfaces:**
- Consumes: `store`, `photoStore.count()`, `uid`, `fmtDate`, `daysBetween`; haversine duplicated locally is FORBIDDEN — export `distanceKm(a,b)` from `js/map.js` and import it here.
- Produces: `renderUs()`; `bucket` `[{id,text,done,createdAt}]`; `answers` `{'YYYY-MM-DD':{a,b}}`; `milestonesCustom` `[{id,label,date}]`.

Core (exact):

```js
// milestones auto: from startDate -> +100,+200,+365,+500,+730,+1000 days ('100 days'…'1000 days')
// plus yearly anniversaries years 1..5 ('1 year'…'5 years'); merge custom; sort by date; past -> '✓ {fmtDate}', future -> 'in {n} days'
// daily question: const QUESTIONS = [/* 40 written-out questions */];
const idx = Math.floor(Date.now()/864e5) % QUESTIONS.length; // same for both partners on a given day
// answers editable only for active partner; both shown side by side once present
```

- [ ] **Step 1: Build** — stat tiles (days together, km apart, memories, notes), milestone timeline with next-up highlighted, bucket list (add/check/delete, done items struck + sunk), daily question card (question, two answer bubbles labeled by partner emoji/name, input for active partner).
- [ ] **Step 2: Write the 40 QUESTIONS inline** (fun/deep mix: "What's a tiny thing I do that you love?", "Where should we travel together next?", "What song feels like us right now?", … all 40 written in code, no placeholders).
- [ ] **Step 3: Verify** — stats live-correct (add a note → count bumps); milestone math vs hand-checked dates; bucket persists; answer as A, switch to B in settings, answer as B → both bubbles show; question changes with system date (spot-check by temporarily overriding idx in console).
- [ ] **Step 4: Commit** `feat: us view (stats, milestones, bucket list, daily question)`.

### Task 9: PWA manifest, icons, README, polish

**Files:**
- Create: `manifest.webmanifest`, `icons/icon.svg` (heart over gradient, also referenced as apple-touch via PNG fallback `icons/icon-192.png`, `icons/icon-512.png` generated via canvas script `tools/make-icons.py` OR hand-exported once), `README.md`; Modify: `index.html` (manifest link, theme-color, apple meta), `css/app.css` (final responsive/empty-state/scrollbar polish)
- Test: manual

- [ ] **Step 1: Manifest** — name from default title, `display:'standalone'`, `theme_color`/`background_color` from tokens, icons 192+512.
- [ ] **Step 2: README** — what it is, how to run (`python -m http.server 4173`), how to install to phone home screen, how the backup "love letter" file syncs a second phone, how Supabase could slot into `store.js` later.
- [ ] **Step 3: Polish pass** — every view at 375px and 1280px; empty states everywhere; focus-visible rings; `prefers-reduced-motion` disables hug/letter animations.
- [ ] **Step 4: Verify + Commit** `feat: PWA manifest, icons, readme, responsive polish`.

### Task 10: Full verification matrix + proof

- [ ] **Step 1: Fresh-profile run-through** — clear storage, complete first-run, exercise EVERY feature end-to-end per spec §Testing list; console must stay clean.
- [ ] **Step 2: Screenshots** — Home, Map, Memories, Notes (one sealed + one open letter), Us; desktop + one mobile shot.
- [ ] **Step 3: Final commit + Discord status with screenshots summary.**

## Self-Review (done)

1. **Spec coverage:** photos→T6, notes+letters→T7, map/live location→T5, together counter+clocks+weather+moods+hugs+countdown→T4, milestones/bucket/question/stats→T8, settings/export/import/first-run→T3, PWA/README→T9, storage seam→T2, error handling folded into each task's verify steps. No gaps.
2. **Placeholder scan:** questions list marked "written inline at implementation" with count + examples (Task 8 Step 2 requires all 40 in code); icon generation offers two concrete routes; no TBDs remain.
3. **Type consistency:** `distanceKm` exported from map.js and imported by us.js (fixed duplicate-haversine risk); store API names match across tasks; profile shape defined once in Task 2 and referenced elsewhere.
