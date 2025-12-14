/**
 * Effect Processor - Handles projectile special effects and behaviors
 * Extracted from ProjectileSystem to improve modularity
 */

import type { CollisionTarget } from "../types/GameTypes";
import { eventBus } from "./EventBus";
import type {
    IEffectProcessor,
    ProjectileState,
} from "./interfaces/ProjectileSystem";

const COLOR_OVERLOAD = 0xffd7a6;

export class EffectProcessor implements IEffectProcessor {
    applyEffects(
        effects: string[],
        projectile: ProjectileState,
        target?: CollisionTarget
    ): void {
        effects.forEach((effect) => {
            switch (effect) {
                case "explosive":
                    this.applyExplosiveEffect(projectile, target);
                    break;
                case "charged":
                    this.applyChargedEffect(projectile, target);
                    break;
                case "homing":
                    this.applyHomingEffect(projectile);
                    break;
            }
        });
    }

    processSpecialBehaviors(
        projectile: ProjectileState,
        _deltaTime: number
    ): void {
        if (
            projectile.tags.includes("splitting") &&
            projectile.tags.includes("canFork")
        ) {
            this.processSplittingBehavior(projectile);
        }
    }

    handleExpiration(projectile: ProjectileState): void {
        if (projectile.tags.includes("explosive")) {
            eventBus.emit("vfx:explosion", {
                position: {
                    x: projectile.position.x,
                    y: projectile.position.y,
                },
                radius: 50,
                color: COLOR_OVERLOAD,
            });
        }
    }

    private applyExplosiveEffect(
        _projectile: ProjectileState,
        target?: CollisionTarget
    ): void {
        if (!target) return;

        eventBus.emit("vfx:explosion", {
            position: { x: target.position.x, y: target.position.y },
            radius: 60,
            color: COLOR_OVERLOAD,
        });
    }

    private applyChargedEffect(
        _projectile: ProjectileState,
        target?: CollisionTarget
    ): void {
        if (!target) return;

        eventBus.emit("vfx:particle-burst", {
            position: { x: target.position.x, y: target.position.y },
            type: "charge-burst",
        });
    }

    private applyHomingEffect(projectile: ProjectileState): void {
        if (!projectile.tags.includes("homing")) {
            projectile.tags.push("homing");
        }
    }

    private processSplittingBehavior(projectile: ProjectileState): void {
        if (projectile.tags.includes("canFork")) {
            projectile.tags = projectile.tags.filter(
                (tag) => tag !== "canFork"
            );

            eventBus.emit("vfx:particle-burst", {
                position: {
                    x: projectile.position.x,
                    y: projectile.position.y,
                },
                type: "split",
            });
        }
    }
}
