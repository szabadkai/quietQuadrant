import Phaser from "phaser";

// ============================================================================
// Type Definitions
// ============================================================================

export type PlayerStats = {
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
};

export type ChargeState = {
    ready: boolean;
    holdMs: number;
    damageBonus: number;
    sizeBonus: number;
    idleMs: number;
};

export type CapacitorConfig = {
    stacks: number;
    idleMs: number;
    damageBonus: number;
    sizeBonus: number;
    chargePierceBonus: number;
};

export type AfterimageConfig = {
    stacks: number;
    trailShots: number;
    shotDamage: number;
};

export type DashSparkConfig = {
    stacks: number;
    shards: number;
    damage: number;
};

export type ShieldConfig = {
    stacks: number;
    shieldHp: number;
    durationMs: number;
    cooldownMs: number;
    nextReadyAt: number;
};

export type ExplosiveConfig = {
    stacks: number;
    radius: number;
    damageMultiplier: number;
};

export type SplitConfig = {
    enabled: boolean;
    forks: number;
    spreadDegrees: number;
    damageMultiplier: number;
};

export type ChainArcConfig = {
    stacks: number;
    range: number;
    damagePercent: number;
    cooldownMs: number;
    lastAt: number;
};

export type KineticConfig = {
    stacks: number;
    healAmount: number;
    cooldownMs: number;
    nextReadyAt: number;
};

export type MomentumConfig = {
    stacks: number;
    ramp: number;
    timeToMaxMs: number;
    timerMs: number;
    bonus: number;
};

export type SpreadConfig = {
    stacks: number;
    spreadDegrees: number;
    critBonus: number;
};

export type HomingConfig = {
    stacks: number;
    range: number;
    turnRate: number;
};

export type MagnetConfig = {
    stacks: number;
    radiusMult: number;
    speedMult: number;
};

export type StabilizerConfig = {
    stacks: number;
    contactMultiplier: number;
};

export type PlatingConfig = {
    stacks: number;
    damageReduction: number;
};

export type ShrapnelConfig = {
    stacks: number;
    shards: number;
    damage: number;
};

export type NeutronCoreConfig = {
    active: boolean;
    speedMultiplier: number;
};

export type SingularityConfig = {
    active: boolean;
    radius: number;
    pullStrength: number;
};

export type BulletHellConfig = {
    active: boolean;
    fireRateMultiplier: number;
    damageMultiplier: number;
    inaccuracyRad: number;
};

export type BloodFuelConfig = {
    stacks: number;
    healPercent: number;
    fireCostPercent: number;
};

export type ChainReactionConfig = {
    stacks: number;
    radius: number;
    damagePercent: number;
};

export type QuantumConfig = {
    active: boolean;
    wrapMargin: number;
    projectileLifetimeMs: number;
};

export type BerserkConfig = {
    stacks: number;
    maxBonus: number;
};

export type UpgradeState = {
    [id: string]: number;
};

// ============================================================================
// Default Factory Functions
// ============================================================================

const PROJECTILE_MAX_LIFETIME_MS = 3800;

export const createDefaultPlayerStats = (): PlayerStats => ({
    moveSpeed: 240,
    damage: 12,
    fireRate: 4,
    projectileSpeed: 520,
    projectiles: 1,
    pierce: 0,
    bounce: 0,
    maxHealth: 5,
    health: 5,
    critChance: 0.05,
    critMultiplier: 2,
});

export const createDefaultChargeState = (): ChargeState => ({
    ready: false,
    holdMs: 0,
    damageBonus: 0.9,
    sizeBonus: 0.2,
    idleMs: 1000,
});

export const createDefaultCapacitorConfig = (): CapacitorConfig => ({
    stacks: 0,
    idleMs: 1000,
    damageBonus: 0.9,
    sizeBonus: 0.2,
    chargePierceBonus: 0,
});

