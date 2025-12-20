import { create } from "zustand";

// Re-export network sync types and functions from dedicated module
// The full implementation is in src/network/NetworkSync.ts
export {
    type DeltaTracker,
    type GuestStateBuffer,
    type GameStateDelta,
    type EntitySnapshot,
    createDeltaTracker,
    createGuestStateBuffer,
    generateDelta,
    applyDelta,
    getAdaptiveTick,
    BASE_TICK_INTERVAL,
    POSITION_THRESHOLD,
    VELOCITY_THRESHOLD,
    ROTATION_THRESHOLD,
} from "../network/NetworkSync";

import {
    type DeltaTracker,
    type GuestStateBuffer,
    type GameStateDelta,
    createDeltaTracker,
    createGuestStateBuffer,
    generateDelta,
    applyDelta,
    getAdaptiveTick,
    BASE_TICK_INTERVAL,
} from "../network/NetworkSync";

// Lazy import Trystero with MQTT strategy (works without HTTPS)
let trysteroModule: any = null;
const getTrystero = async () => {
    if (!trysteroModule) {
        // Use MQTT strategy which doesn't require WebCrypto
        trysteroModule = await import("trystero/mqtt");
    }
    return trysteroModule;
};

// ICE server configuration for better WebRTC connectivity
const EXPRESSTURN_URL = import.meta.env.VITE_TURN_URL || "";
const EXPRESSTURN_USERNAME = import.meta.env.VITE_TURN_USERNAME || "";
const EXPRESSTURN_PASSWORD = import.meta.env.VITE_TURN_PASSWORD || "";

