/**
 * Biquad filters (transposed direct form II, Float64 state) and the
 * Linkwitz-Riley crossover used in zero-latency mode.
 *
 * LR4 is built from two cascaded Butterworth sections. Its lowpass and highpass
 * outputs sum to a second-order allpass, which is why a three-band split needs
 * the low band run through a matching allpass at the upper crossover: without
 * it the bands sum with a magnitude notch around the crossover point.
 */

const SQRT1_2 = Math.SQRT1_2;

export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export class Biquad {
  private c: BiquadCoeffs = { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };
  private z1 = 0;
  private z2 = 0;

  setCoeffs(c: BiquadCoeffs): void {
    this.c = c;
  }

  reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }

  process(x: number): number {
    const { b0, b1, b2, a1, a2 } = this.c;
    const y = b0 * x + this.z1;
    this.z1 = b1 * x - a1 * y + this.z2;
    this.z2 = b2 * x - a2 * y;
    return y;
  }

  processBlock(input: Float64Array, output: Float64Array = input): void {
    const { b0, b1, b2, a1, a2 } = this.c;
    let z1 = this.z1;
    let z2 = this.z2;
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const y = b0 * x + z1;
      z1 = b1 * x - a1 * y + z2;
      z2 = b2 * x - a2 * y;
      output[i] = y;
    }
    // Flush denormals; they cost far more than the accuracy they preserve.
    this.z1 = Math.abs(z1) < 1e-300 ? 0 : z1;
    this.z2 = Math.abs(z2) < 1e-300 ? 0 : z2;
  }
}

function omega(freq: number, sampleRate: number): number {
  // Clamp just below Nyquist so tan() stays finite at extreme settings.
  const f = Math.min(Math.max(freq, 1), sampleRate * 0.49);
  return (2 * Math.PI * f) / sampleRate;
}

export function lowpassCoeffs(freq: number, sampleRate: number, q = SQRT1_2): BiquadCoeffs {
  const w = omega(freq, sampleRate);
  const cosw = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: ((1 - cosw) / 2) / a0,
    b1: (1 - cosw) / a0,
    b2: ((1 - cosw) / 2) / a0,
    a1: (-2 * cosw) / a0,
    a2: (1 - alpha) / a0,
  };
}

export function highpassCoeffs(freq: number, sampleRate: number, q = SQRT1_2): BiquadCoeffs {
  const w = omega(freq, sampleRate);
  const cosw = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: ((1 + cosw) / 2) / a0,
    b1: (-(1 + cosw)) / a0,
    b2: ((1 + cosw) / 2) / a0,
    a1: (-2 * cosw) / a0,
    a2: (1 - alpha) / a0,
  };
}

export function allpassCoeffs(freq: number, sampleRate: number, q = SQRT1_2): BiquadCoeffs {
  const w = omega(freq, sampleRate);
  const cosw = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 - alpha) / a0,
    b1: (-2 * cosw) / a0,
    b2: (1 + alpha) / a0,
    a1: (-2 * cosw) / a0,
    a2: (1 - alpha) / a0,
  };
}

export function highShelfCoeffs(freq: number, sampleRate: number, gainDb: number): BiquadCoeffs {
  const A = Math.pow(10, gainDb / 40);
  const w = omega(freq, sampleRate);
  const cosw = Math.cos(w);
  const alpha = (Math.sin(w) / 2) * Math.sqrt((A + 1 / A) * (1 / SQRT1_2 - 1) + 2);
  const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
  const a0 = A + 1 - (A - 1) * cosw + twoSqrtAAlpha;
  return {
    b0: (A * (A + 1 + (A - 1) * cosw + twoSqrtAAlpha)) / a0,
    b1: (-2 * A * (A - 1 + (A + 1) * cosw)) / a0,
    b2: (A * (A + 1 + (A - 1) * cosw - twoSqrtAAlpha)) / a0,
    a1: (2 * (A - 1 - (A + 1) * cosw)) / a0,
    a2: (A + 1 - (A - 1) * cosw - twoSqrtAAlpha) / a0,
  };
}

/** Second-order Butterworth highpass pair used to clean up the detector path. */
export class DetectorFilter {
  private readonly hpf = new Biquad();
  private readonly tilt = new Biquad();
  private readonly useTilt: boolean;

  constructor(sampleRate: number, hpfHz: number, tiltDb: number) {
    this.hpf.setCoeffs(highpassCoeffs(hpfHz, sampleRate));
    this.useTilt = Math.abs(tiltDb) > 0.01;
    if (this.useTilt) this.tilt.setCoeffs(highShelfCoeffs(2000, sampleRate, tiltDb));
  }

  processBlock(input: Float64Array, output: Float64Array): void {
    this.hpf.processBlock(input, output);
    if (this.useTilt) this.tilt.processBlock(output, output);
  }
}

/** Fourth-order Linkwitz-Riley section (two cascaded Butterworth biquads). */
class Lr4Section {
  private readonly a = new Biquad();
  private readonly b = new Biquad();

  constructor(coeffs: BiquadCoeffs) {
    this.a.setCoeffs(coeffs);
    this.b.setCoeffs(coeffs);
  }

  processBlock(input: Float64Array, output: Float64Array): void {
    this.a.processBlock(input, output);
    this.b.processBlock(output, output);
  }
}

/**
 * Zero-latency multi-band split. Bands are produced low to high; summing all
 * outputs reconstructs the input through an allpass network (flat magnitude,
 * non-flat phase).
 */
export function splitBandsIir(
  input: Float64Array,
  sampleRate: number,
  crossoverHz: number[],
): Float64Array[] {
  const freqs = [...crossoverHz].sort((a, b) => a - b);
  if (freqs.length === 0) return [Float64Array.from(input)];

  const bands: Float64Array[] = [];
  let remainder = Float64Array.from(input);

  for (let i = 0; i < freqs.length; i++) {
    const freq = freqs[i];
    const low = new Float64Array(remainder.length);
    const high = new Float64Array(remainder.length);
    new Lr4Section(lowpassCoeffs(freq, sampleRate)).processBlock(remainder, low);
    new Lr4Section(highpassCoeffs(freq, sampleRate)).processBlock(remainder, high);

    // Every band already emitted sits below this crossover, so it needs the
    // matching allpass to stay phase-aligned with the bands still to come.
    // LR4 lowpass + highpass reduces to a single second-order allpass at Q=1/sqrt(2),
    // so one biquad is the exact compensator here, not a cascaded pair.
    for (const band of bands) {
      const ap = new Biquad();
      ap.setCoeffs(allpassCoeffs(freq, sampleRate));
      ap.processBlock(band, band);
    }

    bands.push(low);
    remainder = high;
  }

  bands.push(remainder);
  return bands;
}
