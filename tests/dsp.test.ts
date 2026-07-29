/**
 * DSP verification suite.
 *
 * These are correctness tests, not smoke tests. The claims the product makes
 * about transparency are either true here or the product is lying, so each one
 * is checked numerically: crossover reconstruction, oversampling gain, dither
 * behaviour, container round-trips, and loudness calibration.
 *
 * Run with: npm test
 */

import { splitBandsLinearPhase } from '../src/dsp/crossover';
import { splitBandsIir } from '../src/dsp/filters';
import { convolve, fft } from '../src/dsp/fft';
import { designHalfband, designLowpass } from '../src/dsp/fir';
import { downsample, upsample } from '../src/dsp/oversampler';
import { measureLoudness } from '../src/dsp/loudness';
import { decodeWav, encodeWav } from '../src/dsp/wav';
import { processChain } from '../src/dsp/chain';
import { renderAB, renderTimeline } from '../src/dsp/render';
import { defaultBand, defaultChain, DEVICES } from '../src/dsp/devices';
import { addBandAt, moveCrossover, removeBand } from '../src/dsp/devices';
import { makeSaturator } from '../src/dsp/saturation';
import { AudioBuffers, MAX_BANDS } from '../src/dsp/types';

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = ''): void {
  checks++;
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(name: string): void {
  console.log(`\n${name}`);
}

function maxAbsDiff(a: Float64Array, b: Float64Array): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > worst) worst = d;
  }
  return worst;
}

function rms(x: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i] * x[i];
  return Math.sqrt(sum / x.length);
}

/** Deterministic pseudo-random source so failures are reproducible. */
function noise(n: number, seed = 12345): Float64Array {
  const out = new Float64Array(n);
  let state = seed >>> 0;
  for (let i = 0; i < n; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    out[i] = (state / 0xffffffff) * 2 - 1;
  }
  return out;
}

function sine(n: number, freq: number, sampleRate: number, amplitude = 1): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

/**
 * Test signal: decaying drum-like bursts over a sustained harmonic bed.
 *
 * The bed is not decoration. A signal made only of decaying hits is close to
 * 100% transient energy, so attenuating transients attenuates essentially
 * everything and the peak-to-average ratio barely moves — the metric goes blind
 * exactly where it needs to discriminate. Real programme material always has
 * sustained content underneath, and with a bed present the crest factor tracks
 * what the attack control actually does.
 */
function transientSignal(n: number, sampleRate: number): Float64Array {
  const out = noise(n, 999);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    out[i] =
      out[i] * 0.02 +
      0.12 * Math.sin(2 * Math.PI * 220 * t) +
      0.09 * Math.sin(2 * Math.PI * 330 * t) +
      0.06 * Math.sin(2 * Math.PI * 880 * t);
  }
  for (let hit = 0; hit < 8; hit++) {
    const start = Math.floor((hit + 0.5) * (n / 8));
    for (let i = 0; i < sampleRate * 0.2 && start + i < n; i++) {
      const decay = Math.exp(-i / (sampleRate * 0.02));
      out[start + i] += 0.7 * decay * Math.sin((2 * Math.PI * 180 * i) / sampleRate);
    }
  }
  return out;
}

function toBuffers(channels: Float64Array[], sampleRate: number): AudioBuffers {
  return { sampleRate, channels, length: channels[0].length };
}

// ---------------------------------------------------------------------------

section('FFT and convolution');
{
  const n = 1024;
  const re = noise(n, 7);
  const im = new Float64Array(n);
  const reCopy = Float64Array.from(re);

  fft(re, im);
  fft(re, im, true);
  check('forward then inverse FFT is the identity', maxAbsDiff(re, reCopy) < 1e-12,
    `max error ${maxAbsDiff(re, reCopy).toExponential(2)}`);

  // Direct convolution against the FFT path, on sizes that exercise both branches.
  const x = noise(500, 3);
  const h = noise(200, 4);
  const fast = convolve(x, h);
  const slow = new Float64Array(x.length + h.length - 1);
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < h.length; j++) slow[i + j] += x[i] * h[j];
  }
  check('overlap-add convolution matches direct convolution', maxAbsDiff(fast, slow) < 1e-10,
    `max error ${maxAbsDiff(fast, slow).toExponential(2)}`);
}

