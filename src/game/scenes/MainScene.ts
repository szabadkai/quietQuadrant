import Phaser from "phaser";
import { soundManager } from "../../audio/SoundManager";
import { getEnemyDefinition } from "../../config/enemies";
import { UPGRADE_CATALOG, UPGRADE_RARITY_ODDS } from "../../config/upgrades";
import { WAVES } from "../../config/waves";
import type {
    BossDefinition,
    ControlBinding,
    EnemySpawn,
    RunMode,
    TwinControlConfig,
    UpgradeDefinition,
    WeeklyAffix,
} from "../../models/types";
import {
    useMultiplayerStore,
    type GameStateSync,
    type GuestBulletRequest,
} from "../../state/useMultiplayerStore";
import { useMetaStore } from "../../state/useMetaStore";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";
import { useInputStore } from "../../state/useInputStore";
import { Prng } from "../../utils/seed";
import { GAME_EVENT_KEYS, gameEvents } from "../events";
import { GAME_HEIGHT, GAME_WIDTH } from "../GameConfig";
import {
    GamepadAdapter,
    type GamepadControlState,
} from "../input/GamepadAdapter";
import type {
    PlayerStats,
    AbilityState,
    ChargeRuntime,
    ShieldState,
    MomentumState,
    PilotRuntime,
} from "./MainScene.types";
import { UpgradeManager } from "./managers/UpgradeManager";
import { BossManager } from "./managers/BossManager";
import {
    EntityInterpolator,
    BulletPredictor,
    LatencyEstimator,
    SNAP_THRESHOLD,
} from "../../network/Interpolation";

const OBJECT_SCALE = 0.7;
const COLOR_ACCENT = 0x9ff0ff;
const COLOR_CHARGE = 0xf7d46b;
const COLOR_PULSE = 0xa0f4ff;
const COLOR_OVERLOAD = 0xffd7a6;
const XP_ATTRACT_RADIUS = 180;
const XP_ATTRACT_MIN_SPEED = 320;
const XP_ATTRACT_MAX_SPEED = 760;
const XP_ATTRACT_LERP_RATE = 10; // per-second factor for smoothing toward target velocity

export class MainScene extends Phaser.Scene {
    private player?: Phaser.Physics.Arcade.Image;
    private player2?: Phaser.Physics.Arcade.Image;
    private playerStats: PlayerStats = {
        moveSpeed: 240,
        damage: 12,
        fireRate: 4,
        projectileSpeed: 520,
        projectiles: 1,
        pierce: 0,
        bounce: 0,
        maxHealth: 5,
        health: 5,
        critChance: 0.05,
        critMultiplier: 2,
    };
    private difficulty = 1;

    private bullets!: Phaser.Physics.Arcade.Group;
    private enemyBullets!: Phaser.Physics.Arcade.Group;
    private enemies!: Phaser.Physics.Arcade.Group;
    private xpPickups!: Phaser.Physics.Arcade.Group;
    private playersGroup!: Phaser.Physics.Arcade.Group;
    private starfieldLayers: {
        sprite: Phaser.GameObjects.TileSprite;
        velocityX: number;
        velocityY: number;
        colorFx?: Phaser.FX.ColorMatrix;
    }[] = [];
    private backgroundFxTargets: Phaser.FX.ColorMatrix[] = [];
    private playfieldBackdrop?: Phaser.GameObjects.Rectangle;

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
    private waveIndex = 0;
    private runActive = false;
    private runStartTime = 0;
    private xp = 0;
    private level = 1;
    private nextXpThreshold = 12;
    private nextWaveCheckAt = 0;
    private intermissionActive = false;
    private intermissionRemainingMs = 0;
    private pendingWaveIndex: number | null = null;
    private lastCountdownBroadcast = 0;
    private screenBounds!: Phaser.Geom.Rectangle;
    private elapsedAccumulator = 0;
    private rng = new Prng(1);
    private seedId = "week-0";
    private affix: WeeklyAffix | null = null;
    private runMode: RunMode = "standard";
    private twinControls?: TwinControlConfig;
    private infiniteMode = false;
    private bossCleared = false;
    private baseDifficulty = 1;
    private enemyHealthScale = 1;
    private modeEnemyCountMultiplier = 1;
    private enemyDamageTakenMultiplier = 1;
    private inputMode: "keyboardMouse" | "controller" = "keyboardMouse";
    private gamepadAdapter?: GamepadAdapter;
    private gamepadAdapterP2?: GamepadAdapter;

    // Visual effect tracking for proper cleanup
    private activeSpawnCues: Phaser.GameObjects.Arc[] = [];
    private activeSpawnTweens: Phaser.Tweens.Tween[] = [];
    private activeDelayedCalls: Phaser.Time.TimerEvent[] = [];
    private playerState?: PilotRuntime;
    private playerTwoState?: PilotRuntime;
    private upgrades!: UpgradeManager;
    private bossManager!: BossManager;

    // Network interpolation for smooth multiplayer (guest-side)
    private enemyInterpolator = new EntityInterpolator(0.2, SNAP_THRESHOLD);
    private enemyBulletPredictor = new BulletPredictor();
    private playerBulletPredictor = new BulletPredictor();
    private hostPlayerInterpolator = new EntityInterpolator(
        0.25,
        SNAP_THRESHOLD
    );
    private latencyEstimator = new LatencyEstimator();
    private lastNetworkUpdateTime = 0;

    // Scratch vectors to avoid per-frame allocations
    private readonly _scratchVec = new Phaser.Math.Vector2();
    private readonly _scratchVec2 = new Phaser.Math.Vector2();

    // Cached store state to avoid multiple getState() calls per frame
    private _frameCache = {
        runStatus: "running" as string,
        isHost: true,
        isMobile: false,
        activePilots: [] as PilotRuntime[],
    };

    constructor() {
        super("MainScene");
    }

    create() {
        this.upgrades = new UpgradeManager({
            getPlayerStats: () => this.playerStats,
            setPlayerStats: (stats) => Object.assign(this.playerStats, stats),
            getPlayerState: () => this.playerState,
            getPlayerTwoState: () => this.playerTwoState,
            enforceHealthCap: () => this.enforceHealthCap(),
            setPaused: (paused) => this.setPaused(paused),
            spawnBurstVisual: (x, y, r, c, a) =>
                this.spawnBurstVisual(x, y, r, c, a),
            defaultShieldState: () => this.defaultShieldState(),
            defaultMomentumState: () => this.defaultMomentumState(),
        });
        this.bossManager = new BossManager({
            getTime: () => this.time.now,
            getDifficulty: () => this.difficulty,
            getEnemyHealthScale: () => this.enemyHealthScale,
            getEnemies: () => this.enemies,
            getEnemyBullets: () => this.enemyBullets,
            getNearestPilot: (x, y) => this.getNearestPilot(x, y),
            spawnWaveEnemies: (spawns) => this.spawnWaveEnemies(spawns),
            spawnBurstVisual: (x, y, r, c, a) =>
                this.spawnBurstVisual(x, y, r, c, a),
            getCamera: () => this.cameras.main,
            addTween: (config) => this.tweens.add(config),
            addCounter: (config) => this.tweens.addCounter(config),
            addDelayedCall: (delay, callback) => {
                this.time.delayedCall(delay, callback);
            },
            addRectangle: (x, y, w, h, color, alpha) =>
                this.add.rectangle(x, y, w, h, color, alpha),
            randFloat: (min, max) => this.randFloat(min, max),
            randBetween: (min, max) => this.randBetween(min, max),
            randChoice: <T>(items: T[]) => this.randChoice(items),
            shuffle: <T>(items: T[]) => this.shuffle(items),
            rngNext: () => this.rng.next(),
        });
        this.screenBounds = new Phaser.Geom.Rectangle(
            32,
            32,
            GAME_WIDTH - 64,
            GAME_HEIGHT - 64
        );
        this.physics.world.setBounds(
            this.screenBounds.x,
            this.screenBounds.y,
            this.screenBounds.width,
            this.screenBounds.height
        );
        this.setupVisuals();
        this.setupInput();
        this.gamepadAdapter = new GamepadAdapter(this);
        this.gamepadAdapterP2 = new GamepadAdapter(this);
        this.setupGroups();
        this.spawnPlayers();
        this.setupCollisions();
    }

    startNewRun(
        seedId: string,
        seedValue: number,
        affix?: WeeklyAffix,
        bossOverride?: BossDefinition,
        options?: { mode?: RunMode; twinControls?: TwinControlConfig }
    ) {
        if (!this.physics || !this.physics.world) {
            this.events.once(Phaser.Scenes.Events.CREATE, () =>
                this.startNewRun(
                    seedId,
                    seedValue,
                    affix,
                    bossOverride,
                    options
                )
            );
            return;
        }
        this.seedId = seedId;
        this.rng = new Prng(seedValue);
        this.bossManager.initialize(bossOverride, affix ?? null, (max) =>
            this.rng.nextInt(max)
        );
        this.affix = affix ?? null;
        this.runMode = options?.mode ?? "standard";
        this.twinControls = options?.twinControls;
        this.infiniteMode = this.runMode === "infinite";
        this.bossCleared = false;
        this.physics.world.resume();
        const waveCap = this.infiniteMode ? null : WAVES.length;
        useRunStore.getState().actions.startRun(seedId, {
            mode: this.runMode,
            waveCap,
        });
        this.resetState();
        useUIStore.getState().actions.setScreen("inGame");
        gameEvents.emit(GAME_EVENT_KEYS.runStarted);
        this.runActive = true;
        this.runStartTime = this.time.now;
        soundManager.prepareRunMusic();

        // Set up guest bullet handler for online host
        if (this.runMode === "online") {
            this.setupGuestBulletHandler();
        }

        this.beginWaveIntermission(0);
    }

    setPaused(paused: boolean) {
        if (paused) {
            this.physics.world.pause();
            useRunStore.getState().actions.setStatus("paused");
        } else {
            this.physics.world.resume();
            useRunStore.getState().actions.setStatus("running");
        }
    }

    private randBetween(min: number, max: number) {
        if (max <= min) return min;
        const span = max - min + 1;
        return Math.floor(this.rng.next() * span) + min;
    }

    private randFloat(min: number, max: number) {
        return this.rng.next() * (max - min) + min;
    }

