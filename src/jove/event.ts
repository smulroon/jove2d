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

    default:
      return null;
  }
}
