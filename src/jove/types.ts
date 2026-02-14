// jove2d type definitions

/** Options for window creation, matching love.window.setMode flags */
export interface WindowFlags {
  fullscreen?: boolean;
  resizable?: boolean;
  borderless?: boolean;
  minwidth?: number;
  minheight?: number;
  highdpi?: boolean;
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
  | { type: "close" };
