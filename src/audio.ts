import { parseSettings, type Settings } from "./settings.ts";

type Effect = "tap" | "coin" | "win" | "dig";
type Voice = { oscillator: OscillatorNode; gain: GainNode };

const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 783.99, 659.25];
const effectNotes: Record<
  Effect,
  { frequencies: number[]; step: number; type: OscillatorType }
> = {
  tap: { frequencies: [520], step: 0.07, type: "sine" },
  coin: { frequencies: [660, 990], step: 0.09, type: "sine" },
  win: { frequencies: [523, 659, 784, 1047], step: 0.12, type: "triangle" },
  dig: { frequencies: [185], step: 0.09, type: "sine" },
};

export class AudioManager {
  private settings: Settings;
  private context: AudioContext | undefined;
  private playing = false;
  private disposed = false;
  private lastDigAt = -Infinity;
  private musicOscillator: OscillatorNode | undefined;
  private musicGain: GainNode | undefined;
  private musicTimer: number | undefined;
  private musicIndex = 0;
  private voices = new Set<Voice>();
  private readonly onVisibilityChange = () => {
    if (
      !document.hidden &&
      this.playing &&
      this.settings.music &&
      this.context?.state === "suspended"
    ) {
      void this.context
        .resume()
        .then(() => this.syncMusic())
        .catch(() => {});
      return;
    }
    this.syncMusic();
  };

  constructor(settings: Settings) {
    this.settings = parseSettings(settings);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  unlock(): void {
    if (this.disposed) return;
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return;
      try {
        this.context = new AudioContextConstructor();
      } catch {
        return;
      }
    }
    if (this.context.state === "suspended")
      void this.context
        .resume()
        .then(() => this.syncMusic())
        .catch(() => {});
    this.syncMusic();
  }

  setSettings(settings: Settings): void {
    this.settings = parseSettings(settings);
    if (!this.settings.sound) this.stopVoices();
    this.syncMusic();
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.syncMusic();
  }

  effect(effect: Effect): void {
    if (this.disposed) return;
    if (effect === "dig") {
      const now = performance.now();
      if (now - this.lastDigAt < 100) return;
      this.lastDigAt = now;
    }

    if (this.settings.vibration && effect !== "dig" && "vibrate" in navigator) {
      const duration = effect === "win" ? 28 : effect === "coin" ? 18 : 8;
      navigator.vibrate(duration);
    }
    if (
      !this.settings.sound ||
      !this.context ||
      this.context.state === "closed"
    )
      return;

    const context = this.context;
    const spec = effectNotes[effect];
    const now = context.currentTime;
    const duration = spec.frequencies.length * spec.step;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = spec.type;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.012);
    gain.gain.setValueAtTime(0.055, now + Math.max(0.02, duration - 0.045));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    spec.frequencies.forEach((frequency, index) => {
      const start = now + index * spec.step;
      oscillator.frequency.setValueAtTime(frequency, start);
    });
    oscillator.connect(gain);
    gain.connect(context.destination);
    const voice = { oscillator, gain };
    this.voices.add(voice);
    oscillator.onended = () => {
      this.voices.delete(voice);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + duration + 0.015);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.playing = false;
    this.stopMusic();
    this.stopVoices();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== "closed")
      void context.close().catch(() => {});
  }

  private syncMusic(): void {
    if (
      !this.playing ||
      !this.settings.music ||
      !this.context ||
      this.disposed ||
      document.hidden ||
      this.context.state === "closed"
    ) {
      this.stopMusic();
      return;
    }
    if (!this.musicOscillator) this.startMusic();
  }

  private startMusic(): void {
    const context = this.context;
    if (!context || context.state === "closed") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      melody[this.musicIndex],
      context.currentTime,
    );
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.018, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    this.musicOscillator = oscillator;
    this.musicGain = gain;
    this.musicTimer = window.setInterval(() => {
      if (!this.musicOscillator || !this.context) return;
      this.musicIndex = (this.musicIndex + 1) % melody.length;
      this.musicOscillator.frequency.setTargetAtTime(
        melody[this.musicIndex],
        this.context.currentTime,
        0.09,
      );
    }, 720);
  }

  private stopMusic(): void {
    if (this.musicTimer !== undefined) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = undefined;
    }
    const oscillator = this.musicOscillator;
    const gain = this.musicGain;
    this.musicOscillator = undefined;
    this.musicGain = undefined;
    if (!oscillator || !gain) return;
    const context = this.context;
    if (!context || context.state === "closed") {
      oscillator.onended = null;
      oscillator.disconnect();
      gain.disconnect();
      return;
    }
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    oscillator.onended = null;
    try {
      oscillator.stop(now);
    } catch {
      // The oscillator may have already stopped.
    }
    oscillator.disconnect();
    gain.disconnect();
  }

  private stopVoices(): void {
    const context = this.context;
    for (const { oscillator, gain } of this.voices) {
      oscillator.onended = null;
      try {
        if (context && context.state !== "closed") oscillator.stop();
      } catch {
        // The voice may already have completed.
      }
      oscillator.disconnect();
      gain.disconnect();
    }
    this.voices.clear();
  }
}
