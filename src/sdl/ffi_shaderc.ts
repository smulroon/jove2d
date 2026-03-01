// Shaderc FFI bindings (GLSL → SPIR-V compilation) via bun:ffi
// Separate from ffi.ts so the engine works even without the shaderc lib installed.

import { dlopen, FFIType } from "bun:ffi";
import { libPath } from "./lib-path";

let lib: ReturnType<typeof _load> | null = null;
let _tried = false;

function _load() {
  const { symbols } = dlopen(libPath("shaderc", "shaderc_jove"), {
    // void jove_shaderc_init()
    jove_shaderc_init: {
      args: [],
      returns: FFIType.void,
    },
    // void jove_shaderc_quit()
    jove_shaderc_quit: {
      args: [],
      returns: FFIType.void,
    },
    // int jove_shaderc_compile(const char* source, int len, int kind)
    jove_shaderc_compile: {
      args: [FFIType.cstring, FFIType.i32, FFIType.i32],
      returns: FFIType.i32,
    },
    // const char* jove_shaderc_get_bytes()
    jove_shaderc_get_bytes: {
      args: [],
      returns: FFIType.pointer,
    },
    // int jove_shaderc_get_length()
    jove_shaderc_get_length: {
      args: [],
      returns: FFIType.i32,
    },
    // const char* jove_shaderc_get_error()
    jove_shaderc_get_error: {
      args: [],
      returns: FFIType.cstring,
    },
  });
  return symbols;
}

/**
 * Try to load the shaderc library. Returns the symbols or null if unavailable.
 * Safe to call multiple times — caches the result.
 */
export function loadShaderc(): typeof lib {
  if (_tried) return lib;
  _tried = true;
  try {
    lib = _load();
  } catch {
    // Shaderc lib not available — engine falls back to glslangValidator CLI
    lib = null;
  }
  return lib;
}

export default loadShaderc;
