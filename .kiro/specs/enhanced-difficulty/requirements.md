# Requirements Document

## Introduction

This feature rebalances the upgrade power levels and enemy strength in Quiet Quadrant to address the game becoming too easy with powerful upgrade combinations. The goal is to tune the existing static difficulty system so that enemy strength better matches the potential power of upgrade builds, while preserving satisfying power spike moments followed by renewed challenge.

## Glossary

- **Upgrade_Balance**: The system that defines the power level and stacking limits of player upgrades
- **Boss_Battle**: The final encounter featuring bullet-hell patterns and multiple phases
- **Wave_Scaling**: The mathematical progression of enemy stats and counts across waves
- **Elite_Variants**: Enhanced enemy versions with increased stats and special behaviors
- **Power_Spikes**: Moments when players feel temporarily overpowered due to good upgrade combinations
- **Challenge_Tuning**: Adjustments to base enemy stats and boss behavior to match upgrade potential

## Requirements

### Requirement 1

**User Story:** As a player, I want upgrade combinations to feel powerful without making the entire game trivial, so that I can enjoy power spikes while still facing meaningful challenges.

#### Acceptance Criteria

1. WHEN powerful upgrade synergies activate THEN the Upgrade_Balance SHALL allow temporary dominance while maintaining wave-to-wave challenge progression
2. WHEN calculating base enemy health THEN the Wave_Scaling SHALL account for typical upgrade damage output at each wave
3. WHEN spawning enemies in later waves THEN the Wave_Scaling SHALL use higher base stats that challenge upgraded players
4. WHEN Elite_Variants appear THEN the Challenge_Tuning SHALL ensure they remain threatening even to well-upgraded players
5. WHEN players reach maximum upgrade stacks THEN the Wave_Scaling SHALL provide enemies that can withstand high-end builds

### Requirement 2

**User Story:** As a player, I want boss battles to be significantly more challenging and engaging, so that they feel like proper climactic encounters that test my skills and build regardless of my upgrade strength.

#### Acceptance Criteria

1. WHEN the Boss_Battle begins THEN the Challenge_Tuning SHALL provide boss health values that create substantial encounters even for high-damage builds
2. WHEN the boss transitions between phases THEN the Boss_Battle SHALL increase bullet density, speed, and pattern complexity significantly
3. WHEN the boss is in later phases THEN the Boss_Battle SHALL introduce overlapping attack patterns and reduced safe zones
4. WHEN boss patterns execute THEN the Boss_Battle SHALL use faster projectile speeds and tighter timing windows
5. WHEN the boss health drops below phase thresholds THEN the Boss_Battle SHALL trigger immediate pattern changes with enhanced difficulty

### Requirement 3

**User Story:** As a player, I want enemy stats and Elite_Variants to be properly tuned to challenge upgraded builds, so that encounters remain threatening throughout the run.

#### Acceptance Criteria

1. WHEN spawning Elite_Variants THEN the Challenge_Tuning SHALL provide stat multipliers that make them dangerous even to upgraded players
2. WHEN Elite_Variants are active THEN the Challenge_Tuning SHALL grant them enhanced health, speed, and damage values
3. WHEN calculating enemy base stats THEN the Wave_Scaling SHALL use values that account for typical player upgrade progression
4. WHEN enemies engage the player THEN Elite_Variants SHALL have significantly increased collision damage and projectile damage
5. WHEN Elite_Variants appear in later waves THEN the Challenge_Tuning SHALL ensure they can survive multiple hits from upgraded weapons

### Requirement 4

**User Story:** As a player, I want upgrade power levels to be rebalanced, so that individual upgrades and synergies provide meaningful but not game-breaking improvements.

#### Acceptance Criteria

1. WHEN stacking common upgrades THEN the Upgrade_Balance SHALL provide diminishing returns or caps to prevent excessive power accumulation
2. WHEN rare and legendary upgrades are obtained THEN the Upgrade_Balance SHALL ensure they are powerful but not trivializing
3. WHEN synergies activate THEN the Upgrade_Balance SHALL provide significant but bounded power increases
4. WHEN multiple damage upgrades stack THEN the Upgrade_Balance SHALL prevent exponential scaling that breaks enemy balance
5. WHEN defensive upgrades accumulate THEN the Upgrade_Balance SHALL maintain player vulnerability to concentrated enemy fire

### Requirement 5

**User Story:** As a player, I want wave progression to provide consistent challenge escalation, so that later waves remain threatening even with good upgrade combinations.

#### Acceptance Criteria

1. WHEN progressing through waves THEN the Wave_Scaling SHALL increase enemy counts and Elite_Variants frequency significantly
2. WHEN reaching mid-game waves THEN the Wave_Scaling SHALL spawn enemy compositions that challenge typical upgrade builds
3. WHEN approaching the boss wave THEN the Wave_Scaling SHALL provide enemy stats that prepare players for the boss difficulty spike
4. WHEN Elite_Variants spawn in later waves THEN the Wave_Scaling SHALL ensure they appear in meaningful numbers
5. WHEN calculating wave enemy counts THEN the Wave_Scaling SHALL account for player area-of-effect and piercing capabilities

### Requirement 6

**User Story:** As a player, I want clear feedback about enemy strength and boss phases, so that I can understand the challenge level and react appropriately to threats.

#### Acceptance Criteria

1. WHEN Elite_Variants spawn THEN the Challenge_Tuning SHALL provide clear visual distinction through enhanced effects and coloring
2. WHEN boss phases change THEN the Boss_Battle SHALL display phase progression and provide dramatic audio-visual feedback
3. WHEN enemies have increased stats THEN the Challenge_Tuning SHALL show visual indicators of their enhanced threat level
4. WHEN the boss enters dangerous phases THEN the Boss_Battle SHALL use screen effects and color changes to signal increased danger
5. WHEN Elite_Variants are present THEN the Challenge_Tuning SHALL ensure their enhanced threat is immediately recognizable to players