import Phaser from "phaser";
import { BOSSES } from "../../../config/bosses";
import { getEnemyDefinition } from "../../../config/enemies";
import type {
    BossDefinition,
    EnemySpawn,
    WeeklyAffix,
} from "../../../models/types";
import { soundManager } from "../../../audio/SoundManager";
import { gameEvents, GAME_EVENT_KEYS } from "../../events";
import { GAME_WIDTH, GAME_HEIGHT } from "../../GameConfig";
import type { PilotRuntime } from "../MainScene.types";

const OBJECT_SCALE = 0.7;

export interface BossManagerCallbacks {
    getTime: () => number;
    getDifficulty: () => number;
    getEnemyHealthScale: () => number;
    getEnemies: () => Phaser.Physics.Arcade.Group;
    getEnemyBullets: () => Phaser.Physics.Arcade.Group;
    getNearestPilot: (x: number, y: number) => PilotRuntime | null;
    spawnWaveEnemies: (spawns: EnemySpawn[]) => void;
    spawnBurstVisual: (
        x: number,
        y: number,
        radius: number,
        color: number,
        alpha: number
    ) => void;
    getCamera: () => Phaser.Cameras.Scene2D.Camera;
    addTween: (
        config: Phaser.Types.Tweens.TweenBuilderConfig
    ) => Phaser.Tweens.Tween;
    addCounter: (
        config: Phaser.Types.Tweens.NumberTweenBuilderConfig
    ) => Phaser.Tweens.Tween;
    addDelayedCall: (delay: number, callback: () => void) => void;
    addRectangle: (
        x: number,
        y: number,
        w: number,
        h: number,
        color: number,
        alpha: number
    ) => Phaser.GameObjects.Rectangle;
    randFloat: (min: number, max: number) => number;
    randBetween: (min: number, max: number) => number;
    randChoice: <T>(items: T[]) => T;
    shuffle: <T>(items: T[]) => T[];
    rngNext: () => number;
}

export type BossVisuals = {
    textureKey: string;
    tint?: number;
    overlayColor?: number;
    scale?: number;
};

export class BossManager {
    private boss?: Phaser.Physics.Arcade.Image;
    private bossMaxHealth = 0;
    private bossPhase = 1;
    private bossNextPatternAt = 0;
    private bossTemplate: BossDefinition = BOSSES[0];
    private bossPatternQueue: string[] = [];
    private bossPatternCursor = 0;
    private bossSpinAngle = 0;
    private bossIntroOverlay?: Phaser.GameObjects.Rectangle;
    private bossIntroColor = 0xf14e4e;
    private affix: WeeklyAffix | null = null;
    private backgroundFxTargets: Phaser.FX.ColorMatrix[] = [];
    private backgroundFxTween?: Phaser.Tweens.Tween;

    private callbacks: BossManagerCallbacks;

    constructor(callbacks: BossManagerCallbacks) {
        this.callbacks = callbacks;
    }

    get currentBoss(): Phaser.Physics.Arcade.Image | undefined {
        return this.boss;
    }

    get currentPhase(): number {
        return this.bossPhase;
    }

    get maxHealth(): number {
        return this.bossMaxHealth;
    }

    get template(): BossDefinition {
        return this.bossTemplate;
    }

    get introColor(): number {
        return this.bossIntroColor;
    }

    reset() {
        this.boss = undefined;
        this.bossMaxHealth = 0;
        this.bossPhase = 1;
        this.bossNextPatternAt = 0;
        this.bossPatternQueue = [];
        this.bossPatternCursor = 0;
        this.bossSpinAngle = 0;
    }

    initialize(
        bossOverride: BossDefinition | undefined,
        affix: WeeklyAffix | null,
        rngNextInt: (max: number) => number
    ) {
        const bossPool = BOSSES.length > 0 ? BOSSES : [this.bossTemplate];
        this.bossTemplate =
            bossOverride ?? bossPool[rngNextInt(bossPool.length)];
        this.affix = affix;
        this.bossPatternQueue = this.callbacks.shuffle(
            this.bossTemplate.patterns
        );
        this.bossPatternCursor = 0;
        this.bossSpinAngle = 0;
    }

    setBackgroundFxTargets(targets: Phaser.FX.ColorMatrix[]) {
        this.backgroundFxTargets = targets;
    }

    setupBossIntroOverlay(scene: Phaser.Scene) {
        this.bossIntroOverlay?.destroy();
        const overlay = scene.add
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
        overlay.postFX.addVignette(0.5, 0.5, 0.9, 0.95);
        this.bossIntroOverlay = overlay;
    }

