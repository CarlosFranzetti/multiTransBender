/**
 * The ten saturation cores.
 *
 * Each returns a stateful, sample-ordered function so the filtered engines can
 * hold biquad state in the closure. `processOversampled` calls them strictly in
 * order, which is what makes that safe.
 *
 * Two invariants every core holds, and the tests check:
 *
 *  1. **Unit slope at zero.** Engaging an engine changes tone and density, not
 *     level. Without this, "warmer" is just "louder" and every A/B picks the
 *     loudest option rather than the best one.
 *  2. **Bounded and C1-continuous.** No curve produces a discontinuity, so the
 *     decimation filter has nothing to smear into wideband hash.
 *
 * These are character models, not measured emulations (prd.md §4, tdd.md §5.2).
 * `calibration` on each device weights its harmonic emphasis and is the hook for
 * fitting against a real unit later without touching the topology.
 */

import { Biquad, highShelfCoeffs, highpassCoeffs, lowpassCoeffs } from './filters';
import { DeviceModel } from './devices';

export interface SaturatorConfig {
  device: DeviceModel;
  /** DRIVE, 0–1. */
  drive: number;
  /** CHARACTER, 0–1. Meaning is per-device; see DeviceModel.characterLabel. */
  character: number;
  /** Rate the core runs at — already multiplied by the oversampling factor. */
  sampleRate: number;
}

// ---------------------------------------------------------------------------
// Primitive curves. All have f(0) = 0 and f'(0) = 1.
// ---------------------------------------------------------------------------

/** Asymmetric soft clip; bias generates even harmonics. */
function asymTanh(x: number, bias: number): number {
  const sech2 = 1 / Math.cosh(bias) ** 2;
  return (Math.tanh(x + bias) - Math.tanh(bias)) / sech2;
}

/** Cubic soft clip — harder knee, odd-order. Saturates at ±2/3. */
function cubicClip(x: number): number {
  if (x >= 1) return 2 / 3;
  if (x <= -1) return -2 / 3;
  return x - (x * x * x) / 3;
}

/** Tape-like: asymptotic to ±1 with a third-order approach. */
function tapeCurve(x: number): number {
  const a = Math.abs(x);
  return x / Math.cbrt(1 + a * a * a);
}

/** Diode pair; `asym` splits the forward and reverse knees. */
function diodeCurve(x: number, asym: number): number {
  const k = 1 + Math.max(asym, 0) * 3;
  return x >= 0 ? 1 - Math.exp(-x) : -(1 - Math.exp(x * k)) / k;
}

/**
 * Simplified Koren-style valve stage.
 *
 * A real triode's plate current follows a 3/2-power law above cutoff and simply
 * stops below it. That hard asymmetry — conducting one way, cutting off the
 * other — is where valve second-harmonic actually comes from, so the model keeps
 * it rather than approximating the whole thing with a symmetric curve.
 * `pentode` hardens the knee toward the flatter pentode characteristic.
 */
function valveStage(x: number, bias: number, pentode: number): number {
  const shifted = x + bias;
  const soft = asymTanh(shifted, 0) - asymTanh(bias, 0);
  const hard = cubicClip(shifted * 1.3) - cubicClip(bias * 1.3);
  const blended = soft * (1 - pentode) + hard * pentode;
  // Restore unit small-signal slope, which the bias point otherwise reduces.
  const slope = (1 - pentode) / Math.cosh(bias) ** 2 + pentode * 1.3 * (1 - bias * bias * 1.69);
  return blended / Math.max(slope, 0.05);
}

// ---------------------------------------------------------------------------

export type SampleFn = (x: number) => number;

const identity: SampleFn = (x) => x;

