import Phaser from "phaser";
import { getUpgradeDefinition } from "../../../config/upgrades";
import {
    canStackUpgrade,
    validateUpgradeCombinationDetailed,
    calculateDiminishedMultiplier,
    applySynergyAdjustment,
    getLegendaryAdjustments,
} from "../../../config/upgradeBalance";
import { SYNERGY_DEFINITIONS } from "../../../config/synergies";
import type { UpgradeDefinition } from "../../../models/types";
import { useMetaStore } from "../../../state/useMetaStore";
import { useRunStore } from "../../../state/useRunStore";
import { useUIStore } from "../../../state/useUIStore";
import type { PlayerStats, PilotRuntime } from "../MainScene.types";

const OBJECT_SCALE = 0.7;
const PROJECTILE_MAX_LIFETIME_MS = 3800;

export type CapacitorConfig = {
    stacks: number;
    idleMs: number;
    damageBonus: number;
    sizeBonus: number;
    chargePierceBonus: number;
};

export type AfterimageConfig = {
    stacks: number;
    trailShots: number;
    shotDamage: number;
};
export type DashSparkConfig = {
    stacks: number;
    shards: number;
    damage: number;
};

export type ShieldConfig = {
    stacks: number;
    shieldHp: number;
    durationMs: number;
    cooldownMs: number;
    nextReadyAt: number;
};

export type ExplosiveConfig = {
    stacks: number;
    radius: number;
    damageMultiplier: number;
};

export type SplitConfig = {
    enabled: boolean;
    forks: number;
    spreadDegrees: number;
    damageMultiplier: number;
};

export type ChainArcConfig = {
    stacks: number;
    range: number;
    damagePercent: number;
    cooldownMs: number;
    lastAt: number;
};

export type KineticConfig = {
    stacks: number;
    healAmount: number;
    cooldownMs: number;
    nextReadyAt: number;
};

export type MomentumConfig = {
    stacks: number;
    ramp: number;
    timeToMaxMs: number;
    timerMs: number;
    bonus: number;
};

export type SpreadConfig = {
    stacks: number;
    spreadDegrees: number;
    critBonus: number;
};
export type HomingConfig = { stacks: number; range: number; turnRate: number };
export type MagnetConfig = {
    stacks: number;
    radiusMult: number;
    speedMult: number;
};
export type StabilizerConfig = { stacks: number; contactMultiplier: number };
export type PlatingConfig = { stacks: number; damageReduction: number };
export type ShrapnelConfig = { stacks: number; shards: number; damage: number };
export type NeutronCoreConfig = { active: boolean; speedMultiplier: number };

export type SingularityConfig = {
    active: boolean;
    radius: number;
    pullStrength: number;
};

export type BulletHellConfig = {
    active: boolean;
    fireRateMultiplier: number;
    damageMultiplier: number;
    inaccuracyRad: number;
};

export type BloodFuelConfig = {
    stacks: number;
    healPercent: number;
    fireCostPercent: number;
};

export type ChainReactionConfig = {
    stacks: number;
    radius: number;
    damagePercent: number;
};

export type QuantumConfig = {
    active: boolean;
    wrapMargin: number;
    projectileLifetimeMs: number;
};

export type BerserkConfig = { stacks: number; maxBonus: number };

export type ChargeState = {
    ready: boolean;
    holdMs: number;
    damageBonus: number;
    sizeBonus: number;
    idleMs: number;
};

export type UpgradeStacks = { [id: string]: number };

export interface UpgradeManagerCallbacks {
    getPlayerStats: () => PlayerStats;
    setPlayerStats: (stats: Partial<PlayerStats>) => void;
    getPlayerState: () => PilotRuntime | undefined;
    getPlayerTwoState: () => PilotRuntime | undefined;
    enforceHealthCap: () => void;
    setPaused: (paused: boolean) => void;
    spawnBurstVisual: (
        x: number,
        y: number,
        radius: number,
        color: number,
        alpha: number
    ) => void;
    defaultShieldState: () => {
        hp: number;
        activeUntil: number;
        nextReadyAt: number;
    };
    defaultMomentumState: () => { timerMs: number; bonus: number };
}

