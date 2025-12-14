import { SFXManager } from "../audio/SFXManager";

describe("SFXManager", () => {
    let sfxManager: SFXManager;
    let mockAudioContext: any;
    let mockSfxGain: any;

    beforeEach(() => {
        // Create a simple mock that tracks method calls
        mockAudioContext = {
            createOscillator: jest.fn(() => {
                const mockOsc = {
                    type: "sine",
                    frequency: {
                        setValueAtTime: jest.fn(),
                        linearRampToValueAtTime: jest.fn(),
                    },
                    connect: jest.fn(),
                    start: jest.fn(),
                    stop: jest.fn(),
                    disconnect: jest.fn(),
                    onended: null as any,
                };
                // Make connect return the connected node for chaining
                mockOsc.connect.mockImplementation((node) => node);
                return mockOsc;
            }),
            createGain: jest.fn(() => {
                const mockGain = {
                    gain: {
                        setValueAtTime: jest.fn(),
                        linearRampToValueAtTime: jest.fn(),
                        value: 0,
                    },
                    connect: jest.fn(),
                    disconnect: jest.fn(),
                };
                // Make connect return the connected node for chaining
                mockGain.connect.mockImplementation((node) => node);
                return mockGain;
            }),
            createBufferSource: jest.fn(() => ({
                buffer: null,
                connect: jest.fn().mockReturnThis(),
                start: jest.fn(),
                stop: jest.fn(),
                disconnect: jest.fn(),
            })),
            createBiquadFilter: jest.fn(() => ({
                type: "lowpass",
                frequency: { value: 0 },
                connect: jest.fn().mockReturnThis(),
                disconnect: jest.fn(),
            })),
            createBuffer: jest.fn(() => ({
                getChannelData: jest.fn(() => new Float32Array(128)),
            })),
            currentTime: 1,
            sampleRate: 44100,
            state: "running",
            resume: jest.fn(),
        };

        mockSfxGain = {
            gain: { value: 1 },
            connect: jest.fn(),
            disconnect: jest.fn(),
        };

        sfxManager = new SFXManager();
        sfxManager.initialize(mockAudioContext, mockSfxGain);

        // Clear any initialization calls and reset cooldowns
        jest.clearAllMocks();
        (sfxManager as any).sfxCooldowns.clear();
    });

    describe("initialization", () => {
        it("should initialize without errors", () => {
            const newSfxManager = new SFXManager();
            expect(() =>
                newSfxManager.initialize(mockAudioContext, mockSfxGain)
            ).not.toThrow();
        });

        it("should store audio context and gain node references", () => {
            // Verify that the SFXManager has stored the references
            expect((sfxManager as any).ctx).toBe(mockAudioContext);
            expect((sfxManager as any).sfxGain).toBe(mockSfxGain);
        });
    });

    describe("playSfx", () => {
        it("should create audio nodes when playing sounds", () => {
            // Call playSfx
            sfxManager.playSfx("uiHover");

            // The playTone method should call createOscillator and createGain
            expect(mockAudioContext.createOscillator).toHaveBeenCalled();
            expect(mockAudioContext.createGain).toHaveBeenCalled();
        });

        it("should handle different sound types", () => {
            sfxManager.playSfx("uiSelect");
            expect(mockAudioContext.createOscillator).toHaveBeenCalled();

            jest.clearAllMocks();

            sfxManager.playSfx("shoot");
            expect(mockAudioContext.createOscillator).toHaveBeenCalled();
        });

        it("should create noise and tone for enemyDown", () => {
            sfxManager.playSfx("enemyDown");
            expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
            expect(mockAudioContext.createOscillator).toHaveBeenCalled();
        });

        it("should create multiple oscillators for xpPickup", () => {
            sfxManager.playSfx("xpPickup");
            expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
        });

        it("should respect cooldown periods", () => {
            sfxManager.playSfx("uiHover");
            const firstCallCount =
                mockAudioContext.createOscillator.mock.calls.length;

            // Immediately play again - should be blocked by cooldown
            sfxManager.playSfx("uiHover");
            const secondCallCount =
                mockAudioContext.createOscillator.mock.calls.length;

            expect(secondCallCount).toBe(firstCallCount);
        });

        it("should allow sound after cooldown period", () => {
            sfxManager.playSfx("uiHover");
            const firstCallCount =
                mockAudioContext.createOscillator.mock.calls.length;

            // Advance time beyond cooldown (uiHover cooldown is 0.08)
            mockAudioContext.currentTime = 2;

            sfxManager.playSfx("uiHover");
            const secondCallCount =
                mockAudioContext.createOscillator.mock.calls.length;

            expect(secondCallCount).toBeGreaterThan(firstCallCount);
        });
    });

    describe("resume", () => {
        it("should resume suspended audio context", () => {
            mockAudioContext.state = "suspended";
            sfxManager.resume();
            expect(mockAudioContext.resume).toHaveBeenCalled();
        });

        it("should not resume running audio context", () => {
            mockAudioContext.state = "running";
            sfxManager.resume();
            expect(mockAudioContext.resume).not.toHaveBeenCalled();
        });
    });
});
