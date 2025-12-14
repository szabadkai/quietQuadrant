/**
 * Service container for dependency injection between systems
 * Provides a way for systems to communicate without tight coupling
 */

export type ServiceFactory<T> = () => T;
export type ServiceInstance<T> = T;

export interface ServiceDefinition<T = unknown> {
  factory?: ServiceFactory<T>;
  instance?: ServiceInstance<T>;
  singleton: boolean;
}

export class ServiceContainer {
  private services = new Map<string, ServiceDefinition>();
  private singletonInstances = new Map<string, unknown>();

  /**
   * Register a service factory
   */
  registerFactory<T>(serviceId: string, factory: ServiceFactory<T>, singleton = true): void {
    if (this.services.has(serviceId)) {
      throw new Error(`Service ${serviceId} is already registered`);
    }

    this.services.set(serviceId, {
      factory,
      singleton,
    });
  }

  /**
   * Register a service instance
   */
  registerInstance<T>(serviceId: string, instance: T): void {
    if (this.services.has(serviceId)) {
      throw new Error(`Service ${serviceId} is already registered`);
    }

    this.services.set(serviceId, {
      instance,
      singleton: true,
    });

    this.singletonInstances.set(serviceId, instance);
  }

  /**
   * Get a service instance
   */
  get<T>(serviceId: string): T {
    const definition = this.services.get(serviceId);
    if (!definition) {
      throw new Error(`Service ${serviceId} is not registered`);
    }

    // Return existing instance if it's a singleton
    if (definition.singleton && this.singletonInstances.has(serviceId)) {
      return this.singletonInstances.get(serviceId) as T;
    }

    // Create new instance
    let instance: T;
    if (definition.instance !== undefined) {
      instance = definition.instance;
    } else if (definition.factory) {
      instance = definition.factory();
    } else {
      throw new Error(`Service ${serviceId} has no factory or instance`);
    }

    // Store singleton instance
    if (definition.singleton) {
      this.singletonInstances.set(serviceId, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered
   */
  has(serviceId: string): boolean {
    return this.services.has(serviceId);
  }

  /**
   * Unregister a service
   */
  unregister(serviceId: string): void {
    this.services.delete(serviceId);
    this.singletonInstances.delete(serviceId);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.singletonInstances.clear();
  }

  /**
   * Get all registered service IDs
   */
  getServiceIds(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Create a scoped container (child container)
   */
  createScope(): ServiceContainer {
    const scope = new ServiceContainer();

    // Copy all service definitions to the scope
    for (const [serviceId, definition] of this.services) {
      scope.services.set(serviceId, { ...definition });
    }

    // Copy singleton instances to the scope
    for (const [serviceId, instance] of this.singletonInstances) {
      scope.singletonInstances.set(serviceId, instance);
    }

    return scope;
  }
}

/**
 * Global service container instance
 */
export const serviceContainer = new ServiceContainer();

/**
 * Service decorator for automatic registration
 */
export function Service(serviceId: string, singleton = true) {
  return <T extends new (...args: unknown[]) => unknown>(ctor: T) => {
    serviceContainer.registerFactory(serviceId, () => new ctor(), singleton);
    return ctor;
  };
}

/**
 * Inject decorator for automatic dependency injection
 */
export function Inject(serviceId: string) {
  return (target: unknown, propertyKey: string) => {
    Object.defineProperty(target, propertyKey, {
      get() {
        return serviceContainer.get(serviceId);
      },
      enumerable: true,
      configurable: true,
    });
  };
}
