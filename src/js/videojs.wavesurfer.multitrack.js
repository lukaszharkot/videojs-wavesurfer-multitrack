/**
 * @file videojs.wavesurfer.multitrack.js
 *
 * VideoJS plugin that displays multiple stacked waveform channels
 * using wavesurfer.js instances synced to the VideoJS media element.
 *
 * Each channel is a peaks-only WaveSurfer instance (no separate audio).
 * The VideoJS media element is passed as `media` to each WaveSurfer so
 * that the cursor automatically follows playback — no manual polling needed.
 */

import videojs from 'video.js';
import WaveSurfer from 'wavesurfer.js';

import Event from './event';
import pluginDefaultOptions from './defaults';
import { fetchPeaks } from './utils/fetch-peaks';
import formatTime from './utils/format-time';

const Plugin = videojs.getPlugin('plugin');

const PLUGIN_NAME = 'wavesurferMultitrack';
const PLUGIN_CLASS = 'vjs-wavesurfer-multitrack';
const WRAPPER_CLASS = 'vjs-multitrack-wrapper';
const CHANNEL_CLASS = 'vjs-multitrack-channel';

/**
 * VideoJS plugin that renders multiple stacked waveform channels.
 *
 * @class
 * @augments videojs.Plugin
 */
class WavesurferMultitrack extends Plugin {
    /**
     * @param {videojs.Player} player
     * @param {Object} options
     */
    constructor(player, options) {
        super(player, options);

        // Merge defaults + user options
        if (videojs.obj !== undefined) {
            this.opts = videojs.obj.merge(pluginDefaultOptions, options);
        } else {
            this.opts = videojs.mergeOptions(pluginDefaultOptions, options);
        }

        this.debug = this.opts.debug === true || String(this.opts.debug) === 'true';
        this.displayMilliseconds = this.opts.displayMilliseconds;

        /** @type {WaveSurfer[]} */
        this._wavesurfers = [];
        /** @type {HTMLElement|null} */
        this._wrapper = null;
        /** @type {boolean} */
        this._waveReady = false;
        /** @type {Function|null} */
        this._resizeObserver = null;

        // Add plugin CSS class to player
        player.addClass(PLUGIN_CLASS);

        // Wait for player UI to be ready before initializing
        this.player.one(Event.READY, this._initialize.bind(this));
    }

    /**
     * Called once the VideoJS player UI is ready.
     * Sets up the waveform container and loads initial tracks.
     * @private
     */
    _initialize() {
        this._log('Plugin initializing');

        // Hide big play button (wavesurfer click-to-seek will handle interaction)
        if (this.player.bigPlayButton) {
            this.player.bigPlayButton.hide();
        }

        // Ensure control bar is visible
        if (this.player.options_.controls === true) {
            this.player.controlBar.show();
            this.player.controlBar.el_.style.display = 'flex';

            if (this.player.controlBar.pictureInPictureToggle) {
                this.player.controlBar.pictureInPictureToggle.hide();
            }

            const uiElements = ['currentTimeDisplay', 'timeDivider', 'durationDisplay'];
            uiElements.forEach((name) => {
                const el = this.player.controlBar[name];
                if (el) {
                    el.el_.style.display = 'block';
                    el.show();
                }
            });

            if (this.player.controlBar.remainingTimeDisplay) {
                this.player.controlBar.remainingTimeDisplay.hide();
            }
        }

        // Create the multitrack wrapper div inside the player
        this._createWrapper();

        // Listen for VideoJS events to keep time display in sync
        this.player.on(Event.TIMEUPDATE, this._onTimeUpdate.bind(this));
        this.player.on(Event.VOLUMECHANGE, this._onVolumeChange.bind(this));
        this.player.on(Event.FULLSCREENCHANGE, this._onScreenChange.bind(this));
        this.player.on(Event.ENDED, this._onEnded.bind(this));

        // Load initial tracks if provided
        if (this.opts.tracks && this.opts.tracks.length > 0) {
            this.loadTracks(this.opts.tracks);
        }
    }

