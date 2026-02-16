// jove2d Tempest — tube shooter with perspective lanes, enemy waves, superzapper
// Player moves along the near rim of a geometric tube and shoots enemies
// approaching from the far end.

import jove from "../../src/index.ts";
import type { Source } from "../../src/index.ts";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const W = 800, H = 600;
const CX = W / 2, CY = H / 2 + 20;

type GameState = "title" | "playing" | "warp" | "gameover";

// A tube is defined by rim points. Lanes exist between adjacent points.
// Near rim = full size, far rim = scaled down (perspective).
const FAR_SCALE = 0.22;

// Level shapes — each is an array of angles (for circular shapes) or explicit [x,y] offsets
interface LevelShape {
  points: [number, number][]; // near-rim offsets from center
  closed: boolean;            // does the tube wrap around?
}

function makeCircle(n: number): LevelShape {
  const pts: [number, number][] = [];
  const R = 240;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  return { points: pts, closed: true };
}

function makeSquare(): LevelShape {
  const pts: [number, number][] = [];
  const S = 200;
  const sides = [
    { sx: -S, sy: -S, ex: S, ey: -S },
    { sx: S, sy: -S, ex: S, ey: S },
    { sx: S, sy: S, ex: -S, ey: S },
    { sx: -S, sy: S, ex: -S, ey: -S },
  ];
  for (const side of sides) {
    for (let i = 0; i < 4; i++) {
      const t = i / 4;
      pts.push([side.sx + (side.ex - side.sx) * t, side.sy + (side.ey - side.sy) * t]);
    }
  }
  return { points: pts, closed: true };
}

function makePlus(): LevelShape {
  const pts: [number, number][] = [];
  const S = 180, s = 80;
  // Top arm
  pts.push([-s, -S], [s, -S], [s, -s]);
  // Right arm
  pts.push([S, -s], [S, s], [s, s]);
  // Bottom arm
  pts.push([s, S], [-s, S], [-s, s]);
  // Left arm
  pts.push([-S, s], [-S, -s], [-s, -s]);
  return { points: pts, closed: true };
}

function makeVee(): LevelShape {
  const pts: [number, number][] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = -240 + t * 480;
    const y = -180 + Math.abs(t - 0.5) * 2 * 260;
    pts.push([x, y]);
  }
  return { points: pts, closed: false };
}

function makeFlat(): LevelShape {
  const pts: [number, number][] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    pts.push([-280 + i * (560 / n), 0]);
  }
  return { points: pts, closed: false };
}

function makeTriangle(): LevelShape {
  const pts: [number, number][] = [];
  const R = 230;
  const corners: [number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    corners.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  for (let s = 0; s < 3; s++) {
    const [sx, sy] = corners[s];
    const [ex, ey] = corners[(s + 1) % 3];
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      pts.push([sx + (ex - sx) * t, sy + (ey - sy) * t]);
    }
  }
  return { points: pts, closed: true };
}

const SHAPES = [
  () => makeCircle(16),
  () => makeSquare(),
  () => makePlus(),
  () => makeVee(),
  () => makeFlat(),
  () => makeTriangle(),
  () => makeCircle(12),
  () => makeCircle(20),
];

// Lane colors cycle (classic Tempest used blue/cyan/green/yellow/red)
const LANE_COLORS: [number, number, number][] = [
  [0, 100, 255], [0, 180, 255], [0, 220, 180], [0, 200, 80],
  [180, 220, 0], [255, 200, 0], [255, 140, 0], [255, 60, 0],
  [255, 0, 80], [200, 0, 200], [120, 0, 255], [60, 60, 255],
];

// Enemy types
type EnemyKind = "flipper" | "tanker" | "spiker";
interface Enemy {
  lane: number;
  depth: number; // 0=far, 1=near
  kind: EnemyKind;
  speed: number;
  flipTimer: number; // flippers change lanes
  spikeTrail: number; // spikers leave spikes up to this depth
}

interface Bullet {
  lane: number;
  depth: number; // 1=near, moving toward 0
}

interface Spike {
  lane: number;
  depth: number; // how far toward near the spike extends (0..1)
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  r: number; g: number; b: number;
}

let state: GameState = "title";
let shape: LevelShape = makeCircle(16);
let numLanes = 0;

// Player
let playerLane = 0;
let score = 0, lives = 3, levelNum = 1;
let zapAvailable = true;

// Game objects
let enemies: Enemy[] = [];
let bullets: Bullet[] = [];
let spikes: Spike[] = [];
let particles: Particle[] = [];

