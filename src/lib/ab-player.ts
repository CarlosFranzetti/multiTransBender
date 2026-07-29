/**
 * Gapless, sample-aligned A/B playback.
 *
 * Every variant plays simultaneously from the same transport position, each
 * through its own gain node, and switching means changing which gain is open.
 * Nothing restarts, nothing reseeks, so the switch is instantaneous and lands
 * on the same sample of the music — which is the only way a comparison tells
 * you about the processing rather than about where the playhead happened to be.
 *
 * The crossfade is 8 ms. Long enough to avoid a click, short enough that it
 * reads as an instant switch rather than a blend.
 */

import { PlaybackPayload } from './engine-client';

const SWITCH_RAMP_SEC = 0.008;

export interface AbSource {
  id: string;
  payload: PlaybackPayload;
}

export class AbPlayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private sources = new Map<string, AudioBufferSourceNode>();
  private gains = new Map<string, GainNode>();
  private activeId: string | null = null;
  private startedAt = 0;
  private offsetSec = 0;
  private playing = false;
  private sampleRate = 48000;
  private durationSec = 0;
  private loop = false;
  private onEndedCallback: (() => void) | null = null;

  get isPlaying(): boolean {
    return this.playing;
  }

  get duration(): number {
    return this.durationSec;
  }

  get active(): string | null {
    return this.activeId;
  }

  /**
   * Load a set of variants. The AudioContext is created at the material's own
   * sample rate so monitoring does not go through an extra resampler.
   */
  async load(sources: AbSource[], sampleRate: number): Promise<void> {
    this.stop();
    this.buffers.clear();

    if (sources.length === 0) return;
    this.sampleRate = sampleRate;

    if (!this.context || this.context.sampleRate !== sampleRate) {
      await this.context?.close();
      try {
        this.context = new AudioContext({ sampleRate, latencyHint: 'playback' });
      } catch {
        // Some browsers refuse unusual rates; fall back and accept the resample.
        this.context = new AudioContext({ latencyHint: 'playback' });
      }
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }

    const context = this.context!;
    for (const source of sources) {
      const { channels, length } = source.payload;
      const buffer = context.createBuffer(
        Math.max(channels.length, 1),
        Math.max(length, 1),
        context.sampleRate,
      );
      for (let c = 0; c < channels.length; c++) {
        // The worker only ever transfers plain ArrayBuffer-backed arrays; the
        // cast satisfies the SharedArrayBuffer case the DOM types allow for.
        buffer.copyToChannel(channels[c] as Float32Array<ArrayBuffer>, c);
      }
      this.buffers.set(source.id, buffer);
      this.durationSec = Math.max(this.durationSec, buffer.duration);
    }

    this.activeId = sources[0].id;
    this.offsetSec = 0;
  }

  has(id: string): boolean {
    return this.buffers.has(id);
  }

  ids(): string[] {
    return [...this.buffers.keys()];
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
    for (const source of this.sources.values()) source.loop = loop;
  }

  onEnded(callback: (() => void) | null): void {
    this.onEndedCallback = callback;
  }

  setVolume(gain: number): void {
    if (!this.master || !this.context) return;
    this.master.gain.setTargetAtTime(gain, this.context.currentTime, 0.01);
  }

  async play(fromSec?: number): Promise<void> {
    if (!this.context || this.buffers.size === 0) return;
    if (this.context.state === 'suspended') await this.context.resume();

    this.teardownSources();
    const startOffset = Math.max(0, Math.min(fromSec ?? this.offsetSec, this.durationSec - 0.001));
    const startTime = this.context.currentTime + 0.05;

    let first = true;
    for (const [id, buffer] of this.buffers) {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = this.loop;

      const gain = this.context.createGain();
      // Only the active variant is audible; the rest run silently in lockstep.
      gain.gain.value = id === this.activeId ? 1 : 0;

      source.connect(gain);
      gain.connect(this.master!);
      source.start(startTime, startOffset);

      if (first) {
        source.onended = () => {
          if (!this.loop && this.playing) {
            this.playing = false;
            this.offsetSec = 0;
            this.onEndedCallback?.();
          }
        };
        first = false;
      }

      this.sources.set(id, source);
      this.gains.set(id, gain);
    }

    this.startedAt = startTime - startOffset;
    this.offsetSec = startOffset;
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.offsetSec = this.currentTime();
    this.teardownSources();
    this.playing = false;
  }

  stop(): void {
    this.teardownSources();
    this.playing = false;
    this.offsetSec = 0;
  }

  currentTime(): number {
    if (!this.context) return this.offsetSec;
    if (!this.playing) return this.offsetSec;
    const elapsed = this.context.currentTime - this.startedAt;
    if (this.loop && this.durationSec > 0) return elapsed % this.durationSec;
    return Math.min(elapsed, this.durationSec);
  }

  async seek(sec: number): Promise<void> {
    const wasPlaying = this.playing;
    this.teardownSources();
    this.offsetSec = Math.max(0, Math.min(sec, this.durationSec));
    this.playing = false;
    if (wasPlaying) await this.play(this.offsetSec);
  }

  /** Switch which variant is audible. Everything stays in sync. */
  select(id: string): void {
    if (!this.buffers.has(id)) return;
    this.activeId = id;
    if (!this.context) return;

    const now = this.context.currentTime;
    for (const [variantId, gain] of this.gains) {
      const target = variantId === id ? 1 : 0;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(target, now + SWITCH_RAMP_SEC);
    }
  }

  private teardownSources(): void {
    for (const source of this.sources.values()) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // Already stopped; nothing to do.
      }
      source.disconnect();
    }
    for (const gain of this.gains.values()) gain.disconnect();
    this.sources.clear();
    this.gains.clear();
  }

  async dispose(): Promise<void> {
    this.stop();
    this.buffers.clear();
    await this.context?.close();
    this.context = null;
    this.master = null;
  }
}
