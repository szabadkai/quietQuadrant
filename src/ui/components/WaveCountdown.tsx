import { WAVES } from "../../config/waves";
import { useRunStore } from "../../state/useRunStore";

export const WaveCountdown = () => {
  const countdown = useRunStore((s) => s.intermissionCountdown);
  const upcomingWave = useRunStore((s) => s.upcomingWave);

  if (countdown === null || upcomingWave === null) return null;

  return (
    <div className="wave-countdown">
      <div className="wave-countdown__card">
        <div className="wave-countdown__badge">
          Round {upcomingWave} / {WAVES.length}
        </div>
        <div className="wave-countdown__timer">
          <span className="wave-countdown__digit">{countdown}</span>
          <span className="wave-countdown__label">Next wave</span>
        </div>
        <div className="wave-countdown__hint">Catch your breath before the next push.</div>
      </div>
    </div>
  );
};
