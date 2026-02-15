// jove2d audio module — mirrors love.audio API
// Uses SDL3's built-in audio API for WAV playback

import { ptr, read, toArrayBuffer } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import {
  SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK,
  SDL_AUDIO_S16,
  SDL_AUDIO_F32,
  SDL_INIT_AUDIO,
} from "../sdl/types.ts";

// SDL_AudioSpec: { format: i32, channels: i32, freq: i32 } = 12 bytes
const AUDIOSPEC_SIZE = 12;

let _deviceId: number = 0;
let _masterVolume = 1.0;
let _initialized = false;

// Device audio spec
const _deviceSpec = new Int32Array(3); // format, channels, freq
const _deviceSpecPtr = ptr(_deviceSpec);

/** Initialize the audio subsystem. Called internally. Device opened lazily on first use. */
export function _init(): boolean {
  if (_initialized) return true;
  // Init SDL audio subsystem only — device opened lazily in _ensureDevice()
  const ok = sdl.SDL_Init(SDL_INIT_AUDIO);
  if (!ok) return false;
  _initialized = true;
  return true;
}

/** Open the playback device on first use. Returns true if device is ready. */
function _ensureDevice(): boolean {
  if (_deviceId) return true;
  if (!_initialized) return false;
  _deviceId = sdl.SDL_OpenAudioDevice(SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK, null);
  return _deviceId !== 0;
}

/** Shut down the audio system. Called internally. */
export function _quit(): void {
  if (!_initialized) return;
  if (_deviceId) {
    sdl.SDL_CloseAudioDevice(_deviceId);
    _deviceId = 0;
  }
  _initialized = false;
}

// ============================================================
// Source type
// ============================================================

export type SourceType = "static" | "stream";

export interface Source {
  play(): void;
  pause(): void;
  stop(): void;
  isPlaying(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
  setLooping(looping: boolean): void;
  isLooping(): boolean;
  setPitch(pitch: number): void;
  getPitch(): number;
  seek(position: number): void;
  tell(): number;
  release(): void;
  _type: SourceType;
}

/** Load a WAV file and create an audio source. */
export function newSource(path: string, type: SourceType = "static"): Source | null {
  if (!_initialized && !_init()) return null;
  if (!_ensureDevice()) return null;

  // Load WAV file
  const specBuf = new Int32Array(3); // format, channels, freq
  const audioBufPtr = new BigUint64Array(1); // pointer to audio data
  const audioLenBuf = new Uint32Array(1);

  const ok = sdl.SDL_LoadWAV(
    Buffer.from(path + "\0"),
    ptr(specBuf),
    ptr(audioBufPtr),
    ptr(audioLenBuf),
  );

  if (!ok) return null;

  // Read the spec using read.* to avoid stale data
  const specPtr = ptr(specBuf);
  const format = read.i32(specPtr, 0);
  const channels = read.i32(specPtr, 4);
  const freq = read.i32(specPtr, 8);

  // Read the audio buffer pointer and length
  const audioBufPtrVal = read.ptr(ptr(audioBufPtr), 0);
  const audioLen = read.u32(ptr(audioLenBuf), 0);

  if (!audioBufPtrVal || audioLen === 0) return null;

  // Copy the audio data to a JS buffer so we can free the SDL buffer
  const audioData = new Uint8Array(toArrayBuffer(audioBufPtrVal, 0, audioLen).slice(0));
  sdl.SDL_free(audioBufPtrVal);

  return _createSource(audioData, format, channels, freq, type);
}

function _createSource(
  audioData: Uint8Array,
  format: number,
  channels: number,
  freq: number,
  type: SourceType,
): Source {
  let _stream: Pointer | null = null;
  let _playing = false;
  let _volume = 1.0;
  let _looping = false;
  let _pitch = 1.0;
  let _position = 0;

  // Create audio stream from source spec to device spec (let SDL handle conversion)
  const srcSpec = new Int32Array([format, channels, freq]);
  // For dst spec, use same format to avoid conversion issues
  // SDL will convert as needed when bound to device
  const dstSpec = new Int32Array([format, channels, freq]);

  _stream = sdl.SDL_CreateAudioStream(ptr(srcSpec), ptr(dstSpec)) as Pointer | null;
  if (!_stream) return null as any;

  function _loadData(): void {
    if (!_stream) return;
    sdl.SDL_ClearAudioStream(_stream);
    const dataPtr = ptr(audioData);
    sdl.SDL_PutAudioStreamData(_stream, dataPtr, audioData.length);
  }

  const source: Source = {
    _type: type,
    play() {
      if (!_stream || !_deviceId) return;
      if (!_playing) {
        _loadData();
        sdl.SDL_BindAudioStream(_deviceId, _stream);
        sdl.SDL_SetAudioStreamGain(_stream, _volume * _masterVolume);
        sdl.SDL_ResumeAudioStreamDevice(_stream);
        _playing = true;
      }
    },
    pause() {
      if (!_stream || !_playing) return;
      sdl.SDL_PauseAudioStreamDevice(_stream);
      _playing = false;
    },
    stop() {
      if (!_stream) return;
      sdl.SDL_UnbindAudioStream(_stream);
      sdl.SDL_ClearAudioStream(_stream);
      _playing = false;
      _position = 0;
    },
    isPlaying() {
      return _playing;
    },
    setVolume(volume: number) {
      _volume = Math.max(0, Math.min(1, volume));
      if (_stream) {
        sdl.SDL_SetAudioStreamGain(_stream, _volume * _masterVolume);
      }
    },
    getVolume() {
      return _volume;
    },
    setLooping(looping: boolean) {
      _looping = looping;
    },
    isLooping() {
      return _looping;
    },
    setPitch(pitch: number) {
      _pitch = pitch;
      // SDL3 doesn't have per-stream pitch control built-in
      // This would require resampling — stored as state for future implementation
    },
    getPitch() {
      return _pitch;
    },
    seek(position: number) {
      _position = position;
      // Seeking requires reloading data from offset — simplified implementation
    },
    tell() {
      return _position;
    },
    release() {
      if (_stream) {
        sdl.SDL_UnbindAudioStream(_stream);
        sdl.SDL_DestroyAudioStream(_stream);
        _stream = null;
      }
      _playing = false;
    },
  };

  return source;
}

// ============================================================
// Global audio controls
// ============================================================

/** Set the master volume (0.0 to 1.0). */
export function setVolume(volume: number): void {
  _masterVolume = Math.max(0, Math.min(1, volume));
}

/** Get the master volume. */
export function getVolume(): number {
  return _masterVolume;
}
