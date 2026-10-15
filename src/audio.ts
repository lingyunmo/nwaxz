import { parseSettings, type Settings } from "./settings.ts";

type Effect = "tap" | "coin" | "win" | "dig";
type Voice = { oscillator: OscillatorNode; gain: GainNode };
const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 783.99, 659.25];
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
  private musicOscillator?: OscillatorNode;
  private musicGain?: GainNode;
  private musicTimer?: number;
  private musicIndex = 0;
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
    if (!this.musicOscillator) this.startMusic();
  }
  private startMusic(): void {
    const context = this.context;
    if (!context || context.state !== "running") return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(melody[this.musicIndex], context.currentTime);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.linearRampToValueAtTime(.05, context.currentTime + .18);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start();
    this.musicOscillator = oscillator; this.musicGain = gain;
    this.musicTimer = window.setInterval(() => {
      if (!this.musicOscillator || !this.context) return;
      this.musicIndex = (this.musicIndex + 1) % melody.length;
      this.musicOscillator.frequency.setTargetAtTime(melody[this.musicIndex], this.context.currentTime, .09);
    }, 720);
  }
  private stopMusic(): void {
    if (this.musicTimer !== undefined) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    const oscillator = this.musicOscillator, gain = this.musicGain;
    this.musicOscillator = undefined; this.musicGain = undefined;
    if (!oscillator || !gain) return;
    oscillator.onended = null;
    try { oscillator.stop(); } catch { /* Already stopped. */ }
    oscillator.disconnect(); gain.disconnect();
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
