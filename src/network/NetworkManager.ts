/**
 * NetworkManager - Coordinates deterministic networking
 *
 * Responsibilities:
 * - Manages connection via Trystero
 * - Sends/receives inputs, projectile spawns, events
 * - Handles clock synchronization
 * - Provides correction snapshots when needed
 */

import {
    type PlayerInput,
    type InputPacket,
    type ProjectileSpawn,
    type GameEvent,
    type CorrectionSnapshot,
    InputBuffer,
    TickClock,
    ClockSync,
    compressInput,
    decompressInput,
    NET_TICK_RATE,
    SNAPSHOT_RATE,
} from "./DeterministicSync";

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionState =
    | "disconnected"
    | "connecting"
    | "connected"
    | "error";
export type NetworkRole = "host" | "guest";

export interface NetworkCallbacks {
    onRemoteInput?: (input: PlayerInput) => void;
    onProjectileSpawn?: (spawn: ProjectileSpawn) => void;
    onGameEvent?: (event: GameEvent) => void;
    onCorrection?: (snapshot: CorrectionSnapshot) => void;
    onPeerJoin?: (peerId: string) => void;
    onPeerLeave?: (peerId: string) => void;
    onGameStart?: () => void;
}

// ============================================================================
// NETWORK MANAGER
// ============================================================================

export class NetworkManager {
    // Connection state
    private room: any = null;
    private _state: ConnectionState = "disconnected";
    private _role: NetworkRole = "host";
    private _roomCode: string | null = null;
    private _peerId: string | null = null;
    private _connectedPeers: string[] = [];

    // Timing
    private clock: TickClock = new TickClock();
    private clockSync: ClockSync = new ClockSync();
    private lastInputSendTime: number = 0;
    private lastSnapshotTime: number = 0;
    private lastPingTime: number = 0;

    // Input buffering
    private localInputBuffer: InputBuffer = new InputBuffer();
    private remoteInputBuffer: InputBuffer = new InputBuffer();

    // Callbacks
    private callbacks: NetworkCallbacks = {};

    // Trystero actions (lazy initialized)
    private sendInput: ((data: InputPacket) => void) | null = null;
    private sendProj: ((data: ProjectileSpawn) => void) | null = null;
    private sendEvent: ((data: GameEvent) => void) | null = null;
    private sendSnap: ((data: CorrectionSnapshot) => void) | null = null;
    private sendPing: ((data: { t: number }) => void) | null = null;
    private sendPong: ((data: { t: number; st: number }) => void) | null = null;
    private sendStart: ((data: any) => void) | null = null;

    // ========================================================================
    // GETTERS
    // ========================================================================

    get state(): ConnectionState {
        return this._state;
    }
    get role(): NetworkRole {
        return this._role;
    }
    get roomCode(): string | null {
        return this._roomCode;
    }
    get peerId(): string | null {
        return this._peerId;
    }
    get connectedPeers(): string[] {
        return [...this._connectedPeers];
    }
    get isHost(): boolean {
        return this._role === "host";
    }
    get isConnected(): boolean {
        return this._state === "connected" && this._connectedPeers.length > 0;
    }
    get currentTick(): number {
        return this.clock.currentTick;
    }
    get rtt(): number {
        return this.clockSync.rtt;
    }

    // ========================================================================
    // CALLBACKS
    // ========================================================================

    setCallbacks(callbacks: NetworkCallbacks): void {
        this.callbacks = callbacks;
    }

    // ========================================================================
    // CONNECTION
    // ========================================================================

    async createRoom(): Promise<string> {
        const roomCode = Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();

        try {
            this._state = "connecting";
            this._role = "host";
            this._roomCode = roomCode;

            const trystero = await import("trystero/mqtt");
            const rtcConfig = this.getRtcConfig();

            this.room = trystero.joinRoom(
                { appId: "quiet-quadrant", rtcConfig },
                roomCode
            );
            this._peerId = trystero.selfId;

            this.setupActions();
            this.setupPeerHandlers();

            this._state = "connected";
            this.clock.start();

            return roomCode;
        } catch (error) {
            console.error("Failed to create room:", error);
            this._state = "error";
            throw error;
        }
    }