    /**
     * Create the scrollable/expandable wrapper div inside the VideoJS player element.
     * @private
     */
    _createWrapper() {
        // Remove existing wrapper if any
        this._removeWrapper();

        const wrapper = document.createElement('div');
        wrapper.className = WRAPPER_CLASS;
        this._applyWrapperStyles(wrapper, 0);

        // Insert before the control bar so controls stay on top
        const controlBar = this.player.el_.querySelector('.vjs-control-bar');
        if (controlBar) {
            this.player.el_.insertBefore(wrapper, controlBar);
        } else {
            this.player.el_.appendChild(wrapper);
        }

        this._wrapper = wrapper;
    }

    /**
     * Apply height / overflow styles to the wrapper based on channel count and scrollFrom.
     * @param {HTMLElement} wrapper
     * @param {number} channelCount
     * @private
     */
    _applyWrapperStyles(wrapper, channelCount) {
        const { channelHeight, scrollFrom } = this.opts;

        if (scrollFrom > 0 && channelCount > 0) {
            // Fixed height with scroll
            const visibleRows = Math.min(scrollFrom, channelCount);
            wrapper.style.height = (visibleRows * channelHeight) + 'px';
            wrapper.style.overflowY = 'auto';
            wrapper.style.overflowX = 'hidden';
        } else {
            // Expand to fit all channels
            const totalHeight = channelCount > 0 ? channelCount * channelHeight : 0;
            wrapper.style.height = totalHeight + 'px';
            wrapper.style.overflowY = 'hidden';
            wrapper.style.overflowX = 'hidden';
        }
    }

    /**
     * Remove wrapper and destroy all WaveSurfer instances.
     * @private
     */
    _removeWrapper() {
        this._destroyWaveSurfers();

        if (this._wrapper && this._wrapper.parentNode) {
            this._wrapper.parentNode.removeChild(this._wrapper);
        }
        this._wrapper = null;
    }

    /**
     * Destroy all WaveSurfer instances without touching the DOM wrapper.
     * @private
     */
    _destroyWaveSurfers() {
        this._wavesurfers.forEach((ws) => {
            try {
                ws.destroy();
            } catch (e) {
                // ignore
            }
        });
        this._wavesurfers = [];
        this._waveReady = false;
    }

    /**
     * Load (or reload) waveform tracks. Filters for type=waveform-json, fetches peaks,
     * and creates one WaveSurfer instance per channel. Safe to call multiple times — the
     * previous waveforms are destroyed and the wrapper is cleared before creating new ones.
     *
     * @param {Array} tracks - Array of BE thumbnail objects. Only items with
     *   `type === "waveform-json"` are used. Each item must have `url` and
     *   `details: { track: number, channel: number }`.
     */
    loadTracks(tracks) {
        if (!tracks || !Array.isArray(tracks)) {
            this._log('loadTracks: invalid tracks argument', 'warn');
            return;
        }

        this._log('loadTracks: loading ' + tracks.length + ' items');

        // Filter and sort: waveform-json only, sorted by track then channel
        const items = tracks
            .filter((t) => t && t.type === 'waveform-json' && t.url)
            .sort((a, b) => {
                const ta = (a.details && a.details.track) || 0;
                const tb = (b.details && b.details.track) || 0;
                if (ta !== tb) return ta - tb;
                const ca = (a.details && a.details.channel) || 0;
                const cb = (b.details && b.details.channel) || 0;
                return ca - cb;
            });

        if (items.length === 0) {
            this._log('loadTracks: no waveform-json items found', 'warn');
            return;
        }

        // Destroy previous wavesurfers and clear wrapper content
        this._destroyWaveSurfers();

        if (!this._wrapper) {
            this._createWrapper();
        } else {
            this._wrapper.innerHTML = '';
        }

        // Update wrapper height for new channel count
        this._applyWrapperStyles(this._wrapper, items.length);

        // Fetch all peaks then create WaveSurfer instances
        const fetchPromises = items.map((item) =>
            fetchPeaks(item.url, this.opts.xhr || {}).catch((err) => {
                this._log('Failed to fetch peaks for ' + item.url + ': ' + err.message, 'error');
                return null;
            })
        );

        Promise.all(fetchPromises).then((peaksArray) => {
            // Get the VideoJS media element for cursor sync
            const mediaEl = this._getMediaElement();

            peaksArray.forEach((peaks, index) => {
                const item = items[index];
                const channelDiv = this._createChannelDiv(item);
                this._wrapper.appendChild(channelDiv);

                const waveDiv = channelDiv.querySelector('.' + CHANNEL_CLASS + '__wave');

                const wsOptions = this._buildWaveSurferOptions(waveDiv, peaks, mediaEl);
                let ws;
                try {
                    ws = WaveSurfer.create(wsOptions);
                } catch (err) {
                    this._log('WaveSurfer.create failed: ' + err.message, 'error');
                    this.player.trigger(Event.WAVE_ERROR, err);
                    return;
                }

                ws.on('ready', () => {
                    this._log('WaveSurfer ready: track=' + (item.details && item.details.track) + ' ch=' + (item.details && item.details.channel));
                    this._checkAllReady(peaksArray.length);
                });

                ws.on('error', (err) => {
                    this._log('WaveSurfer error: ' + err, 'error');
                    this.player.trigger(Event.WAVE_ERROR, err);
                });

                this._wavesurfers.push(ws);
            });

            this.player.trigger(Event.TRACKS_LOADED);
            this._log('Tracks loaded (' + items.length + ' channels)');
        });
    }

