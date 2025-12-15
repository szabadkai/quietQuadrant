# Enhanced Difficulty Design Document

## Overview

This design rebalances Quiet Quadrant's upgrade power levels and enemy strength to address the game becoming too easy with powerful upgrade combinations. The approach focuses on tuning the existing static difficulty system rather than implementing dynamic scaling, preserving satisfying power spike moments while ensuring sustained challenge throughout runs.

The design maintains the core philosophy of allowing players to feel temporarily overpowered when they achieve good synergies, but ensures that subsequent waves and the boss battle provide renewed challenge that tests even optimized builds.

## Architecture

The enhanced difficulty system builds upon the existing wave scaling and enemy spawning architecture:

### Current System Analysis
- Base difficulty multiplier: `baseDifficulty` (default 1.0, configurable)
- Wave scaling: `speedAndFire = baseDifficulty * (overflow scaling)`
- Enemy health scaling: `enemyHealthScale = baseDifficulty * (exponential overflow)`
- Boss patterns: Fixed cooldowns divided by `difficulty` multiplier

### Enhanced Components
1. **Upgrade Power Analysis**: Evaluation of current upgrade stacking potential
2. **Enemy Stat Rebalancing**: Adjusted base stats and elite multipliers
3. **Boss Enhancement**: Improved health, pattern complexity, and phase transitions
4. **Wave Composition Tuning**: Better enemy type distribution and elite frequency

## Components and Interfaces

### Upgrade Balance Adjustments

**Power Level Assessment**:
- Current damage upgrades can stack to extreme levels (8x Power Shot + 8x Rapid Fire + synergies)
- Legendary upgrades like Glass Cannon (+200% damage) create massive power spikes
- Defensive upgrades can make players nearly invulnerable
- Synergies provide additional multiplicative bonuses

**Rebalancing Strategy**:
- Implement diminishing returns on high-stack upgrades
- Adjust legendary upgrade power levels
- Modify synergy bonuses to be additive rather than multiplicative where appropriate
- Introduce upgrade caps or scaling penalties

### Enemy Stat Rebalancing

**Current Base Stats** (from `enemies.ts`):
```
drifter: { speed: 110, health: 18, damage: 10 }
watcher: { speed: 70, health: 28, damage: 12 }
mass: { speed: 45, health: 70, damage: 25 }
boss: { speed: 60, health: 1500, damage: 25 }
```

**Elite Multipliers** (current):
```
health: 1.5x
speed: 1.2x
```

**Proposed Adjustments**:
- Increase base health values by 40-60% across all enemy types
- Enhance elite multipliers to 2.0x health, 1.4x speed
- Add damage multipliers for elite variants
- Introduce new elite behaviors (faster firing, burst movement)

### Boss Battle Enhancement

**Current Boss Issues**:
- Base health of 1500 is insufficient for high-damage builds
- Pattern cooldowns scale linearly with difficulty
- Phase transitions are health-threshold based only
- Limited pattern variety and complexity

**Enhancement Strategy**:
- Increase base boss health to 3000-4000
- Add more aggressive pattern overlapping
- Implement faster phase transitions
- Introduce pattern intensity scaling within phases
- Add visual and audio feedback for phase changes

## Data Models

### Enhanced Enemy Configuration

```typescript
interface EnhancedEnemyStats {
  baseHealth: number;
  healthScaling: number;
  baseDamage: number;
  damageScaling: number;
  baseSpeed: number;
  speedScaling: number;
  eliteMultipliers: {
    health: number;
    damage: number;
    speed: number;
    fireRate?: number;
  };
  specialBehaviors?: EliteBehavior[];
}

interface EliteBehavior {
  type: 'burst_movement' | 'rapid_fire' | 'shield_regen' | 'death_explosion';
  parameters: Record<string, number>;
}
```

### Boss Enhancement Configuration

```typescript
interface EnhancedBossConfig {
  baseHealth: number;
  healthMultiplier: number;
  phaseThresholds: number[];
  patternIntensityScaling: {
    bulletSpeed: number;
    bulletDensity: number;
    patternFrequency: number;
  };
  phaseTransitionEffects: {
    screenShake: boolean;
    colorFlash: boolean;
    patternReset: boolean;
  };
}
```

### Upgrade Balance Configuration

