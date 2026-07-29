'use client';

import { DEVICES, bandColor, getDevice } from '@/dsp/devices';
import {
  ATTACK_RANGE_DB,
  BandParams,
  OUTPUT_RANGE_DB,
  SUSTAIN_RANGE_DB,
} from '@/dsp/types';
import { Knob } from './Knob';
import { FONT_LABEL, FONT_MONO, Theme, fmtHz, shade } from './theme';

/** Maps a bipolar dB control to and from the knob's 0–1 position. */
const toNorm = (db: number, range: number) => (db / range + 1) / 2;
const fromNorm = (value: number, range: number) => (value * 2 - 1) * range;

function EnvelopeMini({
  theme,
  attackDb,
  sustainDb,
  colour,
}: {
  theme: Theme;
  attackDb: number;
  sustainDb: number;
  colour: string;
}) {
  const build = (a: number, s: number) => {
    const points: string[] = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const env = Math.exp(-t * 6) * (1 + a * 0.9) + Math.exp(-t * 1.4) * 0.35 * (1 + s * 1.2);
      points.push(`${i * 2.3},${64 - Math.min(1.18, env) * 50}`);
    }
    return points.join(' ');
  };

  return (
    <svg
      width="230"
      height="72"
      style={{
        display: 'block',
        background: theme.envBg,
        borderRadius: 8,
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,.25)',
      }}
      aria-hidden
    >
      {[18, 36, 54].map((y) => (
        <line key={y} x1="0" x2="230" y1={y} y2={y} stroke={theme.specGrid2} />
      ))}
      <polyline
        points={build(0, 0)}
        fill="none"
        stroke={theme.specLine}
        strokeWidth="1.3"
        strokeDasharray="4 3"
        opacity="0.55"
      />
      <polyline
        points={build(attackDb / ATTACK_RANGE_DB, sustainDb / SUSTAIN_RANGE_DB)}
        fill="none"
        stroke={colour}
        strokeWidth="2"
        style={{ filter: `drop-shadow(0 0 4px ${colour}99)` }}
      />
      <text x="8" y="13" fill={theme.sub} fontSize="7.5" fontFamily={FONT_MONO}>
        BAND ENVELOPE
      </text>
    </svg>
  );
}

export interface BandPanelProps {
  theme: Theme;
  band: BandParams;
  index: number;
  crossovers: number[];
  update: (band: BandParams) => void;
}

/**
 * Controls for the selected band.
 *
 * Three groups matching prd.md §3.1: TRANSIENT, SATURATION ENGINE, BAND OUT.
 * Every band carries a full set — that independence is the product, so the panel
 * never implies a control is shared.
 */
