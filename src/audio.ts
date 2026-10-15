import { parseSettings, type Settings } from "./settings.ts";

type Effect = "tap" | "coin" | "win" | "dig";
type Voice = { oscillator: OscillatorNode; gain: GainNode };
const musicPath = "/assets/audio/bubble-day-soft-v1.mp3";
const effectNotes: Record<Effect, { frequencies: number[]; step: number; type: OscillatorType }> = {
  tap: { frequencies: [520], step: .07, type: "sine" },
  coin: { frequencies: [660, 990], step: .09, type: "sine" },
  win: { frequencies: [523, 659, 784, 1047], step: .12, type: "triangle" },
  dig: { frequencies: [185], step: .09, type: "sine" },
};

export class AudioManager {
  private settings: Settings;
  private context?: AudioContext;
  private resuming?: Promise<boolean>;
  private playing = false;
  private disposed = false;
  private lastDigAt = -Infinity;
  private musicSource?: AudioBufferSourceNode;
  private musicGain?: GainNode;
  private musicBuffer?: AudioBuffer;
  private loadingMusic?: Promise<AudioBuffer | undefined>;
  private musicOffset = 0;
  private musicStartedAt = 0;
  private previewTimer?: number;
  private previewingMusic = false;
  private previewGeneration = 0;
  private voices = new Set<Voice>();
  private readonly onGesture = (event: Event) => {
    if (event.isTrusted && (this.settings.sound || this.settings.music)) void this.unlock();
  };
  private readonly onVisibilityChange = () => {
    if (document.hidden) {
      this.stopPreview();
      this.stopVoices();
      this.syncMusic();
    } else this.resume();
  };

