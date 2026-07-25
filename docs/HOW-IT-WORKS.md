# Same Sky — what it is and how it works

A private app for two people who live in different places. No company owns it, no ads,
no algorithm, no other users. Just the two of you.

---

## The five tabs

### 🏡 Home — the "how are we doing" screen
- **Together for** — days, hours, minutes and seconds since the date you set, ticking live.
- **Two clocks** — your local time and theirs, side by side, with ☀️/🌙 so you can see
  at a glance whether it's a good moment to call. Under each: the weekday (it may be
  tomorrow already for one of you) and the current weather in that city.
- **Countdown** — days until you're together again.
- **Mood** — tap an emoji; they see how you're feeling and how long ago you tapped it.
- **Hug · kiss · cuddles** — three buttons. Each one rains its own animation across
  the screen and tells them you were thinking of them.
- **Question teaser** — if they asked you something, it's right here waiting.

### 🗺️ Map — where you both are
Two heart-shaped pins with your avatars, a dashed line between them, and the distance
in kilometres. Turn on **"keep it updating on its own"** and your pin follows you while
the app is open — and if you travel far enough, **your clock on the Home screen changes
time zone by itself**, so they always see your real local time.

### 📸 Memories — the photo album
Drop photos in, give them captions, mark favourites with a ♥, tap any one to see it big.
They're saved as polaroids, slightly tilted, like a real album.

### 💌 Notes — the wall and the letters
- **Sticky notes** in four pastel colours. Write something small and sweet; pin the ones
  worth keeping at the top.
- **Sealed letters** — "Open when you miss me at 3am", "Open when you land". The text
  stays blurred behind a wax seal until they break it. Give a letter a date and it
  refuses to open early.

### 💞 Us — the shared record
- **Stats** — days together, kilometres apart, photos, notes.
- **Milestones** — 100 days, 1 year, 2 years… calculated for you, with the next one
  starred. Add your own ("first met in person").
- **Bucket list** — everything you'll do when you're finally in the same place.
- **Questions** — either of you asks whatever you like, whenever. The other person's
  copy glows until they answer. Stuck? **🎲 inspire me** offers a prompt (it only
  fills the box — nothing is posted until you press ask).

### ⚙️ Settings
Names, avatars, cities, time zones, your date, next visit, the app's colour and even
its name. Also the backup file, and "erase and set up again".

---

## What happens when you install it

**First launch asks you everything** — your name and avatar, their name and avatar,
both cities (searched for real, so the map, clocks and weather are correct), the date
you count from, an optional next visit, and a colour. Nothing is pre-filled with
somebody else's example data.

Whoever runs setup is marked as the person holding that device. That's how the app
knows a note is *from you* and a mood is *yours*.

---

## The important part: how the two devices talk

There are two possible worlds, and you choose which one you're in.

### World A — private and local (how it works right now)

Everything lives in the browser on your own device. Nothing is uploaded anywhere,
nothing needs an account, and it works with no internet (except the map tiles and
weather).

The catch: **your girlfriend's phone is a separate island.** What you write, she
doesn't see. To share, you use **Settings → Export backup**, which gives you one file
containing everything, and she opens it with **Import backup**. Her app then asks
*"who's holding this device?"* so her notes go under her name.

That's real, and it's private — but it's manual, and there are no notifications.

### World B — actually connected (10 minutes of setup)

Fill in three values in `js/config.js` and the same app becomes a shared one:

- a note, letter, question, mood, kiss or map position appears on the other phone in
  **about a second**
- the other person gets a **notification**, a banner in the app, and a dot on the tab
- both of you install it on your home screens and it behaves like a normal app

What you need: a free **Supabase** account (the database in the middle, no card) and
any free static host such as **Netlify** to put the app online so her phone can open
it. The step-by-step is in [SETUP-SYNC.md](SETUP-SYNC.md) — including the exact SQL to
paste and where the keys live.

Currently synced: notes, sealed letters, questions and answers, moods, hugs/kisses/
cuddles, bucket list, milestones, names, cities, dates, and live location.
Not yet synced: **photos** (they're large and need a storage bucket — a small
addition when you want it). They still travel by the backup file.

Deliberately *not* shared: your accent colour, the app's name, and which partner this
device belongs to — so you can each have it your own colour.

---

## Privacy, plainly

- In World A, the data never leaves your device.
- In World B, it lives in *your* Supabase project, which only you control. The privacy
  comes from your **couple code** — a secret word only you two know. Anyone who learns
  it could read your app, so make it long and don't post it anywhere.
- Location is only ever shared with each other, and auto-update only runs while the
  app is open. Turn it off any time on the Map tab.
- There are no other users, no analytics, and nobody to sell anything.

---

## Little details worth knowing

- **The clocks never lie.** If a city was never set, the app shows `--:--` and "add a
  city" instead of guessing — showing two identical clocks would defeat the point.
- **Two windows can't erase each other.** Every save re-reads first, so a note written
  on one device or window is never overwritten by a stale copy on another.
- **Sealed letters with a date** genuinely refuse to open early.
- **GPS jitter is ignored** — sitting still doesn't spam updates; a real move does.
- **Reduced-motion** is respected: the hearts and animations calm down if your system
  asks for that.
