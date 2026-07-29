import React, { useState, useRef, useCallback } from "react";

/* ============================================================
   RACKFORGE v0.3 — MULTIBAND TRANSIENT ENGINE
   Large interactive spectrum display:
   · Click anywhere on the spectrum to CREATE a band split
     at that frequency (max 6 bands)
   · Drag the crossover handles to move splits
   · Select a band (click its chip or region) for its full
     control set: independent transient shaping + saturation
   · × on a chip removes the band (merges with neighbor)
   Panel view (hardware skins) lives in v0.2 — merges in v0.4.
   ============================================================ */

const FONT_LABEL = "'Avenir Next Condensed','Arial Narrow','Helvetica Neue',sans-serif";
const FONT_MONO = "'SF Mono','JetBrains Mono',Menlo,monospace";

const BAND_COLORS = ["#e0574f", "#e0913c", "#e8c94f", "#5fc47a", "#8db9e8", "#a98fe0"];

const DEVICES = [
  { id: "vulture", name: "VULTURE", sub: "valve distortion", accent: "#a5322b" },
  { id: "fatso", name: "PHATSO 7x", sub: "tape sim / optimizer", accent: "#43c96e" },
  { id: "hg2", name: "HG·II", sub: "pentode + triode", accent: "#d3a24a" },
  { id: "vitalizer", name: "REVITALIZER", sub: "program eq · tube", accent: "#8db9e8" },
  { id: "portico", name: "P·542", sub: "tape · silk", accent: "#c33b36" },
  { id: "glats1", name: "WIZARD TS·1", sub: "stereo tube sat", accent: "#e0913c" },
  { id: "boum", name: "BØM", sub: "warming processor", accent: "#e0574f" },
  { id: "sa2rate", name: "SA²RATE", sub: "even-harmonic sat", accent: "#d97c25" },
  { id: "carnaby", name: "CARNABY", sub: "harmonic eq", accent: "#e0524d" },
  { id: "overstayer", name: "M·A·S", sub: "harmonics / density", accent: "#f2b02c" },
];

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (x) => Math.min(255, Math.max(0, x + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

const fmtHz = (f) => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)}k` : `${Math.round(f)}`);

const defaultBand = () => ({
  attack: 0.5, sustain: 0.5, detail: 0.5, mix: 1, output: 0.5,
  device: "sa2rate", drive: 0.4, character: 0.5, satMix: 0.7,
  on: true, solo: false,
});

/* ---------------- KNOB ---------------- */
function Knob({ label, value, onChange, size = 52, accent = "#e8c94f", knobFace = "#23262d", pointer, ink = "#c8cdd6", format }) {
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
  const polar = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cr + arcR * Math.cos(rad), cr + arcR * Math.sin(rad)];
  };
  const [sx, sy] = polar(a0), [tx, ty] = polar(a1), [ex, ey] = polar(ang);
  const large = ang - a0 > 180 ? 1 : 0;
  const pc = pointer || accent;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, userSelect: "none", touchAction: "none", width: box + 6 }}>
      <div onPointerDown={down} style={{ position: "relative", width: box, height: box, cursor: "ns-resize" }}>
        <svg width={box} height={box} style={{ position: "absolute", inset: 0 }}>
          <path d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 1 1 ${tx} ${ty}`} fill="none" stroke="rgba(120,120,130,.22)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 ${large} 1 ${ex} ${ey}`} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${accent})` }} />
        </svg>
        <div style={{
          position: "absolute", left: pad - 3, top: pad - 3, width: size + 6, height: size + 6, borderRadius: "50%",
          background: "radial-gradient(circle at 50% 35%, rgba(0,0,0,.15), rgba(0,0,0,.55))",
          boxShadow: "0 5px 12px rgba(0,0,0,.55)",
        }} />
        <div style={{
          position: "absolute", left: pad, top: pad, width: size, height: size, borderRadius: "50%",
          background: `radial-gradient(circle at 36% 26%, ${shade(knobFace, 55)}, ${knobFace} 48%, ${shade(knobFace, -50)} 95%)`,
          boxShadow: "inset 0 1px 2px rgba(255,255,255,.28), inset 0 -3px 6px rgba(0,0,0,.45)",
          transform: `rotate(${ang}deg)`,
        }}>
          <div style={{ position: "absolute", left: "50%", top: size * 0.08, width: 3.5, height: size * 0.36, marginLeft: -1.75, background: pc, borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ fontFamily: FONT_LABEL, fontSize: 9, letterSpacing: 1.4, color: ink, fontWeight: 700, textAlign: "center" }}>{label}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: ink, opacity: 0.6 }}>{format ? format(value) : Math.round(value * 100)}</div>
    </div>
  );
}

