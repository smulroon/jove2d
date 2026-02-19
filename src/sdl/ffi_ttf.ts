// SDL3_ttf FFI bindings via bun:ffi
// Separate from ffi.ts so the engine works even without SDL_ttf installed.

import { dlopen, FFIType } from "bun:ffi";
import { libPath } from "./lib-path";

let ttf: ReturnType<typeof _load> | null = null;
let _tried = false;

function _load() {
  const { symbols } = dlopen(libPath("SDL_ttf", "SDL3_ttf"), {
    // bool TTF_Init(void)
    TTF_Init: {
      args: [],
      returns: FFIType.bool,
    },
    // void TTF_Quit(void)
    TTF_Quit: {
      args: [],
      returns: FFIType.void,
    },
    // TTF_Font* TTF_OpenFont(const char* file, float ptsize)
    TTF_OpenFont: {
      args: [FFIType.cstring, FFIType.f32],
      returns: FFIType.pointer,
    },
    // void TTF_CloseFont(TTF_Font* font)
    TTF_CloseFont: {
      args: [FFIType.pointer],
      returns: FFIType.void,
    },
    // bool TTF_SetFontSize(TTF_Font* font, float ptsize)
    TTF_SetFontSize: {
      args: [FFIType.pointer, FFIType.f32],
      returns: FFIType.bool,
    },
    // int TTF_GetFontHeight(const TTF_Font* font)
    TTF_GetFontHeight: {
      args: [FFIType.pointer],
      returns: FFIType.i32,
    },
    // int TTF_GetFontAscent(const TTF_Font* font)
    TTF_GetFontAscent: {
      args: [FFIType.pointer],
      returns: FFIType.i32,
    },
    // int TTF_GetFontDescent(const TTF_Font* font)
    TTF_GetFontDescent: {
      args: [FFIType.pointer],
      returns: FFIType.i32,
    },
    // int TTF_GetFontLineSkip(const TTF_Font* font)
    TTF_GetFontLineSkip: {
      args: [FFIType.pointer],
      returns: FFIType.i32,
    },
    // void TTF_SetFontLineSkip(TTF_Font* font, int lineskip)
    TTF_SetFontLineSkip: {
      args: [FFIType.pointer, FFIType.i32],
      returns: FFIType.void,
    },
    // bool TTF_GetStringSize(TTF_Font* font, const char* text, size_t length, int* w, int* h)
    TTF_GetStringSize: {
      args: [FFIType.pointer, FFIType.cstring, FFIType.u64, FFIType.pointer, FFIType.pointer],
      returns: FFIType.bool,
    },
    // bool TTF_GetStringSizeWrapped(TTF_Font* font, const char* text, size_t length, int wrap_width, int* w, int* h)
    TTF_GetStringSizeWrapped: {
      args: [FFIType.pointer, FFIType.cstring, FFIType.u64, FFIType.i32, FFIType.pointer, FFIType.pointer],
      returns: FFIType.bool,
    },
    // TTF_TextEngine* TTF_CreateRendererTextEngine(SDL_Renderer* renderer)
    TTF_CreateRendererTextEngine: {
      args: [FFIType.pointer],
      returns: FFIType.pointer,
    },
    // void TTF_DestroyRendererTextEngine(TTF_TextEngine* engine)
    TTF_DestroyRendererTextEngine: {
      args: [FFIType.pointer],
      returns: FFIType.void,
    },
    // TTF_Text* TTF_CreateText(TTF_TextEngine* engine, TTF_Font* font, const char* text, size_t length)
    TTF_CreateText: {
      args: [FFIType.pointer, FFIType.pointer, FFIType.cstring, FFIType.u64],
      returns: FFIType.pointer,
    },
    // void TTF_DestroyText(TTF_Text* text)
    TTF_DestroyText: {
      args: [FFIType.pointer],
      returns: FFIType.void,
    },
    // bool TTF_DrawRendererText(TTF_Text* text, float x, float y)
    TTF_DrawRendererText: {
      args: [FFIType.pointer, FFIType.f32, FFIType.f32],
      returns: FFIType.bool,
    },
    // bool TTF_SetTextColor(TTF_Text* text, Uint8 r, Uint8 g, Uint8 b, Uint8 a)
    TTF_SetTextColor: {
      args: [FFIType.pointer, FFIType.u8, FFIType.u8, FFIType.u8, FFIType.u8],
      returns: FFIType.bool,
    },
    // bool TTF_GetTextSize(TTF_Text* text, int* w, int* h)
    TTF_GetTextSize: {
      args: [FFIType.pointer, FFIType.pointer, FFIType.pointer],
      returns: FFIType.bool,
    },
    // bool TTF_SetTextWrapWidth(TTF_Text* text, int wrap_width)
    TTF_SetTextWrapWidth: {
      args: [FFIType.pointer, FFIType.i32],
      returns: FFIType.bool,
    },
    // bool TTF_SetTextWrapWhitespaceVisible(TTF_Text* text, bool visible)
    TTF_SetTextWrapWhitespaceVisible: {
      args: [FFIType.pointer, FFIType.bool],
      returns: FFIType.bool,
    },
  });
  return symbols;
}

/**
 * Try to load SDL_ttf. Returns the symbols or null if unavailable.
 * Safe to call multiple times — caches the result.
 */
export function loadTTF(): typeof ttf {
  if (_tried) return ttf;
  _tried = true;
  try {
    ttf = _load();
  } catch {
    // SDL_ttf not available — engine works without it
    ttf = null;
  }
  return ttf;
}

export default loadTTF;
