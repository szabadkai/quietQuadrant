import { create } from "zustand";

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
// TODO: Move credentials to environment variables for production
const EXPRESSTURN_URL = import.meta.env.VITE_TURN_URL || "";
const EXPRESSTURN_USERNAME = import.meta.env.VITE_TURN_USERNAME || "";
const EXPRESSTURN_PASSWORD = import.meta.env.VITE_TURN_PASSWORD || "";

const rtcConfig: RTCConfiguration = {
    iceServers: [
        // Single STUN server (one is sufficient for NAT traversal)
        { urls: "stun:stun.l.google.com:19302" },
        // TURN server - use ExpressTURN if configured, otherwise Open Relay
        // Note: VITE_TURN_URL should include the port (e.g., "relay1.expressturn.com:3478")
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
        startGame: () => void;
        setOnGameStart: (callback: (() => void) | null) => void;
        setOnGameStateUpdate: (callback: GameStateCallback | null) => void;
        setOnGuestBullet: (callback: GuestBulletCallback | null) => void;
        sendGuestBullet: (bullet: GuestBulletRequest) => void;
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
    actions: {
        setMode: (mode) => set({ mode }),

        createRoom: async () => {
            const roomCode = Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();

            try {
                set({ connectionState: "connecting", roomCode, isHost: true });

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
                const [, getGuestBullet] = room.makeAction("guestBullet");

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

                getGameState((state: GameStateSync) => {
                    if (!state) return;
                    set({ latestGameState: state });
                    const { onGameStateUpdate } = get();
                    if (onGameStateUpdate) onGameStateUpdate(state);
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

                return roomCode;
            } catch (error) {
                console.error("Failed to create room:", error);
                set({ connectionState: "error" });
                throw error;
            }
        },

        joinRoom: async (roomCode) => {
            try {
                set({ connectionState: "connecting", roomCode, isHost: false });

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

                getGameState((state: GameStateSync) => {
                    if (!state) return;
                    set({ latestGameState: state });
                    const { onGameStateUpdate } = get();
                    if (onGameStateUpdate) onGameStateUpdate(state);
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
    },
}));
