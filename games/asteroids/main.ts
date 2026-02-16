// jove2d Asteroids — ship rotation/thrust, screen wrapping, asteroid splitting, debris

import jove from "../../src/index.ts";
import type { Source } from "../../src/index.ts";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const W = 800, H = 600;

type GameState = "title" | "playing" | "gameover";

interface Asteroid {
  x: number; y: number; vx: number; vy: number;
  radius: number; spin: number; angle: number;
  verts: [number, number][]; // unit-circle offsets, scaled by radius
}

interface Bullet { x: number; y: number; vx: number; vy: number; life: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; }

let state: GameState = "title";

// Ship
let shipX = W / 2, shipY = H / 2, shipAngle = -Math.PI / 2;
let shipVX = 0, shipVY = 0;
let invulnTimer = 0;
let thrusting = false;

// Game objects
let bullets: Bullet[] = [];
let asteroids: Asteroid[] = [];
let particles: Particle[] = [];

let score = 0, lives = 3, levelNum = 1;

// Audio
const wavPaths: string[] = [];
let sndShoot: Source | null = null;
let sndExplode: Source | null = null;
let sndThrust: Source | null = null;
let thrustPlaying = false;

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
  const p = join(tmpdir(), `jove2d-asteroids-${name}.wav`);
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

function wrap(x: number, y: number): [number, number] {
  return [((x % W) + W) % W, ((y % H) + H) % H];
}

function makeAsteroidVerts(numVerts: number): [number, number][] {
  const verts: [number, number][] = [];
  for (let i = 0; i < numVerts; i++) {
    const a = (i / numVerts) * Math.PI * 2;
    const r = 0.7 + Math.random() * 0.6; // 0.7-1.3
    verts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return verts;
}

function spawnAsteroid(x: number, y: number, radius: number): Asteroid {
  const speed = 30 + Math.random() * 60;
  const dir = Math.random() * Math.PI * 2;
  return {
    x, y,
    vx: Math.cos(dir) * speed,
    vy: Math.sin(dir) * speed,
    radius,
    spin: (Math.random() - 0.5) * 2,
    angle: Math.random() * Math.PI * 2,
    verts: makeAsteroidVerts(8 + Math.floor(Math.random() * 5)),
  };
}

function spawnDebris(x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
    const dir = Math.random() * Math.PI * 2;
    const spd = 40 + Math.random() * 100;
    particles.push({
      x, y,
      vx: Math.cos(dir) * spd, vy: Math.sin(dir) * spd,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 0.5 + Math.random() * 0.5,
    });
  }
}

function initLevel(num: number) {
  levelNum = num;
  asteroids = [];
  bullets = [];
  particles = [];
  const count = num + 3;
  for (let i = 0; i < count; i++) {
    // Spawn away from ship
    let ax: number, ay: number;
    do {
      ax = Math.random() * W;
      ay = Math.random() * H;
    } while (Math.hypot(ax - shipX, ay - shipY) < 120);
    asteroids.push(spawnAsteroid(ax, ay, 40));
  }
}

function startGame() {
  score = 0;
  lives = 3;
  shipX = W / 2;
  shipY = H / 2;
  shipVX = 0;
  shipVY = 0;
  shipAngle = -Math.PI / 2;
  invulnTimer = 2;
  initLevel(1);
  state = "playing";
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x1 - x2, y1 - y2);
}

// Wrap-aware distance (check original + 8 wraparound positions)
function wrapDist(x1: number, y1: number, x2: number, y2: number): number {
  let best = Infinity;
  for (const dx of [-W, 0, W]) {
    for (const dy of [-H, 0, H]) {
      best = Math.min(best, dist(x1 + dx, y1 + dy, x2, y2));
    }
  }
  return best;
}

