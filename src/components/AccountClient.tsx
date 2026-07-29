'use client';

import { useCallback, useEffect, useState } from 'react';

interface SessionUser {
  id: string;
  email: string;
}

interface Preset {
  id: string;
  name: string;
  kind: string;
  source_name: string | null;
  updated_at: string;
}

interface HistoryEntry {
  id: string;
  kind: string;
  source_name: string | null;
  duration_sec: number | null;
  sample_rate: number | null;
  created_at: string;
}

export function AccountClient() {
  const [ready, setReady] = useState(false);
  const [accountsEnabled, setAccountsEnabled] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setAccountsEnabled(Boolean(data.accountsEnabled));
      setUser(data.user ?? null);
    } catch {
      setAccountsEnabled(false);
    } finally {
      setReady(true);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [presetsResponse, historyResponse] = await Promise.all([
        fetch('/api/presets'),
        fetch('/api/history'),
      ]);
      if (presetsResponse.ok) setPresets((await presetsResponse.json()).presets ?? []);
      if (historyResponse.ok) setHistory((await historyResponse.json()).history ?? []);
    } catch {
      // Nothing to show is a valid state; leave the lists empty.
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (user) void loadData();
  }, [user, loadData]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Something went wrong.');
        return;
      }
      setUser(data.user);
      setPassword('');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setPresets([]);
    setHistory([]);
  };

  const deletePreset = async (id: string) => {
    const response = await fetch(`/api/presets/${id}`, { method: 'DELETE' });
    if (response.ok) setPresets((current) => current.filter((preset) => preset.id !== id));
  };

  if (!ready) {
    return (
      <div className="panel" style={{ marginTop: '2.5rem' }}>
        <span className="faint">Checking your session…</span>
      </div>
    );
  }

  if (!accountsEnabled) {
    return (
      <div className="stack" style={{ paddingTop: '2.5rem', maxWidth: 680 }}>
        <h1>Accounts are not configured here.</h1>
        <div className="notice">
          This deployment has no database attached, so presets cannot sync. Everything else works
          exactly as it does otherwise — the processor has never depended on an account.
        </div>
        <p className="muted">
          To enable them, set <code>DATABASE_URL</code> to a Postgres connection string (Neon is
          what the hosted build uses) and redeploy. The schema creates itself on first use.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="stack" style={{ paddingTop: '2.5rem', maxWidth: 460 }}>
        <div>
          <h1 style={{ marginBottom: '0.6rem' }}>
            {mode === 'login' ? 'Sign in' : 'Create an account'}
          </h1>
          <p className="muted" style={{ fontSize: '0.92rem' }}>
            An account saves your settings, not your audio. There is nowhere for a waveform to go
            here — see <a href="/privacy">privacy</a> for exactly what is stored.
          </p>
        </div>

        <form className="panel stack-sm" onSubmit={submit}>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {mode === 'register' && (
              <span className="faint">At least 10 characters.</span>
            )}
          </div>

          {error && <div className="notice notice-error">{error}</div>}

          <div className="btn-row">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
            >
              {mode === 'login' ? 'Need an account?' : 'Already have one?'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="stack" style={{ paddingTop: '2.5rem', maxWidth: 820 }}>
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Signed in</span>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
        <p className="mono" style={{ marginBottom: 0 }}>
          {user.email}
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Saved presets</span>
          <span className="faint mono">{presets.length}</span>
        </div>
        {presets.length === 0 ? (
          <p className="faint" style={{ marginBottom: 0 }}>
            Nothing saved yet. Presets you save in the studio appear here.
          </p>
        ) : (
          <div className="stack-sm">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="btn-row"
                style={{ justifyContent: 'space-between', alignItems: 'baseline' }}
              >
                <span>
                  <strong>{preset.name}</strong>{' '}
                  <span className="faint mono">
                    {preset.kind}
                    {preset.source_name ? ` · ${preset.source_name}` : ''}
                  </span>
                </span>
                <button className="btn-ghost" onClick={() => deletePreset(preset.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Last three renders</span>
          <span className="faint">Settings only — never the audio</span>
        </div>
        {history.length === 0 ? (
          <p className="faint" style={{ marginBottom: 0 }}>
            No renders recorded yet.
          </p>
        ) : (
          <div className="stack-sm">
            {history.map((entry) => (
              <div key={entry.id} className="readout">
                <span className="readout-item">
                  <strong>{entry.source_name ?? 'Untitled'}</strong>
                </span>
                <span className="readout-item">
                  <span className="readout-label">Mode</span>
                  <strong>{entry.kind}</strong>
                </span>
                {entry.sample_rate && (
                  <span className="readout-item">
                    <span className="readout-label">Rate</span>
                    <strong>{(entry.sample_rate / 1000).toFixed(1)} kHz</strong>
                  </span>
                )}
                <span className="readout-item">
                  <span className="readout-label">When</span>
                  <strong>{new Date(entry.created_at).toLocaleString()}</strong>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
