# Code Refactoring Design Document

## Overview

This design addresses the refactoring of the existing codebase to eliminate extreme line counts per file, with a primary focus on decomposing the 4000+ line MainScene.ts file into a modular, maintainable architecture. The refactoring will follow established software engineering principles including Single Responsibility Principle, separation of concerns, and dependency injection patterns.

The refactoring will transform the monolithic MainScene class into a collection of specialized systems that communicate through well-defined interfaces, making the codebase more maintainable, testable, and extensible.

## Architecture

### Current State Analysis

-   **MainScene.ts**: 4023 lines containing all game logic (player, enemies, projectiles, UI, upgrades, etc.)
-   **SoundManager.ts**: 463 lines managing all audio functionality
-   **Other large files**: Several files between 200-350 lines that could benefit from modularization

### Target Architecture

The refactored architecture will implement a **System-Component-Entity** pattern where:

1. **MainScene** becomes a lightweight orchestrator that manages system lifecycle
2. **Systems** handle specific game concerns (PlayerSystem, EnemySystem, etc.)
3. **Components** represent data and behavior for specific aspects
4. **Entities** are managed by their respective systems

### System Communication

Systems will communicate through:

-   **Event Bus**: For loose coupling between systems
-   **Shared State**: For performance-critical data access
-   **Service Interfaces**: For direct system-to-system communication

## Components and Interfaces

### Core System Interface

```typescript
interface GameSystem {
    initialize(scene: Phaser.Scene): void;
    update(time: number, delta: number): void;
    shutdown(): void;
}
```

### System Registry

```typescript
interface SystemRegistry {
    registerSystem<T extends GameSystem>(name: string, system: T): void;
    getSystem<T extends GameSystem>(name: string): T;
    updateAllSystems(time: number, delta: number): void;
}
```

### Player System

-   **Responsibility**: Player movement, input handling, stats management
-   **Key Components**: PlayerController, PlayerStats, PlayerAbilities
-   **Interfaces**: IPlayerSystem, IPlayerController, IPlayerStats

### Enemy System

-   **Responsibility**: Enemy spawning, AI, wave management
-   **Key Components**: EnemySpawner, EnemyController, WaveManager
-   **Interfaces**: IEnemySystem, IEnemySpawner, IWaveManager

### Projectile System

-   **Responsibility**: Bullet physics, collision detection, special effects
-   **Key Components**: ProjectileManager, CollisionHandler, EffectProcessor
-   **Interfaces**: IProjectileSystem, ICollisionHandler

### Upgrade System

-   **Responsibility**: Upgrade logic, synergy calculations, progression
-   **Key Components**: UpgradeManager, SynergyProcessor, ProgressionTracker
-   **Interfaces**: IUpgradeSystem, ISynergyProcessor

### Visual Effects System

-   **Responsibility**: Particle effects, screen effects, animations
-   **Key Components**: ParticleManager, ScreenEffects, AnimationController
-   **Interfaces**: IVFXSystem, IParticleManager

### Audio System (Refactored)

-   **Responsibility**: Sound effects, music management, audio settings
-   **Key Components**: SFXManager, MusicPlayer, AudioSettings
-   **Interfaces**: IAudioSystem, ISFXManager, IMusicPlayer

## Data Models

### System Configuration

```typescript
interface SystemConfig {
    enabled: boolean;
    priority: number;
    dependencies: string[];
}

interface GameSystemsConfig {
    [systemName: string]: SystemConfig;
}
```

### Player Data Models

```typescript
interface PlayerStats {
    moveSpeed: number;
    damage: number;
    fireRate: number;
    projectileSpeed: number;
    projectiles: number;
    pierce: number;
    bounce: number;
    maxHealth: number;
    health: number;
    critChance: number;
    critMultiplier: number;
}

interface PlayerState {
    stats: PlayerStats;
    abilities: AbilityState;
    position: Phaser.Math.Vector2;
    lastAimDirection: Phaser.Math.Vector2;
}
```

### Enemy Data Models

