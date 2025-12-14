import { MusicPlayer } from "../audio/MusicPlayer";

// Mock HTML Audio Element
global.Audio = jest.fn(() => ({
    src: "",
    volume: 1,
    loop: false,
    paused: false,
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
})) as any;

describe("MusicPlayer", () => {
    let musicPlayer: MusicPlayer;
    let mockAudioContext: any;
    let mockMusicGain: any;

    beforeEach(() => {
        mockAudioContext = {
            createMediaElementSource: jest.fn(() => ({
                connect: jest.fn(),
                disconnect: jest.fn(),
            })),
            state: "running",
            resume: jest.fn(),
        };

        mockMusicGain = {
            gain: { value: 1 },
            connect: jest.fn(),
            disconnect: jest.fn(),
        };

        musicPlayer = new MusicPlayer();
        musicPlayer.initialize(mockAudioContext, mockMusicGain);

        jest.clearAllMocks();
    });

    describe("initialization", () => {
        it("should initialize without errors", () => {
            const newMusicPlayer = new MusicPlayer();
            expect(() =>
                newMusicPlayer.initialize(mockAudioContext, mockMusicGain)
            ).not.toThrow();
        });
    });

    describe("resume", () => {
        it("should resume suspended audio context", () => {
            mockAudioContext.state = "suspended";
            musicPlayer.resume();
            expect(mockAudioContext.resume).toHaveBeenCalled();
        });

        it("should not resume running audio context", () => {
            mockAudioContext.state = "running";
            musicPlayer.resume();
            expect(mockAudioContext.resume).not.toHaveBeenCalled();
        });
    });

    describe("setVolume", () => {
        it("should set volume on music player", () => {
            expect(() => musicPlayer.setVolume(0.5)).not.toThrow();
        });
    });

    describe("music control", () => {
        it("should play title music without errors", () => {
            expect(() => musicPlayer.playTitleMusic()).not.toThrow();
        });

        it("should prepare run music without errors", () => {
            expect(() => musicPlayer.prepareRunMusic()).not.toThrow();
        });

        it("should play level track without errors", () => {
            expect(() => musicPlayer.playLevelTrack(1)).not.toThrow();
            expect(() => musicPlayer.playLevelTrack(2)).not.toThrow();
        });

        it("should start soundtrack without errors", () => {
            expect(() => musicPlayer.startSoundtrack()).not.toThrow();
        });
    });
});
