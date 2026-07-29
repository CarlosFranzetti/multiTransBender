/**
 * Polyphase-quality oversampling for the non-linear stages.
 *
 * Saturation folds energy above Nyquist back into the audible band as
 * inharmonic aliasing, which is exactly the kind of artefact that makes
 * "warmth" sound like distortion instead of tone. Running the non-linearity at
 * 2x-8x with steep halfband filters pushes those products far enough up that
 * the decimation filter removes them.
 */

import { designHalfband } from './fir';
import { OversampleFactor } from './types';
import { zeroPhaseFilter } from './crossover';

const HALFBAND_TAPS = 255;
let halfbandKernel: Float64Array | null = null;

function kernel(): Float64Array {
  if (!halfbandKernel) halfbandKernel = designHalfband(HALFBAND_TAPS, 120);
  return halfbandKernel;
}

/** Insert a zero between every sample and interpolate. Gain is preserved. */
export function upsample2(input: Float64Array): Float64Array {
  const n = input.length;
  const stuffed = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) stuffed[i * 2] = input[i];

  const filtered = zeroPhaseFilter(stuffed, kernel());
  // Zero-stuffing halves the signal power; the factor of two restores level.
  for (let i = 0; i < filtered.length; i++) filtered[i] *= 2;
  return filtered;
}

/** Band-limit then discard every other sample. */
export function downsample2(input: Float64Array): Float64Array {
  const filtered = zeroPhaseFilter(input, kernel());
  const n = filtered.length >>> 1;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = filtered[i * 2];
  return out;
}

export function upsample(input: Float64Array, factor: OversampleFactor): Float64Array {
  let out = input;
  for (let f = factor; f > 1; f >>= 1) out = upsample2(out);
  return out;
}

export function downsample(input: Float64Array, factor: OversampleFactor): Float64Array {
  let out = input;
  for (let f = factor; f > 1; f >>= 1) out = downsample2(out);
  return out;
}

/**
 * Run `fn` sample-by-sample at an elevated rate and return to the base rate.
 * The caller's function must be memoryless or manage its own state at the
 * oversampled rate.
 */
export function processOversampled(
  input: Float64Array,
  factor: OversampleFactor,
  fn: (x: number) => number,
): Float64Array {
  if (factor === 1) {
    const out = new Float64Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = fn(input[i]);
    return out;
  }

  const up = upsample(input, factor);
  for (let i = 0; i < up.length; i++) up[i] = fn(up[i]);
  const down = downsample(up, factor);

  // Guard against off-by-one from the cascade so callers always get a buffer
  // matching the input length.
  if (down.length === input.length) return down;
  const out = new Float64Array(input.length);
  out.set(down.subarray(0, Math.min(down.length, input.length)));
  return out;
}
