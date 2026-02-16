// jove2d Defender — horizontal scrolling shooter with minimap, humanoids to rescue,
// landers that abduct them, and screen-wrapping world.

import jove from "../../src/index.ts";
import type { Source } from "../../src/index.ts";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const W = 800, H = 600;
const WORLD_W = 4000;
const GROUND_Y = H - 60;
const MINIMAP_Y = 12, MINIMAP_H = 24;
const MINIMAP_X = 150, MINIMAP_W = W - 300;

type GameState = "title" | "playing" | "gameover";

// Terrain — array of heights across the world
const TERRAIN_SEGS = 200;
const terrain: number[] = [];

interface Ship {
  x: number; y: number; vx: number; vy: number;
  facing: number; // 1=right, -1=left
  shootCooldown: number;
  invulnTimer: number;
}

interface Bullet { x: number; y: number; vx: number; life: number; }

interface Humanoid {
  x: number; groundY: number; // world X, ground rest Y
  y: number; // current Y (may be carried upward)
  state: "ground" | "carried" | "falling" | "rescued";
  carrier: number; // index of lander carrying, -1 if none
}

type EnemyKind = "lander" | "mutant" | "bomber" | "pod";

interface Enemy {
  x: number; y: number; vx: number; vy: number;
  kind: EnemyKind;
  target: number; // humanoid index for landers, -1 otherwise
  abducting: boolean; // lander is carrying a humanoid upward
  hp: number;
  shootTimer: number;
}

interface EnemyBullet { x: number; y: number; vx: number; vy: number; life: number; }

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  r: number; g: number; b: number;
}

let state: GameState = "title";
let ship: Ship = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, shootCooldown: 0, invulnTimer: 0 };
let cameraX = 0; // world X of left edge of screen
let score = 0, lives = 3, levelNum = 1;
let smartBombs = 3;

let bullets: Bullet[] = [];
let enemies: Enemy[] = [];
let enemyBullets: EnemyBullet[] = [];
let humanoids: Humanoid[] = [];
let particles: Particle[] = [];

let enemiesRemaining = 0; // enemies left to spawn
let spawnTimer = 0;

// Audio
const wavPaths: string[] = [];
let sndShoot: Source | null = null;
let sndExplode: Source | null = null;
let sndDeath: Source | null = null;
let sndBomb: Source | null = null;
let sndRescue: Source | null = null;

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
  const p = join(tmpdir(), `jove2d-defender-${name}.wav`);
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

// World wrapping
function wrapX(x: number): number {
  return ((x % WORLD_W) + WORLD_W) % WORLD_W;
}

function worldDist(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, WORLD_W - d);
}

function worldDelta(from: number, to: number): number {
  let d = to - from;
  if (d > WORLD_W / 2) d -= WORLD_W;
  if (d < -WORLD_W / 2) d += WORLD_W;
  return d;
}

// Convert world X to screen X relative to camera
function toScreenX(wx: number): number {
  return worldDelta(cameraX + W / 2, wx) + W / 2;
}

function terrainHeight(wx: number): number {
  const segW = WORLD_W / TERRAIN_SEGS;
  const idx = wrapX(wx) / segW;
  const i0 = Math.floor(idx) % TERRAIN_SEGS;
  const i1 = (i0 + 1) % TERRAIN_SEGS;
  const frac = idx - Math.floor(idx);
  return terrain[i0] * (1 - frac) + terrain[i1] * frac;
}

function generateTerrain() {
  terrain.length = 0;
  // Multi-octave noise for interesting terrain
  for (let i = 0; i < TERRAIN_SEGS; i++) {
    const t = i / TERRAIN_SEGS;
    let h = 0;
    h += Math.sin(t * Math.PI * 4) * 30;
    h += Math.sin(t * Math.PI * 10 + 1.3) * 15;
    h += Math.sin(t * Math.PI * 22 + 4.7) * 8;
    h += (Math.random() - 0.5) * 10;
    terrain.push(GROUND_Y + h);
  }
}

