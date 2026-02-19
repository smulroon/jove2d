// Quick diagnostic: prints display and window info from SDL3
import * as jove from "../src/jove/index.ts";

jove.init();
jove.window.setMode(800, 600, { resizable: true });
jove.graphics._createRenderer();

const mode = jove.window.getMode();
const desktop = jove.window.getDesktopDimensions();
const dpiScale = jove.window.getDPIScale();
const [pixW, pixH] = jove.graphics.getPixelDimensions();

console.log("=== Display Info ===");
console.log(`Desktop dimensions: ${desktop.width} x ${desktop.height}`);
console.log(`DPI scale: ${dpiScale}`);
console.log(`Window logical size: ${mode.width} x ${mode.height}`);
console.log(`Window pixel size: ${pixW} x ${pixH}`);
console.log(`OS: ${jove.system.getOS()}`);

jove.quit();
