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
}

export interface InputBinding {
  keyboard: Record<string, string>;
  gamepad: Record<string, number>;
}

export interface PilotState {
  position: { x: number; y: number };
  [key: string]: unknown;
}

export interface InputState {
  controls: InputControls;
  binding: InputBinding;
  pilot?: PilotState;
}
