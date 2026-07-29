-- MultiTransBend — Neon/Postgres schema.
--
-- PRIVACY CONTRACT, enforced by the shape of this schema:
-- there is no audio column anywhere, and there never will be. The web
-- standalone stores what you *did* — device choices, band settings, region
-- maps — and nothing you did it to. The waveform is uploaded into the browser
-- tab, processed there, downloaded from there, and gone when the tab closes.
--
-- `source_fingerprint` is a SHA-256 of the decoded audio, computed in the
-- browser. It exists so a saved recipe can recognise the same file if you bring
-- it back later. A hash cannot be turned back into audio, so this keeps the
-- convenience without keeping the content.

create extension if not exists pgcrypto;

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text        not null,
  email_lower   text        not null generated always as (lower(email)) stored,
  password_hash text        not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);

create unique index if not exists users_email_lower_key on users (email_lower);

create table if not exists sessions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references users (id) on delete cascade,
  token_hash text        not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create unique index if not exists sessions_token_hash_key on sessions (token_hash);
create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

-- A saved recipe: the full chain or timeline definition, as JSON.
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
);

create index if not exists presets_user_id_idx on presets (user_id, updated_at desc);
create index if not exists presets_fingerprint_idx on presets (user_id, source_fingerprint);

-- Recent-activity trail, so the web app can offer "pick up where you left off".
-- Again: settings and a hash, never samples.
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
);

create index if not exists render_history_user_idx on render_history (user_id, created_at desc);