// Wave spawning
let spawnTimer = 0, spawnInterval = 1.5;
let enemiesRemaining = 0;

// Warp animation
let warpProgress = 0;

// Audio
const wavPaths: string[] = [];
let sndShoot: Source | null = null;
let sndExplode: Source | null = null;
let sndZap: Source | null = null;
let sndDeath: Source | null = null;

function generateWav(dur: number, gen: (t: number) => number): Uint8Array {
  const sr = 44100, ns = Math.floor(sr * dur), ds = ns * 2, fs = 44 + ds;
  const buf = new ArrayBuffer(fs);
  const v = new DataView(buf);
  v.setUint32(0, 0x52494646, false);
  v.setUint32(4, fs - 8, true);
  v.setUint32(8, 0x57415645, false);
  v.setUint32(12, 0x666d7420, false);
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  v.setUint32(36, 0x64617461, false);
  v.setUint32(40, ds, true);
  for (let i = 0; i < ns; i++) {
    const s = gen(i / sr);
    v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.floor(s * 32767))), true);
  }
  return new Uint8Array(buf);
}

function makeWav(name: string, dur: number, gen: (t: number) => number): Source | null {
  const p = join(tmpdir(), `jove2d-tempest-${name}.wav`);
  writeFileSync(p, generateWav(dur, gen));
  wavPaths.push(p);
  return jove.audio.newSource(p, "static");
}

const shootPool: Source[] = [];
const explodePool: Source[] = [];
function playPool(pool: Source[], src: Source | null, max: number) {
  for (const s of pool) { if (!s.isPlaying()) { s.play(); return; } }
  if (src && pool.length < max) { const c = src.clone(); pool.push(c); c.play(); }
}

// Geometry helpers — get screen position from lane + depth
function nearPt(lane: number): [number, number] {
  const idx = lane % shape.points.length;
  return [CX + shape.points[idx][0], CY + shape.points[idx][1]];
}

function farPt(lane: number): [number, number] {
  const idx = lane % shape.points.length;
  return [CX + shape.points[idx][0] * FAR_SCALE, CY + shape.points[idx][1] * FAR_SCALE];
}

function lerpPt(lane: number, depth: number): [number, number] {
  const [nx, ny] = nearPt(lane);
  const [fx, fy] = farPt(lane);
  return [fx + (nx - fx) * depth, fy + (ny - fy) * depth];
}

// Lane midpoint at a given depth
function laneMid(lane: number, depth: number): [number, number] {
  const nextLane = (lane + 1) % shape.points.length;
  const [x1, y1] = lerpPt(lane, depth);
  const [x2, y2] = lerpPt(nextLane, depth);
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

function initLevel(num: number) {
  levelNum = num;
  const shapeIdx = (num - 1) % SHAPES.length;
  shape = SHAPES[shapeIdx]();
  numLanes = shape.closed ? shape.points.length : shape.points.length - 1;
  playerLane = Math.floor(numLanes / 2);
  enemies = [];
  bullets = [];
  spikes = [];
  particles = [];
  zapAvailable = true;

  // Wave config: more enemies at higher levels
  enemiesRemaining = 8 + num * 3;
  spawnTimer = 1.0; // grace period
  spawnInterval = Math.max(0.3, 1.5 - num * 0.08);
}

function startGame() {
  score = 0;
  lives = 3;
  initLevel(1);
  state = "playing";
}

function spawnEnemy() {
  if (enemiesRemaining <= 0) return;
  enemiesRemaining--;

  const lane = Math.floor(Math.random() * numLanes);
  const baseSpeed = 0.15 + levelNum * 0.02;
  const roll = Math.random();
  let kind: EnemyKind;
  if (roll < 0.55) kind = "flipper";
  else if (roll < 0.8) kind = "tanker";
  else kind = "spiker";

  enemies.push({
    lane, depth: 0, kind,
    speed: kind === "spiker" ? baseSpeed * 0.6 : baseSpeed,
    flipTimer: kind === "flipper" ? 1 + Math.random() * 2 : 99,
    spikeTrail: 0,
  });
}

function spawnParticles(x: number, y: number, r: number, g: number, b: number, count: number) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 60 + Math.random() * 140;
    const life = 0.3 + Math.random() * 0.4;
    particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life, maxLife: life, r, g, b,
    });
  }
}