export const createDefaultAfterimageConfig = (): AfterimageConfig => ({
    stacks: 0,
    trailShots: 0,
    shotDamage: 0,
});

export const createDefaultDashSparkConfig = (): DashSparkConfig => ({
    stacks: 0,
    shards: 0,
    damage: 0,
});

export const createDefaultShieldConfig = (): ShieldConfig => ({
    stacks: 0,
    shieldHp: 60,
    durationMs: 0,
    cooldownMs: 0,
    nextReadyAt: 0,
});

export const createDefaultExplosiveConfig = (): ExplosiveConfig => ({
    stacks: 0,
    radius: 0,
    damageMultiplier: 0,
});

export const createDefaultSplitConfig = (): SplitConfig => ({
    enabled: false,
    forks: 2,
    spreadDegrees: 12,
    damageMultiplier: 0.5,
});

export const createDefaultChainArcConfig = (): ChainArcConfig => ({
    stacks: 0,
    range: 180,
    damagePercent: 0.6,
    cooldownMs: 150,
    lastAt: 0,
});

export const createDefaultKineticConfig = (): KineticConfig => ({
    stacks: 0,
    healAmount: 0.3,
    cooldownMs: 1200,
    nextReadyAt: 0,
});

export const createDefaultMomentumConfig = (): MomentumConfig => ({
    stacks: 0,
    ramp: 0.25,
    timeToMaxMs: 2000,
    timerMs: 0,
    bonus: 0,
});

export const createDefaultSpreadConfig = (): SpreadConfig => ({
    stacks: 0,
    spreadDegrees: 6,
    critBonus: 0,
});

export const createDefaultHomingConfig = (): HomingConfig => ({
    stacks: 0,
    range: 0,
    turnRate: 0,
});

export const createDefaultMagnetConfig = (): MagnetConfig => ({
    stacks: 0,
    radiusMult: 1,
    speedMult: 1,
});

export const createDefaultStabilizerConfig = (): StabilizerConfig => ({
    stacks: 0,
    contactMultiplier: 1,
});

export const createDefaultPlatingConfig = (): PlatingConfig => ({
    stacks: 0,
    damageReduction: 0,
});

export const createDefaultShrapnelConfig = (): ShrapnelConfig => ({
    stacks: 0,
    shards: 0,
    damage: 0,
});

export const createDefaultNeutronCoreConfig = (): NeutronCoreConfig => ({
    active: false,
    speedMultiplier: 0.6,
});

export const createDefaultSingularityConfig = (): SingularityConfig => ({
    active: false,
    radius: 140,
    pullStrength: 520,
});

export const createDefaultBulletHellConfig = (): BulletHellConfig => ({
    active: false,
    fireRateMultiplier: 4,
    damageMultiplier: 0.6,
    inaccuracyRad: Phaser.Math.DegToRad(32),
});

export const createDefaultBloodFuelConfig = (): BloodFuelConfig => ({
    stacks: 0,
    healPercent: 0.12,
    fireCostPercent: 0.02,
});

export const createDefaultChainReactionConfig = (): ChainReactionConfig => ({
    stacks: 0,
    radius: 70,
    damagePercent: 0.5,
});

export const createDefaultQuantumConfig = (): QuantumConfig => ({
    active: false,
    wrapMargin: 18,
    projectileLifetimeMs: PROJECTILE_MAX_LIFETIME_MS,
});

export const createDefaultBerserkConfig = (): BerserkConfig => ({
    stacks: 0,
    maxBonus: 1,
});

// ============================================================================
// GameSettingsRepository Class
// ============================================================================

export class GameSettingsRepository {
    // Player stats
    private _playerStats: PlayerStats;

