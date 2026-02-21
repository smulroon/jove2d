// jove2d benchmark — "Chaos Box" stress test
// Physics bodies fall under gravity, particle bursts on collision, tiled background, audio
// Compare frame times side-by-side with love2d equivalent

import jove from "../../src/index.ts";
import type { Source } from "../../src/index.ts";
import type { ParticleSystem } from "../../src/jove/particles.ts";
import type { SpriteBatch, Canvas, Quad } from "../../src/jove/graphics.ts";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// --- Config ---
const W = 800, H = 600;
const MAX_BODIES = 300;
const WALL = 15;
const TILE_SIZE = 32;
const GRID_W = Math.ceil(W / TILE_SIZE); // 25
const GRID_H = Math.ceil(H / TILE_SIZE); // 19
const PARTICLE_POOL = 8;
const MAX_SOUNDS = 5;
const FRAME_HISTORY = 120;
const FIXED_DT = 1 / 60;
let physicsAccum = 0;

// --- Generate short bump WAV (0.05s 440Hz sine with exponential decay) ---
function generateBumpWav(): Uint8Array {
  const sampleRate = 44100;
  const duration = 0.05;
  const numSamples = Math.floor(sampleRate * duration);
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

// --- State ---
type BodyInfo = { body: ReturnType<typeof jove.physics.newBody>; kind: "circle" | "box"; size: number; color: [number, number, number] };
let world: ReturnType<typeof jove.physics.newWorld>;
const bodies: BodyInfo[] = [];
let bumpSource: Source | null = null;
const soundPool: Source[] = [];
let wavPath = "";
let batch: SpriteBatch | null = null;
const particles: ParticleSystem[] = [];
let particleIdx = 0;
let spawning = true;
let spawnRate = 20; // per second
let spawnAccum = 0;
let muted = false;
const frameTimes: number[] = new Array(FRAME_HISTORY).fill(0);
let frameIdx = 0;
let totalParticles = 0;

await jove.run({
  load() {
    jove.window.setTitle("Benchmark — jove2d");
    jove.graphics.setBackgroundColor(20, 20, 30);

    // --- Audio ---
    wavPath = join(tmpdir(), "jove2d-bump.wav");
    writeFileSync(wavPath, generateBumpWav());
    bumpSource = jove.audio.newSource(wavPath, "static");
    if (bumpSource) {
      for (let i = 0; i < MAX_SOUNDS; i++) {
        soundPool.push(bumpSource.clone());
      }
    }

    // --- Physics world + walls ---
    world = jove.physics.newWorld(0, 9.81 * 30);

    // Ground
    const ground = jove.physics.newBody(world, W / 2, H - WALL / 2, "static");
    jove.physics.newFixture(ground, jove.physics.newRectangleShape(W, WALL));
    // Ceiling
    const ceiling = jove.physics.newBody(world, W / 2, WALL / 2, "static");
    jove.physics.newFixture(ceiling, jove.physics.newRectangleShape(W, WALL));
    // Left
    const left = jove.physics.newBody(world, WALL / 2, H / 2, "static");
    jove.physics.newFixture(left, jove.physics.newRectangleShape(WALL, H));
    // Right
    const right = jove.physics.newBody(world, W - WALL / 2, H / 2, "static");
    jove.physics.newFixture(right, jove.physics.newRectangleShape(WALL, H));

    // --- Tileset + SpriteBatch ---
    const tileset = jove.graphics.newCanvas(128, 128);
    if (tileset) {
      jove.graphics.setCanvas(tileset);
      jove.graphics.clear(0, 0, 0, 0);
      const colors: [number, number, number][] = [[45, 45, 55], [40, 40, 50], [50, 50, 60], [35, 35, 45]];
      for (let ty = 0; ty < 2; ty++) {
        for (let tx = 0; tx < 2; tx++) {
          const c = colors[ty * 2 + tx];
          jove.graphics.setColor(c[0], c[1], c[2]);
          jove.graphics.rectangle("fill", tx * 32, ty * 32, 32, 32);
          jove.graphics.setColor(c[0] + 15, c[1] + 15, c[2] + 15);
          jove.graphics.rectangle("line", tx * 32 + 1, ty * 32 + 1, 30, 30);
        }
      }
      jove.graphics.setCanvas(null);

      const quads: Quad[] = [
        jove.graphics.newQuad(0, 0, 32, 32, 128, 128),
        jove.graphics.newQuad(32, 0, 32, 32, 128, 128),
        jove.graphics.newQuad(0, 32, 32, 32, 128, 128),
        jove.graphics.newQuad(32, 32, 32, 32, 128, 128),
      ];

      batch = jove.graphics.newSpriteBatch(tileset, GRID_W * GRID_H);
      if (batch) {
        for (let y = 0; y < GRID_H; y++) {
          for (let x = 0; x < GRID_W; x++) {
            batch.add(quads[(x + y) % 4], x * TILE_SIZE, y * TILE_SIZE);
          }
        }
      }
    }

    // --- Particle image (8x8 white circle) ---
    const particleImg = jove.graphics.newCanvas(8, 8);
    if (particleImg) {
      jove.graphics.setCanvas(particleImg);
      jove.graphics.clear(0, 0, 0, 0);
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.circle("fill", 4, 4, 4);
      jove.graphics.setCanvas(null);

      // --- Particle pool ---
      for (let i = 0; i < PARTICLE_POOL; i++) {
        const ps = jove.graphics.newParticleSystem(particleImg, 40);
        if (!ps) continue;
        ps.setParticleLifetime(0.2, 0.4);
        ps.setEmissionRate(0); // burst only
        ps.setSpeed(60, 150);
        ps.setDirection(0);
        ps.setSpread(Math.PI * 2);
        ps.setLinearAcceleration(-20, -40, 20, 40);
        ps.setSizes(1.2, 0.5, 0);
        ps.setSizeVariation(0.3);
        ps.setColors(
          255, 220, 80, 255,
          255, 120, 30, 200,
          200, 40, 10, 0,
        );
        ps.setSpin(-4, 4);
        particles.push(ps);
      }
    }

    // --- Contact callback ---
    world.setCallbacks({
      beginContact(contact) {
        const [fA, fB] = contact.getFixtures();
        const bA = fA.getBody();
        const bB = fB.getBody();
        // Only trigger for dynamic-dynamic or dynamic-static with some energy
        if (bA.getType() === "static" && bB.getType() === "static") return;
        const [ax, ay] = bA.getPosition();
        const [bx, by] = bB.getPosition();
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;

        // Emit particles
        if (particles.length > 0) {
          const ps = particles[particleIdx % particles.length];
          ps.setPosition(mx, my);
          ps.emit(20);
          ps.start();
          particleIdx++;
        }

        // Play sound (reuse from pool)
        if (!muted && soundPool.length > 0) {
          for (const s of soundPool) {
            if (s.isStopped()) {
              s.setPitch(0.8 + Math.random() * 0.6);
              s.setVolume(0.3);
              s.play();
              break;
            }
          }
        }
      },
    });
  },

  update(dt) {
    // Record frame time
    frameTimes[frameIdx % FRAME_HISTORY] = dt;
    frameIdx++;

    // Physics step (fixed timestep)
    physicsAccum += dt;
    while (physicsAccum >= FIXED_DT) {
      world.update(FIXED_DT);
      physicsAccum -= FIXED_DT;
    }

    // Auto-spawn
    if (spawning) {
      spawnAccum += dt;
      const interval = 1 / spawnRate;
      while (spawnAccum >= interval) {
        spawnAccum -= interval;
        spawnBody(WALL + 20 + Math.random() * (W - WALL * 2 - 40), WALL + 20);
      }
    }

    // Cap bodies
    while (bodies.length > MAX_BODIES) {
      const old = bodies.shift()!;
      old.body.destroy();
    }

    // Update particles
    totalParticles = 0;
    for (const ps of particles) {
      ps.update(dt);
      totalParticles += ps.getCount();
    }
  },

  draw() {
    // 1. Tiled background
    if (batch) {
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.draw(batch);
    }

    // 2. Physics bodies
    for (const b of bodies) {
      const [bx, by] = b.body.getPosition();
      jove.graphics.setColor(b.color[0], b.color[1], b.color[2]);
      if (b.kind === "circle") {
        jove.graphics.circle("fill", bx, by, b.size);
      } else {
        jove.graphics.push();
        jove.graphics.translate(bx, by);
        jove.graphics.rotate(b.body.getAngle());
        jove.graphics.rectangle("fill", -b.size / 2, -b.size / 2, b.size, b.size);
        jove.graphics.pop();
      }
    }

    // 3. Particles (additive)
    jove.graphics.setBlendMode("add");
    jove.graphics.setColor(255, 255, 255);
    for (const ps of particles) {
      if (ps.getCount() > 0) {
        jove.graphics.draw(ps);
      }
    }
    jove.graphics.setBlendMode("alpha");

    // 4. HUD
    drawHUD();
  },

  keypressed(key) {
    if (key === "escape") {
      try { unlinkSync(wavPath); } catch {}
      jove.window.close();
    } else if (key === "space") {
      spawning = !spawning;
    } else if (key === "up") {
      spawnRate = Math.min(50, spawnRate + 5);
    } else if (key === "down") {
      spawnRate = Math.max(5, spawnRate - 5);
    } else if (key === "r") {
      for (const b of bodies) b.body.destroy();
      bodies.length = 0;
      spawnAccum = 0;
      frameIdx = 0;
      frameTimes.fill(0);
    } else if (key === "m") {
      muted = !muted;
    }
  },

  mousepressed(x, y, button) {
    if (button === 1) {
      for (let i = 0; i < 10; i++) {
        spawnBody(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40);
      }
    }
  },

  quit() {
    try { unlinkSync(wavPath); } catch {}
    return false;
  },
});

function spawnBody(x: number, y: number) {
  const isCircle = Math.random() > 0.4;
  const color: [number, number, number] = [
    100 + Math.floor(Math.random() * 155),
    100 + Math.floor(Math.random() * 155),
    100 + Math.floor(Math.random() * 155),
  ];

  if (isCircle) {
    const r = 8 + Math.random() * 7;
    const body = jove.physics.newBody(world, x, y, "dynamic");
    const shape = jove.physics.newCircleShape(r);
    const fix = jove.physics.newFixture(body, shape, 1.0);
    fix.setRestitution(0.4 + Math.random() * 0.4);
    fix.setFriction(0.3);
    bodies.push({ body, kind: "circle", size: r, color });
  } else {
    const s = 10 + Math.random() * 10;
    const body = jove.physics.newBody(world, x, y, "dynamic");
    const shape = jove.physics.newRectangleShape(s, s);
    const fix = jove.physics.newFixture(body, shape, 1.0);
    fix.setRestitution(0.3 + Math.random() * 0.3);
    fix.setFriction(0.4);
    bodies.push({ body, kind: "box", size: s, color });
  }
}

function drawHUD() {
  const fps = jove.timer.getFPS();
  const avgDt = jove.timer.getAverageDelta();
  const activeSounds = jove.audio.getActiveSourceCount();

  // Compute min/max over history
  let minDt = Infinity, maxDt = 0;
  const count = Math.min(frameIdx, FRAME_HISTORY);
  for (let i = 0; i < count; i++) {
    const dt = frameTimes[i];
    if (dt < minDt) minDt = dt;
    if (dt > maxDt) maxDt = dt;
  }

  // Background panel
  jove.graphics.setColor(0, 0, 0, 180);
  jove.graphics.rectangle("fill", 5, 5, 220, 120);

  jove.graphics.setColor(255, 255, 255);
  jove.graphics.print(`FPS: ${fps}  avg: ${(avgDt * 1000).toFixed(1)}ms`, 10, 8);
  jove.graphics.print(`Bodies: ${bodies.length}/${MAX_BODIES}`, 10, 22);
  jove.graphics.print(`Particles: ${totalParticles}  Sounds: ${activeSounds}`, 10, 36);
  jove.graphics.print(`Spawn: ${spawnRate}/s ${spawning ? "(ON)" : "(OFF)"}`, 10, 50);
  if (count > 0) {
    jove.graphics.print(`dt: min ${(minDt * 1000).toFixed(1)} max ${(maxDt * 1000).toFixed(1)}ms`, 10, 64);
  }
  jove.graphics.setColor(150, 150, 150);
  jove.graphics.print(`SPACE:spawn UP/DN:rate R:reset`, 10, 82);
  jove.graphics.print(`Click:burst M:mute${muted ? "(ON)" : ""} ESC:quit`, 10, 96);

  // Frame time bar graph (bottom-right)
  const graphX = W - FRAME_HISTORY - 10;
  const graphY = H - 70;
  const graphH = 60;

  jove.graphics.setColor(0, 0, 0, 160);
  jove.graphics.rectangle("fill", graphX - 2, graphY - 2, FRAME_HISTORY + 4, graphH + 4);

  // 16ms and 33ms reference lines
  const line16 = graphY + graphH - (16 / 33) * graphH;
  const line33 = graphY;
  jove.graphics.setColor(100, 100, 100, 100);
  jove.graphics.line(graphX, line16, graphX + FRAME_HISTORY, line16);
  jove.graphics.line(graphX, line33, graphX + FRAME_HISTORY, line33);

  for (let i = 0; i < FRAME_HISTORY; i++) {
    const idx = (frameIdx - FRAME_HISTORY + i + FRAME_HISTORY * 2) % FRAME_HISTORY;
    const dt = frameTimes[idx];
    const ms = dt * 1000;
    const barH = Math.min(graphH, (ms / 33) * graphH);

    if (ms < 16) {
      jove.graphics.setColor(80, 200, 80);
    } else if (ms < 33) {
      jove.graphics.setColor(200, 200, 80);
    } else {
      jove.graphics.setColor(200, 80, 80);
    }
    jove.graphics.rectangle("fill", graphX + i, graphY + graphH - barH, 1, barH);
  }

  jove.graphics.setColor(150, 150, 150);
  jove.graphics.print("33ms", graphX - 30, graphY - 4);
  jove.graphics.print("16ms", graphX - 30, line16 - 4);
}
