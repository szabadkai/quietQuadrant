import type { EnemyDefinition, EnemyKind } from "../models/types";

const base: Record<EnemyKind, EnemyDefinition> = {
    drifter: {
        kind: "drifter",
        speed: 100, // Reduced from 110 (-9%)
        health: 22, // Reduced from 28 (-21%)
        damage: 12, // Reduced from 15 (-20%)
    },
    watcher: {
        kind: "watcher",
        speed: 65, // Reduced from 70 (-7%)
        health: 35, // Reduced from 42 (-17%)
        damage: 14, // Reduced from 18 (-22%)
        fireCooldown: 1.8, // Increased from 1.6 (slower firing)
        projectileSpeed: 145, // Reduced from 160 (-9%)
    },
    mass: {
        kind: "mass",
        speed: 40, // Reduced from 45 (-11%)
        health: 85, // Reduced from 105 (-19%)
        damage: 28, // Reduced from 35 (-20%)
        fireCooldown: 2.8, // Increased from 2.6 (slower firing)
        projectileSpeed: 110, // Reduced from 120 (-8%)
    },
    phantom: {
        kind: "phantom",
        speed: 80, // Moderate base speed
        health: 18, // Fragile but evasive
        damage: 15,
    },
    orbiter: {
        kind: "orbiter",
        speed: 120, // Fast orbital speed
        health: 28,
        damage: 10,
        fireCooldown: 2.2,
        projectileSpeed: 130,
    },
    splitter: {
        kind: "splitter",
        speed: 55,
        health: 50, // Moderate health, splits on death
        damage: 18,
    },
    boss: {
        kind: "boss",
        speed: 55, // Reduced from 60 (-8%)
        health: 1200, // Reduced from 1500 (-20%)
        damage: 28, // Reduced from 35 (-20%)
        fireCooldown: 0.9, // Increased from 0.8 (slower firing)
        projectileSpeed: 280, // Reduced from 320 (-12%)
    },
};

export const eliteMultipliers = {
    health: 1.7, // Reduced from 2.0
    speed: 1.25, // Reduced from 1.4
    damage: 1.2, // Reduced from 1.3
};

// Elite behavior configurations for different enemy types
const eliteBehaviors: Record<
    EnemyKind,
    import("../models/types").EliteBehavior[]
> = {
    drifter: ["burst_movement"], // Drifters get burst movement for unpredictable positioning
    watcher: ["rapid_fire"], // Watchers get rapid fire for increased threat at range
    mass: ["burst_movement", "death_explosion"], // Mass enemies get both burst movement and death explosion
    phantom: ["burst_movement"], // Phantoms teleport more frequently
    orbiter: ["rapid_fire"], // Orbiters fire faster while circling
    splitter: ["death_explosion"], // Splitters explode on death
    boss: [], // Boss behaviors are handled separately
};

export const getEnemyDefinition = (
    kind: EnemyKind,
    elite?: boolean
): EnemyDefinition => {
    const data = { ...base[kind] };
    if (elite) {
        data.health *= eliteMultipliers.health;
        data.speed *= eliteMultipliers.speed;
        data.damage *= eliteMultipliers.damage;
        data.elite = true;
        data.eliteBehaviors = eliteBehaviors[kind];
    }
    return data;
};
