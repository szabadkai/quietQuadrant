/**
 * Upgrade Effects - Handles applying upgrade effects to game state
 * Extracted from UpgradeSystem to improve modularity
 */

import type { UpgradeDefinition } from "../../models/types";
import type { UpgradeConfig } from "./interfaces/UpgradeSystem";

export type PlayerStatsUpdater = (stats: any) => void;
export type ProjectileScaleUpdater = (scale: number) => void;
export type GlassCannonCapUpdater = (cap: number | null) => void;

export class UpgradeEffects {
    private playerStatsUpdater?: PlayerStatsUpdater;
    private projectileScaleUpdater?: ProjectileScaleUpdater;
    private glassCannonCapUpdater?: GlassCannonCapUpdater;

    setPlayerStatsUpdater(updater: PlayerStatsUpdater): void {
        this.playerStatsUpdater = updater;
    }

    setProjectileScaleUpdater(updater: ProjectileScaleUpdater): void {
        this.projectileScaleUpdater = updater;
    }

    setGlassCannonCapUpdater(updater: GlassCannonCapUpdater): void {
        this.glassCannonCapUpdater = updater;
    }

    private updatePlayerStats(statChanges: any): void {
        if (this.playerStatsUpdater) {
            this.playerStatsUpdater(statChanges);
        }
    }

    applyUpgradeEffects(
        def: UpgradeDefinition,
        stacks: number,
        upgradeConfig: UpgradeConfig
    ): void {
        switch (def.id) {
            case "power-shot":
                this.updatePlayerStats({
                    damage: { multiply: 1.15 },
                    critChance: { add: 0.05 },
                });
                break;
            case "rapid-fire":
                this.updatePlayerStats({ fireRate: { multiply: 1.15 } });
                break;
            case "swift-projectiles":
                this.updatePlayerStats({ projectileSpeed: { multiply: 1.2 } });
                break;
            case "engine-tune":
                this.updatePlayerStats({ moveSpeed: { multiply: 1.1 } });
                break;
            case "plating":
                this.applyPlating(stacks, upgradeConfig);
                break;
            case "sidecar":
                this.updatePlayerStats({ projectiles: { add: 1 } });
                break;
            case "pierce":
                this.updatePlayerStats({ pierce: { add: 1 } });
                break;
            case "heavy-barrel":
                this.applyHeavyBarrel();
                break;
            case "rebound":
                this.updatePlayerStats({
                    bounce: { add: 2 },
                    projectileSpeed: { multiply: 0.95 },
                });
                break;
            case "dash-sparks":
                this.applyDashSparks(stacks, upgradeConfig);
                break;
            case "held-charge":
                this.applyHeldCharge(stacks, upgradeConfig);
                break;
            case "shield-pickup":
                this.applyShieldPickup(stacks, upgradeConfig);
                break;
            case "kinetic-siphon":
                this.applyKineticSiphon(stacks, upgradeConfig);
                break;
            case "prism-spread":
                this.applyPrismSpread(stacks, upgradeConfig);
                break;
            case "momentum-feed":
                this.applyMomentumFeed(stacks, upgradeConfig);
                break;
            case "split-shot":
                this.applySplitShot(stacks, upgradeConfig);
                break;
            case "explosive-impact":
                this.applyExplosiveImpact(stacks, upgradeConfig);
                break;
            case "chain-arc":
                this.applyChainArc(stacks, upgradeConfig);
                break;
            case "magnet-coil":
                this.applyMagnetCoil(stacks, upgradeConfig);
                break;
            case "stabilizers":
                this.applyStabilizers(stacks, upgradeConfig);
                break;
            case "shrapnel":
                this.applyShrapnel(stacks, upgradeConfig);
                break;
            case "heatseeker":
                this.applyHeatseeker(stacks, upgradeConfig);
                break;
            case "neutron-core":
                this.applyNeutronCore(upgradeConfig);
                break;
            case "glass-cannon":
                this.applyGlassCannon();
                break;
            case "singularity-rounds":
                this.applySingularityRounds(upgradeConfig);
                break;
            case "bullet-hell":
                this.applyBulletHell(upgradeConfig);
                break;
            case "blood-fuel":
                this.applyBloodFuel(stacks, upgradeConfig);
                break;
            case "chain-reaction":
                this.applyChainReaction(stacks, upgradeConfig);
                break;
            case "quantum-tunneling":
                this.applyQuantumTunneling(upgradeConfig);
                break;
            case "berserk-module":
                this.applyBerserkModule(stacks, upgradeConfig);
                break;
        }
    }

