import React, { useState, useRef, useCallback } from "react";

/* ============================================================
   TRANSBAND — multiTransBender v0.1b (preview)
   · Splash / About screen on launch (reopen via ABOUT)
   · Light / Dark theme toggle
   · Three views: ENGINE / PANEL / RACK 3D
   ============================================================ */

const FONT_LABEL = "'Avenir Next Condensed','Arial Narrow','Helvetica Neue',sans-serif";
const FONT_MONO = "'SF Mono','JetBrains Mono',Menlo,monospace";
const BAND_COLORS = ["#e0574f", "#e0913c", "#d9a92f", "#4fb26c", "#5f93d0", "#9a7fd0"];

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (x) => Math.min(255, Math.max(0, x + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};
const fmtHz = (f) => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)}k` : `${Math.round(f)}`);

/* ---------------- THEMES ---------------- */
const THEMES = {
  dark: {
    id: "dark",
    pageBg: "radial-gradient(1400px 700px at 50% -15%, #23262e, #0a0b0d 65%)",
    header: "#efece2", text: "#c8cdd6", sub: "#5a6572", faint: "#3f4550",
    panelBg: "linear-gradient(180deg,#191c22,#131519)", panelBorder: "#2b2f38",
    barBg: "linear-gradient(180deg,#111318,#0c0e11)", barBorder: "#23262e",
    chipBg: "#101216", chipBorder: "#262a32", chipText: "#aab1bc",
    segBg: "#0d0f13", segBorder: "#2a2e36", segText: "#8a93a0",
    ctrlBg: "#181b21", ctrlBorder: "#2c3038", ctrlText: "#e6e2d6",
    knobFace: "#23262d",
    specBg: "linear-gradient(180deg,#06080b,#0c0f14)",
    specGrid: "rgba(140,160,190,.07)", specGrid2: "rgba(140,160,190,.05)",
    specTick: "#4a5462", specLine: "rgba(141,185,232,.6)", specArea: "rgba(141,185,232,.10)",
    xover: "#e8e4d8", xoverTag: "#1a1e25", xoverTagBorder: "#3a404c", xoverText: "#dfe3ea",
    nodeStroke: "#0b0d10", hint: "#3f4855",
    accentGrad: "linear-gradient(180deg,#f2d868,#d9b53a)", accentText: "#14161a",
    stripBg: "#12141a", stripBorder: "#22252b", stripText: "#8a93a0",
    envBg: "linear-gradient(180deg,#07090c,#0c0f14)",
  },
  light: {
    id: "light",
    pageBg: "radial-gradient(1400px 700px at 50% -15%, #ffffff, #dcd8cd 70%)",
    header: "#2a2c33", text: "#3a3e47", sub: "#8a8f9a", faint: "#a8abb2",
    panelBg: "linear-gradient(180deg,#fbfaf6,#eceae2)", panelBorder: "#cfcbbe",
    barBg: "linear-gradient(180deg,#f6f4ee,#e8e5db)", barBorder: "#cfcbbe",
    chipBg: "#f2f0e9", chipBorder: "#cfcbbe", chipText: "#4a4e58",
    segBg: "#eceae2", segBorder: "#c5c1b4", segText: "#6a6f7a",
    ctrlBg: "#f6f4ee", ctrlBorder: "#c5c1b4", ctrlText: "#33363e",
    knobFace: "#dad7cd",
    specBg: "linear-gradient(180deg,#f2f4f6,#e2e6ea)",
    specGrid: "rgba(40,60,90,.08)", specGrid2: "rgba(40,60,90,.06)",
    specTick: "#7a828e", specLine: "rgba(50,95,150,.65)", specArea: "rgba(50,95,150,.10)",
    xover: "#3a3e47", xoverTag: "#fbfaf6", xoverTagBorder: "#b5b1a4", xoverText: "#3a3e47",
    nodeStroke: "#f2f4f6", hint: "#98a0ab",
    accentGrad: "linear-gradient(180deg,#e8c94f,#cfa62e)", accentText: "#2a2410",
    stripBg: "#f2f0e9", stripBorder: "#cfcbbe", stripText: "#6a6f7a",
    envBg: "linear-gradient(180deg,#eef0f3,#e0e4e9)",
  },
};

/* ---------------- DEVICES ---------------- */
const DEVICES = [
  { id: "vulture", name: "VULTURE", sub: "TWIN VALVE DISTORTION", face: "#e3dac0", ink: "#33291a", accent: "#a5322b", texture: "powder", knob: "chicken", knobFace: "#a5322b", pointer: "#f2e9d4", meter: "vu", tubes: 2, switches: ["TRI/PENT", "OVERDRIVE"], params: ["DRIVE", "BIAS", "DISTORTION", "FILTER", "OUTPUT"] },
  { id: "fatso", name: "PHATSO 7x", sub: "TAPE SIM / OPTIMIZER", face: "#17181c", ink: "#dfe3ea", accent: "#43c96e", texture: "anodized", knob: "alu", knobFace: "#d9dade", pointer: "#17181c", meter: "led", tubes: 0, switches: ["TRANNY IN", "WARMTH"], params: ["INPUT", "TRANNY", "WARMTH", "SPANK", "OUTPUT"] },
  { id: "hg2", name: "HG·II", sub: "PENTODE + TRIODE SAT", face: "#0d0d12", ink: "#e8dcba", accent: "#d3a24a", texture: "anodized", knob: "glossy", knobFace: "#1e1e26", pointer: "#d3a24a", meter: "vu", tubes: 4, switches: ["AIR", "ALT TUBE"], params: ["PENTODE", "TRIODE", "SATURATION", "DENSITY", "OUTPUT"] },
  { id: "vitalizer", name: "REVITALIZER", sub: "PROGRAM EQ · TUBE", face: "#2b3d55", ink: "#e4ebf5", accent: "#8db9e8", texture: "brushed", knob: "alu", knobFace: "#c7ccd6", pointer: "#1a2230", meter: "led", tubes: 1, switches: ["TUBE IN", "WIDE"], params: ["DRIVE", "MID-HI TUNE", "BASS", "INTENSITY", "OUTPUT"] },
  { id: "portico", name: "P·542", sub: "TAPE EMULATION · SILK", face: "#363a41", ink: "#ece9e2", accent: "#c33b36", texture: "brushed", knob: "glossy", knobFace: "#b8352f", pointer: "#f4f1ea", meter: "led", tubes: 0, switches: ["SILK RED", "SILK BLUE"], params: ["TRIM", "SATURATION", "TEXTURE", "SOFTEN", "OUTPUT"] },
  { id: "glats1", name: "WIZARD TS·1", sub: "STEREO TUBE SATURATOR", face: "#1c1e23", ink: "#ecdcc0", accent: "#e0913c", texture: "anodized", knob: "chicken", knobFace: "#141519", pointer: "#e0913c", meter: "vu", tubes: 2, switches: ["XFMR OUT", "HI-Z"], params: ["TUBE DRIVE", "TRANSFORMER", "BLEND", "TONE", "OUTPUT"] },
  { id: "boum", name: "BØM", sub: "ANALOG WARMING", face: "#efece3", ink: "#26262b", accent: "#e0574f", texture: "powder", knob: "glossy", knobFace: "#2a2a30", pointer: "#efece3", meter: "led", tubes: 0, switches: ["DIRT", "GLUE"], params: ["WARM", "DRIVE", "LPF", "SQUASH", "OUTPUT"] },
  { id: "sa2rate", name: "SA²RATE", sub: "EVEN-HARMONIC SAT", face: "#f0e3c6", ink: "#3c301c", accent: "#d97c25", texture: "powder", knob: "chicken", knobFace: "#3c301c", pointer: "#f0e3c6", meter: "led", tubes: 0, switches: ["MORE", "SOFT CLIP"], params: ["SATURATION", "EVEN / ODD", "MIX", "TRIM", "OUTPUT"] },
  { id: "carnaby", name: "CARNABY", sub: "HARMONIC EQ", face: "#23262c", ink: "#ece6d8", accent: "#e0524d", texture: "brushed", knob: "glossy", knobFace: "#15171b", pointer: "#e0524d", meter: "led", tubes: 0, switches: ["SAT LINK", "HPF"], params: ["LF SAT", "MF SAT", "HF SAT", "DRIVE", "OUTPUT"] },
  { id: "overstayer", name: "M·A·S", sub: "HARMONICS / DENSITY", face: "#1a1a1a", ink: "#f0e9d8", accent: "#f2b02c", texture: "anodized", knob: "alu", knobFace: "#2a2a2a", pointer: "#f2b02c", meter: "led", tubes: 0, switches: ["FET/DIODE", "TIGHT LF"], params: ["RATIO", "HARMONICS", "DENSITY", "FILTER", "OUTPUT"] },
];

const defaultBand = (device = "sa2rate") => ({
  attack: 0.5, sustain: 0.5, detail: 0.5, mix: 1, output: 0.5,
  device, drive: 0.4, character: 0.5, satMix: 0.7, on: true, solo: false,
});

/* ---------------- KNOB ---------------- */
function Knob({ label, value, onChange, size = 52, variant = "glossy", accent = "#e8c94f", knobFace = "#23262d", pointer, ink = "#c8cdd6", format }) {
  const start = useRef({ y: 0, v: 0 });
  const down = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    start.current = { y: e.clientY, v: value };
    const move = (ev) => onChange(Math.min(1, Math.max(0, start.current.v + (start.current.y - ev.clientY) / 160)));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [value, onChange]);

  const a0 = -135, a1 = 135, ang = a0 + (a1 - a0) * value;
  const pad = 7, box = size + pad * 2, cr = box / 2, arcR = cr - 2;
  const polar = (deg) => { const r = ((deg - 90) * Math.PI) / 180; return [cr + arcR * Math.cos(r), cr + arcR * Math.sin(r)]; };
  const [sx, sy] = polar(a0), [tx, ty] = polar(a1), [ex, ey] = polar(ang);
  const large = ang - a0 > 180 ? 1 : 0;
  const pc = pointer || accent;

  let body;
  if (variant === "alu") body = { background: `conic-gradient(from 90deg, ${shade(knobFace, 25)}, ${shade(knobFace, -30)}, ${shade(knobFace, 30)}, ${shade(knobFace, -25)}, ${shade(knobFace, 25)})` };
  else if (variant === "chicken") body = { background: `radial-gradient(circle at 38% 30%, ${shade(knobFace, 30)}, ${knobFace} 55%, ${shade(knobFace, -45)})` };
  else body = { background: `radial-gradient(circle at 36% 26%, ${shade(knobFace, 55)}, ${knobFace} 48%, ${shade(knobFace, -50)} 95%)` };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, userSelect: "none", touchAction: "none", width: box + 6 }}>
      <div onPointerDown={down} style={{ position: "relative", width: box, height: box, cursor: "ns-resize" }}>
        <svg width={box} height={box} style={{ position: "absolute", inset: 0 }}>
          <path d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 1 1 ${tx} ${ty}`} fill="none" stroke="rgba(128,128,136,.28)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 ${large} 1 ${ex} ${ey}`} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${accent})` }} />
        </svg>
        <div style={{ position: "absolute", left: pad - 3, top: pad - 3, width: size + 6, height: size + 6, borderRadius: "50%", background: "radial-gradient(circle at 50% 35%, rgba(0,0,0,.12), rgba(0,0,0,.45))", boxShadow: "0 5px 12px rgba(0,0,0,.4)" }} />
        <div style={{ position: "absolute", left: pad, top: pad, width: size, height: size, borderRadius: "50%", ...body, boxShadow: "inset 0 1px 2px rgba(255,255,255,.28), inset 0 -3px 6px rgba(0,0,0,.4)", transform: `rotate(${ang}deg)` }}>
          {variant === "chicken" ? (
            <div style={{ position: "absolute", left: "50%", top: -5, width: 11, height: size * 0.62, marginLeft: -5.5, background: `linear-gradient(180deg, ${shade(knobFace, 22)}, ${shade(knobFace, -18)})`, clipPath: "polygon(50% 0, 100% 100%, 0 100%)", borderRadius: 2 }}>
              <div style={{ position: "absolute", left: "50%", top: 3, width: 2, height: 13, marginLeft: -1, background: pc, borderRadius: 1 }} />
            </div>
          ) : (
            <div style={{ position: "absolute", left: "50%", top: size * 0.08, width: 3.5, height: size * 0.36, marginLeft: -1.75, background: pc, borderRadius: 2 }} />
          )}
        </div>
      </div>
      <div style={{ fontFamily: FONT_LABEL, fontSize: 9, letterSpacing: 1.4, color: ink, fontWeight: 700, textAlign: "center" }}>{label}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: ink, opacity: 0.6 }}>{format ? format(value) : Math.round(value * 100)}</div>
    </div>
  );
}

