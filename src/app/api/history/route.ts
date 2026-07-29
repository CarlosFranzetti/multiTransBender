import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { DatabaseUnavailableError, ensureSchema, isDatabaseConfigured, sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Render history for the web standalone.
 *
 * Mirrors the plugin's "last three processings" safety net, minus the audio:
 * the settings are kept so a render can be reproduced, the file is not. Only
 * the three most recent entries per user survive — this is a recovery aid, not
 * an archive, and keeping more would be collecting data for its own sake.
 */
const HISTORY_DEPTH = 3;
const MAX_PAYLOAD_BYTES = 256 * 1024;

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ history: [] });

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    await ensureSchema();
    const history = await sql()`
      select id, kind, payload, source_fingerprint, source_name, duration_sec, sample_rate, created_at
      from render_history
      where user_id = ${user.id}
      order by created_at desc
      limit ${HISTORY_DEPTH}`;
    return NextResponse.json({ history });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not load history.' }, { status: 500 });
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

  const kind = String(body.kind ?? '');
  if (kind !== 'chain' && kind !== 'timeline') {
    return NextResponse.json({ error: 'Unknown history kind.' }, { status: 400 });
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return NextResponse.json({ error: 'Missing settings payload.' }, { status: 400 });
  }

  const serialised = JSON.stringify(body.payload);
  if (serialised.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: 'Those settings are too large to save.' }, { status: 413 });
  }

  const fingerprint = body.sourceFingerprint ? String(body.sourceFingerprint).slice(0, 128) : null;
  const sourceName = body.sourceName ? String(body.sourceName).slice(0, 260) : null;
  const durationSec = Number.isFinite(Number(body.durationSec)) ? Number(body.durationSec) : null;
  const sampleRate = Number.isFinite(Number(body.sampleRate)) ? Math.round(Number(body.sampleRate)) : null;

  try {
    await ensureSchema();
    await sql()`
      insert into render_history (user_id, kind, payload, source_fingerprint, source_name, duration_sec, sample_rate)
      values (${user.id}, ${kind}, ${serialised}::jsonb, ${fingerprint}, ${sourceName}, ${durationSec}, ${sampleRate})`;

    // Trim to depth in the same request, so the table cannot grow unbounded
    // even if a cleanup job is never configured.
    await sql()`
      delete from render_history
      where user_id = ${user.id}
        and id not in (
          select id from render_history
          where user_id = ${user.id}
          order by created_at desc
          limit ${HISTORY_DEPTH}
        )`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not record history.' }, { status: 500 });
  }
}
