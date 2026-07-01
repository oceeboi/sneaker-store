import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ─── Constants ────────────────────────────────────────────────────────────────
const BCRYPT_ROUNDS = 12; // OWASP minimum for bcrypt
const TOKEN_BYTE_SIZE = 32; // 256-bit random token

// ─── Hashing ──────────────────────────────────────────────────────────────────

/**
 * Hash a plain-text password.
 * Always use this — never store plain text.
 */
export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_ROUNDS);

/**
 * Compare a plain-text password against a stored hash.
 * Returns true if they match, false otherwise.
 */
export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

// ─── Secure tokens ────────────────────────────────────────────────────────────
// Tokens that travel over the wire (email links, cookies) are generated as
// random hex strings. Only their SHA-256 hash is stored in MongoDB so that a
// database breach cannot be replayed.

type TokenPair = {
  /** Raw token — sent to the user (email link / cookie value). */
  raw: string;
  /** SHA-256 hash of the raw token — stored in the database. */
  hash: string;
};

/**
 * Generate a cryptographically random token and return both the raw value
 * (to send to the user) and the hash (to store in the DB).
 */
export const generateToken = (): TokenPair => {
  const raw = crypto.randomBytes(TOKEN_BYTE_SIZE).toString('hex');
  const hash = hashToken(raw);
  return { raw, hash };
};

/**
 * Hash a raw token for safe DB storage or lookup.
 * SHA-256 is sufficient here — bcrypt is unnecessary for random tokens.
 */

const HMAC_ALGO = 'sha256';
const SECRET = process.env.TOKEN_HASH_SECRET || 'default_secret'; // Use a strong secret in production!

export const hashToken = (raw: string): string => {
  if (raw === undefined || raw === null) throw new Error('raw token required');
  return crypto.createHmac(HMAC_ALGO, SECRET).update(String(raw)).digest('hex');
};

// ─── Account lock helpers ─────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const shouldLockAccount = (attempts: number): boolean => attempts >= MAX_FAILED_ATTEMPTS;

export const lockExpiryDate = (): Date => new Date(Date.now() + LOCK_DURATION_MS);

export const isAccountLocked = (lockedUntil: Date | null): boolean =>
  lockedUntil !== null && lockedUntil > new Date();
