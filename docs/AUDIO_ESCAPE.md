# Sewer escape music

`public/assets/audio/sewer-escape-v1.mp3` is an original, loopable instrumental bed for the standalone first-person sewer escape horror mode. It uses a subdued low drone, a slow pulse, restrained filtered noise texture, and four distant metallic resonances. It contains no lyrics and does not replace or modify the existing `haunted-laugh-v1.mp3` character laugh.

The source is generated deterministically from PCM in `ops/generate-escape-audio.mjs`, using a fixed random seed, then encoded with the repository machine's FFmpeg `libmp3lame` encoder at 128 kb/s, 48 kHz stereo. Run `node ops/generate-escape-audio.mjs` to reproduce the asset. The intermediate WAV is written under `.local/escape-audio/`.

Verified asset measurements:

- MP3 duration: 48.024 seconds (the generated PCM loop is exactly 48 seconds)
- File size: 768,429 bytes
- Format: MP3, 48 kHz, stereo; MIME type: `audio/mpeg`
- FFmpeg `volumedetect`: maximum sample level -1.8 dBFS; mean volume -13.3 dBFS (RMS-style level)
- FFprobe confirms the MP3 codec, duration, sample rate, channel count, and file size; FFmpeg decoded the complete file for volume analysis.

The in-app Chromium browser decoded the recording to 48.024 seconds and started a looping AudioBufferSource with loopEnd 48 in a running AudioContext. An analyser inserted immediately before the existing destination measured non-zero output (one sample: RMS 0.01728, peak 0.04132). The existing 2.35-second laugh also decoded and started on capture. Pause stops music; resuming restarts from the retained loop position. These checks establish decoded audio and a real output signal, not a physical speaker listening test. Subjective balance and actual iPhone Safari/WeChat output remain unverified on a real phone.
