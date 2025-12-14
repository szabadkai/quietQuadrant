import { AudioSettings } from "../audio/AudioSettings";

describe("AudioSettings", () => {
    let audioSettings: AudioSettings;
    let masterGain: GainNode;
    let musicGain: GainNode;
    let sfxGain: GainNode;

    beforeEach(() => {
        audioSettings = new AudioSettings();

        // Create separate mock instances for each gain node
        masterGain = {
            gain: { value: 0 },
            connect: jest.fn(),
            disconnect: jest.fn(),
        } as any;
        musicGain = {
            gain: { value: 0 },
            connect: jest.fn(),
            disconnect: jest.fn(),
        } as any;
        sfxGain = {
            gain: { value: 0 },
            connect: jest.fn(),
            disconnect: jest.fn(),
        } as any;

        jest.clearAllMocks();
    });

    describe("setSettings", () => {
        it("should clamp volume values to valid range", () => {
            audioSettings.setSettings({
                masterVolume: 1.5, // Above max
                musicVolume: -0.5, // Below min
                sfxVolume: 0.5,
                muteAll: false,
                muteMusic: false,
            });

            const volumes = audioSettings.getVolumes();
            expect(volumes.masterVolume).toBe(1); // Clamped to max
            expect(volumes.musicVolume).toBe(0); // Clamped to min
            expect(volumes.sfxVolume).toBe(0.5); // Valid value
        });

        it("should store mute settings correctly", () => {
            audioSettings.setSettings({
                masterVolume: 0.8,
                musicVolume: 0.6,
                sfxVolume: 0.7,
                muteAll: true,
                muteMusic: false,
            });

            const volumes = audioSettings.getVolumes();
            expect(volumes.muteAll).toBe(true);
            expect(volumes.muteMusic).toBe(false);
        });
    });

    describe("volume calculations", () => {
        beforeEach(() => {
            audioSettings.setSettings({
                masterVolume: 0.8,
                musicVolume: 0.6,
                sfxVolume: 0.7,
                muteAll: false,
                muteMusic: false,
            });
        });

        it("should calculate master volume correctly", () => {
            expect(audioSettings.getMasterVolume()).toBe(0.8);
        });

        it("should calculate music volume as master * music", () => {
            expect(audioSettings.getMusicVolume()).toBe(0.8 * 0.6);
        });

        it("should calculate sfx volume as master * sfx", () => {
            expect(audioSettings.getSfxVolume()).toBe(0.8 * 0.7);
        });

        it("should return 0 for all volumes when muteAll is true", () => {
            audioSettings.setSettings({
                masterVolume: 0.8,
                musicVolume: 0.6,
                sfxVolume: 0.7,
                muteAll: true,
                muteMusic: false,
            });

            expect(audioSettings.getMasterVolume()).toBe(0);
            expect(audioSettings.getMusicVolume()).toBe(0);
            expect(audioSettings.getSfxVolume()).toBe(0);
        });

        it("should return 0 for music volume when muteMusic is true", () => {
            audioSettings.setSettings({
                masterVolume: 0.8,
                musicVolume: 0.6,
                sfxVolume: 0.7,
                muteAll: false,
                muteMusic: true,
            });

            expect(audioSettings.getMusicVolume()).toBe(0);
            expect(audioSettings.getSfxVolume()).toBe(0.8 * 0.7); // SFX not affected
        });
    });

    describe("setGainNodes", () => {
        it("should apply volumes to gain nodes when set", () => {
            audioSettings.setSettings({
                masterVolume: 0.8,
                musicVolume: 0.6,
                sfxVolume: 0.7,
                muteAll: false,
                muteMusic: false,
            });

            audioSettings.setGainNodes(masterGain, musicGain, sfxGain);

            expect(masterGain.gain.value).toBe(0.8);
            expect(musicGain.gain.value).toBe(0.6);
            expect(sfxGain.gain.value).toBe(0.7);
        });

        it("should apply muted volumes to gain nodes", () => {
            audioSettings.setSettings({
                masterVolume: 0.8,
                musicVolume: 0.6,
                sfxVolume: 0.7,
                muteAll: false,
                muteMusic: true,
            });

            audioSettings.setGainNodes(masterGain, musicGain, sfxGain);

            expect(masterGain.gain.value).toBe(0.8);
            expect(musicGain.gain.value).toBe(0); // Muted
            expect(sfxGain.gain.value).toBe(0.7);
        });
    });
});