    /**
     * Create the DOM element for a single channel strip.
     * @param {Object} item - Waveform-json item from BE.
     * @returns {HTMLElement}
     * @private
     */
    _createChannelDiv(item) {
        const track = (item.details && item.details.track) || '';
        const channel = (item.details && item.details.channel) || '';

        const wrapper = document.createElement('div');
        wrapper.className = CHANNEL_CLASS;
        wrapper.style.height = this.opts.channelHeight + 'px';
        wrapper.setAttribute('data-track', track);
        wrapper.setAttribute('data-channel', channel);

        const waveDiv = document.createElement('div');
        waveDiv.className = CHANNEL_CLASS + '__wave';
        waveDiv.style.height = '100%';
        waveDiv.style.width = '100%';

        wrapper.appendChild(waveDiv);
        return wrapper;
    }

    /**
     * Build WaveSurfer options for a channel.
     * @param {HTMLElement} container
     * @param {number[][]|null} peaks
     * @param {HTMLMediaElement|null} mediaEl
     * @returns {Object}
     * @private
     */
    _buildWaveSurferOptions(container, peaks, mediaEl) {
        const opts = {
            container,
            height: this.opts.channelHeight,
            waveColor: this.opts.waveColor,
            progressColor: this.opts.progressColor,
            cursorColor: this.opts.cursorColor,
            cursorWidth: this.opts.cursorWidth,
            normalize: this.opts.normalize,
            interact: true,
            hideScrollbar: true,
            peaks: peaks || undefined,
        };

        if (this.opts.barWidth !== undefined) {
            opts.barWidth = this.opts.barWidth;
        }
        if (this.opts.barGap !== undefined) {
            opts.barGap = this.opts.barGap;
        }
        if (this.opts.barRadius !== undefined) {
            opts.barRadius = this.opts.barRadius;
        }

        // Pass the VideoJS media element so WaveSurfer syncs cursor automatically
        if (mediaEl) {
            opts.media = mediaEl;
        }

        // If we have peaks but no media, we still need a duration.
        // wavesurfer.js v7 infers it from peaks when media is present.
        return opts;
    }

    /**
     * Get the HTML5 media element from the VideoJS player tech.
     * @returns {HTMLMediaElement|null}
     * @private
     */
    _getMediaElement() {
        try {
            if (this.player.tech_ && this.player.tech_.el_) {
                return this.player.tech_.el_;
            }
            // Fallback for older video.js versions
            const tech = this.player.tech({ IWillNotUseThisInPlugins: true });
            return tech && tech.el_ ? tech.el_ : null;
        } catch (e) {
            this._log('Could not get media element: ' + e.message, 'warn');
            return null;
        }
    }

