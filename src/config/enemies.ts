import type { EnemyDefinition, EnemyKind } from "../models/types";

const base: Record<EnemyKind, EnemyDefinition> = {
    drifter: {
        kind: "drifter",
        speed: 100,
        health: 22,
        damage: 1, // Contact damage - 1 HP per hit
    },
    watcher: {
        kind: "watcher",
        speed: 65,
        health: 35,
        damage: 1, // Projectile damage - 1 HP per hit
        fireCooldown: 1.8,
        projectileSpeed: 145,
    },
    mass: {
        kind: "mass",
        speed: 40,
        health: 85,
        damage: 2, // Heavier enemy - 2 HP per hit
        fireCooldown: 2.8,
        projectileSpeed: 110,
    },
    phantom: {
        kind: "phantom",
        speed: 80,
        health: 18,
        damage: 1,
    },
    orbiter: {
        kind: "orbiter",
        speed: 120,
        health: 28,
        damage: 1,
        fireCooldown: 2.2,
        projectileSpeed: 130,
    },
    splitter: {
        kind: "splitter",
        speed: 55,
        health: 50,
        damage: 1,
    },
    boss: {
        kind: "boss",
        speed: 55,
        health: 800,
        damage: 1, // Boss projectiles do 1 HP, but there are many of them
        fireCooldown: 1.0,
        projectileSpeed: 220,
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
