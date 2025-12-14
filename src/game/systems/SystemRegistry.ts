/**
 * System registry for managing game systems
 * Handles system lifecycle, dependencies, and update ordering
 */

import type { GameSystem, SystemConfig } from './interfaces/GameSystem';

export interface SystemRegistryEvents {
  systemRegistered: (systemId: string, system: GameSystem) => void;
  systemUnregistered: (systemId: string) => void;
  systemInitialized: (systemId: string, system: GameSystem) => void;
  systemShutdown: (systemId: string) => void;
  dependencyError: (systemId: string, missingDependency: string) => void;
  circularDependencyError: (cycle: string[]) => void;
}

export class SystemRegistry {
  private systems = new Map<string, GameSystem>();
  private systemConfigs = new Map<string, SystemConfig>();
  private updateOrder: string[] = [];
  private initialized = false;
  private eventListeners = new Map<keyof SystemRegistryEvents, ((...args: unknown[]) => void)[]>();

  /**
   * Register a system with the registry
   */
  registerSystem<T extends GameSystem>(system: T, config?: Partial<SystemConfig>): void {
    const systemId = system.systemId;

    if (this.systems.has(systemId)) {
      throw new Error(`System ${systemId} is already registered`);
    }

    const finalConfig: SystemConfig = {
      enabled: true,
      priority: 0,
      dependencies: system.dependencies,
      ...config,
    };

    this.systems.set(systemId, system);
    this.systemConfigs.set(systemId, finalConfig);

    // Only recalculate update order if we're initialized
    if (this.initialized) {
      this.calculateUpdateOrder();
    }

    this.emit('systemRegistered', systemId, system);
  }

  /**
   * Unregister a system from the registry
   */
  unregisterSystem(systemId: string): void {
    const system = this.systems.get(systemId);
    if (!system) {
      return;
    }

    if (system.isActive) {
      system.shutdown();
      this.emit('systemShutdown', systemId);
    }

    this.systems.delete(systemId);
    this.systemConfigs.delete(systemId);

    // Only recalculate update order if we're initialized
    if (this.initialized) {
      this.calculateUpdateOrder();
    }

    this.emit('systemUnregistered', systemId);
  }

  /**
   * Get a system by its ID
   */
  getSystem<T extends GameSystem>(systemId: string): T | undefined {
    return this.systems.get(systemId) as T;
  }

  /**
   * Get all registered systems
   */
  getAllSystems(): Map<string, GameSystem> {
    return new Map(this.systems);
  }

  /**
   * Initialize all registered systems
   */
  initializeAllSystems(scene: Phaser.Scene): void {
    if (this.initialized) {
      throw new Error('Systems are already initialized');
    }

    // Calculate update order and validate dependencies before initialization
    this.calculateUpdateOrder();
    this.validateDependencies();

    // Initialize systems in dependency order
    for (const systemId of this.updateOrder) {
      const system = this.systems.get(systemId);
      const config = this.systemConfigs.get(systemId);

      if (system && config?.enabled) {
        try {
          system.initialize(scene);
          this.emit('systemInitialized', systemId, system);
        } catch (error) {
          console.error(`Failed to initialize system ${systemId}:`, error);
          throw error;
        }
      }
    }

    this.initialized = true;
  }

  /**
   * Shutdown all systems
   */
  shutdownAllSystems(): void {
    if (!this.initialized) {
      return;
    }

    // Shutdown in reverse order
    for (let i = this.updateOrder.length - 1; i >= 0; i--) {
      const systemId = this.updateOrder[i];
      const system = this.systems.get(systemId);

      if (system?.isActive) {
        try {
          system.shutdown();
          this.emit('systemShutdown', systemId);
        } catch (error) {
          console.error(`Failed to shutdown system ${systemId}:`, error);
        }
      }
    }

    this.initialized = false;
  }

  /**
   * Update all active systems
   */
  updateAllSystems(time: number, delta: number): void {
    if (!this.initialized) {
      return;
    }

    for (const systemId of this.updateOrder) {
      const system = this.systems.get(systemId);
      const config = this.systemConfigs.get(systemId);

      if (system && config?.enabled && system.isActive) {
        try {
          system.update(time, delta);
        } catch (error) {
          console.error(`Error updating system ${systemId}:`, error);
        }
      }
    }
  }

  /**
   * Enable or disable a system
   */
  setSystemEnabled(systemId: string, enabled: boolean): void {
    const config = this.systemConfigs.get(systemId);
    if (config) {
      config.enabled = enabled;
    }
  }

  /**
   * Check if a system is enabled
   */
  isSystemEnabled(systemId: string): boolean {
    const config = this.systemConfigs.get(systemId);
    return config?.enabled ?? false;
  }

  /**
   * Add event listener
   */
  on<K extends keyof SystemRegistryEvents>(event: K, listener: SystemRegistryEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(listener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof SystemRegistryEvents>(event: K, listener: SystemRegistryEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event
   */
  private emit<K extends keyof SystemRegistryEvents>(
    event: K,
    ...args: Parameters<SystemRegistryEvents[K]>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Calculate the update order based on dependencies and priorities
   */
  private calculateUpdateOrder(): void {
    const systems = Array.from(this.systems.keys());
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (systemId: string): void => {
      if (visiting.has(systemId)) {
        // Circular dependency detected
        const cycle = Array.from(visiting);
        cycle.push(systemId);
        this.emit('circularDependencyError', cycle);
        throw new Error(`Circular dependency detected: ${cycle.join(' -> ')}`);
      }

      if (visited.has(systemId)) {
        return;
      }

      visiting.add(systemId);

      const config = this.systemConfigs.get(systemId);
      if (config) {
        // Visit dependencies first
        for (const dependency of config.dependencies) {
          if (!this.systems.has(dependency)) {
            this.emit('dependencyError', systemId, dependency);
            throw new Error(
              `System ${systemId} depends on ${dependency}, but it is not registered`
            );
          }
          visit(dependency);
        }
      }

      visiting.delete(systemId);
      visited.add(systemId);
      order.push(systemId);
    };

    // Sort systems by priority first (higher priority = earlier in update order)
    const sortedSystems = systems.sort((a, b) => {
      const configA = this.systemConfigs.get(a);
      const configB = this.systemConfigs.get(b);
      return (configB?.priority ?? 0) - (configA?.priority ?? 0);
    });

    // Visit all systems to build dependency-ordered list
    for (const systemId of sortedSystems) {
      visit(systemId);
    }

    this.updateOrder = order;
  }

  /**
   * Validate that all dependencies are satisfied
   */
  private validateDependencies(): void {
    for (const [systemId, config] of this.systemConfigs) {
      for (const dependency of config.dependencies) {
        if (!this.systems.has(dependency)) {
          this.emit('dependencyError', systemId, dependency);
          throw new Error(`System ${systemId} depends on ${dependency}, but it is not registered`);
        }
      }
    }
  }

  /**
   * Get system statistics
   */
  getStats(): {
    totalSystems: number;
    activeSystems: number;
    enabledSystems: number;
    updateOrder: string[];
  } {
    const activeSystems = Array.from(this.systems.values()).filter((s) => s.isActive).length;
    const enabledSystems = Array.from(this.systemConfigs.values()).filter((c) => c.enabled).length;

    return {
      totalSystems: this.systems.size,
      activeSystems,
      enabledSystems,
      updateOrder: [...this.updateOrder],
    };
  }
}