function killEnemy(idx: number) {
  const e = enemies[idx];
  const [mx, my] = laneMid(e.lane, e.depth);
  const ci = e.lane % LANE_COLORS.length;
  const [cr, cg, cb] = LANE_COLORS[ci];

  if (e.kind === "tanker") {
    // Split into 2 flippers
    const baseSpeed = 0.15 + levelNum * 0.02;
    const l1 = e.lane > 0 ? e.lane - 1 : (shape.closed ? numLanes - 1 : 0);
    const l2 = e.lane < numLanes - 1 ? e.lane + 1 : (shape.closed ? 0 : numLanes - 1);
    enemies.push({
      lane: l1, depth: e.depth, kind: "flipper",
      speed: baseSpeed * 1.2, flipTimer: 1 + Math.random(), spikeTrail: 0,
    });
    enemies.push({
      lane: l2, depth: e.depth, kind: "flipper",
      speed: baseSpeed * 1.2, flipTimer: 1 + Math.random(), spikeTrail: 0,
    });
    score += 100;
  } else if (e.kind === "spiker") {
    score += 50;
  } else {
    score += 150;
  }

  spawnParticles(mx, my, cr, cg, cb, 8);
  playPool(explodePool, sndExplode, 6);
  enemies.splice(idx, 1);
}

