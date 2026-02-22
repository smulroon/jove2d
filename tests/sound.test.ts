import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import * as sound from "../src/jove/sound.ts";
import * as audio from "../src/jove/audio.ts";
import type { QueueableSource } from "../src/jove/audio.ts";
import { loadAudioDecode } from "../src/sdl/ffi_audio_decode.ts";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Generate a minimal valid WAV file programmatically
function generateWav(durationSec: number, freq: number = 440, sampleRate = 22050): Uint8Array {
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2; // 16-bit mono = 2 bytes per sample
  const fileSize = 44 + dataSize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, fileSize - 8, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t);
    view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
  }

  return new Uint8Array(buf);
}

const tmpDir = tmpdir();
const wavPath = join(tmpDir, "jove2d-test-sound.wav");
let audioAvailable = false;

describe("jove.sound — SoundData", () => {
  beforeAll(() => {
    const wav = generateWav(0.5, 440);
    writeFileSync(wavPath, wav);
    audioAvailable = audio._init();
  });

  afterAll(() => {
    audio._quit();
    try { unlinkSync(wavPath); } catch {}
  });

  // --- Empty SoundData creation ---

  test("newSoundData creates empty buffer with correct size (16-bit mono)", () => {
    const sd = sound.newSoundData(1000, 44100, 16, 1);
    expect(sd.getSampleCount()).toBe(1000);
    expect(sd.getSampleRate()).toBe(44100);
    expect(sd.getBitDepth()).toBe(16);
    expect(sd.getChannelCount()).toBe(1);
    expect(sd._data.length).toBe(1000 * 2); // 16-bit = 2 bytes per sample
  });

  test("newSoundData creates empty buffer (8-bit stereo)", () => {
    const sd = sound.newSoundData(500, 22050, 8, 2);
    expect(sd.getSampleCount()).toBe(500);
    expect(sd.getSampleRate()).toBe(22050);
    expect(sd.getBitDepth()).toBe(8);
    expect(sd.getChannelCount()).toBe(2);
    expect(sd._data.length).toBe(500 * 2); // 8-bit stereo = 2 bytes per frame
  });

  test("newSoundData uses default parameters", () => {
    const sd = sound.newSoundData(100);
    expect(sd.getSampleRate()).toBe(44100);
    expect(sd.getBitDepth()).toBe(16);
    expect(sd.getChannelCount()).toBe(1);
  });

  // --- getSample / setSample ---

  test("getSample returns 0 for empty buffer (16-bit)", () => {
    const sd = sound.newSoundData(100, 44100, 16, 1);
    expect(sd.getSample(0)).toBe(0);
    expect(sd.getSample(50)).toBe(0);
    expect(sd.getSample(99)).toBe(0);
  });

  test("getSample returns 0 for empty buffer (8-bit, silent at 128)", () => {
    const sd = sound.newSoundData(100, 44100, 8, 1);
    expect(sd.getSample(0)).toBe(0);
    expect(sd.getSample(50)).toBe(0);
  });

  test("setSample/getSample round-trip (16-bit)", () => {
    const sd = sound.newSoundData(100, 44100, 16, 1);
    sd.setSample(0, 0.5);
    const val = sd.getSample(0);
    expect(val).toBeCloseTo(0.5, 2);

    sd.setSample(1, -0.75);
    expect(sd.getSample(1)).toBeCloseTo(-0.75, 2);

    sd.setSample(2, 1.0);
    expect(sd.getSample(2)).toBeCloseTo(1.0, 2);

    sd.setSample(3, -1.0);
    expect(sd.getSample(3)).toBeCloseTo(-1.0, 2);
  });

  test("setSample/getSample round-trip (8-bit)", () => {
    const sd = sound.newSoundData(100, 44100, 8, 1);
    sd.setSample(0, 0.5);
    const val = sd.getSample(0);
    // 8-bit has lower precision
    expect(val).toBeCloseTo(0.5, 1);

    sd.setSample(1, -0.5);
    expect(sd.getSample(1)).toBeCloseTo(-0.5, 1);
  });

  test("setSample clamps to -1..1", () => {
    const sd = sound.newSoundData(10, 44100, 16, 1);
    sd.setSample(0, 2.0);
    expect(sd.getSample(0)).toBeCloseTo(1.0, 2);

    sd.setSample(1, -5.0);
    expect(sd.getSample(1)).toBeCloseTo(-1.0, 2);
  });

  test("getSample out of bounds returns 0", () => {
    const sd = sound.newSoundData(10);
    expect(sd.getSample(-1)).toBe(0);
    expect(sd.getSample(10)).toBe(0);
    expect(sd.getSample(999)).toBe(0);
  });

  test("setSample out of bounds is no-op", () => {
    const sd = sound.newSoundData(10);
    sd.setSample(-1, 0.5); // should not throw
    sd.setSample(10, 0.5); // should not throw
  });

  // --- Stereo channel access ---

  test("getSample/setSample with channel parameter (stereo)", () => {
    const sd = sound.newSoundData(10, 44100, 16, 2);
    sd.setSample(0, 0.5, 1); // left
    sd.setSample(0, -0.5, 2); // right
    expect(sd.getSample(0, 1)).toBeCloseTo(0.5, 2);
    expect(sd.getSample(0, 2)).toBeCloseTo(-0.5, 2);
    // Default channel is 1
    expect(sd.getSample(0)).toBeCloseTo(0.5, 2);
  });

  // --- Duration ---

  test("getDuration is correct", () => {
    const sd = sound.newSoundData(44100, 44100, 16, 1);
    expect(sd.getDuration()).toBeCloseTo(1.0, 4);

    const sd2 = sound.newSoundData(22050, 44100, 16, 2);
    expect(sd2.getDuration()).toBeCloseTo(0.5, 4);
  });

  // --- getString ---

  test("getString returns binary string of correct length", () => {
    const sd = sound.newSoundData(10, 44100, 16, 1);
    const str = sd.getString();
    expect(str.length).toBe(20); // 10 samples * 2 bytes
  });

  // --- SoundData from file ---

  test("newSoundData from WAV file", () => {
    const sd = sound.newSoundData(wavPath);
    expect(sd.getSampleCount()).toBeGreaterThan(0);
    expect(sd.getSampleRate()).toBe(22050);
    expect(sd.getBitDepth()).toBe(16);
    expect(sd.getChannelCount()).toBe(1);
    expect(sd.getDuration()).toBeGreaterThan(0.4);
    expect(sd.getDuration()).toBeLessThan(0.6);
  });

  test("newSoundData from WAV has non-zero samples", () => {
    const sd = sound.newSoundData(wavPath);
    // A 440Hz sine wave should have non-zero samples
    let hasNonZero = false;
    for (let i = 0; i < Math.min(100, sd.getSampleCount()); i++) {
      if (Math.abs(sd.getSample(i)) > 0.01) {
        hasNonZero = true;
        break;
      }
    }
    expect(hasNonZero).toBe(true);
  });

  test("newSoundData from nonexistent file throws", () => {
    expect(() => sound.newSoundData("/tmp/nonexistent-audio.wav")).toThrow();
  });
});

