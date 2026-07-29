import { NextResponse } from 'next/server';
import { createSession, isValidEmail, pruneSessions, verifyPassword } from '@/lib/auth';
import { DatabaseUnavailableError, ensureSchema, isDatabaseConfigured, sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A dummy hash with the same cost as a real one. Verifying against it when the
 * email is unknown keeps the response time of "no such user" and "wrong
 * password" indistinguishable, so timing cannot be used to enumerate accounts.
 */
const DUMMY_HASH =
  'scrypt$00000000000000000000000000000000$' + '0'.repeat(128);

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Accounts are not configured on this deployment.' },
      { status: 503 },
    );
  }

  let email: string;
  let password: string;
  try {
    const body = await request.json();
    email = String(body.email ?? '').trim();
    password = String(body.password ?? '');
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!isValidEmail(email) || password.length === 0) {
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }

  try {
    await ensureSchema();
    const rows = (await sql()`
      select id, email, password_hash
      from users
      where email_lower = lower(${email})
      limit 1`) as Array<{ id: string; email: string; password_hash: string }>;

    const user = rows[0];
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !ok) {
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
    }

    await createSession(user.id);
    await sql()`update users set last_seen_at = now() where id = ${user.id}`;
    await pruneSessions();

    return NextResponse.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not sign in.' }, { status: 500 });
  }
}
