/**
 * Refactored MainScene - System Orchestrator
 * This is the new lightweight MainScene that uses the system architecture
 */

import Phaser from "phaser";
import { soundManager } from "../../audio/SoundManager";
import type {
    BossDefinition,
    RunMode,
    TwinControlConfig,
    WeeklyAffix,
} from "../../models/types";
import { useMetaStore } from "../../state/useMetaStore";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";
import { Prng } from "../../utils/seed";
import { GAME_EVENT_KEYS, gameEvents } from "../events";
import { GAME_HEIGHT, GAME_WIDTH } from "../GameConfig";
import { EnemySystem } from "../systems/EnemySystem";
import { eventBus } from "../systems/EventBus";
import { PlayerSystem } from "../systems/PlayerSystem";
import { ProjectileSystem } from "../systems/ProjectileSystem";
import { SystemRegistry } from "../systems/SystemRegistry";
import { TextureFactory } from "../systems/TextureFactory";
import { UpgradeSystem } from "../systems/UpgradeSystem";
import { VFXSystem } from "../systems/VFXSystem";

export class MainScene extends Phaser.Scene {
    // System orchestration
    private systemRegistry!: SystemRegistry;
    private playerSystem!: PlayerSystem;
    private enemySystem!: EnemySystem;
    private projectileSystem!: ProjectileSystem;
    private upgradeSystem!: UpgradeSystem;
    private vfxSystem!: VFXSystem;

    // Core game state
    private screenBounds!: Phaser.Geom.Rectangle;
    private runActive = false;
    private runStartTime = 0;
    private rng = new Prng(1);
    private seedId = "week-0";
    private runMode: RunMode = "standard";
    private twinControls?: TwinControlConfig;
    private affix: WeeklyAffix | null = null;

    // Visual elements
    private lowGraphics = false;
    private starfieldLayers: {
        sprite: Phaser.GameObjects.TileSprite;
        velocityX: number;
        velocityY: number;
        colorFx?: Phaser.FX.ColorMatrix;
    }[] = [];
    private playfieldBackdrop?: Phaser.GameObjects.Rectangle;
    private textureFactory?: TextureFactory;

    constructor() {
        super("MainScene");
    }

    create() {
        this.setupScreenBounds();
        this.textureFactory = new TextureFactory(this);
        this.textureFactory.createStarfieldTextures();
        this.textureFactory.createGameTextures();
        this.initializeSystems();
        this.setupVisuals();
        this.setupEventListeners();
    }

    private setupScreenBounds(): void {
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
    }

    private initializeSystems(): void {
        // Create system registry
        this.systemRegistry = new SystemRegistry();

        // Create systems
        this.playerSystem = new PlayerSystem();
        this.enemySystem = new EnemySystem();
        this.projectileSystem = new ProjectileSystem();
        this.upgradeSystem = new UpgradeSystem();
        this.vfxSystem = new VFXSystem();

        // Register systems with dependencies
        this.systemRegistry.registerSystem(this.vfxSystem);
        this.systemRegistry.registerSystem(this.projectileSystem);
        this.systemRegistry.registerSystem(this.upgradeSystem);
        this.systemRegistry.registerSystem(this.playerSystem);
        this.systemRegistry.registerSystem(this.enemySystem);

        // Initialize all systems
        this.systemRegistry.initializeAllSystems(this);

        // Setup system communication
        this.setupSystemCommunication();
    }

    private setupSystemCommunication(): void {
        // Connect upgrade system to player system
        this.upgradeSystem.setPlayerStatsUpdater((stats) => {
            this.playerSystem.updatePlayerStats(stats);
        });

        // Connect upgrade system to projectile system
        this.upgradeSystem.setProjectileScaleUpdater((scale) => {
            this.projectileSystem.updateConfig({ projectileScale: scale });
        });

        // Setup collision handling between systems
        this.setupCollisionHandling();
    }

    private setupCollisionHandling(): void {
        const projectileGroups = this.projectileSystem.getProjectileGroups();
        const player = this.playerSystem.getPlayer();
        const enemies = this.enemySystem.getEnemiesGroup();
        const enemyBullets = this.enemySystem.getEnemyBulletsGroup();

        console.log("Setting up collisions:", {
            hasPlayer: !!player,
            hasEnemies: !!enemies,
            hasBullets: !!projectileGroups.bullets,
            hasEnemyBullets: !!enemyBullets,
        });

        if (!player || !enemies) {
            console.warn(
                "Cannot setup collisions - missing player or enemies group"
            );
            return;
        }

        // Player bullets hit enemies
        if (projectileGroups.bullets && enemies) {
            this.physics.add.overlap(
                projectileGroups.bullets,
                enemies,
                (bullet, enemy) =>
                    this.handleBulletHitEnemy(
                        bullet as Phaser.Physics.Arcade.Image,
                        enemy as Phaser.Physics.Arcade.Image
                    ),
                undefined,
                this
            );
        }

        // Player collides with enemies (contact damage)
        this.physics.add.overlap(
            player,
            enemies,
            (_player, enemy) =>
                this.handlePlayerHitEnemy(enemy as Phaser.Physics.Arcade.Image),
            undefined,
            this
        );

        // Player hit by enemy bullets
        if (enemyBullets) {
            this.physics.add.overlap(
                player,
                enemyBullets,
                (_player, bullet) =>
                    this.handlePlayerHitByBullet(
                        bullet as Phaser.Physics.Arcade.Image
                    ),
                undefined,
                this
            );
        }

        // Enemy-enemy collision (bounce off each other)
        this.physics.add.collider(enemies, enemies);
    }

