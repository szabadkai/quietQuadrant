/**
 * Final Validation Tests for Enhanced Difficulty System
 * 
 * Task 8: Final integration and balance testing
 * Comprehensive validation of all difficulty enhancements working together
 * 
 * Requirements: All requirements integration
 */

import { describe, it, expect } from 'vitest';
import {
  validateUpgradeCombination,
  validateUpgradeCombinationDetailed,
  calculateMaxDamageMultiplier,
  calculateMaxDPSMultiplier,
  calculateMaxDefenseMultiplier,
  canSafelyAddUpgrade,
  getUpgradePowerSummary
} from '../upgradeBalance';

describe('Final Enhanced Difficulty Validation', () => {
  
  describe('Complete System Integration', () => {
    it('should validate the entire enhanced difficulty system works cohesively', () => {
      // Test a comprehensive set of builds that represent real gameplay scenarios
      const gameplayScenarios = [
        {
          name: 'Early Game Progression',
          builds: [
            {},
            { 'power-shot': 1 },
            { 'power-shot': 2, 'rapid-fire': 1 },
            { 'power-shot': 2, 'rapid-fire': 2, 'plating': 1 }
          ]
        },
        {
          name: 'Mid Game Builds',
          builds: [
            { 'power-shot': 3, 'rapid-fire': 3, 'plating': 2 },
            { 'power-shot': 4, 'rapid-fire': 3, 'heavy-barrel': 1 },
            { 'power-shot': 4, 'rapid-fire': 4, 'plating': 3, 'stabilizers': 1 }
          ]
        },
        {
          name: 'Late Game Builds',
          builds: [
            { 'power-shot': 5, 'rapid-fire': 5, 'glass-cannon': 1 },
            { 'power-shot': 6, 'rapid-fire': 6, 'plating': 4 },
            { 'power-shot': 6, 'rapid-fire': 6, 'glass-cannon': 1, 'heavy-barrel': 2 }
          ]
        },
        {
          name: 'Specialized Builds',
          builds: [
            { 'plating': 4, 'stabilizers': 3, 'power-shot': 3 }, // Tank build
            { 'rapid-fire': 6, 'bullet-hell': 1, 'power-shot': 4 }, // Fire rate build
            { 'power-shot': 6, 'heavy-barrel': 3, 'glass-cannon': 1 } // Pure damage build
          ]
        }
      ];

      gameplayScenarios.forEach(({ name, builds }) => {
        builds.forEach((build, index) => {
          const validation = validateUpgradeCombinationDetailed(build);
          const damage = calculateMaxDamageMultiplier(build);
          const dps = calculateMaxDPSMultiplier(build);
          const defense = calculateMaxDefenseMultiplier(build);

          // All builds should be valid or have clear rejection reasons
          if (!validation.valid) {
            expect(validation.reasons.length).toBeGreaterThan(0);
            // Invalid builds should exceed at least one threshold
            expect(damage > 8.0 || dps > 20.0 || defense > 0.5).toBe(true);
          } else {
            // Valid builds should stay within all thresholds
            expect(damage).toBeLessThanOrEqual(8.0);
            expect(dps).toBeLessThanOrEqual(20.0);
            expect(defense).toBeLessThanOrEqual(0.5);
          }

          // Power should scale appropriately with progression
          if (index > 0 && validation.valid) {
            expect(damage).toBeGreaterThanOrEqual(1);
            expect(dps).toBeGreaterThanOrEqual(1);
          }
        });
      });
    });

    it('should ensure boss encounters remain challenging across all build types', () => {
      const bossHealth = 3500; // Enhanced boss health from design
      const baseDPS = 25;
      const minEncounterTime = 10; // seconds
      const maxEncounterTime = 300; // seconds

      const bossTestBuilds = [
        { name: 'Minimal Build', build: { 'power-shot': 1 } },
        { name: 'Early Build', build: { 'power-shot': 2, 'rapid-fire': 2 } },
        { name: 'Mid Build', build: { 'power-shot': 4, 'rapid-fire': 4, 'plating': 2 } },
        { name: 'Strong Build', build: { 'power-shot': 6, 'rapid-fire': 6 } },
        { name: 'Legendary Build', build: { 'power-shot': 6, 'rapid-fire': 6, 'glass-cannon': 1 } },
        { name: 'Tank Build', build: { 'power-shot': 3, 'plating': 4, 'stabilizers': 3 } },
        { name: 'Extreme Build', build: { 'power-shot': 6, 'rapid-fire': 6, 'heavy-barrel': 2, 'glass-cannon': 1 } }
      ];

      bossTestBuilds.forEach(({ name, build }) => {
        const isValid = validateUpgradeCombination(build);
        
        if (isValid) {
          const dps = calculateMaxDPSMultiplier(build);
          const effectiveDPS = baseDPS * dps;
          const timeToKill = bossHealth / effectiveDPS;

          // All valid builds should provide reasonable encounter times
          expect(timeToKill).toBeGreaterThan(minEncounterTime);
          expect(timeToKill).toBeLessThan(maxEncounterTime);

          // Stronger builds should be progressively faster but not trivial
          if (name.includes('Extreme') || name.includes('Legendary')) {
            expect(timeToKill).toBeGreaterThan(10); // Even extreme builds take at least 10 seconds
          }
          
          if (name.includes('Minimal') || name.includes('Early')) {
            expect(timeToKill).toBeLessThan(200); // Weak builds shouldn't take forever
          }
        }
      });
    });

    it('should validate all upgrade progression paths remain viable', () => {
      // Test that players can progress through different upgrade paths
      const progressionPaths = [
        {
          name: 'Damage Focus Path',
          steps: [
            { 'power-shot': 2 },
            { 'power-shot': 4, 'heavy-barrel': 1 },
            { 'power-shot': 6, 'heavy-barrel': 2, 'glass-cannon': 1 }
          ]
        },
        {
          name: 'Fire Rate Path',
          steps: [
            { 'rapid-fire': 2 },
            { 'rapid-fire': 4, 'power-shot': 2 },
            { 'rapid-fire': 6, 'power-shot': 4, 'bullet-hell': 1 }
          ]
        },
        {
          name: 'Defensive Path',
          steps: [
            { 'plating': 2, 'power-shot': 1 },
            { 'plating': 3, 'stabilizers': 2, 'power-shot': 3 },
            { 'plating': 4, 'stabilizers': 3, 'power-shot': 5 }
          ]
        },
        {
          name: 'Balanced Path',
          steps: [
            { 'power-shot': 2, 'rapid-fire': 1, 'plating': 1 },
            { 'power-shot': 4, 'rapid-fire': 3, 'plating': 2, 'heavy-barrel': 1 },
            { 'power-shot': 6, 'rapid-fire': 5, 'plating': 3, 'heavy-barrel': 2 }
          ]
        }
      ];

      progressionPaths.forEach(({ name, steps }) => {
        let previousPower = 0;
        
        steps.forEach((build, stepIndex) => {
          const isValid = validateUpgradeCombination(build);
          expect(isValid).toBe(true);

          const damage = calculateMaxDamageMultiplier(build);
          const dps = calculateMaxDPSMultiplier(build);
          const defense = calculateMaxDefenseMultiplier(build);
          
          // Calculate total power (weighted combination of metrics)
          const totalPower = damage * 0.4 + dps * 0.4 + defense * 20 * 0.2;
          
          // Each step should provide meaningful progression
          if (stepIndex > 0) {
            expect(totalPower).toBeGreaterThan(previousPower);
          }
          
          previousPower = totalPower;
        });
      });
    });
  });

  describe('Edge Case Robustness', () => {
    it('should handle extreme edge cases gracefully', () => {
      const edgeCases = [
        { name: 'Empty Build', build: {} },
        { name: 'Single Max Stack', build: { 'power-shot': 6 } },
        { name: 'All Legendaries', build: { 'glass-cannon': 1, 'bullet-hell': 1 } },
        { name: 'Conflicting Upgrades', build: { 'glass-cannon': 1, 'plating': 4 } },
        { name: 'Maximum Everything', build: { 'power-shot': 6, 'rapid-fire': 6, 'heavy-barrel': 3, 'plating': 4, 'stabilizers': 3, 'glass-cannon': 1, 'bullet-hell': 1 } }
      ];

      edgeCases.forEach(({ name, build }) => {
        // Should not crash or throw errors
        expect(() => {
          const validation = validateUpgradeCombinationDetailed(build);
          const damage = calculateMaxDamageMultiplier(build);
          const dps = calculateMaxDPSMultiplier(build);
          const defense = calculateMaxDefenseMultiplier(build);
          const summary = getUpgradePowerSummary(build);
          
          // All values should be reasonable numbers
          expect(typeof damage).toBe('number');
          expect(typeof dps).toBe('number');
          expect(typeof defense).toBe('number');
          expect(damage).toBeGreaterThanOrEqual(0);
          expect(dps).toBeGreaterThanOrEqual(0);
          expect(defense).toBeGreaterThanOrEqual(0);
          expect(typeof summary).toBe('string');
          
        }).not.toThrow();
      });
    });

    it('should maintain consistency across repeated validations', () => {
      const testBuild = { 'power-shot': 4, 'rapid-fire': 3, 'glass-cannon': 1, 'plating': 2 };
      
      // Run the same validation multiple times
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push({
          valid: validateUpgradeCombination(testBuild),
          damage: calculateMaxDamageMultiplier(testBuild),
          dps: calculateMaxDPSMultiplier(testBuild),
          defense: calculateMaxDefenseMultiplier(testBuild)
        });
      }
      
      // All results should be identical
      const first = results[0];
      results.forEach(result => {
        expect(result.valid).toBe(first.valid);
        expect(result.damage).toBe(first.damage);
        expect(result.dps).toBe(first.dps);
        expect(result.defense).toBe(first.defense);
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of upgrade combinations efficiently', () => {
      const startTime = Date.now();
      let validationsPerformed = 0;
      
      // Test a large matrix of upgrade combinations
      for (let ps = 0; ps <= 6; ps++) {
        for (let rf = 0; rf <= 6; rf++) {
          for (let hb = 0; hb <= 3; hb++) {
            for (let pl = 0; pl <= 4; pl++) {
              const build: Record<string, number> = {};
              if (ps > 0) build['power-shot'] = ps;
              if (rf > 0) build['rapid-fire'] = rf;
              if (hb > 0) build['heavy-barrel'] = hb;
              if (pl > 0) build['plating'] = pl;
              
              validateUpgradeCombination(build);
              validationsPerformed++;
              
              // Stop if taking too long (should be very fast)
              if (Date.now() - startTime > 5000) break;
            }
          }
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(validationsPerformed).toBeGreaterThan(100);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe('Requirements Validation Summary', () => {
    it('should validate all enhanced difficulty requirements are met', () => {
      // Requirement 1: Upgrade combinations feel powerful without trivializing
      const powerfulBuild = { 'power-shot': 6, 'rapid-fire': 6, 'glass-cannon': 1 };
      expect(validateUpgradeCombination(powerfulBuild)).toBe(true);
      expect(calculateMaxDamageMultiplier(powerfulBuild)).toBeGreaterThan(4.0);
      expect(calculateMaxDamageMultiplier(powerfulBuild)).toBeLessThanOrEqual(8.0);

      // Requirement 2: Boss battles are significantly more challenging
      const bossHealth = 3500;
      const strongBuildDPS = calculateMaxDPSMultiplier(powerfulBuild) * 25;
      const bossEncounterTime = bossHealth / strongBuildDPS;
      expect(bossEncounterTime).toBeGreaterThan(10); // Substantial encounter even for strong builds

      // Requirement 3: Enemy stats challenge upgraded builds
      const moderateBuild = { 'power-shot': 4, 'rapid-fire': 3, 'plating': 2 };
      expect(validateUpgradeCombination(moderateBuild)).toBe(true);
      expect(calculateMaxDamageMultiplier(moderateBuild)).toBeGreaterThan(1.5);

      // Requirement 4: Upgrade power levels are rebalanced
      expect(canSafelyAddUpgrade({ 'power-shot': 6 }, 'power-shot', 1)).toBe(false); // Stacking caps
      const legendaryBuild = { 'glass-cannon': 1 };
      expect(calculateMaxDamageMultiplier(legendaryBuild)).toBeGreaterThan(2.0);
      expect(calculateMaxDamageMultiplier(legendaryBuild)).toBeLessThan(3.0); // Bounded power

      // Requirement 5: Wave progression provides consistent challenge
      const earlyBuild = { 'power-shot': 2, 'rapid-fire': 1 };
      const lateBuild = { 'power-shot': 6, 'rapid-fire': 6 };
      expect(calculateMaxDPSMultiplier(lateBuild)).toBeGreaterThan(calculateMaxDPSMultiplier(earlyBuild) * 2);

      // Requirement 6: Clear feedback (tested through validation functions)
      const detailedValidation = validateUpgradeCombinationDetailed(powerfulBuild);
      expect(detailedValidation.metrics).toBeDefined();
      expect(detailedValidation.valid).toBe(true);
    });
  });
});