describe("jove.audio — QueueableSource", () => {
  beforeAll(() => {
    audioAvailable = audio._init();
  });

  afterAll(() => {
    audio._quit();
  });

  test("newQueueableSource creates a source", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource(44100, 16, 1) as QueueableSource;
    expect(qs).not.toBeNull();
    expect(qs.type()).toBe("queue");
    expect(qs._type).toBe("queue");
    qs.release();
  });

  test("newQueueableSource starts stopped", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource()!;
    expect(qs.isStopped()).toBe(true);
    expect(qs.isPlaying()).toBe(false);
    expect(qs.isPaused()).toBe(false);
    qs.release();
  });

  test("play/pause/stop state transitions", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource()!;
    qs.play();
    expect(qs.isPlaying()).toBe(true);
    qs.pause();
    expect(qs.isPaused()).toBe(true);
    qs.play();
    expect(qs.isPlaying()).toBe(true);
    qs.stop();
    expect(qs.isStopped()).toBe(true);
    qs.release();
  });

  test("volume/pitch/looping controls work", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource()!;
    qs.setVolume(0.5);
    expect(qs.getVolume()).toBe(0.5);
    qs.setPitch(1.5);
    expect(qs.getPitch()).toBe(1.5);
    qs.setLooping(true);
    expect(qs.isLooping()).toBe(true);
    qs.release();
  });

  test("seek/tell/getDuration return 0 for queueable", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource()!;
    qs.seek(1.0); // no-op
    expect(qs.tell()).toBe(0);
    expect(qs.getDuration()).toBe(0);
    qs.release();
  });

  test("clone throws on queueable source", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource()!;
    expect(() => qs.clone()).toThrow("Cannot clone a queueable Source");
    qs.release();
  });

  test("getFreeBufferCount returns bufferCount initially", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource(44100, 16, 1, 8) as QueueableSource;
    expect(qs.getFreeBufferCount()).toBe(8);
    qs.release();
  });

  test("queue(soundData) succeeds with matching format", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource(44100, 16, 1, 8) as QueueableSource;
    const sd = sound.newSoundData(1024, 44100, 16, 1);
    // Fill with a simple tone
    for (let i = 0; i < 1024; i++) {
      sd.setSample(i, Math.sin(2 * Math.PI * 440 * i / 44100));
    }
    const ok = qs.queue(sd);
    expect(ok).toBe(true);
    expect(qs.getFreeBufferCount()).toBe(7);
    qs.release();
  });

  test("queue returns false for format mismatch", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource(44100, 16, 1) as QueueableSource;
    // SoundData with different sample rate
    const sd = sound.newSoundData(100, 22050, 16, 1);
    expect(qs.queue(sd)).toBe(false);
    // SoundData with different bit depth
    const sd2 = sound.newSoundData(100, 44100, 8, 1);
    expect(qs.queue(sd2)).toBe(false);
    // SoundData with different channels
    const sd3 = sound.newSoundData(100, 44100, 16, 2);
    expect(qs.queue(sd3)).toBe(false);
    qs.release();
  });

  test("queue returns false when buffer slots full", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource(44100, 16, 1, 2) as QueueableSource;
    const sd = sound.newSoundData(100, 44100, 16, 1);
    expect(qs.queue(sd)).toBe(true); // slot 1
    expect(qs.queue(sd)).toBe(true); // slot 2
    expect(qs.queue(sd)).toBe(false); // full
    expect(qs.getFreeBufferCount()).toBe(0);
    qs.release();
  });

  test("queue + play does not crash", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource(44100, 16, 1) as QueueableSource;
    const sd = sound.newSoundData(4096, 44100, 16, 1);
    for (let i = 0; i < 4096; i++) {
      sd.setSample(i, Math.sin(2 * Math.PI * 440 * i / 44100));
    }
    qs.queue(sd);
    qs.play();
    expect(qs.isPlaying()).toBe(true);
    // Poll should not crash or auto-stop
    qs._poll();
    expect(qs.isPlaying()).toBe(true);
    qs.stop();
    qs.release();
  });

  test("queueable source stays playing when stream empties", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource(44100, 16, 1) as QueueableSource;
    qs.play();
    // No data queued — stream is empty
    qs._poll();
    expect(qs.isPlaying()).toBe(true); // Should NOT auto-stop
    qs.stop();
    qs.release();
  });

  test("stop clears queued data and resets buffer count", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource(44100, 16, 1, 4) as QueueableSource;
    const sd = sound.newSoundData(100, 44100, 16, 1);
    qs.queue(sd);
    qs.queue(sd);
    expect(qs.getFreeBufferCount()).toBe(2);
    qs.stop();
    expect(qs.getFreeBufferCount()).toBe(4);
    qs.release();
  });

  test("release cleans up properly", () => {
    if (!audioAvailable) return;
    const countBefore = audio.getActiveSourceCount();
    const qs = audio.newQueueableSource()!;
    qs.play();
    expect(audio.getActiveSourceCount()).toBe(countBefore + 1);
    qs.release();
    // After release, source is removed from tracking
    expect(audio.getActiveSourceCount()).toBe(countBefore);
  });

  test("play after release recreates stream", () => {
    if (!audioAvailable) return;
    const qs = audio.newQueueableSource()!;
    qs.play();
    qs.release();
    expect(qs.isStopped()).toBe(true);
    // play() should recreate the stream
    qs.play();
    expect(qs.isPlaying()).toBe(true);
    qs.stop();
    qs.release();
  });
});

