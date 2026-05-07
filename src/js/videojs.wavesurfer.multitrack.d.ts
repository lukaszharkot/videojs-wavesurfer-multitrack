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
    /** Optional label rendered in the top-left corner of the channel strip (e.g. "Track 1 L"). */
    label?: string;
    details?: {
        /** Numeric track identifier. Used by changeTrack() for filtering. */
        track?: number;
        /** Numeric channel identifier. */
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
    /**
     * When true and scrollFrom > 0, channels auto-fit to fill the viewport height equally
     * while their count is <= scrollFrom. Once count exceeds scrollFrom the fixed
     * channelHeight takes over and the wrapper scrolls. Default: false
     */
    autoChannelHeight?: boolean;
    /**
     * Maximum per-channel height in pixels when autoChannelHeight is active.
     * Prevents channels from growing too tall when there are few of them.
     * Only applies when autoChannelHeight=true and scrollFrom > 0.
     */
    maxHeight?: number;
    waveColor?: string;
    progressColor?: string;
    cursorColor?: string;
    cursorWidth?: number;
    barWidth?: number;
    barGap?: number;
    barRadius?: number;
    normalize?: boolean;
    /** Color of the label text. Defaults to cursorColor when not set. */
    labelColor?: string;
    debug?: boolean;
    displayMilliseconds?: boolean;
    xhr?: XhrOptions;
}

/** The plugin instance returned by `player.wavesurferMultitrack()`. */
export interface WavesurferMultitrackPlugin {
    /**
     * Load (or hot-swap) waveform tracks. Filters for type=waveform-json and applies
     * the active track filter set by changeTrack(). Safe to call multiple times.
     */
    loadTracks(tracks: WaveformTrack[]): void;
    /**
     * Filter displayed channels to a single track by its numeric identifier.
     * Passing null (or undefined) clears the filter and shows all tracks.
     * The number must match `details.track` in the items passed to loadTracks().
     *
     * @example
     * plugin.changeTrack(1);     // show only track 1 channels
     * plugin.changeTrack(null);  // back to all tracks
     */
    changeTrack(trackName: number | null): void;
    /** Returns true when all waveforms have been rendered. */
    isReady(): boolean;
    /** Get current playback time in seconds. */
    getCurrentTime(): number;
    /** Get waveform duration in seconds. */
    getDuration(): number;
    dispose(): void;
}

/**
 * Convenience alias — kept for naming-convention parity with videojs-wavesurfer.
 * The wavesurferMultitrack() method is added to every player via module augmentation above.
 */
export type VideojsWavesurferMultitrack = ReturnType<typeof videojs>;

/**
 * Parse an audiowaveform JSON object into wavesurfer.js peaks format.
 * Useful for pre-processing or caching peaks before passing to loadTracks().
 *
 * @param json - Parsed audiowaveform JSON (version 2 format).
 * @returns Peaks per channel as number[][].
 */
export declare function parsePeaksJson(json: {
    data: number[];
    channels?: number;
    bits?: number;
    [key: string]: unknown;
}): number[][];
