# Same Sky 💌

*Two hearts, one sky — a private little app for a long-distance couple.*

Everything lives in one cute, organized place: how long you've been together (ticking
live), both your local times and weather, where each of you is on a map, your photos,
sticky notes and sealed letters, milestones, a shared bucket list, and one question a day
you both answer.

No accounts. No server. No one else's cloud. Your data stays on your devices.

## Features

| Tab | What's inside |
|---|---|
| 🏡 **Home** | days/hours/min/sec together · both time zones with day/night · live weather for both cities · countdown to your next visit · mood check-ins · a "send a hug" button (full-screen hearts) · today's question |
| 🗺️ **Map** | two heart pins, a dashed line between them, the km between you, "update my location" via GPS |
| 📸 **Memories** | photo gallery (polaroid style), captions, favorites, lightbox — stored in your browser's IndexedDB |
| 💌 **Notes** | pastel sticky-note wall + sealed **"Open when…"** letters that stay blurred until the right day |
| 💞 **Us** | stats, auto milestones (100 days, 1 year…), your own milestones, shared bucket list, daily question with both answers |
| ⚙️ **Settings** | names, emoji, cities (with 1-click geocoding), time zones, start date, next visit, backup export/import |

## Install on this laptop (already done)

```
powershell -ExecutionPolicy Bypass -File tools\install.ps1
```

That creates a **Same Sky** icon on the Desktop and in the Start Menu. Double-click it and
the app opens in its own window — no terminal, no browser tabs or address bar. Behind the
scenes the shortcut runs `tools/samesky_launch.pyw`, which starts a tiny local server
(`tools/samesky_server.pyw`) if it isn't already running, then opens the app.

- The server listens on **loopback only** (`localhost:4600`) — nothing is reachable from
  the network, and Windows Firewall never asks for permission.
- The port is **pinned to 4600 on purpose**: the browser keys your notes, photos and
  settings to that exact address, so a shifting port would look like everything vanished.
  If another program is already on 4600, Same Sky says so instead of opening an empty copy.
- Closing the window leaves the little server running until you log off or restart. It
  costs a few MB; the next launch is instant.
- To remove the shortcuts: `powershell -ExecutionPolicy Bypass -File tools\install.ps1 -Uninstall`
- Want it on the taskbar? Pin the **Start Menu entry** (Start → right-click *Same Sky* →
  Pin to taskbar), or drag the Desktop shortcut onto the taskbar. Don't pin the app
  window while it's open — that pin would launch the browser without starting the
  server, so after a restart it would just say the page can't be reached.

## Run it anywhere else

Any static server works:

```
cd same-sky
python -m http.server 4600
```

Open http://localhost:4600. To use it on your phones, host the folder anywhere static
(Netlify/Vercel/GitHub Pages drag-and-drop) — then on the phone open the site and use
**Add to Home Screen**. It installs like a real app (icon, standalone window).

## How two phones stay in sync (for now)

1. One of you sets everything up and taps **Settings → Export backup** — you get a
   `same-sky-backup-….json` "love letter" file.
2. Send it to your partner (any messenger), they tap **Import backup**.
3. On first run each phone answers *"Who's holding this device?"* — that's how notes,
   moods and locations get the right author on each phone.
4. Re-export/import whenever you want to merge worlds again.

It's manual, but it's private and it works offline. 💝

## Real-time sync later (the upgrade path)

All reads/writes go through **`js/store.js`** — nothing else touches storage. To add live
sync, swap its internals for a backend (e.g. Supabase: one `couple` row + a `photos`
bucket + realtime subscription) and every feature — locations, notes, moods, hugs —
updates live on both phones. No view code changes needed.

## Tech

Vanilla HTML/CSS/JS ES modules — no build step, no dependencies to rot. Leaflet +
OpenStreetMap for the map, Open-Meteo for weather & geocoding (both free, no API keys).
Rendering goes through a tiny auto-escaping template helper (`js/dom.js`), so user text
can't inject markup. Photos live in IndexedDB, everything else in localStorage under
`samesky:*` keys.
