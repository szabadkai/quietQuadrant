import type { Settings } from "../models/types";

const soundtrackImports = import.meta.glob("./music/*.{mp3,ogg,wav}", {
  eager: true,
});

const SOUNDTRACK_URLS = Object.values(soundtrackImports).map((mod) => (mod as { default: string }).default);

type SfxKey = "uiHover" | "uiSelect" | "shoot" | "enemyDown" | "xpPickup";

const clampVolume = (value: number) => Math.max(0, Math.min(1, value));

class SoundtrackPlayer {
  private trackUrls: string[] = [];
  private currentIndex = 0;
  private currentElement?: HTMLAudioElement;
  private source?: MediaElementAudioSourceNode;
  private ctx: AudioContext;
  private destination: GainNode;

  constructor(ctx: AudioContext, destination: GainNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  setTracks(urls: string[]) {
    this.trackUrls = shuffle(urls);
    this.currentIndex = 0;
  }

  setVolume(volume: number) {
    if (this.currentElement) {
      this.currentElement.volume = volume;
    }
  }

  play() {
    if (this.trackUrls.length === 0) return;
    if (this.currentElement && !this.currentElement.paused) return;
    this.playTrack(this.currentIndex);
  }

  resumeIfPaused() {
    if (this.currentElement && this.currentElement.paused) {
      this.currentElement.play().catch(() => {});
    }
  }

  private playTrack(index: number) {
    if (this.trackUrls.length === 0) return;
    this.cleanupElement();

    const url = this.trackUrls[index % this.trackUrls.length];
    const el = new Audio(url);
    el.loop = false;
    el.volume = 1;
    const source = this.ctx.createMediaElementSource(el);
    source.connect(this.destination);
    el.addEventListener("ended", () => {
      this.cleanupElement();
      this.currentIndex = (index + 1) % this.trackUrls.length;
      this.playTrack(this.currentIndex);
    });
    el.play().catch(() => {
      this.currentIndex = (index + 1) % this.trackUrls.length;
    });
    this.currentElement = el;
    this.source = source;
  }

  private cleanupElement() {
    this.source?.disconnect();
    if (this.currentElement) {
      this.currentElement.pause();
    }
    this.currentElement = undefined;
    this.source = undefined;
  }
}

class SoundManager {
  private ctx?: AudioContext;
  private masterGain?: GainNode;
  private musicGain?: GainNode;
  private sfxGain?: GainNode;
  private soundtrack?: SoundtrackPlayer;
  private volumes: Pick<Settings, "masterVolume" | "musicVolume" | "sfxVolume" | "muteAll" | "muteMusic"> = {
    masterVolume: 0.6,
    musicVolume: 0.5,
    sfxVolume: 0.7,
    muteAll: false,
    muteMusic: false,
  };
  private sfxCooldowns = new Map<SfxKey, number>();

  resume() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    this.soundtrack?.resumeIfPaused();
  }

  setSettings(settings: Pick<Settings, "masterVolume" | "musicVolume" | "sfxVolume" | "muteAll" | "muteMusic">) {
    this.volumes = {
      masterVolume: clampVolume(settings.masterVolume),
      musicVolume: clampVolume(settings.musicVolume),
      sfxVolume: clampVolume(settings.sfxVolume),
      muteAll: settings.muteAll,
      muteMusic: settings.muteMusic,
    };
    this.applyVolumes();
    this.soundtrack?.setVolume(
      this.volumes.muteAll || this.volumes.muteMusic
        ? 0
        : this.volumes.masterVolume * this.volumes.musicVolume
    );
  }

  startSoundtrack() {
    this.ensureContext();
    this.soundtrack?.setTracks(SOUNDTRACK_URLS);
    this.soundtrack?.play();
  }

