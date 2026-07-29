/**
 * Envelope followers and the differential transient shaper.
 *
 * The shaper works the way a good hardware transient designer does: it never
 * looks at absolute level, only at the *difference* between a fast and a slow
 * envelope. That is what makes it threshold-free — a quiet snare and a loud one
 * get the same treatment, because both produce the same envelope divergence at
 * their onset. Absolute-level designs need a threshold knob and change
 * character as the mix level changes; this one does not.
 */

import { DB_FLOOR } from './types';

/** One-pole envelope follower with independent attack and release. */
export class EnvelopeFollower {
  private attackCoeff: number;
  private releaseCoeff: number;
  private env = 0;

  constructor(sampleRate: number, attackMs: number, releaseMs: number) {
    this.attackCoeff = EnvelopeFollower.coeff(sampleRate, attackMs);
    this.releaseCoeff = EnvelopeFollower.coeff(sampleRate, releaseMs);
  }

  static coeff(sampleRate: number, timeMs: number): number {
    const t = Math.max(timeMs, 0.001) * 0.001;
    return Math.exp(-1 / (sampleRate * t));
  }

  setReleaseCoeff(coeff: number): void {
    this.releaseCoeff = coeff;
  }

  reset(): void {
    this.env = 0;
  }

  process(x: number): number {
    const coeff = x > this.env ? this.attackCoeff : this.releaseCoeff;
    this.env = x + coeff * (this.env - x);
    if (this.env < 1e-300) this.env = 0;
    return this.env;
  }

  value(): number {
    return this.env;
  }
}

/** First-order DC blocker; keeps asymmetric saturation from shifting the floor. */
export class DcBlocker {
  private x1 = 0;
  private y1 = 0;
  private readonly r: number;

  constructor(sampleRate: number, cutoffHz = 5) {
    this.r = 1 - (2 * Math.PI * cutoffHz) / sampleRate;
  }

  process(x: number): number {
    const y = x - this.x1 + this.r * this.y1;
    this.x1 = x;
    this.y1 = Math.abs(y) < 1e-300 ? 0 : y;
    return this.y1;
  }

  processBlock(buf: Float64Array): void {
    for (let i = 0; i < buf.length; i++) buf[i] = this.process(buf[i]);
  }
}

/** Soft-knee half-wave rectifier in the dB domain. */
function softRectify(x: number, kneeDb: number): number {
  if (kneeDb <= 0) return x > 0 ? x : 0;
  const half = kneeDb * 0.5;
  if (x <= -half) return 0;
  if (x >= half) return x;
  const t = x + half;
  return (t * t) / (2 * kneeDb);
}

function toDb(x: number): number {
  return x > 1e-12 ? 20 * Math.log10(x) : DB_FLOOR;
}

export interface ShaperConfig {
  sampleRate: number;
  /** Attack shaping in dB at full transient divergence, +-15 (prd.md 3.1). */
  attackDb: number;
  /** Sustain shaping in dB at full divergence, +-24. */
  sustainDb: number;
  attackTimeMs: number;
  releaseTimeMs: number;
  sustainTimeMs: number;
  /** Detector divergence in dB that counts as a fully-formed transient. */
  referenceDb?: number;
  /** Soft-knee width applied to the differential rectifier, in dB. */
  kneeDb?: number;
}

/**
 * Ratio between the fast and slow envelope attack times. Twenty is wide enough
 * that the two envelopes genuinely separate on a drum hit, but not so wide that
 * sustained material starts registering as a transient.
 */
const SLOW_ATTACK_RATIO = 20;

/**
 * The slow envelope must also *release* more slowly than the fast one.
 *
 * This is not a voicing choice, it is a correctness requirement. Two one-pole
 * followers sharing a release coefficient decay at the same rate, so once an
 * onset has pushed them apart their ratio is preserved for as long as both are
 * releasing — the dB difference never returns to zero and the "transient
 * detector" degenerates into a fixed gain. Giving the slow envelope a longer
 * release makes it fall behind on the way down, which drives the difference
 * back through zero and negative, so the shaper re-arms after every hit.
 */
const ATTACK_SLOW_RELEASE_RATIO = 4;

/** Sustain uses the same trick in the other direction to find the decay tail. */
const SUSTAIN_SLOW_RELEASE_RATIO = 8;

/**
 * Divergence that counts as a fully-formed transient. Set too low, every onset
 * pins the control at maximum and the attack knob turns into a volume knob;
 * this value leaves normal programme material working in the middle of the
 * range where the control is still proportional.
 */
const DEFAULT_REFERENCE_DB = 18;

/** Soft-knee width on the differential rectifier. */
const DEFAULT_KNEE_DB = 4;

/**
 * Computes a per-sample gain curve in dB from a mono detector signal.
 *
 * Returned separately from the audio path so a stereo (or multi-channel) band
 * can share one gain curve. Applying independently-derived gain per channel
 * would move the stereo image every time a transient hit one side harder.
 */
export class TransientShaper {
  private readonly cfg: Required<ShaperConfig>;
  private readonly fast: EnvelopeFollower;
  private readonly slow: EnvelopeFollower;
  private readonly susFast: EnvelopeFollower;
  private readonly susSlow: EnvelopeFollower;
  private readonly smoothCoeff: number;
  private smoothed = 0;

