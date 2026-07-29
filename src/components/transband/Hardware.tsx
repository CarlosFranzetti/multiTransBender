'use client';

import { DeviceModel } from '@/dsp/devices';
import { Knob } from './Knob';
import { FONT_LABEL, FONT_MONO, isDarkFace, shade, textureCSS } from './theme';

/**
 * Hardware furniture for the PANEL and RACK 3D views.
 *
 * These are original "inspired-by" panels per prd.md §9 — original names,
 * original artwork, no real brand marks. Colours and layout are transcribed from
 * the canonical mockup; the shading is deliberately theme-independent so a
 * faceplate reads as a physical object in both light and dark chrome.
 */

export const Screw = () => (
  <div
    style={{
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 32% 28%, #b5b5b5, #5a5a5a 55%, #2e2e2e)',
      boxShadow: 'inset 0 -1px 2px rgba(0,0,0,.65)',
      position: 'relative',
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 2.5,
        bottom: 2.5,
        width: 1.6,
        marginLeft: -0.8,
        background: '#1c1c1c',
        transform: 'rotate(35deg)',
      }}
    />
  </div>
);

export function Toggle({
  label,
  on,
  onClick,
  ink,
  accent,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  ink: string;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        cursor: 'pointer',
        userSelect: 'none',
        background: 'none',
        border: 'none',
        padding: 0,
      }}
    >
      <div
        style={{
          width: 20,
          height: 36,
          borderRadius: 10,
          background: 'linear-gradient(180deg,#0c0c0e,#26262a)',
          boxShadow: 'inset 0 2px 5px rgba(0,0,0,.8)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 3,
            width: 14,
            height: 14,
            borderRadius: '50%',
            top: on ? 3 : 19,
            transition: 'top .12s ease',
            background: 'radial-gradient(circle at 35% 30%, #e8e8e8, #8a8a8a 65%, #4a4a4a)',
            boxShadow: '0 2px 4px rgba(0,0,0,.6)',
          }}
        />
      </div>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: on ? accent : '#2c2c2e',
            boxShadow: on ? `0 0 6px ${accent}` : 'none',
          }}
        />
        <span
          style={{
            fontFamily: FONT_LABEL,
            fontSize: 8,
            letterSpacing: 1.1,
            fontWeight: 700,
            color: ink,
            opacity: 0.85,
          }}
        >
          {label}
        </span>
      </span>
    </button>
  );
}

export function VUMeter({ level = 0.6 }: { level?: number }) {
  const angle = -44 + 88 * Math.min(1, Math.max(0, level));
  return (
    <div
      style={{
        width: 96,
        height: 62,
        borderRadius: 5,
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(110px 66px at 50% 120%, #ffe9a8, #f3e3ae 40%, #e2cf8e)',
        border: '4px solid #141414',
        boxShadow: 'inset 0 0 12px rgba(90,60,10,.45), 0 2px 5px rgba(0,0,0,.5)',
      }}
    >
      <svg width="88" height="54" style={{ position: 'absolute', left: 0, top: 3 }}>
        <path d="M 12 42 A 38 38 0 0 1 76 42" fill="none" stroke="#6e5c2e" strokeWidth="1.3" />
        <path d="M 61 22 A 38 38 0 0 1 76 42" fill="none" stroke="#b23a2e" strokeWidth="2.4" />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 6,
          width: 1.8,
          height: 42,
          marginLeft: -0.9,
          background: '#1a1a1a',
          transformOrigin: 'bottom center',
          transform: `rotate(${angle}deg)`,
          transition: 'transform .35s cubic-bezier(.3,1.4,.5,1)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 1,
          width: '100%',
          textAlign: 'center',
          fontFamily: FONT_LABEL,
          fontSize: 7,
          letterSpacing: 3,
          color: '#5a4a24',
          fontWeight: 700,
        }}
      >
        VU
      </div>
    </div>
  );
}

export function LEDMeter({ level = 0.6 }: { level?: number }) {
  const segments = 12;
  const lit = Math.round(Math.min(1, Math.max(0, level)) * segments);
  const colourAt = (i: number) =>
    i >= segments - 2 ? '#e0473d' : i >= segments - 5 ? '#e8c94f' : '#43c96e';
  return (
    <div
      style={{
        display: 'flex',
        gap: 2.5,
        padding: 5,
        borderRadius: 4,
        background: '#0a0b0d',
        boxShadow: 'inset 0 1px 4px rgba(0,0,0,.8)',
      }}
    >
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 15,
            borderRadius: 1.5,
            background: i < lit ? colourAt(i) : '#1c1e22',
            boxShadow: i < lit ? `0 0 5px ${colourAt(i)}` : 'none',
          }}
        />
      ))}
    </div>
  );
}

export interface DeviceFaceProps {
  device: DeviceModel;
  values: number[];
  setValue: (index: number, value: number) => void;
  switches: boolean[];
  setSwitch: (index: number) => void;
  compact?: boolean;
  /** 0–1 drive level for the meter. */
  meterLevel?: number;
}

