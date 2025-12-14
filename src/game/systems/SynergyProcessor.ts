/**
 * Synergy Processor - Handles upgrade synergy calculations and effects
 * Extracted from UpgradeSystem to improve modularity
 */

import type {
    ISynergyProcessor,
    UpgradeState,
} from "./interfaces/UpgradeSystem";

export class SynergyProcessor implements ISynergyProcessor {
    private playerStatsUpdater: (stats: any) => void;

    constructor(playerStatsUpdater: (stats: any) => void) {
        this.playerStatsUpdater = playerStatsUpdater;
    }

    processSynergy(synergyId: string): void {
        switch (synergyId) {
            case "railgun": {
                this.playerStatsUpdater({
                    critChance: 0.05,
                    critMultiplier: 0.25,
                });
                break;
            }
            case "meat-grinder": {
                this.playerStatsUpdater({
                    critChance: 0.03,
                    critMultiplier: 0.15,
                });
                break;
            }
            case "vampire": {
                this.playerStatsUpdater({
                    critChance: 0.03,
                });
                break;
            }
            default:
                break;
        }
    }

    checkSynergyRequirements(
        synergy: { requires: string[] },
        upgradeStacks: UpgradeState
    ): boolean {
        return synergy.requires.every((req) => (upgradeStacks[req] ?? 0) > 0);
    }

    getSynergyEffects(synergyId: string): any {
        // Return synergy-specific effects configuration
        switch (synergyId) {
            case "railgun":
                return { critChance: 0.05, critMultiplier: 0.25 };
            case "meat-grinder":
                return { critChance: 0.03, critMultiplier: 0.15 };
            case "vampire":
                return { critChance: 0.03 };
            default:
                return {};
        }
    }
}
