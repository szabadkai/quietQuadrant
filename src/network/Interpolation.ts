/**
 * Interpolation - Client-side prediction and smooth interpolation for multiplayer
 *
 * This module provides:
 * - Jitter buffer: Smooths out network timing variations
 * - Entity interpolation: Smooth movement between network updates
 * - Bullet extrapolation: Predict bullet positions based on velocity
 * - Snapshot buffering: Store recent states for interpolation
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/** How far behind real-time to render (ms) - higher = smoother but more latency */
export const INTERPOLATION_DELAY = 100;

/** Maximum snapshots to keep in buffer */
export const MAX_SNAPSHOTS = 10;

/** How aggressively to interpolate (0-1, higher = snappier but jerkier) */
export const DEFAULT_LERP_FACTOR = 0.15;

/** Lerp factor for fast-moving objects like bullets */
export const FAST_LERP_FACTOR = 0.3;

/** Distance threshold to snap instead of interpolate (pixels) */
export const SNAP_THRESHOLD = 100;

/** Maximum extrapolation time (ms) - don't predict too far ahead */
export const MAX_EXTRAPOLATION_TIME = 200;

// ============================================================================
// TYPES
// ============================================================================

/** A timestamped position snapshot */
export interface PositionSnapshot {
    x: number;
    y: number;
    rotation?: number;
    timestamp: number;
}

/** A timestamped velocity snapshot for extrapolation */
export interface VelocitySnapshot extends PositionSnapshot {
    vx: number;
    vy: number;
}

/** Entity state with interpolation data */
export interface InterpolatedEntity {
    id: number;
    current: PositionSnapshot;
    target: PositionSnapshot;
    velocity?: { vx: number; vy: number };
    snapshots: PositionSnapshot[];
    lastUpdateTime: number;
}

/** Jitter buffer for smoothing network updates */
export interface JitterBuffer<T> {
    snapshots: Array<{ data: T; timestamp: number; receivedAt: number }>;
    maxSize: number;
    delay: number;
}

// ============================================================================
// JITTER BUFFER
// ============================================================================

/** Create a new jitter buffer */
export function createJitterBuffer<T>(
    maxSize: number = MAX_SNAPSHOTS,
    delay: number = INTERPOLATION_DELAY
): JitterBuffer<T> {
    return {
        snapshots: [],
        maxSize,
        delay,
    };
}

/** Add a snapshot to the jitter buffer */
export function addToJitterBuffer<T>(
    buffer: JitterBuffer<T>,
    data: T,
    timestamp: number
): void {
    const receivedAt = performance.now();

    // Insert in timestamp order
    const entry = { data, timestamp, receivedAt };
    let inserted = false;

    for (let i = 0; i < buffer.snapshots.length; i++) {
        if (timestamp < buffer.snapshots[i].timestamp) {
            buffer.snapshots.splice(i, 0, entry);
            inserted = true;
            break;
        }
    }

    if (!inserted) {
        buffer.snapshots.push(entry);
    }

    // Trim old snapshots
    while (buffer.snapshots.length > buffer.maxSize) {
        buffer.snapshots.shift();
    }
}

/** Get interpolated data from jitter buffer at a given render time */
export function getFromJitterBuffer<T>(
    buffer: JitterBuffer<T>,
    renderTime: number
): { before: T | null; after: T | null; t: number } {
    // Render time is delayed behind real time
    const targetTime = renderTime - buffer.delay;

    let before: { data: T; timestamp: number } | null = null;
    let after: { data: T; timestamp: number } | null = null;

    for (const snapshot of buffer.snapshots) {
        if (snapshot.timestamp <= targetTime) {
            before = snapshot;
        } else {
            after = snapshot;
            break;
        }
    }

    // Calculate interpolation factor
    let t = 0;
    if (before && after) {
        const range = after.timestamp - before.timestamp;
        if (range > 0) {
            t = (targetTime - before.timestamp) / range;
            t = Math.max(0, Math.min(1, t));
        }
    }

    return {
        before: before?.data ?? null,
        after: after?.data ?? null,
        t,
    };
}

// ============================================================================
// INTERPOLATION FUNCTIONS
// ============================================================================

/** Linear interpolation between two values */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** Interpolate between two positions */
export function lerpPosition(
    from: PositionSnapshot,
    to: PositionSnapshot,
    t: number
): PositionSnapshot {
    return {
        x: lerp(from.x, to.x, t),
        y: lerp(from.y, to.y, t),
        rotation:
            from.rotation !== undefined && to.rotation !== undefined
                ? lerpAngle(from.rotation, to.rotation, t)
                : to.rotation,
        timestamp: lerp(from.timestamp, to.timestamp, t),
    };
}