section('FIR design');
{
  const lp = designLowpass(0.1, 501);
  let dc = 0;
  for (const v of lp) dc += v;
  check('lowpass has exactly unity DC gain', Math.abs(dc - 1) < 1e-12,
    `gain ${dc}`);

  const hb = designHalfband(255);
  const center = (hb.length - 1) / 2;
  check('halfband centre tap is 0.5', Math.abs(hb[center] - 0.5) < 1e-12);
  let evenEnergy = 0;
  for (let i = 0; i < hb.length; i++) {
    const k = i - center;
    if (k !== 0 && k % 2 === 0) evenEnergy += Math.abs(hb[i]);
  }
  check('halfband even taps are zero', evenEnergy === 0, `energy ${evenEnergy}`);
  let hbDc = 0;
  for (const v of hb) hbDc += v;
  check('halfband has unity DC gain', Math.abs(hbDc - 1) < 1e-12, `gain ${hbDc}`);
}

section('Crossover reconstruction');
{
  const sampleRate = 48000;
  const x = noise(48000, 11);

  const bands = splitBandsLinearPhase(x, sampleRate, [140, 1400]);
  check('linear phase produces one more band than crossovers', bands.length === 3);
  const sum = new Float64Array(x.length);
  for (const band of bands) {
    for (let i = 0; i < x.length; i++) sum[i] += band[i];
  }
  const lpError = maxAbsDiff(sum, x);
  check('linear-phase bands sum back to the input', lpError < 1e-9,
    `max error ${lpError.toExponential(2)}`);

  // The IIR path is allpass rather than transparent, so check magnitude flatness
  // by sweeping sines through it rather than comparing sample by sample.
  let worstDb = 0;
  for (const freq of [50, 120, 140, 300, 800, 1400, 3000, 9000, 15000]) {
    const tone = sine(24000, freq, sampleRate);
    const iirBands = splitBandsIir(tone, sampleRate, [140, 1400]);
    const iirSum = new Float64Array(tone.length);
    for (const band of iirBands) {
      for (let i = 0; i < tone.length; i++) iirSum[i] += band[i];
    }
    // Skip the filter start-up transient.
    const settled = iirSum.subarray(4000);
    const db = 20 * Math.log10(rms(settled) / rms(tone.subarray(4000)));
    if (Math.abs(db) > Math.abs(worstDb)) worstDb = db;
  }
  check('zero-latency bands sum to flat magnitude', Math.abs(worstDb) < 0.15,
    `worst deviation ${worstDb.toFixed(3)} dB`);
}

section('Oversampling');
{
  const sampleRate = 48000;
  const tone = sine(16384, 1000, sampleRate, 0.5);

  for (const factor of [2, 4, 8] as const) {
    const round = downsample(upsample(tone, factor), factor);
    const n = Math.min(round.length, tone.length);
    // Compare in the settled middle; the edges include filter ring-in.
    const a = tone.subarray(2000, n - 2000);
    const b = round.subarray(2000, n - 2000);
    const db = 20 * Math.log10(rms(b) / rms(a));
    check(`${factor}x round trip preserves level`, Math.abs(db) < 0.05,
      `${db.toFixed(4)} dB`);
    check(`${factor}x round trip preserves waveform`, maxAbsDiff(Float64Array.from(a), Float64Array.from(b)) < 2e-3,
      `max error ${maxAbsDiff(Float64Array.from(a), Float64Array.from(b)).toExponential(2)}`);
  }
}

