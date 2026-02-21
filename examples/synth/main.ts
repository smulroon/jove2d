// jove2d synth example — demonstrates SoundData + newQueueableSource
// Procedural audio synthesis with keyboard piano, waveform display, multiple waveforms

import jove from "../../src/index.ts";
import type { QueueableSource, SoundData } from "../../src/index.ts";

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 4096; // samples per buffer
const BUFFER_COUNT = 8;

// Waveform types
const WAVEFORMS = ["sine", "square", "sawtooth", "triangle"] as const;
type Waveform = typeof WAVEFORMS[number];

let queueSource: QueueableSource | null = null;
let soundData: SoundData | null = null;
let currentWaveform: Waveform = "sine";
let currentFreq = 0; // 0 = no note playing
let currentNote = "";
let octave = 4;
let phase = 0;
let volume = 0.5;
let playing = false;

// Note frequencies (equal temperament, A4 = 440 Hz)
function noteFreq(note: number, oct: number): number {
  return 440 * Math.pow(2, (oct - 4) + (note - 9) / 12);
}

// Piano key mapping: bottom row = white keys, middle row = black keys
const KEY_MAP: Record<string, { note: number; label: string }> = {
  z: { note: 0, label: "C" },
  s: { note: 1, label: "C#" },
  x: { note: 2, label: "D" },
  d: { note: 3, label: "D#" },
  c: { note: 4, label: "E" },
  v: { note: 5, label: "F" },
  g: { note: 6, label: "F#" },
  b: { note: 7, label: "G" },
  h: { note: 8, label: "G#" },
  n: { note: 9, label: "A" },
  j: { note: 10, label: "A#" },
  m: { note: 11, label: "B" },
  ",": { note: 12, label: "C" }, // next octave
};

// Fill the SoundData with waveform samples
function fillBuffer(waveform: Waveform, freq: number): void {
  if (!soundData) return;
  const inc = freq / SAMPLE_RATE;

  for (let i = 0; i < BUFFER_SIZE; i++) {
    const p = phase + i * inc;
    const t = p % 1;
    let val = 0;

    switch (waveform) {
      case "sine":
        val = Math.sin(2 * Math.PI * p);
        break;
      case "square":
        val = t < 0.5 ? 0.8 : -0.8;
        break;
      case "sawtooth":
        val = 2 * t - 1;
        break;
      case "triangle":
        val = 4 * Math.abs(t - 0.5) - 1;
        break;
    }

    soundData.setSample(i, val * volume);
  }

  phase += BUFFER_SIZE * inc;
  if (phase > 1e6) phase -= Math.floor(phase);
}

// Draw waveform oscilloscope
function drawWaveform(x: number, y: number, w: number, h: number) {
  jove.graphics.setColor(15, 20, 30);
  jove.graphics.rectangle("fill", x, y, w, h);

  jove.graphics.setColor(60, 80, 120);
  jove.graphics.rectangle("line", x, y, w, h);

  // Center line
  jove.graphics.setColor(40, 50, 70);
  jove.graphics.line(x, y + h / 2, x + w, y + h / 2);

  // Grid lines
  jove.graphics.setColor(30, 40, 55);
  jove.graphics.line(x, y + h / 4, x + w, y + h / 4);
  jove.graphics.line(x, y + 3 * h / 4, x + w, y + 3 * h / 4);
  jove.graphics.line(x + w / 4, y, x + w / 4, y + h);
  jove.graphics.line(x + w / 2, y, x + w / 2, y + h);
  jove.graphics.line(x + 3 * w / 4, y, x + 3 * w / 4, y + h);

  if (!soundData || currentFreq === 0) {
    jove.graphics.setColor(80, 80, 80);
    jove.graphics.print("No signal", x + w / 2 - 30, y + h / 2 - 5);
    return;
  }

  // Draw waveform — show ~4 cycles for visual clarity
  const samplesPerCycle = SAMPLE_RATE / currentFreq;
  const numDisplay = Math.min(Math.floor(samplesPerCycle * 4), BUFFER_SIZE);

  jove.graphics.setColor(80, 255, 160);
  let prevPx = x;
  let prevPy = y + h / 2;

  for (let px = 0; px < w; px++) {
    const sampleIdx = Math.floor((px / w) * numDisplay);
    const val = soundData.getSample(sampleIdx);
    const py = y + h / 2 - val * (h / 2 - 10);

    if (px > 0) {
      jove.graphics.line(prevPx, prevPy, x + px, py);
    }
    prevPx = x + px;
    prevPy = py;
  }
}

// Draw a simple piano keyboard
function drawKeyboard(x: number, y: number, w: number, h: number) {
  const whiteKeys = ["z", "x", "c", "v", "b", "n", "m", ","];
  const blackKeys: (string | null)[] = ["s", "d", null, "g", "h", "j", null];
  const whiteW = w / whiteKeys.length;
  const blackW = whiteW * 0.6;
  const blackH = h * 0.6;

  // White keys
  for (let i = 0; i < whiteKeys.length; i++) {
    const kx = x + i * whiteW;
    const key = whiteKeys[i];
    const isActive = jove.keyboard.isDown(key);

    if (isActive) {
      jove.graphics.setColor(100, 200, 255);
    } else {
      jove.graphics.setColor(240, 240, 240);
    }
    jove.graphics.rectangle("fill", kx + 1, y, whiteW - 2, h);
    jove.graphics.setColor(60, 60, 60);
    jove.graphics.rectangle("line", kx + 1, y, whiteW - 2, h);

    jove.graphics.setColor(100, 100, 100);
    const info = KEY_MAP[key];
    if (info) {
      jove.graphics.print(info.label, kx + whiteW / 2 - 4, y + h - 18);
    }
  }

  // Black keys
  for (let i = 0; i < blackKeys.length; i++) {
    const key = blackKeys[i];
    if (!key) continue;
    const kx = x + (i + 0.7) * whiteW;
    const isActive = jove.keyboard.isDown(key);

    if (isActive) {
      jove.graphics.setColor(80, 160, 220);
    } else {
      jove.graphics.setColor(30, 30, 35);
    }
    jove.graphics.rectangle("fill", kx, y, blackW, blackH);
    jove.graphics.setColor(20, 20, 25);
    jove.graphics.rectangle("line", kx, y, blackW, blackH);
  }
}