    private handleBulletHitEnemy(
        bullet: Phaser.Physics.Arcade.Image,
        enemy: Phaser.Physics.Arcade.Image
    ): void {
        if (!bullet.active || !enemy.active) return;

        const damage = (bullet.getData("damage") as number) || 10;
        const pierceLeft = (bullet.getData("pierce") as number) || 0;
        const currentHealth = (enemy.getData("health") as number) || 0;
        const newHealth = currentHealth - damage;

        enemy.setData("health", newHealth);

        // Spawn hit VFX
        this.vfxSystem?.spawnBurstVisual(enemy.x, enemy.y, 20, 0x9ff0ff, 0.6);

        if (newHealth <= 0) {
            // Enemy died - spawn death VFX
            this.vfxSystem?.spawnBurstVisual(
                enemy.x,
                enemy.y,
                40,
                0xff6b6b,
                0.8
            );

            enemy.setActive(false);
            enemy.setVisible(false);
            (enemy.body as Phaser.Physics.Arcade.Body).enable = false;

            eventBus.emit("enemy:died", {
                enemyId: enemy.name || "enemy",
                type: enemy.getData("kind") || "drifter",
                position: { x: enemy.x, y: enemy.y },
            });
        }

        // Handle pierce
        if (pierceLeft > 0) {
            bullet.setData("pierce", pierceLeft - 1);
        } else {
            bullet.setActive(false);
            bullet.setVisible(false);
        }
    }

    private handlePlayerHitEnemy(enemy: Phaser.Physics.Arcade.Image): void {
        if (!enemy.active) return;

        // Check invulnerability
        const playerState = this.playerSystem.getPlayerState();
        if (playerState && this.time.now < playerState.invulnUntil) return;

        // Screen shake on hit
        this.cameras.main.shake(100, 0.01);

        // Red flash VFX
        this.vfxSystem?.spawnBurstVisual(
            playerState?.position.x || 0,
            playerState?.position.y || 0,
            30,
            0xff4444,
            0.7
        );

        this.playerSystem.takeDamage(1);
    }

    private handlePlayerHitByBullet(bullet: Phaser.Physics.Arcade.Image): void {
        if (!bullet.active) return;

        // Check invulnerability
        const playerState = this.playerSystem.getPlayerState();
        if (playerState && this.time.now < playerState.invulnUntil) return;

        const damage = (bullet.getData("damage") as number) || 1;

        // Screen shake on hit
        this.cameras.main.shake(80, 0.008);

        // Red flash VFX
        this.vfxSystem?.spawnBurstVisual(bullet.x, bullet.y, 25, 0xff4444, 0.6);

        this.playerSystem.takeDamage(damage);

        bullet.setActive(false);
        bullet.setVisible(false);
    }

    private setupVisuals(): void {
        this.lowGraphics = useMetaStore.getState().settings.lowGraphicsMode;
        if (this.vfxSystem) {
            this.vfxSystem.setLowGraphicsMode(this.lowGraphics);
        }

        this.createStarfieldLayers();
        this.syncStarfieldVisibility();
        this.createPlayfieldBackdrop();
        if (this.vfxSystem) {
            this.vfxSystem.setupBossIntroOverlay();
        }
    }

    private setupEventListeners(): void {
        // Listen for game events
        eventBus.on("wave:completed", () => {
            this.handleWaveCompleted();
        });

        eventBus.on("player:died", () => {
            this.handlePlayerDied();
        });

        // VFX for shooting
        eventBus.on("projectile:fired", (data) => {
            if (data.type === "player") {
                this.vfxSystem?.spawnMuzzleFlash(
                    data.position.x,
                    data.position.y
                );
            }
        });

        // VFX for enemy death
        eventBus.on("enemy:died", (data) => {
            this.vfxSystem?.spawnBurstVisual(
                data.position.x,
                data.position.y,
                35,
                0xffa500,
                0.8
            );
        });

        eventBus.on("player:level-up", () => {
            this.handlePlayerLevelUp();
        });
    }

    update(time: number, delta: number): void {
        const dt = delta / 1000;

        // Update visual effects
        if (!this.lowGraphics) {
            this.updateStarfield(dt);
        }

        if (!this.runActive) return;

        const runStatus = useRunStore.getState().status;
        if (runStatus !== "running") return;

        // Update all systems through registry
        this.systemRegistry.updateAllSystems(time, delta);

        // Handle game-level logic
        this.updateGameState(time, dt);
    }

    private updateGameState(time: number, dt: number): void {
        // Update elapsed time
        const elapsedAccumulator = dt;
        if (elapsedAccumulator >= 0.2) {
            useRunStore.getState().actions.tick(elapsedAccumulator);
        }

        // Check for wave completion
        if (this.enemySystem.isWaveComplete()) {
            this.handleWaveCompleted();
        }
    }

