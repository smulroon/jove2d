// jove2d Berzerk — maze shooter with robots, Evil Otto, and room transitions
// Navigate rooms, shoot robots, avoid walls. Evil Otto is invincible and chases you.

import jove from "../../src/index.ts";
import type { Source } from "../../src/index.ts";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const W = 800, H = 600;

// Room grid
const WALL_T = 4; // wall thickness
const ROOM_COLS = 12, ROOM_ROWS = 8; // internal cell grid per room
const CELL_W = (W - WALL_T * 2) / ROOM_COLS;
const CELL_H = (H - 60 - WALL_T * 2) / ROOM_ROWS; // leave top 60px for HUD
const ROOM_LEFT = WALL_T, ROOM_TOP = 60;
const ROOM_W = ROOM_COLS * CELL_W, ROOM_H = ROOM_ROWS * CELL_H;

// Door positions (center of each wall)
const DOOR_SIZE = 50;

type GameState = "title" | "playing" | "gameover";
type Dir = "up" | "down" | "left" | "right";

interface Player {
  x: number; y: number;
  vx: number; vy: number;
  shootDir: [number, number]; // last aim direction
  shootCooldown: number;
  invulnTimer: number;
}

interface Robot {
  x: number; y: number;
  vx: number; vy: number;
  shootTimer: number;
  speed: number;
  alive: boolean;
}

interface Bullet {
  x: number; y: number;
  vx: number; vy: number;
  isPlayer: boolean;
  life: number;
}

interface Otto {
  x: number; y: number;
  active: boolean;
  timer: number; // time before Otto appears
  speed: number;
}

// Walls stored as line segments
interface Wall { x1: number; y1: number; x2: number; y2: number; }

let state: GameState = "title";
let player: Player;
let robots: Robot[] = [];
let bullets: Bullet[] = [];
let walls: Wall[] = [];
let otto: Otto;
let score = 0, lives = 3, roomNum = 0;
let roomX = 0, roomY = 0; // room coordinates in infinite grid
let robotsKilledInRoom = 0;

// Audio
const wavPaths: string[] = [];
let sndShoot: Source | null = null;
let sndRobotDie: Source | null = null;
let sndPlayerDie: Source | null = null;
let sndOtto: Source | null = null;

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
  const p = join(tmpdir(), `jove2d-berzerk-${name}.wav`);
  writeFileSync(p, generateWav(dur, gen));
  wavPaths.push(p);
  return jove.audio.newSource(p, "static");
}

const shootPool: Source[] = [];
const robotDiePool: Source[] = [];
function playPool(pool: Source[], src: Source | null, max: number) {
  for (const s of pool) { if (!s.isPlaying()) { s.play(); return; } }
  if (src && pool.length < max) { const c = src.clone(); pool.push(c); c.play(); }
}

