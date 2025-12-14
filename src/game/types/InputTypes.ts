/**
 * Input system type definitions
 */

export interface InputControls {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    fire: boolean;
    dash: boolean;
    move?: { x: number; y: number; lengthSq(): number };
    aim?: { x: number; y: number; lengthSq(): number; clone(): any };
    fireActive?: boolean;
    dashPressed?: boolean;
}

export type InputBinding =
    | {
          type: "keyboardMouse";
          label?: string;
          keyboard?: Record<string, string>;
          gamepad?: Record<string, number>;
      }
    | {
          type: "gamepad";
          id?: string;
          index?: number;
          label?: string;
          keyboard?: Record<string, string>;
          gamepad?: Record<string, number>;
      };

export interface PilotState {
    position: { x: number; y: number };
    sprite?: { x: number; y: number };
    lastAimDirection?: { clone(): any };
    [key: string]: unknown;
}

export interface InputState {
    controls: InputControls;
    binding: InputBinding;
    pilot?: PilotState;
    fireHeld?: boolean;
}