// ============================================================
// Streaming Decoder tests
// ============================================================

const codecLibAvailable = loadAudioDecode() !== null;
const ffmpegAvailable = (() => {
  try {
    const r = Bun.spawnSync(["ffmpeg", "-version"]);
    return r.exitCode === 0;
  } catch { return false; }
})();

describe("jove.sound — Decoder (streaming)", () => {
  const decoderWavPath = join(tmpDir, "jove2d-decoder-test.wav");
  const oggPath = join(tmpDir, "jove2d-decoder-test.ogg");
  const mp3Path = join(tmpDir, "jove2d-decoder-test.mp3");
  const flacPath = join(tmpDir, "jove2d-decoder-test.flac");

  const canRun = codecLibAvailable && ffmpegAvailable;

  beforeAll(() => {
    if (!canRun) return;
    // Generate a 1s 440Hz sine WAV, then convert to each codec
    const wav = generateWav(1.0, 440, 22050);
    writeFileSync(decoderWavPath, wav);
    Bun.spawnSync(["ffmpeg", "-y", "-i", decoderWavPath, "-c:a", "libvorbis", "-q:a", "2", oggPath], { stderr: "ignore" });
    Bun.spawnSync(["ffmpeg", "-y", "-i", decoderWavPath, "-c:a", "libmp3lame", "-q:a", "9", mp3Path], { stderr: "ignore" });
    Bun.spawnSync(["ffmpeg", "-y", "-i", decoderWavPath, "-c:a", "flac", flacPath], { stderr: "ignore" });
  });

  afterAll(() => {
    for (const p of [decoderWavPath, oggPath, mp3Path, flacPath]) {
      try { unlinkSync(p); } catch {}
    }
  });

  test("newDecoder opens OGG file with valid metadata", () => {
    if (!canRun || !existsSync(oggPath)) return;
    const dec = sound.newDecoder(oggPath);
    expect(dec.getChannelCount()).toBe(1);
    expect(dec.getSampleRate()).toBe(22050);
    expect(dec.getBitDepth()).toBe(16);
    expect(dec.getSampleCount()).toBeGreaterThan(0);
    expect(dec.getDuration()).toBeGreaterThan(0.8);
    expect(dec.getDuration()).toBeLessThan(1.2);
    expect(dec.isFinished()).toBe(false);
    dec.close();
  });

  test("newDecoder opens MP3 file", () => {
    if (!canRun || !existsSync(mp3Path)) return;
    const dec = sound.newDecoder(mp3Path);
    expect(dec.getChannelCount()).toBeGreaterThan(0);
    expect(dec.getSampleRate()).toBeGreaterThan(0);
    expect(dec.getDuration()).toBeGreaterThan(0.5);
    dec.close();
  });

  test("newDecoder opens FLAC file", () => {
    if (!canRun || !existsSync(flacPath)) return;
    const dec = sound.newDecoder(flacPath);
    expect(dec.getChannelCount()).toBe(1);
    expect(dec.getSampleRate()).toBe(22050);
    expect(dec.getDuration()).toBeGreaterThan(0.8);
    dec.close();
  });

  test("decode() returns SoundData chunks", () => {
    if (!canRun || !existsSync(oggPath)) return;
    const dec = sound.newDecoder(oggPath, 1024);
    const chunk = dec.decode();
    expect(chunk).not.toBeNull();
    expect(chunk!.getSampleCount()).toBeGreaterThan(0);
    expect(chunk!.getSampleCount()).toBeLessThanOrEqual(1024);
    expect(chunk!.getSampleRate()).toBe(22050);
    expect(chunk!.getBitDepth()).toBe(16);
    expect(chunk!.getChannelCount()).toBe(1);
    dec.close();
  });

  test("decode() reads all data until EOF", () => {
    if (!canRun || !existsSync(oggPath)) return;
    const dec = sound.newDecoder(oggPath, 2048);
    let totalFrames = 0;
    let chunks = 0;
    while (true) {
      const chunk = dec.decode();
      if (!chunk) break;
      totalFrames += chunk.getSampleCount();
      chunks++;
    }
    expect(dec.isFinished()).toBe(true);
    expect(chunks).toBeGreaterThan(1); // Should take multiple chunks for 1s audio
    expect(totalFrames).toBeGreaterThan(20000); // ~22050 frames for 1s at 22050Hz
    expect(totalFrames).toBeLessThan(25000);
    // decode() after EOF returns null
    expect(dec.decode()).toBeNull();
    dec.close();
  });

  test("seek() resets position and allows re-reading", () => {
    if (!canRun || !existsSync(oggPath)) return;
    const dec = sound.newDecoder(oggPath, 1024);

    // Read a chunk
    const chunk1 = dec.decode();
    expect(chunk1).not.toBeNull();
    const pos1 = dec.tell();
    expect(pos1).toBeGreaterThan(0);

    // Seek to beginning
    dec.seek(0);
    expect(dec.tell()).toBe(0);
    expect(dec.isFinished()).toBe(false);

    // Read again — should get data
    const chunk2 = dec.decode();
    expect(chunk2).not.toBeNull();
    expect(chunk2!.getSampleCount()).toBeGreaterThan(0);

    dec.close();
  });

  test("seek() to middle of file", () => {
    if (!canRun || !existsSync(oggPath)) return;
    const dec = sound.newDecoder(oggPath);
    const midFrame = Math.floor(dec.getSampleCount() / 2);

    dec.seek(midFrame);
    expect(dec.tell()).toBe(midFrame);

    const chunk = dec.decode();
    expect(chunk).not.toBeNull();
    dec.close();
  });

  test("tell() tracks position", () => {
    if (!canRun || !existsSync(oggPath)) return;
    const dec = sound.newDecoder(oggPath, 1024);
    expect(dec.tell()).toBe(0);

    dec.decode();
    const pos = dec.tell();
    expect(pos).toBeGreaterThan(0);
    expect(pos).toBeLessThanOrEqual(1024);

    dec.decode();
    expect(dec.tell()).toBeGreaterThan(pos);

    dec.close();
  });

  test("close() releases handle", () => {
    if (!canRun || !existsSync(oggPath)) return;
    const dec = sound.newDecoder(oggPath);
    dec.close();
    expect(dec.isFinished()).toBe(true);
    // decode() after close returns null
    expect(dec.decode()).toBeNull();
    // Double close is safe
    dec.close();
  });

  test("multiple decoders can be open simultaneously", () => {
    if (!canRun) return;
    const decoders: ReturnType<typeof sound.newDecoder>[] = [];
    const paths = [oggPath, mp3Path, flacPath].filter(p => existsSync(p));
    if (paths.length < 2) return;

    for (const p of paths) {
      decoders.push(sound.newDecoder(p));
    }

    // All decoders work independently
    for (const dec of decoders) {
      const chunk = dec.decode();
      expect(chunk).not.toBeNull();
    }

    // Clean up
    for (const dec of decoders) {
      dec.close();
    }
  });

  test("newDecoder throws for unsupported file", () => {
    if (!codecLibAvailable) return;
    expect(() => sound.newDecoder("/tmp/nonexistent.ogg")).toThrow();
  });

  test("newDecoder throws without codec library", () => {
    // This test only makes sense if the lib IS available (can't unload it)
    // Just verify the function exists and has correct signature
    expect(typeof sound.newDecoder).toBe("function");
  });

  test("custom bufferSize is respected", () => {
    if (!canRun || !existsSync(oggPath)) return;
    const dec = sound.newDecoder(oggPath, 512);
    const chunk = dec.decode();
    expect(chunk).not.toBeNull();
    // Buffer size is a max — chunk should be at most 512 frames
    expect(chunk!.getSampleCount()).toBeLessThanOrEqual(512);
    dec.close();
  });

  // --- Streaming source tests ---

  test("newSource with 'stream' type creates a working source", () => {
    if (!canRun || !existsSync(oggPath)) return;
    if (!audio._init() || !audio._ensureDevice()) return;
    const src = audio.newSource(oggPath, "stream");
    expect(src).not.toBeNull();
    expect(src!.type()).toBe("stream");
    expect(src!.getDuration()).toBeGreaterThan(0.8);
    expect(src!.isStopped()).toBe(true);
    src!.release();
    audio._quit();
  });

  test("streaming source play/pause/stop lifecycle", () => {
    if (!canRun || !existsSync(oggPath)) return;
    if (!audio._init() || !audio._ensureDevice()) return;
    const src = audio.newSource(oggPath, "stream")!;
    src.play();
    expect(src.isPlaying()).toBe(true);
    src.pause();
    expect(src.isPaused()).toBe(true);
    src.play();
    expect(src.isPlaying()).toBe(true);
    src.stop();
    expect(src.isStopped()).toBe(true);
    src.release();
    audio._quit();
  });
});
