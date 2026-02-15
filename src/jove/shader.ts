// jove2d shader module — love2d GLSL transpiler, SPIR-V compilation, Shader objects

import { ptr } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import { readFileSync } from "fs";
import sdl from "../sdl/ffi.ts";
import {
  GPU_SHADER_CREATE_INFO_SIZE,
  GPU_SHADER_OFFSET_CODE_SIZE,
  GPU_SHADER_OFFSET_CODE,
  GPU_SHADER_OFFSET_ENTRYPOINT,
  GPU_SHADER_OFFSET_FORMAT,
  GPU_SHADER_OFFSET_STAGE,
  GPU_SHADER_OFFSET_NUM_SAMPLERS,
  GPU_SHADER_OFFSET_NUM_STORAGE_TEX,
  GPU_SHADER_OFFSET_NUM_STORAGE_BUF,
  GPU_SHADER_OFFSET_NUM_UNIFORM_BUF,
  GPU_RENDER_STATE_CREATE_INFO_SIZE,
  GPU_RENDER_STATE_OFFSET_SHADER,
  SDL_GPU_SHADERFORMAT_SPIRV,
  SDL_GPU_SHADERSTAGE_FRAGMENT,
} from "../sdl/types.ts";

// ============================================================
// Types
// ============================================================

export interface UniformInfo {
  name: string;
  type: string; // "float" | "vec2" | "vec3" | "vec4" | "int" | "mat4"
  offset: number; // byte offset in std140 layout
  size: number; // byte size
}

export interface Shader {
  _isShader: true;
  _state: Pointer; // SDL_GPURenderState*
  _gpuShader: Pointer; // SDL_GPUShader*
  _uniformBuf: DataView; // backing buffer for uniform data
  _uniformMap: Map<string, UniformInfo>;
  _uniformSize: number; // total uniform buffer size in bytes
  send(name: string, ...values: number[]): void;
  sendColor(name: string, r: number, g: number, b: number, a?: number): void;
  hasUniform(name: string): boolean;
  release(): void;
}

interface TranspileResult {
  glsl450: string;
  uniforms: UniformInfo[];
}

// ============================================================
// Std140 layout rules
// ============================================================

const STD140: Record<string, { size: number; align: number }> = {
  float: { size: 4, align: 4 },
  int: { size: 4, align: 4 },
  bool: { size: 4, align: 4 },
  vec2: { size: 8, align: 8 },
  vec3: { size: 12, align: 16 },
  vec4: { size: 16, align: 16 },
  mat4: { size: 64, align: 16 },
};

function _computeStd140Layout(uniforms: UniformInfo[]): number {
  let offset = 0;
  for (const u of uniforms) {
    const layout = STD140[u.type];
    if (!layout) throw new Error(`Unsupported uniform type: ${u.type}`);
    // Align up
    offset = Math.ceil(offset / layout.align) * layout.align;
    u.offset = offset;
    u.size = layout.size;
    offset += layout.size;
  }
  // Round total size up to 16-byte alignment (UBO requirement)
  return offset > 0 ? Math.ceil(offset / 16) * 16 : 0;
}

// ============================================================
// Love2d GLSL → Vulkan GLSL 450 transpiler
// ============================================================

