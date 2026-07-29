/**
 * Theme system — extends design/transband/gui/transband-v5.jsx.
 *
 * Per prd.md §3.4 and tdd.md §6.3 the theme affects app chrome only: page,
 * panels, prefs bar, chips, spectrum. Hardware faceplates keep their own device
 * colours in every theme, because a faceplate that changed colour with the app
 * chrome would stop reading as a physical object.
 *
 * The accent is blue rather than the mockup's gold. Gold sat in the same
 * hue family as several faceplates (VULTURE's cream, SA²RATE's sand, M·A·S's
 * amber), so selected chrome competed with the hardware it framed. A cool
 * accent separates "app" from "device" at a glance, and it stays legible
 * against every faceplate in the rack.
 */

export const FONT_LABEL =
  "'Avenir Next Condensed','Arial Narrow','Helvetica Neue',sans-serif";
export const FONT_MONO = "'SF Mono','JetBrains Mono',Menlo,monospace";

export type ThemeId = 'studio-dark' | 'studio-light' | 'midnight' | 'graphite';

export interface Theme {
  id: ThemeId;
  /** Shown in the theme picker. */
  name: string;
  /** True for dark chrome; a few components branch on this for shadow depth. */
  dark: boolean;
  /** The theme's signature colour, used for focus rings and the wordmark. */
  accent: string;

  pageBg: string;
  header: string;
  text: string;
  sub: string;
  faint: string;
  panelBg: string;
  panelBorder: string;
  barBg: string;
  barBorder: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
  segBg: string;
  segBorder: string;
  segText: string;
  ctrlBg: string;
  ctrlBorder: string;
  ctrlText: string;
  knobFace: string;
  specBg: string;
  specGrid: string;
  specGrid2: string;
  specTick: string;
  specLine: string;
  specArea: string;
  xover: string;
  xoverTag: string;
  xoverTagBorder: string;
  xoverText: string;
  nodeStroke: string;
  hint: string;
  accentGrad: string;
  accentText: string;
  stripBg: string;
  stripBorder: string;
  stripText: string;
  envBg: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  /** Default. Neutral near-black chrome, azure accent. */
  'studio-dark': {
    id: 'studio-dark',
    name: 'Studio Dark',
    dark: true,
    accent: '#4da3ff',
    pageBg: 'radial-gradient(1400px 700px at 50% -15%, #23262e, #0a0b0d 65%)',
    header: '#eceef2',
    text: '#c8cdd6',
    sub: '#5a6572',
    faint: '#3f4550',
    panelBg: 'linear-gradient(180deg,#191c22,#131519)',
    panelBorder: '#2b2f38',
    barBg: 'linear-gradient(180deg,#111318,#0c0e11)',
    barBorder: '#23262e',
    chipBg: '#101216',
    chipBorder: '#262a32',
    chipText: '#aab1bc',
    segBg: '#0d0f13',
    segBorder: '#2a2e36',
    segText: '#8a93a0',
    ctrlBg: '#181b21',
    ctrlBorder: '#2c3038',
    ctrlText: '#e2e6ec',
    knobFace: '#23262d',
    specBg: 'linear-gradient(180deg,#06080b,#0c0f14)',
    specGrid: 'rgba(140,160,190,.07)',
    specGrid2: 'rgba(140,160,190,.05)',
    specTick: '#4a5462',
    specLine: 'rgba(141,185,232,.6)',
    specArea: 'rgba(141,185,232,.10)',
    xover: '#dbe3ec',
    xoverTag: '#1a1e25',
    xoverTagBorder: '#3a404c',
    xoverText: '#dfe3ea',
    nodeStroke: '#0b0d10',
    hint: '#3f4855',
    accentGrad: 'linear-gradient(180deg,#6fb4ff,#2f86e0)',
    accentText: '#05121f',
    stripBg: '#12141a',
    stripBorder: '#22252b',
    stripText: '#8a93a0',
    envBg: 'linear-gradient(180deg,#07090c,#0c0f14)',
  },

  /** Daylight chrome for bright rooms. Same accent, darker ink. */
  'studio-light': {
    id: 'studio-light',
    name: 'Studio Light',
    dark: false,
    accent: '#2f86e0',
    pageBg: 'radial-gradient(1400px 700px at 50% -15%, #ffffff, #d8dde4 70%)',
    header: '#242a33',
    text: '#3a3e47',
    sub: '#7c838f',
    faint: '#a2a8b2',
    panelBg: 'linear-gradient(180deg,#fbfcfd,#eceef2)',
    panelBorder: '#c8ccd4',
    barBg: 'linear-gradient(180deg,#f6f8fa,#e6e9ee)',
    barBorder: '#c8ccd4',
    chipBg: '#f0f2f6',
    chipBorder: '#c8ccd4',
    chipText: '#464b56',
    segBg: '#e9ecf1',
    segBorder: '#bfc4cd',
    segText: '#676f7c',
    ctrlBg: '#f6f8fa',
    ctrlBorder: '#bfc4cd',
    ctrlText: '#2f333b',
    knobFace: '#d4d8df',
    specBg: 'linear-gradient(180deg,#f2f5f8,#e0e5eb)',
    specGrid: 'rgba(40,60,90,.08)',
    specGrid2: 'rgba(40,60,90,.06)',
    specTick: '#78808c',
    specLine: 'rgba(47,134,224,.65)',
    specArea: 'rgba(47,134,224,.10)',
    xover: '#3a3e47',
    xoverTag: '#fbfcfd',
    xoverTagBorder: '#b0b6c0',
    xoverText: '#3a3e47',
    nodeStroke: '#f2f5f8',
    hint: '#959ca7',
    accentGrad: 'linear-gradient(180deg,#5aa6f0,#2472c8)',
    accentText: '#ffffff',
    stripBg: '#f0f2f6',
    stripBorder: '#c8ccd4',
    stripText: '#676f7c',
    envBg: 'linear-gradient(180deg,#eef1f5,#dfe4ea)',
  },