/** Interpolate angles correctly (handling wrap-around) */
export function lerpAngle(from: number, to: number, t: number): number {
    let diff = to - from;

    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    return from + diff * t;
}

/** Smooth interpolation using exponential decay (frame-rate independent) */
export function smoothLerp(
    current: number,
    target: number,
    factor: number,
    deltaTime: number
): number {
    // Convert factor to frame-rate independent smoothing
    const smoothing = 1 - Math.pow(1 - factor, deltaTime * 60);
    return lerp(current, target, smoothing);
}

/** Smooth position interpolation */
export function smoothLerpPosition(
    current: { x: number; y: number },
    target: { x: number; y: number },
    factor: number,
    deltaTime: number
): { x: number; y: number } {
    const smoothing = 1 - Math.pow(1 - factor, deltaTime * 60);
    return {
        x: lerp(current.x, target.x, smoothing),
        y: lerp(current.y, target.y, smoothing),
    };
}

// ============================================================================
// EXTRAPOLATION (PREDICTION)
// ============================================================================

/** Extrapolate position based on velocity */
export function extrapolatePosition(
    snapshot: VelocitySnapshot,
    currentTime: number,
    maxExtrapolationTime: number = MAX_EXTRAPOLATION_TIME
): PositionSnapshot {
    const elapsed = Math.min(
        currentTime - snapshot.timestamp,
        maxExtrapolationTime
    );
    const elapsedSec = elapsed / 1000;

    return {
        x: snapshot.x + snapshot.vx * elapsedSec,
        y: snapshot.y + snapshot.vy * elapsedSec,
        rotation: snapshot.rotation,
        timestamp: currentTime,
    };
}

/** Predict bullet position based on last known state */
export function predictBulletPosition(
    lastX: number,
    lastY: number,
    vx: number,
    vy: number,
    lastUpdateTime: number,
    currentTime: number,
    maxExtrapolationTime: number = MAX_EXTRAPOLATION_TIME
): { x: number; y: number } {
    const elapsed = Math.min(
        currentTime - lastUpdateTime,
        maxExtrapolationTime
    );
    const elapsedSec = elapsed / 1000;

    return {
        x: lastX + vx * elapsedSec,
        y: lastY + vy * elapsedSec,
    };
}

// ============================================================================
// ENTITY INTERPOLATION MANAGER
// ============================================================================

/** Manager for interpolating multiple entities */
export class EntityInterpolator {
    private entities: Map<string, InterpolatedEntity> = new Map();
    private lerpFactor: number;
    private snapThreshold: number;

    constructor(
        lerpFactor: number = DEFAULT_LERP_FACTOR,
        snapThreshold: number = SNAP_THRESHOLD
    ) {
        this.lerpFactor = lerpFactor;
        this.snapThreshold = snapThreshold;
    }

    /** Update target position for an entity */
    updateTarget(
        id: string,
        x: number,
        y: number,
        rotation?: number,
        velocity?: { vx: number; vy: number }
    ): void {
        const now = performance.now();
        const existing = this.entities.get(id);

        const newTarget: PositionSnapshot = { x, y, rotation, timestamp: now };

        if (existing) {
            // Add to snapshot history
            existing.snapshots.push(newTarget);
            if (existing.snapshots.length > MAX_SNAPSHOTS) {
                existing.snapshots.shift();
            }

            existing.target = newTarget;
            existing.velocity = velocity;
            existing.lastUpdateTime = now;
        } else {
            // New entity - snap to position
            this.entities.set(id, {
                id: parseInt(id) || 0,
                current: { ...newTarget },
                target: newTarget,
                velocity,
                snapshots: [newTarget],
                lastUpdateTime: now,
            });
        }
    }