    // Upgrade configs
    private _chargeState: ChargeState;
    private _capacitorConfig: CapacitorConfig;
    private _afterimageConfig: AfterimageConfig;
    private _dashSparkConfig: DashSparkConfig;
    private _shieldConfig: ShieldConfig;
    private _explosiveConfig: ExplosiveConfig;
    private _splitConfig: SplitConfig;
    private _chainArcConfig: ChainArcConfig;
    private _kineticConfig: KineticConfig;
    private _momentumConfig: MomentumConfig;
    private _spreadConfig: SpreadConfig;
    private _homingConfig: HomingConfig;
    private _magnetConfig: MagnetConfig;
    private _stabilizerConfig: StabilizerConfig;
    private _platingConfig: PlatingConfig;
    private _shrapnelConfig: ShrapnelConfig;

    // Heavy hitter configs
    private _neutronCoreConfig: NeutronCoreConfig;
    private _glassCannonCap: number | null;
    private _singularityConfig: SingularityConfig;
    private _bulletHellConfig: BulletHellConfig;
    private _bloodFuelConfig: BloodFuelConfig;
    private _chainReactionConfig: ChainReactionConfig;
    private _quantumConfig: QuantumConfig;
    private _berserkConfig: BerserkConfig;

    // Misc settings
    private _projectileScale: number;
    private _upgradeStacks: UpgradeState;
    private _activeSynergies: Set<string>;

    constructor() {
        this._playerStats = createDefaultPlayerStats();
        this._chargeState = createDefaultChargeState();
        this._capacitorConfig = createDefaultCapacitorConfig();
        this._afterimageConfig = createDefaultAfterimageConfig();
        this._dashSparkConfig = createDefaultDashSparkConfig();
        this._shieldConfig = createDefaultShieldConfig();
        this._explosiveConfig = createDefaultExplosiveConfig();
        this._splitConfig = createDefaultSplitConfig();
        this._chainArcConfig = createDefaultChainArcConfig();
        this._kineticConfig = createDefaultKineticConfig();
        this._momentumConfig = createDefaultMomentumConfig();
        this._spreadConfig = createDefaultSpreadConfig();
        this._homingConfig = createDefaultHomingConfig();
        this._magnetConfig = createDefaultMagnetConfig();
        this._stabilizerConfig = createDefaultStabilizerConfig();
        this._platingConfig = createDefaultPlatingConfig();
        this._shrapnelConfig = createDefaultShrapnelConfig();
        this._neutronCoreConfig = createDefaultNeutronCoreConfig();
        this._glassCannonCap = null;
        this._singularityConfig = createDefaultSingularityConfig();
        this._bulletHellConfig = createDefaultBulletHellConfig();
        this._bloodFuelConfig = createDefaultBloodFuelConfig();
        this._chainReactionConfig = createDefaultChainReactionConfig();
        this._quantumConfig = createDefaultQuantumConfig();
        this._berserkConfig = createDefaultBerserkConfig();
        this._projectileScale = 1;
        this._upgradeStacks = {};
        this._activeSynergies = new Set<string>();
    }

    // ========================================================================
    // Getters
    // ========================================================================

    get playerStats(): PlayerStats {
        return this._playerStats;
    }

    get chargeState(): ChargeState {
        return this._chargeState;
    }

    get capacitorConfig(): CapacitorConfig {
        return this._capacitorConfig;
    }

    get afterimageConfig(): AfterimageConfig {
        return this._afterimageConfig;
    }

    get dashSparkConfig(): DashSparkConfig {
        return this._dashSparkConfig;
    }

    get shieldConfig(): ShieldConfig {
        return this._shieldConfig;
    }

    get explosiveConfig(): ExplosiveConfig {
        return this._explosiveConfig;
    }

    get splitConfig(): SplitConfig {
        return this._splitConfig;
    }

    get chainArcConfig(): ChainArcConfig {
        return this._chainArcConfig;
    }

    get kineticConfig(): KineticConfig {
        return this._kineticConfig;
    }

    get momentumConfig(): MomentumConfig {
        return this._momentumConfig;
    }

