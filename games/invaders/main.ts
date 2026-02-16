// jove2d Space Invaders — alien grid, destructible shields, scoring, levels

import jove from "../../src/index.ts";
import type { Source } from "../../src/index.ts";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const W = 800, H = 600;
const ALIEN_COLS = 11, ALIEN_ROWS = 5;
const ALIEN_W = 32, ALIEN_H = 24, ALIEN_GAP_X = 12, ALIEN_GAP_Y = 10;
const GRID_W = ALIEN_COLS * (ALIEN_W + ALIEN_GAP_X) - ALIEN_GAP_X;

type GameState = "title" | "playing" | "gameover";

// Alien colors by row (top→bottom): magenta, cyan, green, yellow, yellow
const ALIEN_COLORS: [number, number, number][] = [
  [240, 60, 240], [60, 220, 240], [60, 240, 60], [240, 240, 60], [240, 240, 60],
];
const ROW_POINTS = [30, 20, 20, 10, 10];

interface Bullet { x: number; y: number; vy: number; }
interface ShieldBlock { x: number; y: number; hp: number; }

let state: GameState = "title";

// Player
let playerX = W / 2;
const PLAYER_Y = H - 50, PLAYER_SPEED = 250;
let lives = 3;
let shootCooldown = 0;

// Aliens
let aliens: boolean[] = []; // alive/dead flat array [row*COLS+col]
let alienBaseX = 0, alienBaseY = 0;
let alienDir = 1; // 1=right, -1=left
let alienMoveTimer = 0, alienMoveInterval = 0.6;
let alienStepDown = false;
let alienShootTimer = 0, alienShootInterval = 1.5;

// Bullets
let playerBullets: Bullet[] = [];
let alienBullets: Bullet[] = [];

// Shields
let shields: ShieldBlock[][] = [];
const SHIELD_BLOCK_SIZE = 6;
const SHIELD_Y = H - 130;

// Score
let score = 0, highScore = 0, levelNum = 1;

// Death flash
let deathFlash = 0;

// Audio
const wavPaths: string[] = [];
let sndShoot: Source | null = null;
let sndExplode: Source | null = null;
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
  const p = join(tmpdir(), `jove2d-invaders-${name}.wav`);
  writeFileSync(p, generateWav(dur, gen));
  wavPaths.push(p);
  return jove.audio.newSource(p, "static");
}

// Sound pools
const shootPool: Source[] = [];
const explodePool: Source[] = [];
function playPool(pool: Source[], src: Source | null, max: number) {
  for (const s of pool) { if (!s.isPlaying()) { s.play(); return; } }
  if (src && pool.length < max) { const c = src.clone(); pool.push(c); c.play(); }
}

function aliensAlive(): number {
  let count = 0;
  for (const a of aliens) if (a) count++;
  return count;
}

function alienPos(idx: number): [number, number] {
  const row = Math.floor(idx / ALIEN_COLS), col = idx % ALIEN_COLS;
  return [
    alienBaseX + col * (ALIEN_W + ALIEN_GAP_X),
    alienBaseY + row * (ALIEN_H + ALIEN_GAP_Y),
  ];
}

function makeShield(cx: number): ShieldBlock[] {
  const blocks: ShieldBlock[] = [];
  const w = 7, h = 5; // grid of blocks
  const startX = cx - (w * SHIELD_BLOCK_SIZE) / 2;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      // Cut out bottom-center notch
      if (r >= 3 && c >= 2 && c <= 4) continue;
      blocks.push({ x: startX + c * SHIELD_BLOCK_SIZE, y: SHIELD_Y + r * SHIELD_BLOCK_SIZE, hp: 3 });
    }
  }
  return blocks;
}

function initLevel(num: number) {
  levelNum = num;
  aliens = new Array(ALIEN_ROWS * ALIEN_COLS).fill(true);
  alienBaseX = (W - GRID_W) / 2;
  alienBaseY = 80;
  alienDir = 1;
  alienMoveTimer = 0;
  alienMoveInterval = Math.max(0.1, 0.6 - (num - 1) * 0.05);
  alienStepDown = false;
  alienShootTimer = 0;
  alienShootInterval = Math.max(0.5, 1.5 - (num - 1) * 0.1);
  playerBullets = [];
  alienBullets = [];
  shootCooldown = 0;

  // 4 shields
  shields = [];
  const spacing = W / 5;
  for (let i = 0; i < 4; i++) {
    shields.push(makeShield(spacing * (i + 1)));
  }
}

function startGame() {
  score = 0;
  lives = 3;
  playerX = W / 2;
  deathFlash = 0;
  initLevel(1);
  state = "playing";
}

