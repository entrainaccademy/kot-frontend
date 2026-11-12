"use client";

// High-fidelity audio notification service with Web Audio synthesis fallback & HTML5 Audio playback

export type SoundType = "kitchen-bell" | "food-ready";

const STORAGE_KEY_ENABLED = "kot_sound_enabled";
const STORAGE_KEY_VOLUME = "kot_sound_volume";

class SoundService {
  private audioContext: AudioContext | null = null;
  private isUnlocked: boolean = false;
  private soundEnabled: boolean = true;
  private volume: number = 0.9;
  private processedEventIds: Set<string> = new Set();
  private playQueue: Promise<void> = Promise.resolve();

  constructor() {
    if (typeof window !== "undefined") {
      const savedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);
      if (savedEnabled !== null) {
        this.soundEnabled = savedEnabled === "true";
      }

      const savedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (savedVolume !== null) {
        const parsed = parseFloat(savedVolume);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      }

      // Automatically unlock audio on the very first user click, keydown, or touch anywhere on the page
      const autoUnlock = () => {
        this.unlockAudio();
      };

      window.addEventListener("click", autoUnlock, { passive: true });
      window.addEventListener("touchstart", autoUnlock, { passive: true });
      window.addEventListener("keydown", autoUnlock, { passive: true });
    }
  }

  public isAudioUnlocked(): boolean {
    return this.isUnlocked && this.audioContext?.state === "running";
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
    }
    if (enabled) {
      this.unlockAudio();
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
    }
  }

  // Explicit user unlock method - Must be called on user interaction to comply with Chrome autoplay
  public async unlockAudio(): Promise<boolean> {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext || this.audioContext.state === "closed") {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume();
        }
      }
      this.isUnlocked = true;
      return true;
    } catch (err) {
      console.warn("[SoundService] Audio unlock prevented:", err);
      return false;
    }
  }

  // Deduplicate events to prevent double-playing sounds on re-renders or socket repeats
  public hasProcessed(eventId: string): boolean {
    if (!eventId) return false;
    return this.processedEventIds.has(eventId);
  }

  public markProcessed(eventId: string): void {
    if (!eventId) return;
    this.processedEventIds.add(eventId);

    // Auto-clean after 2 minutes
    setTimeout(() => {
      this.processedEventIds.delete(eventId);
    }, 120000);
  }

  // Primary sound playback function
  public async playSound(type: SoundType, eventId?: string): Promise<boolean> {
    if (!this.soundEnabled) return false;

    // Check duplicate event ID
    if (eventId) {
      if (this.hasProcessed(eventId)) {
        return false;
      }
      this.markProcessed(eventId);
    }

    // Try unlocking context if suspended
    await this.unlockAudio();

    // Queue audio so rapid arrivals don't clip harshly
    return new Promise((resolve) => {
      this.playQueue = this.playQueue.then(async () => {
        let played = false;

        // Engine 1: Pure Web Audio API synthesis (Instant, zero-latency, 100% reliable)
        try {
          await this.playViaWebAudio(type);
          played = true;
        } catch (synthErr) {
          console.warn(`[SoundService] Web Audio synthesis note for ${type}:`, synthErr);
        }

        // Engine 2: HTML5 Audio Element playback in parallel
        try {
          const htmlPlayed = await this.playViaHtmlAudio(type);
          if (htmlPlayed) played = true;
        } catch {
          // Fallback handled by Engine 1
        }

        resolve(played);
        await new Promise((r) => setTimeout(r, 120));
      });
    });
  }

  public async playKitchenBell(eventId?: string): Promise<boolean> {
    return this.playSound("kitchen-bell", eventId);
  }

  public async playFoodReady(eventId?: string): Promise<boolean> {
    return this.playSound("food-ready", eventId);
  }

  // HTML5 Audio playback using local WAV file
  private async playViaHtmlAudio(type: SoundType): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      const src = type === "kitchen-bell" ? "/sounds/kitchen-bell.wav" : "/sounds/food-ready.wav";
      const audio = new Audio(src);
      audio.volume = this.volume;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      return true;
    } catch {
      return false;
    }
  }

  // Pure Web Audio API synthesis: zero-latency, works even if asset download fails
  private async playViaWebAudio(type: SoundType): Promise<void> {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume, now);
    masterGain.connect(ctx.destination);

    if (type === "kitchen-bell") {
      // Classic loud brass counter service bell 'DING!' (~1.2s)
      const freqs = [1567.98, 2093.00, 1046.50, 3135.96];
      const gains = [0.65, 0.40, 0.35, 0.15];
      const decayTime = 1.2;

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(gains[idx], now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decayTime);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + decayTime);
      });
    } else if (type === "food-ready") {
      // Two-tone warm chime: Tone 1 (G5 784Hz) -> Tone 2 (C5 523Hz) (~1.5s)
      // Note 1: G5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(783.99, now);
      gain1.gain.setValueAtTime(0.7, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.65);

      // Note 2: C5 (starting at +0.32s)
      const t2 = now + 0.32;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(523.25, t2);
      gain2.gain.setValueAtTime(0.8, t2);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 1.1);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(t2);
      osc2.stop(t2 + 1.1);
    }
  }
}

// Global Singleton Instance
export const soundService = new SoundService();