// Seeded RNG for deterministic room layout from room coordinates
function roomSeed(rx: number, ry: number): () => number {
  let s = (rx * 73856093) ^ (ry * 19349663) ^ 83492791;
  s = (s >>> 0) | 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateRoom(rx: number, ry: number, enterDir: Dir | null) {
  const rng = roomSeed(rx, ry);
  walls = [];
  robots = [];
  bullets = [];
  robotsKilledInRoom = 0;

  // Outer walls with door gaps
  const left = ROOM_LEFT, top = ROOM_TOP;
  const right = left + ROOM_W, bottom = top + ROOM_H;
  const midX = left + ROOM_W / 2, midY = top + ROOM_H / 2;
  const halfDoor = DOOR_SIZE / 2;

  // Top wall (door in center)
  walls.push({ x1: left, y1: top, x2: midX - halfDoor, y2: top });
  walls.push({ x1: midX + halfDoor, y1: top, x2: right, y2: top });
  // Bottom wall
  walls.push({ x1: left, y1: bottom, x2: midX - halfDoor, y2: bottom });
  walls.push({ x1: midX + halfDoor, y1: bottom, x2: right, y2: bottom });
  // Left wall
  walls.push({ x1: left, y1: top, x2: left, y2: midY - halfDoor });
  walls.push({ x1: left, y1: midY + halfDoor, x2: left, y2: bottom });
  // Right wall
  walls.push({ x1: right, y1: top, x2: right, y2: midY - halfDoor });
  walls.push({ x1: right, y1: midY + halfDoor, x2: right, y2: bottom });

  // Internal walls — random horizontal and vertical segments
  const difficulty = Math.min(roomNum, 15);
  const numWalls = 4 + Math.floor(rng() * (3 + difficulty * 0.5));

  for (let i = 0; i < numWalls; i++) {
    const horiz = rng() < 0.5;
    if (horiz) {
      const row = 1 + Math.floor(rng() * (ROOM_ROWS - 2));
      const startCol = Math.floor(rng() * (ROOM_COLS - 2));
      const len = 1 + Math.floor(rng() * 3);
      const endCol = Math.min(startCol + len, ROOM_COLS - 1);
      const wy = top + row * CELL_H;
      const wx1 = left + startCol * CELL_W;
      const wx2 = left + endCol * CELL_W;
      walls.push({ x1: wx1, y1: wy, x2: wx2, y2: wy });
    } else {
      const col = 1 + Math.floor(rng() * (ROOM_COLS - 2));
      const startRow = Math.floor(rng() * (ROOM_ROWS - 2));
      const len = 1 + Math.floor(rng() * 3);
      const endRow = Math.min(startRow + len, ROOM_ROWS - 1);
      const wx = left + col * CELL_W;
      const wy1 = top + startRow * CELL_H;
      const wy2 = top + endRow * CELL_H;
      walls.push({ x1: wx, y1: wy1, x2: wx, y2: wy2 });
    }
  }

  // Spawn robots
  const numRobots = Math.min(3 + Math.floor(roomNum * 0.8), 11);
  const baseSpeed = 40 + Math.min(roomNum * 4, 60);
  for (let i = 0; i < numRobots; i++) {
    let rx2: number, ry2: number;
    // Place in cells, avoiding player spawn area
    for (let attempt = 0; attempt < 20; attempt++) {
      rx2 = left + (1 + Math.floor(rng() * (ROOM_COLS - 2))) * CELL_W + CELL_W / 2;
      ry2 = top + (1 + Math.floor(rng() * (ROOM_ROWS - 2))) * CELL_H + CELL_H / 2;
      // Don't spawn too close to entrance
      const ok = enterDir === null ||
        (enterDir === "left" && rx2 > left + ROOM_W * 0.3) ||
        (enterDir === "right" && rx2 < right - ROOM_W * 0.3) ||
        (enterDir === "up" && ry2 > top + ROOM_H * 0.3) ||
        (enterDir === "down" && ry2 < bottom - ROOM_H * 0.3);
      if (ok) {
        robots.push({
          x: rx2!, y: ry2!, vx: 0, vy: 0,
          shootTimer: 1.5 + rng() * 2,
          speed: baseSpeed + rng() * 20,
          alive: true,
        });
        break;
      }
    }
  }

  // Player position based on entry direction
  const px = enterDir === "left" ? left + 20 : enterDir === "right" ? right - 20 : midX;
  const py = enterDir === "up" ? top + 20 : enterDir === "down" ? bottom - 20 : midY;
  player.x = px;
  player.y = py;
  player.vx = 0;
  player.vy = 0;
  player.shootCooldown = 0;

  // Otto setup — appears after a delay
  otto = {
    x: enterDir === "left" ? right - 40 : enterDir === "right" ? left + 40 :
       rng() < 0.5 ? left + 40 : right - 40,
    y: midY,
    active: false,
    timer: Math.max(8, 18 - roomNum * 0.5),
    speed: 60 + Math.min(roomNum * 3, 40),
  };
}

// Collision: point vs line segment (with thickness)
function pointNearSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number, dist: number): boolean {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1) < dist;
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nearX = x1 + t * dx, nearY = y1 + t * dy;
  return Math.hypot(px - nearX, py - nearY) < dist;
}

function collidesWall(x: number, y: number, radius: number): boolean {
  for (const w of walls) {
    if (pointNearSegment(x, y, w.x1, w.y1, w.x2, w.y2, radius + WALL_T / 2)) return true;
  }
  return false;
}

function startGame() {
  score = 0;
  lives = 3;
  roomNum = 0;
  roomX = 0;
  roomY = 0;
  player = { x: W / 2, y: H / 2, vx: 0, vy: 0, shootDir: [1, 0], shootCooldown: 0, invulnTimer: 2 };
  otto = { x: 0, y: 0, active: false, timer: 15, speed: 60 };
  generateRoom(roomX, roomY, null);
  state = "playing";
}

