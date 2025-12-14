/**
 * Upgrade system interface and related types
 */

import type {
    UpgradeDefinition,
    SynergyDefinition,
} from "../../../models/types";
import type { GameSystem } from "./GameSystem";

export interface UpgradeState {
    [id: string]: number;
}

export interface SynergyState {
    activeSynergies: Set<string>;
}

export interface UpgradeConfig {
    // Configuration for various upgrade effects
    capacitorConfig: {
        stacks: number;
        idleMs: number;
        damageBonus: number;
        sizeBonus: number;
        chargePierceBonus: number;
    };
    afterimageConfig: {
        stacks: number;
        trailShots: number;
        shotDamage: number;
    };
    dashSparkConfig: {
        stacks: number;
        shards: number;
        damage: number;
    };
    shieldConfig: {
        stacks: number;
        shieldHp: number;
        durationMs: number;
        cooldownMs: number;
        nextReadyAt: number;
    };
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
    chainArcConfig: {
        stacks: number;
        range: number;
        damagePercent: number;
        cooldownMs: number;
        lastAt: number;
    };
    kineticConfig: {
        stacks: number;
        healAmount: number;
        cooldownMs: number;
        nextReadyAt: number;
    };
    momentumConfig: {
        stacks: number;
        ramp: number;
        timeToMaxMs: number;
        timerMs: number;
        bonus: number;
    };
    spreadConfig: {
        stacks: number;
        spreadDegrees: number;
        critBonus: number;
    };
    homingConfig: {
        stacks: number;
        range: number;
        turnRate: number;
    };
    magnetConfig: {
        stacks: number;
        radiusMult: number;
        speedMult: number;
    };
    stabilizerConfig: {
        stacks: number;
        contactMultiplier: number;
    };
    platingConfig: {
        stacks: number;
        damageReduction: number;
    };
    shrapnelConfig: {
        stacks: number;
        shards: number;
        damage: number;
    };
    neutronCoreConfig: {
        active: boolean;
        speedMultiplier: number;
    };
    singularityConfig: {
        active: boolean;
        radius: number;
        pullStrength: number;
    };
    bulletHellConfig: {
        active: boolean;
        fireRateMultiplier: number;
        damageMultiplier: number;
        inaccuracyRad: number;
    };
    bloodFuelConfig: {
        stacks: number;
        healPercent: number;
        fireCostPercent: number;
    };
    chainReactionConfig: {
        stacks: number;
        radius: number;
        damagePercent: number;
    };
    quantumConfig: {
        active: boolean;
        wrapMargin: number;
        projectileLifetimeMs: number;
    };
    berserkConfig: {
        stacks: number;
        maxBonus: number;
    };
}

export interface IUpgradeSystem extends GameSystem {
    /**
     * Apply an upgrade to the player
     */
    applyUpgrade(upgradeId: string): void;

    /**
     * Get current upgrade stacks
     */
    getUpgradeStacks(): UpgradeState;

    /**
     * Get upgrade stack count for a specific upgrade
     */
    getUpgradeStack(upgradeId: string): number;

    /**
     * Roll upgrade options for level up
     */
    rollUpgradeOptions(): UpgradeDefinition[];

    /**
     * Get pending upgrade options
     */
    getPendingUpgradeOptions(): UpgradeDefinition[];

    /**
     * Clear pending upgrade options
     */
    clearPendingUpgradeOptions(): void;

    /**
     * Check and activate synergies
     */
    checkSynergies(): void;

    /**
     * Get active synergies
     */
    getActiveSynergies(): Set<string>;

    /**
     * Get upgrade configuration for effects
     */
    getUpgradeConfig(): UpgradeConfig;

    /**
     * Reset upgrade state
     */
    resetUpgradeState(): void;

    /**
     * Set random number generator for upgrade rolling
     */
    setRng(rng: { next(): number; nextInt(max: number): number }): void;

    /**
     * Set affix for upgrade bonuses
     */
    setAffix(affix: { rareUpgradeBonus?: number } | null): void;
}

export interface ISynergyProcessor {
    /**
     * Process synergy activation
     */
    processSynergy(synergyId: string): void;

    /**
     * Check if synergy requirements are met
     */
    checkSynergyRequirements(
        synergy: SynergyDefinition,
        upgradeStacks: UpgradeState
    ): boolean;

    /**
     * Get synergy effects for a given synergy
     */
    getSynergyEffects(synergyId: string): any;
}
