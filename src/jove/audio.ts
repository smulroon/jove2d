// jove2d audio module — mirrors love.audio API
// Uses SDL3's built-in audio API for WAV playback + OGG/MP3/FLAC via codec lib

import { ptr, read, toArrayBuffer } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import { loadAudioDecode } from "../sdl/ffi_audio_decode.ts";
import {
  SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK,
  SDL_AUDIO_U8,
  SDL_AUDIO_S16,
  SDL_AUDIO_F32,
  SDL_INIT_AUDIO,
} from "../sdl/types.ts";
import type { Decoder } from "./sound.ts";

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
export function _ensureDevice(): boolean {
  if (_deviceId) return true;
  if (!_initialized) return false;
  // Try zero-filled spec first — bun:ffi on Windows mishandles null pointer args,
  // causing audio clicking artifacts when SDL resamples to device format.
  // Fall back to null for dummy driver (which rejects zero-filled spec).
  _deviceId = sdl.SDL_OpenAudioDevice(SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK, _deviceSpecPtr);
  if (!_deviceId) {
    _deviceId = sdl.SDL_OpenAudioDevice(SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK, null);
  }
  return _deviceId !== 0;
}

/** Get the current audio device ID (0 if not open). */
export function _getDeviceId(): number {
  return _deviceId;
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

/** Poll all playing sources for end-of-stream / looping / streaming feed. Call once per frame. */
export function _updateSources(): void {
  let toRelease: Source[] | null = null;
  for (const source of _sources) {
    // Feed streaming sources before polling
    if ((source as any)._feedStream) {
      (source as any)._feedStream();
    }
    if (source._poll()) {
      (toRelease ??= []).push(source);
    }
  }
  if (toRelease) {
    for (const source of toRelease) {
      source.release();
    }
  }
}

// ============================================================
// Source type
// ============================================================

export type SourceType = "static" | "stream" | "queue";
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
  /** @internal — returns true if source finished and should be auto-released */
  _poll(): boolean;
  /** @internal */
  _type: SourceType;
  /** @internal */
  _applyMasterVolume(): void;
}

// Supported codec extensions (checked before WAV fallback)
const _codecExtensions = new Set([".ogg", ".mp3", ".flac"]);

/**
 * Try decoding via the codec library (OGG/MP3/FLAC).
 * Returns decoded PCM data or null if unsupported/unavailable.
 */
function _tryDecode(path: string): { data: Uint8Array; channels: number; freq: number } | null {
  const ext = path.lastIndexOf(".");
  if (ext === -1) return null;
  const suffix = path.slice(ext).toLowerCase();
  if (!_codecExtensions.has(suffix)) return null;

  const lib = loadAudioDecode();
  if (!lib) return null;

  // Out-params: pointer to sample data, channels, sample rate
  const outDataPtr = new BigUint64Array(1); // int16_t*
  const outCh = new Int32Array(1);
  const outRate = new Int32Array(1);

  const frames = lib.jove_audio_decode(
    Buffer.from(path + "\0"),
    ptr(outDataPtr),
    ptr(outCh),
    ptr(outRate),
  );

  if (frames <= 0) return null;

  const dataPtr = read.ptr(ptr(outDataPtr), 0);
  const channels = read.i32(ptr(outCh), 0);
  const freq = read.i32(ptr(outRate), 0);

  if (!dataPtr || channels <= 0 || freq <= 0) return null;

  // Copy PCM data to JS buffer, then free C buffer
  const byteLen = Number(frames) * channels * 2; // S16 = 2 bytes per sample
  const data = new Uint8Array(toArrayBuffer(dataPtr, 0, byteLen).slice(0));
  lib.jove_audio_free(dataPtr);

  return { data, channels, freq };
}

/**
 * Decode an audio file to raw PCM data. Supports WAV, OGG, MP3, FLAC.
 * Exported for use by sound.ts (SoundData from file).
 */
export function _decodeFile(path: string): { data: Uint8Array; format: number; channels: number; freq: number } | null {
  // Try codec library first (OGG/MP3/FLAC)
  const decoded = _tryDecode(path);
  if (decoded) return { data: decoded.data, format: SDL_AUDIO_S16, channels: decoded.channels, freq: decoded.freq };

  // Fall through to WAV path
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

  return { data: audioData, format, channels, freq };
}

