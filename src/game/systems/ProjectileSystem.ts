/**
 * Projectile system implementation
 * Handles bullet physics, collision detection, and special effects
 * Extracted from MainScene to improve modularity
 */

import * as Phaser from "phaser";
import type { CollisionTarget } from "../types/GameTypes";
import { CollisionHandler } from "./CollisionHandler";
import { EffectProcessor } from "./EffectProcessor";
import { eventBus } from "./EventBus";
import { BaseGameSystem } from "./interfaces/GameSystem";
import type {
    CollisionResult,
    ICollisionHandler,
    IEffectProcessor,
    IProjectileSystem,
    ProjectileConfig,
    ProjectileState,
} from "./interfaces/ProjectileSystem";
import { HomingHandler } from "./HomingHandler";
import { ProjectileBoundsHandler } from "./ProjectileBoundsHandler";

const OBJECT_SCALE = 0.7;
const PROJECTILE_MAX_LIFETIME_MS = 3800;
const COLOR_ACCENT = 0x9ff0ff;
const COLOR_CHARGE = 0xf7d46b;
const COLOR_OVERLOAD = 0xffd7a6;

export interface ProjectileSystemConfig {
    homingConfig: { stacks: number; range: number; turnRate: number };
    quantumConfig: {
        active: boolean;
        wrapMargin: number;
        projectileLifetimeMs: number;
    };
    neutronCoreConfig: { active: boolean; speedMultiplier: number };
    explosiveConfig: {
        stacks: number;
        radius: number;
        damageMultiplier: number;
    };
    splitConfig: {
        enabled: boolean;
        forks: number;
        spreadDegrees: number;
        damageMultiplier: number;
    };
    projectileScale: number;
}

export interface SpawnBulletConfig {
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
}

