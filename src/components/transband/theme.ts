/**
 * Theme system — transcribed from design/transband/gui/transband-v5.jsx.
 *
 * Per prd.md §3.4 and tdd.md §6.3 the theme affects app chrome only: page,
 * panels, prefs bar, chips, spectrum. Hardware faceplates keep their own device
 * colours in both themes, because a faceplate that changed colour with the app
 * theme would stop reading as a physical object.
 */

export const FONT_LABEL =
  "'Avenir Next Condensed','Arial Narrow','Helvetica Neue',sans-serif";
export const FONT_MONO = "'SF Mono','JetBrains Mono',Menlo,monospace";

export interface Theme {
  id: 'dark' | 'light';
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

export const THEMES: Record<'dark' | 'light', Theme> = {
  dark: {
    id: 'dark',
    pageBg: 'radial-gradient(1400px 700px at 50% -15%, #23262e, #0a0b0d 65%)',
    header: '#efece2',
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
    ctrlText: '#e6e2d6',
    knobFace: '#23262d',
    specBg: 'linear-gradient(180deg,#06080b,#0c0f14)',
    specGrid: 'rgba(140,160,190,.07)',
    specGrid2: 'rgba(140,160,190,.05)',
    specTick: '#4a5462',
    specLine: 'rgba(141,185,232,.6)',
    specArea: 'rgba(141,185,232,.10)',
    xover: '#e8e4d8',
    xoverTag: '#1a1e25',
    xoverTagBorder: '#3a404c',
    xoverText: '#dfe3ea',
    nodeStroke: '#0b0d10',
    hint: '#3f4855',
    accentGrad: 'linear-gradient(180deg,#f2d868,#d9b53a)',
    accentText: '#14161a',
    stripBg: '#12141a',
    stripBorder: '#22252b',
    stripText: '#8a93a0',
    envBg: 'linear-gradient(180deg,#07090c,#0c0f14)',
  },
  light: {
    id: 'light',
    pageBg: 'radial-gradient(1400px 700px at 50% -15%, #ffffff, #dcd8cd 70%)',
    header: '#2a2c33',
    text: '#3a3e47',
    sub: '#8a8f9a',
    faint: '#a8abb2',
    panelBg: 'linear-gradient(180deg,#fbfaf6,#eceae2)',
    panelBorder: '#cfcbbe',
    barBg: 'linear-gradient(180deg,#f6f4ee,#e8e5db)',
    barBorder: '#cfcbbe',
    chipBg: '#f2f0e9',
    chipBorder: '#cfcbbe',
    chipText: '#4a4e58',
    segBg: '#eceae2',
    segBorder: '#c5c1b4',
    segText: '#6a6f7a',
    ctrlBg: '#f6f4ee',
    ctrlBorder: '#c5c1b4',
    ctrlText: '#33363e',
    knobFace: '#dad7cd',
    specBg: 'linear-gradient(180deg,#f2f4f6,#e2e6ea)',
    specGrid: 'rgba(40,60,90,.08)',
    specGrid2: 'rgba(40,60,90,.06)',
    specTick: '#7a828e',
    specLine: 'rgba(50,95,150,.65)',
    specArea: 'rgba(50,95,150,.10)',
    xover: '#3a3e47',
    xoverTag: '#fbfaf6',
    xoverTagBorder: '#b5b1a4',
    xoverText: '#3a3e47',
    nodeStroke: '#f2f4f6',
    hint: '#98a0ab',
    accentGrad: 'linear-gradient(180deg,#e8c94f,#cfa62e)',
    accentText: '#2a2410',
    stripBg: '#f2f0e9',
    stripBorder: '#cfcbbe',
    stripText: '#6a6f7a',
    envBg: 'linear-gradient(180deg,#eef0f3,#e0e4e9)',
  },
};

/** Lighten or darken a hex colour by a signed 0-255 amount. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (x: number) => Math.min(255, Math.max(0, x + amount));
  return `rgb(${clamp(n >> 16)},${clamp((n >> 8) & 255)},${clamp(n & 255)})`;
}

export function fmtHz(f: number): string {
  return f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)}k` : `${Math.round(f)}`;
}

/** Faceplate surface treatments. */
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