await jove.run({
  load() {
    jove.window.setTitle("jove2d — Tempest");
    jove.graphics.setBackgroundColor(0, 0, 0);

    sndShoot = makeWav("shoot", 0.06, (t) =>
      Math.sin(2 * Math.PI * 1400 * t) * (1 - t / 0.06) * 0.25);
    sndExplode = makeWav("explode", 0.12, (t) =>
      (Math.random() * 2 - 1) * (1 - t / 0.12) * 0.35);
    sndZap = makeWav("zap", 0.3, (t) => {
      const freq = 2000 - t * 4000;
      return Math.sin(2 * Math.PI * Math.max(100, freq) * t) * (1 - t / 0.3) * 0.4
        + (Math.random() * 2 - 1) * 0.15 * (1 - t / 0.3);
    });
    sndDeath = makeWav("death", 0.5, (t) => {
      const freq = 300 - t * 400;
      return Math.sin(2 * Math.PI * Math.max(40, freq) * t) * (1 - t / 0.5) * 0.5;
    });
  },

  update(dt) {
    if (state === "warp") {
      warpProgress += dt * 1.5;
      if (warpProgress >= 1) {
        initLevel(levelNum + 1);
        state = "playing";
      }
      return;
    }

    if (state !== "playing") return;

    // Spawn enemies
    spawnTimer -= dt;
    if (spawnTimer <= 0 && enemiesRemaining > 0) {
      spawnEnemy();
      spawnTimer = spawnInterval;
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.depth -= 2.0 * dt; // bullets travel fast toward far end
      if (b.depth <= 0) { bullets.splice(i, 1); continue; }

      // Hit enemy?
      let hit = false;
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (e.lane === b.lane && Math.abs(e.depth - b.depth) < 0.06) {
          killEnemy(ei);
          bullets.splice(i, 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // Hit spike?
      for (let si = spikes.length - 1; si >= 0; si--) {
        const s = spikes[si];
        if (s.lane === b.lane && b.depth <= s.depth) {
          // Destroy spike segment
          s.depth -= 0.1;
          if (s.depth <= 0) spikes.splice(si, 1);
          bullets.splice(i, 1);
          score += 10;
          break;
        }
      }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.depth += e.speed * dt;

      if (e.kind === "spiker") {
        // Leave spike trail
        const existing = spikes.find(s => s.lane === e.lane);
        if (existing) {
          existing.depth = Math.max(existing.depth, e.depth);
        } else {
          spikes.push({ lane: e.lane, depth: e.depth });
        }
        // Spikers retreat after reaching ~0.85 depth
        if (e.depth >= 0.85) {
          enemies.splice(i, 1);
          continue;
        }
      }

      // Flipper lane change
      if (e.kind === "flipper" && e.depth > 0.15) {
        e.flipTimer -= dt;
        if (e.flipTimer <= 0) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          const newLane = e.lane + dir;
          if (shape.closed) {
            e.lane = ((newLane % numLanes) + numLanes) % numLanes;
          } else {
            e.lane = Math.max(0, Math.min(numLanes - 1, newLane));
          }
          e.flipTimer = 0.8 + Math.random() * 1.5;
        }
      }

      // Enemy reached the near rim — kill player
      if (e.depth >= 1.0) {
        enemies.splice(i, 1);
        lives--;
        sndDeath?.play();
        const [px, py] = laneMid(playerLane, 1.0);
        spawnParticles(px, py, 255, 255, 0, 15);
        if (lives <= 0) {
          state = "gameover";
          return;
        }
      }
    }

    // Check player collision with enemies at near rim (same lane, depth > 0.9)
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.lane === playerLane && e.depth > 0.9) {
        enemies.splice(i, 1);
        lives--;
        sndDeath?.play();
        const [px, py] = laneMid(playerLane, 1.0);
        spawnParticles(px, py, 255, 255, 0, 15);
        if (lives <= 0) {
          state = "gameover";
          return;
        }
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Level complete — all enemies spawned and destroyed
    if (enemiesRemaining <= 0 && enemies.length === 0) {
      warpProgress = 0;
      state = "warp";
    }
  },

  draw() {
    if (state === "title") {
      jove.graphics.setColor(255, 255, 0);
      jove.graphics.printf("TEMPEST", 0, H / 2 - 80, W, "center");
      jove.graphics.setColor(0, 200, 255);
      jove.graphics.printf("Press ENTER to start", 0, H / 2 - 10, W, "center");
      jove.graphics.setColor(150, 150, 180);
      jove.graphics.printf("LEFT/RIGHT  Move along rim", 0, H / 2 + 30, W, "center");
      jove.graphics.printf("SPACE  Shoot   Z  Superzapper", 0, H / 2 + 55, W, "center");
      jove.graphics.printf("ESC  Quit", 0, H / 2 + 80, W, "center");
      return;
    }

    // Warp zoom effect
    if (state === "warp") {
      const s = 1 + warpProgress * 4;
      jove.graphics.push();
      jove.graphics.translate(CX, CY);
      jove.graphics.scale(s, s);
      jove.graphics.translate(-CX, -CY);
      drawTube(0.5 + warpProgress * 0.5);
      jove.graphics.pop();
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.printf(`LEVEL ${levelNum + 1}`, 0, H / 2, W, "center");
      return;
    }

    drawTube(1.0);

    // Draw spikes
    for (const s of spikes) {
      const [nx, ny] = laneMid(s.lane, s.depth);
      const [fx, fy] = laneMid(s.lane, 0);
      jove.graphics.setColor(0, 255, 0, 150);
      jove.graphics.line(fx, fy, nx, ny);
    }

    // Draw enemies
    for (const e of enemies) {
      const [mx, my] = laneMid(e.lane, e.depth);
      const size = 4 + e.depth * 10;
      if (e.kind === "flipper") {
        // Diamond shape
        jove.graphics.setColor(255, 0, 0);
        jove.graphics.polygon("fill",
          mx, my - size, mx + size, my, mx, my + size, mx - size, my);
      } else if (e.kind === "tanker") {
        // Square
        jove.graphics.setColor(255, 255, 0);
        jove.graphics.rectangle("fill", mx - size, my - size, size * 2, size * 2);
      } else {
        // Spiker — triangle
        jove.graphics.setColor(0, 255, 0);
        jove.graphics.polygon("fill",
          mx, my - size, mx + size * 0.7, my + size * 0.7, mx - size * 0.7, my + size * 0.7);
      }
    }

    // Draw bullets
    jove.graphics.setColor(255, 255, 0);
    for (const b of bullets) {
      const [bx, by] = laneMid(b.lane, b.depth);
      const sz = 2 + b.depth * 3;
      jove.graphics.circle("fill", bx, by, sz);
    }

    // Draw player (claw shape on near rim)
    const pn1 = nearPt(playerLane);
    const pn2 = nearPt((playerLane + 1) % shape.points.length);
    const [pmx, pmy] = [(pn1[0] + pn2[0]) / 2, (pn1[1] + pn2[1]) / 2];

    // Claw arms extend slightly inward from the two lane edges
    const [f1x, f1y] = lerpPt(playerLane, 0.9);
    const [f2x, f2y] = lerpPt((playerLane + 1) % shape.points.length, 0.9);

    jove.graphics.setColor(255, 255, 0);
    jove.graphics.polygon("fill", pn1[0], pn1[1], f1x, f1y, pmx, pmy);
    jove.graphics.polygon("fill", pn2[0], pn2[1], f2x, f2y, pmx, pmy);
    // Bright dot at center
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.circle("fill", pmx, pmy, 4);

    // Draw particles
    for (const p of particles) {
      const alpha = Math.floor((p.life / p.maxLife) * 255);
      jove.graphics.setColor(p.r, p.g, p.b, alpha);
      jove.graphics.circle("fill", p.x, p.y, 2);
    }

    // HUD
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`SCORE: ${score}`, 15, 10);
    jove.graphics.print(`LEVEL: ${levelNum}`, W - 110, 10);

    // Lives
    jove.graphics.setColor(255, 255, 0);
    for (let i = 0; i < lives; i++) {
      jove.graphics.polygon("fill",
        20 + i * 20, 45, 15 + i * 20, 38, 25 + i * 20, 38);
    }

    // Superzapper indicator
    if (zapAvailable) {
      jove.graphics.setColor(0, 200, 255);
      jove.graphics.print("ZAP READY", W / 2 - 35, H - 25);
    }

    // Enemies remaining
    jove.graphics.setColor(120, 120, 150);
    jove.graphics.print(`Enemies: ${enemiesRemaining + enemies.length}`, W / 2 - 40, 10);

    // Game over
    if (state === "gameover") {
      jove.graphics.setColor(0, 0, 0, 180);
      jove.graphics.rectangle("fill", W / 2 - 140, H / 2 - 45, 280, 90);
      jove.graphics.setColor(255, 80, 80);
      jove.graphics.printf("GAME OVER", 0, H / 2 - 30, W, "center");
      jove.graphics.setColor(200, 200, 200);
      jove.graphics.printf("ENTER to restart", 0, H / 2 + 5, W, "center");
    }
  },

  keypressed(key) {
    if (key === "escape") { jove.event.quit(); return; }
    if (key === "return") {
      if (state === "title" || state === "gameover") startGame();
      return;
    }
    if (state !== "playing") return;

    if (key === "left") {
      if (shape.closed) {
        playerLane = ((playerLane - 1) % numLanes + numLanes) % numLanes;
      } else {
        playerLane = Math.max(0, playerLane - 1);
      }
    } else if (key === "right") {
      if (shape.closed) {
        playerLane = (playerLane + 1) % numLanes;
      } else {
        playerLane = Math.min(numLanes - 1, playerLane + 1);
      }
    } else if (key === "space") {
      if (bullets.length < 6) {
        bullets.push({ lane: playerLane, depth: 0.95 });
        playPool(shootPool, sndShoot, 4);
      }
    } else if (key === "z" && zapAvailable) {
      // Superzapper — destroy all visible enemies
      zapAvailable = false;
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const [mx, my] = laneMid(e.lane, e.depth);
        const ci = e.lane % LANE_COLORS.length;
        spawnParticles(mx, my, LANE_COLORS[ci][0], LANE_COLORS[ci][1], LANE_COLORS[ci][2], 5);
        score += 50;
      }
      enemies = [];
      sndZap?.play();
    }
  },

  quit() {
    for (const p of wavPaths) { try { unlinkSync(p); } catch {} }
    return false;
  },
});