export function BandPanel({ theme, band, index, crossovers, update }: BandPanelProps) {
  const colour = bandColor(index);
  const edges = [20, ...crossovers, 20000];
  const device = getDevice(band.deviceId);
  const ink = theme.text;

  const groupLabel = (text: string, tint?: string) => (
    <div
      style={{
        fontFamily: FONT_LABEL,
        fontSize: 9,
        letterSpacing: 2.5,
        color: tint || theme.sub,
        fontWeight: 800,
        marginBottom: 8,
      }}
    >
      {text}
    </div>
  );

  return (
    <div
      style={{
        background: theme.panelBg,
        borderRadius: 10,
        padding: '14px 18px',
        border: `1px solid ${colour}55`,
        borderTop: `3px solid ${colour}`,
        boxShadow: `0 10px 24px rgba(0,0,0,.2), 0 0 30px ${colour}10`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontFamily: FONT_LABEL,
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: 2,
            color: colour,
          }}
        >
          BAND {index + 1}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: theme.sub }}>
          {fmtHz(edges[index])}–{fmtHz(edges[index + 1])} Hz · independent transient + saturation
          chain
        </div>
      </div>

      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          {groupLabel('TRANSIENT', colour)}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Knob
              label="ATTACK"
              value={toNorm(band.attackDb, ATTACK_RANGE_DB)}
              onChange={(v) => update({ ...band, attackDb: fromNorm(v, ATTACK_RANGE_DB) })}
              accent={colour}
              knobFace={theme.knobFace}
              ink={ink}
              format={(v) => `${fromNorm(v, ATTACK_RANGE_DB).toFixed(1)} dB`}
              title="Onset shaping. Threshold-free: it reacts to envelope divergence, not level."
            />
            <Knob
              label="SUSTAIN"
              value={toNorm(band.sustainDb, SUSTAIN_RANGE_DB)}
              onChange={(v) => update({ ...band, sustainDb: fromNorm(v, SUSTAIN_RANGE_DB) })}
              accent={colour}
              knobFace={theme.knobFace}
              ink={ink}
              format={(v) => `${fromNorm(v, SUSTAIN_RANGE_DB).toFixed(1)} dB`}
              title="Decay tail shaping."
            />
            <Knob
              label="DETAIL"
              value={band.detail}
              onChange={(v) => update({ ...band, detail: v })}
              accent="#5f93d0"
              knobFace={theme.knobFace}
              ink={ink}
              resetValue={0}
              format={(v) => `${Math.round(v * 100)}%`}
              title="HF-weighted transient path. Snap without a broadband attack boost."
            />
            <EnvelopeMini
              theme={theme}
              attackDb={band.attackDb}
              sustainDb={band.sustainDb}
              colour={colour}
            />
          </div>
        </div>

        <div>
          {groupLabel('SATURATION ENGINE', device.accent)}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginRight: 6 }}>
              <select
                value={band.deviceId}
                onChange={(event) => update({ ...band, deviceId: event.target.value })}
                aria-label={`Band ${index + 1} saturation engine`}
                style={{
                  background: theme.ctrlBg,
                  color: theme.ctrlText,
                  border: `1px solid ${device.accent}66`,
                  borderRadius: 5,
                  padding: '7px 9px',
                  fontFamily: FONT_LABEL,
                  fontSize: 12,
                  minWidth: 150,
                }}
              >
                {DEVICES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: device.accent, opacity: 0.9 }}>
                {device.sub.toLowerCase()}
              </div>
            </div>
            <Knob
              label="DRIVE"
              value={band.drive}
              onChange={(v) => update({ ...band, drive: v })}
              accent={device.accent}
              knobFace={theme.knobFace}
              ink={ink}
              resetValue={0.4}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <Knob
              label="CHARACTER"
              value={band.character}
              onChange={(v) => update({ ...band, character: v })}
              accent={device.accent}
              knobFace={theme.knobFace}
              ink={ink}
              format={(v) => `${Math.round(v * 100)}%`}
              title={device.characterLabel}
            />
            <Knob
              label="SAT MIX"
              value={band.satMix}
              onChange={(v) => update({ ...band, satMix: v })}
              accent={theme.text}
              knobFace={theme.knobFace}
              ink={ink}
              resetValue={0.7}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 8,
              color: theme.sub,
              marginTop: 6,
              maxWidth: 340,
            }}
          >
            CHARACTER → {device.characterLabel.toLowerCase()}
          </div>
        </div>

        <div>
          {groupLabel('BAND OUT')}
          <div style={{ display: 'flex', gap: 6 }}>
            <Knob
              label="MIX"
              value={band.mix}
              onChange={(v) => update({ ...band, mix: v })}
              accent={theme.text}
              knobFace={theme.knobFace}
              ink={ink}
              resetValue={1}
              format={(v) => `${Math.round(v * 100)}%`}
              title="Parallel blend of the whole band chain against the untouched band."
            />
            <Knob
              label="OUTPUT"
              value={toNorm(band.outputDb, OUTPUT_RANGE_DB)}
              onChange={(v) => update({ ...band, outputDb: fromNorm(v, OUTPUT_RANGE_DB) })}
              accent={theme.text}
              knobFace={theme.knobFace}
              ink={ink}
              format={(v) => `${fromNorm(v, OUTPUT_RANGE_DB).toFixed(1)} dB`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const chipButton = (theme: Theme, on: boolean, colour: string): React.CSSProperties => ({
  fontFamily: FONT_LABEL,
  fontSize: 8.5,
  fontWeight: 800,
  letterSpacing: 1,
  padding: '3px 7px',
  borderRadius: 4,
  cursor: 'pointer',
  background: on ? `linear-gradient(180deg, ${colour}, ${shade(colour, -35)})` : theme.segBg,
  color: on ? '#fff' : theme.segText,
  border: `1px solid ${on ? colour : theme.segBorder}`,
});

export interface BandChipsProps {
  theme: Theme;
  bands: BandParams[];
  crossovers: number[];
  selected: number;
  onSelect: (index: number) => void;
  onToggle: (index: number) => void;
  onSolo: (index: number) => void;
  onRemove: (index: number) => void;
}

export function BandChips({
  theme,
  bands,
  crossovers,
  selected,
  onSelect,
  onToggle,
  onSolo,
  onRemove,
}: BandChipsProps) {
  const edges = [20, ...crossovers, 20000];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {bands.map((band, i) => {
        const colour = bandColor(i);
        const isSelected = i === selected;
        const device = getDevice(band.deviceId);
        return (
          <div
            key={i}
            onClick={() => onSelect(i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              background: isSelected
                ? `linear-gradient(180deg, ${colour}30, ${colour}12)`
                : theme.chipBg,
              border: `1px solid ${isSelected ? colour : theme.chipBorder}`,
              opacity: band.on ? 1 : 0.55,
            }}
          >
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: colour }} />
            <div>
              <div
                style={{
                  fontFamily: FONT_LABEL,
                  fontWeight: 800,
                  fontSize: 11.5,
                  letterSpacing: 1.2,
                  color: isSelected ? colour : theme.chipText,
                }}
              >
                BAND {i + 1}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: theme.sub }}>
                {fmtHz(edges[i])}–{fmtHz(edges[i + 1])} · {device.name}
              </div>
            </div>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onSolo(i);
              }}
              style={chipButton(theme, band.solo, '#d9a92f')}
              title="Solo this band"
            >
              S
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggle(i);
              }}
              style={chipButton(theme, band.on, colour)}
            >
              {band.on ? 'ON' : 'OFF'}
            </button>
            {bands.length > 1 && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(i);
                }}
                style={{ ...chipButton(theme, false, '#e0473d'), padding: '2px 7px' }}
                title="Remove band (merges into its neighbour)"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
