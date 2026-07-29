'use client';

import { FONT_LABEL, FONT_MONO, Theme } from './theme';

/**
 * Splash / About — prd.md §3.4.
 *
 * Shown once per session on open and reopened from the ABOUT button. All copy
 * lives in the constants below so it can be edited in one place, which is what
 * §3.4 asks for.
 */

export const PRODUCT_NAME = 'TRANSBAND';
export const PRODUCT_SUBTITLE = 'multiTransBender';
export const VERSION_BADGE = 'v0.1b · BETA';

export const TAGLINE = [
  'Dreamed up, designed, and willed into existence',
  'by the twisted minds at TRANSBAND',
];

export const CREDITS = [
  {
    name: 'SERGIO DIMOFF',
    role: 'Ideas & Inspiration · The Plugin He Actually Needed',
    tags: 'musician · DJ · record miner',
  },
  {
    name: 'CARLOS “LOS” FRANZETTI',
    role: 'Loop Engineer · Part-Time Phantom · Chief Loser of Things',
    tags: 'musician · synthetics · bike missile · app builder · perpetually late · occasionally M.I.A.',
  },
];

export const FOOTNOTE =
  'original "inspired-by" artwork · engines modeled on classic hardware · no valves were harmed';

export function AboutScreen({ onClose, theme }: { onClose: () => void; theme: Theme }) {
  const accent = theme.accent;
  const credit = (name: string, role: string, tags: string) => (
    <div
      key={name}
      style={{
        padding: '14px 18px',
        borderRadius: 10,
        background: 'rgba(255,255,255,.04)',
        border: `1px solid ${accent}2e`,
        textAlign: 'left',
      }}
    >
      <div
        style={{
          fontFamily: FONT_LABEL,
          fontWeight: 800,
          fontSize: 16,
          letterSpacing: 1.5,
          color: '#efece2',
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: FONT_LABEL,
          fontSize: 11,
          letterSpacing: 1,
          color: accent,
          marginTop: 3,
          fontWeight: 700,
        }}
      >
        {role}
      </div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9.5,
          color: '#8a93a0',
          marginTop: 6,
          lineHeight: 1.7,
        }}
      >
        {tags}
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="About TRANSBAND"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(1200px 800px at 50% 30%, #1c1f27, #07080a 75%)',
        padding: 18,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT_LABEL,
              fontWeight: 800,
              fontSize: 42,
              letterSpacing: 9,
              color: '#efece2',
              textShadow: `0 0 40px ${accent}40, 0 3px 6px rgba(0,0,0,.7)`,
            }}
          >
            TRANS<span style={{ color: accent }}>BAND</span>
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              letterSpacing: 4,
              color: '#8a93a0',
              marginTop: 4,
            }}
          >
            {PRODUCT_SUBTITLE}
          </div>
          <div
            style={{
              display: 'inline-block',
              marginTop: 10,
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              letterSpacing: 2,
              color: accent,
              border: `1px solid ${accent}66`,
              borderRadius: 20,
              padding: '4px 14px',
            }}
          >
            {VERSION_BADGE}
          </div>
        </div>

        <div
          style={{
            height: 1,
            background:
              `linear-gradient(90deg, transparent, ${accent}59, transparent)`,
          }}
        />

        <div
          style={{
            fontFamily: FONT_LABEL,
            fontSize: 13,
            letterSpacing: 1.5,
            color: '#aab1bc',
            lineHeight: 1.7,
          }}
        >
          {TAGLINE[0]}
          <br />
          by the twisted minds at{' '}
          <span style={{ color: accent, fontWeight: 800 }}>{PRODUCT_NAME}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {CREDITS.map((c) => credit(c.name, c.role, c.tags))}
        </div>

        <button
          onClick={onClose}
          autoFocus
          style={{
            alignSelf: 'center',
            marginTop: 4,
            fontFamily: FONT_LABEL,
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: 3,
            padding: '12px 44px',
            borderRadius: 8,
            cursor: 'pointer',
            border: `1px solid ${accent}`,
            background: theme.accentGrad,
            color: theme.accentText,
            boxShadow: `0 0 30px ${accent}4d, inset 0 1px 0 rgba(255,255,255,.35)`,
          }}
        >
          ENTER THE RACK
        </button>

        <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: '#4a5260' }}>{FOOTNOTE}</div>
      </div>
    </div>
  );
}
