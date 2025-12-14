import type { SynergyDefinition } from "../models/types";

export const SYNERGY_DEFINITIONS: SynergyDefinition[] = [
  {
    id: "black-hole-sun",
    name: "Black Hole Sun",
    description: "Singularity rounds clump enemies, then chain reactions erase the pack at once.",
    requires: ["singularity-rounds", "chain-reaction"],
  },
  {
    id: "railgun",
    name: "Railgun",
    description: "Fully charged shots pierce everything after phasing through walls. +5% crit chance and +25% crit damage.",
    requires: ["held-charge", "quantum-tunneling", "swift-projectiles"],
  },
  {
    id: "meat-grinder",
    name: "Meat Grinder",
    description: "Heavy neutron spheres become a bullet-plow that shreds with shrapnel. Sharpened crits (+3% chance, +15% crit damage).",
    requires: ["neutron-core", "shrapnel"],
  },
  {
    id: "frame-rate-killer",
    name: "Frame Rate Killer",
    description: "Bullet Hell plus rebounds and splits flood the arena with living bullets.",
    requires: ["bullet-hell", "rebound", "split-shot"],
  },
  {
    id: "vampire",
    name: "Vampire",
    description: "Health-as-ammo Blood Fuel feeds a Berserk frenzy with predatory crits (+3% crit chance).",
    requires: ["blood-fuel", "berserk-module"],
  },
];

export const getSynergyDefinition = (id: string) =>
  SYNERGY_DEFINITIONS.find((s) => s.id === id);
