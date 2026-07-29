/**
 * MultiTransBend — the ten saturation engines.
 *
 * Per prd.md §3.2 these are original DSP models *inspired by* the character of
 * well-known hardware, with original names and original panel artwork. No
 * hardware was measured (prd.md §4, tdd.md §5.2): each engine is a character
 * model built from published circuit topology, specification figures, and
 * listening. `calibration` exists so a future swept-sine measurement of a real
 * unit can be fitted in without touching the topology — tdd.md §5.2's
 * calibration-layer plan, present from day one rather than retrofitted.
 *
 * Skin metadata (face, ink, accent, texture, knob, meter, tubes, switches,
 * params) is transcribed from design/transband/gui/transband-v5.jsx, which
 * prd.md §8 designates the canonical visual spec.
 */

import {
  BandParams,
  Chain,
  MAX_BANDS,
  adaptiveTimes,
  bandCentreHz,
} from './types';

/** The nonlinear core a device is built on. */
export type SaturationCore =
  | 'valve-twin' // triode/pentode pair, bias-shifting
  | 'tape-tranny' // tape softening plus transformer iron
  | 'pentode-triode' // parallel pentode and triode paths
  | 'program-tube' // program EQ into a single tube stage
  | 'tape-silk' // tape emulation with a silk shelf
  | 'tube-transformer' // tube drive into an output transformer
  | 'warm-lpf' // gentle warming with an analogue lowpass
  | 'even-harmonic' // asymmetric, even-order dominant
  | 'band-drive' // per-sub-band drive into a shared core
  | 'fet-diode'; // FET and diode harmonic paths

export type KnobVariant = 'chicken' | 'alu' | 'glossy';
export type Texture = 'powder' | 'anodized' | 'brushed';
export type MeterType = 'vu' | 'led';

export interface DeviceModel {
  id: string;
  /** In-product name. Original by design — see prd.md §9. */
  name: string;
  /** Faceplate subtitle. */
  sub: string;

  // ---- visual skin (gui/transband-v5.jsx) ----
  face: string;
  ink: string;
  accent: string;
  texture: Texture;
  knob: KnobVariant;
  knobFace: string;
  pointer: string;
  meter: MeterType;
  /** Glowing valves visible on the RACK 3D top plate. */
  tubes: number;
  /** Faceplate toggle labels. */
  switches: [string, string];
  /** Faceplate knob labels, front panel order. */
  params: string[];

  // ---- dsp model ----
  core: SaturationCore;
  /** What the CHARACTER macro controls on this engine. */
  characterLabel: string;
  /** Drive multiplier at DRIVE = 1. Sets how hard the engine can be pushed. */
  driveDepth: number;
  /** Static asymmetry before CHARACTER modulates it, [-1, 1]. */
  bias: number;
  /** Corner of the engine's own voicing filter, Hz. */
  toneHz: number;
  /** Output trim baked into the voicing, dB. Keeps engines level-matched. */
  outputTrimDb: number;
  /**
   * Harmonic calibration weights: [2nd, 3rd, 4th, 5th] relative emphasis.
   * Re-fittable from swept-sine measurements without changing the topology.
   */
  calibration: [number, number, number, number];
}

