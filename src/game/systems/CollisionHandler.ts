/**
 * Collision Handler - Handles projectile collision detection and processing
 * Extracted from ProjectileSystem to improve modularity
 */

import type { CollisionTarget } from "../types/GameTypes";
import { eventBus } from "./EventBus";
import type {
    CollisionResult,
    ICollisionHandler,
    ProjectileState,
} from "./interfaces/ProjectileSystem";

const COLOR_OVERLOAD = 0xffd7a6;

export class CollisionHandler implements ICollisionHandler {
    checkCollision(
        projectile: ProjectileState,
        target: CollisionTarget
    ): boolean {
        if (!projectile.sprite || !target) return false;

        const dx = projectile.position.x - target.position.x;
        const dy = projectile.position.y - target.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < 20; // Simple collision radius
    }

    processCollisionEffects(
        projectile: ProjectileState,
        _target: CollisionTarget
    ): string[] {
        const effects: string[] = [];

        if (projectile.tags.includes("explosive")) {
            effects.push("explosion");
        }

        if (projectile.tags.includes("charged")) {
            effects.push("charge-burst");
        }

        return effects;
    }

    calculateDamage(
        projectile: ProjectileState,
        _target: CollisionTarget
    ): number {
        let damage = projectile.damage;

        if (projectile.tags.includes("charged")) {
            damage *= 1.5;
        }

        if (projectile.tags.includes("crit")) {
            damage *= 2;
        }

        return damage;
    }

    calculateCollisionResult(
        _projectileId: string,
        _target: CollisionTarget
    ): CollisionResult {
        // This would look up the projectile by ID and calculate the result
        return {
            projectileDestroyed: true,
            targetDestroyed: false,
            damageDealt: 0,
            effectsTriggered: [],
        };
    }
}
