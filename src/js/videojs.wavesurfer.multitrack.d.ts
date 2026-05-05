/**
 * TypeScript declarations for @lukaszharkot/videojs-wavesurfer-multitrack
 *
 * Simply importing this package augments video.js so every `videojs.Player`
 * automatically gains the `wavesurferMultitrack()` method.
 *
 *   import '@lukaszharkot/videojs-wavesurfer-multitrack';
 *
 *   #player: videojs.Player;
 *   this.#player.wavesurferMultitrack().loadTracks(tracks);
 */

import videojs from 'video.js';

/** Augments video.js — every player gets wavesurferMultitrack() on import. */
declare module 'video.js' {
    interface VideoJsPlayer {
        wavesurferMultitrack(): WavesurferMultitrackPlugin;
    }
}

/** A single waveform-json item as returned by the backend. */
export interface WaveformTrack {
    type: string;
    url: string;
    contentType?: string;
    details?: {
        track?: number;
        channel?: number;
        [key: string]: unknown;
    };
}

/** XHR / fetch options passed when loading waveform JSON URLs. */
export interface XhrOptions {
    credentials?: 'include' | 'same-origin' | 'omit';
    headers?: Record<string, string>;
    [key: string]: unknown;
}

/** Plugin configuration options passed via `plugins.wavesurferMultitrack`. */
export interface Options {
    /** Only items with type==="waveform-json" are used. */
    tracks?: WaveformTrack[];
    /** Height in pixels for each waveform channel row. Default: 100 */
    channelHeight?: number;
    /** 0 = expand player; N = fix height at N*channelHeight and scroll. Default: 0 */
    scrollFrom?: number;
    waveColor?: string;
    progressColor?: string;
    cursorColor?: string;
    cursorWidth?: number;
    barWidth?: number;
    barGap?: number;
    barRadius?: number;
    normalize?: boolean;
    debug?: boolean;
    displayMilliseconds?: boolean;
    xhr?: XhrOptions;
}

/** The plugin instance returned by `player.wavesurferMultitrack()`. */
export interface WavesurferMultitrackPlugin {
    /** Reload waveforms without reinitialising the VideoJS player. */
    loadTracks(tracks: WaveformTrack[]): void;
    dispose(): void;
}

/**
 * Convenience alias for `videojs.Player` — kept for the same naming convention
 * as `videojs-wavesurfer` (Wavesurfer.VideojsWavesurfer).
 * The `wavesurferMultitrack()` method is added via module augmentation above,
 * so `videojs.Player` is already sufficient.
 */
export type VideojsWavesurferMultitrack = videojs.Player;