export const DEVICES: DeviceModel[] = [
  {
    id: 'vulture',
    name: 'VULTURE',
    sub: 'TWIN VALVE DISTORTION',
    face: '#e3dac0',
    ink: '#33291a',
    accent: '#a5322b',
    texture: 'powder',
    knob: 'chicken',
    knobFace: '#a5322b',
    pointer: '#f2e9d4',
    meter: 'vu',
    tubes: 2,
    switches: ['TRI/PENT', 'OVERDRIVE'],
    params: ['DRIVE', 'BIAS', 'DISTORTION', 'FILTER', 'OUTPUT'],
    core: 'valve-twin',
    characterLabel: 'Triode → pentode bias',
    driveDepth: 14,
    bias: 0.35,
    toneHz: 8000,
    outputTrimDb: -1.4,
    calibration: [1, 0.85, 0.5, 0.42],
  },
  {
    id: 'fatso',
    name: 'PHATSO 7x',
    sub: 'TAPE SIM / OPTIMIZER',
    face: '#17181c',
    ink: '#dfe3ea',
    accent: '#43c96e',
    texture: 'anodized',
    knob: 'alu',
    knobFace: '#d9dade',
    pointer: '#17181c',
    meter: 'led',
    tubes: 0,
    switches: ['TRANNY IN', 'WARMTH'],
    params: ['INPUT', 'TRANNY', 'WARMTH', 'SPANK', 'OUTPUT'],
    core: 'tape-tranny',
    characterLabel: 'Tape ↔ transformer',
    driveDepth: 9,
    bias: 0.12,
    toneHz: 12000,
    outputTrimDb: -0.9,
    calibration: [0.8, 1, 0.35, 0.3],
  },
  {
    id: 'hg2',
    name: 'HG·II',
    sub: 'PENTODE + TRIODE SAT',
    face: '#0d0d12',
    ink: '#e8dcba',
    accent: '#d3a24a',
    texture: 'anodized',
    knob: 'glossy',
    knobFace: '#1e1e26',
    pointer: '#d3a24a',
    meter: 'vu',
    tubes: 4,
    switches: ['AIR', 'ALT TUBE'],
    params: ['PENTODE', 'TRIODE', 'SATURATION', 'DENSITY', 'OUTPUT'],
    core: 'pentode-triode',
    characterLabel: 'Pentode ↔ triode blend',
    driveDepth: 11,
    bias: 0.2,
    toneHz: 14000,
    outputTrimDb: -1.1,
    calibration: [1, 0.7, 0.55, 0.35],
  },
  {
    id: 'vitalizer',
    name: 'REVITALIZER',
    sub: 'PROGRAM EQ · TUBE',
    face: '#2b3d55',
    ink: '#e4ebf5',
    accent: '#8db9e8',
    texture: 'brushed',
    knob: 'alu',
    knobFace: '#c7ccd6',
    pointer: '#1a2230',
    meter: 'led',
    tubes: 1,
    switches: ['TUBE IN', 'WIDE'],
    params: ['DRIVE', 'MID-HI TUNE', 'BASS', 'INTENSITY', 'OUTPUT'],
    core: 'program-tube',
    characterLabel: 'Mid-high tune',
    driveDepth: 7,
    bias: 0.28,
    toneHz: 3800,
    outputTrimDb: -0.7,
    calibration: [1, 0.45, 0.3, 0.2],
  },
  {
    id: 'portico',
    name: 'P·542',
    sub: 'TAPE EMULATION · SILK',
    face: '#363a41',
    ink: '#ece9e2',
    accent: '#c33b36',
    texture: 'brushed',
    knob: 'glossy',
    knobFace: '#b8352f',
    pointer: '#f4f1ea',
    meter: 'led',
    tubes: 0,
    switches: ['SILK RED', 'SILK BLUE'],
    params: ['TRIM', 'SATURATION', 'TEXTURE', 'SOFTEN', 'OUTPUT'],
    core: 'tape-silk',
    characterLabel: 'Silk blue ↔ red',
    driveDepth: 8,
    bias: 0.15,
    toneHz: 9000,
    outputTrimDb: -0.8,
    calibration: [0.9, 0.6, 0.4, 0.25],
  },
  {
    id: 'glats1',
    name: 'WIZARD TS·1',
    sub: 'STEREO TUBE SATURATOR',
    face: '#1c1e23',
    ink: '#ecdcc0',
    accent: '#e0913c',
    texture: 'anodized',
    knob: 'chicken',
    knobFace: '#141519',
    pointer: '#e0913c',
    meter: 'vu',
    tubes: 2,
    switches: ['XFMR OUT', 'HI-Z'],
    params: ['TUBE DRIVE', 'TRANSFORMER', 'BLEND', 'TONE', 'OUTPUT'],
    core: 'tube-transformer',
    characterLabel: 'Transformer drive',
    driveDepth: 12,
    bias: 0.3,
    toneHz: 220,
    outputTrimDb: -1.2,
    calibration: [1, 0.75, 0.45, 0.4],
  },
  {
    id: 'boum',
    name: 'BØM',
    sub: 'ANALOG WARMING',
    face: '#efece3',
    ink: '#26262b',
    accent: '#e0574f',
    texture: 'powder',
    knob: 'glossy',
    knobFace: '#2a2a30',
    pointer: '#efece3',
    meter: 'led',
    tubes: 0,
    switches: ['DIRT', 'GLUE'],
    params: ['WARM', 'DRIVE', 'LPF', 'SQUASH', 'OUTPUT'],
    core: 'warm-lpf',
    characterLabel: 'Analogue lowpass',
    driveDepth: 10,
    bias: -0.18,
    toneHz: 7000,
    outputTrimDb: -0.6,
    calibration: [0.6, 1, 0.3, 0.45],
  },
  {
    id: 'sa2rate',
    name: 'SA²RATE',
    sub: 'EVEN-HARMONIC SAT',
    face: '#f0e3c6',
    ink: '#3c301c',
    accent: '#d97c25',
    texture: 'powder',
    knob: 'chicken',
    knobFace: '#3c301c',
    pointer: '#f0e3c6',
    meter: 'led',
    tubes: 0,
    switches: ['MORE', 'SOFT CLIP'],
    params: ['SATURATION', 'EVEN / ODD', 'MIX', 'TRIM', 'OUTPUT'],
    core: 'even-harmonic',
    characterLabel: 'Even ↔ odd symmetry',
    driveDepth: 13,
    bias: 0.5,
    toneHz: 16000,
    outputTrimDb: -1.0,
    calibration: [1, 0.3, 0.6, 0.2],
  },
  {
    id: 'carnaby',
    name: 'CARNABY',
    sub: 'HARMONIC EQ',
    face: '#23262c',
    ink: '#ece6d8',
    accent: '#e0524d',
    texture: 'brushed',
    knob: 'glossy',
    knobFace: '#15171b',
    pointer: '#e0524d',
    meter: 'led',
    tubes: 0,
    switches: ['SAT LINK', 'HPF'],
    params: ['LF SAT', 'MF SAT', 'HF SAT', 'DRIVE', 'OUTPUT'],
    core: 'band-drive',
    characterLabel: 'Drive tilt, LF → HF',
    driveDepth: 9,
    bias: 0.1,
    toneHz: 1000,
    outputTrimDb: -0.7,
    calibration: [0.85, 0.8, 0.4, 0.3],
  },
  {
    id: 'overstayer',
    name: 'M·A·S',
    sub: 'HARMONICS / DENSITY',
    face: '#1a1a1a',
    ink: '#f0e9d8',
    accent: '#f2b02c',
    texture: 'anodized',
    knob: 'alu',
    knobFace: '#2a2a2a',
    pointer: '#f2b02c',
    meter: 'led',
    tubes: 0,
    switches: ['FET/DIODE', 'TIGHT LF'],
    params: ['RATIO', 'HARMONICS', 'DENSITY', 'FILTER', 'OUTPUT'],
    core: 'fet-diode',
    characterLabel: 'FET ↔ diode',
    driveDepth: 12,
    bias: -0.3,
    toneHz: 60,
    outputTrimDb: -1.0,
    calibration: [0.7, 1, 0.35, 0.55],
  },
];

