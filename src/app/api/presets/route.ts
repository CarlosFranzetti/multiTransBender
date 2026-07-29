import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { DatabaseUnavailableError, ensureSchema, isDatabaseConfigured, sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Preset storage.
 *
 * The payload is the chain or timeline definition — device ids, band settings,
 * crossover points, region boundaries. It is bounded in size because there is
 * no legitimate reason for a settings blob to be large, and an unbounded jsonb
 * column is an invitation to use the database as file storage, which is exactly
 * what this product promises not to do.
 */
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_PRESETS_PER_USER = 500;

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ presets: [] });

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    await ensureSchema();
    const presets = await sql()`
      select id, name, kind, payload, source_fingerprint, source_name, notes, created_at, updated_at
      from presets
      where user_id = ${user.id}
      order by updated_at desc
      limit ${MAX_PRESETS_PER_USER}`;
    return NextResponse.json({ presets });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not load presets.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Accounts are not configured.' }, { status: 503 });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim().slice(0, 120);
  const kind = String(body.kind ?? '');
  const payload = body.payload;

  if (!name) return NextResponse.json({ error: 'Give the preset a name.' }, { status: 400 });
  if (kind !== 'chain' && kind !== 'timeline') {
    return NextResponse.json({ error: 'Unknown preset kind.' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Missing settings payload.' }, { status: 400 });
  }

  const serialised = JSON.stringify(payload);
  if (serialised.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Those settings are too large to save.' }, { status: 413 });
  }

  const fingerprint = body.sourceFingerprint ? String(body.sourceFingerprint).slice(0, 128) : null;
  const sourceName = body.sourceName ? String(body.sourceName).slice(0, 260) : null;
  const notes = body.notes ? String(body.notes).slice(0, 2000) : null;

  try {
    await ensureSchema();

    const countRows = (await sql()`
      select count(*)::int as count from presets where user_id = ${user.id}`) as Array<{
      count: number;
    }>;
    if ((countRows[0]?.count ?? 0) >= MAX_PRESETS_PER_USER) {
      return NextResponse.json(
        { error: 'Preset limit reached. Delete a few before saving more.' },
        { status: 409 },
      );
    }

    const rows = (await sql()`
      insert into presets (user_id, name, kind, payload, source_fingerprint, source_name, notes)
      values (${user.id}, ${name}, ${kind}, ${serialised}::jsonb, ${fingerprint}, ${sourceName}, ${notes})
      returning id, name, kind, payload, source_fingerprint, source_name, notes, created_at, updated_at`) as Array<
      Record<string, unknown>
    >;

    return NextResponse.json({ preset: rows[0] });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not save that preset.' }, { status: 500 });
  }
}
