'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEVICES,
  FACTORY_PRESETS,
  addBandAt,
  bandColor,
  defaultChain,
  getDevice,
  moveCrossover,
  removeBand,
} from '@/dsp/devices';
import { reportedLatencySamples } from '@/dsp/chain';
import { Chain, MAX_BANDS, OUTPUT_RANGE_DB } from '@/dsp/types';
import { EncodeOptions } from '@/dsp/wav';
import { AbPlayer } from '@/lib/ab-player';
import { EngineClient, LoadedInfo, PlaybackPayload, VariantInfo } from '@/lib/engine-client';
import { AboutScreen } from './About';
import { BandChips, BandPanel } from './BandPanel';
import { DeviceFace, Rack3D, RackEars } from './Hardware';
import { PrefsBar } from './PrefsBar';
import { Spectrum } from './Spectrum';
import { DEFAULT_THEME, FONT_LABEL, FONT_MONO, THEMES, THEME_ORDER, ThemeId, shade } from './theme';

type View = 'engine' | 'panel' | 'rack3d';

interface Snapshot {
  id: string;
  name: string;
  chain: Chain;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec - m * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDb(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '−∞';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

/**
 * The faceplate's five knobs are bound to the selected band's real parameters.
 *
 * prd.md §3.3 requires all three views to manipulate one parameter state, so the
 * panel cannot have controls of its own. The labels differ per device because
 * the artwork differs; what they *do* is the same chain underneath.
 */
const FACE_BINDINGS = ['drive', 'character', 'satMix', 'detail', 'output'] as const;

export function TransbandApp() {
  const engineRef = useRef<EngineClient | null>(null);
  const playerRef = useRef<AbPlayer | null>(null);

  const [showAbout, setShowAbout] = useState(true);
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME);
  const [view, setView] = useState<View>('engine');
  const theme = THEMES[themeId];

  const [chain, setChain] = useState<Chain>(() => defaultChain());
  const [selected, setSelected] = useState(1);

  const [loaded, setLoaded] = useState<LoadedInfo | null>(null);
  const [spectrum, setSpectrum] = useState<Float32Array | null>(null);
  const [status, setStatus] = useState<{ stage: string; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [variants, setVariants] = useState<VariantInfo[]>([]);
  const [activeVariant, setActiveVariant] = useState('source');
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [loop, setLoop] = useState(true);

  const [exportOptions, setExportOptions] = useState<EncodeOptions>({
    bitDepth: 32,
    float: true,
    dither: false,
    noiseShaping: false,
  });

  // Faceplate toggles. Cosmetic in v0.1b — the PRD does not yet define their DSP
  // behaviour, so they are not pretending to be wired to anything.
  const [switches, setSwitches] = useState<Record<string, boolean[]>>(() =>
    Object.fromEntries(DEVICES.map((d) => [d.id, d.switches.map((_, i) => i === 0)])),
  );

  const engine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new EngineClient();
    return engineRef.current;
  }, []);

  const player = useCallback(() => {
    if (!playerRef.current) playerRef.current = new AbPlayer();
    return playerRef.current;
  }, []);

