// jove2d sound module — mirrors love.sound API
// Provides SoundData for sample-level audio manipulation + streaming Decoder

import { read, toArrayBuffer } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import { SDL_AUDIO_U8, SDL_AUDIO_S16 } from "../sdl/types.ts";
import { _decodeFile } from "./audio.ts";
import { loadAudioDecode } from "../sdl/ffi_audio_decode.ts";

export interface SoundData {
  /** Get sample value at frame index i, normalized -1..1. Optional channel (1-based, default 1). */
  getSample(i: number, channel?: number): number;
  /** Set sample value at frame index i, normalized -1..1. Optional channel (1-based, default 1). */
  setSample(i: number, value: number, channel?: number): void;
  /** Total number of sample frames. */
  getSampleCount(): number;
  /** Sample rate in Hz (e.g. 44100). */
  getSampleRate(): number;
  /** Bit depth (8 or 16). */
  getBitDepth(): number;
  /** Number of audio channels (1=mono, 2=stereo). */
  getChannelCount(): number;
  /** Duration in seconds. */
  getDuration(): number;
  /** Raw PCM bytes as a binary string (love2d compat). */
  getString(): string;
  /** @internal — raw PCM byte data */
  _data: Uint8Array;
  /** @internal — SDL audio format constant */
  _format: number;
  /** @internal */
  _channels: number;
  /** @internal */
  _sampleRate: number;
  /** @internal */
  _bitDepth: number;
}

/**
 * Create a new SoundData.
 * - `newSoundData(samples, rate?, bitDepth?, channels?)` — allocate empty buffer
 * - `newSoundData(filepath)` — decode from audio file (WAV/OGG/MP3/FLAC)
 */
export function newSoundData(
  samplesOrPath: number | string,
  rate: number = 44100,
  bitDepth: number = 16,
  channels: number = 1,
): SoundData {
  if (typeof samplesOrPath === "string") {
    return _fromFile(samplesOrPath);
  }
  return _fromEmpty(samplesOrPath, rate, bitDepth, channels);
}

function _fromEmpty(samples: number, rate: number, bitDepth: number, channels: number): SoundData {
  const bytesPerSample = bitDepth === 16 ? 2 : 1;
  const totalBytes = samples * channels * bytesPerSample;
  const data = new Uint8Array(totalBytes);
  const format = bitDepth === 16 ? SDL_AUDIO_S16 : SDL_AUDIO_U8;
  // For 8-bit, silence is 128 (unsigned center)
  if (bitDepth === 8) data.fill(128);
  return _createSoundData(data, format, channels, rate, bitDepth);
}

function _fromFile(path: string): SoundData {
  const decoded = _decodeFile(path);
  if (!decoded) throw new Error(`Could not load audio file: ${path}`);
  const bitDepth = decoded.format === SDL_AUDIO_U8 ? 8 : 16;
  return _createSoundData(decoded.data, decoded.format, decoded.channels, decoded.freq, bitDepth);
}

export function _createSoundData(
  data: Uint8Array,
  format: number,
  channels: number,
  sampleRate: number,
  bitDepth: number,
): SoundData {
  const bytesPerSample = bitDepth === 16 ? 2 : 1;
  const frameCount = Math.floor(data.length / (channels * bytesPerSample));

  // Typed view for 16-bit sample access
  const view16 = bitDepth === 16
    ? new Int16Array(data.buffer, data.byteOffset, Math.floor(data.length / 2))
    : null;

  return {
    _data: data,
    _format: format,
    _channels: channels,
    _sampleRate: sampleRate,
    _bitDepth: bitDepth,

    getSample(i: number, channel: number = 1): number {
      const ch = channel - 1; // 1-based → 0-based
      if (i < 0 || i >= frameCount || ch < 0 || ch >= channels) return 0;
      if (view16) {
        return view16[i * channels + ch] / 32768;
      } else {
        // 8-bit unsigned: 0-255 → -1..1
        return (data[i * channels + ch] - 128) / 128;
      }
    },

    setSample(i: number, value: number, channel: number = 1): void {
      const ch = channel - 1;
      if (i < 0 || i >= frameCount || ch < 0 || ch >= channels) return;
      const clamped = Math.max(-1, Math.min(1, value));
      if (view16) {
        view16[i * channels + ch] = Math.round(clamped * 32767);
      } else {
        data[i * channels + ch] = Math.round(clamped * 128 + 128);
      }
    },

    getSampleCount(): number {
      return frameCount;
    },

    getSampleRate(): number {
      return sampleRate;
    },

    getBitDepth(): number {
      return bitDepth;
    },

    getChannelCount(): number {
      return channels;
    },

    getDuration(): number {
      return frameCount / sampleRate;
    },

    getString(): string {
      let str = "";
      for (let i = 0; i < data.length; i++) {
        str += String.fromCharCode(data[i]);
      }
      return str;
    },
  };
}

