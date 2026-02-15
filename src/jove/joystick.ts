// jove2d joystick/gamepad module — mirrors love.joystick

import { ptr, read } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import {
  SDL_INIT_GAMEPAD,
  GAMEPAD_BUTTON_NAMES,
  GAMEPAD_BUTTON_FROM_NAME,
  GAMEPAD_AXIS_NAMES,
  GAMEPAD_AXIS_FROM_NAME,
  HAT_DIRECTION_NAMES,
} from "../sdl/types.ts";

export interface Joystick {
  /** Internal SDL_Joystick pointer */
  readonly _joystick: Pointer;
  /** Internal SDL_Gamepad pointer (null if not a gamepad) */
  readonly _gamepad: Pointer | null;
  /** SDL instance ID */
  readonly _instanceId: number;

  /** Get the number of axes. */
  getAxisCount(): number;
  /** Get the value of a joystick axis (0-indexed). Returns -1 to 1. */
  getAxis(axis: number): number;
  /** Get the number of buttons. */
  getButtonCount(): number;
  /** Check if one or more buttons are pressed (1-indexed like love2d). */
  isDown(...buttons: number[]): boolean;
  /** Get the number of hats. */
  getHatCount(): number;
  /** Get the direction of a hat (0-indexed). Returns direction string. */
  getHat(hat: number): string;
  /** Get the joystick name. */
  getName(): string;
  /** Get [id, instanceId]. */
  getID(): [number, number];
  /** Check if the joystick is still connected. */
  isConnected(): boolean;
  /** Check if this joystick has a gamepad mapping. */
  isGamepad(): boolean;
  /** Get a gamepad axis value by name. Returns -1 to 1. */
  getGamepadAxis(axis: string): number;
  /** Check if one or more gamepad buttons are pressed by name. */
  isGamepadDown(...buttons: string[]): boolean;
  /** Set vibration (left/right 0-1, duration in seconds, -1 = infinite). */
  setVibration(left?: number, right?: number, duration?: number): boolean;
  /** Check if vibration is supported. */
  isVibrationSupported(): boolean;
  /** Get [vendorID, productID, productVersion]. */
  getDeviceInfo(): [number, number, number];
}

// Active joystick map: instanceId → Joystick
const _joysticks = new Map<number, Joystick>();

// Sequential ID counter (love2d assigns incrementing IDs)
let _nextId = 1;

// Map instanceId → sequential ID
const _idMap = new Map<number, number>();

// Out-param buffer for SDL_GetJoysticks count
const _countBuf = new Int32Array(1);

/** Get all connected joysticks. */
export function getJoysticks(): Joystick[] {
  return Array.from(_joysticks.values());
}

/** Get the number of connected joysticks. */
export function getJoystickCount(): number {
  return _joysticks.size;
}

/** Called internally when a joystick is added. Returns the Joystick object. */
export function _onJoystickAdded(instanceId: number): Joystick | null {
  // Already tracked?
  if (_joysticks.has(instanceId)) return _joysticks.get(instanceId)!;

  const isGp = sdl.SDL_IsGamepad(instanceId);
  let joystickPtr: Pointer;
  let gamepadPtr: Pointer | null = null;

  if (isGp) {
    gamepadPtr = sdl.SDL_OpenGamepad(instanceId);
    if (!gamepadPtr) return null;
    joystickPtr = sdl.SDL_GetGamepadJoystick(gamepadPtr);
    if (!joystickPtr) {
      sdl.SDL_CloseGamepad(gamepadPtr);
      return null;
    }
  } else {
    joystickPtr = sdl.SDL_OpenJoystick(instanceId);
    if (!joystickPtr) return null;
  }

  const seqId = _nextId++;
  _idMap.set(instanceId, seqId);

  const joy = _createJoystick(joystickPtr, gamepadPtr, instanceId, seqId);
  _joysticks.set(instanceId, joy);
  return joy;
}

/** Called internally when a joystick is removed. Returns the Joystick object. */
export function _onJoystickRemoved(instanceId: number): Joystick | null {
  const joy = _joysticks.get(instanceId);
  if (!joy) return null;

  _joysticks.delete(instanceId);

  // Close handles
  if (joy._gamepad) {
    sdl.SDL_CloseGamepad(joy._gamepad);
  } else {
    sdl.SDL_CloseJoystick(joy._joystick);
  }

  return joy;
}

/** Get a joystick by instance ID. */
export function _getByInstanceId(instanceId: number): Joystick | null {
  return _joysticks.get(instanceId) ?? null;
}