  /** Deep indigo. Lowest ambient light, longest sessions. */
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    dark: true,
    accent: '#6ea8ff',
    pageBg: 'radial-gradient(1400px 700px at 50% -15%, #161c2e, #05070f 68%)',
    header: '#e6ecfa',
    text: '#b9c3d6',
    sub: '#5b6782',
    faint: '#3c4560',
    panelBg: 'linear-gradient(180deg,#141a2a,#0e121d)',
    panelBorder: '#242c42',
    barBg: 'linear-gradient(180deg,#0e1320,#090c15)',
    barBorder: '#1d2438',
    chipBg: '#0d111b',
    chipBorder: '#212940',
    chipText: '#9fabc4',
    segBg: '#0a0d16',
    segBorder: '#242c42',
    segText: '#7d89a4',
    ctrlBg: '#141a2a',
    ctrlBorder: '#28304a',
    ctrlText: '#dee5f2',
    knobFace: '#1e2536',
    specBg: 'linear-gradient(180deg,#04060d,#0a0e18)',
    specGrid: 'rgba(130,160,220,.08)',
    specGrid2: 'rgba(130,160,220,.05)',
    specTick: '#4a5674',
    specLine: 'rgba(150,190,255,.62)',
    specArea: 'rgba(120,170,255,.11)',
    xover: '#d6e0f5',
    xoverTag: '#161c2c',
    xoverTagBorder: '#333d5a',
    xoverText: '#dce4f4',
    nodeStroke: '#070a12',
    hint: '#3d4763',
    accentGrad: 'linear-gradient(180deg,#8bbcff,#3f7fe0)',
    accentText: '#04101f',
    stripBg: '#0f1420',
    stripBorder: '#1f2740',
    stripText: '#7d89a4',
    envBg: 'linear-gradient(180deg,#05080f,#0a0e18)',
  },

  /** Warm neutral grey with a steel accent. Least colour cast on the faceplates. */
  graphite: {
    id: 'graphite',
    name: 'Graphite',
    dark: true,
    accent: '#7fb0d8',
    pageBg: 'radial-gradient(1400px 700px at 50% -15%, #2a2926, #101010 66%)',
    header: '#ece9e4',
    text: '#c4c1bb',
    sub: '#6b6862',
    faint: '#4a4844',
    panelBg: 'linear-gradient(180deg,#1e1d1b,#161514)',
    panelBorder: '#33312e',
    barBg: 'linear-gradient(180deg,#161514,#101010)',
    barBorder: '#2a2926',
    chipBg: '#141312',
    chipBorder: '#2e2c29',
    chipText: '#aaa69f',
    segBg: '#111110',
    segBorder: '#33312e',
    segText: '#8a867f',
    ctrlBg: '#1c1b19',
    ctrlBorder: '#35332f',
    ctrlText: '#e4e1dc',
    knobFace: '#282622',
    specBg: 'linear-gradient(180deg,#0a0a09,#121211)',
    specGrid: 'rgba(190,185,175,.07)',
    specGrid2: 'rgba(190,185,175,.05)',
    specTick: '#5c5852',
    specLine: 'rgba(160,190,215,.6)',
    specArea: 'rgba(150,180,210,.09)',
    xover: '#e0dcd5',
    xoverTag: '#1e1d1b',
    xoverTagBorder: '#403d38',
    xoverText: '#e0dcd5',
    nodeStroke: '#0d0d0c',
    hint: '#4c4a45',
    accentGrad: 'linear-gradient(180deg,#9dc6e8,#5f92bb)',
    accentText: '#0b1620',
    stripBg: '#161514',
    stripBorder: '#2c2a27',
    stripText: '#8a867f',
    envBg: 'linear-gradient(180deg,#0a0a09,#121211)',
  },
};

/** Picker order. */
export const THEME_ORDER: ThemeId[] = [
  'studio-dark',
  'studio-light',
  'midnight',
  'graphite',
];

export const DEFAULT_THEME: ThemeId = 'studio-dark';

/** Lighten or darken a hex colour by a signed 0-255 amount. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (x: number) => Math.min(255, Math.max(0, x + amount));
  return `rgb(${clamp(n >> 16)},${clamp((n >> 8) & 255)},${clamp(n & 255)})`;
}

export function fmtHz(f: number): string {
  return f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)}k` : `${Math.round(f)}`;
}

/** Faceplate surface treatments. Theme-independent by design. */
export function textureCSS(
  texture: 'powder' | 'anodized' | 'brushed',
  face: string,
  dark: boolean,
): React.CSSProperties {
  const base = `linear-gradient(180deg, ${shade(face, dark ? 14 : 8)}, ${face} 30%, ${shade(
    face,
    dark ? -8 : -16,
  )})`;
  if (texture === 'brushed') {
    return {
      background: `repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, rgba(0,0,0,.045) 1px 2px), ${base}`,
    };
  }
  if (texture === 'anodized') {
    return {
      background: `radial-gradient(700px 200px at 50% -60%, rgba(255,255,255,.10), transparent 60%), ${base}`,
    };
  }
  return {
    background: `radial-gradient(500px 240px at 30% -40%, rgba(255,255,255,.22), transparent 55%), ${base}`,
  };
}

export function isDarkFace(face: string): boolean {
  return parseInt(face.slice(1, 3), 16) < 110;
}