    startNewRun(
        seedId: string,
        seedValue: number,
        affix?: WeeklyAffix,
        bossOverride?: BossDefinition,
        options?: { mode?: RunMode; twinControls?: TwinControlConfig }
    ): void {
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

        // Initialize run state
        this.seedId = seedId;
        this.rng = new Prng(seedValue);
        this.affix = affix ?? null;
        this.runMode = options?.mode ?? "standard";
        this.twinControls = options?.twinControls;

        // Setup systems for new run
        this.upgradeSystem.setRng(this.rng);
        this.upgradeSystem.setAffix(this.affix);
        this.upgradeSystem.resetUpgradeState();

        // Start the run
        this.physics.world.resume();
        const waveCap = this.runMode === "infinite" ? null : 50; // Placeholder wave cap
        useRunStore.getState().actions.startRun(seedId, {
            mode: this.runMode,
            waveCap,
        });

        this.resetGameState();
        useUIStore.getState().actions.setScreen("inGame");
        gameEvents.emit(GAME_EVENT_KEYS.runStarted);

        this.runActive = true;
        this.runStartTime = this.time.now;
        soundManager.prepareRunMusic();

        // Start first wave
        this.enemySystem.startWave(0);
    }

    setPaused(paused: boolean): void {
        if (paused) {
            this.physics.world.pause();
            useRunStore.getState().actions.setStatus("paused");
        } else {
            this.physics.world.resume();
            useRunStore.getState().actions.setStatus("running");
        }
    }

    applyUpgrade(upgradeId: string): void {
        this.upgradeSystem.applyUpgrade(upgradeId);
    }

    // Event handlers
    private handleWaveCompleted(): void {
        const currentWave = this.enemySystem.getCurrentWave();
        if (currentWave) {
            const nextWaveIndex = currentWave.index + 1;

            // Check if there are more waves
            if (this.runMode === "infinite" || nextWaveIndex < 50) {
                // Placeholder wave limit
                // Start next wave after a delay
                this.time.delayedCall(3000, () => {
                    this.enemySystem.startWave(nextWaveIndex);
                });
            } else {
                // Run completed
                this.handleRunCompleted();
            }
        }
    }

    private handlePlayerDied(): void {
        this.runActive = false;
        useRunStore.getState().actions.setStatus("ended");
        useUIStore.getState().actions.setScreen("summary");
    }

    private handlePlayerLevelUp(): void {
        // Generate upgrade options
        const options = this.upgradeSystem.rollUpgradeOptions();
        if (options.length > 0) {
            useUIStore.getState().actions.openUpgradeSelection();
            this.setPaused(true);
        }
    }

    private handleRunCompleted(): void {
        this.runActive = false;
        useRunStore.getState().actions.setStatus("ended");
        useUIStore.getState().actions.setScreen("summary");
    }

    private resetGameState(): void {
        // Reset core game state
        this.runActive = false;
        this.runStartTime = 0;

        // Reset visual effects
        this.vfxSystem.resetBackgroundEffects();
        this.syncStarfieldVisibility();

        // Update UI
        const playerStats = this.playerSystem.getPlayerStats();
        useRunStore
            .getState()
            .actions.setVitals(playerStats.health, playerStats.maxHealth);
        useRunStore.getState().actions.setXp(1, 0, 12); // Level 1, 0 XP, 12 threshold
        useRunStore.getState().actions.setWaveCountdown(null, null);
    }

    private createStarfieldLayers(): void {
        // Clear existing layers
        for (const layer of this.starfieldLayers) {
            layer.sprite.destroy();
        }
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

            const colorFx = this.vfxSystem?.registerBackgroundFxTarget(sprite);
            this.starfieldLayers.push({
                sprite,
                velocityX: def.velocityX,
                velocityY: def.velocityY,
                colorFx: colorFx ?? undefined,
            });
        });
    }

    private createPlayfieldBackdrop(): void {
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
        this.vfxSystem?.registerBackgroundFxTarget(this.playfieldBackdrop);
    }

    private syncStarfieldVisibility(): void {
        const visible = !this.lowGraphics;
        this.starfieldLayers.forEach((layer) => {
            layer.sprite.setVisible(visible);
        });
    }

    private updateStarfield(dt: number): void {
        this.starfieldLayers.forEach((layer) => {
            layer.sprite.tilePositionX += layer.velocityX * dt;
            layer.sprite.tilePositionY += layer.velocityY * dt;
        });
    }

    setLowGraphicsMode(enabled: boolean): void {
        this.lowGraphics = enabled;
        this.vfxSystem?.setLowGraphicsMode(enabled);
        this.syncStarfieldVisibility();
    }

    debugSetWave(waveNumber: number): void {
        if (!this.runActive) return;
        this.enemySystem?.startWave(waveNumber);
    }

    // Cleanup
    shutdown(): void {
        this.systemRegistry?.shutdownAllSystems();
        eventBus.removeAllListeners();
    }
}
