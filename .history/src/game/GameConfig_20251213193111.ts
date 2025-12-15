import Phaser from "phaser";

export const GAME_WIDTH = 1100;
export const GAME_HEIGHT = 700;

export const createGameConfig = (
	parent: string | HTMLElement,
	scenes: Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig => ({
	type: Phaser.AUTO,
	parent,
	width: GAME_WIDTH,
	height: GAME_HEIGHT,
	backgroundColor: "#06080c",
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
	},
	physics: {
		default: "arcade",
		arcade: {
			debug: false,
		},
	},
	scene: scenes,
});