    get spreadConfig(): SpreadConfig {
        return this._spreadConfig;
    }

    get homingConfig(): HomingConfig {
        return this._homingConfig;
    }

    get magnetConfig(): MagnetConfig {
        return this._magnetConfig;
    }

    get stabilizerConfig(): StabilizerConfig {
        return this._stabilizerConfig;
    }

    get platingConfig(): PlatingConfig {
        return this._platingConfig;
    }

    get shrapnelConfig(): ShrapnelConfig {
        return this._shrapnelConfig;
    }

    get neutronCoreConfig(): NeutronCoreConfig {
        return this._neutronCoreConfig;
    }

    get glassCannonCap(): number | null {
        return this._glassCannonCap;
    }

    get singularityConfig(): SingularityConfig {
        return this._singularityConfig;
    }

    get bulletHellConfig(): BulletHellConfig {
        return this._bulletHellConfig;
    }

    get bloodFuelConfig(): BloodFuelConfig {
        return this._bloodFuelConfig;
    }

    get chainReactionConfig(): ChainReactionConfig {
        return this._chainReactionConfig;
    }

    get quantumConfig(): QuantumConfig {
        return this._quantumConfig;
    }

    get berserkConfig(): BerserkConfig {
        return this._berserkConfig;
    }

    get projectileScale(): number {
        return this._projectileScale;
    }

    get upgradeStacks(): UpgradeState {
        return this._upgradeStacks;
    }

    get activeSynergies(): Set<string> {
        return this._activeSynergies;
    }

    // ========================================================================
    // Setters
    // ========================================================================

    set playerStats(value: PlayerStats) {
        this._playerStats = value;
    }

    set chargeState(value: ChargeState) {
        this._chargeState = value;
    }

    set capacitorConfig(value: CapacitorConfig) {
        this._capacitorConfig = value;
    }

    set afterimageConfig(value: AfterimageConfig) {
        this._afterimageConfig = value;
    }

    set dashSparkConfig(value: DashSparkConfig) {
        this._dashSparkConfig = value;
    }

    set shieldConfig(value: ShieldConfig) {
        this._shieldConfig = value;
    }

    set explosiveConfig(value: ExplosiveConfig) {
        this._explosiveConfig = value;
    }

    set splitConfig(value: SplitConfig) {
        this._splitConfig = value;
    }

    set chainArcConfig(value: ChainArcConfig) {
        this._chainArcConfig = value;
    }

    set kineticConfig(value: KineticConfig) {
        this._kineticConfig = value;
    }

    set momentumConfig(value: MomentumConfig) {
        this._momentumConfig = value;
    }

    set spreadConfig(value: SpreadConfig) {
        this._spreadConfig = value;
    }

    set homingConfig(value: HomingConfig) {
        this._homingConfig = value;
    }

    set magnetConfig(value: MagnetConfig) {
        this._magnetConfig = value;
    }

    set stabilizerConfig(value: StabilizerConfig) {
        this._stabilizerConfig = value;
    }

    set platingConfig(value: PlatingConfig) {
        this._platingConfig = value;
    }

    set shrapnelConfig(value: ShrapnelConfig) {
        this._shrapnelConfig = value;
    }

    set neutronCoreConfig(value: NeutronCoreConfig) {
        this._neutronCoreConfig = value;
    }

    set glassCannonCap(value: number | null) {
        this._glassCannonCap = value;
    }

    set singularityConfig(value: SingularityConfig) {
        this._singularityConfig = value;
    }

    set bulletHellConfig(value: BulletHellConfig) {
        this._bulletHellConfig = value;
    }

    set bloodFuelConfig(value: BloodFuelConfig) {
        this._bloodFuelConfig = value;
    }

    set chainReactionConfig(value: ChainReactionConfig) {
        this._chainReactionConfig = value;
    }

    set quantumConfig(value: QuantumConfig) {
        this._quantumConfig = value;
    }

