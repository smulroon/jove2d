// jove2d Arkanoid — brick breaker with powerups and level layouts

import jove from "../../src/index.ts";
import type { Source } from "../../src/index.ts";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const W = 800, H = 600;
const BRICK_COLS = 12, BRICK_ROWS = 8;
const BRICK_W = 56, BRICK_H = 18;
const FIELD_X = (W - BRICK_COLS * BRICK_W) / 2;
const FIELD_TOP = 60;
const PADDLE_Y = H - 40;
const BALL_R = 5;
const BALL_SPEED = 350;

type GameState = "title" | "playing" | "gameover";

// Brick row colors
const ROW_COLORS: [number, number, number][] = [
  [240, 60, 60], [240, 140, 40], [240, 220, 40], [60, 220, 60],
  [40, 220, 220], [60, 100, 240], [160, 60, 240], [240, 100, 180],
];

interface Ball { x: number; y: number; vx: number; vy: number; }
interface Powerup { x: number; y: number; vy: number; kind: "wide" | "multi" | "life"; }

let state: GameState = "title";
let paddleX = W / 2, paddleW = 80, wideTimer = 0;
let balls: Ball[] = [];
let bricks: number[][] = []; // 0=empty, 1=normal, 2=strong, 3=unbreakable
let powerups: Powerup[] = [];
let score = 0, lives = 3, levelNum = 1;
let serving = true; // ball sits on paddle

// Audio
const wavPaths: string[] = [];
let sndPaddle: Source | null = null;
let sndBrick: Source | null = null;
let sndPowerup: Source | null = null;

function generateWav(dur: number, gen: (t: number, i: number, n: number) => number): Uint8Array {
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
    const s = gen(i / sr, i, ns);
    v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.floor(s * 32767))), true);
  }
  return new Uint8Array(buf);
}

function makeWav(name: string, dur: number, gen: (t: number, i: number, n: number) => number): Source | null {
  const p = join(tmpdir(), `jove2d-arkanoid-${name}.wav`);
  writeFileSync(p, generateWav(dur, gen));
  wavPaths.push(p);
  return jove.audio.newSource(p, "static");
}

// Sound pools
function makePool(src: Source | null): Source[] { return src ? [src] : []; }
let paddlePool: Source[] = [];
let brickPool: Source[] = [];
let powerupPool: Source[] = [];

function playFromPool(pool: Source[], src: Source | null, max: number) {
  for (const s of pool) { if (!s.isPlaying()) { s.play(); return; } }
  if (src && pool.length < max) { const c = src.clone(); pool.push(c); c.play(); }
}

// Level layouts
function makeLayout(num: number): number[][] {
  const grid: number[][] = [];
  for (let r = 0; r < BRICK_ROWS; r++) grid.push(new Array(BRICK_COLS).fill(0));
  const pat = (num - 1) % 6;
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      let hp = 0;
      if (pat === 0) { // stripes
        hp = 1;
      } else if (pat === 1) { // checkerboard
        hp = (r + c) % 2 === 0 ? 1 : 0;
      } else if (pat === 2) { // diamond
        const cx = BRICK_COLS / 2 - 0.5, cy = BRICK_ROWS / 2 - 0.5;
        hp = Math.abs(c - cx) / cx + Math.abs(r - cy) / cy <= 1 ? 1 : 0;
      } else if (pat === 3) { // pyramid
        const half = Math.floor(BRICK_COLS / 2);
        const rowW = Math.floor((r + 1) * half / BRICK_ROWS);
        hp = c >= half - rowW && c < half + rowW ? 1 : 0;
      } else if (pat === 4) { // fortress
        hp = 1;
        if (r >= 2 && r <= 5 && c >= 3 && c <= 8) hp = 0; // hollow center
        if (r === 0 && (c === 0 || c === BRICK_COLS - 1)) hp = 3; // unbreakable corners
        if (r === 0 && c >= 1 && c <= BRICK_COLS - 2) hp = 2;
      } else { // random
        hp = Math.random() < 0.7 ? 1 : 0;
        if (hp === 1 && Math.random() < 0.15) hp = 2;
      }
      // Increase difficulty on higher levels
      if (hp === 1 && num > 2 && Math.random() < 0.1 * (num - 2)) hp = 2;
      grid[r][c] = hp;
    }
  }
  return grid;
}

function breakableCount(): number {
  let count = 0;
  for (const row of bricks) for (const b of row) if (b === 1 || b === 2) count++;
  return count;
}

function resetBall() {
  balls = [{ x: paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0 }];
  serving = true;
}