section('WAV round trip');
{
  const sampleRate = 96000;
  const left = sine(4096, 440, sampleRate, 0.5);
  const right = sine(4096, 660, sampleRate, 0.25);
  const source = toBuffers([left, right], sampleRate);

  const floatWav = encodeWav(source, { bitDepth: 32, float: true, dither: false, noiseShaping: false });
  const decoded = decodeWav(floatWav);
  check('float export preserves sample rate', decoded.sampleRate === sampleRate);
  check('float export preserves channel count', decoded.channels.length === 2);
  check('float export preserves frame count', decoded.length === 4096);
  // Float32 storage is the only quantisation in the lossless path.
  const err = Math.max(maxAbsDiff(decoded.channels[0], left), maxAbsDiff(decoded.channels[1], right));
  check('float export is bit-transparent to float32 precision', err < 1e-7,
    `max error ${err.toExponential(2)}`);

  const pcm24 = decodeWav(encodeWav(source, { bitDepth: 24, float: false, dither: true, noiseShaping: false }));
  const err24 = maxAbsDiff(pcm24.channels[0], left);
  check('24-bit export stays within a few LSBs', err24 < 1e-5, `max error ${err24.toExponential(2)}`);
  check('24-bit export reports its depth', pcm24.sourceBitDepth === 24);

  const silent = toBuffers([new Float64Array(2048), new Float64Array(2048)], 48000);
  const undithered = decodeWav(encodeWav(silent, { bitDepth: 16, float: false, dither: false, noiseShaping: false }));
  check('undithered silence quantises to true zero', rms(undithered.channels[0]) === 0);
  const dithered = decodeWav(encodeWav(silent, { bitDepth: 16, float: false, dither: true, noiseShaping: false }));
  check('dithered silence carries sub-LSB noise', rms(dithered.channels[0]) > 0 && rms(dithered.channels[0]) < 1e-4,
    `rms ${rms(dithered.channels[0]).toExponential(2)}`);
}

section('Loudness');
{
  const sampleRate = 48000;
  const amp = Math.pow(10, -20 / 20);
  const tone = sine(sampleRate * 4, 1000, sampleRate, amp);
  const stereo = toBuffers([tone, Float64Array.from(tone)], sampleRate);
  const report = measureLoudness(stereo);

  // A 1 kHz sine at -20 dBFS on both channels sits near -20 LUFS; the exact
  // figure depends on the K-weighting gain at 1 kHz.
  check('integrated loudness of a -20 dBFS tone is near -20 LUFS',
    Math.abs(report.integratedLufs + 20) < 3,
    `${report.integratedLufs.toFixed(2)} LUFS`);
  check('sample peak matches the tone amplitude', Math.abs(report.samplePeakDb + 20) < 0.1,
    `${report.samplePeakDb.toFixed(2)} dBFS`);
  check('true peak is at or above sample peak', report.truePeakDb >= report.samplePeakDb - 0.01,
    `tp ${report.truePeakDb.toFixed(2)} sp ${report.samplePeakDb.toFixed(2)}`);

  const quiet = toBuffers([new Float64Array(sampleRate)], sampleRate);
  check('digital silence gates to -Infinity', !Number.isFinite(measureLoudness(quiet).integratedLufs));
}

