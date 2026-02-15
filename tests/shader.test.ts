import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import sdl from "../src/sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../src/sdl/types.ts";
import * as window from "../src/jove/window.ts";
import * as graphics from "../src/jove/graphics.ts";
import {
  transpileFragmentShader,
  compileGLSLToSPIRV,
} from "../src/jove/shader.ts";
import type { Shader } from "../src/jove/shader.ts";

// ============================================================
// Transpiler tests (no renderer needed)
// ============================================================

describe("shader transpiler", () => {
  test("basic effect() extraction", () => {
    const result = transpileFragmentShader(`
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc) * color;
      }
    `);
    expect(result.glsl450).toContain("#version 450");
    expect(result.glsl450).toContain("layout(location = 0) in vec4 v_color");
    expect(result.glsl450).toContain("layout(location = 1) in vec2 v_uv");
    expect(result.glsl450).toContain("layout(location = 0) out vec4 o_color");
    expect(result.glsl450).toContain("sampler2D u_texture");
    expect(result.glsl450).toContain("texture(u_texture, tc)");
    expect(result.glsl450).not.toContain("Texel");
    expect(result.glsl450).toContain("o_color =");
    expect(result.uniforms).toHaveLength(0);
  });

  test("extern → uniform mapping with correct std140 offsets", () => {
    const result = transpileFragmentShader(`
      extern float time;
      extern vec2 resolution;
      extern vec4 tint;
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc) * color;
      }
    `);
    expect(result.uniforms).toHaveLength(3);

    // float: offset 0, size 4, align 4
    expect(result.uniforms[0].name).toBe("time");
    expect(result.uniforms[0].type).toBe("float");
    expect(result.uniforms[0].offset).toBe(0);
    expect(result.uniforms[0].size).toBe(4);

    // vec2: align 8, so offset 8 (not 4)
    expect(result.uniforms[1].name).toBe("resolution");
    expect(result.uniforms[1].type).toBe("vec2");
    expect(result.uniforms[1].offset).toBe(8);
    expect(result.uniforms[1].size).toBe(8);

    // vec4: align 16, so offset 16
    expect(result.uniforms[2].name).toBe("tint");
    expect(result.uniforms[2].type).toBe("vec4");
    expect(result.uniforms[2].offset).toBe(16);
    expect(result.uniforms[2].size).toBe(16);

    // Uniform block in output
    expect(result.glsl450).toContain("layout(std140, set = 3, binding = 0) uniform Uniforms");
    expect(result.glsl450).toContain("float time;");
    expect(result.glsl450).toContain("vec2 resolution;");
    expect(result.glsl450).toContain("vec4 tint;");
  });

  test("Texel() → texture() replacement", () => {
    const result = transpileFragmentShader(`
      vec4 effect(vec4 color, Image myTex, vec2 tc, vec2 sc) {
          vec4 a = Texel(myTex, tc);
          vec4 b = Texel(myTex, tc + vec2(0.01, 0.0));
          return (a + b) * 0.5 * color;
      }
    `);
    expect(result.glsl450).toContain("texture(u_texture, tc)");
    expect(result.glsl450).toContain("texture(u_texture, tc + vec2(0.01, 0.0))");
    expect(result.glsl450).not.toContain("Texel");
    expect(result.glsl450).not.toContain("myTex");
  });

  test("multiple externs of different types", () => {
    const result = transpileFragmentShader(`
      extern float brightness;
      extern int mode;
      extern vec3 lightDir;
      extern mat4 transform;
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc);
      }
    `);
    expect(result.uniforms).toHaveLength(4);

    expect(result.uniforms[0]).toMatchObject({ name: "brightness", type: "float", offset: 0, size: 4 });
    expect(result.uniforms[1]).toMatchObject({ name: "mode", type: "int", offset: 4, size: 4 });
    // vec3: align 16
    expect(result.uniforms[2]).toMatchObject({ name: "lightDir", type: "vec3", offset: 16, size: 12 });
    // mat4: align 16, after vec3 at offset 16+12=28 → align to 32
    expect(result.uniforms[3]).toMatchObject({ name: "transform", type: "mat4", offset: 32, size: 64 });
  });

  test("no-extern passthrough shader", () => {
    const result = transpileFragmentShader(`
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return color;
      }
    `);
    expect(result.uniforms).toHaveLength(0);
    expect(result.glsl450).not.toContain("uniform Uniforms");
    expect(result.glsl450).toContain("o_color = color");
  });

  test("helper functions are preserved", () => {
    const result = transpileFragmentShader(`
      extern float time;

      float wave(float x) {
          return sin(x * 6.28);
      }

      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          float w = wave(time);
          return Texel(tex, tc) * vec4(w, w, w, 1.0);
      }
    `);
    expect(result.glsl450).toContain("float wave(float x)");
    expect(result.glsl450).toContain("return sin(x * 6.28)");
  });

  test("raw GLSL 450 passthrough", () => {
    const raw = `#version 450
layout(location = 0) in vec4 v_color;
layout(location = 0) out vec4 o_color;
void main() { o_color = v_color; }`;
    const result = transpileFragmentShader(raw);
    expect(result.glsl450).toBe(raw);
    expect(result.uniforms).toHaveLength(0);
  });

  test("malformed shader throws error", () => {
    expect(() => transpileFragmentShader("not a valid shader")).toThrow(
      "Shader must define"
    );
  });

  test("screen_coords uses gl_FragCoord", () => {
    const result = transpileFragmentShader(`
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return vec4(sc.x, sc.y, 0.0, 1.0);
      }
    `);
    expect(result.glsl450).toContain("vec2 sc = gl_FragCoord.xy");
  });

  test("vec3 std140 alignment (16-byte aligned)", () => {
    const result = transpileFragmentShader(`
      extern vec3 a;
      extern float b;
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return color;
      }
    `);
    // vec3: offset 0, size 12, align 16
    expect(result.uniforms[0]).toMatchObject({ name: "a", offset: 0, size: 12 });
    // float after vec3: 0+12=12, align 4 → offset 12
    expect(result.uniforms[1]).toMatchObject({ name: "b", offset: 12, size: 4 });
  });
});