export class UpgradeManager {
    // Upgrade configs
    capacitor: CapacitorConfig = {
        stacks: 0,
        idleMs: 1000,
        damageBonus: 0.9,
        sizeBonus: 0.2,
        chargePierceBonus: 0,
    };
    afterimage: AfterimageConfig = { stacks: 0, trailShots: 0, shotDamage: 0 };
    dashSpark: DashSparkConfig = { stacks: 0, shards: 0, damage: 0 };
    shield: ShieldConfig = {
        stacks: 0,
        shieldHp: 60,
        durationMs: 0,
        cooldownMs: 0,
        nextReadyAt: 0,
    };
    explosive: ExplosiveConfig = { stacks: 0, radius: 0, damageMultiplier: 0 };
    split: SplitConfig = {
        enabled: false,
        forks: 2,
        spreadDegrees: 12,
        damageMultiplier: 0.5,
    };
    chainArc: ChainArcConfig = {
        stacks: 0,
        range: 180,
        damagePercent: 0.6,
        cooldownMs: 150,
        lastAt: 0,
    };
    kinetic: KineticConfig = {
        stacks: 0,
        healAmount: 0.3,
        cooldownMs: 1200,
        nextReadyAt: 0,
    };
    momentum: MomentumConfig = {
        stacks: 0,
        ramp: 0.25,
        timeToMaxMs: 2000,
        timerMs: 0,
        bonus: 0,
    };
    spread: SpreadConfig = { stacks: 0, spreadDegrees: 6, critBonus: 0 };
    homing: HomingConfig = { stacks: 0, range: 0, turnRate: 0 };
    magnet: MagnetConfig = { stacks: 0, radiusMult: 1, speedMult: 1 };
    stabilizer: StabilizerConfig = { stacks: 0, contactMultiplier: 1 };
    plating: PlatingConfig = { stacks: 0, damageReduction: 0 };
    shrapnel: ShrapnelConfig = { stacks: 0, shards: 0, damage: 0 };
    neutronCore: NeutronCoreConfig = { active: false, speedMultiplier: 0.6 };
    singularity: SingularityConfig = {
        active: false,
        radius: 140,
        pullStrength: 520,
    };
    bulletHell: BulletHellConfig = {
        active: false,
        fireRateMultiplier: 4,
        damageMultiplier: 0.6,
        inaccuracyRad: Phaser.Math.DegToRad(32),
    };
    bloodFuel: BloodFuelConfig = {
        stacks: 0,
        healPercent: 0.12,
        fireCostPercent: 0.02,
    };
    chainReaction: ChainReactionConfig = {
        stacks: 0,
        radius: 70,
        damagePercent: 0.5,
    };
    quantum: QuantumConfig = {
        active: false,
        wrapMargin: 18,
        projectileLifetimeMs: PROJECTILE_MAX_LIFETIME_MS,
    };
    berserk: BerserkConfig = { stacks: 0, maxBonus: 1 };
    chargeState: ChargeState = {
        ready: false,
        holdMs: 0,
        damageBonus: 0.9,
        sizeBonus: 0.2,
        idleMs: 1000,
    };

    glassCannonCap: number | null = null;
    projectileScale = 1;
    stacks: UpgradeStacks = {};
    pendingOptions: UpgradeDefinition[] = [];
    activeSynergies = new Set<string>();

    private callbacks: UpgradeManagerCallbacks;

    constructor(callbacks: UpgradeManagerCallbacks) {
        this.callbacks = callbacks;
    }

