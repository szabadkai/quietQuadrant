import Phaser from "phaser";

/**
 * Boot scene that preloads all game assets before MainScene starts.
 * SVG sprites are loaded here and rasterized by Phaser at load time.
 */
export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: "BootScene" });
    }

    preload() {
        // Load all sprite SVGs
        const sprites = [
            "player",
            "drifter",
            "watcher",
            "mass",
            "boss",
            "bullet",
            "enemy-bullet",
            "xp",
            "elite-drifter",
            "elite-watcher",
            "elite-mass",
            "boss-sentinel",
            "boss-swarm-core",
            "boss-obelisk",
            "boss-warden",
            "boss-harbinger",
        ];

        sprites.forEach((name) => {
            this.load.svg(name, `sprites/${name}.svg`, {
                width: 64,
                height: 64,
            });
        });
    }

    create() {
        // Start MainScene once assets are loaded
        this.scene.start("MainScene");
    }
}
