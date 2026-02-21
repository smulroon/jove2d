// jove2d sound module — mirrors love.sound API
// Provides SoundData for sample-level audio manipulation

import { SDL_AUDIO_U8, SDL_AUDIO_S16 } from "../sdl/types.ts";
import { _decodeFile } from "./audio.ts";

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

function _createSoundData(
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
