// jove2d Blocks — classic falling-block puzzle
// 7-bag randomizer, DAS, lock delay, ghost piece, line clear animation

import jove from "../../src/index.ts";
import type { Source } from "../../src/index.ts";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const W = 800, H = 600;
const COLS = 10, ROWS = 22, VISIBLE = 20;
const CELL = 26;
const BOARD_X = (W - COLS * CELL) / 2;
const BOARD_Y = (H - VISIBLE * CELL) / 2;

type GameState = "title" | "playing" | "gameover";

// Piece definitions: [rotations][cells] — each cell is [row, col] offset
const PIECES = [
  // I
  [[[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]], [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]]],
  // O
  [[[0,0],[0,1],[1,0],[1,1]], [[0,0],[0,1],[1,0],[1,1]], [[0,0],[0,1],[1,0],[1,1]], [[0,0],[0,1],[1,0],[1,1]]],
  // T
  [[[0,1],[1,0],[1,1],[1,2]], [[0,0],[1,0],[1,1],[2,0]], [[0,0],[0,1],[0,2],[1,1]], [[0,1],[1,0],[1,1],[2,1]]],
  // S
  [[[0,1],[0,2],[1,0],[1,1]], [[0,0],[1,0],[1,1],[2,1]], [[0,1],[0,2],[1,0],[1,1]], [[0,0],[1,0],[1,1],[2,1]]],
  // Z
  [[[0,0],[0,1],[1,1],[1,2]], [[0,1],[1,0],[1,1],[2,0]], [[0,0],[0,1],[1,1],[1,2]], [[0,1],[1,0],[1,1],[2,0]]],
  // J
  [[[0,0],[1,0],[1,1],[1,2]], [[0,0],[0,1],[1,0],[2,0]], [[0,0],[0,1],[0,2],[1,2]], [[0,1],[1,1],[2,0],[2,1]]],
  // L
  [[[0,2],[1,0],[1,1],[1,2]], [[0,0],[1,0],[2,0],[2,1]], [[0,0],[0,1],[0,2],[1,0]], [[0,0],[0,1],[1,1],[2,1]]],
];

// Colors per piece type (index 1-7 stored in board)
const COLORS: [number, number, number][] = [
  [0, 240, 240],   // I - cyan
  [240, 240, 0],   // O - yellow
  [160, 0, 240],   // T - purple
  [0, 240, 0],     // S - green
  [240, 0, 0],     // Z - red
  [0, 0, 240],     // J - blue
  [240, 160, 0],   // L - orange
];

// State
let state: GameState = "title";
let board: number[][] = [];
let curType = 0, curRot = 0, curX = 0, curY = 0;
let nextType = 0;
let bag: number[] = [];
let dropTimer = 0, dropInterval = 1.0;
let dasTimer = 0, dasDir = 0, dasActive = false;
const DAS_DELAY = 0.17, DAS_REPEAT = 0.05;
let lockTimer = 0, onGround = false;
const LOCK_DELAY = 0.5;
let softDrop = false;
let clearLines: number[] = [];
let clearTimer = 0;
const CLEAR_FLASH = 0.3;
let score = 0, level = 1, lines = 0;

// Audio
const wavPaths: string[] = [];
let sndClear: Source | null = null;
let sndLock: Source | null = null;
let sndGameOver: Source | null = null;

function generateWav(durationSec: number, genSample: (t: number, i: number, total: number) => number): Uint8Array {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;
  const buf = new ArrayBuffer(fileSize);
  const v = new DataView(buf);
  v.setUint32(0, 0x52494646, false); // RIFF
  v.setUint32(4, fileSize - 8, true);
  v.setUint32(8, 0x57415645, false); // WAVE
  v.setUint32(12, 0x666d7420, false); // fmt
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  v.setUint32(36, 0x64617461, false); // data
  v.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const s = genSample(t, i, numSamples);
    v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.floor(s * 32767))), true);
  }
  return new Uint8Array(buf);
}

function makeWav(name: string, dur: number, gen: (t: number, i: number, n: number) => number): Source | null {
  const p = join(tmpdir(), `jove2d-blocks-${name}.wav`);
  writeFileSync(p, generateWav(dur, gen));
  wavPaths.push(p);
  return jove.audio.newSource(p, "static");
}

