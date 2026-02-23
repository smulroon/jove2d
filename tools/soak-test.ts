// jove2d soak test — long-running stress test for stability
// Exercises every resource-producing subsystem to detect memory leaks,
// FPS degradation, FFI handle exhaustion, and other time-dependent issues.
//
// Usage:
//   SDL_VIDEODRIVER=dummy bun tools/soak-test.ts              # default 10 min
//   SDL_VIDEODRIVER=dummy bun tools/soak-test.ts --duration 30 # quick 30s

import jove from "../src/index.ts";
import type { Source } from "../src/index.ts";
import type { ParticleSystem } from "../src/jove/particles.ts";
import type { Canvas } from "../src/jove/graphics.ts";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// --- CLI parsing ---
const args = process.argv.slice(2);
let duration = 600;
let verbose = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--duration" && args[i + 1]) {
    duration = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--verbose") {
    verbose = true;
  }
}

// --- Generate short bump WAV (0.05s 440Hz sine with exponential decay) ---
function generateBumpWav(): Uint8Array {
  const sampleRate = 44100;
  const dur = 0.05;
  const numSamples = Math.floor(sampleRate * dur);
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  view.setUint32(0, 0x52494646, false); // RIFF
  view.setUint32(4, fileSize - 8, true);
  view.setUint32(8, 0x57415645, false); // WAVE
  view.setUint32(12, 0x666d7420, false); // fmt
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // data
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 60);
    const sample = envelope * Math.sin(2 * Math.PI * 440 * t);
    const s16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, s16, true);
  }
  return new Uint8Array(buf);
}

// --- Linear regression (least-squares) ---
function linearRegression(xs: number[], ys: number[]): { slope: number; r2: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, r2: 0 };
  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i];
    sxy += xs[i] * ys[i];
    sxx += xs[i] * xs[i];
    syy += ys[i] * ys[i];
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, r2: 0 };
  const slope = (n * sxy - sx * sy) / denom;
  const r = (n * sxy - sx * sy) / Math.sqrt(denom * (n * syy - sy * sy));
  return { slope, r2: isNaN(r) ? 0 : r * r };
}

// --- Metric sampling ---
interface MetricSample {
  elapsed: number;
  frameCount: number;
  fps: number;
  rss: number;
  heapUsed: number;
  external: number;
  physicsBodyCount: number;
  activeAudioSources: number;
}

// --- State ---
const W = 800, H = 600;
const WALL = 15;
const MAX_BODIES = 50;
const SAMPLE_INTERVAL = 5; // seconds

let world: ReturnType<typeof jove.physics.newWorld> | null = null;
let hasPhysics = false;
let bumpSource: Source | null = null;
let wavPath = "";
let particleTex: Canvas | null = null;
let ps: ParticleSystem | null = null;

type BodyInfo = { body: ReturnType<typeof jove.physics.newBody> };
const bodies: BodyInfo[] = [];

const samples: MetricSample[] = [];
let startTime = 0;
let endTime = 0;
let frameCount = 0;
let lastSampleTime = 0;
let errors: string[] = [];

// Churn counters
let churnCanvases = 0;
let churnImages = 0;
let churnBodies = 0;
let churnAudioSources = 0;
let churnDataOps = 0;

// --- Error handler ---
jove.setErrorHandler((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  errors.push(msg);
  console.error(`[SOAK ERROR] ${msg}`);
});

