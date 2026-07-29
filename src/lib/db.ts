import { neon } from '@neondatabase/serverless';

/**
 * Neon connection.
 *
 * The database is optional on purpose. Accounts are a convenience for saving
 * settings, not a gate on the processor — with no DATABASE_URL configured the
 * app still loads, processes and exports audio, it just cannot save presets to
 * the cloud. That keeps a fresh deploy working before anyone has provisioned
 * anything, and it means a database outage degrades one feature instead of
 * taking the tool down.
 */

let cached: ReturnType<typeof neon> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function sql() {
  if (!process.env.DATABASE_URL) {
    throw new DatabaseUnavailableError();
  }
  if (!cached) cached = neon(process.env.DATABASE_URL);
  return cached;
}

export class DatabaseUnavailableError extends Error {
  constructor() {
    super('Accounts are not configured on this deployment.');
    this.name = 'DatabaseUnavailableError';
  }
}

/** Idempotent schema bootstrap, safe to run on every cold start. */
export async function ensureSchema(): Promise<void> {
  const db = sql();
  await db`create extension if not exists pgcrypto`;
  await db`
    create table if not exists users (
      id            uuid primary key default gen_random_uuid(),
      email         text        not null,
      email_lower   text        not null generated always as (lower(email)) stored,
      password_hash text        not null,
      created_at    timestamptz not null default now(),
      last_seen_at  timestamptz
    )`;
  await db`create unique index if not exists users_email_lower_key on users (email_lower)`;
  await db`
    create table if not exists sessions (
      id         uuid        primary key default gen_random_uuid(),
      user_id    uuid        not null references users (id) on delete cascade,
      token_hash text        not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null
    )`;
  await db`create unique index if not exists sessions_token_hash_key on sessions (token_hash)`;
  await db`create index if not exists sessions_user_id_idx on sessions (user_id)`;
  await db`
    create table if not exists presets (
      id                 uuid        primary key default gen_random_uuid(),
      user_id            uuid        not null references users (id) on delete cascade,
      name               text        not null,
      kind               text        not null check (kind in ('chain', 'timeline')),
      payload            jsonb       not null,
      source_fingerprint text,
      source_name        text,
      notes              text,
      created_at         timestamptz not null default now(),
      updated_at         timestamptz not null default now()
    )`;
  await db`create index if not exists presets_user_id_idx on presets (user_id, updated_at desc)`;
  await db`create index if not exists presets_fingerprint_idx on presets (user_id, source_fingerprint)`;
  await db`
    create table if not exists render_history (
      id                 uuid        primary key default gen_random_uuid(),
      user_id            uuid        not null references users (id) on delete cascade,
      kind               text        not null check (kind in ('chain', 'timeline')),
      payload            jsonb       not null,
      source_fingerprint text,
      source_name        text,
      duration_sec       double precision,
      sample_rate        integer,
      created_at         timestamptz not null default now()
    )`;
  await db`create index if not exists render_history_user_idx on render_history (user_id, created_at desc)`;
}