    async joinRoom(roomCode: string): Promise<void> {
        try {
            this._state = "connecting";
            this._role = "guest";
            this._roomCode = roomCode;

            const trystero = await import("trystero/mqtt");
            const rtcConfig = this.getRtcConfig();

            this.room = trystero.joinRoom(
                { appId: "quiet-quadrant", rtcConfig },
                roomCode
            );
            this._peerId = trystero.selfId;

            this.setupActions();
            this.setupPeerHandlers();

            this._state = "connected";
            this.clock.start();
        } catch (error) {
            console.error("Failed to join room:", error);
            this._state = "error";
            throw error;
        }
    }

    disconnect(): void {
        if (this.room) {
            this.room.leave();
        }
        this.room = null;
        this._state = "disconnected";
        this._role = "host";
        this._roomCode = null;
        this._peerId = null;
        this._connectedPeers = [];
        this.clock.reset();
        this.clockSync.reset();
        this.localInputBuffer.clear();
        this.remoteInputBuffer.clear();
        this.sendInput = null;
        this.sendProj = null;
        this.sendEvent = null;
        this.sendSnap = null;
        this.sendPing = null;
        this.sendPong = null;
        this.sendStart = null;
    }

    private getRtcConfig(): RTCConfiguration {
        const turnUrl = import.meta.env.VITE_TURN_URL || "";
        const turnUser = import.meta.env.VITE_TURN_USERNAME || "";
        const turnPass = import.meta.env.VITE_TURN_PASSWORD || "";

        return {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                ...(turnUrl
                    ? [
                          {
                              urls: [
                                  `turn:${turnUrl}`,
                                  `turn:${turnUrl}?transport=tcp`,
                              ],
                              username: turnUser,
                              credential: turnPass,
                          },
                      ]
                    : [
                          {
                              urls: [
                                  "turn:openrelay.metered.ca:443",
                                  "turn:openrelay.metered.ca:443?transport=tcp",
                              ],
                              username: "openrelayproject",
                              credential: "openrelayproject",
                          },
                      ]),
            ],
            iceCandidatePoolSize: 4,
        };
    }

    private setupActions(): void {
        if (!this.room) return;

        // Input sync (most frequent) - "i" for minimal overhead
        const [sendI, getI] = this.room.makeAction("i");
        this.sendInput = sendI;
        getI((data: InputPacket) => {
            const input = decompressInput(data);
            this.remoteInputBuffer.set(input.tick, input);
            this.callbacks.onRemoteInput?.(input);
        });

        // Projectile spawn - "p"
        const [sendP, getP] = this.room.makeAction("p");
        this.sendProj = sendP;
        getP((data: ProjectileSpawn) => {
            this.callbacks.onProjectileSpawn?.(data);
        });

        // Game events - "e"
        const [sendE, getE] = this.room.makeAction("e");
        this.sendEvent = sendE;
        getE((data: GameEvent) => {
            this.callbacks.onGameEvent?.(data);
        });

        // Correction snapshots - "s"
        const [sendS, getS] = this.room.makeAction("s");
        this.sendSnap = sendS;
        getS((data: CorrectionSnapshot) => {
            this.callbacks.onCorrection?.(data);
        });

        // Clock sync ping - "pi"
        const [sendPi, getPi] = this.room.makeAction("pi");
        this.sendPing = sendPi;
        getPi((data: { t: number }) => {
            // Respond with pong
            this.sendPong?.({ t: data.t, st: performance.now() });
        });

        // Clock sync pong - "po"
        const [sendPo, getPo] = this.room.makeAction("po");
        this.sendPong = sendPo;
        getPo((data: { t: number; st: number }) => {
            this.clockSync.processPong(data.t, data.st);
        });

        // Game start signal - "go"
        const [sendGo, getGo] = this.room.makeAction("go");
        this.sendStart = sendGo;
        getGo(() => {
            this.callbacks.onGameStart?.();
        });
    }

    private setupPeerHandlers(): void {
        if (!this.room) return;

        this.room.onPeerJoin((peerId: string) => {
            this._connectedPeers.push(peerId);
            this.callbacks.onPeerJoin?.(peerId);

            // Start clock sync
            this.sendClockPing();
        });

        this.room.onPeerLeave((peerId: string) => {
            this._connectedPeers = this._connectedPeers.filter(
                (id) => id !== peerId
            );
            this.callbacks.onPeerLeave?.(peerId);
        });
    }

    // ========================================================================
    // SENDING
    // ========================================================================

    /** Send local input (called every network tick) */
    sendLocalInput(input: PlayerInput): void {
        if (!this.isConnected || !this.sendInput) return;

        this.localInputBuffer.set(input.tick, input);
        this.sendInput(compressInput(input));
    }

    /** Send projectile spawn event */
    sendProjectileSpawn(spawn: ProjectileSpawn): void {
        if (!this.isConnected || !this.sendProj) return;
        this.sendProj(spawn);
    }

    /** Send game event */
    sendGameEvent(event: GameEvent): void {
        if (!this.isConnected || !this.sendEvent) return;
        this.sendEvent(event);
    }

    /** Send correction snapshot (host only, periodic) */
    sendCorrectionSnapshot(snapshot: CorrectionSnapshot): void {
        if (!this.isConnected || !this.sendSnap || !this.isHost) return;
        this.sendSnap(snapshot);
    }

    /** Signal game start (host only) */
    signalGameStart(): void {
        if (!this.isConnected || !this.sendStart || !this.isHost) return;
        this.sendStart({});
    }

    /** Send clock sync ping */
    sendClockPing(): void {
        if (!this.isConnected || !this.sendPing) return;
        this.sendPing({ t: performance.now() });
    }

    // ========================================================================
    // INPUT ACCESS
    // ========================================================================

    /** Get remote input for a tick */
    getRemoteInput(tick: number): PlayerInput | null {
        return this.remoteInputBuffer.get(tick);
    }

    /** Get latest remote input */
    getLatestRemoteInput(): PlayerInput | null {
        return this.remoteInputBuffer.getLatest(this.currentTick);
    }

    /** Get local input for a tick */
    getLocalInput(tick: number): PlayerInput | null {
        return this.localInputBuffer.get(tick);
    }

    // ========================================================================
    // TICK MANAGEMENT
    // ========================================================================

    /** Called every frame to handle periodic network tasks */
    update(): void {
        if (!this.isConnected) return;

        const now = performance.now();

        // Periodic clock sync (every 2 seconds)
        if (now - this.lastPingTime > 2000) {
            this.sendClockPing();
            this.lastPingTime = now;
        }
    }

    /** Check if it's time to send input */
    shouldSendInput(): boolean {
        const now = performance.now();
        const interval = 1000 / NET_TICK_RATE;
        if (now - this.lastInputSendTime >= interval) {
            this.lastInputSendTime = now;
            return true;
        }
        return false;
    }

    /** Check if it's time to send snapshot (host only) */
    shouldSendSnapshot(): boolean {
        if (!this.isHost) return false;
        const now = performance.now();
        const interval = 1000 / SNAPSHOT_RATE;
        if (now - this.lastSnapshotTime >= interval) {
            this.lastSnapshotTime = now;
            return true;
        }
        return false;
    }
}

// Singleton instance
let networkManager: NetworkManager | null = null;

export function getNetworkManager(): NetworkManager {
    if (!networkManager) {
        networkManager = new NetworkManager();
    }
    return networkManager;
}

export function resetNetworkManager(): void {
    if (networkManager) {
        networkManager.disconnect();
    }
    networkManager = null;
}