/* ---------------- HARDWARE BITS (device-colored, theme-independent) ---------------- */
const Screw = () => (
  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "radial-gradient(circle at 32% 28%, #b5b5b5, #5a5a5a 55%, #2e2e2e)", boxShadow: "inset 0 -1px 2px rgba(0,0,0,.65)", position: "relative" }}>
    <div style={{ position: "absolute", left: "50%", top: 2.5, bottom: 2.5, width: 1.6, marginLeft: -0.8, background: "#1c1c1c", transform: "rotate(35deg)" }} />
  </div>
);

function Toggle({ label, on, onClick, ink, accent }) {
  return (
    <div onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", userSelect: "none" }}>
      <div style={{ width: 20, height: 36, borderRadius: 10, background: "linear-gradient(180deg,#0c0c0e,#26262a)", boxShadow: "inset 0 2px 5px rgba(0,0,0,.8)", position: "relative" }}>
        <div style={{ position: "absolute", left: 3, width: 14, height: 14, borderRadius: "50%", top: on ? 3 : 19, transition: "top .12s ease", background: "radial-gradient(circle at 35% 30%, #e8e8e8, #8a8a8a 65%, #4a4a4a)", boxShadow: "0 2px 4px rgba(0,0,0,.6)" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: on ? accent : "#2c2c2e", boxShadow: on ? `0 0 6px ${accent}` : "none" }} />
        <span style={{ fontFamily: FONT_LABEL, fontSize: 8, letterSpacing: 1.1, fontWeight: 700, color: ink, opacity: 0.85 }}>{label}</span>
      </div>
    </div>
  );
}