function spawnParticles(x: number, y: number, r: number, g: number, b: number, count: number) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 40 + Math.random() * 120;
    const life = 0.3 + Math.random() * 0.5;
    particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life, maxLife: life, r, g, b,
    });
  }
}

function spawnEnemy(kind: EnemyKind) {
  // Spawn off-screen in world coordinates
  const side = Math.random() < 0.5 ? -1 : 1;
  const ex = wrapX(ship.x + side * (W / 2 + 50 + Math.random() * 200));
  let ey: number;
  if (kind === "lander") ey = 60 + Math.random() * 100;
  else if (kind === "bomber") ey = 100 + Math.random() * 200;
  else ey = 80 + Math.random() * 250;

  const baseSpeed = 40 + levelNum * 5;
  const e: Enemy = {
    x: ex, y: ey,
    vx: (Math.random() - 0.5) * baseSpeed,
    vy: (Math.random() - 0.5) * 20,
    kind, target: -1, abducting: false,
    hp: kind === "pod" ? 2 : 1,
    shootTimer: 1 + Math.random() * 2,
  };

  // Landers seek a humanoid
  if (kind === "lander") {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < humanoids.length; i++) {
      if (humanoids[i].state !== "ground") continue;
      const d = worldDist(ex, humanoids[i].x);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    e.target = best;
  }

  enemies.push(e);
}

function initLevel(num: number) {
  levelNum = num;
  generateTerrain();

  ship.x = WORLD_W / 2;
  ship.y = 250;
  ship.vx = 0;
  ship.vy = 0;
  ship.facing = 1;
  ship.shootCooldown = 0;
  ship.invulnTimer = 2;
  cameraX = ship.x - W / 2;

  bullets = [];
  enemies = [];
  enemyBullets = [];
  particles = [];

  // Place humanoids along the ground
  humanoids = [];
  const numHumans = 8 + Math.min(num, 6) * 2;
  for (let i = 0; i < numHumans; i++) {
    const hx = Math.random() * WORLD_W;
    const gy = terrainHeight(hx);
    humanoids.push({ x: hx, groundY: gy, y: gy - 8, state: "ground", carrier: -1 });
  }

  // Wave config
  enemiesRemaining = 10 + num * 4;
  spawnTimer = 1.5;
  smartBombs = 3;
}

function startGame() {
  score = 0;
  lives = 3;
  initLevel(1);
  state = "playing";
}

function killPlayer() {
  lives--;
  spawnParticles(ship.x, ship.y, 255, 200, 50, 20);
  sndDeath?.play();
  if (lives <= 0) {
    state = "gameover";
  } else {
    ship.invulnTimer = 2;
    ship.vx = 0;
    ship.vy = 0;
  }
}

function killEnemy(idx: number) {
  const e = enemies[idx];
  const sx = toScreenX(e.x);
  spawnParticles(sx, e.y, 255, 100, 50, 10);
  playPool(explodePool, sndExplode, 8);

  // Release carried humanoid
  if (e.kind === "lander" && e.abducting && e.target >= 0 && e.target < humanoids.length) {
    const h = humanoids[e.target];
    if (h.state === "carried") {
      h.state = "falling";
      h.carrier = -1;
    }
  }

  // Pods split into mutants
  if (e.kind === "pod") {
    for (let i = 0; i < 3; i++) {
      const m: Enemy = {
        x: e.x, y: e.y,
        vx: (Math.random() - 0.5) * 150,
        vy: (Math.random() - 0.5) * 100,
        kind: "mutant", target: -1, abducting: false, hp: 1,
        shootTimer: 0.5 + Math.random(),
      };
      enemies.push(m);
    }
  }

  const pts = e.kind === "lander" ? 150 : e.kind === "mutant" ? 200 : e.kind === "bomber" ? 250 : 500;
  score += pts;
  enemies.splice(idx, 1);
}

