# Same Sky — Long-Distance Couple App — Design

**Date:** 2026-07-25
**Status:** Approved by declared-default (user away; defaults announced in chat + Discord, no objection)

## Purpose

A private app for two people in a long-distance relationship across time zones. It keeps
their shared life in one cute, organized place: photos, notes, where each other is right
now, how long they've been together, and when they'll meet next.

## User-named must-haves

1. Upload pictures into a shared gallery
2. Write cute notes to each other
3. See each other's live locations on a map
4. Handle the time difference (both local times visible)
5. See how long they've been together
6. Cute design, but organized

## Additional features (researched from LoveByte, Couplete, Candle, Together, Lovewick)

- Countdown to next visit
- Live weather for both cities (Open-Meteo, free, no API key)
- Auto-computed milestones (100/365/500/1000 days, anniversaries)
- Shared bucket list ("when we're together" wish list)
- Daily question both partners answer
- Mood check-in per partner + "send a hug" interaction
- "Open when..." sealed letters (sealed until a chosen condition/date)

## Approach (chosen: A)

- **A) Local-first web app (chosen):** No accounts, no server dependency, data private
  on-device. Installable as a PWA ("Add to Home Screen"). Each partner updates their own
  location from their own device; an export/import backup code keeps devices in sync until
  a real backend is added.
- B) Supabase full-stack: true realtime sync; requires account creation + deployment. Deferred — storage layer is designed so this can be added without rewriting features.
- C) Native mobile: heaviest, not previewable here. Rejected for v1.

## Architecture

**Stack:** Vanilla HTML/CSS/JS single-page app. No build step. Leaflet (CDN) +
OpenStreetMap tiles for the map. Open-Meteo for weather. Google Fonts for typography.
Served by any static server; `python -m http.server` or `npx serve` for development.

**Why no framework:** zero-dependency durability (the app should still open in 5 years),
trivial hosting, and the user can read/tweak everything. Organization comes from module
files, not a bundler.

**File layout:**

```
same-sky/
  index.html          — shell: nav, view containers, modals
  manifest.webmanifest — PWA manifest (installable)
  css/
    theme.css         — palette, typography, spacing tokens
    app.css           — layout + components
  js/
    store.js          — ALL persistence behind one API (localStorage + IndexedDB for photos)
    app.js            — boot, routing between views, shared helpers
    home.js           — dashboard view
    map.js            — map view (Leaflet, geolocation, distance)
    memories.js       — photo gallery view
    notes.js          — notes wall + sealed letters
    us.js             — stats, milestones, bucket list, daily question
    settings.js       — profile/settings view + export/import
  docs/superpowers/specs/ — this document
```

**Data flow:** Views never touch storage directly; they call `store.js` (get/set namespaced
keys, photo blobs in IndexedDB). This is the seam where Supabase sync would plug in later.
State changes re-render the owning view; there is no global reactive framework.

**Views (5 tabs + settings):**

1. **Home** — greeting by time of day; live days-together counter (ticking
   days/hours/min/sec); two time-zone clocks with day/night icons; weather chips for both
   cities; next-visit countdown; mood check-in row; hug button (full-screen heart burst
   animation, logged); today's question teaser.
2. **Map** — full-height Leaflet map; heart marker per partner; dashed great-circle line
   between; distance in km; "update my location" via browser geolocation (with graceful
   denial handling → city fallback); partner location from their last update or their
   configured city.
3. **Memories** — photo upload (file input + drag-drop), grid gallery, captions + dates,
   lightbox, favorite hearts, delete. Photos stored as blobs in IndexedDB (survives
   refresh, no size squeeze like base64-in-localStorage).
4. **Notes** — pastel sticky-note wall (author-colored), add/edit/delete, pin; sealed
   "Open when..." letters that blur content until opened, with open-date or free-form
   condition label.
5. **Us** — relationship stats (days together, current distance apart, photos saved, notes written); milestone timeline
   (auto-computed + custom); shared bucket list with checkboxes; daily question of the day
   with both partners' answers (question rotates deterministically by date from a built-in
   list).
6. **Settings** (gear, not a tab) — names, emoji avatars, relationship start date,
   next-visit date, each partner's city + time zone (IANA), theme accent, app title;
   export/import full backup as a downloadable JSON file ("love letter" file) so the
   second phone can be seeded and periodically synced.

**Active-partner model:** the app asks "who's using this device?" once (switchable in
Settings). Mood, notes authorship, "my location," and daily-question answers write to the
active partner's slot. This is what makes one codebase work for both of them.

## Design language

Cute but organized: soft blush/cream palette with rose accent, big rounded cards, one
display font (romantic serif) + one clean body font, consistent 8px spacing grid, gentle
shadows, floating hearts kept to moments (hug animation, milestones) rather than
everywhere. Mobile-first: bottom tab bar on phones, top nav on desktop. The
frontend-design skill governs final aesthetics.

## Error handling

- Geolocation denied/unavailable → toast + fall back to configured city coordinates.
- Weather/tiles offline → chips show "—", map shows last tiles; app never blocks on network.
- IndexedDB unavailable (private mode) → photos disabled with friendly notice; rest works.
- Import validates JSON shape + version before overwriting; corrupt file → error toast, no change.
- All dates handled via IANA time zones with `Intl` APIs (no manual offset math).

## Testing

Manual verification in the browser preview: every feature exercised (upload, note
create/seal/open, geolocation grant + deny, counters tick, countdown, mood, hug, bucket
list, daily question, export→import round-trip), console checked for errors, mobile
viewport checked. No automated test suite for v1 (static app, no build); `store.js` is
written pure enough to unit-test later if the app grows.

## Out of scope (v1)

Accounts/auth, realtime backend sync, push notifications, chat (they have messaging
apps), shared calendar, native builds. The store seam + export/import cover the gap
until Supabase is wanted.
