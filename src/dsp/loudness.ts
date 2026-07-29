/**
 * ITU-R BS.1770-4 loudness and true-peak measurement.
 *
 * This exists so A/B comparison is level-matched. A device that adds 0.8 dB
 * will win a blind test against a better-sounding device that adds nothing,
 * every time, unless the levels are matched first. Matching on integrated
 * loudness rather than peak is the right call because it tracks what the ear
 * actually weights.
 */

import { Biquad } from './filters';
import { upsample } from './oversampler';
import { AudioBuffers, LoudnessReport } from './types';

/** K-weighting stage 1: high-frequency shelf modelling the head. */
function shelfCoeffs(sampleRate: number) {
  const gainDb = 3.999843853973347;
  const f0 = 1681.974450955533;
  const q = 0.7071752369554196;

  const k = Math.tan((Math.PI * f0) / sampleRate);
  const vh = Math.pow(10, gainDb / 20);
  const vb = Math.pow(vh, 0.4996667741545416);
  const a0 = 1 + k / q + k * k;

  return {
    b0: (vh + (vb * k) / q + k * k) / a0,
    b1: (2 * (k * k - vh)) / a0,
    b2: (vh - (vb * k) / q + k * k) / a0,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / q + k * k) / a0,
  };
}

/** K-weighting stage 2: RLB high-pass. */
function rlbCoeffs(sampleRate: number) {
  const f0 = 38.13547087602444;
  const q = 0.5003270373238773;
  const k = Math.tan((Math.PI * f0) / sampleRate);
  const a0 = 1 + k / q + k * k;

  return {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / q + k * k) / a0,
  };
}

/** BS.1770 channel weights. Stereo and mono use unity throughout. */
function channelWeight(index: number, channelCount: number): number {
  if (channelCount <= 2) return 1;
  // 5.x ordering: L R C LFE Ls Rs. LFE is excluded from the measurement.
  const weights = [1, 1, 1, 0, 1.41, 1.41];
  return weights[index] ?? 1;
}

const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = -10;
const BLOCK_MS = 400;
const OVERLAP = 0.75;

export function measureLoudness(buffers: AudioBuffers): LoudnessReport {
  const { sampleRate, length, channels } = buffers;

  const blockSize = Math.round((BLOCK_MS / 1000) * sampleRate);
  const hop = Math.max(1, Math.round(blockSize * (1 - OVERLAP)));
  const blockCount = length >= blockSize ? Math.floor((length - blockSize) / hop) + 1 : 0;

  // Per-block weighted mean square, accumulated across channels.
  const blockPower = new Float64Array(Math.max(blockCount, 0));
  let samplePeak = 0;

  for (let c = 0; c < channels.length; c++) {
    const weight = channelWeight(c, channels.length);
    const source = channels[c];

    for (let i = 0; i < length; i++) {
      const a = Math.abs(source[i]);
      if (a > samplePeak) samplePeak = a;
    }
    if (weight === 0) continue;

    const filtered = Float64Array.from(source);
    const shelf = new Biquad();
    shelf.setCoeffs(shelfCoeffs(sampleRate));
    shelf.processBlock(filtered, filtered);
    const rlb = new Biquad();
    rlb.setCoeffs(rlbCoeffs(sampleRate));
    rlb.processBlock(filtered, filtered);

    // Prefix sums of the squared signal turn each block's mean square into two
    // lookups, which keeps 75%-overlapped analysis linear rather than quadratic.
    const prefix = new Float64Array(length + 1);
    for (let i = 0; i < length; i++) prefix[i + 1] = prefix[i] + filtered[i] * filtered[i];

    for (let b = 0; b < blockCount; b++) {
      const start = b * hop;
      const sum = prefix[start + blockSize] - prefix[start];
      blockPower[b] += (weight * sum) / blockSize;
    }
  }

  const integratedLufs = gatedLoudness(blockPower);

  return {
    integratedLufs,
    truePeakDb: measureTruePeak(buffers),
    samplePeakDb: samplePeak > 0 ? 20 * Math.log10(samplePeak) : -Infinity,
  };
}

function blockLufs(power: number): number {
  return power > 0 ? -0.691 + 10 * Math.log10(power) : -Infinity;
}

function gatedLoudness(blockPower: Float64Array): number {
  if (blockPower.length === 0) return -Infinity;

  let sum = 0;
  let count = 0;
  for (const power of blockPower) {
    if (blockLufs(power) > ABSOLUTE_GATE_LUFS) {
      sum += power;
      count++;
    }
  }
  if (count === 0) return -Infinity;

  const relativeThreshold = blockLufs(sum / count) + RELATIVE_GATE_LU;

  let gatedSum = 0;
  let gatedCount = 0;
  for (const power of blockPower) {
    const lufs = blockLufs(power);
    if (lufs > ABSOLUTE_GATE_LUFS && lufs > relativeThreshold) {
      gatedSum += power;
      gatedCount++;
    }
  }

  return gatedCount === 0 ? -Infinity : blockLufs(gatedSum / gatedCount);
}

/**
 * True peak via 4x oversampling, as BS.1770 specifies. Inter-sample peaks are
 * what actually clip a converter or a lossy encoder, and they routinely sit
 * 1-2 dB above the sample peak on dense material.
 */
export function measureTruePeak(buffers: AudioBuffers): number {
  let peak = 0;
  for (const channel of buffers.channels) {
    const up = upsample(channel, 4);
    for (let i = 0; i < up.length; i++) {
      const a = Math.abs(up[i]);
      if (a > peak) peak = a;
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}
