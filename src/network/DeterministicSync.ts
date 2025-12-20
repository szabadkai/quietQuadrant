/**
 * DeterministicSync - Input-based networking for deterministic simulation
 *
 * Architecture:
 * - Host is authoritative for: enemies, enemy bullets, waves, pickups
 * - Each player is authoritative for: their ship, their bullets
 * - Sync inputs, not transforms
 * - Projectiles: fire-and-forget with deterministic simulation
 * - Corrections only when drift exceeds threshold
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Network tick rate (Hz) - how often we send input packets */
export const NET_TICK_RATE = 20; // 20Hz = 50ms intervals (plenty for inputs)

/** Simulation tick rate (Hz) - local game runs at this rate */
export const SIM_TICK_RATE = 60;

/** Maximum input buffer size */
export const INPUT_BUFFER_SIZE = 64;

/** Position error threshold before correction (pixels) */
export const CORRECTION_THRESHOLD = 50;

/** Snapshot rate for corrections (Hz) */
export const SNAPSHOT_RATE = 5; // 5Hz = 200ms intervals

// ============================================================================
// INPUT TYPES
// ============================================================================

/** Player input for a single tick */
export interface PlayerInput {
    tick: number;
    moveX: number; // -1 to 1
    moveY: number; // -1 to 1
    aimX: number; // normalized
    aimY: number; // normalized
    fire: boolean;
    dash: boolean;
}

/** Compressed input packet (sent over network) */
export interface InputPacket {
    t: number; // tick
    mx: number; // moveX * 127 (int8)
    my: number; // moveY * 127
    ax: number; // aimX * 127
    ay: number; // aimY * 127
    f: number; // flags: bit 0 = fire, bit 1 = dash
}

/** Projectile spawn event (fire-and-forget) */
export interface ProjectileSpawn {
    id: number; // unique ID
    tick: number; // spawn tick
    x: number; // spawn position
    y: number;
    vx: number; // velocity
    vy: number;
    ownerId: string; // "host" or "guest"
    seed: number; // for any RNG effects
}

/** Lightweight correction snapshot */
export interface CorrectionSnapshot {
    tick: number;
    entities: Array<{
        id: string;
        x: number;
        y: number;
        vx?: number;
        vy?: number;
    }>;
}

/** Game event (discrete, non-continuous) */
export interface GameEvent {
    tick: number;
    type: string;
    data: any;
}

// ============================================================================
// INPUT COMPRESSION
// ============================================================================

/** Compress input for network transmission */
export function compressInput(input: PlayerInput): InputPacket {
    return {
        t: input.tick,
        mx: Math.round(input.moveX * 127),
        my: Math.round(input.moveY * 127),
        ax: Math.round(input.aimX * 127),
        ay: Math.round(input.aimY * 127),
        f: (input.fire ? 1 : 0) | (input.dash ? 2 : 0),
    };
}

/** Decompress input from network */
export function decompressInput(packet: InputPacket): PlayerInput {
    return {
        tick: packet.t,
        moveX: packet.mx / 127,
        moveY: packet.my / 127,
        aimX: packet.ax / 127,
        aimY: packet.ay / 127,
        fire: (packet.f & 1) !== 0,
        dash: (packet.f & 2) !== 0,
    };
}

// ============================================================================
// INPUT BUFFER
// ============================================================================

/** Ring buffer for storing inputs */
export class InputBuffer {
    private buffer: (PlayerInput | null)[];
    private size: number;

    constructor(size: number = INPUT_BUFFER_SIZE) {
        this.size = size;
        this.buffer = new Array(size).fill(null);
    }

    /** Store input at tick */
    set(tick: number, input: PlayerInput): void {
        const index = tick % this.size;
        this.buffer[index] = input;
    }

    /** Get input at tick (or null if not available) */
    get(tick: number): PlayerInput | null {
        const index = tick % this.size;
        const input = this.buffer[index];
        if (input && input.tick === tick) {
            return input;
        }
        return null;
    }

    /** Get latest input before or at tick */
    getLatest(maxTick: number): PlayerInput | null {
        for (let t = maxTick; t > maxTick - this.size && t >= 0; t--) {
            const input = this.get(t);
            if (input) return input;
        }
        return null;
    }

    /** Clear all inputs */
    clear(): void {
        this.buffer.fill(null);
    }
}

// ============================================================================
// TICK CLOCK
// ============================================================================

/** Synchronized tick clock */
export class TickClock {
    private startTime: number = 0;
    private tickRate: number;
    private _offset: number = 0; // offset from peer's clock

    constructor(tickRate: number = SIM_TICK_RATE) {
        this.tickRate = tickRate;
    }

    /** Start the clock */
    start(): void {
        this.startTime = performance.now();
    }

