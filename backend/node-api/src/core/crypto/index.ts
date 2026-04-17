import crypto from 'crypto';
import { config } from '../../config';

const ALGORITHM = 'aes-256-cbc';
const KEY       = Buffer.from(config.encryption.key, 'hex'); // 32 bytes

// ---------------------------------------------------------------------------
// AES-256-CBC string encryption (PII fields: email, phone)
// Returns "iv:ciphertext" as a single hex string.
// ---------------------------------------------------------------------------

export function encrypt(plaintext: string): string {
  const iv         = crypto.randomBytes(16);
  const cipher     = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, dataHex] = ciphertext.split(':');
  const iv        = Buffer.from(ivHex, 'hex');
  const data      = Buffer.from(dataHex, 'hex');
  const decipher  = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

// ---------------------------------------------------------------------------
// AES-256-CBC buffer encryption (KYC document files)
// ---------------------------------------------------------------------------

export function encryptBuffer(buffer: Buffer): { data: Buffer; iv: Buffer } {
  const iv      = crypto.randomBytes(16);
  const cipher  = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const data    = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { data, iv };
}

export function decryptBuffer(data: Buffer, iv: Buffer): Buffer {
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SHA-256 hash for deterministic duplicate detection (email dedup). */
export function hashForLookup(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

/** Generate a cryptographically secure numeric OTP. */
export function generateOtp(length = 6): string {
  const max = Math.pow(10, length);
  const otp = crypto.randomInt(0, max);
  return otp.toString().padStart(length, '0');
}

/** Constant-time string comparison (prevents timing attacks). */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
