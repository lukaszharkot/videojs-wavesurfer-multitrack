/**
 * TypeScript declarations for @lukaszharkot/videojs-wavesurfer-multitrack
 *
 * Usage:
 *   import WavesurferMultitrack from '@lukaszharkot/videojs-wavesurfer-multitrack';
 *
 *   #player: WavesurferMultitrack.VideojsWavesurferMultitrack;
 *
 *   this.#player.wavesurferMultitrack().loadTracks(tracks);
 */

import videojs from 'video.js';

declare namespace WavesurferMultitrack {

    /** A single waveform-json item as returned by the backend. */
    interface WaveformTrack {
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
    interface XhrOptions {
        credentials?: 'include' | 'same-origin' | 'omit';
        headers?: Record<string, string>;
        [key: string]: unknown;
    }

    /** Plugin configuration options. */
    interface Options {
        /**
         * Array of waveform-json objects from the backend.
         * Only items with `type === "waveform-json"` are used.
         */
        tracks?: WaveformTrack[];

        /** Height in pixels for each waveform channel row. Default: 100 */
        channelHeight?: number;

        /**
         * 0 = expand the player container to fit all channels.
         * N = fix the container height at N × channelHeight and scroll after N channels.
         * Default: 0
         */
        scrollFrom?: number;

        /** Waveform bar color. Default: '#999' */
        waveColor?: string;

        /** Played-portion color. Default: '#555' */
        progressColor?: string;

        /** Cursor / playhead color. Default: '#fff' */
        cursorColor?: string;

        /** Cursor line width in px. Default: 1 */
        cursorWidth?: number;

        /** Bar width in px. Leave undefined for line mode. */
        barWidth?: number;

        /** Gap between bars in px (requires barWidth). */
        barGap?: number;

        /** Bar corner radius in px (requires barWidth). */
        barRadius?: number;

        /** Normalise peaks to max amplitude. Default: false */
        normalize?: boolean;

        /** Enable verbose console logging. Default: false */
        debug?: boolean;

        /** Show milliseconds in time display. Default: true */
        displayMilliseconds?: boolean;

        /** Fetch options used when loading waveform JSON. */
        xhr?: XhrOptions;
    }

    /** The plugin instance returned by `player.wavesurferMultitrack()`. */
    interface Plugin {
        /**
         * Load (or reload) waveform tracks.
         * Destroys existing waveforms and renders new ones without
         * reinitialising the VideoJS player.
         *
         * @param tracks - Array of backend thumbnail objects.
         *   Only items with `type === "waveform-json"` are used.
         */
        loadTracks(tracks: WaveformTrack[]): void;

        /** Destroy all WaveSurfer instances and remove the waveform wrapper. */
        dispose(): void;
    }

    /**
     * A VideoJS player with the wavesurferMultitrack plugin attached.
     * Use this type instead of `videojs.Player` when the plugin is active.
     *
     * @example
     * import WavesurferMultitrack from '@lukaszharkot/videojs-wavesurfer-multitrack';
     *
     * class MyComponent {
     *   #player: WavesurferMultitrack.VideojsWavesurferMultitrack;
     *
     *   init() {
     *     this.#player = videojs('my-video', {
     *       plugins: {
     *         wavesurferMultitrack: { tracks: [...], channelHeight: 80 }
     *       }
     *     }) as WavesurferMultitrack.VideojsWavesurferMultitrack;
     *   }
     *
     *   swapTracks(newTracks: WavesurferMultitrack.WaveformTrack[]) {
     *     this.#player.wavesurferMultitrack().loadTracks(newTracks);
     *   }
     * }
     */
    interface VideojsWavesurferMultitrack extends videojs.Player {
        /** Access the wavesurferMultitrack plugin instance. */
        wavesurferMultitrack(): Plugin;
    }
}

export = WavesurferMultitrack;
