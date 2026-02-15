// SDL3 TypeScript type definitions

import type { Pointer } from "bun:ffi";

/** Opaque pointer to an SDL_Window */
export type SDLWindow = Pointer;

/** Opaque pointer to an SDL_Surface */
export type SDLSurface = Pointer;

// SDL_Surface struct offsets (64-bit Linux x86-64, from SDL_surface.h)
// flags(u32,0) format(u32,4) w(i32,8) h(i32,12) pitch(i32,16) [4-byte pad] pixels(ptr,24)
export const SDL_SURFACE_OFFSET_W = 8;
export const SDL_SURFACE_OFFSET_H = 12;
export const SDL_SURFACE_OFFSET_PITCH = 16;
export const SDL_SURFACE_OFFSET_PIXELS = 24;
export const SDL_SURFACE_OFFSET_FORMAT = 4;

/** SDL_InitFlags (Uint32) */
export const SDL_INIT_AUDIO = 0x00000010;
export const SDL_INIT_VIDEO = 0x00000020;
export const SDL_INIT_JOYSTICK = 0x00000200;
export const SDL_INIT_HAPTIC = 0x00001000;
export const SDL_INIT_GAMEPAD = 0x00002000;
export const SDL_INIT_EVENTS = 0x00004000;
export const SDL_INIT_SENSOR = 0x00008000;
export const SDL_INIT_CAMERA = 0x00010000;

/** SDL_WindowFlags (Uint64) — using bigint for 64-bit flags */
export const SDL_WINDOW_FULLSCREEN = 0x0000000000000001n;
export const SDL_WINDOW_OPENGL = 0x0000000000000002n;
export const SDL_WINDOW_HIDDEN = 0x0000000000000008n;
export const SDL_WINDOW_BORDERLESS = 0x0000000000000010n;
export const SDL_WINDOW_RESIZABLE = 0x0000000000000020n;
export const SDL_WINDOW_MINIMIZED = 0x0000000000000040n;
export const SDL_WINDOW_MAXIMIZED = 0x0000000000000080n;
export const SDL_WINDOW_HIGH_PIXEL_DENSITY = 0x0000000000002000n;
export const SDL_WINDOW_ALWAYS_ON_TOP = 0x0000000000010000n;
export const SDL_WINDOW_INPUT_FOCUS = 0x0000000000000200n;
export const SDL_WINDOW_MOUSE_FOCUS = 0x0000000000000400n;
export const SDL_WINDOW_VULKAN = 0x0000000010000000n;

/** SDL_FlashOperation constants */
export const SDL_FLASH_CANCEL = 0;
export const SDL_FLASH_BRIEFLY = 1;
export const SDL_FLASH_UNTIL_FOCUSED = 2;

/** SDL_MessageBoxFlags constants */
export const SDL_MESSAGEBOX_ERROR = 0x10;
export const SDL_MESSAGEBOX_WARNING = 0x20;
export const SDL_MESSAGEBOX_INFORMATION = 0x40;

/** SDL_WINDOWPOS_CENTERED */
export const SDL_WINDOWPOS_CENTERED = 0x2fff0000;

/** SDL3 Event type constants */
export const SDL_EVENT_QUIT = 0x100;
export const SDL_EVENT_WINDOW_SHOWN = 0x202;
export const SDL_EVENT_WINDOW_HIDDEN = 0x203;
export const SDL_EVENT_WINDOW_EXPOSED = 0x204;
export const SDL_EVENT_WINDOW_MOVED = 0x205;
export const SDL_EVENT_WINDOW_RESIZED = 0x206;
export const SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED = 0x207;
export const SDL_EVENT_WINDOW_MINIMIZED = 0x209;
export const SDL_EVENT_WINDOW_MAXIMIZED = 0x20a;
export const SDL_EVENT_WINDOW_RESTORED = 0x20b;
export const SDL_EVENT_WINDOW_FOCUS_GAINED = 0x20e;
export const SDL_EVENT_WINDOW_FOCUS_LOST = 0x20f;
export const SDL_EVENT_WINDOW_CLOSE_REQUESTED = 0x210;

/** Keyboard event constants */
export const SDL_EVENT_KEY_DOWN = 0x300;
export const SDL_EVENT_KEY_UP = 0x301;
export const SDL_EVENT_TEXT_INPUT = 0x303;

/** Mouse event constants */
export const SDL_EVENT_MOUSE_MOTION = 0x400;
export const SDL_EVENT_MOUSE_BUTTON_DOWN = 0x401;
export const SDL_EVENT_MOUSE_BUTTON_UP = 0x402;
export const SDL_EVENT_MOUSE_WHEEL = 0x403;

/** Size of SDL_Event union in bytes */
export const SDL_EVENT_SIZE = 128;

/** SDL_KeyboardEvent struct offsets (x86-64) */
export const SDL_KEYBOARD_EVENT_SCANCODE = 24;
export const SDL_KEYBOARD_EVENT_KEY = 28;
export const SDL_KEYBOARD_EVENT_MOD = 32;
export const SDL_KEYBOARD_EVENT_DOWN = 36;
export const SDL_KEYBOARD_EVENT_REPEAT = 37;

/** SDL_MouseMotionEvent struct offsets */
export const SDL_MOUSE_MOTION_STATE = 24;
export const SDL_MOUSE_MOTION_X = 28;
export const SDL_MOUSE_MOTION_Y = 32;
export const SDL_MOUSE_MOTION_XREL = 36;
export const SDL_MOUSE_MOTION_YREL = 40;