/** Extract the content between matching braces starting at the opening brace. */
function _extractBraceBlock(code: string, openBraceIndex: number): string {
  let depth = 0;
  let start = -1;
  for (let i = openBraceIndex; i < code.length; i++) {
    if (code[i] === "{") {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (code[i] === "}") {
      depth--;
      if (depth === 0) {
        return code.substring(start, i);
      }
    }
  }
  throw new Error("Unmatched braces in shader code");
}

/**
 * Transpile love2d-style GLSL fragment shader to Vulkan GLSL 450.
 *
 * If the input starts with `#version`, it is assumed to be raw GLSL 450
 * and is passed through without transpilation (uniforms must be empty).
 */
export function transpileFragmentShader(loveGLSL: string): TranspileResult {
  const trimmed = loveGLSL.trim();

  // Raw GLSL 450 passthrough
  if (trimmed.startsWith("#version")) {
    return { glsl450: trimmed, uniforms: [] };
  }

  // Step 1: Extract and remove extern declarations
  const uniforms: UniformInfo[] = [];
  const externRegex = /^\s*extern\s+(\w+)\s+(\w+)\s*;/gm;
  let cleanCode = trimmed.replace(externRegex, (_match, type, name) => {
    uniforms.push({ name, type, offset: 0, size: 0 });
    return "";
  });

  // Compute std140 layout
  const totalSize = _computeStd140Layout(uniforms);

  // Step 2: Find effect() function
  const effectRegex =
    /vec4\s+effect\s*\(\s*vec4\s+(\w+)\s*,\s*Image\s+(\w+)\s*,\s*vec2\s+(\w+)\s*,\s*vec2\s+(\w+)\s*\)/;
  const effectMatch = cleanCode.match(effectRegex);
  if (!effectMatch) {
    throw new Error(
      "Shader must define: vec4 effect(vec4 color, Image tex, vec2 texture_coords, vec2 screen_coords)"
    );
  }

  const [fullSig, colorParam, texParam, tcParam, scParam] = effectMatch;

  // Step 3: Extract body using brace counting
  const effectStart = cleanCode.indexOf(fullSig);
  const bodyStart = cleanCode.indexOf("{", effectStart + fullSig.length);
  if (bodyStart === -1) throw new Error("Missing opening brace for effect()");
  const body = _extractBraceBlock(cleanCode, bodyStart);

  // Step 4: Extract helper code (everything before effect(), minus extern lines)
  const helperCode = cleanCode.substring(0, effectStart).trim();

  // Step 5: Apply replacements in body
  let processedBody = body;
  // Replace Texel(texParam, ...) → texture(u_texture, ...)
  const texelRegex = new RegExp(
    `Texel\\s*\\(\\s*${texParam}\\s*,`,
    "g"
  );
  processedBody = processedBody.replace(texelRegex, "texture(u_texture,");

  // Replace `return expr;` → `o_color = expr;` only in the effect body
  processedBody = processedBody.replace(
    /\breturn\s+(.+?)\s*;/g,
    "o_color = $1;"
  );

  // Step 6: Generate Vulkan GLSL 450
  let glsl = `#version 450\n\n`;
  glsl += `// Vertex shader outputs (fixed by SDL3 GPU renderer)\n`;
  glsl += `layout(location = 0) in vec4 v_color;\n`;
  glsl += `layout(location = 1) in vec2 v_uv;\n\n`;
  glsl += `// Fragment output\n`;
  glsl += `layout(location = 0) out vec4 o_color;\n\n`;
  glsl += `// Drawable texture (bound by SDL at set=2, binding=0)\n`;
  glsl += `layout(set = 2, binding = 0) uniform sampler2D u_texture;\n\n`;

  // Uniform block
  if (uniforms.length > 0) {
    glsl += `// User uniforms (set via Shader:send)\n`;
    glsl += `layout(std140, set = 3, binding = 0) uniform Uniforms {\n`;
    for (const u of uniforms) {
      glsl += `    ${u.type} ${u.name};\n`;
    }
    glsl += `};\n\n`;
  }

  // Helper code (user-defined functions)
  if (helperCode.length > 0) {
    glsl += helperCode + "\n\n";
  }

  // Main function wrapping effect body
  glsl += `void main() {\n`;
  glsl += `    vec4 ${colorParam} = v_color;\n`;
  glsl += `    vec2 ${tcParam} = v_uv;\n`;
  glsl += `    vec2 ${scParam} = gl_FragCoord.xy;\n`;
  glsl += processedBody + "\n";
  glsl += `}\n`;

  return { glsl450: glsl, uniforms };
}

// ============================================================
// SPIR-V compilation (WASM glslang with CLI fallback)
// ============================================================

// Check if glslangValidator CLI is available (cached)
let _cliAvailable: boolean | null = null;

function _hasGlslangCLI(): boolean {
  if (_cliAvailable !== null) return _cliAvailable;
  try {
    const result = Bun.spawnSync(["glslangValidator", "--version"]);
    _cliAvailable = result.exitCode === 0;
  } catch {
    _cliAvailable = false;
  }
  return _cliAvailable;
}

async function _compileWithCLI(glsl: string): Promise<Uint8Array> {
  const tmpDir = "/tmp";
  const id = `jove2d-shader-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fragPath = `${tmpDir}/${id}.frag`;
  const spvPath = `${tmpDir}/${id}.spv`;

  try {
    await Bun.write(fragPath, glsl);
    const proc = Bun.spawnSync([
      "glslangValidator",
      "-V",
      fragPath,
      "-o",
      spvPath,
    ]);
    if (proc.exitCode !== 0) {
      const stderr = proc.stderr.toString();
      throw new Error(`GLSL compilation failed:\n${stderr}`);
    }
    const spirv = readFileSync(spvPath);
    return new Uint8Array(spirv);
  } finally {
    try { require("fs").unlinkSync(fragPath); } catch {}
    try { require("fs").unlinkSync(spvPath); } catch {}
  }
}

/** Compile Vulkan GLSL 450 fragment shader to SPIR-V bytecode. */
export async function compileGLSLToSPIRV(
  glsl: string
): Promise<Uint8Array> {
  if (!_hasGlslangCLI()) {
    throw new Error(
      "glslangValidator not found. Install with: sudo apt install glslang-tools"
    );
  }
  return _compileWithCLI(glsl);
}

// ============================================================
// Shader object creation
// ============================================================

// Persistent "main\0" string for entrypoint
const _mainEntrypoint = Buffer.from("main\0");
const _mainEntrypointPtr = ptr(_mainEntrypoint);

/**
 * Create a shader from love2d-style GLSL fragment code.
 *
 * @param fragmentCode - Love2d GLSL dialect or raw Vulkan GLSL 450
 * @param renderer - SDL_Renderer* (must be GPU renderer)
 * @param gpuDevice - SDL_GPUDevice*
 * @returns Shader object, or null if compilation fails
 */
export async function createShader(
  fragmentCode: string,
  renderer: Pointer,
  gpuDevice: Pointer
): Promise<Shader> {
  // Step 1: Transpile love2d GLSL → Vulkan GLSL 450
  const { glsl450, uniforms } = transpileFragmentShader(fragmentCode);

  // Step 2: Compile to SPIR-V
  const spirvBytes = await compileGLSLToSPIRV(glsl450);

  // Step 3: Build SDL_GPUShaderCreateInfo struct
  const hasUniforms = uniforms.length > 0;
  const totalUniformSize = hasUniforms ? _computeStd140Layout(uniforms) : 0;
  const shaderInfoBuf = new ArrayBuffer(GPU_SHADER_CREATE_INFO_SIZE);
  const shaderInfoView = new DataView(shaderInfoBuf);
  const shaderInfoArr = new Uint8Array(shaderInfoBuf);

  // Keep references alive during FFI call
  const spirvBuf = new Uint8Array(spirvBytes);
  const spirvPtr = ptr(spirvBuf);

  // code_size (size_t = u64 on 64-bit)
  shaderInfoView.setBigUint64(
    GPU_SHADER_OFFSET_CODE_SIZE,
    BigInt(spirvBuf.byteLength),
    true
  );
  // code (pointer)
  shaderInfoView.setBigUint64(
    GPU_SHADER_OFFSET_CODE,
    BigInt(spirvPtr as unknown as number),
    true
  );
  // entrypoint (pointer)
  shaderInfoView.setBigUint64(
    GPU_SHADER_OFFSET_ENTRYPOINT,
    BigInt(_mainEntrypointPtr as unknown as number),
    true
  );
  // format
  shaderInfoView.setUint32(
    GPU_SHADER_OFFSET_FORMAT,
    SDL_GPU_SHADERFORMAT_SPIRV,
    true
  );
  // stage
  shaderInfoView.setUint32(
    GPU_SHADER_OFFSET_STAGE,
    SDL_GPU_SHADERSTAGE_FRAGMENT,
    true
  );
  // num_samplers = 1 (main texture)
  shaderInfoView.setUint32(GPU_SHADER_OFFSET_NUM_SAMPLERS, 1, true);
  // num_storage_textures = 0
  shaderInfoView.setUint32(GPU_SHADER_OFFSET_NUM_STORAGE_TEX, 0, true);
  // num_storage_buffers = 0
  shaderInfoView.setUint32(GPU_SHADER_OFFSET_NUM_STORAGE_BUF, 0, true);
  // num_uniform_buffers = 1 if we have uniforms
  shaderInfoView.setUint32(
    GPU_SHADER_OFFSET_NUM_UNIFORM_BUF,
    hasUniforms ? 1 : 0,
    true
  );

  // Create the GPU shader
  const gpuShader = sdl.SDL_CreateGPUShader(
    gpuDevice,
    ptr(shaderInfoArr)
  ) as Pointer | null;
  if (!gpuShader) {
    throw new Error(
      `SDL_CreateGPUShader failed: ${sdl.SDL_GetError()}`
    );
  }

  // Step 4: Build SDL_GPURenderStateCreateInfo struct
  const stateInfoBuf = new ArrayBuffer(GPU_RENDER_STATE_CREATE_INFO_SIZE);
  const stateInfoView = new DataView(stateInfoBuf);
  const stateInfoArr = new Uint8Array(stateInfoBuf);

  // fragment_shader (pointer)
  stateInfoView.setBigUint64(
    0, // GPU_RENDER_STATE_OFFSET_SHADER
    BigInt(gpuShader as unknown as number),
    true
  );
  // All other fields default to 0 (no additional samplers, storage, etc.)

  // Create the render state
  const renderState = sdl.SDL_CreateGPURenderState(
    renderer,
    ptr(stateInfoArr)
  ) as Pointer | null;
  if (!renderState) {
    sdl.SDL_ReleaseGPUShader(gpuDevice, gpuShader);
    throw new Error(
      `SDL_CreateGPURenderState failed: ${sdl.SDL_GetError()}`
    );
  }

  // Step 5: Build uniform map and buffer
  const uniformMap = new Map<string, UniformInfo>();
  for (const u of uniforms) {
    uniformMap.set(u.name, u);
  }

  const uniformBufArray = new ArrayBuffer(
    Math.max(totalUniformSize, 16)
  );
  const uniformBufView = new DataView(uniformBufArray);
  const uniformBufBytes = new Uint8Array(uniformBufArray);

  // Step 6: Build Shader object
  const shader: Shader = {
    _isShader: true,
    _state: renderState,
    _gpuShader: gpuShader,
    _uniformBuf: uniformBufView,
    _uniformMap: uniformMap,
    _uniformSize: totalUniformSize,

    send(name: string, ...values: number[]): void {
      const info = uniformMap.get(name);
      if (!info) return;

      _writeUniform(uniformBufView, info, values);

      // Push to GPU
      if (totalUniformSize > 0) {
        sdl.SDL_SetGPURenderStateFragmentUniforms(
          renderState,
          0,
          ptr(uniformBufBytes),
          totalUniformSize
        );
      }
    },

    sendColor(
      name: string,
      r: number,
      g: number,
      b: number,
      a?: number
    ): void {
      this.send(name, r / 255, g / 255, b / 255, (a ?? 255) / 255);
    },

    hasUniform(name: string): boolean {
      return uniformMap.has(name);
    },

    release(): void {
      sdl.SDL_DestroyGPURenderState(renderState);
      sdl.SDL_ReleaseGPUShader(gpuDevice, gpuShader);
    },
  };

  return shader;
}

// ============================================================
// Uniform buffer writing
// ============================================================

function _writeUniform(
  view: DataView,
  info: UniformInfo,
  values: number[]
): void {
  const { type, offset } = info;

  switch (type) {
    case "float":
      view.setFloat32(offset, values[0], true);
      break;
    case "int":
    case "bool":
      view.setInt32(offset, values[0], true);
      break;
    case "vec2":
      view.setFloat32(offset, values[0], true);
      view.setFloat32(offset + 4, values[1], true);
      break;
    case "vec3":
      view.setFloat32(offset, values[0], true);
      view.setFloat32(offset + 4, values[1], true);
      view.setFloat32(offset + 8, values[2], true);
      break;
    case "vec4":
      view.setFloat32(offset, values[0], true);
      view.setFloat32(offset + 4, values[1], true);
      view.setFloat32(offset + 8, values[2], true);
      view.setFloat32(offset + 12, values[3], true);
      break;
    case "mat4":
      for (let i = 0; i < 16; i++) {
        view.setFloat32(offset + i * 4, values[i], true);
      }
      break;
  }
}
