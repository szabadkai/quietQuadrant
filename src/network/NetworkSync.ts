/**
 * NetworkSync - Delta encoding and state synchronization for multiplayer
 *
 * This module handles efficient network synchronization using:
 * - Delta encoding: Only transmit changes, not full state
 * - Adaptive tick rate: Reduce frequency when many entities exist
 * - Sequence numbers: Handle out-of-order packets
 * - Periodic full syncs: Recovery mechanism for lost packets
 */

import type { GameStateSync } from "../state/useMultiplayerStore";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Thresholds for detecting "significant" changes worth transmitting
export const POSITION_THRESHOLD = 2; // pixels - ignore micro-movements
export const VELOCITY_THRESHOLD = 5; // pixels/sec
export const ROTATION_THRESHOLD = 0.05; // radians

// Adaptive tick rate based on entity count
export const BASE_TICK_INTERVAL = 33; // ~30fps baseline
export const MAX_TICK_INTERVAL = 100; // ~10fps when heavily loaded
export const ENTITY_TICK_SCALE = 2; // ms added per entity over threshold
export const ENTITY_THRESHOLD = 20; // start scaling after this many entities

// Full sync interval for recovery
export const FULL_SYNC_INTERVAL = 3000; // Force full sync every 3 seconds

// ============================================================================
// TYPES
// ============================================================================

/** Snapshot of an entity's state for change detection */
export interface EntitySnapshot {
    x: number;
    y: number;
    vx?: number;
    vy?: number;
    rotation?: number;
    health?: number;
    active: boolean;
    lastSent: number;
}

/** Host-side state tracker for generating deltas */
export interface DeltaTracker {
    seq: number;
    lastFullSync: number;
    fullSyncInterval: number;
    previousState: GameStateSync | null;
    entitySnapshots: Map<string, EntitySnapshot>;
}

/** Guest-side buffer for reconstructing state from deltas */
export interface GuestStateBuffer {
    lastSeq: number;
    reconstructedState: GameStateSync | null;
    pendingDeltas: GameStateDelta[];
    lastFullState: GameStateSync | null;
}

/** Delta packet - contains only changes since last sync */
export interface GameStateDelta {
    seq: number;
    baseSeq: number;
    timestamp: number;
    isFull: boolean;

    // Player deltas (always included - small payload)
    players: {
        p1?: Partial<GameStateSync["players"]["p1"]>;
        p2?: Partial<GameStateSync["players"]["p2"]>;
    };

    // Entity deltas - only changed entities
    enemyUpdates?: Array<{
        id: number;
        x?: number;
        y?: number;
        health?: number;
        kind?: string;
        active?: boolean;
    }>;
    enemyRemovals?: number[];

    bulletUpdates?: Array<{
        id: number;
        x: number;
        y: number;
        vx: number;
        vy: number;
    }>;
    bulletRemovals?: number[];

    playerBulletUpdates?: Array<{
        id: number;
        x: number;
        y: number;
        vx: number;
        vy: number;
        rotation: number;
    }>;
    playerBulletRemovals?: number[];

