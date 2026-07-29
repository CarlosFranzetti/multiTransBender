/**
 * Render orchestration: A/B comparison and multi-device timeline rendering.
 *
 * The timeline renderer deliberately does *not* process each region in
 * isolation. It renders the entire file once per distinct chain, with the
 * envelope followers running continuously from the first sample, and then
 * crossfades between those full renders. Chopping the file up and processing
 * the pieces would reset every detector at each boundary, which puts an audible
 * discontinuity exactly where the user has asked for a device change — the
 * worst possible place for one. The cost is one full pass per chain, which is
 * irrelevant offline.
 */

import { processChain } from './chain';
import { fft } from './fft';
import { measureLoudness } from './loudness';
import {
  AudioBuffers,
  Chain,
  LoudnessReport,
  ProgressCallback,
  Region,
  RenderResult,
  dbToGain,
} from './types';
import { getDevice } from './devices';

/**
 * Label a chain for the A/B switcher.
 *
 * With a device per band there is no single device name to show, so the label
 * names the distinct engines in play — which is what the listener is actually
 * choosing between.
 */
export function describeChain(chain: Chain, index: number): string {
  const active = chain.bands.filter((band) => band.on);
  const names = [...new Set(active.map((band) => getDevice(band.deviceId).name))];
  if (names.length === 0) return `Variant ${index + 1}`;
  if (names.length <= 2) return names.join(' + ');
  return `${names[0]} +${names.length - 1}`;
}

/** Largest correction loudness matching will apply, to stop runaway gain. */
const MAX_MATCH_DB = 12;

function stableKey(chain: Chain): string {
  return JSON.stringify(chain);
}

function scaleBuffers(buffers: AudioBuffers, gain: number): void {
  if (gain === 1) return;
  for (const channel of buffers.channels) {
    for (let i = 0; i < channel.length; i++) channel[i] *= gain;
  }
}

function matchToReference(
  buffers: AudioBuffers,
  reference: LoudnessReport,
  enabled: boolean,
): { loudness: LoudnessReport; matchGainDb: number } {
  const measured = measureLoudness(buffers);
  if (!enabled || !Number.isFinite(measured.integratedLufs) || !Number.isFinite(reference.integratedLufs)) {
    return { loudness: measured, matchGainDb: 0 };
  }

  const delta = reference.integratedLufs - measured.integratedLufs;
  const clamped = Math.max(-MAX_MATCH_DB, Math.min(MAX_MATCH_DB, delta));
  if (Math.abs(clamped) < 0.01) return { loudness: measured, matchGainDb: 0 };

  scaleBuffers(buffers, dbToGain(clamped));
  return { loudness: measureLoudness(buffers), matchGainDb: clamped };
}

/**
 * Render the whole file through each chain. Every result is loudness-matched to
 * the source so switching between them compares tone, not level.
 */
export function renderAB(
  source: AudioBuffers,
  chains: Chain[],
  onProgress?: ProgressCallback,
): RenderResult[] {
  const reference = measureLoudness(source);
  const results: RenderResult[] = [];

  chains.forEach((chain, index) => {
    const label = describeChain(chain, index);
    const processed = processChain(source, chain, {
      onProgress: (p) =>
        onProgress?.({
          stage: `Rendering ${label}`,
          progress: (index + p) / chains.length,
        }),
    });

    const { loudness, matchGainDb } = matchToReference(processed, reference, chain.autoGainMatch);
    results.push({ label, buffers: processed, loudness, matchGainDb });
  });

  onProgress?.({ stage: 'Complete', progress: 1 });
  return results;
}

/**
 * Raised-cosine ramp. Its complement sums to exactly 1, which is what you want
 * for two renders of the same source: they are highly correlated, so an
 * equal-power law would produce a level bulge through the crossfade.
 */