export function DeviceFace({
  device,
  values,
  setValue,
  switches,
  setSwitch,
  compact = false,
  meterLevel,
}: DeviceFaceProps) {
  const dark = isDarkFace(device.face);
  const level = meterLevel ?? 0.22 + (values[0] ?? 0.5) * 0.6;

  return (
    <div
      style={{
        minHeight: compact ? 170 : 200,
        padding: compact ? '12px 18px' : '16px 24px 14px',
        position: 'relative',
        ...textureCSS(device.texture, device.face, dark),
        boxShadow: 'inset 0 2px 1px rgba(255,255,255,.18), inset 0 -3px 8px rgba(0,0,0,.35)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              fontFamily: FONT_LABEL,
              fontWeight: 800,
              fontSize: 23,
              letterSpacing: 3,
              color: device.ink,
              textShadow: dark ? '0 1px 0 rgba(0,0,0,.6)' : '0 1px 0 rgba(255,255,255,.5)',
            }}
          >
            {device.name}
          </div>
          <div
            style={{
              fontFamily: FONT_LABEL,
              fontSize: 9.5,
              letterSpacing: 2.2,
              color: device.ink,
              opacity: 0.6,
              fontWeight: 700,
            }}
          >
            {device.sub}
          </div>
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 8,
            letterSpacing: 1,
            color: device.ink,
            opacity: 0.4,
          }}
        >
          TRANSBAND
        </div>
      </div>

      <div
        style={{
          height: 2,
          marginBottom: 12,
          background: `linear-gradient(90deg, transparent, ${
            dark ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.18)'
          }, transparent)`,
          boxShadow: `0 1px 0 ${dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.5)'}`,
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {device.params.map((param, i) => (
          <Knob
            key={param}
            label={param}
            value={values[i] ?? 0.5}
            onChange={(v) => setValue(i, v)}
            variant={device.knob}
            knobFace={device.knobFace}
            pointer={device.pointer}
            accent={device.accent}
            ink={device.ink}
            size={compact ? 46 : 54}
          />
        ))}
        <div style={{ display: 'flex', gap: 12 }}>
          {device.switches.map((label, i) => (
            <Toggle
              key={label}
              label={label}
              on={switches[i] ?? false}
              onClick={() => setSwitch(i)}
              ink={device.ink}
              accent={device.accent}
            />
          ))}
        </div>
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
        >
          {device.meter === 'vu' ? <VUMeter level={level} /> : <LEDMeter level={level} />}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#e0473d',
                boxShadow: '0 0 7px #e0473d',
              }}
            />
            <span
              style={{
                fontFamily: FONT_LABEL,
                fontSize: 8,
                letterSpacing: 2,
                color: device.ink,
                opacity: 0.7,
                fontWeight: 700,
              }}
            >
              POWER
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RackEars({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', filter: 'drop-shadow(0 14px 28px rgba(0,0,0,.4))' }}>
      <div
        style={{
          width: 28,
          borderRadius: '5px 0 0 5px',
          background: 'linear-gradient(90deg,#060607,#232326 70%,#17171a)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
        }}
      >
        <Screw />
        <Screw />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <div
        style={{
          width: 28,
          borderRadius: '0 5px 5px 0',
          background: 'linear-gradient(90deg,#17171a,#232326 30%,#060607)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
        }}
      >
        <Screw />
        <Screw />
      </div>
    </div>
  );
}

/**
 * RACK 3D top plate.
 *
 * Pseudo-3D via a CSS perspective transform rather than a GL scene — tdd.md
 * §6.1 calls for exactly this. It stays cheap, it stays fully interactive, and
 * the valves glow.
 */
export function TopPlate({ device }: { device: DeviceModel }) {
  const dark = isDarkFace(device.face);
  const plate = dark ? shade(device.face, 6) : shade(device.face, -6);

  return (
    <div
      style={{
        height: 190,
        margin: '0 28px',
        transformOrigin: 'bottom center',
        transform: 'perspective(950px) rotateX(58deg)',
        background: `repeating-linear-gradient(0deg, rgba(0,0,0,.10) 0 2px, transparent 2px 9px), linear-gradient(180deg, ${shade(
          plate,
          dark ? -18 : -26,
        )}, ${plate})`,
        borderRadius: '6px 6px 0 0',
        position: 'relative',
        boxShadow: 'inset 0 3px 8px rgba(0,0,0,.35), inset 0 -2px 3px rgba(255,255,255,.1)',
        borderLeft: '1px solid rgba(0,0,0,.4)',
        borderRight: '1px solid rgba(0,0,0,.4)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '8%',
          right: '40%',
          top: '16%',
          bottom: '22%',
          background:
            'repeating-linear-gradient(90deg, rgba(0,0,0,.45) 0 5px, transparent 5px 14px)',
          borderRadius: 4,
          opacity: 0.5,
        }}
      />
      {Array.from({ length: device.tubes }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${14 + i * 11}%`,
            top: '30%',
            width: 26,
            height: 46,
            borderRadius: '50% 50% 40% 40%',
            background:
              'radial-gradient(circle at 50% 65%, #ffb75e, #e0632e 55%, rgba(120,30,10,.6))',
            boxShadow: '0 0 26px rgba(255,140,60,.75), 0 0 60px rgba(255,120,40,.35)',
            opacity: 0.9,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          right: '7%',
          top: '18%',
          width: '20%',
          height: '52%',
          background: 'linear-gradient(180deg,#26262a,#141416)',
          borderRadius: 5,
          boxShadow: '0 6px 14px rgba(0,0,0,.5)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '18% 22%',
            background: 'repeating-linear-gradient(0deg,#3a3a40 0 3px,#222226 3px 6px)',
            borderRadius: 3,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: '8%',
          bottom: '6%',
          fontFamily: FONT_MONO,
          fontSize: 9,
          letterSpacing: 2,
          color: dark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.4)',
        }}
      >
        TRANSBAND · {device.name} · TB-{device.id.toUpperCase().slice(0, 4)}-0001
      </div>
    </div>
  );
}

export function Rack3D(props: DeviceFaceProps) {
  return (
    <div style={{ padding: '6px 0 0' }}>
      <TopPlate device={props.device} />
      <RackEars>
        <DeviceFace {...props} compact />
      </RackEars>
      <div
        style={{
          height: 26,
          margin: '0 40px',
          background: 'radial-gradient(60% 100% at 50% 0%, rgba(0,0,0,.4), transparent 70%)',
        }}
      />
    </div>
  );
}
