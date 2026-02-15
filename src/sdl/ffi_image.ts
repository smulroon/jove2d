// SDL3_image FFI bindings via bun:ffi
// Separate from ffi.ts so the engine works even without SDL_image installed.

import { dlopen, FFIType } from "bun:ffi";
import { resolve } from "path";

const SDL_IMAGE_LIB_PATH = resolve(
  import.meta.dir,
  "../../vendor/SDL_image/install/lib/libSDL3_image.so"
);

let img: ReturnType<typeof _load> | null = null;
let _tried = false;

function _load() {
  const { symbols } = dlopen(SDL_IMAGE_LIB_PATH, {
    // SDL_Texture* IMG_LoadTexture(SDL_Renderer* renderer, const char* file)
    IMG_LoadTexture: {
      args: [FFIType.pointer, FFIType.cstring],
      returns: FFIType.pointer,
    },
    // SDL_Surface* IMG_Load(const char* file)
    IMG_Load: {
      args: [FFIType.cstring],
      returns: FFIType.pointer,
    },
  });
  return symbols;
}

/**
 * Try to load SDL_image. Returns the symbols or null if unavailable.
 * Safe to call multiple times — caches the result.
 */
export function loadImage(): typeof img {
  if (_tried) return img;
  _tried = true;
  try {
    img = _load();
  } catch {
    // SDL_image not available — engine works without it (BMP-only)
    img = null;
  }
  return img;
}

export default loadImage;
