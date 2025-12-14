import type { Settings } from "../models/types";

export interface AudioVolumes {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    muteAll: boolean;
    muteMusic: boolean;
}

export class AudioSettings {
    private volumes: AudioVolumes = {
        masterVolume: 0.6,
        musicVolume: 0.5,
        sfxVolume: 0.7,
        muteAll: false,
        muteMusic: false,
    };

    private masterGain?: GainNode;
    private musicGain?: GainNode;
    private sfxGain?: GainNode;

    constructor() {}

    setGainNodes(masterGain: GainNode, musicGain: GainNode, sfxGain: GainNode) {
        this.masterGain = masterGain;
        this.musicGain = musicGain;
        this.sfxGain = sfxGain;
        this.applyVolumes();
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
        this.volumes = {
            masterVolume: this.clampVolume(settings.masterVolume),
            musicVolume: this.clampVolume(settings.musicVolume),
            sfxVolume: this.clampVolume(settings.sfxVolume),
            muteAll: settings.muteAll,
            muteMusic: settings.muteMusic,
        };
        this.applyVolumes();
    }

    getVolumes(): AudioVolumes {
        return { ...this.volumes };
    }

    getMasterVolume(): number {
        return this.volumes.muteAll ? 0 : this.volumes.masterVolume;
    }

    getMusicVolume(): number {
        return this.volumes.muteAll || this.volumes.muteMusic
            ? 0
            : this.volumes.masterVolume * this.volumes.musicVolume;
    }

    getSfxVolume(): number {
        return this.volumes.muteAll
            ? 0
            : this.volumes.masterVolume * this.volumes.sfxVolume;
    }

    private clampVolume(value: number): number {
        return Math.max(0, Math.min(1, value));
    }

    private applyVolumes() {
        if (!this.masterGain || !this.musicGain || !this.sfxGain) return;

        const master = this.getMasterVolume();
        const music =
            this.volumes.muteAll || this.volumes.muteMusic
                ? 0
                : this.volumes.musicVolume;
        const sfx = this.volumes.muteAll ? 0 : this.volumes.sfxVolume;

        this.masterGain.gain.value = master;
        this.musicGain.gain.value = music;
        this.sfxGain.gain.value = sfx;
    }
}
