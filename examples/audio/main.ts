// jove2d audio example — demonstrates play/pause/stop, pitch, volume, looping, seek
// Also demonstrates OGG/MP3/FLAC codec support (F1-F4 to switch formats)
// Generates a sine wave WAV at load time, converts to other formats via ffmpeg

import jove from "../../src/index.ts";
import type { Source } from "../../src/index.ts";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Generate a WAV file programmatically
function generateWav(durationSec: number, freq: number): Uint8Array {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, fileSize - 8, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Mix two frequencies for a richer tone
    const sample = 0.6 * Math.sin(2 * Math.PI * freq * t)
                 + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t)
                 + 0.1 * Math.sin(2 * Math.PI * freq * 3 * t);
    const s16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, s16, true);
  }
  return new Uint8Array(buf);
}

// Format definitions
interface FormatInfo {
  ext: string;
  label: string;
  path: string;
  available: boolean;
}

let source: Source | null = null;
let statusMsg = "Press SPACE to play";
let currentFormat = 0;
const formats: FormatInfo[] = [];
const tmpBase = join(tmpdir(), "jove2d-example-audio");

// Try converting WAV to another format via ffmpeg
function tryConvert(wavPath: string, ext: string, ffmpegArgs: string[]): boolean {
  const outPath = `${tmpBase}.${ext}`;
  const result = Bun.spawnSync(
    ["ffmpeg", "-y", "-i", wavPath, ...ffmpegArgs, outPath],
    { stderr: "ignore", stdout: "ignore" },
  );
  return result.exitCode === 0 && existsSync(outPath);
}

function switchFormat(index: number) {
  if (index < 0 || index >= formats.length || !formats[index].available) return;
  if (index === currentFormat && source) return;

  // Stop and release current source
  if (source) {
    source.stop();
    source.release();
  }

  currentFormat = index;
  const fmt = formats[currentFormat];
  source = jove.audio.newSource(fmt.path, "static");
  if (source) {
    statusMsg = `Loaded ${fmt.label} — press SPACE to play`;
  } else {
    statusMsg = `Failed to load ${fmt.label}!`;
  }
}

