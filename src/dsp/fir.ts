/**
 * FIR design helpers: Kaiser-windowed sinc lowpass filters and the
 * complementary-pair construction used by the linear-phase crossover.
 *
 * The complementary trick matters for audio quality: instead of designing a
 * separate highpass (whose magnitude would only approximately complement the
 * lowpass), the highpass is built as `delta - lowpass`. The two bands then sum
 * to a mathematically exact pure delay, so a multi-band split with all bands at
 * unity is bit-transparent apart from that delay.
 */

/** Zeroth-order modified Bessel function of the first kind. */
function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  const halfX = x / 2;
  for (let k = 1; k < 60; k++) {
    term *= (halfX / k) * (halfX / k);
    sum += term;
    if (term < sum * 1e-17) break;
  }
  return sum;
}

/** Kaiser window of the given length and beta. */
export function kaiserWindow(length: number, beta: number): Float64Array {
  const w = new Float64Array(length);
  const denom = besselI0(beta);
  const m = length - 1;
  for (let i = 0; i < length; i++) {
    const r = (2 * i) / m - 1;
    const arg = 1 - r * r;
    w[i] = besselI0(beta * Math.sqrt(arg < 0 ? 0 : arg)) / denom;
  }
  return w;
}

/** Kaiser beta for a target stopband attenuation in dB. */
export function kaiserBeta(stopbandDb: number): number {
  if (stopbandDb > 50) return 0.1102 * (stopbandDb - 8.7);
  if (stopbandDb >= 21) return 0.5842 * Math.pow(stopbandDb - 21, 0.4) + 0.07886 * (stopbandDb - 21);
  return 0;
}

/**
 * Linear-phase lowpass via windowed sinc.
 *
 * @param cutoffNorm  Cutoff as a fraction of the sample rate (0..0.5).
 * @param length      Taps; forced odd so the group delay is a whole sample.
 * @param stopbandDb  Target stopband attenuation.
 */
export function designLowpass(cutoffNorm: number, length: number, stopbandDb = 110): Float64Array {
  const taps = length % 2 === 0 ? length + 1 : length;
  const h = new Float64Array(taps);
  const window = kaiserWindow(taps, kaiserBeta(stopbandDb));
  const center = (taps - 1) / 2;
  const wc = 2 * Math.PI * cutoffNorm;

  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const n = i - center;
    const sinc = n === 0 ? 2 * cutoffNorm : Math.sin(wc * n) / (Math.PI * n);
    h[i] = sinc * window[i];
    sum += h[i];
  }

  // Normalise DC gain to exactly 1 so the complementary highpass is exact.
  const inv = 1 / sum;
  for (let i = 0; i < taps; i++) h[i] *= inv;
  return h;
}

/**
 * Number of taps needed for a transition band of `transitionNorm` (fraction of
 * the sample rate) at the requested attenuation, rounded up to odd.
 */
export function estimateTaps(transitionNorm: number, stopbandDb = 110): number {
  const n = Math.ceil((stopbandDb - 8) / (2.285 * 2 * Math.PI * transitionNorm));
  return n % 2 === 0 ? n + 1 : n;
}

/** Group delay in samples of a symmetric odd-length FIR. */
export function firDelay(kernel: Float64Array): number {
  return (kernel.length - 1) / 2;
}

/**
 * Complementary highpass kernel: an impulse at the group delay minus the
 * lowpass. `lowpass + highpass` is exactly a unit impulse.
 */
export function complementaryHighpass(lowpass: Float64Array): Float64Array {
  const h = new Float64Array(lowpass.length);
  for (let i = 0; i < lowpass.length; i++) h[i] = -lowpass[i];
  h[(lowpass.length - 1) / 2] += 1;
  return h;
}

/**
 * Halfband lowpass for oversampling. Every other tap away from the centre is
 * exactly zero, which is what makes polyphase up/downsampling cheap, and the
 * centre tap is exactly 0.5.
 */
export function designHalfband(length: number, stopbandDb = 120): Float64Array {
  const taps = length % 4 === 3 ? length : length + ((3 - (length % 4)) % 4);
  const h = designLowpass(0.25, taps, stopbandDb);
  const center = (taps - 1) / 2;
  for (let i = 0; i < taps; i++) {
    const n = i - center;
    if (n !== 0 && n % 2 === 0) h[i] = 0;
  }
  h[center] = 0.5;

  // Renormalise the odd taps so DC gain is exactly 1.
  let sum = 0;
  for (let i = 0; i < taps; i++) sum += h[i];
  const correction = (1 - h[center]) / (sum - h[center]);
  for (let i = 0; i < taps; i++) {
    if (i !== center) h[i] *= correction;
  }
  return h;
}

/** Streaming FIR with an internal history buffer, for block-based use. */
export class FirFilter {
  private readonly kernel: Float64Array;
  private readonly history: Float64Array;
  private pos = 0;

  constructor(kernel: Float64Array) {
    this.kernel = kernel;
    this.history = new Float64Array(kernel.length);
  }

  reset(): void {
    this.history.fill(0);
    this.pos = 0;
  }

  process(x: number): number {
    const k = this.kernel;
    const h = this.history;
    const n = k.length;
    h[this.pos] = x;
    let acc = 0;
    let idx = this.pos;
    for (let i = 0; i < n; i++) {
      acc += k[i] * h[idx];
      idx = idx === 0 ? n - 1 : idx - 1;
    }
    this.pos = this.pos === n - 1 ? 0 : this.pos + 1;
    return acc;
  }
}