export class ProjectileSystem
    extends BaseGameSystem
    implements IProjectileSystem
{
    private bullets?: Phaser.Physics.Arcade.Group;
    private enemyBullets?: Phaser.Physics.Arcade.Group;
    private collisionHandler: ICollisionHandler;
    private effectProcessor: IEffectProcessor;
    private boundsHandler?: ProjectileBoundsHandler;
    private homingHandler?: HomingHandler;

    // Configuration - will be updated by upgrade system
    private config: ProjectileSystemConfig = {
        homingConfig: { stacks: 0, range: 0, turnRate: 0 },
        quantumConfig: {
            active: false,
            wrapMargin: 18,
            projectileLifetimeMs: PROJECTILE_MAX_LIFETIME_MS,
        },
        neutronCoreConfig: { active: false, speedMultiplier: 0.6 },
        explosiveConfig: { stacks: 0, radius: 0, damageMultiplier: 0 },
        splitConfig: {
            enabled: false,
            forks: 2,
            spreadDegrees: 12,
            damageMultiplier: 0.5,
        },
        projectileScale: 1,
    };

    constructor() {
        super("projectile-system", []);
        this.collisionHandler = new CollisionHandler();
        this.effectProcessor = new EffectProcessor();
    }

    protected onInitialize(): void {
        const scene = this.getScene();
        this.setupProjectileGroups();
        this.setupEventListeners();
        this.boundsHandler = new ProjectileBoundsHandler(scene);
        this.homingHandler = new HomingHandler(scene);
    }

    protected onShutdown(): void {
        this.bullets?.destroy();
        this.enemyBullets?.destroy();
        eventBus.removeAllListeners("projectile:fired");
        eventBus.removeAllListeners("projectile:hit");
        eventBus.removeAllListeners("projectile:expired");
    }

    update(time: number, delta: number): void {
        const dt = delta / 1000;
        this.homingHandler?.handleHeatseekingProjectiles(
            this.bullets,
            this.config.homingConfig,
            dt
        );
        this.boundsHandler?.handleProjectileBounds(
            this.bullets,
            this.enemyBullets,
            this.config
        );
    }

    // Configuration methods
    updateConfig(newConfig: Partial<ProjectileSystemConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    getProjectileGroups(): {
        bullets: Phaser.Physics.Arcade.Group | undefined;
        enemyBullets: Phaser.Physics.Arcade.Group | undefined;
    } {
        return {
            bullets: this.bullets,
            enemyBullets: this.enemyBullets,
        };
    }

    // Main projectile spawning method extracted from MainScene
    spawnBullet(config: SpawnBulletConfig): Phaser.Physics.Arcade.Image | null {
        if (!this.bullets) {
            console.warn("ProjectileSystem: bullets group not initialized");
            return null;
        }

        const bullet = this.bullets.get(
            config.x,
            config.y,
            "bullet"
        ) as Phaser.Physics.Arcade.Image;
        if (!bullet) {
            console.warn("ProjectileSystem: failed to get bullet from pool");
            return null;
        }

        const sizeScale =
            (config.sizeMultiplier ?? 1) *
            this.config.projectileScale *
            OBJECT_SCALE;
        const isHeavy = this.config.neutronCoreConfig.active;
        const isRailgun =
            config.charged === true && config.tags.includes("railgun");

        bullet.setActive(true);
        bullet.setVisible(true);
        bullet.setScale(sizeScale);

        const body = bullet.body as Phaser.Physics.Arcade.Body;

        // Ensure physics body is enabled
        if (body) {
            body.enable = true;
        }

        // dir is already scaled by speed, so we just apply neutron core modifier if active
        const speedModifier = isHeavy
            ? this.config.neutronCoreConfig.speedMultiplier
            : 1;

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
            config.dir.x * speedModifier,
            config.dir.y * speedModifier
        );
        bullet.setRotation(config.dir.angle());

        // Set projectile data
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
            this.config.quantumConfig.active
                ? this.getScene().time.now +
                      this.config.quantumConfig.projectileLifetimeMs
                : null
        );

        // Set visual effects
        bullet.setTint(
            isRailgun
                ? COLOR_OVERLOAD
                : config.charged
                ? COLOR_CHARGE
                : COLOR_ACCENT
        );

        return bullet;
    }

    // Extracted from MainScene - handles projectile collision with enemies
    handleBulletHitEnemy(
        bullet: Phaser.GameObjects.GameObject,
        target: Phaser.GameObjects.GameObject,
        onDamageCallback?: (
            enemy: Phaser.Physics.Arcade.Image,
            damage: number,
            projectile: Phaser.Physics.Arcade.Image
        ) => void,
        onExplosiveCallback?: (
            projectile: Phaser.Physics.Arcade.Image,
            enemy: Phaser.Physics.Arcade.Image
        ) => void
    ): void {
        const projectile = bullet as Phaser.Physics.Arcade.Image;
        const enemy = target as Phaser.Physics.Arcade.Image;
        const damage = projectile.getData("damage") as number;
        const pierceLeft = projectile.getData("pierce") as number;

        // Apply damage through callback
        if (onDamageCallback) {
            onDamageCallback(enemy, damage, projectile);
        }

        // Handle special effects
        this.handleForks(projectile, enemy);

        if (onExplosiveCallback) {
            onExplosiveCallback(projectile, enemy);
        }

        // Handle pierce
        if (pierceLeft > 0) {
            projectile.setData("pierce", pierceLeft - 1);
        } else {
            projectile.destroy();
        }
    }

    // Extracted from MainScene - handles projectile interception
    handleProjectileIntercept(
        playerBullet: Phaser.Physics.Arcade.Image,
        enemyBullet: Phaser.Physics.Arcade.Image
    ): void {
        if (playerBullet.getData("isHeavy") !== true) return;

        enemyBullet.destroy();
        const pierceLeft = (playerBullet.getData("pierce") as number) ?? 0;
        if (pierceLeft > 0) {
            playerBullet.setData("pierce", pierceLeft - 1);
        } else {
            playerBullet.destroy();
        }

        // Emit visual effect event
        eventBus.emit("vfx:explosion", {
            position: { x: playerBullet.x, y: playerBullet.y },
            radius: 18 * OBJECT_SCALE,
            color: COLOR_OVERLOAD,
        });
    }

    // IProjectileSystem interface implementation
    fireProjectile(
        type: "player" | "enemy",
        position: Phaser.Math.Vector2,
        direction: Phaser.Math.Vector2,
        config: ProjectileConfig
    ): string | undefined {
        const projectileId = `${type}-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}`;

        if (type === "player") {
            const bulletConfig: SpawnBulletConfig = {
                x: position.x,
                y: position.y,
                dir: direction.clone().scale(config.speed),
                damage: config.damage,
                pierce: config.pierce,
                bounce: config.bounce,
                tags: config.effects,
                charged: config.effects.includes("charged"),
                sizeMultiplier: config.size,
            };

            const bullet = this.spawnBullet(bulletConfig);
            return bullet ? projectileId : undefined;
        } else {
            return this.spawnEnemyBullet(
                projectileId,
                position,
                direction,
                config
            );
        }
    }

    removeProjectile(projectileId: string): void {
        // This would be used if we maintained a projectile registry
        // For now, projectiles are managed directly by Phaser groups
    }

    getActiveProjectiles(): ProjectileState[] {
        const projectiles: ProjectileState[] = [];

        if (this.bullets) {
            this.bullets.getChildren().forEach((child) => {
                const bullet = child as Phaser.Physics.Arcade.Image;
                if (bullet.active) {
                    const body = bullet.body as Phaser.Physics.Arcade.Body;
                    projectiles.push({
                        id: `bullet-${bullet.x}-${bullet.y}`,
                        type: "player",
                        position: new Phaser.Math.Vector2(bullet.x, bullet.y),
                        velocity: new Phaser.Math.Vector2(
                            body.velocity.x,
                            body.velocity.y
                        ),
                        damage: bullet.getData("damage") || 0,
                        pierce: bullet.getData("pierce") || 0,
                        bounce: bullet.getData("bounces") || 0,
                        lifetime: 0,
                        maxLifetime: PROJECTILE_MAX_LIFETIME_MS,
                        sprite: bullet,
                        tags: bullet.getData("tags") || [],
                    });
                }
            });
        }

        return projectiles;
    }

    getProjectilesByType(type: "player" | "enemy"): ProjectileState[] {
        return this.getActiveProjectiles().filter((p) => p.type === type);
    }

    handleCollision(
        projectileId: string,
        target: CollisionTarget
    ): CollisionResult {
        return this.collisionHandler.calculateCollisionResult(
            projectileId,
            target
        );
    }

    clearAllProjectiles(): void {
        this.bullets?.clear(true, true);
        this.enemyBullets?.clear(true, true);
    }

    // Private methods extracted from MainScene
    private setupProjectileGroups(): void {
        const scene = this.getScene();

        this.bullets = scene.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            maxSize: 128,
            runChildUpdate: false,
        });

        this.enemyBullets = scene.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            maxSize: 256,
            runChildUpdate: false,
        });
    }

    private setupEventListeners(): void {
        // Listen for projectile requests from other systems
        eventBus.on("projectile:fired", (data) => {
            const config: ProjectileConfig = {
                damage: data.damage ?? 10,
                speed: data.speed ?? 500,
                pierce: data.pierce ?? 0,
                bounce: data.bounce ?? 0,
                lifetime: 3000,
                size: 1,
                effects: data.charged ? ["charged"] : [],
            };

            const direction = data.direction
                ? new Phaser.Math.Vector2(data.direction.x, data.direction.y)
                : new Phaser.Math.Vector2(1, 0);

            this.fireProjectile(
                data.type,
                new Phaser.Math.Vector2(data.position.x, data.position.y),
                direction,
                config
            );
        });
    }

    private getPierceWithSynergy(
        basePierce: number,
        isCharged: boolean
    ): number {
        if (isCharged && this.config.splitConfig.enabled) return 999; // Railgun synergy
        return basePierce;
    }

    private handleForks(
        projectile: Phaser.Physics.Arcade.Image,
        enemy: Phaser.Physics.Arcade.Image
    ): void {
        if (!this.config.splitConfig.enabled) return;
        if (!projectile.getData("canFork")) return;

        const sourceType = projectile.getData("sourceType") as string;
        if (sourceType === "fork") return;

        projectile.setData("canFork", false);

        const forks = this.config.splitConfig.forks;
        const spreadDeg = this.config.splitConfig.spreadDegrees;
        const damageMultiplier = this.config.splitConfig.damageMultiplier;
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

    private spawnEnemyBullet(
        id: string,
        position: Phaser.Math.Vector2,
        direction: Phaser.Math.Vector2,
        config: ProjectileConfig
    ): string | undefined {
        if (!this.enemyBullets) return undefined;

        const scene = this.getScene();
        const bullet = this.enemyBullets.get(
            position.x,
            position.y,
            "enemy-bullet"
        ) as Phaser.Physics.Arcade.Image;
        if (!bullet) return undefined;

        const sizeScale = config.size * OBJECT_SCALE;
        const heavy = config.effects.includes("heavy");

        bullet.setActive(true);
        bullet.setVisible(true);
        bullet.setScale(heavy ? sizeScale * 1.5 : sizeScale);
        bullet.setVelocity(
            direction.x * config.speed,
            direction.y * config.speed
        );
        bullet.setData("damage", heavy ? config.damage * 2 : config.damage);
        bullet.setData("heavy", heavy);

        // Set bullet lifetime
        scene.time.delayedCall(config.lifetime, () => {
            if (bullet.active) {
                bullet.setActive(false);
                bullet.setVisible(false);
            }
        });

        return id;
    }
}