function VUMeter({ level = 0.6 }) {
  const ang = -44 + 88 * Math.min(1, level);
  return (
    <div style={{ width: 96, height: 62, borderRadius: 5, position: "relative", overflow: "hidden", background: "radial-gradient(110px 66px at 50% 120%, #ffe9a8, #f3e3ae 40%, #e2cf8e)", border: "4px solid #141414", boxShadow: "inset 0 0 12px rgba(90,60,10,.45), 0 2px 5px rgba(0,0,0,.5)" }}>
      <svg width="88" height="54" style={{ position: "absolute", left: 0, top: 3 }}>
        <path d="M 12 42 A 38 38 0 0 1 76 42" fill="none" stroke="#6e5c2e" strokeWidth="1.3" />
        <path d="M 61 22 A 38 38 0 0 1 76 42" fill="none" stroke="#b23a2e" strokeWidth="2.4" />
      </svg>
      <div style={{ position: "absolute", left: "50%", bottom: 6, width: 1.8, height: 42, marginLeft: -0.9, background: "#1a1a1a", transformOrigin: "bottom center", transform: `rotate(${ang}deg)`, transition: "transform .35s cubic-bezier(.3,1.4,.5,1)" }} />
      <div style={{ position: "absolute", bottom: 1, width: "100%", textAlign: "center", fontFamily: FONT_LABEL, fontSize: 7, letterSpacing: 3, color: "#5a4a24", fontWeight: 700 }}>VU</div>
    </div>
  );
}

function LEDMeter({ level = 0.6 }) {
  const segs = 12, lit = Math.round(Math.min(1, level) * segs);
  const colorAt = (i) => (i >= segs - 2 ? "#e0473d" : i >= segs - 5 ? "#e8c94f" : "#43c96e");
  return (
    <div style={{ display: "flex", gap: 2.5, padding: 5, borderRadius: 4, background: "#0a0b0d", boxShadow: "inset 0 1px 4px rgba(0,0,0,.8)" }}>
      {Array.from({ length: segs }).map((_, i) => (
        <div key={i} style={{ width: 7, height: 15, borderRadius: 1.5, background: i < lit ? colorAt(i) : "#1c1e22", boxShadow: i < lit ? `0 0 5px ${colorAt(i)}` : "none" }} />
      ))}
    </div>
  );
}

const textureCSS = (t, face, dark) => {
  const base = `linear-gradient(180deg, ${shade(face, dark ? 14 : 8)}, ${face} 30%, ${shade(face, dark ? -8 : -16)})`;
  if (t === "brushed") return { background: `repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, rgba(0,0,0,.045) 1px 2px), ${base}` };
  if (t === "anodized") return { background: `radial-gradient(700px 200px at 50% -60%, rgba(255,255,255,.10), transparent 60%), ${base}` };
  return { background: `radial-gradient(500px 240px at 30% -40%, rgba(255,255,255,.22), transparent 55%), ${base}` };
};

