import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { DatabaseUnavailableError, isDatabaseConfigured, sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAYLOAD_BYTES = 256 * 1024;

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Accounts are not configured.' }, { status: 503 });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Unknown preset.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim().slice(0, 120);
  const payload = body.payload;
  if (!name) return NextResponse.json({ error: 'Give the preset a name.' }, { status: 400 });
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Missing settings payload.' }, { status: 400 });
  }

  const serialised = JSON.stringify(payload);
  if (serialised.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Those settings are too large to save.' }, { status: 413 });
  }

  const notes = body.notes ? String(body.notes).slice(0, 2000) : null;

  try {
    // The user_id predicate is the authorisation check: a preset belonging to
    // someone else simply does not match, and the caller cannot tell the
    // difference between "not yours" and "does not exist".
    const rows = await sql()`
      update presets
      set name = ${name},
          payload = ${serialised}::jsonb,
          notes = ${notes},
          updated_at = now()
      where id = ${id} and user_id = ${user.id}
      returning id, name, kind, payload, source_fingerprint, source_name, notes, created_at, updated_at`;

    if ((rows as unknown[]).length === 0) {
      return NextResponse.json({ error: 'Unknown preset.' }, { status: 404 });
    }
    return NextResponse.json({ preset: (rows as unknown[])[0] });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not update that preset.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Accounts are not configured.' }, { status: 503 });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Unknown preset.' }, { status: 404 });

  try {
    const rows = await sql()`
      delete from presets where id = ${id} and user_id = ${user.id} returning id`;
    if ((rows as unknown[]).length === 0) {
      return NextResponse.json({ error: 'Unknown preset.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not delete that preset.' }, { status: 500 });
  }
}