    private applyPlating(stacks: number, config: UpgradeConfig): void {
        const damageReduction = Math.min(0.08 * stacks, 0.6);
        config.platingConfig = { stacks, damageReduction };
        this.updatePlayerStats({
            maxHealth: { add: 1 },
            health: { add: 1, cap: "maxHealth" },
        });
    }

    private applyHeavyBarrel(): void {
        this.updatePlayerStats({
            damage: { multiply: 1.2 },
            fireRate: { multiply: 0.9 },
            critMultiplier: { add: 0.05 },
        });
        this.projectileScaleUpdater?.(1.1);
    }

    private applyDashSparks(stacks: number, config: UpgradeConfig): void {
        const shards = 6 + (stacks - 1) * 2;
        const damage = 1.6 + (stacks - 1) * 0.25;
        config.dashSparkConfig = { stacks, shards, damage };
    }

    private applyHeldCharge(stacks: number, config: UpgradeConfig): void {
        const idleMs = Math.max(400, 800 - (stacks - 1) * 80);
        const damageBonus = 0.8 + (stacks - 1) * 0.12;
        const sizeBonus = 0.2;
        const chargePierceBonus = 2 + (stacks - 1);
        config.capacitorConfig = {
            stacks,
            idleMs,
            damageBonus,
            sizeBonus,
            chargePierceBonus,
        };
    }

    private applyShieldPickup(stacks: number, config: UpgradeConfig): void {
        const durationMs = (2 + (stacks - 1) * 0.3) * 1000;
        const cooldownMs = Math.max(3000, 5000 - (stacks - 1) * 600);
        const shieldHp = 60;
        config.shieldConfig = {
            stacks,
            shieldHp,
            durationMs,
            cooldownMs,
            nextReadyAt: 0,
        };
    }

    private applyKineticSiphon(stacks: number, config: UpgradeConfig): void {
        const healAmount = 0.3 + (stacks - 1) * 0.1;
        const cooldownMs = Math.max(800, 1200 - (stacks - 1) * 200);
        config.kineticConfig = {
            stacks,
            healAmount,
            cooldownMs,
            nextReadyAt: 0,
        };
    }

    private applyPrismSpread(stacks: number, config: UpgradeConfig): void {
        const prevBonus = config.spreadConfig.critBonus;
        const spreadDegrees = Math.max(3, 6 - (stacks - 1) * 1.5);
        const critBonus = 0.05 * stacks;
        config.spreadConfig = { stacks, spreadDegrees, critBonus };
        this.updatePlayerStats({ critChance: { add: critBonus - prevBonus } });
    }

    private applyMomentumFeed(stacks: number, config: UpgradeConfig): void {
        const ramp = 0.25 + (stacks - 1) * 0.05;
        const timeToMaxMs = Math.max(1400, 2000 - (stacks - 1) * 200);
        config.momentumConfig = {
            stacks,
            ramp,
            timeToMaxMs,
            timerMs: 0,
            bonus: 0,
        };
    }

    private applySplitShot(stacks: number, config: UpgradeConfig): void {
        const damageMultiplier = 0.5 + (stacks - 1) * 0.1;
        const spreadDegrees = Math.max(8, 12 - (stacks - 1) * 2);
        config.splitConfig = {
            enabled: true,
            forks: 2,
            spreadDegrees,
            damageMultiplier,
        };
    }