    /** Get interpolated position for an entity */
    getPosition(id: string, deltaTime: number): PositionSnapshot | null {
        const entity = this.entities.get(id);
        if (!entity) return null;

        const now = performance.now();
        const timeSinceUpdate = now - entity.lastUpdateTime;

        // If we have velocity and it's been a while, extrapolate
        if (entity.velocity && timeSinceUpdate > 50) {
            const extrapolated = extrapolatePosition(
                {
                    ...entity.target,
                    vx: entity.velocity.vx,
                    vy: entity.velocity.vy,
                },
                now
            );

            // Blend extrapolation with interpolation
            entity.current = {
                x: smoothLerp(
                    entity.current.x,
                    extrapolated.x,
                    this.lerpFactor,
                    deltaTime
                ),
                y: smoothLerp(
                    entity.current.y,
                    extrapolated.y,
                    this.lerpFactor,
                    deltaTime
                ),
                rotation: entity.target.rotation,
                timestamp: now,
            };
        } else {
            // Check if we should snap or interpolate
            const dx = entity.target.x - entity.current.x;
            const dy = entity.target.y - entity.current.y;
            const distSq = dx * dx + dy * dy;

            if (distSq > this.snapThreshold * this.snapThreshold) {
                // Snap to target
                entity.current = { ...entity.target };
            } else {
                // Smooth interpolation
                entity.current = {
                    x: smoothLerp(
                        entity.current.x,
                        entity.target.x,
                        this.lerpFactor,
                        deltaTime
                    ),
                    y: smoothLerp(
                        entity.current.y,
                        entity.target.y,
                        this.lerpFactor,
                        deltaTime
                    ),
                    rotation:
                        entity.target.rotation !== undefined
                            ? lerpAngle(
                                  entity.current.rotation ?? 0,
                                  entity.target.rotation,
                                  this.lerpFactor
                              )
                            : entity.current.rotation,
                    timestamp: now,
                };
            }
        }

        return entity.current;
    }

    /** Remove an entity from tracking */
    remove(id: string): void {
        this.entities.delete(id);
    }

    /** Clear all entities */
    clear(): void {
        this.entities.clear();
    }

    /** Check if entity exists */
    has(id: string): boolean {
        return this.entities.has(id);
    }
}

// ============================================================================
// BULLET PREDICTOR
// ============================================================================

/** Specialized predictor for bullets (high-speed, predictable trajectory) */
export class BulletPredictor {
    private bullets: Map<number, VelocitySnapshot> = new Map();

    /** Update bullet state from network */
    update(id: number, x: number, y: number, vx: number, vy: number): void {
        this.bullets.set(id, {
            x,
            y,
            vx,
            vy,
            timestamp: performance.now(),
        });
    }

    /** Get predicted position for a bullet */
    getPosition(id: number): { x: number; y: number } | null {
        const bullet = this.bullets.get(id);
        if (!bullet) return null;

        return predictBulletPosition(
            bullet.x,
            bullet.y,
            bullet.vx,
            bullet.vy,
            bullet.timestamp,
            performance.now()
        );
    }

    /** Remove a bullet */
    remove(id: number): void {
        this.bullets.delete(id);
    }

    /** Clear all bullets */
    clear(): void {
        this.bullets.clear();
    }

    /** Get all bullet IDs */
    getIds(): number[] {
        return Array.from(this.bullets.keys());
    }
}

// ============================================================================
// NETWORK LATENCY ESTIMATOR
// ============================================================================

/** Estimates network latency for adaptive interpolation */
export class LatencyEstimator {
    private samples: number[] = [];
    private maxSamples: number;
    private _average: number = 50; // Default assumption
    private _jitter: number = 10;

    constructor(maxSamples: number = 20) {
        this.maxSamples = maxSamples;
    }

    /** Add a latency sample (round-trip time / 2) */
    addSample(latencyMs: number): void {
        this.samples.push(latencyMs);
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
        this.recalculate();
    }

    /** Estimate latency from timestamp difference */
    estimateFromTimestamp(
        serverTimestamp: number,
        localTimestamp: number
    ): void {
        // This is a rough estimate - assumes clocks are somewhat synchronized
        const diff = Math.abs(localTimestamp - serverTimestamp);
        if (diff < 1000) {
            // Sanity check
            this.addSample(diff);
        }
    }

    private recalculate(): void {
        if (this.samples.length === 0) return;

        // Calculate average
        const sum = this.samples.reduce((a, b) => a + b, 0);
        this._average = sum / this.samples.length;

        // Calculate jitter (standard deviation)
        const squaredDiffs = this.samples.map((s) =>
            Math.pow(s - this._average, 2)
        );
        const avgSquaredDiff =
            squaredDiffs.reduce((a, b) => a + b, 0) / this.samples.length;
        this._jitter = Math.sqrt(avgSquaredDiff);
    }

    /** Get estimated average latency */
    get average(): number {
        return this._average;
    }

    /** Get estimated jitter */
    get jitter(): number {
        return this._jitter;
    }

    /** Get recommended interpolation delay based on network conditions */
    get recommendedDelay(): number {
        // Delay should be at least average latency + 2x jitter for smooth playback
        return Math.max(50, this._average + this._jitter * 2);
    }
}
