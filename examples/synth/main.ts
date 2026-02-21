// jove2d synth example — demonstrates SoundData + newQueueableSource
// Polyphonic audio synthesis with keyboard piano, waveform display, ADSR envelope

import jove from "../../src/index.ts";
import type { QueueableSource, SoundData } from "../../src/index.ts";

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 4096;
const BUFFER_COUNT = 8;
const MAX_VOICES = 13; // one per key

// Waveform types
const WAVEFORMS = ["sine", "square", "sawtooth", "triangle"] as const;
type Waveform = typeof WAVEFORMS[number];

let queueSource: QueueableSource | null = null;
let soundData: SoundData | null = null;
let currentWaveform: Waveform = "sine";
let octave = 4;
let volume = 0.5;
let playing = false;

// ADSR envelope (times in seconds)
const ATTACK = 0.01;
const DECAY = 0.08;
const SUSTAIN = 0.7;
const RELEASE = 0.05;

const ATTACK_SAMPLES = Math.floor(SAMPLE_RATE * ATTACK);
const DECAY_SAMPLES = Math.floor(SAMPLE_RATE * DECAY);
const RELEASE_SAMPLES = Math.floor(SAMPLE_RATE * RELEASE);

// Voice pool
type EnvStage = "attack" | "decay" | "sustain" | "release" | "off";

interface Voice {
  freq: number;
  phase: number;
  envStage: EnvStage;
  envPos: number;
  envLevel: number;
  key: string; // which key triggered this voice
}

const voices: Voice[] = [];

function findVoice(key: string): Voice | undefined {
  return voices.find(v => v.key === key && v.envStage !== "off");
}

function noteOn(key: string, freq: number) {
  // If this key already has an active (non-releasing) voice, ignore (key repeat)
  let voice = findVoice(key);
  if (voice && voice.envStage !== "release") return;
  // Retrigger a releasing voice
  if (voice) {
    voice.freq = freq;
    voice.phase = 0;
    voice.envStage = "attack";
    voice.envPos = 0;
    voice.envLevel = 0;
    return;
  }
  // Reuse an "off" voice or create new
  voice = voices.find(v => v.envStage === "off");
  if (voice) {
    voice.freq = freq;
    voice.phase = 0;
    voice.envStage = "attack";
    voice.envPos = 0;
    voice.envLevel = 0;
    voice.key = key;
  } else if (voices.length < MAX_VOICES) {
    voices.push({ freq, phase: 0, envStage: "attack", envPos: 0, envLevel: 0, key });
  }
}

function noteOff(key: string) {
  const voice = findVoice(key);
  if (voice && voice.envStage !== "release" && voice.envStage !== "off") {
    voice.envStage = "release";
    voice.envPos = 0;
  }
}

// Note frequencies (equal temperament, A4 = 440 Hz)
function noteFreq(note: number, oct: number): number {
  return 440 * Math.pow(2, (oct - 4) + (note - 9) / 12);
}

// Piano key mapping
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
  ",": { note: 12, label: "C" },
};

// Generate a raw waveform sample at phase p
function waveformSample(waveform: Waveform, p: number): number {
  const t = p % 1;
  switch (waveform) {
    case "sine": return Math.sin(2 * Math.PI * p);
    case "square": return t < 0.5 ? 0.8 : -0.8;
    case "sawtooth": return 2 * t - 1;
    case "triangle": return 4 * Math.abs(t - 0.5) - 1;
  }
}

// Advance envelope by one sample, return amplitude (0-1)
function envTick(v: Voice): number {
  switch (v.envStage) {
    case "attack":
      v.envLevel = v.envPos / ATTACK_SAMPLES;
      v.envPos++;
      if (v.envPos >= ATTACK_SAMPLES) { v.envStage = "decay"; v.envPos = 0; }
      return v.envLevel;
    case "decay":
      v.envLevel = 1 - (1 - SUSTAIN) * (v.envPos / DECAY_SAMPLES);
      v.envPos++;
      if (v.envPos >= DECAY_SAMPLES) { v.envStage = "sustain"; v.envPos = 0; }
      return v.envLevel;
    case "sustain":
      return SUSTAIN;
    case "release":
      v.envLevel = SUSTAIN * (1 - v.envPos / RELEASE_SAMPLES);
      v.envPos++;
      if (v.envPos >= RELEASE_SAMPLES) { v.envStage = "off"; v.envLevel = 0; }
      return v.envLevel;
    case "off":
      return 0;
  }
}

