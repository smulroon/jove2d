// jove2d audio example — demonstrates play/pause/stop, pitch, volume, looping, seek
// Generates a sine wave WAV at load time (no external audio files needed)

import jove from "../../src/index.ts";
import type { Source } from "../../src/index.ts";
import { writeFileSync, unlinkSync } from "fs";
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

let source: Source | null = null;
let wavPath = "";
let statusMsg = "Press SPACE to play";

await jove.run({
  load() {
    jove.window.setTitle("Audio Example");
    jove.graphics.setBackgroundColor(25, 25, 35);

    // Generate WAV and write to temp file
    wavPath = join(tmpdir(), "jove2d-example-audio.wav");
    const wav = generateWav(3.0, 261.63); // 3 seconds, middle C
    writeFileSync(wavPath, wav);

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

    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print(`Status: ${statusMsg}`, x, y + 30);

    if (source) {
      jove.graphics.print(`Duration: ${source.getDuration().toFixed(2)}s`, x, y + 50);
      jove.graphics.print(`Position: ${source.tell().toFixed(2)}s`, x, y + 70);
      jove.graphics.print(`Volume: ${(source.getVolume() * 100).toFixed(0)}%`, x, y + 90);
      jove.graphics.print(`Pitch: ${source.getPitch().toFixed(2)}x`, x, y + 110);
      jove.graphics.print(`Looping: ${source.isLooping() ? "ON" : "OFF"}`, x, y + 130);
      jove.graphics.print(`Active sources: ${jove.audio.getActiveSourceCount()}`, x, y + 150);
      jove.graphics.print(`Master volume: ${(jove.audio.getVolume() * 100).toFixed(0)}%`, x, y + 170);
    }

    jove.graphics.setColor(150, 200, 255);
    jove.graphics.print("Controls:", x, y + 210);
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("SPACE  — Play / Restart", x, y + 230);
    jove.graphics.print("P      — Pause / Resume", x, y + 250);
    jove.graphics.print("S      — Stop", x, y + 270);
    jove.graphics.print("L      — Toggle looping", x, y + 290);
    jove.graphics.print("UP/DN  — Pitch +/- 0.1", x, y + 310);
    jove.graphics.print("LT/RT  — Volume +/- 10%", x, y + 330);
    jove.graphics.print("[/]    — Master volume +/- 10%", x, y + 350);
    jove.graphics.print("1-9    — Seek to 0-100%", x, y + 370);
    jove.graphics.print("C      — Clone + play", x, y + 390);
    jove.graphics.print("ESC    — Quit", x, y + 410);
  },

  keypressed(key) {
    if (key === "escape") {
      // Cleanup temp file
      try { unlinkSync(wavPath); } catch {}
      jove.window.close();
      return;
    }

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
    try { unlinkSync(wavPath); } catch {}
    return false;
  },
});
