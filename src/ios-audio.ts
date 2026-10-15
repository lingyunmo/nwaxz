type PlaybackNavigator = Navigator & { audioSession?: { type: string } };

// WebAudio's default iOS ambient session can be muted by the ringer switch.
// Keep the media workaround limited to Apple touch devices without this API.
export class PlaybackSession {
  private bridge?: HTMLAudioElement;
  activate(reset = false): void {
    const nav = navigator as PlaybackNavigator;
    try {
      if (nav.audioSession) {
        if (reset) nav.audioSession.type = "auto";
        nav.audioSession.type = "playback";
        this.bridge?.pause();
        return;
      }
    } catch { /* Some embedded browsers expose a restricted AudioSession. */ }
    const appleTouch = /iPhone|iPad|iPod/.test(nav.userAgent)
      || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
    if (!appleTouch || !window.Audio) return;
    try {
      if (!this.bridge) {
        this.bridge = new window.Audio("/assets/audio/ios-session-v1.mp3");
        this.bridge.loop = true;
        this.bridge.preload = "auto";
        this.bridge.setAttribute("playsinline", "");
      }
      if (reset) this.bridge.pause();
      // Call play inside the gesture, before any resume/decode awaits.
      if (this.bridge.paused) void this.bridge.play()?.catch(() => {});
    } catch { /* A later touchend or explicit recovery can retry. */ }
  }
  release(): void {
    this.bridge?.pause();
    try {
      const session = (navigator as PlaybackNavigator).audioSession;
      if (session?.type === "playback") session.type = "auto";
    } catch { /* Optional platform API. */ }
  }
  dispose(): void {
    this.release();
    if (this.bridge) {
      this.bridge.removeAttribute("src");
      this.bridge.load();
      this.bridge = undefined;
    }
  }
}