  useEffect(
    () => () => {
      playerRef.current?.dispose();
      engineRef.current?.dispose();
    },
    [],
  );

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const p = player();
      setPosition(p.currentTime() / (p.duration || 1));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, player]);

  const band = chain.bands[Math.min(selected, chain.bands.length - 1)];
  const device = getDevice(band.deviceId);
  const colour = bandColor(selected);
  const pdc = useMemo(
    () => reportedLatencySamples(chain, loaded?.sampleRate ?? 48000),
    [chain, loaded],
  );

  const updateBand = useCallback(
    (index: number, next: Chain['bands'][number]) => {
      setChain((current) => ({
        ...current,
        bands: current.bands.map((b, i) => (i === index ? next : b)),
      }));
    },
    [],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setVariants([]);
      setActiveVariant('source');
      player().stop();
      setPlaying(false);
      setStatus({ stage: 'Loading', progress: 0.05 });

      try {
        const info = await engine().load(file, setStatus);
        setLoaded(info);
        await player().load([{ id: 'source', payload: info.playback }], info.sampleRate);
        player().setLoop(loop);
        player().onEnded(() => setPlaying(false));
        const analysis = await engine().spectrum(null, 240);
        setSpectrum(analysis.spectrum);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load that file.');
        setLoaded(null);
      } finally {
        setStatus(null);
      }
    },
    [engine, player, loop],
  );

  const render = useCallback(async () => {
    if (!loaded) return;
    setError(null);
    player().stop();
    setPlaying(false);

    // Always render the live chain; snapshots are rendered alongside it so the
    // comparison includes what you are currently editing.
    const chains = [chain, ...snapshots.map((s) => s.chain)];
    const labels = ['Current', ...snapshots.map((s) => s.name)];

    try {
      setStatus({ stage: 'Rendering', progress: 0 });
      const result = await engine().renderAB(chains, setStatus);

      const named = result.variants.map((variant, i) => ({
        ...variant,
        label: labels[i] ?? variant.label,
      }));
      setVariants(named);

      await player().load(
        [
          { id: 'source', payload: loaded.playback },
          ...named.map((variant, i) => ({
            id: variant.id,
            payload: result.playback[i] as PlaybackPayload,
          })),
        ],
        loaded.sampleRate,
      );
      player().setLoop(loop);
      player().onEnded(() => setPlaying(false));

      const first = named[0]?.id ?? 'source';
      player().select(first);
      setActiveVariant(first);
      const analysis = await engine().spectrum(first, 240);
      setSpectrum(analysis.spectrum);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Rendering failed.');
    } finally {
      setStatus(null);
    }
  }, [loaded, chain, snapshots, engine, player, loop]);

  const selectVariant = useCallback(
    async (id: string) => {
      player().select(id);
      setActiveVariant(id);
      try {
        const analysis = await engine().spectrum(id === 'source' ? null : id, 240);
        setSpectrum(analysis.spectrum);
      } catch {
        // Keep the previous curve rather than blanking the display.
      }
    },
    [player, engine],
  );

  const togglePlay = useCallback(async () => {
    const p = player();
    if (p.isPlaying) {
      p.pause();
      setPlaying(false);
    } else {
      await p.play();
      setPlaying(true);
    }
  }, [player]);

  const download = useCallback(async () => {
    if (!loaded) return;
    setError(null);
    setStatus({ stage: 'Encoding', progress: 0.2 });
    try {
      const result = await engine().export(activeVariant, exportOptions, setStatus);
      const blob = new Blob([result.data], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const base = loaded.fileName.replace(/\.[^.]+$/, '');
      const depth = exportOptions.float ? '32f' : `${exportOptions.bitDepth}`;
      anchor.href = url;
      anchor.download = `${base} — TRANSBAND ${result.label} [${depth}].wav`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed.');
    } finally {
      setStatus(null);
    }
  }, [engine, activeVariant, exportOptions, loaded]);

  const setFaceValue = (index: number, value: number) => {
    const binding = FACE_BINDINGS[index];
    if (!binding) return;
    if (binding === 'output') {
      updateBand(selected, { ...band, outputDb: (value * 2 - 1) * OUTPUT_RANGE_DB });
    } else {
      updateBand(selected, { ...band, [binding]: value });
    }
  };

  const faceValues = FACE_BINDINGS.map((binding) =>
    binding === 'output' ? band.outputDb / OUTPUT_RANGE_DB / 2 + 0.5 : (band[binding] as number),
  );

  const headerButton = (active: boolean): React.CSSProperties => ({
    fontFamily: FONT_LABEL,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 2.5,
    padding: '9px 15px',
    border: 'none',
    cursor: 'pointer',
    background: active ? theme.accentGrad : theme.stripBg,
    color: active ? theme.accentText : theme.stripText,
  });

  const deviceStrip = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))',
        gap: 9,
      }}
    >
      {DEVICES.map((d) => {
        const active = d.id === band.deviceId;
        return (
          <button
            key={d.id}
            onClick={() => updateBand(selected, { ...band, deviceId: d.id })}
            style={{
              textAlign: 'left',
              padding: '9px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              background: active
                ? `linear-gradient(180deg, ${shade(d.face, 10)}, ${shade(d.face, -20)})`
                : theme.stripBg,
              border: `1px solid ${active ? d.accent : theme.stripBorder}`,
              color: active ? d.ink : theme.stripText,
              boxShadow: active ? `0 0 16px ${d.accent}33` : 'none',
            }}
          >
            <div style={{ fontFamily: FONT_LABEL, fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>
              {d.name}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, opacity: 0.62, marginTop: 2 }}>
              {d.sub.toLowerCase()}
            </div>
          </button>
        );
      })}
    </div>
  );

  const panelStyle: React.CSSProperties = {
    background: theme.barBg,
    border: `1px solid ${theme.barBorder}`,
    borderRadius: 8,
    padding: '10px 16px',
  };

  const buttonStyle: React.CSSProperties = {
    fontFamily: FONT_LABEL,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 1.6,
    padding: '8px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    background: theme.segBg,
    border: `1px solid ${theme.segBorder}`,
    color: theme.text,
  };

  const primaryButton: React.CSSProperties = {
    ...buttonStyle,
    background: theme.accentGrad,
    color: theme.accentText,
    border: `1px solid ${theme.accent}`,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '22px 14px',
        color: theme.text,
        background: theme.pageBg,
        transition: 'background .25s ease',
      }}
    >
      {showAbout && <AboutScreen onClose={() => setShowAbout(false)} theme={theme} />}

      <div
        style={{
          maxWidth: 1060,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 13,
        }}
      >
        {/* ---- header ---- */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div
              style={{
                fontFamily: FONT_LABEL,
                fontWeight: 800,
                fontSize: 26,
                letterSpacing: 5,
                color: theme.header,
              }}
            >
              TRANS<span style={{ color: theme.accent }}>BAND</span>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: theme.sub }}>
              multiTransBender · v0.1b
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                borderRadius: 6,
                overflow: 'hidden',
                border: `1px solid ${theme.segBorder}`,
              }}
            >
              {(
                [
                  ['engine', 'ENGINE'],
                  ['panel', 'PANEL'],
                  ['rack3d', 'RACK 3D'],
                ] as Array<[View, string]>
              ).map(([id, label]) => (
                <button key={id} onClick={() => setView(id)} style={headerButton(view === id)}>
                  {label}
                </button>
              ))}
            </div>
            <select
              value={themeId}
              onChange={(event) => setThemeId(event.target.value as ThemeId)}
              aria-label="Theme"
              title="Chrome theme — faceplate colours never change"
              style={{
                fontFamily: FONT_LABEL,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.6,
                padding: '9px 11px',
                borderRadius: 6,
                cursor: 'pointer',
                background: theme.stripBg,
                color: theme.stripText,
                border: `1px solid ${theme.segBorder}`,
              }}
            >
              {THEME_ORDER.map((id) => (
                <option key={id} value={id}>
                  {THEMES[id].name.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAbout(true)}
              style={{
                ...headerButton(false),
                borderRadius: 6,
                border: `1px solid ${theme.segBorder}`,
              }}
            >
              ABOUT
            </button>
          </div>
        </div>

        <PrefsBar theme={theme} chain={chain} onChange={setChain} pdcSamples={pdc} />

        {/* ---- session bar: file, transport, A/B, export ---- */}
        <div style={panelStyle}>
          {!loaded ? (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              style={{
                border: `1px dashed ${dragging ? theme.accent : theme.segBorder}`,
                borderRadius: 8,
                padding: '26px 16px',
                textAlign: 'center',
                background: dragging ? `${theme.accent}0d` : 'transparent',
              }}
            >
              <div
                style={{
                  fontFamily: FONT_LABEL,
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: 2,
                  marginBottom: 6,
                  color: theme.header,
                }}
              >
                DROP AN AUDIO FILE
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: theme.sub, marginBottom: 14 }}>
                WAV and AIFF are read natively at their own rate and depth · nothing is uploaded
              </div>
              <label style={{ ...primaryButton, display: 'inline-block' }}>
                CHOOSE FILE
                <input
                  type="file"
                  accept="audio/*,.wav,.aiff,.aif,.flac,.mp3,.m4a"
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                  }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </label>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  fontFamily: FONT_MONO,
                  fontSize: 9.5,
                  color: theme.sub,
                }}
              >
                <strong style={{ color: theme.header }}>{loaded.fileName}</strong>
                <span>{(loaded.sampleRate / 1000).toFixed(1)} kHz</span>
                <span>
                  {loaded.container === 'decoded'
                    ? 'decoded'
                    : `${loaded.sourceBitDepth}-bit ${loaded.sourceFormat}`}
                </span>
                <span>{loaded.channelCount === 1 ? 'mono' : 'stereo'}</span>
                <span>{formatTime(loaded.durationSec)}</span>
                <span>{formatDb(loaded.loudness.integratedLufs)} LUFS</span>
                <span>{formatDb(loaded.loudness.truePeakDb)} dBTP</span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={togglePlay} style={primaryButton}>
                  {playing ? 'PAUSE' : 'PLAY'}
                </button>
                <button
                  onClick={() => {
                    player().stop();
                    setPlaying(false);
                    setPosition(0);
                  }}
                  style={buttonStyle}
                >
                  STOP
                </button>
                <label
                  style={{
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                    fontFamily: FONT_MONO,
                    fontSize: 9.5,
                    color: theme.sub,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={loop}
                    onChange={(event) => {
                      setLoop(event.target.checked);
                      player().setLoop(event.target.checked);
                    }}
                  />
                  LOOP
                </label>
                <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: theme.sub }}>
                  {formatTime(position * loaded.durationSec)} / {formatTime(loaded.durationSec)}
                </span>

                <button
                  onClick={() =>
                    setSnapshots((current) =>
                      current.length >= 3
                        ? current
                        : [
                            ...current,
                            {
                              id: `snap-${Date.now()}`,
                              name: String.fromCharCode(65 + current.length),
                              chain: JSON.parse(JSON.stringify(chain)) as Chain,
                            },
                          ],
                    )
                  }
                  style={{ ...buttonStyle, marginLeft: 'auto' }}
                  disabled={snapshots.length >= 3}
                  title="Freeze the current settings as an A/B candidate"
                >
                  CAPTURE A/B
                </button>
                {snapshots.length > 0 && (
                  <button onClick={() => setSnapshots([])} style={buttonStyle}>
                    CLEAR ({snapshots.length})
                  </button>
                )}
                <button onClick={render} disabled={Boolean(status)} style={primaryButton}>
                  {variants.length > 0 ? 'RE-RENDER' : 'RENDER'}
                </button>
              </div>

              {status && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: FONT_MONO,
                      fontSize: 9,
                      color: theme.sub,
                      marginBottom: 4,
                    }}
                  >
                    <span>{status.stage}</span>
                    <span>{Math.round(status.progress * 100)}%</span>
                  </div>
                  <div
                    style={{
                      height: 3,
                      background: theme.segBg,
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${status.progress * 100}%`,
                        background: theme.accent,
                        transition: 'width .15s ease',
                      }}
                    />
                  </div>
                </div>
              )}

              {variants.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span
                    style={{
                      fontFamily: FONT_LABEL,
                      fontSize: 9,
                      letterSpacing: 2,
                      color: theme.sub,
                      fontWeight: 800,
                    }}
                  >
                    COMPARE
                  </span>
                  {[
                    { id: 'source', label: 'SOURCE', lufs: loaded.loudness.integratedLufs, match: 0 },
                    ...variants.map((v) => ({
                      id: v.id,
                      label: v.label.toUpperCase(),
                      lufs: v.loudness.integratedLufs,
                      match: v.matchGainDb,
                    })),
                  ].map((entry) => {
                    const active = entry.id === activeVariant;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => void selectVariant(entry.id)}
                        style={{
                          ...buttonStyle,
                          padding: '6px 11px',
                          background: active ? theme.accentGrad : theme.segBg,
                          color: active ? theme.accentText : theme.segText,
                          border: `1px solid ${active ? theme.accent : theme.segBorder}`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 1,
                        }}
                      >
                        <span>{entry.label}</span>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 7.5, opacity: 0.8 }}>
                          {formatDb(entry.lufs)} LUFS
                          {entry.match ? ` · ${formatDb(entry.match)} match` : ''}
                        </span>
                      </button>
                    );
                  })}
                  <span
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 8,
                      color: theme.faint,
                      marginLeft: 4,
                    }}
                  >
                    level matched · sample aligned · switching never reseeks
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={exportOptions.float ? 'float32' : String(exportOptions.bitDepth)}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === 'float32') {
                      setExportOptions({
                        bitDepth: 32,
                        float: true,
                        dither: false,
                        noiseShaping: false,
                      });
                    } else {
                      setExportOptions({
                        bitDepth: Number(value) as 16 | 24,
                        float: false,
                        dither: true,
                        noiseShaping: false,
                      });
                    }
                  }}
                  aria-label="Export format"
                  style={{
                    background: theme.ctrlBg,
                    color: theme.ctrlText,
                    border: `1px solid ${theme.segBorder}`,
                    borderRadius: 5,
                    padding: '7px 9px',
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                  }}
                >
                  <option value="float32">WAV 32-bit float · lossless</option>
                  <option value="24">WAV 24-bit PCM · dithered</option>
                  <option value="16">WAV 16-bit PCM · dithered</option>
                </select>
                <button onClick={download} disabled={Boolean(status)} style={buttonStyle}>
                  DOWNLOAD {activeVariant === 'source' ? 'SOURCE' : 'PROCESSED'}
                </button>
                <button
                  onClick={async () => {
                    await engine().clear();
                    await player().dispose();
                    playerRef.current = null;
                    setLoaded(null);
                    setVariants([]);
                    setSpectrum(null);
                    setPlaying(false);
                    setPosition(0);
                  }}
                  style={buttonStyle}
                >
                  CLEAR AUDIO
                </button>
                <span
                  style={{ fontFamily: FONT_MONO, fontSize: 8, color: theme.faint, marginLeft: 'auto' }}
                >
                  {exportOptions.float
                    ? 'engine output verbatim — no quantisation, no dither, no clipping'
                    : 'quantised with TPDF dither'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 10,
                fontFamily: FONT_MONO,
                fontSize: 9.5,
                color: '#e0473d',
                borderLeft: '2px solid #e0473d',
                paddingLeft: 10,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* ---- views ---- */}
        {view === 'engine' && (
          <>
            <Spectrum
              theme={theme}
              spectrum={spectrum}
              crossovers={chain.crossoverHz}
              bands={chain.bands}
              selected={selected}
              maxBands={MAX_BANDS}
              onSelect={setSelected}
              onAddAt={(freq) => {
                setChain((current) => {
                  const next = addBandAt(current, freq);
                  if (next !== current) {
                    const sorted = [...next.crossoverHz].sort((a, b) => a - b);
                    setSelected(sorted.indexOf(freq) + 1);
                  }
                  return next;
                });
              }}
              onMoveCrossover={(index, freq) =>
                setChain((current) => moveCrossover(current, index, freq))
              }
            />

            <BandChips
              theme={theme}
              bands={chain.bands}
              crossovers={chain.crossoverHz}
              selected={selected}
              onSelect={setSelected}
              onToggle={(i) =>
                setChain((current) => ({
                  ...current,
                  bands: current.bands.map((b, j) => (j === i ? { ...b, on: !b.on } : b)),
                }))
              }
              onSolo={(i) =>
                setChain((current) => ({
                  ...current,
                  bands: current.bands.map((b, j) => (j === i ? { ...b, solo: !b.solo } : b)),
                }))
              }
              onRemove={(i) => {
                setChain((current) => removeBand(current, i));
                setSelected((current) => Math.max(0, current >= i ? current - 1 : current));
              }}
            />

            <BandPanel
              theme={theme}
              band={band}
              index={selected}
              crossovers={chain.crossoverHz}
              update={(next) => updateBand(selected, next)}
            />

            <div style={panelStyle}>
              <div
                style={{
                  fontFamily: FONT_LABEL,
                  fontSize: 9,
                  letterSpacing: 2,
                  color: theme.sub,
                  fontWeight: 800,
                  marginBottom: 8,
                }}
              >
                FACTORY BANK
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))',
                  gap: 8,
                }}
              >
                {FACTORY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setChain(JSON.parse(JSON.stringify(preset.chain)) as Chain);
                      setSelected(0);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '9px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: theme.stripBg,
                      border: `1px solid ${theme.stripBorder}`,
                      color: theme.stripText,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: FONT_LABEL,
                        fontWeight: 800,
                        fontSize: 11.5,
                        letterSpacing: 1,
                        color: theme.chipText,
                      }}
                    >
                      {preset.name}
                      <span style={{ color: theme.faint, marginLeft: 6, fontSize: 8.5 }}>
                        {preset.group}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 8,
                        opacity: 0.75,
                        marginTop: 3,
                        lineHeight: 1.5,
                      }}
                    >
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {view === 'panel' && (
          <>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 9,
                color: theme.sub,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: colour, fontWeight: 700 }}>BAND {selected + 1}</span>
              <span>·</span>
              <span>faceplate controls the selected band — one state, three views</span>
            </div>
            <RackEars>
              <DeviceFace
                device={device}
                values={faceValues}
                setValue={setFaceValue}
                switches={switches[device.id] ?? []}
                setSwitch={(i) =>
                  setSwitches((current) => ({
                    ...current,
                    [device.id]: (current[device.id] ?? []).map((v, j) => (j === i ? !v : v)),
                  }))
                }
                meterLevel={0.2 + band.drive * 0.7}
              />
            </RackEars>
            <BandChips
              theme={theme}
              bands={chain.bands}
              crossovers={chain.crossoverHz}
              selected={selected}
              onSelect={setSelected}
              onToggle={(i) =>
                setChain((current) => ({
                  ...current,
                  bands: current.bands.map((b, j) => (j === i ? { ...b, on: !b.on } : b)),
                }))
              }
              onSolo={(i) =>
                setChain((current) => ({
                  ...current,
                  bands: current.bands.map((b, j) => (j === i ? { ...b, solo: !b.solo } : b)),
                }))
              }
              onRemove={(i) => {
                setChain((current) => removeBand(current, i));
                setSelected((current) => Math.max(0, current >= i ? current - 1 : current));
              }}
            />
            {deviceStrip}
          </>
        )}

        {view === 'rack3d' && (
          <>
            <Rack3D
              device={device}
              values={faceValues}
              setValue={setFaceValue}
              switches={switches[device.id] ?? []}
              setSwitch={(i) =>
                setSwitches((current) => ({
                  ...current,
                  [device.id]: (current[device.id] ?? []).map((v, j) => (j === i ? !v : v)),
                }))
              }
              meterLevel={0.2 + band.drive * 0.7}
            />
            {deviceStrip}
          </>
        )}

        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            color: theme.faint,
            textAlign: 'center',
            lineHeight: 1.8,
          }}
        >
          engine: click ON the line → add band (max 6) · click node/region → select · knobs drag
          vertically, shift for fine, double-click to reset · four chrome themes in the header
          <br />
          audio is processed in this tab and never uploaded
        </div>
      </div>
    </div>
  );
}
