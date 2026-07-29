/**
 * Per-band signal chain: split, shape, saturate, blend, sum.
 *
 * Structure follows tdd.md §2: CrossoverBank → BandChain × N → SumStage, where
 * each BandChain is TransientShaper → SaturationEngine (oversampled) →
 * BandMixOut. Every band carries its own device, so this loop is genuinely
 * running up to six different saturation engines over one piece of audio.
 *
 * Two things here are worth knowing before changing anything:
 *
 * 1. Lookahead is applied by reading the *control signal* ahead of the audio
 *    rather than delaying the audio. Offline that is exact and costs no latency,
 *    so a render lines up sample-for-sample with the source and dry/wet mixing
 *    stays phase-correct. The real-time plugin cannot do this and reports PDC
 *    instead (tdd.md §3).
 *
 * 2. Detection is stereo-linked: one gain curve drives every channel of a band,
 *    so a transient that hits one side harder cannot pull the stereo image.
 */

import { splitBandsLinearPhase } from './crossover';
import { getDevice, resolveTimes } from './devices';
import { DcBlocker, TransientShaper, buildDetector, forwardExtremum } from './envelope';
import { Biquad, DetectorFilter, highpassCoeffs, splitBandsIir } from './filters';
import { processOversampled } from './oversampler';
import { makeSaturator } from './saturation';
import {
  ATTACK_RANGE_DB,
  AudioBuffers,
  BandParams,
  Chain,
  SUSTAIN_RANGE_DB,
  clamp,
  dbToGain,
} from './types';

/** BALANCED mode's fixed detector lookahead — tdd.md §3, tuned by ear. */
const BALANCED_LOOKAHEAD_SAMPLES = 64;

/** Where the DETAIL path splits off. Above this is snap, below it is body. */
const DETAIL_SPLIT_HZ = 2500;

function cloneBuffers(source: AudioBuffers): AudioBuffers {
  return {
    sampleRate: source.sampleRate,
    length: source.length,
    channels: source.channels.map((c) => Float64Array.from(c)),
  };
}

export function emptyBuffers(
  sampleRate: number,
  channelCount: number,
  length: number,
): AudioBuffers {
  return {
    sampleRate,
    length,
    channels: Array.from({ length: channelCount }, () => new Float64Array(length)),
  };
}

function applyGainInPlace(buffers: AudioBuffers, gain: number): void {
  if (gain === 1) return;
  for (const channel of buffers.channels) {
    for (let i = 0; i < channel.length; i++) channel[i] *= gain;
  }
}

/** Split every channel. Returns `bands[bandIndex][channelIndex]`. */
function splitAllChannels(input: AudioBuffers, chain: Chain): Float64Array[][] {
  const linearPhase = chain.latencyMode === 'hq-linear';
  const perChannel = input.channels.map((channel) =>
    linearPhase
      ? splitBandsLinearPhase(channel, input.sampleRate, chain.crossoverHz)
      : splitBandsIir(channel, input.sampleRate, chain.crossoverHz),
  );

  const bandCount = perChannel[0].length;
  const bands: Float64Array[][] = [];
  for (let b = 0; b < bandCount; b++) {
    bands.push(perChannel.map((channelBands) => channelBands[b]));
  }
  return bands;
}

/**
 * Quantise to float32 storage precision.
 *
 * The 32-bit preference (prd.md §3.5) is the plugin's CPU-economy path. In the
 * browser everything is a double regardless, so honouring the setting means
 * actually rounding intermediates — otherwise the control would be decorative.
 * Offline there is no speed to gain from it; it is here so a web render matches
 * what the plugin will do at the same setting.
 */
function quantiseTo32(buffer: Float64Array): void {
  for (let i = 0; i < buffer.length; i++) buffer[i] = Math.fround(buffer[i]);
}

export interface ProcessOptions {
  onProgress?: (progress: number) => void;
}

