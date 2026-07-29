/**
 * MultiTransBend · core types.
 *
 * Follows the parameter surface defined in design/transband/prd.md §3.1:
 * 1–6 bands, each a fully independent chain with its own transient shaping AND
 * its own saturation engine. That per-band independence is the whole product —
 * a single global device would be a different, smaller plugin.
 *
 * Values are stored in real units (dB, Hz, ms) rather than the normalised 0–1
 * the GUI mockup uses. Presets are then readable, diffable, and survive a change
 * to a control's range; the interface converts at the knob.
 */

/** Planar audio: one Float64Array per channel, all of equal length. */
export interface AudioBuffers {
  sampleRate: number;
  channels: Float64Array[];
  /** Frames per channel. */
  length: number;
}

/** prd.md §3.5 — latency modes. */
export type LatencyMode = 'zero' | 'balanced' | 'hq-linear';

/** prd.md §3.5 — oversampling around the nonlinear stages. */
export type OversampleFactor = 1 | 2 | 4 | 8 | 16;

/** prd.md §3.5 — internal precision. */
export type Precision = 32 | 64;

export const MAX_BANDS = 6;
export const MIN_BANDS = 1;

/** prd.md §3.1 — control ranges. */
export const ATTACK_RANGE_DB = 15;
export const SUSTAIN_RANGE_DB = 24;
export const OUTPUT_RANGE_DB = 12;

/**
 * One band: an independent transient + saturation chain.
 */
export interface BandParams {
  /** Band engaged. A bypassed band still passes its audio through, unshaped. */
  on: boolean;
  /** Solo. If any band is soloed, only soloed bands reach the sum. */
  solo: boolean;

  // ---- transient section ----
  /** Attack shaping, ±15 dB. Positive sharpens onsets. */
  attackDb: number;
  /** Sustain shaping, ±24 dB. Positive extends decay tails. */
  sustainDb: number;
  /** HF-weighted transient emphasis, 0–1. Adds snap without broadband attack. */
  detail: number;
  /**
   * Detector times. Left null to use the program-adaptive default derived from
   * the band's centre frequency — low bands genuinely need slower detectors,
   * and making that automatic is better than making the user discover it.
   */
  attackTimeMs: number | null;
  releaseTimeMs: number | null;
  sustainTimeMs: number | null;

  // ---- saturation section ----
  /** Which of the ten engines this band runs. */
  deviceId: string;
  /** Drive into the nonlinear core, 0–1. */
  drive: number;
  /** Device-specific macro (bias, symmetry, emphasis…), 0–1. */
  character: number;
  /** Parallel blend of the saturated signal against the clean band, 0–1. */
  satMix: number;

  // ---- band output ----
  /** Parallel blend of the whole band chain against the untouched band, 0–1. */
  mix: number;
  /** Band output trim, ±12 dB. */
  outputDb: number;
}

/**
 * A complete processing state: the crossover layout, every band, and the
 * quality preferences.
 */
export interface Chain {
  /** Crossover frequencies in Hz, ascending. N frequencies produce N+1 bands. */
  crossoverHz: number[];
  bands: BandParams[];

  latencyMode: LatencyMode;
  oversample: OversampleFactor;
  precision: Precision;

  /** Global input trim in dB. */
  inputTrimDb: number;
  /** Global output trim in dB. */
  outputTrimDb: number;
  /** Global dry/wet, 0–1. Delay-compensated. */
  mix: number;
  /** Match the render to the source loudness so comparisons are honest. */
  autoGainMatch: boolean;
}

/**
 * A timeline region assigning a chain to a span of the source.
 * Regions are rendered with continuous detector state across the whole file and
 * then crossfaded, so a device change never resets an envelope mid-music.
 */
export interface Region {
  id: string;
  startSec: number;
  endSec: number;
  crossfadeMs: number;
  chain: Chain;
}

export type RenderMode = 'ab' | 'timeline';

export interface LoudnessReport {
  /** ITU-R BS.1770-4 integrated loudness in LUFS. */
  integratedLufs: number;
  /** True peak in dBTP (4x oversampled). */
  truePeakDb: number;
  /** Sample peak in dBFS. */
  samplePeakDb: number;
}

export interface RenderResult {
  label: string;
  buffers: AudioBuffers;
  loudness: LoudnessReport;
  /** Gain in dB applied for loudness matching, if any. */
  matchGainDb: number;
}

export interface ProgressReport {
  stage: string;
  /** 0..1 */
  progress: number;
}

export type ProgressCallback = (report: ProgressReport) => void;

export const DB_FLOOR = -160;

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function gainToDb(gain: number): number {
  return gain > 0 ? 20 * Math.log10(gain) : DB_FLOOR;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Program-adaptive detector times.
 *
 * A 60 Hz cycle is 16 ms long, so a 1 ms detector on a bass band is measuring
 * the waveform rather than the event. Scaling the time constants with the band's
 * centre frequency is what stops low bands from chattering and high bands from
 * smearing — tdd.md §4 calls for it and it matters more than any single knob.
 */
export function adaptiveTimes(centreHz: number): {
  attackTimeMs: number;
  releaseTimeMs: number;
  sustainTimeMs: number;
} {
  const f = clamp(centreHz, 30, 18000);
  // One period at the band centre, floored so the top end stays sane.
  const periodMs = 1000 / f;
  const attackTimeMs = clamp(periodMs * 0.9, 0.4, 14);
  const releaseTimeMs = clamp(periodMs * 22, 45, 320);
  const sustainTimeMs = clamp(periodMs * 34, 90, 520);
  return { attackTimeMs, releaseTimeMs, sustainTimeMs };
}

/** Geometric centre of a band, used for the adaptive times and the UI node. */
export function bandCentreHz(crossoverHz: number[], index: number): number {
  const edges = [20, ...[...crossoverHz].sort((a, b) => a - b), 20000];
  const low = edges[index] ?? 20;
  const high = edges[index + 1] ?? 20000;
  return Math.sqrt(low * high);
}