    set berserkConfig(value: BerserkConfig) {
        this._berserkConfig = value;
    }

    set projectileScale(value: number) {
        this._projectileScale = value;
    }

    set upgradeStacks(value: UpgradeState) {
        this._upgradeStacks = value;
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    getUpgradeStackCount(upgradeId: string): number {
        return this._upgradeStacks[upgradeId] ?? 0;
    }

    setUpgradeStackCount(upgradeId: string, count: number): void {
        this._upgradeStacks[upgradeId] = count;
    }

    incrementUpgradeStack(upgradeId: string): number {
        const current = this.getUpgradeStackCount(upgradeId);
        this._upgradeStacks[upgradeId] = current + 1;
        return current + 1;
    }

    hasSynergy(synergyId: string): boolean {
        return this._activeSynergies.has(synergyId);
    }

    addSynergy(synergyId: string): void {
        this._activeSynergies.add(synergyId);
    }

    clearSynergies(): void {
        this._activeSynergies.clear();
    }

    /**
     * Resets all settings to their default values
     */
    reset(): void {
        this._playerStats = createDefaultPlayerStats();
        this._chargeState = createDefaultChargeState();
        this._capacitorConfig = createDefaultCapacitorConfig();
        this._afterimageConfig = createDefaultAfterimageConfig();
        this._dashSparkConfig = createDefaultDashSparkConfig();
        this._shieldConfig = createDefaultShieldConfig();
        this._explosiveConfig = createDefaultExplosiveConfig();
        this._splitConfig = createDefaultSplitConfig();
        this._chainArcConfig = createDefaultChainArcConfig();
        this._kineticConfig = createDefaultKineticConfig();
        this._momentumConfig = createDefaultMomentumConfig();
        this._spreadConfig = createDefaultSpreadConfig();
        this._homingConfig = createDefaultHomingConfig();
        this._magnetConfig = createDefaultMagnetConfig();
        this._stabilizerConfig = createDefaultStabilizerConfig();
        this._platingConfig = createDefaultPlatingConfig();
        this._shrapnelConfig = createDefaultShrapnelConfig();
        this._neutronCoreConfig = createDefaultNeutronCoreConfig();
        this._glassCannonCap = null;
        this._singularityConfig = createDefaultSingularityConfig();
        this._bulletHellConfig = createDefaultBulletHellConfig();
        this._bloodFuelConfig = createDefaultBloodFuelConfig();
        this._chainReactionConfig = createDefaultChainReactionConfig();
        this._quantumConfig = createDefaultQuantumConfig();
        this._berserkConfig = createDefaultBerserkConfig();
        this._projectileScale = 1;
        this._upgradeStacks = {};
        this._activeSynergies.clear();
    }

    /**
     * Creates a snapshot of current settings for serialization
     */
    snapshot(): GameSettingsSnapshot {
        return {
            playerStats: { ...this._playerStats },
            chargeState: { ...this._chargeState },
            capacitorConfig: { ...this._capacitorConfig },
            afterimageConfig: { ...this._afterimageConfig },
            dashSparkConfig: { ...this._dashSparkConfig },
            shieldConfig: { ...this._shieldConfig },
            explosiveConfig: { ...this._explosiveConfig },
            splitConfig: { ...this._splitConfig },
            chainArcConfig: { ...this._chainArcConfig },
            kineticConfig: { ...this._kineticConfig },
            momentumConfig: { ...this._momentumConfig },
            spreadConfig: { ...this._spreadConfig },
            homingConfig: { ...this._homingConfig },
            magnetConfig: { ...this._magnetConfig },
            stabilizerConfig: { ...this._stabilizerConfig },
            platingConfig: { ...this._platingConfig },
            shrapnelConfig: { ...this._shrapnelConfig },
            neutronCoreConfig: { ...this._neutronCoreConfig },
            glassCannonCap: this._glassCannonCap,
            singularityConfig: { ...this._singularityConfig },
            bulletHellConfig: { ...this._bulletHellConfig },
            bloodFuelConfig: { ...this._bloodFuelConfig },
            chainReactionConfig: { ...this._chainReactionConfig },
            quantumConfig: { ...this._quantumConfig },
            berserkConfig: { ...this._berserkConfig },
            projectileScale: this._projectileScale,
            upgradeStacks: { ...this._upgradeStacks },
            activeSynergies: Array.from(this._activeSynergies),
        };
    }

    /**
     * Restores settings from a snapshot
     */
    restore(snapshot: GameSettingsSnapshot): void {
        this._playerStats = { ...snapshot.playerStats };
        this._chargeState = { ...snapshot.chargeState };
        this._capacitorConfig = { ...snapshot.capacitorConfig };
        this._afterimageConfig = { ...snapshot.afterimageConfig };
        this._dashSparkConfig = { ...snapshot.dashSparkConfig };
        this._shieldConfig = { ...snapshot.shieldConfig };
        this._explosiveConfig = { ...snapshot.explosiveConfig };
        this._splitConfig = { ...snapshot.splitConfig };
        this._chainArcConfig = { ...snapshot.chainArcConfig };
        this._kineticConfig = { ...snapshot.kineticConfig };
        this._momentumConfig = { ...snapshot.momentumConfig };
        this._spreadConfig = { ...snapshot.spreadConfig };
        this._homingConfig = { ...snapshot.homingConfig };
        this._magnetConfig = { ...snapshot.magnetConfig };
        this._stabilizerConfig = { ...snapshot.stabilizerConfig };
        this._platingConfig = { ...snapshot.platingConfig };
        this._shrapnelConfig = { ...snapshot.shrapnelConfig };
        this._neutronCoreConfig = { ...snapshot.neutronCoreConfig };
        this._glassCannonCap = snapshot.glassCannonCap;
        this._singularityConfig = { ...snapshot.singularityConfig };
        this._bulletHellConfig = { ...snapshot.bulletHellConfig };
        this._bloodFuelConfig = { ...snapshot.bloodFuelConfig };
        this._chainReactionConfig = { ...snapshot.chainReactionConfig };
        this._quantumConfig = { ...snapshot.quantumConfig };
        this._berserkConfig = { ...snapshot.berserkConfig };
        this._projectileScale = snapshot.projectileScale;
        this._upgradeStacks = { ...snapshot.upgradeStacks };
        this._activeSynergies = new Set(snapshot.activeSynergies);
    }
}

// ============================================================================
// Snapshot Type for Serialization
// ============================================================================

export interface GameSettingsSnapshot {
    playerStats: PlayerStats;
    chargeState: ChargeState;
    capacitorConfig: CapacitorConfig;
    afterimageConfig: AfterimageConfig;
    dashSparkConfig: DashSparkConfig;
    shieldConfig: ShieldConfig;
    explosiveConfig: ExplosiveConfig;
    splitConfig: SplitConfig;
    chainArcConfig: ChainArcConfig;
    kineticConfig: KineticConfig;
    momentumConfig: MomentumConfig;
    spreadConfig: SpreadConfig;
    homingConfig: HomingConfig;
    magnetConfig: MagnetConfig;
    stabilizerConfig: StabilizerConfig;
    platingConfig: PlatingConfig;
    shrapnelConfig: ShrapnelConfig;
    neutronCoreConfig: NeutronCoreConfig;
    glassCannonCap: number | null;
    singularityConfig: SingularityConfig;
    bulletHellConfig: BulletHellConfig;
    bloodFuelConfig: BloodFuelConfig;
    chainReactionConfig: ChainReactionConfig;
    quantumConfig: QuantumConfig;
    berserkConfig: BerserkConfig;
    projectileScale: number;
    upgradeStacks: UpgradeState;
    activeSynergies: string[];
}