function killPlayer() {
  lives--;
  sndPlayerDie?.play();
  if (lives <= 0) {
    state = "gameover";
  } else {
    player.invulnTimer = 2;
    player.vx = 0;
    player.vy = 0;
  }
}

function enterRoom(dir: Dir) {
  if (dir === "right") roomX++;
  else if (dir === "left") roomX--;
  else if (dir === "up") roomY--;
  else roomY++;
  roomNum++;

  // Player enters from opposite side
  const enterDir: Dir = dir === "right" ? "left" : dir === "left" ? "right" :
    dir === "up" ? "down" : "up";
  generateRoom(roomX, roomY, enterDir);
}

function checkRoomExit() {
  const left = ROOM_LEFT, top = ROOM_TOP;
  const right = left + ROOM_W, bottom = top + ROOM_H;
  const midX = left + ROOM_W / 2, midY = top + ROOM_H / 2;
  const halfDoor = DOOR_SIZE / 2;

  if (player.x > right + 5 && Math.abs(player.y - midY) < halfDoor) {
    enterRoom("right"); return true;
  }
  if (player.x < left - 5 && Math.abs(player.y - midY) < halfDoor) {
    enterRoom("left"); return true;
  }
  if (player.y < top - 5 && Math.abs(player.x - midX) < halfDoor) {
    enterRoom("up"); return true;
  }
  if (player.y > bottom + 5 && Math.abs(player.x - midY) < halfDoor) {
    enterRoom("down"); return true;
  }
  return false;
}