/* ---------------- SPECTRUM DISPLAY ---------------- */
const W = 940, H = 320, PADL = 34, PADR = 12, PADT = 14, PADB = 26;
const PW = W - PADL - PADR, PH = H - PADT - PADB;
const fToX = (f) => PADL + (Math.log10(f / 20) / 3) * PW;
const xToF = (x) => 20 * Math.pow(10, ((x - PADL) / PW) * 3);

function spectrumPath() {
  // aesthetic program-material curve (illustrative, not real analysis)
  const pts = [];
  for (let i = 0; i <= 140; i++) {
    const f = 20 * Math.pow(10, (i / 140) * 3);
    let m = -6 - 9 * Math.log10(f / 60);
    m += 10 * Math.exp(-Math.pow(Math.log10(f / 55), 2) * 14);   // kick
    m += 5 * Math.exp(-Math.pow(Math.log10(f / 240), 2) * 18);   // low mids
    m += 4 * Math.exp(-Math.pow(Math.log10(f / 2600), 2) * 12);  // presence
    m += 2.5 * Math.exp(-Math.pow(Math.log10(f / 9000), 2) * 16); // air
    const y = PADT + PH * (0.18 + Math.min(1, Math.max(0, (6 - m) / 42)) * 0.8);
    pts.push([fToX(f), y]);
  }
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L ${fToX(20000)} ${PADT + PH} L ${fToX(20)} ${PADT + PH} Z` };
}
const SPEC = spectrumPath();

function SpectrumDisplay({ crossovers, bands, selected, onSelect, onAddAt, onMoveXover, maxBands }) {
  const svgRef = useRef(null);
  const dragging = useRef(null);

  const clientToX = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  };

  const handleClick = (e) => {
    if (dragging.current !== null) return;
    const x = clientToX(e);
    if (x < PADL + 6 || x > W - PADR - 6) return;
    const f = xToF(x);
    // near an existing handle? ignore (that's a drag zone)
    if (crossovers.some((c) => Math.abs(fToX(c) - x) < 12)) return;
    if (bands.length >= maxBands) {
      // select the band under the click instead
      const idx = crossovers.findIndex((c) => f < c);
      onSelect(idx === -1 ? bands.length - 1 : idx);
      return;
    }
    onAddAt(f);
  };

  const startDrag = (i) => (e) => {
    e.stopPropagation(); e.preventDefault();
    dragging.current = i;
    const move = (ev) => {
      const x = Math.min(W - PADR - 8, Math.max(PADL + 8, clientToX(ev)));
      onMoveXover(i, xToF(x));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setTimeout(() => (dragging.current = null), 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const edges = [20, ...crossovers, 20000];

  return (
    <div style={{ borderRadius: 10, overflow: "hidden", boxShadow: "inset 0 2px 10px rgba(0,0,0,.7), 0 1px 0 rgba(255,255,255,.05)" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", background: "linear-gradient(180deg,#06080b,#0c0f14)", cursor: "crosshair" }} onClick={handleClick}>
        {/* grid */}
        {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((f) => (
          <g key={f}>
            <line x1={fToX(f)} x2={fToX(f)} y1={PADT} y2={PADT + PH} stroke="rgba(140,160,190,.07)" />
            <text x={fToX(f)} y={H - 8} fill="#4a5462" fontSize="9" fontFamily={FONT_MONO} textAnchor="middle">{fmtHz(f)}</text>
          </g>
        ))}
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={PADL} x2={W - PADR} y1={PADT + PH * t} y2={PADT + PH * t} stroke="rgba(140,160,190,.05)" />
        ))}
        {[-12, -24, -36].map((db, i) => (
          <text key={db} x={6} y={PADT + PH * (0.25 * (i + 1)) + 3} fill="#4a5462" fontSize="8.5" fontFamily={FONT_MONO}>{db}</text>
        ))}

        {/* band tints */}
        {bands.map((b, i) => {
          const x0 = fToX(edges[i]), x1 = fToX(edges[i + 1]);
          const col = BAND_COLORS[i];
          const sel = i === selected;
          return (
            <g key={i} onClick={(e) => { e.stopPropagation(); if (dragging.current === null) onSelect(i); }} style={{ cursor: "pointer" }}>
              <rect x={x0} y={PADT} width={x1 - x0} height={PH}
                fill={col} opacity={b.on ? (sel ? 0.16 : 0.07) : 0.02} />
              {sel && <rect x={x0} y={PADT} width={x1 - x0} height={3} fill={col} />}
              {/* attack marker (solid) and sustain marker (dashed) per band */}
              {b.on && (
                <>
                  <line x1={x0 + 5} x2={x1 - 5} y1={PADT + PH * (0.5 - (b.attack - 0.5) * 0.55)} y2={PADT + PH * (0.5 - (b.attack - 0.5) * 0.55)}
                    stroke={col} strokeWidth={sel ? 2.4 : 1.5} style={sel ? { filter: `drop-shadow(0 0 3px ${col})` } : undefined} />
                  <line x1={x0 + 5} x2={x1 - 5} y1={PADT + PH * (0.5 - (b.sustain - 0.5) * 0.55)} y2={PADT + PH * (0.5 - (b.sustain - 0.5) * 0.55)}
                    stroke={col} strokeWidth="1.3" strokeDasharray="5 4" opacity="0.75" />
                </>
              )}
              <text x={(x0 + x1) / 2} y={PADT + 16} fill={b.on ? col : "#3a414c"} fontSize="11" fontWeight="800" fontFamily={FONT_LABEL} textAnchor="middle" letterSpacing="2">
                {`B${i + 1}`}{b.solo ? " · S" : ""}{!b.on ? " · OFF" : ""}
              </text>
            </g>
          );
        })}

        {/* spectrum */}
        <path d={SPEC.area} fill="rgba(141,185,232,.10)" pointerEvents="none" />
        <path d={SPEC.line} fill="none" stroke="rgba(141,185,232,.55)" strokeWidth="1.6" pointerEvents="none" />

        {/* crossover handles */}
        {crossovers.map((c, i) => {
          const x = fToX(c);
          return (
            <g key={i} onPointerDown={startDrag(i)} style={{ cursor: "ew-resize" }}>
              <line x1={x} x2={x} y1={PADT} y2={PADT + PH} stroke="#e8e4d8" strokeWidth="1.4" opacity="0.85" />
              <rect x={x - 10} y={PADT} width={20} height={PH} fill="transparent" />
              <rect x={x - 15} y={PADT + PH - 20} width={30} height={16} rx={3} fill="#1a1e25" stroke="#3a404c" />
              <text x={x} y={PADT + PH - 8} fill="#dfe3ea" fontSize="8.5" fontFamily={FONT_MONO} textAnchor="middle">{fmtHz(c)}</text>
              <circle cx={x} cy={PADT + 6} r={4.5} fill="#e8e4d8" />
            </g>
          );
        })}

        {/* hint */}
        <text x={W - PADR - 4} y={PADT + 14} fill="#3f4855" fontSize="8.5" fontFamily={FONT_MONO} textAnchor="end">
          {bands.length < maxBands ? "click spectrum → add band split" : "max 6 bands"} · drag handles · solid = attack · dashed = sustain
        </text>
      </svg>
    </div>
  );
}

/* ---------------- BAND CHIPS ---------------- */
function BandChips({ bands, crossovers, selected, onSelect, onToggle, onSolo, onRemove }) {
  const edges = [20, ...crossovers, 20000];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {bands.map((b, i) => {
        const col = BAND_COLORS[i];
        const sel = i === selected;
        return (
          <div key={i} onClick={() => onSelect(i)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, cursor: "pointer",
            background: sel ? `linear-gradient(180deg, ${col}26, ${col}10)` : "linear-gradient(180deg,#14171c,#0f1115)",
            border: `1px solid ${sel ? col : "#262a32"}`,
            boxShadow: sel ? `0 0 14px ${col}30` : "0 2px 6px rgba(0,0,0,.3)",
            opacity: b.on ? 1 : 0.55,
          }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: col }} />
            <div>
              <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 11.5, letterSpacing: 1.2, color: sel ? col : "#aab1bc" }}>BAND {i + 1}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#5a6572" }}>{fmtHz(edges[i])}–{fmtHz(edges[i + 1])} Hz</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onSolo(i); }} style={chipBtn(b.solo, "#e8c94f")}>S</button>
            <button onClick={(e) => { e.stopPropagation(); onToggle(i); }} style={chipBtn(b.on, col)}>{b.on ? "ON" : "OFF"}</button>
            {bands.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); onRemove(i); }} style={{ ...chipBtn(false, "#e0473d"), padding: "2px 7px" }}>×</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const chipBtn = (on, color) => ({
  fontFamily: FONT_LABEL, fontSize: 8.5, fontWeight: 800, letterSpacing: 1,
  padding: "3px 7px", borderRadius: 4, cursor: "pointer",
  background: on ? `linear-gradient(180deg, ${color}, ${shade(color, -35)})` : "#14161a",
  color: on ? "#0d0f12" : "#6b7480",
  border: `1px solid ${on ? color : "#2c3038"}`,
});

/* ---------------- ENVELOPE MINI ---------------- */
function EnvelopeMini({ attack, sustain, color }) {
  const a = (attack - 0.5) * 2, s = (sustain - 0.5) * 2;
  const mk = (aa, ss) => {
    const pts = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const env = Math.exp(-t * 6) * (1 + aa * 0.9) + Math.exp(-t * 1.4) * 0.35 * (1 + ss * 1.2);
      pts.push(`${i * 2.4},${66 - Math.min(1.18, env) * 52}`);
    }
    return pts.join(" ");
  };
  return (
    <svg width="240" height="74" style={{ display: "block", background: "linear-gradient(180deg,#07090c,#0c0f14)", borderRadius: 8, boxShadow: "inset 0 2px 6px rgba(0,0,0,.7)" }}>
      {[18, 36, 54].map((y) => <line key={y} x1="0" x2="240" y1={y} y2={y} stroke="rgba(140,160,190,.06)" />)}
      <polyline points={mk(0, 0)} fill="none" stroke="rgba(141,185,232,.35)" strokeWidth="1.3" strokeDasharray="4 3" />
      <polyline points={mk(a, s)} fill="none" stroke={color} strokeWidth="2" style={{ filter: `drop-shadow(0 0 4px ${color}99)` }} />
      <text x="8" y="13" fill="#5f6b7a" fontSize="7.5" fontFamily={FONT_MONO}>BAND ENVELOPE</text>
    </svg>
  );
}

/* ---------------- BAND CONTROL PANEL ---------------- */
function BandPanel({ band, index, crossovers, update }) {
  const col = BAND_COLORS[index];
  const edges = [20, ...crossovers, 20000];
  const dev = DEVICES.find((d) => d.id === band.device);
  const ink = "#c8cdd6";
  const set = (k) => (v) => update({ ...band, [k]: v });

  const groupLabel = (t, c) => (
    <div style={{ fontFamily: FONT_LABEL, fontSize: 9, letterSpacing: 2.5, color: c || "#6d7684", fontWeight: 800, marginBottom: 8 }}>{t}</div>
  );

  return (
    <div style={{
      background: "linear-gradient(180deg,#191c22,#131519)", borderRadius: 10, padding: "14px 18px",
      border: `1px solid ${col}44`, borderTop: `3px solid ${col}`,
      boxShadow: `0 10px 24px rgba(0,0,0,.45), 0 0 30px ${col}12, inset 0 1px 0 rgba(255,255,255,.05)`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 16, letterSpacing: 2, color: col }}>BAND {index + 1}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#6b7480" }}>{fmtHz(edges[index])}–{fmtHz(edges[index + 1])} Hz · full independent chain</div>
      </div>

      <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* transient group */}
        <div>
          {groupLabel("TRANSIENT", col)}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Knob label="ATTACK" value={band.attack} onChange={set("attack")} accent={col} ink={ink} format={(v) => `${((v - 0.5) * 30).toFixed(1)} dB`} />
            <Knob label="SUSTAIN" value={band.sustain} onChange={set("sustain")} accent={col} ink={ink} format={(v) => `${((v - 0.5) * 48).toFixed(1)} dB`} />
            <Knob label="DETAIL" value={band.detail} onChange={set("detail")} accent="#8db9e8" ink={ink} />
            <EnvelopeMini attack={band.attack} sustain={band.sustain} color={col} />
          </div>
        </div>

        {/* saturation group */}
        <div>
          {groupLabel("SATURATION ENGINE", dev.accent)}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginRight: 6 }}>
              <select value={band.device} onChange={(e) => update({ ...band, device: e.target.value })} style={{
                background: "#181b21", color: "#e6e2d6", border: `1px solid ${dev.accent}55`,
                borderRadius: 5, padding: "7px 9px", fontFamily: FONT_LABEL, fontSize: 12, letterSpacing: 0.5,
                boxShadow: "inset 0 1px 3px rgba(0,0,0,.5)", minWidth: 150,
              }}>
                {DEVICES.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: dev.accent, opacity: 0.8 }}>{dev.sub}</div>
            </div>
            <Knob label="DRIVE" value={band.drive} onChange={set("drive")} accent={dev.accent} ink={ink} />
            <Knob label="CHARACTER" value={band.character} onChange={set("character")} accent={dev.accent} ink={ink} />
            <Knob label="SAT MIX" value={band.satMix} onChange={set("satMix")} accent="#c8cdd6" ink={ink} format={(v) => `${Math.round(v * 100)}%`} />
          </div>
        </div>

        {/* band out group */}
        <div>
          {groupLabel("BAND OUT")}
          <div style={{ display: "flex", gap: 6 }}>
            <Knob label="MIX" value={band.mix} onChange={set("mix")} accent="#c8cdd6" ink={ink} format={(v) => `${Math.round(v * 100)}%`} />
            <Knob label="OUTPUT" value={band.output} onChange={set("output")} accent="#c8cdd6" ink={ink} format={(v) => `${((v - 0.5) * 24).toFixed(1)} dB`} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PREFS ---------------- */
function PrefsBar({ prefs, setPrefs, bandCount }) {
  const seg = (opts, key) => (
    <div style={{ display: "flex", background: "#0d0f13", border: "1px solid #2a2e36", borderRadius: 5, overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,.5)" }}>
      {opts.map((o) => (
        <button key={o} onClick={() => setPrefs({ ...prefs, [key]: o })} style={{
          fontFamily: FONT_MONO, fontSize: 9.5, padding: "6px 10px", cursor: "pointer", border: "none",
          background: prefs[key] === o ? "linear-gradient(180deg,#f2d868,#d9b53a)" : "transparent",
          color: prefs[key] === o ? "#14161a" : "#8a93a0", fontWeight: prefs[key] === o ? 700 : 400,
        }}>{o}</button>
      ))}
    </div>
  );
  const lbl = (t) => <span style={{ fontFamily: FONT_LABEL, fontSize: 9, letterSpacing: 2, color: "#5f6774", fontWeight: 800 }}>{t}</span>;
  const pdc = prefs.latency === "ZERO" ? 0 : prefs.latency === "BALANCED" ? 64 : 1024 + bandCount * 512;
  return (
    <div style={{
      display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", padding: "10px 16px",
      background: "linear-gradient(180deg,#111318,#0c0e11)", borderRadius: 8, border: "1px solid #23262e",
      boxShadow: "0 6px 16px rgba(0,0,0,.4)",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{lbl("PRECISION")}{seg(["32-BIT", "64-BIT"], "precision")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{lbl("OVERSAMPLING")}{seg(["OFF", "2×", "4×", "8×", "16×"], "os")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{lbl("LATENCY MODE")}{seg(["ZERO", "BALANCED", "HQ LINEAR"], "latency")}</div>
      <div style={{ marginLeft: "auto", fontFamily: FONT_MONO, fontSize: 9, color: "#5a6572", textAlign: "right", lineHeight: 1.6 }}>
        {bandCount} bands · PDC {pdc} smp<br />
        {prefs.latency === "ZERO" ? "IIR crossovers · 0 added latency at any band count" : prefs.latency === "HQ LINEAR" ? "linear-phase FIR · PDC grows with band count" : "hybrid · fixed small PDC"}
      </div>
    </div>
  );
}

/* ---------------- APP ---------------- */
export default function RackForgeEngine() {
  const [crossovers, setCrossovers] = useState([180, 2500]);
  const [bands, setBands] = useState([defaultBand(), { ...defaultBand(), device: "vulture" }, { ...defaultBand(), device: "hg2" }]);
  const [selected, setSelected] = useState(1);
  const [prefs, setPrefs] = useState({ precision: "64-BIT", os: "4×", latency: "ZERO" });
  const MAX = 6;

  const addAt = (f) => {
    if (bands.length >= MAX) return;
    const idx = crossovers.findIndex((c) => f < c);
    const insertAt = idx === -1 ? crossovers.length : idx;
    const newX = [...crossovers.slice(0, insertAt), f, ...crossovers.slice(insertAt)];
    const src = bands[insertAt];
    const newB = [...bands.slice(0, insertAt + 1), { ...src }, ...bands.slice(insertAt + 1)];
    setCrossovers(newX);
    setBands(newB);
    setSelected(insertAt + 1);
  };

  const moveXover = (i, f) => {
    const lo = (i === 0 ? 22 : crossovers[i - 1]) * 1.15;
    const hi = (i === crossovers.length - 1 ? 18000 : crossovers[i + 1]) / 1.15;
    setCrossovers((s) => s.map((c, j) => (j === i ? Math.min(hi, Math.max(lo, f)) : c)));
  };

  const removeBand = (i) => {
    if (bands.length <= 1) return;
    const xi = i === 0 ? 0 : i - 1;
    setCrossovers((s) => s.filter((_, j) => j !== xi));
    setBands((s) => s.filter((_, j) => j !== i));
    setSelected(Math.max(0, Math.min(selected, bands.length - 2)));
  };

  return (
    <div style={{
      minHeight: "100vh", padding: "24px 16px", color: "#c8cdd6",
      background: "radial-gradient(1400px 700px at 50% -15%, #23262e, #0a0b0d 65%)",
    }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", display: "flex", flexDirection: "column", gap: 13 }}>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 27, letterSpacing: 5, color: "#efece2", textShadow: "0 2px 4px rgba(0,0,0,.6)" }}>
              RACK<span style={{ color: "#e8c94f" }}>FORGE</span>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#5a6572" }}>multiband transient engine · preview v0.3</div>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#5a6572" }}>panel view (hardware skins): see v0.2 — merged in v0.4</div>
        </div>

        <PrefsBar prefs={prefs} setPrefs={setPrefs} bandCount={bands.length} />

        <SpectrumDisplay
          crossovers={crossovers} bands={bands} selected={selected}
          onSelect={setSelected} onAddAt={addAt} onMoveXover={moveXover} maxBands={MAX}
        />

        <BandChips
          bands={bands} crossovers={crossovers} selected={selected}
          onSelect={setSelected}
          onToggle={(i) => setBands((s) => s.map((b, j) => (j === i ? { ...b, on: !b.on } : b)))}
          onSolo={(i) => setBands((s) => s.map((b, j) => (j === i ? { ...b, solo: !b.solo } : b)))}
          onRemove={removeBand}
        />

        <BandPanel
          band={bands[selected]} index={selected} crossovers={crossovers}
          update={(b) => setBands((s) => s.map((x, j) => (j === selected ? b : x)))}
        />

        <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#3f4550", textAlign: "center" }}>
          click spectrum to split · drag handles to move crossovers · chips select / solo / bypass / remove · spectrum curve is illustrative
        </div>
      </div>
    </div>
  );
}
