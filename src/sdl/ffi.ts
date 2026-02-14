// SDL3 FFI bindings via bun:ffi

import { dlopen, FFIType, ptr, toArrayBuffer, suffix } from "bun:ffi";
import { resolve } from "path";

const SDL3_LIB_PATH = resolve(
  import.meta.dir,
  "../../vendor/SDL3/install/lib/libSDL3.so"
);

const { symbols: sdl } = dlopen(SDL3_LIB_PATH, {
  // bool SDL_Init(SDL_InitFlags flags)
  SDL_Init: {
    args: [FFIType.u32],
    returns: FFIType.bool,
  },
  // void SDL_Quit(void)
  SDL_Quit: {
    args: [],
    returns: FFIType.void,
  },
  // int SDL_GetVersion(void)
  SDL_GetVersion: {
    args: [],
    returns: FFIType.i32,
  },
  // const char* SDL_GetError(void)
  SDL_GetError: {
    args: [],
    returns: FFIType.cstring,
  },
  // SDL_Window* SDL_CreateWindow(const char* title, int w, int h, SDL_WindowFlags flags)
  SDL_CreateWindow: {
    args: [FFIType.cstring, FFIType.i32, FFIType.i32, FFIType.u64],
    returns: FFIType.pointer,
  },
  // void SDL_DestroyWindow(SDL_Window* window)
  SDL_DestroyWindow: {
    args: [FFIType.pointer],
    returns: FFIType.void,
  },
});

export default sdl;
