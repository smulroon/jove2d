// Audio codec FFI bindings (stb_vorbis + dr_mp3 + dr_flac) via bun:ffi
// Separate from ffi.ts so the engine works even without the codec lib installed.

import { dlopen, FFIType } from "bun:ffi";
import { libPath } from "./lib-path";

let lib: ReturnType<typeof _load> | null = null;
let _tried = false;

function _load() {
  const { symbols } = dlopen(libPath("audio_decode", "audio_decode"), {
    // int64_t jove_audio_decode(const char* path, int16_t** out_data, int* out_ch, int* out_rate)
    jove_audio_decode: {
      args: [FFIType.cstring, FFIType.pointer, FFIType.pointer, FFIType.pointer],
      returns: FFIType.i64,
    },
    // void jove_audio_free(int16_t* data)
    jove_audio_free: {
      args: [FFIType.pointer],
      returns: FFIType.void,
    },
  });
  return symbols;
}

/**
 * Try to load the audio decode library. Returns the symbols or null if unavailable.
 * Safe to call multiple times — caches the result.
 */
export function loadAudioDecode(): typeof lib {
  if (_tried) return lib;
  _tried = true;
  try {
    lib = _load();
  } catch {
    // Audio decode lib not available — engine works without it (WAV-only)
    lib = null;
  }
  return lib;
}

export default loadAudioDecode;
