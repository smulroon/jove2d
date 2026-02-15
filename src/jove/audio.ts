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

// Source tracking for global operations
const _sources = new Set<Source>();

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
  // Release all tracked sources
  for (const source of _sources) {
    source.release();
  }
  _sources.clear();
  if (_deviceId) {
    sdl.SDL_CloseAudioDevice(_deviceId);
    _deviceId = 0;
  }
  _initialized = false;
}

/** Poll all playing sources for end-of-stream / looping. Call once per frame. */
export function _updateSources(): void {
  for (const source of _sources) {
    source._poll();
  }
}

// ============================================================
// Source type
// ============================================================

export type SourceType = "static" | "stream";
type SourceState = "stopped" | "playing" | "paused";

export interface Source {
  play(): void;
  pause(): void;
  stop(): void;
  isPlaying(): boolean;
  isStopped(): boolean;
  isPaused(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
  setLooping(looping: boolean): void;
  isLooping(): boolean;
  setPitch(pitch: number): void;
  getPitch(): number;
  seek(position: number): void;
  tell(): number;
  getDuration(): number;
  clone(): Source;
  type(): SourceType;
  release(): void;
  /** @internal */
  _poll(): void;
  /** @internal */
  _type: SourceType;
  /** @internal */
  _applyMasterVolume(): void;
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
  sourceType: SourceType,
): Source {
  let _stream: Pointer | null = null;
  let _state: SourceState = "stopped";
  let _volume = 1.0;
  let _looping = false;
  let _pitch = 1.0;

  // Compute bytes per second for seek/tell/duration
  const bytesPerSample = format === SDL_AUDIO_F32 ? 4 : 2;
  const _bytesPerSecond = freq * channels * bytesPerSample;

  // Create audio stream from source spec (let SDL handle conversion when bound to device)
  const srcSpec = new Int32Array([format, channels, freq]);
  const dstSpec = new Int32Array([format, channels, freq]);

  _stream = sdl.SDL_CreateAudioStream(ptr(srcSpec), ptr(dstSpec)) as Pointer | null;
  if (!_stream) return null as any;

  function _loadData(byteOffset: number = 0): void {
    if (!_stream) return;
    sdl.SDL_ClearAudioStream(_stream);
    const offset = Math.min(byteOffset, audioData.length);
    if (offset > 0) {
      const sliced = audioData.subarray(offset);
      sdl.SDL_PutAudioStreamData(_stream, ptr(sliced), sliced.length);
    } else {
      sdl.SDL_PutAudioStreamData(_stream, ptr(audioData), audioData.length);
    }
    sdl.SDL_FlushAudioStream(_stream);
  }

  function _bind(): void {
    if (!_stream || !_deviceId) return;
    sdl.SDL_BindAudioStream(_deviceId, _stream);
  }

  function _unbind(): void {
    if (!_stream) return;
    sdl.SDL_UnbindAudioStream(_stream);
  }

  function _applyGain(): void {
    if (!_stream) return;
    sdl.SDL_SetAudioStreamGain(_stream, _volume * _masterVolume);
  }

  function _applyPitch(): void {
    if (!_stream) return;
    sdl.SDL_SetAudioStreamFrequencyRatio(_stream, _pitch);
  }

  const source: Source = {
    _type: sourceType,

    play() {
      if (!_stream || !_deviceId) return;
      if (_state === "playing") {
        // love2d: play() on playing source rewinds
        _unbind();
        _loadData();
        _bind();
        _applyGain();
        _applyPitch();
        sdl.SDL_ResumeAudioStreamDevice(_stream);
        return;
      }
      if (_state === "paused") {
        // Resume from pause
        sdl.SDL_ResumeAudioStreamDevice(_stream);
        _state = "playing";
        return;
      }
      // stopped → playing
      _loadData();
      _bind();
      _applyGain();
      _applyPitch();
      sdl.SDL_ResumeAudioStreamDevice(_stream);
      _state = "playing";
    },

    pause() {
      if (!_stream || _state !== "playing") return;
      sdl.SDL_PauseAudioStreamDevice(_stream);
      _state = "paused";
    },

    stop() {
      if (!_stream || _state === "stopped") return;
      _unbind();
      sdl.SDL_ClearAudioStream(_stream);
      _state = "stopped";
    },

    isPlaying() {
      return _state === "playing";
    },

    isStopped() {
      return _state === "stopped";
    },

    isPaused() {
      return _state === "paused";
    },

    setVolume(volume: number) {
      _volume = Math.max(0, Math.min(1, volume));
      _applyGain();
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
      _pitch = Math.max(0.01, pitch); // SDL3 requires ratio > 0
      _applyPitch();
    },

    getPitch() {
      return _pitch;
    },

    seek(position: number) {
      if (!_stream) return;
      const byteOffset = Math.max(0, Math.floor(position * _bytesPerSecond));
      // Align to frame boundary (channels * bytesPerSample)
      const frameSize = channels * bytesPerSample;
      const aligned = byteOffset - (byteOffset % frameSize);
      if (_state === "playing") {
        _unbind();
        _loadData(aligned);
        _bind();
        _applyGain();
        _applyPitch();
        sdl.SDL_ResumeAudioStreamDevice(_stream);
      } else if (_state === "paused") {
        _loadData(aligned);
        // Stay paused — data is queued but device stays paused
      } else {
        // Stopped: just queue data from offset, don't play
        _loadData(aligned);
      }
    },

    tell(): number {
      if (!_stream || _state === "stopped") return 0;
      // Estimate position: total duration minus remaining audio in stream
      const available = sdl.SDL_GetAudioStreamAvailable(_stream);
      const totalSeconds = audioData.length / _bytesPerSecond;
      const remainingSeconds = Math.max(0, available) / _bytesPerSecond;
      return Math.max(0, totalSeconds - remainingSeconds);
    },

    getDuration(): number {
      return audioData.length / _bytesPerSecond;
    },

    clone(): Source {
      const cloned = _createSource(audioData, format, channels, freq, sourceType);
      cloned.setVolume(_volume);
      cloned.setPitch(_pitch);
      cloned.setLooping(_looping);
      return cloned;
    },

    type(): SourceType {
      return sourceType;
    },

    release() {
      if (_stream) {
        _unbind();
        sdl.SDL_DestroyAudioStream(_stream);
        _stream = null;
      }
      _state = "stopped";
      _sources.delete(source);
    },

    _poll() {
      if (_state !== "playing" || !_stream) return;
      const available = sdl.SDL_GetAudioStreamAvailable(_stream);
      if (available <= 0) {
        if (_looping) {
          // Re-queue audio data for loop
          sdl.SDL_PutAudioStreamData(_stream, ptr(audioData), audioData.length);
          sdl.SDL_FlushAudioStream(_stream);
        } else {
          // Auto-stop when playback finished
          _unbind();
          sdl.SDL_ClearAudioStream(_stream);
          _state = "stopped";
        }
      }
    },

    _applyMasterVolume() {
      _applyGain();
    },
  };

  _sources.add(source);
  return source;
}

// ============================================================
// Global audio controls
// ============================================================

/** Set the master volume (0.0 to 1.0). Propagates to all sources. */
export function setVolume(volume: number): void {
  _masterVolume = Math.max(0, Math.min(1, volume));
  for (const source of _sources) {
    source._applyMasterVolume();
  }
}

/** Get the master volume. */
export function getVolume(): number {
  return _masterVolume;
}

/** Get the number of currently playing sources. */
export function getActiveSourceCount(): number {
  let count = 0;
  for (const source of _sources) {
    if (source.isPlaying()) count++;
  }
  return count;
}

/** Pause all currently playing sources (no args). */
export function pause(): void {
  for (const source of _sources) {
    if (source.isPlaying()) {
      source.pause();
    }
  }
}

/** Resume/play: with no args, resumes all paused sources. With a source arg, plays that source. */
export function play(source?: Source): void {
  if (source) {
    source.play();
    return;
  }
  for (const s of _sources) {
    if (s.isPaused()) {
      s.play();
    }
  }
}

/** Stop all sources (no args) or a specific source. */
export function stop(source?: Source): void {
  if (source) {
    source.stop();
    return;
  }
  for (const s of _sources) {
    s.stop();
  }
}