/** Load an audio file and create a source. Supports WAV, OGG, MP3, FLAC. */
export function newSource(path: string, type: SourceType = "static"): Source | null {
  if (!_initialized && !_init()) return null;
  if (!_ensureDevice()) return null;

  // Streaming type: use Decoder to feed chunks incrementally
  if (type === "stream") {
    return _createStreamSource(path);
  }

  const decoded = _decodeFile(path);
  if (!decoded) return null;
  return _createSource(decoded.data, decoded.format, decoded.channels, decoded.freq, type);
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
      if (!_deviceId) return;
      // Recreate stream if it was auto-released after finishing
      if (!_stream) {
        const newSrcSpec = new Int32Array([format, channels, freq]);
        const newDstSpec = new Int32Array([format, channels, freq]);
        _stream = sdl.SDL_CreateAudioStream(ptr(newSrcSpec), ptr(newDstSpec)) as Pointer | null;
        if (!_stream) return;
        _sources.add(source);
      }
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

    _poll(): boolean {
      if (_state !== "playing" || !_stream) return false;
      const available = sdl.SDL_GetAudioStreamAvailable(_stream);
      if (available <= 0) {
        if (_looping) {
          // Re-queue audio data for loop
          sdl.SDL_PutAudioStreamData(_stream, ptr(audioData), audioData.length);
          sdl.SDL_FlushAudioStream(_stream);
        } else {
          // Auto-stop when playback finished — signal for auto-release
          _unbind();
          sdl.SDL_ClearAudioStream(_stream);
          _state = "stopped";
          return true;
        }
      }
      return false;
    },

    _applyMasterVolume() {
      _applyGain();
    },
  };

  _sources.add(source);
  return source;
}

// ============================================================
// Streaming source (Decoder-backed)
// ============================================================

/**
 * Create a streaming source that feeds audio from a Decoder.
 * Uses a QueueableSource internally, feeding chunks each frame.
 */