// ============================================================
// SPIR-V compilation tests
// ============================================================

describe("SPIR-V compilation", () => {
  test("compiles valid Vulkan GLSL 450 to SPIR-V", async () => {
    const glsl = `#version 450
layout(location = 0) in vec4 v_color;
layout(location = 1) in vec2 v_uv;
layout(location = 0) out vec4 o_color;
layout(set = 2, binding = 0) uniform sampler2D u_texture;
void main() {
    o_color = texture(u_texture, v_uv) * v_color;
}`;
    const spirv = await compileGLSLToSPIRV(glsl);
    expect(spirv).toBeInstanceOf(Uint8Array);
    expect(spirv.byteLength).toBeGreaterThan(0);

    // Check SPIR-V magic number (0x07230203)
    const view = new DataView(spirv.buffer, spirv.byteOffset, spirv.byteLength);
    expect(view.getUint32(0, true)).toBe(0x07230203);
  });

  test("compiles transpiled love2d shader to SPIR-V", async () => {
    const { glsl450 } = transpileFragmentShader(`
      extern float time;
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          vec4 pixel = Texel(tex, tc);
          pixel.r *= 0.5 + 0.5 * sin(time);
          return pixel * color;
      }
    `);
    const spirv = await compileGLSLToSPIRV(glsl450);
    expect(spirv.byteLength).toBeGreaterThan(0);
    const view = new DataView(spirv.buffer, spirv.byteOffset, spirv.byteLength);
    expect(view.getUint32(0, true)).toBe(0x07230203);
  });

  test("rejects invalid GLSL", async () => {
    const glsl = `#version 450
void main() { invalid_syntax; }`;
    await expect(compileGLSLToSPIRV(glsl)).rejects.toThrow();
  });
});

// ============================================================
// GPU renderer + Shader integration tests
// ============================================================

