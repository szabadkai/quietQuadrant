import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useInputStore } from "../../state/useInputStore";
import { isPortrait } from "../../utils/device";
import { useUIStore } from "../../state/useUIStore";

const STICK_RADIUS = 50;

const clampStick = (dx: number, dy: number) => {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  const magnitude = Math.min(1, dist / STICK_RADIUS);
  const normX = dx / dist;
  const normY = dy / dist;
  return { x: normX * magnitude, y: normY * magnitude, magnitude };
};

type StickSide = "left" | "right";

export const TouchControls = () => {
  const isMobile = useInputStore((s) => s.isMobile);
  const leftStick = useInputStore((s) => s.leftStick);
  const rightStick = useInputStore((s) => s.rightStick);
  const { updateLeftStick, updateRightStick, releaseLeftStick, releaseRightStick, setIsMobile } =
    useInputStore((s) => s.actions);
  const screen = useUIStore((s) => s.screen);
  const upgradeOpen = useUIStore((s) => s.upgradeSelectionOpen);
  const pauseOpen = useUIStore((s) => s.pauseMenuOpen);
  const [portrait, setPortrait] = useState(false);
  const leftPointerId = useRef<number | null>(null);
  const rightPointerId = useRef<number | null>(null);
  const leftOrigin = useRef({ x: 0, y: 0 });
  const rightOrigin = useRef({ x: 0, y: 0 });
  const leftBaseRef = useRef<HTMLDivElement | null>(null);
  const rightBaseRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMobile) return;
    const mql = window.matchMedia("(orientation: portrait)");
    const handleChange = () => setPortrait(isPortrait());
    handleChange();
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [isMobile]);

  useEffect(() => {
    return () => {
      useInputStore.getState().actions.reset();
    };
  }, []);

  useEffect(() => {
    const handleMove = (ev: PointerEvent) => {
      if (ev.pointerId === leftPointerId.current) {
        updateStick("left", ev.clientX, ev.clientY);
      } else if (ev.pointerId === rightPointerId.current) {
        updateStick("right", ev.clientX, ev.clientY);
      }
    };
    const handleEnd = (ev: PointerEvent) => {
      if (ev.pointerId === leftPointerId.current) {
        releaseLeftStick();
        leftPointerId.current = null;
      } else if (ev.pointerId === rightPointerId.current) {
        releaseRightStick();
        rightPointerId.current = null;
      }
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };
  }, [releaseLeftStick, releaseRightStick]);

  if (!isMobile || screen !== "inGame" || upgradeOpen || pauseOpen) return null;

  const getOrigin = (side: StickSide) => {
    const ref = side === "left" ? leftBaseRef.current : rightBaseRef.current;
    if (!ref) return { x: 0, y: 0 };
    const rect = ref.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const beginStick = (side: StickSide, ev: ReactPointerEvent<HTMLDivElement>) => {
    setIsMobile(true);
    ev.preventDefault();
    if (side === "left" && leftPointerId.current !== null) return;
    if (side === "right" && rightPointerId.current !== null) return;
    const origin = getOrigin(side);
    if (side === "left") {
      leftPointerId.current = ev.pointerId;
      leftOrigin.current = origin;
    } else {
      rightPointerId.current = ev.pointerId;
      rightOrigin.current = origin;
    }
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    updateStick(side, ev.clientX, ev.clientY);
  };

  const updateStick = (side: StickSide, clientX: number, clientY: number) => {
    const pointerId = side === "left" ? leftPointerId.current : rightPointerId.current;
    if (pointerId === null) return;
    const origin = side === "left" ? leftOrigin.current : rightOrigin.current;
    const { x, y, magnitude } = clampStick(clientX - origin.x, clientY - origin.y);
    const state = { active: magnitude > 0.01, x, y, magnitude };
    if (side === "left") {
      updateLeftStick(state);
    } else {
      updateRightStick(state);
    }
  };

  const endStick = (side: StickSide, ev: ReactPointerEvent<HTMLDivElement>) => {
    const pointerId = side === "left" ? leftPointerId.current : rightPointerId.current;
    if (pointerId !== ev.pointerId) return;
    ev.preventDefault();
    ev.currentTarget.releasePointerCapture(ev.pointerId);
    if (side === "left") {
      leftPointerId.current = null;
      releaseLeftStick();
    } else {
      rightPointerId.current = null;
      releaseRightStick();
    }
  };

  return (
    <div className="touch-layer" aria-hidden="true">
      {portrait && (
        <div className="orientation-overlay">
          <div className="orientation-card">
            <div className="orientation-title">Rotate for landscape</div>
            <div className="orientation-copy">Quiet Quadrant plays best in landscape.</div>
          </div>
        </div>
      )}
      <div
        className="touch-zone left"
        onPointerDown={(ev) => beginStick("left", ev)}
        onPointerMove={(ev) => {
          ev.preventDefault();
          updateStick("left", ev.clientX, ev.clientY);
        }}
        onPointerUp={(ev) => endStick("left", ev)}
        onPointerCancel={(ev) => endStick("left", ev)}
      >
        <div className="touch-stick" ref={leftBaseRef}>
          <div className="stick-ring" />
          <div
            className="stick-thumb"
            style={{
              transform: `translate(calc(-50% + ${leftStick.x * STICK_RADIUS}px), calc(-50% + ${leftStick.y * STICK_RADIUS}px))`,
              opacity: leftStick.active ? 1 : 0.6,
            }}
          />
        </div>
      </div>
      <div
        className="touch-zone right"
        onPointerDown={(ev) => beginStick("right", ev)}
        onPointerMove={(ev) => {
          ev.preventDefault();
          updateStick("right", ev.clientX, ev.clientY);
        }}
        onPointerUp={(ev) => endStick("right", ev)}
        onPointerCancel={(ev) => endStick("right", ev)}
      >
        <div className="touch-stick" ref={rightBaseRef}>
          <div className="stick-ring" />
          <div
            className="stick-thumb"
            style={{
              transform: `translate(calc(-50% + ${rightStick.x * STICK_RADIUS}px), calc(-50% + ${rightStick.y * STICK_RADIUS}px))`,
              opacity: rightStick.active ? 1 : 0.6,
            }}
          />
        </div>
      </div>
    </div>
  );
};
