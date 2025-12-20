import { useEffect, useRef, useState } from "react";

type MenuInput = {
    moveX: -1 | 0 | 1;
    moveY: -1 | 0 | 1;
    confirm: boolean;
    back: boolean;
    tabLeft: boolean;
    tabRight: boolean;
    serial: number;
};

const DEADZONE = 0.35;
const AXIS_REPEAT_DELAY_MS = 180;

const initialInput: MenuInput = {
    moveX: 0,
    moveY: 0,
    confirm: false,
    back: false,
    tabLeft: false,
    tabRight: false,
    serial: 0,
};

export function useMenuControls(enabled: boolean) {
    const [input, setInput] = useState<MenuInput>(initialInput);
    const lastAxisFire = useRef({ x: 0, y: 0, time: 0 });
    const rafRef = useRef<number | null>(null);
    const serialRef = useRef(0);
    const lastButtons = useRef({
        confirm: false,
        back: false,
        tabLeft: false,
        tabRight: false,
    });

    const readPadButtons = () => {
        const pads = navigator.getGamepads?.() ?? [];
        const pad = pads.find((p) => p && p.connected) ?? null;
        if (!pad) return null;
        const confirm =
            pad.buttons[0]?.pressed || // south
            pad.buttons[1]?.pressed || // east
            pad.buttons[5]?.pressed || // RB/R1
            pad.buttons[7]?.value > 0.3; // RT/R2
        const back =
            pad.buttons[1]?.pressed || // east (B on Xbox/Pro)
            pad.buttons[2]?.pressed || // west
            pad.buttons[8]?.pressed || // back/view/minus
            pad.buttons[16]?.pressed; // extra back on some pads
        const tabLeft = pad.buttons[4]?.pressed || pad.buttons[6]?.value > 0.3; // LB/L1 or LT/L2
        const tabRight = pad.buttons[5]?.pressed || pad.buttons[7]?.value > 0.3; // RB/R1 or RT/R2
        return { confirm, back, tabLeft, tabRight };
    };

    useEffect(() => {
        if (!enabled) {
            setInput(initialInput);
            return;
        }

        const snapshot = readPadButtons();
        if (snapshot) {
            lastButtons.current = snapshot;
        }

        const handleKey = (e: KeyboardEvent) => {
            if (!enabled || e.repeat) return;
            const bump = () => ++serialRef.current;
            switch (e.key) {
                case "ArrowLeft":
                case "a":
                case "A":
                    e.preventDefault();
                    setInput({ ...initialInput, moveX: -1, serial: bump() });
                    break;
                case "ArrowRight":
                case "d":
                case "D":
                    e.preventDefault();
                    setInput({ ...initialInput, moveX: 1, serial: bump() });
                    break;
                case "ArrowUp":
                case "w":
                case "W":
                    e.preventDefault();
                    setInput({ ...initialInput, moveY: -1, serial: bump() });
                    break;
                case "ArrowDown":
                case "s":
                case "S":
                    e.preventDefault();
                    setInput({ ...initialInput, moveY: 1, serial: bump() });
                    break;
                case "Escape":
                case "Backspace":
                    e.preventDefault();
                    setInput({ ...initialInput, back: true, serial: bump() });
                    break;
                case "Enter":
                case " ":
                    e.preventDefault();
                    setInput({
                        ...initialInput,
                        confirm: true,
                        serial: bump(),
                    });
                    break;
                case "Tab":
                    if (e.shiftKey) {
                        setInput({
                            ...initialInput,
                            tabLeft: true,
                            serial: bump(),
                        });
                    } else {
                        setInput({
                            ...initialInput,
                            tabRight: true,
                            serial: bump(),
                        });
                    }
                    e.preventDefault();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener("keydown", handleKey);
        return () => {
            window.removeEventListener("keydown", handleKey);
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled) {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            return;
        }

        const tick = (time: number) => {
            const pads = navigator.getGamepads?.() ?? [];
            const pad = pads.find((p) => p && p.connected) ?? null;
            if (pad) {
                const moveXRaw = pad.axes[0] ?? 0;
                const moveYRaw = pad.axes[1] ?? 0;
                const dpadX =
                    (pad.buttons[15]?.pressed ? 1 : 0) +
                    (pad.buttons[14]?.pressed ? -1 : 0);
                const dpadY =
                    (pad.buttons[13]?.pressed ? 1 : 0) +
                    (pad.buttons[12]?.pressed ? -1 : 0);
                const axisX =
                    Math.abs(moveXRaw) > DEADZONE ? Math.sign(moveXRaw) : 0;
                const axisY =
                    Math.abs(moveYRaw) > DEADZONE ? Math.sign(moveYRaw) : 0;
                const moveX = dpadX !== 0 ? dpadX : axisX;
                const moveY = dpadY !== 0 ? dpadY : axisY;

                const btnSnapshot = readPadButtons();
                const confirm = btnSnapshot?.confirm ?? false;
                const back = btnSnapshot?.back ?? false;
                const tabLeft = btnSnapshot?.tabLeft ?? false;
                const tabRight = btnSnapshot?.tabRight ?? false;

                const last = lastAxisFire.current;
                let emitX = 0;
                let emitY = 0;
                if (
                    moveX !== 0 &&
                    (last.x !== moveX ||
                        time - last.time > AXIS_REPEAT_DELAY_MS)
                ) {
                    emitX = moveX;
                    last.x = moveX;
                    last.time = time;
                } else if (moveX === 0) {
                    last.x = 0;
                }
                if (
                    moveY !== 0 &&
                    (last.y !== moveY ||
                        time - last.time > AXIS_REPEAT_DELAY_MS)
                ) {
                    emitY = moveY;
                    last.y = moveY;
                    last.time = time;
                } else if (moveY === 0) {
                    last.y = 0;
                }

                const confirmEdge = confirm && !lastButtons.current.confirm;
                const backEdge = back && !lastButtons.current.back;
                const tabLeftEdge = tabLeft && !lastButtons.current.tabLeft;
                const tabRightEdge = tabRight && !lastButtons.current.tabRight;

                lastButtons.current = {
                    confirm,
                    back,
                    tabLeft,
                    tabRight,
                };

                if (
                    emitX ||
                    emitY ||
                    confirmEdge ||
                    backEdge ||
                    tabLeftEdge ||
                    tabRightEdge
                ) {
                    setInput({
                        moveX: (emitX as -1 | 0 | 1) ?? 0,
                        moveY: (emitY as -1 | 0 | 1) ?? 0,
                        confirm: confirmEdge,
                        back: backEdge,
                        tabLeft: tabLeftEdge,
                        tabRight: tabRightEdge,
                        serial: ++serialRef.current,
                    });
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
    }, [enabled]);

    return input;
}