// Sound pool for frequently-played sounds
const lockPool: Source[] = [];
function playLock() {
  for (const s of lockPool) {
    if (!s.isPlaying()) { s.play(); return; }
  }
  if (sndLock && lockPool.length < 6) {
    const c = sndLock.clone();
    lockPool.push(c);
    c.play();
  }
}

const clearPool: Source[] = [];
function playClear() {
  for (const s of clearPool) {
    if (!s.isPlaying()) { s.play(); return; }
  }
  if (sndClear && clearPool.length < 4) {
    const c = sndClear.clone();
    clearPool.push(c);
    c.play();
  }
}

function shuffleBag(): number[] {
  const a = [0, 1, 2, 3, 4, 5, 6];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextFromBag(): number {
  if (bag.length === 0) bag = shuffleBag();
  return bag.pop()!;
}

function resetBoard() {
  board = [];
  for (let r = 0; r < ROWS; r++) {
    board.push(new Array(COLS).fill(0));
  }
}

function cells(type: number, rot: number): [number, number][] {
  return PIECES[type][rot] as [number, number][];
}

function fits(type: number, rot: number, x: number, y: number): boolean {
  for (const [dr, dc] of cells(type, rot)) {
    const r = y + dr, c = x + dc;
    if (c < 0 || c >= COLS || r >= ROWS) return false;
    if (r >= 0 && board[r][c] !== 0) return false;
  }
  return true;
}

function lockPiece() {
  for (const [dr, dc] of cells(curType, curRot)) {
    const r = curY + dr, c = curX + dc;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      board[r][c] = curType + 1;
    }
  }
  // Check for line clears
  clearLines = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(c => c !== 0)) {
      clearLines.push(r);
    }
  }
  if (clearLines.length > 0) {
    clearTimer = CLEAR_FLASH;
    const pts = [0, 100, 300, 500, 800][clearLines.length] ?? 800;
    score += pts * level;
    lines += clearLines.length;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(0.05, 1.0 - (level - 1) * 0.08);
    playClear();
  } else {
    playLock();
    spawnPiece();
  }
}

function collapseLines() {
  for (const r of clearLines.sort((a, b) => a - b)) {
    board.splice(r, 1);
    board.unshift(new Array(COLS).fill(0));
  }
  clearLines = [];
  spawnPiece();
}

function spawnPiece() {
  curType = nextType;
  nextType = nextFromBag();
  curRot = 0;
  curX = 3;
  curY = 0;
  dropTimer = 0;
  lockTimer = 0;
  onGround = false;
  softDrop = false;
  if (!fits(curType, curRot, curX, curY)) {
    state = "gameover";
    sndGameOver?.play();
  }
}

function ghostY(): number {
  let gy = curY;
  while (fits(curType, curRot, curX, gy + 1)) gy++;
  return gy;
}

function tryRotate(dir: number) {
  const newRot = (curRot + dir + 4) % 4;
  // Try offsets: 0, -1, +1
  for (const dx of [0, -1, 1]) {
    if (fits(curType, newRot, curX + dx, curY)) {
      curRot = newRot;
      curX += dx;
      if (onGround) lockTimer = 0; // reset lock delay on rotate
      return;
    }
  }
}

function moveHoriz(dir: number) {
  if (fits(curType, curRot, curX + dir, curY)) {
    curX += dir;
    if (onGround) lockTimer = 0; // reset lock delay on move
  }
}

function hardDrop() {
  let dropped = 0;
  while (fits(curType, curRot, curX, curY + 1)) {
    curY++;
    dropped++;
  }
  score += dropped * 2;
  lockPiece();
}

function startGame() {
  resetBoard();
  bag = shuffleBag();
  nextType = nextFromBag();
  score = 0;
  level = 1;
  lines = 0;
  dropInterval = 1.0;
  clearLines = [];
  clearTimer = 0;
  dasTimer = 0;
  dasDir = 0;
  dasActive = false;
  spawnPiece();
  state = "playing";
}