/** SDL_MouseButtonEvent struct offsets */
export const SDL_MOUSE_BUTTON_BUTTON = 24;
export const SDL_MOUSE_BUTTON_DOWN = 25;
export const SDL_MOUSE_BUTTON_CLICKS = 26;
export const SDL_MOUSE_BUTTON_X = 28;
export const SDL_MOUSE_BUTTON_Y = 32;

/** SDL_MouseWheelEvent struct offsets */
export const SDL_MOUSE_WHEEL_X = 24;
export const SDL_MOUSE_WHEEL_Y = 28;
export const SDL_MOUSE_WHEEL_DIR = 32;

/** SDL_BlendMode constants */
export const SDL_BLENDMODE_NONE = 0x00000000;
export const SDL_BLENDMODE_BLEND = 0x00000001;
export const SDL_BLENDMODE_ADD = 0x00000002;
export const SDL_BLENDMODE_MOD = 0x00000004;
export const SDL_BLENDMODE_MUL = 0x00000008;

/** SDL_FlipMode constants */
export const SDL_FLIP_NONE = 0;
export const SDL_FLIP_HORIZONTAL = 1;
export const SDL_FLIP_VERTICAL = 2;

/** SDL_TextureAccess constants */
export const SDL_TEXTUREACCESS_STATIC = 0;
export const SDL_TEXTUREACCESS_STREAMING = 1;
export const SDL_TEXTUREACCESS_TARGET = 2;

/** SDL_ScaleMode constants */
export const SDL_SCALEMODE_NEAREST = 0;
export const SDL_SCALEMODE_LINEAR = 1;

/** SDL_PixelFormat constants */
export const SDL_PIXELFORMAT_RGBA8888 = 0x16362004;
export const SDL_PIXELFORMAT_ARGB8888 = 0x16862004;
export const SDL_PIXELFORMAT_ABGR8888 = 0x16462004;

/** SDL_TextInputEvent offsets (x86-64) — text pointer at offset 24 */
export const SDL_TEXT_INPUT_TEXT = 24;

/** SDL_DropEvent offsets (x86-64) */
export const SDL_EVENT_DROP_FILE = 0x1000;
export const SDL_EVENT_DROP_TEXT = 0x1001;
export const SDL_EVENT_DROP_BEGIN = 0x1002;
export const SDL_EVENT_DROP_COMPLETE = 0x1003;
export const SDL_DROP_EVENT_SOURCE = 32;
export const SDL_DROP_EVENT_DATA = 40;

/** SDL audio constants */
export const SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK = 0xFFFFFFFF;
export const SDL_AUDIO_S16 = 0x8010;
export const SDL_AUDIO_F32 = 0x8120;

/** SDL_PowerState constants */
export const SDL_POWERSTATE_ERROR = -1;
export const SDL_POWERSTATE_UNKNOWN = 0;
export const SDL_POWERSTATE_ON_BATTERY = 1;
export const SDL_POWERSTATE_NO_BATTERY = 2;
export const SDL_POWERSTATE_CHARGING = 3;
export const SDL_POWERSTATE_CHARGED = 4;

/** VSync constants */
export const SDL_RENDERER_VSYNC_DISABLED = 0;
export const SDL_RENDERER_VSYNC_ADAPTIVE = -1;

/** Opaque pointer to an SDL_Renderer */
export type SDLRenderer = Pointer;

/** Opaque pointer to an SDL_Texture */
export type SDLTexture = Pointer;

/**
 * SDL scancode → love2d-style key name mapping.
 * Based on SDL_Scancode enum values.
 */
export const SCANCODE_NAMES: Record<number, string> = {
  4: "a", 5: "b", 6: "c", 7: "d", 8: "e", 9: "f", 10: "g", 11: "h",
  12: "i", 13: "j", 14: "k", 15: "l", 16: "m", 17: "n", 18: "o", 19: "p",
  20: "q", 21: "r", 22: "s", 23: "t", 24: "u", 25: "v", 26: "w", 27: "x",
  28: "y", 29: "z",
  30: "1", 31: "2", 32: "3", 33: "4", 34: "5", 35: "6", 36: "7", 37: "8",
  38: "9", 39: "0",
  40: "return", 41: "escape", 42: "backspace", 43: "tab", 44: "space",
  45: "-", 46: "=", 47: "[", 48: "]", 49: "\\",
  51: ";", 52: "'", 53: "`", 54: ",", 55: ".", 56: "/",
  57: "capslock",
  58: "f1", 59: "f2", 60: "f3", 61: "f4", 62: "f5", 63: "f6",
  64: "f7", 65: "f8", 66: "f9", 67: "f10", 68: "f11", 69: "f12",
  70: "printscreen", 71: "scrolllock", 72: "pause",
  73: "insert", 74: "home", 75: "pageup",
  76: "delete", 77: "end", 78: "pagedown",
  79: "right", 80: "left", 81: "down", 82: "up",
  83: "numlock",
  84: "kp/", 85: "kp*", 86: "kp-", 87: "kp+", 88: "kpenter",
  89: "kp1", 90: "kp2", 91: "kp3", 92: "kp4", 93: "kp5",
  94: "kp6", 95: "kp7", 96: "kp8", 97: "kp9", 98: "kp0",
  99: "kp.",
  224: "lctrl", 225: "lshift", 226: "lalt", 227: "lgui",
  228: "rctrl", 229: "rshift", 230: "ralt", 231: "rgui",
};