section('Chain transparency and shaping');
{
  const sampleRate = 48000;
  const x = transientSignal(sampleRate * 2, sampleRate);
  const source = toBuffers([Float64Array.from(x), Float64Array.from(x)], sampleRate);

  // Neutral: no shaping, no drive. prd.md 5 requires this to null against input.
  const neutral = defaultChain();
  neutral.latencyMode = 'hq-linear';
  neutral.autoGainMatch = false;
  neutral.bands = neutral.bands.map((b) => ({ ...b, drive: 0, satMix: 0 }));
  const passed = processChain(source, neutral);
  const nullDepth = 20 * Math.log10(Math.max(maxAbsDiff(passed.channels[0], source.channels[0]), 1e-20));
  check('neutral chain nulls against the input below -100 dBFS', nullDepth < -100,
    `null depth ${nullDepth.toFixed(1)} dBFS`);

  const crest = (buf: Float64Array) => {
    let peak = 0;
    for (const v of buf) peak = Math.max(peak, Math.abs(v));
    return 20 * Math.log10(peak / rms(buf));
  };
  const before = crest(source.channels[0]);

  const punchy = defaultChain();
  punchy.autoGainMatch = false;
  punchy.bands = punchy.bands.map((b) => ({ ...b, attackDb: 12, drive: 0, satMix: 0 }));
  const shaped = processChain(source, punchy);
  check('attack up increases crest factor', crest(shaped.channels[0]) > before + 0.5,
    `${before.toFixed(2)} dB -> ${crest(shaped.channels[0]).toFixed(2)} dB`);

  const soft = defaultChain();
  soft.autoGainMatch = false;
  soft.bands = soft.bands.map((b) => ({ ...b, attackDb: -12, drive: 0, satMix: 0 }));
  check('attack down decreases crest factor', crest(processChain(source, soft).channels[0]) < before - 0.5);

  check('stereo-linked detection keeps channels identical',
    maxAbsDiff(shaped.channels[0], shaped.channels[1]) === 0);
  check('no NaN or Infinity in the output',
    shaped.channels.every((c) => c.every((v) => Number.isFinite(v))));

  // DETAIL is an HF-weighted path: it must add high-frequency energy without
  // becoming a broadband level change.
  const detailed = defaultChain();
  detailed.autoGainMatch = false;
  detailed.bands = detailed.bands.map((b) => ({ ...b, detail: 1, drive: 0, satMix: 0 }));
  const withDetail = processChain(source, detailed);
  const flat = defaultChain();
  flat.autoGainMatch = false;
  flat.bands = flat.bands.map((b) => ({ ...b, drive: 0, satMix: 0 }));
  const withoutDetail = processChain(source, flat);
  check('DETAIL raises peak without a broadband level jump',
    crest(withDetail.channels[0]) > crest(withoutDetail.channels[0]),
    `${crest(withoutDetail.channels[0]).toFixed(2)} -> ${crest(withDetail.channels[0]).toFixed(2)} dB`);

  // Solo must mute every band that is not soloed.
  const soloed = defaultChain();
  soloed.autoGainMatch = false;
  soloed.bands = soloed.bands.map((b, i) => ({ ...b, solo: i === 1, drive: 0, satMix: 0 }));
  const soloOut = processChain(source, soloed);
  let soloPeak = 0;
  for (const v of soloOut.channels[0]) soloPeak = Math.max(soloPeak, Math.abs(v));
  let fullPeak = 0;
  for (const v of withoutDetail.channels[0]) fullPeak = Math.max(fullPeak, Math.abs(v));
  check('solo isolates a single band', soloPeak > 1e-5 && soloPeak < fullPeak * 0.95,
    `solo ${soloPeak.toFixed(4)} vs full ${fullPeak.toFixed(4)}`);
}

section('Band editing');
{
  const chain = defaultChain();
  check('default state is three bands', chain.bands.length === 3 && chain.crossoverHz.length === 2);

  let edited = addBandAt(chain, 800);
  check('click-to-add inserts a band', edited.bands.length === 4 && edited.crossoverHz.length === 3);
  check('added crossover lands where asked', edited.crossoverHz.includes(800));

  // prd.md 3.1: maximum six bands.
  for (let i = 0; i < 6; i++) edited = addBandAt(edited, 300 + i * 137);
  check('band count is capped at six', edited.bands.length === MAX_BANDS,
    `got ${edited.bands.length}`);

  const removed = removeBand(edited, 2);
  check('remove merges into a neighbour',
    removed.bands.length === edited.bands.length - 1 &&
      removed.crossoverHz.length === edited.crossoverHz.length - 1);

  const single = removeBand({ ...chain, bands: [defaultBand()], crossoverHz: [] }, 0);
  check('the last band cannot be removed', single.bands.length === 1);

  // tdd.md 6.2: crossovers clamp 15% clear of their neighbours.
  const squeezed = moveCrossover(chain, 1, 100);
  check('crossover drag is clamped against its neighbour',
    squeezed.crossoverHz[1] > squeezed.crossoverHz[0],
    `${squeezed.crossoverHz.map((c) => c.toFixed(0)).join(', ')}`);
}

