// jove2d entry point

export {
  init, quit, getVersion, run,
  window, graphics, keyboard, mouse,
  timer, filesystem, math, system, audio, event,
} from "./jove/index.ts";
export type { GameCallbacks, WindowFlags, WindowMode, JoveEvent, ImageData } from "./jove/types.ts";
export type { Font } from "./jove/font.ts";
export type { SpriteBatch, Mesh } from "./jove/graphics.ts";
export type { ParticleSystem } from "./jove/particles.ts";
export type { Shader } from "./jove/shader.ts";
export type { Source } from "./jove/audio.ts";

import * as jove from "./jove/index.ts";
export default jove;
