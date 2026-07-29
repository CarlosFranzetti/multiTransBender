import { NextResponse } from 'next/server';
import {
  checkPassword,
  createSession,
  hashPassword,
  isValidEmail,
  pruneSessions,
} from '@/lib/auth';
import { DatabaseUnavailableError, ensureSchema, isDatabaseConfigured, sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  const strength = checkPassword(password);
  if (!strength.ok) {
    return NextResponse.json({ error: strength.reason }, { status: 400 });
  }

  try {
    await ensureSchema();
    const passwordHash = await hashPassword(password);

    const rows = (await sql()`
      insert into users (email, password_hash)
      values (${email}, ${passwordHash})
      on conflict (email_lower) do nothing
      returning id, email`) as Array<{ id: string; email: string }>;

    if (rows.length === 0) {
      // Deliberately the same shape as any other failure, so this endpoint
      // cannot be used to enumerate which addresses have accounts.
      return NextResponse.json(
        { error: 'Could not create that account. Try signing in instead.' },
        { status: 409 },
      );
    }

    await createSession(rows[0].id);
    await pruneSessions();
    return NextResponse.json({ user: { id: rows[0].id, email: rows[0].email } });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not create that account.' }, { status: 500 });
  }
}