const DEVICE_INDEX = new Map(DEVICES.map((device) => [device.id, device]));

export function getDevice(id: string): DeviceModel {
  return DEVICE_INDEX.get(id) ?? DEVICES[0];
}

/** Band tints, transcribed from the canonical GUI spec. */
export const BAND_COLORS = [
  '#e0574f',
  '#e0913c',
  '#d9a92f',
  '#4fb26c',
  '#5f93d0',
  '#9a7fd0',
];

export function bandColor(index: number): string {
  return BAND_COLORS[index % BAND_COLORS.length];
}

/** Default crossovers from the canonical mockup: three bands at 180 Hz / 2.5 kHz. */
export const DEFAULT_CROSSOVERS = [180, 2500];

export function defaultBand(deviceId = 'sa2rate'): BandParams {
  return {
    on: true,
    solo: false,
    attackDb: 0,
    sustainDb: 0,
    detail: 0,
    attackTimeMs: null,
    releaseTimeMs: null,
    sustainTimeMs: null,
    deviceId,
    drive: 0.4,
    character: 0.5,
    satMix: 0.7,
    mix: 1,
    outputDb: 0,
  };
}

/** The mockup's opening state: SA²RATE / VULTURE / HG·II across three bands. */
export function defaultChain(): Chain {
  return {
    crossoverHz: [...DEFAULT_CROSSOVERS],
    bands: [defaultBand('sa2rate'), defaultBand('vulture'), defaultBand('hg2')],
    latencyMode: 'zero',
    oversample: 4,
    precision: 64,
    inputTrimDb: 0,
    outputTrimDb: 0,
    mix: 1,
    autoGainMatch: true,
  };
}