    private shuffle<T>(items: T[]): T[] {
        const arr = [...items];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.rng.nextInt(i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    private randChoice<T>(items: T[]): T {
        if (items.length === 0) {
            throw new Error("randChoice called with empty array");
        }
        return items[this.rng.nextInt(items.length)];
    }

    private handleExplosiveImpact(
        projectile: Phaser.Physics.Arcade.Image,
        enemy: Phaser.Physics.Arcade.Image
    ) {
        if (this.upgrades.explosive.stacks <= 0) return;
        const radius = this.upgrades.explosive.radius;
        if (radius <= 0) return;
        const dmgMultiplier = this.upgrades.explosive.damageMultiplier;
        const damage = (projectile.getData("damage") as number) * dmgMultiplier;
        const tags = (projectile.getData("tags") as string[] | undefined) ?? [];
        this.applyAoeDamage(enemy.x, enemy.y, radius, damage, tags);
        this.spawnBurstVisual(enemy.x, enemy.y, radius, COLOR_OVERLOAD, 0.8);
    }

    update(_: number, delta: number) {
        const dt = delta / 1000;
        this.updateStarfield(dt);
        if (!this.runActive || !this.playerState) return;

        // Cache store state once per frame to avoid repeated getState() calls
        const runState = useRunStore.getState();
        const multiplayerState = useMultiplayerStore.getState();
        const inputState = useInputStore.getState();
        this._frameCache.runStatus = runState.status;
        this._frameCache.isHost = multiplayerState.isHost;
        this._frameCache.isMobile = inputState.isMobile;

        // Cache active pilots (reuse array to avoid allocation)
        this._frameCache.activePilots.length = 0;
        if (this.isPilotActive(this.playerState)) {
            this._frameCache.activePilots.push(this.playerState);
        }
        if (
            (this.runMode === "twin" || this.runMode === "online") &&
            this.isPilotActive(this.playerTwoState)
        ) {
            this._frameCache.activePilots.push(this.playerTwoState!);
        }

        const activePilots = this._frameCache.activePilots;
        if (activePilots.length === 0) return;

        const controlSnapshots = activePilots.map((pilot) => {
            const binding = this.resolveControlBinding(pilot.id);
            const controls = this.readControlsForPilot(pilot, binding);
            pilot.control = binding;
            pilot.gamepadState = controls;
            if (controls.usingGamepad) {
                this.setInputMode("controller");
            } else if (
                binding.type === "keyboardMouse" &&
                this.isPointerDown()
            ) {
                this.setInputMode("keyboardMouse");
            }
            this.handleGamepadMetaInputs(controls);
            return { pilot, binding, controls };
        });

        if (this._frameCache.runStatus !== "running") return;
        this.elapsedAccumulator += dt;
        if (this.elapsedAccumulator >= 0.2) {
            runState.actions.tick(this.elapsedAccumulator);
            this.elapsedAccumulator = 0;
        }

        // In online mode, handle based on host/guest role
        const isHost = this._frameCache.isHost;
        const isOnlineGuest = this.runMode === "online" && !isHost;
        const isMobileInput = this._frameCache.isMobile;

        if (isOnlineGuest) {
            // Guest: Apply received game state, handle local input including shooting
            this.applyReceivedGameState();
            // Find local pilot and handle movement + shooting
            controlSnapshots.forEach(({ pilot, binding, controls }) => {
                if (binding.type === "keyboardMouse") {
                    this.handlePlayerMovement(pilot, dt, controls, binding);
                    this.updateMomentum(pilot, dt, controls, binding);
                    const fireHeld =
                        controls.fireActive ||
                        (binding.type === "keyboardMouse" &&
                            !isMobileInput &&
                            this.isPointerDown());
                    this.updateChargeState(pilot, dt, fireHeld);
                    // Guest sends bullet requests to host instead of spawning locally
                    this.handleGuestShooting(
                        pilot,
                        controls,
                        binding,
                        fireHeld
                    );
                    this.broadcastLocalPilotPosition(pilot);
                }
            });
        } else {
            // Host or local: Run full simulation
            controlSnapshots.forEach(({ pilot, binding, controls }) => {
                // Handle remote players - sync their position from multiplayer store
                if (binding.type === "remote") {
                    this.syncRemotePilot(pilot, binding);
                } else {
                    this.handlePlayerMovement(pilot, dt, controls, binding);
                    this.updateMomentum(pilot, dt, controls, binding);
                    const fireHeld =
                        controls.fireActive ||
                        (binding.type === "keyboardMouse" &&
                            !isMobileInput &&
                            this.isPointerDown());
                    this.updateChargeState(pilot, dt, fireHeld);
                    this.handleShooting(pilot, controls, binding, fireHeld);
                }
            });

            // Host broadcasts game state to guest
            if (this.runMode === "online" && isHost) {
                this.broadcastGameState();
            }
        }

        this.tickShieldTimers();
        controlSnapshots.forEach(({ pilot }) => this.updateShieldVisual(pilot));

        // Guest skips simulation - it receives state from host
        if (isOnlineGuest) {
            return;
        }

        this.handleEnemies();
        this.handleHeatseekingProjectiles(dt);
        this.handleProjectileBounds();
        this.handleXpAttraction(dt);
        this.bossManager.handleBossPatterns();
        this.handleWaveIntermission(dt);

        if (
            !this.intermissionActive &&
            this.enemies.countActive(true) === 0 &&
            this.time.now > this.nextWaveCheckAt
        ) {
            const hasNextWave =
                this.infiniteMode || this.waveIndex < WAVES.length - 1;
            if (hasNextWave) {
                this.beginWaveIntermission(this.waveIndex + 1);
            }
        }
    }

    applyUpgrade(id: string) {
        this.upgrades.apply(id);
    }

    private setupVisuals() {
        this.backgroundFxTargets = [];
        this.createStarfieldTextures();
        this.createStarfieldLayers();
        this.createPlayfieldBackdrop();
        this.bossManager.setupBossIntroOverlay(this);
        this.bossManager.setBackgroundFxTargets(this.backgroundFxTargets);
        // Sprite textures are now loaded from SVG files in BootScene
    }

    private createStarfieldTextures() {
        const layers = [
            {
                key: "starfield-far",
                size: 200,
                count: 24,
                color: 0x52657c,
                alpha: [0.14, 0.32] as const,
                radius: [0.9, 1.6] as const,
            },
            {
                key: "starfield-mid",
                size: 220,
                count: 28,
                color: 0x7bd3ff,
                alpha: [0.2, 0.45] as const,
                radius: [1, 2.2] as const,
            },
            {
                key: "starfield-near",
                size: 240,
                count: 20,
                color: 0xcde9ff,
                alpha: [0.35, 0.75] as const,
                radius: [1.4, 2.8] as const,
            },
        ];
        layers.forEach((layer) => {
            if (this.textures.exists(layer.key)) return;
            const g = this.add.graphics({ x: 0, y: 0 });
            for (let i = 0; i < layer.count; i++) {
                const x = Phaser.Math.Between(0, layer.size);
                const y = Phaser.Math.Between(0, layer.size);
                const alpha = Phaser.Math.FloatBetween(
                    layer.alpha[0],
                    layer.alpha[1]
                );
                const radius = Phaser.Math.FloatBetween(
                    layer.radius[0],
                    layer.radius[1]
                );
                g.fillStyle(layer.color, alpha);
                g.fillCircle(x, y, radius);
                if (Math.random() < 0.25) {
                    g.fillStyle(layer.color, alpha * 0.45);
                    g.fillCircle(x, y, radius + 1.1);
                }
            }
            g.generateTexture(layer.key, layer.size, layer.size);
            g.destroy();
        });
    }

    private createStarfieldLayers() {
        this.starfieldLayers.forEach((layer) => layer.sprite.destroy());
        this.starfieldLayers = [];
        const defs = [
            {
                key: "starfield-far",
                alpha: 0.3,
                velocityX: -3,
                velocityY: 6,
                depth: -3,
            },
            {
                key: "starfield-mid",
                alpha: 0.42,
                velocityX: -6,
                velocityY: 14,
                depth: -2.6,
            },
            {
                key: "starfield-near",
                alpha: 0.6,
                velocityX: -10,
                velocityY: 22,
                depth: -2.2,
                blendAdd: true,
            },
        ];
        defs.forEach((def) => {
            const sprite = this.add
                .tileSprite(
                    GAME_WIDTH / 2,
                    GAME_HEIGHT / 2,
                    GAME_WIDTH,
                    GAME_HEIGHT,
                    def.key
                )
                .setDepth(def.depth)
                .setAlpha(def.alpha);
            sprite.tilePositionX = Phaser.Math.Between(0, 200);
            sprite.tilePositionY = Phaser.Math.Between(0, 200);
            if (def.blendAdd) {
                sprite.setBlendMode(Phaser.BlendModes.ADD);
            }
            const colorFx = this.registerBackgroundFxTarget(sprite);
            this.starfieldLayers.push({
                sprite,
                velocityX: def.velocityX,
                velocityY: def.velocityY,
                colorFx: colorFx ?? undefined,
            });
        });
    }

    private registerBackgroundFxTarget(
        obj: Phaser.GameObjects.GameObject
    ): Phaser.FX.ColorMatrix | null {
        const fxComponent = (
            obj as unknown as { postFX?: Phaser.GameObjects.Components.FX }
        ).postFX;
        if (!fxComponent || typeof fxComponent.addColorMatrix !== "function")
            return null;
        const fx = fxComponent.addColorMatrix();
        this.backgroundFxTargets.push(fx);
        return fx;
    }

    private createPlayfieldBackdrop() {
        this.playfieldBackdrop?.destroy();
        this.playfieldBackdrop = this.add
            .rectangle(
                GAME_WIDTH / 2,
                GAME_HEIGHT / 2,
                GAME_WIDTH - 16,
                GAME_HEIGHT - 16,
                0x0b0f13,
                0.94
            )
            .setStrokeStyle(2, 0x1d2330);
        this.registerBackgroundFxTarget(this.playfieldBackdrop);
    }

    private updateStarfield(dt: number) {
        this.starfieldLayers.forEach((layer) => {
            layer.sprite.tilePositionX += layer.velocityX * dt;
            layer.sprite.tilePositionY += layer.velocityY * dt;
        });
    }

    private defaultAbility(): AbilityState {
        const dashCooldownMult = this.affix?.dashCooldownMultiplier ?? 1;
        return {
            dashCooldownMs: 1600 * dashCooldownMult,
            dashDurationMs: 220,
            nextDashAt: 0,
            activeUntil: 0,
        };
    }

    private defaultChargeRuntime(): ChargeRuntime {
        return {
            ready: false,
            holdMs: 0,
            damageBonus: 0.9,
            sizeBonus: 0.2,
            idleMs: 1000,
        };
    }

    private defaultShieldState(): ShieldState {
        return { hp: 0, activeUntil: 0, nextReadyAt: 0 };
    }

    private defaultMomentumState(): MomentumState {
        return { timerMs: 0, bonus: 0 };
    }

    private makePilotRuntime(
        id: "p1" | "p2",
        sprite: Phaser.Physics.Arcade.Image,
        control: ControlBinding
    ): PilotRuntime {
        return {
            id,
            sprite,
            ability: this.defaultAbility(),
            charge: this.defaultChargeRuntime(),
            momentum: this.defaultMomentumState(),
            shield: this.defaultShieldState(),
            lastAimDirection: new Phaser.Math.Vector2(1, 0),
            lastShotAt: 0,
            invulnUntil: 0,
            control,
            gamepadState: {
                hasGamepad: !!this.input.gamepad,
                usingGamepad: false,
                move: new Phaser.Math.Vector2(0, 0),
                aim: new Phaser.Math.Vector2(0, 0),
                fireActive: false,
                dashPressed: false,
                pausePressed: false,
                swapRequested: false,
            },
        };
    }

    private spawnPlayers() {
        this.player = this.physics.add
            .image(GAME_WIDTH / 2 - 20, GAME_HEIGHT / 2, "player")
            .setScale(OBJECT_SCALE)
            .setDepth(1);
        this.player.setCollideWorldBounds(true);
        this.player.setDamping(true);
        this.player.setDrag(0.95, 0.95);
        (this.player.body as Phaser.Physics.Arcade.Body).setSize(
            28 * OBJECT_SCALE,
            28 * OBJECT_SCALE,
            true
        );

        this.player2 = this.physics.add
            .image(GAME_WIDTH / 2 + 20, GAME_HEIGHT / 2, "player")
            .setScale(OBJECT_SCALE)
            .setDepth(1);
        this.player2.setCollideWorldBounds(true);
        this.player2.setDamping(true);
        this.player2.setDrag(0.95, 0.95);
        (this.player2.body as Phaser.Physics.Arcade.Body).setSize(
            28 * OBJECT_SCALE,
            28 * OBJECT_SCALE,
            true
        );
        this.player2.setVisible(false);
        this.player2.setActive(false);
        (this.player2.body as Phaser.Physics.Arcade.Body).enable = false;

        this.playersGroup.addMultiple([this.player, this.player2]);

        this.playerState = this.makePilotRuntime("p1", this.player, {
            type: "keyboardMouse",
        });
        this.playerTwoState = this.makePilotRuntime("p2", this.player2, {
            type: "gamepad",
        });
    }

    private getPilotBySprite(
        sprite: Phaser.Physics.Arcade.Image
    ): PilotRuntime | undefined {
        if (this.playerState?.sprite === sprite) return this.playerState;
        if (this.playerTwoState?.sprite === sprite) return this.playerTwoState;
        return undefined;
    }

    private isPilotActive(pilot?: PilotRuntime) {
        if (!pilot) return false;
        const body = pilot.sprite.body as Phaser.Physics.Arcade.Body | null;
        return (
            pilot.sprite.visible &&
            pilot.sprite.active &&
            !!body?.enable &&
            pilot.sprite.alpha > 0
        );
    }

    private getActivePilots(): PilotRuntime[] {
        const pilots: PilotRuntime[] = [];
        if (this.isPilotActive(this.playerState)) {
            pilots.push(this.playerState!);
        }
        if (
            (this.runMode === "twin" || this.runMode === "online") &&
            this.isPilotActive(this.playerTwoState)
        ) {
            pilots.push(this.playerTwoState!);
        }
        return pilots;
    }

    private getNearestPilot(x: number, y: number): PilotRuntime | null {
        const pilots = this.getActivePilots();
        if (pilots.length === 0) return null;
        let nearest: PilotRuntime | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        pilots.forEach((pilot) => {
            const dx = pilot.sprite.x - x;
            const dy = pilot.sprite.y - y;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDist) {
                bestDist = distSq;
                nearest = pilot;
            }
        });
        return nearest;
    }

    private emptyControlState(): GamepadControlState {
        return {
            hasGamepad: !!this.input.gamepad,
            usingGamepad: false,
            move: new Phaser.Math.Vector2(0, 0),
            aim: new Phaser.Math.Vector2(0, 0),
            fireActive: false,
            dashPressed: false,
            pausePressed: false,
            swapRequested: false,
        };
    }

    private resolveControlBinding(pilotId: "p1" | "p2"): ControlBinding {
        if (this.runMode !== "twin" && this.runMode !== "online") {
            return (
                this.twinControls?.[pilotId] ?? {
                    type: "keyboardMouse",
                    label: "Keyboard + Mouse",
                }
            );
        }
        const fallback: ControlBinding =
            pilotId === "p1"
                ? { type: "keyboardMouse", label: "Keyboard + Mouse" }
                : { type: "gamepad", label: "Gamepad" };
        return this.twinControls?.[pilotId] ?? fallback;
    }

    private readKeyboardDirection() {
        const dir = new Phaser.Math.Vector2(0, 0);
        if (this.cursors.left?.isDown || this.wasd.A.isDown) dir.x -= 1;
        if (this.cursors.right?.isDown || this.wasd.D.isDown) dir.x += 1;
        if (this.cursors.up?.isDown || this.wasd.W.isDown) dir.y -= 1;
        if (this.cursors.down?.isDown || this.wasd.S.isDown) dir.y += 1;
        return dir;
    }

    private readKeyboardControls(pilot: PilotRuntime): GamepadControlState {
        const inputState = useInputStore.getState();

        // If in mobile mode, always use mobile input path (even when sticks are idle)
        // This prevents touch events from being misinterpreted as mouse clicks
        if (inputState.isMobile) {
            const move = new Phaser.Math.Vector2(
                inputState.leftStick.x,
                inputState.leftStick.y
            );

            // Right stick for aiming, or use movement direction if not active
            let aim: Phaser.Math.Vector2;
            if (inputState.rightStick.active) {
                aim = new Phaser.Math.Vector2(
                    inputState.rightStick.x,
                    inputState.rightStick.y
                );
            } else if (move.lengthSq() > 0) {
                aim = move.clone().normalize();
            } else {
                aim = pilot.lastAimDirection.clone();
            }

            // Fire when right stick is active with sufficient magnitude
            const fireActive =
                inputState.rightStick.active &&
                inputState.rightStick.magnitude > 0.2;

            return {
                hasGamepad: false,
                usingGamepad: false,
                move,
                aim,
                fireActive,
                dashPressed: false, // Could add a dash button for mobile later
                pausePressed: false,
                swapRequested: false,
            };
        }

        // Fall back to keyboard/mouse controls (only when not in mobile mode)
        const dir = this.readKeyboardDirection();
        const aim = this.getPointerAim(pilot);
        return {
            hasGamepad: !!this.input.gamepad,
            usingGamepad: false,
            move: dir,
            aim,
            fireActive: this.isPointerDown(),
            dashPressed: Phaser.Input.Keyboard.JustDown(this.wasd.SHIFT),
            pausePressed: false,
            swapRequested: false,
        };
    }

    private readControlsForPilot(
        pilot: PilotRuntime,
        binding: ControlBinding
    ): GamepadControlState {
        // Remote players don't have local controls
        if (binding.type === "remote") {
            return this.emptyControlState();
        }

        // In mobile mode, always use readKeyboardControls which handles virtual sticks
        const inputState = useInputStore.getState();
        if (inputState.isMobile) {
            return this.readKeyboardControls(pilot);
        }

        if (this.runMode !== "twin" && this.runMode !== "online") {
            return (
                this.gamepadAdapter?.update() ??
                pilot.gamepadState ??
                this.emptyControlState()
            );
        }
        if (binding.type === "gamepad") {
            const adapter =
                pilot.id === "p1" ? this.gamepadAdapter : this.gamepadAdapterP2;
            return (
                adapter?.update(binding.id, binding.index) ??
                this.emptyControlState()
            );
        }
        return this.readKeyboardControls(pilot);
    }

    private syncRemotePilot(pilot: PilotRuntime, binding: ControlBinding) {
        if (binding.type !== "remote") return;

        const { playerStates, peerId } = useMultiplayerStore.getState();
        // Get the remote peer's state (not our own)
        const remoteState = Object.entries(playerStates).find(
            ([id]) => id !== peerId
        )?.[1];

        if (remoteState && remoteState.position) {
            // Smoothly interpolate to remote position
            const targetX = remoteState.position.x;
            const targetY = remoteState.position.y;

            // Disable physics for remote player to prevent local physics from interfering
            const body = pilot.sprite.body as Phaser.Physics.Arcade.Body;
            if (body) {
                body.setVelocity(0, 0);
                body.setAcceleration(0, 0);
            }

            // Interpolate position
            pilot.sprite.x = Phaser.Math.Linear(pilot.sprite.x, targetX, 0.5);
            pilot.sprite.y = Phaser.Math.Linear(pilot.sprite.y, targetY, 0.5);

            // Update rotation to face movement direction
            if (this.lastRemotePos) {
                const dx = targetX - this.lastRemotePos.x;
                const dy = targetY - this.lastRemotePos.y;
                if (dx * dx + dy * dy > 1) {
                    pilot.sprite.rotation = Math.atan2(dy, dx);
                }
            }
            this.lastRemotePos = { x: targetX, y: targetY };
        }
    }

    private lastRemotePos?: { x: number; y: number };
    private lastGameStateBroadcast = 0;

    private broadcastGameState() {
        const now = this.time.now;
        // Note: Adaptive tick interval is now handled in sendGameStateDelta
        // We still do a basic throttle here to avoid calling the function too often
        if (now - this.lastGameStateBroadcast < 16) return; // Max 60fps calls
        this.lastGameStateBroadcast = now;

        const { actions } = useMultiplayerStore.getState();

        // Collect enemy data
        const enemyData: GameStateSync["enemies"] = [];
        this.enemies.getChildren().forEach((enemy: any, index: number) => {
            if (enemy.active) {
                enemyData.push({
                    id: index,
                    x: enemy.x,
                    y: enemy.y,
                    health: enemy.getData?.("health") ?? 100,
                    kind: enemy.getData?.("kind") ?? "drifter",
                    active: true,
                });
            }
        });

        // Collect bullet data (enemy bullets)
        const bulletData: GameStateSync["bullets"] = [];
        this.enemyBullets
            .getChildren()
            .forEach((bullet: any, index: number) => {
                if (bullet.active) {
                    const body = bullet.body as Phaser.Physics.Arcade.Body;
                    bulletData.push({
                        id: index,
                        x: bullet.x,
                        y: bullet.y,
                        vx: body?.velocity?.x ?? 0,
                        vy: body?.velocity?.y ?? 0,
                    });
                }
            });

        // Collect player bullet data
        const playerBulletData: GameStateSync["playerBullets"] = [];
        this.bullets.getChildren().forEach((bullet: any, index: number) => {
            if (bullet.active) {
                const body = bullet.body as Phaser.Physics.Arcade.Body;
                playerBulletData.push({
                    id: index,
                    x: bullet.x,
                    y: bullet.y,
                    vx: body?.velocity?.x ?? 0,
                    vy: body?.velocity?.y ?? 0,
                    rotation: bullet.rotation ?? 0,
                });
            }
        });

        const gameState: GameStateSync = {
            players: {
                p1: {
                    x: this.playerState?.sprite.x ?? 0,
                    y: this.playerState?.sprite.y ?? 0,
                    rotation: this.playerState?.sprite.rotation ?? 0,
                    health: useRunStore.getState().playerHealth,
                    active: this.playerState?.sprite.active ?? false,
                },
                p2: {
                    x: this.playerTwoState?.sprite.x ?? 0,
                    y: this.playerTwoState?.sprite.y ?? 0,
                    rotation: this.playerTwoState?.sprite.rotation ?? 0,
                    health: useRunStore.getState().playerHealth,
                    active: this.playerTwoState?.sprite.active ?? false,
                },
            },
            enemies: enemyData,
            bullets: bulletData,
            playerBullets: playerBulletData,
            wave: this.waveIndex,
            score: useRunStore.getState().enemiesDestroyed,
            timestamp: now,
            // Countdown/intermission state
            intermissionActive: this.intermissionActive,
            countdown: useRunStore.getState().intermissionCountdown,
            pendingWave: this.pendingWaveIndex,
        };

        // Use delta-based sync with adaptive tick rate
        const entityCount =
            enemyData.length + bulletData.length + playerBulletData.length;
        actions.sendGameStateDelta(gameState, entityCount);
    }

    private applyReceivedGameState() {
        const { latestGameState, isHost } = useMultiplayerStore.getState();
        if (!latestGameState || isHost) return;

        const now = performance.now();
        const deltaTime = (now - this.lastNetworkUpdateTime) / 1000;
        this.lastNetworkUpdateTime = now;

        // Estimate latency from timestamp difference
        this.latencyEstimator.estimateFromTimestamp(
            latestGameState.timestamp,
            this.time.now
        );

        // Apply host player position (P1 is host's ship for guest)
        if (this.playerState && latestGameState.players.p1) {
            const p1 = latestGameState.players.p1;

            // Update interpolator target
            this.hostPlayerInterpolator.updateTarget(
                "host",
                p1.x,
                p1.y,
                p1.rotation
            );

            // Get interpolated position
            const interpolated = this.hostPlayerInterpolator.getPosition(
                "host",
                deltaTime
            );
            if (interpolated) {
                this.playerState.sprite.x = interpolated.x;
                this.playerState.sprite.y = interpolated.y;
                this.playerState.sprite.rotation =
                    interpolated.rotation ?? p1.rotation;
            }

            // Disable physics for remote player
            const body = this.playerState.sprite
                .body as Phaser.Physics.Arcade.Body;
            if (body) {
                body.setVelocity(0, 0);
                body.setAcceleration(0, 0);
            }
        }

        // Apply enemy positions with interpolation
        this.applyEnemyStateWithInterpolation(latestGameState, deltaTime);

        // Apply bullet positions with prediction
        this.applyBulletStateWithPrediction(latestGameState);

        // Apply player bullet positions with prediction
        this.applyPlayerBulletStateWithPrediction(latestGameState);

        // Apply countdown/intermission state
        const runActions = useRunStore.getState().actions;
        if (
            latestGameState.intermissionActive &&
            latestGameState.countdown !== null
        ) {
            runActions.setWaveCountdown(
                latestGameState.countdown,
                latestGameState.pendingWave ?? this.waveIndex + 1
            );
            this.intermissionActive = true;
            this.pendingWaveIndex = latestGameState.pendingWave;
        } else if (
            !latestGameState.intermissionActive &&
            this.intermissionActive
        ) {
            runActions.setWaveCountdown(null, null);
            this.intermissionActive = false;
            this.pendingWaveIndex = null;
        }

        // Sync wave index
        if (latestGameState.wave !== this.waveIndex) {
            this.waveIndex = latestGameState.wave;
            runActions.setWave(latestGameState.wave);
        }
    }

    /** Apply enemy state with smooth interpolation */
    private applyEnemyStateWithInterpolation(
        gameState: GameStateSync,
        deltaTime: number
    ): void {
        // Build a map of current enemies by sync ID
        const enemyMap = new Map<number, Phaser.Physics.Arcade.Image>();
        (this.enemies.getChildren() as Phaser.Physics.Arcade.Image[]).forEach(
            (enemy) => {
                if (enemy.active) {
                    const syncId = enemy.getData("syncId") as
                        | number
                        | undefined;
                    if (syncId !== undefined) {
                        enemyMap.set(syncId, enemy);
                    }
                }
            }
        );

        const receivedEnemyIds = new Set<number>();

        // Update or spawn enemies
        gameState.enemies.forEach((enemyData) => {
            if (!enemyData.active) return;
            receivedEnemyIds.add(enemyData.id);

            let enemy = enemyMap.get(enemyData.id);

            if (!enemy) {
                // Spawn new enemy
                const textureKey = enemyData.kind;
                enemy = this.enemies.get(
                    enemyData.x,
                    enemyData.y,
                    textureKey
                ) as Phaser.Physics.Arcade.Image;

                if (enemy) {
                    enemy.setActive(true);
                    enemy.setVisible(true);
                    enemy.setScale(OBJECT_SCALE);
                    enemy.setData("kind", enemyData.kind);
                    enemy.setData("health", enemyData.health);
                    enemy.setData("syncId", enemyData.id);
                    enemyMap.set(enemyData.id, enemy);
                }
            }

            if (enemy) {
                // Update interpolator target
                const entityId = `enemy-${enemyData.id}`;
                this.enemyInterpolator.updateTarget(
                    entityId,
                    enemyData.x,
                    enemyData.y
                );

                // Get interpolated position
                const interpolated = this.enemyInterpolator.getPosition(
                    entityId,
                    deltaTime
                );
                if (interpolated) {
                    enemy.x = interpolated.x;
                    enemy.y = interpolated.y;
                }

                enemy.setData("health", enemyData.health);
            }
        });

        // Deactivate enemies that host no longer has
        enemyMap.forEach((enemy, id) => {
            if (!receivedEnemyIds.has(id)) {
                enemy.setActive(false);
                enemy.setVisible(false);
                this.enemyInterpolator.remove(`enemy-${id}`);
            }
        });
    }

    /** Apply bullet state with velocity-based prediction */
    private applyBulletStateWithPrediction(gameState: GameStateSync): void {
        const bulletMap = new Map<number, Phaser.Physics.Arcade.Image>();
        (
            this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Image[]
        ).forEach((bullet) => {
            if (bullet.active) {
                const syncId = bullet.getData("syncId") as number | undefined;
                if (syncId !== undefined) {
                    bulletMap.set(syncId, bullet);
                }
            }
        });

        const receivedBulletIds = new Set<number>();

        gameState.bullets.forEach((bulletData) => {
            receivedBulletIds.add(bulletData.id);

            // Update predictor with latest data
            this.enemyBulletPredictor.update(
                bulletData.id,
                bulletData.x,
                bulletData.y,
                bulletData.vx,
                bulletData.vy
            );

            let bullet = bulletMap.get(bulletData.id);

            if (!bullet) {
                // Spawn new bullet
                bullet = this.enemyBullets.get(
                    bulletData.x,
                    bulletData.y,
                    "enemy-bullet"
                ) as Phaser.Physics.Arcade.Image;

                if (bullet) {
                    bullet.setActive(true);
                    bullet.setVisible(true);
                    bullet.setScale(OBJECT_SCALE);
                    bullet.setData("syncId", bulletData.id);
                    bulletMap.set(bulletData.id, bullet);
                }
            }

            if (bullet) {
                // Get predicted position
                const predicted = this.enemyBulletPredictor.getPosition(
                    bulletData.id
                );
                if (predicted) {
                    bullet.x = predicted.x;
                    bullet.y = predicted.y;
                }

                // Set velocity for physics-based movement between updates
                const body = bullet.body as Phaser.Physics.Arcade.Body;
                if (body) {
                    body.setVelocity(bulletData.vx, bulletData.vy);
                }
            }
        });

        // Deactivate bullets that host no longer has
        bulletMap.forEach((bullet, id) => {
            if (!receivedBulletIds.has(id)) {
                bullet.setActive(false);
                bullet.setVisible(false);
                this.enemyBulletPredictor.remove(id);
            }
        });
    }

    /** Apply player bullet state with velocity-based prediction */
    private applyPlayerBulletStateWithPrediction(
        gameState: GameStateSync
    ): void {
        if (!gameState.playerBullets) return;

        // Reconcile optimistic bullets first
        this.reconcileOptimisticBullets();

        const bulletMap = new Map<number, Phaser.Physics.Arcade.Image>();
        (this.bullets.getChildren() as Phaser.Physics.Arcade.Image[]).forEach(
            (bullet) => {
                if (bullet.active) {
                    const syncId = bullet.getData("syncId") as
                        | number
                        | undefined;
                    // Skip optimistic bullets (negative IDs)
                    if (syncId !== undefined && syncId >= 0) {
                        bulletMap.set(syncId, bullet);
                    }
                }
            }
        );

        const receivedBulletIds = new Set<number>();

        gameState.playerBullets.forEach((bulletData) => {
            receivedBulletIds.add(bulletData.id);

            // Update predictor
            this.playerBulletPredictor.update(
                bulletData.id,
                bulletData.x,
                bulletData.y,
                bulletData.vx,
                bulletData.vy
            );

            let bullet = bulletMap.get(bulletData.id);

            if (!bullet) {
                // Spawn new bullet
                bullet = this.bullets.get(
                    bulletData.x,
                    bulletData.y,
                    "bullet"
                ) as Phaser.Physics.Arcade.Image;

                if (bullet) {
                    bullet.setActive(true);
                    bullet.setVisible(true);
                    bullet.setScale(OBJECT_SCALE);
                    bullet.setData("syncId", bulletData.id);
                    bullet.setData("optimistic", false); // Mark as confirmed
                    bulletMap.set(bulletData.id, bullet);
                }
            }

            if (bullet) {
                // Get predicted position
                const predicted = this.playerBulletPredictor.getPosition(
                    bulletData.id
                );
                if (predicted) {
                    bullet.x = predicted.x;
                    bullet.y = predicted.y;
                }

                bullet.rotation = bulletData.rotation;

                const body = bullet.body as Phaser.Physics.Arcade.Body;
                if (body) {
                    body.setVelocity(bulletData.vx, bulletData.vy);
                }
            }
        });

        // Deactivate bullets that host no longer has
        bulletMap.forEach((bullet, id) => {
            if (!receivedBulletIds.has(id)) {
                bullet.setActive(false);
                bullet.setVisible(false);
                this.playerBulletPredictor.remove(id);
            }
        });
    }

    private lastBroadcastTime = 0;
    private readonly BROADCAST_INTERVAL = 16; // ~60fps

    private broadcastLocalPilotPosition(pilot: PilotRuntime) {
        const now = this.time.now;
        if (now - this.lastBroadcastTime < this.BROADCAST_INTERVAL) return;
        this.lastBroadcastTime = now;

        const { peerId, actions } = useMultiplayerStore.getState();

        if (peerId) {
            actions.updatePlayerState(peerId, {
                position: { x: pilot.sprite.x, y: pilot.sprite.y },
                health: 100, // TODO: sync actual health
                isAlive: pilot.sprite.active,
            });
        }
    }

    private lastGuestShotTime = 0;
    private readonly GUEST_SHOT_COOLDOWN = 200; // Reduced from 250ms for snappier feel
    private optimisticBulletIds: Set<number> = new Set(); // Track locally spawned bullets
    private nextOptimisticBulletId = -1; // Negative IDs for optimistic bullets

    private handleGuestShooting(
        pilot: PilotRuntime,
        controls: GamepadControlState,
        _binding: ControlBinding,
        fireHeld: boolean
    ) {
        if (!this.isPilotActive(pilot)) return;
        const fireRequested = fireHeld || controls.fireActive;
        if (!fireRequested) return;

        const now = this.time.now;
        if (now - this.lastGuestShotTime < this.GUEST_SHOT_COOLDOWN) return;
        this.lastGuestShotTime = now;

        // Get aim direction
        const dir = this.getAimDirection(pilot, controls, true);

        // Send bullet request to host
        const { actions } = useMultiplayerStore.getState();
        actions.sendGuestBullet({
            x: pilot.sprite.x,
            y: pilot.sprite.y,
            dirX: dir.x,
            dirY: dir.y,
            timestamp: now,
        });

        // OPTIMISTIC: Spawn bullet locally for instant feedback
        // This bullet will be reconciled when host confirms
        this.spawnOptimisticBullet(pilot.sprite.x, pilot.sprite.y, dir);

        // Play sound locally for feedback
        soundManager.playSfx("shoot");
    }

    /** Spawn a local bullet for instant feedback (guest-side) */
    private spawnOptimisticBullet(
        x: number,
        y: number,
        dir: Phaser.Math.Vector2
    ): void {
        const bullet = this.bullets.get(
            x,
            y,
            "bullet"
        ) as Phaser.Physics.Arcade.Image;
        if (!bullet) return;

        bullet.setActive(true);
        bullet.setVisible(true);
        bullet.setScale(OBJECT_SCALE);
        bullet.rotation = Math.atan2(dir.y, dir.x);

        // Use negative ID to mark as optimistic
        const optimisticId = this.nextOptimisticBulletId--;
        bullet.setData("syncId", optimisticId);
        bullet.setData("optimistic", true);
        bullet.setData("spawnTime", performance.now());
        this.optimisticBulletIds.add(optimisticId);

        // Set velocity based on player stats
        const speed = this.playerStats.projectileSpeed;
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setVelocity(dir.x * speed, dir.y * speed);
        }

        // Set damage for collision handling
        bullet.setData("damage", this.playerStats.damage);
        bullet.setData("pierce", this.playerStats.pierce);
        bullet.setData("bounce", this.playerStats.bounce);
        bullet.setData("tags", []);

        // Auto-cleanup optimistic bullets after a timeout (in case host never confirms)
        this.time.delayedCall(500, () => {
            if (bullet.active && bullet.getData("optimistic")) {
                bullet.setActive(false);
                bullet.setVisible(false);
                this.optimisticBulletIds.delete(optimisticId);
            }
        });
    }

