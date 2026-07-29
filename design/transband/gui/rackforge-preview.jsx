import React, { useState, useRef, useCallback } from "react";

/* ============================================================
   RACKFORGE — Transient Designer + Analog Saturation Suite
   Interface preview: PANEL view (per-device skins) and
   ENGINE view (uniform multiband interface).
   ============================================================ */

const DEVICES = [
  {
    id: "vulture", name: "Culture Vulture", maker: "Thermionic-style",
    face: "#ddd3ba", ink: "#2a2419", accent: "#a5322b", knobFace: "#17140f",
    pointer: "#e8e0cc", dark: false, knobStyle: "chicken",
    tag: "Valve distortion · triode / pentode",
    params: [
      { l: "DRIVE", v: 0.55 }, { l: "BIAS", v: 0.42 }, { l: "DISTORT", v: 0.3 },
      { l: "FILTER", v: 0.7 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "fatso", name: "EL7x FATSO", maker: "Empirical-style",
    face: "#15161a", ink: "#d8dbe2", accent: "#43c96e", knobFace: "#dcdcdc",
    pointer: "#15161a", dark: true, knobStyle: "round",
    tag: "Tape sim · tranny · warmth",
    params: [
      { l: "INPUT", v: 0.6 }, { l: "TRANNY", v: 0.5 }, { l: "WARMTH", v: 0.45 },
      { l: "COMP", v: 0.35 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "hg2", name: "HG-2", maker: "Black Box-style",
    face: "#0e0e13", ink: "#e6d9b8", accent: "#d3a24a", knobFace: "#1c1c22",
    pointer: "#d3a24a", dark: true, knobStyle: "round",
    tag: "Pentode + triode parallel saturation",
    params: [
      { l: "PENTODE", v: 0.5 }, { l: "TRIODE", v: 0.4 }, { l: "AIR", v: 0.55 },
      { l: "DENSITY", v: 0.3 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "vitalizer", name: "Vitalizer Mk3-T", maker: "SPL-style",
    face: "#26374e", ink: "#dfe7f2", accent: "#7fb2e5", knobFace: "#101722",
    pointer: "#dfe7f2", dark: true, knobStyle: "round",
    tag: "Program EQ · tube stage · stereo width",
    params: [
      { l: "DRIVE", v: 0.4 }, { l: "MID-HI TUNE", v: 0.6 }, { l: "BASS", v: 0.5 },
      { l: "INTENSITY", v: 0.45 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "portico", name: "Portico 542", maker: "RND-style",
    face: "#33373d", ink: "#e8e6e0", accent: "#c33b36", knobFace: "#b8352f",
    pointer: "#f2efe8", dark: true, knobStyle: "round",
    tag: "Tape emulation · Silk red / blue",
    params: [
      { l: "TRIM", v: 0.5 }, { l: "SILK", v: 0.5 }, { l: "TEXTURE", v: 0.45 },
      { l: "SOFTEN", v: 0.3 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "glats1", name: "GLA-TS1 Wizard", maker: "Gainlab-style",
    face: "#1b1d21", ink: "#e8d9c2", accent: "#e0913c", knobFace: "#101114",
    pointer: "#e0913c", dark: true, knobStyle: "chicken",
    tag: "Stereo tube saturation · transformer out",
    params: [
      { l: "TUBE DRIVE", v: 0.55 }, { l: "TRANSFORMER", v: 0.5 }, { l: "BLEND", v: 0.65 },
      { l: "TONE", v: 0.5 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "boum", name: "BOUM", maker: "OTO-style",
    face: "#eceae2", ink: "#26262a", accent: "#e0574f", knobFace: "#2a2a2e",
    pointer: "#eceae2", dark: false, knobStyle: "round",
    tag: "Warming · drive · analog LPF · glue",
    params: [
      { l: "WARM", v: 0.5 }, { l: "DRIVE", v: 0.4 }, { l: "LPF", v: 0.8 },
      { l: "GLUE", v: 0.35 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "sa2rate", name: "SA2RATE 2", maker: "Looptrotter-style",
    face: "#efe2c4", ink: "#3a2f1c", accent: "#d97c25", knobFace: "#3a2f1c",
    pointer: "#efe2c4", dark: false, knobStyle: "chicken",
    tag: "Even-harmonic saturation · no fizz",
    params: [
      { l: "SATURATION", v: 0.55 }, { l: "EVEN/ODD", v: 0.4 }, { l: "MIX", v: 0.7 },
      { l: "TRIM", v: 0.5 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "carnaby", name: "Carnaby H-EQ", maker: "Cranborne-style",
    face: "#22252b", ink: "#e9e3d6", accent: "#e0524d", knobFace: "#15171b",
    pointer: "#e0524d", dark: true, knobStyle: "round",
    tag: "Harmonic EQ · saturate by band",
    params: [
      { l: "LF SAT", v: 0.45 }, { l: "MF SAT", v: 0.4 }, { l: "HF SAT", v: 0.5 },
      { l: "DRIVE", v: 0.5 }, { l: "OUTPUT", v: 0.5 },
    ],
  },
  {
    id: "overstayer", name: "M-A-S / NT-02A", maker: "Overstayer-style",
    face: "#191919", ink: "#efe8d8", accent: "#f2b02c", knobFace: "#232323",
    pointer: "#f2b02c", dark: true, knobStyle: "round",
    tag: "Modular harmonics · ratio · density",
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
  { id: "high", name: "HIGH", range: "5–20 kHz", color: "#7fb2e5" },
];

const FONT_LABEL = "'Avenir Next Condensed','Arial Narrow','Helvetica Neue',sans-serif";
const FONT_MONO = "'SF Mono','JetBrains Mono',Menlo,monospace";

/* ---------- Knob ---------- */
function Knob({ label, value, onChange, size = 52, accent = "#f2b02c", face = "#1c1c1c", pointer = "#eee", ink = "#cfcfcf", style: knobStyle = "round", format }) {
  const ref = useRef(null);
  const start = useRef({ y: 0, v: 0 });

  const down = useCallback((e) => {
    e.preventDefault();
    start.current = { y: e.clientY, v: value };
    const move = (ev) => {
      const d = (start.current.y - ev.clientY) / 150;
      onChange(Math.min(1, Math.max(0, start.current.v + d)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [value, onChange]);

  const a0 = -135, a1 = 135;
  const ang = a0 + (a1 - a0) * value;
  const r = size / 2;
  const arcR = r + 5;
  const polar = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [arcR + arcR * Math.cos(rad), arcR + arcR * Math.sin(rad)];
  };
  const [sx, sy] = polar(a0);
  const [ex, ey] = polar(ang);
  const large = ang - a0 > 180 ? 1 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, userSelect: "none", touchAction: "none" }}>
      <div ref={ref} onPointerDown={down} style={{ position: "relative", width: arcR * 2, height: arcR * 2, cursor: "ns-resize" }}>
        <svg width={arcR * 2} height={arcR * 2} style={{ position: "absolute", inset: 0 }}>
          <path d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 1 1 ${polar(a1)[0]} ${polar(a1)[1]}`} fill="none" stroke="rgba(128,128,128,.25)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 ${large} 1 ${ex} ${ey}`} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div style={{
          position: "absolute", left: arcR - r, top: arcR - r, width: size, height: size, borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${face}, ${face} 55%, rgba(0,0,0,.55))`,
          boxShadow: "0 3px 8px rgba(0,0,0,.5), inset 0 1px 1px rgba(255,255,255,.15)",
          transform: `rotate(${ang}deg)`,
        }}>
          {knobStyle === "chicken" ? (
            <div style={{ position: "absolute", left: "50%", top: -4, width: 8, height: r + 6, marginLeft: -4, background: face, clipPath: "polygon(50% 0, 100% 100%, 0 100%)", borderRadius: 2 }}>
              <div style={{ position: "absolute", left: "50%", top: 2, width: 2, height: 12, marginLeft: -1, background: pointer }} />
            </div>
          ) : (
            <div style={{ position: "absolute", left: "50%", top: 4, width: 3, height: r * 0.62, marginLeft: -1.5, background: pointer, borderRadius: 2 }} />
          )}
        </div>
      </div>
      <div style={{ fontFamily: FONT_LABEL, fontSize: 10, letterSpacing: 1.4, color: ink, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: ink, opacity: 0.65 }}>{format ? format(value) : `${Math.round(value * 100)}`}</div>
    </div>
  );
}

/* ---------- Hardware bits ---------- */
const Screw = ({ style }) => (
  <div style={{
    width: 11, height: 11, borderRadius: "50%",
    background: "radial-gradient(circle at 35% 30%, #9a9a9a, #4a4a4a 70%)",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,.6)", position: "relative", ...style,
  }}>
    <div style={{ position: "absolute", left: "50%", top: 2, bottom: 2, width: 1.5, marginLeft: -0.75, background: "#222", transform: "rotate(38deg)" }} />
  </div>
);

const LED = ({ on, color = "#43c96e" }) => (
  <div style={{
    width: 8, height: 8, borderRadius: "50%",
    background: on ? color : "#2a2a2a",
    boxShadow: on ? `0 0 8px ${color}, 0 0 2px ${color}` : "inset 0 1px 2px rgba(0,0,0,.7)",
  }} />
);

function VUMeter({ level = 0.6, accent }) {
  const ang = -42 + 84 * level;
  return (
    <div style={{
      width: 96, height: 62, borderRadius: 6, background: "linear-gradient(#f6ecc9, #e8d9a4)",
      position: "relative", overflow: "hidden", boxShadow: "inset 0 0 10px rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.15)",
      border: "3px solid #1a1a1a",
    }}>
      <svg width="90" height="56" style={{ position: "absolute", left: 0, top: 2 }}>
        <path d="M 12 44 A 40 40 0 0 1 78 44" fill="none" stroke="#7a6a3a" strokeWidth="1.5" />
        <path d="M 62 22 A 40 40 0 0 1 78 44" fill="none" stroke="#b23a2e" strokeWidth="2.5" />
      </svg>
      <div style={{
        position: "absolute", left: "50%", bottom: 6, width: 2, height: 42, marginLeft: -1,
        background: "#1a1a1a", transformOrigin: "bottom center", transform: `rotate(${ang}deg)`,
        transition: "transform .3s ease",
      }} />
      <div style={{ position: "absolute", bottom: 3, width: "100%", textAlign: "center", fontFamily: FONT_LABEL, fontSize: 8, letterSpacing: 2, color: "#5a4a24" }}>VU</div>
    </div>
  );
}

/* ---------- Panel view (per-device skin) ---------- */
function DevicePanel({ device, values, setValues, driveLevel }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch" }}>
      {/* rack ear left */}
      <div style={{ width: 26, background: "linear-gradient(90deg,#0c0c0c,#1e1e1e)", borderRadius: "4px 0 0 4px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
        <Screw /><Screw />
      </div>
      {/* faceplate */}
      <div style={{
        flex: 1, minHeight: 190, background: `linear-gradient(180deg, ${device.face}, ${shade(device.face, device.dark ? 10 : -14)})`,
        padding: "16px 22px 14px", position: "relative",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), inset 0 -2px 6px rgba(0,0,0,.35)",
      }}>
        {/* header row */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <span style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 22, letterSpacing: 1, color: device.ink }}>{device.name}</span>
            <span style={{ fontFamily: FONT_LABEL, fontSize: 11, letterSpacing: 2, color: device.ink, opacity: 0.6, marginLeft: 12 }}>{device.maker.toUpperCase()}</span>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: device.ink, opacity: 0.55 }}>{device.tag}</div>
        </div>
        {/* controls row */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          {device.params.map((p, i) => (
            <Knob key={p.l} label={p.l} value={values[i]} onChange={(v) => setValues(i, v)}
              accent={device.accent} face={device.knobFace} pointer={device.pointer} ink={device.ink} style={device.knobStyle} size={54} />
          ))}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <VUMeter level={0.25 + driveLevel * 0.6} accent={device.accent} />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <LED on color={device.accent} />
              <span style={{ fontFamily: FONT_LABEL, fontSize: 9, letterSpacing: 1.5, color: device.ink, opacity: 0.7 }}>DRIVE</span>
              <LED on color="#c33b36" />
              <span style={{ fontFamily: FONT_LABEL, fontSize: 9, letterSpacing: 1.5, color: device.ink, opacity: 0.7 }}>PWR</span>
            </div>
          </div>
        </div>
      </div>
      {/* rack ear right */}
      <div style={{ width: 26, background: "linear-gradient(90deg,#1e1e1e,#0c0c0c)", borderRadius: "0 4px 4px 0", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
        <Screw /><Screw />
      </div>
    </div>
  );
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (x) => Math.min(255, Math.max(0, x + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/* ---------- Transient display ---------- */
function TransientDisplay({ attack, sustain }) {
  const a = (attack - 0.5) * 2, s = (sustain - 0.5) * 2;
  const pts = [];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const env = Math.exp(-t * 6) * (1 + a * 0.9) + Math.exp(-t * 1.4) * 0.35 * (1 + s * 1.2);
    pts.push(`${i * 3},${64 - Math.min(1.15, env) * 52}`);
  }
  return (
    <svg width="300" height="70" style={{ display: "block" }}>
      <rect width="300" height="70" rx="6" fill="#0b0d10" />
      {[17, 34, 51].map((y) => <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="rgba(255,255,255,.05)" />)}
      <polyline points={pts.join(" ")} fill="none" stroke="#e8c94f" strokeWidth="2" />
      <polyline points={pts.map((p) => p.split(",")).map(([x, y]) => `${x},${64 - (64 - y) * 0.45}`).join(" ")} fill="none" stroke="rgba(127,178,229,.5)" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="8" y="14" fill="#5a6572" fontSize="8" fontFamily={FONT_MONO}>ENVELOPE — shaped vs. dry</text>
    </svg>
  );
}

/* ---------- Universal engine view ---------- */
function EngineView({ bands, setBands, trans, setTrans }) {
  const ink = "#c8cdd6";
  const label = (t) => (
    <div style={{ fontFamily: FONT_LABEL, fontSize: 10, letterSpacing: 2.5, color: "#6b7480", fontWeight: 700, marginBottom: 10 }}>{t}</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Transient section */}
      <div style={{ background: "linear-gradient(180deg,#1a1d22,#14161a)", borderRadius: 8, padding: "14px 18px", border: "1px solid #2a2e36" }}>
        {label("TRANSIENT ENGINE")}
        <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
          <TransientDisplay attack={trans.attack} sustain={trans.sustain} />
          <Knob label="ATTACK" value={trans.attack} onChange={(v) => setTrans({ ...trans, attack: v })} accent="#e8c94f" face="#22252b" pointer="#e8c94f" ink={ink} format={(v) => `${((v - 0.5) * 30).toFixed(1)} dB`} />
          <Knob label="SUSTAIN" value={trans.sustain} onChange={(v) => setTrans({ ...trans, sustain: v })} accent="#e8c94f" face="#22252b" pointer="#e8c94f" ink={ink} format={(v) => `${((v - 0.5) * 48).toFixed(1)} dB`} />
          <Knob label="DETAIL" value={trans.detail} onChange={(v) => setTrans({ ...trans, detail: v })} accent="#7fb2e5" face="#22252b" pointer="#7fb2e5" ink={ink} />
          <Knob label="MIX" value={trans.mix} onChange={(v) => setTrans({ ...trans, mix: v })} accent="#c8cdd6" face="#22252b" pointer="#c8cdd6" ink={ink} format={(v) => `${Math.round(v * 100)}%`} />
          <Knob label="OUTPUT" value={trans.output} onChange={(v) => setTrans({ ...trans, output: v })} accent="#c8cdd6" face="#22252b" pointer="#c8cdd6" ink={ink} format={(v) => `${((v - 0.5) * 24).toFixed(1)} dB`} />
        </div>
      </div>

      {/* Multiband saturation */}
      <div style={{ background: "linear-gradient(180deg,#1a1d22,#14161a)", borderRadius: 8, padding: "14px 18px", border: "1px solid #2a2e36" }}>
        {label("MULTIBAND SATURATION — INDEPENDENT ENGINE PER BAND")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
          {bands.map((b, i) => {
            const dev = DEVICES.find((d) => d.id === b.device);
            const def = BAND_DEFS[i];
            return (
              <div key={def.id} style={{ background: "#101216", border: `1px solid ${b.on ? def.color + "55" : "#22252b"}`, borderTop: `3px solid ${b.on ? def.color : "#33363d"}`, borderRadius: 6, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 13, letterSpacing: 1.5, color: b.on ? def.color : "#5a5f68" }}>{def.name}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: "#5a6572" }}>{def.range}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setBands(i, { ...b, solo: !b.solo })} style={miniBtn(b.solo, "#e8c94f")}>S</button>
                    <button onClick={() => setBands(i, { ...b, on: !b.on })} style={miniBtn(b.on, def.color)}>{b.on ? "ON" : "OFF"}</button>
                  </div>
                </div>
                <select value={b.device} onChange={(e) => setBands(i, { ...b, device: e.target.value })}
                  style={{
                    width: "100%", background: "#191c22", color: dev ? "#e6e2d6" : "#888", border: "1px solid #2c3038",
                    borderRadius: 4, padding: "6px 8px", fontFamily: FONT_LABEL, fontSize: 12, letterSpacing: 0.5, marginBottom: 10,
                  }}>
                  {DEVICES.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <div style={{ display: "flex", justifyContent: "space-around" }}>
                  <Knob label="DRIVE" value={b.drive} onChange={(v) => setBands(i, { ...b, drive: v })} size={40} accent={dev.accent} face="#22252b" pointer={dev.accent} ink="#9aa1ac" />
                  <Knob label="CHAR" value={b.character} onChange={(v) => setBands(i, { ...b, character: v })} size={40} accent={dev.accent} face="#22252b" pointer={dev.accent} ink="#9aa1ac" />
                  <Knob label="MIX" value={b.mix} onChange={(v) => setBands(i, { ...b, mix: v })} size={40} accent="#c8cdd6" face="#22252b" pointer="#c8cdd6" ink="#9aa1ac" format={(v) => `${Math.round(v * 100)}%`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const miniBtn = (on, color) => ({
  fontFamily: FONT_LABEL, fontSize: 9, fontWeight: 700, letterSpacing: 1,
  padding: "3px 8px", borderRadius: 3, cursor: "pointer",
  background: on ? color : "#191c22", color: on ? "#0d0f12" : "#6b7480",
  border: `1px solid ${on ? color : "#2c3038"}`,
});

/* ---------- Prefs bar ---------- */
function PrefsBar({ prefs, setPrefs }) {
  const seg = (opts, key) => (
    <div style={{ display: "flex", background: "#101216", border: "1px solid #2a2e36", borderRadius: 4, overflow: "hidden" }}>
      {opts.map((o) => (
        <button key={o} onClick={() => setPrefs({ ...prefs, [key]: o })} style={{
          fontFamily: FONT_MONO, fontSize: 9.5, padding: "5px 9px", cursor: "pointer", border: "none",
          background: prefs[key] === o ? "#e8c94f" : "transparent",
          color: prefs[key] === o ? "#14161a" : "#8a93a0", fontWeight: prefs[key] === o ? 700 : 400,
        }}>{o}</button>
      ))}
    </div>
  );
  const lbl = (t) => <span style={{ fontFamily: FONT_LABEL, fontSize: 9, letterSpacing: 1.8, color: "#5a6572", fontWeight: 700 }}>{t}</span>;
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", padding: "8px 14px", background: "#0e1013", borderRadius: 6, border: "1px solid #22252b" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{lbl("PRECISION")}{seg(["32-BIT", "64-BIT"], "precision")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{lbl("OVERSAMPLING")}{seg(["OFF", "2×", "4×", "8×", "16×"], "os")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{lbl("LATENCY MODE")}{seg(["ZERO", "BALANCED", "HQ LINEAR"], "latency")}</div>
      <div style={{ marginLeft: "auto", fontFamily: FONT_MONO, fontSize: 9, color: "#5a6572" }}>
        PDC: {prefs.latency === "ZERO" ? "0 smp" : prefs.latency === "BALANCED" ? "64 smp" : "2048 smp"} · {prefs.precision} float · {prefs.os} OS
      </div>
    </div>
  );
}

/* ---------- App ---------- */
export default function RackForge() {
  const [view, setView] = useState("engine");
  const [activeDevice, setActiveDevice] = useState("vulture");
  const [deviceValues, setDeviceValues] = useState(() =>
    Object.fromEntries(DEVICES.map((d) => [d.id, d.params.map((p) => p.v)]))
  );
  const [bands, setBandsState] = useState([
    { device: "sa2rate", drive: 0.45, character: 0.5, mix: 0.8, on: true, solo: false },
    { device: "vulture", drive: 0.35, character: 0.6, mix: 0.6, on: true, solo: false },
    { device: "portico", drive: 0.4, character: 0.5, mix: 0.7, on: true, solo: false },
    { device: "hg2", drive: 0.5, character: 0.55, mix: 0.65, on: true, solo: false },
  ]);
  const [trans, setTrans] = useState({ attack: 0.62, sustain: 0.42, detail: 0.5, mix: 1, output: 0.5 });
  const [prefs, setPrefs] = useState({ precision: "64-BIT", os: "4×", latency: "BALANCED" });

  const dev = DEVICES.find((d) => d.id === activeDevice);
  const setDevVal = (i, v) => setDeviceValues((s) => ({ ...s, [activeDevice]: s[activeDevice].map((x, j) => (j === i ? v : x)) }));
  const setBands = (i, b) => setBandsState((s) => s.map((x, j) => (j === i ? b : x)));

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(1200px 600px at 50% -10%, #1d2026, #0a0b0d 70%)", padding: "22px 16px", color: "#c8cdd6" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 26, letterSpacing: 4, color: "#eceae2" }}>RACKFORGE</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#5a6572" }}>transient designer · analog saturation suite · v0.1 preview</div>
          </div>
          <div style={{ display: "flex", background: "#101216", border: "1px solid #2a2e36", borderRadius: 5, overflow: "hidden" }}>
            {[["engine", "ENGINE VIEW"], ["panel", "PANEL VIEW"]].map(([id, t]) => (
              <button key={id} onClick={() => setView(id)} style={{
                fontFamily: FONT_LABEL, fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: "8px 16px",
                border: "none", cursor: "pointer",
                background: view === id ? "#e8c94f" : "transparent", color: view === id ? "#14161a" : "#8a93a0",
              }}>{t}</button>
            ))}
          </div>
        </div>

        <PrefsBar prefs={prefs} setPrefs={setPrefs} />

        {view === "panel" ? (
          <>
            <DevicePanel device={dev} values={deviceValues[activeDevice]} setValues={setDevVal} driveLevel={deviceValues[activeDevice][0]} />
            {/* rack strip: device selector */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 }}>
              {DEVICES.map((d) => (
                <button key={d.id} onClick={() => setActiveDevice(d.id)} style={{
                  textAlign: "left", padding: "9px 12px", borderRadius: 5, cursor: "pointer",
                  background: d.id === activeDevice ? `linear-gradient(180deg, ${d.face}, ${shade(d.face, -18)})` : "#14161a",
                  border: d.id === activeDevice ? `1px solid ${d.accent}` : "1px solid #22252b",
                  color: d.id === activeDevice ? d.ink : "#8a93a0",
                }}>
                  <div style={{ fontFamily: FONT_LABEL, fontWeight: 700, fontSize: 12, letterSpacing: 0.8 }}>{d.name}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 8, opacity: 0.65, marginTop: 2 }}>{d.tag}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <EngineView bands={bands} setBands={setBands} trans={trans} setTrans={setTrans} />
        )}

        <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#3f4550", textAlign: "center", paddingTop: 4 }}>
          Panel skins are original "inspired-by" designs — sound engines modeled on the referenced hardware. Drag knobs vertically.
        </div>
      </div>
    </div>
  );
}
