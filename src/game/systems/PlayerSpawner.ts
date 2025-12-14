/**
 * Player Spawner - Handles player sprite creation and setup
 * Extracted from PlayerSystem to improve modularity
 */

import * as Phaser from "phaser";

const OBJECT_SCALE = 0.7;

export class PlayerSpawner {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    createPlayer(
        x: number,
        y: number,
        textureKey: string = "player"
    ): Phaser.Physics.Arcade.Image {
        const player = this.scene.physics.add
            .image(x, y, textureKey)
            .setScale(OBJECT_SCALE)
            .setDepth(1);

        player.setCollideWorldBounds(true);
        player.setDamping(true);
        player.setDrag(0.95, 0.95);

        const body = player.body as Phaser.Physics.Arcade.Body;
        body.setSize(28 * OBJECT_SCALE, 28 * OBJECT_SCALE, true);
        body.enable = true; // Ensure body is enabled

        return player;
    }

    createInactivePlayer(
        x: number,
        y: number,
        textureKey: string = "player"
    ): Phaser.Physics.Arcade.Image {
        const player = this.createPlayer(x, y, textureKey);

        player.setVisible(false);
        player.setActive(false);
        (player.body as Phaser.Physics.Arcade.Body).enable = false;

        return player;
    }

    getGameDimensions(): { width: number; height: number } {
        return {
            width: this.scene.scale.width,
            height: this.scene.scale.height,
        };
    }
}