    /** Clean up optimistic bullets when host state arrives (called from applyPlayerBulletStateWithPrediction) */
    private reconcileOptimisticBullets(): void {
        // Remove old optimistic bullets that have been superseded by host state
        const now = performance.now();
        const maxAge = 300; // ms - optimistic bullets older than this are stale

        (this.bullets.getChildren() as Phaser.Physics.Arcade.Image[]).forEach(
            (bullet) => {
                if (bullet.active && bullet.getData("optimistic")) {
                    const spawnTime = bullet.getData("spawnTime") as number;
                    if (now - spawnTime > maxAge) {
                        bullet.setActive(false);
                        bullet.setVisible(false);
                        const id = bullet.getData("syncId") as number;
                        this.optimisticBulletIds.delete(id);
                    }
                }
            }
        );
    }

    setupGuestBulletHandler() {
        // Host sets up handler to spawn bullets when guest shoots
        const { actions, isHost } = useMultiplayerStore.getState();
        if (!isHost) return;

        actions.setOnGuestBullet((bullet: GuestBulletRequest) => {
            // Spawn bullet at guest's position with their aim direction
            const dir = new Phaser.Math.Vector2(bullet.dirX, bullet.dirY);
            this.spawnBullet({
                x: bullet.x,
                y: bullet.y,
                dir,
                damage: this.playerStats.damage,
                pierce: this.playerStats.pierce,
                bounce: this.playerStats.bounce,
                tags: [],
                charged: false,
                sizeMultiplier: 1,
                sourceType: "primary",
            });
        });
    }

    private setupInput() {
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = {
            W: this.input.keyboard!.addKey("W"),
            A: this.input.keyboard!.addKey("A"),
            S: this.input.keyboard!.addKey("S"),
            D: this.input.keyboard!.addKey("D"),
            SHIFT: this.input.keyboard!.addKey(
                Phaser.Input.Keyboard.KeyCodes.SHIFT
            ),
        };
    }