    private applyExplosiveImpact(stacks: number, config: UpgradeConfig): void {
        const radius = 32 + (stacks - 1) * 10;
        const damageMultiplier = 0.55 + (stacks - 1) * 0.1;
        config.explosiveConfig = { stacks, radius, damageMultiplier };
    }

    private applyChainArc(stacks: number, config: UpgradeConfig): void {
        const range = 180 + (stacks - 1) * 20;
        const damagePercent = 0.6 + (stacks - 1) * 0.1;
        const cooldownMs = Math.max(120, 150 - (stacks - 1) * 20);
        config.chainArcConfig = {
            stacks,
            range,
            damagePercent,
            cooldownMs,
            lastAt: 0,
        };
    }

    private applyMagnetCoil(stacks: number, config: UpgradeConfig): void {
        const radiusMult = 1 + 0.3 + (stacks - 1) * 0.15;
        const speedMult = 1 + 0.2 + (stacks - 1) * 0.1;
        config.magnetConfig = { stacks, radiusMult, speedMult };
    }

    private applyStabilizers(stacks: number, config: UpgradeConfig): void {
        const contactMultiplier = Math.max(0.5, 1 - 0.15 * stacks);
        config.stabilizerConfig = { stacks, contactMultiplier };
    }

    private applyShrapnel(stacks: number, config: UpgradeConfig): void {
        const shards = 6 + (stacks - 1) * 2;
        const damage = 0.35 + (stacks - 1) * 0.05;
        config.shrapnelConfig = { stacks, shards, damage };
    }

    private applyHeatseeker(stacks: number, config: UpgradeConfig): void {
        const range = 240 + (stacks - 1) * 60;
        const turnRate = stacks === 1 ? 10 : stacks === 2 ? 30 : 90;
        config.homingConfig = { stacks, range, turnRate };
    }

    private applyNeutronCore(config: UpgradeConfig): void {
        config.neutronCoreConfig = { active: true, speedMultiplier: 0.6 };
        this.projectileScaleUpdater?.(1.15);
        this.updatePlayerStats({ projectileSpeed: { multiply: 0.6 } });
    }

    private applyGlassCannon(): void {
        this.glassCannonCapUpdater?.(1);
        this.updatePlayerStats({
            damage: { multiply: 3 },
            critChance: { add: 0.1 },
            maxHealth: { set: 1 },
            health: { set: 1 },
        });
    }

    private applySingularityRounds(config: UpgradeConfig): void {
        config.singularityConfig = {
            active: true,
            radius: 160,
            pullStrength: 640,
        };
    }

    private applyBulletHell(config: UpgradeConfig): void {
        config.bulletHellConfig = {
            active: true,
            fireRateMultiplier: 4,
            damageMultiplier: 0.6,
            inaccuracyRad: 34,
        };
        this.updatePlayerStats({
            fireRate: { multiply: 4 },
            damage: { multiply: 0.6 },
        });
    }

    private applyBloodFuel(stacks: number, config: UpgradeConfig): void {
        const healPercent = 0.12 + (stacks - 1) * 0.03;
        const fireCostPercent = 0.02 * stacks;
        config.bloodFuelConfig = { stacks, healPercent, fireCostPercent };
    }

    private applyChainReaction(stacks: number, config: UpgradeConfig): void {
        const radius = 70 + (stacks - 1) * 10;
        const damagePercent = 0.5 + (stacks - 1) * 0.05;
        config.chainReactionConfig = { stacks, radius, damagePercent };
    }

    private applyQuantumTunneling(config: UpgradeConfig): void {
        config.quantumConfig = {
            active: true,
            wrapMargin: 18,
            projectileLifetimeMs: 3800,
        };
    }

    private applyBerserkModule(stacks: number, config: UpgradeConfig): void {
        const maxBonus = 1 + (stacks - 1) * 0.5;
        config.berserkConfig = { stacks, maxBonus };
    }
}