    getBossVisuals(id?: string): BossVisuals {
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

    spawnBoss() {
        const visuals = this.getBossVisuals(this.bossTemplate?.id);
        const textureKey = visuals.textureKey;
        this.boss = this.callbacks
            .getEnemies()
            .get(
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
        const difficulty = this.callbacks.getDifficulty();
        const enemyHealthScale = this.callbacks.getEnemyHealthScale();
        const health =
            base.health *
            (tuning.healthMultiplier ?? 1) *
            affixBossHealthMult *
            enemyHealthScale;
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
        this.boss.setData("speed", speed * difficulty);
        this.boss.setData(
            "fireCooldown",
            fireCooldownBase / (fireRateMultiplier * difficulty)
        );
        this.boss.setData(
            "projectileSpeed",
            projSpeedBase * projectileSpeedMultiplier * difficulty
        );
        this.bossNextPatternAt = this.callbacks.getTime() + 1500 / difficulty;
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

    handleBossPatterns() {
        if (!this.boss || !this.boss.active) return;
        if (this.callbacks.getTime() < this.bossNextPatternAt) return;
        this.fireBossPattern();
    }

    private fireBossPattern() {
        if (!this.boss) return;
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

    private nextBossPattern(): string {
        if (this.bossPatternQueue.length === 0) {
            this.bossPatternQueue = this.callbacks.shuffle(
                this.bossTemplate.patterns
            );
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
        const gapStart = this.callbacks.randFloat(0, Math.PI * 2);
        const baseGapWidth = Math.PI / 9;
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
            this.callbacks.getTime() + this.getBossPatternCooldown(1100);
        this.tryBossPatternOverlap();
    }

    private bossPatternAimedBurst() {
        if (!this.boss) return;
        const targetPilot = this.callbacks.getNearestPilot(
            this.boss.x,
            this.boss.y
        );
        if (!targetPilot) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
        const target = new Phaser.Math.Vector2(
            targetPilot.sprite.x,
            targetPilot.sprite.y
        )
            .subtract(center)
            .normalize();

        const baseSpread = Phaser.Math.DegToRad(8);
        const spread =
            baseSpread * Math.max(0.6, 1.0 - (this.bossPhase - 1) * 0.2);
        const baseBullets = 7;
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
            this.callbacks.getTime() + this.getBossPatternCooldown(950);
        this.tryBossPatternOverlap();
    }

    private bossPatternBeamSpin() {
        if (!this.boss) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
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
            this.callbacks.getTime() + this.getBossPatternCooldown(780);
        this.tryBossPatternOverlap();
    }

    private bossPatternSummonMinions() {
        const phaseMultiplier = 1.0 + (this.bossPhase - 1) * 0.3;
        const eliteChance = Math.min(0.7, 0.35 + (this.bossPhase - 1) * 0.175);

        const choices: EnemySpawn[] = [
            {
                kind: "drifter",
                count: Math.floor(
                    this.callbacks.randBetween(3, 4) * phaseMultiplier
                ),
            },
            {
                kind: "watcher",
                count: Math.floor(
                    this.callbacks.randBetween(1, 2) * phaseMultiplier
                ),
            },
            {
                kind: "mass",
                count: Math.max(1, Math.floor(1 * phaseMultiplier)),
                elite: this.callbacks.rngNext() < eliteChance,
            },
            {
                kind: "phantom",
                count: Math.floor(
                    this.callbacks.randBetween(1, 2) * phaseMultiplier
                ),
                elite: this.callbacks.rngNext() < eliteChance,
            },
            {
                kind: "orbiter",
                count: Math.floor(
                    this.callbacks.randBetween(2, 3) * phaseMultiplier
                ),
            },
            {
                kind: "splitter",
                count: Math.max(1, Math.floor(1 * phaseMultiplier)),
                elite: this.callbacks.rngNext() < eliteChance,
            },
        ];
        const pick = this.callbacks.randChoice(choices);
        this.callbacks.spawnWaveEnemies([pick]);
        this.bossNextPatternAt =
            this.callbacks.getTime() + this.getBossPatternCooldown(1400);
        this.tryBossPatternOverlap();
    }

    private bossPatternConeVolley() {
        if (!this.boss) return;
        const targetPilot = this.callbacks.getNearestPilot(
            this.boss.x,
            this.boss.y
        );
        if (!targetPilot) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
        const target = new Phaser.Math.Vector2(
            targetPilot.sprite.x,
            targetPilot.sprite.y
        )
            .subtract(center)
            .normalize();

        const baseSpread = Phaser.Math.DegToRad(6);
        const spread =
            baseSpread * Math.max(0.7, 1.0 - (this.bossPhase - 1) * 0.15);
        const baseBullets = 9;
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
            this.callbacks.getTime() + this.getBossPatternCooldown(1100);
        this.tryBossPatternOverlap();
    }

    private bossPatternPulseRing() {
        if (!this.boss) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);

        const baseRings = 16;
        const ringBullets = this.getBossBulletDensity(baseRings);
        const ringCount = Math.min(4, 2 + (this.bossPhase - 1));
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

        for (let ring = 0; ring < ringCount; ring++) {
            const ringDelay = ring * delay;
            const ringSpeed = 240 + ring * 40;
            this.callbacks.addDelayedCall(ringDelay, () =>
                fireRing(this.callbacks.randFloat(0, Math.PI * 2), ringSpeed)
            );
        }

        this.bossNextPatternAt =
            this.callbacks.getTime() + this.getBossPatternCooldown(1200);
        this.tryBossPatternOverlap();
    }

    private bossPatternSlam() {
        if (!this.boss) return;
        const targetPilot = this.callbacks.getNearestPilot(
            this.boss.x,
            this.boss.y
        );
        if (!targetPilot) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
        const toward = new Phaser.Math.Vector2(
            targetPilot.sprite.x,
            targetPilot.sprite.y
        )
            .subtract(center)
            .normalize();

        const baseBullets = 3;
        const bulletCount = this.getBossBulletDensity(baseBullets);
        const baseSpread = 0.12;
        const spread =
            baseSpread * Math.max(0.8, 1.0 - (this.bossPhase - 1) * 0.1);

        this.spawnEnemyBullet(
            center.x,
            center.y,
            toward,
            this.getBossProjectileSpeed(360)
        );

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
            this.callbacks.getTime() + this.getBossPatternCooldown(1100);
        this.tryBossPatternOverlap();
    }

    private bossPatternShardSpray() {
        if (!this.boss) return;
        const center = new Phaser.Math.Vector2(this.boss.x, this.boss.y);
        const baseShards = 16;
        const shardCount = this.getBossBulletDensity(baseShards);

        const baseRandomness = 0.05;
        const randomness = baseRandomness * (1.0 + (this.bossPhase - 1) * 0.5);

        for (let i = 0; i < shardCount; i++) {
            const angle =
                (Math.PI * 2 * i) / shardCount +
                this.callbacks.randFloat(-randomness, randomness);
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
            this.callbacks.getTime() + this.getBossPatternCooldown(900);
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

        const waveCount = Math.min(3, 1 + (this.bossPhase - 1));
        const waveDelay = 150 * Math.max(0.6, 1.0 - (this.bossPhase - 1) * 0.2);

        for (let wave = 0; wave < waveCount; wave++) {
            this.callbacks.addDelayedCall(wave * waveDelay, () => {
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
            this.callbacks.getTime() + this.getBossPatternCooldown(850);
        this.tryBossPatternOverlap();
    }

    private getBossPatternCooldown(baseCooldown: number): number {
        const phaseSpeedMultiplier = Math.max(
            0.4,
            1.0 - (this.bossPhase - 1) * 0.3
        );
        const difficultyMultiplier = 1.0 / this.callbacks.getDifficulty();
        return baseCooldown * phaseSpeedMultiplier * difficultyMultiplier;
    }

    private getBossProjectileSpeed(baseSpeed: number): number {
        const phaseSpeedBonus = 1.0 + (this.bossPhase - 1) * 0.25;
        return baseSpeed * this.callbacks.getDifficulty() * phaseSpeedBonus;
    }

    private getBossBulletDensity(baseDensity: number): number {
        const phaseMultiplier = 1.0 + (this.bossPhase - 1) * 0.3;
        return Math.floor(baseDensity * phaseMultiplier);
    }

    private shouldTriggerOverlappingPattern(): boolean {
        const overlapChance = Math.min(0.4, (this.bossPhase - 1) * 0.2);
        return this.callbacks.rngNext() < overlapChance;
    }

    private tryBossPatternOverlap() {
        if (!this.shouldTriggerOverlappingPattern()) return;

        const secondaryPatterns = ["ring-with-gap", "aimed-burst"];
        const pattern = this.callbacks.randChoice(secondaryPatterns);

        this.callbacks.addDelayedCall(200, () => {
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

    private spawnEnemyBullet(
        x: number,
        y: number,
        dir: Phaser.Math.Vector2,
        speed: number,
        heavy = false
    ) {
        const bullet = this.callbacks
            .getEnemyBullets()
            .get(x, y, "enemy-bullet") as Phaser.Physics.Arcade.Image;
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

    handleBossPhaseChange() {
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

            this.triggerBossPhaseTransition(previousPhase, phase);
            this.pulseBackgroundForBossPhase(phase);
            gameEvents.emit(GAME_EVENT_KEYS.bossPhaseChanged, { phase });

            this.bossNextPatternAt = this.callbacks.getTime() + 300;
        }
    }

    private triggerBossPhaseTransition(_fromPhase: number, toPhase: number) {
        if (!this.boss) return;

        const shakeIntensity = 0.01 + (toPhase - 1) * 0.005;
        const shakeDuration = 400 + (toPhase - 1) * 200;
        this.callbacks.getCamera().shake(shakeDuration, shakeIntensity);

        const phaseColors = [
            [255, 100, 100],
            [255, 150, 50],
            [255, 50, 50],
        ];
        const [r, g, b] = phaseColors[toPhase - 1];

        const flashDuration = 400 + (toPhase - 1) * 200;
        this.callbacks.getCamera().flash(flashDuration, r, g, b);

        if (toPhase >= 2) {
            const dangerOverlay = this.callbacks.addRectangle(
                GAME_WIDTH / 2,
                GAME_HEIGHT / 2,
                GAME_WIDTH,
                GAME_HEIGHT,
                toPhase === 3 ? 0xff2020 : 0xff6020,
                0.15
            );
            dangerOverlay.setDepth(10).setBlendMode(Phaser.BlendModes.MULTIPLY);

            this.callbacks.addTween({
                targets: dangerOverlay,
                alpha: { from: 0.15, to: 0.05 },
                duration: 800,
                yoyo: true,
                repeat: 3,
                onComplete: () => dangerOverlay.destroy(),
            });
        }

        if (this.boss) {
            const tintIntensity = 0xffffff - (toPhase - 1) * 0x202020;
            this.boss.setTint(tintIntensity);

            const originalScale = this.boss.scaleX;
            this.callbacks.addTween({
                targets: this.boss,
                scaleX: originalScale * 1.2,
                scaleY: originalScale * 1.2,
                duration: 200,
                yoyo: true,
                ease: "Power2",
            });
        }

        soundManager.playSfx("bossPhaseChange");

        if (this.boss) {
            const burstRadius = 60 + (toPhase - 1) * 20;
            const burstColor =
                toPhase === 3 ? 0xff3030 : toPhase === 2 ? 0xff9632 : 0xff6464;
            this.callbacks.spawnBurstVisual(
                this.boss.x,
                this.boss.y,
                burstRadius,
                burstColor,
                1.0
            );
        }
    }

    private applyBackgroundTone(saturationBoost: number, brightness: number) {
        if (this.backgroundFxTargets.length === 0) return;
        this.backgroundFxTargets.forEach((fx) => {
            fx.reset();
            fx.saturate(saturationBoost);
            fx.brightness(brightness, true);
        });
    }

    pulseBackgroundForBossPhase(phase: number) {
        if (this.backgroundFxTween) {
            this.backgroundFxTween.stop();
            this.backgroundFxTween = undefined;
        }
        if (this.backgroundFxTargets.length === 0) {
            this.callbacks.getCamera().flash(220, 255, 94, 94);
            return;
        }
        const targetSaturation = 0.9 + phase * 0.25;
        const targetBrightness = 1.25 + phase * 0.1;
        this.backgroundFxTween = this.callbacks.addCounter({
            from: 0,
            to: 1,
            duration: 320,
            yoyo: true,
            ease: "Quad.easeOut",
            onUpdate: (tw: Phaser.Tweens.Tween) => {
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

    playBossIntroPulse() {
        if (this.bossIntroOverlay) {
            this.callbacks.addTween({
                targets: this.bossIntroOverlay,
                alpha: 0,
                duration: 0,
            });
            this.bossIntroOverlay.setVisible(true);
            this.bossIntroOverlay.setAlpha(0);
            this.bossIntroOverlay.setFillStyle(
                this.bossIntroColor,
                this.bossIntroOverlay.fillAlpha
            );
            this.callbacks.addTween({
                targets: this.bossIntroOverlay,
                alpha: { from: 0, to: 0.82 },
                duration: 180,
                ease: "Quad.easeOut",
                yoyo: true,
                hold: 260,
                onComplete: () => this.bossIntroOverlay?.setVisible(false),
            });
        } else {
            const rgb = Phaser.Display.Color.IntegerToRGB(this.bossIntroColor);
            this.callbacks.getCamera().flash(220, rgb.r, rgb.g, rgb.b);
        }
        this.pulseBackgroundForBossPhase(this.bossPhase || 1);
    }
}
