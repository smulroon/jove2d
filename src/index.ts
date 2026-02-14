// jove2d entry point

export { init, quit, getVersion, run, window, graphics } from "./jove/index.ts";
export type { GameCallbacks, WindowFlags, WindowMode, JoveEvent, ImageData } from "./jove/types.ts";

import * as jove from "./jove/index.ts";
export default jove;