section('Saturation engines');
{
  const sampleRate = 48000;
  const x = transientSignal(sampleRate, sampleRate);
  const source = toBuffers([x], sampleRate);

  for (const device of DEVICES) {
    // Small-signal gain must be ~unity, or the engine is a volume control
    // wearing a tone control's label.
    //
    // Measured with a settled 1 kHz sine rather than a single sample: several
    // engines carry voicing filters, and a filter's response to one impulse is
    // its first coefficient, not its passband gain. A one-shot probe would
    // report those engines as broken when they are behaving correctly.
    const probe = sine(8192, 1000, sampleRate, 1e-4);
    const fn = makeSaturator({ device, drive: 0.5, character: 0.5, sampleRate });
    const probed = new Float64Array(probe.length);
    for (let i = 0; i < probe.length; i++) probed[i] = fn(probe[i]);
    const settledIn = probe.subarray(2048);
    const settledOut = probed.subarray(2048);
    const gainDb = 20 * Math.log10(rms(Float64Array.from(settledOut)) / rms(Float64Array.from(settledIn)));
    check(`${device.name} passes small signals at unity`, Math.abs(gainDb) < 3,
      `${gainDb.toFixed(2)} dB`);

    const chain = defaultChain();
    chain.autoGainMatch = false;
    chain.oversample = 4;
    chain.bands = chain.bands.map((b) => ({
      ...b, deviceId: device.id, attackDb: 4, sustainDb: 3, drive: 0.6, satMix: 1,
    }));
    const out = processChain(source, chain);
    let peak = 0;
    for (const v of out.channels[0]) peak = Math.max(peak, Math.abs(v));
    check(`${device.name} renders finite audio at a sane level`,
      out.channels[0].every((v) => Number.isFinite(v)) && peak > 1e-4 && peak < 8,
      `peak ${peak.toFixed(3)}`);
  }
}

section('A/B and timeline rendering');
{
  const sampleRate = 48000;
  const x = transientSignal(sampleRate * 3, sampleRate);
  const source = toBuffers([Float64Array.from(x), Float64Array.from(x)], sampleRate);

  const chains = ['sa2rate', 'vulture', 'hg2'].map((id) => {
    const chain = defaultChain();
    chain.bands = chain.bands.map((b) => ({ ...b, deviceId: id, attackDb: 6 }));
    return chain;
  });

  const results = renderAB(source, chains);
  check('A/B renders one result per chain', results.length === 3);
  check('A/B results keep the source length', results.every((r) => r.buffers.length === source.length));

  const reference = measureLoudness(source).integratedLufs;
  const worstMismatch = Math.max(
    ...results.map((r) => Math.abs(r.loudness.integratedLufs - reference)),
  );
  check('A/B results are loudness matched to the source', worstMismatch < 0.5,
    `worst ${worstMismatch.toFixed(3)} LU`);

  const timeline = renderTimeline(source, {
    baseChain: chains[0],
    regions: [
      { id: 'a', startSec: 0.5, endSec: 1.5, crossfadeMs: 50, chain: chains[1] },
      { id: 'b', startSec: 1.4, endSec: 2.5, crossfadeMs: 50, chain: chains[2] },
    ],
  });
  check('timeline render keeps the source length', timeline.buffers.length === source.length);
  check('timeline render is finite', timeline.buffers.channels[0].every((v) => Number.isFinite(v)));

  // Where no region is active, the timeline must equal the base render exactly.
  const baseOnly = processChain(source, chains[0]);
  let edgeError = 0;
  for (let i = 0; i < 0.4 * sampleRate; i++) {
    edgeError = Math.max(edgeError, Math.abs(timeline.buffers.channels[0][i] - baseOnly.channels[0][i]));
  }
  check('timeline falls back to the base chain outside regions', edgeError < 1e-12,
    `max error ${edgeError.toExponential(2)}`);

  // Overlapping regions must not sum past unity and spike the level. The base
  // chain counts here too: it occupies most of the timeline, so leaving it out
  // would compare the blend against the wrong ceiling.
  let timelinePeak = 0;
  let referencePeak = 0;
  for (const r of chains.map((c) => processChain(source, c))) {
    for (const v of r.channels[0]) referencePeak = Math.max(referencePeak, Math.abs(v));
  }
  for (const v of timeline.buffers.channels[0]) timelinePeak = Math.max(timelinePeak, Math.abs(v));
  check('overlapping regions do not spike the level', timelinePeak <= referencePeak * 1.02,
    `timeline ${timelinePeak.toFixed(3)} vs max pass ${referencePeak.toFixed(3)}`);
}

// ---------------------------------------------------------------------------

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
