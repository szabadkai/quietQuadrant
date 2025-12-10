import { useEffect } from "react";
import { gameManager } from "../../game/GameManager";

export const GameCanvas = () => {
  useEffect(() => {
    gameManager.init("game-root");
  }, []);

  return <div id="game-root" className="game-root" />;
};
