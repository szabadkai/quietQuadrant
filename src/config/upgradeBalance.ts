/**
 * Upgrade Balance Configuration
 * 
 * This module defines the rebalanced upgrade system to prevent excessive power scaling
 * while maintaining satisfying progression. Implements diminishing returns, stack caps,
 * and synergy adjustments as specified in the enhanced difficulty requirements.
 */

export interface UpgradeBalanceConfig {
  diminishingReturns: {
    [upgradeId: string]: {
      threshold: number;
      scalingFactor: number;
    };
  };
  stackingCaps: {
    [upgradeId: string]: number;
  };
  synergyAdjustments: {
    [synergyId: string]: {
      bonusType: 'additive' | 'multiplicative';
      powerReduction?: number;
    };
  };
  legendaryAdjustments: {
    [upgradeId: string]: {
      damageMultiplier?: number;
      fireRateMultiplier?: number;
      critChanceBonus?: number;
    };
  };
}

/**
 * Enhanced upgrade balance configuration
 * Addresses Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */
export const UPGRADE_BALANCE_CONFIG: UpgradeBalanceConfig = {
  // Diminishing returns for high-stack upgrades (Requirement 4.1)
  diminishingReturns: {
    'power-shot': {
      threshold: 4, // After 4 stacks, diminishing returns kick in
      scalingFactor: 0.7, // Each additional stack is 70% as effective
    },
    'rapid-fire': {
      threshold: 4,
      scalingFactor: 0.7,
    },
    'heavy-barrel': {
      threshold: 2,
      scalingFactor: 0.6, // More aggressive diminishing for heavy barrel
    },
    'plating': {
      threshold: 3,
      scalingFactor: 0.8, // Defensive upgrades maintain some effectiveness
    },
  },

  // Hard caps on certain upgrades to prevent infinite scaling
  stackingCaps: {
    'power-shot': 6, // Reduced from 8 to 6
    'rapid-fire': 6, // Reduced from 8 to 6
    'heavy-barrel': 3, // Keep at 3 but with diminishing returns
    'plating': 4, // Reduced from 5 to 4
  },

  // Synergy power adjustments (Requirement 4.3)
  synergyAdjustments: {
    'railgun': {
      bonusType: 'additive',
      powerReduction: 0.3, // Reduce crit bonuses by 30%
    },
    'meat-grinder': {
      bonusType: 'additive',
      powerReduction: 0.2, // Reduce crit bonuses by 20%
    },
    'vampire': {
      bonusType: 'additive',
      powerReduction: 0.1, // Slight reduction
    },
    'frame-rate-killer': {
      bonusType: 'multiplicative',
      powerReduction: 0.4, // Significant reduction to prevent screen flooding
    },
  },

  // Legendary upgrade adjustments (Requirement 4.2)
  legendaryAdjustments: {
    'glass-cannon': {
      damageMultiplier: 2.5, // Reduced from 3.0x to 2.5x
      critChanceBonus: 0.08, // Reduced from 0.1 to 0.08
    },
    'bullet-hell': {
      fireRateMultiplier: 3.0, // Reduced from 4.0x to 3.0x
      damageMultiplier: 0.7, // Increased penalty from 0.6 to 0.7
    },
  },
};

/**
 * Calculate effective upgrade multiplier with diminishing returns
 * @param upgradeId The upgrade identifier
 * @param stacks Current number of stacks
 * @param baseMultiplier Base multiplier per stack (e.g., 1.15 for 15% increase)
 * @returns Effective multiplier accounting for diminishing returns
 */
export function calculateDiminishedMultiplier(
  upgradeId: string,
  stacks: number,
  baseMultiplier: number
): number {
  const config = UPGRADE_BALANCE_CONFIG.diminishingReturns[upgradeId];
  if (!config || stacks <= config.threshold) {
    // No diminishing returns, use standard exponential stacking
    return Math.pow(baseMultiplier, stacks);
  }

  // Calculate normal stacks up to threshold
  const normalStacks = config.threshold;
  const diminishedStacks = stacks - normalStacks;
  
  // Base power from normal stacks
  const basePower = Math.pow(baseMultiplier, normalStacks);
  
  // Diminished power from additional stacks
  const diminishedIncrement = baseMultiplier - 1; // e.g., 0.15 for 15% increase
  const scaledIncrement = diminishedIncrement * config.scalingFactor;
  const diminishedPower = Math.pow(1 + scaledIncrement, diminishedStacks);
  
  return basePower * diminishedPower;
}

/**
 * Check if upgrade can be stacked further
 * @param upgradeId The upgrade identifier
 * @param currentStacks Current number of stacks
 * @returns True if upgrade can be stacked further
 */
export function canStackUpgrade(upgradeId: string, currentStacks: number): boolean {
  const cap = UPGRADE_BALANCE_CONFIG.stackingCaps[upgradeId];
  return cap === undefined || currentStacks < cap;
}

/**
 * Apply synergy power adjustments
 * @param synergyId The synergy identifier
 * @param basePower Base synergy power
 * @returns Adjusted synergy power
 */
