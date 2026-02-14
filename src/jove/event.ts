// jove2d event system — polls SDL events and returns typed JoveEvent objects

import { ptr, read } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import {
  SDL_EVENT_SIZE,
  SDL_EVENT_QUIT,
  SDL_EVENT_WINDOW_SHOWN,
  SDL_EVENT_WINDOW_HIDDEN,
  SDL_EVENT_WINDOW_MOVED,
  SDL_EVENT_WINDOW_RESIZED,
  SDL_EVENT_WINDOW_MINIMIZED,
  SDL_EVENT_WINDOW_MAXIMIZED,
  SDL_EVENT_WINDOW_RESTORED,
  SDL_EVENT_WINDOW_FOCUS_GAINED,
  SDL_EVENT_WINDOW_FOCUS_LOST,
  SDL_EVENT_WINDOW_CLOSE_REQUESTED,
  SDL_EVENT_KEY_DOWN,
  SDL_EVENT_KEY_UP,
  SDL_EVENT_MOUSE_MOTION,
  SDL_EVENT_MOUSE_BUTTON_DOWN,
  SDL_EVENT_MOUSE_BUTTON_UP,
  SDL_EVENT_MOUSE_WHEEL,
  SDL_KEYBOARD_EVENT_SCANCODE,
  SDL_KEYBOARD_EVENT_DOWN,
  SDL_KEYBOARD_EVENT_REPEAT,
  SDL_MOUSE_MOTION_X,
  SDL_MOUSE_MOTION_Y,
  SDL_MOUSE_MOTION_XREL,
  SDL_MOUSE_MOTION_YREL,
  SDL_MOUSE_BUTTON_BUTTON,
  SDL_MOUSE_BUTTON_DOWN,
  SDL_MOUSE_BUTTON_CLICKS,
  SDL_MOUSE_BUTTON_X,
  SDL_MOUSE_BUTTON_Y,
  SDL_MOUSE_WHEEL_X,
  SDL_MOUSE_WHEEL_Y,
  SCANCODE_NAMES,
} from "../sdl/types.ts";
import type { JoveEvent } from "./types.ts";

// Pre-allocate event buffer — reused every poll call.
// IMPORTANT: We must use read.u32/read.i32 from bun:ffi to read from the
// pointer, because ptr() returns a pointer to bun's internal copy of the
// buffer data — DataView on the JS-side ArrayBuffer sees stale data.
const eventBuffer = new Uint8Array(SDL_EVENT_SIZE);
const eventPtr = ptr(eventBuffer);

/** Poll all pending SDL events, returning typed JoveEvent array */
export function pollEvents(): JoveEvent[] {
  const events: JoveEvent[] = [];

  while (sdl.SDL_PollEvent(eventPtr)) {
    const eventType = read.u32(eventPtr, 0);
    const event = mapEvent(eventType, eventPtr);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

function mapEvent(eventType: number, p: Pointer): JoveEvent | null {
  switch (eventType) {
    case SDL_EVENT_QUIT:
      return { type: "quit" };

    case SDL_EVENT_WINDOW_CLOSE_REQUESTED:
      return { type: "close" };

    case SDL_EVENT_WINDOW_FOCUS_GAINED:
      return { type: "focus", hasFocus: true };

    case SDL_EVENT_WINDOW_FOCUS_LOST:
      return { type: "focus", hasFocus: false };

    case SDL_EVENT_WINDOW_RESIZED:
      // SDL_WindowEvent: data1 (int32) at offset 20, data2 (int32) at offset 24
      return {
        type: "resize",
        width: read.i32(p, 20),
        height: read.i32(p, 24),
      };

    case SDL_EVENT_WINDOW_MOVED:
      return {
        type: "moved",
        x: read.i32(p, 20),
        y: read.i32(p, 24),
      };

    case SDL_EVENT_WINDOW_MINIMIZED:
      return { type: "minimized" };

    case SDL_EVENT_WINDOW_MAXIMIZED:
      return { type: "maximized" };

    case SDL_EVENT_WINDOW_RESTORED:
      return { type: "restored" };

    case SDL_EVENT_WINDOW_SHOWN:
      return { type: "shown" };

    case SDL_EVENT_WINDOW_HIDDEN:
      return { type: "hidden" };

    // --- Keyboard events ---

    case SDL_EVENT_KEY_DOWN: {
      const scancode = read.i32(p, SDL_KEYBOARD_EVENT_SCANCODE);
      const isRepeat = read.u8(p, SDL_KEYBOARD_EVENT_REPEAT) !== 0;
      const keyName = SCANCODE_NAMES[scancode] ?? `scancode${scancode}`;
      return { type: "keypressed", key: keyName, scancode: keyName, isRepeat };
    }

    case SDL_EVENT_KEY_UP: {
      const scancode = read.i32(p, SDL_KEYBOARD_EVENT_SCANCODE);
      const keyName = SCANCODE_NAMES[scancode] ?? `scancode${scancode}`;
      return { type: "keyreleased", key: keyName, scancode: keyName };
    }

    // --- Mouse events ---

    case SDL_EVENT_MOUSE_MOTION:
      return {
        type: "mousemoved",
        x: read.f32(p, SDL_MOUSE_MOTION_X),
        y: read.f32(p, SDL_MOUSE_MOTION_Y),
        dx: read.f32(p, SDL_MOUSE_MOTION_XREL),
        dy: read.f32(p, SDL_MOUSE_MOTION_YREL),
      };

    case SDL_EVENT_MOUSE_BUTTON_DOWN:
      return {
        type: "mousepressed",
        x: read.f32(p, SDL_MOUSE_BUTTON_X),
        y: read.f32(p, SDL_MOUSE_BUTTON_Y),
        button: read.u8(p, SDL_MOUSE_BUTTON_BUTTON),
        clicks: read.u8(p, SDL_MOUSE_BUTTON_CLICKS),
      };

    case SDL_EVENT_MOUSE_BUTTON_UP:
      return {
        type: "mousereleased",
        x: read.f32(p, SDL_MOUSE_BUTTON_X),
        y: read.f32(p, SDL_MOUSE_BUTTON_Y),
        button: read.u8(p, SDL_MOUSE_BUTTON_BUTTON),
      };

    case SDL_EVENT_MOUSE_WHEEL:
      return {
        type: "wheelmoved",
        x: read.f32(p, SDL_MOUSE_WHEEL_X),
        y: read.f32(p, SDL_MOUSE_WHEEL_Y),
      };

    default:
      return null;
  }
}
