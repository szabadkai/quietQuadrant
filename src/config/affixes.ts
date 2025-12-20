import type { WeeklyAffix } from "../models/types";

export const AFFIXES: WeeklyAffix[] = [
    // === ORIGINAL AFFIXES ===
    {
        id: "nimble-foes",
        name: "Nimble Foes",
        description: "+12% enemy speed, -10% enemy health.",
        enemySpeedMultiplier: 1.12,
        enemyHealthMultiplier: 0.9,
    },
    {
        id: "ironclad",
        name: "Ironclad",
        description: "+18% enemy health, -8% enemy speed.",
        enemyHealthMultiplier: 1.18,
        enemySpeedMultiplier: 0.92,
    },
    {
        id: "volatile-rare",
        name: "Volatile Finds",
        description: "+15% rare upgrade odds.",
        rareUpgradeBonus: 0.15,
    },
    {
        id: "glass-boost",
        name: "Glass Boost",
        description:
            "-12% enemy health, +10% enemy speed, +10% rare upgrade odds.",
        enemyHealthMultiplier: 0.88,
        enemySpeedMultiplier: 1.1,
        rareUpgradeBonus: 0.1,
    },

    // === NEW AFFIXES ===

    // Player-focused
    {
        id: "overclocked",
        name: "Overclocked",
        description:
            "+20% player damage, +15% enemy damage. High risk, high reward.",
        playerDamageMultiplier: 1.2,
        enemyDamageMultiplier: 1.15,
    },
    {
        id: "adrenaline-rush",
        name: "Adrenaline Rush",
        description: "+15% player speed, -20% dash cooldown. Move fast or die.",
        playerSpeedMultiplier: 1.15,
        dashCooldownMultiplier: 0.8,
    },
    {
        id: "sluggish",
        name: "Sluggish",
        description: "-10% player speed, but +25% player damage.",
        playerSpeedMultiplier: 0.9,
        playerDamageMultiplier: 1.25,
    },

    // XP and progression
    {
        id: "fast-learner",
        name: "Fast Learner",
        description: "+30% XP gain, but -10% player damage.",
        xpMultiplier: 1.3,
        playerDamageMultiplier: 0.9,
    },
    {
        id: "golden-age",
        name: "Golden Age",
        description:
            "+5% legendary upgrade odds, +10% rare odds. The good stuff.",
        legendaryUpgradeBonus: 0.05,
        rareUpgradeBonus: 0.1,
    },
    {
        id: "tough-choices",
        name: "Tough Choices",
        description: "Only 2 upgrade choices per level, but +20% XP gain.",
        upgradeChoices: 2,
        xpMultiplier: 1.2,
    },
    {
        id: "abundance",
        name: "Abundance",
        description: "4 upgrade choices per level, but -15% XP gain.",
        upgradeChoices: 4,
        xpMultiplier: 0.85,
    },

    // Enemy-focused
    {
        id: "bullet-storm",
        name: "Bullet Storm",
        description: "+25% enemy projectile speed. Dodge harder.",
        enemyProjectileSpeedMultiplier: 1.25,
    },
    {
        id: "swarm-tactics",
        name: "Swarm Tactics",
        description: "+20% more enemies per wave, -15% enemy health.",
        waveEnemyCountMultiplier: 1.2,
        enemyHealthMultiplier: 0.85,
    },
    {
        id: "elite-forces",
        name: "Elite Forces",
        description: "+25% elite spawn chance. More elites, more danger.",
        eliteChanceBonus: 0.25,
    },
    {
        id: "glass-cannons",
        name: "Glass Cannons",
        description: "Enemies deal +30% damage but have -25% health.",
        enemyDamageMultiplier: 1.3,
        enemyHealthMultiplier: 0.75,
    },

    // Boss-focused
    {
        id: "enraged-boss",
        name: "Enraged Boss",
        description:
            "Boss has +20% health and +15% projectile speed. Good luck.",
        bossHealthMultiplier: 1.2,
        bossProjectileSpeedMultiplier: 1.15,
    },
    {
        id: "weakened-boss",
        name: "Weakened Boss",
        description: "Boss has -15% health, but +10% enemy health in waves.",
        bossHealthMultiplier: 0.85,
        enemyHealthMultiplier: 1.1,
    },

    // Mixed/unique
    {
        id: "chaos-mode",
        name: "Chaos Mode",
        description: "+15% everything: enemy speed, damage, and player damage.",
        enemySpeedMultiplier: 1.15,
        enemyDamageMultiplier: 1.15,
        playerDamageMultiplier: 1.15,
    },
    {
        id: "marathon",
        name: "Marathon",
        description:
            "-20% XP gain, but +15% player speed and -10% dash cooldown.",
        xpMultiplier: 0.8,
        playerSpeedMultiplier: 1.15,
        dashCooldownMultiplier: 0.9,
    },
];
