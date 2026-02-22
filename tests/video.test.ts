import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { loadVideo } from "../src/sdl/ffi_video.ts";
import { existsSync } from "fs";

const videoLibAvailable = loadVideo() !== null;

describe("jove.video — pl_mpeg FFI bindings", () => {
  test.skipIf(!videoLibAvailable)("loadVideo returns symbols", () => {
    const lib = loadVideo();
    expect(lib).not.toBeNull();
    expect(typeof lib!.jove_video_open).toBe("function");
    expect(typeof lib!.jove_video_close).toBe("function");
    expect(typeof lib!.jove_video_get_width).toBe("function");
    expect(typeof lib!.jove_video_get_height).toBe("function");
    expect(typeof lib!.jove_video_get_duration).toBe("function");
    expect(typeof lib!.jove_video_get_framerate).toBe("function");
    expect(typeof lib!.jove_video_has_audio).toBe("function");
    expect(typeof lib!.jove_video_get_samplerate).toBe("function");
    expect(typeof lib!.jove_video_play).toBe("function");
    expect(typeof lib!.jove_video_pause).toBe("function");
    expect(typeof lib!.jove_video_stop).toBe("function");
    expect(typeof lib!.jove_video_is_playing).toBe("function");
    expect(typeof lib!.jove_video_has_ended).toBe("function");
    expect(typeof lib!.jove_video_set_looping).toBe("function");
    expect(typeof lib!.jove_video_is_looping).toBe("function");
    expect(typeof lib!.jove_video_tell).toBe("function");
    expect(typeof lib!.jove_video_seek).toBe("function");
    expect(typeof lib!.jove_video_update).toBe("function");
    expect(typeof lib!.jove_video_get_pixels).toBe("function");
    expect(typeof lib!.jove_video_get_audio_size).toBe("function");
    expect(typeof lib!.jove_video_get_audio_ptr).toBe("function");
  });

  test.skipIf(!videoLibAvailable)("open invalid file returns -1", () => {
    const lib = loadVideo()!;
    const idx = lib.jove_video_open(Buffer.from("/nonexistent.mpg\0"), 0);
    expect(idx).toBe(-1);
  });

  test.skipIf(!videoLibAvailable)("getters return 0 for invalid index", () => {
    const lib = loadVideo()!;
    expect(lib.jove_video_get_width(-1)).toBe(0);
    expect(lib.jove_video_get_height(-1)).toBe(0);
    expect(lib.jove_video_get_duration(-1)).toBe(0);
    expect(lib.jove_video_get_framerate(-1)).toBe(0);
    expect(lib.jove_video_has_audio(-1)).toBe(0);
    expect(lib.jove_video_get_samplerate(-1)).toBe(0);
    expect(lib.jove_video_is_playing(-1)).toBe(0);
    expect(lib.jove_video_has_ended(-1)).toBe(1);
    expect(lib.jove_video_is_looping(-1)).toBe(0);
  });

  test.skipIf(!videoLibAvailable)("playback control on invalid index is safe", () => {
    const lib = loadVideo()!;
    // These should not crash
    lib.jove_video_play(-1);
    lib.jove_video_pause(-1);
    lib.jove_video_stop(-1);
    lib.jove_video_set_looping(-1, 1);
    lib.jove_video_seek(-1, 0);
    expect(lib.jove_video_update(-1, 0.016)).toBe(0);
  });

  test.skipIf(!videoLibAvailable)("get_pixels returns null for invalid index", () => {
    const lib = loadVideo()!;
    expect(lib.jove_video_get_pixels(-1)).toBeNull();
    expect(lib.jove_video_get_audio_ptr(-1)).toBeNull();
    expect(lib.jove_video_get_audio_size(-1)).toBe(0);
  });
});

describe("jove.video — Video module", () => {
  test("newVideo import exists", async () => {
    const videoMod = await import("../src/jove/video.ts");
    expect(typeof videoMod.newVideo).toBe("function");
    expect(typeof videoMod._updateVideos).toBe("function");
    expect(typeof videoMod._quit).toBe("function");
  });

  test.skipIf(!videoLibAvailable)("newVideo returns null without renderer", async () => {
    const videoMod = await import("../src/jove/video.ts");
    // No SDL renderer initialized, should return null gracefully
    const v = videoMod.newVideo("/nonexistent.mpg");
    expect(v).toBeNull();
  });

  test("_updateVideos is safe with no videos", async () => {
    const videoMod = await import("../src/jove/video.ts");
    // Should not crash even without any videos
    videoMod._updateVideos(0.016);
  });

  test("_quit is safe with no videos", async () => {
    const videoMod = await import("../src/jove/video.ts");
    videoMod._quit();
  });
});

describe("jove.video — graceful fallback", () => {
  test("loadVideo returns null or symbols", () => {
    const lib = loadVideo();
    // Either null (lib not built) or has all expected functions
    if (lib) {
      expect(typeof lib.jove_video_open).toBe("function");
    } else {
      expect(lib).toBeNull();
    }
  });
});