    reset() {
        this.capacitor = {
            stacks: 0,
            idleMs: 1000,
            damageBonus: 0.9,
            sizeBonus: 0.2,
            chargePierceBonus: 0,
        };
        this.afterimage = { stacks: 0, trailShots: 0, shotDamage: 0 };
        this.dashSpark = { stacks: 0, shards: 0, damage: 0 };
        this.shield = {
            stacks: 0,
            shieldHp: 60,
            durationMs: 0,
            cooldownMs: 0,
            nextReadyAt: 0,
        };
        this.explosive = { stacks: 0, radius: 0, damageMultiplier: 0 };
        this.split = {
            enabled: false,
            forks: 2,
            spreadDegrees: 12,
            damageMultiplier: 0.5,
        };
        this.chainArc = {
            stacks: 0,
            range: 180,
            damagePercent: 0.6,
            cooldownMs: 150,
            lastAt: 0,
        };
        this.kinetic = {
            stacks: 0,
            healAmount: 0.3,
            cooldownMs: 1200,
            nextReadyAt: 0,
        };
        this.momentum = {
            stacks: 0,
            ramp: 0.25,
            timeToMaxMs: 2000,
            timerMs: 0,
            bonus: 0,
        };
        this.spread = { stacks: 0, spreadDegrees: 6, critBonus: 0 };
        this.homing = { stacks: 0, range: 0, turnRate: 0 };
        this.magnet = { stacks: 0, radiusMult: 1, speedMult: 1 };
        this.stabilizer = { stacks: 0, contactMultiplier: 1 };
        this.plating = { stacks: 0, damageReduction: 0 };
        this.shrapnel = { stacks: 0, shards: 0, damage: 0 };
        this.neutronCore = { active: false, speedMultiplier: 0.6 };
        this.singularity = { active: false, radius: 140, pullStrength: 520 };
        this.bulletHell = {
            active: false,
            fireRateMultiplier: 4,
            damageMultiplier: 0.6,
            inaccuracyRad: Phaser.Math.DegToRad(32),
        };
        this.bloodFuel = {
            stacks: 0,
            healPercent: 0.12,
            fireCostPercent: 0.02,
        };
        this.chainReaction = { stacks: 0, radius: 70, damagePercent: 0.5 };
        this.quantum = {
            active: false,
            wrapMargin: 18,
            projectileLifetimeMs: PROJECTILE_MAX_LIFETIME_MS,
        };
        this.berserk = { stacks: 0, maxBonus: 1 };
        this.chargeState = {
            ready: false,
            holdMs: 0,
            damageBonus: 0.9,
            sizeBonus: 0.2,
            idleMs: 1000,
        };
        this.glassCannonCap = null;
        this.projectileScale = 1;
        this.stacks = {};
        this.pendingOptions = [];
        this.activeSynergies.clear();
    }

    apply(id: string): boolean {
        const def = getUpgradeDefinition(id);
        if (!def) return false;
        const current = this.stacks[id] ?? 0;

        if (!canStackUpgrade(id, current)) return false;
        if (def.maxStacks && current >= def.maxStacks) return false;

        const testUpgrades = { ...this.stacks, [id]: current + 1 };
        const validation = validateUpgradeCombinationDetailed(testUpgrades);

        if (!validation.valid) {
            console.warn(`Upgrade ${id} rejected:`, validation.reasons);
            console.warn("Power metrics:", validation.metrics);
            return false;
        }

        this.stacks[id] = current + 1;
        this.pendingOptions = [];
        useUIStore.getState().actions.closeUpgradeSelection();
        this.callbacks.setPaused(false);
        this.applyEffects(def);
        this.checkSynergies();

        useRunStore.getState().actions.addUpgrade({
            id: def.id,
            stacks: this.stacks[id],
        });
        return true;
    }

    private checkSynergies() {
        SYNERGY_DEFINITIONS.forEach((syn) => {
            if (this.activeSynergies.has(syn.id)) return;
            const ready = syn.requires.every(
                (req) => (this.stacks[req] ?? 0) > 0
            );
            if (ready) {
                this.enableSynergy(syn.id);
            }
        });
    }