describe("shader GPU integration", () => {
  let gpuAvailable = false;

  beforeAll(() => {
    sdl.SDL_Init(SDL_INIT_VIDEO);
    window.setMode(640, 480);
    graphics._createRenderer();
    gpuAvailable = graphics._getGPUDevice() !== null;
  });

  afterAll(() => {
    graphics._destroyRenderer();
    window.close();
    sdl.SDL_Quit();
  });

  test("GPU renderer detected or gracefully unavailable", () => {
    // This test just documents whether the GPU renderer is available
    if (gpuAvailable) {
      expect(graphics._getGPUDevice()).not.toBeNull();
    } else {
      expect(graphics._getGPUDevice()).toBeNull();
    }
  });

  test("newShader returns null without GPU renderer", async () => {
    if (gpuAvailable) return; // skip if GPU is available
    const shader = await graphics.newShader(`
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc) * color;
      }
    `);
    expect(shader).toBeNull();
  });

  test("newShader creates a Shader object with GPU renderer", async () => {
    if (!gpuAvailable) return; // skip if GPU not available
    const shader = await graphics.newShader(`
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc) * color;
      }
    `);
    expect(shader).not.toBeNull();
    expect(shader!._isShader).toBe(true);
    expect(shader!._state).toBeTruthy();
    expect(shader!._gpuShader).toBeTruthy();
    shader!.release();
  });

  test("setShader/getShader round-trip", async () => {
    if (!gpuAvailable) return;
    const shader = await graphics.newShader(`
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc) * color;
      }
    `);
    expect(graphics.getShader()).toBeNull();
    graphics.setShader(shader);
    expect(graphics.getShader()).toBe(shader);
    graphics.setShader(null);
    expect(graphics.getShader()).toBeNull();
    shader!.release();
  });

  test("Shader:send for float", async () => {
    if (!gpuAvailable) return;
    const shader = await graphics.newShader(`
      extern float time;
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc) * color * time;
      }
    `);
    expect(shader!.hasUniform("time")).toBe(true);
    expect(shader!.hasUniform("nonexistent")).toBe(false);
    // Should not throw
    shader!.send("time", 1.5);
    shader!.release();
  });

  test("Shader:send for vec2 and vec4", async () => {
    if (!gpuAvailable) return;
    const shader = await graphics.newShader(`
      extern vec2 offset;
      extern vec4 tint;
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc + offset) * tint;
      }
    `);
    shader!.send("offset", 0.1, 0.2);
    shader!.send("tint", 1.0, 0.5, 0.0, 1.0);
    shader!.release();
  });

  test("Shader:sendColor", async () => {
    if (!gpuAvailable) return;
    const shader = await graphics.newShader(`
      extern vec4 myColor;
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc) * myColor;
      }
    `);
    // sendColor takes 0-255 range, converts to 0-1
    shader!.sendColor("myColor", 255, 128, 0, 255);
    shader!.release();
  });

  test("setShader(null) clears active shader", async () => {
    if (!gpuAvailable) return;
    const shader = await graphics.newShader(`
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc) * color;
      }
    `);
    graphics.setShader(shader);
    expect(graphics.getShader()).toBe(shader);
    graphics.setShader(null);
    expect(graphics.getShader()).toBeNull();
    shader!.release();
  });

  test("draw with active shader doesn't crash", async () => {
    if (!gpuAvailable) return;
    const shader = await graphics.newShader(`
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc) * color;
      }
    `);
    const canvas = graphics.newCanvas(64, 64);
    graphics.setShader(shader);
    // Should not throw
    graphics.draw(canvas!);
    graphics.setShader(null);
    canvas!.release();
    shader!.release();
  });

  test("reset() clears active shader", async () => {
    if (!gpuAvailable) return;
    const shader = await graphics.newShader(`
      vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
          return Texel(tex, tc) * color;
      }
    `);
    graphics.setShader(shader);
    expect(graphics.getShader()).not.toBeNull();
    graphics.reset();
    expect(graphics.getShader()).toBeNull();
    shader!.release();
  });
});
