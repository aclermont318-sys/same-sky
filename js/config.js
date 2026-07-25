// Same Sky - the only file you edit to switch sync on.
//
// Empty these three values and the app goes straight back to being private and
// on-device; nothing is deleted. The anon key is public by design - it only permits
// what the database's row policies allow. COUPLE_CODE is the real secret: anyone who
// knows it can read your app's contents, so keep it between the two of you.

export const SUPABASE_URL = 'https://ntvafmrfngbqduidetfq.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50dmFmbXJmbmdicWR1aWRldGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODkxMDAsImV4cCI6MjEwMDU2NTEwMH0.uQioYHhf0GCUux-44rH3V96YWC1k2OkhLcTkiR5IZks';
// The couple code is NOT here on purpose. It is created when the first person sets
// up, lives in that device's storage, and reaches the other person only through the
// invite link — so this file stays safe to publish.

export const syncConfigured = () =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