export function processChain(
  input: AudioBuffers,
  chain: Chain,
  options: ProcessOptions = {},
): AudioBuffers {
  const { sampleRate, length } = input;
  const channelCount = input.channels.length;

  const wet = cloneBuffers(input);
  applyGainInPlace(wet, dbToGain(chain.inputTrimDb));

  const bands = splitAllChannels(wet, chain);
  const summed = emptyBuffers(sampleRate, channelCount, length);
  const gainCurve = new Float64Array(length);
  const detailCurve = new Float64Array(length);

  // Solo is exclusive: if anything is soloed, everything else is muted. Checked
  // once here so a soloed band cannot be silenced by its own `on` flag.
  const soloActive = chain.bands.some((band) => band.solo);

  for (let b = 0; b < bands.length; b++) {
    const bandChannels = bands[b];
    const params: BandParams = chain.bands[Math.min(b, chain.bands.length - 1)];
    const device = getDevice(params.deviceId);

    const audible = soloActive ? params.solo : params.on;
    if (!audible) {
      options.onProgress?.((b + 1) / bands.length);
      continue;
    }

    // Untouched copy for the band MIX blend at the end of the chain.
    const clean = bandChannels.map((channel) => Float64Array.from(channel));

    const times = resolveTimes(params, chain.crossoverHz, b);
    const attack = clamp(params.attackDb, -ATTACK_RANGE_DB, ATTACK_RANGE_DB);
    const sustain = clamp(params.sustainDb, -SUSTAIN_RANGE_DB, SUSTAIN_RANGE_DB);

    // ---- transient shaping ----
    if (attack !== 0 || sustain !== 0) {
      const detectorRaw = buildDetector(bandChannels, device.core, sampleRate);
      const detector = new Float64Array(length);
      new DetectorFilter(sampleRate, 25, 0).processBlock(detectorRaw, detector);
      for (let i = 0; i < length; i++) detector[i] = Math.abs(detector[i]);

      const shaper = new TransientShaper({
        sampleRate,
        attackDb: attack,
        sustainDb: sustain,
        attackTimeMs: times.attackTimeMs,
        releaseTimeMs: times.releaseTimeMs,
        sustainTimeMs: times.sustainTimeMs,
      });
      shaper.processBuffer(detector, gainCurve);

      // Align the control signal with the peak it acts on. A differential
      // detector reaches full divergence about one attack time-constant *after*
      // an onset, so applied literally a cut lands on the body of a hit and
      // misses the peak — making "attack down" produce a peakier signal, not a
      // flatter one. Sliding a running extremum backwards over the lookahead
      // window is the same construction a lookahead limiter uses.
      const baseLookahead =
        chain.latencyMode === 'balanced' ? BALANCED_LOOKAHEAD_SAMPLES : 0;
      const alignWindow =
        baseLookahead + Math.round((times.attackTimeMs / 1000) * sampleRate);

      const aligned =
        attack > 0
          ? forwardExtremum(gainCurve, alignWindow, 'max')
          : attack < 0
            ? forwardExtremum(gainCurve, alignWindow, 'min')
            : gainCurve;

      for (const channel of bandChannels) {
        for (let i = 0; i < length; i++) channel[i] *= dbToGain(aligned[i]);
      }
    }

    // ---- DETAIL: parallel HF-weighted transient path (tdd.md §4) ----
    // Adds click and snap definition without a broadband attack boost, which is
    // the difference between a snare reading as "articulate" and as "harsh".
    if (params.detail > 0.001) {
      const splitHz = Math.min(DETAIL_SPLIT_HZ, sampleRate * 0.45);
      const hfChannels = bandChannels.map((channel) => {
        const hf = new Float64Array(length);
        const filter = new Biquad();
        filter.setCoeffs(highpassCoeffs(splitHz, sampleRate));
        filter.processBlock(channel, hf);
        return hf;
      });

      const hfDetector = buildDetector(hfChannels, 'peak', sampleRate);
      const detailShaper = new TransientShaper({
        sampleRate,
        // A fixed, deliberately strong attack: DETAIL sets how much of this
        // path is blended, not how hard it works.
        attackDb: 12,
        sustainDb: 0,
        attackTimeMs: 0.6,
        releaseTimeMs: 60,
        sustainTimeMs: 120,
      });
      detailShaper.processBuffer(hfDetector, detailCurve);
      const aligned = forwardExtremum(detailCurve, Math.round(sampleRate * 0.002), 'max');

      const amount = clamp(params.detail, 0, 1) * 0.6;
      for (let c = 0; c < bandChannels.length; c++) {
        const channel = bandChannels[c];
        const hf = hfChannels[c];
        for (let i = 0; i < length; i++) {
          channel[i] += hf[i] * (dbToGain(aligned[i]) - 1) * amount;
        }
      }
    }

    // ---- saturation, oversampled around the nonlinearity only ----
    if (params.drive > 0.001 && params.satMix > 0.001) {
      const factor = chain.oversample;
      for (let c = 0; c < bandChannels.length; c++) {
        const saturator = makeSaturator({
          device,
          drive: params.drive,
          character: params.character,
          sampleRate: sampleRate * factor,
        });
        const dry = bandChannels[c];
        const saturated = processOversampled(dry, factor, saturator);

        if (device.bias !== 0) new DcBlocker(sampleRate).processBlock(saturated);

        const satMix = clamp(params.satMix, 0, 1);
        const trim = dbToGain(device.outputTrimDb * satMix);
        const out = new Float64Array(length);
        for (let i = 0; i < length; i++) {
          out[i] = (saturated[i] * satMix + dry[i] * (1 - satMix)) * trim;
        }
        bandChannels[c] = out;
      }
    }

    // ---- band output: trim, then parallel blend against the clean band ----
    const outputGain = dbToGain(params.outputDb);
    const mix = clamp(params.mix, 0, 1);

    for (let c = 0; c < channelCount; c++) {
      const band = bandChannels[c];
      const raw = clean[c];
      const out = summed.channels[c];
      for (let i = 0; i < length; i++) {
        // Processed and clean are sample-aligned, so a linear blend is correct;
        // an equal-power law would bulge in the middle for correlated signals.
        out[i] += band[i] * outputGain * mix + raw[i] * (1 - mix);
      }
    }

    if (chain.precision === 32) {
      for (const channel of summed.channels) quantiseTo32(channel);
    }

    options.onProgress?.((b + 1) / bands.length);
  }

  applyGainInPlace(summed, dbToGain(chain.outputTrimDb));

  const globalMix = clamp(chain.mix, 0, 1);
  if (globalMix < 1) {
    for (let c = 0; c < channelCount; c++) {
      const out = summed.channels[c];
      const dry = input.channels[c];
      for (let i = 0; i < length; i++) {
        out[i] = out[i] * globalMix + dry[i] * (1 - globalMix);
      }
    }
  }

  return summed;
}

/**
 * Latency this chain would report in a host, in samples.
 *
 * Offline the renderer has none — lookahead is a read-ahead and the linear-phase
 * filters are non-causal. This figure is what the *plugin* would report for the
 * same settings, shown in the interface so the two stay comparable (tdd.md §3).
 */
export function reportedLatencySamples(chain: Chain, sampleRate: number): number {
  switch (chain.latencyMode) {
    case 'zero':
      return 0;
    case 'balanced':
      return BALANCED_LOOKAHEAD_SAMPLES;
    case 'hq-linear': {
      // FIR length scales with the lowest crossover, so PDC grows as splits move
      // down and as bands are added.
      const lowest = Math.min(...chain.crossoverHz, 20000);
      const taps = Math.min(Math.max(Math.round((sampleRate * 4) / lowest), 127), 32769);
      return (taps - 1) / 2;
    }
    default:
      return 0;
  }
}
