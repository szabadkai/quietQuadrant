// Mock the individual modules BEFORE importing SoundManager
jest.mock("../audio/AudioSettings");
jest.mock("../audio/MusicPlayer");
jest.mock("../audio/SFXManager");

import { AudioSettings } from "../audio/AudioSettings";
import { MusicPlayer } from "../audio/MusicPlayer";
import { SFXManager } from "../audio/SFXManager";
import { soundManager } from "../audio/SoundManager";

// Mock Web Audio API
const mockGainNode = {
    gain: { value: 0 },
    connect: jest.fn(),
    disconnect: jest.fn(),
};

const mockAudioContext = {
    createGain: jest.fn(() => mockGainNode),
    destination: {},
    state: "running",
    resume: jest.fn(),
};

global.AudioContext = jest.fn(() => mockAudioContext) as any;
global.window = {} as any;

describe("SoundManager", () => {
    let mockAudioSettings: jest.Mocked<AudioSettings>;
    let mockMusicPlayer: jest.Mocked<MusicPlayer>;
    let mockSfxManager: jest.Mocked<SFXManager>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mock instances manually
        mockAudioSettings = {
            getMusicVolume: jest.fn().mockReturnValue(0.5),
            setSettings: jest.fn(),
            setGainNodes: jest.fn(),
        } as any;

        mockMusicPlayer = {
            initialize: jest.fn(),
            resume: jest.fn(),
            setVolume: jest.fn(),
            playTitleMusic: jest.fn(),
            prepareRunMusic: jest.fn(),
            playLevelTrack: jest.fn(),
            startSoundtrack: jest.fn(),
        } as any;

        mockSfxManager = {
            initialize: jest.fn(),
            playSfx: jest.fn(),
        } as any;

        // Replace the instances in the SoundManager
        (soundManager as any).audioSettings = mockAudioSettings;
        (soundManager as any).musicPlayer = mockMusicPlayer;
        (soundManager as any).sfxManager = mockSfxManager;

        // Reset the audio context so it gets recreated with our mock
        (soundManager as any).ctx = undefined;
    });

    describe("resume", () => {
        it("should resume audio context when suspended", () => {
            mockAudioContext.state = "suspended";

            soundManager.resume();

            expect(mockAudioContext.resume).toHaveBeenCalled();
            expect(mockMusicPlayer.resume).toHaveBeenCalled();
        });

        it("should not resume audio context when running", () => {
            mockAudioContext.state = "running";

            soundManager.resume();

            expect(mockAudioContext.resume).not.toHaveBeenCalled();
            expect(mockMusicPlayer.resume).toHaveBeenCalled();
        });
    });

    describe("music control", () => {
        it("should play title music and apply volume", () => {
            soundManager.playTitleMusic();

            expect(mockMusicPlayer.playTitleMusic).toHaveBeenCalled();
            expect(mockMusicPlayer.setVolume).toHaveBeenCalledWith(0.5);
        });

        it("should prepare run music", () => {
            soundManager.prepareRunMusic();

            expect(mockMusicPlayer.prepareRunMusic).toHaveBeenCalled();
        });

        it("should play level track and apply volume", () => {
            soundManager.playLevelTrack(2);

            expect(mockMusicPlayer.playLevelTrack).toHaveBeenCalledWith(2);
            expect(mockMusicPlayer.setVolume).toHaveBeenCalledWith(0.5);
        });

        it("should start soundtrack and apply volume", () => {
            soundManager.startSoundtrack();

            expect(mockMusicPlayer.startSoundtrack).toHaveBeenCalled();
            expect(mockMusicPlayer.setVolume).toHaveBeenCalledWith(0.5);
        });
    });

    describe("settings management", () => {
        it("should update audio settings and apply music volume", () => {
            const settings = {
                masterVolume: 0.8,
                musicVolume: 0.6,
                sfxVolume: 0.7,
                muteAll: false,
                muteMusic: false,
            };

            soundManager.setSettings(settings);

            expect(mockAudioSettings.setSettings).toHaveBeenCalledWith(
                settings
            );
            expect(mockMusicPlayer.setVolume).toHaveBeenCalledWith(0.5);
        });
    });

    describe("sound effects", () => {
        it("should delegate SFX playback to SFXManager", () => {
            soundManager.playSfx("uiHover");

            expect(mockSfxManager.playSfx).toHaveBeenCalledWith("uiHover");
        });

        it("should play different SFX types", () => {
            soundManager.playSfx("shoot");
            soundManager.playSfx("enemyDown");
            soundManager.playSfx("xpPickup");

            expect(mockSfxManager.playSfx).toHaveBeenCalledWith("shoot");
            expect(mockSfxManager.playSfx).toHaveBeenCalledWith("enemyDown");
            expect(mockSfxManager.playSfx).toHaveBeenCalledWith("xpPickup");
        });
    });

    describe("initialization", () => {
        it("should initialize all modules when audio context is created", () => {
            // Trigger context creation by calling a method that needs it
            soundManager.startSoundtrack();

            expect(mockAudioSettings.setGainNodes).toHaveBeenCalled();
            expect(mockMusicPlayer.initialize).toHaveBeenCalled();
            expect(mockSfxManager.initialize).toHaveBeenCalled();
        });

        it("should create proper audio graph connections", () => {
            soundManager.startSoundtrack();

            expect(mockAudioContext.createGain).toHaveBeenCalledTimes(3); // master, music, sfx
            expect(mockGainNode.connect).toHaveBeenCalled();
        });
    });
});
