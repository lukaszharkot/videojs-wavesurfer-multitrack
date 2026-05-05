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
    // Wavesurfer visual options (applied to every channel instance).
    waveColor: '#999',
    progressColor: '#555',
    cursorColor: '#fff',
    cursorWidth: 1,
    barWidth: undefined,
    barGap: undefined,
    barRadius: undefined,
    normalize: false,
    // Fetch options used when loading waveform JSON files.
    // Supports: { credentials: 'include' | 'same-origin' | 'omit' }
    xhr: {},
    // Show milliseconds in time display.
    displayMilliseconds: true,
    // Enable debug console output.
    debug: false
};

export default pluginDefaultOptions;