    private enableSynergy(id: string) {
        if (this.activeSynergies.has(id)) return;
        this.activeSynergies.add(id);
        const stats = this.callbacks.getPlayerStats();
        const p1 = this.callbacks.getPlayerState();
        const p2 = this.callbacks.getPlayerTwoState();

        switch (id) {
            case "railgun": {
                const baseCritChance = 0.05;
                const baseCritMultiplier = 0.25;
                this.callbacks.setPlayerStats({
                    critChance:
                        stats.critChance +
                        applySynergyAdjustment("railgun", baseCritChance),
                    critMultiplier:
                        stats.critMultiplier +
                        applySynergyAdjustment("railgun", baseCritMultiplier),
                });
                break;
            }
            case "meat-grinder": {
                const baseCritChance = 0.03;
                const baseCritMultiplier = 0.15;
                this.callbacks.setPlayerStats({
                    critChance:
                        stats.critChance +
                        applySynergyAdjustment("meat-grinder", baseCritChance),
                    critMultiplier:
                        stats.critMultiplier +
                        applySynergyAdjustment(
                            "meat-grinder",
                            baseCritMultiplier
                        ),
                });
                break;
            }
            case "vampire": {
                const baseCritChance = 0.03;
                this.callbacks.setPlayerStats({
                    critChance:
                        stats.critChance +
                        applySynergyAdjustment("vampire", baseCritChance),
                });
                break;
            }
            case "tesla-coil":
                this.chainArc.damagePercent += 0.15;
                break;
            case "glass-storm":
                this.bulletHell.inaccuracyRad *= 0.5;
                break;
            case "phantom-striker":
                if (p1) p1.ability.dashCooldownMs *= 0.75;
                if (p2) p2.ability.dashCooldownMs *= 0.75;
                break;
            case "gravity-well":
                this.explosive.radius *= 1.3;
                break;
            case "sniper-elite":
                this.homing.turnRate *= 2;
                this.callbacks.setPlayerStats({
                    critMultiplier: stats.critMultiplier + 0.1,
                });
                break;
            case "immortal-engine":
                this.shield.durationMs *= 1.5;
                break;
            case "prism-cannon":
                this.callbacks.setPlayerStats({
                    critChance: stats.critChance + 0.08,
                });
                break;
        }

        const metaState = useMetaStore.getState();
        const previousUnlockCount =
            metaState.lifetimeStats.synergyUnlockCounts[id] ?? 0;
        const synergyDef = SYNERGY_DEFINITIONS.find((s) => s.id === id);

        if (previousUnlockCount === 0 && synergyDef) {
            metaState.actions.showAchievement(
                id,
                synergyDef.name,
                synergyDef.description
            );
        }

        useRunStore.getState().actions.unlockSynergy(id);
        const anchor = p1?.sprite ?? p2?.sprite ?? null;
        if (anchor) {
            this.callbacks.spawnBurstVisual(
                anchor.x,
                anchor.y,
                38 * OBJECT_SCALE,
                0xffd7a6,
                0.85
            );
        }
    }

