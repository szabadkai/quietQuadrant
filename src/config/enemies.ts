import type { EnemyDefinition, EnemyKind } from "../models/types";

const base: Record<EnemyKind, EnemyDefinition> = {
	drifter: {
		kind: "drifter",
		speed: 110,
		health: 28, // Increased from 18 (+56%)
		damage: 15, // Increased from 10 (+50%)
	},
	watcher: {
		kind: "watcher",
		speed: 70,
		health: 42, // Increased from 28 (+50%)
		damage: 18, // Increased from 12 (+50%)
		fireCooldown: 1.6,
		projectileSpeed: 160,
	},
	mass: {
		kind: "mass",
		speed: 45,
		health: 105, // Increased from 70 (+50%)
		damage: 35, // Increased from 25 (+40%)
		fireCooldown: 2.6,
		projectileSpeed: 120,
	},
	boss: {
		kind: "boss",
		speed: 60,
		health: 1500, // Base health - multiplied by boss tuning (3000-4000 final)
		damage: 35, // Increased from 25 to 35 (+40%)
		fireCooldown: 0.8, // Reduced from 1.0 to 0.8 for faster firing
		projectileSpeed: 320, // Increased from 260 to 320 (+23%)
	},
};

export const eliteMultipliers = {
	health: 2.0, // Enhanced from 1.5 to 2.0
	speed: 1.4,  // Enhanced from 1.2 to 1.4
	damage: 1.3, // Added damage multiplier
};

// Elite behavior configurations for different enemy types
const eliteBehaviors: Record<EnemyKind, import("../models/types").EliteBehavior[]> = {
	drifter: ['burst_movement'], // Drifters get burst movement for unpredictable positioning
	watcher: ['rapid_fire'], // Watchers get rapid fire for increased threat at range
	mass: ['burst_movement', 'death_explosion'], // Mass enemies get both burst movement and death explosion
	boss: [], // Boss behaviors are handled separately
};

export const getEnemyDefinition = (
	kind: EnemyKind,
	elite?: boolean,
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
