// jove2d event system — polls SDL events and returns typed JoveEvent objects

import { ptr, read, CString } from "bun:ffi";
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
  SDL_EVENT_TEXT_EDITING,
  SDL_EVENT_TEXT_INPUT,
  SDL_EVENT_MOUSE_MOTION,
  SDL_EVENT_MOUSE_BUTTON_DOWN,
  SDL_EVENT_MOUSE_BUTTON_UP,
  SDL_EVENT_MOUSE_WHEEL,
  SDL_EVENT_DROP_FILE,
  SDL_EVENT_JOYSTICK_AXIS_MOTION,
  SDL_EVENT_JOYSTICK_HAT_MOTION,
  SDL_EVENT_JOYSTICK_BUTTON_DOWN,
  SDL_EVENT_JOYSTICK_BUTTON_UP,
  SDL_EVENT_JOYSTICK_ADDED,
  SDL_EVENT_JOYSTICK_REMOVED,
  SDL_EVENT_GAMEPAD_AXIS_MOTION,
  SDL_EVENT_GAMEPAD_BUTTON_DOWN,
  SDL_EVENT_GAMEPAD_BUTTON_UP,
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
  SDL_TEXT_EDITING_TEXT,
  SDL_TEXT_EDITING_START,
  SDL_TEXT_EDITING_LENGTH,
  SDL_TEXT_INPUT_TEXT,
  SDL_DROP_EVENT_DATA,
  SDL_JOY_EVENT_WHICH,
  SDL_JOY_AXIS_EVENT_AXIS,
  SDL_JOY_AXIS_EVENT_VALUE,
  SDL_JOY_BUTTON_EVENT_BUTTON,
  SDL_JOY_HAT_EVENT_HAT,
  SDL_JOY_HAT_EVENT_VALUE,
  HAT_DIRECTION_NAMES,
  GAMEPAD_BUTTON_NAMES,
  GAMEPAD_AXIS_NAMES,
  SCANCODE_NAMES,
} from "../sdl/types.ts";
import type { JoveEvent } from "./types.ts";
import { _getRenderer } from "./graphics.ts";

// Pre-allocate event buffer — reused every poll call.
// IMPORTANT: We must use read.u32/read.i32 from bun:ffi to read from the
// pointer, because ptr() returns a pointer to bun's internal copy of the
// buffer data — DataView on the JS-side ArrayBuffer sees stale data.
const eventBuffer = new Uint8Array(SDL_EVENT_SIZE);
const eventPtr = ptr(eventBuffer);

// Queue for user-injected events
const _injectedEvents: JoveEvent[] = [];

/** Inject a custom event into the event queue. */
export function push(event: JoveEvent): void {
  _injectedEvents.push(event);
}

/** Clear all pending events (both SDL and injected). */
export function clear(): void {
  _injectedEvents.length = 0;
  // Drain SDL event queue
  while (sdl.SDL_PollEvent(eventPtr)) {
    // discard
  }
}

/** Push a quit event. */
export function quit(): void {
  _injectedEvents.push({ type: "quit" });
}