    /**
     * Check if all WaveSurfer instances have fired 'ready'. When all are ready,
     * emit the 'waveReady' event on the player.
     * @param {number} total
     * @private
     */
    _checkAllReady(total) {
        const readyCount = this._wavesurfers.filter((ws) => {
            try {
                return ws.getDuration() > 0;
            } catch (e) {
                return false;
            }
        }).length;

        if (readyCount >= total && !this._waveReady) {
            this._waveReady = true;
            this._log('All waveforms ready');

            // Show play button now that waveforms are ready
            if (this.player.controlBar && this.player.controlBar.playToggle) {
                this.player.controlBar.playToggle.show();
            }

            this.player.trigger(Event.WAVE_READY);
        }
    }

    // -------------------------------------------------------------------------
    // VideoJS event handlers
    // -------------------------------------------------------------------------

    /** @private */
    _onTimeUpdate() {
        this._updateTimeDisplay();
    }

    /** @private */
    _onVolumeChange() {
        // no-op: VideoJS manages volume natively
    }

    /** @private */
    _onScreenChange() {
        // Redraw all wavesurfers on fullscreen change
        this._wavesurfers.forEach((ws) => {
            try {
                ws.drawBuffer && ws.drawBuffer();
            } catch (e) {
                // ignore
            }
        });
    }

    /** @private */
    _onEnded() {
        this.player.trigger(Event.PLAYBACK_FINISH);
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Update the VideoJS current time and duration displays.
     */
    _updateTimeDisplay() {
        const currentTime = this.player.currentTime() || 0;
        const duration = this.player.duration() || 0;

        const cb = this.player.controlBar;
        if (cb && cb.currentTimeDisplay && cb.currentTimeDisplay.contentEl() &&
            cb.currentTimeDisplay.contentEl().lastChild) {
            cb.currentTimeDisplay.formattedTime_ =
                cb.currentTimeDisplay.contentEl().lastChild.textContent =
                    formatTime(currentTime, duration, this.displayMilliseconds);
        }
    }

    /**
     * Start playback.
     */
    play() {
        this._log('play()');
        this.player.play();
    }

    /**
     * Pause playback.
     */
    pause() {
        this._log('pause()');
        this.player.pause();
    }

    /**
     * Set volume (0–1).
     * @param {number} volume
     */
    setVolume(volume) {
        if (volume !== undefined) {
            this._log('setVolume(' + volume + ')');
            this.player.volume(volume);
        }
    }

    /**
     * Get current playback time in seconds.
     * @returns {number}
     */
    getCurrentTime() {
        return this.player.currentTime() || 0;
    }

    /**
     * Get waveform duration in seconds.
     * @returns {number}
     */
    getDuration() {
        return this.player.duration() || 0;
    }

    /**
     * Returns true when all waveforms have been rendered.
     * @returns {boolean}
     */
    isReady() {
        return this._waveReady;
    }

    /**
     * Remove the plugin, destroy all WaveSurfer instances and clean up the DOM.
     * Called automatically by VideoJS when the player is disposed.
     */
    dispose() {
        this._log('dispose()');
        this._removeWrapper();
        super.dispose();
    }

    // -------------------------------------------------------------------------
    // Logging
    // -------------------------------------------------------------------------

    /**
     * @param {string} msg
     * @param {'log'|'warn'|'error'} [level='log']
     * @private
     */
    _log(msg, level = 'log') {
        if (this.debug || level === 'error') {
            const prefix = '[videojs-wavesurfer-multitrack] ';
            if (level === 'error') {
                console.error(prefix + msg);
            } else if (level === 'warn') {
                console.warn(prefix + msg);
            } else {
                console.log(prefix + msg);
            }
        }
    }
}

// Register the plugin with VideoJS
if (videojs && typeof videojs.registerPlugin === 'function') {
    videojs.registerPlugin(PLUGIN_NAME, WavesurferMultitrack);
}

export { WavesurferMultitrack };
export default WavesurferMultitrack;
