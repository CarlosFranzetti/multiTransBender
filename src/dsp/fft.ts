/**
 * Iterative radix-2 complex FFT with cached twiddle factors, plus the
 * overlap-add convolution used by the linear-phase crossover.
 *
 * Everything is Float64 so long FIR convolutions stay well below the noise
 * floor of the 32-bit float export format.
 */

interface Twiddles {
  cos: Float64Array;
  sin: Float64Array;
  rev: Uint32Array;
}

const twiddleCache = new Map<number, Twiddles>();

function getTwiddles(n: number): Twiddles {
  const cached = twiddleCache.get(n);
  if (cached) return cached;
  if ((n & (n - 1)) !== 0) throw new Error(`FFT size must be a power of two, got ${n}`);

  const half = n >>> 1;
  const cos = new Float64Array(half);
  const sin = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    const angle = (-2 * Math.PI * i) / n;
    cos[i] = Math.cos(angle);
    sin[i] = Math.sin(angle);
  }

  const bits = Math.log2(n) | 0;
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let x = i;
    let r = 0;
    for (let b = 0; b < bits; b++) {
      r = (r << 1) | (x & 1);
      x >>>= 1;
    }
    rev[i] = r >>> 0;
  }

  const t: Twiddles = { cos, sin, rev };
  twiddleCache.set(n, t);
  return t;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** In-place complex FFT. `inverse` performs the unnormalised inverse. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  const { cos, sin, rev } = getTwiddles(n);

  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let tmp = re[i];
      re[i] = re[j];
      re[j] = tmp;
      tmp = im[i];
      im[i] = im[j];
      im[j] = tmp;
    }
  }

  const sign = inverse ? -1 : 1;
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >>> 1;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cos[k];
        const wi = sign * sin[k];
        const a = i + j;
        const b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }

  if (inverse) {
    const inv = 1 / n;
    for (let i = 0; i < n; i++) {
      re[i] *= inv;
      im[i] *= inv;
    }
  }
}

/**
 * Overlap-add FIR convolution. Returns `input.length + kernel.length - 1`
 * samples; callers trim the FIR group delay themselves so that complementary
 * band pairs stay sample-aligned.
 */
export function convolve(input: Float64Array, kernel: Float64Array): Float64Array {
  const kn = kernel.length;
  const outLen = input.length + kn - 1;

  // Short kernels are faster and more accurate done directly.
  if (kn <= 64 || input.length <= 64) {
    const out = new Float64Array(outLen);
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      if (x === 0) continue;
      for (let j = 0; j < kn; j++) out[i + j] += x * kernel[j];
    }
    return out;
  }

  // Pick a block size that keeps the FFT comfortably larger than the kernel.
  const fftSize = nextPowerOfTwo(Math.max(kn * 4, 2048));
  const blockSize = fftSize - kn + 1;

  const kre = new Float64Array(fftSize);
  const kim = new Float64Array(fftSize);
  kre.set(kernel);
  fft(kre, kim);

  const out = new Float64Array(outLen);
  const bre = new Float64Array(fftSize);
  const bim = new Float64Array(fftSize);

  for (let pos = 0; pos < input.length; pos += blockSize) {
    const n = Math.min(blockSize, input.length - pos);
    bre.fill(0);
    bim.fill(0);
    for (let i = 0; i < n; i++) bre[i] = input[pos + i];

    fft(bre, bim);
    for (let i = 0; i < fftSize; i++) {
      const xr = bre[i];
      const xi = bim[i];
      bre[i] = xr * kre[i] - xi * kim[i];
      bim[i] = xr * kim[i] + xi * kre[i];
    }
    fft(bre, bim, true);

    const limit = Math.min(fftSize, outLen - pos);
    for (let i = 0; i < limit; i++) out[pos + i] += bre[i];
  }

  return out;
}