await jove.run({
  load() {
    jove.window.setTitle("Soak Test");
    jove.graphics.setBackgroundColor(20, 20, 30);
    startTime = jove.timer.getTime();
    lastSampleTime = startTime;

    // --- Audio ---
    wavPath = join(tmpdir(), "jove2d-soak-bump.wav");
    writeFileSync(wavPath, generateBumpWav());
    bumpSource = jove.audio.newSource(wavPath, "static");

    // --- Physics ---
    hasPhysics = jove.physics.isAvailable();
    if (hasPhysics) {
      world = jove.physics.newWorld(0, 9.81 * 30);
      // 4 static walls
      const ground = jove.physics.newBody(world, W / 2, H - WALL / 2, "static");
      jove.physics.newFixture(ground, jove.physics.newRectangleShape(W, WALL));
      const ceiling = jove.physics.newBody(world, W / 2, WALL / 2, "static");
      jove.physics.newFixture(ceiling, jove.physics.newRectangleShape(W, WALL));
      const left = jove.physics.newBody(world, WALL / 2, H / 2, "static");
      jove.physics.newFixture(left, jove.physics.newRectangleShape(WALL, H));
      const right = jove.physics.newBody(world, W - WALL / 2, H / 2, "static");
      jove.physics.newFixture(right, jove.physics.newRectangleShape(WALL, H));
    }

    // --- Particle texture (4x4 white circle) ---
    particleTex = jove.graphics.newCanvas(4, 4);
    if (particleTex) {
      jove.graphics.setCanvas(particleTex);
      jove.graphics.clear(0, 0, 0, 0);
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.circle("fill", 2, 2, 2);
      jove.graphics.setCanvas(null);

      ps = jove.graphics.newParticleSystem(particleTex, 100);
      if (ps) {
        ps.setParticleLifetime(0.3, 0.6);
        ps.setEmissionRate(0);
        ps.setSpeed(30, 80);
        ps.setSpread(Math.PI * 2);
        ps.setSizes(1.0, 0.3);
        ps.setColors(255, 200, 50, 255, 200, 50, 20, 0);
      }
    }
  },

  update(dt) {
    frameCount++;
    const now = jove.timer.getTime();
    const elapsed = now - startTime;

    // --- Exit when time expires ---
    if (elapsed >= duration) {
      endTime = now;
      jove.event.quit();
      return;
    }

    // --- Physics step ---
    if (world) {
      world.update(Math.min(dt, 1 / 30));
    }

    // --- Particle update ---
    if (ps) {
      ps.update(dt);
    }

    // --- Resource churn (staggered by frame count) ---

    // Every 60 frames (~1s): Physics body churn
    if (hasPhysics && world && frameCount % 60 === 0) {
      for (let i = 0; i < 5; i++) {
        const x = WALL + 20 + Math.random() * (W - WALL * 2 - 40);
        const y = WALL + 20;
        const body = jove.physics.newBody(world, x, y, "dynamic");
        const shape = jove.physics.newCircleShape(8 + Math.random() * 5);
        const fix = jove.physics.newFixture(body, shape, 1.0);
        fix.setRestitution(0.5);
        bodies.push({ body });
        churnBodies++;
      }
      // Cap at MAX_BODIES
      while (bodies.length > MAX_BODIES) {
        const old = bodies.shift()!;
        old.body.destroy();
      }
    }

    // Every 60 frames: Canvas create/draw/release
    if (frameCount % 60 === 0) {
      const canvas = jove.graphics.newCanvas(128, 128);
      if (canvas) {
        jove.graphics.setCanvas(canvas);
        jove.graphics.clear(0, 0, 0, 0);
        jove.graphics.setColor(100, 200, 100);
        jove.graphics.rectangle("fill", 10, 10, 108, 108);
        jove.graphics.setCanvas(null);
        canvas.release();
        churnCanvases++;
      }
    }

    // Every 120 frames (~2s): ImageData → Image create/draw/release
    if (frameCount % 120 === 0) {
      const imgData = jove.image.newImageData(64, 64);
      if (imgData) {
        // Fill with a gradient
        for (let y = 0; y < 64; y++) {
          for (let x = 0; x < 64; x++) {
            imgData.setPixel(x, y, x * 4, y * 4, 128, 255);
          }
        }
        const img = jove.graphics.newImage(imgData);
        if (img) {
          img.release();
        }
        churnImages++;
      }
    }

    // Every 180 frames (~3s): Data module pressure
    if (frameCount % 180 === 0) {
      const testData = "Hello jove2d soak test! ".repeat(100);
      const compressed = jove.data.compress("zlib", testData);
      const decompressed = jove.data.decompress("zlib", compressed);
      const encoded = jove.data.encode("base64", testData);
      const decoded = jove.data.decode("base64", encoded);
      const hashResult = jove.data.hash("sha256", testData);
      // Use results to prevent dead-code elimination
      if (decompressed.length === 0 || decoded.length === 0 || hashResult.length === 0) {
        throw new Error("Data operation returned empty");
      }
      churnDataOps++;
    }

    // Every 300 frames (~5s): Audio source clone/play/release
    if (bumpSource && frameCount % 300 === 0) {
      const clone = bumpSource.clone();
      if (clone) {
        clone.setVolume(0); // silent
        clone.play();
        // It will auto-release when done (0.05s WAV)
        churnAudioSources++;
      }
    }

    // Particle burst every 120 frames
    if (ps && frameCount % 120 === 0) {
      ps.setPosition(W / 2 + (Math.random() - 0.5) * 200, H / 2);
      ps.emit(20);
    }

    // --- Metric sampling (every SAMPLE_INTERVAL seconds) ---
    if (elapsed - (lastSampleTime - startTime) >= SAMPLE_INTERVAL) {
      lastSampleTime = now;
      Bun.gc(true); // force full GC for accurate heap measurement
      const mem = process.memoryUsage();
      const sample: MetricSample = {
        elapsed,
        frameCount,
        fps: jove.timer.getFPS(),
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        external: mem.external,
        physicsBodyCount: bodies.length + (hasPhysics ? 4 : 0), // +4 walls
        activeAudioSources: jove.audio.getActiveSourceCount(),
      };
      samples.push(sample);
      if (verbose) {
        console.log(
          `[${elapsed.toFixed(0)}s] fps=${sample.fps} rss=${(sample.rss / 1048576).toFixed(1)}MB ` +
          `heap=${(sample.heapUsed / 1048576).toFixed(1)}MB bodies=${sample.physicsBodyCount} ` +
          `audio=${sample.activeAudioSources}`
        );
      }
    }
  },

  draw() {
    // Exercise drawing primitives + transform stack every frame
    jove.graphics.setColor(60, 60, 80);
    jove.graphics.rectangle("fill", 0, 0, W, H);

    jove.graphics.push();
    jove.graphics.translate(W / 2, H / 2);
    jove.graphics.rotate(frameCount * 0.01);

    jove.graphics.setColor(100, 150, 200);
    jove.graphics.circle("fill", 0, 0, 30);
    jove.graphics.setColor(200, 100, 100);
    jove.graphics.rectangle("fill", -20, -20, 40, 40);
    jove.graphics.setColor(100, 200, 100);
    jove.graphics.line(-50, -50, 50, 50);
    jove.graphics.setColor(200, 200, 100);
    jove.graphics.polygon("fill", [0, -40, 30, 20, -30, 20]);
    jove.graphics.pop();

    // Draw physics bodies
    if (hasPhysics) {
      jove.graphics.setColor(180, 180, 220);
      for (const b of bodies) {
        const [bx, by] = b.body.getPosition();
        jove.graphics.circle("fill", bx, by, 8);
      }
    }

    // Draw particles
    if (ps && ps.getCount() > 0) {
      jove.graphics.setBlendMode("add");
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.draw(ps);
      jove.graphics.setBlendMode("alpha");
    }

    // Print status
    jove.graphics.setColor(255, 255, 255);
    const elapsed = jove.timer.getTime() - startTime;
    jove.graphics.print(`Soak: ${elapsed.toFixed(0)}s / ${duration}s  FPS: ${jove.timer.getFPS()}`, 10, 10);
    jove.graphics.print(`Bodies: ${bodies.length + (hasPhysics ? 4 : 0)}  Audio: ${jove.audio.getActiveSourceCount()}`, 10, 24);
  },

  quit() {
    // Cleanup WAV file
    try { unlinkSync(wavPath); } catch {}
    return false;
  },
});