export function applySynergyAdjustment(synergyId: string, basePower: number): number {
  const config = UPGRADE_BALANCE_CONFIG.synergyAdjustments[synergyId];
  if (!config || !config.powerReduction) {
    return basePower;
  }
  
  return basePower * (1 - config.powerReduction);
}

/**
 * Get adjusted legendary upgrade values
 * @param upgradeId The legendary upgrade identifier
 * @returns Adjusted values for the legendary upgrade
 */
export function getLegendaryAdjustments(upgradeId: string) {
  return UPGRADE_BALANCE_CONFIG.legendaryAdjustments[upgradeId] || {};
}

/**
 * Calculate maximum theoretical damage multiplier for validation
 * This helps ensure upgrade combinations don't exceed balance thresholds
 * @param upgrades Current upgrade configuration
 * @returns Maximum damage multiplier
 */
export function calculateMaxDamageMultiplier(upgrades: Record<string, number>): number {
  let totalMultiplier = 1;
  
  // Power Shot with diminishing returns
  const powerShotStacks = upgrades['power-shot'] || 0;
  if (powerShotStacks > 0) {
    totalMultiplier *= calculateDiminishedMultiplier('power-shot', powerShotStacks, 1.15);
  }
  
  // Heavy Barrel with diminishing returns
  const heavyBarrelStacks = upgrades['heavy-barrel'] || 0;
  if (heavyBarrelStacks > 0) {
    totalMultiplier *= calculateDiminishedMultiplier('heavy-barrel', heavyBarrelStacks, 1.2);
  }
  
  // Glass Cannon (legendary)
  if (upgrades['glass-cannon'] > 0) {
    const adjustments = getLegendaryAdjustments('glass-cannon');
    totalMultiplier *= adjustments.damageMultiplier || 2.5;
  }
  
  // Bullet Hell damage penalty
  if (upgrades['bullet-hell'] > 0) {
    const adjustments = getLegendaryAdjustments('bullet-hell');
    totalMultiplier *= adjustments.damageMultiplier || 0.7;
  }
  
  return totalMultiplier;
}

/**
 * Calculate maximum theoretical defensive multiplier for validation
 * This helps ensure defensive combinations don't create invulnerability
 * @param upgrades Current upgrade configuration
 * @returns Maximum damage reduction percentage (0-1)
 */
export function calculateMaxDefenseMultiplier(upgrades: Record<string, number>): number {
  let totalReduction = 0;
  
  // Plating damage reduction with diminishing returns
  const platingStacks = upgrades['plating'] || 0;
  if (platingStacks > 0) {
    for (let i = 1; i <= platingStacks; i++) {
      const baseReduction = 0.08;
      if (i <= 3) {
        totalReduction += baseReduction;
      } else {
        // Diminishing returns after 3 stacks
        totalReduction += baseReduction * 0.8;
      }
    }
    totalReduction = Math.min(totalReduction, 0.5); // Cap at 50%
  }
  
  // Stabilizers collision damage reduction (separate from general damage reduction)
  const stabilizerStacks = upgrades['stabilizers'] || 0;
  if (stabilizerStacks > 0) {
    // Stabilizers affect collision damage separately, not included in general reduction
    // This is handled in the collision damage calculation in MainScene
  }
  
  return totalReduction;
}

/**
 * Calculate maximum theoretical DPS (Damage Per Second) multiplier
 * Combines damage and fire rate for comprehensive power assessment
 * @param upgrades Current upgrade configuration
 * @returns Maximum DPS multiplier
 */
export function calculateMaxDPSMultiplier(upgrades: Record<string, number>): number {
  const damageMultiplier = calculateMaxDamageMultiplier(upgrades);
  const fireRateMultiplier = calculateMaxFireRateMultiplier(upgrades);
  return damageMultiplier * fireRateMultiplier;
}

/**
 * Validate that upgrade combination doesn't create invulnerability
 * Checks both damage reduction and health scaling to prevent invincible builds
 * @param upgrades Current upgrade configuration
 * @returns True if defensive combination maintains vulnerability
 */
export function validateDefensiveLimits(upgrades: Record<string, number>): boolean {
  const maxDefense = calculateMaxDefenseMultiplier(upgrades);
  
  // Defensive upgrades should never exceed 50% damage reduction
  if (maxDefense > 0.5) return false;
  
  // Glass Cannon should cap health at 1 regardless of other upgrades
  if (upgrades['glass-cannon'] > 0) {
    // With Glass Cannon, no amount of plating should allow more than 1 HP
    return true; // Glass Cannon enforces vulnerability by health cap
  }
  
  // Even with maximum defensive upgrades, player should take meaningful damage
  const remainingDamage = 1 - maxDefense;
  return remainingDamage >= 0.5; // At least 50% damage should get through
}

/**
 * Enhanced validation for upgrade combinations with comprehensive checks
 * @param upgrades Current upgrade configuration
 * @returns Validation result with details about what failed
 */