/* ---------------- FRONT PANEL ---------------- */
function DeviceFace({ device, values, setValue, switches, setSwitch, compact = false }) {
  const dark = parseInt(device.face.slice(1, 3), 16) < 110;
  return (
    <div style={{ minHeight: compact ? 170 : 200, padding: compact ? "12px 18px" : "16px 24px 14px", position: "relative", ...textureCSS(device.texture, device.face, dark), boxShadow: "inset 0 2px 1px rgba(255,255,255,.18), inset 0 -3px 8px rgba(0,0,0,.35)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 23, letterSpacing: 3, color: device.ink, textShadow: dark ? "0 1px 0 rgba(0,0,0,.6)" : "0 1px 0 rgba(255,255,255,.5)" }}>{device.name}</div>
          <div style={{ fontFamily: FONT_LABEL, fontSize: 9.5, letterSpacing: 2.2, color: device.ink, opacity: 0.6, fontWeight: 700 }}>{device.sub}</div>
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 1, color: device.ink, opacity: 0.4 }}>TRANSBAND</div>
      </div>
      <div style={{ height: 2, marginBottom: 12, background: `linear-gradient(90deg, transparent, ${dark ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.18)"}, transparent)`, boxShadow: `0 1px 0 ${dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.5)"}` }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        {device.params.map((p, i) => (
          <Knob key={p} label={p} value={values[i]} onChange={(v) => setValue(i, v)} variant={device.knob} knobFace={device.knobFace} pointer={device.pointer} accent={device.accent} ink={device.ink} size={compact ? 46 : 54} />
        ))}
        <div style={{ display: "flex", gap: 12 }}>
          {device.switches.map((s, i) => <Toggle key={s} label={s} on={switches[i]} onClick={() => setSwitch(i)} ink={device.ink} accent={device.accent} />)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {device.meter === "vu" ? <VUMeter level={0.22 + values[0] * 0.6} /> : <LEDMeter level={0.25 + values[0] * 0.6} />}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e0473d", boxShadow: "0 0 7px #e0473d" }} />
            <span style={{ fontFamily: FONT_LABEL, fontSize: 8, letterSpacing: 2, color: device.ink, opacity: 0.7, fontWeight: 700 }}>POWER</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RackEars({ children }) {
  return (
    <div style={{ display: "flex", filter: "drop-shadow(0 14px 28px rgba(0,0,0,.4))" }}>
      <div style={{ width: 28, borderRadius: "5px 0 0 5px", background: "linear-gradient(90deg,#060607,#232326 70%,#17171a)", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}><Screw /><Screw /></div>
      <div style={{ flex: 1 }}>{children}</div>
      <div style={{ width: 28, borderRadius: "0 5px 5px 0", background: "linear-gradient(90deg,#17171a,#232326 30%,#060607)", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}><Screw /><Screw /></div>
    </div>
  );
}

/* ---------------- 3D RACK VIEW ---------------- */
function TopPlate({ device }) {
  const dark = parseInt(device.face.slice(1, 3), 16) < 110;
  const plate = dark ? shade(device.face, 6) : shade(device.face, -6);
  return (
    <div style={{
      height: 190, margin: "0 28px", transformOrigin: "bottom center",
      transform: "perspective(950px) rotateX(58deg)",
      background: `repeating-linear-gradient(0deg, rgba(0,0,0,.10) 0 2px, transparent 2px 9px), linear-gradient(180deg, ${shade(plate, dark ? -18 : -26)}, ${plate})`,
      borderRadius: "6px 6px 0 0", position: "relative",
      boxShadow: "inset 0 3px 8px rgba(0,0,0,.35), inset 0 -2px 3px rgba(255,255,255,.1)",
      borderLeft: "1px solid rgba(0,0,0,.4)", borderRight: "1px solid rgba(0,0,0,.4)",
    }}>
      <div style={{ position: "absolute", left: "8%", right: "40%", top: "16%", bottom: "22%", background: "repeating-linear-gradient(90deg, rgba(0,0,0,.45) 0 5px, transparent 5px 14px)", borderRadius: 4, opacity: 0.5 }} />
      {Array.from({ length: device.tubes }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: `${14 + i * 11}%`, top: "30%", width: 26, height: 46, borderRadius: "50% 50% 40% 40%", background: "radial-gradient(circle at 50% 65%, #ffb75e, #e0632e 55%, rgba(120,30,10,.6))", boxShadow: "0 0 26px rgba(255,140,60,.75), 0 0 60px rgba(255,120,40,.35)", opacity: 0.9 }} />
      ))}
      <div style={{ position: "absolute", right: "7%", top: "18%", width: "20%", height: "52%", background: "linear-gradient(180deg,#26262a,#141416)", borderRadius: 5, boxShadow: "0 6px 14px rgba(0,0,0,.5)" }}>
        <div style={{ position: "absolute", inset: "18% 22%", background: "repeating-linear-gradient(0deg,#3a3a40 0 3px,#222226 3px 6px)", borderRadius: 3 }} />
      </div>
      <div style={{ position: "absolute", left: "8%", bottom: "6%", fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 2, color: dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.4)" }}>
        TRANSBAND · {device.name} · TB-{device.id.toUpperCase().slice(0, 4)}-0001
      </div>
    </div>
  );
}

function Rack3D({ device, values, setValue, switches, setSwitch }) {
  return (
    <div style={{ padding: "6px 0 0" }}>
      <TopPlate device={device} />
      <RackEars>
        <DeviceFace device={device} values={values} setValue={setValue} switches={switches} setSwitch={setSwitch} compact />
      </RackEars>
      <div style={{ height: 26, margin: "0 40px", background: "radial-gradient(60% 100% at 50% 0%, rgba(0,0,0,.4), transparent 70%)" }} />
    </div>
  );
}

/* ---------------- SPECTRUM (ENGINE VIEW) ---------------- */
const W = 940, H = 340, PADL = 34, PADR = 12, PADT = 14, PADB = 26;
const PW = W - PADL - PADR, PH = H - PADT - PADB;
const fToX = (f) => PADL + (Math.log10(f / 20) / 3) * PW;
const xToF = (x) => 20 * Math.pow(10, ((x - PADL) / PW) * 3);

function specMag(f) {
  let m = -6 - 9 * Math.log10(f / 60);
  m += 10 * Math.exp(-Math.pow(Math.log10(f / 55), 2) * 14);
  m += 5 * Math.exp(-Math.pow(Math.log10(f / 240), 2) * 18);
  m += 4 * Math.exp(-Math.pow(Math.log10(f / 2600), 2) * 12);
  m += 2.5 * Math.exp(-Math.pow(Math.log10(f / 9000), 2) * 16);
  return m;
}
const specY = (f) => PADT + PH * (0.18 + Math.min(1, Math.max(0, (6 - specMag(f)) / 42)) * 0.8);

function buildSpec() {
  const pts = [];
  for (let i = 0; i <= 140; i++) {
    const f = 20 * Math.pow(10, (i / 140) * 3);
    pts.push([fToX(f), specY(f)]);
  }
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L ${fToX(20000)} ${PADT + PH} L ${fToX(20)} ${PADT + PH} Z` };
}
const SPEC = buildSpec();

function SpectrumDisplay({ T, crossovers, bands, selected, onSelect, onAddAt, onMoveXover, maxBands }) {
  const svgRef = useRef(null);
  const dragging = useRef(null);
  const edges = [20, ...crossovers, 20000];

  const clientToPt = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const handleClick = (e) => {
    if (dragging.current !== null) return;
    const { x, y } = clientToPt(e);
    if (x < PADL + 6 || x > W - PADR - 6) return;
    const f = xToF(x);
    if (crossovers.some((c) => Math.abs(fToX(c) - x) < 12)) return;
    const nearLine = Math.abs(y - specY(f)) < 18;
    if (nearLine && bands.length < maxBands) { onAddAt(f); return; }
    const idx = crossovers.findIndex((c) => f < c);
    onSelect(idx === -1 ? bands.length - 1 : idx);
  };

  const startDrag = (i) => (e) => {
    e.stopPropagation(); e.preventDefault();
    dragging.current = i;
    const move = (ev) => {
      const { x } = clientToPt(ev);
      onMoveXover(i, xToF(Math.min(W - PADR - 8, Math.max(PADL + 8, x))));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setTimeout(() => (dragging.current = null), 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div style={{ borderRadius: 10, overflow: "hidden", boxShadow: T.id === "dark" ? "inset 0 2px 10px rgba(0,0,0,.7)" : "inset 0 2px 8px rgba(0,0,0,.15), 0 1px 0 rgba(255,255,255,.6)" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", background: T.specBg, cursor: "crosshair" }} onClick={handleClick}>
        {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((f) => (
          <g key={f}>
            <line x1={fToX(f)} x2={fToX(f)} y1={PADT} y2={PADT + PH} stroke={T.specGrid} />
            <text x={fToX(f)} y={H - 8} fill={T.specTick} fontSize="9" fontFamily={FONT_MONO} textAnchor="middle">{fmtHz(f)}</text>
          </g>
        ))}
        {[0.25, 0.5, 0.75].map((t) => <line key={t} x1={PADL} x2={W - PADR} y1={PADT + PH * t} y2={PADT + PH * t} stroke={T.specGrid2} />)}

        {bands.map((b, i) => {
          const x0 = fToX(edges[i]), x1 = fToX(edges[i + 1]);
          const col = BAND_COLORS[i], sel = i === selected;
          return (
            <g key={i}>
              <rect x={x0} y={PADT} width={x1 - x0} height={PH} fill={col} opacity={b.on ? (sel ? 0.16 : 0.07) : 0.02} />
              {sel && <rect x={x0} y={PADT} width={x1 - x0} height={3} fill={col} />}
              {b.on && (
                <>
                  <line x1={x0 + 5} x2={x1 - 5} y1={PADT + PH * (0.5 - (b.attack - 0.5) * 0.5)} y2={PADT + PH * (0.5 - (b.attack - 0.5) * 0.5)} stroke={col} strokeWidth={sel ? 2.2 : 1.4} />
                  <line x1={x0 + 5} x2={x1 - 5} y1={PADT + PH * (0.5 - (b.sustain - 0.5) * 0.5)} y2={PADT + PH * (0.5 - (b.sustain - 0.5) * 0.5)} stroke={col} strokeWidth="1.2" strokeDasharray="5 4" opacity="0.7" />
                </>
              )}
            </g>
          );
        })}

        <path d={SPEC.area} fill={T.specArea} pointerEvents="none" />
        <path d={SPEC.line} fill="none" stroke={T.specLine} strokeWidth="1.7" pointerEvents="none" />

        {bands.map((b, i) => {
          const fc = Math.sqrt(edges[i] * edges[i + 1]);
          const col = BAND_COLORS[i], sel = i === selected;
          return (
            <g key={`n${i}`} onClick={(e) => { e.stopPropagation(); onSelect(i); }} style={{ cursor: "pointer" }}>
              {sel && <circle cx={fToX(fc)} cy={specY(fc)} r={13} fill="none" stroke={col} strokeWidth="1.4" opacity="0.65" />}
              <circle cx={fToX(fc)} cy={specY(fc)} r={sel ? 8.5 : 6.5} fill={b.on ? col : "#7a7f88"} stroke={T.nodeStroke} strokeWidth="2" style={sel ? { filter: `drop-shadow(0 0 8px ${col})` } : undefined} />
              <text x={fToX(fc)} y={specY(fc) + 3.5} fill={T.nodeStroke} fontSize="9" fontWeight="800" fontFamily={FONT_LABEL} textAnchor="middle">{i + 1}</text>
            </g>
          );
        })}

        {crossovers.map((c, i) => {
          const x = fToX(c);
          return (
            <g key={i} onPointerDown={startDrag(i)} style={{ cursor: "ew-resize" }}>
              <line x1={x} x2={x} y1={PADT} y2={PADT + PH} stroke={T.xover} strokeWidth="1.3" opacity="0.8" />
              <rect x={x - 10} y={PADT} width={20} height={PH} fill="transparent" />
              <rect x={x - 15} y={PADT + PH - 20} width={30} height={16} rx={3} fill={T.xoverTag} stroke={T.xoverTagBorder} />
              <text x={x} y={PADT + PH - 8} fill={T.xoverText} fontSize="8.5" fontFamily={FONT_MONO} textAnchor="middle">{fmtHz(c)}</text>
              <rect x={x - 4.5} y={PADT + 2} width={9} height={9} rx={2} fill={T.xover} />
            </g>
          );
        })}

        <text x={W - PADR - 4} y={PADT + 14} fill={T.hint} fontSize="8.5" fontFamily={FONT_MONO} textAnchor="end">
          {bands.length < maxBands ? "click ON the line → new band" : "max 6 bands"} · click node/region → select · drag handles
        </text>
      </svg>
    </div>
  );
}

/* ---------------- BAND CONTROLS ---------------- */
function EnvelopeMini({ T, attack, sustain, color }) {
  const mk = (aa, ss) => {
    const pts = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const env = Math.exp(-t * 6) * (1 + aa * 0.9) + Math.exp(-t * 1.4) * 0.35 * (1 + ss * 1.2);
      pts.push(`${i * 2.3},${64 - Math.min(1.18, env) * 50}`);
    }
    return pts.join(" ");
  };
  return (
    <svg width="230" height="72" style={{ display: "block", background: T.envBg, borderRadius: 8, boxShadow: "inset 0 2px 6px rgba(0,0,0,.25)" }}>
      {[18, 36, 54].map((y) => <line key={y} x1="0" x2="230" y1={y} y2={y} stroke={T.specGrid2} />)}
      <polyline points={mk(0, 0)} fill="none" stroke={T.specLine} strokeWidth="1.3" strokeDasharray="4 3" opacity="0.55" />
      <polyline points={mk((attack - 0.5) * 2, (sustain - 0.5) * 2)} fill="none" stroke={color} strokeWidth="2" style={{ filter: `drop-shadow(0 0 4px ${color}99)` }} />
      <text x="8" y="13" fill={T.sub} fontSize="7.5" fontFamily={FONT_MONO}>BAND ENVELOPE</text>
    </svg>
  );
}

function BandPanel({ T, band, index, crossovers, update }) {
  const col = BAND_COLORS[index];
  const edges = [20, ...crossovers, 20000];
  const dev = DEVICES.find((d) => d.id === band.device);
  const ink = T.text;
  const set = (k) => (v) => update({ ...band, [k]: v });
  const gl = (t, c) => <div style={{ fontFamily: FONT_LABEL, fontSize: 9, letterSpacing: 2.5, color: c || T.sub, fontWeight: 800, marginBottom: 8 }}>{t}</div>;
  return (
    <div style={{ background: T.panelBg, borderRadius: 10, padding: "14px 18px", border: `1px solid ${col}55`, borderTop: `3px solid ${col}`, boxShadow: `0 10px 24px rgba(0,0,0,.2), 0 0 30px ${col}10` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 16, letterSpacing: 2, color: col }}>BAND {index + 1}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.sub }}>{fmtHz(edges[index])}–{fmtHz(edges[index + 1])} Hz · independent transient + saturation chain</div>
      </div>
      <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          {gl("TRANSIENT", col)}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Knob label="ATTACK" value={band.attack} onChange={set("attack")} accent={col} knobFace={T.knobFace} ink={ink} format={(v) => `${((v - 0.5) * 30).toFixed(1)} dB`} />
            <Knob label="SUSTAIN" value={band.sustain} onChange={set("sustain")} accent={col} knobFace={T.knobFace} ink={ink} format={(v) => `${((v - 0.5) * 48).toFixed(1)} dB`} />
            <Knob label="DETAIL" value={band.detail} onChange={set("detail")} accent="#5f93d0" knobFace={T.knobFace} ink={ink} />
            <EnvelopeMini T={T} attack={band.attack} sustain={band.sustain} color={col} />
          </div>
        </div>
        <div>
          {gl("SATURATION ENGINE", dev.accent)}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginRight: 6 }}>
              <select value={band.device} onChange={(e) => update({ ...band, device: e.target.value })} style={{ background: T.ctrlBg, color: T.ctrlText, border: `1px solid ${dev.accent}66`, borderRadius: 5, padding: "7px 9px", fontFamily: FONT_LABEL, fontSize: 12, minWidth: 150 }}>
                {DEVICES.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: dev.accent, opacity: 0.9 }}>{dev.sub.toLowerCase()}</div>
            </div>
            <Knob label="DRIVE" value={band.drive} onChange={set("drive")} accent={dev.accent} knobFace={T.knobFace} ink={ink} />
            <Knob label="CHARACTER" value={band.character} onChange={set("character")} accent={dev.accent} knobFace={T.knobFace} ink={ink} />
            <Knob label="SAT MIX" value={band.satMix} onChange={set("satMix")} accent={T.text} knobFace={T.knobFace} ink={ink} format={(v) => `${Math.round(v * 100)}%`} />
          </div>
        </div>
        <div>
          {gl("BAND OUT")}
          <div style={{ display: "flex", gap: 6 }}>
            <Knob label="MIX" value={band.mix} onChange={set("mix")} accent={T.text} knobFace={T.knobFace} ink={ink} format={(v) => `${Math.round(v * 100)}%`} />
            <Knob label="OUTPUT" value={band.output} onChange={set("output")} accent={T.text} knobFace={T.knobFace} ink={ink} format={(v) => `${((v - 0.5) * 24).toFixed(1)} dB`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BandChips({ T, bands, crossovers, selected, onSelect, onToggle, onSolo, onRemove }) {
  const edges = [20, ...crossovers, 20000];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {bands.map((b, i) => {
        const col = BAND_COLORS[i], sel = i === selected;
        return (
          <div key={i} onClick={() => onSelect(i)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, cursor: "pointer", background: sel ? `linear-gradient(180deg, ${col}30, ${col}12)` : T.chipBg, border: `1px solid ${sel ? col : T.chipBorder}`, opacity: b.on ? 1 : 0.55 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: col }} />
            <div>
              <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 11.5, letterSpacing: 1.2, color: sel ? col : T.chipText }}>BAND {i + 1}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: T.sub }}>{fmtHz(edges[i])}–{fmtHz(edges[i + 1])}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onSolo(i); }} style={chipBtn(T, b.solo, "#d9a92f")}>S</button>
            <button onClick={(e) => { e.stopPropagation(); onToggle(i); }} style={chipBtn(T, b.on, col)}>{b.on ? "ON" : "OFF"}</button>
            {bands.length > 1 && <button onClick={(e) => { e.stopPropagation(); onRemove(i); }} style={{ ...chipBtn(T, false, "#e0473d"), padding: "2px 7px" }}>×</button>}
          </div>
        );
      })}
    </div>
  );
}
const chipBtn = (T, on, color) => ({ fontFamily: FONT_LABEL, fontSize: 8.5, fontWeight: 800, letterSpacing: 1, padding: "3px 7px", borderRadius: 4, cursor: "pointer", background: on ? `linear-gradient(180deg, ${color}, ${shade(color, -35)})` : T.segBg, color: on ? "#fff" : T.segText, border: `1px solid ${on ? color : T.segBorder}` });

/* ---------------- PREFS ---------------- */
function PrefsBar({ T, prefs, setPrefs, bandCount }) {
  const seg = (opts, key) => (
    <div style={{ display: "flex", background: T.segBg, border: `1px solid ${T.segBorder}`, borderRadius: 5, overflow: "hidden" }}>
      {opts.map((o) => (
        <button key={o} onClick={() => setPrefs({ ...prefs, [key]: o })} style={{ fontFamily: FONT_MONO, fontSize: 9.5, padding: "6px 10px", cursor: "pointer", border: "none", background: prefs[key] === o ? T.accentGrad : "transparent", color: prefs[key] === o ? T.accentText : T.segText, fontWeight: prefs[key] === o ? 700 : 400 }}>{o}</button>
      ))}
    </div>
  );
  const lbl = (t) => <span style={{ fontFamily: FONT_LABEL, fontSize: 9, letterSpacing: 2, color: T.sub, fontWeight: 800 }}>{t}</span>;
  const pdc = prefs.latency === "ZERO" ? 0 : prefs.latency === "BALANCED" ? 64 : 1024 + bandCount * 512;
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", padding: "10px 16px", background: T.barBg, borderRadius: 8, border: `1px solid ${T.barBorder}` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{lbl("PRECISION")}{seg(["32-BIT", "64-BIT"], "precision")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{lbl("OVERSAMPLING")}{seg(["OFF", "2×", "4×", "8×", "16×"], "os")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{lbl("LATENCY MODE")}{seg(["ZERO", "BALANCED", "HQ LINEAR"], "latency")}</div>
      <div style={{ marginLeft: "auto", fontFamily: FONT_MONO, fontSize: 9, color: T.sub, textAlign: "right", lineHeight: 1.6 }}>
        {bandCount} bands · PDC {pdc} smp (illustrative)<br />
        {prefs.latency === "ZERO" ? "IIR crossovers · 0 added latency" : prefs.latency === "HQ LINEAR" ? "linear-phase FIR · PDC grows w/ bands" : "hybrid · fixed small PDC"}
      </div>
    </div>
  );
}

/* ---------------- SPLASH / ABOUT ---------------- */
function AboutScreen({ onClose }) {
  const credit = (name, role, tags) => (
    <div style={{ padding: "14px 18px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(232,201,79,.18)", textAlign: "left" }}>
      <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 16, letterSpacing: 1.5, color: "#efece2" }}>{name}</div>
      <div style={{ fontFamily: FONT_LABEL, fontSize: 11, letterSpacing: 1, color: "#e8c94f", marginTop: 3, fontWeight: 700 }}>{role}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: "#8a93a0", marginTop: 6, lineHeight: 1.7 }}>{tags}</div>
    </div>
  );
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(1200px 800px at 50% 30%, #1c1f27, #07080a 75%)", padding: 18,
    }}>
      <div style={{ maxWidth: 560, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* logo */}
        <div>
          <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 42, letterSpacing: 9, color: "#efece2", textShadow: "0 0 40px rgba(232,201,79,.25), 0 3px 6px rgba(0,0,0,.7)" }}>
            TRANS<span style={{ color: "#e8c94f" }}>BAND</span>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 4, color: "#8a93a0", marginTop: 4 }}>multiTransBender</div>
          <div style={{ display: "inline-block", marginTop: 10, fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 2, color: "#e8c94f", border: "1px solid rgba(232,201,79,.4)", borderRadius: 20, padding: "4px 14px" }}>v0.1b · BETA</div>
        </div>

        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(232,201,79,.35), transparent)" }} />

        <div style={{ fontFamily: FONT_LABEL, fontSize: 13, letterSpacing: 1.5, color: "#aab1bc", lineHeight: 1.7 }}>
          Dreamed up, designed, and willed into existence<br />by the twisted minds at <span style={{ color: "#e8c94f", fontWeight: 800 }}>TRANSBAND</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          {credit(
            "SERGIO DIMOFF",
            "Ideas & Inspiration · The Plugin He Actually Needed",
            "musician · DJ · record miner"
          )}
          {credit(
            "CARLOS \u201CLOS\u201D FRANZETTI",
            "Loop Engineer · Part-Time Phantom · Chief Loser of Things",
            "musician · synthetics · bike missile · app builder · perpetually late · occasionally M.I.A."
          )}
        </div>

        <button onClick={onClose} style={{
          alignSelf: "center", marginTop: 4, fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 13, letterSpacing: 3,
          padding: "12px 44px", borderRadius: 8, cursor: "pointer", border: "1px solid #e8c94f",
          background: "linear-gradient(180deg,#f2d868,#d9b53a)", color: "#14161a",
          boxShadow: "0 0 30px rgba(232,201,79,.3), inset 0 1px 0 rgba(255,255,255,.5)",
        }}>ENTER THE RACK</button>

        <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: "#4a5260" }}>original "inspired-by" artwork · engines modeled on classic hardware · no valves were harmed</div>
      </div>
    </div>
  );
}

/* ---------------- APP ---------------- */
export default function TransBand() {
  const [showAbout, setShowAbout] = useState(true);
  const [themeId, setThemeId] = useState("dark");
  const T = THEMES[themeId];
  const [view, setView] = useState("engine");
  const [crossovers, setCrossovers] = useState([180, 2500]);
  const [bands, setBands] = useState([defaultBand("sa2rate"), defaultBand("vulture"), defaultBand("hg2")]);
  const [selected, setSelected] = useState(1);
  const [prefs, setPrefs] = useState({ precision: "64-BIT", os: "4×", latency: "ZERO" });
  const [activeDevice, setActiveDevice] = useState("vulture");
  const [vals, setVals] = useState(() => Object.fromEntries(DEVICES.map((d) => [d.id, d.params.map(() => 0.5)])));
  const [sw, setSw] = useState(() => Object.fromEntries(DEVICES.map((d) => [d.id, d.switches.map((_, i) => i === 0)])));
  const MAX = 6;

  const addAt = (f) => {
    if (bands.length >= MAX) return;
    const idx = crossovers.findIndex((c) => f < c);
    const at = idx === -1 ? crossovers.length : idx;
    setCrossovers((s) => [...s.slice(0, at), f, ...s.slice(at)]);
    setBands((s) => [...s.slice(0, at + 1), { ...s[at] }, ...s.slice(at + 1)]);
    setSelected(at + 1);
  };
  const moveXover = (i, f) => {
    const lo = (i === 0 ? 22 : crossovers[i - 1]) * 1.15;
    const hi = (i === crossovers.length - 1 ? 18000 : crossovers[i + 1]) / 1.15;
    setCrossovers((s) => s.map((c, j) => (j === i ? Math.min(hi, Math.max(lo, f)) : c)));
  };
  const removeBand = (i) => {
    if (bands.length <= 1) return;
    setCrossovers((s) => s.filter((_, j) => j !== (i === 0 ? 0 : i - 1)));
    setBands((s) => s.filter((_, j) => j !== i));
    setSelected((sel) => Math.max(0, Math.min(sel >= i ? sel - 1 : sel, bands.length - 2)));
  };

  const dev = DEVICES.find((d) => d.id === activeDevice);
  const setVal = (i, v) => setVals((s) => ({ ...s, [activeDevice]: s[activeDevice].map((x, j) => (j === i ? v : x)) }));
  const setSwitch = (i) => setSw((s) => ({ ...s, [activeDevice]: s[activeDevice].map((x, j) => (j === i ? !x : x)) }));

  const DeviceStrip = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 9 }}>
      {DEVICES.map((d) => (
        <button key={d.id} onClick={() => setActiveDevice(d.id)} style={{
          textAlign: "left", padding: "9px 12px", borderRadius: 6, cursor: "pointer",
          background: d.id === activeDevice ? `linear-gradient(180deg, ${shade(d.face, 10)}, ${shade(d.face, -20)})` : T.stripBg,
          border: d.id === activeDevice ? `1px solid ${d.accent}` : `1px solid ${T.stripBorder}`,
          color: d.id === activeDevice ? d.ink : T.stripText,
          boxShadow: d.id === activeDevice ? `0 0 16px ${d.accent}33` : "none",
        }}>
          <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>{d.name}</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, opacity: 0.62, marginTop: 2 }}>{d.sub.toLowerCase()}</div>
        </button>
      ))}
    </div>
  );

  const hdrBtn = (active) => ({
    fontFamily: FONT_LABEL, fontSize: 11, fontWeight: 800, letterSpacing: 2.5, padding: "9px 15px", border: "none", cursor: "pointer",
    background: active ? T.accentGrad : T.stripBg, color: active ? T.accentText : T.stripText,
  });

  return (
    <div style={{ minHeight: "100vh", padding: "22px 14px", color: T.text, background: T.pageBg, transition: "background .25s ease" }}>
      {showAbout && <AboutScreen onClose={() => setShowAbout(false)} />}
      <div style={{ maxWidth: 1060, margin: "0 auto", display: "flex", flexDirection: "column", gap: 13 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 26, letterSpacing: 5, color: T.header }}>
              TRANS<span style={{ color: "#d9a92f" }}>BAND</span>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.sub }}>multiTransBender · v0.1b</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${T.segBorder}` }}>
              {[["engine", "ENGINE"], ["panel", "PANEL"], ["rack3d", "RACK 3D"]].map(([id, t]) => (
                <button key={id} onClick={() => setView(id)} style={hdrBtn(view === id)}>{t}</button>
              ))}
            </div>
            <button onClick={() => setThemeId(themeId === "dark" ? "light" : "dark")} title="Toggle theme" style={{
              ...hdrBtn(false), borderRadius: 6, border: `1px solid ${T.segBorder}`, padding: "9px 13px", fontSize: 13, lineHeight: 1,
            }}>{themeId === "dark" ? "☀" : "☾"}</button>
            <button onClick={() => setShowAbout(true)} style={{ ...hdrBtn(false), borderRadius: 6, border: `1px solid ${T.segBorder}` }}>ABOUT</button>
          </div>
        </div>

        <PrefsBar T={T} prefs={prefs} setPrefs={setPrefs} bandCount={bands.length} />

        {view === "engine" && (
          <>
            <SpectrumDisplay T={T} crossovers={crossovers} bands={bands} selected={selected} onSelect={setSelected} onAddAt={addAt} onMoveXover={moveXover} maxBands={MAX} />
            <BandChips T={T} bands={bands} crossovers={crossovers} selected={selected} onSelect={setSelected}
              onToggle={(i) => setBands((s) => s.map((b, j) => (j === i ? { ...b, on: !b.on } : b)))}
              onSolo={(i) => setBands((s) => s.map((b, j) => (j === i ? { ...b, solo: !b.solo } : b)))}
              onRemove={removeBand} />
            <BandPanel T={T} band={bands[selected]} index={selected} crossovers={crossovers} update={(b) => setBands((s) => s.map((x, j) => (j === selected ? b : x)))} />
          </>
        )}

        {view === "panel" && (
          <>
            <RackEars>
              <DeviceFace device={dev} values={vals[activeDevice]} setValue={setVal} switches={sw[activeDevice]} setSwitch={setSwitch} />
            </RackEars>
            <DeviceStrip />
          </>
        )}

        {view === "rack3d" && (
          <>
            <Rack3D device={dev} values={vals[activeDevice]} setValue={setVal} switches={sw[activeDevice]} setSwitch={setSwitch} />
            <DeviceStrip />
          </>
        )}

        <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.faint, textAlign: "center" }}>
          engine: click ON the line → add band (max 6) · click node/region → select · knobs drag vertically · ☀/☾ toggles theme
        </div>
      </div>
    </div>
  );
}
