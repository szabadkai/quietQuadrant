# WebRTC Multiplayer Implementation

## Overview

This implementation adds WebRTC-based twin multiplayer mode to Quiet Quadrant using Trystero for peer-to-peer connections.

## Features

### 1. **Multiplayer Mode Selection**

-   **Local Co-op**: Two controllers on the same device (existing twin mode)
-   **Host Online Game**: Create a room and share a code with a friend
-   **Join Online Game**: Enter a room code to join a friend's game

### 2. **WebRTC Connection via Trystero**

-   Peer-to-peer connections using Trystero library
-   No backend server required for signaling
-   Automatic room code generation (6-character codes)
-   Connection state management

### 3. **UI Components**

#### MultiplayerSetup (`src/ui/components/MultiplayerSetup.tsx`)

-   Entry point for multiplayer mode
-   Allows choosing between local and online play

#### HostGame (`src/ui/components/HostGame.tsx`)

-   Creates a room automatically on mount
-   Displays room code for sharing
-   Shows connection status
-   Starts game when peer connects

#### JoinGame (`src/ui/components/JoinGame.tsx`)

-   Input field for entering room code
-   Connects to host's room
-   Auto-starts game on successful connection

### 4. **State Management**

#### Multiplayer Store (`src/state/useMultiplayerStore.ts`)

-   Manages WebRTC connection state
-   Handles room creation and joining
-   Tracks connected peers
-   Provides actions for sending/receiving game state

**Key State:**

-   `mode`: "local" | "host" | "join"
-   `connectionState`: "disconnected" | "connecting" | "connected" | "error"
-   `roomCode`: 6-character room identifier
-   `connectedPeers`: Array of connected peer IDs
-   `playerStates`: Record of player positions, health, etc.

**Key Actions:**

-   `createRoom()`: Creates a new room and returns room code
-   `joinRoom(code)`: Joins an existing room
-   `disconnect()`: Leaves the room and cleans up
-   `updatePlayerState()`: Updates and syncs player state
-   `sendGameAction()`: Sends game actions to peers

## How It Works

### Connection Flow

1. **Host:**

    - User clicks "Host Online Game"
    - Room is created with random 6-character code
    - Trystero establishes WebRTC signaling
    - Host waits for peer to join
    - When peer connects, host can start the game

2. **Guest:**
    - User clicks "Join Online Game"
    - Enters room code from host
    - Trystero connects to host via WebRTC
    - Game starts automatically on connection

### Game State Synchronization

The multiplayer store provides two channels for communication:

1. **Player Updates** (`playerUpdate` action)

    - Syncs player position, health, alive status
    - Called frequently during gameplay
    - Each peer maintains their own state and broadcasts updates

2. **Game Actions** (`gameAction` action)
    - For discrete game events (upgrades, wave changes, etc.)
    - Can be extended for specific game mechanics

## Next Steps

To fully integrate multiplayer into the game, you'll need to:

1. **Sync Game State**

    - Hook up player position updates from Phaser game objects
    - Sync upgrade selections between players
    - Sync wave progression and enemy spawns

2. **Handle Disconnections**

    - Add reconnection logic
    - Handle peer disconnects gracefully
    - Show appropriate UI when connection is lost

3. **Sync Game Start**

    - Ensure both players start with same seed
    - Coordinate wave timing
    - Share upgrade choices

4. **Add Latency Handling**

    - Implement client-side prediction
    - Add interpolation for smooth movement
    - Handle out-of-order messages

5. **Testing**
    - Test with different network conditions
    - Verify state stays in sync
    - Handle edge cases (rapid disconnects, etc.)

## Technical Details

### Trystero Configuration

-   **App ID**: "quiet-quadrant"
-   **Room Codes**: 6-character alphanumeric (uppercase)
-   **Signaling**: Uses Trystero's default public signaling servers

### Dependencies

-   `trystero`: ^0.x.x (WebRTC peer-to-peer library)
-   `zustand`: ^5.0.9 (State management)

## Usage Example

```typescript
// In your game code, to send player position:
const { updatePlayerState, peerId } = useMultiplayerStore();

// Update local player state and broadcast to peers
updatePlayerState(peerId, {
    position: { x: player.x, y: player.y },
    health: player.health,
    isAlive: player.isAlive,
});

// To send a game action:
const { sendGameAction } = useMultiplayerStore((s) => s.actions);
sendGameAction({ type: "upgrade_selected", upgradeId: "rapid-fire" });
```

## Known Limitations

1. **No Host Migration**: If host disconnects, game ends
2. **Two Players Only**: Current implementation supports 1v1 only
3. **No Spectators**: Room is limited to active players
4. **Public Signaling**: Uses public Trystero servers (consider private for production)

## Future Enhancements

-   Add voice chat support
-   Implement host migration
-   Support for more than 2 players
-   Add matchmaking system
-   Implement replay/spectator mode
-   Add private signaling servers for better reliability