await jove.run({
  load() {
    jove.window.setTitle("Audio Example");
    jove.graphics.setBackgroundColor(25, 25, 35);

    // Generate WAV and write to temp file
    const wavPath = `${tmpBase}.wav`;
    const wav = generateWav(3.0, 261.63); // 3 seconds, middle C
    writeFileSync(wavPath, wav);

    // WAV is always available
    formats.push({ ext: "wav", label: "WAV", path: wavPath, available: true });

    // Try creating OGG/MP3/FLAC via ffmpeg
    const oggOk = tryConvert(wavPath, "ogg", ["-c:a", "libvorbis", "-q:a", "2"]);
    formats.push({ ext: "ogg", label: "OGG Vorbis", path: `${tmpBase}.ogg`, available: oggOk });

    const mp3Ok = tryConvert(wavPath, "mp3", ["-c:a", "libmp3lame", "-q:a", "9"]);
    formats.push({ ext: "mp3", label: "MP3", path: `${tmpBase}.mp3`, available: mp3Ok });

    const flacOk = tryConvert(wavPath, "flac", ["-c:a", "flac"]);
    formats.push({ ext: "flac", label: "FLAC", path: `${tmpBase}.flac`, available: flacOk });

    // Load initial WAV source
    source = jove.audio.newSource(wavPath, "static");
    if (!source) {
      statusMsg = "Failed to create audio source!";
    }
  },

  update(dt) {
    if (!source) return;

    if (source.isPlaying()) {
      statusMsg = "Playing";
    } else if (source.isPaused()) {
      statusMsg = "Paused";
    } else {
      statusMsg = "Stopped";
    }
  },

  draw() {
    const y = 20;
    const x = 20;

    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("=== Audio Example ===", x, y);

    // Format info
    jove.graphics.setColor(255, 220, 100);
    const fmt = formats[currentFormat];
    jove.graphics.print(`Format: ${fmt ? fmt.label : "none"}`, x, y + 22);

    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print(`Status: ${statusMsg}`, x, y + 44);

    if (source) {
      jove.graphics.print(`Duration: ${source.getDuration().toFixed(2)}s`, x, y + 64);
      jove.graphics.print(`Position: ${source.tell().toFixed(2)}s`, x, y + 84);
      jove.graphics.print(`Volume: ${(source.getVolume() * 100).toFixed(0)}%`, x, y + 104);
      jove.graphics.print(`Pitch: ${source.getPitch().toFixed(2)}x`, x, y + 124);
      jove.graphics.print(`Looping: ${source.isLooping() ? "ON" : "OFF"}`, x, y + 144);
      jove.graphics.print(`Active sources: ${jove.audio.getActiveSourceCount()}`, x, y + 164);
      jove.graphics.print(`Master volume: ${(jove.audio.getVolume() * 100).toFixed(0)}%`, x, y + 184);
    }

    // Format selection
    jove.graphics.setColor(150, 200, 255);
    jove.graphics.print("Format (F1-F4):", x, y + 216);
    for (let i = 0; i < formats.length; i++) {
      const f = formats[i];
      if (i === currentFormat) {
        jove.graphics.setColor(100, 255, 100);
      } else if (f.available) {
        jove.graphics.setColor(180, 180, 180);
      } else {
        jove.graphics.setColor(100, 100, 100);
      }
      const marker = i === currentFormat ? ">" : " ";
      const avail = f.available ? "" : " (needs ffmpeg)";
      jove.graphics.print(`${marker} F${i + 1} ${f.label}${avail}`, x + 10, y + 236 + i * 18);
    }

    // Controls
    jove.graphics.setColor(150, 200, 255);
    jove.graphics.print("Controls:", x, y + 316);
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("SPACE  — Play / Restart", x, y + 336);
    jove.graphics.print("P      — Pause / Resume", x, y + 356);
    jove.graphics.print("S      — Stop", x, y + 376);
    jove.graphics.print("L      — Toggle looping", x, y + 396);
    jove.graphics.print("UP/DN  — Pitch +/- 0.1", x, y + 416);
    jove.graphics.print("LT/RT  — Volume +/- 10%", x, y + 436);
    jove.graphics.print("[/]    — Master volume +/- 10%", x, y + 456);
    jove.graphics.print("1-9    — Seek to 0-100%", x, y + 476);
    jove.graphics.print("C      — Clone + play", x, y + 496);
    jove.graphics.print("ESC    — Quit", x, y + 516);
  },

  keypressed(key) {
    if (key === "escape") {
      jove.window.close();
      return;
    }

    // Format switching
    if (key === "f1") { switchFormat(0); return; }
    if (key === "f2") { switchFormat(1); return; }
    if (key === "f3") { switchFormat(2); return; }
    if (key === "f4") { switchFormat(3); return; }

    if (!source) return;

    if (key === "space") {
      source.play();
    } else if (key === "p") {
      if (source.isPlaying()) {
        source.pause();
      } else if (source.isPaused()) {
        source.play();
      }
    } else if (key === "s") {
      source.stop();
    } else if (key === "l") {
      source.setLooping(!source.isLooping());
    } else if (key === "up") {
      source.setPitch(Math.min(3.0, source.getPitch() + 0.1));
    } else if (key === "down") {
      source.setPitch(Math.max(0.1, source.getPitch() - 0.1));
    } else if (key === "right") {
      source.setVolume(Math.min(1.0, source.getVolume() + 0.1));
    } else if (key === "left") {
      source.setVolume(Math.max(0.0, source.getVolume() - 0.1));
    } else if (key === "]") {
      jove.audio.setVolume(Math.min(1.0, jove.audio.getVolume() + 0.1));
    } else if (key === "[") {
      jove.audio.setVolume(Math.max(0.0, jove.audio.getVolume() - 0.1));
    } else if (key === "c") {
      // Clone and play
      const cloned = source.clone();
      cloned.setPitch(1.5); // Higher pitch to hear the difference
      cloned.play();
    } else if (key >= "1" && key <= "9") {
      // Seek to percentage of duration
      const pct = parseInt(key) / 10;
      source.seek(pct * source.getDuration());
    }
  },

  quit() {
    // Cleanup temp files
    for (const f of formats) {
      try { unlinkSync(f.path); } catch {}
    }
    return false;
  },
});