function _createStreamSource(path: string): Source | null {
  // Lazy import to avoid circular dependency at module load time
  const { newDecoder } = require("./sound.ts") as typeof import("./sound.ts");

  let decoder: Decoder;
  try {
    decoder = newDecoder(path);
  } catch {
    // Decoder not available (lib missing) or file not supported — fall back to full decode
    const decoded = _decodeFile(path);
    if (!decoded) return null;
    return _createSource(decoded.data, decoded.format, decoded.channels, decoded.freq, "stream");
  }

  const channels = decoder.getChannelCount();
  const sampleRate = decoder.getSampleRate();
  const totalFrames = decoder.getSampleCount();
  const format = SDL_AUDIO_S16;
  const bytesPerSample = 2;
  const _bytesPerSecond = sampleRate * channels * bytesPerSample;
  const totalDuration = totalFrames / sampleRate;
  const bufferSize = decoder._bufferSize;
  // Keep ~4 chunks in the stream at all times
  const LOW_WATER = 2;
  const HIGH_WATER = 4;

  // Create audio stream
  const srcSpec = new Int32Array([format, channels, sampleRate]);
  const dstSpec = new Int32Array([format, channels, sampleRate]);
  let _stream = sdl.SDL_CreateAudioStream(ptr(srcSpec), ptr(dstSpec)) as Pointer | null;
  if (!_stream) {
    decoder.close();
    return null;
  }

  let _state: SourceState = "stopped";
  let _volume = 1.0;
  let _looping = false;
  let _pitch = 1.0;
  let _seekPending = false;

  function _bind(): void {
    if (_stream && _deviceId) sdl.SDL_BindAudioStream(_deviceId, _stream);
  }

  function _unbind(): void {
    if (_stream) sdl.SDL_UnbindAudioStream(_stream);
  }

  function _applyGain(): void {
    if (_stream) sdl.SDL_SetAudioStreamGain(_stream, _volume * _masterVolume);
  }

  function _applyPitch(): void {
    if (_stream) sdl.SDL_SetAudioStreamFrequencyRatio(_stream, _pitch);
  }

  /** Feed decoded chunks into the audio stream to keep it topped up. */
  function _feedStream(): void {
    if (_state !== "playing" || !_stream) return;

    const available = Math.max(0, sdl.SDL_GetAudioStreamAvailable(_stream) as number);
    const chunkBytes = bufferSize * channels * bytesPerSample;
    const pendingChunks = Math.ceil(available / chunkBytes);

    // Fill up to HIGH_WATER chunks
    let chunksToFeed = HIGH_WATER - pendingChunks;
    while (chunksToFeed > 0) {
      const chunk = decoder.decode();
      if (!chunk) {
        // EOF
        if (_looping) {
          decoder.seek(0);
          continue; // try reading from start
        }
        // Mark EOF — let _poll handle auto-stop when stream drains
        break;
      }
      sdl.SDL_PutAudioStreamData(_stream, ptr(chunk._data), chunk._data.length);
      sdl.SDL_FlushAudioStream(_stream);
      chunksToFeed--;
    }
  }

  /** Pre-fill stream buffer before starting playback. */
  function _prefill(): void {
    for (let i = 0; i < HIGH_WATER; i++) {
      const chunk = decoder.decode();
      if (!chunk) break;
      sdl.SDL_PutAudioStreamData(_stream!, ptr(chunk._data), chunk._data.length);
    }
    sdl.SDL_FlushAudioStream(_stream!);
  }

  const source: Source & { _feedStream: () => void } = {
    _type: "stream" as SourceType,
    _feedStream: _feedStream,

    play() {
      if (!_deviceId) return;
      if (!_stream) {
        // Recreate stream if released
        const newSrcSpec = new Int32Array([format, channels, sampleRate]);
        const newDstSpec = new Int32Array([format, channels, sampleRate]);
        _stream = sdl.SDL_CreateAudioStream(ptr(newSrcSpec), ptr(newDstSpec)) as Pointer | null;
        if (!_stream) return;
        _sources.add(source);
      }
      if (_state === "playing") {
        // Rewind
        _unbind();
        sdl.SDL_ClearAudioStream(_stream);
        decoder.seek(0);
        _prefill();
        _bind();
        _applyGain();
        _applyPitch();
        sdl.SDL_ResumeAudioStreamDevice(_stream);
        return;
      }
      if (_state === "paused") {
        sdl.SDL_ResumeAudioStreamDevice(_stream);
        _state = "playing";
        return;
      }
      // stopped → playing
      decoder.seek(0);
      sdl.SDL_ClearAudioStream(_stream);
      _prefill();
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

    isPlaying() { return _state === "playing"; },
    isStopped() { return _state === "stopped"; },
    isPaused() { return _state === "paused"; },

    setVolume(volume: number) {
      _volume = Math.max(0, Math.min(1, volume));
      _applyGain();
    },
    getVolume() { return _volume; },

    setLooping(looping: boolean) { _looping = looping; },
    isLooping() { return _looping; },

    setPitch(pitch: number) {
      _pitch = Math.max(0.01, pitch);
      _applyPitch();
    },
    getPitch() { return _pitch; },

    seek(position: number) {
      if (!_stream) return;
      const frame = Math.max(0, Math.floor(position * sampleRate));
      decoder.seek(frame);
      sdl.SDL_ClearAudioStream(_stream);
      if (_state === "playing") {
        _prefill();
        sdl.SDL_FlushAudioStream(_stream);
      }
    },

    tell(): number {
      if (!_stream || _state === "stopped") return 0;
      // Decoder position minus what's still in the stream buffer
      const available = Math.max(0, sdl.SDL_GetAudioStreamAvailable(_stream) as number);
      const decoderPos = decoder.tell() / sampleRate;
      const buffered = available / _bytesPerSecond;
      return Math.max(0, decoderPos - buffered);
    },

    getDuration(): number {
      return totalDuration;
    },

    clone(): Source {
      // Clone creates a new stream source with its own decoder
      return _createStreamSource(path)!;
    },

    type(): SourceType { return "stream"; },

    release() {
      if (_stream) {
        _unbind();
        sdl.SDL_DestroyAudioStream(_stream);
        _stream = null;
      }
      decoder.close();
      _state = "stopped";
      _sources.delete(source);
    },

    _poll(): boolean {
      if (_state !== "playing" || !_stream) return false;
      const available = sdl.SDL_GetAudioStreamAvailable(_stream);
      if (available <= 0 && decoder.isFinished()) {
        if (_looping) {
          decoder.seek(0);
          _prefill();
        } else {
          _unbind();
          sdl.SDL_ClearAudioStream(_stream);
          _state = "stopped";
          return true;
        }
      }
      return false;
    },

    _applyMasterVolume() { _applyGain(); },
  };

  _sources.add(source);
  return source;
}

// ============================================================
// Queueable source (procedural/streaming audio)
// ============================================================

export interface QueueableSource extends Source {
  /** Queue SoundData for playback. Returns false if buffer slots full or format mismatch. */
  queue(soundData: { _data: Uint8Array; _format: number; _channels: number; _sampleRate: number; _bitDepth: number }): boolean;
  /** Get the number of free buffer slots. */
  getFreeBufferCount(): number;
}

/**
 * Create a queueable audio source for procedural/streaming audio.
 * Data is pushed via queue(soundData) rather than loaded from a file.
 */
export function newQueueableSource(
  sampleRate: number = 44100,
  bitDepth: number = 16,
  channels: number = 1,
  bufferCount: number = 8,
): QueueableSource | null {
  if (!_initialized && !_init()) return null;
  if (!_ensureDevice()) return null;

  const format = bitDepth === 16 ? SDL_AUDIO_S16 : SDL_AUDIO_U8;

  const srcSpec = new Int32Array([format, channels, sampleRate]);
  const dstSpec = new Int32Array([format, channels, sampleRate]);
  let _stream = sdl.SDL_CreateAudioStream(ptr(srcSpec), ptr(dstSpec)) as Pointer | null;
  if (!_stream) return null;

  let _state: SourceState = "stopped";
  let _volume = 1.0;
  let _looping = false;
  let _pitch = 1.0;

  // Track last queued chunk size for getFreeBufferCount estimation
  let _lastChunkSize = 0;

  function _bind(): void {
    if (_stream && _deviceId) sdl.SDL_BindAudioStream(_deviceId, _stream);
  }

  function _unbind(): void {
    if (_stream) sdl.SDL_UnbindAudioStream(_stream);
  }

  function _applyGain(): void {
    if (_stream) sdl.SDL_SetAudioStreamGain(_stream, _volume * _masterVolume);
  }

  function _applyPitch(): void {
    if (_stream) sdl.SDL_SetAudioStreamFrequencyRatio(_stream, _pitch);
  }

  const source: QueueableSource = {
    _type: "queue" as SourceType,

    play() {
      if (!_deviceId) return;
      if (!_stream) {
        // Recreate stream if released
        const newSrcSpec = new Int32Array([format, channels, sampleRate]);
        const newDstSpec = new Int32Array([format, channels, sampleRate]);
        _stream = sdl.SDL_CreateAudioStream(ptr(newSrcSpec), ptr(newDstSpec)) as Pointer | null;
        if (!_stream) return;
        _sources.add(source);
      }
      if (_state === "paused") {
        sdl.SDL_ResumeAudioStreamDevice(_stream);
        _state = "playing";
        return;
      }
      if (_state === "playing") return; // No rewind for queueable
      // stopped → playing
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
      if (!_stream) return;
      if (_state !== "stopped") {
        _unbind();
        _state = "stopped";
      }
      // Always clear queued data, even if already stopped
      sdl.SDL_ClearAudioStream(_stream);
      _lastChunkSize = 0;
    },

    isPlaying() { return _state === "playing"; },
    isStopped() { return _state === "stopped"; },
    isPaused() { return _state === "paused"; },

    setVolume(volume: number) {
      _volume = Math.max(0, Math.min(1, volume));
      _applyGain();
    },
    getVolume() { return _volume; },

    setLooping(looping: boolean) { _looping = looping; },
    isLooping() { return _looping; },

    setPitch(pitch: number) {
      _pitch = Math.max(0.01, pitch);
      _applyPitch();
    },
    getPitch() { return _pitch; },

    seek() { /* no-op for queueable */ },
    tell() { return 0; },
    getDuration() { return 0; },

    clone() { throw new Error("Cannot clone a queueable Source"); },

    type(): SourceType { return "queue"; },

    release() {
      if (_stream) {
        _unbind();
        sdl.SDL_DestroyAudioStream(_stream);
        _stream = null;
      }
      _state = "stopped";
      _lastChunkSize = 0;
      _sources.delete(source);
    },

    _poll(): boolean {
      // Queueable sources do NOT auto-stop when stream empties
      return false;
    },

    _applyMasterVolume() { _applyGain(); },

    // --- QueueableSource-specific ---

    queue(soundData): boolean {
      if (!_stream) return false;
      // Check available bytes to enforce buffer limit
      if (_lastChunkSize > 0) {
        const available = Math.max(0, sdl.SDL_GetAudioStreamAvailable(_stream) as number);
        if (available >= _lastChunkSize * bufferCount) return false;
      }
      // Verify format compatibility
      if (soundData._sampleRate !== sampleRate ||
          soundData._bitDepth !== bitDepth ||
          soundData._channels !== channels) {
        return false;
      }
      // slice() to force fresh ptr() — bun:ffi caches ptr() per TypedArray object,
      // so reused buffers would send stale data without this copy.
      // SDL_PutAudioStreamData copies internally, so the slice is short-lived.
      const data = soundData._data.slice();
      sdl.SDL_PutAudioStreamData(_stream, ptr(data), data.length);
      sdl.SDL_FlushAudioStream(_stream);
      _lastChunkSize = data.length;
      return true;
    },

    getFreeBufferCount(): number {
      if (!_stream) return 0;
      if (_lastChunkSize === 0) return bufferCount;
      const available = Math.max(0, sdl.SDL_GetAudioStreamAvailable(_stream) as number);
      const pendingBuffers = Math.ceil(available / _lastChunkSize);
      return Math.max(0, bufferCount - pendingBuffers);
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
