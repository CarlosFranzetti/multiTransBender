/**
 * Linear-phase multi-band crossover.
 *
 * Each split runs a zero-phase (offline, non-causal) windowed-sinc lowpass and
 * derives the highpass by subtraction, so the bands sum back to the input
 * sample-for-sample rather than merely "close enough". That exactness is the
 * whole point: with every band at unity the multi-band stage is transparent, so
 * any difference the listener hears is the shaping, never the crossover.
 */

import { convolve } from './fft';
import { designLowpass, estimateTaps } from './fir';

/** Widest transition band we allow, as a fraction of the crossover frequency. */
const TRANSITION_RATIO = 0.28;
const MIN_TAPS = 127;
const MAX_TAPS = 32769;

export function crossoverTaps(freqHz: number, sampleRate: number): number {
  const transitionNorm = (freqHz * TRANSITION_RATIO) / sampleRate;
  const taps = estimateTaps(transitionNorm, 110);
  const clamped = Math.min(Math.max(taps, MIN_TAPS), MAX_TAPS);
  return clamped % 2 === 0 ? clamped + 1 : clamped;
}

/**
 * Zero-phase FIR lowpass. The input is padded by the group delay on both sides
 * so the filter's ring-in and ring-out are captured inside the returned span,
 * then trimmed back to the original length with no net delay.
 */
export function zeroPhaseFilter(input: Float64Array, kernel: Float64Array): Float64Array {
  const n = input.length;
  const delay = (kernel.length - 1) / 2;
  const padded = new Float64Array(n + 2 * delay);
  padded.set(input, delay);

  const full = convolve(padded, kernel);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = full[2 * delay + i];
  return out;
}

/**
 * Split into `crossoverHz.length + 1` bands, ordered low to high.
 * Summing the result reproduces the input exactly (to Float64 rounding).
 */
export function splitBandsLinearPhase(
  input: Float64Array,
  sampleRate: number,
  crossoverHz: number[],
): Float64Array[] {
  const freqs = [...crossoverHz].sort((a, b) => a - b);
  if (freqs.length === 0) return [Float64Array.from(input)];

  const bands: Float64Array[] = [];
  let remainder = input;

  for (const freq of freqs) {
    const kernel = designLowpass(freq / sampleRate, crossoverTaps(freq, sampleRate));
    const low = zeroPhaseFilter(remainder, kernel);
    const high = new Float64Array(remainder.length);
    for (let i = 0; i < remainder.length; i++) high[i] = remainder[i] - low[i];
    bands.push(low);
    remainder = high;
  }

  bands.push(remainder instanceof Float64Array ? remainder : Float64Array.from(remainder));
  return bands;
}

/** Latency in samples introduced by a crossover configuration. */
export function crossoverLatency(): number {
  // Zero-phase filtering is non-causal and offline, so the rendered result is
  // already time-aligned with the source. Live hosts use the IIR path instead.
  return 0;
}
