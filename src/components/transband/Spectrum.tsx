'use client';

import { useMemo, useRef } from 'react';
import { BandParams } from '@/dsp/types';
import { bandColor } from '@/dsp/devices';
import { FONT_LABEL, FONT_MONO, Theme, fmtHz } from './theme';

/**
 * ENGINE view spectrum — prd.md §3.1, tdd.md §6.2.
 *
 * Interactions:
 *  · click within ~18 px of the curve  → add a band split at that frequency
 *  · click a numbered node or a region → select that band
 *  · drag a crossover handle           → move the split
 *
 * The curve is the real averaged spectrum of the loaded file, not a decorative
 * one. Placing a crossover is a decision about the material, so the display has
 * to show the material.
 */

const W = 940;
const H = 340;
const PADL = 34;
const PADR = 12;
const PADT = 14;
const PADB = 26;
const PW = W - PADL - PADR;
const PH = H - PADT - PADB;

export const fToX = (f: number) => PADL + (Math.log10(f / 20) / 3) * PW;
export const xToF = (x: number) => 20 * Math.pow(10, ((x - PADL) / PW) * 3);

/** Map a dB magnitude to a y coordinate. -6 dB at the top, -84 at the bottom. */
function dbToY(db: number): number {
  const top = -6;
  const bottom = -84;
  const t = Math.min(1, Math.max(0, (top - db) / (top - bottom)));
  return PADT + PH * (0.06 + t * 0.88);
}

export interface SpectrumProps {
  theme: Theme;
  /** Averaged spectrum in dB, log-spaced 20 Hz–20 kHz. Null before a file loads. */
  spectrum: Float32Array | null;
  crossovers: number[];
  bands: BandParams[];
  selected: number;
  maxBands: number;
  onSelect: (index: number) => void;
  onAddAt: (freq: number) => void;
  onMoveCrossover: (index: number, freq: number) => void;
}

