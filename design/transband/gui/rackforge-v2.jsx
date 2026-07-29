import React, { useState, useRef, useCallback } from "react";

/* ============================================================
   RACKFORGE v0.2 — Polished GUI preview
   PANEL VIEW: distinct "inspired-by" hardware skins, layered
   3D shading. ENGINE VIEW: uniform multiband interface.
   Panel artwork is original — engines modeled on referenced HW.
   ============================================================ */

const FONT_LABEL = "'Avenir Next Condensed','Arial Narrow','Helvetica Neue',sans-serif";
const FONT_MONO = "'SF Mono','JetBrains Mono',Menlo,monospace";

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (x) => Math.min(255, Math.max(0, x + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

/* ---------------- DEVICE DEFINITIONS ---------------- */
const DEVICES = [
  {
    id: "vulture", name: "VULTURE", sub: "TWIN VALVE DISTORTION", makerTag: "thermionic-style",
    face: "#e3dac0", ink: "#33291a", accent: "#a5322b",
    texture: "powder", knob: "chicken", knobFace: "#a5322b", pointer: "#f2e9d4",
    meter: "vu", meterCount: 2,
    switches: [{ l: "TRIODE / PENTODE", on: true }, { l: "OVERDRIVE", on: false }],
    params: [
      { l: "DRIVE", v: 0.55 }, { l: "BIAS", v: 0.42 }, { l: "DISTORTION", v: 0.3 },
      { l: "FILTER", v: 0.7 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "fatso", name: "PHATSO 7x", sub: "TAPE SIM / OPTIMIZER", makerTag: "empirical-style",
    face: "#17181c", ink: "#dfe3ea", accent: "#43c96e",
    texture: "anodized", knob: "alu", knobFace: "#d9dade", pointer: "#17181c",
    meter: "led", meterCount: 2,
    switches: [{ l: "TRANNY IN", on: true }, { l: "WARMTH", on: true }],
    params: [
      { l: "INPUT", v: 0.6 }, { l: "TRANNY", v: 0.5 }, { l: "WARMTH", v: 0.45 },
      { l: "SPANK", v: 0.35 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "hg2", name: "HG·II", sub: "PENTODE + TRIODE SATURATOR", makerTag: "blackbox-style",
    face: "#0d0d12", ink: "#e8dcba", accent: "#d3a24a",
    texture: "anodized", knob: "glossy", knobFace: "#1e1e26", pointer: "#d3a24a",
    meter: "vu", meterCount: 1,
    switches: [{ l: "AIR", on: true }, { l: "ALT TUBE", on: false }],
    params: [
      { l: "PENTODE", v: 0.5 }, { l: "TRIODE", v: 0.4 }, { l: "SATURATION", v: 0.55 },
      { l: "DENSITY", v: 0.3 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "vitalizer", name: "REVITALIZER", sub: "PROGRAM EQ · TUBE STAGE", makerTag: "spl-style",
    face: "#2b3d55", ink: "#e4ebf5", accent: "#8db9e8",
    texture: "brushed", knob: "alu", knobFace: "#c7ccd6", pointer: "#1a2230",
    meter: "led", meterCount: 1,
    switches: [{ l: "TUBE IN", on: true }, { l: "WIDE", on: true }],
    params: [
      { l: "DRIVE", v: 0.4 }, { l: "MID-HI TUNE", v: 0.6 }, { l: "BASS", v: 0.5 },
      { l: "INTENSITY", v: 0.45 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "portico", name: "P·542", sub: "TAPE EMULATION · SILK", makerTag: "rnd-style",
    face: "#363a41", ink: "#ece9e2", accent: "#c33b36",
    texture: "brushed", knob: "glossy", knobFace: "#b8352f", pointer: "#f4f1ea",
    meter: "led", meterCount: 1,
    switches: [{ l: "SILK RED", on: true }, { l: "SILK BLUE", on: false }],
    params: [
      { l: "TRIM", v: 0.5 }, { l: "SATURATION", v: 0.5 }, { l: "TEXTURE", v: 0.45 },
      { l: "SOFTEN", v: 0.3 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "glats1", name: "WIZARD TS·1", sub: "STEREO TUBE SATURATOR", makerTag: "gainlab-style",
    face: "#1c1e23", ink: "#ecdcc0", accent: "#e0913c",
    texture: "anodized", knob: "chicken", knobFace: "#141519", pointer: "#e0913c",
    meter: "vu", meterCount: 2,
    switches: [{ l: "XFMR OUT", on: true }, { l: "HI-Z", on: false }],
    params: [
      { l: "TUBE DRIVE", v: 0.55 }, { l: "TRANSFORMER", v: 0.5 }, { l: "BLEND", v: 0.65 },
      { l: "TONE", v: 0.5 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "boum", name: "BØM", sub: "ANALOG WARMING PROCESSOR", makerTag: "oto-style",
    face: "#efece3", ink: "#26262b", accent: "#e0574f",
    texture: "powder", knob: "glossy", knobFace: "#2a2a30", pointer: "#efece3",
    meter: "led", meterCount: 1,
    switches: [{ l: "DIRT", on: false }, { l: "GLUE", on: true }],
    params: [
      { l: "WARM", v: 0.5 }, { l: "DRIVE", v: 0.4 }, { l: "LPF", v: 0.8 },
      { l: "SQUASH", v: 0.35 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "sa2rate", name: "SA²RATE", sub: "EVEN-HARMONIC SATURATION", makerTag: "looptrotter-style",
    face: "#f0e3c6", ink: "#3c301c", accent: "#d97c25",
    texture: "powder", knob: "chicken", knobFace: "#3c301c", pointer: "#f0e3c6",
    meter: "led", meterCount: 2,
    switches: [{ l: "MORE", on: false }, { l: "SOFT CLIP", on: true }],
    params: [
      { l: "SATURATION", v: 0.55 }, { l: "EVEN / ODD", v: 0.4 }, { l: "MIX", v: 0.7 },
      { l: "TRIM", v: 0.5 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "carnaby", name: "CARNABY", sub: "HARMONIC EQ", makerTag: "cranborne-style",
    face: "#23262c", ink: "#ece6d8", accent: "#e0524d",
    texture: "brushed", knob: "glossy", knobFace: "#15171b", pointer: "#e0524d",
    meter: "led", meterCount: 1,
    switches: [{ l: "SAT LINK", on: true }, { l: "HPF", on: false }],
    params: [
      { l: "LF SAT", v: 0.45 }, { l: "MF SAT", v: 0.4 }, { l: "HF SAT", v: 0.5 },
      { l: "DRIVE", v: 0.5 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "overstayer", name: "M·A·S", sub: "MODULAR HARMONICS / DENSITY", makerTag: "overstayer-style",
    face: "#1a1a1a", ink: "#f0e9d8", accent: "#f2b02c",
    texture: "anodized", knob: "alu", knobFace: "#2a2a2a", pointer: "#f2b02c",
    meter: "led", meterCount: 2,
    switches: [{ l: "FET / DIODE", on: true }, { l: "TIGHT LF", on: false }],
    params: [
      { l: "RATIO", v: 0.5 }, { l: "HARMONICS", v: 0.55 }, { l: "DENSITY", v: 0.4 },
      { l: "FILTER", v: 0.6 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
];

const BAND_DEFS = [
  { id: "low", name: "LOW", range: "20–180 Hz", color: "#e0574f" },
  { id: "lomid", name: "LO MID", range: "180–900 Hz", color: "#e0913c" },
  { id: "himid", name: "HI MID", range: "0.9–5 kHz", color: "#e8c94f" },
  { id: "high", name: "HIGH", range: "5–20 kHz", color: "#8db9e8" },
];

/* ---------------- KNOB (layered 3D) ---------------- */
function Knob({ label, value, onChange, size = 56, variant = "glossy", knobFace = "#1c1c22", pointer = "#eee", accent = "#e8c94f", ink = "#cfcfcf", format, showArc = true }) {
  const start = useRef({ y: 0, v: 0 });
  const down = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    start.current = { y: e.clientY, v: value };
    const move = (ev) => onChange(Math.min(1, Math.max(0, start.current.v + (start.current.y - ev.clientY) / 160)));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [value, onChange]);

  const a0 = -135, a1 = 135, ang = a0 + (a1 - a0) * value;
  const pad = 7, box = size + pad * 2, cr = box / 2, arcR = cr - 2;
  const polar = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cr + arcR * Math.cos(rad), cr + arcR * Math.sin(rad)];
  };
  const [sx, sy] = polar(a0), [tx, ty] = polar(a1), [ex, ey] = polar(ang);
  const large = ang - a0 > 180 ? 1 : 0;

  /* body layers per variant */
  let body, cap;
  if (variant === "alu") {
    body = { background: `conic-gradient(from 90deg, ${shade(knobFace, 25)}, ${shade(knobFace, -30)}, ${shade(knobFace, 30)}, ${shade(knobFace, -25)}, ${shade(knobFace, 25)})` };
    cap = { inset: "18%", background: `radial-gradient(circle at 35% 28%, ${shade(knobFace, 40)}, ${knobFace} 60%, ${shade(knobFace, -35)})` };
  } else if (variant === "chicken") {
    body = { background: `radial-gradient(circle at 38% 30%, ${shade(knobFace, 30)}, ${knobFace} 55%, ${shade(knobFace, -45)})` };
    cap = null;
  } else {
    body = { background: `radial-gradient(circle at 36% 26%, ${shade(knobFace, 55)}, ${knobFace} 48%, ${shade(knobFace, -50)} 95%)` };
    cap = { inset: "30%", background: `radial-gradient(circle at 40% 32%, rgba(255,255,255,.35), rgba(255,255,255,0) 55%)` };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, userSelect: "none", touchAction: "none", width: box + 8 }}>
      <div onPointerDown={down} style={{ position: "relative", width: box, height: box, cursor: "ns-resize" }}>
        {showArc && (
          <svg width={box} height={box} style={{ position: "absolute", inset: 0 }}>
            <path d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 1 1 ${tx} ${ty}`} fill="none" stroke="rgba(120,120,130,.22)" strokeWidth="2.5" strokeLinecap="round" />
            <path d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 ${large} 1 ${ex} ${ey}`} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${accent})` }} />
          </svg>
        )}
        {/* skirt / base shadow */}
        <div style={{
          position: "absolute", left: pad - 3, top: pad - 3, width: size + 6, height: size + 6, borderRadius: "50%",
          background: "radial-gradient(circle at 50% 35%, rgba(0,0,0,.15), rgba(0,0,0,.55))",
          boxShadow: "0 6px 14px rgba(0,0,0,.55), 0 2px 4px rgba(0,0,0,.5)",
        }} />
        {/* body */}
        <div style={{
          position: "absolute", left: pad, top: pad, width: size, height: size, borderRadius: "50%",
          ...body,
          boxShadow: "inset 0 1px 2px rgba(255,255,255,.28), inset 0 -3px 6px rgba(0,0,0,.45)",
          transform: `rotate(${ang}deg)`,
        }}>
          {cap && <div style={{ position: "absolute", borderRadius: "50%", ...cap }} />}
          {variant === "chicken" ? (
            <div style={{
              position: "absolute", left: "50%", top: -5, width: 11, height: size * 0.62, marginLeft: -5.5,
              background: `linear-gradient(180deg, ${shade(knobFace, 22)}, ${shade(knobFace, -18)})`,
              clipPath: "polygon(50% 0, 100% 100%, 0 100%)", borderRadius: 2,
              boxShadow: "0 1px 2px rgba(0,0,0,.4)",
            }}>
              <div style={{ position: "absolute", left: "50%", top: 3, width: 2, height: 13, marginLeft: -1, background: pointer, borderRadius: 1 }} />
            </div>
          ) : (
            <div style={{
              position: "absolute", left: "50%", top: size * 0.08, width: 3.5, height: size * 0.36, marginLeft: -1.75,
              background: pointer, borderRadius: 2, boxShadow: `0 0 4px rgba(0,0,0,.4)`,
            }} />
          )}
        </div>
      </div>
      <div style={{ fontFamily: FONT_LABEL, fontSize: 9.5, letterSpacing: 1.6, color: ink, fontWeight: 700, textAlign: "center", textShadow: "0 1px 0 rgba(0,0,0,.25)" }}>{label}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: ink, opacity: 0.6 }}>{format ? format(value) : Math.round(value * 100)}</div>
    </div>
  );
}

/* ---------------- HARDWARE BITS ---------------- */
const Screw = () => (
  <div style={{
    width: 12, height: 12, borderRadius: "50%",
    background: "radial-gradient(circle at 32% 28%, #b5b5b5, #5a5a5a 55%, #2e2e2e)",
    boxShadow: "inset 0 -1px 2px rgba(0,0,0,.65), 0 1px 1px rgba(255,255,255,.08)",
    position: "relative",
  }}>
    <div style={{ position: "absolute", left: "50%", top: 2.5, bottom: 2.5, width: 1.6, marginLeft: -0.8, background: "#1c1c1c", transform: "rotate(35deg)", borderRadius: 1 }} />
  </div>
);

function Toggle({ label, on, onClick, ink, accent }) {
  return (
    <div onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", userSelect: "none" }}>
      <div style={{
        width: 22, height: 40, borderRadius: 11,
        background: "linear-gradient(180deg, #0c0c0e, #26262a)",
        boxShadow: "inset 0 2px 5px rgba(0,0,0,.8), 0 1px 0 rgba(255,255,255,.08)",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", left: 3, width: 16, height: 16, borderRadius: "50%",
          top: on ? 3 : 21, transition: "top .12s ease",
          background: "radial-gradient(circle at 35% 30%, #e8e8e8, #8a8a8a 65%, #4a4a4a)",
          boxShadow: "0 2px 4px rgba(0,0,0,.6)",
        }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: on ? accent : "#2c2c2e", boxShadow: on ? `0 0 6px ${accent}` : "inset 0 1px 2px rgba(0,0,0,.7)" }} />
        <span style={{ fontFamily: FONT_LABEL, fontSize: 8.5, letterSpacing: 1.2, fontWeight: 700, color: ink, opacity: 0.85 }}>{label}</span>
      </div>
    </div>
  );
}

function VUMeter({ level = 0.6 }) {
  const ang = -44 + 88 * level;
  return (
    <div style={{
      width: 104, height: 68, borderRadius: 5, position: "relative", overflow: "hidden",
      background: "radial-gradient(120px 70px at 50% 120%, #ffe9a8, #f3e3ae 40%, #e2cf8e)",
      border: "4px solid #141414",
      boxShadow: "inset 0 0 14px rgba(90,60,10,.45), 0 2px 5px rgba(0,0,0,.5), inset 0 2px 3px rgba(255,255,255,.4)",
    }}>
      <svg width="96" height="60" style={{ position: "absolute", left: 0, top: 3 }}>
        <path d="M 13 46 A 42 42 0 0 1 83 46" fill="none" stroke="#6e5c2e" strokeWidth="1.4" />
        <path d="M 66 24 A 42 42 0 0 1 83 46" fill="none" stroke="#b23a2e" strokeWidth="2.6" />
        {[-40, -25, -10, 5, 22, 40].map((d, i) => {
          const r = ((d - 90) * Math.PI) / 180;
          return <line key={i} x1={48 + 36 * Math.cos(r)} y1={50 + 36 * Math.sin(r)} x2={48 + 42 * Math.cos(r)} y2={50 + 42 * Math.sin(r)} stroke="#6e5c2e" strokeWidth="1" />;
        })}
      </svg>
      <div style={{
        position: "absolute", left: "50%", bottom: 7, width: 1.8, height: 46, marginLeft: -0.9,
        background: "linear-gradient(180deg,#111,#3a3a3a)", transformOrigin: "bottom center",
        transform: `rotate(${ang}deg)`, transition: "transform .35s cubic-bezier(.3,1.4,.5,1)",
        boxShadow: "1px 0 2px rgba(0,0,0,.3)",
      }} />
      <div style={{ position: "absolute", bottom: 2, width: "100%", textAlign: "center", fontFamily: FONT_LABEL, fontSize: 7.5, letterSpacing: 3, color: "#5a4a24", fontWeight: 700 }}>VU</div>
    </div>
  );
}

function LEDMeter({ level = 0.6, vertical = false }) {
  const segs = 12;
  const lit = Math.round(level * segs);
  const colorAt = (i) => (i >= segs - 2 ? "#e0473d" : i >= segs - 5 ? "#e8c94f" : "#43c96e");
  return (
    <div style={{
      display: "flex", flexDirection: vertical ? "column-reverse" : "row", gap: 2.5,
      padding: 5, borderRadius: 4, background: "#0a0b0d",
      boxShadow: "inset 0 1px 4px rgba(0,0,0,.8), 0 1px 0 rgba(255,255,255,.06)",
    }}>
      {Array.from({ length: segs }).map((_, i) => (
        <div key={i} style={{
          width: vertical ? 14 : 7, height: vertical ? 5 : 16, borderRadius: 1.5,
          background: i < lit ? colorAt(i) : "#1c1e22",
          boxShadow: i < lit ? `0 0 5px ${colorAt(i)}` : "none",
        }} />
      ))}
    </div>
  );
}

/* ---------------- PANEL TEXTURES ---------------- */
const textureCSS = (t, face, dark) => {
  const base = `linear-gradient(180deg, ${shade(face, dark ? 14 : 8)}, ${face} 30%, ${shade(face, dark ? -8 : -16)})`;
  if (t === "brushed") return {
    background: `repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, rgba(0,0,0,.045) 1px 2px), ${base}`,
  };
  if (t === "anodized") return {
    background: `radial-gradient(700px 200px at 50% -60%, rgba(255,255,255,.10), rgba(255,255,255,0) 60%), ${base}`,
  };
  return { /* powder coat */
    background: `radial-gradient(500px 240px at 30% -40%, rgba(255,255,255,.22), rgba(255,255,255,0) 55%), ${base}`,
  };
};

/* ---------------- DEVICE PANEL ---------------- */
function DevicePanel({ device, values, setValue, switches, setSwitch }) {
  const dark = parseInt(device.face.slice(1, 3), 16) < 110;
  const driveLevel = values[0];
  return (
    <div style={{ display: "flex", filter: "drop-shadow(0 14px 28px rgba(0,0,0,.55))" }}>
      {/* left rack ear */}
      <div style={{
        width: 30, borderRadius: "5px 0 0 5px",
        background: "linear-gradient(90deg, #060607, #232326 70%, #17171a)",
        display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: "12px 0",
        boxShadow: "inset -2px 0 4px rgba(0,0,0,.5)",
      }}><Screw /><Screw /></div>

      {/* faceplate */}
      <div style={{
        flex: 1, minHeight: 210, padding: "18px 26px 16px", position: "relative",
        ...textureCSS(device.texture, device.face, dark),
        boxShadow: "inset 0 2px 1px rgba(255,255,255,.18), inset 0 -3px 8px rgba(0,0,0,.35)",
      }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div style={{
              fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 26, letterSpacing: 3, color: device.ink,
              textShadow: dark ? "0 1px 0 rgba(0,0,0,.6), 0 -1px 0 rgba(255,255,255,.08)" : "0 1px 0 rgba(255,255,255,.5), 0 -1px 0 rgba(0,0,0,.15)",
            }}>{device.name}</div>
            <div style={{ fontFamily: FONT_LABEL, fontSize: 10, letterSpacing: 2.4, color: device.ink, opacity: 0.62, fontWeight: 700 }}>{device.sub}</div>
          </div>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 8.5, color: device.ink, opacity: 0.5,
            border: `1px solid ${device.ink}33`, borderRadius: 3, padding: "3px 8px",
          }}>{device.makerTag}</div>
        </div>

        {/* engraved divider */}
        <div style={{ height: 2, marginBottom: 16, background: `linear-gradient(90deg, transparent, ${dark ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.18)"}, transparent)`, boxShadow: `0 1px 0 ${dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.5)"}` }} />

        {/* controls row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          {device.params.map((p, i) => (
            <Knob key={p.l} label={p.l} value={values[i]} onChange={(v) => setValue(i, v)}
              variant={device.knob} knobFace={device.knobFace} pointer={device.pointer}
              accent={device.accent} ink={device.ink} size={58} />
          ))}

          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {device.switches.map((s, i) => (
              <Toggle key={s.l} label={s.l} on={switches[i]} onClick={() => setSwitch(i)} ink={device.ink} accent={device.accent} />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {device.meter === "vu" ? (
              <div style={{ display: "flex", gap: 8 }}>
                {Array.from({ length: device.meterCount }).map((_, i) => (
                  <VUMeter key={i} level={0.22 + driveLevel * 0.6 + i * 0.04} />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {Array.from({ length: device.meterCount }).map((_, i) => (
                  <LEDMeter key={i} level={0.25 + driveLevel * 0.6 - i * 0.06} />
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e0473d", boxShadow: "0 0 7px #e0473d" }} />
              <span style={{ fontFamily: FONT_LABEL, fontSize: 8.5, letterSpacing: 2, color: device.ink, opacity: 0.7, fontWeight: 700 }}>POWER</span>
            </div>
          </div>
        </div>
      </div>

      {/* right rack ear */}
      <div style={{
        width: 30, borderRadius: "0 5px 5px 0",
        background: "linear-gradient(90deg, #17171a, #232326 30%, #060607)",
        display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: "12px 0",
        boxShadow: "inset 2px 0 4px rgba(0,0,0,.5)",
      }}><Screw /><Screw /></div>
    </div>
  );
}

/* ---------------- TRANSIENT DISPLAY ---------------- */
function TransientDisplay({ attack, sustain }) {
  const a = (attack - 0.5) * 2, s = (sustain - 0.5) * 2;
  const mk = (aa, ss) => {
    const pts = [];
    for (let i = 0; i <= 110; i++) {
      const t = i / 110;
      const env = Math.exp(-t * 6) * (1 + aa * 0.9) + Math.exp(-t * 1.4) * 0.35 * (1 + ss * 1.2);
      pts.push(`${i * 2.9},${76 - Math.min(1.18, env) * 60}`);
    }
    return pts.join(" ");
  };
  return (
    <div style={{ borderRadius: 8, overflow: "hidden", boxShadow: "inset 0 2px 8px rgba(0,0,0,.7), 0 1px 0 rgba(255,255,255,.06)" }}>
      <svg width="320" height="84" style={{ display: "block", background: "linear-gradient(180deg,#07090c,#0d1015)" }}>
        {[21, 42, 63].map((y) => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="rgba(140,160,190,.06)" />)}
        {[64, 128, 192, 256].map((x) => <line key={x} x1={x} x2={x} y1="0" y2="84" stroke="rgba(140,160,190,.05)" />)}
        <polyline points={mk(0, 0)} fill="none" stroke="rgba(141,185,232,.4)" strokeWidth="1.4" strokeDasharray="4 3" />
        <polyline points={mk(a, s)} fill="none" stroke="#e8c94f" strokeWidth="2.2" style={{ filter: "drop-shadow(0 0 4px rgba(232,201,79,.7))" }} />
        <text x="10" y="15" fill="#5f6b7a" fontSize="8" fontFamily={FONT_MONO}>ENVELOPE · gold = shaped · blue = dry</text>
      </svg>
    </div>
  );
}

/* ---------------- ENGINE VIEW ---------------- */
function EngineView({ bands, setBand, trans, setTrans }) {
  const ink = "#c8cdd6";
  const section = {
    background: "linear-gradient(180deg,#1b1e24,#141519)", borderRadius: 10, padding: "16px 20px",
    border: "1px solid #2b2f38",
    boxShadow: "0 10px 24px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.05)",
  };
  const secLabel = (t) => (
    <div style={{ fontFamily: FONT_LABEL, fontSize: 10, letterSpacing: 3, color: "#6d7684", fontWeight: 800, marginBottom: 12 }}>{t}</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={section}>
        {secLabel("TRANSIENT ENGINE")}
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <TransientDisplay attack={trans.attack} sustain={trans.sustain} />
          <Knob label="ATTACK" value={trans.attack} onChange={(v) => setTrans({ ...trans, attack: v })} accent="#e8c94f" knobFace="#23262d" pointer="#e8c94f" ink={ink} format={(v) => `${((v - 0.5) * 30).toFixed(1)} dB`} />
          <Knob label="SUSTAIN" value={trans.sustain} onChange={(v) => setTrans({ ...trans, sustain: v })} accent="#e8c94f" knobFace="#23262d" pointer="#e8c94f" ink={ink} format={(v) => `${((v - 0.5) * 48).toFixed(1)} dB`} />
          <Knob label="DETAIL" value={trans.detail} onChange={(v) => setTrans({ ...trans, detail: v })} accent="#8db9e8" knobFace="#23262d" pointer="#8db9e8" ink={ink} />
          <Knob label="MIX" value={trans.mix} onChange={(v) => setTrans({ ...trans, mix: v })} accent="#c8cdd6" knobFace="#23262d" pointer="#c8cdd6" ink={ink} format={(v) => `${Math.round(v * 100)}%`} />
          <Knob label="OUTPUT" value={trans.output} onChange={(v) => setTrans({ ...trans, output: v })} accent="#c8cdd6" knobFace="#23262d" pointer="#c8cdd6" ink={ink} format={(v) => `${((v - 0.5) * 24).toFixed(1)} dB`} />
        </div>
      </div>

      <div style={section}>
        {secLabel("MULTIBAND SATURATION — INDEPENDENT ENGINE PER BAND")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
          {bands.map((b, i) => {
            const dev = DEVICES.find((d) => d.id === b.device);
            const def = BAND_DEFS[i];
            return (
              <div key={def.id} style={{
                background: "linear-gradient(180deg,#101216,#0d0f13)",
                border: `1px solid ${b.on ? def.color + "44" : "#22252b"}`,
                borderTop: `3px solid ${b.on ? def.color : "#33363d"}`,
                borderRadius: 8, padding: "12px 14px",
                boxShadow: b.on ? `0 6px 18px rgba(0,0,0,.4), 0 0 24px ${def.color}14` : "0 6px 18px rgba(0,0,0,.4)",
                opacity: b.on ? 1 : 0.65, transition: "opacity .15s ease",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                  <div>
                    <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 14, letterSpacing: 2, color: b.on ? def.color : "#5a5f68" }}>{def.name}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: "#5a6572" }}>{def.range}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setBand(i, { ...b, solo: !b.solo })} style={miniBtn(b.solo, "#e8c94f")}>S</button>
                    <button onClick={() => setBand(i, { ...b, on: !b.on })} style={miniBtn(b.on, def.color)}>{b.on ? "ON" : "OFF"}</button>
                  </div>
                </div>
                <select value={b.device} onChange={(e) => setBand(i, { ...b, device: e.target.value })} style={{
                  width: "100%", background: "#181b21", color: "#e6e2d6", border: "1px solid #2c3038",
                  borderRadius: 5, padding: "7px 9px", fontFamily: FONT_LABEL, fontSize: 12.5, letterSpacing: 0.5, marginBottom: 10,
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,.5)",
                }}>
                  {DEVICES.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.sub.toLowerCase()}</option>)}
                </select>
                <div style={{ display: "flex", justifyContent: "space-around" }}>
                  <Knob label="DRIVE" value={b.drive} onChange={(v) => setBand(i, { ...b, drive: v })} size={42} accent={dev.accent} knobFace="#23262d" pointer={dev.accent} ink="#9aa1ac" />
                  <Knob label="CHAR" value={b.character} onChange={(v) => setBand(i, { ...b, character: v })} size={42} accent={dev.accent} knobFace="#23262d" pointer={dev.accent} ink="#9aa1ac" />
                  <Knob label="MIX" value={b.mix} onChange={(v) => setBand(i, { ...b, mix: v })} size={42} accent="#c8cdd6" knobFace="#23262d" pointer="#c8cdd6" ink="#9aa1ac" format={(v) => `${Math.round(v * 100)}%`} />
                </div>
                <div style={{ marginTop: 10 }}><LEDMeter level={b.on ? 0.2 + b.drive * 0.65 : 0} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const miniBtn = (on, color) => ({
  fontFamily: FONT_LABEL, fontSize: 9, fontWeight: 800, letterSpacing: 1,
  padding: "4px 9px", borderRadius: 4, cursor: "pointer",
  background: on ? `linear-gradient(180deg, ${color}, ${shade(color, -35)})` : "linear-gradient(180deg,#1c1f25,#14161a)",
  color: on ? "#0d0f12" : "#6b7480",
  border: `1px solid ${on ? color : "#2c3038"}`,
  boxShadow: on ? `0 0 10px ${color}44, inset 0 1px 0 rgba(255,255,255,.35)` : "inset 0 1px 0 rgba(255,255,255,.04)",
});

/* ---------------- PREFS ---------------- */
function PrefsBar({ prefs, setPrefs }) {
  const seg = (opts, key) => (
    <div style={{ display: "flex", background: "#0d0f13", border: "1px solid #2a2e36", borderRadius: 5, overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,.5)" }}>
      {opts.map((o) => (
        <button key={o} onClick={() => setPrefs({ ...prefs, [key]: o })} style={{
          fontFamily: FONT_MONO, fontSize: 9.5, padding: "6px 10px", cursor: "pointer", border: "none",
          background: prefs[key] === o ? "linear-gradient(180deg,#f2d868,#d9b53a)" : "transparent",
          color: prefs[key] === o ? "#14161a" : "#8a93a0", fontWeight: prefs[key] === o ? 700 : 400,
          boxShadow: prefs[key] === o ? "inset 0 1px 0 rgba(255,255,255,.5)" : "none",
        }}>{o}</button>
      ))}
    </div>
  );
  const lbl = (t) => <span style={{ fontFamily: FONT_LABEL, fontSize: 9, letterSpacing: 2, color: "#5f6774", fontWeight: 800 }}>{t}</span>;
  return (
    <div style={{
      display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", padding: "10px 16px",
      background: "linear-gradient(180deg,#111318,#0c0e11)", borderRadius: 8, border: "1px solid #23262e",
      boxShadow: "0 6px 16px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04)",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{lbl("PRECISION")}{seg(["32-BIT", "64-BIT"], "precision")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{lbl("OVERSAMPLING")}{seg(["OFF", "2×", "4×", "8×", "16×"], "os")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{lbl("LATENCY MODE")}{seg(["ZERO", "BALANCED", "HQ LINEAR"], "latency")}</div>
      <div style={{ marginLeft: "auto", fontFamily: FONT_MONO, fontSize: 9, color: "#5a6572", textAlign: "right" }}>
        PDC {prefs.latency === "ZERO" ? "0" : prefs.latency === "BALANCED" ? "64" : "2048"} smp<br />
        {prefs.precision} float · {prefs.os} OS
      </div>
    </div>
  );
}

/* ---------------- APP ---------------- */
export default function RackForge() {
  const [view, setView] = useState("panel");
  const [activeDevice, setActiveDevice] = useState("vulture");
  const [vals, setVals] = useState(() => Object.fromEntries(DEVICES.map((d) => [d.id, d.params.map((p) => p.v)])));
  const [sw, setSw] = useState(() => Object.fromEntries(DEVICES.map((d) => [d.id, d.switches.map((s) => s.on)])));
  const [bands, setBands] = useState([
    { device: "sa2rate", drive: 0.45, character: 0.5, mix: 0.8, on: true, solo: false },
    { device: "vulture", drive: 0.35, character: 0.6, mix: 0.6, on: true, solo: false },
    { device: "portico", drive: 0.4, character: 0.5, mix: 0.7, on: true, solo: false },
    { device: "hg2", drive: 0.5, character: 0.55, mix: 0.65, on: true, solo: false },
  ]);
  const [trans, setTrans] = useState({ attack: 0.62, sustain: 0.42, detail: 0.5, mix: 1, output: 0.5 });
  const [prefs, setPrefs] = useState({ precision: "64-BIT", os: "4×", latency: "BALANCED" });

  const dev = DEVICES.find((d) => d.id === activeDevice);

  return (
    <div style={{
      minHeight: "100vh", padding: "26px 16px", color: "#c8cdd6",
      background: "radial-gradient(1400px 700px at 50% -15%, #23262e, #0a0b0d 65%)",
    }}>
      <div style={{ maxWidth: 1020, margin: "0 auto", display: "flex", flexDirection: "column", gap: 15 }}>

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 28, letterSpacing: 5, color: "#efece2", textShadow: "0 2px 4px rgba(0,0,0,.6)" }}>
              RACK<span style={{ color: "#e8c94f" }}>FORGE</span>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#5a6572" }}>transient designer · analog saturation suite · preview v0.2</div>
          </div>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #2b2f38", boxShadow: "0 4px 10px rgba(0,0,0,.4)" }}>
            {[["panel", "PANEL VIEW"], ["engine", "ENGINE VIEW"]].map(([id, t]) => (
              <button key={id} onClick={() => setView(id)} style={{
                fontFamily: FONT_LABEL, fontSize: 11, fontWeight: 800, letterSpacing: 2.5, padding: "9px 18px",
                border: "none", cursor: "pointer",
                background: view === id ? "linear-gradient(180deg,#f2d868,#d9b53a)" : "#12141a",
                color: view === id ? "#14161a" : "#8a93a0",
                boxShadow: view === id ? "inset 0 1px 0 rgba(255,255,255,.5)" : "none",
              }}>{t}</button>
            ))}
          </div>
        </div>

        <PrefsBar prefs={prefs} setPrefs={setPrefs} />

        {view === "panel" ? (
          <>
            <DevicePanel
              device={dev}
              values={vals[activeDevice]}
              setValue={(i, v) => setVals((s) => ({ ...s, [activeDevice]: s[activeDevice].map((x, j) => (j === i ? v : x)) }))}
              switches={sw[activeDevice]}
              setSwitch={(i) => setSw((s) => ({ ...s, [activeDevice]: s[activeDevice].map((x, j) => (j === i ? !x : x)) }))}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 9 }}>
              {DEVICES.map((d) => (
                <button key={d.id} onClick={() => setActiveDevice(d.id)} style={{
                  textAlign: "left", padding: "10px 13px", borderRadius: 6, cursor: "pointer",
                  background: d.id === activeDevice
                    ? `linear-gradient(180deg, ${shade(d.face, 10)}, ${shade(d.face, -20)})`
                    : "linear-gradient(180deg,#15171c,#101115)",
                  border: d.id === activeDevice ? `1px solid ${d.accent}` : "1px solid #22252b",
                  color: d.id === activeDevice ? d.ink : "#8a93a0",
                  boxShadow: d.id === activeDevice ? `0 0 16px ${d.accent}33, 0 4px 10px rgba(0,0,0,.4)` : "0 3px 8px rgba(0,0,0,.3)",
                  transition: "box-shadow .15s ease",
                }}>
                  <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 12.5, letterSpacing: 1 }}>{d.name}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 8, opacity: 0.62, marginTop: 3 }}>{d.sub.toLowerCase()}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <EngineView bands={bands} setBand={(i, b) => setBands((s) => s.map((x, j) => (j === i ? b : x)))} trans={trans} setTrans={setTrans} />
        )}

        <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#3f4550", textAlign: "center", paddingTop: 2 }}>
          Original "inspired-by" panel artwork · engines modeled on the referenced hardware · drag knobs vertically
        </div>
      </div>
    </div>
  );
}
