import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audioDir = path.join(root, 'public', 'assets', 'audio');
const tempDir = path.join(root, '.local', 'escape-audio');
const sampleRate = 48_000;
const channels = 2;
const seconds = 48;
const tau = Math.PI * 2;
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function makeTexture() {
  const rand = rng(0x51e7a23b);
  const size = 65_536;
  const partials = Array.from({ length: 280 }, () => ({
    hz: (1 + Math.floor(rand() * 115_200)) / seconds,
    phase: rand() * tau,
    amp: (rand() * 2 - 1) / Math.sqrt(280),
  }));
  const table = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const t = i * seconds / size;
    let value = 0;
    for (const p of partials) value += p.amp * Math.sin(tau * p.hz * t + p.phase);
    table[i] = value * 0.42;
  }
  return table;
}

function textureAt(table, t) {
  const pos = t / seconds * table.length;
  const idx = Math.floor(pos);
  const frac = pos - idx;
  return table[idx % table.length] * (1 - frac) + table[(idx + 1) % table.length] * frac;
}

function makeSamples() {
  const frames = seconds * sampleRate;
  const table = makeTexture();
  const samples = new Float32Array(frames * channels);
  const bells = [
    { center: 6.8, hz: 493.9, width: 0.68, phase: 0.4, gain: 0.14 },
    { center: 17.2, hz: 369.99, width: 0.84, phase: 2.0, gain: 0.13 },
    { center: 29.5, hz: 587.33, width: 0.72, phase: 1.1, gain: 0.12 },
    { center: 40.7, hz: 440, width: 0.88, phase: 2.8, gain: 0.13 },
  ];
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const pulsePhase = tau * t / 4.8;
    const pulse = 0.5 + 0.5 * Math.sin(pulsePhase - Math.PI / 2);
    const swell = 0.77 + 0.23 * (0.5 + 0.5 * Math.sin(tau * t / seconds - Math.PI / 2));
    const sub = Math.sin(tau * 36.71 * t + 0.2) * 0.34
      + Math.sin(tau * 43.65 * t + 1.8) * 0.23
      + Math.sin(tau * 55 * t + 2.7) * 0.14;
    const mid = Math.sin(tau * 73.42 * t + 1.3) * 0.105
      + Math.sin(tau * 82.41 * t + 2.1) * 0.075
      + Math.sin(tau * 110 * t + 0.7) * 0.042;
    const tremor = (0.72 + 0.28 * pulse) * (sub + mid) * swell;
    const texture = textureAt(table, t) * (0.10 + 0.035 * pulse);
    let metal = 0;
    for (const b of bells) {
      const d = Math.min(Math.abs(t - b.center), seconds - Math.abs(t - b.center));
      const env = Math.exp(-0.5 * (d / b.width) ** 2);
      metal += env * b.gain * (Math.sin(tau * b.hz * t + b.phase)
        + 0.31 * Math.sin(tau * b.hz * 2.76 * t + b.phase + 0.8));
    }
    const base = tremor + texture + metal;
    samples[i * 2] = base * 0.72;
    samples[i * 2 + 1] = (tremor * 0.97 + texture * 0.9 + metal * 0.84) * 0.72;
  }
  let peak = 0;
  for (const x of samples) peak = Math.max(peak, Math.abs(x));
  const target = 10 ** (-1.4 / 20);
  const gain = peak > 0 ? target / peak : 1;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

async function writeWav(file, samples) {
  const dataBytes = samples.length * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataBytes, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22); wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * 2, 28); wav.writeUInt16LE(channels * 2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  await writeFile(file, wav);
}

await mkdir(audioDir, { recursive: true });
await mkdir(tempDir, { recursive: true });
const wavPath = path.join(tempDir, 'sewer-escape-v1.wav');
const mp3Path = path.join(audioDir, 'sewer-escape-v1.mp3');
await writeWav(wavPath, makeSamples());
const result = spawnSync(ffmpeg, [
  '-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath,
  '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', String(sampleRate),
  '-ac', String(channels), '-write_xing', '0', mp3Path,
], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr || `ffmpeg exited ${result.status}`);
console.log(`Generated ${seconds}s loopable escape score: ${mp3Path}`);
