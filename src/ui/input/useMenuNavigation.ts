import { useEffect, useMemo, useRef, useState } from "react";
import { useMenuControls } from "./useMenuControls";

export type MenuNavItem = {
  ref: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  lockHorizontal?: boolean;
  onAdjust?: (dir: -1 | 1) => void;
  onActivate?: () => void;
};

type NavOptions = {
  enabled: boolean;
  columns?: number;
  onBack?: () => void;
  loop?: boolean;
};

export function useMenuNavigation(items: MenuNavItem[], options: NavOptions) {
  const { enabled, columns = 1, onBack, loop = true } = options;
  const [index, setIndex] = useState(0);
  const controls = useMenuControls(enabled);
  const count = items.length;
  const focusTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const firstActive = items.findIndex((i) => !i.disabled);
    if (firstActive >= 0) {
      setIndex((prev) =>
        prev >= count || items[prev]?.disabled ? firstActive : prev
      );
    } else {
      setIndex(0);
    }
  }, [enabled, count]);

  const focusItem = (idx: number) => {
    const item = items[idx];
    if (!item || !item.ref.current) return;
    item.ref.current.focus({ preventScroll: true });
  };

  const isDisabled = (idx: number) =>
    idx < 0 || idx >= count ? true : items[idx]?.disabled === true;

  const moveIndex = (delta: number) => {
    if (count === 0) return;
    let next = index + delta;
    let guard = 0;
    while (isDisabled(next) && guard < count) {
      next += delta;
      if (loop) {
        next = (next + count) % count;
      } else {
        if (next < 0 || next >= count) return;
      }
      guard += 1;
    }
    if (!loop) {
      next = Math.max(0, Math.min(count - 1, next));
    } else {
      next = (next + count) % count;
    }
    setIndex(next);
    focusItem(next);
  };

  const moveGrid = (dx: number, dy: number) => {
    if (columns <= 1) {
      moveIndex(dx !== 0 ? dx : dy * columns);
      return;
    }
    if (dy !== 0) {
      moveIndex(dy * columns);
      return;
    }
    if (dx !== 0) {
      moveIndex(dx);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    const current = items[index];
    if (controls.back) {
      onBack?.();
      return;
    }

    if (controls.moveX !== 0 && current?.lockHorizontal && current.onAdjust) {
      current.onAdjust(controls.moveX as -1 | 1);
      return;
    }

    if (controls.moveX !== 0 || controls.moveY !== 0) {
      moveGrid(controls.moveX, controls.moveY);
      return;
    }

    if (controls.confirm) {
      current?.onActivate?.();
      return;
    }
  }, [controls, enabled, index, items, onBack, columns]);

  useEffect(() => {
    if (!enabled || count === 0) return;
    // Focus the current item when nav is enabled.
    if (focusTimer.current !== null) {
      clearTimeout(focusTimer.current);
    }
    focusTimer.current = window.setTimeout(() => {
      focusItem(index);
    }, 0);
    return () => {
      if (focusTimer.current !== null) {
        clearTimeout(focusTimer.current);
      }
    };
  }, [enabled, index, count]);

  return useMemo(
    () => ({
      focusedIndex: enabled ? index : -1,
      setIndex,
    }),
    [enabled, index]
  );
}
