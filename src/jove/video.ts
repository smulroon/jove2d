// jove2d video module — mirrors love.video API
// Uses pl_mpeg for MPEG-1 video + MP2 audio decoding

import { ptr } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import { loadVideo } from "../sdl/ffi_video.ts";
import {
  SDL_PIXELFORMAT_ABGR8888,
  SDL_AUDIO_S16,
  SDL_BLENDMODE_BLEND,
} from "../sdl/types.ts";
import { _ensureDevice, _getDeviceId } from "./audio.ts";
import { _getRenderer } from "./graphics.ts";

type SDLTexture = Pointer;

export interface Video {
  _texture: SDLTexture;
  _width: number;
  _height: number;
  _isVideo: true;

  play(): void;
  pause(): void;
  rewind(): void;
  seek(t: number): void;
  tell(): number;
  isPlaying(): boolean;
  getWidth(): number;
  getHeight(): number;
  getDimensions(): [number, number];
  getDuration(): number;
  getSource(): VideoAudioSource | null;
  setFilter(min: string, mag: string): void;
  getFilter(): [string, string];
  setLooping(loop: boolean): void;
  isLooping(): boolean;
  release(): void;
}

export interface VideoAudioSource {
  setVolume(v: number): void;
  getVolume(): number;
}

// Internal state stored alongside each Video
interface VideoInternal {
  idx: number;
  audioStream: Pointer | null;
  audioVolume: number;
  released: boolean;
  filterMin: string;
  filterMag: string;
}

const _videos = new Map<Video, VideoInternal>();

/**
 * Open an MPEG-1 video file. Returns a Video object or null if pl_mpeg is unavailable.
 *
 * Options:
 * - audio: boolean (default true) — decode MP2 audio track if present
 */
export function newVideo(path: string, options?: { audio?: boolean }): Video | null {
  const vlib = loadVideo();
  if (!vlib) return null;

  const renderer = _getRenderer();
  if (!renderer) return null;

  const decodeAudio = options?.audio !== false;
  const idx = vlib.jove_video_open(Buffer.from(path + "\0"), decodeAudio ? 1 : 0);
  if (idx < 0) return null;

  const width = vlib.jove_video_get_width(idx);
  const height = vlib.jove_video_get_height(idx);
  const hasAudio = vlib.jove_video_has_audio(idx) !== 0;

  // Create initial texture from first frame via surface→texture path.
  // This lets SDL handle pixel format conversion to the GPU's native format.
  // plm_frame_to_rgba outputs bytes [R,G,B,A] — SDL_PIXELFORMAT_ABGR8888 on LE
  // stores bytes [R,G,B,A] (packed uint32: A=MSB, R=LSB).
  const pixelsPtr = vlib.jove_video_get_pixels(idx);
  const surface = sdl.SDL_CreateSurfaceFrom(
    width, height, SDL_PIXELFORMAT_ABGR8888, pixelsPtr, width * 4
  ) as Pointer | null;
  if (!surface) {
    vlib.jove_video_close(idx);
    return null;
  }
  let texture = sdl.SDL_CreateTextureFromSurface(renderer, surface) as SDLTexture | null;
  sdl.SDL_DestroySurface(surface);
  if (!texture) {
    vlib.jove_video_close(idx);
    return null;
  }
  sdl.SDL_SetTextureBlendMode(texture, SDL_BLENDMODE_BLEND);
  sdl.SDL_SetTextureScaleMode(texture, 1); // SDL_SCALEMODE_LINEAR

  // Audio stream (if video has audio)
  let audioStream: Pointer | null = null;
  if (hasAudio) {
    const sampleRate = vlib.jove_video_get_samplerate(idx);
    if (sampleRate > 0 && _ensureDevice()) {
      const srcSpec = new Int32Array([SDL_AUDIO_S16, 2, sampleRate]);
      const dstSpec = new Int32Array([SDL_AUDIO_S16, 2, sampleRate]);
      audioStream = sdl.SDL_CreateAudioStream(ptr(srcSpec), ptr(dstSpec)) as Pointer | null;
      if (audioStream) {
        sdl.SDL_BindAudioStream(_getDeviceId(), audioStream);
      }
    }
  }

  const internal: VideoInternal = {
    idx,
    audioStream,
    audioVolume: 1.0,
    released: false,
    filterMin: "linear",
    filterMag: "linear",
  };

  const video: Video = {
    _texture: texture,
    _width: width,
    _height: height,
    _isVideo: true,

    play() {
      if (internal.released) return;
      vlib.jove_video_play(idx);
    },

    pause() {
      if (internal.released) return;
      vlib.jove_video_pause(idx);
    },

    rewind() {
      if (internal.released) return;
      vlib.jove_video_stop(idx);
      if (internal.audioStream) {
        sdl.SDL_ClearAudioStream(internal.audioStream);
      }
    },

    seek(t: number) {
      if (internal.released) return;
      vlib.jove_video_seek(idx, t);
      if (internal.audioStream) {
        sdl.SDL_ClearAudioStream(internal.audioStream);
      }
    },

    tell() {
      if (internal.released) return 0;
      return vlib.jove_video_tell(idx);
    },

    isPlaying() {
      if (internal.released) return false;
      return vlib.jove_video_is_playing(idx) !== 0;
    },

    getWidth() { return width; },
    getHeight() { return height; },
    getDimensions() { return [width, height]; },

    getDuration() {
      if (internal.released) return 0;
      return vlib.jove_video_get_duration(idx);
    },

    getSource() {
      if (!internal.audioStream) return null;
      return {
        setVolume(v: number) {
          internal.audioVolume = Math.max(0, Math.min(1, v));
        },
        getVolume() {
          return internal.audioVolume;
        },
      };
    },

    setFilter(min: string, mag: string) {
      internal.filterMin = min;
      internal.filterMag = mag;
      const mode = mag === "linear" ? 1 : 0;
      sdl.SDL_SetTextureScaleMode(video._texture, mode);
    },

    getFilter() { return [internal.filterMin, internal.filterMag]; },

    setLooping(loop: boolean) {
      if (internal.released) return;
      vlib.jove_video_set_looping(idx, loop ? 1 : 0);
    },

    isLooping() {
      if (internal.released) return false;
      return vlib.jove_video_is_looping(idx) !== 0;
    },

    release() {
      if (internal.released) return;
      internal.released = true;
      _videos.delete(video);
      if (internal.audioStream) {
        sdl.SDL_UnbindAudioStream(internal.audioStream);
        sdl.SDL_DestroyAudioStream(internal.audioStream);
        internal.audioStream = null;
      }
      if (video._texture) {
        sdl.SDL_DestroyTexture(video._texture);
      }
      vlib.jove_video_close(idx);
    },
  };

  _videos.set(video, internal);
  return video;
}