    private applyEffects(def: UpgradeDefinition) {
        const stats = this.callbacks.getPlayerStats();
        const p1 = this.callbacks.getPlayerState();
        const p2 = this.callbacks.getPlayerTwoState();

        switch (def.id) {
            case "power-shot": {
                const stacks = this.stacks[def.id];
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
                this.callbacks.setPlayerStats({
                    damage: stats.damage * incrementalMultiplier,
                    critChance: stats.critChance + 0.05,
                });
                break;
            }
            case "rapid-fire": {
                const stacks = this.stacks[def.id];
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
                this.callbacks.setPlayerStats({
                    fireRate: stats.fireRate * incrementalMultiplier,
                });
                break;
            }
            case "swift-projectiles":
                this.callbacks.setPlayerStats({
                    projectileSpeed: stats.projectileSpeed * 1.2,
                });
                break;
            case "engine-tune":
                this.callbacks.setPlayerStats({
                    moveSpeed: stats.moveSpeed * 1.1,
                });
                break;

            case "plating": {
                const stacks = this.stacks[def.id];
                let effectiveDamageReduction = 0;
                for (let i = 1; i <= stacks; i++) {
                    const baseReduction = 0.08;
                    effectiveDamageReduction +=
                        i <= 3 ? baseReduction : baseReduction * 0.8;
                }
                effectiveDamageReduction = Math.min(
                    effectiveDamageReduction,
                    0.5
                );
                this.plating = {
                    stacks,
                    damageReduction: effectiveDamageReduction,
                };
                this.callbacks.setPlayerStats({
                    maxHealth: stats.maxHealth + 1,
                    health: Math.min(stats.maxHealth + 1, stats.health + 1),
                });
                this.callbacks.enforceHealthCap();
                useRunStore
                    .getState()
                    .actions.setVitals(
                        this.callbacks.getPlayerStats().health,
                        this.callbacks.getPlayerStats().maxHealth
                    );
                break;
            }
            case "sidecar":
                this.callbacks.setPlayerStats({
                    projectiles: stats.projectiles + 1,
                });
                break;
            case "pierce":
                this.callbacks.setPlayerStats({ pierce: stats.pierce + 1 });
                break;
            case "heavy-barrel": {
                const stacks = this.stacks[def.id];
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
                this.callbacks.setPlayerStats({
                    damage: stats.damage * incrementalMultiplier,
                    fireRate: stats.fireRate * 0.9,
                    critMultiplier: stats.critMultiplier + 0.05,
                });
                this.projectileScale *= 1.1;
                break;
            }
            case "rebound":
                this.callbacks.setPlayerStats({
                    bounce: stats.bounce + 2,
                    projectileSpeed: stats.projectileSpeed * 0.95,
                });
                break;

            case "dash-sparks": {
                const stacks = this.stacks[def.id];
                const shards = 6 + (stacks - 1) * 2;
                const damage = stats.damage * (1.6 + (stacks - 1) * 0.25);
                this.dashSpark = { stacks, shards, damage };
                break;
            }
            case "held-charge": {
                const stacks = this.stacks[def.id];
                const idleMs = Math.max(400, 800 - (stacks - 1) * 80);
                const damageBonus = 0.8 + (stacks - 1) * 0.12;
                const sizeBonus = 0.2;
                const chargePierceBonus = 2 + (stacks - 1);
                this.capacitor = {
                    stacks,
                    idleMs,
                    damageBonus,
                    sizeBonus,
                    chargePierceBonus,
                };
                this.chargeState.idleMs = idleMs;
                this.chargeState.damageBonus = damageBonus;
                this.chargeState.sizeBonus = sizeBonus;
                if (p1) {
                    p1.charge.idleMs = idleMs;
                    p1.charge.damageBonus = damageBonus;
                    p1.charge.sizeBonus = sizeBonus;
                }
                if (p2) {
                    p2.charge.idleMs = idleMs;
                    p2.charge.damageBonus = damageBonus;
                    p2.charge.sizeBonus = sizeBonus;
                }
                break;
            }
            case "shield-pickup": {
                const stacks = this.stacks[def.id];
                const durationMs = (2 + (stacks - 1) * 0.3) * 1000;
                const cooldownMs = Math.max(3000, 5000 - (stacks - 1) * 600);
                this.shield = {
                    stacks,
                    shieldHp: 60,
                    durationMs,
                    cooldownMs,
                    nextReadyAt: 0,
                };
                if (p1) p1.shield = this.callbacks.defaultShieldState();
                if (p2) p2.shield = this.callbacks.defaultShieldState();
                break;
            }
            case "kinetic-siphon": {
                const stacks = this.stacks[def.id];
                const healAmount = 0.3 + (stacks - 1) * 0.1;
                const cooldownMs = Math.max(800, 1200 - (stacks - 1) * 200);
                this.kinetic = {
                    stacks,
                    healAmount,
                    cooldownMs,
                    nextReadyAt: 0,
                };
                break;
            }

            case "prism-spread": {
                const stacks = this.stacks[def.id];
                const prevBonus = this.spread.critBonus;
                const spreadDegrees = Math.max(3, 6 - (stacks - 1) * 1.5);
                const critBonus = 0.05 * stacks;
                this.spread = { stacks, spreadDegrees, critBonus };
                this.callbacks.setPlayerStats({
                    critChance: stats.critChance + critBonus - prevBonus,
                });
                break;
            }
            case "momentum-feed": {
                const stacks = this.stacks[def.id];
                const ramp = 0.25 + (stacks - 1) * 0.05;
                const timeToMaxMs = Math.max(1400, 2000 - (stacks - 1) * 200);
                this.momentum = {
                    stacks,
                    ramp,
                    timeToMaxMs,
                    timerMs: 0,
                    bonus: 0,
                };
                if (p1) p1.momentum = this.callbacks.defaultMomentumState();
                if (p2) p2.momentum = this.callbacks.defaultMomentumState();
                break;
            }
            case "split-shot": {
                const stacks = this.stacks[def.id];
                const damageMultiplier = 0.5 + (stacks - 1) * 0.1;
                const spreadDegrees = Math.max(8, 12 - (stacks - 1) * 2);
                this.split = {
                    enabled: true,
                    forks: 2,
                    spreadDegrees,
                    damageMultiplier,
                };
                break;
            }
            case "explosive-impact": {
                const stacks = this.stacks[def.id];
                const radius = (32 + (stacks - 1) * 10) * OBJECT_SCALE;
                const damageMultiplier = 0.55 + (stacks - 1) * 0.1;
                this.explosive = { stacks, radius, damageMultiplier };
                break;
            }
            case "chain-arc": {
                const stacks = this.stacks[def.id];
                const range = 180 + (stacks - 1) * 20;
                const damagePercent = 0.6 + (stacks - 1) * 0.1;
                const cooldownMs = Math.max(120, 150 - (stacks - 1) * 20);
                this.chainArc = {
                    stacks,
                    range,
                    damagePercent,
                    cooldownMs,
                    lastAt: 0,
                };
                break;
            }
            case "magnet-coil": {
                const stacks = this.stacks[def.id];
                const radiusMult = 1 + 0.3 + (stacks - 1) * 0.15;
                const speedMult = 1 + 0.2 + (stacks - 1) * 0.1;
                this.magnet = { stacks, radiusMult, speedMult };
                break;
            }

            case "stabilizers": {
                const stacks = this.stacks[def.id];
                const contactMultiplier = Math.max(0.5, 1 - 0.15 * stacks);
                this.stabilizer = { stacks, contactMultiplier };
                break;
            }
            case "shrapnel": {
                const stacks = this.stacks[def.id];
                const shards = 6 + (stacks - 1) * 2;
                const damage = stats.damage * (0.35 + (stacks - 1) * 0.05);
                this.shrapnel = { stacks, shards, damage };
                break;
            }
            case "heatseeker": {
                const stacks = this.stacks[def.id];
                const range = 240 + (stacks - 1) * 60;
                const turnRate = Phaser.Math.DegToRad(
                    stacks === 1 ? 10 : stacks === 2 ? 30 : 90
                );
                this.homing = { stacks, range, turnRate };
                break;
            }
            case "neutron-core":
                this.neutronCore = { active: true, speedMultiplier: 0.6 };
                this.projectileScale *= 1.15;
                this.callbacks.setPlayerStats({
                    projectileSpeed: stats.projectileSpeed * 0.6,
                });
                break;
            case "glass-cannon": {
                const adjustments = getLegendaryAdjustments("glass-cannon");
                this.glassCannonCap = 1;
                this.callbacks.setPlayerStats({
                    damage:
                        stats.damage * (adjustments.damageMultiplier || 2.5),
                    critChance:
                        stats.critChance +
                        (adjustments.critChanceBonus || 0.08),
                    maxHealth: Math.min(stats.maxHealth, 1),
                    health: Math.min(stats.health, 1),
                });
                useRunStore
                    .getState()
                    .actions.setVitals(
                        this.callbacks.getPlayerStats().health,
                        this.callbacks.getPlayerStats().maxHealth
                    );
                break;
            }
            case "singularity-rounds":
                this.singularity = {
                    active: true,
                    radius: 160,
                    pullStrength: 640,
                };
                break;

            case "bullet-hell": {
                const adjustments = getLegendaryAdjustments("bullet-hell");
                const fireRateMultiplier =
                    adjustments.fireRateMultiplier || 3.0;
                const damageMultiplier = adjustments.damageMultiplier || 0.7;
                this.bulletHell = {
                    active: true,
                    fireRateMultiplier,
                    damageMultiplier,
                    inaccuracyRad: Phaser.Math.DegToRad(34),
                };
                this.callbacks.setPlayerStats({
                    fireRate: stats.fireRate * fireRateMultiplier,
                    damage: stats.damage * damageMultiplier,
                });
                break;
            }
            case "blood-fuel": {
                const stacks = this.stacks[def.id];
                const healPercent = 0.12 + (stacks - 1) * 0.03;
                const fireCostPercent = 0.02 * stacks;
                this.bloodFuel = { stacks, healPercent, fireCostPercent };
                break;
            }
            case "chain-reaction": {
                const stacks = this.stacks[def.id];
                const radius = 70 + (stacks - 1) * 10;
                const damagePercent = 0.5 + (stacks - 1) * 0.05;
                this.chainReaction = { stacks, radius, damagePercent };
                break;
            }
            case "quantum-tunneling":
                this.quantum = {
                    active: true,
                    wrapMargin: 18,
                    projectileLifetimeMs: PROJECTILE_MAX_LIFETIME_MS,
                };
                break;
            case "berserk-module": {
                const stacks = this.stacks[def.id];
                const maxBonus = 1 + (stacks - 1) * 0.5;
                this.berserk = { stacks, maxBonus };
                break;
            }
        }
    }
}
