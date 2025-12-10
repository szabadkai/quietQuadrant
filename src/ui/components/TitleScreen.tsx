import { useUIStore } from "../../state/useUIStore";
import { gameManager } from "../../game/GameManager";

export const TitleScreen = () => {
  const { setScreen } = useUIStore((s) => s.actions);

  const start = () => {
    gameManager.startRun();
  };

  return (
    <div className="overlay title-screen">
      <div className="panel hero">
        <div className="eyebrow">Quiet Quadrant</div>
        <h1>One ship. One quadrant. Stay alive.</h1>
        <p>
          Minimalist roguelike shooter in a contained arena. Build a sharp loadout,
          weave through escalating waves, and survive the bullet-hell boss.
        </p>
        <div className="actions">
          <button className="primary" onClick={start}>
            Begin Run
          </button>
          <button className="ghost" onClick={() => setScreen("howToPlay")}>
            How to Play
          </button>
        </div>
      </div>
    </div>
  );
};