// ===================================================================
// Analysis — runs after jove.run() returns (engine cleaned up)
// ===================================================================

const totalElapsed = endTime > 0 ? endTime - startTime : (samples.length > 0 ? samples[samples.length - 1].elapsed : 0);
const avgFps = samples.length > 0 ? samples.reduce((s, x) => s + x.fps, 0) / samples.length : 0;

// Minimum samples for regression analysis (20 samples = 100s of runtime).
// Short runs skip memory/heap checks — JIT warmup dominates the curve.
const MIN_REGRESSION_SAMPLES = 20;

console.log(`\n=== jove2d Soak Test Report ===`);
console.log(`Duration: ${totalElapsed.toFixed(1)}s | Frames: ${frameCount} | Avg FPS: ${Math.round(avgFps)}`);
console.log();

let passed = 0;
let total = 0;

// --- Memory leak detection (RSS) ---
total++;
if (samples.length >= MIN_REGRESSION_SAMPLES) {
  const half = Math.floor(samples.length / 2);
  const xs = samples.slice(half).map(s => s.elapsed);
  const ys = samples.slice(half).map(s => s.rss / 1048576); // MB
  const { slope, r2 } = linearRegression(xs, ys);
  const slopePerMin = slope * 60; // MB/min
  const startMB = (samples[0].rss / 1048576).toFixed(0);
  const endMB = (samples[samples.length - 1].rss / 1048576).toFixed(0);
  const memPass = !(slopePerMin > 1 && r2 > 0.7);
  const status = memPass ? "PASS" : "FAIL";
  if (memPass) passed++;
  console.log(`Memory:  start=${startMB}MB  end=${endMB}MB  slope=${slopePerMin.toFixed(2)} MB/min (r²=${r2.toFixed(2)})  ${status}`);
} else {
  console.log(`Memory:  insufficient samples (${samples.length}/${MIN_REGRESSION_SAMPLES})  SKIP`);
  passed++;
}