/** Resolved detector times for a band, honouring any manual override. */
export function resolveTimes(
  band: BandParams,
  crossoverHz: number[],
  index: number,
): { attackTimeMs: number; releaseTimeMs: number; sustainTimeMs: number } {
  const auto = adaptiveTimes(bandCentreHz(crossoverHz, index));
  return {
    attackTimeMs: band.attackTimeMs ?? auto.attackTimeMs,
    releaseTimeMs: band.releaseTimeMs ?? auto.releaseTimeMs,
    sustainTimeMs: band.sustainTimeMs ?? auto.sustainTimeMs,
  };
}

/**
 * Insert a crossover at `freq`, splitting the band that contains it.
 * The new band inherits the settings of the one it was cut from, which is what
 * the mockup does and what makes click-to-add feel non-destructive.
 */
export function addBandAt(chain: Chain, freq: number): Chain {
  if (chain.bands.length >= MAX_BANDS) return chain;

  const sorted = [...chain.crossoverHz].sort((a, b) => a - b);
  const at = sorted.findIndex((c) => freq < c);
  const insertAt = at === -1 ? sorted.length : at;

  const crossoverHz = [...sorted.slice(0, insertAt), freq, ...sorted.slice(insertAt)];
  const source = chain.bands[insertAt] ?? defaultBand();
  const bands = [
    ...chain.bands.slice(0, insertAt + 1),
    { ...source, solo: false },
    ...chain.bands.slice(insertAt + 1),
  ];

  return { ...chain, crossoverHz, bands };
}

/** Remove a band, merging it into its neighbour. */
export function removeBand(chain: Chain, index: number): Chain {
  if (chain.bands.length <= 1) return chain;
  const crossoverIndex = index === 0 ? 0 : index - 1;
  return {
    ...chain,
    crossoverHz: chain.crossoverHz.filter((_, i) => i !== crossoverIndex),
    bands: chain.bands.filter((_, i) => i !== index),
  };
}

/**
 * Move a crossover, clamped to 15% clear of its neighbours.
 * tdd.md §6.2 specifies the clamp; without it a drag can invert two crossovers
 * and produce a zero-width band.
 */
export function moveCrossover(chain: Chain, index: number, freq: number): Chain {
  const sorted = [...chain.crossoverHz].sort((a, b) => a - b);
  const low = (index === 0 ? 22 : sorted[index - 1]) * 1.15;
  const high = (index === sorted.length - 1 ? 18000 : sorted[index + 1]) / 1.15;
  const clamped = Math.min(high, Math.max(low, freq));
  return {
    ...chain,
    crossoverHz: sorted.map((c, i) => (i === index ? clamped : c)),
  };
}

export interface FactoryPreset {
  id: string;
  name: string;
  group: 'drums' | 'bus' | 'mix';
  description: string;
  chain: Chain;
}

function preset(
  base: Chain,
  crossoverHz: number[],
  bands: Array<Partial<BandParams> & { deviceId: string }>,
): Chain {
  return {
    ...base,
    crossoverHz,
    bands: bands.map((patch) => ({ ...defaultBand(patch.deviceId), ...patch })),
  };
}

