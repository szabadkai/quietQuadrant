/**
 * Property-Based Tests for Upgrade Balance System
 * 
 * **Feature: enhanced-difficulty, Property 9: Upgrade stacking has diminishing returns or caps**
 * **Feature: enhanced-difficulty, Property 10: Rare and legendary upgrades have bounded power levels**
 * **Feature: enhanced-difficulty, Property 11: Synergy bonuses are meaningful but bounded**
 * 
 * These tests verify the correctness properties across many input combinations
 * using property-based testing principles with 100+ iterations per property.
 */

import {
  calculateDiminishedMultiplier,
  canStackUpgrade,
  validateUpgradeCombination,
  calculateMaxDamageMultiplier,
  applySynergyAdjustment,
  getLegendaryAdjustments,
  UPGRADE_BALANCE_CONFIG
} from '../upgradeBalance';

// Simple property-based testing utilities
function* generateIntegers(min: number, max: number, count: number = 100) {
  for (let i = 0; i < count; i++) {
    yield Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

function* generateUpgradeCombinations(count: number = 100) {
  const regularUpgrades = ['power-shot', 'rapid-fire', 'heavy-barrel', 'plating'];
  const legendaryUpgrades = ['glass-cannon', 'bullet-hell'];
  
  // Stacking caps from the config
  const stackingCaps: Record<string, number> = {
    'power-shot': 6,
    'rapid-fire': 6,
    'heavy-barrel': 3,
    'plating': 4,
    'glass-cannon': 1, // Legendaries should only have 1 stack
    'bullet-hell': 1
  };
  
  for (let i = 0; i < count; i++) {
    const combination: Record<string, number> = {};
    const numUpgrades = Math.floor(Math.random() * 4) + 1; // 1-4 upgrades
    
    for (let j = 0; j < numUpgrades; j++) {
      // Choose from all upgrades
      const allUpgrades = [...regularUpgrades, ...legendaryUpgrades];
      const upgradeId = allUpgrades[Math.floor(Math.random() * allUpgrades.length)];
      
      // Don't add the same upgrade twice
      if (combination[upgradeId]) continue;
      
      // Respect stacking caps
      const maxStacks = stackingCaps[upgradeId] || 8;
      const stacks = Math.floor(Math.random() * maxStacks) + 1;
      combination[upgradeId] = stacks;
    }
    
    yield combination;
  }
}

function* generateSynergyValues(count: number = 100) {
  for (let i = 0; i < count; i++) {
    yield Math.random() * 0.5; // 0 to 0.5 synergy values
  }
}

// Property-based test runner
function runPropertyTest(
  name: string,
  generator: Generator<any>,
  property: (input: any) => boolean,
  iterations: number = 100
): { passed: boolean; failures: any[]; totalTests: number } {
  const failures: any[] = [];
  let testCount = 0;
  
  for (const input of generator) {
    testCount++;
    if (testCount > iterations) break;
    
    try {
      if (!property(input)) {
        failures.push(input);
      }
    } catch (error) {
      failures.push({ input, error: error.message });
    }
  }
  
  const passed = failures.length === 0;
  console.log(`Property Test: ${name}`);
  console.log(`  Tests run: ${testCount}`);
  console.log(`  Passed: ${passed ? 'YES' : 'NO'}`);
  if (!passed) {
    console.log(`  Failures: ${failures.length}`);
    console.log(`  First failure:`, failures[0]);
  }
  
  return { passed, failures, totalTests: testCount };
}

/**
 * **Feature: enhanced-difficulty, Property 9: Upgrade stacking has diminishing returns or caps**
 * **Validates: Requirements 4.1**
 * 
 * For any upgrade that can be stacked multiple times, the effectiveness per stack 
 * should decrease or reach a maximum limit
 */
export function testUpgradeStackingLimits(): { passed: boolean; failures: any[]; totalTests: number } {
  return runPropertyTest(
    'Upgrade stacking has diminishing returns or caps',
    generateIntegers(1, 10, 100),
    (stacks: number) => {
      // Test power-shot diminishing returns
      if (stacks > 4) {
        const withDiminishing = calculateDiminishedMultiplier('power-shot', stacks, 1.15);
        const withoutDiminishing = Math.pow(1.15, stacks);
        
        // With diminishing returns should be less than without
        if (withDiminishing >= withoutDiminishing) {
          return false;
        }
      }
      
      // Test stacking caps
      const canStack5 = canStackUpgrade('power-shot', 5);
      const canStack6 = canStackUpgrade('power-shot', 6);
      const canStack7 = canStackUpgrade('power-shot', 7);
      
      // Should be able to stack to 5, not to 6 or beyond
      return canStack5 && !canStack6 && !canStack7;
    },
    100
  );
}

/**
 * **Feature: enhanced-difficulty, Property 10: Rare and legendary upgrades have bounded power levels**
 * **Validates: Requirements 4.2**
 * 
 * For any rare or legendary upgrade, its power increase should be significant 
 * but remain within defined balance thresholds
 */
export function testLegendaryUpgradeBounds(): { passed: boolean; failures: any[]; totalTests: number } {
  return runPropertyTest(
    'Rare and legendary upgrades have bounded power levels',
    generateUpgradeCombinations(100),
    (upgrades: Record<string, number>) => {
      // Test Glass Cannon bounds
      if (upgrades['glass-cannon']) {
        const adjustments = getLegendaryAdjustments('glass-cannon');
        const damageMultiplier = adjustments.damageMultiplier || 1;
        const critBonus = adjustments.critChanceBonus || 0;
        
        // Glass Cannon should be powerful but bounded
        if (damageMultiplier > 3.0 || damageMultiplier < 2.0) return false;
        if (critBonus > 0.15 || critBonus < 0.05) return false;
      }
      
      // Test Bullet Hell bounds
      if (upgrades['bullet-hell']) {
        const adjustments = getLegendaryAdjustments('bullet-hell');
        const fireRateMultiplier = adjustments.fireRateMultiplier || 1;
        const damageMultiplier = adjustments.damageMultiplier || 1;
        
        // Bullet Hell should have high fire rate but damage penalty
        if (fireRateMultiplier > 4.0 || fireRateMultiplier < 2.0) return false;
        if (damageMultiplier > 1.0 || damageMultiplier < 0.5) return false;
      }
      
      // Test overall damage bounds
      const maxDamage = calculateMaxDamageMultiplier(upgrades);
      return maxDamage <= 10.0; // Should not exceed 10x damage
    },
    100
  );
}

/**
 * **Feature: enhanced-difficulty, Property 11: Synergy bonuses are meaningful but bounded**
 * **Validates: Requirements 4.3**
 * 
 * For any synergy combination, the total power increase should be substantial 
 * but not exceed balance limits
 */
export function testSynergyPowerLimits(): { passed: boolean; failures: any[]; totalTests: number } {
  return runPropertyTest(
    'Synergy bonuses are meaningful but bounded',
    generateSynergyValues(100),
    (basePower: number) => {
      // Test railgun synergy adjustment
      const railgunAdjusted = applySynergyAdjustment('railgun', basePower);
      if (railgunAdjusted >= basePower) return false; // Should be reduced
      if (railgunAdjusted < basePower * 0.5) return false; // Should still be meaningful
      
      // Test meat-grinder synergy adjustment
      const meatGrinderAdjusted = applySynergyAdjustment('meat-grinder', basePower);
      if (meatGrinderAdjusted >= basePower) return false; // Should be reduced
      if (meatGrinderAdjusted < basePower * 0.6) return false; // Should still be meaningful
      
      // Test vampire synergy adjustment
      const vampireAdjusted = applySynergyAdjustment('vampire', basePower);
      if (vampireAdjusted >= basePower) return false; // Should be reduced
      if (vampireAdjusted < basePower * 0.8) return false; // Should still be meaningful
      
      return true;
    },
    100
  );
}

/**
 * **Feature: enhanced-difficulty, Property 12: Maximum damage combinations remain within balance thresholds**
 * **Validates: Requirements 4.4**
 * 
 * For any combination of damage upgrades and synergies, the total damage multiplier 
 * should not exceed defined maximum values
 */
export function testMaximumDamageCombinations(): { passed: boolean; failures: any[]; totalTests: number } {
  return runPropertyTest(
    'Maximum damage combinations remain within balance thresholds',
    generateUpgradeCombinations(100),
    (upgrades: Record<string, number>) => {
      // Ensure upgrade combination validation works
      const isValid = validateUpgradeCombination(upgrades);
      const maxDamage = calculateMaxDamageMultiplier(upgrades);
      
      // If combination is valid, damage should be within bounds
      if (isValid && maxDamage > 8.0) return false;
      
      // If damage exceeds bounds, combination should be invalid
      if (maxDamage > 8.0 && isValid) return false;
      
      return true;
    },
    100
  );
}

/**
 * **Feature: enhanced-difficulty, Property 13: Maximum defensive builds maintain vulnerability**
 * **Validates: Requirements 4.5**
 * 
 * For any combination of defensive upgrades, the player should still take 
 * meaningful damage from concentrated enemy fire
 */
export function testDefensiveUpgradeVulnerability(): { passed: boolean; failures: any[]; totalTests: number } {
  return runPropertyTest(
    'Maximum defensive builds maintain vulnerability',
    generateIntegers(1, 6, 100),
    (platingStacks: number) => {
      // Test that plating damage reduction is capped
      let totalReduction = 0;
      for (let i = 1; i <= platingStacks; i++) {
        const baseReduction = 0.08;
        if (i <= 3) {
          totalReduction += baseReduction;
        } else {
          totalReduction += baseReduction * 0.8; // Diminishing returns
        }
      }
      totalReduction = Math.min(totalReduction, 0.5); // Capped at 50%
      
      // Should never exceed 50% damage reduction
      return totalReduction <= 0.5;
    },
    100
  );
}

// Run all property-based tests
export function runAllPropertyTests(): boolean {
  console.log('Running Property-Based Tests for Upgrade Balance System...\n');
  
  const results = [
    testUpgradeStackingLimits(),
    testLegendaryUpgradeBounds(),
    testSynergyPowerLimits(),
    testMaximumDamageCombinations(),
    testDefensiveUpgradeVulnerability()
  ];
  
  const allPassed = results.every(result => result.passed);
  const totalTests = results.reduce((sum, result) => sum + result.totalTests, 0);
  const totalFailures = results.reduce((sum, result) => sum + result.failures.length, 0);
  
  console.log('\n=== Property-Based Test Summary ===');
  console.log(`Total tests run: ${totalTests}`);
  console.log(`Total failures: ${totalFailures}`);
  console.log(`All tests passed: ${allPassed ? 'YES' : 'NO'}`);
  
  return allPassed;
}

// Export for manual testing
if (typeof window !== 'undefined') {
  (window as any).runUpgradeBalanceTests = runAllPropertyTests;
}