/**
 * Native WAV/AIFF decoding and encoding.
 *
 * The browser's own `decodeAudioData` is not usable here: it resamples to the
 * AudioContext's rate, which silently destroys the "lossless" claim before
 * processing even starts. Parsing the container directly gives the file's true
 * sample rate, true bit depth, and bit-exact samples.
 */

import { AudioBuffers } from './types';

export interface DecodedAudio extends AudioBuffers {
  /** Source bit depth, for display and for choosing a sensible export default. */
  sourceBitDepth: number;
  sourceFormat: 'pcm' | 'float';
  /** Container the samples came from. */
  container: 'wav' | 'aiff' | 'decoded';
}

class Reader {
  readonly view: DataView;
  offset = 0;

  constructor(readonly buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  fourcc(at = this.offset): string {
    const b = new Uint8Array(this.buffer, at, 4);
    return String.fromCharCode(b[0], b[1], b[2], b[3]);
  }
}

function int24ToFloat(view: DataView, at: number): number {
  const b0 = view.getUint8(at);
  const b1 = view.getUint8(at + 1);
  const b2 = view.getUint8(at + 2);
  let value = b0 | (b1 << 8) | (b2 << 16);
  if (value & 0x800000) value |= ~0xffffff;
  return value / 8388608;
}

/** Decode a RIFF/WAVE (or RF64) file into planar Float64 channels. */
export function decodeWav(buffer: ArrayBuffer): DecodedAudio {
  const reader = new Reader(buffer);
  const { view } = reader;

  const riff = reader.fourcc(0);
  if (riff !== 'RIFF' && riff !== 'RF64') throw new Error('Not a RIFF/WAVE file');
  if (reader.fourcc(8) !== 'WAVE') throw new Error('RIFF file is not WAVE');

  let pos = 12;
  let formatTag = 0;
  let channelCount = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;
  let ds64DataLength = -1;

  while (pos + 8 <= buffer.byteLength) {
    const id = reader.fourcc(pos);
    let size = view.getUint32(pos + 4, true);
    const body = pos + 8;

    if (id === 'ds64') {
      // RF64 stores the real 64-bit sizes here.
      ds64DataLength = Number(view.getBigUint64(body + 8, true));
    } else if (id === 'fmt ') {
      formatTag = view.getUint16(body, true);
      channelCount = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
      if (formatTag === 0xfffe && size >= 40) {
        // WAVE_FORMAT_EXTENSIBLE: the real format is the first two bytes of the
        // SubFormat GUID.
        formatTag = view.getUint16(body + 24, true);
      }
    } else if (id === 'data') {
      dataOffset = body;
      dataLength = size === 0xffffffff && ds64DataLength >= 0 ? ds64DataLength : size;
      if (dataLength > buffer.byteLength - body) dataLength = buffer.byteLength - body;
      size = dataLength;
    }

    pos = body + size + (size % 2); // chunks are word-aligned
    if (size === 0 && id !== 'data') break;
  }

  if (dataOffset < 0) throw new Error('WAVE file has no data chunk');
  if (!channelCount || !sampleRate) throw new Error('WAVE file has no usable fmt chunk');

  const bytesPerSample = bitsPerSample >> 3;
  const frameSize = bytesPerSample * channelCount;
  const frames = Math.floor(dataLength / frameSize);

  const channels = Array.from({ length: channelCount }, () => new Float64Array(frames));
  const isFloat = formatTag === 3;

  for (let f = 0; f < frames; f++) {
    const base = dataOffset + f * frameSize;
    for (let c = 0; c < channelCount; c++) {
      const at = base + c * bytesPerSample;
      let sample: number;

      if (isFloat) {
        sample = bitsPerSample === 64 ? view.getFloat64(at, true) : view.getFloat32(at, true);
      } else {
        switch (bitsPerSample) {
          case 8:
            sample = (view.getUint8(at) - 128) / 128;
            break;
          case 16:
            sample = view.getInt16(at, true) / 32768;
            break;
          case 24:
            sample = int24ToFloat(view, at);
            break;
          case 32:
            sample = view.getInt32(at, true) / 2147483648;
            break;
          default:
            throw new Error(`Unsupported WAVE bit depth: ${bitsPerSample}`);
        }
      }
      channels[c][f] = sample;
    }
  }

  return {
    sampleRate,
    length: frames,
    channels,
    sourceBitDepth: bitsPerSample,
    sourceFormat: isFloat ? 'float' : 'pcm',
    container: 'wav',
  };
}

/** IEEE 754 80-bit extended float, as AIFF stores its sample rate. */
function readExtendedFloat(view: DataView, at: number): number {
  const exponent = view.getUint16(at);
  const hi = view.getUint32(at + 2);
  const lo = view.getUint32(at + 6);
  const sign = exponent & 0x8000 ? -1 : 1;
  const e = (exponent & 0x7fff) - 16383;
  const mantissa = hi * 4294967296 + lo;
  return sign * mantissa * Math.pow(2, e - 63);
}

export function decodeAiff(buffer: ArrayBuffer): DecodedAudio {
  const reader = new Reader(buffer);
  const { view } = reader;

  if (reader.fourcc(0) !== 'FORM') throw new Error('Not an AIFF file');
  const formType = reader.fourcc(8);
  if (formType !== 'AIFF' && formType !== 'AIFC') throw new Error('FORM file is not AIFF');

  let pos = 12;
  let channelCount = 0;
  let frames = 0;
  let bitsPerSample = 0;
  let sampleRate = 0;
  let dataOffset = -1;
  let compression = 'NONE';

  while (pos + 8 <= buffer.byteLength) {
    const id = reader.fourcc(pos);
    const size = view.getUint32(pos + 4);
    const body = pos + 8;

    if (id === 'COMM') {
      channelCount = view.getUint16(body);
      frames = view.getUint32(body + 2);
      bitsPerSample = view.getUint16(body + 6);
      sampleRate = readExtendedFloat(view, body + 8);
      if (formType === 'AIFC' && size >= 22) compression = reader.fourcc(body + 18);
    } else if (id === 'SSND') {
      const dataStart = view.getUint32(body);
      dataOffset = body + 8 + dataStart;
    }

    pos = body + size + (size % 2);
    if (size === 0) break;
  }

  if (dataOffset < 0 || !channelCount) throw new Error('AIFF file is missing COMM or SSND');
  const isFloat = compression === 'fl32' || compression === 'FL32' || compression === 'fl64';
  const littleEndian = compression === 'sowt';

  const bytesPerSample = bitsPerSample >> 3;
  const frameSize = bytesPerSample * channelCount;
  const channels = Array.from({ length: channelCount }, () => new Float64Array(frames));

  for (let f = 0; f < frames; f++) {
    const base = dataOffset + f * frameSize;
    for (let c = 0; c < channelCount; c++) {
      const at = base + c * bytesPerSample;
      let sample: number;

      if (isFloat) {
        sample = bitsPerSample === 64 ? view.getFloat64(at) : view.getFloat32(at);
      } else if (bitsPerSample === 16) {
        sample = view.getInt16(at, littleEndian) / 32768;
      } else if (bitsPerSample === 24) {
        if (littleEndian) {
          sample = int24ToFloat(view, at);
        } else {
          let value = (view.getUint8(at) << 16) | (view.getUint8(at + 1) << 8) | view.getUint8(at + 2);
          if (value & 0x800000) value |= ~0xffffff;
          sample = value / 8388608;
        }
      } else if (bitsPerSample === 32) {
        sample = view.getInt32(at, littleEndian) / 2147483648;
      } else if (bitsPerSample === 8) {
        sample = view.getInt8(at) / 128;
      } else {
        throw new Error(`Unsupported AIFF bit depth: ${bitsPerSample}`);
      }
      channels[c][f] = sample;
    }
  }

  return {
    sampleRate,
    length: frames,
    channels,
    sourceBitDepth: bitsPerSample,
    sourceFormat: isFloat ? 'float' : 'pcm',
    container: 'aiff',
  };
}

export type ExportBitDepth = 16 | 24 | 32;

export interface EncodeOptions {
  bitDepth: ExportBitDepth;
  /** Float export is only available at 32 bit and is bit-transparent. */
  float: boolean;
  /** TPDF dither, applied only when reducing to a fixed-point depth. */
  dither: boolean;
  /** Second-order noise shaping, pushing dither noise out of the ear's peak sensitivity. */
  noiseShaping: boolean;
}

function writeString(view: DataView, at: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
}

/**
 * Encode planar Float64 channels to a WAV file.
 *
 * 32-bit float export is the lossless path: the samples in the file are exactly
 * the samples the engine produced, with no quantisation, no dither, and no
 * clipping applied.
 */
export function encodeWav(buffers: AudioBuffers, options: EncodeOptions): ArrayBuffer {
  const { channels, sampleRate, length } = buffers;
  const channelCount = channels.length;
  const isFloat = options.float && options.bitDepth === 32;
  const bytesPerSample = options.bitDepth >> 3;
  const blockAlign = bytesPerSample * channelCount;
  const dataBytes = length * blockAlign;

  // RIFF header (12) + fmt (24) + data header (8).
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, isFloat ? 3 : 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, options.bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  const base = 44;

  if (isFloat) {
    for (let f = 0; f < length; f++) {
      for (let c = 0; c < channelCount; c++) {
        view.setFloat32(base + (f * channelCount + c) * 4, channels[c][f], true);
      }
    }
    return buffer;
  }

  const scale = options.bitDepth === 16 ? 32768 : options.bitDepth === 24 ? 8388608 : 2147483648;
  const maxValue = scale - 1;
  // Per-channel noise-shaping error history.
  const e1 = new Float64Array(channelCount);
  const e2 = new Float64Array(channelCount);

  for (let f = 0; f < length; f++) {
    for (let c = 0; c < channelCount; c++) {
      let sample = channels[c][f] * scale;

      if (options.noiseShaping) {
        // Second-order shaper: moves quantisation noise up out of the 3-4 kHz
        // region where hearing is most sensitive.
        sample += 2 * e1[c] - e2[c];
      }

      let dithered = sample;
      if (options.dither) {
        // TPDF at 1 LSB peak-to-peak: the sum of two independent rectangular
        // sources, which decorrelates the error from the signal.
        dithered += Math.random() + Math.random() - 1;
      }

      let quantised = Math.round(dithered);
      if (quantised > maxValue) quantised = maxValue;
      if (quantised < -scale) quantised = -scale;

      if (options.noiseShaping) {
        e2[c] = e1[c];
        e1[c] = quantised - sample;
      }

      const at = base + (f * channelCount + c) * bytesPerSample;
      if (options.bitDepth === 16) {
        view.setInt16(at, quantised, true);
      } else if (options.bitDepth === 24) {
        const v = quantised < 0 ? quantised + 0x1000000 : quantised;
        view.setUint8(at, v & 0xff);
        view.setUint8(at + 1, (v >> 8) & 0xff);
        view.setUint8(at + 2, (v >> 16) & 0xff);
      } else {
        view.setInt32(at, quantised, true);
      }
    }
  }

  return buffer;
}

/** Sample rate probe for MPEG audio, so fallback decoding keeps the native rate. */
export function probeMpegSampleRate(buffer: ArrayBuffer): number | null {
  const bytes = new Uint8Array(buffer);
  const rates: Record<number, number[]> = {
    3: [44100, 48000, 32000], // MPEG-1
    2: [22050, 24000, 16000], // MPEG-2
    0: [11025, 12000, 8000], // MPEG-2.5
  };

  const limit = Math.min(bytes.length - 4, 200000);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) continue;
    const versionBits = (bytes[i + 1] >> 3) & 0x03;
    const rateIndex = (bytes[i + 2] >> 2) & 0x03;
    const table = rates[versionBits];
    if (table && rateIndex < 3) return table[rateIndex];
  }
  return null;
}

export function sniffContainer(buffer: ArrayBuffer): 'wav' | 'aiff' | 'other' {
  if (buffer.byteLength < 12) return 'other';
  const reader = new Reader(buffer);
  const magic = reader.fourcc(0);
  if (magic === 'RIFF' || magic === 'RF64') return reader.fourcc(8) === 'WAVE' ? 'wav' : 'other';
  if (magic === 'FORM') {
    const type = reader.fourcc(8);
    if (type === 'AIFF' || type === 'AIFC') return 'aiff';
  }
  return 'other';
}
