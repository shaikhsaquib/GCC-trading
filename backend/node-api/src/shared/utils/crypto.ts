import crypto from 'crypto';

const ALGORITHM  = 'aes-256-cbc';
const KEY_HEX    = process.env.ENCRYPTION_KEY || 'a'.repeat(64); // 32 bytes hex
const IV_HEX     = process.env.ENCRYPTION_IV  || 'b'.repeat(32); // 16 bytes hex

const KEY = Buffer.from(KEY_HEX, 'hex');
const IV  = Buffer.from(IV_HEX,  'hex');

/** AES-256-CBC encrypt — FSD §KYC-004, auth.users column-level encryption */
export function encrypt(plaintext: string): string {
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
  return cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex');
}

export function decrypt(ciphertext: string): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
  return decipher.update(ciphertext, 'hex', 'utf8') + decipher.final('utf8');
}

/** Encrypt a Buffer (for KYC documents) with a random IV */
export function encryptBuffer(data: Buffer): { encrypted: Buffer; iv: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return { encrypted, iv: iv.toString('hex') };
}

export function decryptBuffer(encrypted: Buffer, ivHex: string): Buffer {
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/** Generate a cryptographically secure OTP */
export function generateOTP(digits = 6): string {
  const max = Math.pow(10, digits);
  return crypto.randomInt(0, max).toString().padStart(digits, '0');
}

/** Constant-time string comparison (prevents timing attacks) */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
