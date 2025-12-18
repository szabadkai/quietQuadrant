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

export type MultiplayerMode = "local" | "host" | "join";
export type ConnectionState =
    | "disconnected"
    | "connecting"
    | "connected"
    | "error";

interface PlayerState {
    id: string;
    position: { x: number; y: number };
    health: number;
    isAlive: boolean;
}

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
        startGame: () => void;
        setOnGameStart: (callback: (() => void) | null) => void;
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
                const room = joinRoom({ appId: "quiet-quadrant" }, roomCode);
                const myId = selfId;

                // Set up event handlers
                const [, getPlayerUpdate] = room.makeAction("playerUpdate");
                const [, getGameAction] = room.makeAction("gameAction");

                getPlayerUpdate((data: any, peerId: string) => {
                    if (!data) return;
                    const { playerStates } = get();
                    const existingState = playerStates[peerId] || {
                        id: peerId,
                        position: { x: 0, y: 0 },
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
                const room = joinRoom({ appId: "quiet-quadrant" }, roomCode);
                const myId = selfId;

                // Set up event handlers (same as host)
                const [, getPlayerUpdate] = room.makeAction("playerUpdate");
                const [, getGameAction] = room.makeAction("gameAction");

                getPlayerUpdate((data: any, peerId: string) => {
                    if (!data) return;
                    const { playerStates } = get();
                    const existingState = playerStates[peerId] || {
                        id: peerId,
                        position: { x: 0, y: 0 },
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
    },
}));
