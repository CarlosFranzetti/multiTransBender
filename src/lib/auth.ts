import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { sql } from './db';

/**
 * Account handling.
 *
 * Deliberately small: email, a scrypt-hashed password, and an opaque session
 * token. No third-party identity provider, no analytics identifiers, no
 * profile. The account exists so your settings follow you between machines and
 * for nothing else.
 *
 * Session tokens are random 32-byte values; only their SHA-256 is stored, so a
 * leaked database dump does not hand anyone a working session. (A fast hash is
 * correct here and wrong for passwords — the token already has full entropy, so
 * there is nothing to brute-force, whereas a password does not and needs the
 * deliberate slowness of scrypt.)
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SCRYPT_KEYLEN = 64;
const SESSION_COOKIE = 'mtb_session';
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await sql()`
    insert into sessions (user_id, token_hash, expires_at)
    values (${userId}, ${hashToken(token)}, ${expiresAt.toISOString()})`;

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await sql()`delete from sessions where token_hash = ${hashToken(token)}`;
    } catch {
      // The cookie is cleared regardless; a failed delete must not block logout.
    }
  }
  store.delete(SESSION_COOKIE);
}

/** Resolve the signed-in user, or null. Expired sessions are treated as absent. */
export async function currentUser(): Promise<SessionUser | null> {
  if (!process.env.DATABASE_URL) return null;

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const rows = (await sql()`
      select users.id, users.email
      from sessions
      join users on users.id = sessions.user_id
      where sessions.token_hash = ${hashToken(token)}
        and sessions.expires_at > now()
      limit 1`) as Array<{ id: string; email: string }>;

    return rows[0] ? { id: rows[0].id, email: rows[0].email } : null;
  } catch {
    return null;
  }
}

/** Remove expired rows. Cheap enough to run opportunistically on sign-in. */
export async function pruneSessions(): Promise<void> {
  try {
    await sql()`delete from sessions where expires_at < now()`;
  } catch {
    // Housekeeping only.
  }
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export interface PasswordCheck {
  ok: boolean;
  reason?: string;
}

export function checkPassword(password: string): PasswordCheck {
  if (password.length < 10) return { ok: false, reason: 'Use at least 10 characters.' };
  if (password.length > 512) return { ok: false, reason: 'That password is too long.' };
  return { ok: true };
}
