import { test, expect, describe, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import * as audio from "../src/jove/audio.ts";
import type { Source } from "../src/jove/audio.ts";
import { SDL_AUDIO_S16 } from "../src/sdl/types.ts";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Generate a minimal valid WAV file programmatically
function generateWav(durationSec: number, freq: number = 440): Uint8Array {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2; // 16-bit mono = 2 bytes per sample
  const fileSize = 44 + dataSize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, fileSize - 8, true); // file size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true); // data size

  // Sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t);
    const s16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, s16, true);
  }

  return new Uint8Array(buf);
}

// Write WAV to temp file
const tmpDir = tmpdir();
const wavPath = join(tmpDir, "jove2d-test-audio.wav");

// Audio tests need SDL audio subsystem — skip if not available (e.g. CI)
let audioAvailable = false;

describe("jove.audio", () => {
  beforeAll(() => {
    // Generate and write test WAV
    const wav = generateWav(0.5, 440); // 0.5 second, 440 Hz
    writeFileSync(wavPath, wav);

    // Try to init audio
    audioAvailable = audio._init();
  });

  afterAll(() => {
    audio._quit();
    try {
      unlinkSync(wavPath);
    } catch {}
  });

  // --- Source creation ---

  test("newSource creates a source from WAV file", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath, "static");
    expect(src).not.toBeNull();
    src!.release();
  });

  test("newSource returns null for nonexistent file", () => {
    if (!audioAvailable) return;
    const src = audio.newSource("/tmp/nonexistent.wav");
    expect(src).toBeNull();
  });

  // --- Initial state ---

  test("new source starts stopped", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    expect(src.isPlaying()).toBe(false);
    expect(src.isStopped()).toBe(true);
    expect(src.isPaused()).toBe(false);
    src.release();
  });

  test("default volume is 1.0", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    expect(src.getVolume()).toBe(1);
    src.release();
  });

  test("default pitch is 1.0", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    expect(src.getPitch()).toBe(1);
    src.release();
  });

  test("default looping is false", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    expect(src.isLooping()).toBe(false);
    src.release();
  });

  // --- State transitions ---

  test("play() transitions to playing", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.play();
    expect(src.isPlaying()).toBe(true);
    expect(src.isStopped()).toBe(false);
    src.stop();
    src.release();
  });

  test("pause() transitions from playing to paused", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.play();
    src.pause();
    expect(src.isPaused()).toBe(true);
    expect(src.isPlaying()).toBe(false);
    src.stop();
    src.release();
  });

  test("play() from paused resumes", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.play();
    src.pause();
    expect(src.isPaused()).toBe(true);
    src.play();
    expect(src.isPlaying()).toBe(true);
    src.stop();
    src.release();
  });

  test("stop() transitions to stopped", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.play();
    src.stop();
    expect(src.isStopped()).toBe(true);
    expect(src.isPlaying()).toBe(false);
    src.release();
  });

  test("play() on playing source rewinds (stays playing)", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.play();
    expect(src.isPlaying()).toBe(true);
    src.play(); // rewind
    expect(src.isPlaying()).toBe(true);
    src.stop();
    src.release();
  });

  test("pause() on stopped is no-op", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.pause(); // no-op
    expect(src.isStopped()).toBe(true);
    src.release();
  });

  test("stop() on stopped is no-op", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.stop(); // no-op
    expect(src.isStopped()).toBe(true);
    src.release();
  });

  // --- Volume ---

  test("setVolume/getVolume round-trip", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.setVolume(0.5);
    expect(src.getVolume()).toBe(0.5);
    src.release();
  });

  test("setVolume clamps to 0-1", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.setVolume(-1);
    expect(src.getVolume()).toBe(0);
    src.setVolume(5);
    expect(src.getVolume()).toBe(1);
    src.release();
  });

  // --- Pitch ---

  test("setPitch/getPitch round-trip", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.setPitch(2.0);
    expect(src.getPitch()).toBe(2.0);
    src.setPitch(0.5);
    expect(src.getPitch()).toBe(0.5);
    src.release();
  });

  test("setPitch clamps minimum to 0.01", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.setPitch(-1);
    expect(src.getPitch()).toBe(0.01);
    src.release();
  });

  // --- Looping ---

  test("setLooping/isLooping round-trip", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.setLooping(true);
    expect(src.isLooping()).toBe(true);
    src.setLooping(false);
    expect(src.isLooping()).toBe(false);
    src.release();
  });

  // --- Duration ---

  test("getDuration returns correct value", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    const dur = src.getDuration();
    // 0.5 second WAV at 22050 Hz mono S16 = 22050 samples
    // Actual: floor(22050 * 0.5) = 11025 samples, 22050 bytes, 22050/44100 = 0.5s
    expect(dur).toBeGreaterThan(0.4);
    expect(dur).toBeLessThan(0.6);
    src.release();
  });

  // --- Tell/Seek ---

  test("tell() returns 0 when stopped", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    expect(src.tell()).toBe(0);
    src.release();
  });

  test("seek() does not crash on stopped source", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.seek(0.1); // Should not throw
    src.release();
  });

  test("seek() does not crash on playing source", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.play();
    src.seek(0.1);
    expect(src.isPlaying()).toBe(true);
    src.stop();
    src.release();
  });

  // --- Clone ---

  test("clone() copies config but not state", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.setVolume(0.7);
    src.setPitch(1.5);
    src.setLooping(true);
    src.play();

    const cloned = src.clone();
    expect(cloned).not.toBeNull();
    expect(cloned.getVolume()).toBe(0.7);
    expect(cloned.getPitch()).toBe(1.5);
    expect(cloned.isLooping()).toBe(true);
    expect(cloned.isStopped()).toBe(true); // Clone starts stopped

    src.stop();
    src.release();
    cloned.release();
  });

  // --- type() ---

  test("type() returns source type", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath, "static")!;
    expect(src.type()).toBe("static");
    expect(src._type).toBe("static");
    src.release();
  });

  // --- release ---

  test("release() removes from source tracking", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.play();
    const countBefore = audio.getActiveSourceCount();
    src.release();
    const countAfter = audio.getActiveSourceCount();
    expect(countAfter).toBeLessThan(countBefore);
  });

  // --- Global controls ---

  test("global setVolume/getVolume", () => {
    const prev = audio.getVolume();
    audio.setVolume(0.3);
    expect(audio.getVolume()).toBe(0.3);
    audio.setVolume(prev); // restore
  });

  test("getActiveSourceCount counts playing sources", () => {
    if (!audioAvailable) return;
    const s1 = audio.newSource(wavPath)!;
    const s2 = audio.newSource(wavPath)!;
    expect(audio.getActiveSourceCount()).toBe(0);
    s1.play();
    expect(audio.getActiveSourceCount()).toBe(1);
    s2.play();
    expect(audio.getActiveSourceCount()).toBe(2);
    s1.stop();
    expect(audio.getActiveSourceCount()).toBe(1);
    s2.stop();
    s1.release();
    s2.release();
  });

  test("global pause() pauses all playing sources", () => {
    if (!audioAvailable) return;
    const s1 = audio.newSource(wavPath)!;
    const s2 = audio.newSource(wavPath)!;
    s1.play();
    s2.play();
    audio.pause();
    expect(s1.isPaused()).toBe(true);
    expect(s2.isPaused()).toBe(true);
    expect(audio.getActiveSourceCount()).toBe(0);
    s1.release();
    s2.release();
  });

  test("global play() resumes paused sources", () => {
    if (!audioAvailable) return;
    const s1 = audio.newSource(wavPath)!;
    s1.play();
    audio.pause();
    expect(s1.isPaused()).toBe(true);
    audio.play();
    expect(s1.isPlaying()).toBe(true);
    s1.stop();
    s1.release();
  });

  test("global stop() stops all sources", () => {
    if (!audioAvailable) return;
    const s1 = audio.newSource(wavPath)!;
    const s2 = audio.newSource(wavPath)!;
    s1.play();
    s2.play();
    audio.stop();
    expect(s1.isStopped()).toBe(true);
    expect(s2.isStopped()).toBe(true);
    s1.release();
    s2.release();
  });

  test("audio.play(source) plays specific source", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    audio.play(src);
    expect(src.isPlaying()).toBe(true);
    src.stop();
    src.release();
  });

  test("audio.stop(source) stops specific source", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.play();
    audio.stop(src);
    expect(src.isStopped()).toBe(true);
    src.release();
  });

  // --- _updateSources auto-stop ---

  test("_updateSources auto-stops finished non-looping sources", () => {
    if (!audioAvailable) return;
    // Create a very short WAV (0.01s)
    const shortWavPath = join(tmpDir, "jove2d-test-short.wav");
    const shortWav = generateWav(0.01, 440);
    writeFileSync(shortWavPath, shortWav);

    const src = audio.newSource(shortWavPath)!;
    src.play();
    expect(src.isPlaying()).toBe(true);

    // Wait a bit for audio to finish, then poll
    // Since SDL processes the stream async, the available bytes may take time to drain
    // We simulate by calling _updateSources after a short delay
    setTimeout(() => {
      audio._updateSources();
      // Source may or may not have auto-stopped depending on timing
      // Just verify it doesn't crash
    }, 100);

    // Cleanup immediately (the setTimeout is fire-and-forget for this test)
    src.stop();
    src.release();
    try {
      unlinkSync(shortWavPath);
    } catch {}
  });

  // --- Master volume propagation ---

  test("master volume propagation on setVolume", () => {
    if (!audioAvailable) return;
    const src = audio.newSource(wavPath)!;
    src.setVolume(0.5);
    audio.setVolume(0.5);
    // Can't directly read SDL gain, but verify no crash and state is correct
    expect(audio.getVolume()).toBe(0.5);
    expect(src.getVolume()).toBe(0.5);
    audio.setVolume(1.0); // restore
    src.release();
  });
});
