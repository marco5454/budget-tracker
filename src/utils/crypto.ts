/**
 * Cryptography helpers used by the app.
 *
 * Two distinct uses, do not confuse them:
 *
 *  1) App-lock PIN/passphrase verification (createLockHash / verifyLockHash).
 *     This is access-gating only. It does NOT encrypt the IndexedDB —
 *     anyone with full device access can still read the raw DB.
 *
 *  2) Backup file encryption (encryptBackupPayload / decryptBackupPayload).
 *     This DOES encrypt the exported backup file at rest using AES-GCM
 *     with a key derived from a user-supplied passphrase via PBKDF2.
 *
 * Plus a small SHA-256 helper used for backup integrity hashes.
 */

const PBKDF2_ITERATIONS = 200_000;
const PBKDF2_BACKUP_ITERATIONS = 250_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;

// ---- base64 helpers (binary-safe, work for arbitrary byte strings) ----

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
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

function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(b64ToBuf(b64));
}

// ---- generic PBKDF2 derive raw bits (used by app-lock hash) ----

async function deriveBitsPBKDF2(
  passphrase: string,
  salt: ArrayBuffer | Uint8Array,
  iterations: number,
  bits: number,
): Promise<ArrayBuffer> {
  const pwKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const saltBuf = salt instanceof Uint8Array ? toArrayBuffer(salt) : salt;
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuf, iterations, hash: "SHA-256" },
    pwKey,
    bits,
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Copy into a fresh ArrayBuffer (avoids SharedArrayBuffer typing issues
  // and any byteOffset/byteLength weirdness from views).
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

// ===== App-lock PIN/passphrase =====

export interface LockHash {
  salt: string;
  hash: string;
  iterations: number;
  v: 1;
}

export async function createLockHash(passphrase: string): Promise<LockHash> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hashBuf = await deriveBitsPBKDF2(
    passphrase,
    saltBytes,
    PBKDF2_ITERATIONS,
    KEY_BITS,
  );
  return {
    salt: bufToB64(saltBytes),
    hash: bufToB64(hashBuf),
    iterations: PBKDF2_ITERATIONS,
    v: 1,
  };
}

export async function verifyLockHash(
  passphrase: string,
  stored: LockHash,
): Promise<boolean> {
  if (stored?.v !== 1) return false;
  const saltBuf = b64ToBuf(stored.salt);
  const hashBuf = await deriveBitsPBKDF2(
    passphrase,
    saltBuf,
    stored.iterations || PBKDF2_ITERATIONS,
    KEY_BITS,
  );
  const a = new Uint8Array(hashBuf);
  const b = b64ToBytes(stored.hash);
  if (a.length !== b.length) return false;
  // Constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ===== SHA-256 hash (string -> hex) =====

export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// ===== Backup file encryption (AES-GCM + PBKDF2) =====

export interface EncryptedBackupEnvelope {
  /** File-format marker so import can detect this format. */
  appName: "Ward Budget Tracker";
  /** Distinct from plaintext backup version. */
  format: "encrypted-v1";
  /** PBKDF2 + AES-GCM parameters. */
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  /** Base64 of AES-GCM ciphertext (which already contains the auth tag). */
  ciphertext: string;
  /** SHA-256 hex of the plaintext JSON, for tamper detection after decrypt. */
  plaintextSha256: string;
  exportedAt: string;
}

async function deriveAesKey(
  passphrase: string,
  saltBytes: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const pwKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(saltBytes),
      iterations,
      hash: "SHA-256",
    },
    pwKey,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackupPayload(
  plaintextJson: string,
  passphrase: string,
): Promise<EncryptedBackupEnvelope> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error("Passphrase must be at least 4 characters.");
  }
  const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const ivBytes = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(passphrase, saltBytes, PBKDF2_BACKUP_ITERATIONS);
  const data = new TextEncoder().encode(plaintextJson);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(ivBytes) },
    key,
    data,
  );
  const sha = await sha256Hex(plaintextJson);
  return {
    appName: "Ward Budget Tracker",
    format: "encrypted-v1",
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_BACKUP_ITERATIONS,
    salt: bufToB64(saltBytes),
    iv: bufToB64(ivBytes),
    ciphertext: bufToB64(new Uint8Array(ct)),
    plaintextSha256: sha,
    exportedAt: new Date().toISOString(),
  };
}

export async function decryptBackupPayload(
  envelope: EncryptedBackupEnvelope,
  passphrase: string,
): Promise<{ plaintextJson: string }> {
  if (envelope?.format !== "encrypted-v1" || envelope?.kdf !== "PBKDF2-SHA256") {
    throw new Error("Unsupported encrypted backup format.");
  }
  const saltBytes = b64ToBytes(envelope.salt);
  const ivBytes = b64ToBytes(envelope.iv);
  const key = await deriveAesKey(
    passphrase,
    saltBytes,
    envelope.iterations || PBKDF2_BACKUP_ITERATIONS,
  );
  let ptBuf: ArrayBuffer;
  try {
    ptBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(ivBytes) },
      key,
      b64ToBuf(envelope.ciphertext),
    );
  } catch {
    throw new Error("Wrong passphrase, or the file is corrupted.");
  }
  const plaintextJson = new TextDecoder().decode(ptBuf);
  if (envelope.plaintextSha256) {
    const sha = await sha256Hex(plaintextJson);
    if (sha !== envelope.plaintextSha256) {
      throw new Error("Backup integrity check failed (SHA-256 mismatch).");
    }
  }
  return { plaintextJson };
}

export function isEncryptedBackup(parsed: unknown): parsed is EncryptedBackupEnvelope {
  if (!parsed || typeof parsed !== "object") return false;
  const o = parsed as Record<string, unknown>;
  return (
    o.appName === "Ward Budget Tracker" &&
    o.format === "encrypted-v1" &&
    typeof o.ciphertext === "string" &&
    typeof o.salt === "string" &&
    typeof o.iv === "string"
  );
}
