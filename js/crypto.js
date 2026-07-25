// Same Sky — your words leave this device already sealed.
//
// The app is hosted publicly, so its database key is public too. That key alone must
// never be enough to read your notes. Everything is encrypted in the browser with a
// key derived from your couple code — the secret that only ever travels inside the
// invite link. The server stores ciphertext it cannot read, and the row is filed
// under a hash of the code, so even the code itself never leaves your devices.

const enc = new TextEncoder();
const dec = new TextDecoder();

const keyCache = new Map();
const roomCache = new Map();

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** The public name of your shared row: a hash, never the code itself. */
export async function roomId(code) {
  if (roomCache.has(code)) return roomCache.get(code);
  const id = (await sha256Hex(`same-sky:room:${code}`)).slice(0, 32);
  roomCache.set(code, id);
  return id;
}

async function keyFor(code) {
  if (keyCache.has(code)) return keyCache.get(code);
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('same-sky/v1'), iterations: 120000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  keyCache.set(code, key);
  return key;
}

const toB64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/** JSON in, sealed envelope out. */
export async function sealJSON(code, value) {
  const key = await keyFor(code);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, iv: toB64(iv), ct: toB64(ct) };
}

export async function openJSON(code, envelope) {
  if (!envelope || typeof envelope !== 'object' || !envelope.ct) return envelope; // plain (pre-encryption) row
  const key = await keyFor(code);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(envelope.iv) }, key, fromB64(envelope.ct),
  );
  return JSON.parse(dec.decode(plain));
}

/** Same treatment for photo bytes. */
export async function sealBytes(code, blob) {
  const key = await keyFor(code);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await blob.arrayBuffer());
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return new Blob([out], { type: 'application/octet-stream' });
}

export async function openBytes(code, blob, type = 'image/jpeg') {
  const all = new Uint8Array(await blob.arrayBuffer());
  const key = await keyFor(code);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12),
  );
  return new Blob([plain], { type });
}