function getBottomAliens(): number[] {
  // For each column, find the lowest alive alien
  const bottom: number[] = [];
  for (let c = 0; c < ALIEN_COLS; c++) {
    for (let r = ALIEN_ROWS - 1; r >= 0; r--) {
      if (aliens[r * ALIEN_COLS + c]) {
        bottom.push(r * ALIEN_COLS + c);
        break;
      }
    }
  }
  return bottom;
}

await jove.run({
  load() {
    jove.window.setTitle("jove2d — Space Invaders");
    jove.graphics.setBackgroundColor(0, 0, 0);

    sndShoot = makeWav("shoot", 0.1, (t) =>
      Math.sin(2 * Math.PI * 880 * t) * (1 - t / 0.1) * 0.3);
    sndExplode = makeWav("explode", 0.15, (t) =>
      (Math.random() * 2 - 1) * (1 - t / 0.15) * 0.4);
    sndDeath = makeWav("death", 0.4, (t) => {
      const freq = 400 - t * 800;
      return Math.sin(2 * Math.PI * Math.max(50, freq) * t) * (1 - t / 0.4) * 0.5;
    });
  },

  update(dt) {
    if (state !== "playing") return;

    if (deathFlash > 0) {
      deathFlash -= dt;
      if (deathFlash <= 0) {
        playerX = W / 2;
      }
      return;
    }

    // Player movement
    if (jove.keyboard.isDown("left")) playerX -= PLAYER_SPEED * dt;
    if (jove.keyboard.isDown("right")) playerX += PLAYER_SPEED * dt;
    playerX = Math.max(20, Math.min(W - 20, playerX));

    // Shoot cooldown
    if (shootCooldown > 0) shootCooldown -= dt;

    // Alien movement
    alienMoveTimer += dt;
    // Speed up as aliens die
    const alive = aliensAlive();
    const speedMult = 1 + (ALIEN_ROWS * ALIEN_COLS - alive) * 0.02;
    if (alienMoveTimer >= alienMoveInterval / speedMult) {
      alienMoveTimer = 0;
      if (alienStepDown) {
        alienBaseY += ALIEN_H;
        alienStepDown = false;
      } else {
        alienBaseX += alienDir * 10;
        // Check bounds
        let minC = ALIEN_COLS, maxC = -1;
        for (let i = 0; i < aliens.length; i++) {
          if (aliens[i]) {
            const col = i % ALIEN_COLS;
            minC = Math.min(minC, col);
            maxC = Math.max(maxC, col);
          }
        }
        const leftEdge = alienBaseX + minC * (ALIEN_W + ALIEN_GAP_X);
        const rightEdge = alienBaseX + maxC * (ALIEN_W + ALIEN_GAP_X) + ALIEN_W;
        if (rightEdge >= W - 10 || leftEdge <= 10) {
          alienDir = -alienDir;
          alienStepDown = true;
        }
      }
    }

    // Alien shooting
    alienShootTimer += dt;
    if (alienShootTimer >= alienShootInterval && alienBullets.length < 5) {
      alienShootTimer = 0;
      const bottom = getBottomAliens();
      if (bottom.length > 0) {
        const idx = bottom[Math.floor(Math.random() * bottom.length)];
        const [ax, ay] = alienPos(idx);
        alienBullets.push({ x: ax + ALIEN_W / 2, y: ay + ALIEN_H, vy: 250 });
      }
    }

    // Update player bullets
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const b = playerBullets[i];
      b.y += b.vy * dt;
      if (b.y < -10) { playerBullets.splice(i, 1); continue; }

      // Hit alien?
      let hit = false;
      for (let ai = 0; ai < aliens.length; ai++) {
        if (!aliens[ai]) continue;
        const [ax, ay] = alienPos(ai);
        if (b.x >= ax && b.x <= ax + ALIEN_W && b.y >= ay && b.y <= ay + ALIEN_H) {
          aliens[ai] = false;
          const row = Math.floor(ai / ALIEN_COLS);
          score += ROW_POINTS[row];
          if (score > highScore) highScore = score;
          playPool(explodePool, sndExplode, 6);
          playerBullets.splice(i, 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // Hit shield?
      for (const shield of shields) {
        for (let si = shield.length - 1; si >= 0; si--) {
          const s = shield[si];
          if (b.x >= s.x && b.x <= s.x + SHIELD_BLOCK_SIZE &&
              b.y >= s.y && b.y <= s.y + SHIELD_BLOCK_SIZE) {
            s.hp--;
            if (s.hp <= 0) shield.splice(si, 1);
            playerBullets.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
    }

    // Update alien bullets
    for (let i = alienBullets.length - 1; i >= 0; i--) {
      const b = alienBullets[i];
      b.y += b.vy * dt;
      if (b.y > H + 10) { alienBullets.splice(i, 1); continue; }

      // Hit player?
      if (deathFlash <= 0 && b.y >= PLAYER_Y - 8 && b.y <= PLAYER_Y + 16 &&
          b.x >= playerX - 16 && b.x <= playerX + 16) {
        lives--;
        deathFlash = 1.5;
        sndDeath?.play();
        alienBullets.splice(i, 1);
        if (lives <= 0) {
          state = "gameover";
        }
        continue;
      }

      // Hit shield?
      let hit = false;
      for (const shield of shields) {
        for (let si = shield.length - 1; si >= 0; si--) {
          const s = shield[si];
          if (b.x >= s.x && b.x <= s.x + SHIELD_BLOCK_SIZE &&
              b.y >= s.y && b.y <= s.y + SHIELD_BLOCK_SIZE) {
            s.hp--;
            if (s.hp <= 0) shield.splice(si, 1);
            alienBullets.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
    }

    // Check aliens reaching player row
    for (let i = 0; i < aliens.length; i++) {
      if (!aliens[i]) continue;
      const [, ay] = alienPos(i);
      if (ay + ALIEN_H >= PLAYER_Y - 10) {
        state = "gameover";
        sndDeath?.play();
        return;
      }
    }

    // Level complete
    if (alive === 0) {
      initLevel(levelNum + 1);
    }
  },

  draw() {
    if (state === "title") {
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.printf("SPACE INVADERS", 0, H / 2 - 60, W, "center");
      jove.graphics.setColor(180, 180, 180);
      jove.graphics.printf("Press ENTER to start", 0, H / 2, W, "center");
      jove.graphics.printf("ESC to quit", 0, H / 2 + 30, W, "center");
      return;
    }

    // HUD
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`SCORE: ${score}`, 20, 10);
    jove.graphics.printf(`HI: ${highScore}`, 0, 10, W, "center");
    jove.graphics.print(`LEVEL: ${levelNum}`, W - 120, 10);

    // Lives (ship icons)
    for (let i = 0; i < lives; i++) {
      const lx = 20 + i * 28;
      jove.graphics.setColor(60, 240, 60);
      jove.graphics.polygon("fill", lx, 40, lx - 8, 52, lx + 8, 52);
    }

    // Draw shields
    for (const shield of shields) {
      for (const s of shield) {
        if (s.hp === 3) jove.graphics.setColor(60, 240, 60);
        else if (s.hp === 2) jove.graphics.setColor(240, 240, 60);
        else jove.graphics.setColor(240, 80, 60);
        jove.graphics.rectangle("fill", s.x, s.y, SHIELD_BLOCK_SIZE, SHIELD_BLOCK_SIZE);
      }
    }

    // Draw aliens
    for (let i = 0; i < aliens.length; i++) {
      if (!aliens[i]) continue;
      const row = Math.floor(i / ALIEN_COLS);
      const [ax, ay] = alienPos(i);
      const [cr, cg, cb] = ALIEN_COLORS[row];
      jove.graphics.setColor(cr, cg, cb);
      jove.graphics.rectangle("fill", ax + 2, ay + 2, ALIEN_W - 4, ALIEN_H - 4);
      // Detail: eyes
      jove.graphics.setColor(0, 0, 0);
      jove.graphics.rectangle("fill", ax + 8, ay + 6, 4, 4);
      jove.graphics.rectangle("fill", ax + ALIEN_W - 12, ay + 6, 4, 4);
      // Detail: legs
      jove.graphics.setColor(cr, cg, cb);
      if (row >= 2) {
        jove.graphics.rectangle("fill", ax + 4, ay + ALIEN_H - 2, 4, 4);
        jove.graphics.rectangle("fill", ax + ALIEN_W - 8, ay + ALIEN_H - 2, 4, 4);
      }
    }

    // Draw player
    if (deathFlash <= 0 || Math.floor(deathFlash * 10) % 2 === 0) {
      jove.graphics.setColor(60, 240, 60);
      jove.graphics.polygon("fill",
        playerX, PLAYER_Y - 8,
        playerX - 16, PLAYER_Y + 12,
        playerX + 16, PLAYER_Y + 12,
      );
      jove.graphics.rectangle("fill", playerX - 2, PLAYER_Y - 14, 4, 8);
    }

    // Draw bullets
    jove.graphics.setColor(255, 255, 255);
    for (const b of playerBullets) {
      jove.graphics.rectangle("fill", b.x - 1, b.y, 3, 8);
    }
    jove.graphics.setColor(255, 80, 80);
    for (const b of alienBullets) {
      jove.graphics.rectangle("fill", b.x - 1, b.y, 3, 8);
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
    if (state !== "playing" || deathFlash > 0) return;

    if (key === "space" && shootCooldown <= 0 && playerBullets.length < 3) {
      playerBullets.push({ x: playerX, y: PLAYER_Y - 14, vy: -500 });
      shootCooldown = 0.3;
      playPool(shootPool, sndShoot, 4);
    }
  },

  quit() {
    for (const p of wavPaths) { try { unlinkSync(p); } catch {} }
    return false;
  },
});