  constructor(cfg: ShaperConfig) {
    this.cfg = { referenceDb: DEFAULT_REFERENCE_DB, kneeDb: DEFAULT_KNEE_DB, ...cfg };
    const { sampleRate, attackTimeMs, releaseTimeMs, sustainTimeMs } = this.cfg;

    this.fast = new EnvelopeFollower(sampleRate, attackTimeMs, releaseTimeMs);
    this.slow = new EnvelopeFollower(
      sampleRate,
      attackTimeMs * SLOW_ATTACK_RATIO,
      releaseTimeMs * ATTACK_SLOW_RELEASE_RATIO,
    );
    this.susFast = new EnvelopeFollower(sampleRate, attackTimeMs, sustainTimeMs);
    this.susSlow = new EnvelopeFollower(
      sampleRate,
      attackTimeMs,
      sustainTimeMs * SUSTAIN_SLOW_RELEASE_RATIO,
    );

    // Smoothing the gain at ~1.5 ms removes zipper noise without measurably
    // rounding the onset the shaper is supposed to sharpen.
    this.smoothCoeff = EnvelopeFollower.coeff(sampleRate, 1.5);
  }

  /**
   * @param detector Rectified, band-limited detector signal (linear, >= 0).
   * @returns Gain to apply, in dB.
   */
  processSample(detector: number): number {
    const fastEnv = this.fast.process(detector);
    const slowEnv = this.slow.process(detector);
    const susFastEnv = this.susFast.process(detector);
    const susSlowEnv = this.susSlow.process(detector);

    const { referenceDb, kneeDb, attackDb, sustainDb } = this.cfg;

    let gainDb = 0;

    if (attackDb !== 0) {
      // Positive while the fast envelope is outrunning the slow one, i.e. during
      // an onset. Zero everywhere else, so steady material is untouched.
      const divergence = softRectify(toDb(fastEnv) - toDb(slowEnv), kneeDb);
      gainDb += attackDb * Math.min(divergence / referenceDb, 1);
    }

    if (sustainDb !== 0) {
      // Positive while the slow-release envelope sits above the fast one, which
      // is precisely the decay tail after the onset has passed.
      const divergence = softRectify(toDb(susSlowEnv) - toDb(susFastEnv), kneeDb);
      gainDb += sustainDb * Math.min(divergence / referenceDb, 1);
    }

    this.smoothed = gainDb + this.smoothCoeff * (this.smoothed - gainDb);
    return this.smoothed;
  }

  /** Fill `out` with the dB gain curve for the whole detector buffer. */
  processBuffer(detector: Float64Array, out: Float64Array): void {
    for (let i = 0; i < detector.length; i++) out[i] = this.processSample(detector[i]);
  }

  reset(): void {
    this.fast.reset();
    this.slow.reset();
    this.susFast.reset();
    this.susSlow.reset();
    this.smoothed = 0;
  }
}

/**
 * Forward-looking running extremum, via a monotonic deque (O(n) regardless of
 * window length).
 *
 * A differential detector reaches its maximum divergence roughly one attack
 * time-constant *after* the onset, not at it — the fast envelope needs time to
 * pull away from the slow one. Applied literally, that means a gain reduction
 * lands on the body of a hit and misses the peak it was supposed to control,
 * so turning attack down makes a signal *more* peaky rather than less.
 *
 * Sliding the extremum of the control signal backwards over the lookahead
 * window fixes it: the shaping is fully in place by the time the peak arrives.
 * This is the same construction a lookahead limiter uses, and because the
 * running extremum of a continuous signal is itself continuous, it introduces
 * no discontinuity that would need further smoothing.
 */
export function forwardExtremum(
  src: Float64Array,
  window: number,
  mode: 'max' | 'min',
): Float64Array {
  const n = src.length;
  const out = new Float64Array(n);
  if (window <= 0 || n === 0) {
    out.set(src);
    return out;
  }

  const deque = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const wins = mode === 'max'
    ? (a: number, b: number) => a >= b
    : (a: number, b: number) => a <= b;

  // Scanning right to left keeps the window [i, i + w] ahead of the cursor.
  for (let i = n - 1; i >= 0; i--) {
    while (tail > head && wins(src[i], src[deque[tail - 1]])) tail--;
    deque[tail++] = i;
    while (deque[head] > i + window) head++;
    out[i] = src[deque[head]];
  }
  return out;
}

/**
 * Builds the detector signal for a band: rectified, optionally RMS-smoothed,
 * and stereo-linked by taking the maximum across channels.
 */
export type DetectorMode = 'peak' | 'rms' | 'hybrid' | string;

export function buildDetector(
  channels: Float64Array[],
  mode: DetectorMode,
  sampleRate: number,
): Float64Array {
  const n = channels[0].length;
  const out = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    let peak = 0;
    for (let c = 0; c < channels.length; c++) {
      const v = Math.abs(channels[c][i]);
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }

  if (mode === 'peak') return out;
  const useRms = mode === 'rms';

  // 3 ms RMS window: long enough to ignore waveform-cycle ripple on bass,
  // short enough that a kick onset still registers within its attack.
  const coeff = EnvelopeFollower.coeff(sampleRate, 3);
  let ms = 0;
  const rms = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const sq = out[i] * out[i];
    ms = sq + coeff * (ms - sq);
    rms[i] = Math.sqrt(ms);
  }

  if (useRms) return rms;

  // Hybrid keeps the peak's onset speed but leans on RMS for body.
  for (let i = 0; i < n; i++) out[i] = 0.5 * out[i] + 0.5 * rms[i];
  return out;
}
