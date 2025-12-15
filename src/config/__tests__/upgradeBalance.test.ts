/**
 * Basic tests for upgrade balance system
 * These tests verify the core functionality of the rebalanced upgrade system
 */

import {
  calculateDiminishedMultiplier,
  canStackUpgrade,
  validateUpgradeCombination,
  validateUpgradeCombinationDetailed,
  calculateMaxDamageMultiplier,
  calculateMaxDefenseMultiplier,
  applySynergyAdjustment,
  getLegendaryAdjustments,
  getUpgradePowerSummary,
  canSafelyAddUpgrade
} from '../upgradeBalance';

describe('Upgrade Balance System', () => {
  describe('calculateDiminishedMultiplier', () => {
    it('should apply normal stacking below threshold', () => {
      // Power Shot: 4 stacks should be normal (1.15^4)
      const result = calculateDiminishedMultiplier('power-shot', 4, 1.15);
      const expected = Math.pow(1.15, 4);
      expect(Math.abs(result - expected)).toBeLessThan(0.001);
    });

    it('should apply diminishing returns above threshold', () => {
      // Power Shot: 6 stacks should have diminishing returns
      const result = calculateDiminishedMultiplier('power-shot', 6, 1.15);
      const normalStacking = Math.pow(1.15, 6);
      expect(result).toBeLessThan(normalStacking);
    });

    it('should handle upgrades without diminishing returns config', () => {
      const result = calculateDiminishedMultiplier('unknown-upgrade', 5, 1.2);
      const expected = Math.pow(1.2, 5);
      expect(Math.abs(result - expected)).toBeLessThan(0.001);
    });
  });

  describe('canStackUpgrade', () => {
    it('should respect stacking caps', () => {
      expect(canStackUpgrade('power-shot', 5)).toBe(true);
      expect(canStackUpgrade('power-shot', 6)).toBe(false);
    });

    it('should allow stacking for upgrades without caps', () => {
      expect(canStackUpgrade('unknown-upgrade', 10)).toBe(true);
    });
  });

  describe('validateUpgradeCombination', () => {
    it('should allow reasonable upgrade combinations', () => {
      const upgrades = {
        'power-shot': 3,
        'rapid-fire': 3,
        'heavy-barrel': 2
      };
      expect(validateUpgradeCombination(upgrades)).toBe(true);
    });

    it('should reject excessive upgrade combinations', () => {
      const upgrades = {
        'power-shot': 6,
        'rapid-fire': 6,
        'heavy-barrel': 3,
        'glass-cannon': 1,
        'bullet-hell': 1
      };
      expect(validateUpgradeCombination(upgrades)).toBe(false);
    });
  });

  describe('calculateMaxDamageMultiplier', () => {
    it('should calculate damage multiplier correctly', () => {
      const upgrades = {
        'power-shot': 4,
        'heavy-barrel': 2
      };
      const result = calculateMaxDamageMultiplier(upgrades);
      expect(result).toBeGreaterThan(1);
      expect(result).toBeLessThan(10); // Should be reasonable
    });

    it('should include glass cannon multiplier', () => {
      const upgrades = {
        'power-shot': 2,
        'glass-cannon': 1
      };
      const result = calculateMaxDamageMultiplier(upgrades);
      expect(result).toBeGreaterThan(2.5); // Should include glass cannon
    });
  });

  describe('applySynergyAdjustment', () => {
    it('should reduce synergy power when configured', () => {
      const basePower = 0.25;
      const adjusted = applySynergyAdjustment('railgun', basePower);
      expect(adjusted).toBeLessThan(basePower);
    });

    it('should return original power for unconfigured synergies', () => {
      const basePower = 0.15;
      const adjusted = applySynergyAdjustment('unknown-synergy', basePower);
      expect(adjusted).toBe(basePower);
    });
  });

  describe('getLegendaryAdjustments', () => {
    it('should return adjustments for configured legendaries', () => {
      const adjustments = getLegendaryAdjustments('glass-cannon');
      expect(adjustments.damageMultiplier).toBe(2.5);
      expect(adjustments.critChanceBonus).toBe(0.08);
    });

    it('should return empty object for unconfigured legendaries', () => {
      const adjustments = getLegendaryAdjustments('unknown-legendary');
      expect(Object.keys(adjustments)).toHaveLength(0);
    });
  });

  describe('validateUpgradeCombinationDetailed', () => {
    it('should provide detailed validation results', () => {
      const upgrades = {
        'power-shot': 3,
        'rapid-fire': 3
      };
      const result = validateUpgradeCombinationDetailed(upgrades);
      
      expect(result.valid).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.metrics.maxDamage).toBeGreaterThan(1);
      expect(result.metrics.maxFireRate).toBeGreaterThan(1);
      expect(result.metrics.maxDPS).toBeGreaterThan(1);
    });

    it('should identify invalid combinations with reasons', () => {
      const upgrades = {
        'power-shot': 6,
        'rapid-fire': 6,
        'glass-cannon': 1,
        'bullet-hell': 1
      };
      const result = validateUpgradeCombinationDetailed(upgrades);
      
      expect(result.valid).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('calculateMaxDefenseMultiplier', () => {
    it('should calculate defense reduction correctly', () => {
      const upgrades = { 'plating': 3 };
      const result = calculateMaxDefenseMultiplier(upgrades);
      
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(0.5); // Should be capped at 50%
    });

    it('should cap defense at 50%', () => {
      const upgrades = { 'plating': 10 }; // Excessive plating
      const result = calculateMaxDefenseMultiplier(upgrades);
      
      expect(result).toBeLessThanOrEqual(0.5);
    });
  });

  describe('getUpgradePowerSummary', () => {
    it('should provide readable power summary', () => {
      const upgrades = { 'power-shot': 2, 'rapid-fire': 2 };
      const summary = getUpgradePowerSummary(upgrades);
      
      expect(summary).toContain('Upgrade Power Summary');
      expect(summary).toContain('Damage Multiplier');
      expect(summary).toContain('Status:');
    });
  });

  describe('canSafelyAddUpgrade', () => {
    it('should allow safe upgrade additions', () => {
      const upgrades = { 'power-shot': 2 };
      const canAdd = canSafelyAddUpgrade(upgrades, 'rapid-fire', 1);
      
      expect(canAdd).toBe(true);
    });

    it('should reject unsafe upgrade additions', () => {
      // Create a combination that exceeds the damage threshold (8.0x)
      // power-shot: 6 gives ~2.0x, glass-cannon gives 2.5x, heavy-barrel: 3 gives ~1.73x
      // Total: 2.0 * 2.5 * 1.73 = 8.65x > 8.0x threshold
      const upgrades = { 'power-shot': 6, 'heavy-barrel': 3, 'glass-cannon': 1 };
      const canAdd = canSafelyAddUpgrade(upgrades, 'power-shot', 1); // Try to add more power-shot (should be capped)
      
      expect(canAdd).toBe(false);
    });
  });
});