```typescript
interface EnemyState {
    type: string;
    health: number;
    maxHealth: number;
    position: Phaser.Math.Vector2;
    velocity: Phaser.Math.Vector2;
    lastActionTime: number;
}

interface WaveState {
    index: number;
    active: boolean;
    remainingEnemies: number;
    spawnQueue: EnemySpawn[];
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to eliminate redundancy:

-   Properties 2.1-2.5 (system extraction) are specific examples that can be combined into a single comprehensive property about proper system decomposition
-   Properties 3.1, 3.2, 3.4 (directory organization) can be combined into one property about consistent file organization
-   Properties 4.1, 4.2, 4.5 (TypeScript interfaces) can be combined into one property about type safety preservation
-   Properties 5.1, 5.4 (behavior preservation) are redundant and can be combined

Property 1: File size constraint compliance
_For any_ refactored source file in the codebase, the line count should not exceed 500 lines
**Validates: Requirements 1.2**

Property 2: Functionality preservation through testing
_For any_ existing test in the test suite, the test should continue to pass after refactoring without modification
**Validates: Requirements 1.5, 5.1, 5.4**

Property 3: System decomposition completeness
_For any_ major game system (player, enemy, projectile, upgrade, UI), there should exist a dedicated module containing that system's logic
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 4: Interface implementation consistency
_For any_ system module, it should implement the required GameSystem interface and define clear TypeScript interfaces for its public API
**Validates: Requirements 2.6, 4.1**

Property 5: Directory organization consistency
_For any_ refactored file, it should be placed in the appropriate directory following established naming conventions and separation of concerns
**Validates: Requirements 3.1, 3.2, 3.4**

Property 6: Import path correctness
_For any_ import statement in the refactored codebase, it should resolve to a valid module without compilation errors
**Validates: Requirements 3.5, 4.5**

Property 7: Type safety preservation
_For any_ existing type definition or constraint, it should remain accessible and properly typed after refactoring
**Validates: Requirements 4.2, 4.3**

Property 8: Test coverage maintenance
_For any_ module in the refactored codebase, it should have unit tests covering its public interface and maintain overall coverage percentage
**Validates: Requirements 5.2, 5.5**

## Error Handling

### System Initialization Errors

-   **Dependency Resolution**: Systems with missing dependencies should fail gracefully with clear error messages
-   **Circular Dependencies**: The system registry should detect and prevent circular dependencies between systems
-   **Resource Loading**: Failed resource loading should not crash the entire game, but should provide fallback behavior

### Runtime Error Isolation

-   **System Failures**: If one system encounters an error, it should not crash other systems
-   **State Corruption**: Systems should validate their state and recover from corruption when possible
-   **Memory Leaks**: Each system should properly clean up resources during shutdown

### Migration Error Handling

-   **Import Resolution**: Missing imports during refactoring should be detected and reported clearly
-   **Type Compatibility**: Type mismatches should be caught at compile time with helpful error messages
-   **Interface Violations**: Systems that don't implement required interfaces should fail at initialization

## Testing Strategy

### Dual Testing Approach

The refactoring will employ both unit testing and property-based testing to ensure comprehensive validation:

**Unit Testing Requirements:**

-   Each new system module will have dedicated unit tests for its public interface
-   Integration tests will verify that systems communicate correctly
-   Regression tests will ensure existing game behavior is preserved
-   Mock objects will be used to isolate system dependencies during testing

**Property-Based Testing Requirements:**

-   Property-based tests will use **fast-check** library for TypeScript/JavaScript
-   Each property-based test will run a minimum of 100 iterations
-   Tests will be tagged with comments referencing design document properties using format: **Feature: code-refactoring, Property {number}: {property_text}**
-   Property tests will validate universal behaviors across all valid inputs

**Specific Testing Areas:**

1. **File Analysis Testing**: Verify that file size analysis correctly identifies large files
2. **Module Extraction Testing**: Validate that functionality is properly extracted into appropriate systems
3. **Interface Compliance Testing**: Ensure all systems implement required interfaces
4. **Import Resolution Testing**: Verify all imports resolve correctly after refactoring
5. **Behavioral Equivalence Testing**: Confirm game behavior remains identical after refactoring

**Test Coverage Requirements:**

-   Maintain or exceed current test coverage percentage
-   Each new module must have >90% line coverage
-   Integration points between systems must be fully tested
-   Property-based tests must cover edge cases and boundary conditions

### Testing Framework Configuration

-   **Unit Tests**: Jest with TypeScript support
-   **Property-Based Tests**: fast-check library
-   **Integration Tests**: Custom game state validation
-   **Coverage**: Istanbul/nyc for coverage reporting
-   **Minimum Iterations**: 100 iterations per property-based test