await jove.run({
  load() {
    jove.window.setTitle("jove2d — Asteroids");
    jove.graphics.setBackgroundColor(0, 0, 0);

    sndShoot = makeWav("shoot", 0.08, (t) =>
      Math.sin(2 * Math.PI * 1200 * t) * (1 - t / 0.08) * 0.25);
    sndExplode = makeWav("explode", 0.2, (t) =>
      (Math.random() * 2 - 1) * (1 - t / 0.2) * 0.4);
    sndThrust = makeWav("thrust", 0.5, (t) =>
      Math.sin(2 * Math.PI * 80 * t) * 0.15 * (1 - t / 0.5));
    if (sndThrust) sndThrust.setLooping(true);
  },

  update(dt) {
    if (state !== "playing") return;

    // Ship rotation
    const ROT_SPEED = 4;
    if (jove.keyboard.isDown("left")) shipAngle -= ROT_SPEED * dt;
    if (jove.keyboard.isDown("right")) shipAngle += ROT_SPEED * dt;

    // Thrust
    thrusting = jove.keyboard.isDown("up") || jove.keyboard.isDown("w");
    if (thrusting) {
      const ACCEL = 300;
      shipVX += Math.cos(shipAngle) * ACCEL * dt;
      shipVY += Math.sin(shipAngle) * ACCEL * dt;
      if (sndThrust && !thrustPlaying) { sndThrust.play(); thrustPlaying = true; }
    } else {
      if (sndThrust && thrustPlaying) { sndThrust.stop(); thrustPlaying = false; }
    }

    // Friction
    shipVX *= (1 - 0.02 * dt * 60); // ~0.98 per frame at 60fps
    shipVY *= (1 - 0.02 * dt * 60);

    // Move & wrap ship
    shipX += shipVX * dt;
    shipY += shipVY * dt;
    [shipX, shipY] = wrap(shipX, shipY);

    // Invulnerability
    if (invulnTimer > 0) invulnTimer -= dt;

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      [b.x, b.y] = wrap(b.x, b.y);
      b.life -= dt;
      if (b.life <= 0) { bullets.splice(i, 1); continue; }

      // Hit asteroid?
      for (let ai = asteroids.length - 1; ai >= 0; ai--) {
        const a = asteroids[ai];
        if (wrapDist(b.x, b.y, a.x, a.y) < a.radius) {
          // Split or destroy
          if (a.radius >= 30) {
            // large -> 2 medium
            asteroids.push(spawnAsteroid(a.x, a.y, 20));
            asteroids.push(spawnAsteroid(a.x, a.y, 20));
            score += 20;
          } else if (a.radius >= 15) {
            // medium -> 2 small
            asteroids.push(spawnAsteroid(a.x, a.y, 10));
            asteroids.push(spawnAsteroid(a.x, a.y, 10));
            score += 50;
          } else {
            score += 100;
          }
          spawnDebris(a.x, a.y, Math.floor(a.radius / 3));
          playPool(explodePool, sndExplode, 6);
          asteroids.splice(ai, 1);
          bullets.splice(i, 1);
          break;
        }
      }
    }

    // Update asteroids
    for (const a of asteroids) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      [a.x, a.y] = wrap(a.x, a.y);
      a.angle += a.spin * dt;

      // Collision with ship
      if (invulnTimer <= 0 && wrapDist(shipX, shipY, a.x, a.y) < a.radius + 10) {
        lives--;
        spawnDebris(shipX, shipY, 12);
        sndExplode?.play();
        if (lives <= 0) {
          state = "gameover";
          if (sndThrust && thrustPlaying) { sndThrust.stop(); thrustPlaying = false; }
          return;
        }
        // Respawn
        shipX = W / 2;
        shipY = H / 2;
        shipVX = 0;
        shipVY = 0;
        invulnTimer = 2;
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

    // Level complete
    if (asteroids.length === 0) {
      initLevel(levelNum + 1);
    }
  },

  draw() {
    if (state === "title") {
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.printf("ASTEROIDS", 0, H / 2 - 60, W, "center");
      jove.graphics.setColor(180, 180, 180);
      jove.graphics.printf("Press ENTER to start", 0, H / 2, W, "center");
      jove.graphics.printf("Arrow keys to move, SPACE to shoot", 0, H / 2 + 30, W, "center");
      jove.graphics.printf("ESC to quit", 0, H / 2 + 60, W, "center");
      return;
    }

    // Draw asteroids
    for (const a of asteroids) {
      jove.graphics.setColor(200, 200, 200);
      const coords: number[] = [];
      for (const [vx, vy] of a.verts) {
        const rx = vx * Math.cos(a.angle) - vy * Math.sin(a.angle);
        const ry = vx * Math.sin(a.angle) + vy * Math.cos(a.angle);
        coords.push(a.x + rx * a.radius, a.y + ry * a.radius);
      }
      jove.graphics.polygon("line", ...coords);
    }

    // Draw particles
    for (const p of particles) {
      const alpha = Math.floor((p.life / p.maxLife) * 255);
      jove.graphics.setColor(255, 200, 100, alpha);
      jove.graphics.circle("fill", p.x, p.y, 2);
    }

    // Draw bullets
    jove.graphics.setColor(255, 255, 255);
    for (const b of bullets) {
      jove.graphics.circle("fill", b.x, b.y, 2);
    }

    // Draw ship
    if (state !== "gameover") {
      // Blink when invulnerable
      if (invulnTimer <= 0 || Math.floor(invulnTimer * 8) % 2 === 0) {
        const cos = Math.cos(shipAngle), sin = Math.sin(shipAngle);
        // Ship triangle
        const nx = cos * 14, ny = sin * 14; // nose
        const blx = cos * -10 - sin * 8, bly = sin * -10 + cos * 8; // back-left
        const brx = cos * -10 + sin * 8, bry = sin * -10 - cos * 8; // back-right

        jove.graphics.setColor(255, 255, 255);
        jove.graphics.polygon("line",
          shipX + nx, shipY + ny,
          shipX + blx, shipY + bly,
          shipX + brx, shipY + bry,
        );

        // Thrust flame
        if (thrusting) {
          const fx = cos * -14, fy = sin * -14;
          const flx = cos * -10 - sin * 4, fly = sin * -10 + cos * 4;
          const frx = cos * -10 + sin * 4, fry = sin * -10 - cos * 4;
          jove.graphics.setColor(255, 160, 40);
          jove.graphics.polygon("fill",
            shipX + flx, shipY + fly,
            shipX + fx, shipY + fy,
            shipX + frx, shipY + fry,
          );
        }
      }
    }

    // HUD
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`SCORE: ${score}`, 20, 10);
    jove.graphics.print(`LEVEL: ${levelNum}`, W - 110, 10);

    // Lives as ship icons
    for (let i = 0; i < lives; i++) {
      const lx = 30 + i * 25, ly = 38;
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.polygon("line", lx, ly - 8, lx - 6, ly + 6, lx + 6, ly + 6);
    }

    // Game over
    if (state === "gameover") {
      jove.graphics.setColor(0, 0, 0, 160);
      jove.graphics.rectangle("fill", W / 2 - 130, H / 2 - 40, 260, 80);
      jove.graphics.setColor(255, 80, 80);
      jove.graphics.printf("GAME OVER", 0, H / 2 - 25, W, "center");
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

    if (key === "space" && bullets.length < 8) {
      const BULLET_SPEED = 500;
      bullets.push({
        x: shipX + Math.cos(shipAngle) * 14,
        y: shipY + Math.sin(shipAngle) * 14,
        vx: Math.cos(shipAngle) * BULLET_SPEED + shipVX * 0.3,
        vy: Math.sin(shipAngle) * BULLET_SPEED + shipVY * 0.3,
        life: 1.2,
      });
      playPool(shootPool, sndShoot, 4);
    }
  },

  quit() {
    if (sndThrust && thrustPlaying) { sndThrust.stop(); thrustPlaying = false; }
    for (const p of wavPaths) { try { unlinkSync(p); } catch {} }
    return false;
  },
});