/** prd.md §6 — factory bank organised by source. */
export const FACTORY_PRESETS: FactoryPreset[] = [
  {
    id: 'drum-bus-snap',
    name: 'Drum Bus Snap',
    group: 'drums',
    description: 'Weight below 140, snap through the body, air on top. Even-harmonic glue.',
    chain: preset(defaultChain(), [140, 2200], [
      { deviceId: 'sa2rate', attackDb: 2.5, sustainDb: -1, drive: 0.35, character: 0.35, satMix: 0.6 },
      { deviceId: 'vulture', attackDb: 6, sustainDb: -3, detail: 0.3, drive: 0.45, character: 0.5, satMix: 0.55 },
      { deviceId: 'hg2', attackDb: 5, sustainDb: -2, detail: 0.55, drive: 0.3, character: 0.6, satMix: 0.5 },
    ]),
  },
  {
    id: 'room-collapse',
    name: 'Room Collapse',
    group: 'drums',
    description: 'Pulls the tail off overheads and ambience without touching the hit.',
    chain: preset(defaultChain(), [200, 3000], [
      { deviceId: 'boum', attackDb: 0, sustainDb: -7, drive: 0.2, satMix: 0.4 },
      { deviceId: 'boum', attackDb: 2, sustainDb: -11, drive: 0.25, satMix: 0.45 },
      { deviceId: 'portico', attackDb: 1, sustainDb: -9, detail: 0.25, drive: 0.2, satMix: 0.4 },
    ]),
  },
  {
    id: 'parallel-crush',
    name: 'Parallel Crush',
    group: 'drums',
    description: 'Hard valve drive held at 40% band mix. All character, none of the level.',
    chain: preset(defaultChain(), [120, 1800], [
      { deviceId: 'overstayer', attackDb: 4, sustainDb: 2, drive: 0.8, character: 0.35, satMix: 1, mix: 0.4 },
      { deviceId: 'vulture', attackDb: 7, sustainDb: 3, drive: 0.85, character: 0.7, satMix: 1, mix: 0.4 },
      { deviceId: 'vulture', attackDb: 5, sustainDb: 1, detail: 0.5, drive: 0.7, character: 0.8, satMix: 1, mix: 0.4 },
    ]),
  },
  {
    id: 'bus-glue',
    name: 'Bus Glue',
    group: 'bus',
    description: 'Small moves, tape below and transformer above. Level matched.',
    chain: preset(defaultChain(), [160, 4000], [
      { deviceId: 'fatso', attackDb: 1, sustainDb: 1.5, drive: 0.3, character: 0.4, satMix: 0.5 },
      { deviceId: 'fatso', attackDb: 1.5, sustainDb: 1, drive: 0.28, character: 0.5, satMix: 0.45 },
      { deviceId: 'glats1', attackDb: 2, sustainDb: 0.5, detail: 0.3, drive: 0.25, character: 0.45, satMix: 0.4 },
    ]),
  },
  {
    id: 'vocal-forward',
    name: 'Vocal Forward',
    group: 'bus',
    description: 'Articulation up top, chest register untouched, programme EQ tube on the mids.',
    chain: preset(defaultChain(), [220, 3200], [
      { deviceId: 'portico', attackDb: 0, sustainDb: 1, drive: 0.2, satMix: 0.35 },
      { deviceId: 'vitalizer', attackDb: 2, sustainDb: 2, drive: 0.35, character: 0.55, satMix: 0.5 },
      { deviceId: 'vitalizer', attackDb: 4.5, sustainDb: 0, detail: 0.6, drive: 0.3, character: 0.65, satMix: 0.45 },
    ]),
  },
  {
    id: 'master-air',
    name: 'Master Air',
    group: 'mix',
    description: 'Four bands, tiny moves, linear phase. For the last 2% of a finished mix.',
    chain: {
      ...defaultChain(),
      latencyMode: 'hq-linear',
      crossoverHz: [110, 900, 6000],
      bands: [
        { ...defaultBand('fatso'), attackDb: 0.8, sustainDb: 0.6, drive: 0.18, satMix: 0.3 },
        { ...defaultBand('carnaby'), attackDb: 1, sustainDb: 0.5, drive: 0.16, character: 0.4, satMix: 0.3 },
        { ...defaultBand('carnaby'), attackDb: 1.4, sustainDb: 0.4, drive: 0.15, character: 0.55, satMix: 0.28 },
        { ...defaultBand('sa2rate'), attackDb: 1.8, sustainDb: 0.3, detail: 0.35, drive: 0.14, character: 0.3, satMix: 0.25 },
      ],
    },
  },
  {
    id: 'low-end-authority',
    name: 'Low End Authority',
    group: 'mix',
    description: 'Transformer iron on the bottom, definition restored to a squashed bass.',
    chain: preset(defaultChain(), [90, 700], [
      { deviceId: 'glats1', attackDb: 3.5, sustainDb: 2, drive: 0.5, character: 0.75, satMix: 0.6 },
      { deviceId: 'overstayer', attackDb: 4, sustainDb: -1, drive: 0.4, character: 0.4, satMix: 0.5 },
      { deviceId: 'carnaby', attackDb: 1.5, sustainDb: 0, detail: 0.3, drive: 0.25, character: 0.6, satMix: 0.35 },
    ]),
  },
];