    // Metadata (only when changed)
    wave?: number;
    score?: number;
    intermissionActive?: boolean;
    countdown?: number | null;
    pendingWave?: number | null;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/** Create a new delta tracker for the host */
export function createDeltaTracker(): DeltaTracker {
    return {
        seq: 0,
        lastFullSync: 0,
        fullSyncInterval: FULL_SYNC_INTERVAL,
        previousState: null,
        entitySnapshots: new Map(),
    };
}

/** Create a new state buffer for the guest */
export function createGuestStateBuffer(): GuestStateBuffer {
    return {
        lastSeq: -1,
        reconstructedState: null,
        pendingDeltas: [],
        lastFullState: null,
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Calculate adaptive tick interval based on entity count */
export function getAdaptiveTick(entityCount: number): number {
    if (entityCount <= ENTITY_THRESHOLD) return BASE_TICK_INTERVAL;
    const extra = (entityCount - ENTITY_THRESHOLD) * ENTITY_TICK_SCALE;
    return Math.min(BASE_TICK_INTERVAL + extra, MAX_TICK_INTERVAL);
}

/** Check if position changed significantly */
function positionChanged(
    oldX: number,
    oldY: number,
    newX: number,
    newY: number
): boolean {
    const dx = Math.abs(newX - oldX);
    const dy = Math.abs(newY - oldY);
    return dx > POSITION_THRESHOLD || dy > POSITION_THRESHOLD;
}

/** Check if velocity changed significantly */
function velocityChanged(
    oldVx: number,
    oldVy: number,
    newVx: number,
    newVy: number
): boolean {
    return (
        Math.abs(newVx - oldVx) > VELOCITY_THRESHOLD ||
        Math.abs(newVy - oldVy) > VELOCITY_THRESHOLD
    );
}

// ============================================================================
// DELTA GENERATION (Host-side)
// ============================================================================

/** Generate a delta from current state vs previous state */
export function generateDelta(
    tracker: DeltaTracker,
    currentState: GameStateSync,
    forceFullSync: boolean = false
): GameStateDelta {
    const now = currentState.timestamp;
    tracker.seq++;

    // Force full sync periodically or on first send
    const needsFullSync =
        forceFullSync ||
        !tracker.previousState ||
        now - tracker.lastFullSync > tracker.fullSyncInterval;

    if (needsFullSync) {
        return generateFullSync(tracker, currentState, now);
    }

    return generateDeltaOnly(tracker, currentState, now);
}

/** Generate a full state sync packet */
function generateFullSync(
    tracker: DeltaTracker,
    currentState: GameStateSync,
    now: number
): GameStateDelta {
    tracker.lastFullSync = now;
    tracker.previousState = structuredClone(currentState);

    // Update entity snapshots
    tracker.entitySnapshots.clear();
    currentState.enemies.forEach((e) => {
        tracker.entitySnapshots.set(`enemy-${e.id}`, {
            x: e.x,
            y: e.y,
            health: e.health,
            active: e.active,
            lastSent: now,
        });
    });
    currentState.bullets.forEach((b) => {
        tracker.entitySnapshots.set(`bullet-${b.id}`, {
            x: b.x,
            y: b.y,
            vx: b.vx,
            vy: b.vy,
            active: true,
            lastSent: now,
        });
    });
    currentState.playerBullets.forEach((b) => {
        tracker.entitySnapshots.set(`pbullet-${b.id}`, {
            x: b.x,
            y: b.y,
            vx: b.vx,
            vy: b.vy,
            rotation: b.rotation,
            active: true,
            lastSent: now,
        });
    });

    return {
        seq: tracker.seq,
        baseSeq: tracker.seq - 1,
        timestamp: now,
        isFull: true,
        players: currentState.players,
        enemyUpdates: currentState.enemies,
        bulletUpdates: currentState.bullets,
        playerBulletUpdates: currentState.playerBullets,
        wave: currentState.wave,
        score: currentState.score,
        intermissionActive: currentState.intermissionActive,
        countdown: currentState.countdown,
        pendingWave: currentState.pendingWave,
    };
}

/** Generate a delta-only packet (changes since last sync) */
function generateDeltaOnly(
    tracker: DeltaTracker,
    currentState: GameStateSync,
    now: number
): GameStateDelta {
    const prev = tracker.previousState!;
    const delta: GameStateDelta = {
        seq: tracker.seq,
        baseSeq: tracker.seq - 1,
        timestamp: now,
        isFull: false,
        players: {},
    };

    // Player deltas
    if (playerChanged(prev.players.p1, currentState.players.p1)) {
        delta.players.p1 = currentState.players.p1;
    }
    if (playerChanged(prev.players.p2, currentState.players.p2)) {
        delta.players.p2 = currentState.players.p2;
    }

    // Enemy deltas
    const enemyResult = computeEntityDeltas(
        prev.enemies,
        currentState.enemies,
        tracker,
        "enemy",
        now
    );
    if (enemyResult.updates && enemyResult.updates.length > 0)
        delta.enemyUpdates = enemyResult.updates;
    if (enemyResult.removals.length > 0)
        delta.enemyRemovals = enemyResult.removals;

    // Bullet deltas
    const bulletResult = computeBulletDeltas(
        prev.bullets,
        currentState.bullets,
        tracker,
        "bullet",
        now
    );
    if (bulletResult.updates && bulletResult.updates.length > 0)
        delta.bulletUpdates = bulletResult.updates;
    if (bulletResult.removals.length > 0)
        delta.bulletRemovals = bulletResult.removals;

    // Player bullet deltas
    const pBulletResult = computePlayerBulletDeltas(
        prev.playerBullets,
        currentState.playerBullets,
        tracker,
        "pbullet",
        now
    );
    if (pBulletResult.updates && pBulletResult.updates.length > 0)
        delta.playerBulletUpdates = pBulletResult.updates;
    if (pBulletResult.removals.length > 0)
        delta.playerBulletRemovals = pBulletResult.removals;

    // Metadata deltas
    if (prev.wave !== currentState.wave) delta.wave = currentState.wave;
    if (prev.score !== currentState.score) delta.score = currentState.score;
    if (prev.intermissionActive !== currentState.intermissionActive) {
        delta.intermissionActive = currentState.intermissionActive;
    }
    if (prev.countdown !== currentState.countdown)
        delta.countdown = currentState.countdown;
    if (prev.pendingWave !== currentState.pendingWave)
        delta.pendingWave = currentState.pendingWave;

    // Update previous state
    tracker.previousState = structuredClone(currentState);

    // Clean up old snapshots
    enemyResult.removals.forEach((id) =>
        tracker.entitySnapshots.delete(`enemy-${id}`)
    );
    bulletResult.removals.forEach((id) =>
        tracker.entitySnapshots.delete(`bullet-${id}`)
    );
    pBulletResult.removals.forEach((id) =>
        tracker.entitySnapshots.delete(`pbullet-${id}`)
    );

    return delta;
}

/** Check if player state changed significantly */
function playerChanged(
    prev: GameStateSync["players"]["p1"],
    curr: GameStateSync["players"]["p1"]
): boolean {
    return (
        positionChanged(prev.x, prev.y, curr.x, curr.y) ||
        Math.abs(prev.rotation - curr.rotation) > ROTATION_THRESHOLD ||
        prev.health !== curr.health ||
        prev.active !== curr.active
    );
}

/** Compute deltas for enemy entities */
function computeEntityDeltas(
    prevEntities: GameStateSync["enemies"],
    currEntities: GameStateSync["enemies"],
    tracker: DeltaTracker,
    prefix: string,
    now: number
): { updates: GameStateDelta["enemyUpdates"]; removals: number[] } {
    const updates: NonNullable<GameStateDelta["enemyUpdates"]> = [];
    const removals: number[] = [];

    const currentIds = new Set(currEntities.map((e) => e.id));
    const prevIds = new Set(prevEntities.map((e) => e.id));

    // Find removed entities
    prevIds.forEach((id) => {
        if (!currentIds.has(id)) removals.push(id);
    });

    // Find new/changed entities
    currEntities.forEach((entity) => {
        const key = `${prefix}-${entity.id}`;
        const snapshot = tracker.entitySnapshots.get(key);

        if (!snapshot || !prevIds.has(entity.id)) {
            // New entity - send full data
            updates.push(entity);
            tracker.entitySnapshots.set(key, {
                x: entity.x,
                y: entity.y,
                health: entity.health,
                active: entity.active,
                lastSent: now,
            });
        } else if (
            positionChanged(snapshot.x, snapshot.y, entity.x, entity.y) ||
            snapshot.health !== entity.health
        ) {
            // Changed entity - send delta
            const update: (typeof updates)[0] = { id: entity.id };
            if (positionChanged(snapshot.x, snapshot.y, entity.x, entity.y)) {
                update.x = entity.x;
                update.y = entity.y;
            }
            if (snapshot.health !== entity.health) {
                update.health = entity.health;
            }
            updates.push(update);
            tracker.entitySnapshots.set(key, {
                x: entity.x,
                y: entity.y,
                health: entity.health,
                active: entity.active,
                lastSent: now,
            });
        }
    });

    return { updates, removals };
}

/** Compute deltas for bullet entities */
function computeBulletDeltas(
    prevBullets: GameStateSync["bullets"],
    currBullets: GameStateSync["bullets"],
    tracker: DeltaTracker,
    prefix: string,
    now: number
): { updates: GameStateDelta["bulletUpdates"]; removals: number[] } {
    const updates: NonNullable<GameStateDelta["bulletUpdates"]> = [];
    const removals: number[] = [];

    const currentIds = new Set(currBullets.map((b) => b.id));
    const prevIds = new Set(prevBullets.map((b) => b.id));

    prevIds.forEach((id) => {
        if (!currentIds.has(id)) removals.push(id);
    });

    currBullets.forEach((bullet) => {
        const key = `${prefix}-${bullet.id}`;
        const snapshot = tracker.entitySnapshots.get(key);

        // For bullets, always send if new or velocity changed (they move fast)
        if (
            !snapshot ||
            !prevIds.has(bullet.id) ||
            velocityChanged(
                snapshot.vx ?? 0,
                snapshot.vy ?? 0,
                bullet.vx,
                bullet.vy
            )
        ) {
            updates.push(bullet);
            tracker.entitySnapshots.set(key, {
                x: bullet.x,
                y: bullet.y,
                vx: bullet.vx,
                vy: bullet.vy,
                active: true,
                lastSent: now,
            });
        }
    });

    return { updates, removals };
}

/** Compute deltas for player bullet entities */
function computePlayerBulletDeltas(
    prevBullets: GameStateSync["playerBullets"],
    currBullets: GameStateSync["playerBullets"],
    tracker: DeltaTracker,
    prefix: string,
    now: number
): { updates: GameStateDelta["playerBulletUpdates"]; removals: number[] } {
    const updates: NonNullable<GameStateDelta["playerBulletUpdates"]> = [];
    const removals: number[] = [];

    const currentIds = new Set(currBullets.map((b) => b.id));
    const prevIds = new Set(prevBullets.map((b) => b.id));

    prevIds.forEach((id) => {
        if (!currentIds.has(id)) removals.push(id);
    });

    currBullets.forEach((bullet) => {
        const key = `${prefix}-${bullet.id}`;
        const snapshot = tracker.entitySnapshots.get(key);

        if (
            !snapshot ||
            !prevIds.has(bullet.id) ||
            velocityChanged(
                snapshot.vx ?? 0,
                snapshot.vy ?? 0,
                bullet.vx,
                bullet.vy
            )
        ) {
            updates.push(bullet);
            tracker.entitySnapshots.set(key, {
                x: bullet.x,
                y: bullet.y,
                vx: bullet.vx,
                vy: bullet.vy,
                rotation: bullet.rotation,
                active: true,
                lastSent: now,
            });
        }
    });

    return { updates, removals };
}

// ============================================================================
// DELTA APPLICATION (Guest-side)
// ============================================================================

/** Apply a delta to reconstruct state on guest side */
export function applyDelta(
    buffer: GuestStateBuffer,
    delta: GameStateDelta
): GameStateSync | null {
    // Handle out-of-order packets
    if (delta.seq <= buffer.lastSeq && !delta.isFull) {
        return buffer.reconstructedState;
    }

    // Full sync - replace everything
    if (delta.isFull) {
        return applyFullSync(buffer, delta);
    }

    // Delta update - need base state
    if (!buffer.reconstructedState) {
        buffer.pendingDeltas.push(delta);
        return null;
    }

    // Check for gaps in sequence
    if (delta.seq > buffer.lastSeq + 1) {
        buffer.pendingDeltas.push(delta);
        buffer.pendingDeltas.sort((a, b) => a.seq - b.seq);
        return buffer.reconstructedState;
    }

    return applyDeltaToState(buffer, delta);
}

/** Apply a full sync packet */
function applyFullSync(
    buffer: GuestStateBuffer,
    delta: GameStateDelta
): GameStateSync {
    buffer.lastSeq = delta.seq;
    buffer.lastFullState = {
        players: {
            p1: delta.players.p1 as GameStateSync["players"]["p1"],
            p2: delta.players.p2 as GameStateSync["players"]["p2"],
        },
        enemies: (delta.enemyUpdates as GameStateSync["enemies"]) ?? [],
        bullets: (delta.bulletUpdates as GameStateSync["bullets"]) ?? [],
        playerBullets:
            (delta.playerBulletUpdates as GameStateSync["playerBullets"]) ?? [],
        wave: delta.wave ?? 0,
        score: delta.score ?? 0,
        timestamp: delta.timestamp,
        intermissionActive: delta.intermissionActive ?? false,
        countdown: delta.countdown ?? null,
        pendingWave: delta.pendingWave ?? null,
    };
    buffer.reconstructedState = buffer.lastFullState;
    buffer.pendingDeltas = [];
    return buffer.reconstructedState;
}

/** Apply a delta packet to existing state */
function applyDeltaToState(
    buffer: GuestStateBuffer,
    delta: GameStateDelta
): GameStateSync {
    buffer.lastSeq = delta.seq;
    const state = buffer.reconstructedState!;

    // Apply player updates
    if (delta.players.p1) {
        Object.assign(state.players.p1, delta.players.p1);
    }
    if (delta.players.p2) {
        Object.assign(state.players.p2, delta.players.p2);
    }

    // Apply enemy changes
    if (delta.enemyRemovals) {
        const removeSet = new Set(delta.enemyRemovals);
        state.enemies = state.enemies.filter((e) => !removeSet.has(e.id));
    }
    if (delta.enemyUpdates) {
        applyEntityUpdates(state.enemies, delta.enemyUpdates);
    }

    // Apply bullet changes
    if (delta.bulletRemovals) {
        const removeSet = new Set(delta.bulletRemovals);
        state.bullets = state.bullets.filter((b) => !removeSet.has(b.id));
    }
    if (delta.bulletUpdates) {
        delta.bulletUpdates.forEach((update) => {
            const existing = state.bullets.find((b) => b.id === update.id);
            if (existing) {
                Object.assign(existing, update);
            } else {
                state.bullets.push(update);
            }
        });
    }

    // Apply player bullet changes
    if (delta.playerBulletRemovals) {
        const removeSet = new Set(delta.playerBulletRemovals);
        state.playerBullets = state.playerBullets.filter(
            (b) => !removeSet.has(b.id)
        );
    }
    if (delta.playerBulletUpdates) {
        delta.playerBulletUpdates.forEach((update) => {
            const existing = state.playerBullets.find(
                (b) => b.id === update.id
            );
            if (existing) {
                Object.assign(existing, update);
            } else {
                state.playerBullets.push(update);
            }
        });
    }

    // Apply metadata
    if (delta.wave !== undefined) state.wave = delta.wave;
    if (delta.score !== undefined) state.score = delta.score;
    if (delta.intermissionActive !== undefined)
        state.intermissionActive = delta.intermissionActive;
    if (delta.countdown !== undefined) state.countdown = delta.countdown;
    if (delta.pendingWave !== undefined) state.pendingWave = delta.pendingWave;

    state.timestamp = delta.timestamp;

    // Try to apply any pending deltas
    while (buffer.pendingDeltas.length > 0) {
        const next = buffer.pendingDeltas[0];
        if (next.seq === buffer.lastSeq + 1) {
            buffer.pendingDeltas.shift();
            applyDeltaToState(buffer, next);
        } else {
            break;
        }
    }

    return state;
}

/** Apply entity updates to an array */
function applyEntityUpdates(
    entities: GameStateSync["enemies"],
    updates: NonNullable<GameStateDelta["enemyUpdates"]>
): void {
    updates.forEach((update) => {
        const existing = entities.find((e) => e.id === update.id);
        if (existing) {
            if (update.x !== undefined) existing.x = update.x;
            if (update.y !== undefined) existing.y = update.y;
            if (update.health !== undefined) existing.health = update.health;
            if (update.active !== undefined) existing.active = update.active;
        } else {
            // New entity
            entities.push({
                id: update.id,
                x: update.x ?? 0,
                y: update.y ?? 0,
                health: update.health ?? 100,
                kind: update.kind ?? "drifter",
                active: update.active ?? true,
            });
        }
    });
}