function ramp(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

function regionEnvelope(region: Region, sampleRate: number, length: number): Float64Array {
  const env = new Float64Array(length);
  const start = Math.max(0, Math.round(region.startSec * sampleRate));
  const end = Math.min(length, Math.round(region.endSec * sampleRate));
  if (end <= start) return env;

  const fade = Math.max(1, Math.round((region.crossfadeMs / 1000) * sampleRate));
  // A short region must not fade in and out through each other.
  const usableFade = Math.min(fade, Math.floor((end - start) / 2));

  for (let i = start; i < end; i++) {
    const fromStart = i - start;
    const toEnd = end - 1 - i;
    const inGain = usableFade > 0 ? ramp(fromStart / usableFade) : 1;
    const outGain = usableFade > 0 ? ramp(toEnd / usableFade) : 1;
    env[i] = Math.min(inGain, outGain);
  }
  return env;
}

export interface TimelineRenderOptions {
  regions: Region[];
  /** Chain used wherever no region is active. */
  baseChain: Chain;
  onProgress?: ProgressCallback;
  /** Match the finished render to the source loudness. */
  gainMatch?: boolean;
}

export function renderTimeline(
  source: AudioBuffers,
  options: TimelineRenderOptions,
): RenderResult {
  const { regions, baseChain, onProgress } = options;
  const { sampleRate, length } = source;
  const channelCount = source.channels.length;

  // One full render per distinct chain, shared by every region that uses it.
  const passes = new Map<string, AudioBuffers>();
  const chainOrder: Chain[] = [baseChain, ...regions.map((r) => r.chain)];
  const distinct: Chain[] = [];
  for (const chain of chainOrder) {
    const key = stableKey(chain);
    if (!passes.has(key)) {
      passes.set(key, null as unknown as AudioBuffers);
      distinct.push(chain);
    }
  }

  distinct.forEach((chain, index) => {
    const rendered = processChain(source, chain, {
      onProgress: (p) =>
        onProgress?.({
          stage: `Rendering pass ${index + 1} of ${distinct.length}`,
          progress: ((index + p) / distinct.length) * 0.9,
        }),
    });
    passes.set(stableKey(chain), rendered);
  });

  onProgress?.({ stage: 'Blending regions', progress: 0.92 });

  const envelopes = regions.map((region) => regionEnvelope(region, sampleRate, length));
  const baseWeight = new Float64Array(length);
  const totals = new Float64Array(length);

  for (const env of envelopes) {
    for (let i = 0; i < length; i++) totals[i] += env[i];
  }
  for (let i = 0; i < length; i++) {
    if (totals[i] > 1) {
      // Overlapping regions share the sample proportionally rather than
      // summing past unity and producing a level spike at the overlap.
      const inv = 1 / totals[i];
      for (const env of envelopes) env[i] *= inv;
      baseWeight[i] = 0;
    } else {
      baseWeight[i] = 1 - totals[i];
    }
  }

  const out: AudioBuffers = {
    sampleRate,
    length,
    channels: Array.from({ length: channelCount }, () => new Float64Array(length)),
  };

  const basePass = passes.get(stableKey(baseChain))!;
  for (let c = 0; c < channelCount; c++) {
    const dst = out.channels[c];
    const src = basePass.channels[c];
    for (let i = 0; i < length; i++) dst[i] = src[i] * baseWeight[i];
  }

  regions.forEach((region, index) => {
    const pass = passes.get(stableKey(region.chain))!;
    const env = envelopes[index];
    for (let c = 0; c < channelCount; c++) {
      const dst = out.channels[c];
      const src = pass.channels[c];
      for (let i = 0; i < length; i++) {
        if (env[i] !== 0) dst[i] += src[i] * env[i];
      }
    }
  });

  onProgress?.({ stage: 'Measuring', progress: 0.97 });

  const reference = measureLoudness(source);
  const { loudness, matchGainDb } = matchToReference(out, reference, options.gainMatch ?? false);

  onProgress?.({ stage: 'Complete', progress: 1 });
  return { label: 'Timeline', buffers: out, loudness, matchGainDb };
}

/** Extract a time range, for fast preview renders while the user is dialling in. */
export function sliceBuffers(source: AudioBuffers, startSec: number, endSec: number): AudioBuffers {
  const start = Math.max(0, Math.round(startSec * source.sampleRate));
  const end = Math.min(source.length, Math.round(endSec * source.sampleRate));
  const length = Math.max(0, end - start);
  return {
    sampleRate: source.sampleRate,
    length,
    channels: source.channels.map((c) => Float64Array.from(c.subarray(start, end))),
  };
}

/**
 * Peak envelope for waveform drawing, reduced to `buckets` min/max pairs.
 * Min and max are both kept so the drawn waveform shows real asymmetry rather
 * than a symmetric blob.
 */
export function peakEnvelope(
  source: AudioBuffers,
  buckets: number,
): { min: Float32Array; max: Float32Array } {
  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);
  const perBucket = Math.max(1, Math.floor(source.length / buckets));

  for (let b = 0; b < buckets; b++) {
    const start = b * perBucket;
    const end = Math.min(source.length, start + perBucket);
    let lo = 0;
    let hi = 0;
    for (let c = 0; c < source.channels.length; c++) {
      const channel = source.channels[c];
      for (let i = start; i < end; i++) {
        const v = channel[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    min[b] = lo;
    max[b] = hi;
  }

  return { min, max };
}

/**
 * Averaged magnitude spectrum for the ENGINE view, in dB, on a log frequency
 * grid from 20 Hz to 20 kHz.
 *
 * Welch's method — overlapping Hann-windowed blocks, averaged — rather than one
 * big FFT. A single transform of a whole song is dominated by whatever happened
 * to be playing at that moment and looks like noise; averaging gives the stable
 * picture of the material that you can actually place a crossover against.
 */
export function averageSpectrum(buffers: AudioBuffers, points = 240): Float32Array {
  const out = new Float32Array(points);
  const fftSize = 4096;
  const half = fftSize >>> 1;
  if (buffers.length < fftSize) return out.fill(-120);

  const window = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
  }

  const power = new Float64Array(half);
  const hop = fftSize >>> 1;
  // Cap the number of blocks so a long file analyses as fast as a short one.
  const maxBlocks = 180;
  const available = Math.floor((buffers.length - fftSize) / hop) + 1;
  const stride = Math.max(1, Math.floor(available / maxBlocks));
  let blocks = 0;

  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);

  for (let b = 0; b < available; b += stride) {
    const start = b * hop;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < fftSize; i++) {
      let sum = 0;
      for (let c = 0; c < buffers.channels.length; c++) sum += buffers.channels[c][start + i];
      re[i] = (sum / buffers.channels.length) * window[i];
    }
    fft(re, im);
    for (let k = 0; k < half; k++) power[k] += re[k] * re[k] + im[k] * im[k];
    blocks++;
  }

  if (blocks === 0) return out.fill(-120);

  const binHz = buffers.sampleRate / fftSize;
  const norm = 1 / (blocks * fftSize * fftSize * 0.25);

  for (let p = 0; p < points; p++) {
    // Log grid, and each point averages the bins that fall inside its cell —
    // otherwise the top octaves alias into a jagged mess.
    const f0 = 20 * Math.pow(10, (p / points) * 3);
    const f1 = 20 * Math.pow(10, ((p + 1) / points) * 3);
    const k0 = Math.max(1, Math.floor(f0 / binHz));
    const k1 = Math.min(half - 1, Math.max(k0 + 1, Math.ceil(f1 / binHz)));

    let sum = 0;
    for (let k = k0; k < k1; k++) sum += power[k];
    const mean = sum / Math.max(1, k1 - k0);
    out[p] = mean > 0 ? 10 * Math.log10(mean * norm) : -120;
  }

  return out;
}