const rtcConfig: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        ...(EXPRESSTURN_URL
            ? [
                  {
                      urls: [
                          `turn:${EXPRESSTURN_URL}`,
                          `turn:${EXPRESSTURN_URL}?transport=tcp`,
                      ],
                      username: EXPRESSTURN_USERNAME,
                      credential: EXPRESSTURN_PASSWORD,
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

export type MultiplayerMode = "local" | "host" | "join";
export type ConnectionState =
    | "disconnected"
    | "connecting"
    | "connected"
    | "error";

interface PlayerState {
    id: string;
    position: { x: number; y: number };
    rotation: number;
    health: number;
    isAlive: boolean;
}

// Full game state for synchronization
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
    // Countdown/intermission state
    intermissionActive: boolean;
    countdown: number | null;
    pendingWave: number | null;
}

// Guest bullet spawn request
export interface GuestBulletRequest {
    x: number;
    y: number;
    dirX: number;
    dirY: number;
    timestamp: number;
}

// Callback type for game state updates
type GameStateCallback = (state: GameStateSync) => void;
type GuestBulletCallback = (bullet: GuestBulletRequest) => void;

interface MultiplayerState {
    mode: MultiplayerMode;
    connectionState: ConnectionState;
    roomCode: string | null;
    isHost: boolean;
    peerId: string | null;
    connectedPeers: string[];
    playerStates: Record<string, PlayerState>;
    gameStarted: boolean;
    onGameStart: (() => void) | null;
    latestGameState: GameStateSync | null;
    onGameStateUpdate: GameStateCallback | null;
    onGuestBullet: GuestBulletCallback | null;
    // Delta encoding state
    deltaTracker: DeltaTracker | null;
    guestStateBuffer: GuestStateBuffer | null;
    lastBroadcastTime: number;
    adaptiveTickInterval: number;
    actions: {
        setMode: (mode: MultiplayerMode) => void;
        createRoom: () => Promise<string>;
        joinRoom: (roomCode: string) => Promise<void>;
        disconnect: () => void;
        updatePlayerState: (
            playerId: string,
            state: Partial<PlayerState>
        ) => void;
        sendGameAction: (action: any) => void;
        sendGameState: (state: GameStateSync) => void;
        sendGameStateDelta: (state: GameStateSync, entityCount: number) => void;
        startGame: () => void;
        setOnGameStart: (callback: (() => void) | null) => void;
        setOnGameStateUpdate: (callback: GameStateCallback | null) => void;
        setOnGuestBullet: (callback: GuestBulletCallback | null) => void;
        sendGuestBullet: (bullet: GuestBulletRequest) => void;
        requestFullSync: () => void;
    };
}

export const useMultiplayerStore = create<MultiplayerState>()((set, get) => ({
    mode: "local",
    connectionState: "disconnected",
    roomCode: null,
    isHost: false,
    peerId: null,
    connectedPeers: [],
    playerStates: {},
    gameStarted: false,
    onGameStart: null,
    latestGameState: null,
    onGameStateUpdate: null,
    onGuestBullet: null,
    // Delta encoding state
    deltaTracker: null,
    guestStateBuffer: null,
    lastBroadcastTime: 0,
    adaptiveTickInterval: BASE_TICK_INTERVAL,
    actions: {
        setMode: (mode) => set({ mode }),

        createRoom: async () => {
            const roomCode = Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();

            try {
                set({
                    connectionState: "connecting",
                    roomCode,
                    isHost: true,
                    deltaTracker: createDeltaTracker(), // Initialize delta tracker for host
                });

                const { joinRoom, selfId } = await getTrystero();
                const room = joinRoom(
                    { appId: "quiet-quadrant", rtcConfig },
                    roomCode
                );
                const myId = selfId;

                // Set up event handlers
                const [, getPlayerUpdate] = room.makeAction("playerUpdate");
                const [, getGameAction] = room.makeAction("gameAction");
                const [, getGameState] = room.makeAction("gameState");
                const [, getGameStateDelta] = room.makeAction("gameStateDelta");
                const [, getGuestBullet] = room.makeAction("guestBullet");
                const [, getSyncRequest] = room.makeAction("syncRequest");

                getGuestBullet((bullet: GuestBulletRequest) => {
                    if (!bullet) return;
                    const { onGuestBullet } = get();
                    if (onGuestBullet) onGuestBullet(bullet);
                });

                getPlayerUpdate((data: any, peerId: string) => {
                    if (!data) return;
                    const { playerStates } = get();
                    const existingState = playerStates[peerId] || {
                        id: peerId,
                        position: { x: 0, y: 0 },
                        rotation: 0,
                        health: 100,
                        isAlive: true,
                    };
                    set({
                        playerStates: {
                            ...playerStates,
                            [peerId]: { ...existingState, ...data },
                        },
                    });
                });

                getGameAction((action: any, peerId: string) => {
                    console.log(
                        "Received game action:",
                        action,
                        "from:",
                        peerId
                    );
                    if (action?.type === "startGame") {
                        set({ gameStarted: true });
                        const { onGameStart } = get();
                        if (onGameStart) onGameStart();
                    }
                });

                // Legacy full state handler (for compatibility)
                getGameState((state: GameStateSync) => {
                    if (!state) return;
                    set({ latestGameState: state });
                    const { onGameStateUpdate } = get();
                    if (onGameStateUpdate) onGameStateUpdate(state);
                });

                // Delta state handler
                getGameStateDelta((delta: GameStateDelta) => {
                    if (!delta) return;
                    let { guestStateBuffer } = get();
                    if (!guestStateBuffer) {
                        guestStateBuffer = createGuestStateBuffer();
                        set({ guestStateBuffer });
                    }
                    const reconstructed = applyDelta(guestStateBuffer, delta);
                    if (reconstructed) {
                        set({
                            latestGameState: reconstructed,
                            guestStateBuffer,
                        });
                        const { onGameStateUpdate } = get();
                        if (onGameStateUpdate) onGameStateUpdate(reconstructed);
                    }
                });

                // Handle sync requests from guest
                getSyncRequest((_: any, peerId: string) => {
                    console.log("Guest requested full sync:", peerId);
                    const { deltaTracker } = get();
                    if (deltaTracker) {
                        // Force next broadcast to be a full sync
                        deltaTracker.lastFullSync = 0;
                    }
                });

                room.onPeerJoin((peerId: string) => {
                    const { connectedPeers, deltaTracker } = get();
                    // Force full sync when new peer joins
                    if (deltaTracker) {
                        deltaTracker.lastFullSync = 0;
                    }
                    set({
                        connectedPeers: [...connectedPeers, peerId],
                        connectionState: "connected",
                    });
                });

                room.onPeerLeave((peerId: string) => {
                    const { connectedPeers, playerStates } = get();
                    const newPlayerStates = { ...playerStates };
                    delete newPlayerStates[peerId];

                    set({
                        connectedPeers: connectedPeers.filter(
                            (id) => id !== peerId
                        ),
                        playerStates: newPlayerStates,
                    });
                });

                // Store room reference for later use
                (get() as any).room = room;

                set({
                    peerId: myId,
                    connectionState: "connected",
                });

                return roomCode;
            } catch (error) {
                console.error("Failed to create room:", error);
                set({ connectionState: "error" });
                throw error;
            }
        },

        joinRoom: async (roomCode) => {
            try {
                set({
                    connectionState: "connecting",
                    roomCode,
                    isHost: false,
                    guestStateBuffer: createGuestStateBuffer(), // Initialize guest buffer
                });

                const { joinRoom, selfId } = await getTrystero();
                const room = joinRoom(
                    { appId: "quiet-quadrant", rtcConfig },
                    roomCode
                );
                const myId = selfId;

                // Set up event handlers (same as host)
                const [, getPlayerUpdate] = room.makeAction("playerUpdate");
                const [, getGameAction] = room.makeAction("gameAction");
                const [, getGameState] = room.makeAction("gameState");
                const [, getGameStateDelta] = room.makeAction("gameStateDelta");

                getPlayerUpdate((data: any, peerId: string) => {
                    if (!data) return;
                    const { playerStates } = get();
                    const existingState = playerStates[peerId] || {
                        id: peerId,
                        position: { x: 0, y: 0 },
                        rotation: 0,
                        health: 100,
                        isAlive: true,
                    };
                    set({
                        playerStates: {
                            ...playerStates,
                            [peerId]: { ...existingState, ...data },
                        },
                    });
                });

                getGameAction((action: any, peerId: string) => {
                    console.log(
                        "Received game action:",
                        action,
                        "from:",
                        peerId
                    );
                    if (action?.type === "startGame") {
                        set({ gameStarted: true });
                        const { onGameStart } = get();
                        if (onGameStart) onGameStart();
                    }
                });

                // Legacy full state handler
                getGameState((state: GameStateSync) => {
                    if (!state) return;
                    set({ latestGameState: state });
                    const { onGameStateUpdate } = get();
                    if (onGameStateUpdate) onGameStateUpdate(state);
                });

                // Delta state handler - primary sync method
                getGameStateDelta((delta: GameStateDelta) => {
                    if (!delta) return;
                    let { guestStateBuffer } = get();
                    if (!guestStateBuffer) {
                        guestStateBuffer = createGuestStateBuffer();
                        set({ guestStateBuffer });
                    }
                    const reconstructed = applyDelta(guestStateBuffer, delta);
                    if (reconstructed) {
                        set({
                            latestGameState: reconstructed,
                            guestStateBuffer,
                        });
                        const { onGameStateUpdate } = get();
                        if (onGameStateUpdate) onGameStateUpdate(reconstructed);
                    }
                });

                room.onPeerJoin((peerId: string) => {
                    const { connectedPeers } = get();
                    set({
                        connectedPeers: [...connectedPeers, peerId],
                        connectionState: "connected",
                    });
                });

                room.onPeerLeave((peerId: string) => {
                    const { connectedPeers, playerStates } = get();
                    const newPlayerStates = { ...playerStates };
                    delete newPlayerStates[peerId];

                    set({
                        connectedPeers: connectedPeers.filter(
                            (id) => id !== peerId
                        ),
                        playerStates: newPlayerStates,
                    });
                });

                // Store room reference for later use
                (get() as any).room = room;

                set({
                    peerId: myId,
                    connectionState: "connected",
                });
            } catch (error) {
                console.error("Failed to join room:", error);
                set({ connectionState: "error" });
                throw error;
            }
        },

        disconnect: () => {
            const room = (get() as any).room;
            if (room) {
                room.leave();
            }
            set({
                connectionState: "disconnected",
                roomCode: null,
                isHost: false,
                peerId: null,
                connectedPeers: [],
                playerStates: {},
                deltaTracker: null,
                guestStateBuffer: null,
                lastBroadcastTime: 0,
                adaptiveTickInterval: BASE_TICK_INTERVAL,
            });
            (get() as any).room = null;
        },

        updatePlayerState: (playerId, state) => {
            const { playerStates, peerId } = get();
            const existingState = playerStates[playerId] || {
                id: playerId,
                position: { x: 0, y: 0 },
                health: 100,
                isAlive: true,
            };
            const newState = { ...existingState, ...state };

            set({
                playerStates: {
                    ...playerStates,
                    [playerId]: newState,
                },
            });

            // Send update to peers if we have a room and it's our own state
            const room = (get() as any).room;
            if (room && playerId === peerId) {
                const [sendPlayerUpdate] = room.makeAction("playerUpdate");
                sendPlayerUpdate(state);
            }
        },

        sendGameAction: (action) => {
            const room = (get() as any).room;
            if (room) {
                const [sendGameAction] = room.makeAction("gameAction");
                sendGameAction(action);
            } else {
                console.log("Sending game action:", action);
            }
        },

        sendGameState: (state: GameStateSync) => {
            const room = (get() as any).room;
            if (room) {
                const [sendGameState] = room.makeAction("gameState");
                sendGameState(state);
            }
        },

        // New delta-based sync method - primary sync for online play
        sendGameStateDelta: (state: GameStateSync, entityCount: number) => {
            const room = (get() as any).room;
            if (!room) return;

            const now = Date.now();
            const { deltaTracker, lastBroadcastTime, adaptiveTickInterval } =
                get();

            // Calculate adaptive tick interval based on entity count
            const newTickInterval = getAdaptiveTick(entityCount);
            if (newTickInterval !== adaptiveTickInterval) {
                set({ adaptiveTickInterval: newTickInterval });
            }

            // Check if enough time has passed
            if (now - lastBroadcastTime < adaptiveTickInterval) {
                return;
            }

            if (!deltaTracker) {
                // Fallback to full state if no tracker
                const [sendGameState] = room.makeAction("gameState");
                sendGameState(state);
                set({ lastBroadcastTime: now });
                return;
            }

            // Generate and send delta
            const delta = generateDelta(deltaTracker, state);
            const [sendGameStateDelta] = room.makeAction("gameStateDelta");
            sendGameStateDelta(delta);
            set({ lastBroadcastTime: now });
        },

        startGame: () => {
            const { isHost, actions } = get();
            if (isHost) {
                // Host sends start signal to guest
                actions.sendGameAction({ type: "startGame" });
            }
            set({ gameStarted: true });
        },

        setOnGameStart: (callback) => {
            set({ onGameStart: callback });
        },

        setOnGameStateUpdate: (callback) => {
            set({ onGameStateUpdate: callback });
        },

        setOnGuestBullet: (callback) => {
            set({ onGuestBullet: callback });
        },

        sendGuestBullet: (bullet: GuestBulletRequest) => {
            const room = (get() as any).room;
            if (room) {
                const [sendGuestBullet] = room.makeAction("guestBullet");
                sendGuestBullet(bullet);
            }
        },

        // Guest can request a full sync if state seems corrupted
        requestFullSync: () => {
            const room = (get() as any).room;
            if (room) {
                const [sendSyncRequest] = room.makeAction("syncRequest");
                sendSyncRequest({ type: "fullSync" });
                // Reset guest buffer to prepare for fresh state
                set({ guestStateBuffer: createGuestStateBuffer() });
            }
        },
    },
}));
