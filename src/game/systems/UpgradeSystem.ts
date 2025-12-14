/**
 * Upgrade System - Handles upgrade logic, synergy calculations, and progression tracking
 */

import { SYNERGY_DEFINITIONS } from "../../config/synergies";
import {
    getUpgradeDefinition,
    UPGRADE_CATALOG,
    UPGRADE_RARITY_ODDS,
} from "../../config/upgrades";
import type { UpgradeDefinition, WeeklyAffix } from "../../models/types";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";
import { GAME_EVENT_KEYS, gameEvents } from "../events";
import { BaseGameSystem } from "./interfaces/GameSystem";
import type {
    IUpgradeSystem,
    ISynergyProcessor,
    UpgradeConfig,
    UpgradeState,
} from "./interfaces/UpgradeSystem";
import { SynergyProcessor } from "./SynergyProcessor";
import { UpgradeEffects } from "./UpgradeEffects";

export class UpgradeSystem extends BaseGameSystem implements IUpgradeSystem {
    private upgradeStacks: UpgradeState = {};
    private pendingUpgradeOptions: UpgradeDefinition[] = [];
    private activeSynergies = new Set<string>();
    private upgradeConfig: UpgradeConfig;
    private synergyProcessor: SynergyProcessor;
    private rng: { next(): number; nextInt(max: number): number } = {
        next: () => Math.random(),
        nextInt: (max: number) => Math.floor(Math.random() * max),
    };
    private affix: WeeklyAffix | null = null;
    private upgradeEffects: UpgradeEffects;

    constructor() {
        super("upgrade-system", []);
        this.upgradeConfig = this.createDefaultUpgradeConfig();
        this.upgradeEffects = new UpgradeEffects();
        this.synergyProcessor = new SynergyProcessor((stats) =>
            this.updatePlayerStats(stats)
        );
    }

    protected onInitialize(): void {
        // System is ready to process upgrades
    }

    protected onShutdown(): void {
        this.resetUpgradeState();
    }

    update(_time: number, _delta: number): void {
        // Upgrade system doesn't need frame-by-frame updates
        // All upgrade processing is event-driven
    }

    setPlayerStatsUpdater(updater: (stats: any) => void): void {
        this.upgradeEffects.setPlayerStatsUpdater(updater);
    }

    setProjectileScaleUpdater(updater: (scale: number) => void): void {
        this.upgradeEffects.setProjectileScaleUpdater(updater);
    }

    setGlassCannonCapUpdater(updater: (cap: number | null) => void): void {
        this.upgradeEffects.setGlassCannonCapUpdater(updater);
    }

    applyUpgrade(upgradeId: string): void {
        const def = getUpgradeDefinition(upgradeId);
        if (!def) return;

        const current = this.upgradeStacks[upgradeId] ?? 0;
        if (def.maxStacks && current >= def.maxStacks) return;

        this.upgradeStacks[upgradeId] = current + 1;
        this.pendingUpgradeOptions = [];

        useUIStore.getState().actions.closeUpgradeSelection();
        this.applyUpgradeEffects(def);
        this.checkSynergies();

        useRunStore.getState().actions.addUpgrade({
            id: def.id,
            stacks: this.upgradeStacks[upgradeId],
        });
    }

    getUpgradeStacks(): UpgradeState {
        return { ...this.upgradeStacks };
    }

    getUpgradeStack(upgradeId: string): number {
        return this.upgradeStacks[upgradeId] ?? 0;
    }

