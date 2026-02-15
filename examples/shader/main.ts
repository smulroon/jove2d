// jove2d shader example — custom fragment shaders
//
// Demonstrates newShader, setShader/getShader, Shader:send, and sendColor.
// Three effects: color cycling, wave distortion, and vignette.

import jove from "../../src/index.ts";
import type { Canvas } from "../../src/jove/graphics.ts";
import type { Shader } from "../../src/jove/shader.ts";

let scene: Canvas | null = null;
let colorShader: Shader | null = null;
let waveShader: Shader | null = null;
let vignetteShader: Shader | null = null;
let t = 0;
let activeEffect = 0;
const effectNames = ["Color Cycle", "Wave Distort", "Vignette", "No Shader"];

await jove.run({
  async load() {
    jove.window.setTitle("Shader Example");
    jove.graphics.setBackgroundColor(20, 20, 30);

    // Create a scene to apply shaders to
    scene = jove.graphics.newCanvas(400, 300);

    // Effect 1: Color cycling — shifts RGB channels over time
    colorShader = await jove.graphics.newShader(`
      extern float time;
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          vec4 pixel = Texel(tex, tc);
          pixel.r *= 0.5 + 0.5 * sin(time);
          pixel.g *= 0.5 + 0.5 * sin(time + 2.094);
          pixel.b *= 0.5 + 0.5 * sin(time + 4.189);
          return pixel * color;
      }
    `);

    // Effect 2: Wave distortion
    waveShader = await jove.graphics.newShader(`
      extern float time;
      extern float amplitude;
      extern float frequency;
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          vec2 uv = tc;
          uv.x += sin(uv.y * frequency + time) * amplitude;
          uv.y += cos(uv.x * frequency + time * 0.7) * amplitude;
          return Texel(tex, uv) * color;
      }
    `);
    if (waveShader) {
      waveShader.send("amplitude", 0.02);
      waveShader.send("frequency", 15.0);
    }

    // Effect 3: Vignette with tint
    vignetteShader = await jove.graphics.newShader(`
      extern float radius;
      extern float softness;
      extern vec4 tintColor;
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          vec4 pixel = Texel(tex, tc);
          vec2 center = vec2(0.5, 0.5);
          float dist = distance(tc, center);
          float vignette = smoothstep(radius, radius - softness, dist);
          pixel.rgb *= vignette;
          pixel.rgb = mix(pixel.rgb, tintColor.rgb * pixel.rgb, tintColor.a);
          return pixel * color;
      }
    `);
    if (vignetteShader) {
      vignetteShader.send("radius", 0.75);
      vignetteShader.send("softness", 0.45);
      vignetteShader.send("tintColor", 1.0, 0.9, 0.7, 0.3);
    }

    if (!colorShader && !waveShader && !vignetteShader) {
      // GPU renderer not available
      activeEffect = 3; // no shader mode
    }
  },

  update(dt) {
    t += dt;

    // Update shader uniforms
    if (colorShader) colorShader.send("time", t * 2);
    if (waveShader) waveShader.send("time", t * 3);

    // Render scene to canvas
    if (scene) {
      jove.graphics.setCanvas(scene);
      jove.graphics.clear(40, 40, 60);

      // Draw some shapes
      jove.graphics.setColor(255, 100, 50);
      jove.graphics.rectangle("fill", 20, 20, 120, 80);

      jove.graphics.setColor(50, 200, 255);
      jove.graphics.circle("fill", 280, 80, 60);

      jove.graphics.setColor(100, 255, 100);
      jove.graphics.ellipse("fill", 200, 200, 80, 40);

      jove.graphics.setColor(255, 255, 100);
      jove.graphics.polygon("fill", 50, 200, 100, 260, 20, 280);

      jove.graphics.setColor(255, 255, 255);
      jove.graphics.print("Shader Demo", 140, 140);
      jove.graphics.print("Press 1-4 to switch effects", 100, 160);

      jove.graphics.setCanvas(null);
    }
  },

  draw() {
    if (!scene) return;

    const shaders = [colorShader, waveShader, vignetteShader, null];
    const shader = shaders[activeEffect];

    // Draw the scene with the active shader
    jove.graphics.setColor(255, 255, 255);
    if (shader) {
      jove.graphics.setShader(shader);
    }
    jove.graphics.draw(scene, 200, 120);
    if (shader) {
      jove.graphics.setShader(null);
    }

    // Draw without shader as reference (small, bottom-left)
    jove.graphics.draw(scene, 10, 440, 0, 0.35, 0.35);

    // HUD
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`Active effect: ${effectNames[activeEffect]}`, 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 10);
    jove.graphics.print("Press 1-4 to switch | ESC to quit", 10, 30);
    jove.graphics.print(`Time: ${t.toFixed(1)}s`, 10, 50);

    if (!colorShader) {
      jove.graphics.setColor(255, 80, 80);
      jove.graphics.print("GPU renderer not available — shaders disabled", 10, 70);
    }

    // Labels
    jove.graphics.setColor(150, 150, 150);
    jove.graphics.print("Original (no shader)", 10, 425);
    jove.graphics.rectangle("line", 200, 120, 400, 300);
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
    if (key === "1") activeEffect = 0;
    if (key === "2") activeEffect = 1;
    if (key === "3") activeEffect = 2;
    if (key === "4") activeEffect = 3;
  },
});