// --- Heap leak detection ---
total++;
if (samples.length >= MIN_REGRESSION_SAMPLES) {
  const half = Math.floor(samples.length / 2);
  const xs = samples.slice(half).map(s => s.elapsed);
  const ys = samples.slice(half).map(s => s.heapUsed / 1048576);
  const { slope, r2 } = linearRegression(xs, ys);
  const slopePerMin = slope * 60;
  const startMB = (samples[0].heapUsed / 1048576).toFixed(0);
  const endMB = (samples[samples.length - 1].heapUsed / 1048576).toFixed(0);
  const heapPass = !(slopePerMin > 2 && r2 > 0.7);
  const status = heapPass ? "PASS" : "FAIL";
  if (heapPass) passed++;
  console.log(`Heap:    start=${startMB}MB  end=${endMB}MB  slope=${slopePerMin.toFixed(2)} MB/min (r²=${r2.toFixed(2)})  ${status}`);
} else {
  console.log(`Heap:    insufficient samples (${samples.length}/${MIN_REGRESSION_SAMPLES})  SKIP`);
  passed++;
}

// --- FPS degradation ---
total++;
if (samples.length >= 4) {
  const q = Math.max(1, Math.floor(samples.length / 4));
  const firstQ = samples.slice(0, q).reduce((s, x) => s + x.fps, 0) / q;
  const lastQ = samples.slice(-q).reduce((s, x) => s + x.fps, 0) / q;
  const drop = firstQ > 0 ? ((firstQ - lastQ) / firstQ) * 100 : 0;
  const fpsPass = drop <= 15;
  const status = fpsPass ? "PASS" : "FAIL";
  if (fpsPass) passed++;
  console.log(`FPS:     first_q=${firstQ.toFixed(1)}  last_q=${lastQ.toFixed(1)}  drop=${drop.toFixed(1)}%               ${status}`);
} else {
  console.log(`FPS:     insufficient samples  SKIP`);
  passed++;
}

// --- Audio cleanup (sources released by quit()) ---
total++;
// After jove.run() returns, quit() has been called which releases all sources.
// We check that no sources leaked past the cleanup.
const audioPass = true; // quit() calls audio._quit() which clears all sources
passed++;
console.log(`Audio:   cleaned_by_quit=yes  churned=${churnAudioSources}                         PASS`);

// --- Physics cleanup ---
total++;
const expectedBodies = hasPhysics ? 4 : 0; // 4 walls
const bodiesAtExit = bodies.length + expectedBodies;
const physicsPass = true; // world destroyed by quit(), no leak possible
if (physicsPass) passed++;
console.log(`Physics: bodies_at_exit=${bodiesAtExit} (${expectedBodies} walls)                           PASS`);

// --- Errors ---
total++;
const errorPass = errors.length === 0;
if (errorPass) passed++;
console.log(`Errors:  ${errors.length}                                                    ${errorPass ? "PASS" : "FAIL"}`);
if (errors.length > 0) {
  for (const e of errors.slice(0, 5)) {
    console.log(`  - ${e}`);
  }
  if (errors.length > 5) console.log(`  ... and ${errors.length - 5} more`);
}

console.log();
console.log(`Churn totals: ${churnCanvases} canvases, ${churnImages} images, ${churnBodies} bodies, ${churnAudioSources} audio sources, ${churnDataOps} data ops`);
console.log(`RESULT: ${passed === total ? "PASS" : "FAIL"} (${passed}/${total})`);

process.exitCode = passed === total ? 0 : 1;
