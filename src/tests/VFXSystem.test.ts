/**
 * VFXSystem Unit Tests
 * Tests particle effect creation and management, screen effect application and timing
 */

import { VFXSystem } from "../game/systems/VFXSystem";

// Mock Phaser.Math.Vector2
(global as any).Phaser = {
    Math: {
        Vector2: class Vector2 {
            x: number;
            y: number;

            constructor(x: number = 0, y: number = 0) {
                this.x = x;
                this.y = y;
            }

            angle(): number {
                return Math.atan2(this.y, this.x);
            }
        },
    },
};

// Mock Phaser objects
const mockTweens = {
    add: jest.fn(),
    addCounter: jest.fn(),
    killTweensOf: jest.fn(),
};

const mockCameras = {
    main: {
        shake: jest.fn(),
        flash: jest.fn(),
    },
};

const mockAdd = {
    circle: jest.fn(() => ({
        setStrokeStyle: jest.fn().mockReturnThis(),
        setDepth: jest.fn().mockReturnThis(),
        destroy: jest.fn(),
    })),
    arc: jest.fn(() => ({
        setStrokeStyle: jest.fn().mockReturnThis(),
        setDepth: jest.fn().mockReturnThis(),
        setVisible: jest.fn().mockReturnThis(),
        setPosition: jest.fn().mockReturnThis(),
        setAlpha: jest.fn().mockReturnThis(),
        setScale: jest.fn().mockReturnThis(),
    })),
    rectangle: jest.fn(() => ({
        setDepth: jest.fn().mockReturnThis(),
        setScrollFactor: jest.fn().mockReturnThis(),
        setAlpha: jest.fn().mockReturnThis(),
        setBlendMode: jest.fn().mockReturnThis(),
        setVisible: jest.fn().mockReturnThis(),
        setFillStyle: jest.fn().mockReturnThis(),
        destroy: jest.fn(),
        postFX: {
            addVignette: jest.fn(),
        },
        fillAlpha: 0.28,
    })),
    graphics: jest.fn(() => ({
        generateTexture: jest.fn(),
        destroy: jest.fn(),
    })),
};

const mockScene = {
    tweens: mockTweens,
    cameras: mockCameras,
    add: mockAdd,
    time: { now: 1000 },
    scale: { width: 800, height: 600 },
    textures: {
        exists: jest.fn(() => false),
    },
} as any;