export function Spectrum({
  theme,
  spectrum,
  crossovers,
  bands,
  selected,
  maxBands,
  onSelect,
  onAddAt,
  onMoveCrossover,
}: SpectrumProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);
  const edges = [20, ...crossovers, 20000];

  const curve = useMemo(() => {
    if (!spectrum || spectrum.length === 0) {
      return { line: '', area: '', at: () => PADT + PH * 0.6 };
    }
    const points: Array<[number, number]> = [];
    for (let i = 0; i < spectrum.length; i++) {
      const f = 20 * Math.pow(10, (i / spectrum.length) * 3);
      points.push([fToX(f), dbToY(spectrum[i])]);
    }
    const line = points
      .map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' ');
    const area = `${line} L ${fToX(20000)} ${PADT + PH} L ${fToX(20)} ${PADT + PH} Z`;

    const at = (f: number) => {
      const idx = Math.round((Math.log10(Math.max(f, 20) / 20) / 3) * spectrum.length);
      return dbToY(spectrum[Math.min(Math.max(idx, 0), spectrum.length - 1)]);
    };
    return { line, area, at };
  }, [spectrum]);

  const clientToPoint = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  };

  const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (dragging.current !== null) return;
    const { x, y } = clientToPoint(event);
    if (x < PADL + 6 || x > W - PADR - 6) return;

    const freq = xToF(x);
    // Ignore clicks that land on a crossover handle; that is a drag target.
    if (crossovers.some((c) => Math.abs(fToX(c) - x) < 12)) return;

    if (Math.abs(y - curve.at(freq)) < 18 && bands.length < maxBands) {
      onAddAt(freq);
      return;
    }
    const idx = crossovers.findIndex((c) => freq < c);
    onSelect(idx === -1 ? bands.length - 1 : idx);
  };

  const startDrag = (index: number) => (event: React.PointerEvent) => {
    event.stopPropagation();
    event.preventDefault();
    dragging.current = index;

    const move = (moveEvent: PointerEvent) => {
      const { x } = clientToPoint(moveEvent);
      onMoveCrossover(index, xToF(Math.min(W - PADR - 8, Math.max(PADL + 8, x))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      // Cleared on the next tick so the click that ends the drag is swallowed.
      setTimeout(() => {
        dragging.current = null;
      }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      style={{
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow:
          theme.id === 'dark'
            ? 'inset 0 2px 10px rgba(0,0,0,.7)'
            : 'inset 0 2px 8px rgba(0,0,0,.15), 0 1px 0 rgba(255,255,255,.6)',
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', width: '100%', background: theme.specBg, cursor: 'crosshair' }}
        onClick={handleClick}
        role="group"
        aria-label="Spectrum and band editor"
      >
        {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((f) => (
          <g key={f}>
            <line x1={fToX(f)} x2={fToX(f)} y1={PADT} y2={PADT + PH} stroke={theme.specGrid} />
            <text
              x={fToX(f)}
              y={H - 8}
              fill={theme.specTick}
              fontSize="9"
              fontFamily={FONT_MONO}
              textAnchor="middle"
            >
              {fmtHz(f)}
            </text>
          </g>
        ))}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={PADL}
            x2={W - PADR}
            y1={PADT + PH * t}
            y2={PADT + PH * t}
            stroke={theme.specGrid2}
          />
        ))}

        {bands.map((band, i) => {
          const x0 = fToX(edges[i]);
          const x1 = fToX(edges[i + 1]);
          const colour = bandColor(i);
          const isSelected = i === selected;
          // Attack solid, sustain dashed — prd.md §3.1. Normalised against the
          // control ranges so the marker heights mean the same thing on both.
          const attackY = PADT + PH * (0.5 - (band.attackDb / 15) * 0.4);
          const sustainY = PADT + PH * (0.5 - (band.sustainDb / 24) * 0.4);
          return (
            <g key={i}>
              <rect
                x={x0}
                y={PADT}
                width={x1 - x0}
                height={PH}
                fill={colour}
                opacity={band.on ? (isSelected ? 0.16 : 0.07) : 0.02}
              />
              {isSelected && <rect x={x0} y={PADT} width={x1 - x0} height={3} fill={colour} />}
              {band.on && (
                <>
                  <line
                    x1={x0 + 5}
                    x2={x1 - 5}
                    y1={attackY}
                    y2={attackY}
                    stroke={colour}
                    strokeWidth={isSelected ? 2.2 : 1.4}
                  />
                  <line
                    x1={x0 + 5}
                    x2={x1 - 5}
                    y1={sustainY}
                    y2={sustainY}
                    stroke={colour}
                    strokeWidth="1.2"
                    strokeDasharray="5 4"
                    opacity="0.7"
                  />
                </>
              )}
            </g>
          );
        })}

        {curve.line && (
          <>
            <path d={curve.area} fill={theme.specArea} pointerEvents="none" />
            <path
              d={curve.line}
              fill="none"
              stroke={theme.specLine}
              strokeWidth="1.7"
              pointerEvents="none"
            />
          </>
        )}
        {!curve.line && (
          <text
            x={W / 2}
            y={PADT + PH / 2}
            fill={theme.hint}
            fontSize="12"
            fontFamily={FONT_MONO}
            textAnchor="middle"
          >
            load a file to see its spectrum
          </text>
        )}

        {bands.map((band, i) => {
          const centre = Math.sqrt(edges[i] * edges[i + 1]);
          const colour = bandColor(i);
          const isSelected = i === selected;
          return (
            <g
              key={`node-${i}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(i);
              }}
              style={{ cursor: 'pointer' }}
            >
              {isSelected && (
                <circle
                  cx={fToX(centre)}
                  cy={curve.at(centre)}
                  r={13}
                  fill="none"
                  stroke={colour}
                  strokeWidth="1.4"
                  opacity="0.65"
                />
              )}
              <circle
                cx={fToX(centre)}
                cy={curve.at(centre)}
                r={isSelected ? 8.5 : 6.5}
                fill={band.on ? colour : '#7a7f88'}
                stroke={theme.nodeStroke}
                strokeWidth="2"
                style={isSelected ? { filter: `drop-shadow(0 0 8px ${colour})` } : undefined}
              />
              <text
                x={fToX(centre)}
                y={curve.at(centre) + 3.5}
                fill={theme.nodeStroke}
                fontSize="9"
                fontWeight="800"
                fontFamily={FONT_LABEL}
                textAnchor="middle"
                pointerEvents="none"
              >
                {i + 1}
              </text>
            </g>
          );
        })}

        {crossovers.map((c, i) => {
          const x = fToX(c);
          return (
            <g key={`xover-${i}`} onPointerDown={startDrag(i)} style={{ cursor: 'ew-resize' }}>
              <line
                x1={x}
                x2={x}
                y1={PADT}
                y2={PADT + PH}
                stroke={theme.xover}
                strokeWidth="1.3"
                opacity="0.8"
              />
              <rect x={x - 10} y={PADT} width={20} height={PH} fill="transparent" />
              <rect
                x={x - 15}
                y={PADT + PH - 20}
                width={30}
                height={16}
                rx={3}
                fill={theme.xoverTag}
                stroke={theme.xoverTagBorder}
              />
              <text
                x={x}
                y={PADT + PH - 8}
                fill={theme.xoverText}
                fontSize="8.5"
                fontFamily={FONT_MONO}
                textAnchor="middle"
              >
                {fmtHz(c)}
              </text>
              <rect x={x - 4.5} y={PADT + 2} width={9} height={9} rx={2} fill={theme.xover} />
            </g>
          );
        })}

        <text
          x={W - PADR - 4}
          y={PADT + 14}
          fill={theme.hint}
          fontSize="8.5"
          fontFamily={FONT_MONO}
          textAnchor="end"
        >
          {bands.length < maxBands ? 'click ON the line → new band' : `max ${maxBands} bands`} ·
          click node/region → select · drag handles
        </text>
      </svg>
    </div>
  );
}
