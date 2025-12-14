/**
 * Event bus for loose coupling between systems
 * Allows systems to communicate without direct dependencies
 */

export type EventListener<T = unknown> = (data: T) => void;
export type EventUnsubscribe = () => void;

export interface EventBusEvents {
  // Player events
  'player:health-changed': { health: number; maxHealth: number };
  'player:died': { playerId: string };
  'player:respawned': { playerId: string };
  'player:level-up': { level: number; xp: number };
  'player:upgrade-selected': { upgradeId: string };

  // Enemy events
  'enemy:spawned': {
    enemyId: string;
    type: string;
    position: { x: number; y: number };
  };
  'enemy:died': {
    enemyId: string;
    type: string;
    position: { x: number; y: number };
  };
  'enemy:damaged': {
    enemyId: string;
    damage: number;
    remainingHealth: number;
  };

  // Wave events
  'wave:started': { waveIndex: number };
  'wave:completed': { waveIndex: number };
  'wave:enemy-count-changed': { remaining: number; total: number };

  // Projectile events
  'projectile:fired': {
    projectileId: string;
    type: 'player' | 'enemy';
    position: { x: number; y: number };
  };
  'projectile:hit': {
    projectileId: string;
    targetId: string;
    damage: number;
  };
  'projectile:expired': { projectileId: string };

  // Game events
  'game:paused': { timestamp: number };
  'game:resumed': { timestamp: number };
  'game:over': { score: number; wave: number };

  // System events
  'system:initialized': { systemId: string };
  'system:shutdown': { systemId: string };
  'system:error': { systemId: string; error: string };

  // Audio events
  'audio:play-sfx': { soundId: string; volume?: number };
  'audio:play-music': { trackId: string; loop?: boolean };
  'audio:stop-music': Record<string, never>;

  // VFX events
  'vfx:explosion': {
    position: { x: number; y: number };
    radius: number;
    color: number;
  };
  'vfx:particle-burst': { position: { x: number; y: number }; type: string };
  'vfx:screen-shake': { intensity: number; duration: number };
}

export class EventBus {
  private listeners = new Map<string, EventListener[]>();
  private onceListeners = new Map<string, EventListener[]>();

  /**
   * Subscribe to an event
   */
  on<K extends keyof EventBusEvents>(
    event: K,
    listener: EventListener<EventBusEvents[K]>
  ): EventUnsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.push(listener);
    }

    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to an event (one-time only)
   */
  once<K extends keyof EventBusEvents>(
    event: K,
    listener: EventListener<EventBusEvents[K]>
  ): EventUnsubscribe {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, []);
    }

    const listeners = this.onceListeners.get(event);
    if (listeners) {
      listeners.push(listener);
    }

    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof EventBusEvents>(event: K, listener: EventListener<EventBusEvents[K]>): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }

    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      const index = onceListeners.indexOf(listener);
      if (index !== -1) {
        onceListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event
   */
  emit<K extends keyof EventBusEvents>(event: K, data: EventBusEvents[K]): void {
    // Call regular listeners
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }

    // Call once listeners and remove them
    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      const listenersToCall = [...onceListeners];
      onceListeners.length = 0; // Clear the array

      listenersToCall.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in once event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends keyof EventBusEvents>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount<K extends keyof EventBusEvents>(event: K): number {
    const regularCount = this.listeners.get(event)?.length ?? 0;
    const onceCount = this.onceListeners.get(event)?.length ?? 0;
    return regularCount + onceCount;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): string[] {
    const events = new Set<string>();

    for (const event of this.listeners.keys()) {
      events.add(event);
    }

    for (const event of this.onceListeners.keys()) {
      events.add(event);
    }

    return Array.from(events);
  }

  /**
   * Create a namespaced event bus
   */
  namespace(prefix: string): NamespacedEventBus {
    return new NamespacedEventBus(this, prefix);
  }
}

/**
 * Namespaced event bus for system-specific events
 */
export class NamespacedEventBus {
  constructor(
    private eventBus: EventBus,
    private prefix: string
  ) {}

  on<K extends keyof EventBusEvents>(
    event: K,
    listener: EventListener<EventBusEvents[K]>
  ): EventUnsubscribe {
    return this.eventBus.on(`${this.prefix}:${event}` as K, listener);
  }

  once<K extends keyof EventBusEvents>(
    event: K,
    listener: EventListener<EventBusEvents[K]>
  ): EventUnsubscribe {
    return this.eventBus.once(`${this.prefix}:${event}` as K, listener);
  }

  emit<K extends keyof EventBusEvents>(event: K, data: EventBusEvents[K]): void {
    this.eventBus.emit(`${this.prefix}:${event}` as K, data);
  }

  off<K extends keyof EventBusEvents>(event: K, listener: EventListener<EventBusEvents[K]>): void {
    this.eventBus.off(`${this.prefix}:${event}` as K, listener);
  }
}

/**
 * Global event bus instance
 */
export const eventBus = new EventBus();
