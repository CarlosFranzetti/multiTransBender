'use client';

import { Chain, LatencyMode, OversampleFactor, Precision } from '@/dsp/types';
import { FONT_LABEL, FONT_MONO, Theme } from './theme';

/**
 * Quality preferences — prd.md §3.5.
 *
 * The PDC readout is the *plugin's* latency for these settings, not the
 * renderer's. Offline there is none: lookahead is a read-ahead and the
 * linear-phase filters are non-causal. Showing the figure anyway keeps the two
 * builds comparable, and it is labelled so nobody mistakes it for a cost they
 * are paying here.
 */

const OVERSAMPLE_OPTIONS: Array<{ label: string; value: OversampleFactor }> = [
  { label: 'OFF', value: 1 },
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
  { label: '8×', value: 8 },
  { label: '16×', value: 16 },
];

const LATENCY_OPTIONS: Array<{ label: string; value: LatencyMode; hint: string }> = [
  { label: 'ZERO', value: 'zero', hint: 'IIR crossovers · minimum phase · no added latency' },
  { label: 'BALANCED', value: 'balanced', hint: 'IIR + fixed detector lookahead · small PDC' },
  { label: 'HQ LINEAR', value: 'hq-linear', hint: 'linear-phase FIR · exact band reconstruction' },
];

export interface PrefsBarProps {
  theme: Theme;
  chain: Chain;
  onChange: (chain: Chain) => void;
  /** Latency the plugin would report for these settings, in samples. */
  pdcSamples: number;
}

export function PrefsBar({ theme, chain, onChange, pdcSamples }: PrefsBarProps) {
  const segment = <T,>(
    options: Array<{ label: string; value: T }>,
    current: T,
    onPick: (value: T) => void,
    groupLabel: string,
  ) => (
    <div
      role="group"
      aria-label={groupLabel}
      style={{
        display: 'flex',
        background: theme.segBg,
        border: `1px solid ${theme.segBorder}`,
        borderRadius: 5,
        overflow: 'hidden',
      }}
    >
      {options.map((option) => {
        const active = option.value === current;
        return (
          <button
            key={option.label}
            onClick={() => onPick(option.value)}
            aria-pressed={active}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              padding: '6px 10px',
              cursor: 'pointer',
              border: 'none',
              background: active ? theme.accentGrad : 'transparent',
              color: active ? theme.accentText : theme.segText,
              fontWeight: active ? 700 : 400,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  const label = (text: string) => (
    <span
      style={{
        fontFamily: FONT_LABEL,
        fontSize: 9,
        letterSpacing: 2,
        color: theme.sub,
        fontWeight: 800,
      }}
    >
      {text}
    </span>
  );

  const activeLatency = LATENCY_OPTIONS.find((o) => o.value === chain.latencyMode);

  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '10px 16px',
        background: theme.barBg,
        borderRadius: 8,
        border: `1px solid ${theme.barBorder}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {label('PRECISION')}
        {segment<Precision>(
          [
            { label: '32-BIT', value: 32 },
            { label: '64-BIT', value: 64 },
          ],
          chain.precision,
          (precision) => onChange({ ...chain, precision }),
          'Internal precision',
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {label('OVERSAMPLING')}
        {segment<OversampleFactor>(
          OVERSAMPLE_OPTIONS,
          chain.oversample,
          (oversample) => onChange({ ...chain, oversample }),
          'Oversampling factor',
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {label('LATENCY MODE')}
        {segment<LatencyMode>(
          LATENCY_OPTIONS,
          chain.latencyMode,
          (latencyMode) => onChange({ ...chain, latencyMode }),
          'Latency mode',
        )}
      </div>

      <div
        style={{
          marginLeft: 'auto',
          fontFamily: FONT_MONO,
          fontSize: 9,
          color: theme.sub,
          textAlign: 'right',
          lineHeight: 1.6,
        }}
      >
        {chain.bands.length} band{chain.bands.length === 1 ? '' : 's'} · plugin PDC{' '}
        {pdcSamples} smp · offline render 0
        <br />
        {activeLatency?.hint}
      </div>
    </div>
  );
}