/** Initialize: init gamepad subsystem and enumerate already-connected joysticks. */
export function _init(): void {
  // Init gamepad subsystem separately (non-fatal if it fails)
  const ok = sdl.SDL_Init(SDL_INIT_GAMEPAD);
  if (!ok) return;

  const countPtr = ptr(_countBuf);
  const idsPtr = sdl.SDL_GetJoysticks(countPtr);
  if (!idsPtr) return;

  const count = read.i32(countPtr, 0);
  for (let i = 0; i < count; i++) {
    const instanceId = read.u32(idsPtr, i * 4);
    _onJoystickAdded(instanceId);
  }
  sdl.SDL_free(idsPtr);
}

/** Cleanup: close all joysticks. */
export function _quit(): void {
  for (const [instanceId, joy] of _joysticks) {
    if (joy._gamepad) {
      sdl.SDL_CloseGamepad(joy._gamepad);
    } else {
      sdl.SDL_CloseJoystick(joy._joystick);
    }
  }
  _joysticks.clear();
  _idMap.clear();
  _nextId = 1;
}

function _createJoystick(
  joystickPtr: Pointer,
  gamepadPtr: Pointer | null,
  instanceId: number,
  seqId: number,
): Joystick {
  return {
    _joystick: joystickPtr,
    _gamepad: gamepadPtr,
    _instanceId: instanceId,

    getAxisCount(): number {
      return sdl.SDL_GetNumJoystickAxes(joystickPtr);
    },

    getAxis(axis: number): number {
      const raw = sdl.SDL_GetJoystickAxis(joystickPtr, axis);
      // Normalize -32768..32767 to -1..1
      return raw < 0 ? raw / 32768 : raw / 32767;
    },

    getButtonCount(): number {
      return sdl.SDL_GetNumJoystickButtons(joystickPtr);
    },

    isDown(...buttons: number[]): boolean {
      for (const b of buttons) {
        // love2d uses 1-indexed buttons
        if (sdl.SDL_GetJoystickButton(joystickPtr, b - 1)) return true;
      }
      return false;
    },

    getHatCount(): number {
      return sdl.SDL_GetNumJoystickHats(joystickPtr);
    },

    getHat(hat: number): string {
      const value = sdl.SDL_GetJoystickHat(joystickPtr, hat);
      return HAT_DIRECTION_NAMES[value] ?? "c";
    },

    getName(): string {
      if (gamepadPtr) {
        return String(sdl.SDL_GetGamepadName(gamepadPtr) ?? "Unknown Gamepad");
      }
      return String(sdl.SDL_GetJoystickName(joystickPtr) ?? "Unknown Joystick");
    },

    getID(): [number, number] {
      return [seqId, instanceId];
    },

    isConnected(): boolean {
      return sdl.SDL_JoystickConnected(joystickPtr);
    },

    isGamepad(): boolean {
      return gamepadPtr !== null;
    },

    getGamepadAxis(axis: string): number {
      if (!gamepadPtr) return 0;
      const sdlAxis = GAMEPAD_AXIS_FROM_NAME[axis];
      if (sdlAxis === undefined) return 0;
      const raw = sdl.SDL_GetGamepadAxis(gamepadPtr, sdlAxis);
      return raw < 0 ? raw / 32768 : raw / 32767;
    },

    isGamepadDown(...buttons: string[]): boolean {
      if (!gamepadPtr) return false;
      for (const name of buttons) {
        const sdlBtn = GAMEPAD_BUTTON_FROM_NAME[name];
        if (sdlBtn !== undefined && sdl.SDL_GetGamepadButton(gamepadPtr, sdlBtn)) {
          return true;
        }
      }
      return false;
    },

    setVibration(left = 0, right = 0, duration = -1): boolean {
      const lowFreq = Math.round(Math.max(0, Math.min(1, left)) * 0xffff);
      const highFreq = Math.round(Math.max(0, Math.min(1, right)) * 0xffff);
      const ms = duration < 0 ? 0 : Math.round(duration * 1000); // 0 = infinite in SDL
      if (gamepadPtr) {
        return sdl.SDL_RumbleGamepad(gamepadPtr, lowFreq, highFreq, ms);
      }
      return sdl.SDL_RumbleJoystick(joystickPtr, lowFreq, highFreq, ms);
    },

    isVibrationSupported(): boolean {
      // Try a zero-amplitude rumble — if it succeeds, rumble is supported
      if (gamepadPtr) {
        return sdl.SDL_RumbleGamepad(gamepadPtr, 0, 0, 0);
      }
      return sdl.SDL_RumbleJoystick(joystickPtr, 0, 0, 0);
    },

    getDeviceInfo(): [number, number, number] {
      return [
        sdl.SDL_GetJoystickVendor(joystickPtr),
        sdl.SDL_GetJoystickProduct(joystickPtr),
        sdl.SDL_GetJoystickProductVersion(joystickPtr),
      ];
    },
  };
}