    /** Get current tick based on elapsed time */
    get currentTick(): number {
        if (this.startTime === 0) return 0;
        const elapsed = performance.now() - this.startTime;
        return Math.floor(elapsed / (1000 / this.tickRate));
    }

    /** Set tick offset (for clock sync) */
    setOffset(offset: number): void {
        this._offset = offset;
    }

    /** Get offset */
    get offset(): number {
        return this._offset;
    }

    /** Convert local tick to remote tick */
    toRemoteTick(localTick: number): number {
        return localTick + this._offset;
    }

    /** Convert remote tick to local tick */
    toLocalTick(remoteTick: number): number {
        return remoteTick - this._offset;
    }

    /** Reset clock */
    reset(): void {
        this.startTime = 0;
        this._offset = 0;
    }
}

// ============================================================================
// DETERMINISTIC PROJECTILE MANAGER
// ============================================================================

/** Manages deterministic projectile simulation */
export class ProjectileManager {
    private projectiles: Map<number, ProjectileState> = new Map();
    private nextId: number = 0;
    private localOwnerId: string;

    constructor(localOwnerId: string) {
        this.localOwnerId = localOwnerId;
    }

    /** Spawn a projectile locally (we are authority) */
    spawnLocal(
        x: number,
        y: number,
        vx: number,
        vy: number,
        tick: number,
        seed: number
    ): ProjectileSpawn {
        const id = this.nextId++;
        const spawn: ProjectileSpawn = {
            id,
            tick,
            x,
            y,
            vx,
            vy,
            ownerId: this.localOwnerId,
            seed,
        };

        this.projectiles.set(id, {
            ...spawn,
            currentX: x,
            currentY: y,
            active: true,
        });

        return spawn;
    }

    /** Spawn a projectile from remote (they are authority) */
    spawnRemote(spawn: ProjectileSpawn, currentTick: number): void {
        // Simulate forward to current tick
        const ticksElapsed = currentTick - spawn.tick;
        const dt = ticksElapsed / SIM_TICK_RATE;

        this.projectiles.set(spawn.id, {
            ...spawn,
            currentX: spawn.x + spawn.vx * dt,
            currentY: spawn.y + spawn.vy * dt,
            active: true,
        });
    }

    /** Update all projectiles for one tick */
    update(dt: number): void {
        this.projectiles.forEach((proj) => {
            if (!proj.active) return;
            proj.currentX += proj.vx * dt;
            proj.currentY += proj.vy * dt;
        });
    }

    /** Get projectile state */
    get(id: number): ProjectileState | undefined {
        return this.projectiles.get(id);
    }

    /** Remove projectile */
    remove(id: number): void {
        const proj = this.projectiles.get(id);
        if (proj) {
            proj.active = false;
        }
        this.projectiles.delete(id);
    }

    /** Get all active projectiles */
    getAll(): ProjectileState[] {
        return Array.from(this.projectiles.values()).filter((p) => p.active);
    }

    /** Clear all projectiles */
    clear(): void {
        this.projectiles.clear();
        this.nextId = 0;
    }

    /** Check if we own this projectile */
    isOwned(id: number): boolean {
        const proj = this.projectiles.get(id);
        return proj?.ownerId === this.localOwnerId;
    }
}

interface ProjectileState extends ProjectileSpawn {
    currentX: number;
    currentY: number;
    active: boolean;
}

// ============================================================================
// NETWORK MESSAGE TYPES
// ============================================================================

/** All message types for the network layer */
export type NetMessage =
    | { type: "input"; data: InputPacket }
    | { type: "proj"; data: ProjectileSpawn }
    | { type: "event"; data: GameEvent }
    | { type: "snap"; data: CorrectionSnapshot }
    | { type: "ping"; t: number }
    | { type: "pong"; t: number; st: number };

// ============================================================================
// CLOCK SYNC
// ============================================================================

/** Simple clock synchronization */
export class ClockSync {
    private samples: number[] = [];
    private maxSamples: number = 10;
    private _rtt: number = 0;
    private _offset: number = 0;

    /** Process a pong response */
    processPong(sentTime: number, remoteTime: number): void {
        const now = performance.now();
        const rtt = now - sentTime;
        const oneWay = rtt / 2;
        const offset = remoteTime + oneWay - now;

        this.samples.push(offset);
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }

        // Use median for stability
        const sorted = [...this.samples].sort((a, b) => a - b);
        this._offset = sorted[Math.floor(sorted.length / 2)];
        this._rtt = rtt;
    }

    /** Get estimated clock offset */
    get offset(): number {
        return this._offset;
    }

    /** Get estimated round-trip time */
    get rtt(): number {
        return this._rtt;
    }

    /** Reset */
    reset(): void {
        this.samples = [];
        this._rtt = 0;
        this._offset = 0;
    }
}