export function makeSaturator(config: SaturatorConfig): SampleFn {
  const { device, drive, character, sampleRate } = config;
  if (drive <= 0.0001) return identity;

  const g = 1 + drive * device.driveDepth;
  const bias = device.bias;
  const [h2, h3] = device.calibration;

  switch (device.core) {
    // VULTURE — triode/pentode pair with a bias that shifts under drive.
    case 'valve-twin': {
      const pentode = character;
      let sag = 0;
      const sagCoeff = Math.exp(-1 / (sampleRate * 0.05));
      const tone = new Biquad();
      tone.setCoeffs(lowpassCoeffs(device.toneHz, sampleRate));
      return (x) => {
        // Rectified level pulls the operating point around, the way a real
        // supply sags. This is what makes hard playing sound different from
        // loud playing rather than simply louder.
        const level = Math.abs(x);
        sag = level + sagCoeff * (sag - level);
        const dynamicBias = bias * h2 * (1 - Math.min(sag, 1) * 0.55);
        return tone.process(valveStage(g * x, dynamicBias, pentode) / g);
      };
    }

    // PHATSO 7x — tape softening morphing into transformer iron.
    case 'tape-tranny': {
      const tranny = character;
      const lf = new Biquad();
      lf.setCoeffs(lowpassCoeffs(180, sampleRate));
      const air = new Biquad();
      air.setCoeffs(highShelfCoeffs(device.toneHz, sampleRate, -1.5 * drive));
      return (x) => {
        const tape = tapeCurve(g * x) / g;
        const low = lf.process(x);
        const iron = tapeCurve(g * 1.4 * low) / (g * 1.4) + (x - low);
        return air.process(tape * (1 - tranny) + iron * tranny);
      };
    }

    // HG·II — parallel pentode and triode paths.
    case 'pentode-triode': {
      const triode = character;
      const airShelf = new Biquad();
      airShelf.setCoeffs(highShelfCoeffs(device.toneHz, sampleRate, 1.2 * drive));
      return (x) => {
        const pent = cubicClip(g * x) / g;
        const tri = asymTanh(g * x, bias * h2) / g;
        return airShelf.process(pent * (1 - triode) + tri * triode);
      };
    }

    // REVITALIZER — programme EQ into a single tube stage.
    case 'program-tube': {
      // CHARACTER sweeps the mid-high tune point, as on the faceplate.
      const tuneHz = 900 * Math.pow(10, character * 0.95);
      const emphasis = new Biquad();
      emphasis.setCoeffs(highShelfCoeffs(tuneHz, sampleRate, 3.5 * drive));
      const deEmphasis = new Biquad();
      deEmphasis.setCoeffs(highShelfCoeffs(tuneHz, sampleRate, -2.2 * drive));
      return (x) => {
        // Emphasise, saturate, partially de-emphasise: the tube only ever sees
        // the tuned band hard, so the rest of the spectrum stays clean.
        const pre = emphasis.process(x);
        const driven = asymTanh(g * pre, bias * h2) / g;
        return deEmphasis.process(driven);
      };
    }

    // P·542 — tape emulation with the silk shelf morphing blue → red.
    case 'tape-silk': {
      const red = character;
      const silkLow = new Biquad();
      silkLow.setCoeffs(highShelfCoeffs(400, sampleRate, 2.0 * drive * red));
      const silkHigh = new Biquad();
      silkHigh.setCoeffs(highShelfCoeffs(device.toneHz, sampleRate, 2.4 * drive * (1 - red)));
      return (x) => {
        const tape = tapeCurve(g * x) / g;
        const harmonic = asymTanh(g * 0.6 * tape, bias * h2) / (g * 0.6);
        return silkHigh.process(silkLow.process(harmonic));
      };
    }

    // WIZARD TS·1 — tube drive into an output transformer.
    case 'tube-transformer': {
      const xfmr = character;
      const iron = new Biquad();
      iron.setCoeffs(lowpassCoeffs(device.toneHz, sampleRate));
      const bump = new Biquad();
      bump.setCoeffs(highpassCoeffs(28, sampleRate));
      return (x) => {
        const tube = asymTanh(g * x, bias * h2) / g;
        const low = iron.process(tube);
        // Only the iron sees the hard drive; the rest passes through, so the
        // top end does not dull as the transformer is pushed.
        const saturatedIron = tapeCurve(g * (1 + xfmr * 2) * low) / (g * (1 + xfmr * 2));
        return bump.process(saturatedIron * xfmr + low * (1 - xfmr) + (tube - low));
      };
    }

    // BØM — gentle warming into an analogue lowpass.
    case 'warm-lpf': {
      const cutoff = 1200 * Math.pow(10, character * 1.15);
      const lpf = new Biquad();
      lpf.setCoeffs(lowpassCoeffs(Math.min(cutoff, sampleRate * 0.45), sampleRate));
      return (x) => {
        const warm = asymTanh(g * x, bias * h3) / g;
        return lpf.process(warm);
      };
    }

    // SA²RATE — even-harmonic core; CHARACTER morphs symmetry even ↔ odd.
    case 'even-harmonic': {
      // 0 = fully asymmetric (even dominant), 1 = symmetric (odd dominant).
      const symmetry = character;
      const effectiveBias = bias * h2 * (1 - symmetry);
      return (x) => {
        const even = asymTanh(g * x, effectiveBias) / g;
        const odd = cubicClip(g * x) / g;
        return even * (1 - symmetry * 0.6) + odd * symmetry * 0.6;
      };
    }

    // CARNABY — three internal sub-bands driven by a shared core, tilted by CHARACTER.
    case 'band-drive': {
      const lowSplit = new Biquad();
      lowSplit.setCoeffs(lowpassCoeffs(200, sampleRate));
      const highSplit = new Biquad();
      highSplit.setCoeffs(lowpassCoeffs(2500, sampleRate));
      // CHARACTER tilts which sub-band is driven hardest, LF through HF.
      const tilt = character * 2 - 1;
      const lowDrive = g * (1 - tilt * 0.6);
      const midDrive = g;
      const highDrive = g * (1 + tilt * 0.6);
      return (x) => {
        const low = lowSplit.process(x);
        const lowMid = highSplit.process(x);
        const mid = lowMid - low;
        const high = x - lowMid;
        return (
          asymTanh(lowDrive * low, bias) / lowDrive +
          asymTanh(midDrive * mid, bias) / midDrive +
          asymTanh(highDrive * high, bias) / highDrive
        );
      };
    }

    // M·A·S — FET and diode harmonic paths, blended by CHARACTER.
    case 'fet-diode': {
      const diode = character;
      const tight = new Biquad();
      tight.setCoeffs(highpassCoeffs(device.toneHz, sampleRate));
      const asym = Math.abs(bias);
      const dc = diodeCurve(bias * 0.5, asym);
      return (x) => {
        const fet = cubicClip(g * x + bias * 0.3) / g - cubicClip(bias * 0.3) / g;
        const dio = (diodeCurve(g * x + bias * 0.5, asym) - dc) / g;
        const blended = fet * (1 - diode) + dio * diode;
        // Keeps the low end from turning to mush as density rises.
        return tight.process(blended) * 0.35 + blended * 0.65;
      };
    }

    default:
      return identity;
  }
}