    rollUpgradeOptions(): UpgradeDefinition[] {
        const sidecarStacks = this.upgradeStacks.sidecar ?? 0;
        const available = UPGRADE_CATALOG.filter((u) => {
            const stacks = this.upgradeStacks[u.id] ?? 0;
            // Prism Spread only matters when Sidecar is active; hide it until then.
            if (u.id === "prism-spread" && sidecarStacks === 0) return false;
            return u.maxStacks ? stacks < u.maxStacks : true;
        });

        const picks: UpgradeDefinition[] = [];
        const rareBonus = this.affix?.rareUpgradeBonus ?? 0;

        const weightFor = (u: UpgradeDefinition) => {
            const rarityBase =
                u.rarity === "rare"
                    ? UPGRADE_RARITY_ODDS.rare * (1 + rareBonus)
                    : UPGRADE_RARITY_ODDS[u.rarity] ?? 0;
            return Math.max(0, (u.dropWeight ?? 1) * rarityBase);
        };

        const weightedPool = available
            .map((u) => ({ def: u, weight: weightFor(u) }))
            .filter((entry) => entry.weight > 0);

        for (let i = 0; i < 3; i++) {
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

        this.pendingUpgradeOptions = picks;
        return picks;
    }

    getPendingUpgradeOptions(): UpgradeDefinition[] {
        return [...this.pendingUpgradeOptions];
    }

    clearPendingUpgradeOptions(): void {
        this.pendingUpgradeOptions = [];
    }

    checkSynergies(): void {
        SYNERGY_DEFINITIONS.forEach((syn) => {
            if (this.activeSynergies.has(syn.id)) return;
            const ready = this.synergyProcessor.checkSynergyRequirements(
                syn,
                this.upgradeStacks
            );
            if (ready) {
                this.enableSynergy(syn.id);
            }
        });
    }

    getActiveSynergies(): Set<string> {
        return new Set(this.activeSynergies);
    }

    getUpgradeConfig(): UpgradeConfig {
        return { ...this.upgradeConfig };
    }

    resetUpgradeState(): void {
        this.upgradeStacks = {};
        this.pendingUpgradeOptions = [];
        this.activeSynergies.clear();
        this.upgradeConfig = this.createDefaultUpgradeConfig();
    }

    setRng(rng: { next(): number; nextInt(max: number): number }): void {
        this.rng = rng;
    }

    setAffix(affix: WeeklyAffix | null): void {
        this.affix = affix;
    }

    private enableSynergy(id: string): void {
        if (this.activeSynergies.has(id)) return;

        this.activeSynergies.add(id);
        this.synergyProcessor.processSynergy(id);
        useRunStore.getState().actions.unlockSynergy(id);

        // Emit synergy activation event
        gameEvents.emit(GAME_EVENT_KEYS.synergyActivated, { synergyId: id });
    }

    private updatePlayerStats(statChanges: any): void {
        // Delegate to upgrade effects which has the updater
        // This is called by synergy processor
    }

    private applyUpgradeEffects(def: UpgradeDefinition): void {
        const stacks = this.upgradeStacks[def.id];
        this.upgradeEffects.applyUpgradeEffects(
            def,
            stacks,
            this.upgradeConfig
        );
    }

    private createDefaultUpgradeConfig(): UpgradeConfig {
        return {
            capacitorConfig: {
                stacks: 0,
                idleMs: 1000,
                damageBonus: 0.9,
                sizeBonus: 0.2,
                chargePierceBonus: 0,
            },
            afterimageConfig: { stacks: 0, trailShots: 0, shotDamage: 0 },
            dashSparkConfig: { stacks: 0, shards: 0, damage: 0 },
            shieldConfig: {
                stacks: 0,
                shieldHp: 60,
                durationMs: 0,
                cooldownMs: 0,
                nextReadyAt: 0,
            },
            explosiveConfig: { stacks: 0, radius: 0, damageMultiplier: 0 },
            splitConfig: {
                enabled: false,
                forks: 2,
                spreadDegrees: 12,
                damageMultiplier: 0.5,
            },
            chainArcConfig: {
                stacks: 0,
                range: 180,
                damagePercent: 0.6,
                cooldownMs: 150,
                lastAt: 0,
            },
            kineticConfig: {
                stacks: 0,
                healAmount: 0.3,
                cooldownMs: 1200,
                nextReadyAt: 0,
            },
            momentumConfig: {
                stacks: 0,
                ramp: 0.25,
                timeToMaxMs: 2000,
                timerMs: 0,
                bonus: 0,
            },
            spreadConfig: { stacks: 0, spreadDegrees: 6, critBonus: 0 },
            homingConfig: { stacks: 0, range: 0, turnRate: 0 },
            magnetConfig: { stacks: 0, radiusMult: 1, speedMult: 1 },
            stabilizerConfig: { stacks: 0, contactMultiplier: 1 },
            platingConfig: { stacks: 0, damageReduction: 0 },
            shrapnelConfig: { stacks: 0, shards: 0, damage: 0 },
            neutronCoreConfig: { active: false, speedMultiplier: 0.6 },
            singularityConfig: {
                active: false,
                radius: 140,
                pullStrength: 520,
            },
            bulletHellConfig: {
                active: false,
                fireRateMultiplier: 4,
                damageMultiplier: 0.6,
                inaccuracyRad: 32,
            },
            bloodFuelConfig: {
                stacks: 0,
                healPercent: 0.12,
                fireCostPercent: 0.02,
            },
            chainReactionConfig: { stacks: 0, radius: 70, damagePercent: 0.5 },
            quantumConfig: {
                active: false,
                wrapMargin: 18,
                projectileLifetimeMs: 3800,
            },
            berserkConfig: { stacks: 0, maxBonus: 1 },
        };
    }
}
