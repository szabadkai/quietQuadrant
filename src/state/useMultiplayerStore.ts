/**
 * Multiplayer Store - Simplified state management for deterministic networking
 *
 * This store now acts as a thin wrapper around NetworkManager,
 * providing React-friendly state access via Zustand.
 */

import { create } from "zustand";
import {
    getNetworkManager,
    resetNetworkManager,
    type ConnectionState,
    type NetworkRole,
} from "../network/NetworkManager";
import type {
    PlayerInput,
    ProjectileSpawn,
    GameEvent,
    CorrectionSnapshot,
} from "../network/DeterministicSync";

// Re-export types for convenience
export type { PlayerInput, ProjectileSpawn, GameEvent, CorrectionSnapshot };
export type { ConnectionState, NetworkRole };

// ============================================================================
// LEGACY TYPES (for backward compatibility during migration)
// ============================================================================

export type MultiplayerMode = "local" | "host" | "join";

// Legacy GameStateSync - kept for gradual migration
export interface GameStateSync {
    players: {
        p1: {
            x: number;
            y: number;
            rotation: number;
            health: number;
            active: boolean;
        };
        p2: {
            x: number;
            y: number;
            rotation: number;
            health: number;
            active: boolean;
        };
    };
    enemies: Array<{
        id: number;
        x: number;
        y: number;
        health: number;
        kind: string;
        active: boolean;
    }>;
    bullets: Array<{
        id: number;
        x: number;
        y: number;
        vx: number;
        vy: number;
    }>;
    playerBullets: Array<{
        id: number;
        x: number;
        y: number;
        vx: number;
        vy: number;
        rotation: number;
    }>;
    wave: number;
    score: number;
    timestamp: number;
    intermissionActive: boolean;
    countdown: number | null;
    pendingWave: number | null;
}

export interface GuestBulletRequest {
    x: number;
    y: number;
    dirX: number;
    dirY: number;
    timestamp: number;
}

// ============================================================================
// STORE STATE
// ============================================================================

interface MultiplayerState {
    // Connection state (synced from NetworkManager)
    mode: MultiplayerMode;
    connectionState: ConnectionState;
    roomCode: string | null;
    isHost: boolean;
    peerId: string | null;
    connectedPeers: string[];
    gameStarted: boolean;

    // Callbacks for game integration
    onGameStart: (() => void) | null;
    onRemoteInput: ((input: PlayerInput) => void) | null;
    onProjectileSpawn: ((spawn: ProjectileSpawn) => void) | null;
    onGameEvent: ((event: GameEvent) => void) | null;
    onCorrection: ((snapshot: CorrectionSnapshot) => void) | null;

    // Legacy compatibility
    latestGameState: GameStateSync | null;
    onGameStateUpdate: ((state: GameStateSync) => void) | null;
    onGuestBullet: ((bullet: GuestBulletRequest) => void) | null;
    playerStates: Record<
        string,
        {
            id: string;
            position: { x: number; y: number };
            health: number;
            isAlive: boolean;
        }
    >;

