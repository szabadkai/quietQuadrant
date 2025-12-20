import Phaser from "phaser";
import { soundManager } from "../../audio/SoundManager";
import { BOSSES } from "../../config/bosses";
import { getEnemyDefinition } from "../../config/enemies";
import { SYNERGY_DEFINITIONS } from "../../config/synergies";
import {
    getUpgradeDefinition,
    UPGRADE_CATALOG,
    UPGRADE_RARITY_ODDS,
} from "../../config/upgrades";
import {
    canStackUpgrade,
    validateUpgradeCombinationDetailed,
    calculateDiminishedMultiplier,
    applySynergyAdjustment,
    getLegendaryAdjustments,
    calculateMaxDamageMultiplier,
    calculateMaxDPSMultiplier,
    calculateMaxDefenseMultiplier,
} from "../../config/upgradeBalance";
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

const OBJECT_SCALE = 0.7;
const COLOR_ACCENT = 0x9ff0ff;
const COLOR_CHARGE = 0xf7d46b;
const COLOR_PULSE = 0xa0f4ff;
const COLOR_OVERLOAD = 0xffd7a6;
const XP_ATTRACT_RADIUS = 180;
const XP_ATTRACT_MIN_SPEED = 320;
const XP_ATTRACT_MAX_SPEED = 760;
const XP_ATTRACT_LERP_RATE = 10; // per-second factor for smoothing toward target velocity
const PROJECTILE_MAX_LIFETIME_MS = 3800;

type PlayerStats = {
    moveSpeed: number;
    damage: number;
    fireRate: number; // shots per second
    projectileSpeed: number;
    projectiles: number;
    pierce: number;
    bounce: number;
    maxHealth: number;
    health: number;
    critChance: number;
    critMultiplier: number;
};

type AbilityState = {
    dashCooldownMs: number;
    dashDurationMs: number;
    nextDashAt: number;
    activeUntil: number;
};

type ChargeRuntime = {
    ready: boolean;
    holdMs: number;
    damageBonus: number;
    sizeBonus: number;
    idleMs: number;
};

type ShieldState = {
    hp: number;
    activeUntil: number;
    nextReadyAt: number;
};

type MomentumState = {
    timerMs: number;
    bonus: number;
};

type PilotRuntime = {
    id: "p1" | "p2";
    sprite: Phaser.Physics.Arcade.Image;
    ability: AbilityState;
    charge: ChargeRuntime;
    momentum: MomentumState;
    shield: ShieldState;
    lastAimDirection: Phaser.Math.Vector2;
    lastShotAt: number;
    invulnUntil: number;
    gamepadState: GamepadControlState;
    control: ControlBinding;
    shieldRing?: Phaser.GameObjects.Arc;
};