await jove.run({
  load() {
    jove.window.setTitle("Synth Example — Procedural Audio");
    jove.graphics.setBackgroundColor(20, 22, 30);

    queueSource = jove.audio.newQueueableSource(SAMPLE_RATE, 16, 1, BUFFER_COUNT) as QueueableSource;
    soundData = jove.sound.newSoundData(BUFFER_SIZE, SAMPLE_RATE, 16, 1);
  },

  update(dt) {
    if (!queueSource || !soundData) return;

    // Fill all available buffer slots with audio data
    if (currentFreq > 0) {
      let queued = false;
      while (queueSource.getFreeBufferCount() > 0) {
        fillBuffer(currentWaveform, currentFreq);
        if (!queueSource.queue(soundData)) break;
        queued = true;
      }
      // Start playback after first queue
      if (queued && !playing) {
        queueSource.play();
        playing = true;
      }
    }
  },

  draw() {
    const margin = 20;
    const winW = jove.graphics.getWidth();
    let y = margin;

    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`=== Procedural Audio Synth ===   FPS: ${jove.timer.getFPS()}`, margin, y);
    y += 28;

    // Waveform display
    drawWaveform(margin, y, winW - margin * 2, 180);
    y += 195;

    // Info panel
    jove.graphics.setColor(255, 220, 100);
    jove.graphics.print(`Waveform: ${currentWaveform}`, margin, y);
    y += 20;

    if (currentFreq > 0) {
      jove.graphics.setColor(100, 255, 160);
      jove.graphics.print(`Note: ${currentNote}${octave} (${currentFreq.toFixed(1)} Hz)`, margin, y);
    } else {
      jove.graphics.setColor(120, 120, 120);
      jove.graphics.print("Note: --", margin, y);
    }
    y += 20;

    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print(`Octave: ${octave}`, margin, y);
    jove.graphics.print(`Volume: ${(volume * 100).toFixed(0)}%`, margin + 120, y);
    y += 20;

    if (queueSource && soundData) {
      jove.graphics.setColor(150, 180, 255);
      jove.graphics.print(`Free buffers: ${queueSource.getFreeBufferCount()}/${BUFFER_COUNT}`, margin, y);
      jove.graphics.print(`Source: ${queueSource.isPlaying() ? "playing" : queueSource.isPaused() ? "paused" : "stopped"}`, margin + 200, y);
    }
    y += 20;

    if (soundData) {
      jove.graphics.setColor(140, 140, 140);
      jove.graphics.print(
        `SoundData: ${soundData.getSampleCount()} samples, ${soundData.getSampleRate()} Hz, ${soundData.getBitDepth()}-bit, ${soundData.getChannelCount()}ch, ${soundData.getDuration().toFixed(3)}s`,
        margin, y,
      );
    }
    y += 30;

    // Piano keyboard
    drawKeyboard(margin, y, winW - margin * 2, 100);
    y += 115;

    // Controls
    jove.graphics.setColor(150, 200, 255);
    jove.graphics.print("Controls:", margin, y);
    y += 20;
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("Z-M        Piano keys (C to C)", margin, y); y += 16;
    jove.graphics.print("1-4        Waveform (sine/square/saw/tri)", margin, y); y += 16;
    jove.graphics.print("UP/DOWN    Octave +/-", margin, y); y += 16;
    jove.graphics.print("LEFT/RIGHT Volume +/-", margin, y); y += 16;
    jove.graphics.print("ESC        Quit", margin, y);
  },

  keypressed(key) {
    if (key === "escape") {
      jove.window.close();
      return;
    }

    if (key === "1") { currentWaveform = "sine"; return; }
    if (key === "2") { currentWaveform = "square"; return; }
    if (key === "3") { currentWaveform = "sawtooth"; return; }
    if (key === "4") { currentWaveform = "triangle"; return; }

    if (key === "up") { octave = Math.min(7, octave + 1); return; }
    if (key === "down") { octave = Math.max(1, octave - 1); return; }

    if (key === "right") { volume = Math.min(1.0, volume + 0.1); return; }
    if (key === "left") { volume = Math.max(0.0, volume - 0.1); return; }

    // Piano keys — only reset phase when note changes (key repeat would cause clicks)
    const noteInfo = KEY_MAP[key];
    if (noteInfo) {
      const oct = noteInfo.note >= 12 ? octave + 1 : octave;
      const note = noteInfo.note % 12;
      const newFreq = noteFreq(note, oct);
      if (newFreq !== currentFreq) {
        currentFreq = newFreq;
        currentNote = noteInfo.label;
        phase = 0;
      }
    }
  },

  keyreleased(key) {
    if (KEY_MAP[key]) {
      currentFreq = 0;
      currentNote = "";
    }
  },
});