```typescript
interface UpgradeBalanceConfig {
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
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to eliminate redundancy:

- Properties 1.2 and 3.3 both test that enemy stats account for player upgrade progression - these can be combined
- Properties 3.1 and 3.2 both test elite variant stat enhancements - these can be combined  
- Properties 1.4 and 3.5 both test elite survivability against upgraded builds - these can be combined
- Visual feedback properties (6.1-6.5) are all examples of UI feedback and can be grouped

### Core Properties

**Property 1: Enemy health scales with expected player damage**
*For any* wave number and typical upgrade progression at that wave, enemy health values should require reasonable time-to-kill even with expected damage output
**Validates: Requirements 1.2, 3.3**

**Property 2: Later waves have significantly higher enemy stats**
*For any* pair of waves where one is at least 3 waves later than the other, the later wave's enemies should have meaningfully higher base stats
**Validates: Requirements 1.3**

**Property 3: Elite variants have enhanced stats and survivability**
*For any* elite enemy compared to its regular variant, the elite should have significantly higher health, damage, and speed multipliers that maintain threat against upgraded builds
**Validates: Requirements 1.4, 3.1, 3.2, 3.5**

**Property 4: Maximum upgrade combinations don't trivialize enemies**
*For any* combination of maximum upgrade stacks, the resulting damage output should not reduce enemy time-to-kill below reasonable thresholds
**Validates: Requirements 1.5**

**Property 5: Boss health provides substantial encounters for high-damage builds**
*For any* high-damage build configuration, boss health should require significant engagement time and cannot be defeated trivially quickly
**Validates: Requirements 2.1**

**Property 6: Boss phases have measurably increased difficulty**
*For any* boss phase transition, later phases should have higher bullet density, speed, and pattern frequency than earlier phases
**Validates: Requirements 2.2, 2.3, 2.4**

**Property 7: Boss phase transitions trigger immediately at health thresholds**
*For any* boss health value that crosses a phase threshold, the phase change should occur immediately with enhanced difficulty parameters
**Validates: Requirements 2.5**

**Property 8: Elite variants deal significantly more damage**
*For any* elite enemy compared to its regular variant, the elite should deal meaningfully higher collision and projectile damage
**Validates: Requirements 3.4**

**Property 9: Upgrade stacking has diminishing returns or caps**
*For any* upgrade that can be stacked multiple times, the effectiveness per stack should decrease or reach a maximum limit
**Validates: Requirements 4.1**

**Property 10: Rare and legendary upgrades have bounded power levels**
*For any* rare or legendary upgrade, its power increase should be significant but remain within defined balance thresholds
**Validates: Requirements 4.2**

**Property 11: Synergy bonuses are meaningful but bounded**
*For any* synergy combination, the total power increase should be substantial but not exceed balance limits
**Validates: Requirements 4.3**

**Property 12: Maximum damage combinations remain within balance thresholds**
*For any* combination of damage upgrades and synergies, the total damage multiplier should not exceed defined maximum values
**Validates: Requirements 4.4**

**Property 13: Maximum defensive builds maintain vulnerability**
*For any* combination of defensive upgrades, the player should still take meaningful damage from concentrated enemy fire
**Validates: Requirements 4.5**

**Property 14: Later waves have increased enemy counts and elite frequency**
*For any* wave in the later half of the game, enemy counts and elite spawn rates should be significantly higher than early waves
**Validates: Requirements 5.1, 5.4**

**Property 15: Mid-game waves challenge typical upgrade builds**
*For any* mid-game wave (waves 5-8), enemy compositions should provide appropriate challenge for expected upgrade progression
**Validates: Requirements 5.2**

**Property 16: Pre-boss waves bridge to boss difficulty**
*For any* wave immediately before the boss, enemy stats should be appropriately scaled to prepare for boss encounter difficulty
**Validates: Requirements 5.3**

**Property 17: Enemy counts account for AoE capabilities**
*For any* wave where players have area-of-effect or piercing upgrades, enemy counts should be sufficient to maintain challenge
**Validates: Requirements 5.5**

## Error Handling

### Upgrade Balance Validation
- Validate upgrade stack limits don't exceed defined maximums
- Ensure synergy combinations don't create infinite loops or crashes
- Handle edge cases where multiple legendary upgrades interact

### Enemy Spawning Robustness
- Gracefully handle cases where elite spawn rates would exceed 100%
- Ensure minimum enemy counts are maintained even with scaling adjustments
- Validate that boss health calculations don't result in negative or zero values

### Boss Pattern Safety
- Ensure boss pattern overlaps don't create impossible-to-avoid situations
- Validate that phase transitions don't interrupt critical pattern states
- Handle edge cases where boss health changes rapidly due to high damage

## Testing Strategy

### Unit Testing Approach
Unit tests will focus on specific calculations and edge cases:
- Upgrade stacking mathematics and diminishing returns
- Enemy stat calculation formulas
- Boss phase threshold detection
- Elite variant stat multiplier application

### Property-Based Testing Approach
Property-based tests will verify the correctness properties across many input combinations:
- Generate random upgrade combinations and verify balance constraints
- Test enemy scaling across all wave numbers and difficulty settings
- Validate boss behavior across different phase transitions and health values
- Verify elite enemy enhancements across all enemy types

**Property Testing Configuration:**
- Minimum 100 iterations per property test
- Use QuickCheck-style generators for upgrade combinations, wave configurations, and enemy stats
- Each property test must reference its corresponding design document property
- Tag format: `**Feature: enhanced-difficulty, Property {number}: {property_text}**`

### Integration Testing
- Test complete runs with various upgrade builds to ensure overall balance
- Verify boss encounters remain challenging across different player builds
- Validate that visual and audio feedback systems work correctly with enhanced difficulty

The dual testing approach ensures both mathematical correctness of individual components and overall system balance across the full range of possible game states.