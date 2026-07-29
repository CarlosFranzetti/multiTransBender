/// <reference lib="webworker" />

/**
 * Rendering worker.
 *
 * The whole engine runs here, off the main thread, so a multi-minute file does
 * not freeze the interface. It is also the only place the decoded audio ever
 * lives: nothing is uploaded, nothing is persisted, and closing the tab is
 * enough to destroy it.
 *
 * Float64 buffers stay resident in the worker for export. Playback copies are
 * downcast to Float32 and transferred, because that is all the Web Audio graph
 * can accept anyway and it halves what crosses the boundary.
 */

import { processChain } from '../dsp/chain';
import { measureLoudness } from '../dsp/loudness';
import { averageSpectrum, peakEnvelope, renderAB, renderTimeline, sliceBuffers } from '../dsp/render';
import { AudioBuffers, Chain, LoudnessReport, Region } from '../dsp/types';
import { DecodedAudio, decodeAiff, decodeWav, encodeWav, EncodeOptions, sniffContainer } from '../dsp/wav';

interface Variant {
  id: string;
  label: string;
  deviceId: string | null;
  buffers: AudioBuffers;
  loudness: LoudnessReport;
  matchGainDb: number;
}

let source: DecodedAudio | null = null;
const variants = new Map<string, Variant>();

type Request =
  | { id: number; type: 'decodeContainer'; data: ArrayBuffer; fileName: string }
  | {
      id: number;
      type: 'ingestPcm';
      channels: Float32Array[];
      sampleRate: number;
      fileName: string;
      sourceBitDepth: number;
    }
  | { id: number; type: 'renderAB'; chains: Chain[] }
  | { id: number; type: 'renderTimeline'; baseChain: Chain; regions: Region[]; gainMatch: boolean }
  | { id: number; type: 'renderPreview'; chain: Chain; startSec: number; endSec: number }
  | { id: number; type: 'export'; variantId: string; options: EncodeOptions }
  | { id: number; type: 'waveform'; variantId: string | null; buckets: number }
  | { id: number; type: 'spectrum'; variantId: string | null; points: number }
  | { id: number; type: 'clear' };

function post(message: unknown, transfer: Transferable[] = []): void {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message, transfer);
}

function progress(id: number, stage: string, value: number): void {
  post({ id, type: 'progress', stage, progress: value });
}

/** Playback copy: Float32, one array per channel, transferred not cloned. */
function toTransferable(buffers: AudioBuffers): {
  channels: Float32Array[];
  sampleRate: number;
  length: number;
} {
  const channels = buffers.channels.map((channel) => {
    const out = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) out[i] = channel[i];
    return out;
  });
  return { channels, sampleRate: buffers.sampleRate, length: buffers.length };
}

function sourceOrThrow(): DecodedAudio {
  if (!source) throw new Error('No audio loaded');
  return source;
}

function registerVariant(
  id: string,
  label: string,
  deviceId: string | null,
  buffers: AudioBuffers,
  loudness: LoudnessReport,
  matchGainDb: number,
): Variant {
  const variant: Variant = { id, label, deviceId, buffers, loudness, matchGainDb };
  variants.set(id, variant);
  return variant;
}

function describe(variant: Variant) {
  return {
    id: variant.id,
    label: variant.label,
    deviceId: variant.deviceId,
    loudness: variant.loudness,
    matchGainDb: variant.matchGainDb,
    durationSec: variant.buffers.length / variant.buffers.sampleRate,
  };
}

