// jove2d hello example — creates a window for 2 seconds then exits

import { init, quit, createWindow, destroyWindow } from "../../src/jove/index.ts";
import { SDL_WINDOW_RESIZABLE } from "../../src/sdl/types.ts";

init();

const window = createWindow("Hello jove2d!", 800, 600, SDL_WINDOW_RESIZABLE);
console.log("Window created! Closing in 2 seconds...");

await Bun.sleep(2000);

destroyWindow(window);
quit();
console.log("Done.");