/** Update all active videos. Called once per frame from the game loop. */
export function _updateVideos(dt: number): void {
  const vlib = loadVideo();
  if (!vlib) return;

  const renderer = _getRenderer();

  for (const [video, internal] of _videos) {
    if (internal.released) continue;
    const { idx, audioStream } = internal;

    // Advance playback (decodes video + audio frames internally)
    const gotFrame = vlib.jove_video_update(idx, dt);

    if (gotFrame && renderer) {
      // Create surface from decoded RGBA pixels, then texture from surface.
      // SDL handles pixel format conversion to the GPU's native format.
      const pixelsPtr = vlib.jove_video_get_pixels(idx);
      if (pixelsPtr) {
        const surface = sdl.SDL_CreateSurfaceFrom(
          video._width, video._height, SDL_PIXELFORMAT_ABGR8888,
          pixelsPtr, video._width * 4
        ) as Pointer | null;
        if (surface) {
          const newTex = sdl.SDL_CreateTextureFromSurface(renderer, surface) as SDLTexture | null;
          sdl.SDL_DestroySurface(surface);
          if (newTex) {
            sdl.SDL_SetTextureBlendMode(newTex, SDL_BLENDMODE_BLEND);
            const mode = internal.filterMag === "linear" ? 1 : 0;
            sdl.SDL_SetTextureScaleMode(newTex, mode);
            // Swap textures
            sdl.SDL_DestroyTexture(video._texture);
            video._texture = newTex;
          }
        }
      }
    }

    // Feed decoded audio to SDL audio stream
    if (audioStream) {
      const audioSize = vlib.jove_video_get_audio_size(idx);
      if (audioSize > 0) {
        const audioPtr = vlib.jove_video_get_audio_ptr(idx);
        if (audioPtr) {
          sdl.SDL_PutAudioStreamData(audioStream, audioPtr, audioSize);
        }
      }
    }
  }
}

/** Release all videos. Called on quit. */
export function _quit(): void {
  for (const [video] of _videos) {
    video.release();
  }
  _videos.clear();
}
