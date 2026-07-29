'use client';

import { useCallback, useRef } from 'react';
import { FONT_LABEL, FONT_MONO, shade } from './theme';

export interface KnobProps {
  label: string;
  /** Normalised position, 0–1. */
  value: number;
  onChange: (value: number) => void;
  size?: number;
  variant?: 'chicken' | 'alu' | 'glossy';
  accent?: string;
  knobFace?: string;
  pointer?: string;
  ink?: string;
  /** Renders the value readout; receives the normalised position. */
  format?: (value: number) => string;
  /** Position restored by a double-click. prd.md §6. */
  resetValue?: number;
  title?: string;
}

/**
 * Rotary control.
 *
 * Interaction follows prd.md §6: vertical drag, Shift for fine, double-click to
 * reset. Pointer capture is on `window` rather than the element so a fast drag
 * that leaves the knob keeps tracking instead of sticking — the single most
 * noticeable difference between a control that feels like hardware and one that
 * feels like a web page.
 */
export function Knob({
  label,
  value,
  onChange,
  size = 52,
  variant = 'glossy',
  accent = '#e8c94f',
  knobFace = '#23262d',
  pointer,
  ink = '#c8cdd6',
  format,
  resetValue = 0.5,
  title,
}: KnobProps) {
  const start = useRef({ y: 0, v: 0 });

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      start.current = { y: event.clientY, v: value };

      const move = (moveEvent: PointerEvent) => {
        // 160 px for full travel, 640 with Shift held for fine adjustment.
        const travel = moveEvent.shiftKey ? 640 : 160;
        const delta = (start.current.y - moveEvent.clientY) / travel;
        onChange(Math.min(1, Math.max(0, start.current.v + delta)));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [value, onChange],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.005 : 0.02;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      onChange(Math.min(1, value + step));
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      onChange(Math.max(0, value - step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      onChange(resetValue);
    }
  };

  const a0 = -135;
  const a1 = 135;
  const angle = a0 + (a1 - a0) * value;
  const pad = 7;
  const box = size + pad * 2;
  const centre = box / 2;
  const arcR = centre - 2;

  const polar = (deg: number): [number, number] => {
    const r = ((deg - 90) * Math.PI) / 180;
    return [centre + arcR * Math.cos(r), centre + arcR * Math.sin(r)];
  };
  const [sx, sy] = polar(a0);
  const [tx, ty] = polar(a1);
  const [ex, ey] = polar(angle);
  const large = angle - a0 > 180 ? 1 : 0;
  const pointerColour = pointer || accent;

  let body: React.CSSProperties;
  if (variant === 'alu') {
    body = {
      background: `conic-gradient(from 90deg, ${shade(knobFace, 25)}, ${shade(
        knobFace,
        -30,
      )}, ${shade(knobFace, 30)}, ${shade(knobFace, -25)}, ${shade(knobFace, 25)})`,
    };
  } else if (variant === 'chicken') {
    body = {
      background: `radial-gradient(circle at 38% 30%, ${shade(knobFace, 30)}, ${knobFace} 55%, ${shade(
        knobFace,
        -45,
      )})`,
    };
  } else {
    body = {
      background: `radial-gradient(circle at 36% 26%, ${shade(knobFace, 55)}, ${knobFace} 48%, ${shade(
        knobFace,
        -50,
      )} 95%)`,
    };
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        userSelect: 'none',
        touchAction: 'none',
        width: box + 6,
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onDoubleClick={() => onChange(resetValue)}
        onKeyDown={onKeyDown}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Number(value.toFixed(3))}
        aria-valuetext={format ? format(value) : `${Math.round(value * 100)}`}
        title={title ?? label}
        style={{ position: 'relative', width: box, height: box, cursor: 'ns-resize' }}
      >
        <svg width={box} height={box} style={{ position: 'absolute', inset: 0 }}>
          <path
            d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 1 1 ${tx} ${ty}`}
            fill="none"
            stroke="rgba(128,128,136,.28)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 ${large} 1 ${ex} ${ey}`}
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${accent})` }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: pad - 3,
            top: pad - 3,
            width: size + 6,
            height: size + 6,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 50% 35%, rgba(0,0,0,.12), rgba(0,0,0,.45))',
            boxShadow: '0 5px 12px rgba(0,0,0,.4)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: pad,
            top: pad,
            width: size,
            height: size,
            borderRadius: '50%',
            ...body,
            boxShadow:
              'inset 0 1px 2px rgba(255,255,255,.28), inset 0 -3px 6px rgba(0,0,0,.4)',
            transform: `rotate(${angle}deg)`,
          }}
        >
          {variant === 'chicken' ? (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: -5,
                width: 11,
                height: size * 0.62,
                marginLeft: -5.5,
                background: `linear-gradient(180deg, ${shade(knobFace, 22)}, ${shade(
                  knobFace,
                  -18,
                )})`,
                clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
                borderRadius: 2,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 3,
                  width: 2,
                  height: 13,
                  marginLeft: -1,
                  background: pointerColour,
                  borderRadius: 1,
                }}
              />
            </div>
          ) : (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: size * 0.08,
                width: 3.5,
                height: size * 0.36,
                marginLeft: -1.75,
                background: pointerColour,
                borderRadius: 2,
              }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          fontFamily: FONT_LABEL,
          fontSize: 9,
          letterSpacing: 1.4,
          color: ink,
          fontWeight: 700,
          textAlign: 'center',
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: ink, opacity: 0.6 }}>
        {format ? format(value) : Math.round(value * 100)}
      </div>
    </div>
  );
}
