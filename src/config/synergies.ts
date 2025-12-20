import type { SynergyDefinition } from "../models/types";

export const SYNERGY_DEFINITIONS: SynergyDefinition[] = [
    {
        id: "black-hole-sun",
        name: "Black Hole Sun",
        description:
            "Singularity rounds clump enemies, then chain reactions erase the pack at once.",
        requires: ["singularity-rounds", "chain-reaction"],
    },
    {
        id: "railgun",
        name: "Railgun",
        description:
            "Fully charged shots pierce everything after phasing through walls. +5% crit chance and +25% crit damage.",
        requires: ["held-charge", "quantum-tunneling", "swift-projectiles"],
    },
    {
        id: "meat-grinder",
        name: "Meat Grinder",
        description:
            "Heavy neutron spheres become a bullet-plow that shreds with shrapnel. Sharpened crits (+3% chance, +15% crit damage).",
        requires: ["neutron-core", "shrapnel"],
    },
    {
        id: "frame-rate-killer",
        name: "Frame Rate Killer",
        description:
            "Bullet Hell plus rebounds and splits flood the arena with living bullets.",
        requires: ["bullet-hell", "rebound", "split-shot"],
    },
    {
        id: "vampire",
        name: "Vampire",
        description:
            "Health-as-ammo Blood Fuel feeds a Berserk frenzy with predatory crits (+3% crit chance).",
        requires: ["blood-fuel", "berserk-module"],
    },
    // New synergies below
    {
        id: "tesla-coil",
        name: "Tesla Coil",
        description:
            "Chain lightning arcs through explosive impacts, creating devastating chain reactions. +15% arc damage.",
        requires: ["chain-arc", "explosive-impact"],
    },
    {
        id: "glass-storm",
        name: "Glass Storm",
        description:
            "Glass Cannon's raw power combined with Bullet Hell creates a deadly spray. Accuracy penalty reduced by 50%.",
        requires: ["glass-cannon", "bullet-hell"],
    },
    {
        id: "phantom-striker",
        name: "Phantom Striker",
        description:
            "Dash through enemies while sparks and shrapnel tear them apart. Dash cooldown -25%.",
        requires: ["dash-sparks", "shrapnel"],
    },
    {
        id: "gravity-well",
        name: "Gravity Well",
        description:
            "Singularity pulls enemies into explosive detonations. Explosion radius +30%.",
        requires: ["singularity-rounds", "explosive-impact"],
    },
    {
        id: "sniper-elite",
        name: "Sniper Elite",
        description:
            "Charged heatseeker rounds never miss their mark. Homing strength doubled on charged shots. +10% crit damage.",
        requires: ["held-charge", "heatseeker"],
    },
    {
        id: "immortal-engine",
        name: "Immortal Engine",
        description:
            "XP shields combined with kinetic healing create near-invulnerability. Shield duration +50%.",
        requires: ["shield-pickup", "kinetic-siphon"],
    },
    {
        id: "prism-cannon",
        name: "Prism Cannon",
        description:
            "Tight prism spread with heavy barrel creates a focused devastation beam. +8% crit chance.",
        requires: ["prism-spread", "heavy-barrel", "sidecar"],
    },
];

export const getSynergyDefinition = (id: string) =>
    SYNERGY_DEFINITIONS.find((s) => s.id === id);