  constructor(settings: Settings) {
    this.settings = parseSettings(settings);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    document.addEventListener("pointerdown", this.onGesture, true);
    document.addEventListener("keydown", this.onGesture, true);
  }
  async unlock(): Promise<boolean> {
    if (this.disposed) return false;
    if (!this.context) {
      const Constructor = window.AudioContext;
      if (!Constructor) return false;
      try { this.context = new Constructor(); } catch { return false; }
    }
    const context = this.context;
    if (context.state === "closed") return false;
    if (context.state === "running") {
      this.syncMusic();
      return true;
    }
    if (!this.resuming) {
      this.resuming = context.resume().then(() => {
        if (this.disposed || this.context !== context || context.state !== "running") return false;
        this.syncMusic();
        return true;
      }).catch(() => false).finally(() => { this.resuming = undefined; });
    }
    return this.resuming;
  }
  resume(): void { if (this.context) void this.unlock(); }
  suspend(): void {
    this.stopPreview();
    this.stopMusic();
    this.stopVoices();
    if (this.context?.state === "running") void this.context.suspend().catch(() => {});
  }
  setSettings(settings: Settings): void {
    this.settings = parseSettings(settings);
    if (!this.settings.sound) this.stopVoices();
    if (!this.settings.music) this.stopPreview();
    this.syncMusic();
  }
  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.syncMusic();
  }
  async preview(kind: "music" | "sound"): Promise<boolean> {
    this.stopPreview();
    const generation = this.previewGeneration;
    if (!await this.unlock() || generation !== this.previewGeneration || document.hidden) return false;
    if (kind === "music") {
      if (!await this.loadMusic() || generation !== this.previewGeneration || this.disposed || document.hidden || this.context?.state !== "running") return false;
      if (!this.musicSource) this.musicOffset = 0;
      this.previewingMusic = true;
      this.syncMusic();
      this.previewTimer = window.setTimeout(() => {
        this.previewTimer = undefined;
        this.previewingMusic = false;
        this.syncMusic();
      }, 4000);
    } else this.playEffect("win");
    return true;
  }
  stopPreview(): void {
    this.previewGeneration++;
    if (this.previewTimer !== undefined) window.clearTimeout(this.previewTimer);
    this.previewTimer = undefined;
    this.previewingMusic = false;
    this.stopVoices();
    this.syncMusic();
  }
  effect(effect: Effect): void {
    if (this.disposed || document.hidden) return;
    if (effect === "dig") {
      const now = performance.now();
      if (now - this.lastDigAt < 100) return;
      this.lastDigAt = now;
    }
    if (this.settings.vibration && effect !== "dig" && "vibrate" in navigator)
      navigator.vibrate(effect === "win" ? 28 : effect === "coin" ? 18 : 8);
    if (!this.settings.sound) return;
    if (this.context?.state === "running") this.playEffect(effect);
    else void this.unlock().then(ready => {
      if (ready && this.settings.sound) this.playEffect(effect);
    });
  }
  private playEffect(effect: Effect): void {
    const context = this.context;
    if (!context || context.state !== "running" || this.disposed || document.hidden) return;
    const spec = effectNotes[effect], now = context.currentTime,
      duration = spec.frequencies.length * spec.step, volume = effect === "dig" ? .07 : .12;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = spec.type;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .012);
    gain.gain.setValueAtTime(volume, now + Math.max(.02, duration - .045));
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    spec.frequencies.forEach((frequency, index) => oscillator.frequency.setValueAtTime(frequency, now + index * spec.step));
    oscillator.connect(gain); gain.connect(context.destination);
    const voice = { oscillator, gain };
    this.voices.add(voice);
    oscillator.onended = () => { this.voices.delete(voice); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now); oscillator.stop(now + duration + .015);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.playing = false;
    this.stopPreview(); this.stopMusic(); this.stopVoices();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    document.removeEventListener("pointerdown", this.onGesture, true);
    document.removeEventListener("keydown", this.onGesture, true);
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }
  private syncMusic(): void {
    if (((!this.playing || !this.settings.music) && !this.previewingMusic) || !this.context || this.disposed || document.hidden || this.context.state !== "running") {
      this.stopMusic(); return;
    }
    if (this.musicSource) return;
    if (this.musicBuffer) this.startMusic();
    else void this.loadMusic().then(buffer => { if (buffer) this.syncMusic(); });
  }
  private loadMusic(): Promise<AudioBuffer | undefined> {
    if (this.musicBuffer) return Promise.resolve(this.musicBuffer);
    if (this.loadingMusic) return this.loadingMusic;
    const context = this.context;
    if (!context || this.disposed) return Promise.resolve(undefined);
    this.loadingMusic = (async () => {
      try {
        const response = await fetch(musicPath);
        if (!response.ok) return undefined;
        const bytes = await response.arrayBuffer();
        if (this.disposed || this.context !== context) return undefined;
        const buffer = await context.decodeAudioData(bytes);
        if (this.disposed || this.context !== context) return undefined;
        this.musicBuffer = buffer;
        return buffer;
      } catch { return undefined; }
    })().finally(() => { this.loadingMusic = undefined; });
    return this.loadingMusic;
  }
  private startMusic(): void {
    const context = this.context, buffer = this.musicBuffer;
    if (!context || context.state !== "running" || !buffer || this.musicSource) return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.linearRampToValueAtTime(.65, context.currentTime + .18);
    source.connect(gain); gain.connect(context.destination);
    this.musicStartedAt = context.currentTime;
    source.start(context.currentTime, this.musicOffset);
    this.musicSource = source; this.musicGain = gain;
  }
  private stopMusic(): void {
    const source = this.musicSource, gain = this.musicGain;
    this.musicSource = undefined; this.musicGain = undefined;
    if (!source || !gain) return;
    if (this.context && this.musicBuffer)
      this.musicOffset = (this.musicOffset + Math.max(0, this.context.currentTime - this.musicStartedAt)) % this.musicBuffer.duration;
    try { source.stop(); } catch { /* Already stopped. */ }
    source.disconnect(); gain.disconnect();
  }
  private stopVoices(): void {
    for (const { oscillator, gain } of this.voices) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* Already ended. */ }
      oscillator.disconnect(); gain.disconnect();
    }
    this.voices.clear();
  }
}
