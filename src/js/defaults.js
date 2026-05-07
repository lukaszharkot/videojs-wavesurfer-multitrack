/**
 * @file defaults.js
 * Default plugin options for videojs-wavesurfer-multitrack.
 */

const pluginDefaultOptions = {
    // Array of waveform-json items from BE. Each item: { type, url, details: { track, channel } }
    tracks: [],
    // Height in pixels for each waveform channel strip.
    channelHeight: 100,
    // 0 = stretch the player container to fit all channels.
    // N = fix container height to N * channelHeight and enable vertical scroll.
    scrollFrom: 0,
    // When true and scrollFrom > 0, channels auto-fit their height to fill the
    // viewport equally as long as their count is <= scrollFrom.
    // Once channels exceed scrollFrom the fixed channelHeight takes over and scroll kicks in.
    autoChannelHeight: false,
    // Wavesurfer visual options (applied to every channel instance).
    waveColor: '#999',
    progressColor: '#555',
    cursorColor: '#fff',
    cursorWidth: 1,
    barWidth: undefined,
    barGap: undefined,
    barRadius: undefined,
    normalize: false,
    // Color of the label text. Defaults to cursorColor when not set.
    labelColor: undefined,
    // Color of the divider line between channels. Accepts any CSS color string.
    dividerColor: 'rgba(255,255,255,0.15)',
    // Fetch options used when loading waveform JSON files.
    // Supports: { credentials: 'include' | 'same-origin' | 'omit' }
    xhr: {},
    // When autoChannelHeight is true, caps the auto-calculated per-channel height.
    maxHeight: undefined,
    displayMilliseconds: false,
    // Enable debug console output.
    debug: false
};

export default pluginDefaultOptions;