// ============================================================
// Streaming Decoder — mirrors love.sound.newDecoder
// ============================================================

export interface Decoder {
  /** Read next chunk of PCM data. Returns SoundData or null on EOF. */
  decode(): SoundData | null;
  /** Seek to a PCM frame offset. */
  seek(offset: number): void;
  /** Get current position in frames. */
  tell(): number;
  /** Bit depth (always 16 for decoded audio). */
  getBitDepth(): number;
  /** Number of audio channels. */
  getChannelCount(): number;
  /** Sample rate in Hz. */
  getSampleRate(): number;
  /** Total duration in seconds. */
  getDuration(): number;
  /** Total number of sample frames. */
  getSampleCount(): number;
  /** True if last decode() returned null (EOF). */
  isFinished(): boolean;
  /** Release the C decoder handle. */
  close(): void;
  /** @internal — handle index for streaming sources */
  _idx: number;
  /** @internal — buffer size in frames */
  _bufferSize: number;
}

/**
 * Create a streaming audio decoder.
 * Reads chunks of PCM incrementally instead of loading the entire file.
 *
 * @param path       Path to an audio file (OGG/MP3/FLAC)
 * @param bufferSize Number of frames per decode() call (default 4096, matches love2d)
 */
export function newDecoder(path: string, bufferSize: number = 4096): Decoder {
  const lib = loadAudioDecode();
  if (!lib) throw new Error("Audio decode library not available");

  const idx = lib.jove_decoder_open(Buffer.from(path + "\0"));
  if (idx < 0) throw new Error(`Could not open decoder for: ${path}`);

  // Read metadata
  const outCh = new Int32Array(1);
  const outRate = new Int32Array(1);
  const outTotal = new BigInt64Array(1);
  lib.jove_decoder_get_info(idx, outCh, outRate, outTotal);

  const channels = outCh[0];
  const sampleRate = outRate[0];
  const totalFrames = Number(outTotal[0]);

  // Get C-side buffer pointer (avoids ptr() Windows bug)
  const bufPtr = lib.jove_decoder_get_buf() as Pointer;

  let _finished = false;
  let _closed = false;

  return {
    _idx: idx,
    _bufferSize: bufferSize,

    decode(): SoundData | null {
      if (_closed || _finished) return null;

      const framesRead = Number(lib.jove_decoder_read(idx, bufferSize));
      if (framesRead <= 0) {
        _finished = true;
        return null;
      }

      // Copy from C-side buffer to JS
      const byteLen = framesRead * channels * 2; // S16 = 2 bytes per sample
      const data = new Uint8Array(toArrayBuffer(bufPtr, 0, byteLen).slice(0));

      return _createSoundData(data, SDL_AUDIO_S16, channels, sampleRate, 16);
    },

    seek(offset: number): void {
      if (_closed) return;
      lib.jove_decoder_seek(idx, BigInt(Math.max(0, Math.floor(offset))));
      _finished = false;
    },

    tell(): number {
      if (_closed) return 0;
      return Number(lib.jove_decoder_tell(idx));
    },

    getBitDepth(): number { return 16; },
    getChannelCount(): number { return channels; },
    getSampleRate(): number { return sampleRate; },
    getDuration(): number { return totalFrames / sampleRate; },
    getSampleCount(): number { return totalFrames; },
    isFinished(): boolean { return _finished; },

    close(): void {
      if (_closed) return;
      lib.jove_decoder_close(idx);
      _closed = true;
      _finished = true;
    },
  };
}