await jove.run({
  load() {
    jove.window.setTitle("jove2d — Defender");
    jove.graphics.setBackgroundColor(0, 0, 0);

    sndShoot = makeWav("shoot", 0.06, (t) =>
      Math.sin(2 * Math.PI * 1000 * t) * (1 - t / 0.06) * 0.2);
    sndExplode = makeWav("explode", 0.15, (t) =>
      (Math.random() * 2 - 1) * (1 - t / 0.15) * 0.35);
    sndDeath = makeWav("death", 0.5, (t) => {
      const freq = 350 - t * 500;
      return Math.sin(2 * Math.PI * Math.max(40, freq) * t) * (1 - t / 0.5) * 0.5;
    });
    sndBomb = makeWav("bomb", 0.3, (t) =>
      (Math.random() * 2 - 1) * Math.sin(2 * Math.PI * 60 * t) * (1 - t / 0.3) * 0.5);
    sndRescue = makeWav("rescue", 0.2, (t) => {
      const freq = 600 + t * 1200;
      return Math.sin(2 * Math.PI * freq * t) * (1 - t / 0.2) * 0.35;
    });
  },

  update(dt) {
    if (state !== "playing") return;

    // Ship controls — thrust toward facing direction
    const ACCEL = 500, MAX_VX = 350, MAX_VY = 250, FRICTION = 0.96;

    if (jove.keyboard.isDown("left")) {
      ship.facing = -1;
      ship.vx -= ACCEL * dt;
    }
    if (jove.keyboard.isDown("right")) {
      ship.facing = 1;
      ship.vx += ACCEL * dt;
    }
    if (jove.keyboard.isDown("up")) ship.vy -= ACCEL * 0.7 * dt;
    if (jove.keyboard.isDown("down")) ship.vy += ACCEL * 0.7 * dt;

    // Friction when not pressing horizontal
    if (!jove.keyboard.isDown("left") && !jove.keyboard.isDown("right")) {
      ship.vx *= Math.pow(FRICTION, dt * 60);
    }
    if (!jove.keyboard.isDown("up") && !jove.keyboard.isDown("down")) {
      ship.vy *= Math.pow(FRICTION, dt * 60);
    }

    // Clamp velocities
    ship.vx = Math.max(-MAX_VX, Math.min(MAX_VX, ship.vx));
    ship.vy = Math.max(-MAX_VY, Math.min(MAX_VY, ship.vy));

    ship.x = wrapX(ship.x + ship.vx * dt);
    ship.y = Math.max(30, Math.min(GROUND_Y - 30, ship.y + ship.vy * dt));

    // Camera follows ship (offset so ship is 1/3 from the facing edge)
    const targetCam = ship.facing > 0 ? ship.x - W * 0.3 : ship.x - W * 0.7;
    cameraX += worldDelta(cameraX, targetCam) * 4 * dt;
    cameraX = wrapX(cameraX);

    // Shoot cooldown
    if (ship.shootCooldown > 0) ship.shootCooldown -= dt;
    if (ship.invulnTimer > 0) ship.invulnTimer -= dt;

    // Spawn enemies
    spawnTimer -= dt;
    if (spawnTimer <= 0 && enemiesRemaining > 0) {
      const roll = Math.random();
      let kind: EnemyKind;
      if (roll < 0.45) kind = "lander";
      else if (roll < 0.65) kind = "bomber";
      else if (roll < 0.85) kind = "mutant";
      else kind = "pod";
      spawnEnemy(kind);
      enemiesRemaining--;
      spawnTimer = Math.max(0.4, 1.5 - levelNum * 0.08);
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x = wrapX(b.x + b.vx * dt);
      b.life -= dt;
      if (b.life <= 0) { bullets.splice(i, 1); continue; }

      // Hit enemy?
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (worldDist(b.x, e.x) < 18 && Math.abs(b.y - e.y) < 14) {
          e.hp--;
          if (e.hp <= 0) killEnemy(ei);
          bullets.splice(i, 1);
          break;
        }
      }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      if (e.kind === "lander") {
        // Move toward target humanoid, descend to abduct
        if (e.target >= 0 && e.target < humanoids.length && !e.abducting) {
          const h = humanoids[e.target];
          if (h.state === "ground") {
            const dx = worldDelta(e.x, h.x);
            e.vx += Math.sign(dx) * 80 * dt;
            e.vx = Math.max(-60, Math.min(60, e.vx));
            // Descend toward humanoid
            if (worldDist(e.x, h.x) < 30) {
              e.vy = 40; // move down
              if (Math.abs(e.y - h.y) < 12) {
                // Grab humanoid
                e.abducting = true;
                h.state = "carried";
                h.carrier = i;
                e.vy = -50; // ascend
              }
            }
          } else {
            e.target = -1; // humanoid gone, roam
          }
        }

        if (e.abducting) {
          e.vy = -45 - levelNum * 3; // carry upward
          // If carried to top, humanoid is lost and lander becomes mutant
          if (e.y < 20) {
            if (e.target >= 0 && e.target < humanoids.length) {
              humanoids[e.target].state = "ground"; // remove by resetting off-screen
              humanoids[e.target].y = -100;
            }
            e.kind = "mutant";
            e.abducting = false;
            e.vx = (Math.random() - 0.5) * 150;
            e.vy = (Math.random() - 0.5) * 80;
          }
        }

        if (!e.abducting && e.target < 0) {
          // Roam
          e.vx += (Math.random() - 0.5) * 100 * dt;
          e.vy += (Math.random() - 0.5) * 60 * dt;
        }
      } else if (e.kind === "mutant") {
        // Aggressively chase player
        const dx = worldDelta(e.x, ship.x);
        const dy = ship.y - e.y;
        e.vx += Math.sign(dx) * 120 * dt;
        e.vy += Math.sign(dy) * 80 * dt;
      } else if (e.kind === "bomber") {
        // Steady horizontal movement, drop mines (just shoot)
        e.vy = Math.sin(Date.now() / 600 + i) * 20;
      } else if (e.kind === "pod") {
        // Drift slowly
        e.vx += (Math.random() - 0.5) * 30 * dt;
        e.vy += (Math.random() - 0.5) * 20 * dt;
      }

      // Clamp velocity
      const maxSpd = e.kind === "mutant" ? 200 : 100;
      e.vx = Math.max(-maxSpd, Math.min(maxSpd, e.vx));
      e.vy = Math.max(-80, Math.min(80, e.vy));

      e.x = wrapX(e.x + e.vx * dt);
      e.y = Math.max(40, Math.min(GROUND_Y - 20, e.y + e.vy * dt));

      // Move carried humanoid with lander
      if (e.kind === "lander" && e.abducting && e.target >= 0 && e.target < humanoids.length) {
        const h = humanoids[e.target];
        h.x = e.x;
        h.y = e.y + 12;
      }

      // Enemy shooting
      if (e.kind !== "pod") {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && worldDist(e.x, ship.x) < W * 0.7) {
          const dx = worldDelta(e.x, ship.x);
          const dy = ship.y - e.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const spd = 200;
          enemyBullets.push({
            x: e.x, y: e.y,
            vx: (dx / len) * spd, vy: (dy / len) * spd,
            life: 1.5,
          });
          e.shootTimer = e.kind === "mutant" ? 0.6 + Math.random() * 0.8 : 1.2 + Math.random() * 1.5;
        }
      }

      // Collide with player
      if (ship.invulnTimer <= 0 && worldDist(e.x, ship.x) < 16 && Math.abs(e.y - ship.y) < 14) {
        killEnemy(i);
        killPlayer();
        if (state === "gameover") return;
      }
    }

    // Update enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x = wrapX(b.x + b.vx * dt);
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.y > GROUND_Y || b.y < 0) { enemyBullets.splice(i, 1); continue; }

      // Hit player?
      if (ship.invulnTimer <= 0 && worldDist(b.x, ship.x) < 14 && Math.abs(b.y - ship.y) < 12) {
        enemyBullets.splice(i, 1);
        killPlayer();
        if (state === "gameover") return;
      }
    }

    // Update humanoids
    for (const h of humanoids) {
      if (h.state === "falling") {
        h.y += 120 * dt;
        const gy = terrainHeight(h.x);
        // Catch by player?
        if (ship.invulnTimer <= 0 && worldDist(h.x, ship.x) < 20 && Math.abs(h.y - ship.y) < 20) {
          h.state = "rescued";
          h.carrier = -1;
          score += 500;
          playPool([], sndRescue, 1);
          sndRescue?.play();
        } else if (h.y >= gy - 8) {
          // Safely landed
          h.y = gy - 8;
          h.groundY = gy;
          h.state = "ground";
        }
      }
      // Rescued humanoids ride on ship temporarily then drop
      if (h.state === "rescued") {
        h.x = ship.x;
        h.y = ship.y + 14;
        // If ship near ground, humanoid disembarks
        if (ship.y > GROUND_Y - 80) {
          h.state = "ground";
          h.groundY = terrainHeight(h.x);
          h.y = h.groundY - 8;
        }
      }
    }

    // Update particles (screen-space)
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Level complete
    if (enemiesRemaining <= 0 && enemies.length === 0) {
      initLevel(levelNum + 1);
    }
  },

  draw() {
    if (state === "title") {
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.printf("DEFENDER", 0, H / 2 - 80, W, "center");
      jove.graphics.setColor(100, 200, 255);
      jove.graphics.printf("Protect the humanoids from alien abduction!", 0, H / 2 - 40, W, "center");
      jove.graphics.setColor(180, 180, 180);
      jove.graphics.printf("Arrow keys to fly, SPACE to shoot", 0, H / 2 + 10, W, "center");
      jove.graphics.printf("Z  Smart bomb   |   ESC  Quit", 0, H / 2 + 40, W, "center");
      jove.graphics.printf("Press ENTER to start", 0, H / 2 + 80, W, "center");
      return;
    }

    // Draw stars (static pattern based on screen + camera)
    jove.graphics.setColor(80, 80, 100);
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 137 + 53) * 7) % W;
      const sy = ((i * 251 + 97) * 3) % (GROUND_Y - 50) + 45;
      jove.graphics.point(sx, sy);
    }

    // Draw terrain
    jove.graphics.setColor(40, 120, 40);
    const segW = WORLD_W / TERRAIN_SEGS;
    for (let sx = -segW; sx < W + segW; sx += segW) {
      const wx = wrapX(cameraX + sx);
      const h = terrainHeight(wx);
      const nextH = terrainHeight(wrapX(wx + segW));
      const x1 = sx, x2 = sx + segW;
      // Draw as filled quad from terrain to bottom
      jove.graphics.polygon("fill", x1, h, x2, nextH, x2, H, x1, H);
    }
    // Terrain surface line
    jove.graphics.setColor(80, 200, 80);
    for (let sx = -segW; sx < W + segW; sx += segW) {
      const wx = wrapX(cameraX + sx);
      const h = terrainHeight(wx);
      const nextH = terrainHeight(wrapX(wx + segW));
      jove.graphics.line(sx, h, sx + segW, nextH);
    }

    // Draw humanoids
    for (const h of humanoids) {
      if (h.y < -50) continue;
      const sx = toScreenX(h.x);
      if (sx < -20 || sx > W + 20) continue;
      if (h.state === "carried") jove.graphics.setColor(255, 100, 100);
      else if (h.state === "rescued") jove.graphics.setColor(100, 255, 255);
      else jove.graphics.setColor(0, 255, 0);
      // Simple stick figure
      jove.graphics.rectangle("fill", sx - 2, h.y - 8, 4, 12);
      jove.graphics.circle("fill", sx, h.y - 10, 3);
    }

    // Draw enemies
    for (const e of enemies) {
      const sx = toScreenX(e.x);
      if (sx < -30 || sx > W + 30) continue;

      if (e.kind === "lander") {
        jove.graphics.setColor(0, 255, 0);
        // Saucer shape
        jove.graphics.ellipse("fill", sx, e.y, 12, 6);
        jove.graphics.setColor(0, 180, 0);
        jove.graphics.ellipse("fill", sx, e.y - 3, 6, 4);
        // Tractor beam when abducting
        if (e.abducting) {
          jove.graphics.setColor(0, 255, 0, 60);
          jove.graphics.polygon("fill", sx - 6, e.y + 5, sx + 6, e.y + 5, sx + 2, e.y + 30, sx - 2, e.y + 30);
        }
      } else if (e.kind === "mutant") {
        jove.graphics.setColor(255, 0, 255);
        jove.graphics.polygon("fill", sx, e.y - 10, sx + 10, e.y, sx + 6, e.y + 8,
          sx - 6, e.y + 8, sx - 10, e.y);
      } else if (e.kind === "bomber") {
        jove.graphics.setColor(255, 50, 50);
        jove.graphics.rectangle("fill", sx - 8, e.y - 5, 16, 10);
        jove.graphics.setColor(200, 0, 0);
        jove.graphics.rectangle("fill", sx - 4, e.y - 8, 8, 4);
      } else { // pod
        jove.graphics.setColor(255, 200, 0);
        jove.graphics.circle("fill", sx, e.y, 10);
        jove.graphics.setColor(200, 150, 0);
        jove.graphics.circle("line", sx, e.y, 10);
      }
    }

    // Draw enemy bullets
    jove.graphics.setColor(255, 100, 100);
    for (const b of enemyBullets) {
      const sx = toScreenX(b.x);
      if (sx < -10 || sx > W + 10) continue;
      jove.graphics.circle("fill", sx, b.y, 2);
    }

    // Draw player bullets
    jove.graphics.setColor(255, 255, 200);
    for (const b of bullets) {
      const sx = toScreenX(b.x);
      if (sx < -10 || sx > W + 10) continue;
      jove.graphics.line(sx, b.y, sx + ship.facing * 8, b.y);
    }

    // Draw ship
    if (ship.invulnTimer <= 0 || Math.floor(ship.invulnTimer * 8) % 2 === 0) {
      const sx = toScreenX(ship.x);
      jove.graphics.setColor(255, 255, 255);
      if (ship.facing > 0) {
        jove.graphics.polygon("fill", sx + 16, sx, sx - 10, sx - 6, sx - 10, sx + 6);
        // Correct: polygon needs x,y pairs
      }
      // Proper ship drawing
      const tip = ship.facing * 16;
      const backX = -ship.facing * 10;
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.polygon("fill",
        sx + tip, ship.y,
        sx + backX, ship.y - 7,
        sx + backX, ship.y + 7,
      );
      // Engine glow
      if (jove.keyboard.isDown(ship.facing > 0 ? "right" : "left")) {
        jove.graphics.setColor(255, 160, 40);
        const exh = -ship.facing * 14;
        jove.graphics.polygon("fill",
          sx + backX, ship.y - 4,
          sx + exh, ship.y,
          sx + backX, ship.y + 4,
        );
      }
    }

    // Draw particles
    for (const p of particles) {
      const alpha = Math.floor((p.life / p.maxLife) * 255);
      jove.graphics.setColor(p.r, p.g, p.b, alpha);
      jove.graphics.circle("fill", p.x, p.y, 2);
    }

    // Minimap background
    jove.graphics.setColor(0, 0, 30, 180);
    jove.graphics.rectangle("fill", MINIMAP_X, MINIMAP_Y, MINIMAP_W, MINIMAP_H);
    jove.graphics.setColor(60, 60, 100);
    jove.graphics.rectangle("line", MINIMAP_X, MINIMAP_Y, MINIMAP_W, MINIMAP_H);

    // Minimap terrain
    jove.graphics.setColor(40, 100, 40);
    for (let i = 0; i < MINIMAP_W; i += 2) {
      const wx = (i / MINIMAP_W) * WORLD_W;
      const h = terrainHeight(wx);
      const mh = ((h - (GROUND_Y - 60)) / 120) * MINIMAP_H;
      jove.graphics.line(MINIMAP_X + i, MINIMAP_Y + MINIMAP_H, MINIMAP_X + i, MINIMAP_Y + MINIMAP_H - Math.max(1, mh));
    }

    // Minimap viewport indicator
    const vpLeft = MINIMAP_X + (wrapX(cameraX) / WORLD_W) * MINIMAP_W;
    const vpWidth = (W / WORLD_W) * MINIMAP_W;
    jove.graphics.setColor(255, 255, 255, 60);
    jove.graphics.rectangle("fill", vpLeft, MINIMAP_Y, vpWidth, MINIMAP_H);

    // Minimap dots: player (white), enemies (colored), humanoids (green)
    const mmDot = (wx: number, wy: number, r: number, g: number, b: number) => {
      const mx = MINIMAP_X + (wrapX(wx) / WORLD_W) * MINIMAP_W;
      const my = MINIMAP_Y + (wy / H) * MINIMAP_H;
      jove.graphics.setColor(r, g, b);
      jove.graphics.rectangle("fill", mx - 1, Math.max(MINIMAP_Y, Math.min(my, MINIMAP_Y + MINIMAP_H - 2)), 2, 2);
    };

    for (const h of humanoids) {
      if (h.y > -50 && h.state !== "rescued") mmDot(h.x, h.y, 0, 255, 0);
    }
    for (const e of enemies) {
      const c: [number, number, number] =
        e.kind === "lander" ? [0, 255, 0] :
        e.kind === "mutant" ? [255, 0, 255] :
        e.kind === "bomber" ? [255, 50, 50] : [255, 200, 0];
      mmDot(e.x, e.y, c[0], c[1], c[2]);
    }
    mmDot(ship.x, ship.y, 255, 255, 255);

    // HUD
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`SCORE: ${score}`, 15, MINIMAP_Y + MINIMAP_H + 8);
    jove.graphics.print(`LEVEL: ${levelNum}`, W - 110, MINIMAP_Y + MINIMAP_H + 8);

    // Lives
    for (let i = 0; i < lives; i++) {
      jove.graphics.setColor(255, 255, 255);
      const lx = 15 + i * 22, ly = MINIMAP_Y + MINIMAP_H + 28;
      jove.graphics.polygon("fill", lx + 10, ly + 4, lx, ly, lx, ly + 8);
    }

    // Smart bombs
    jove.graphics.setColor(255, 100, 100);
    for (let i = 0; i < smartBombs; i++) {
      jove.graphics.circle("fill", W - 100 + i * 18, MINIMAP_Y + MINIMAP_H + 30, 5);
    }

    // Enemies remaining
    jove.graphics.setColor(120, 120, 150);
    const total = enemiesRemaining + enemies.length;
    jove.graphics.printf(`Enemies: ${total}`, 0, MINIMAP_Y + MINIMAP_H + 8, W, "center");

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

    if (key === "space" && ship.shootCooldown <= 0) {
      const BULLET_SPEED = 700;
      bullets.push({
        x: ship.x + ship.facing * 18,
        y: ship.y,
        vx: ship.facing * BULLET_SPEED + ship.vx * 0.3,
        life: 0.6,
      });
      ship.shootCooldown = 0.1;
      playPool(shootPool, sndShoot, 6);
    }

    if (key === "z" && smartBombs > 0) {
      smartBombs--;
      sndBomb?.play();
      // Destroy all enemies on screen
      for (let i = enemies.length - 1; i >= 0; i--) {
        const sx = toScreenX(enemies[i].x);
        if (sx >= -20 && sx <= W + 20) {
          killEnemy(i);
        }
      }
      // Clear enemy bullets on screen
      enemyBullets = enemyBullets.filter(b => {
        const sx = toScreenX(b.x);
        return sx < -20 || sx > W + 20;
      });
    }
  },

  quit() {
    for (const p of wavPaths) { try { unlinkSync(p); } catch {} }
    return false;
  },
});
