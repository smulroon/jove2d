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

  // --- Surface / Screenshot ---

  // SDL_Surface* SDL_GetWindowSurface(SDL_Window* window)
  SDL_GetWindowSurface: {
    args: [FFIType.pointer],
    returns: FFIType.pointer,
  },
  // bool SDL_UpdateWindowSurface(SDL_Window* window)
  SDL_UpdateWindowSurface: {
    args: [FFIType.pointer],
    returns: FFIType.bool,
  },
  // bool SDL_SavePNG(SDL_Surface* surface, const char* file)
  SDL_SavePNG: {
    args: [FFIType.pointer, FFIType.cstring],
    returns: FFIType.bool,
  },
  // bool SDL_SaveBMP(SDL_Surface* surface, const char* file)
  SDL_SaveBMP: {
    args: [FFIType.pointer, FFIType.cstring],
    returns: FFIType.bool,
  },
  // SDL_Surface* SDL_DuplicateSurface(SDL_Surface* surface)
  SDL_DuplicateSurface: {
    args: [FFIType.pointer],
    returns: FFIType.pointer,
  },
  // void SDL_DestroySurface(SDL_Surface* surface)
  SDL_DestroySurface: {
    args: [FFIType.pointer],
    returns: FFIType.void,
  },
  // bool SDL_LockSurface(SDL_Surface* surface)
  SDL_LockSurface: {
    args: [FFIType.pointer],
    returns: FFIType.bool,
  },
  // void SDL_UnlockSurface(SDL_Surface* surface)
  SDL_UnlockSurface: {
    args: [FFIType.pointer],
    returns: FFIType.void,
  },

  // --- Renderer ---

  // SDL_Renderer* SDL_CreateRenderer(SDL_Window* window, const char* name)
  SDL_CreateRenderer: {
    args: [FFIType.pointer, FFIType.pointer],
    returns: FFIType.pointer,
  },
  // void SDL_DestroyRenderer(SDL_Renderer* renderer)
  SDL_DestroyRenderer: {
    args: [FFIType.pointer],
    returns: FFIType.void,
  },
  // bool SDL_SetRenderDrawColor(SDL_Renderer* renderer, u8 r, u8 g, u8 b, u8 a)
  SDL_SetRenderDrawColor: {
    args: [FFIType.pointer, FFIType.u8, FFIType.u8, FFIType.u8, FFIType.u8],
    returns: FFIType.bool,
  },
  // bool SDL_GetRenderDrawColor(SDL_Renderer* renderer, u8* r, u8* g, u8* b, u8* a)
  SDL_GetRenderDrawColor: {
    args: [FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer],
    returns: FFIType.bool,
  },
  // bool SDL_RenderClear(SDL_Renderer* renderer)
  SDL_RenderClear: {
    args: [FFIType.pointer],
    returns: FFIType.bool,
  },
  // bool SDL_RenderPresent(SDL_Renderer* renderer)
  SDL_RenderPresent: {
    args: [FFIType.pointer],
    returns: FFIType.bool,
  },
  // bool SDL_RenderPoint(SDL_Renderer* renderer, float x, float y)
  SDL_RenderPoint: {
    args: [FFIType.pointer, FFIType.f32, FFIType.f32],
    returns: FFIType.bool,
  },
  // bool SDL_RenderLine(SDL_Renderer* renderer, float x1, float y1, float x2, float y2)
  SDL_RenderLine: {
    args: [FFIType.pointer, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32],
    returns: FFIType.bool,
  },
  // bool SDL_RenderLines(SDL_Renderer* renderer, const SDL_FPoint* points, int count)
  SDL_RenderLines: {
    args: [FFIType.pointer, FFIType.pointer, FFIType.i32],
    returns: FFIType.bool,
  },
  // bool SDL_RenderRect(SDL_Renderer* renderer, const SDL_FRect* rect)
  SDL_RenderRect: {
    args: [FFIType.pointer, FFIType.pointer],
    returns: FFIType.bool,
  },
  // bool SDL_RenderFillRect(SDL_Renderer* renderer, const SDL_FRect* rect)
  SDL_RenderFillRect: {
    args: [FFIType.pointer, FFIType.pointer],
    returns: FFIType.bool,
  },
  // bool SDL_RenderGeometry(SDL_Renderer* renderer, SDL_Texture* texture, const SDL_Vertex* vertices, int num_vertices, const int* indices, int num_indices)
  SDL_RenderGeometry: {
    args: [FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.i32, FFIType.pointer, FFIType.i32],
    returns: FFIType.bool,
  },
  // bool SDL_SetRenderDrawBlendMode(SDL_Renderer* renderer, SDL_BlendMode blendMode)
  SDL_SetRenderDrawBlendMode: {
    args: [FFIType.pointer, FFIType.u32],
    returns: FFIType.bool,
  },
  // bool SDL_RenderDebugText(SDL_Renderer* renderer, float x, float y, const char* str)
  SDL_RenderDebugText: {
    args: [FFIType.pointer, FFIType.f32, FFIType.f32, FFIType.cstring],
    returns: FFIType.bool,
  },
  // SDL_Surface* SDL_RenderReadPixels(SDL_Renderer* renderer, const SDL_Rect* rect)
  SDL_RenderReadPixels: {
    args: [FFIType.pointer, FFIType.pointer],
    returns: FFIType.pointer,
  },

  // --- Keyboard ---

  // const bool* SDL_GetKeyboardState(int* numkeys)
  SDL_GetKeyboardState: {
    args: [FFIType.pointer],
    returns: FFIType.pointer,
  },
  // const char* SDL_GetKeyName(SDL_Keycode key)
  SDL_GetKeyName: {
    args: [FFIType.u32],
    returns: FFIType.cstring,
  },
  // SDL_Keycode SDL_GetKeyFromScancode(SDL_Scancode scancode, SDL_Keymod modstate, bool key_event)
  SDL_GetKeyFromScancode: {
    args: [FFIType.i32, FFIType.u16, FFIType.bool],
    returns: FFIType.u32,
  },

  // --- Mouse ---

  // SDL_MouseButtonFlags SDL_GetMouseState(float* x, float* y)
  SDL_GetMouseState: {
    args: [FFIType.pointer, FFIType.pointer],
    returns: FFIType.u32,
  },
  // void SDL_WarpMouseInWindow(SDL_Window* window, float x, float y)
  SDL_WarpMouseInWindow: {
    args: [FFIType.pointer, FFIType.f32, FFIType.f32],
    returns: FFIType.void,
  },
});

export default sdl;
