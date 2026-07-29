/**
 * MultiTransBend DSP core.
 *
 * Pure TypeScript, no Web Audio, no DOM. It runs unchanged in a Web Worker, in
 * Node for the test suite, and in the local standalone build, which means the
 * render you audition in the browser is the render you download.
 */

export * from './types';
export * from './devices';
export * from './chain';
export * from './render';
export * from './loudness';
export * from './wav';
export { splitBandsLinearPhase, zeroPhaseFilter, crossoverTaps } from './crossover';
export { splitBandsIir, Biquad } from './filters';
export { designLowpass, designHalfband, estimateTaps } from './fir';
export { upsample, downsample, processOversampled } from './oversampler';
export { makeSaturator } from './saturation';
export type { SaturationCore, DeviceModel, KnobVariant, Texture, MeterType } from './devices';
export { EnvelopeFollower, TransientShaper, buildDetector, DcBlocker, forwardExtremum } from './envelope';
export { fft, convolve, nextPowerOfTwo } from './fft';

export const ENGINE_VERSION = '0.1b';

/** Human-readable summary of what the engine guarantees, shown in the UI. */
export const ENGINE_GUARANTEES = [
  '64-bit float throughout — no intermediate rounding between stages',
  'Sample rate and channel count preserved exactly, never resampled',
  'Linear-phase crossover sums bit-exactly with all bands at unity',
  'Lookahead read-ahead, not delay — renders align sample-for-sample with the source',
  'Non-linear stages oversampled up to 8x with 120 dB halfband filters',
  'Stereo-linked detection so transients never shift the image',
  '32-bit float export is the engine output verbatim, unclipped and undithered',
] as const;
