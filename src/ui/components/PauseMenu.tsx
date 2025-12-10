import { gameManager } from "../../game/GameManager";
import { useRunStore } from "../../state/useRunStore";
import { useUIStore } from "../../state/useUIStore";

export const PauseMenu = () => {
  const pauseOpen = useUIStore((s) => s.pauseMenuOpen);
  const { closePause, setScreen } = useUIStore((s) => s.actions);
  const resetRun = useRunStore((s) => s.actions.reset);

  if (!pauseOpen) return null;

  return (
    <div className="overlay pause-menu">
      <div className="panel">
        <div className="panel-header">Paused</div>
        <div className="actions">
          <button
            className="primary"
            onClick={() => {
              closePause();
              gameManager.resume();
            }}
          >
            Resume
          </button>
          <button
            className="ghost"
            onClick={() => {
              closePause();
              resetRun();
              setScreen("title");
            }}
          >
            Quit to Title
          </button>
        </div>
      </div>
    </div>
  );
};
