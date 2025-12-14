import type { Settings } from "../models/types";
import { AudioSettings } from "./AudioSettings";
import { MusicPlayer } from "./MusicPlayer";
import { SFXManager, type SfxKey } from "./SFXManager";

class SoundManager {
    private ctx?: AudioContext;
    private masterGain?: GainNode;
    private musicGain?: GainNode;
    private sfxGain?: GainNode;

    private audioSettings: AudioSettings;
    private musicPlayer: MusicPlayer;
    private sfxManager: SFXManager;

    constructor() {
        this.audioSettings = new AudioSettings();
        this.musicPlayer = new MusicPlayer();
        this.sfxManager = new SFXManager();
    }

    resume() {
        const ctx = this.ensureContext();
        if (!ctx) return;
        if (ctx.state === "suspended") {
            ctx.resume();
        }
        this.musicPlayer.resume();
    }

    playTitleMusic() {
        this.musicPlayer.playTitleMusic();
        this.applyMusicVolume();
    }

    prepareRunMusic() {
        this.musicPlayer.prepareRunMusic();
    }

    playLevelTrack(waveNumber: number) {
        this.musicPlayer.playLevelTrack(waveNumber);
        this.applyMusicVolume();
    }

    setSettings(
        settings: Pick<
            Settings,
            | "masterVolume"
            | "musicVolume"
            | "sfxVolume"
            | "muteAll"
            | "muteMusic"
        >
    ) {
        this.audioSettings.setSettings(settings);
        this.applyMusicVolume();
    }

    startSoundtrack() {
        this.resume();
        this.ensureContext();
        this.musicPlayer.startSoundtrack();
        this.applyMusicVolume();
    }

    playSfx(key: SfxKey) {
        this.sfxManager.playSfx(key);
    }

    private applyMusicVolume() {
        const musicVolume = this.audioSettings.getMusicVolume();
        this.musicPlayer.setVolume(musicVolume);
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

            // Initialize all modules with the audio context and gain nodes
            this.audioSettings.setGainNodes(masterGain, musicGain, sfxGain);
            this.musicPlayer.initialize(ctx, musicGain);
            this.sfxManager.initialize(ctx, sfxGain);
        }
        return this.ctx;
    }
}

export const soundManager = new SoundManager();