// Count active voices
function activeVoiceCount(): number {
  let n = 0;
  for (const v of voices) if (v.envStage !== "off") n++;
  return n;
}

// Fill the SoundData by mixing all active voices
function fillBuffer(waveform: Waveform): void {
  if (!soundData) return;

  // Count active voices for normalization (prevent clipping)
  let numActive = 0;
  for (const v of voices) if (v.envStage !== "off") numActive++;
  const norm = numActive > 1 ? 1 / Math.sqrt(numActive) : 1;

  for (let i = 0; i < BUFFER_SIZE; i++) {
    let mix = 0;
    for (const v of voices) {
      if (v.envStage === "off") continue;
      const inc = v.freq / SAMPLE_RATE;
      const p = v.phase + i * inc;
      mix += waveformSample(waveform, p) * envTick(v);
    }
    soundData.setSample(i, mix * norm * volume);
  }

  // Advance phase for each voice
  for (const v of voices) {
    if (v.envStage === "off") continue;
    const inc = v.freq / SAMPLE_RATE;
    v.phase += BUFFER_SIZE * inc;
    if (v.phase > 1e6) v.phase -= Math.floor(v.phase);
  }
}

// Get the display frequency (highest active voice, for oscilloscope)
function displayFreq(): number {
  let freq = 0;
  for (const v of voices) {
    if (v.envStage !== "off" && v.envStage !== "release" && v.freq > freq) freq = v.freq;
  }
  return freq;
}

// Draw waveform oscilloscope
function drawWaveform(x: number, y: number, w: number, h: number) {
  jove.graphics.setColor(15, 20, 30);
  jove.graphics.rectangle("fill", x, y, w, h);

  jove.graphics.setColor(60, 80, 120);
  jove.graphics.rectangle("line", x, y, w, h);

  jove.graphics.setColor(40, 50, 70);
  jove.graphics.line(x, y + h / 2, x + w, y + h / 2);

  jove.graphics.setColor(30, 40, 55);
  jove.graphics.line(x, y + h / 4, x + w, y + h / 4);
  jove.graphics.line(x, y + 3 * h / 4, x + w, y + 3 * h / 4);
  jove.graphics.line(x + w / 4, y, x + w / 4, y + h);
  jove.graphics.line(x + w / 2, y, x + w / 2, y + h);
  jove.graphics.line(x + 3 * w / 4, y, x + 3 * w / 4, y + h);

  const dFreq = displayFreq();
  if (!soundData || dFreq === 0) {
    jove.graphics.setColor(80, 80, 80);
    jove.graphics.print("No signal", x + w / 2 - 30, y + h / 2 - 5);
    return;
  }

  const samplesPerCycle = SAMPLE_RATE / dFreq;
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

    if (activeVoiceCount() > 0) {
      let queued = false;
      while (queueSource.getFreeBufferCount() > 0) {
        fillBuffer(currentWaveform);
        if (!queueSource.queue(soundData)) break;
        queued = true;
      }
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

    drawWaveform(margin, y, winW - margin * 2, 180);
    y += 195;

    jove.graphics.setColor(255, 220, 100);
    jove.graphics.print(`Waveform: ${currentWaveform}`, margin, y);
    y += 20;

    const active = activeVoiceCount();
    if (active > 0) {
      jove.graphics.setColor(100, 255, 160);
      jove.graphics.print(`Voices: ${active}`, margin, y);
    } else {
      jove.graphics.setColor(120, 120, 120);
      jove.graphics.print("Voices: --", margin, y);
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

    drawKeyboard(margin, y, winW - margin * 2, 100);
    y += 115;

    jove.graphics.setColor(150, 200, 255);
    jove.graphics.print("Controls:", margin, y);
    y += 20;
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("Z-M        Piano keys (C to C) — polyphonic!", margin, y); y += 16;
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

    const noteInfo = KEY_MAP[key];
    if (noteInfo) {
      const oct = noteInfo.note >= 12 ? octave + 1 : octave;
      const note = noteInfo.note % 12;
      noteOn(key, noteFreq(note, oct));
    }
  },

  keyreleased(key) {
    if (KEY_MAP[key]) {
      noteOff(key);
    }
  },
});
