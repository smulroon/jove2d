// jove2d entry point

import { init, quit, getVersion } from "./jove/index.ts";

init();
console.log(`SDL3 initialized successfully! (version ${getVersion()})`);
quit();