    private setupGroups() {
        this.playersGroup = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            maxSize: 2,
            runChildUpdate: false,
        });
        this.bullets = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            maxSize: 128,
            runChildUpdate: false,
        });
        this.enemyBullets = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            maxSize: 256,
            runChildUpdate: false,
        });
        this.enemies = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            maxSize: 128,
            runChildUpdate: false,
        });
        this.xpPickups = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            maxSize: 256,
            runChildUpdate: false,
        });
    }

    private setupCollisions() {
        // Explicitly prevent friendly fire - bullets should never hit players
        // This is a safeguard even though there's no collision set up between them
        this.physics.add.overlap(
            this.bullets,
            this.playersGroup,
            () => {
                // Do nothing - friendly fire is disabled
            },
            () => false, // Process callback returns false to prevent any collision
            this
        );

        this.physics.add.collider(
            this.enemies,
            this.enemies,
            (a, b) =>
                this.handleEnemyCollide(
                    a as Phaser.Physics.Arcade.Image,
                    b as Phaser.Physics.Arcade.Image
                ),
            undefined,
            this
        );
        this.physics.add.overlap(
            this.bullets,
            this.enemies,
            (obj1, obj2) =>
                this.handleBulletHitEnemy(
                    obj1 as Phaser.GameObjects.GameObject,
                    obj2 as Phaser.GameObjects.GameObject
                ),
            undefined,
            this
        );
        this.physics.add.overlap(
            this.playersGroup,
            this.enemies,
            (playerObj, enemy) => {
                const pilot = this.getPilotBySprite(
                    playerObj as Phaser.Physics.Arcade.Image
                );
                if (!pilot) return;
                this.handlePlayerDamage(
                    pilot,
                    enemy as Phaser.Physics.Arcade.Image,
                    3,
                    true
                );
            },
            undefined,
            this
        );
        this.physics.add.overlap(
            this.playersGroup,
            this.enemyBullets,
            (playerObj, bullet) => {
                const pilot = this.getPilotBySprite(
                    playerObj as Phaser.Physics.Arcade.Image
                );
                if (!pilot) return;
                bullet.destroy();
                this.handlePlayerDamage(
                    pilot,
                    bullet as Phaser.Physics.Arcade.Image,
                    1,
                    false
                );
            },
            undefined,
            this
        );
        this.physics.add.overlap(
            this.playersGroup,
            this.xpPickups,
            (_player, pickup) =>
                this.collectXp(pickup as Phaser.Physics.Arcade.Image),
            undefined,
            this
        );
        this.physics.add.overlap(
            this.bullets,
            this.enemyBullets,
            (playerBullet, enemyBullet) =>
                this.handleProjectileIntercept(
                    playerBullet as Phaser.Physics.Arcade.Image,
                    enemyBullet as Phaser.Physics.Arcade.Image
                ),
            undefined,
            this
        );
    }

    private resetState() {
        const settings = useMetaStore.getState().settings;
        const twinActive = this.runMode === "twin" || this.runMode === "online";
        if (
            !this.player ||
            !this.player2 ||
            !this.playerState ||
            !this.playerTwoState
        ) {
            this.spawnPlayers();
        }
        this.inputMode = "keyboardMouse";
        this.bossManager.reset();
        this.baseDifficulty =
            typeof settings.difficultyMultiplier === "number"
                ? settings.difficultyMultiplier
                : 1;
        this.difficulty = this.baseDifficulty;
        this.modeEnemyCountMultiplier =
            this.runMode === "twin" || this.runMode === "online" ? 1.5 : 1;
        this.enemyDamageTakenMultiplier =
            this.runMode === "twin" || this.runMode === "online" ? 1.2 : 1;
        this.enemyHealthScale = 1;
        this.bossCleared = false;
        this.playerStats = {
            moveSpeed: 240,
            damage: 12,
            fireRate: 4,
            projectileSpeed: 520,
            projectiles: 1,
            pierce: 0,
            bounce: 0,
            maxHealth: 5,
            health: 5,
            critChance: 0.05,
            critMultiplier: 2,
        };

        // Apply affix modifiers to player stats
        if (this.affix) {
            if (this.affix.playerDamageMultiplier) {
                this.playerStats.damage *= this.affix.playerDamageMultiplier;
            }
            if (this.affix.playerSpeedMultiplier) {
                this.playerStats.moveSpeed *= this.affix.playerSpeedMultiplier;
            }
        }

        this.upgrades.reset();
        this.waveIndex = 0;
        this.xp = 0;
        this.level = 1;
        this.nextXpThreshold = 12;
        this.nextWaveCheckAt = 0;
        this.intermissionActive = false;
        this.pendingWaveIndex = null;
        this.intermissionRemainingMs = 0;
        this.lastCountdownBroadcast = 0;
        this.runActive = false;
        this.elapsedAccumulator = 0;

        // Clear network interpolators for fresh state
        this.enemyInterpolator.clear();
        this.enemyBulletPredictor.clear();
        this.playerBulletPredictor.clear();
        this.hostPlayerInterpolator.clear();
        this.lastNetworkUpdateTime = 0;
        this.optimisticBulletIds.clear();
        this.nextOptimisticBulletId = -1;

        // Clean up visual effects before clearing pools
        this.cleanupVisualEffects();

        this.enemies.clear(true, true);
        this.bullets.clear(true, true);
        this.enemyBullets.clear(true, true);
        this.xpPickups.clear(true, true);
        const offset = twinActive ? 32 : 0;
        const center = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
        const resetPilot = (
            pilot: PilotRuntime | undefined,
            pos: { x: number; y: number },
            active: boolean
        ) => {
            if (!pilot) return;
            pilot.ability = this.defaultAbility();
            pilot.charge = this.defaultChargeRuntime();
            pilot.momentum = this.defaultMomentumState();
            pilot.shield = this.defaultShieldState();
            pilot.lastAimDirection.set(1, 0);
            pilot.lastShotAt = this.time.now;
            pilot.invulnUntil = 0;
            pilot.control = this.resolveControlBinding(pilot.id);
            pilot.gamepadState = this.emptyControlState();
            pilot.shieldRing?.setVisible(false);
            pilot.sprite.setPosition(pos.x, pos.y);
            pilot.sprite.setActive(active);
            pilot.sprite.setVisible(active);
            const body = pilot.sprite.body as
                | Phaser.Physics.Arcade.Body
                | undefined;
            if (body) {
                body.enable = active;
                body.setVelocity(0, 0);
                body.setAcceleration(0, 0);
            }
            const adapter =
                pilot.id === "p1" ? this.gamepadAdapter : this.gamepadAdapterP2;
            if (pilot.control.type === "gamepad") {
                adapter?.setLockedPad(pilot.control.id, pilot.control.index);
            } else {
                adapter?.setLockedPad(undefined, undefined);
            }
        };
        resetPilot(
            this.playerState,
            { x: center.x - offset, y: center.y },
            true
        );
        resetPilot(
            this.playerTwoState,
            { x: center.x + offset, y: center.y },
            twinActive
        );
        const actions = useRunStore.getState().actions;
        actions.setVitals(this.playerStats.health, this.playerStats.maxHealth);
        actions.setXp(this.level, this.xp, this.nextXpThreshold);
        actions.setWaveCountdown(null, null);
    }

    private handlePlayerMovement(
        pilot: PilotRuntime,
        _dt: number,
        controls: GamepadControlState,
        binding: ControlBinding
    ) {
        if (!this.isPilotActive(pilot)) return;
        const body = pilot.sprite.body as Phaser.Physics.Arcade.Body;
        const dir = new Phaser.Math.Vector2(0, 0);

        if (controls.move.lengthSq() > 0) {
            dir.copy(controls.move);
        } else if (
            binding.type === "keyboardMouse" ||
            (this.runMode !== "twin" && this.runMode !== "online")
        ) {
            // Check touch input first, then keyboard
            const inputState = useInputStore.getState();
            if (inputState.isMobile && inputState.leftStick.active) {
                dir.set(inputState.leftStick.x, inputState.leftStick.y);
            } else {
                dir.copy(this.readKeyboardDirection());
            }
        }

        if (dir.lengthSq() > 0) {
            dir.normalize();
            body.setAcceleration(
                dir.x * this.playerStats.moveSpeed * 5,
                dir.y * this.playerStats.moveSpeed * 5
            );
        } else {
            body.setAcceleration(0, 0);
        }

        const isDashing = this.time.now < pilot.ability.activeUntil;
        const speed = isDashing
            ? this.playerStats.moveSpeed * 2.2
            : this.playerStats.moveSpeed;
        body.setMaxSpeed(speed);

        const dashPressed =
            controls.dashPressed ||
            (binding.type === "keyboardMouse" &&
                Phaser.Input.Keyboard.JustDown(this.wasd.SHIFT));
        if (dashPressed) {
            this.tryDash(pilot, dir);
        }

        const aimDir = this.getAimDirection(
            pilot,
            controls,
            binding.type === "keyboardMouse" ||
                (this.runMode !== "twin" && this.runMode !== "online")
        );
        pilot.sprite.rotation = Phaser.Math.Angle.Between(
            0,
            0,
            aimDir.x,
            aimDir.y
        );

        pilot.sprite.x = Phaser.Math.Clamp(
            pilot.sprite.x,
            this.screenBounds.left,
            this.screenBounds.right
        );
        pilot.sprite.y = Phaser.Math.Clamp(
            pilot.sprite.y,
            this.screenBounds.top,
            this.screenBounds.bottom
        );
    }

    private getAimDirection(
        pilot: PilotRuntime,
        controls: GamepadControlState,
        allowPointer: boolean
    ) {
        if (controls.aim.lengthSq() > 0) {
            const aim = controls.aim.clone().normalize();
            pilot.lastAimDirection.copy(aim);
            return aim;
        }
        if (allowPointer) {
            return this.getPointerAim(pilot);
        }
        return pilot.lastAimDirection.clone();
    }

    private getPointerAim(pilot: PilotRuntime) {
        if (!this.isPilotActive(pilot)) return pilot.lastAimDirection.clone();
        const pointer = this.input.activePointer;
        if (pointer) {
            const aimVec = new Phaser.Math.Vector2(
                pointer.worldX - pilot.sprite.x,
                pointer.worldY - pilot.sprite.y
            );
            if (aimVec.lengthSq() > 0.0001) {
                aimVec.normalize();
                pilot.lastAimDirection.copy(aimVec);
                return aimVec;
            }
        }
        return pilot.lastAimDirection.clone();
    }

    private isPointerDown() {
        return (
            this.input.activePointer?.isDown === true ||
            this.input.mousePointer?.isDown === true
        );
    }

    private handleGamepadMetaInputs(gamepadState: GamepadControlState) {
        if (!gamepadState.pausePressed) return;
        const uiState = useUIStore.getState();
        if (uiState.screen !== "inGame") return;
        const uiActions = uiState.actions;
        if (uiState.pauseMenuOpen) {
            uiActions.closePause();
            this.setPaused(false);
        } else {
            uiActions.openPause();
            this.setPaused(true);
        }
    }

    private setInputMode(mode: "keyboardMouse" | "controller") {
        if (this.inputMode === mode) return;
        this.inputMode = mode;
        const meta = useMetaStore.getState();
        if (meta.settings.inputMode !== mode) {
            meta.actions.updateSettings({ inputMode: mode }).catch(() => {});
        }
    }

    private updateChargeState(
        pilot: PilotRuntime,
        dt: number,
        fireHeld: boolean
    ) {
        if (this.upgrades.capacitor.stacks === 0) return;
        if (fireHeld) {
            pilot.charge.holdMs = Math.min(
                this.upgrades.capacitor.idleMs,
                pilot.charge.holdMs + dt * 1000
            );
            if (pilot.charge.holdMs >= this.upgrades.capacitor.idleMs) {
                pilot.charge.ready = true;
            }
        } else {
            pilot.charge.holdMs = 0;
            pilot.charge.ready = false;
        }
    }

    private updateMomentum(
        pilot: PilotRuntime,
        dt: number,
        _controls: GamepadControlState,
        _binding: ControlBinding
    ) {
        if (this.upgrades.momentum.stacks === 0 || !this.isPilotActive(pilot))
            return;
        const body = pilot.sprite.body as Phaser.Physics.Arcade.Body;
        const speed = body.velocity.length();
        const moving = speed > 30;
        if (moving) {
            pilot.momentum.timerMs = Math.min(
                this.upgrades.momentum.timeToMaxMs,
                pilot.momentum.timerMs + dt * 1000
            );
        } else {
            pilot.momentum.timerMs = Math.max(
                0,
                pilot.momentum.timerMs - dt * 800
            );
        }
        const ratio = Phaser.Math.Clamp(
            pilot.momentum.timerMs / this.upgrades.momentum.timeToMaxMs,
            0,
            1
        );
        pilot.momentum.bonus = this.upgrades.momentum.ramp * ratio;
    }

    private tickShieldTimers() {
        const now = this.time.now;
        const handle = (pilot?: PilotRuntime) => {
            if (!pilot) return;
            if (pilot.shield.hp > 0 && now > pilot.shield.activeUntil) {
                pilot.shield.hp = 0;
                pilot.shield.activeUntil = 0;
            }
        };
        handle(this.playerState);
        handle(this.playerTwoState);
    }

    private tryDash(pilot: PilotRuntime, dir: Phaser.Math.Vector2) {
        if (this.time.now < pilot.ability.nextDashAt) return;
        const dashDir =
            dir.lengthSq() > 0
                ? dir.clone().normalize()
                : new Phaser.Math.Vector2(1, 0);
        const body = pilot.sprite.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(
            dashDir.x * this.playerStats.moveSpeed * 3,
            dashDir.y * this.playerStats.moveSpeed * 3
        );
        pilot.ability.activeUntil =
            this.time.now + pilot.ability.dashDurationMs;
        pilot.invulnUntil = pilot.ability.activeUntil;
        pilot.ability.nextDashAt = this.time.now + pilot.ability.dashCooldownMs;
        this.spawnDashTrail(
            new Phaser.Math.Vector2(pilot.sprite.x, pilot.sprite.y),
            dashDir
        );
        this.spawnAfterimageShots(dashDir, pilot);
        this.spawnDashSparkExplosion(
            new Phaser.Math.Vector2(pilot.sprite.x, pilot.sprite.y),
            dashDir
        );
    }

    private handleShooting(
        pilot: PilotRuntime,
        controls: GamepadControlState,
        binding: ControlBinding,
        fireHeld: boolean
    ) {
        if (!this.isPilotActive(pilot)) return;
        const fireRequested = fireHeld || controls.fireActive;
        if (!fireRequested) return;

        const useChargeMode = this.upgrades.capacitor.stacks > 0;
        const isCharged = useChargeMode && pilot.charge.ready;
        const dir = this.getAimDirection(
            pilot,
            controls,
            binding.type === "keyboardMouse" ||
                (this.runMode !== "twin" && this.runMode !== "online")
        );
        const spreadCount = this.playerStats.projectiles;
        const spreadStepDeg = this.upgrades.spread.spreadDegrees;
        soundManager.playSfx("shoot");
        const baseDamage = this.playerStats.damage;
        const chargeDamageMultiplier = isCharged
            ? 1 + this.upgrades.capacitor.damageBonus
            : 1;
        const sizeScale = isCharged ? 1 + this.upgrades.capacitor.sizeBonus : 1;
        const pierce =
            this.playerStats.pierce +
            (isCharged ? this.upgrades.capacitor.chargePierceBonus : 0);
        const bounce = this.playerStats.bounce;
        const tags = this.buildProjectileTags(isCharged);
        const fireRateBonus = 1 + pilot.momentum.bonus;
        const adjustedFireRate =
            this.playerStats.fireRate *
            fireRateBonus *
            (1 + this.getBerserkBonus());
        const cooldown = 1000 / adjustedFireRate;
        if (this.time.now < pilot.lastShotAt + cooldown) return;
        if (!this.payBloodFuelCost()) return;
        pilot.lastShotAt = this.time.now;
        if (useChargeMode && isCharged) {
            pilot.charge.ready = false;
            pilot.charge.holdMs = 0;
        }

        for (let i = 0; i < spreadCount; i++) {
            const offset =
                spreadCount <= 1
                    ? 0
                    : (i - (spreadCount - 1) / 2) *
                      Phaser.Math.DegToRad(spreadStepDeg);
            const shotDir = this.applyInaccuracy(dir.clone().rotate(offset));
            this.spawnBullet({
                x: pilot.sprite.x,
                y: pilot.sprite.y,
                dir: shotDir,
                damage: baseDamage * chargeDamageMultiplier,
                pierce,
                bounce,
                sizeMultiplier: sizeScale,
                tags,
                charged: isCharged,
                sourceType: "primary",
            });
        }
        if (isCharged) {
            this.spawnMuzzleFlash(pilot.sprite.x, pilot.sprite.y);
        }
    }

    private spawnBullet(config: {
        x: number;
        y: number;
        dir: Phaser.Math.Vector2;
        damage: number;
        pierce: number;
        bounce: number;
        tags: string[];
        charged?: boolean;
        sizeMultiplier?: number;
        sourceType?: string;
    }) {
        const bullet = this.bullets.get(
            config.x,
            config.y,
            "bullet"
        ) as Phaser.Physics.Arcade.Image;
        if (!bullet) return null;
        const sizeScale =
            (config.sizeMultiplier ?? 1) *
            this.upgrades.projectileScale *
            OBJECT_SCALE;
        const isHeavy = this.upgrades.neutronCore.active;
        const isRailgun =
            config.charged === true &&
            this.upgrades.activeSynergies.has("railgun");
        bullet.setActive(true);
        bullet.setVisible(true);
        bullet.setScale(sizeScale);
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        const projectileSpeed =
            this.playerStats.projectileSpeed *
            (isHeavy ? this.upgrades.neutronCore.speedMultiplier : 1);
        if (isHeavy) {
            const radius = 12 * sizeScale;
            body.setCircle(radius);
            body.setOffset(
                bullet.displayWidth * 0.5 - radius,
                bullet.displayHeight * 0.5 - radius
            );
        } else {
            body.setSize(8 * sizeScale, 24 * sizeScale, true);
        }
        body.setVelocity(
            config.dir.x * projectileSpeed,
            config.dir.y * projectileSpeed
        );
        bullet.setRotation(config.dir.angle());
        bullet.setData(
            "pierce",
            this.getPierceWithSynergy(config.pierce, config.charged === true)
        );
        bullet.setData("damage", config.damage);
        bullet.setData("bounces", config.bounce);
        bullet.setData("tags", config.tags);
        bullet.setData("charged", config.charged === true);
        bullet.setData("sourceType", config.sourceType ?? "primary");
        bullet.setData("hitCount", 0);
        bullet.setData("lastHitAt", 0);
        bullet.setData("canFork", true);
        bullet.setData("isHeavy", isHeavy);
        bullet.setData(
            "expireAt",
            this.upgrades.quantum.active
                ? this.time.now + this.upgrades.quantum.projectileLifetimeMs
                : null
        );
        bullet.setTint(
            isRailgun
                ? COLOR_OVERLOAD
                : config.charged
                ? COLOR_CHARGE
                : COLOR_ACCENT
        );
        return bullet;
    }

    private buildProjectileTags(isCharged: boolean): string[] {
        const tags = ["projectile"];
        if (isCharged) tags.push("charge");
        return tags;
    }

    private getPierceWithSynergy(basePierce: number, isCharged: boolean) {
        if (isCharged && this.upgrades.activeSynergies.has("railgun"))
            return 999;
        return basePierce;
    }

    private getBerserkBonus() {
        if (this.upgrades.berserk.stacks <= 0) return 0;
        const maxHealth = Math.max(this.playerStats.maxHealth, 1);
        const healthRatio = Phaser.Math.Clamp(
            this.playerStats.health / maxHealth,
            0,
            1
        );
        const missing = 1 - healthRatio;
        return Phaser.Math.Clamp(
            missing * this.upgrades.berserk.maxBonus,
            0,
            this.upgrades.berserk.maxBonus
        );
    }

    private applyInaccuracy(dir: Phaser.Math.Vector2) {
        const maxError = this.upgrades.bulletHell.active
            ? this.upgrades.bulletHell.inaccuracyRad
            : 0;
        if (maxError <= 0) return dir;
        const offset = this.randFloat(-maxError, maxError);
        return dir.clone().rotate(offset);
    }

    private payBloodFuelCost() {
        if (this.upgrades.bloodFuel.stacks <= 0) return true;
        const cost =
            this.playerStats.health * this.upgrades.bloodFuel.fireCostPercent;
        if (cost <= 0) return true;
        this.playerStats.health -= cost;
        this.enforceHealthCap();
        useRunStore
            .getState()
            .actions.setVitals(
                this.playerStats.health,
                this.playerStats.maxHealth
            );
        if (this.playerStats.health <= 0) {
            this.endRun(false);
            return false;
        }
        return true;
    }

    private spawnAfterimageShots(
        dir: Phaser.Math.Vector2,
        pilot: PilotRuntime
    ) {
        if (this.upgrades.afterimage.trailShots <= 0) return;
        if (!this.isPilotActive(pilot)) return;
        const shots = this.upgrades.afterimage.trailShots;
        const spacing = 18;
        const tags = this.buildProjectileTags(false).concat(["afterimage"]);
        for (let i = 1; i <= shots; i++) {
            const offset = dir.clone().scale(-spacing * i);
            const pos = new Phaser.Math.Vector2(
                pilot.sprite.x + offset.x,
                pilot.sprite.y + offset.y
            );
            const pierce = this.playerStats.pierce;
            const bounce = this.playerStats.bounce;
            this.spawnBullet({
                x: pos.x,
                y: pos.y,
                dir,
                damage: this.upgrades.afterimage.shotDamage,
                pierce,
                bounce,
                tags,
                charged: false,
                sourceType: "afterimage",
            });
        }
    }

    private spawnDashSparkExplosion(
        origin: Phaser.Math.Vector2,
        dashDir: Phaser.Math.Vector2
    ) {
        if (
            this.upgrades.dashSpark.shards <= 0 ||
            this.upgrades.dashSpark.damage <= 0
        )
            return;
        const baseDir =
            dashDir.lengthSq() > 0
                ? dashDir.clone().normalize()
                : new Phaser.Math.Vector2(1, 0);
        for (let i = 0; i < this.upgrades.dashSpark.shards; i++) {
            const arcAngle = (i / this.upgrades.dashSpark.shards) * Math.PI * 2;
            const jitter = this.randFloat(-0.15, 0.15);
            const dir = baseDir.clone().rotate(arcAngle + jitter);
            this.spawnBullet({
                x: origin.x,
                y: origin.y,
                dir,
                damage: this.upgrades.dashSpark.damage,
                pierce: 0,
                bounce: 0,
                tags: ["dash-spark"],
                charged: false,
                sourceType: "dash-spark",
            });
        }
        this.spawnBurstVisual(
            origin.x,
            origin.y,
            34 * OBJECT_SCALE,
            COLOR_ACCENT,
            0.8
        );
    }

    private spawnDashTrail(
        origin: Phaser.Math.Vector2,
        dir: Phaser.Math.Vector2
    ) {
        const length = 42 * OBJECT_SCALE;
        const width = 6 * OBJECT_SCALE;
        const angle = dir.angle();
        const rect = this.add
            .rectangle(origin.x, origin.y, length, width, COLOR_ACCENT, 0.35)
            .setRotation(angle)
            .setDepth(0.6);
        this.tweens.add({
            targets: rect,
            alpha: { from: 0.35, to: 0 },
            scaleX: { from: 1, to: 0.6 },
            duration: 180,
            onComplete: () => rect.destroy(),
        });
    }

    private spawnMuzzleFlash(x: number, y: number) {
        const flash = this.add
            .circle(x, y, 10 * OBJECT_SCALE, COLOR_CHARGE, 0.35)
            .setDepth(2);
        this.tweens.add({
            targets: flash,
            scale: { from: 0.6, to: 1.4 },
            alpha: { from: 0.35, to: 0 },
            duration: 140,
            onComplete: () => flash.destroy(),
        });
    }

    private spawnBurstVisual(
        x: number,
        y: number,
        radius: number,
        color: number,
        strokeOpacity = 0.7
    ) {
        const circle = this.add
            .circle(x, y, radius, color, 0.08)
            .setStrokeStyle(2, color, strokeOpacity)
            .setDepth(0.5);
        circle.setData("isBurstVisual", true);
        this.tweens.add({
            targets: circle,
            alpha: { from: 0.8, to: 0 },
            scale: { from: 0.9, to: 1.15 },
            duration: 200,
            onComplete: () => circle.destroy(),
        });
    }

    private playCritFeedback(enemy: Phaser.Physics.Arcade.Image) {
        this.cameras.main.shake(80, 0.0025);
        const flash = this.add
            .circle(enemy.x, enemy.y, 16 * OBJECT_SCALE, COLOR_OVERLOAD, 0.65)
            .setDepth(1.1);
        this.tweens.add({
            targets: flash,
            scale: { from: 0.85, to: 1.25 },
            alpha: { from: 0.65, to: 0 },
            duration: 140,
            onComplete: () => flash.destroy(),
        });
    }

    private updateShieldVisual(pilot?: PilotRuntime) {
        if (!pilot) return;
        const active =
            pilot.shield.hp > 0 && this.time.now <= pilot.shield.activeUntil;
        if (!pilot.shieldRing && active) {
            pilot.shieldRing = this.add
                .arc(
                    pilot.sprite.x,
                    pilot.sprite.y,
                    34 * OBJECT_SCALE,
                    0,
                    360,
                    false,
                    COLOR_ACCENT,
                    0.2
                )
                .setStrokeStyle(3, COLOR_ACCENT, 0.9)
                .setDepth(0.9);
        }
        if (!pilot.shieldRing) return;
        pilot.shieldRing.setVisible(active);
        if (!active) return;
        pilot.shieldRing.setPosition(pilot.sprite.x, pilot.sprite.y);
        const remaining = pilot.shield.activeUntil - this.time.now;
        const alpha = Phaser.Math.Clamp(
            remaining / this.upgrades.shield.durationMs,
            0.3,
            0.8
        );
        pilot.shieldRing.setAlpha(alpha);
        const pulse = 1 + Math.sin(this.time.now / 120) * 0.06;
        pilot.shieldRing.setScale(pulse);
    }

    private handleEnemies() {
        const targetPilot = this.getNearestPilot(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2
        );
        if (!targetPilot) return;
        this.enemies.getChildren().forEach((child) => {
            const enemy = child as Phaser.Physics.Arcade.Image;
            if (!enemy.active || !enemy.visible) return;
            const kind = enemy.getData("kind") as string;
            const speed = enemy.getData("speed") as number;
            const slowUntil = enemy.getData("slowUntil") as number | undefined;
            const slowFactor =
                slowUntil && slowUntil > this.time.now
                    ? (enemy.getData("slowFactor") as number | undefined) ?? 1
                    : 1;
            const pilot = this.getNearestPilot(enemy.x, enemy.y) ?? targetPilot;
            // Reuse scratch vector to avoid per-enemy allocation
            const targetVec = this._scratchVec.set(
                pilot.sprite.x - enemy.x,
                pilot.sprite.y - enemy.y
            );
            const dist = targetVec.length();
            targetVec.normalize();

            // Handle elite behaviors
            const isElite = enemy.getData("elite") as boolean;
            const eliteBehaviors =
                (enemy.getData("eliteBehaviors") as string[]) || [];

            if (kind === "drifter") {
                // Check for burst movement behavior
                if (isElite && eliteBehaviors.includes("burst_movement")) {
                    this.handleBurstMovement(
                        enemy,
                        targetVec,
                        speed,
                        slowFactor
                    );
                } else {
                    enemy.setVelocity(
                        targetVec.x * speed * slowFactor,
                        targetVec.y * speed * slowFactor
                    );
                }
            } else if (kind === "watcher") {
                if (dist > 260) {
                    enemy.setVelocity(
                        targetVec.x * speed * slowFactor,
                        targetVec.y * speed * slowFactor
                    );
                } else if (dist < 180) {
                    enemy.setVelocity(
                        -targetVec.x * speed * slowFactor,
                        -targetVec.y * speed * slowFactor
                    );
                } else {
                    enemy.setVelocity(0, 0);
                }

                // Handle rapid fire behavior for elite watchers
                // Reuse scratch vector 2 for pilot position
                this._scratchVec2.set(pilot.sprite.x, pilot.sprite.y);
                if (isElite && eliteBehaviors.includes("rapid_fire")) {
                    this.tryEliteRapidFire(enemy, this._scratchVec2);
                } else {
                    this.tryEnemyShot(enemy, this._scratchVec2);
                }
            } else if (kind === "mass") {
                // Check for burst movement behavior
                if (isElite && eliteBehaviors.includes("burst_movement")) {
                    this.handleBurstMovement(
                        enemy,
                        targetVec,
                        speed * 0.7,
                        slowFactor
                    );
                } else {
                    enemy.setVelocity(
                        targetVec.x * speed * 0.7 * slowFactor,
                        targetVec.y * speed * 0.7 * slowFactor
                    );
                }
                // Reuse scratch vector 2 for pilot position
                this._scratchVec2.set(pilot.sprite.x, pilot.sprite.y);
                this.tryEnemyShot(enemy, this._scratchVec2, true);
            } else if (kind === "phantom") {
                // Phantom: teleports around, moves slowly between teleports
                this.handlePhantomMovement(
                    enemy,
                    pilot,
                    speed,
                    slowFactor,
                    isElite
                );
            } else if (kind === "orbiter") {
                // Orbiter: circles around the player
                this.handleOrbiterMovement(
                    enemy,
                    pilot,
                    speed,
                    slowFactor,
                    isElite,
                    eliteBehaviors
                );
            } else if (kind === "splitter") {
                // Splitter: moves toward player, splits on death
                if (isElite && eliteBehaviors.includes("burst_movement")) {
                    this.handleBurstMovement(
                        enemy,
                        targetVec,
                        speed,
                        slowFactor
                    );
                } else {
                    enemy.setVelocity(
                        targetVec.x * speed * slowFactor,
                        targetVec.y * speed * slowFactor
                    );
                }
            } else if (kind === "boss") {
                this.updateBossMovement(enemy);
            }

            // Update elite glow position to follow enemy
            const eliteGlow = enemy.getData("eliteGlow") as
                | Phaser.GameObjects.Arc
                | undefined;
            if (eliteGlow) {
                eliteGlow.setPosition(enemy.x, enemy.y);
            }
        });
    }

    private handlePhantomMovement(
        enemy: Phaser.Physics.Arcade.Image,
        pilot: PilotRuntime,
        speed: number,
        slowFactor: number,
        _isElite: boolean
    ) {
        const nextTeleport = enemy.getData("nextTeleport") as number;
        const teleportCooldown = enemy.getData("teleportCooldown") as number;

        if (this.time.now >= nextTeleport) {
            // Teleport to a new position near the player
            const angle = this.randFloat(0, Math.PI * 2);
            const distance = this.randBetween(100, 200);
            let newX = pilot.sprite.x + Math.cos(angle) * distance;
            let newY = pilot.sprite.y + Math.sin(angle) * distance;

            // Clamp to screen bounds
            newX = Phaser.Math.Clamp(
                newX,
                this.screenBounds.left + 40,
                this.screenBounds.right - 40
            );
            newY = Phaser.Math.Clamp(
                newY,
                this.screenBounds.top + 40,
                this.screenBounds.bottom - 40
            );

            // Visual effect for teleport
            this.spawnBurstVisual(enemy.x, enemy.y, 30, 0x9b6dff, 0.6);
            enemy.setPosition(newX, newY);
            this.spawnBurstVisual(newX, newY, 30, 0x9b6dff, 0.6);

            // Set next teleport time
            const cooldownVariance = this.randBetween(-300, 300);
            enemy.setData(
                "nextTeleport",
                this.time.now + teleportCooldown + cooldownVariance
            );

            // Brief pause after teleport
            enemy.setVelocity(0, 0);
        } else {
            // Slow drift toward player between teleports
            const targetVec = this._scratchVec
                .set(pilot.sprite.x - enemy.x, pilot.sprite.y - enemy.y)
                .normalize();
            const driftSpeed = speed * 0.4 * slowFactor;
            enemy.setVelocity(
                targetVec.x * driftSpeed,
                targetVec.y * driftSpeed
            );
        }
    }

    private handleOrbiterMovement(
        enemy: Phaser.Physics.Arcade.Image,
        pilot: PilotRuntime,
        speed: number,
        slowFactor: number,
        isElite: boolean,
        eliteBehaviors: string[]
    ) {
        let orbitAngle = enemy.getData("orbitAngle") as number;
        const orbitRadius = enemy.getData("orbitRadius") as number;
        const orbitDirection = enemy.getData("orbitDirection") as number;

        // Update orbit angle based on speed
        const angularSpeed = speed * 0.008 * slowFactor;
        orbitAngle += angularSpeed * orbitDirection;
        enemy.setData("orbitAngle", orbitAngle);

        // Calculate target position on orbit
        const targetX = pilot.sprite.x + Math.cos(orbitAngle) * orbitRadius;
        const targetY = pilot.sprite.y + Math.sin(orbitAngle) * orbitRadius;

        // Move toward orbit position
        const dx = targetX - enemy.x;
        const dy = targetY - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
            const moveSpeed = Math.min(speed * slowFactor, dist * 3);
            enemy.setVelocity((dx / dist) * moveSpeed, (dy / dist) * moveSpeed);
        } else {
            enemy.setVelocity(0, 0);
        }

        // Orbiters can shoot while circling
        this._scratchVec2.set(pilot.sprite.x, pilot.sprite.y);
        if (isElite && eliteBehaviors.includes("rapid_fire")) {
            this.tryEliteRapidFire(enemy, this._scratchVec2);
        } else {
            this.tryEnemyShot(enemy, this._scratchVec2);
        }
    }

    private handleBurstMovement(
        enemy: Phaser.Physics.Arcade.Image,
        targetVec: Phaser.Math.Vector2,
        speed: number,
        slowFactor: number
    ) {
        // Elite burst movement: quick dashes toward player with pauses
        const burstCooldown = (enemy.getData("burstCooldown") as number) || 0;
        const burstActive = (enemy.getData("burstActive") as boolean) || false;
        const burstEndTime = (enemy.getData("burstEndTime") as number) || 0;

        if (this.time.now > burstCooldown && !burstActive) {
            // Start burst
            enemy.setData("burstActive", true);
            enemy.setData("burstEndTime", this.time.now + 300); // 300ms burst
            enemy.setData("burstCooldown", this.time.now + 1500); // 1.5s cooldown

            // Enhanced burst speed for elites
            enemy.setVelocity(
                targetVec.x * speed * 2.5 * slowFactor,
                targetVec.y * speed * 2.5 * slowFactor
            );
        } else if (burstActive && this.time.now > burstEndTime) {
            // End burst, pause movement
            enemy.setData("burstActive", false);
            enemy.setVelocity(0, 0);
        } else if (!burstActive) {
            // Normal slow movement between bursts
            enemy.setVelocity(
                targetVec.x * speed * 0.3 * slowFactor,
                targetVec.y * speed * 0.3 * slowFactor
            );
        }
    }

    private tryEliteRapidFire(
        enemy: Phaser.Physics.Arcade.Image,
        target: Phaser.Math.Vector2
    ) {
        // Elite rapid fire: faster shooting rate
        const fireCooldown = (enemy.getData("fireCooldown") as number) * 0.5; // 50% faster
        const nextFire = enemy.getData("nextFire") as number;
        if (this.time.now < nextFire) return;

        enemy.setData("nextFire", this.time.now + fireCooldown * 1000);

        const dir = new Phaser.Math.Vector2(
            target.x - enemy.x,
            target.y - enemy.y
        );
        dir.normalize();

        const projSpeed = enemy.getData("projectileSpeed") as number;
        this.spawnEnemyBullet(enemy.x, enemy.y, dir, projSpeed);
    }

    private handleDeathExplosion(enemy: Phaser.Physics.Arcade.Image) {
        // Elite death explosion behavior
        const x = enemy.x;
        const y = enemy.y;
        const explosionRadius = 80;
        const explosionDamage = (enemy.getData("damage") as number) || 25;

        // Create visual explosion effect
        this.spawnBurstVisual(x, y, explosionRadius, 0xff4444, 1.0);

        // Apply damage to nearby players
        const pilots = this.getActivePilots();
        pilots.forEach((pilot) => {
            const dx = pilot.sprite.x - x;
            const dy = pilot.sprite.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= explosionRadius) {
                this.handlePlayerDamage(
                    pilot,
                    enemy,
                    explosionDamage * 0.5,
                    false
                );
            }
        });

        // Screen shake for dramatic effect
        this.cameras.main.shake(300, 0.008);

        // Play elite explosion sound (Requirement 6.2)
        soundManager.playSfx("eliteExplosion");
    }

    private updateBossMovement(boss: Phaser.Physics.Arcade.Image) {
        const body = boss.body as Phaser.Physics.Arcade.Body | null;
        if (!body) return;
        const speed = (boss.getData("speed") as number) ?? 0;
        const centerX = GAME_WIDTH / 2;
        const centerY = this.screenBounds.top + 150;
        const t = this.time.now;
        const orbitX = 140;
        const orbitY = 90;
        let targetX = centerX + Math.cos(t / 1400) * orbitX;
        let targetY = centerY + Math.sin(t / 1200) * orbitY;
        const targetPilot = this.getNearestPilot(boss.x, boss.y);
        if (targetPilot) {
            targetX = Phaser.Math.Linear(targetX, targetPilot.sprite.x, 0.12);
            targetY = Phaser.Math.Linear(
                targetY,
                targetPilot.sprite.y - 80,
                0.08
            );
        }
        const dir = new Phaser.Math.Vector2(targetX - boss.x, targetY - boss.y);
        const dist = dir.length();
        if (dist > 2) {
            dir.scale(1 / dist);
            const moveSpeed = speed * 0.65;
            body.setVelocity(dir.x * moveSpeed, dir.y * moveSpeed);
        } else {
            body.setVelocity(0, 0);
        }
    }

    private handleHeatseekingProjectiles(dt: number) {
        if (this.upgrades.homing.stacks <= 0) return;
        const maxTurn = this.upgrades.homing.turnRate * dt;
        if (maxTurn <= 0 || this.upgrades.homing.range <= 0) return;
        const rangeSq = this.upgrades.homing.range * this.upgrades.homing.range;
        const activeEnemies: Phaser.Physics.Arcade.Image[] = [];
        this.enemies.getChildren().forEach((enemyChild) => {
            const enemy = enemyChild as Phaser.Physics.Arcade.Image;
            if (enemy.active && enemy.visible) {
                activeEnemies.push(enemy);
            }
        });
        if (activeEnemies.length === 0) return;

        this.bullets.getChildren().forEach((child) => {
            const projectile = child as Phaser.Physics.Arcade.Image;
            if (!projectile.active || !projectile.visible) return;
            const body = projectile.body as Phaser.Physics.Arcade.Body;
            const speed = body.velocity.length();
            if (speed < 10) return;

            let nearest: Phaser.Physics.Arcade.Image | null = null;
            let nearestDistSq = rangeSq;
            activeEnemies.forEach((enemy) => {
                const dx = enemy.x - projectile.x;
                const dy = enemy.y - projectile.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < nearestDistSq) {
                    nearestDistSq = distSq;
                    nearest = enemy;
                }
            });

            if (!nearest) return;

            const target = nearest as Phaser.Physics.Arcade.Image;
            const desiredAngle = Phaser.Math.Angle.Between(
                projectile.x,
                projectile.y,
                target.x,
                target.y
            );
            const currentAngle = Math.atan2(body.velocity.y, body.velocity.x);
            const newAngle = Phaser.Math.Angle.RotateTo(
                currentAngle,
                desiredAngle,
                maxTurn
            );
            const vx = Math.cos(newAngle) * speed;
            const vy = Math.sin(newAngle) * speed;
            body.setVelocity(vx, vy);
            projectile.setRotation(newAngle);
        });
    }

    private handleEnemyCollide(
        enemyA: Phaser.Physics.Arcade.Image,
        enemyB: Phaser.Physics.Arcade.Image
    ) {
        const bodyA = enemyA.body as Phaser.Physics.Arcade.Body | null;
        const bodyB = enemyB.body as Phaser.Physics.Arcade.Body | null;
        if (!bodyA || !bodyB) return;

        // Skip nudging the boss so it stays anchored.
        if (
            enemyA.getData("kind") === "boss" ||
            enemyB.getData("kind") === "boss"
        ) {
            return;
        }

        // Apply a gentle impulse so clumps loosen rather than sticking together.
        const dx = bodyA.x - bodyB.x;
        const dy = bodyA.y - bodyB.y;
        const distSq = dx * dx + dy * dy;
        if (distSq === 0) return;
        const dist = Math.sqrt(distSq);
        const strength = 40;
        const nx = dx / dist;
        const ny = dy / dist;
        bodyA.velocity.x += nx * strength;
        bodyA.velocity.y += ny * strength;
        bodyB.velocity.x -= nx * strength;
        bodyB.velocity.y -= ny * strength;
    }

    private handleXpAttraction(dt: number) {
        const radius = XP_ATTRACT_RADIUS * this.upgrades.magnet.radiusMult;
        const maxDistSq = radius * radius;
        const lerp = Phaser.Math.Clamp(dt * XP_ATTRACT_LERP_RATE, 0, 1);
        const pilots = this.getActivePilots();
        if (pilots.length === 0) return;

        this.xpPickups.getChildren().forEach((child) => {
            const pickup = child as Phaser.Physics.Arcade.Image;
            if (!pickup.active || !pickup.visible) return;

            const nearest = this.getNearestPilot(pickup.x, pickup.y);
            if (!nearest) return;
            const dx = nearest.sprite.x - pickup.x;
            const dy = nearest.sprite.y - pickup.y;
            const distSq = dx * dx + dy * dy;
            const body = pickup.body as Phaser.Physics.Arcade.Body;
            const alreadyMagnetized = pickup.getData("magnetized") === true;
            if (!alreadyMagnetized && distSq > maxDistSq) return;
            if (distSq <= maxDistSq) {
                pickup.setData("magnetized", true);
            }

            const dist = Math.max(Math.sqrt(distSq), 1);
            const dirX = dx / dist;
            const dirY = dy / dist;
            const proximity = Phaser.Math.Clamp(
                1 - Math.min(dist, radius) / radius,
                0,
                1
            );
            const targetSpeed = Phaser.Math.Linear(
                XP_ATTRACT_MIN_SPEED * this.upgrades.magnet.speedMult,
                XP_ATTRACT_MAX_SPEED * this.upgrades.magnet.speedMult,
                proximity
            );
            const targetVx = dirX * targetSpeed;
            const targetVy = dirY * targetSpeed;

            body.velocity.x = Phaser.Math.Linear(
                body.velocity.x,
                targetVx,
                lerp
            );
            body.velocity.y = Phaser.Math.Linear(
                body.velocity.y,
                targetVy,
                lerp
            );
        });
    }

    private tryEnemyShot(
        enemy: Phaser.Physics.Arcade.Image,
        target: Phaser.Math.Vector2,
        heavy?: boolean
    ) {
        const nextFire = enemy.getData("nextFire") as number;
        const fireCooldown = enemy.getData("fireCooldown") as number;
        if (!fireCooldown || this.time.now < nextFire) return;

        const dir = new Phaser.Math.Vector2(
            target.x - enemy.x,
            target.y - enemy.y
        ).normalize();
        const speed = enemy.getData("projectileSpeed") as number;
        this.spawnEnemyBullet(enemy.x, enemy.y, dir, speed, heavy);
        enemy.setData("nextFire", this.time.now + fireCooldown * 1000);
    }

    private spawnEnemyBullet(
        x: number,
        y: number,
        dir: Phaser.Math.Vector2,
        speed: number,
        heavy = false
    ) {
        const bullet = this.enemyBullets.get(
            x,
            y,
            "enemy-bullet"
        ) as Phaser.Physics.Arcade.Image;
        if (!bullet) return;
        bullet.setActive(true);
        bullet.setVisible(true);
        const scale = OBJECT_SCALE * (heavy ? 1.4 : 1);
        bullet.setScale(scale);
        (bullet.body as Phaser.Physics.Arcade.Body).setSize(
            8 * scale,
            20 * scale,
            true
        );
        bullet.setVelocity(dir.x * speed, dir.y * speed);
        bullet.setData("damage", heavy ? 2 : 1);
    }

    private handleProjectileIntercept(
        playerBullet: Phaser.Physics.Arcade.Image,
        enemyBullet: Phaser.Physics.Arcade.Image
    ) {
        if (playerBullet.getData("isHeavy") !== true) return;
        enemyBullet.destroy();
        const pierceLeft = (playerBullet.getData("pierce") as number) ?? 0;
        if (pierceLeft > 0) {
            playerBullet.setData("pierce", pierceLeft - 1);
        } else {
            playerBullet.destroy();
        }
        this.spawnBurstVisual(
            playerBullet.x,
            playerBullet.y,
            18 * OBJECT_SCALE,
            COLOR_OVERLOAD,
            0.6
        );
    }

    private handleBulletHitEnemy = (
        bullet: Phaser.GameObjects.GameObject,
        target: Phaser.GameObjects.GameObject
    ) => {
        const projectile = bullet as Phaser.Physics.Arcade.Image;
        const enemy = target as Phaser.Physics.Arcade.Image;
        const damage = projectile.getData("damage") as number;
        const pierceLeft = projectile.getData("pierce") as number;
        this.applyDamageToEnemy(enemy, damage, projectile);
        this.handleForks(projectile, enemy);
        this.handleExplosiveImpact(projectile, enemy);
        this.applySingularityPull(enemy);

        if (pierceLeft > 0) {
            projectile.setData("pierce", pierceLeft - 1);
        } else {
            projectile.destroy();
        }
    };

    private applyDamageToEnemy(
        enemy: Phaser.Physics.Arcade.Image,
        damage: number,
        source?: Phaser.Physics.Arcade.Image,
        opts?: {
            tags?: string[];
            slowPotencyMultiplier?: number;
            isPulse?: boolean;
        }
    ) {
        if (!enemy.active) return;
        let resolvedDamage = damage;
        const now = this.time.now;
        const tags =
            opts?.tags ?? (source?.getData("tags") as string[] | undefined);
        const charged = source?.getData("charged") === true;
        const sourceType = source?.getData("sourceType") as string | undefined;
        let wasCrit = false;
        if (!opts?.isPulse) {
            const critChance = this.playerStats.critChance;
            if (this.rng.next() < critChance) {
                wasCrit = true;
                resolvedDamage *= this.playerStats.critMultiplier;
            }
        }
        resolvedDamage *= this.enemyDamageTakenMultiplier;

        enemy.setData("lastHitTags", tags);
        enemy.setData("lastHitCharged", charged);
        enemy.setData("lastHitAt", now);
        enemy.setData("lastHitSourceType", sourceType ?? "");
        enemy.setData("lastHitCrit", wasCrit);

        const current = enemy.getData("health") as number;
        const remaining = current - resolvedDamage;
        enemy.setData("health", remaining);
        const tintColor = wasCrit ? 0xfff0c2 : 0xffffff;
        enemy.setTintFill(tintColor);
        this.time.delayedCall(50, () => {
            if (enemy.active) enemy.clearTint();
        });
        if (wasCrit) {
            this.playCritFeedback(enemy);
        }

        if (remaining <= 0) {
            this.handleEnemyDeath(enemy, tags);
        } else if ((enemy.getData("kind") as string) === "boss") {
            this.bossManager.handleBossPhaseChange();
        }

        // edge extension removed with simplified charge; no-op
    }

    private handleForks(
        projectile: Phaser.Physics.Arcade.Image,
        enemy: Phaser.Physics.Arcade.Image
    ) {
        if (!this.upgrades.split.enabled) return;
        if (!projectile.getData("canFork")) return;
        const sourceType = projectile.getData("sourceType") as string;
        if (sourceType === "fork") return;

        projectile.setData("canFork", false);
        const forks = this.upgrades.split.forks;
        const spreadDeg = this.upgrades.split.spreadDegrees;
        const damageMultiplier = this.upgrades.split.damageMultiplier;
        const spreadRad = Phaser.Math.DegToRad(spreadDeg);
        const baseDir = new Phaser.Math.Vector2(
            enemy.x - projectile.x,
            enemy.y - projectile.y
        ).normalize();
        const totalSpread = Math.max(spreadRad, 0.01);
        const step = forks > 1 ? totalSpread / (forks - 1) : 0;
        const start = -totalSpread / 2;

        for (let i = 0; i < forks; i++) {
            const dir = baseDir.clone().rotate(start + step * i);
            const tags =
                (projectile.getData("tags") as string[] | undefined) ?? [];
            this.spawnBullet({
                x: projectile.x,
                y: projectile.y,
                dir,
                damage: projectile.getData("damage") * damageMultiplier,
                pierce: projectile.getData("pierce"),
                bounce: projectile.getData("bounces") ?? 0,
                tags,
                charged: false,
                sourceType: "fork",
            });
        }
    }

    private applyAoeDamage(
        x: number,
        y: number,
        radius: number,
        damage: number,
        sourceTags: string[] = []
    ) {
        this.enemies.getChildren().forEach((child) => {
            const enemy = child as Phaser.Physics.Arcade.Image;
            if (!enemy.active) return;
            const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
            if (dist <= radius + 2) {
                this.applyDamageToEnemy(enemy, damage, undefined, {
                    tags: sourceTags.concat(["aoe"]),
                });
            }
        });
    }

    private triggerChainReaction(
        x: number,
        y: number,
        kind: string,
        maxHealth?: number,
        source?: Phaser.Physics.Arcade.Image
    ) {
        if (this.upgrades.chainReaction.stacks <= 0) return;
        if (kind === "boss") return;
        const damageBase =
            (maxHealth ?? 0) * this.upgrades.chainReaction.damagePercent;
        if (damageBase <= 0) return;
        const radius =
            this.upgrades.chainReaction.radius *
            (this.upgrades.activeSynergies.has("black-hole-sun") ? 1.25 : 1);
        this.enemies.getChildren().forEach((child) => {
            const enemy = child as Phaser.Physics.Arcade.Image;
            if (!enemy.active || enemy === source) return;
            const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
            if (dist <= radius + 2) {
                this.applyDamageToEnemy(enemy, damageBase, undefined, {
                    tags: ["volatile", "aoe"],
                });
            }
        });
        this.spawnBurstVisual(x, y, radius * 0.7, COLOR_OVERLOAD, 0.7);
    }

    private applyBloodFuelHeal() {
        if (this.upgrades.bloodFuel.stacks <= 0) return;
        const healAmount =
            this.playerStats.maxHealth * this.upgrades.bloodFuel.healPercent;
        if (healAmount <= 0) return;
        this.healPlayer(healAmount);
    }

    private applySingularityPull(target: Phaser.Physics.Arcade.Image) {
        if (!this.upgrades.singularity.active) return;
        const center = new Phaser.Math.Vector2(target.x, target.y);
        const radius =
            this.upgrades.singularity.radius *
            (this.upgrades.activeSynergies.has("black-hole-sun") ? 1.2 : 1);
        const strength = this.upgrades.singularity.pullStrength;
        this.enemies.getChildren().forEach((child) => {
            const enemy = child as Phaser.Physics.Arcade.Image;
            if (!enemy.active || enemy === target) return;
            const dx = center.x - enemy.x;
            const dy = center.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= 6 || dist > radius) return;
            const pullScale = 1 - dist / radius;
            const body = enemy.body as Phaser.Physics.Arcade.Body | null;
            if (!body) return;
            const dirX = dx / dist;
            const dirY = dy / dist;
            body.velocity.x += dirX * strength * pullScale;
            body.velocity.y += dirY * strength * pullScale;
        });
        this.spawnBurstVisual(
            center.x,
            center.y,
            radius * 0.5,
            COLOR_CHARGE,
            0.45
        );
    }

    private tryChainArc(origin: Phaser.Physics.Arcade.Image) {
        if (this.upgrades.chainArc.stacks <= 0) return;
        const now = this.time.now;
        if (
            now <
            this.upgrades.chainArc.lastAt + this.upgrades.chainArc.cooldownMs
        )
            return;
        const range = this.upgrades.chainArc.range;
        let nearest: Phaser.Physics.Arcade.Image | null = null;
        let nearestDist = Number.MAX_VALUE;
        this.enemies.getChildren().forEach((child) => {
            const enemy = child as Phaser.Physics.Arcade.Image;
            if (!enemy.active) return;
            if (enemy === origin) return;
            const dist = Phaser.Math.Distance.Between(
                origin.x,
                origin.y,
                enemy.x,
                enemy.y
            );
            if (dist < range && dist < nearestDist) {
                nearest = enemy;
                nearestDist = dist;
            }
        });
        if (!nearest) return;
        const target = nearest as Phaser.Physics.Arcade.Image;
        this.upgrades.chainArc.lastAt = now;
        const damage =
            this.playerStats.damage * this.upgrades.chainArc.damagePercent;
        this.applyDamageToEnemy(target, damage, undefined, { tags: ["arc"] });
        const line = this.add
            .line(
                0,
                0,
                origin.x,
                origin.y,
                target.x,
                target.y,
                COLOR_PULSE,
                0.7
            )
            .setLineWidth(2);
        this.tweens.add({
            targets: line,
            alpha: { from: 0.7, to: 0 },
            duration: 150,
            onComplete: () => line.destroy(),
        });
    }

    private handleProjectileBounds() {
        const margin = 32;
        const left = this.screenBounds.left - margin;
        const right = this.screenBounds.right + margin;
        const top = this.screenBounds.top - margin;
        const bottom = this.screenBounds.bottom + margin;

        this.bullets.getChildren().forEach((child) => {
            const proj = child as Phaser.Physics.Arcade.Image;
            if (!proj.active || !proj.visible) return;
            const body = proj.body as Phaser.Physics.Arcade.Body;
            const expireAt = proj.getData("expireAt") as number | null;
            if (expireAt && this.time.now > expireAt) {
                proj.destroy();
                return;
            }
            if (this.upgrades.quantum.active) {
                const wrap = this.upgrades.quantum.wrapMargin;
                if (proj.x < left) proj.x = right - wrap;
                else if (proj.x > right) proj.x = left + wrap;
                if (proj.y < top) proj.y = bottom - wrap;
                else if (proj.y > bottom) proj.y = top + wrap;
                return;
            }
            let bounces = (proj.getData("bounces") as number) ?? 0;
            let bounced = false;
            let outOfBounds = false;

            if (proj.x < left) {
                proj.x = left;
                outOfBounds = true;
                if (bounces > 0) {
                    body.velocity.x = Math.abs(body.velocity.x);
                    bounces -= 1;
                    bounced = true;
                }
            } else if (proj.x > right) {
                proj.x = right;
                outOfBounds = true;
                if (bounces > 0) {
                    body.velocity.x = -Math.abs(body.velocity.x);
                    bounces -= 1;
                    bounced = true;
                }
            }

            if (proj.y < top) {
                proj.y = top;
                outOfBounds = true;
                if (bounces > 0) {
                    body.velocity.y = Math.abs(body.velocity.y);
                    bounces -= 1;
                    bounced = true;
                }
            } else if (proj.y > bottom) {
                proj.y = bottom;
                outOfBounds = true;
                if (bounces > 0) {
                    body.velocity.y = -Math.abs(body.velocity.y);
                    bounces -= 1;
                    bounced = true;
                }
            }

            if (bounced) {
                proj.setData("bounces", bounces);
            } else if (outOfBounds) {
                proj.destroy();
            }
        });

        this.enemyBullets.getChildren().forEach((child) => {
            const proj = child as Phaser.Physics.Arcade.Image;
            if (!proj.active || !proj.visible) return;
            if (
                proj.x < left ||
                proj.x > right ||
                proj.y < top ||
                proj.y > bottom
            ) {
                proj.destroy();
            }
        });
    }

    private handleEnemyDeath(
        enemy: Phaser.Physics.Arcade.Image,
        killerTags?: string[]
    ) {
        const kind = enemy.getData("kind") as string;
        const x = enemy.x;
        const y = enemy.y;
        const maxHealth =
            (enemy.getData("maxHealth") as number | undefined) ??
            (enemy.getData("health") as number);
        const wasCritKill = enemy.getData("lastHitCrit") === true;
        this.spawnShrapnel(enemy);
        if (wasCritKill) {
            this.spawnCritShrapnel(enemy);
        }

        // Handle elite death explosion behavior
        const isElite = enemy.getData("elite") as boolean;
        const eliteBehaviors =
            (enemy.getData("eliteBehaviors") as string[]) || [];
        if (isElite && eliteBehaviors.includes("death_explosion")) {
            this.handleDeathExplosion(enemy);
        }

        // Handle splitter death - spawn mini splitters
        if (kind === "splitter") {
            const splitCount = enemy.getData("splitCount") as number;
            if (splitCount > 0) {
                this.handleSplitterDeath(x, y, splitCount, isElite);
            }
        }

        const fromVolatile = killerTags?.includes("volatile");
        if (!fromVolatile) {
            this.triggerChainReaction(x, y, kind, maxHealth, enemy);
        }

        // Cleanup elite glow effects before destroying enemy
        const eliteGlow = enemy.getData("eliteGlow") as
            | Phaser.GameObjects.Arc
            | undefined;
        if (eliteGlow) {
            this.tweens.killTweensOf(eliteGlow);
            eliteGlow.destroy();
        }

        enemy.destroy();
        useRunStore.getState().actions.recordKill();
        this.dropXp(x, y, kind);
        this.applyBloodFuelHeal();
        soundManager.playSfx("enemyDown");
        this.tryChainArc(enemy);
        this.tryKineticHeal();
        if (kind === "boss") {
            this.bossCleared = true;
            this.bossManager.reset();

            // Trigger card reward for defeating boss
            useMetaStore.getState().actions.triggerCardReward();

            if (!this.infiniteMode) {
                this.endRun(true);
            }
        }
    }

    private handleSplitterDeath(
        x: number,
        y: number,
        splitCount: number,
        isElite: boolean
    ) {
        // Visual effect for split
        this.spawnBurstVisual(x, y, 40, 0xff9944, 0.7);

        // Spawn mini splitters in a spread pattern
        const angleStep = (Math.PI * 2) / splitCount;
        for (let i = 0; i < splitCount; i++) {
            const angle = angleStep * i + this.randFloat(-0.3, 0.3);
            const distance = 30;
            const spawnX = x + Math.cos(angle) * distance;
            const spawnY = y + Math.sin(angle) * distance;

            // Spawn a smaller splitter that won't split further
            this.spawnMiniSplitter(spawnX, spawnY, isElite);
        }
    }

    private spawnMiniSplitter(x: number, y: number, elite: boolean) {
        const textureKey = elite ? "elite-splitter" : "splitter";
        const enemy = this.enemies.get(
            0,
            0,
            textureKey
        ) as Phaser.Physics.Arcade.Image;
        if (!enemy) return;

        const miniScale = OBJECT_SCALE * 0.6;
        enemy.setActive(true);
        enemy.setVisible(true);
        enemy.setScale(miniScale);
        enemy.setPosition(x, y);

        // Mini splitters have reduced stats
        const stats = getEnemyDefinition("splitter", elite);
        const enemyHealthMult = this.affix?.enemyHealthMultiplier ?? 1;
        const enemySpeedMult = this.affix?.enemySpeedMultiplier ?? 1;
        const enemyDamageMult = this.affix?.enemyDamageMultiplier ?? 1;

        const maxHealth =
            stats.health * 0.4 * enemyHealthMult * this.enemyHealthScale;
        enemy.setData("kind", "splitter");
        enemy.setData("health", maxHealth);
        enemy.setData("maxHealth", maxHealth);
        enemy.setData(
            "speed",
            stats.speed * 1.3 * this.difficulty * enemySpeedMult
        ); // Faster
        enemy.setData("damage", stats.damage * 0.5 * enemyDamageMult);
        enemy.setData("elite", elite);
        enemy.setData("eliteBehaviors", []);
        enemy.setData("splitCount", 0); // Mini splitters don't split

        const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
        enemyBody.setSize(enemy.displayWidth, enemy.displayHeight, true);
        enemyBody.setBounce(0.4, 0.4);
        enemyBody.enable = true;

        if (elite) {
            enemy.setTint(0xff6b47);
        } else {
            enemy.clearTint();
        }

        // Give initial velocity away from spawn point
        const angle = this.randFloat(0, Math.PI * 2);
        const speed = 150;
        enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    }

    private dropXp(x: number, y: number, kind: string) {
        const pickup = this.xpPickups.get(
            x,
            y,
            "xp"
        ) as Phaser.Physics.Arcade.Image;
        if (!pickup) return;
        pickup.setActive(true);
        pickup.setVisible(true);
        pickup.setScale(OBJECT_SCALE);
        // XP values: mass=6, watcher/orbiter=4, splitter=5, phantom=4, drifter=3
        const xpValues: Record<string, number> = {
            mass: 6,
            watcher: 4,
            orbiter: 4,
            splitter: 5,
            phantom: 4,
            drifter: 3,
        };
        pickup.setData("value", xpValues[kind] ?? 3);
        pickup.setVelocity(
            this.randBetween(-40, 40),
            this.randBetween(-40, 40)
        );
        const body = pickup.body as Phaser.Physics.Arcade.Body;
        const radius = 18 * OBJECT_SCALE;
        body.setCircle(radius);
        body.setOffset(
            pickup.displayWidth * 0.5 - radius,
            pickup.displayHeight * 0.5 - radius
        );
    }

    private collectXp(pickup: Phaser.Physics.Arcade.Image) {
        const baseValue = pickup.getData("value") as number;
        const xpMult = this.affix?.xpMultiplier ?? 1;
        const value = Math.round(baseValue * xpMult);
        pickup.destroy();
        soundManager.playSfx("xpPickup");
        this.tryShieldPickup();
        this.xp += value;
        while (this.xp >= this.nextXpThreshold) {
            this.xp -= this.nextXpThreshold;
            this.levelUp();
        }
        const actions = useRunStore.getState().actions;
        actions.setXp(this.level, this.xp, this.nextXpThreshold);
    }

    private tryShieldPickup() {
        if (this.upgrades.shield.stacks <= 0) return;
        const now = this.time.now;
        if (now < this.upgrades.shield.nextReadyAt) return;
        this.upgrades.shield.nextReadyAt =
            now + this.upgrades.shield.cooldownMs;
        const activate = (pilot?: PilotRuntime) => {
            if (!pilot || !this.isPilotActive(pilot)) return;
            pilot.shield.activeUntil = now + this.upgrades.shield.durationMs;
            pilot.shield.hp = this.upgrades.shield.shieldHp;
            pilot.shield.nextReadyAt = this.upgrades.shield.nextReadyAt;
            if (!pilot.shieldRing) {
                pilot.shieldRing = this.add
                    .circle(
                        pilot.sprite.x,
                        pilot.sprite.y,
                        26 * OBJECT_SCALE,
                        COLOR_PULSE,
                        0.06
                    )
                    .setStrokeStyle(3, COLOR_PULSE, 0.8)
                    .setDepth(1.5);
            }
            pilot.shieldRing.setVisible(true);
            pilot.shieldRing.setAlpha(0.8);
            pilot.shieldRing.setPosition(pilot.sprite.x, pilot.sprite.y);
            this.spawnBurstVisual(
                pilot.sprite.x,
                pilot.sprite.y,
                30 * OBJECT_SCALE,
                COLOR_PULSE,
                0.9
            );
        };
        activate(this.playerState);
        if (this.runMode === "twin" || this.runMode === "online") {
            activate(this.playerTwoState);
        }
    }

    private tryKineticHeal() {
        if (this.upgrades.kinetic.stacks <= 0) return;
        const now = this.time.now;
        if (now < this.upgrades.kinetic.nextReadyAt) return;
        this.upgrades.kinetic.nextReadyAt =
            now + this.upgrades.kinetic.cooldownMs;
        this.healPlayer(this.upgrades.kinetic.healAmount);
    }

    private spawnShrapnel(enemy: Phaser.Physics.Arcade.Image) {
        if (this.upgrades.shrapnel.stacks <= 0) return;
        const shards = this.upgrades.shrapnel.shards;
        const damage = this.upgrades.shrapnel.damage;
        if (shards <= 0 || damage <= 0) return;
        const baseDir = new Phaser.Math.Vector2(1, 0);
        for (let i = 0; i < shards; i++) {
            const angle = this.randFloat(-Math.PI / 3, Math.PI / 3);
            const dir = baseDir.clone().rotate(angle);
            this.spawnBullet({
                x: enemy.x,
                y: enemy.y,
                dir,
                damage,
                pierce: 0,
                bounce: 0,
                tags: ["shrapnel"],
                charged: false,
                sourceType: "shrapnel",
            });
        }
    }

    private spawnCritShrapnel(enemy: Phaser.Physics.Arcade.Image) {
        const shards = 3;
        const damage = Math.max(1, this.playerStats.damage * 0.35);
        const speedScalar = 0.65;
        for (let i = 0; i < shards; i++) {
            const angle = this.randFloat(0, Math.PI * 2);
            const dir = new Phaser.Math.Vector2(1, 0)
                .rotate(angle)
                .scale(speedScalar);
            this.spawnBullet({
                x: enemy.x,
                y: enemy.y,
                dir,
                damage,
                pierce: 0,
                bounce: 0,
                tags: ["crit-shrapnel"],
                charged: false,
                sourceType: "crit-shrapnel",
            });
        }
    }

    private healPlayer(amount: number) {
        this.playerStats.health = Math.min(
            this.playerStats.maxHealth,
            this.playerStats.health + amount
        );
        this.enforceHealthCap();
        useRunStore
            .getState()
            .actions.setVitals(
                this.playerStats.health,
                this.playerStats.maxHealth
            );
    }

    private enforceHealthCap() {
        if (this.upgrades.glassCannonCap === null) return;
        this.playerStats.maxHealth = Math.min(
            this.playerStats.maxHealth,
            this.upgrades.glassCannonCap
        );
        this.playerStats.health = Math.min(
            this.playerStats.health,
            this.playerStats.maxHealth
        );
    }

    private levelUp() {
        this.level += 1;
        this.nextXpThreshold = Math.floor(this.nextXpThreshold * 1.2 + 6);
        useRunStore
            .getState()
            .actions.setXp(this.level, this.xp, this.nextXpThreshold);
        this.upgrades.pendingOptions = this.rollUpgradeOptions();
        if (this.upgrades.pendingOptions.length === 0) return;
        this.setPaused(true);
        useUIStore.getState().actions.openUpgradeSelection();
        gameEvents.emit(GAME_EVENT_KEYS.levelUp, {
            options: this.upgrades.pendingOptions,
        });
    }

    private rollUpgradeOptions(): UpgradeDefinition[] {
        const sidecarStacks = this.upgrades.stacks["sidecar"] ?? 0;

        // Get card collection from meta store
        const cardCollection = useMetaStore.getState().cardCollection;
        const unlockedUpgrades = cardCollection.unlockedUpgrades;
        const upgradeBoosts = cardCollection.upgradeBoosts;

        const available = UPGRADE_CATALOG.filter((u) => {
            // Only show unlocked upgrades
            if (!unlockedUpgrades.includes(u.id)) return false;

            const stacks = this.upgrades.stacks[u.id] ?? 0;
            // Prism Spread only matters when Sidecar is active; hide it until then.
            if (u.id === "prism-spread" && sidecarStacks === 0) return false;
            return u.maxStacks ? stacks < u.maxStacks : true;
        });
        const picks: UpgradeDefinition[] = [];
        const rareBonus = this.affix?.rareUpgradeBonus ?? 0;
        const legendaryBonus = this.affix?.legendaryUpgradeBonus ?? 0;
        const numChoices = this.affix?.upgradeChoices ?? 3;
        const weightFor = (u: UpgradeDefinition) => {
            let rarityBase: number;
            if (u.rarity === "rare") {
                rarityBase = UPGRADE_RARITY_ODDS.rare * (1 + rareBonus);
            } else if (u.rarity === "legendary") {
                rarityBase =
                    UPGRADE_RARITY_ODDS.legendary * (1 + legendaryBonus);
            } else {
                rarityBase = UPGRADE_RARITY_ODDS[u.rarity] ?? 0;
            }
            // Apply boost from card collection (each boost level adds 20% weight)
            const boostLevel = upgradeBoosts[u.id] ?? 0;
            const boostMultiplier = 1 + boostLevel * 0.2;
            return Math.max(
                0,
                (u.dropWeight ?? 1) * rarityBase * boostMultiplier
            );
        };
        const weightedPool = available
            .map((u) => ({ def: u, weight: weightFor(u) }))
            .filter((entry) => entry.weight > 0);

        for (let i = 0; i < numChoices; i++) {
            if (weightedPool.length === 0) break;
            const totalWeight = weightedPool.reduce(
                (sum, entry) => sum + entry.weight,
                0
            );
            if (totalWeight <= 0) break;
            let roll = this.rng.next() * totalWeight;
            let pickedIndex = weightedPool.length - 1;
            for (let idx = 0; idx < weightedPool.length; idx++) {
                roll -= weightedPool[idx].weight;
                if (roll <= 0) {
                    pickedIndex = idx;
                    break;
                }
            }
            picks.push(weightedPool[pickedIndex].def);
            weightedPool.splice(pickedIndex, 1);
        }
        return picks;
    }

    private beginWaveIntermission(nextWaveIndex: number) {
        this.intermissionActive = true;
        this.pendingWaveIndex = nextWaveIndex;
        this.intermissionRemainingMs = 3000;
        this.lastCountdownBroadcast = 3;
        useRunStore.getState().actions.setWaveCountdown(3, nextWaveIndex + 1);
        soundManager.playLevelTrack(nextWaveIndex + 1);
    }

    private handleWaveIntermission(dt: number) {
        if (!this.intermissionActive || this.pendingWaveIndex === null) return;

        this.intermissionRemainingMs = Math.max(
            0,
            this.intermissionRemainingMs - dt * 1000
        );

        const secondsLeft = Math.max(
            1,
            Math.ceil(this.intermissionRemainingMs / 1000)
        );
        if (secondsLeft !== this.lastCountdownBroadcast) {
            this.lastCountdownBroadcast = secondsLeft;
            useRunStore
                .getState()
                .actions.setWaveCountdown(
                    secondsLeft,
                    this.pendingWaveIndex + 1
                );
        }

        if (this.intermissionRemainingMs <= 0) {
            const nextWave = this.pendingWaveIndex;
            this.intermissionActive = false;
            this.pendingWaveIndex = null;
            this.lastCountdownBroadcast = 0;
            this.intermissionRemainingMs = 0;
            useRunStore.getState().actions.setWaveCountdown(null, null);
            this.startWave(nextWave);
        }
    }

    private computeWaveScaling(index: number) {
        // Enhanced wave scaling with unlock-based difficulty progression
        // New players start easier, difficulty scales with collection progress

        const overflow =
            this.infiniteMode && index >= WAVES.length
                ? index - (WAVES.length - 1)
                : 0;

        // Calculate unlock-based difficulty modifier (0.85 to 1.15)
        // More unlocks = harder game, but starts easier for new players
        const cardCollection = useMetaStore.getState().cardCollection;
        const totalUpgrades = UPGRADE_CATALOG.length;
        const unlockedCount = cardCollection.unlockedUpgrades.length;
        const unlockProgress = unlockedCount / totalUpgrades; // 0 to 1
        // Start at 0.85x difficulty, scale up to 1.15x as you unlock everything
        const unlockDifficultyMod = 0.85 + unlockProgress * 0.3;

        // Progressive scaling for standard waves (0-9) - SOFTENED
        let baseHealthMultiplier = 1;
        let baseSpeedMultiplier = 1;
        let baseCountMultiplier = 1;

        if (index < WAVES.length) {
            // Early waves (0-3): Very gentle scaling for new players
            if (index <= 3) {
                baseHealthMultiplier = 1 + index * 0.05; // 1.0, 1.05, 1.1, 1.15
                baseSpeedMultiplier = 1 + index * 0.03; // 1.0, 1.03, 1.06, 1.09
                baseCountMultiplier = 1;
            }
            // Mid-game waves (4-6): Moderate scaling
            else if (index <= 6) {
                const midProgress = (index - 4) / 2; // 0 to 1 over waves 4-6
                baseHealthMultiplier = 1.15 + midProgress * 0.35; // 1.15 to 1.5
                baseSpeedMultiplier = 1.09 + midProgress * 0.16; // 1.09 to 1.25
                baseCountMultiplier = 1 + midProgress * 0.1; // 1.0 to 1.1
            }
            // Late waves (7-9): Challenging but fair scaling
            else {
                const lateProgress = (index - 7) / 2; // 0 to 1 over waves 7-9
                baseHealthMultiplier = 1.5 + lateProgress * 0.4; // 1.5 to 1.9
                baseSpeedMultiplier = 1.25 + lateProgress * 0.2; // 1.25 to 1.45
                baseCountMultiplier = 1.1 + lateProgress * 0.15; // 1.1 to 1.25
            }
        }

        // Apply base difficulty, unlock modifier, and infinite mode overflow scaling
        const speedAndFire =
            this.baseDifficulty *
            baseSpeedMultiplier *
            unlockDifficultyMod *
            (overflow > 0 ? 1 + overflow * 0.2 : 1); // Reduced overflow scaling
        const healthScale =
            this.baseDifficulty *
            baseHealthMultiplier *
            unlockDifficultyMod *
            (overflow > 0 ? 1.15 ** overflow : 1); // Reduced from 1.2
        const countScale =
            baseCountMultiplier *
            (overflow > 0 ? 1 + overflow * 0.3 : 1) * // Reduced from 0.4
            this.modeEnemyCountMultiplier;

        return { speedAndFire, healthScale, countScale };
    }

    private getWaveSpawns(index: number, countScale: number): EnemySpawn[] {
        if (!this.infiniteMode && index >= WAVES.length) {
            return WAVES[WAVES.length - 1]?.enemies ?? [];
        }

        if (index < WAVES.length) {
            return WAVES[index].enemies.map((spawn) =>
                spawn.kind === "boss"
                    ? spawn
                    : {
                          ...spawn,
                          count: Math.max(
                              1,
                              Math.round(spawn.count * countScale)
                          ),
                      }
            );
        }

        const overflow = index - (WAVES.length - 1);
        const basePoolRaw = WAVES.slice(
            Math.max(2, WAVES.length - 4),
            WAVES.length - 1
        );
        const basePool =
            basePoolRaw.length > 0
                ? basePoolRaw
                : WAVES.slice(0, Math.max(1, WAVES.length - 1));
        const loopIndex = Math.max(0, overflow - 1);
        const template =
            basePool[loopIndex % basePool.length] ??
            WAVES[Math.max(0, WAVES.length - 2)];
        // Enhanced elite frequency for infinite mode (Requirement 5.4)
        const affixEliteBonus = this.affix?.eliteChanceBonus ?? 0;
        const eliteBonusChance = Math.min(
            0.5,
            0.15 + overflow * 0.05 + affixEliteBonus
        );

        return template.enemies.map((spawn) => {
            if (spawn.kind === "boss") return spawn;
            const baseCount = Math.max(1, Math.round(spawn.count * countScale));
            const elite =
                spawn.elite !== undefined
                    ? spawn.elite
                    : this.rng.next() < eliteBonusChance;
            return { ...spawn, count: baseCount, elite };
        });
    }

    private startWave(index: number) {
        this.waveIndex = index;
        this.intermissionActive = false;
        this.pendingWaveIndex = null;
        this.intermissionRemainingMs = 0;
        this.lastCountdownBroadcast = 0;
        useRunStore.getState().actions.setWaveCountdown(null, null);
        useRunStore.getState().actions.setWave(index + 1);
        const scaling = this.computeWaveScaling(index);
        this.difficulty = scaling.speedAndFire;
        this.enemyHealthScale = scaling.healthScale;
        gameEvents.emit(GAME_EVENT_KEYS.waveStarted, { wave: index + 1 });
        const spawns = this.getWaveSpawns(index, scaling.countScale);
        this.spawnWaveEnemies(spawns);
        this.nextWaveCheckAt = this.time.now + 700;
    }

    private spawnWaveEnemies(spawns: EnemySpawn[]) {
        const waveCountMult = this.affix?.waveEnemyCountMultiplier ?? 1;
        const eliteBonus = this.affix?.eliteChanceBonus ?? 0;
        const randomized = spawns.map((spawn) => {
            if (spawn.kind === "boss") return spawn;
            const delta = this.randBetween(-1, 1);
            const baseCount = Math.max(1, spawn.count + delta);
            const count = Math.round(baseCount * waveCountMult);
            const baseEliteChance = 0.12;
            const elite =
                spawn.elite !== undefined
                    ? spawn.elite
                    : this.rng.next() < baseEliteChance + eliteBonus &&
                      (spawn.kind === "watcher" || spawn.kind === "mass");
            return { ...spawn, count, elite };
        });
        randomized.forEach((spawn) => {
            if (spawn.kind === "boss") {
                this.bossManager.spawnBoss();
                return;
            }
            for (let i = 0; i < spawn.count; i++) {
                this.spawnEnemy(spawn.kind, spawn.elite);
            }
        });
    }

    private spawnEnemy(kind: string, elite?: boolean, scale?: number) {
        // Use elite textures for enhanced visual distinction (Requirements 6.1, 6.5)
        let textureKey: string;
        if (elite) {
            textureKey =
                kind === "drifter"
                    ? "elite-drifter"
                    : kind === "watcher"
                    ? "elite-watcher"
                    : kind === "mass"
                    ? "elite-mass"
                    : kind === "phantom"
                    ? "elite-phantom"
                    : kind === "orbiter"
                    ? "elite-orbiter"
                    : kind === "splitter"
                    ? "elite-splitter"
                    : kind;
        } else {
            textureKey = kind;
        }

        const enemy = this.enemies.get(
            0,
            0,
            textureKey
        ) as Phaser.Physics.Arcade.Image;
        if (!enemy) return;
        enemy.setActive(true);
        enemy.setVisible(false);
        const baseScale = scale ?? OBJECT_SCALE;
        enemy.setScale(baseScale);
        const spawnPos = this.pickPerimeterSpawn();
        enemy.setPosition(spawnPos.x, spawnPos.y);
        const stats = getEnemyDefinition(kind as any, elite);
        const enemyHealthMult = this.affix?.enemyHealthMultiplier ?? 1;
        const enemySpeedMult = this.affix?.enemySpeedMultiplier ?? 1;
        const enemyDamageMult = this.affix?.enemyDamageMultiplier ?? 1;
        const enemyProjSpeedMult =
            this.affix?.enemyProjectileSpeedMultiplier ?? 1;
        const maxHealth =
            stats.health * enemyHealthMult * this.enemyHealthScale;
        enemy.setData("kind", kind);
        enemy.setData("health", maxHealth);
        enemy.setData("maxHealth", maxHealth);
        enemy.setData("speed", stats.speed * this.difficulty * enemySpeedMult);
        enemy.setData(
            "fireCooldown",
            stats.fireCooldown ? stats.fireCooldown / this.difficulty : 0
        );
        enemy.setData(
            "projectileSpeed",
            stats.projectileSpeed
                ? stats.projectileSpeed * this.difficulty * enemyProjSpeedMult
                : 0
        );
        enemy.setData("nextFire", this.time.now + this.randBetween(400, 1200));
        enemy.setData("damage", stats.damage * enemyDamageMult);
        enemy.setData("elite", elite || false);
        enemy.setData("eliteBehaviors", stats.eliteBehaviors || []);

        // Initialize special enemy data
        if (kind === "phantom") {
            enemy.setData(
                "nextTeleport",
                this.time.now + this.randBetween(1500, 3000)
            );
            enemy.setData("teleportCooldown", elite ? 1200 : 2000);
        } else if (kind === "orbiter") {
            enemy.setData("orbitAngle", this.randFloat(0, Math.PI * 2));
            enemy.setData("orbitRadius", this.randBetween(120, 200));
            enemy.setData("orbitDirection", this.rng.next() > 0.5 ? 1 : -1);
        } else if (kind === "splitter") {
            enemy.setData("splitCount", scale ? 0 : 2); // Mini splitters don't split further
        }

        // Enhanced visual threat indicators for high-stat enemies (Requirements 6.3, 6.5)
        const healthRatio =
            maxHealth / getEnemyDefinition(kind as any, false).health;
        const speedRatio =
            (stats.speed * this.difficulty * enemySpeedMult) /
            getEnemyDefinition(kind as any, false).speed;

        // Add threat indicator for significantly enhanced enemies
        if (healthRatio > 1.5 || speedRatio > 1.5 || elite) {
            enemy.setData("threatLevel", elite ? "elite" : "enhanced");

            // Add subtle size increase for enhanced enemies
            if (!elite && (healthRatio > 1.5 || speedRatio > 1.5)) {
                enemy.setScale(OBJECT_SCALE * 1.1);
                enemy.setTint(0xffaa77); // Subtle orange tint for enhanced non-elites
            }
        }

        const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
        enemyBody.setSize(enemy.displayWidth, enemy.displayHeight, true);
        enemyBody.setBounce(0.4, 0.4);
        enemyBody.enable = false;
        enemy.setVelocity(0, 0);
        if (elite) {
            // Enhanced elite visual distinction (Requirements 6.1, 6.3, 6.5)
            enemy.setTint(0xff6b47); // Bright orange-red tint for threat indication

            // Add pulsing glow effect for elite enemies
            const glowRing = this.add
                .arc(
                    enemy.x,
                    enemy.y,
                    32 * OBJECT_SCALE,
                    0,
                    360,
                    false,
                    0xff6b47,
                    0.15
                )
                .setStrokeStyle(2, 0xff6b47, 0.6)
                .setDepth(0.3);

            // Store glow ring reference on enemy for cleanup
            enemy.setData("eliteGlow", glowRing);

            // Pulsing animation for elite glow
            this.tweens.add({
                targets: glowRing,
                alpha: { from: 0.6, to: 0.2 },
                scale: { from: 0.9, to: 1.1 },
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut",
            });
        } else {
            enemy.clearTint();
        }
        this.showSpawnCue(enemy);
    }

    private handlePlayerDamage(
        pilot: PilotRuntime,
        source: Phaser.Physics.Arcade.Image,
        amount: number,
        isContact: boolean
    ) {
        const now = this.time.now;
        if (now < pilot.invulnUntil) return;
        const contactMultiplier = isContact
            ? this.upgrades.stabilizer.contactMultiplier
            : 1;
        const armorReduction = Math.min(
            Math.max(this.upgrades.plating.damageReduction, 0),
            0.6
        );
        const armorMultiplier = 1 - armorReduction;
        let remaining =
            (isContact ? amount + 0.5 : amount) *
            contactMultiplier *
            armorMultiplier;

        if (pilot.shield.hp > 0 && now <= pilot.shield.activeUntil) {
            const absorbed = Math.min(pilot.shield.hp, remaining);
            pilot.shield.hp -= absorbed;
            remaining -= absorbed;
            if (pilot.shield.hp <= 0) {
                pilot.shield.activeUntil = 0;
            }
        }

        if (remaining <= 0) return;

        this.playerStats.health -= remaining;
        useRunStore
            .getState()
            .actions.setVitals(
                this.playerStats.health,
                this.playerStats.maxHealth
            );
        pilot.sprite.setTintFill(0xf14e4e);
        this.time.delayedCall(80, () => pilot.sprite.clearTint());

        // Apply knockback and invulnerability on contact damage
        if (isContact && source.active) {
            const knockbackStrength = 280;
            const invulnDurationMs = 500;
            const dx = pilot.sprite.x - source.x;
            const dy = pilot.sprite.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const knockX = (dx / dist) * knockbackStrength;
            const knockY = (dy / dist) * knockbackStrength;
            pilot.sprite.body?.velocity.set(knockX, knockY);
            pilot.invulnUntil = now + invulnDurationMs;

            // Play bump sound
            soundManager.playSfx("playerHit");

            // Flash a blue shield ring to indicate deflection
            this.spawnBurstVisual(
                pilot.sprite.x,
                pilot.sprite.y,
                36 * OBJECT_SCALE,
                COLOR_ACCENT,
                0.9
            );
        }

        if (this.playerStats.health <= 0) {
            this.endRun(false);
        }
    }

    private pickPerimeterSpawn() {
        const margin = 40;
        const minSpacing = 60; // Minimum distance between spawned enemies
        const maxAttempts = 10; // Prevent infinite loops

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const edges = [
                {
                    x: this.randBetween(
                        this.screenBounds.left,
                        this.screenBounds.right
                    ),
                    y: this.screenBounds.top + margin,
                    side: "top" as const,
                },
                {
                    x: this.randBetween(
                        this.screenBounds.left,
                        this.screenBounds.right
                    ),
                    y: this.screenBounds.bottom - margin,
                    side: "bottom" as const,
                },
                {
                    x: this.screenBounds.left + margin,
                    y: this.randBetween(
                        this.screenBounds.top,
                        this.screenBounds.bottom
                    ),
                    side: "left" as const,
                },
                {
                    x: this.screenBounds.right - margin,
                    y: this.randBetween(
                        this.screenBounds.top,
                        this.screenBounds.bottom
                    ),
                    side: "right" as const,
                },
            ];
            const candidate = this.randChoice(edges);

            // Check distance from existing enemies
            let tooClose = false;
            this.enemies.getChildren().forEach((child) => {
                const enemy = child as Phaser.Physics.Arcade.Image;
                if (!enemy.active) return;
                const dist = Phaser.Math.Distance.Between(
                    candidate.x,
                    candidate.y,
                    enemy.x,
                    enemy.y
                );
                if (dist < minSpacing) {
                    tooClose = true;
                }
            });

            if (!tooClose) {
                return candidate;
            }
        }

        // Fallback: return a random position if no valid spot found
        const edges = [
            {
                x: this.randBetween(
                    this.screenBounds.left,
                    this.screenBounds.right
                ),
                y: this.screenBounds.top + margin,
                side: "top" as const,
            },
            {
                x: this.randBetween(
                    this.screenBounds.left,
                    this.screenBounds.right
                ),
                y: this.screenBounds.bottom - margin,
                side: "bottom" as const,
            },
            {
                x: this.screenBounds.left + margin,
                y: this.randBetween(
                    this.screenBounds.top,
                    this.screenBounds.bottom
                ),
                side: "left" as const,
            },
            {
                x: this.screenBounds.right - margin,
                y: this.randBetween(
                    this.screenBounds.top,
                    this.screenBounds.bottom
                ),
                side: "right" as const,
            },
        ];
        return this.randChoice(edges);
    }

    private showSpawnCue(enemy: Phaser.Physics.Arcade.Image) {
        const cue = this.add
            .circle(enemy.x, enemy.y, 26, 0x9ff0ff, 0.15)
            .setStrokeStyle(2, 0x6dd6ff, 0.6);
        const flash = this.tweens.add({
            targets: cue,
            alpha: { from: 0.15, to: 0.4 },
            scale: { from: 0.9, to: 1.1 },
            duration: 500,
            yoyo: true,
            repeat: 2,
        });

        // Track visual effects for cleanup
        this.activeSpawnCues.push(cue);
        this.activeSpawnTweens.push(flash);

        // Store spawn data in case enemy is destroyed during delay
        const spawnData = {
            x: enemy.x,
            y: enemy.y,
            kind: enemy.getData("kind") as string,
            elite: enemy.getData("elite") as boolean,
        };

        const delayedCall = this.time.delayedCall(1500, () => {
            // Clean up tracking arrays
            const cueIndex = this.activeSpawnCues.indexOf(cue);
            if (cueIndex >= 0) this.activeSpawnCues.splice(cueIndex, 1);

            const tweenIndex = this.activeSpawnTweens.indexOf(flash);
            if (tweenIndex >= 0) this.activeSpawnTweens.splice(tweenIndex, 1);

            const callIndex = this.activeDelayedCalls.indexOf(delayedCall);
            if (callIndex >= 0) this.activeDelayedCalls.splice(callIndex, 1);

            cue.destroy();
            flash.stop();

            // If enemy was destroyed during spawn delay, create a new one
            if (!enemy.active) {
                const newEnemy = this.enemies.get(
                    spawnData.x,
                    spawnData.y,
                    spawnData.elite ? `elite-${spawnData.kind}` : spawnData.kind
                ) as Phaser.Physics.Arcade.Image;
                if (newEnemy) {
                    // Restore enemy data from spawn data
                    const stats = getEnemyDefinition(
                        spawnData.kind as any,
                        spawnData.elite
                    );
                    const enemyHealthMult =
                        this.affix?.enemyHealthMultiplier ?? 1;
                    const enemySpeedMult =
                        this.affix?.enemySpeedMultiplier ?? 1;
                    const maxHealth =
                        stats.health * enemyHealthMult * this.enemyHealthScale;

                    newEnemy.setActive(true);
                    newEnemy.setVisible(true);
                    newEnemy.setScale(OBJECT_SCALE);
                    newEnemy.setData("kind", spawnData.kind);
                    newEnemy.setData("health", maxHealth);
                    newEnemy.setData("maxHealth", maxHealth);
                    newEnemy.setData(
                        "speed",
                        stats.speed * this.difficulty * enemySpeedMult
                    );
                    newEnemy.setData(
                        "fireCooldown",
                        stats.fireCooldown
                            ? stats.fireCooldown / this.difficulty
                            : 0
                    );
                    newEnemy.setData(
                        "projectileSpeed",
                        stats.projectileSpeed
                            ? stats.projectileSpeed * this.difficulty
                            : 0
                    );
                    newEnemy.setData(
                        "nextFire",
                        this.time.now + this.randBetween(400, 1200)
                    );
                    newEnemy.setData("damage", stats.damage);
                    newEnemy.setData("elite", spawnData.elite || false);
                    newEnemy.setData(
                        "eliteBehaviors",
                        stats.eliteBehaviors || []
                    );

                    const enemyBody =
                        newEnemy.body as Phaser.Physics.Arcade.Body;
                    enemyBody.setSize(
                        newEnemy.displayWidth,
                        newEnemy.displayHeight,
                        true
                    );
                    enemyBody.setBounce(0.4, 0.4);
                    enemyBody.enable = true;
                    newEnemy.setVelocity(0, 0);

                    // Apply elite visual effects
                    if (spawnData.elite) {
                        newEnemy.setTint(0xff6b47);
                        const glowRing = this.add
                            .arc(
                                newEnemy.x,
                                newEnemy.y,
                                32 * OBJECT_SCALE,
                                0,
                                360,
                                false,
                                0xff6b47,
                                0.15
                            )
                            .setStrokeStyle(2, 0xff6b47, 0.6)
                            .setDepth(0.3);

                        newEnemy.setData("eliteGlow", glowRing);
                        this.tweens.add({
                            targets: glowRing,
                            alpha: { from: 0.6, to: 0.2 },
                            scale: { from: 0.9, to: 1.1 },
                            duration: 800,
                            yoyo: true,
                            repeat: -1,
                            ease: "Sine.easeInOut",
                        });
                        soundManager.playSfx("eliteSpawn");
                    }
                }
                return;
            }

            const body = enemy.body as Phaser.Physics.Arcade.Body | null;
            if (!body) {
                enemy.destroy();
                return;
            }
            enemy.setActive(true);
            enemy.setVisible(true);
            body.enable = true;
            enemy.setVelocity(0, 0);

            // Play elite spawn sound for enhanced enemies (Requirement 6.2)
            const isElite = enemy.getData("elite") as boolean;
            if (isElite) {
                soundManager.playSfx("eliteSpawn");
            }
        });

        // Track the delayed call for cleanup
        this.activeDelayedCalls.push(delayedCall);
    }

    private cleanupVisualEffects() {
        // Stop all tweens first to prevent orphaned animations
        this.tweens.killAll();

        // Clean up spawn cues
        this.activeSpawnCues.forEach((cue) => {
            if (cue && cue.active) {
                cue.destroy();
            }
        });
        this.activeSpawnCues.length = 0;

        // Stop and clean up spawn tweens
        this.activeSpawnTweens.forEach((tween) => {
            if (tween && tween.isActive()) {
                tween.stop();
            }
        });
        this.activeSpawnTweens.length = 0;

        // Cancel delayed spawn calls
        this.activeDelayedCalls.forEach((call) => {
            if (call && !call.hasDispatched) {
                call.destroy();
            }
        });
        this.activeDelayedCalls.length = 0;

        // Clean up any remaining visual effects (safety net)
        // Copy the list to avoid mutation during iteration
        const childrenToCheck = [...this.children.list];
        childrenToCheck.forEach((child) => {
            if (!child || !child.active) return;

            // Clean up Arc objects (spawn cues, shield rings, etc.)
            if (child instanceof Phaser.GameObjects.Arc) {
                const arc = child as Phaser.GameObjects.Arc;
                const isSpawnCue =
                    arc.fillColor === 0x9ff0ff || arc.strokeColor === 0x6dd6ff;
                const isEliteGlow =
                    arc.fillColor === 0xff6b47 || arc.strokeColor === 0xff6b47;
                const isBurstVisual = arc.getData("isBurstVisual") === true;

                if (isSpawnCue || isEliteGlow || isBurstVisual) {
                    child.destroy();
                }
            }

            // Clean up Rectangle objects (debris particles from death animation)
            if (child instanceof Phaser.GameObjects.Rectangle) {
                const rect = child as Phaser.GameObjects.Rectangle;
                // Debris particles are small cyan rectangles at depth 10
                if (
                    rect.depth === 10 &&
                    rect.width <= 10 &&
                    rect.fillColor === 0x9ff0ff
                ) {
                    child.destroy();
                }
            }
        });
    }

    private endRun(victory: boolean) {
        this.runActive = false;
        this.intermissionActive = false;
        this.pendingWaveIndex = null;
        this.intermissionRemainingMs = 0;
        this.lastCountdownBroadcast = 0;
        this.physics.world.pause();

        // Play death animation if not a victory
        if (!victory && this.playerState?.sprite) {
            this.playDeathAnimation(this.playerState.sprite, () =>
                this.finalizeEndRun(victory)
            );
        } else {
            this.finalizeEndRun(victory);
        }
    }

    private playDeathAnimation(
        sprite: Phaser.Physics.Arcade.Image,
        onComplete: () => void
    ) {
        const x = sprite.x;
        const y = sprite.y;

        // Hide the player sprite
        sprite.setVisible(false);

        // Play death explosion sound
        soundManager.playSfx("playerDeath");

        // Screen shake
        this.cameras.main.shake(400, 0.015);

        // Initial explosion burst
        this.spawnBurstVisual(x, y, 50, 0xf14e4e, 1);

        // Spawn debris particles flying outward
        const debrisCount = 12;
        for (let i = 0; i < debrisCount; i++) {
            const angle = (i / debrisCount) * Math.PI * 2;
            const speed = 120 + Math.random() * 100;
            const debris = this.add
                .rectangle(x, y, 6, 6, 0x9ff0ff)
                .setDepth(10);
            this.tweens.add({
                targets: debris,
                x: x + Math.cos(angle) * speed,
                y: y + Math.sin(angle) * speed,
                alpha: 0,
                scale: 0.3,
                duration: 500 + Math.random() * 200,
                ease: "Quad.easeOut",
                onComplete: () => debris.destroy(),
            });
        }

        // Secondary explosion rings
        this.time.delayedCall(100, () => {
            this.spawnBurstVisual(x, y, 70, COLOR_ACCENT, 0.8);
        });
        this.time.delayedCall(200, () => {
            this.spawnBurstVisual(x, y, 90, 0xffffff, 0.6);
        });

        // Flash the screen
        this.time.delayedCall(150, () => {
            this.cameras.main.flash(200, 255, 255, 255, false);
        });

        // Complete after animation
        this.time.delayedCall(600, onComplete);
    }

    private finalizeEndRun(victory: boolean) {
        const state = useRunStore.getState();
        const durationSeconds = (this.time.now - this.runStartTime) / 1000;
        const summary = {
            runId: state.runId ?? crypto.randomUUID(),
            timestamp: Date.now(),
            durationSeconds,
            wavesCleared: this.waveIndex + 1,
            bossDefeated: victory || this.bossCleared,
            enemiesDestroyed: state.enemiesDestroyed,
            upgrades: state.currentUpgrades,
            seedId: state.seedId ?? this.seedId,
            bossId: this.bossManager.template?.id,
            affixId: this.affix?.id,
            synergies: state.achievedSynergies,
            mode: this.runMode,
        };
        state.actions.setWaveCountdown(null, null);
        state.actions.endRun(summary);
        useUIStore.getState().actions.setScreen("summary");
        gameEvents.emit(GAME_EVENT_KEYS.runEnded, summary);
    }

    // Dev helper: jump directly to a wave for testing.
    debugSetWave(waveNumber: number) {
        const target = this.infiniteMode
            ? Math.max(0, waveNumber - 1)
            : Phaser.Math.Clamp(waveNumber - 1, 0, WAVES.length - 1);
        // Clean up visual effects before clearing pools
        this.cleanupVisualEffects();

        this.enemies.clear(true, true);
        this.enemyBullets.clear(true, true);
        this.xpPickups.clear(true, true);
        this.intermissionActive = false;
        this.pendingWaveIndex = null;
        this.intermissionRemainingMs = 0;
        this.lastCountdownBroadcast = 0;
        this.startWave(target);
    }
}
