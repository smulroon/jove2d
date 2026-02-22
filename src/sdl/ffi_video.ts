// pl_mpeg video decoder FFI bindings via bun:ffi
// Separate from ffi.ts so the engine works even without the video lib installed.

import { dlopen, FFIType } from "bun:ffi";
import { libPath } from "./lib-path";

let lib: ReturnType<typeof _load> | null = null;
let _tried = false;

function _load() {
  const { symbols } = dlopen(libPath("pl_mpeg", "pl_mpeg_jove"), {
    // int jove_video_open(const char* path, int decode_audio)
    jove_video_open: {
      args: [FFIType.cstring, FFIType.i32],
      returns: FFIType.i32,
    },
    // void jove_video_close(int idx)
    jove_video_close: {
      args: [FFIType.i32],
      returns: FFIType.void,
    },
    // int jove_video_get_width(int idx)
    jove_video_get_width: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    // int jove_video_get_height(int idx)
    jove_video_get_height: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    // float jove_video_get_duration(int idx)
    jove_video_get_duration: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    // float jove_video_get_framerate(int idx)
    jove_video_get_framerate: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    // int jove_video_has_audio(int idx)
    jove_video_has_audio: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    // int jove_video_get_samplerate(int idx)
    jove_video_get_samplerate: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    // void jove_video_play(int idx)
    jove_video_play: {
      args: [FFIType.i32],
      returns: FFIType.void,
    },
    // void jove_video_pause(int idx)
    jove_video_pause: {
      args: [FFIType.i32],
      returns: FFIType.void,
    },
    // void jove_video_stop(int idx)
    jove_video_stop: {
      args: [FFIType.i32],
      returns: FFIType.void,
    },
    // int jove_video_is_playing(int idx)
    jove_video_is_playing: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    // int jove_video_has_ended(int idx)
    jove_video_has_ended: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    // void jove_video_set_looping(int idx, int loop)
    jove_video_set_looping: {
      args: [FFIType.i32, FFIType.i32],
      returns: FFIType.void,
    },
    // int jove_video_is_looping(int idx)
    jove_video_is_looping: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    // float jove_video_tell(int idx)
    jove_video_tell: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    // void jove_video_seek(int idx, float t)
    jove_video_seek: {
      args: [FFIType.i32, FFIType.f32],
      returns: FFIType.void,
    },
    // int jove_video_update(int idx, float dt)
    jove_video_update: {
      args: [FFIType.i32, FFIType.f32],
      returns: FFIType.i32,
    },
    // void* jove_video_get_pixels(int idx)
    jove_video_get_pixels: {
      args: [FFIType.i32],
      returns: FFIType.pointer,
    },
    // int jove_video_get_audio_size(int idx)
    jove_video_get_audio_size: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    // void* jove_video_get_audio_ptr(int idx)
    jove_video_get_audio_ptr: {
      args: [FFIType.i32],
      returns: FFIType.pointer,
    },
  });
  return symbols;
}

/**
 * Try to load the pl_mpeg video library. Returns the symbols or null if unavailable.
 * Safe to call multiple times — caches the result.
 */
export function loadVideo(): typeof lib {
  if (_tried) return lib;
  _tried = true;
  try {
    lib = _load();
  } catch {
    // Video lib not available — engine works without it
    lib = null;
  }
  return lib;
}

export default loadVideo;
