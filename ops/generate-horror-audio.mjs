import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audioDir = path.join(root, 'public', 'assets', 'audio');
const tempDir = path.join(root, '.local', 'horror-audio');
const sampleRate = 48_000;
const channels = 2;
const tau = Math.PI * 2;

function writeWav(filePath, samples) {
  const dataBytes = samples.length * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * 2, 28);
  wav.writeUInt16LE(channels * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return writeFile(filePath, wav);
}

function encodeMp3(wavPath, mp3Path, bitrate) {
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath,
    '-codec:a', 'libmp3lame', '-b:a', bitrate, '-ar', String(sampleRate),
    '-ac', String(channels), mp3Path,
  ], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `ffmpeg exited ${result.status}`);
}

function noisePartials(seed, count, maxHz, period) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  return Array.from({ length: count }, () => {
    const bin = 1 + Math.floor(random() * Math.max(1, Math.floor(maxHz * period)));
    return { hz: bin / period, phase: random() * tau, amp: 2 * random() - 1 };
  });
}

function makeNoiseTable(partials, size, period) {
  const values = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const t = i * period / size;
    let value = 0;
    for (const p of partials) value += p.amp * Math.sin(tau * p.hz * t + p.phase);
    values[i] = value;
  }
  const norm = Math.sqrt(partials.length / 2);
  for (let i = 0; i < size; i++) values[i] /= norm;
  return values;
}

function samplePeriodic(table, t, period) {
  const position = (t / period) * table.length;
  const index = Math.floor(position) % table.length;
  const mix = position - Math.floor(position);
  const next = (index + 1) % table.length;
  return table[index] * (1 - mix) + table[next] * mix;
}

function makeAmbience() {
  const seconds = 32;
  const frames = seconds * sampleRate;
  const wind = noisePartials(0x5a17c0de, 900, 5_800, seconds);
  const windTable = makeNoiseTable(wind, 65_536, seconds);
  const metallic = [
    { hz: 413, phase: 0.3, center: 8.2, width: 0.56, gain: 0.30 },
    { hz: 617, phase: 1.8, center: 18.4, width: 0.72, gain: 0.21 },
    { hz: 287, phase: 2.4, center: 25.2, width: 0.60, gain: 0.25 },
  ];
  const samples = new Float32Array(frames * channels);
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const slow = 0.70 + 0.15 * Math.sin(tau * t / seconds + 0.6) + 0.08 * Math.sin(tau * 3 * t / seconds + 1.4);
    const drone = 0.19 * Math.sin(tau * 41 * t + 0.1)
      + 0.12 * Math.sin(tau * 54 * t + 1.7)
      + 0.07 * Math.sin(tau * 82 * t + 2.8)
      + 0.05 * Math.sin(tau * 109 * t + 0.4);
    const windValue = samplePeriodic(windTable, t, seconds) * slow * 0.115;
    let metal = 0;
    for (const p of metallic) {
      const distance = Math.min(Math.abs(t - p.center), seconds - Math.abs(t - p.center));
      const envelope = Math.exp(-0.5 * (distance / p.width) ** 2);
      metal += p.gain * envelope * Math.sin(tau * p.hz * t + p.phase);
      metal += p.gain * 0.24 * envelope * Math.sin(tau * p.hz * 2.71 * t + p.phase + 0.8);
    }
    const left = (drone + windValue + metal) * 0.78;
    const right = (drone * 0.96 + windValue * 0.92 + metal * 0.83) * 0.78;
    samples[i * 2] = left;
    samples[i * 2 + 1] = right;
  }
  return samples;
}

function smoothstep(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

function makeLaugh() {
  const seconds = 2.35;
  const frames = Math.round(seconds * sampleRate);
  const pulses = [0.08, 0.73, 1.38];
  const breath = noisePartials(0x4217, 320, 9_000, seconds);
  const breathTable = makeNoiseTable(breath, 32_768, seconds);
  const samples = new Float32Array(frames * channels);
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    let voiced = 0;
    let air = 0;
    for (let k = 0; k < pulses.length; k++) {
      const local = t - pulses[k];
      if (local < 0 || local > 0.58) continue;
      const attack = smoothstep(local / 0.035);
      const release = smoothstep((0.58 - local) / 0.17);
      const shape = attack * release * (0.78 + 0.22 * Math.sin(Math.PI * local / 0.58));
      const f0 = 104 - 15 * (local / 0.58) + 2.0 * Math.sin(tau * local * 3.1 + k);
      const vowel = local < 0.16 ? smoothstep(local / 0.16) : 0.86 + 0.14 * Math.sin(Math.PI * (local - 0.16) / 0.42);
      for (let h = 1; h <= 42; h++) {
        const hz = h * f0;
        const formant = 0.78 * Math.exp(-0.5 * ((hz - 720) / 260) ** 2)
          + 0.48 * Math.exp(-0.5 * ((hz - 1_280) / 420) ** 2)
          + 0.19 * Math.exp(-0.5 * ((hz - 2_450) / 780) ** 2);
        const spectral = formant / (1 + 0.055 * h);
        voiced += Math.sin(tau * h * (104 * local - 7.5 * local * local / 0.58) + h * 0.31 + k * 1.1) * spectral;
      }
      const noiseValue = samplePeriodic(breathTable, t, seconds);
      air += noiseValue * shape * (0.07 + 0.025 * Math.sin(tau * local * 2.2));
      voiced *= shape * vowel * 0.13;
    }
    const breathEnvelope = Math.exp(-Math.max(0, t - 2.0) * 7);
    const out = (voiced + air * (t < 2.02 ? 1 : breathEnvelope)) * 0.88;
    samples[i * 2] = out;
    samples[i * 2 + 1] = out * 0.91;
  }
  return samples;
}

await mkdir(audioDir, { recursive: true });
await mkdir(tempDir, { recursive: true });
const ambienceWav = path.join(tempDir, 'haunted-bath-v1.wav');
const laughWav = path.join(tempDir, 'haunted-laugh-v1.wav');
await writeWav(ambienceWav, makeAmbience());
await writeWav(laughWav, makeLaugh());
encodeMp3(ambienceWav, path.join(audioDir, 'haunted-bath-v1.mp3'), '192k');
encodeMp3(laughWav, path.join(audioDir, 'haunted-laugh-v1.mp3'), '160k');
console.log(`Generated 32s loopable ambience and 2.35s synthetic laugh at ${audioDir}`);