/** Poll all pending SDL events, returning typed JoveEvent array */
export function pollEvents(): JoveEvent[] {
  const events: JoveEvent[] = [];

  // Return injected events first
  while (_injectedEvents.length > 0) {
    events.push(_injectedEvents.shift()!);
  }

  const renderer = _getRenderer();
  while (sdl.SDL_PollEvent(eventPtr)) {
    // Convert mouse/touch coordinates from window space to render (logical) space.
    // Required when SDL_SetRenderLogicalPresentation is active (high-DPI scaling).
    if (renderer) {
      sdl.SDL_ConvertEventToRenderCoordinates(renderer, eventPtr);
    }
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

    // --- Text input event ---

    case SDL_EVENT_TEXT_EDITING: {
      const textPtr = read.ptr(p, SDL_TEXT_EDITING_TEXT);
      if (!textPtr) return null;
      const text = new CString(textPtr);
      return {
        type: "textedited",
        text: text.toString(),
        start: read.i32(p, SDL_TEXT_EDITING_START),
        length: read.i32(p, SDL_TEXT_EDITING_LENGTH),
      };
    }

    case SDL_EVENT_TEXT_INPUT: {
      // Text pointer at offset 24 (after windowID + padding on 64-bit)
      const textPtr = read.ptr(p, SDL_TEXT_INPUT_TEXT);
      if (!textPtr) return null;
      // Read the text as a cstring
      const text = new CString(textPtr);
      return { type: "textinput", text: text.toString() };
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

    // --- Drop events ---

    case SDL_EVENT_DROP_FILE: {
      const dataPtr = read.ptr(p, SDL_DROP_EVENT_DATA);
      if (!dataPtr) return null;
      const filePath = new Bun.CString(dataPtr);
      return { type: "filedropped", path: filePath.toString() };
    }

    // --- Joystick events ---

    case SDL_EVENT_JOYSTICK_ADDED:
      return { type: "joystickadded", instanceId: read.u32(p, SDL_JOY_EVENT_WHICH) };

    case SDL_EVENT_JOYSTICK_REMOVED:
      return { type: "joystickremoved", instanceId: read.u32(p, SDL_JOY_EVENT_WHICH) };

    case SDL_EVENT_JOYSTICK_AXIS_MOTION: {
      const raw = read.i16(p, SDL_JOY_AXIS_EVENT_VALUE);
      return {
        type: "joystickaxis",
        instanceId: read.u32(p, SDL_JOY_EVENT_WHICH),
        axis: read.u8(p, SDL_JOY_AXIS_EVENT_AXIS),
        value: raw < 0 ? raw / 32768 : raw / 32767,
      };
    }

    case SDL_EVENT_JOYSTICK_BUTTON_DOWN:
      return {
        type: "joystickpressed",
        instanceId: read.u32(p, SDL_JOY_EVENT_WHICH),
        button: read.u8(p, SDL_JOY_BUTTON_EVENT_BUTTON) + 1, // love2d is 1-indexed
      };

    case SDL_EVENT_JOYSTICK_BUTTON_UP:
      return {
        type: "joystickreleased",
        instanceId: read.u32(p, SDL_JOY_EVENT_WHICH),
        button: read.u8(p, SDL_JOY_BUTTON_EVENT_BUTTON) + 1,
      };

    case SDL_EVENT_JOYSTICK_HAT_MOTION: {
      const hatVal = read.u8(p, SDL_JOY_HAT_EVENT_VALUE);
      return {
        type: "joystickhat",
        instanceId: read.u32(p, SDL_JOY_EVENT_WHICH),
        hat: read.u8(p, SDL_JOY_HAT_EVENT_HAT) + 1, // love2d is 1-indexed
        direction: HAT_DIRECTION_NAMES[hatVal] ?? "c",
      };
    }

    // --- Gamepad events ---

    case SDL_EVENT_GAMEPAD_BUTTON_DOWN: {
      const btn = read.u8(p, SDL_JOY_BUTTON_EVENT_BUTTON);
      const name = GAMEPAD_BUTTON_NAMES[btn];
      if (!name) return null;
      return {
        type: "gamepadpressed",
        instanceId: read.u32(p, SDL_JOY_EVENT_WHICH),
        button: name,
      };
    }

    case SDL_EVENT_GAMEPAD_BUTTON_UP: {
      const btn = read.u8(p, SDL_JOY_BUTTON_EVENT_BUTTON);
      const name = GAMEPAD_BUTTON_NAMES[btn];
      if (!name) return null;
      return {
        type: "gamepadreleased",
        instanceId: read.u32(p, SDL_JOY_EVENT_WHICH),
        button: name,
      };
    }

    case SDL_EVENT_GAMEPAD_AXIS_MOTION: {
      const axisIdx = read.u8(p, SDL_JOY_AXIS_EVENT_AXIS);
      const axisName = GAMEPAD_AXIS_NAMES[axisIdx];
      if (!axisName) return null;
      const raw = read.i16(p, SDL_JOY_AXIS_EVENT_VALUE);
      return {
        type: "gamepadaxis",
        instanceId: read.u32(p, SDL_JOY_EVENT_WHICH),
        axis: axisName,
        value: raw < 0 ? raw / 32768 : raw / 32767,
      };
    }

    default:
      return null;
  }
}