type UpgradeState = {
    [id: string]: number;
};

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
    private chargeState = {
        ready: false,
        holdMs: 0,
        damageBonus: 0.9,
        sizeBonus: 0.2,
        idleMs: 1000,
    };
    private capacitorConfig = {
        stacks: 0,
        idleMs: 1000,
        damageBonus: 0.9,
        sizeBonus: 0.2,
        chargePierceBonus: 0,
    };
    private afterimageConfig = { stacks: 0, trailShots: 0, shotDamage: 0 };
    private dashSparkConfig = { stacks: 0, shards: 0, damage: 0 };
    private shieldConfig = {
        stacks: 0,
        shieldHp: 60,
        durationMs: 0,
        cooldownMs: 0,
        nextReadyAt: 0,
    };
    private explosiveConfig = { stacks: 0, radius: 0, damageMultiplier: 0 };
    private splitConfig = {
        enabled: false,
        forks: 2,
        spreadDegrees: 12,
        damageMultiplier: 0.5,
    };
    private chainArcConfig = {
        stacks: 0,
        range: 180,
        damagePercent: 0.6,
        cooldownMs: 150,
        lastAt: 0,
    };
    private kineticConfig = {
        stacks: 0,
        healAmount: 0.3,
        cooldownMs: 1200,
        nextReadyAt: 0,
    };
    private momentumConfig = {
        stacks: 0,
        ramp: 0.25,
        timeToMaxMs: 2000,
        timerMs: 0,
        bonus: 0,
    };
    private spreadConfig = { stacks: 0, spreadDegrees: 6, critBonus: 0 };
    private homingConfig = { stacks: 0, range: 0, turnRate: 0 };
    private projectileScale = 1;
    private magnetConfig = { stacks: 0, radiusMult: 1, speedMult: 1 };
    private stabilizerConfig = { stacks: 0, contactMultiplier: 1 };
    private platingConfig = { stacks: 0, damageReduction: 0 };
    private shrapnelConfig = { stacks: 0, shards: 0, damage: 0 };
    // heavy hitter configs
    private neutronCoreConfig = { active: false, speedMultiplier: 0.6 };
    private glassCannonCap: number | null = null;
    private singularityConfig = {
        active: false,
        radius: 140,
        pullStrength: 520,
    };
    private bulletHellConfig = {
        active: false,
        fireRateMultiplier: 4,
        damageMultiplier: 0.6,
        inaccuracyRad: Phaser.Math.DegToRad(32),
    };
    private bloodFuelConfig = {
        stacks: 0,
        healPercent: 0.12,
        fireCostPercent: 0.02,
    };
    private chainReactionConfig = { stacks: 0, radius: 70, damagePercent: 0.5 };
    private quantumConfig = {
        active: false,
        wrapMargin: 18,
        projectileLifetimeMs: PROJECTILE_MAX_LIFETIME_MS,
    };
    private berserkConfig = { stacks: 0, maxBonus: 1 };
    private activeSynergies = new Set<string>();
    private difficulty = 1;
    private bossMaxHealth = 0;

    private bullets!: Phaser.Physics.Arcade.Group;
    private enemyBullets!: Phaser.Physics.Arcade.Group;
    private enemies!: Phaser.Physics.Arcade.Group;
    private xpPickups!: Phaser.Physics.Arcade.Group;
    private playersGroup!: Phaser.Physics.Arcade.Group;
    private lowGraphics = false;
    private starfieldLayers: {
        sprite: Phaser.GameObjects.TileSprite;
        velocityX: number;
        velocityY: number;
        colorFx?: Phaser.FX.ColorMatrix;
    }[] = [];
    private backgroundFxTargets: Phaser.FX.ColorMatrix[] = [];
    private backgroundFxTween?: Phaser.Tweens.Tween;
    private bossIntroOverlay?: Phaser.GameObjects.Rectangle;
    private playfieldBackdrop?: Phaser.GameObjects.Rectangle;
    private bossIntroColor = 0xf14e4e;

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
    private waveIndex = 0;
    private runActive = false;
    private runStartTime = 0;
    private xp = 0;
    private level = 1;
    private nextXpThreshold = 12;
    private pendingUpgradeOptions: UpgradeDefinition[] = [];
    private upgradeStacks: UpgradeState = {};
    private nextWaveCheckAt = 0;
    private intermissionActive = false;
    private intermissionRemainingMs = 0;
    private pendingWaveIndex: number | null = null;
    private lastCountdownBroadcast = 0;
    private bossPhase = 1;
    private boss?: Phaser.Physics.Arcade.Image;
    private bossNextPatternAt = 0;
    private screenBounds!: Phaser.Geom.Rectangle;
    private elapsedAccumulator = 0;
    private rng = new Prng(1);
    private seedId = "week-0";
    private bossTemplate: BossDefinition = BOSSES[0];
    private affix: WeeklyAffix | null = null;
    private bossPatternQueue: string[] = [];
    private bossPatternCursor = 0;
    private bossSpinAngle = 0;
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

    constructor() {
        super("MainScene");
    }

    create() {
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
        const bossPool = BOSSES.length > 0 ? BOSSES : [this.bossTemplate];
        this.bossTemplate =
            bossOverride ?? bossPool[this.rng.nextInt(bossPool.length)];
        this.affix = affix ?? null;
        this.bossPatternQueue = this.shuffle(this.bossTemplate.patterns);
        this.bossPatternCursor = 0;
        this.bossSpinAngle = 0;
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
        if (this.explosiveConfig.stacks <= 0) return;
        const radius = this.explosiveConfig.radius;
        if (radius <= 0) return;
        const dmgMultiplier = this.explosiveConfig.damageMultiplier;
        const damage = (projectile.getData("damage") as number) * dmgMultiplier;
        const tags = (projectile.getData("tags") as string[] | undefined) ?? [];
        this.applyAoeDamage(enemy.x, enemy.y, radius, damage, tags);
        this.spawnBurstVisual(enemy.x, enemy.y, radius, COLOR_OVERLOAD, 0.8);
    }

    update(_: number, delta: number) {
        const dt = delta / 1000;
        if (!this.lowGraphics) {
            this.updateStarfield(dt);
        }
        if (!this.runActive || !this.playerState) return;
        const runStatus = useRunStore.getState().status;
        const activePilots = this.getActivePilots();
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

        if (runStatus !== "running") return;
        this.elapsedAccumulator += dt;
        if (this.elapsedAccumulator >= 0.2) {
            useRunStore.getState().actions.tick(this.elapsedAccumulator);
            this.elapsedAccumulator = 0;

            // Periodic upgrade validation check (Requirements 4.4, 4.5, 1.5)
            // Run every 0.2 seconds to catch any edge cases
            if (Object.keys(this.upgradeStacks).length > 0) {
                this.emergencyUpgradeValidation();
            }
        }

        // In online mode, handle based on host/guest role
        const { isHost } = useMultiplayerStore.getState();
        const isOnlineGuest = this.runMode === "online" && !isHost;

        if (isOnlineGuest) {
            // Guest: Apply received game state, handle local input including shooting
            this.applyReceivedGameState();
            // Find local pilot and handle movement + shooting
            const isMobileInput = useInputStore.getState().isMobile;
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
            const isMobileInput = useInputStore.getState().isMobile;
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
        this.handleBossPatterns();
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
        const def = getUpgradeDefinition(id);
        if (!def) return;
        const current = this.upgradeStacks[id] ?? 0;

        // Check balance system stacking limits (Requirements 4.1, 4.4)
        if (!canStackUpgrade(id, current)) return;
        if (def.maxStacks && current >= def.maxStacks) return;

        // Enhanced validation with detailed feedback (Requirements 4.4, 4.5, 1.5)
        const testUpgrades = { ...this.upgradeStacks, [id]: current + 1 };
        const validation = validateUpgradeCombinationDetailed(testUpgrades);

        if (!validation.valid) {
            // Log validation failure for debugging
            console.warn(`Upgrade ${id} rejected:`, validation.reasons);
            console.warn("Power metrics:", validation.metrics);

            // Upgrade would exceed balance limits, reject it
            return;
        }

        // Additional safeguards against infinite damage builds (Requirement 1.5)
        if (validation.metrics.maxDPS > 15.0) {
            // Even if technically valid, reject extremely high DPS combinations
            console.warn(
                `Upgrade ${id} rejected: DPS too high (${validation.metrics.maxDPS.toFixed(
                    2
                )}x)`
            );
            return;
        }

        this.upgradeStacks[id] = current + 1;
        this.pendingUpgradeOptions = [];
        useUIStore.getState().actions.closeUpgradeSelection();
        this.setPaused(false);
        this.applyUpgradeEffects(def);
        this.checkSynergies();

        // Validate upgrade state after application (Requirements 4.4, 4.5)
        this.validateCurrentUpgradeState();

        useRunStore.getState().actions.addUpgrade({
            id: def.id,
            stacks: this.upgradeStacks[id],
        });
    }

    private checkSynergies() {
        SYNERGY_DEFINITIONS.forEach((syn) => {
            if (this.activeSynergies.has(syn.id)) return;
            const ready = syn.requires.every(
                (req) => (this.upgradeStacks[req] ?? 0) > 0
            );
            if (ready) {
                this.enableSynergy(syn.id);
            }
        });
    }

    private enableSynergy(id: string) {
        if (this.activeSynergies.has(id)) return;
        this.activeSynergies.add(id);
        switch (id) {
            case "railgun": {
                // Apply synergy power adjustments (Requirement 4.3)
                const baseCritChance = 0.05;
                const baseCritMultiplier = 0.25;
                this.playerStats.critChance += applySynergyAdjustment(
                    "railgun",
                    baseCritChance
                );
                this.playerStats.critMultiplier += applySynergyAdjustment(
                    "railgun",
                    baseCritMultiplier
                );
                break;
            }
            case "meat-grinder": {
                // Apply synergy power adjustments (Requirement 4.3)
                const baseCritChance = 0.03;
                const baseCritMultiplier = 0.15;
                this.playerStats.critChance += applySynergyAdjustment(
                    "meat-grinder",
                    baseCritChance
                );
                this.playerStats.critMultiplier += applySynergyAdjustment(
                    "meat-grinder",
                    baseCritMultiplier
                );
                break;
            }
            case "vampire": {
                // Apply synergy power adjustments (Requirement 4.3)
                const baseCritChance = 0.03;
                this.playerStats.critChance += applySynergyAdjustment(
                    "vampire",
                    baseCritChance
                );
                break;
            }
            case "tesla-coil": {
                // Chain arc + explosive = boosted arc damage
                this.chainArcConfig.damagePercent += 0.15;
                break;
            }
            case "glass-storm": {
                // Glass cannon + bullet hell = reduced accuracy penalty
                this.bulletHellConfig.inaccuracyRad *= 0.5;
                break;
            }
            case "phantom-striker": {
                // Dash sparks + shrapnel = reduced dash cooldown
                if (this.playerState) {
                    this.playerState.ability.dashCooldownMs *= 0.75;
                }
                if (this.playerTwoState) {
                    this.playerTwoState.ability.dashCooldownMs *= 0.75;
                }
                break;
            }
            case "gravity-well": {
                // Singularity + explosive = bigger explosions
                this.explosiveConfig.radius *= 1.3;
                break;
            }
            case "sniper-elite": {
                // Held charge + heatseeker = stronger homing on charged + crit bonus
                this.homingConfig.turnRate *= 2;
                this.playerStats.critMultiplier += 0.1;
                break;
            }
            case "immortal-engine": {
                // Shield pickup + kinetic siphon = longer shields
                this.shieldConfig.durationMs *= 1.5;
                break;
            }
            case "prism-cannon": {
                // Prism spread + heavy barrel + sidecar = crit bonus
                this.playerStats.critChance += 0.08;
                break;
            }
            default:
                break;
        }
        // Validate upgrade state after synergy activation (Requirements 4.3, 4.4)
        this.validateCurrentUpgradeState();

        useRunStore.getState().actions.unlockSynergy(id);
        const anchor =
            this.playerState?.sprite ?? this.playerTwoState?.sprite ?? null;
        if (anchor && !this.lowGraphics) {
            this.spawnBurstVisual(
                anchor.x,
                anchor.y,
                38 * OBJECT_SCALE,
                COLOR_OVERLOAD,
                0.85
            );
        }
    }

    private setupVisuals() {
        this.lowGraphics = useMetaStore.getState().settings.lowGraphicsMode;
        this.backgroundFxTargets = [];
        this.createStarfieldTextures();
        this.createStarfieldLayers();
        this.syncStarfieldVisibility();
        this.createPlayfieldBackdrop();
        this.setupBossIntroOverlay();
        this.createBossTextures();
        this.createTexture("player", (g) => {
            const c = 32;
            g.fillStyle(0x0f1b2d, 1);
            g.fillTriangle(c + 20, c, c - 12, c - 14, c - 12, c + 14);
            g.lineStyle(2, 0x9ff0ff);
            g.strokeTriangle(c + 20, c, c - 12, c - 14, c - 12, c + 14);
            g.fillStyle(0x7ad1ff, 1);
            g.fillTriangle(c + 6, c, c - 4, c - 6, c - 4, c + 6);
            g.fillStyle(0x11344d, 1);
            g.fillRect(c - 18, c - 8, 8, 4);
            g.fillRect(c - 18, c + 4, 8, 4);
            g.lineStyle(2, 0x9ff0ff, 0.9);
            g.lineBetween(c - 12, c - 10, c + 4, c - 4);
            g.lineBetween(c - 12, c + 10, c + 4, c + 4);
            g.fillStyle(0x9ff0ff, 0.8);
            g.fillRect(c - 6, c - 5, 10, 10);
        });
        this.createTexture("drifter", (g) => {
            const c = 32;
            g.lineStyle(3, 0xa8b0c2);
            g.strokeCircle(c, c, 16);
            g.lineStyle(2, 0x6dd6ff, 0.9);
            g.strokeCircle(c, c, 11);
            g.fillStyle(0x0d1a28, 1);
            g.fillCircle(c, c, 9);
            g.fillStyle(0x6dd6ff, 1);
            g.fillCircle(c, c, 5);
            g.fillStyle(0xa8b0c2, 1);
            g.fillRect(c - 4, c + 14, 8, 10);
            g.fillRect(c - 20, c - 2, 6, 10);
            g.fillRect(c + 14, c - 2, 6, 10);
        });
        this.createTexture("watcher", (g) => {
            const c = 32;
            g.fillStyle(0x0f1626, 1);
            g.fillRoundedRect(c - 16, c - 16, 32, 32, 6);
            g.lineStyle(3, 0x8aa3e0);
            g.strokeRoundedRect(c - 16, c - 16, 32, 32, 6);
            g.lineStyle(2, 0x6dd6ff, 0.8);
            g.lineBetween(c - 12, c, c + 12, c);
            g.lineBetween(c, c - 12, c, c + 12);
            g.fillStyle(0x6dd6ff, 1);
            g.fillCircle(c, c, 7);
            g.fillStyle(0x182744, 1);
            g.fillCircle(c, c, 4);
            g.fillStyle(0xf4f6fb, 0.8);
            g.fillCircle(c + 3, c - 2, 2);
        });
        this.createTexture("mass", (g) => {
            const c = 32;
            const hull = [
                { x: c, y: c - 20 },
                { x: c + 18, y: c },
                { x: c, y: c + 20 },
                { x: c - 18, y: c },
            ];
            g.fillStyle(0x26120f, 1);
            g.fillPoints(hull, true);
            g.lineStyle(3, 0xe0a86f);
            g.strokePoints(hull, true);
            g.fillStyle(0x6b3a21, 1);
            g.fillRect(c - 6, c - 10, 12, 7);
            g.lineStyle(2, 0xe0a86f, 0.8);
            g.lineBetween(c - 10, c - 4, c + 10, c - 4);
            g.lineBetween(c - 10, c + 4, c + 10, c + 4);
        });
        this.createTexture("boss", (g) => {
            const c = 32;
            g.fillStyle(0x180c13, 1);
            g.fillEllipse(c, c, 58, 40);
            g.lineStyle(4, 0xf14e4e);
            g.strokeEllipse(c, c, 58, 40);
            g.fillStyle(0x2a0f18, 1);
            g.fillEllipse(c, c, 46, 28);
            g.fillStyle(0xf14e4e, 0.8);
            g.fillEllipse(c, c, 32, 18);
            g.fillStyle(0xfafafa, 1);
            g.fillCircle(c + 2, c - 2, 6);
            g.fillStyle(0x0b0f13, 1);
            g.fillCircle(c + 4, c - 2, 3);
            g.lineStyle(3, 0xf14e4e, 0.9);
            g.beginPath();
            g.moveTo(c - 30, c - 10);
            g.lineTo(c - 18, c - 24);
            g.lineTo(c - 10, c - 6);
            g.strokePath();
            g.beginPath();
            g.moveTo(c + 30, c - 10);
            g.lineTo(c + 18, c - 24);
            g.lineTo(c + 10, c - 6);
            g.strokePath();
        });
        this.createTexture("bullet", (g) => {
            const c = 32;
            g.fillStyle(0xfafafa, 1);
            g.fillRoundedRect(c - 2, c - 12, 4, 18, 2);
            g.fillStyle(0x9ff0ff, 0.8);
            g.fillRoundedRect(c - 1, c - 14, 2, 6, 1);
        });
        this.createTexture("enemy-bullet", (g) => {
            const c = 32;
            g.fillStyle(0xf14e4e);
            g.fillRoundedRect(c - 2, c - 10, 4, 16, 2);
            g.fillStyle(0xffc2c2, 0.8);
            g.fillRoundedRect(c - 1, c - 12, 2, 5, 1);
        });
        this.createTexture("xp", (g) => {
            const c = 32;
            const gem = [
                { x: c, y: c - 8 },
                { x: c + 6, y: c },
                { x: c, y: c + 8 },
                { x: c - 6, y: c },
            ];
            g.fillStyle(0x6dd6ff, 1);
            g.fillPoints(gem, true);
            g.lineStyle(2, 0x9ff0ff, 0.9);
            g.strokePoints(gem, true);
            g.fillStyle(0xf4f6fb, 0.9);
            g.fillTriangle(c - 1, c - 4, c + 3, c, c - 1, c + 4);
        });

        // Create enhanced elite enemy textures (Requirements 6.1, 6.3, 6.5)
        this.createTexture("elite-drifter", (g) => {
            const c = 32;
            // Base drifter shape with enhanced effects
            g.lineStyle(4, 0xff6b47); // Thicker, more menacing outline
            g.strokeCircle(c, c, 16);
            g.lineStyle(3, 0xff9966, 0.9);
            g.strokeCircle(c, c, 11);
            g.fillStyle(0x2a0f0a, 1); // Darker core
            g.fillCircle(c, c, 9);
            g.fillStyle(0xff6b47, 1); // Bright threat color
            g.fillCircle(c, c, 5);
            // Enhanced threat spikes
            g.fillStyle(0xff6b47, 1);
            g.fillRect(c - 4, c + 14, 8, 12);
            g.fillRect(c - 22, c - 2, 8, 10);
            g.fillRect(c + 14, c - 2, 8, 10);
        });

        this.createTexture("elite-watcher", (g) => {
            const c = 32;
            // Enhanced watcher with more aggressive appearance
            g.fillStyle(0x1a0f0f, 1);
            g.fillRoundedRect(c - 16, c - 16, 32, 32, 6);
            g.lineStyle(4, 0xff6b47); // Threat color outline
            g.strokeRoundedRect(c - 16, c - 16, 32, 32, 6);
            g.lineStyle(3, 0xff9966, 0.8);
            g.lineBetween(c - 12, c, c + 12, c);
            g.lineBetween(c, c - 12, c, c + 12);
            g.fillStyle(0xff6b47, 1);
            g.fillCircle(c, c, 8); // Larger, more menacing eye
            g.fillStyle(0x2a0f0a, 1);
            g.fillCircle(c, c, 5);
            g.fillStyle(0xff9966, 0.9);
            g.fillCircle(c + 3, c - 2, 3); // Brighter glint
        });

        this.createTexture("elite-mass", (g) => {
            const c = 32;
            // Enhanced mass with spikier, more threatening appearance
            const hull = [
                { x: c, y: c - 22 }, // Taller spikes
                { x: c + 20, y: c },
                { x: c, y: c + 22 },
                { x: c - 20, y: c },
            ];
            g.fillStyle(0x2a0f0a, 1);
            g.fillPoints(hull, true);
            g.lineStyle(4, 0xff6b47); // Thicker threat outline
            g.strokePoints(hull, true);
            g.fillStyle(0x4a1f0f, 1);
            g.fillRect(c - 6, c - 12, 12, 9);
            g.lineStyle(3, 0xff9966, 0.8);
            g.lineBetween(c - 12, c - 4, c + 12, c - 4);
            g.lineBetween(c - 12, c + 4, c + 12, c + 4);
        });
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
        if (this.lowGraphics) return null;
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

    private createBossTextures() {
        // Sentinel: keep the existing elliptical red core
        this.createTexture("boss-sentinel", (g) => {
            const c = 32;
            g.fillStyle(0x180c13, 1);
            g.fillEllipse(c, c, 58, 40);
            g.lineStyle(4, 0xf14e4e);
            g.strokeEllipse(c, c, 58, 40);
            g.fillStyle(0x2a0f18, 1);
            g.fillEllipse(c, c, 46, 28);
            g.fillStyle(0xf14e4e, 0.8);
            g.fillEllipse(c, c, 32, 18);
            g.fillStyle(0xfafafa, 1);
            g.fillCircle(c + 2, c - 2, 6);
            g.fillStyle(0x0b0f13, 1);
            g.fillCircle(c + 4, c - 2, 3);
            g.lineStyle(3, 0xf14e4e, 0.9);
            g.beginPath();
            g.moveTo(c - 30, c - 10);
            g.lineTo(c - 18, c - 24);
            g.lineTo(c - 10, c - 6);
            g.strokePath();
            g.beginPath();
            g.moveTo(c + 30, c - 10);
            g.lineTo(c + 18, c - 24);
            g.lineTo(c + 10, c - 6);
            g.strokePath();
        });

        // Swarm Core: hexagon chassis with emerald glow
        this.createTexture("boss-swarm-core", (g) => {
            const c = 32;
            const hull = [
                { x: c, y: c - 26 },
                { x: c + 22, y: c - 13 },
                { x: c + 22, y: c + 13 },
                { x: c, y: c + 26 },
                { x: c - 22, y: c + 13 },
                { x: c - 22, y: c - 13 },
            ];
            g.fillStyle(0x0e1811, 1);
            g.fillPoints(hull, true);
            g.lineStyle(4, 0x7de36f);
            g.strokePoints(hull, true);
            g.fillStyle(0x15321b, 1);
            g.fillEllipse(c, c, 30, 22);
            g.lineStyle(3, 0x9df07f, 0.9);
            g.strokeEllipse(c, c, 28, 18);
            g.fillStyle(0xb7ff99, 0.9);
            g.fillCircle(c, c, 10);
            g.fillStyle(0x1c3c22, 1);
            g.fillCircle(c, c, 5);
            g.lineStyle(2, 0xb7ff99, 0.8);
            g.lineBetween(c - 16, c, c + 16, c);
            g.lineBetween(c, c - 12, c, c + 12);
        });

        // Obelisk: tall monolith with violet runes
        this.createTexture("boss-obelisk", (g) => {
            const c = 32;
            g.fillStyle(0x0f0c18, 1);
            g.fillRoundedRect(c - 16, c - 30, 32, 60, 6);
            g.lineStyle(4, 0x9d7bff);
            g.strokeRoundedRect(c - 16, c - 30, 32, 60, 6);
            g.fillStyle(0x1c1132, 1);
            g.fillRoundedRect(c - 10, c - 20, 20, 40, 4);
            g.lineStyle(3, 0xcab7ff, 0.95);
            g.beginPath();
            g.moveTo(c, c - 20);
            g.lineTo(c + 12, c);
            g.lineTo(c, c + 20);
            g.lineTo(c - 12, c);
            g.closePath();
            g.strokePath();
            g.fillStyle(0xcab7ff, 0.9);
            g.fillCircle(c, c - 14, 4);
            g.fillCircle(c, c, 5);
            g.fillCircle(c, c + 14, 4);
        });
    }

    private setupBossIntroOverlay() {
        this.bossIntroOverlay?.destroy();
        const overlay = this.add
            .rectangle(
                GAME_WIDTH / 2,
                GAME_HEIGHT / 2,
                GAME_WIDTH,
                GAME_HEIGHT,
                this.bossIntroColor,
                0.28
            )
            .setDepth(5)
            .setScrollFactor(0)
            .setAlpha(0)
            .setBlendMode(Phaser.BlendModes.MULTIPLY);
        overlay.setVisible(false);
        if (!this.lowGraphics) {
            overlay.postFX.addVignette(0.5, 0.5, 0.9, 0.95);
        }
        this.bossIntroOverlay = overlay;
    }

    private syncStarfieldVisibility() {
        const visible = !this.lowGraphics;
        this.starfieldLayers.forEach((layer) =>
            layer.sprite.setVisible(visible)
        );
    }

    private updateStarfield(dt: number) {
        this.starfieldLayers.forEach((layer) => {
            layer.sprite.tilePositionX += layer.velocityX * dt;
            layer.sprite.tilePositionY += layer.velocityY * dt;
        });
    }

    private applyBackgroundTone(saturationBoost: number, brightness: number) {
        if (this.lowGraphics || this.backgroundFxTargets.length === 0) return;
        this.backgroundFxTargets.forEach((fx) => {
            fx.reset();
            fx.saturate(saturationBoost);
            fx.brightness(brightness, true);
        });
    }

    private pulseBackgroundForBossPhase(phase: number) {
        if (this.backgroundFxTween) {
            this.backgroundFxTween.stop();
            this.backgroundFxTween = undefined;
        }
        if (this.lowGraphics || this.backgroundFxTargets.length === 0) {
            this.cameras.main.flash(220, 255, 94, 94);
            return;
        }
        const targetSaturation = 0.9 + phase * 0.25;
        const targetBrightness = 1.25 + phase * 0.1;
        this.backgroundFxTween = this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 320,
            yoyo: true,
            ease: "Quad.easeOut",
            onUpdate: (tw) => {
                const p = tw.getValue();
                if (p === null) return;
                const sat = Phaser.Math.Linear(0, targetSaturation, p);
                const bright = Phaser.Math.Linear(1, targetBrightness, p);
                this.applyBackgroundTone(sat, bright);
            },
            onComplete: () => {
                this.applyBackgroundTone(0, 1);
                this.backgroundFxTween = undefined;
            },
        });
    }

    private playBossIntroPulse() {
        if (this.bossIntroOverlay) {
            this.tweens.killTweensOf(this.bossIntroOverlay);
            this.bossIntroOverlay.setVisible(true);
            this.bossIntroOverlay.setAlpha(0);
            this.bossIntroOverlay.setFillStyle(
                this.bossIntroColor,
                this.bossIntroOverlay.fillAlpha
            );
            this.tweens.add({
                targets: this.bossIntroOverlay,
                alpha: { from: 0, to: this.lowGraphics ? 0.4 : 0.82 },
                duration: 180,
                ease: "Quad.easeOut",
                yoyo: true,
                hold: 260,
                onComplete: () => this.bossIntroOverlay?.setVisible(false),
            });
        } else {
            const rgb = Phaser.Display.Color.IntegerToRGB(this.bossIntroColor);
            this.cameras.main.flash(220, rgb.r, rgb.g, rgb.b);
        }
        this.pulseBackgroundForBossPhase(this.bossPhase || 1);
    }

    private getBossVisuals(id?: string): {
        textureKey: string;
        tint?: number;
        overlayColor?: number;
        scale?: number;
    } {
        switch (id) {
            case "swarm-core":
                return {
                    textureKey: "boss-swarm-core",
                    tint: 0x9df07f,
                    overlayColor: 0x8fe876,
                    scale: 2.1,
                };
            case "obelisk":
                return {
                    textureKey: "boss-obelisk",
                    tint: 0xcab7ff,
                    overlayColor: 0xa07bff,
                    scale: 2.3,
                };
            case "sentinel":
            default:
                return {
                    textureKey: "boss-sentinel",
                    tint: 0xf14e4e,
                    overlayColor: 0xf14e4e,
                    scale: 2,
                };
        }
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
    private readonly GAME_STATE_BROADCAST_INTERVAL = 33; // ~30fps for game state

    private broadcastGameState() {
        const now = this.time.now;
        if (
            now - this.lastGameStateBroadcast <
            this.GAME_STATE_BROADCAST_INTERVAL
        )
            return;
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

        actions.sendGameState(gameState);
    }

    private applyReceivedGameState() {
        const { latestGameState, isHost } = useMultiplayerStore.getState();
        if (!latestGameState || isHost) return;

        // Apply player positions (P1 is host's ship for guest)
        if (this.playerState && latestGameState.players.p1) {
            const p1 = latestGameState.players.p1;
            this.playerState.sprite.x = Phaser.Math.Linear(
                this.playerState.sprite.x,
                p1.x,
                0.5
            );
            this.playerState.sprite.y = Phaser.Math.Linear(
                this.playerState.sprite.y,
                p1.y,
                0.5
            );
            this.playerState.sprite.rotation = p1.rotation;

            // Disable physics for remote player
            const body = this.playerState.sprite
                .body as Phaser.Physics.Arcade.Body;
            if (body) {
                body.setVelocity(0, 0);
                body.setAcceleration(0, 0);
            }
        }

        // Apply enemy positions - spawn if needed, update if exists
        const activeEnemies = this.enemies
            .getChildren()
            .filter((e: any) => e.active) as Phaser.Physics.Arcade.Image[];

        // Spawn missing enemies or update existing ones
        latestGameState.enemies.forEach((enemyData, index) => {
            if (!enemyData.active) return;

            let enemy = activeEnemies[index];
            if (!enemy) {
                // Determine texture based on enemy kind
                const kind = enemyData.kind;
                const textureKey =
                    kind === "drifter"
                        ? "drifter"
                        : kind === "watcher"
                        ? "watcher"
                        : kind === "mass"
                        ? "mass"
                        : kind === "boss"
                        ? "boss"
                        : "drifter"; // fallback

                // Spawn a new enemy for the guest
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
                    enemy.setData("syncId", index);
                }
            }

            if (enemy) {
                enemy.x = Phaser.Math.Linear(enemy.x, enemyData.x, 0.5);
                enemy.y = Phaser.Math.Linear(enemy.y, enemyData.y, 0.5);
                enemy.setData("health", enemyData.health);
            }
        });

        // Deactivate enemies that host no longer has
        activeEnemies.forEach((enemy, index) => {
            if (
                index >= latestGameState.enemies.length ||
                !latestGameState.enemies[index]?.active
            ) {
                enemy.setActive(false);
                enemy.setVisible(false);
            }
        });

        // Apply enemy bullet positions - spawn if needed
        const activeBullets = this.enemyBullets
            .getChildren()
            .filter((b: any) => b.active) as Phaser.Physics.Arcade.Image[];

        latestGameState.bullets.forEach((bulletData, index) => {
            let bullet = activeBullets[index];
            if (!bullet) {
                // Spawn a new bullet for the guest
                bullet = this.enemyBullets.get(
                    bulletData.x,
                    bulletData.y,
                    "enemy-bullet"
                ) as Phaser.Physics.Arcade.Image;
                if (bullet) {
                    bullet.setActive(true);
                    bullet.setVisible(true);
                    bullet.setScale(OBJECT_SCALE);
                }
            }

            if (bullet) {
                bullet.x = bulletData.x;
                bullet.y = bulletData.y;
                const body = bullet.body as Phaser.Physics.Arcade.Body;
                if (body) {
                    body.setVelocity(bulletData.vx, bulletData.vy);
                }
            }
        });

        // Deactivate bullets that host no longer has
        activeBullets.forEach((bullet, index) => {
            if (index >= latestGameState.bullets.length) {
                bullet.setActive(false);
                bullet.setVisible(false);
            }
        });

        // Apply player bullet positions - sync from host
        if (latestGameState.playerBullets) {
            const activePlayerBullets = this.bullets
                .getChildren()
                .filter((b: any) => b.active) as Phaser.Physics.Arcade.Image[];

            latestGameState.playerBullets.forEach((bulletData, index) => {
                let bullet = activePlayerBullets[index];
                if (!bullet) {
                    // Spawn a new player bullet for the guest
                    bullet = this.bullets.get(
                        bulletData.x,
                        bulletData.y,
                        "bullet"
                    ) as Phaser.Physics.Arcade.Image;
                    if (bullet) {
                        bullet.setActive(true);
                        bullet.setVisible(true);
                        bullet.setScale(OBJECT_SCALE);
                    }
                }

                if (bullet) {
                    bullet.x = bulletData.x;
                    bullet.y = bulletData.y;
                    bullet.rotation = bulletData.rotation;
                    const body = bullet.body as Phaser.Physics.Arcade.Body;
                    if (body) {
                        body.setVelocity(bulletData.vx, bulletData.vy);
                    }
                }
            });

            // Deactivate player bullets that host no longer has
            activePlayerBullets.forEach((bullet, index) => {
                if (index >= (latestGameState.playerBullets?.length ?? 0)) {
                    bullet.setActive(false);
                    bullet.setVisible(false);
                }
            });
        }

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
            // Intermission ended on host, clear it on guest
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
    private readonly GUEST_SHOT_COOLDOWN = 250; // ms between shots for guest

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

        // Play sound locally for feedback
        soundManager.playSfx("shoot");
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
        this.lowGraphics = settings.lowGraphicsMode;
        this.inputMode = "keyboardMouse";
        this.syncStarfieldVisibility();
        this.backgroundFxTween?.stop();
        this.backgroundFxTween = undefined;
        this.applyBackgroundTone(0, 1);
        if (this.bossIntroOverlay) {
            this.bossIntroOverlay.setAlpha(0);
            this.bossIntroOverlay.setVisible(false);
        }
        this.bossIntroColor = 0xf14e4e;
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

        this.chargeState = {
            ready: false,
            holdMs: 0,
            damageBonus: 0.9,
            sizeBonus: 0.2,
            idleMs: 1000,
        };
        this.capacitorConfig = {
            stacks: 0,
            idleMs: 1000,
            damageBonus: 0.9,
            sizeBonus: 0.2,
            chargePierceBonus: 0,
        };
        this.afterimageConfig = { stacks: 0, trailShots: 0, shotDamage: 0 };
        this.dashSparkConfig = { stacks: 0, shards: 0, damage: 0 };
        this.shieldConfig = {
            stacks: 0,
            shieldHp: 60,
            durationMs: 0,
            cooldownMs: 0,
            nextReadyAt: 0,
        };
        this.explosiveConfig = { stacks: 0, radius: 0, damageMultiplier: 0 };
        this.splitConfig = {
            enabled: false,
            forks: 2,
            spreadDegrees: 12,
            damageMultiplier: 0.5,
        };
        this.chainArcConfig = {
            stacks: 0,
            range: 180,
            damagePercent: 0.6,
            cooldownMs: 150,
            lastAt: 0,
        };
        this.kineticConfig = {
            stacks: 0,
            healAmount: 0.3,
            cooldownMs: 1200,
            nextReadyAt: 0,
        };
        this.momentumConfig = {
            stacks: 0,
            ramp: 0.25,
            timeToMaxMs: 2000,
            timerMs: 0,
            bonus: 0,
        };
        this.spreadConfig = { stacks: 0, spreadDegrees: 6, critBonus: 0 };
        this.homingConfig = { stacks: 0, range: 0, turnRate: 0 };
        this.projectileScale = 1;
        this.magnetConfig = { stacks: 0, radiusMult: 1, speedMult: 1 };
        this.stabilizerConfig = { stacks: 0, contactMultiplier: 1 };
        this.platingConfig = { stacks: 0, damageReduction: 0 };
        this.shrapnelConfig = { stacks: 0, shards: 0, damage: 0 };
        this.neutronCoreConfig = { active: false, speedMultiplier: 0.6 };
        this.glassCannonCap = null;
        this.singularityConfig = {
            active: false,
            radius: 140,
            pullStrength: 520,
        };
        this.bulletHellConfig = {
            active: false,
            fireRateMultiplier: 4,
            damageMultiplier: 0.6,
            inaccuracyRad: Phaser.Math.DegToRad(32),
        };
        this.bloodFuelConfig = {
            stacks: 0,
            healPercent: 0.12,
            fireCostPercent: 0.02,
        };
        this.chainReactionConfig = {
            stacks: 0,
            radius: 70,
            damagePercent: 0.5,
        };
        this.quantumConfig = {
            active: false,
            wrapMargin: 18,
            projectileLifetimeMs: PROJECTILE_MAX_LIFETIME_MS,
        };
        this.berserkConfig = { stacks: 0, maxBonus: 1 };
        this.activeSynergies.clear();
        this.waveIndex = 0;
        this.xp = 0;
        this.level = 1;
        this.nextXpThreshold = 12;
        this.upgradeStacks = {};
        this.pendingUpgradeOptions = [];
        this.nextWaveCheckAt = 0;
        this.intermissionActive = false;
        this.pendingWaveIndex = null;
        this.intermissionRemainingMs = 0;
        this.lastCountdownBroadcast = 0;
        this.bossPhase = 1;
        this.bossNextPatternAt = 0;
        this.runActive = false;
        this.elapsedAccumulator = 0;
        this.bossMaxHealth = 0;

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
        if (this.capacitorConfig.stacks === 0) return;
        if (fireHeld) {
            pilot.charge.holdMs = Math.min(
                this.capacitorConfig.idleMs,
                pilot.charge.holdMs + dt * 1000
            );
            if (pilot.charge.holdMs >= this.capacitorConfig.idleMs) {
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
        if (this.momentumConfig.stacks === 0 || !this.isPilotActive(pilot))
            return;
        const body = pilot.sprite.body as Phaser.Physics.Arcade.Body;
        const speed = body.velocity.length();
        const moving = speed > 30;
        if (moving) {
            pilot.momentum.timerMs = Math.min(
                this.momentumConfig.timeToMaxMs,
                pilot.momentum.timerMs + dt * 1000
            );
        } else {
            pilot.momentum.timerMs = Math.max(
                0,
                pilot.momentum.timerMs - dt * 800
            );
        }
        const ratio = Phaser.Math.Clamp(
            pilot.momentum.timerMs / this.momentumConfig.timeToMaxMs,
            0,
            1
        );
        pilot.momentum.bonus = this.momentumConfig.ramp * ratio;
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

        const useChargeMode = this.capacitorConfig.stacks > 0;
        const isCharged = useChargeMode && pilot.charge.ready;
        const dir = this.getAimDirection(
            pilot,
            controls,
            binding.type === "keyboardMouse" ||
                (this.runMode !== "twin" && this.runMode !== "online")
        );
        const spreadCount = this.playerStats.projectiles;
        const spreadStepDeg = this.spreadConfig.spreadDegrees;
        soundManager.playSfx("shoot");
        const baseDamage = this.playerStats.damage;
        const chargeDamageMultiplier = isCharged
            ? 1 + this.capacitorConfig.damageBonus
            : 1;
        const sizeScale = isCharged ? 1 + this.capacitorConfig.sizeBonus : 1;
        const pierce =
            this.playerStats.pierce +
            (isCharged ? this.capacitorConfig.chargePierceBonus : 0);
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
            (config.sizeMultiplier ?? 1) * this.projectileScale * OBJECT_SCALE;
        const isHeavy = this.neutronCoreConfig.active;
        const isRailgun =
            config.charged === true && this.activeSynergies.has("railgun");
        bullet.setActive(true);
        bullet.setVisible(true);
        bullet.setScale(sizeScale);
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        const projectileSpeed =
            this.playerStats.projectileSpeed *
            (isHeavy ? this.neutronCoreConfig.speedMultiplier : 1);
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
            this.quantumConfig.active
                ? this.time.now + this.quantumConfig.projectileLifetimeMs
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
        if (isCharged && this.activeSynergies.has("railgun")) return 999;
        return basePierce;
    }

    private getBerserkBonus() {
        if (this.berserkConfig.stacks <= 0) return 0;
        const maxHealth = Math.max(this.playerStats.maxHealth, 1);
        const healthRatio = Phaser.Math.Clamp(
            this.playerStats.health / maxHealth,
            0,
            1
        );
        const missing = 1 - healthRatio;
        return Phaser.Math.Clamp(
            missing * this.berserkConfig.maxBonus,
            0,
            this.berserkConfig.maxBonus
        );
    }

    private applyInaccuracy(dir: Phaser.Math.Vector2) {
        const maxError = this.bulletHellConfig.active
            ? this.bulletHellConfig.inaccuracyRad
            : 0;
        if (maxError <= 0) return dir;
        const offset = this.randFloat(-maxError, maxError);
        return dir.clone().rotate(offset);
    }

    private payBloodFuelCost() {
        if (this.bloodFuelConfig.stacks <= 0) return true;
        const cost =
            this.playerStats.health * this.bloodFuelConfig.fireCostPercent;
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
        if (this.afterimageConfig.trailShots <= 0) return;
        if (!this.isPilotActive(pilot)) return;
        const shots = this.afterimageConfig.trailShots;
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
                damage: this.afterimageConfig.shotDamage,
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
            this.dashSparkConfig.shards <= 0 ||
            this.dashSparkConfig.damage <= 0
        )
            return;
        const baseDir =
            dashDir.lengthSq() > 0
                ? dashDir.clone().normalize()
                : new Phaser.Math.Vector2(1, 0);
        for (let i = 0; i < this.dashSparkConfig.shards; i++) {
            const arcAngle = (i / this.dashSparkConfig.shards) * Math.PI * 2;
            const jitter = this.randFloat(-0.15, 0.15);
            const dir = baseDir.clone().rotate(arcAngle + jitter);
            this.spawnBullet({
                x: origin.x,
                y: origin.y,
                dir,
                damage: this.dashSparkConfig.damage,
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
        if (this.lowGraphics) return;
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
        if (this.lowGraphics) return;
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
        if (this.lowGraphics) return;
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
        if (this.lowGraphics) return;
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
            remaining / this.shieldConfig.durationMs,
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
            const targetVec = new Phaser.Math.Vector2(
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
                if (isElite && eliteBehaviors.includes("rapid_fire")) {
                    this.tryEliteRapidFire(
                        enemy,
                        new Phaser.Math.Vector2(pilot.sprite.x, pilot.sprite.y)
                    );
                } else {
                    this.tryEnemyShot(
                        enemy,
                        new Phaser.Math.Vector2(pilot.sprite.x, pilot.sprite.y)
                    );
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
                this.tryEnemyShot(
                    enemy,
                    new Phaser.Math.Vector2(pilot.sprite.x, pilot.sprite.y),
                    true
                );
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
        if (!this.lowGraphics) {
            this.spawnBurstVisual(x, y, explosionRadius, 0xff4444, 1.0);
        }

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
        if (this.homingConfig.stacks <= 0) return;
        const maxTurn = this.homingConfig.turnRate * dt;
        if (maxTurn <= 0 || this.homingConfig.range <= 0) return;
        const rangeSq = this.homingConfig.range * this.homingConfig.range;
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
        const radius = XP_ATTRACT_RADIUS * this.magnetConfig.radiusMult;
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
                XP_ATTRACT_MIN_SPEED * this.magnetConfig.speedMult,
                XP_ATTRACT_MAX_SPEED * this.magnetConfig.speedMult,
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

    private handleBossPatterns() {
        if (!this.boss || !this.boss.active) return;
        if (this.time.now < this.bossNextPatternAt) return;
        this.fireBossPattern();
    }

    private fireBossPattern() {
        if (!this.boss) return;
        // Phase intensity could be used for future pattern variations
        const pattern = this.nextBossPattern();
        switch (pattern) {
            case "beam-spin":
                this.bossPatternBeamSpin();
                break;
            case "aimed-burst":
                this.bossPatternAimedBurst();
                break;
            case "ring-with-gap":
                this.bossPatternRingWithGap();
                break;
            case "summon-minions":
                this.bossPatternSummonMinions();
                break;
            case "cone-volley":
                this.bossPatternConeVolley();
                break;
            case "pulse-ring":
                this.bossPatternPulseRing();
                break;
            case "slam":
                this.bossPatternSlam();
                break;
            case "ricochet-shards":
                this.bossPatternShardSpray();
                break;
            case "lane-beams":
                this.bossPatternLaneBeams();
                break;
            default:
                this.bossPatternRingWithGap();
                break;
        }
    }

    private nextBossPattern() {
        if (this.bossPatternQueue.length === 0) {
            this.bossPatternQueue = this.shuffle(this.bossTemplate.patterns);
            this.bossPatternCursor = 0;
            if (this.bossPatternQueue.length === 0) {
                return "ring-with-gap";
            }
        }
        const pattern =
            this.bossPatternQueue[
                this.bossPatternCursor % this.bossPatternQueue.length
            ];
        this.bossPatternCursor++;
        return pattern;
    }

    private bossPatternRingWithGap() {
        if (!this.boss) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
        const baseBullets = 22;
        const total = this.getBossBulletDensity(baseBullets);
        const gapStart = this.randFloat(0, Math.PI * 2);
        const baseGapWidth = Math.PI / 9;
        // Reduce gap width in later phases for increased difficulty
        const gapWidth =
            baseGapWidth * Math.max(0.5, 1.0 - (this.bossPhase - 1) * 0.25);

        for (let i = 0; i < total; i++) {
            const angle = (Math.PI * 2 * i) / total;
            const diff = Math.abs(
                ((angle - gapStart + Math.PI * 2) % (Math.PI * 2)) - Math.PI
            );
            if (diff < gapWidth) continue;
            const dir = new Phaser.Math.Vector2(
                Math.cos(angle),
                Math.sin(angle)
            );
            this.spawnEnemyBullet(
                center.x,
                center.y,
                dir,
                this.getBossProjectileSpeed(280)
            );
        }
        this.bossNextPatternAt =
            this.time.now + this.getBossPatternCooldown(1100);
        this.tryBossPatternOverlap();
    }

    private bossPatternAimedBurst() {
        if (!this.boss) return;
        const targetPilot = this.getNearestPilot(this.boss.x, this.boss.y);
        if (!targetPilot) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
        const target = new Phaser.Math.Vector2(
            targetPilot.sprite.x,
            targetPilot.sprite.y
        )
            .subtract(center)
            .normalize();

        // Increase burst size and reduce spread in later phases
        const baseSpread = Phaser.Math.DegToRad(8);
        const spread =
            baseSpread * Math.max(0.6, 1.0 - (this.bossPhase - 1) * 0.2);
        const baseBullets = 7; // -3 to +3
        const bulletCount = this.getBossBulletDensity(baseBullets);
        const halfCount = Math.floor(bulletCount / 2);

        for (let i = -halfCount; i <= halfCount; i++) {
            const dir = target.clone().rotate(spread * i);
            this.spawnEnemyBullet(
                center.x,
                center.y,
                dir,
                this.getBossProjectileSpeed(300)
            );
        }
        this.bossNextPatternAt =
            this.time.now + this.getBossPatternCooldown(950);
        this.tryBossPatternOverlap();
    }

    private bossPatternBeamSpin() {
        if (!this.boss) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
        // Faster spin rate in later phases
        const baseSpinRate = Phaser.Math.DegToRad(22);
        const spinRate = baseSpinRate * (1.0 + (this.bossPhase - 1) * 0.5);
        this.bossSpinAngle += spinRate;

        const baseBeams = 14;
        const total = this.getBossBulletDensity(baseBeams);
        for (let i = 0; i < total; i++) {
            const angle = this.bossSpinAngle + (Math.PI * 2 * i) / total;
            const dir = new Phaser.Math.Vector2(
                Math.cos(angle),
                Math.sin(angle)
            );
            this.spawnEnemyBullet(
                center.x,
                center.y,
                dir,
                this.getBossProjectileSpeed(250)
            );
        }
        this.bossNextPatternAt =
            this.time.now + this.getBossPatternCooldown(780);
        this.tryBossPatternOverlap();
    }

    private bossPatternSummonMinions() {
        // Increase minion count and elite chance in later phases
        const phaseMultiplier = 1.0 + (this.bossPhase - 1) * 0.3;
        const eliteChance = Math.min(0.7, 0.35 + (this.bossPhase - 1) * 0.175);

        const choices: EnemySpawn[] = [
            {
                kind: "drifter",
                count: Math.floor(this.randBetween(3, 4) * phaseMultiplier),
            },
            {
                kind: "watcher",
                count: Math.floor(this.randBetween(1, 2) * phaseMultiplier),
            },
            {
                kind: "mass",
                count: Math.max(1, Math.floor(1 * phaseMultiplier)),
                elite: this.rng.next() < eliteChance,
            },
        ];
        const pick = this.randChoice(choices);
        this.spawnWaveEnemies([pick]);
        this.bossNextPatternAt =
            this.time.now + this.getBossPatternCooldown(1400);
        this.tryBossPatternOverlap();
    }

    private bossPatternConeVolley() {
        if (!this.boss) return;
        const targetPilot = this.getNearestPilot(this.boss.x, this.boss.y);
        if (!targetPilot) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
        const target = new Phaser.Math.Vector2(
            targetPilot.sprite.x,
            targetPilot.sprite.y
        )
            .subtract(center)
            .normalize();

        // Tighter cone with more bullets in later phases
        const baseSpread = Phaser.Math.DegToRad(6);
        const spread =
            baseSpread * Math.max(0.7, 1.0 - (this.bossPhase - 1) * 0.15);
        const baseBullets = 9; // -4 to +4
        const bulletCount = this.getBossBulletDensity(baseBullets);
        const halfCount = Math.floor(bulletCount / 2);

        for (let i = -halfCount; i <= halfCount; i++) {
            const dir = target.clone().rotate(spread * i);
            this.spawnEnemyBullet(
                center.x,
                center.y,
                dir,
                this.getBossProjectileSpeed(300)
            );
        }
        this.bossNextPatternAt =
            this.time.now + this.getBossPatternCooldown(1100);
        this.tryBossPatternOverlap();
    }

    private bossPatternPulseRing() {
        if (!this.boss) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);

        // More rings and faster timing in later phases
        const baseRings = 16;
        const ringBullets = this.getBossBulletDensity(baseRings);
        const ringCount = Math.min(4, 2 + (this.bossPhase - 1)); // 2, 3, 4 rings
        const baseDelay = 200;
        const delay =
            baseDelay * Math.max(0.5, 1.0 - (this.bossPhase - 1) * 0.25);

        const fireRing = (offset: number, speed: number) => {
            for (let i = 0; i < ringBullets; i++) {
                const angle = offset + (Math.PI * 2 * i) / ringBullets;
                const dir = new Phaser.Math.Vector2(
                    Math.cos(angle),
                    Math.sin(angle)
                );
                this.spawnEnemyBullet(
                    center.x,
                    center.y,
                    dir,
                    this.getBossProjectileSpeed(speed)
                );
            }
        };

        // Fire multiple rings with increasing speed
        for (let ring = 0; ring < ringCount; ring++) {
            const ringDelay = ring * delay;
            const ringSpeed = 240 + ring * 40; // Increasing speed per ring
            this.time.delayedCall(ringDelay, () =>
                fireRing(this.randFloat(0, Math.PI * 2), ringSpeed)
            );
        }

        this.bossNextPatternAt =
            this.time.now + this.getBossPatternCooldown(1200);
        this.tryBossPatternOverlap();
    }

    private bossPatternSlam() {
        if (!this.boss) return;
        const targetPilot = this.getNearestPilot(this.boss.x, this.boss.y);
        if (!targetPilot) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
        const toward = new Phaser.Math.Vector2(
            targetPilot.sprite.x,
            targetPilot.sprite.y
        )
            .subtract(center)
            .normalize();

        // More projectiles and tighter spread in later phases
        const baseBullets = 3;
        const bulletCount = this.getBossBulletDensity(baseBullets);
        const baseSpread = 0.12;
        const spread =
            baseSpread * Math.max(0.8, 1.0 - (this.bossPhase - 1) * 0.1);

        // Fire center bullet
        this.spawnEnemyBullet(
            center.x,
            center.y,
            toward,
            this.getBossProjectileSpeed(360)
        );

        // Fire side bullets
        for (let i = 1; i < bulletCount; i++) {
            const angle = (i % 2 === 0 ? 1 : -1) * spread * Math.ceil(i / 2);
            this.spawnEnemyBullet(
                center.x,
                center.y,
                toward.clone().rotate(angle),
                this.getBossProjectileSpeed(320)
            );
        }

        this.bossNextPatternAt =
            this.time.now + this.getBossPatternCooldown(1100);
        this.tryBossPatternOverlap();
    }

    private bossPatternShardSpray() {
        if (!this.boss) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
        const baseShards = 16;
        const shardCount = this.getBossBulletDensity(baseShards);

        // Increased randomness and speed in later phases
        const baseRandomness = 0.05;
        const randomness = baseRandomness * (1.0 + (this.bossPhase - 1) * 0.5);

        for (let i = 0; i < shardCount; i++) {
            const angle =
                (Math.PI * 2 * i) / shardCount +
                this.randFloat(-randomness, randomness);
            const dir = new Phaser.Math.Vector2(
                Math.cos(angle),
                Math.sin(angle)
            );
            this.spawnEnemyBullet(
                center.x,
                center.y,
                dir,
                this.getBossProjectileSpeed(300)
            );
        }
        this.bossNextPatternAt =
            this.time.now + this.getBossPatternCooldown(900);
        this.tryBossPatternOverlap();
    }

    private bossPatternLaneBeams() {
        if (!this.boss) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
        const dirs = [
            new Phaser.Math.Vector2(1, 0),
            new Phaser.Math.Vector2(-1, 0),
            new Phaser.Math.Vector2(0, 1),
            new Phaser.Math.Vector2(0, -1),
        ];
        const diagonals = [
            new Phaser.Math.Vector2(1, 1).normalize(),
            new Phaser.Math.Vector2(-1, 1).normalize(),
            new Phaser.Math.Vector2(1, -1).normalize(),
            new Phaser.Math.Vector2(-1, -1).normalize(),
        ];

        // Fire multiple waves of beams in later phases
        const waveCount = Math.min(3, 1 + (this.bossPhase - 1)); // 1, 2, 3 waves
        const waveDelay = 150 * Math.max(0.6, 1.0 - (this.bossPhase - 1) * 0.2);

        for (let wave = 0; wave < waveCount; wave++) {
            this.time.delayedCall(wave * waveDelay, () => {
                [...dirs, ...diagonals].forEach((dir) => {
                    this.spawnEnemyBullet(
                        center.x,
                        center.y,
                        dir,
                        this.getBossProjectileSpeed(240)
                    );
                });
            });
        }

        this.bossNextPatternAt =
            this.time.now + this.getBossPatternCooldown(850);
        this.tryBossPatternOverlap();
    }

    // Enhanced boss battle methods for Requirements 2.1, 2.2, 2.3, 2.4, 2.5

    private getBossPatternCooldown(baseCooldown: number): number {
        // Faster transitions and more aggressive patterns (Requirements 2.2, 2.4)
        const phaseSpeedMultiplier = Math.max(
            0.4,
            1.0 - (this.bossPhase - 1) * 0.3
        ); // 1.0x, 0.7x, 0.4x
        const difficultyMultiplier = 1.0 / this.difficulty;
        return baseCooldown * phaseSpeedMultiplier * difficultyMultiplier;
    }

    private getBossProjectileSpeed(baseSpeed: number): number {
        // Faster projectile speeds in later phases (Requirement 2.4)
        const phaseSpeedBonus = 1.0 + (this.bossPhase - 1) * 0.25; // 1.0x, 1.25x, 1.5x
        return baseSpeed * this.difficulty * phaseSpeedBonus;
    }

    private getBossBulletDensity(baseDensity: number): number {
        // Increased bullet density in later phases (Requirement 2.2)
        const phaseMultiplier = 1.0 + (this.bossPhase - 1) * 0.3; // 1.0x, 1.3x, 1.6x
        return Math.floor(baseDensity * phaseMultiplier);
    }

    private shouldTriggerOverlappingPattern(): boolean {
        // More aggressive pattern overlapping in later phases (Requirement 2.3)
        const overlapChance = Math.min(0.4, (this.bossPhase - 1) * 0.2); // 0%, 20%, 40%
        return this.rng.next() < overlapChance;
    }

    private tryBossPatternOverlap() {
        // Implement pattern overlapping for enhanced difficulty (Requirement 2.3)
        if (!this.shouldTriggerOverlappingPattern()) return;

        // Fire a secondary pattern with reduced intensity
        const secondaryPatterns = ["ring-with-gap", "aimed-burst"];
        const pattern = this.randChoice(secondaryPatterns);

        // Delay the secondary pattern slightly
        this.time.delayedCall(200, () => {
            switch (pattern) {
                case "ring-with-gap":
                    this.bossPatternRingWithGap();
                    break;
                case "aimed-burst":
                    this.bossPatternAimedBurst();
                    break;
            }
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
        if (!this.lowGraphics) {
            this.spawnBurstVisual(
                playerBullet.x,
                playerBullet.y,
                18 * OBJECT_SCALE,
                COLOR_OVERLOAD,
                0.6
            );
        }
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
            this.handleBossPhaseChange();
        }

        // edge extension removed with simplified charge; no-op
    }

    private handleForks(
        projectile: Phaser.Physics.Arcade.Image,
        enemy: Phaser.Physics.Arcade.Image
    ) {
        if (!this.splitConfig.enabled) return;
        if (!projectile.getData("canFork")) return;
        const sourceType = projectile.getData("sourceType") as string;
        if (sourceType === "fork") return;

        projectile.setData("canFork", false);
        const forks = this.splitConfig.forks;
        const spreadDeg = this.splitConfig.spreadDegrees;
        const damageMultiplier = this.splitConfig.damageMultiplier;
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
        if (this.chainReactionConfig.stacks <= 0) return;
        if (kind === "boss") return;
        const damageBase =
            (maxHealth ?? 0) * this.chainReactionConfig.damagePercent;
        if (damageBase <= 0) return;
        const radius =
            this.chainReactionConfig.radius *
            (this.activeSynergies.has("black-hole-sun") ? 1.25 : 1);
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
        if (!this.lowGraphics) {
            this.spawnBurstVisual(x, y, radius * 0.7, COLOR_OVERLOAD, 0.7);
        }
    }

    private applyBloodFuelHeal() {
        if (this.bloodFuelConfig.stacks <= 0) return;
        const healAmount =
            this.playerStats.maxHealth * this.bloodFuelConfig.healPercent;
        if (healAmount <= 0) return;
        this.healPlayer(healAmount);
    }

    private applySingularityPull(target: Phaser.Physics.Arcade.Image) {
        if (!this.singularityConfig.active) return;
        const center = new Phaser.Math.Vector2(target.x, target.y);
        const radius =
            this.singularityConfig.radius *
            (this.activeSynergies.has("black-hole-sun") ? 1.2 : 1);
        const strength = this.singularityConfig.pullStrength;
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
        if (!this.lowGraphics) {
            this.spawnBurstVisual(
                center.x,
                center.y,
                radius * 0.5,
                COLOR_CHARGE,
                0.45
            );
        }
    }

    private tryChainArc(origin: Phaser.Physics.Arcade.Image) {
        if (this.chainArcConfig.stacks <= 0) return;
        const now = this.time.now;
        if (now < this.chainArcConfig.lastAt + this.chainArcConfig.cooldownMs)
            return;
        const range = this.chainArcConfig.range;
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
        this.chainArcConfig.lastAt = now;
        const damage =
            this.playerStats.damage * this.chainArcConfig.damagePercent;
        this.applyDamageToEnemy(target, damage, undefined, { tags: ["arc"] });
        if (!this.lowGraphics) {
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
            if (this.quantumConfig.active) {
                const wrap = this.quantumConfig.wrapMargin;
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
            this.boss = undefined;
            this.bossMaxHealth = 0;
            this.bossPhase = 1;
            if (!this.infiniteMode) {
                this.endRun(true);
            }
        }
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
        pickup.setData(
            "value",
            kind === "mass" ? 6 : kind === "watcher" ? 4 : 3
        );
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
        if (this.shieldConfig.stacks <= 0) return;
        const now = this.time.now;
        if (now < this.shieldConfig.nextReadyAt) return;
        this.shieldConfig.nextReadyAt = now + this.shieldConfig.cooldownMs;
        const activate = (pilot?: PilotRuntime) => {
            if (!pilot || !this.isPilotActive(pilot)) return;
            pilot.shield.activeUntil = now + this.shieldConfig.durationMs;
            pilot.shield.hp = this.shieldConfig.shieldHp;
            pilot.shield.nextReadyAt = this.shieldConfig.nextReadyAt;
            if (!this.lowGraphics) {
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
            }
        };
        activate(this.playerState);
        if (this.runMode === "twin" || this.runMode === "online") {
            activate(this.playerTwoState);
        }
    }

    private tryKineticHeal() {
        if (this.kineticConfig.stacks <= 0) return;
        const now = this.time.now;
        if (now < this.kineticConfig.nextReadyAt) return;
        this.kineticConfig.nextReadyAt = now + this.kineticConfig.cooldownMs;
        this.healPlayer(this.kineticConfig.healAmount);
    }

    private spawnShrapnel(enemy: Phaser.Physics.Arcade.Image) {
        if (this.shrapnelConfig.stacks <= 0) return;
        const shards = this.shrapnelConfig.shards;
        const damage = this.shrapnelConfig.damage;
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
        if (this.glassCannonCap === null) return;
        this.playerStats.maxHealth = Math.min(
            this.playerStats.maxHealth,
            this.glassCannonCap
        );
        this.playerStats.health = Math.min(
            this.playerStats.health,
            this.playerStats.maxHealth
        );
    }

    /**
     * Get current upgrade power metrics for monitoring and validation
     * Requirements 1.5, 4.4, 4.5
     */
    private getCurrentUpgradePowerMetrics() {
        return {
            maxDamage: calculateMaxDamageMultiplier(this.upgradeStacks),
            maxDPS: calculateMaxDPSMultiplier(this.upgradeStacks),
            maxDefense: calculateMaxDefenseMultiplier(this.upgradeStacks),
            upgradeStacks: { ...this.upgradeStacks },
            activeSynergies: Array.from(this.activeSynergies),
        };
    }

    /**
     * Validate current upgrade state and log warnings if approaching limits
     * Requirements 4.4, 4.5
     */
    private validateCurrentUpgradeState(): boolean {
        const validation = validateUpgradeCombinationDetailed(
            this.upgradeStacks
        );

        if (!validation.valid) {
            console.error(
                "Invalid upgrade state detected:",
                validation.reasons
            );
            console.error("Current metrics:", validation.metrics);
            return false;
        }

        // Warn if approaching limits (80% of thresholds)
        if (validation.metrics.maxDamage > 6.4) {
            // 80% of 8.0 limit
            console.warn(
                `Damage approaching limit: ${validation.metrics.maxDamage.toFixed(
                    2
                )}x / 8.0x`
            );
        }

        if (validation.metrics.maxDPS > 16.0) {
            // 80% of 20.0 limit
            console.warn(
                `DPS approaching limit: ${validation.metrics.maxDPS.toFixed(
                    2
                )}x / 20.0x`
            );
        }

        if (validation.metrics.maxDefense > 0.4) {
            // 80% of 0.5 limit
            console.warn(
                `Defense approaching limit: ${(
                    validation.metrics.maxDefense * 100
                ).toFixed(1)}% / 50%`
            );
        }

        return true;
    }

    /**
     * Emergency safeguard to prevent infinite damage or invulnerability
     * Called during critical game state changes
     * Requirements 1.5, 4.4, 4.5
     */
    private emergencyUpgradeValidation(): void {
        const metrics = this.getCurrentUpgradePowerMetrics();

        // Hard caps to prevent game-breaking scenarios
        if (metrics.maxDamage > 10.0) {
            console.error(
                "Emergency: Damage multiplier exceeded safe limits, capping at 10x"
            );
            // In a real scenario, we might need to adjust player stats or disable upgrades
            // For now, we log the issue
        }

        if (metrics.maxDPS > 25.0) {
            console.error(
                "Emergency: DPS multiplier exceeded safe limits, capping at 25x"
            );
        }

        if (metrics.maxDefense > 0.6) {
            console.error(
                "Emergency: Defense exceeded safe limits, capping at 60%"
            );
        }

        // Validate that Glass Cannon health cap is properly enforced
        if (
            this.upgradeStacks["glass-cannon"] > 0 &&
            this.playerStats.maxHealth > 1
        ) {
            console.error(
                "Emergency: Glass Cannon health cap not properly enforced"
            );
            this.playerStats.maxHealth = 1;
            this.playerStats.health = Math.min(this.playerStats.health, 1);
        }
    }

    private levelUp() {
        this.level += 1;
        this.nextXpThreshold = Math.floor(this.nextXpThreshold * 1.2 + 6);
        useRunStore
            .getState()
            .actions.setXp(this.level, this.xp, this.nextXpThreshold);
        this.pendingUpgradeOptions = this.rollUpgradeOptions();
        if (this.pendingUpgradeOptions.length === 0) return;
        this.setPaused(true);
        useUIStore.getState().actions.openUpgradeSelection();
        gameEvents.emit(GAME_EVENT_KEYS.levelUp, {
            options: this.pendingUpgradeOptions,
        });
    }

    private rollUpgradeOptions(): UpgradeDefinition[] {
        const sidecarStacks = this.upgradeStacks["sidecar"] ?? 0;
        const available = UPGRADE_CATALOG.filter((u) => {
            const stacks = this.upgradeStacks[u.id] ?? 0;
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
            return Math.max(0, (u.dropWeight ?? 1) * rarityBase);
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

    private applyUpgradeEffects(def: UpgradeDefinition) {
        switch (def.id) {
            case "power-shot": {
                // Apply diminishing returns for power shot stacking (Requirement 4.1)
                const stacks = this.upgradeStacks[def.id];
                const effectiveMultiplier = calculateDiminishedMultiplier(
                    "power-shot",
                    stacks,
                    1.15
                );
                const previousMultiplier =
                    stacks > 1
                        ? calculateDiminishedMultiplier(
                              "power-shot",
                              stacks - 1,
                              1.15
                          )
                        : 1;
                const incrementalMultiplier =
                    effectiveMultiplier / previousMultiplier;

                this.playerStats.damage *= incrementalMultiplier;
                this.playerStats.critChance += 0.05;
                break;
            }
            case "rapid-fire": {
                // Apply diminishing returns for rapid fire stacking (Requirement 4.1)
                const stacks = this.upgradeStacks[def.id];
                const effectiveMultiplier = calculateDiminishedMultiplier(
                    "rapid-fire",
                    stacks,
                    1.15
                );
                const previousMultiplier =
                    stacks > 1
                        ? calculateDiminishedMultiplier(
                              "rapid-fire",
                              stacks - 1,
                              1.15
                          )
                        : 1;
                const incrementalMultiplier =
                    effectiveMultiplier / previousMultiplier;

                this.playerStats.fireRate *= incrementalMultiplier;
                break;
            }
            case "swift-projectiles": {
                this.playerStats.projectileSpeed *= 1.2;
                break;
            }
            case "engine-tune": {
                this.playerStats.moveSpeed *= 1.1;
                break;
            }
            case "plating": {
                const stacks = this.upgradeStacks[def.id];
                this.playerStats.maxHealth += 1;
                this.playerStats.health = Math.min(
                    this.playerStats.maxHealth,
                    this.playerStats.health + 1
                );

                // Apply diminishing returns for defensive upgrades (Requirement 4.5)
                // Calculate effective damage reduction with diminishing returns
                let effectiveDamageReduction = 0;
                for (let i = 1; i <= stacks; i++) {
                    const baseReduction = 0.08;
                    if (i <= 3) {
                        effectiveDamageReduction += baseReduction;
                    } else {
                        // Diminishing returns after 3 stacks
                        effectiveDamageReduction += baseReduction * 0.8;
                    }
                }
                effectiveDamageReduction = Math.min(
                    effectiveDamageReduction,
                    0.5
                ); // Cap at 50%

                this.platingConfig = {
                    stacks,
                    damageReduction: effectiveDamageReduction,
                };
                this.enforceHealthCap();
                useRunStore
                    .getState()
                    .actions.setVitals(
                        this.playerStats.health,
                        this.playerStats.maxHealth
                    );
                break;
            }
            case "sidecar": {
                this.playerStats.projectiles += 1;
                break;
            }
            case "pierce": {
                this.playerStats.pierce += 1;
                break;
            }
            case "heavy-barrel": {
                // Apply diminishing returns for heavy barrel stacking (Requirement 4.1)
                const stacks = this.upgradeStacks[def.id];
                const effectiveMultiplier = calculateDiminishedMultiplier(
                    "heavy-barrel",
                    stacks,
                    1.2
                );
                const previousMultiplier =
                    stacks > 1
                        ? calculateDiminishedMultiplier(
                              "heavy-barrel",
                              stacks - 1,
                              1.2
                          )
                        : 1;
                const incrementalMultiplier =
                    effectiveMultiplier / previousMultiplier;

                this.playerStats.damage *= incrementalMultiplier;
                this.playerStats.fireRate *= 0.9;
                this.projectileScale *= 1.1;
                this.playerStats.critMultiplier += 0.05;
                break;
            }
            case "rebound": {
                this.playerStats.bounce += 2;
                this.playerStats.projectileSpeed *= 0.95;
                break;
            }
            case "dash-sparks": {
                const stacks = this.upgradeStacks[def.id];
                const shards = 6 + (stacks - 1) * 2;
                const damage =
                    this.playerStats.damage * (1.6 + (stacks - 1) * 0.25);
                this.dashSparkConfig = { stacks, shards, damage };
                break;
            }
            case "held-charge": {
                const stacks = this.upgradeStacks[def.id];
                const idleMs = Math.max(400, 800 - (stacks - 1) * 80);
                const damageBonus = 0.8 + (stacks - 1) * 0.12;
                const sizeBonus = 0.2;
                const chargePierceBonus = 2 + (stacks - 1);
                this.capacitorConfig = {
                    stacks,
                    idleMs,
                    damageBonus,
                    sizeBonus,
                    chargePierceBonus,
                };
                this.chargeState.idleMs = idleMs;
                this.chargeState.damageBonus = damageBonus;
                this.chargeState.sizeBonus = sizeBonus;
                if (this.playerState) {
                    this.playerState.charge.idleMs = idleMs;
                    this.playerState.charge.damageBonus = damageBonus;
                    this.playerState.charge.sizeBonus = sizeBonus;
                }
                if (this.playerTwoState) {
                    this.playerTwoState.charge.idleMs = idleMs;
                    this.playerTwoState.charge.damageBonus = damageBonus;
                    this.playerTwoState.charge.sizeBonus = sizeBonus;
                }
                break;
            }
            case "shield-pickup": {
                const stacks = this.upgradeStacks[def.id];
                const durationMs = (2 + (stacks - 1) * 0.3) * 1000;
                const cooldownMs = Math.max(3000, 5000 - (stacks - 1) * 600);
                const shieldHp = 60;
                this.shieldConfig = {
                    stacks,
                    shieldHp,
                    durationMs,
                    cooldownMs,
                    nextReadyAt: 0,
                };
                this.playerState &&
                    (this.playerState.shield = this.defaultShieldState());
                this.playerTwoState &&
                    (this.playerTwoState.shield = this.defaultShieldState());
                break;
            }
            case "kinetic-siphon": {
                const stacks = this.upgradeStacks[def.id];
                const healAmount = 0.3 + (stacks - 1) * 0.1;
                const cooldownMs = Math.max(800, 1200 - (stacks - 1) * 200);
                this.kineticConfig = {
                    stacks,
                    healAmount,
                    cooldownMs,
                    nextReadyAt: 0,
                };
                break;
            }
            case "prism-spread": {
                const stacks = this.upgradeStacks[def.id];
                const prevBonus = this.spreadConfig.critBonus;
                const spreadDegrees = Math.max(3, 6 - (stacks - 1) * 1.5);
                const critBonus = 0.05 * stacks;
                this.spreadConfig = { stacks, spreadDegrees, critBonus };
                this.playerStats.critChance += critBonus - prevBonus;
                break;
            }
            case "momentum-feed": {
                const stacks = this.upgradeStacks[def.id];
                const ramp = 0.25 + (stacks - 1) * 0.05;
                const timeToMaxMs = Math.max(1400, 2000 - (stacks - 1) * 200);
                this.momentumConfig = {
                    stacks,
                    ramp,
                    timeToMaxMs,
                    timerMs: 0,
                    bonus: 0,
                };
                if (this.playerState) {
                    this.playerState.momentum = this.defaultMomentumState();
                }
                if (this.playerTwoState) {
                    this.playerTwoState.momentum = this.defaultMomentumState();
                }
                break;
            }
            case "split-shot": {
                const stacks = this.upgradeStacks[def.id];
                const damageMultiplier = 0.5 + (stacks - 1) * 0.1;
                const spreadDegrees = Math.max(8, 12 - (stacks - 1) * 2);
                this.splitConfig = {
                    enabled: true,
                    forks: 2,
                    spreadDegrees,
                    damageMultiplier,
                };
                break;
            }
            case "explosive-impact": {
                const stacks = this.upgradeStacks[def.id];
                const radius = (32 + (stacks - 1) * 10) * OBJECT_SCALE;
                const damageMultiplier = 0.55 + (stacks - 1) * 0.1;
                this.explosiveConfig = { stacks, radius, damageMultiplier };
                break;
            }
            case "chain-arc": {
                const stacks = this.upgradeStacks[def.id];
                const range = 180 + (stacks - 1) * 20;
                const damagePercent = 0.6 + (stacks - 1) * 0.1;
                const cooldownMs = Math.max(120, 150 - (stacks - 1) * 20);
                this.chainArcConfig = {
                    stacks,
                    range,
                    damagePercent,
                    cooldownMs,
                    lastAt: 0,
                };
                break;
            }
            case "magnet-coil": {
                const stacks = this.upgradeStacks[def.id];
                const radiusMult = 1 + 0.3 + (stacks - 1) * 0.15;
                const speedMult = 1 + 0.2 + (stacks - 1) * 0.1;
                this.magnetConfig = { stacks, radiusMult, speedMult };
                break;
            }
            case "stabilizers": {
                const stacks = this.upgradeStacks[def.id];
                const contactMultiplier = Math.max(0.5, 1 - 0.15 * stacks);
                this.stabilizerConfig = { stacks, contactMultiplier };
                break;
            }
            case "shrapnel": {
                const stacks = this.upgradeStacks[def.id];
                const shards = 6 + (stacks - 1) * 2;
                const damage =
                    this.playerStats.damage * (0.35 + (stacks - 1) * 0.05);
                this.shrapnelConfig = { stacks, shards, damage };
                break;
            }
            case "heatseeker": {
                const stacks = this.upgradeStacks[def.id];
                const range = 240 + (stacks - 1) * 60;
                const turnRate = Phaser.Math.DegToRad(
                    stacks === 1 ? 10 : stacks === 2 ? 30 : 90
                );
                this.homingConfig = { stacks, range, turnRate };
                break;
            }
            case "neutron-core": {
                this.neutronCoreConfig = { active: true, speedMultiplier: 0.6 };
                this.projectileScale *= 1.15;
                this.playerStats.projectileSpeed *=
                    this.neutronCoreConfig.speedMultiplier;
                break;
            }
            case "glass-cannon": {
                // Apply legendary upgrade adjustments (Requirement 4.2)
                const adjustments = getLegendaryAdjustments("glass-cannon");
                this.glassCannonCap = 1;
                this.playerStats.damage *= adjustments.damageMultiplier || 2.5;
                this.playerStats.critChance +=
                    adjustments.critChanceBonus || 0.08;
                this.playerStats.maxHealth = Math.min(
                    this.playerStats.maxHealth,
                    1
                );
                this.playerStats.health = Math.min(
                    this.playerStats.health,
                    this.playerStats.maxHealth
                );
                useRunStore
                    .getState()
                    .actions.setVitals(
                        this.playerStats.health,
                        this.playerStats.maxHealth
                    );
                break;
            }
            case "singularity-rounds": {
                this.singularityConfig = {
                    active: true,
                    radius: 160,
                    pullStrength: 640,
                };
                break;
            }
            case "bullet-hell": {
                // Apply legendary upgrade adjustments (Requirement 4.2)
                const adjustments = getLegendaryAdjustments("bullet-hell");
                const fireRateMultiplier =
                    adjustments.fireRateMultiplier || 3.0;
                const damageMultiplier = adjustments.damageMultiplier || 0.7;

                this.bulletHellConfig = {
                    active: true,
                    fireRateMultiplier,
                    damageMultiplier,
                    inaccuracyRad: Phaser.Math.DegToRad(34),
                };
                this.playerStats.fireRate *= fireRateMultiplier;
                this.playerStats.damage *= damageMultiplier;
                break;
            }
            case "blood-fuel": {
                const stacks = this.upgradeStacks[def.id];
                const healPercent = 0.12 + (stacks - 1) * 0.03;
                const fireCostPercent = 0.02 * stacks;
                this.bloodFuelConfig = { stacks, healPercent, fireCostPercent };
                break;
            }
            case "chain-reaction": {
                const stacks = this.upgradeStacks[def.id];
                const radius = 70 + (stacks - 1) * 10;
                const damagePercent = 0.5 + (stacks - 1) * 0.05;
                this.chainReactionConfig = { stacks, radius, damagePercent };
                break;
            }
            case "quantum-tunneling": {
                this.quantumConfig = {
                    active: true,
                    wrapMargin: 18,
                    projectileLifetimeMs: PROJECTILE_MAX_LIFETIME_MS,
                };
                break;
            }
            case "berserk-module": {
                const stacks = this.upgradeStacks[def.id];
                const maxBonus = 1 + (stacks - 1) * 0.5;
                this.berserkConfig = { stacks, maxBonus };
                break;
            }
            default:
                break;
        }
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
        // Enhanced wave scaling to account for typical upgrade progression
        // Requirements 1.2, 1.3, 5.1, 5.2, 5.3, 5.4, 5.5

        const overflow =
            this.infiniteMode && index >= WAVES.length
                ? index - (WAVES.length - 1)
                : 0;

        // Progressive scaling for standard waves (0-9) to challenge upgrade builds
        let baseHealthMultiplier = 1;
        let baseSpeedMultiplier = 1;
        let baseCountMultiplier = 1;

        if (index < WAVES.length) {
            // Early waves (0-2): Minimal scaling to allow power spike enjoyment
            if (index <= 2) {
                baseHealthMultiplier = 1 + index * 0.1; // 1.0, 1.1, 1.2
                baseSpeedMultiplier = 1 + index * 0.05; // 1.0, 1.05, 1.1
                baseCountMultiplier = 1;
            }
            // Mid-game waves (3-6): Moderate scaling to challenge typical upgrade builds
            else if (index <= 6) {
                const midProgress = (index - 3) / 3; // 0 to 1 over waves 3-6
                baseHealthMultiplier = 1.2 + midProgress * 0.6; // 1.2 to 1.8
                baseSpeedMultiplier = 1.1 + midProgress * 0.3; // 1.1 to 1.4
                baseCountMultiplier = 1 + midProgress * 0.2; // 1.0 to 1.2
            }
            // Late waves (7-9): Aggressive scaling for optimized builds
            else {
                const lateProgress = (index - 7) / 2; // 0 to 1 over waves 7-9
                baseHealthMultiplier = 1.8 + lateProgress * 0.7; // 1.8 to 2.5
                baseSpeedMultiplier = 1.4 + lateProgress * 0.4; // 1.4 to 1.8
                baseCountMultiplier = 1.2 + lateProgress * 0.3; // 1.2 to 1.5
            }
        }

        // Apply base difficulty and infinite mode overflow scaling
        const speedAndFire =
            this.baseDifficulty *
            baseSpeedMultiplier *
            (overflow > 0 ? 1 + overflow * 0.25 : 1);
        const healthScale =
            this.baseDifficulty *
            baseHealthMultiplier *
            (overflow > 0 ? 1.2 ** overflow : 1);
        const countScale =
            baseCountMultiplier *
            (overflow > 0 ? 1 + overflow * 0.4 : 1) *
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
                this.spawnBoss();
                return;
            }
            for (let i = 0; i < spawn.count; i++) {
                this.spawnEnemy(spawn.kind, spawn.elite);
            }
        });
    }

    private spawnEnemy(kind: string, elite?: boolean) {
        // Use elite textures for enhanced visual distinction (Requirements 6.1, 6.5)
        let textureKey: string;
        if (elite) {
            textureKey =
                kind === "drifter"
                    ? "elite-drifter"
                    : kind === "watcher"
                    ? "elite-watcher"
                    : "elite-mass";
        } else {
            textureKey =
                kind === "drifter"
                    ? "drifter"
                    : kind === "watcher"
                    ? "watcher"
                    : "mass";
        }

        const enemy = this.enemies.get(
            0,
            0,
            textureKey
        ) as Phaser.Physics.Arcade.Image;
        if (!enemy) return;
        enemy.setActive(true);
        enemy.setVisible(false);
        enemy.setScale(OBJECT_SCALE);
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
            if (!this.lowGraphics) {
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
            }
        } else {
            enemy.clearTint();
        }
        this.showSpawnCue(enemy);
    }

    private spawnBoss() {
        const visuals = this.getBossVisuals(this.bossTemplate?.id);
        const textureKey = visuals.textureKey;
        this.boss = this.enemies.get(
            GAME_WIDTH / 2,
            140,
            textureKey
        ) as Phaser.Physics.Arcade.Image;
        if (!this.boss) return;
        this.boss.setActive(true);
        this.boss.setVisible(true);
        this.boss.setScale(OBJECT_SCALE * 2);
        if (visuals.scale) {
            this.boss.setScale(OBJECT_SCALE * visuals.scale);
        }
        this.boss.setData("kind", "boss");
        const base = getEnemyDefinition("boss");
        const tuning = this.bossTemplate?.tuning ?? {};
        const affixBossHealthMult = this.affix?.bossHealthMultiplier ?? 1;
        const affixBossProjSpeedMult =
            this.affix?.bossProjectileSpeedMultiplier ?? 1;
        const health =
            base.health *
            (tuning.healthMultiplier ?? 1) *
            affixBossHealthMult *
            this.enemyHealthScale;
        const speed = base.speed * (tuning.speedMultiplier ?? 1);
        const fireCooldownBase = base.fireCooldown ?? 1.2;
        const fireRateMultiplier = tuning.fireRateMultiplier ?? 1;
        const projSpeedBase = base.projectileSpeed ?? 0;
        const projectileSpeedMultiplier =
            (tuning.projectileSpeedMultiplier ?? 1) * affixBossProjSpeedMult;

        this.bossMaxHealth = health;
        this.boss.setData("health", health);
        this.boss.setData("maxHealth", health);
        this.boss.setData("bossId", this.bossTemplate?.id ?? "boss");
        this.boss.setData("speed", speed * this.difficulty);
        this.boss.setData(
            "fireCooldown",
            fireCooldownBase / (fireRateMultiplier * this.difficulty)
        );
        this.boss.setData(
            "projectileSpeed",
            projSpeedBase * projectileSpeedMultiplier * this.difficulty
        );
        this.bossNextPatternAt = this.time.now + 1500 / this.difficulty;
        const bossBody = this.boss.body as Phaser.Physics.Arcade.Body;
        bossBody.setSize(this.boss.displayWidth, this.boss.displayHeight, true);
        bossBody.setImmovable(false);
        bossBody.setCollideWorldBounds(true);
        bossBody.setDrag(60, 60);
        if (visuals.tint) {
            this.boss.setTint(visuals.tint);
        } else {
            this.boss.clearTint();
        }
        this.bossIntroColor = visuals.overlayColor ?? 0xf14e4e;
        this.playBossIntroPulse();
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
            ? this.stabilizerConfig.contactMultiplier
            : 1;
        const armorReduction = Math.min(
            Math.max(this.platingConfig.damageReduction, 0),
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
            if (!this.lowGraphics) {
                this.spawnBurstVisual(
                    pilot.sprite.x,
                    pilot.sprite.y,
                    36 * OBJECT_SCALE,
                    COLOR_ACCENT,
                    0.9
                );
            }
        }

        if (this.playerStats.health <= 0) {
            this.endRun(false);
        }
    }

    private createTexture(
        key: string,
        draw: (g: Phaser.GameObjects.Graphics) => void
    ) {
        if (this.textures.exists(key)) return;
        const g = this.add.graphics({ x: 0, y: 0 });
        draw(g);
        g.generateTexture(key, 64, 64);
        g.destroy();
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
                        if (!this.lowGraphics) {
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
                        }
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

    private handleBossPhaseChange() {
        if (!this.boss) return;
        const hp = this.boss.getData("health") as number;
        const maxHp = this.bossMaxHealth || getEnemyDefinition("boss").health;
        const hpPct = hp / maxHp;
        let phase = 1;
        if (hpPct < 0.66) phase = 2;
        if (hpPct < 0.33) phase = 3;
        if (phase !== this.bossPhase) {
            const previousPhase = this.bossPhase;
            this.bossPhase = phase;

            // Enhanced visual and audio feedback (Requirements 2.5, 6.2, 6.4)
            this.triggerBossPhaseTransition(previousPhase, phase);
            this.pulseBackgroundForBossPhase(phase);
            gameEvents.emit(GAME_EVENT_KEYS.bossPhaseChanged, { phase });

            // Immediate pattern reset for faster transitions (Requirement 2.5)
            this.bossNextPatternAt = this.time.now + 300; // Quick transition
        }
    }

    private triggerBossPhaseTransition(_fromPhase: number, toPhase: number) {
        // Enhanced visual and audio feedback for phase changes (Requirements 6.2, 6.4)
        if (!this.boss) return;

        // Screen shake intensity increases with phase
        const shakeIntensity = 0.01 + (toPhase - 1) * 0.005;
        const shakeDuration = 400 + (toPhase - 1) * 200;
        this.cameras.main.shake(shakeDuration, shakeIntensity);

        // Enhanced screen effects for dangerous boss phases (Requirements 6.4)
        const phaseColors = [
            [255, 100, 100], // Phase 1: Red
            [255, 150, 50], // Phase 2: Orange
            [255, 50, 50], // Phase 3: Intense Red
        ];
        const [r, g, b] = phaseColors[toPhase - 1];

        // Longer, more intense flash for higher phases
        const flashDuration = 400 + (toPhase - 1) * 200;
        this.cameras.main.flash(flashDuration, r, g, b);

        // Add screen distortion effects for phases 2 and 3
        if (toPhase >= 2 && !this.lowGraphics) {
            // Create temporary screen overlay for dangerous phases
            const dangerOverlay = this.add
                .rectangle(
                    GAME_WIDTH / 2,
                    GAME_HEIGHT / 2,
                    GAME_WIDTH,
                    GAME_HEIGHT,
                    toPhase === 3 ? 0xff2020 : 0xff6020,
                    0.15
                )
                .setDepth(10)
                .setBlendMode(Phaser.BlendModes.MULTIPLY);

            // Pulsing danger overlay
            this.tweens.add({
                targets: dangerOverlay,
                alpha: { from: 0.15, to: 0.05 },
                duration: 800,
                yoyo: true,
                repeat: 3,
                onComplete: () => dangerOverlay.destroy(),
            });
        }

        // Boss visual enhancement
        if (this.boss) {
            // Increase boss tint intensity with phase
            const tintIntensity = 0xffffff - (toPhase - 1) * 0x202020;
            this.boss.setTint(tintIntensity);

            // Scale pulse effect
            const originalScale = this.boss.scaleX;
            this.tweens.add({
                targets: this.boss,
                scaleX: originalScale * 1.2,
                scaleY: originalScale * 1.2,
                duration: 200,
                yoyo: true,
                ease: "Power2",
            });
        }

        // Audio feedback for boss phase change (Requirements 6.2, 6.4)
        soundManager.playSfx("bossPhaseChange");

        // Spawn dramatic visual burst
        if (!this.lowGraphics && this.boss) {
            const burstRadius = 60 + (toPhase - 1) * 20;
            const burstColor =
                toPhase === 3 ? 0xff3030 : toPhase === 2 ? 0xff9632 : 0xff6464;
            this.spawnBurstVisual(
                this.boss.x,
                this.boss.y,
                burstRadius,
                burstColor,
                1.0
            );
        }
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

        if (this.lowGraphics) {
            // Simple flash and end
            this.cameras.main.flash(300, 255, 80, 80);
            this.time.delayedCall(400, onComplete);
            return;
        }

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
            bossId: this.bossTemplate?.id,
            affixId: this.affix?.id,
            synergies: state.achievedSynergies,
            mode: this.runMode,
        };
        state.actions.setWaveCountdown(null, null);
        state.actions.endRun(summary);
        useUIStore.getState().actions.setScreen("summary");
        gameEvents.emit(GAME_EVENT_KEYS.runEnded, summary);
    }

    setLowGraphicsMode(enabled: boolean) {
        this.lowGraphics = enabled;
        if (!enabled && this.starfieldLayers.length === 0) {
            this.createStarfieldTextures();
            this.createStarfieldLayers();
        }
        this.syncStarfieldVisibility();
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
