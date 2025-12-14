import { useRunStore } from "../../state/useRunStore";

export const WaveCountdown = () => {
  const countdown = useRunStore((s) => s.intermissionCountdown);
  const upcomingWave = useRunStore((s) => s.upcomingWave);
  const waveCap = useRunStore((s) => s.waveCap);

  if (countdown === null || upcomingWave === null) return null;

  return (
    <div className="wave-countdown">
      <div className="wave-countdown__card">
        <div className="wave-countdown__badge">
          Round {upcomingWave} / {waveCap ?? "∞"}
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
