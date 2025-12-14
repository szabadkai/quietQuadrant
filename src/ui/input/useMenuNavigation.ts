import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMenuControls } from './useMenuControls';

export type MenuNavItem = {
  ref: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  lockHorizontal?: boolean;
  onAdjust?: (dir: -1 | 1) => void;
  onActivate?: () => void;
  onFocus?: () => void;
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
  const lastSerial = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const firstActive = items.findIndex((i) => !i.disabled);
    if (firstActive >= 0) {
      setIndex((prev) => (prev >= count || items[prev]?.disabled ? firstActive : prev));
    } else {
      setIndex(0);
    }
  }, [enabled, count, items]);

  const focusItem = useCallback(
    (idx: number) => {
      const item = items[idx];
      if (!item) return;
      item.onFocus?.();
      const el = item.ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
    },
    [items]
  );

  const isDisabled = useCallback(
    (idx: number) => (idx < 0 || idx >= count ? true : items[idx]?.disabled === true),
    [count, items]
  );

  const moveIndex = useCallback(
    (delta: number) => {
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
      if (loop) {
        next = (next + count) % count;
      } else {
        next = Math.max(0, Math.min(count - 1, next));
      }
      setIndex(next);
      focusItem(next);
    },
    [count, index, isDisabled, loop, focusItem]
  );

  const moveGrid = useCallback(
    (dx: number, dy: number) => {
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
    },
    [columns, moveIndex]
  );

  useEffect(() => {
    if (!enabled) return;
    if (controls.serial === lastSerial.current) return;
    lastSerial.current = controls.serial;
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
  }, [controls, enabled, index, items, onBack, moveGrid]);

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
  }, [enabled, index, count, focusItem]);

  return useMemo(
    () => ({
      focusedIndex: enabled ? index : -1,
      setIndex,
    }),
    [enabled, index]
  );
}