export function validateUpgradeCombinationDetailed(upgrades: Record<string, number>): {
  valid: boolean;
  reasons: string[];
  metrics: {
    maxDamage: number;
    maxFireRate: number;
    maxDPS: number;
    maxDefense: number;
  };
} {
  const reasons: string[] = [];
  const maxDamage = calculateMaxDamageMultiplier(upgrades);
  const maxFireRate = calculateMaxFireRateMultiplier(upgrades);
  const maxDPS = calculateMaxDPSMultiplier(upgrades);
  const maxDefense = calculateMaxDefenseMultiplier(upgrades);
  
  // Balance thresholds (Requirements 4.4, 4.5)
  const MAX_DAMAGE_THRESHOLD = 8.0;
  const MAX_DPS_THRESHOLD = 20.0;
  const MAX_DEFENSE_THRESHOLD = 0.5;
  
  if (maxDamage > MAX_DAMAGE_THRESHOLD) {
    reasons.push(`Damage multiplier ${maxDamage.toFixed(2)}x exceeds limit of ${MAX_DAMAGE_THRESHOLD}x`);
  }
  
  if (maxDPS > MAX_DPS_THRESHOLD) {
    reasons.push(`DPS multiplier ${maxDPS.toFixed(2)}x exceeds limit of ${MAX_DPS_THRESHOLD}x`);
  }
  
  if (maxDefense > MAX_DEFENSE_THRESHOLD) {
    reasons.push(`Damage reduction ${(maxDefense * 100).toFixed(1)}% exceeds limit of ${MAX_DEFENSE_THRESHOLD * 100}%`);
  }
  
  // Check defensive limits
  if (!validateDefensiveLimits(upgrades)) {
    reasons.push('Defensive combination would create near-invulnerability');
  }
  
  return {
    valid: reasons.length === 0,
    reasons,
    metrics: {
      maxDamage,
      maxFireRate,
      maxDPS,
      maxDefense
    }
  };
}

/**
 * Get upgrade power summary for debugging and monitoring
 * @param upgrades Current upgrade configuration
 * @returns Human-readable power summary
 */
export function getUpgradePowerSummary(upgrades: Record<string, number>): string {
  const validation = validateUpgradeCombinationDetailed(upgrades);
  const lines = [
    `Upgrade Power Summary:`,
    `  Damage Multiplier: ${validation.metrics.maxDamage.toFixed(2)}x (limit: 8.0x)`,
    `  Fire Rate Multiplier: ${validation.metrics.maxFireRate.toFixed(2)}x`,
    `  DPS Multiplier: ${validation.metrics.maxDPS.toFixed(2)}x (limit: 20.0x)`,
    `  Damage Reduction: ${(validation.metrics.maxDefense * 100).toFixed(1)}% (limit: 50%)`,
    `  Status: ${validation.valid ? 'VALID' : 'INVALID'}`
  ];
  
  if (!validation.valid) {
    lines.push(`  Issues: ${validation.reasons.join(', ')}`);
  }
  
  return lines.join('\n');
}

/**
 * Check if an upgrade would be safe to add without exceeding limits
 * @param currentUpgrades Current upgrade configuration
 * @param upgradeId ID of upgrade to potentially add
 * @param stacks Number of stacks to add (default: 1)
 * @returns True if upgrade can be safely added
 */
export function canSafelyAddUpgrade(
  currentUpgrades: Record<string, number>, 
  upgradeId: string, 
  stacks: number = 1
): boolean {
  const testUpgrades = { 
    ...currentUpgrades, 
    [upgradeId]: (currentUpgrades[upgradeId] || 0) + stacks 
  };
  
  // Check stacking limits first
  if (!canStackUpgrade(upgradeId, currentUpgrades[upgradeId] || 0)) {
    return false;
  }
  
  // Check balance limits
  return validateUpgradeCombination(testUpgrades);
}

/**
 * Validate that upgrade combination doesn't exceed balance thresholds
 * @param upgrades Current upgrade configuration
 * @returns True if combination is within balance limits
 */
export function validateUpgradeCombination(upgrades: Record<string, number>): boolean {
  const detailed = validateUpgradeCombinationDetailed(upgrades);
  return detailed.valid;
}

/**
 * Calculate maximum fire rate multiplier
 * @param upgrades Current upgrade configuration
 * @returns Maximum fire rate multiplier
 */
export function calculateMaxFireRateMultiplier(upgrades: Record<string, number>): number {
  let totalMultiplier = 1;
  
  // Rapid Fire with diminishing returns
  const rapidFireStacks = upgrades['rapid-fire'] || 0;
  if (rapidFireStacks > 0) {
    totalMultiplier *= calculateDiminishedMultiplier('rapid-fire', rapidFireStacks, 1.15);
  }
  
  // Heavy Barrel penalty
  const heavyBarrelStacks = upgrades['heavy-barrel'] || 0;
  if (heavyBarrelStacks > 0) {
    totalMultiplier *= Math.pow(0.9, heavyBarrelStacks);
  }
  
  // Bullet Hell boost
  if (upgrades['bullet-hell'] > 0) {
    const adjustments = getLegendaryAdjustments('bullet-hell');
    totalMultiplier *= adjustments.fireRateMultiplier || 3.0;
  }
  
  return totalMultiplier;
}