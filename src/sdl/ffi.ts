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

  // --- Window properties ---

  // bool SDL_SetWindowTitle(SDL_Window* window, const char* title)
  SDL_SetWindowTitle: {
    args: [FFIType.pointer, FFIType.cstring],
    returns: FFIType.bool,
  },
  // const char* SDL_GetWindowTitle(SDL_Window* window)
  SDL_GetWindowTitle: {
    args: [FFIType.pointer],
    returns: FFIType.cstring,
  },
  // bool SDL_SetWindowSize(SDL_Window* window, int w, int h)
  SDL_SetWindowSize: {
    args: [FFIType.pointer, FFIType.i32, FFIType.i32],
    returns: FFIType.bool,
  },
  // bool SDL_GetWindowSize(SDL_Window* window, int* w, int* h)
  SDL_GetWindowSize: {
    args: [FFIType.pointer, FFIType.pointer, FFIType.pointer],
    returns: FFIType.bool,
  },
  // bool SDL_SetWindowPosition(SDL_Window* window, int x, int y)
  SDL_SetWindowPosition: {
    args: [FFIType.pointer, FFIType.i32, FFIType.i32],
    returns: FFIType.bool,
  },
  // bool SDL_GetWindowPosition(SDL_Window* window, int* x, int* y)
  SDL_GetWindowPosition: {
    args: [FFIType.pointer, FFIType.pointer, FFIType.pointer],
    returns: FFIType.bool,
  },

  // --- Window state ---

  // bool SDL_SetWindowFullscreen(SDL_Window* window, bool fullscreen)
  SDL_SetWindowFullscreen: {
    args: [FFIType.pointer, FFIType.bool],
    returns: FFIType.bool,
  },
  // SDL_WindowFlags SDL_GetWindowFlags(SDL_Window* window)
  SDL_GetWindowFlags: {
    args: [FFIType.pointer],
    returns: FFIType.u64,
  },
  // bool SDL_ShowWindow(SDL_Window* window)
  SDL_ShowWindow: {
    args: [FFIType.pointer],
    returns: FFIType.bool,
  },
  // bool SDL_HideWindow(SDL_Window* window)
  SDL_HideWindow: {
    args: [FFIType.pointer],
    returns: FFIType.bool,
  },
  // bool SDL_MaximizeWindow(SDL_Window* window)
  SDL_MaximizeWindow: {
    args: [FFIType.pointer],
    returns: FFIType.bool,
  },
  // bool SDL_MinimizeWindow(SDL_Window* window)
  SDL_MinimizeWindow: {
    args: [FFIType.pointer],
    returns: FFIType.bool,
  },
  // bool SDL_RestoreWindow(SDL_Window* window)
  SDL_RestoreWindow: {
    args: [FFIType.pointer],
    returns: FFIType.bool,
  },

  // --- Window limits ---

  // bool SDL_SetWindowMinimumSize(SDL_Window* window, int min_w, int min_h)
  SDL_SetWindowMinimumSize: {
    args: [FFIType.pointer, FFIType.i32, FFIType.i32],
    returns: FFIType.bool,
  },
  // bool SDL_GetWindowMinimumSize(SDL_Window* window, int* w, int* h)
  SDL_GetWindowMinimumSize: {
    args: [FFIType.pointer, FFIType.pointer, FFIType.pointer],
    returns: FFIType.bool,
  },

  // --- Display ---

  // float SDL_GetWindowDisplayScale(SDL_Window* window)
  SDL_GetWindowDisplayScale: {
    args: [FFIType.pointer],
    returns: FFIType.f32,
  },
  // SDL_DisplayID* SDL_GetDisplays(int* count)
  SDL_GetDisplays: {
    args: [FFIType.pointer],
    returns: FFIType.pointer,
  },
  // SDL_DisplayID SDL_GetPrimaryDisplay(void)
  SDL_GetPrimaryDisplay: {
    args: [],
    returns: FFIType.u32,
  },
  // bool SDL_GetDisplayBounds(SDL_DisplayID displayID, SDL_Rect* rect)
  SDL_GetDisplayBounds: {
    args: [FFIType.u32, FFIType.pointer],
    returns: FFIType.bool,
  },

  // --- Events ---

  // bool SDL_PollEvent(SDL_Event* event)
  SDL_PollEvent: {
    args: [FFIType.pointer],
    returns: FFIType.bool,
  },
});

export default sdl;