await jove.run({
  load() {
    jove.window.setTitle("jove2d — Berzerk");
    jove.graphics.setBackgroundColor(0, 0, 0);

    sndShoot = makeWav("shoot", 0.06, (t) =>
      Math.sin(2 * Math.PI * 900 * t) * (1 - t / 0.06) * 0.2);
    sndRobotDie = makeWav("robotdie", 0.12, (t) =>
      (Math.random() * 2 - 1) * (1 - t / 0.12) * 0.3);
    sndPlayerDie = makeWav("playerdie", 0.5, (t) => {
      const freq = 350 - t * 500;
      return Math.sin(2 * Math.PI * Math.max(40, freq) * t) * (1 - t / 0.5) * 0.5;
    });
    sndOtto = makeWav("otto", 0.15, (t) => {
      const freq = 200 + Math.sin(t * 40) * 100;
      return Math.sin(2 * Math.PI * freq * t) * 0.25;
    });
  },

  update(dt) {
    if (state !== "playing") return;

    // Player movement (8-directional)
    const SPEED = 150;
    let dx = 0, dy = 0;
    if (jove.keyboard.isDown("left") || jove.keyboard.isDown("a")) dx -= 1;
    if (jove.keyboard.isDown("right") || jove.keyboard.isDown("d")) dx += 1;
    if (jove.keyboard.isDown("up") || jove.keyboard.isDown("w")) dy -= 1;
    if (jove.keyboard.isDown("down") || jove.keyboard.isDown("s")) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;
      player.shootDir = [dx, dy];
    }

    const newX = player.x + dx * SPEED * dt;
    const newY = player.y + dy * SPEED * dt;

    // Move X and Y independently for wall sliding
    if (!collidesWall(newX, player.y, 8)) player.x = newX;
    if (!collidesWall(player.x, newY, 8)) player.y = newY;

    // Check room exit
    if (checkRoomExit()) return;

    if (player.shootCooldown > 0) player.shootCooldown -= dt;
    if (player.invulnTimer > 0) player.invulnTimer -= dt;

    // Update robots
    for (const r of robots) {
      if (!r.alive) continue;

      // Move toward player with some randomness
      const rdx = player.x - r.x, rdy = player.y - r.y;
      const rdist = Math.sqrt(rdx * rdx + rdy * rdy) || 1;

      // Only move if not too close
      if (rdist > 60) {
        const moveX = (rdx / rdist) * r.speed;
        const moveY = (rdy / rdist) * r.speed;
        const nx = r.x + moveX * dt;
        const ny = r.y + moveY * dt;
        if (!collidesWall(nx, r.y, 10)) r.x = nx;
        if (!collidesWall(r.x, ny, 10)) r.y = ny;
      }

      // Shoot at player
      r.shootTimer -= dt;
      if (r.shootTimer <= 0 && rdist < 400) {
        r.shootTimer = Math.max(0.8, 2.5 - roomNum * 0.08) + Math.random() * 0.5;
        const bspeed = 180 + Math.min(roomNum * 5, 80);
        bullets.push({
          x: r.x, y: r.y,
          vx: (rdx / rdist) * bspeed,
          vy: (rdy / rdist) * bspeed,
          isPlayer: false, life: 2.0,
        });
      }

      // Robot touches player
      if (player.invulnTimer <= 0 && Math.hypot(player.x - r.x, player.y - r.y) < 16) {
        r.alive = false;
        killPlayer();
        if (state === "gameover") return;
      }

      // Robot touches wall — robot dies
      if (collidesWall(r.x, r.y, 6)) {
        r.alive = false;
        score += 50;
        robotsKilledInRoom++;
        playPool(robotDiePool, sndRobotDie, 6);
      }
    }

    // Remove dead robots
    robots = robots.filter(r => r.alive);

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (b.life <= 0 || collidesWall(b.x, b.y, 2)) {
        bullets.splice(i, 1);
        continue;
      }

      if (b.isPlayer) {
        // Hit robot?
        for (const r of robots) {
          if (!r.alive) continue;
          if (Math.hypot(b.x - r.x, b.y - r.y) < 14) {
            r.alive = false;
            score += 50;
            robotsKilledInRoom++;
            playPool(robotDiePool, sndRobotDie, 6);
            bullets.splice(i, 1);
            break;
          }
        }
      } else {
        // Hit player?
        if (player.invulnTimer <= 0 && Math.hypot(b.x - player.x, b.y - player.y) < 10) {
          bullets.splice(i, 1);
          killPlayer();
          if (state === "gameover") return;
        }
        // Hit another robot? (friendly fire)
        for (const r of robots) {
          if (!r.alive) continue;
          if (Math.hypot(b.x - r.x, b.y - r.y) < 14) {
            r.alive = false;
            score += 50;
            robotsKilledInRoom++;
            playPool(robotDiePool, sndRobotDie, 6);
            bullets.splice(i, 1);
            break;
          }
        }
      }
    }

    // Otto countdown
    if (!otto.active) {
      otto.timer -= dt;
      if (otto.timer <= 0) {
        otto.active = true;
        sndOtto?.play();
      }
    }

    // Update Otto — bouncing smiley face, invincible, chases player
    if (otto.active) {
      const odx = player.x - otto.x, ody = player.y - otto.y;
      const odist = Math.sqrt(odx * odx + ody * ody) || 1;
      // Otto ignores walls
      otto.x += (odx / odist) * otto.speed * dt;
      otto.y += (ody / odist) * otto.speed * dt;

      // Otto kills player on contact
      if (player.invulnTimer <= 0 && Math.hypot(player.x - otto.x, player.y - otto.y) < 18) {
        killPlayer();
        if (state === "gameover") return;
      }

      // Otto kills robots it passes through
      for (const r of robots) {
        if (!r.alive) continue;
        if (Math.hypot(otto.x - r.x, otto.y - r.y) < 18) {
          r.alive = false;
          playPool(robotDiePool, sndRobotDie, 6);
        }
      }
    }

    // Bonus: all robots cleared earns room bonus
    // (player must exit through a door to advance)
  },

  draw() {
    if (state === "title") {
      jove.graphics.setColor(255, 255, 0);
      jove.graphics.printf("BERZERK", 0, H / 2 - 80, W, "center");
      jove.graphics.setColor(200, 200, 200);
      jove.graphics.printf("Escape the robot maze!", 0, H / 2 - 40, W, "center");
      jove.graphics.setColor(150, 150, 180);
      jove.graphics.printf("Arrow keys / WASD to move", 0, H / 2 + 10, W, "center");
      jove.graphics.printf("SPACE to shoot (aims in move direction)", 0, H / 2 + 35, W, "center");
      jove.graphics.printf("Exit through doors to advance rooms", 0, H / 2 + 60, W, "center");
      jove.graphics.printf("Beware: Evil Otto is invincible!", 0, H / 2 + 85, W, "center");
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.printf("Press ENTER to start", 0, H / 2 + 120, W, "center");
      return;
    }

    // HUD
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`SCORE: ${score}`, 15, 10);
    jove.graphics.print(`ROOM: ${roomNum + 1}`, W / 2 - 35, 10);
    jove.graphics.print(`LIVES: ${lives}`, W - 100, 10);

    // Lives icons
    for (let i = 0; i < lives; i++) {
      jove.graphics.setColor(0, 200, 255);
      jove.graphics.circle("fill", 20 + i * 18, 42, 5);
    }

    // Otto warning
    if (!otto.active && otto.timer < 5) {
      const blink = Math.floor(otto.timer * 3) % 2 === 0;
      if (blink) {
        jove.graphics.setColor(255, 80, 80);
        jove.graphics.printf("INTRUDER ALERT!", 0, 35, W, "center");
      }
    }

    // Draw walls
    jove.graphics.setColor(0, 0, 255);
    for (const w of walls) {
      // Draw thick wall
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      // Perpendicular normal
      const nx = -dy / len * (WALL_T / 2), ny = dx / len * (WALL_T / 2);
      jove.graphics.polygon("fill",
        w.x1 + nx, w.y1 + ny,
        w.x2 + nx, w.y2 + ny,
        w.x2 - nx, w.y2 - ny,
        w.x1 - nx, w.y1 - ny,
      );
    }

    // Draw robots
    for (const r of robots) {
      if (!r.alive) continue;
      // Body
      jove.graphics.setColor(255, 0, 0);
      jove.graphics.rectangle("fill", r.x - 8, r.y - 10, 16, 20);
      // Head
      jove.graphics.setColor(255, 100, 100);
      jove.graphics.rectangle("fill", r.x - 6, r.y - 14, 12, 6);
      // Eyes
      jove.graphics.setColor(255, 255, 0);
      jove.graphics.rectangle("fill", r.x - 4, r.y - 12, 3, 3);
      jove.graphics.rectangle("fill", r.x + 1, r.y - 12, 3, 3);
      // Arms
      jove.graphics.setColor(255, 0, 0);
      jove.graphics.line(r.x - 8, r.y - 4, r.x - 14, r.y + 4);
      jove.graphics.line(r.x + 8, r.y - 4, r.x + 14, r.y + 4);
    }

    // Draw player
    if (player.invulnTimer <= 0 || Math.floor(player.invulnTimer * 8) % 2 === 0) {
      // Body
      jove.graphics.setColor(0, 200, 255);
      jove.graphics.rectangle("fill", player.x - 6, player.y - 8, 12, 16);
      // Head
      jove.graphics.setColor(0, 255, 255);
      jove.graphics.circle("fill", player.x, player.y - 12, 5);
      // Gun arm (points in shoot direction)
      jove.graphics.setColor(200, 200, 255);
      const [sdx, sdy] = player.shootDir;
      jove.graphics.line(player.x, player.y - 2,
        player.x + sdx * 14, player.y - 2 + sdy * 14);
    }

    // Draw Evil Otto
    if (otto.active) {
      // Bouncing smiley face
      const bounce = Math.abs(Math.sin(Date.now() / 200)) * 6;
      const oy = otto.y - bounce;
      jove.graphics.setColor(255, 200, 0);
      jove.graphics.circle("fill", otto.x, oy, 16);
      // Eyes
      jove.graphics.setColor(0, 0, 0);
      jove.graphics.circle("fill", otto.x - 5, oy - 4, 3);
      jove.graphics.circle("fill", otto.x + 5, oy - 4, 3);
      // Smile — arc approximation with line segments
      for (let a = -0.8; a < 0.8; a += 0.2) {
        const x1 = otto.x + Math.cos(a) * 9;
        const y1 = oy + 2 + Math.sin(a) * 6;
        const x2 = otto.x + Math.cos(a + 0.2) * 9;
        const y2 = oy + 2 + Math.sin(a + 0.2) * 6;
        jove.graphics.line(x1, y1, x2, y2);
      }
    }

    // Draw bullets
    for (const b of bullets) {
      jove.graphics.setColor(b.isPlayer ? 255 : 255, b.isPlayer ? 255 : 80, b.isPlayer ? 255 : 80);
      jove.graphics.circle("fill", b.x, b.y, 3);
    }

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

    if (key === "space" && player.shootCooldown <= 0) {
      const BULLET_SPEED = 350;
      const [sdx, sdy] = player.shootDir;
      bullets.push({
        x: player.x + sdx * 10,
        y: player.y + sdy * 10,
        vx: sdx * BULLET_SPEED,
        vy: sdy * BULLET_SPEED,
        isPlayer: true, life: 1.2,
      });
      player.shootCooldown = 0.2;
      playPool(shootPool, sndShoot, 4);
    }
  },

  quit() {
    for (const p of wavPaths) { try { unlinkSync(p); } catch {} }
    return false;
  },
});