// Draw the tube wireframe
function drawTube(alpha: number) {
  const a = Math.floor(alpha * 255);
  const n = shape.points.length;
  const lanes = shape.closed ? n : n - 1;

  // Draw lane lines (near to far)
  for (let i = 0; i < n; i++) {
    const ci = i % LANE_COLORS.length;
    const [cr, cg, cb] = LANE_COLORS[ci];
    jove.graphics.setColor(cr, cg, cb, Math.floor(a * 0.5));
    const [nx, ny] = nearPt(i);
    const [fx, fy] = farPt(i);
    jove.graphics.line(nx, ny, fx, fy);
  }

  // Draw near rim
  for (let i = 0; i < lanes; i++) {
    const ci = i % LANE_COLORS.length;
    const [cr, cg, cb] = LANE_COLORS[ci];
    jove.graphics.setColor(cr, cg, cb, a);
    const [x1, y1] = nearPt(i);
    const [x2, y2] = nearPt((i + 1) % n);
    jove.graphics.line(x1, y1, x2, y2);
  }

  // Draw far rim
  for (let i = 0; i < lanes; i++) {
    const ci = i % LANE_COLORS.length;
    const [cr, cg, cb] = LANE_COLORS[ci];
    jove.graphics.setColor(cr, cg, cb, Math.floor(a * 0.6));
    const [x1, y1] = farPt(i);
    const [x2, y2] = farPt((i + 1) % n);
    jove.graphics.line(x1, y1, x2, y2);
  }
}