function resetSource(decoded: DecodedAudio, fileName: string, id: number): void {
  source = decoded;
  variants.clear();

  const loudness = measureLoudness(decoded);
  registerVariant('source', 'Source', null, decoded, loudness, 0);

  const playback = toTransferable(decoded);
  post(
    {
      id,
      type: 'loaded',
      fileName,
      sampleRate: decoded.sampleRate,
      channelCount: decoded.channels.length,
      length: decoded.length,
      durationSec: decoded.length / decoded.sampleRate,
      sourceBitDepth: decoded.sourceBitDepth,
      sourceFormat: decoded.sourceFormat,
      container: decoded.container,
      loudness,
      playback,
    },
    playback.channels.map((c) => c.buffer),
  );
}

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;

  try {
    switch (request.type) {
      case 'decodeContainer': {
        progress(request.id, 'Reading file', 0.1);
        const container = sniffContainer(request.data);
        if (container === 'other') throw new Error('Unsupported container');
        const decoded = container === 'wav' ? decodeWav(request.data) : decodeAiff(request.data);
        progress(request.id, 'Measuring', 0.7);
        resetSource(decoded, request.fileName, request.id);
        break;
      }

      case 'ingestPcm': {
        // Fallback path: the main thread decoded a compressed format for us.
        const channels = request.channels.map((c) => {
          const out = new Float64Array(c.length);
          for (let i = 0; i < c.length; i++) out[i] = c[i];
          return out;
        });
        const decoded: DecodedAudio = {
          sampleRate: request.sampleRate,
          length: channels[0]?.length ?? 0,
          channels,
          sourceBitDepth: request.sourceBitDepth,
          sourceFormat: 'float',
          container: 'decoded',
        };
        resetSource(decoded, request.fileName, request.id);
        break;
      }

      case 'renderAB': {
        const src = sourceOrThrow();
        // Drop previous renders before allocating new ones; a long file at 64-bit
        // stereo is heavy enough that holding two generations can exhaust the tab.
        for (const key of [...variants.keys()]) {
          if (key !== 'source') variants.delete(key);
        }

        const results = renderAB(src, request.chains, (report) =>
          progress(request.id, report.stage, report.progress),
        );

        const described = results.map((result, index) => {
          const chain = request.chains[index];
          const variant = registerVariant(
            `ab-${index}`,
            result.label,
            chain.bands.find((band) => band.on)?.deviceId ?? null,
            result.buffers,
            result.loudness,
            result.matchGainDb,
          );
          return describe(variant);
        });

        const playback = results.map((r) => toTransferable(r.buffers));
        post(
          { id: request.id, type: 'renderedAB', variants: described, playback },
          playback.flatMap((p) => p.channels.map((c) => c.buffer)),
        );
        break;
      }

      case 'renderTimeline': {
        const src = sourceOrThrow();
        variants.delete('timeline');
        const result = renderTimeline(src, {
          baseChain: request.baseChain,
          regions: request.regions,
          gainMatch: request.gainMatch,
          onProgress: (report) => progress(request.id, report.stage, report.progress),
        });

        const variant = registerVariant(
          'timeline',
          'Timeline',
          null,
          result.buffers,
          result.loudness,
          result.matchGainDb,
        );
        const playback = toTransferable(result.buffers);
        post(
          { id: request.id, type: 'renderedTimeline', variant: describe(variant), playback },
          playback.channels.map((c) => c.buffer),
        );
        break;
      }

      case 'renderPreview': {
        const src = sourceOrThrow();
        const slice = sliceBuffers(src, request.startSec, request.endSec);
        const processed = processChain(slice, request.chain, {
          onProgress: (p) => progress(request.id, 'Preview', p),
        });
        const playback = toTransferable(processed);
        post(
          { id: request.id, type: 'preview', playback },
          playback.channels.map((c) => c.buffer),
        );
        break;
      }

      case 'export': {
        const variant = variants.get(request.variantId);
        if (!variant) throw new Error('Nothing rendered to export');
        progress(request.id, 'Encoding', 0.3);
        const data = encodeWav(variant.buffers, request.options);
        post({ id: request.id, type: 'exported', data, label: variant.label }, [data]);
        break;
      }

      case 'waveform': {
        const target = request.variantId ? variants.get(request.variantId) : sourceOrThrow();
        if (!target) throw new Error('Unknown variant');
        const buffers = 'buffers' in target ? target.buffers : (target as AudioBuffers);
        const envelope = peakEnvelope(buffers, request.buckets);
        post({ id: request.id, type: 'waveform', min: envelope.min, max: envelope.max }, [
          envelope.min.buffer,
          envelope.max.buffer,
        ]);
        break;
      }

      case 'spectrum': {
        const target = request.variantId ? variants.get(request.variantId) : null;
        const buffers = target ? target.buffers : sourceOrThrow();
        const spectrum = averageSpectrum(buffers, request.points);
        post({ id: request.id, type: 'spectrum', spectrum }, [spectrum.buffer]);
        break;
      }

      case 'clear': {
        source = null;
        variants.clear();
        post({ id: request.id, type: 'cleared' });
        break;
      }
    }
  } catch (error) {
    post({
      id: request.id,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
