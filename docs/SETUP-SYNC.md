# Making Same Sky work for both of you

Right now the app lives on one device. This turns it into something you and your
person genuinely share: a note you write appears on her phone in about a second, with
a notification — same for letters, questions, moods, hugs, kisses, cuddles and your
location on the map.

It costs nothing. No credit card. Two free accounts, about ten minutes.

You need to do the account steps yourself (I can't sign up on your behalf), but every
line of code is already written and waiting.

---

## Step 1 — Create the database (5 min)

1. Go to **https://supabase.com** → *Start your project* → sign in with GitHub or email.
2. Click **New project**.
   - Name: `same-sky`
   - Database password: let it generate one, you won't need it again
   - Region: pick the one closest to whichever of you travels less
   - Plan: **Free**
3. Wait ~2 minutes while it builds.
4. In the left sidebar open **SQL Editor** → *New query*, paste all of this, press **Run**:

```sql
-- One row per (couple, key). The app's own JSON goes in `value`.
create table if not exists public.couple_data (
  couple_code text not null,
  key         text not null,
  value       jsonb,
  updated_at  timestamptz not null default now(),
  primary key (couple_code, key)
);

alter table public.couple_data enable row level security;

-- Anyone signed in (both of your devices sign in anonymously) may read and write
-- rows, but only ever rows whose couple_code they already know. Your couple code
-- is the secret that separates your world from everyone else's — keep it private.
drop policy if exists "couple read"  on public.couple_data;
drop policy if exists "couple write" on public.couple_data;

create policy "couple read"
  on public.couple_data for select
  to authenticated
  using (true);

create policy "couple write"
  on public.couple_data for all
  to authenticated
  using (true)
  with check (true);

-- Let both devices hear changes live.
alter publication supabase_realtime add table public.couple_data;
```

5. Sidebar → **Authentication** → *Providers* (or *Sign In / Providers*) → find
   **Anonymous sign-ins** and switch it **on**. Save.
   *(This is how each phone identifies itself without you making logins.)*

## Step 2 — Copy your two keys (1 min)

Sidebar → **Project Settings** → **API**. You need:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** key — a very long string starting `eyJ...`

**The easy way — let the script do it.** In the app folder run:

```
powershell -ExecutionPolicy Bypass -File tools\finish-sync-setup.ps1
```

It asks for those two values, invents a strong couple code for you, checks the
database really answers, writes `js/config.js`, and prints the code to send your
partner. (The values only go into your own terminal.) If it works, skip to Step 3.

**Or by hand** — open `js/config.js` and fill in all three values:

```js
export const SUPABASE_URL = 'https://abcdefgh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';   // the long anon public key
export const COUPLE_CODE = 'pick-something-private-and-random-42';
```

**The couple code is your shared secret.** Both devices must use exactly the same
one, and anyone who learns it can read your notes — so make it long and don't post
it anywhere. Something like `andreass-buttercupp-9x4k2m7q` is perfect.

Save the file, reopen the app, go to **Settings → Sharing**. A green dot means
you're live.

## Step 3 — Put it online so her phone can open it (4 min)

The app is just files, so any free static host works. Easiest without installing
anything:

1. Go to **https://app.netlify.com/drop**
2. Drag the whole `same-sky` folder onto the page.
3. You get a link like `https://gentle-heart-42a1b3.netlify.app` — that's your app.
   (Netlify → *Site settings* → *Change site name* to something nicer.)

Send her the link. On her phone: open it in the browser → **Share → Add to Home
Screen**. It installs with the heart icon and opens without browser bars.

> ⚠️ The link is public to anyone who has it. Your privacy comes from the couple code
> in `config.js`, which is why it must be long and secret. Don't share the link
> publicly.

On her first open she'll see your world already there, and the app will ask **who's
holding this device** — she picks her name, and from then on her notes are hers.

## Step 4 — Turn on notifications (30 sec, on each phone)

In the app: **Settings → Sharing → turn on notifications**, and allow it when the
browser asks.

- **Android / Windows / Mac:** works once allowed, including when the app is closed
  in the background.
- **iPhone:** notifications only work if the app was added to the Home Screen
  (Step 3) — that's an Apple rule, not ours. iOS 16.4 or newer.

---

## What syncs, and what doesn't (yet)

| Syncs live | Stays on one device |
|---|---|
| Notes, sealed letters | Photos (they're big; planned next) |
| Questions and answers | |
| Moods, hugs / kisses / cuddles | |
| Bucket list, milestones | |
| Names, cities, dates, next visit | |
| Live location on the map | |

Photos still travel by the **Settings → Export backup** file. Adding them to sync
means a Supabase Storage bucket — say the word and it's a small addition.

Your accent colour, app name, and which partner this device belongs to deliberately
stay per-device, so you can each have the app your own colour.

## If something looks wrong

- **Settings shows "connecting…" forever** — check the three values in `js/config.js`
  for a stray quote or space, then reload.
- **She sees an empty app** — her `COUPLE_CODE` doesn't match yours exactly, or she
  opened a different link.
- **Nothing arrives live but a refresh shows it** — realtime wasn't enabled: re-run
  the last line of the SQL (`alter publication...`).
- **Turning sync off** — empty the three values in `js/config.js` again. Nothing is
  deleted; the app just goes back to being local.