function launchBall() {
  if (!serving || balls.length === 0) return;
  const angle = (-60 + Math.random() * 120) * Math.PI / 180;
  balls[0].vx = Math.sin(angle) * BALL_SPEED;
  balls[0].vy = -Math.cos(angle) * BALL_SPEED;
  serving = false;
}

function startLevel(num: number) {
  levelNum = num;
  bricks = makeLayout(num);
  powerups = [];
  paddleW = 80;
  wideTimer = 0;
  resetBall();
}

function startGame() {
  score = 0;
  lives = 3;
  startLevel(1);
  state = "playing";
}

function brickRect(r: number, c: number): [number, number, number, number] {
  return [FIELD_X + c * BRICK_W, FIELD_TOP + r * BRICK_H, BRICK_W, BRICK_H];
}

await jove.run({
  load() {
    jove.window.setTitle("jove2d — Arkanoid");
    jove.graphics.setBackgroundColor(15, 15, 40);

    sndPaddle = makeWav("paddle", 0.08, (t) =>
      Math.sin(2 * Math.PI * 600 * t) * (1 - t / 0.08) * 0.4);
    sndBrick = makeWav("brick", 0.06, (t) =>
      Math.sin(2 * Math.PI * 900 * t) * (1 - t / 0.06) * 0.35);
    sndPowerup = makeWav("powerup", 0.2, (t) => {
      const freq = 500 + t * 1500;
      return Math.sin(2 * Math.PI * freq * t) * (1 - t / 0.2) * 0.4;
    });
    paddlePool = makePool(sndPaddle);
    brickPool = makePool(sndBrick);
    powerupPool = makePool(sndPowerup);
  },

  update(dt) {
    if (state !== "playing") return;

    // Paddle movement
    const speed = 400;
    if (jove.keyboard.isDown("left")) paddleX -= speed * dt;
    if (jove.keyboard.isDown("right")) paddleX += speed * dt;
    const halfPW = paddleW / 2;
    paddleX = Math.max(halfPW, Math.min(W - halfPW, paddleX));

    // Wide paddle timer
    if (wideTimer > 0) {
      wideTimer -= dt;
      if (wideTimer <= 0) { paddleW = 80; wideTimer = 0; }
    }

    // Serving — ball follows paddle
    if (serving && balls.length > 0) {
      balls[0].x = paddleX;
      balls[0].y = PADDLE_Y - BALL_R - 1;
      return;
    }

    // Update balls
    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const b = balls[bi];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Wall collisions
      if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
      if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); }
      if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy = Math.abs(b.vy); }

      // Ball lost
      if (b.y > H + 20) {
        balls.splice(bi, 1);
        if (balls.length === 0) {
          lives--;
          if (lives <= 0) {
            state = "gameover";
          } else {
            resetBall();
          }
        }
        continue;
      }

      // Paddle collision
      if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y + BALL_R <= PADDLE_Y + 14 &&
          b.x >= paddleX - halfPW && b.x <= paddleX + halfPW) {
        const offset = (b.x - paddleX) / halfPW; // -1 to 1
        const angle = offset * 60 * Math.PI / 180;
        const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        b.vx = Math.sin(angle) * spd;
        b.vy = -Math.cos(angle) * spd;
        b.y = PADDLE_Y - BALL_R;
        playFromPool(paddlePool, sndPaddle, 4);
      }

      // Brick collision
      for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          if (bricks[r][c] === 0) continue;
          const [bx, by, bw, bh] = brickRect(r, c);
          // AABB vs circle
          const closestX = Math.max(bx, Math.min(b.x, bx + bw));
          const closestY = Math.max(by, Math.min(b.y, by + bh));
          const dx = b.x - closestX, dy = b.y - closestY;
          if (dx * dx + dy * dy < BALL_R * BALL_R) {
            // Determine hit face
            const overlapL = (b.x + BALL_R) - bx;
            const overlapR = (bx + bw) - (b.x - BALL_R);
            const overlapT = (b.y + BALL_R) - by;
            const overlapB = (by + bh) - (b.y - BALL_R);
            const minH = Math.min(overlapL, overlapR);
            const minV = Math.min(overlapT, overlapB);
            if (minH < minV) {
              b.vx = overlapL < overlapR ? -Math.abs(b.vx) : Math.abs(b.vx);
            } else {
              b.vy = overlapT < overlapB ? -Math.abs(b.vy) : Math.abs(b.vy);
            }

            if (bricks[r][c] === 3) {
              // unbreakable — just bounce
            } else {
              bricks[r][c]--;
              if (bricks[r][c] === 0) {
                score += 10 * levelNum;
                // Powerup drop
                if (Math.random() < 0.15) {
                  const kinds: Powerup["kind"][] = ["wide", "multi", "life"];
                  powerups.push({
                    x: bx + bw / 2, y: by + bh / 2, vy: 120,
                    kind: kinds[Math.floor(Math.random() * kinds.length)],
                  });
                }
              }
            }
            playFromPool(brickPool, sndBrick, 6);
            break; // one brick per frame per ball
          }
        }
      }
    }

    // Update powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy * dt;
      if (p.y > H) { powerups.splice(i, 1); continue; }
      // Catch with paddle
      if (p.y + 8 >= PADDLE_Y && p.y - 8 <= PADDLE_Y + 14 &&
          p.x >= paddleX - halfPW && p.x <= paddleX + halfPW) {
        if (p.kind === "wide") { paddleW = 160; wideTimer = 10; }
        else if (p.kind === "multi") {
          const extra: Ball[] = [];
          for (const b of balls) {
            if (extra.length + balls.length >= 12) break;
            extra.push({ x: b.x, y: b.y, vx: b.vx * 0.8 + BALL_SPEED * 0.3, vy: b.vy * 0.8 - BALL_SPEED * 0.3 });
            extra.push({ x: b.x, y: b.y, vx: b.vx * 0.8 - BALL_SPEED * 0.3, vy: b.vy * 0.8 - BALL_SPEED * 0.3 });
          }
          balls.push(...extra);
        }
        else if (p.kind === "life") { lives++; }
        playFromPool(powerupPool, sndPowerup, 3);
        powerups.splice(i, 1);
      }
    }

    // Level clear
    if (breakableCount() === 0) {
      startLevel(levelNum + 1);
    }
  },

  draw() {
    if (state === "title") {
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.printf("ARKANOID", 0, H / 2 - 60, W, "center");
      jove.graphics.setColor(180, 180, 180);
      jove.graphics.printf("Press ENTER to start", 0, H / 2, W, "center");
      jove.graphics.printf("ESC to quit", 0, H / 2 + 30, W, "center");
      return;
    }

    // Playfield border
    jove.graphics.setColor(60, 60, 80);
    jove.graphics.rectangle("line", FIELD_X - 2, FIELD_TOP - 2,
      BRICK_COLS * BRICK_W + 4, H - FIELD_TOP + 4);

    // Draw bricks
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        if (bricks[r][c] === 0) continue;
        const [bx, by, bw, bh] = brickRect(r, c);
        const [cr, cg, cb] = ROW_COLORS[r];
        if (bricks[r][c] === 3) {
          jove.graphics.setColor(80, 80, 90);
        } else {
          jove.graphics.setColor(cr, cg, cb);
        }
        jove.graphics.rectangle("fill", bx + 1, by + 1, bw - 2, bh - 2);
        if (bricks[r][c] === 2) {
          // Silver border for strong bricks
          jove.graphics.setColor(200, 200, 220);
          jove.graphics.rectangle("line", bx + 1, by + 1, bw - 2, bh - 2);
        }
      }
    }

    // Draw powerups
    for (const p of powerups) {
      if (p.kind === "wide") jove.graphics.setColor(0, 220, 0);
      else if (p.kind === "multi") jove.graphics.setColor(60, 120, 255);
      else jove.graphics.setColor(255, 60, 60);
      jove.graphics.rectangle("fill", p.x - 8, p.y - 5, 16, 10);
      jove.graphics.setColor(255, 255, 255);
      const label = p.kind === "wide" ? "W" : p.kind === "multi" ? "M" : "+";
      jove.graphics.print(label, p.x - 3, p.y - 6);
    }

    // Draw paddle
    jove.graphics.setColor(220, 220, 240);
    jove.graphics.rectangle("fill", paddleX - paddleW / 2, PADDLE_Y, paddleW, 12);

    // Draw balls
    jove.graphics.setColor(255, 255, 255);
    for (const b of balls) {
      jove.graphics.circle("fill", b.x, b.y, BALL_R);
    }

    // HUD
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`Score: ${score}`, 10, 10);
    jove.graphics.print(`Level: ${levelNum}`, 10, 28);
    jove.graphics.print(`Lives: ${lives}`, W - 80, 10);

    if (serving && state === "playing") {
      jove.graphics.setColor(180, 180, 180);
      jove.graphics.printf("Press SPACE to launch", 0, H / 2, W, "center");
    }

    // Game over
    if (state === "gameover") {
      jove.graphics.setColor(0, 0, 0, 160);
      jove.graphics.rectangle("fill", W / 2 - 120, H / 2 - 40, 240, 80);
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
    if (state === "playing" && key === "space") launchBall();
  },

  quit() {
    for (const p of wavPaths) { try { unlinkSync(p); } catch {} }
    return false;
  },
});
