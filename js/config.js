// Same Sky — the only file you edit to switch sync on.
//
// Leave these empty and the app stays exactly as it is: private, on-device, no
// accounts, no server. Fill them in (see docs/SETUP-SYNC.md, about 10 minutes) and
// both phones share the same world: notes, photos, moods, questions and live
// location arrive on the other device within a second, with a notification.
//
// The anon key is meant to be public — it only permits what the database's row
// policies allow, and those restrict everything to your own couple code.

export const SUPABASE_URL = '';       // e.g. 'https://abcdefgh.supabase.co'
export const SUPABASE_ANON_KEY = '';  // the long 'anon public' key

// Both phones must use the SAME code — it is what pairs you two together.
// Treat it like a password: anyone who knows it can read your app's contents.
export const COUPLE_CODE = '';        // e.g. 'andreass-buttercupp-7f3k9x'

export const syncConfigured = () =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && COUPLE_CODE);
