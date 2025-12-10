import Phaser from "phaser";
import { createGameConfig } from "./GameConfig";
import { MainScene } from "./scenes/MainScene";

class GameManager {
  private game?: Phaser.Game;
  private mainScene?: MainScene;

  init(containerId: string) {
    if (this.game) return;
    this.mainScene = new MainScene();
    const config = createGameConfig(containerId, [this.mainScene]);
    this.game = new Phaser.Game(config);
  }

  startRun() {
    if (!this.game) {
      this.init("game-root");
    }
    this.mainScene?.startNewRun();
  }

  applyUpgrade(id: string) {
    if (!this.game) return;
    this.mainScene?.applyUpgrade(id);
  }

  setLowGraphicsMode(enabled: boolean) {
    if (!this.game) return;
    this.mainScene?.setLowGraphicsMode(enabled);
  }

  pause() {
    if (!this.game) return;
    this.mainScene?.setPaused(true);
  }

  resume() {
    if (!this.game) return;
    this.mainScene?.setPaused(false);
  }
}

export const gameManager = new GameManager();
