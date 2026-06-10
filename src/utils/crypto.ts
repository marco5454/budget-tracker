/**
 * Lightweight PIN/passphrase verification using PBKDF2 + SHA-256.
 * NOTE: This protects against casual access. It does NOT encrypt the
 * database — IndexedDB content is still readable to anyone with full
 * device access. For real confidentiality, encrypt at the OS / disk level.
 */

const ITERATIONS = 200_000;

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKeyBytes(
  passphrase: string,
  salt: ArrayBuffer,
  iterations = ITERATIONS,
): Promise<ArrayBuffer> {
  const pwKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    pwKey,
    256,
  );
}

export interface LockHash {
  salt: string;
  hash: string;
  iterations: number;
  v: 1;
}

export async function createLockHash(passphrase: string): Promise<LockHash> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = saltBytes.buffer;
  const hashBuf = await deriveKeyBytes(passphrase, salt);
  return {
    salt: bufToB64(salt),
    hash: bufToB64(hashBuf),
    iterations: ITERATIONS,
    v: 1,
  };
}

export async function verifyLockHash(
  passphrase: string,
  stored: LockHash,
): Promise<boolean> {
  if (stored?.v !== 1) return false;
  const salt = b64ToBuf(stored.salt);
  const hashBuf = await deriveKeyBytes(
    passphrase,
    salt,
    stored.iterations || ITERATIONS,
  );
  const a = new Uint8Array(hashBuf);
  const b = new Uint8Array(b64ToBuf(stored.hash));
  if (a.length !== b.length) return false;
  // Constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
