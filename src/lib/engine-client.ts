/**
 * Typed client for the rendering worker.
 *
 * Also owns the fallback decode path. WAV and AIFF are parsed natively inside
 * the worker so the file's real sample rate and bit depth survive; anything
 * else has to go through the browser decoder, which resamples to the
 * AudioContext rate. Probing the sample rate first and building the context at
 * that rate avoids the resample where the format makes it possible.
 */

import { Chain, LoudnessReport, Region } from '@/dsp/types';
import { EncodeOptions, probeMpegSampleRate, sniffContainer } from '@/dsp/wav';

export interface PlaybackPayload {
  channels: Float32Array[];
  sampleRate: number;
  length: number;
}

export interface LoadedInfo {
  fileName: string;
  sampleRate: number;
  channelCount: number;
  length: number;
  durationSec: number;
  sourceBitDepth: number;
  sourceFormat: 'pcm' | 'float';
  container: 'wav' | 'aiff' | 'decoded';
  loudness: LoudnessReport;
  playback: PlaybackPayload;
}

export interface VariantInfo {
  id: string;
  label: string;
  deviceId: string | null;
  loudness: LoudnessReport;
  matchGainDb: number;
  durationSec: number;
}

export interface ProgressEvent {
  stage: string;
  progress: number;
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  onProgress?: (event: ProgressEvent) => void;
};

export class EngineClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(new URL('../workers/engine.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as { id: number; type: string } & Record<string, unknown>;
      const entry = this.pending.get(data.id);
      if (!entry) return;

      if (data.type === 'progress') {
        entry.onProgress?.({
          stage: String(data.stage),
          progress: Number(data.progress),
        });
        return;
      }

      this.pending.delete(data.id);
      if (data.type === 'error') {
        entry.reject(new Error(String(data.message)));
      } else {
        entry.resolve(data);
      }
    };

    worker.onerror = (event) => {
      const error = new Error(event.message || 'Rendering worker failed');
      for (const entry of this.pending.values()) entry.reject(error);
      this.pending.clear();
    };

    this.worker = worker;
    return worker;
  }

  private send<T>(
    message: Record<string, unknown>,
    transfer: Transferable[] = [],
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<T> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        onProgress,
      });
      worker.postMessage({ ...message, id }, transfer);
    });
  }

  /**
   * Decode a user-supplied file.
   *
   * WAV and AIFF take the native path. Everything else is decoded by the
   * browser, and the caller is told so it can warn that the source was lossy.
   */
  async load(file: File, onProgress?: (event: ProgressEvent) => void): Promise<LoadedInfo> {
    const data = await file.arrayBuffer();
    const container = sniffContainer(data);

    if (container !== 'other') {
      return this.send<LoadedInfo>(
        { type: 'decodeContainer', data, fileName: file.name },
        [data],
        onProgress,
      );
    }

    onProgress?.({ stage: 'Decoding', progress: 0.2 });
    const probed = probeMpegSampleRate(data);
    const decoded = await decodeWithBrowser(data, probed);

    const channels: Float32Array[] = [];
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      channels.push(new Float32Array(decoded.getChannelData(c)));
    }

    return this.send<LoadedInfo>(
      {
        type: 'ingestPcm',
        channels,
        sampleRate: decoded.sampleRate,
        fileName: file.name,
        sourceBitDepth: 32,
      },
      channels.map((c) => c.buffer),
      onProgress,
    );
  }

  renderAB(
    chains: Chain[],
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<{ variants: VariantInfo[]; playback: PlaybackPayload[] }> {
    return this.send({ type: 'renderAB', chains }, [], onProgress);
  }

  renderTimeline(
    baseChain: Chain,
    regions: Region[],
    gainMatch: boolean,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<{ variant: VariantInfo; playback: PlaybackPayload }> {
    return this.send(
      { type: 'renderTimeline', baseChain, regions, gainMatch },
      [],
      onProgress,
    );
  }

  export(
    variantId: string,
    options: EncodeOptions,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<{ data: ArrayBuffer; label: string }> {
    return this.send({ type: 'export', variantId, options }, [], onProgress);
  }

  spectrum(variantId: string | null, points: number): Promise<{ spectrum: Float32Array }> {
    return this.send({ type: 'spectrum', variantId, points });
  }

  waveform(variantId: string | null, buckets: number): Promise<{ min: Float32Array; max: Float32Array }> {
    return this.send({ type: 'waveform', variantId, buckets });
  }

  /** Drop all audio from memory. */
  async clear(): Promise<void> {
    if (!this.worker) return;
    await this.send({ type: 'clear' });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

/**
 * Browser decode for compressed formats.
 *
 * `decodeAudioData` always resamples to the context's rate, so the context is
 * created at the file's own rate when we can determine it. When we cannot, the
 * device rate is used and the caller warns the user.
 */
async function decodeWithBrowser(data: ArrayBuffer, preferredRate: number | null): Promise<AudioBuffer> {
  const Ctor =
    typeof OfflineAudioContext !== 'undefined'
      ? OfflineAudioContext
      : (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
          .webkitOfflineAudioContext;

  const rates = preferredRate ? [preferredRate, 48000] : [48000];
  let lastError: unknown = null;

  for (const rate of rates) {
    try {
      const context = new Ctor(1, 1, rate);
      // decodeAudioData detaches the buffer, so hand it a copy each attempt.
      return await context.decodeAudioData(data.slice(0));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not decode this file');
}
