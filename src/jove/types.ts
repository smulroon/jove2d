// jove2d type definitions

/** Options for window creation, matching love.window.setMode flags */
export interface WindowFlags {
  fullscreen?: boolean;
  resizable?: boolean;
  borderless?: boolean;
  minwidth?: number;
  minheight?: number;
  highdpi?: boolean;
  vsync?: number;
  x?: number;
  y?: number;
}

/** Current window mode info returned by getMode() */
export interface WindowMode {
  width: number;
  height: number;
  flags: WindowFlags;
}

/** Game callbacks passed to jove.run() */
export interface GameCallbacks {
  load?(): void | Promise<void>;
  update?(dt: number): void;
  draw?(): void;
  quit?(): boolean | void;
  focus?(hasFocus: boolean): void;
  resize?(width: number, height: number): void;
  keypressed?(key: string, scancode: string, isRepeat: boolean): void;
  keyreleased?(key: string, scancode: string): void;
  mousepressed?(x: number, y: number, button: number, isTouch: boolean): void;
  mousereleased?(x: number, y: number, button: number, isTouch: boolean): void;
  mousemoved?(x: number, y: number, dx: number, dy: number): void;
  wheelmoved?(x: number, y: number): void;
  textinput?(text: string): void;
  filedropped?(path: string): void;
  visible?(visible: boolean): void;
  joystickadded?(joystick: import("./joystick.ts").Joystick): void;
  joystickremoved?(joystick: import("./joystick.ts").Joystick): void;
  joystickpressed?(joystick: import("./joystick.ts").Joystick, button: number): void;
  joystickreleased?(joystick: import("./joystick.ts").Joystick, button: number): void;
  joystickaxis?(joystick: import("./joystick.ts").Joystick, axis: number, value: number): void;
  joystickhat?(joystick: import("./joystick.ts").Joystick, hat: number, direction: string): void;
  gamepadpressed?(joystick: import("./joystick.ts").Joystick, button: string): void;
  gamepadreleased?(joystick: import("./joystick.ts").Joystick, button: string): void;
  gamepadaxis?(joystick: import("./joystick.ts").Joystick, axis: string, value: number): void;
}

/** Raw pixel data from a screenshot capture */
export interface ImageData {
  data: Uint8Array;
  width: number;
  height: number;
  format: string; // e.g. "rgba8888", "bgra8888"
}

/** Discriminated union of jove events */
export type JoveEvent =
  | { type: "quit" }
  | { type: "focus"; hasFocus: boolean }
  | { type: "resize"; width: number; height: number }
  | { type: "moved"; x: number; y: number }
  | { type: "minimized" }
  | { type: "maximized" }
  | { type: "restored" }
  | { type: "shown" }
  | { type: "hidden" }
  | { type: "close" }
  | { type: "keypressed"; key: string; scancode: string; isRepeat: boolean }
  | { type: "keyreleased"; key: string; scancode: string }
  | { type: "mousepressed"; x: number; y: number; button: number; clicks: number }
  | { type: "mousereleased"; x: number; y: number; button: number }
  | { type: "mousemoved"; x: number; y: number; dx: number; dy: number }
  | { type: "wheelmoved"; x: number; y: number }
  | { type: "textinput"; text: string }
  | { type: "filedropped"; path: string }
  | { type: "joystickadded"; instanceId: number }
  | { type: "joystickremoved"; instanceId: number }
  | { type: "joystickpressed"; instanceId: number; button: number }
  | { type: "joystickreleased"; instanceId: number; button: number }
  | { type: "joystickaxis"; instanceId: number; axis: number; value: number }
  | { type: "joystickhat"; instanceId: number; hat: number; direction: string }
  | { type: "gamepadpressed"; instanceId: number; button: string }
  | { type: "gamepadreleased"; instanceId: number; button: string }
  | { type: "gamepadaxis"; instanceId: number; axis: string; value: number };