describe("VFXSystem", () => {
    let vfxSystem: VFXSystem;

    beforeEach(() => {
        jest.clearAllMocks();
        vfxSystem = new VFXSystem();
        vfxSystem.initialize(mockScene);
    });

    afterEach(() => {
        vfxSystem.shutdown();
    });

    describe("System Lifecycle", () => {
        test("should initialize with correct system ID", () => {
            expect(vfxSystem.systemId).toBe("vfx");
            expect(vfxSystem.dependencies).toEqual([]);
            expect(vfxSystem.isActive).toBe(true);
        });

        test("should shutdown cleanly", () => {
            vfxSystem.shutdown();
            expect(vfxSystem.isActive).toBe(false);
        });
    });

    describe("Low Graphics Mode", () => {
        test("should set and get low graphics mode", () => {
            expect(vfxSystem.isLowGraphicsMode()).toBe(false);

            vfxSystem.setLowGraphicsMode(true);
            expect(vfxSystem.isLowGraphicsMode()).toBe(true);

            vfxSystem.setLowGraphicsMode(false);
            expect(vfxSystem.isLowGraphicsMode()).toBe(false);
        });

        test("should skip visual effects in low graphics mode", () => {
            vfxSystem.setLowGraphicsMode(true);

            vfxSystem.spawnBurstVisual(100, 100, 50, 0xff0000);
            expect(mockAdd.circle).not.toHaveBeenCalled();

            vfxSystem.spawnMuzzleFlash(100, 100);
            expect(mockAdd.circle).not.toHaveBeenCalled();
        });
    });

    describe("Particle Effect Creation", () => {
        test("should create burst visual with correct parameters", () => {
            const mockCircle = {
                setStrokeStyle: jest.fn().mockReturnThis(),
                setDepth: jest.fn().mockReturnThis(),
                destroy: jest.fn(),
            };
            mockAdd.circle.mockReturnValue(mockCircle);

            vfxSystem.spawnBurstVisual(100, 150, 50, 0xff0000, 0.8);

            expect(mockAdd.circle).toHaveBeenCalledWith(
                100,
                150,
                50,
                0xff0000,
                0.08
            );
            expect(mockCircle.setStrokeStyle).toHaveBeenCalledWith(
                2,
                0xff0000,
                0.8
            );
            expect(mockCircle.setDepth).toHaveBeenCalledWith(0.5);
            expect(mockTweens.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    targets: mockCircle,
                    alpha: { from: 0.8, to: 0 },
                    scale: { from: 0.9, to: 1.15 },
                    duration: 200,
                })
            );
        });

        test("should create muzzle flash with correct parameters", () => {
            const mockFlash = {
                setStrokeStyle: jest.fn().mockReturnThis(),
                setDepth: jest.fn().mockReturnThis(),
                destroy: jest.fn(),
            };
            mockAdd.circle.mockReturnValue(mockFlash);

            vfxSystem.spawnMuzzleFlash(200, 250);

            expect(mockAdd.circle).toHaveBeenCalledWith(
                200,
                250,
                7,
                0xf7d46b,
                0.35
            );
            expect(mockFlash.setDepth).toHaveBeenCalledWith(2);
            expect(mockTweens.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    targets: mockFlash,
                    scale: { from: 0.6, to: 1.4 },
                    alpha: { from: 0.35, to: 0 },
                    duration: 140,
                })
            );
        });

        test("should use default stroke opacity for burst visual", () => {
            const mockCircle = {
                setStrokeStyle: jest.fn().mockReturnThis(),
                setDepth: jest.fn().mockReturnThis(),
                destroy: jest.fn(),
            };
            mockAdd.circle.mockReturnValue(mockCircle);

            vfxSystem.spawnBurstVisual(100, 150, 50, 0xff0000);

            expect(mockCircle.setStrokeStyle).toHaveBeenCalledWith(
                2,
                0xff0000,
                0.7
            );
        });
    });

    describe("Screen Effect Application", () => {
        test("should apply critical hit feedback with camera shake", () => {
            const mockEnemy = { x: 300, y: 400 } as any;
            const mockFlash = {
                setStrokeStyle: jest.fn().mockReturnThis(),
                setDepth: jest.fn().mockReturnThis(),
                destroy: jest.fn(),
            };
            mockAdd.circle.mockReturnValue(mockFlash);

            vfxSystem.playCritFeedback(mockEnemy);

            expect(mockCameras.main.shake).toHaveBeenCalledWith(80, 0.0025);
            expect(mockAdd.circle).toHaveBeenCalledWith(
                300,
                400,
                11.2,
                0xffd7a6,
                0.65
            );
            expect(mockTweens.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    targets: mockFlash,
                    scale: { from: 0.85, to: 1.25 },
                    alpha: { from: 0.65, to: 0 },
                    duration: 140,
                })
            );
        });

        test("should apply background tone effects", () => {
            const mockFx = {
                reset: jest.fn(),
                saturate: jest.fn(),
                brightness: jest.fn(),
            };

            // Simulate having background FX targets
            (vfxSystem as any).backgroundFxTargets = [mockFx];

            vfxSystem.applyBackgroundTone(1.5, 1.2);

            expect(mockFx.reset).toHaveBeenCalled();
            expect(mockFx.saturate).toHaveBeenCalledWith(1.5);
            expect(mockFx.brightness).toHaveBeenCalledWith(1.2, true);
        });

        test("should skip background tone in low graphics mode", () => {
            vfxSystem.setLowGraphicsMode(true);
            const mockFx = {
                reset: jest.fn(),
                saturate: jest.fn(),
                brightness: jest.fn(),
            };

            (vfxSystem as any).backgroundFxTargets = [mockFx];

            vfxSystem.applyBackgroundTone(1.5, 1.2);

            expect(mockFx.reset).not.toHaveBeenCalled();
        });
    });

    describe("Boss Effects", () => {
        test("should pulse background for boss phase", () => {
            // Add some background FX targets to trigger the tween
            const mockFx = {
                reset: jest.fn(),
                saturate: jest.fn(),
                brightness: jest.fn(),
            };
            (vfxSystem as any).backgroundFxTargets = [mockFx];

            vfxSystem.pulseBackgroundForBossPhase(2);

            expect(mockTweens.addCounter).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 0,
                    to: 1,
                    duration: 320,
                    yoyo: true,
                    ease: "Quad.easeOut",
                })
            );
        });

        test("should use camera flash in low graphics mode for boss phase", () => {
            vfxSystem.setLowGraphicsMode(true);

            vfxSystem.pulseBackgroundForBossPhase(1);

            expect(mockCameras.main.flash).toHaveBeenCalledWith(
                220,
                255,
                94,
                94
            );
            expect(mockTweens.addCounter).not.toHaveBeenCalled();
        });

        test("should play boss intro pulse", () => {
            vfxSystem.setupBossIntroOverlay();

            vfxSystem.playBossIntroPulse();

            expect(mockTweens.killTweensOf).toHaveBeenCalled();
            expect(mockTweens.add).toHaveBeenCalled();
        });
    });

    describe("Texture Creation", () => {
        test("should create texture with drawing function", () => {
            const mockGraphics = {
                generateTexture: jest.fn(),
                destroy: jest.fn(),
            };
            mockAdd.graphics.mockReturnValue(mockGraphics);

            const drawFunction = jest.fn();
            vfxSystem.createTexture("test-texture", drawFunction);

            expect(mockAdd.graphics).toHaveBeenCalledWith({ x: 0, y: 0 });
            expect(drawFunction).toHaveBeenCalledWith(mockGraphics);
            expect(mockGraphics.generateTexture).toHaveBeenCalledWith(
                "test-texture",
                64,
                64
            );
            expect(mockGraphics.destroy).toHaveBeenCalled();
        });

        test("should skip texture creation if texture already exists", () => {
            mockScene.textures.exists.mockReturnValue(true);

            const drawFunction = jest.fn();
            vfxSystem.createTexture("existing-texture", drawFunction);

            expect(mockAdd.graphics).not.toHaveBeenCalled();
            expect(drawFunction).not.toHaveBeenCalled();
        });
    });

    describe("Shield Visual Updates", () => {
        test("should create shield ring for active pilot", () => {
            const mockShieldRing = {
                setStrokeStyle: jest.fn().mockReturnThis(),
                setDepth: jest.fn().mockReturnThis(),
                setVisible: jest.fn().mockReturnThis(),
                setPosition: jest.fn().mockReturnThis(),
                setAlpha: jest.fn().mockReturnThis(),
                setScale: jest.fn().mockReturnThis(),
            };
            mockAdd.arc.mockReturnValue(mockShieldRing);

            const pilot = {
                sprite: { x: 100, y: 200 },
                shield: { hp: 50, activeUntil: 2000 },
                shieldRing: undefined,
            };

            vfxSystem.updateShieldVisual(pilot);

            expect(mockAdd.arc).toHaveBeenCalledWith(
                100,
                200,
                expect.closeTo(23.8, 1),
                0,
                360,
                false,
                0x9ff0ff,
                0.2
            );
            expect(mockShieldRing.setStrokeStyle).toHaveBeenCalledWith(
                3,
                0x9ff0ff,
                0.9
            );
            expect(mockShieldRing.setDepth).toHaveBeenCalledWith(0.9);
            expect(pilot.shieldRing).toBe(mockShieldRing);
        });

        test("should update existing shield ring position and effects", () => {
            const mockShieldRing = {
                setVisible: jest.fn().mockReturnThis(),
                setPosition: jest.fn().mockReturnThis(),
                setAlpha: jest.fn().mockReturnThis(),
                setScale: jest.fn().mockReturnThis(),
            };

            const pilot = {
                sprite: { x: 150, y: 250 },
                shield: { hp: 30, activeUntil: 1500 },
                shieldRing: mockShieldRing,
            };

            vfxSystem.updateShieldVisual(pilot);

            expect(mockShieldRing.setVisible).toHaveBeenCalledWith(true);
            expect(mockShieldRing.setPosition).toHaveBeenCalledWith(150, 250);
            expect(mockShieldRing.setAlpha).toHaveBeenCalled();
            expect(mockShieldRing.setScale).toHaveBeenCalled();
        });

        test("should handle pilot with no shield", () => {
            const pilot = {
                sprite: { x: 100, y: 200 },
                shield: { hp: 0, activeUntil: 0 },
                shieldRing: undefined,
            };

            expect(() => vfxSystem.updateShieldVisual(pilot)).not.toThrow();
            expect(mockAdd.arc).not.toHaveBeenCalled();
        });

        test("should handle null pilot gracefully", () => {
            expect(() => vfxSystem.updateShieldVisual(null)).not.toThrow();
            expect(mockAdd.arc).not.toHaveBeenCalled();
        });
    });

    describe("Dash Trail Effects", () => {
        test("should create dash trail with correct parameters", () => {
            const mockRect = {
                setRotation: jest.fn().mockReturnThis(),
                setDepth: jest.fn().mockReturnThis(),
                setScrollFactor: jest.fn().mockReturnThis(),
                setAlpha: jest.fn().mockReturnThis(),
                setBlendMode: jest.fn().mockReturnThis(),
                setVisible: jest.fn().mockReturnThis(),
                setFillStyle: jest.fn().mockReturnThis(),
                destroy: jest.fn(),
                postFX: {
                    addVignette: jest.fn(),
                },
                fillAlpha: 0.35,
            };
            mockAdd.rectangle.mockReturnValue(mockRect);

            const origin = new (global as any).Phaser.Math.Vector2(100, 200);
            const dir = new (global as any).Phaser.Math.Vector2(1, 0);
            dir.angle = jest.fn(() => 0);

            vfxSystem.spawnDashTrail(origin, dir);

            expect(mockAdd.rectangle).toHaveBeenCalledWith(
                100,
                200,
                expect.closeTo(29.4, 1), // 42 * 0.7
                expect.closeTo(4.2, 1), // 6 * 0.7
                0x9ff0ff,
                0.35
            );
            expect(mockRect.setRotation).toHaveBeenCalledWith(0);
            expect(mockRect.setDepth).toHaveBeenCalledWith(0.6);
            expect(mockTweens.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    targets: mockRect,
                    alpha: { from: 0.35, to: 0 },
                    scaleX: { from: 1, to: 0.6 },
                    duration: 180,
                })
            );
        });

        test("should skip dash trail in low graphics mode", () => {
            vfxSystem.setLowGraphicsMode(true);

            const origin = new (global as any).Phaser.Math.Vector2(100, 200);
            const dir = new (global as any).Phaser.Math.Vector2(1, 0);

            vfxSystem.spawnDashTrail(origin, dir);

            expect(mockAdd.rectangle).not.toHaveBeenCalled();
        });
    });

    describe("Background FX Management", () => {
        test("should register background FX target", () => {
            const mockObj = {
                postFX: {
                    addColorMatrix: jest.fn(() => ({
                        reset: jest.fn(),
                        saturate: jest.fn(),
                        brightness: jest.fn(),
                    })),
                },
            };

            const result = vfxSystem.registerBackgroundFxTarget(mockObj as any);

            expect(mockObj.postFX.addColorMatrix).toHaveBeenCalled();
            expect(result).toBeTruthy();
        });

        test("should return null for objects without postFX in low graphics mode", () => {
            vfxSystem.setLowGraphicsMode(true);
            const mockObj = {};

            const result = vfxSystem.registerBackgroundFxTarget(mockObj as any);

            expect(result).toBeNull();
        });

        test("should return null for objects without postFX component", () => {
            const mockObj = {};

            const result = vfxSystem.registerBackgroundFxTarget(mockObj as any);

            expect(result).toBeNull();
        });

        test("should reset background effects", () => {
            const mockTween = {
                stop: jest.fn(),
            };
            (vfxSystem as any).backgroundFxTween = mockTween;

            vfxSystem.resetBackgroundEffects();

            expect(mockTween.stop).toHaveBeenCalled();
        });
    });

    describe("Update Method", () => {
        test("should handle update calls without errors", () => {
            expect(() => vfxSystem.update(1000, 16)).not.toThrow();
        });
    });
});
