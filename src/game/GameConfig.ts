import Phaser from "phaser";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 720;

export const createGameConfig = (
  parent: string | HTMLElement,
  scenes: Phaser.Types.Scenes.SceneType[]
): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent,
  backgroundColor: "#06080c",
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scene: scenes,
});