function drawCell(x: number, y: number, colorIdx: number, alpha: number = 255) {
  const [r, g, b] = COLORS[colorIdx - 1];
  jove.graphics.setColor(r, g, b, alpha);
  jove.graphics.rectangle("fill", x + 1, y + 1, CELL - 2, CELL - 2);
  // lighter border
  jove.graphics.setColor(Math.min(255, r + 60), Math.min(255, g + 60), Math.min(255, b + 60), alpha);
  jove.graphics.rectangle("line", x + 1, y + 1, CELL - 2, CELL - 2);
}

await jove.run({
  load() {
    jove.window.setTitle("jove2d — Blocks");
    jove.graphics.setBackgroundColor(20, 20, 30);

    // Generate sounds
    sndClear = makeWav("clear", 0.3, (t) => {
      const freq = 400 + t * 2000;
      return Math.sin(2 * Math.PI * freq * t) * (1 - t / 0.3) * 0.5;
    });
    sndLock = makeWav("lock", 0.08, (t) => {
      return Math.sin(2 * Math.PI * 150 * t) * (1 - t / 0.08) * 0.4;
    });
    sndGameOver = makeWav("gameover", 0.6, (t) => {
      const freq = 400 - t * 500;
      return Math.sin(2 * Math.PI * Math.max(50, freq) * t) * (1 - t / 0.6) * 0.5;
    });
  },

  update(dt) {
    if (state !== "playing") return;

    // Line clear animation
    if (clearTimer > 0) {
      clearTimer -= dt;
      if (clearTimer <= 0) {
        collapseLines();
      }
      return;
    }

    // DAS (Delayed Auto Shift)
    if (dasDir !== 0) {
      dasTimer += dt;
      if (!dasActive && dasTimer >= DAS_DELAY) {
        dasActive = true;
        dasTimer = 0;
        moveHoriz(dasDir);
      } else if (dasActive && dasTimer >= DAS_REPEAT) {
        dasTimer = 0;
        moveHoriz(dasDir);
      }
    }

    // Gravity
    const speed = softDrop ? dropInterval / 15 : dropInterval;
    dropTimer += dt;
    if (dropTimer >= speed) {
      dropTimer = 0;
      if (fits(curType, curRot, curX, curY + 1)) {
        curY++;
        if (softDrop) score += 1;
        onGround = false;
        lockTimer = 0;
      } else {
        onGround = true;
      }
    }

    // Lock delay
    if (onGround) {
      lockTimer += dt;
      if (lockTimer >= LOCK_DELAY) {
        lockPiece();
      }
    }
  },

  draw() {
    if (state === "title") {
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.printf("BLOCKS", 0, H / 2 - 60, W, "center");
      jove.graphics.setColor(180, 180, 180);
      jove.graphics.printf("Press ENTER to start", 0, H / 2, W, "center");
      jove.graphics.printf("ESC to quit", 0, H / 2 + 30, W, "center");
      return;
    }

    // Draw board background
    jove.graphics.setColor(40, 40, 50);
    jove.graphics.rectangle("fill", BOARD_X, BOARD_Y, COLS * CELL, VISIBLE * CELL);

    // Grid lines
    jove.graphics.setColor(50, 50, 65);
    for (let c = 1; c < COLS; c++) {
      jove.graphics.line(BOARD_X + c * CELL, BOARD_Y, BOARD_X + c * CELL, BOARD_Y + VISIBLE * CELL);
    }
    for (let r = 1; r < VISIBLE; r++) {
      jove.graphics.line(BOARD_X, BOARD_Y + r * CELL, BOARD_X + COLS * CELL, BOARD_Y + r * CELL);
    }

    // Board border
    jove.graphics.setColor(100, 100, 120);
    jove.graphics.rectangle("line", BOARD_X, BOARD_Y, COLS * CELL, VISIBLE * CELL);

    // Draw locked cells (skip top 2 hidden rows)
    for (let r = 2; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== 0) {
          const flash = clearLines.includes(r) && clearTimer > 0;
          if (flash) {
            const blink = Math.floor(clearTimer * 20) % 2 === 0;
            if (blink) {
              jove.graphics.setColor(255, 255, 255);
              jove.graphics.rectangle("fill", BOARD_X + c * CELL + 1, BOARD_Y + (r - 2) * CELL + 1, CELL - 2, CELL - 2);
            }
          } else {
            drawCell(BOARD_X + c * CELL, BOARD_Y + (r - 2) * CELL, board[r][c]);
          }
        }
      }
    }

    if (state === "playing" && clearTimer <= 0) {
      // Ghost piece
      const gy = ghostY();
      for (const [dr, dc] of cells(curType, curRot)) {
        const r = gy + dr - 2, c = curX + dc;
        if (r >= 0) {
          drawCell(BOARD_X + c * CELL, BOARD_Y + r * CELL, curType + 1, 50);
        }
      }

      // Current piece
      for (const [dr, dc] of cells(curType, curRot)) {
        const r = curY + dr - 2, c = curX + dc;
        if (r >= 0) {
          drawCell(BOARD_X + c * CELL, BOARD_Y + r * CELL, curType + 1);
        }
      }
    }

    // Next piece preview
    const previewX = BOARD_X + COLS * CELL + 30;
    const previewY = BOARD_Y + 10;
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("NEXT", previewX, previewY);
    jove.graphics.setColor(50, 50, 65);
    jove.graphics.rectangle("fill", previewX, previewY + 20, 4 * CELL, 4 * CELL);
    jove.graphics.setColor(80, 80, 100);
    jove.graphics.rectangle("line", previewX, previewY + 20, 4 * CELL, 4 * CELL);
    for (const [dr, dc] of cells(nextType, 0)) {
      drawCell(previewX + dc * CELL + CELL / 2, previewY + 20 + dr * CELL + CELL / 2, nextType + 1);
    }

    // Score panel
    const panelX = previewX;
    let py = previewY + 140;
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("SCORE", panelX, py);
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print(`${score}`, panelX, py + 18);
    py += 50;
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("LEVEL", panelX, py);
    jove.graphics.setColor(100, 255, 100);
    jove.graphics.print(`${level}`, panelX, py + 18);
    py += 50;
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("LINES", panelX, py);
    jove.graphics.setColor(100, 200, 255);
    jove.graphics.print(`${lines}`, panelX, py + 18);

    // Controls
    const ctrlX = BOARD_X - 150;
    jove.graphics.setColor(120, 120, 140);
    jove.graphics.print("LEFT/RIGHT Move", ctrlX, BOARD_Y + 10);
    jove.graphics.print("UP  Rotate", ctrlX, BOARD_Y + 28);
    jove.graphics.print("DOWN  Soft drop", ctrlX, BOARD_Y + 46);
    jove.graphics.print("SPACE  Hard drop", ctrlX, BOARD_Y + 64);
    jove.graphics.print("ESC  Quit", ctrlX, BOARD_Y + 82);

    // Game over overlay
    if (state === "gameover") {
      jove.graphics.setColor(0, 0, 0, 160);
      jove.graphics.rectangle("fill", BOARD_X, BOARD_Y + VISIBLE * CELL / 2 - 40, COLS * CELL, 80);
      jove.graphics.setColor(255, 80, 80);
      jove.graphics.printf("GAME OVER", BOARD_X, BOARD_Y + VISIBLE * CELL / 2 - 25, COLS * CELL, "center");
      jove.graphics.setColor(200, 200, 200);
      jove.graphics.printf("ENTER to restart", BOARD_X, BOARD_Y + VISIBLE * CELL / 2 + 5, COLS * CELL, "center");
    }
  },

  keypressed(key) {
    if (key === "escape") {
      jove.event.quit();
      return;
    }
    if (key === "return") {
      if (state === "title" || state === "gameover") {
        startGame();
      }
      return;
    }
    if (state !== "playing" || clearTimer > 0) return;

    if (key === "left") {
      moveHoriz(-1);
      dasDir = -1;
      dasTimer = 0;
      dasActive = false;
    } else if (key === "right") {
      moveHoriz(1);
      dasDir = 1;
      dasTimer = 0;
      dasActive = false;
    } else if (key === "up") {
      tryRotate(1);
    } else if (key === "down") {
      softDrop = true;
    } else if (key === "space") {
      hardDrop();
    }
  },

  keyreleased(key) {
    if (key === "left" && dasDir === -1) { dasDir = 0; dasActive = false; }
    if (key === "right" && dasDir === 1) { dasDir = 0; dasActive = false; }
    if (key === "down") softDrop = false;
  },

  quit() {
    for (const p of wavPaths) { try { unlinkSync(p); } catch {} }
    return false;
  },
});
