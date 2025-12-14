/**
 * Game systems index
 * Provides clean imports for all system-related functionality
 *
 * Note: Game system implementations (EnemySystem, PlayerSystem, etc.) that depend
 * on Phaser should be imported directly from their respective files to avoid
 * pulling Phaser into test environments.
 */

// Core infrastructure (no Phaser dependency)
export * from "./EventBus";
export * from "./ServiceContainer";
export * from "./SystemRegistry";

// System interfaces (explicit exports to avoid naming conflicts)
export {
    BaseGameSystem,
    type GameSystem,
    type GameSystemsConfig,
    type SystemConfig,
} from "./interfaces/GameSystem";
export type {
    EnemySpawn,
    EnemyState,
    IEnemySpawner,
    IEnemySystem,
    IWaveManager,
    WaveState,
} from "./interfaces/EnemySystem";
export type {
    AbilityState,
    IPlayerController,
    IPlayerSystem,
    PlayerState,
    PlayerStats,
} from "./interfaces/PlayerSystem";
export type {
    CollisionResult,
    ICollisionHandler,
    IEffectProcessor,
    IProjectileSystem,
    ProjectileConfig,
    ProjectileState,
} from "./interfaces/ProjectileSystem";
export type {
    IUpgradeSystem,
    ISynergyProcessor,
    UpgradeState,
} from "./interfaces/UpgradeSystem";
export type {
    IVFXSystem,
    ParticleManager,
    ScreenEffects,
    ParticleEffectConfig,
    BackgroundEffect,
} from "./interfaces/VFXSystem";

// UpgradeSystem and SynergyProcessor don't have direct Phaser dependencies
export { UpgradeSystem } from "./UpgradeSystem";
export { SynergyProcessor } from "./SynergyProcessor";

// Note: The following modules have Phaser dependencies and should be imported
// directly from their respective files to avoid pulling Phaser into test environments:
// - CollisionHandler, EffectProcessor, WaveManager, EnemySpawner, PlayerController
// - HomingHandler, ProjectileBoundsHandler, PilotStateManager, PlayerSpawner
// - TextureFactory, EnemyAI, UpgradeEffects