    actions: {
        setMode: (mode: MultiplayerMode) => void;
        createRoom: () => Promise<string>;
        joinRoom: (roomCode: string) => Promise<void>;
        disconnect: () => void;
        startGame: () => void;

        // New deterministic API
        sendInput: (input: PlayerInput) => void;
        sendProjectileSpawn: (spawn: ProjectileSpawn) => void;
        sendGameEvent: (event: GameEvent) => void;
        sendCorrection: (snapshot: CorrectionSnapshot) => void;

        // Callbacks
        setOnGameStart: (callback: (() => void) | null) => void;
        setOnRemoteInput: (
            callback: ((input: PlayerInput) => void) | null
        ) => void;
        setOnProjectileSpawn: (
            callback: ((spawn: ProjectileSpawn) => void) | null
        ) => void;
        setOnGameEvent: (callback: ((event: GameEvent) => void) | null) => void;
        setOnCorrection: (
            callback: ((snapshot: CorrectionSnapshot) => void) | null
        ) => void;

        // Legacy API (for gradual migration)
        updatePlayerState: (
            playerId: string,
            state: Partial<{
                position: { x: number; y: number };
                health: number;
                isAlive: boolean;
            }>
        ) => void;
        sendGameAction: (action: any) => void;
        sendGameState: (state: GameStateSync) => void;
        setOnGameStateUpdate: (
            callback: ((state: GameStateSync) => void) | null
        ) => void;
        setOnGuestBullet: (
            callback: ((bullet: GuestBulletRequest) => void) | null
        ) => void;
        sendGuestBullet: (bullet: GuestBulletRequest) => void;
    };
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useMultiplayerStore = create<MultiplayerState>()((set, get) => ({
    mode: "local",
    connectionState: "disconnected",
    roomCode: null,
    isHost: false,
    peerId: null,
    connectedPeers: [],
    gameStarted: false,

    onGameStart: null,
    onRemoteInput: null,
    onProjectileSpawn: null,
    onGameEvent: null,
    onCorrection: null,

    latestGameState: null,
    onGameStateUpdate: null,
    onGuestBullet: null,
    playerStates: {},

    actions: {
        setMode: (mode) => set({ mode }),

        createRoom: async () => {
            const nm = getNetworkManager();

            // Set up callbacks before connecting
            nm.setCallbacks({
                onPeerJoin: (peerId) => {
                    const { connectedPeers } = get();
                    set({
                        connectedPeers: [...connectedPeers, peerId],
                        connectionState: "connected",
                    });
                },
                onPeerLeave: (peerId) => {
                    const { connectedPeers } = get();
                    set({
                        connectedPeers: connectedPeers.filter(
                            (id) => id !== peerId
                        ),
                    });
                },
                onGameStart: () => {
                    set({ gameStarted: true });
                    const { onGameStart } = get();
                    onGameStart?.();
                },
                onRemoteInput: (input) => {
                    const { onRemoteInput } = get();
                    onRemoteInput?.(input);
                },
                onProjectileSpawn: (spawn) => {
                    const { onProjectileSpawn } = get();
                    onProjectileSpawn?.(spawn);
                },
                onGameEvent: (event) => {
                    const { onGameEvent } = get();
                    onGameEvent?.(event);

                    // Legacy: handle guest bullet as game event
                    if (event.type === "guestBullet") {
                        const { onGuestBullet } = get();
                        onGuestBullet?.(event.data as GuestBulletRequest);
                    }
                },
                onCorrection: (snapshot) => {
                    const { onCorrection } = get();
                    onCorrection?.(snapshot);
                },
            });

            set({ connectionState: "connecting", isHost: true });

            try {
                const roomCode = await nm.createRoom();
                set({
                    roomCode,
                    peerId: nm.peerId,
                    connectionState: "connected",
                });
                return roomCode;
            } catch (error) {
                set({ connectionState: "error" });
                throw error;
            }
        },

        joinRoom: async (roomCode) => {
            const nm = getNetworkManager();

            // Set up callbacks
            nm.setCallbacks({
                onPeerJoin: (peerId) => {
                    const { connectedPeers } = get();
                    set({
                        connectedPeers: [...connectedPeers, peerId],
                        connectionState: "connected",
                    });
                },
                onPeerLeave: (peerId) => {
                    const { connectedPeers } = get();
                    set({
                        connectedPeers: connectedPeers.filter(
                            (id) => id !== peerId
                        ),
                    });
                },
                onGameStart: () => {
                    set({ gameStarted: true });
                    const { onGameStart } = get();
                    onGameStart?.();
                },
                onRemoteInput: (input) => {
                    const { onRemoteInput } = get();
                    onRemoteInput?.(input);
                },
                onProjectileSpawn: (spawn) => {
                    const { onProjectileSpawn } = get();
                    onProjectileSpawn?.(spawn);
                },
                onGameEvent: (event) => {
                    const { onGameEvent } = get();
                    onGameEvent?.(event);
                },
                onCorrection: (snapshot) => {
                    const { onCorrection } = get();
                    onCorrection?.(snapshot);
                },
            });

            set({ connectionState: "connecting", isHost: false, roomCode });

            try {
                await nm.joinRoom(roomCode);
                set({
                    peerId: nm.peerId,
                    connectionState: "connected",
                });
            } catch (error) {
                set({ connectionState: "error" });
                throw error;
            }
        },

        disconnect: () => {
            resetNetworkManager();
            set({
                connectionState: "disconnected",
                roomCode: null,
                isHost: false,
                peerId: null,
                connectedPeers: [],
                gameStarted: false,
                playerStates: {},
                latestGameState: null,
            });
        },

        startGame: () => {
            const nm = getNetworkManager();
            const { isHost } = get();
            if (isHost) {
                nm.signalGameStart();
            }
            set({ gameStarted: true });
        },

        // New deterministic API
        sendInput: (input) => {
            const nm = getNetworkManager();
            nm.sendLocalInput(input);
        },

        sendProjectileSpawn: (spawn) => {
            const nm = getNetworkManager();
            nm.sendProjectileSpawn(spawn);
        },

        sendGameEvent: (event) => {
            const nm = getNetworkManager();
            nm.sendGameEvent(event);
        },

        sendCorrection: (snapshot) => {
            const nm = getNetworkManager();
            nm.sendCorrectionSnapshot(snapshot);
        },

        // Callback setters
        setOnGameStart: (callback) => set({ onGameStart: callback }),
        setOnRemoteInput: (callback) => set({ onRemoteInput: callback }),
        setOnProjectileSpawn: (callback) =>
            set({ onProjectileSpawn: callback }),
        setOnGameEvent: (callback) => set({ onGameEvent: callback }),
        setOnCorrection: (callback) => set({ onCorrection: callback }),

        // Legacy API
        updatePlayerState: (playerId, state) => {
            const { playerStates } = get();
            const existing = playerStates[playerId] || {
                id: playerId,
                position: { x: 0, y: 0 },
                health: 100,
                isAlive: true,
            };
            set({
                playerStates: {
                    ...playerStates,
                    [playerId]: { ...existing, ...state },
                },
            });
        },

        sendGameAction: (action) => {
            const nm = getNetworkManager();
            nm.sendGameEvent({
                tick: nm.currentTick,
                type: action.type,
                data: action,
            });
        },

        sendGameState: (_state) => {
            // No-op in new architecture - state is derived from inputs
            console.warn(
                "sendGameState is deprecated - use input-based sync instead"
            );
        },

        setOnGameStateUpdate: (callback) =>
            set({ onGameStateUpdate: callback }),
        setOnGuestBullet: (callback) => set({ onGuestBullet: callback }),

        sendGuestBullet: (bullet) => {
            const nm = getNetworkManager();
            nm.sendGameEvent({
                tick: nm.currentTick,
                type: "guestBullet",
                data: bullet,
            });
        },
    },
}));