  playSfx(key: SfxKey) {
    this.resume();
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    if (this.isCoolingDown(key, ctx.currentTime)) return;

    switch (key) {
      case "uiHover":
        this.playTone(ctx, {
          frequency: 540 + Math.random() * 80,
          type: "triangle",
          duration: 0.14,
          attack: 0.005,
          decay: 0.08,
          release: 0.08,
          volume: 0.22,
        });
        break;
      case "uiSelect":
        this.playTone(ctx, {
          frequency: 360 + Math.random() * 50,
          type: "square",
          duration: 0.18,
          attack: 0.006,
          decay: 0.1,
          release: 0.12,
          volume: 0.28,
          glide: -140,
        });
        break;
      case "shoot":
        this.playTone(ctx, {
          frequency: 840 + Math.random() * 200,
          type: "sawtooth",
          duration: 0.1,
          attack: 0.003,
          decay: 0.06,
          release: 0.08,
          volume: 0.18,
          glide: -220,
        });
        break;
      case "enemyDown":
        this.playNoise(ctx, 0.18, 0.26, 1400);
        this.playTone(ctx, {
          frequency: 220 + Math.random() * 40,
          type: "square",
          duration: 0.22,
          attack: 0.004,
          decay: 0.14,
          release: 0.14,
          volume: 0.3,
          glide: -120,
        });
        break;
      case "xpPickup":
        this.playTone(ctx, {
          frequency: 980 + Math.random() * 80,
          type: "sine",
          duration: 0.1,
          attack: 0.004,
          decay: 0.06,
          release: 0.08,
          volume: 0.25,
        });
        this.playTone(
          ctx,
          {
            frequency: 1260 + Math.random() * 40,
            type: "triangle",
            duration: 0.12,
            attack: 0.004,
            decay: 0.08,
            release: 0.1,
            volume: 0.2,
          },
          0.05
        );
        break;
      default:
        break;
    }
  }

  private ensureContext() {
    if (typeof window === "undefined") return undefined;
    if (!this.ctx) {
      const ctx = new AudioContext();
      const masterGain = ctx.createGain();
      const musicGain = ctx.createGain();
      const sfxGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      this.ctx = ctx;
      this.masterGain = masterGain;
      this.musicGain = musicGain;
      this.sfxGain = sfxGain;
      this.applyVolumes();
      this.soundtrack = new SoundtrackPlayer(ctx, musicGain);
      this.soundtrack.setTracks(SOUNDTRACK_URLS);
    }
    return this.ctx;
  }

  private applyVolumes() {
    if (!this.masterGain || !this.musicGain || !this.sfxGain) return;
    const master = this.volumes.muteAll ? 0 : clampVolume(this.volumes.masterVolume);
    const music = this.volumes.muteAll || this.volumes.muteMusic ? 0 : clampVolume(this.volumes.musicVolume);
    const sfx = this.volumes.muteAll ? 0 : clampVolume(this.volumes.sfxVolume);
    this.masterGain.gain.value = master;
    this.musicGain.gain.value = music;
    this.sfxGain.gain.value = sfx;
  }

  private isCoolingDown(key: SfxKey, now: number) {
    const minGaps: Record<SfxKey, number> = {
      uiHover: 0.08,
      uiSelect: 0.05,
      shoot: 0.025,
      enemyDown: 0.04,
      xpPickup: 0.05,
    };
    const last = this.sfxCooldowns.get(key) ?? 0;
    if (now - last < minGaps[key]) return true;
    this.sfxCooldowns.set(key, now);
    return false;
  }

  private playTone(
    ctx: AudioContext,
    opts: {
      frequency: number;
      type: OscillatorType;
      duration: number;
      attack: number;
      decay: number;
      release: number;
      volume: number;
      glide?: number;
    },
    delaySeconds = 0
  ) {
    if (!this.sfxGain) return;
    const start = ctx.currentTime + delaySeconds;
    const end = start + opts.duration + opts.release;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.frequency, start);
    if (opts.glide && opts.glide !== 0) {
      osc.frequency.linearRampToValueAtTime(
        Math.max(40, opts.frequency + opts.glide),
        start + opts.duration
      );
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(opts.volume, start + opts.attack);
    gain.gain.linearRampToValueAtTime(opts.volume * 0.4, start + opts.attack + opts.decay);
    gain.gain.linearRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(start);
    osc.stop(end + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private playNoise(ctx: AudioContext, duration: number, volume: number, cutoffHz: number) {
    if (!this.sfxGain) return;
    const bufferSize = Math.max(128, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoffHz;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start();
    source.stop(ctx.currentTime + duration + 0.02);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}

const shuffle = <T,>(arr: T[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const soundManager = new SoundManager();
