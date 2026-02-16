// jove2d Pac-Man — maze chase with ghosts, dots, power pellets, and fruit

import jove from "../../src/index.ts";
import type { Source } from "../../src/index.ts";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const W = 800, H = 600;

// Maze: 28x31 grid (classic layout). '#'=wall, '.'=dot, 'o'=power pellet,
// ' '=empty, '-'=ghost house door, 'G'=ghost house interior
const MAZE_TEMPLATE = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.##### ## #####.######",
  "     #.##### ## #####.#     ",
  "     #.##          ##.#     ",
  "     #.## ###--### ##.#     ",
  "######.## #GGGGGG# ##.######",
  "      .   #GGGGGG#   .      ",
  "######.## #GGGGGG# ##.######",
  "     #.## ######## ##.#     ",
  "     #.##          ##.#     ",
  "     #.## ######## ##.#     ",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......  .......##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

const COLS = 28, ROWS = 31;
const CELL = Math.min(Math.floor((W - 40) / COLS), Math.floor((H - 60) / ROWS));
const MAZE_X = Math.floor((W - COLS * CELL) / 2);
const MAZE_Y = Math.floor((H - ROWS * CELL) / 2) + 15;

type GameState = "title" | "playing" | "dying" | "gameover";
type Dir = "up" | "down" | "left" | "right" | "none";

const DIR_DX: Record<Dir, number> = { up: 0, down: 0, left: -1, right: 1, none: 0 };
const DIR_DY: Record<Dir, number> = { up: -1, down: 1, left: 0, right: 0, none: 0 };
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left", none: "none" };

// Ghost colors
const GHOST_COLORS: [number, number, number][] = [
  [255, 0, 0],     // Blinky (red)
  [255, 184, 255],  // Pinky (pink)
  [0, 255, 255],    // Inky (cyan)
  [255, 184, 82],   // Clyde (orange)
];

// Ghost modes
type GhostMode = "scatter" | "chase" | "frightened" | "eaten";

interface Ghost {
  x: number; y: number;      // grid position (can be fractional during movement)
  gridX: number; gridY: number; // target grid cell
  dir: Dir;
  mode: GhostMode;
  colorIdx: number;
  speed: number;
  scatterTarget: [number, number]; // corner to scatter to
  exitTimer: number; // time before leaving ghost house
}

let state: GameState = "title";
let maze: string[][] = [];
let pacX = 14, pacY = 23, pacDir: Dir = "left", pacNextDir: Dir = "left";
let pacMoveTimer = 0;
const PAC_SPEED = 0.12; // seconds per cell
let pacMouth = 0; // animation: 0-1 cycle

let ghosts: Ghost[] = [];
let ghostModeTimer = 0;
let globalGhostMode: "scatter" | "chase" = "scatter";
let frightenedTimer = 0;
let ghostsEatenCombo = 0;

let dots = 0, totalDots = 0;
let score = 0, lives = 3, levelNum = 1;
let dyingTimer = 0;

// Fruit
let fruitActive = false, fruitTimer = 0;
const FRUIT_X = 14, FRUIT_Y = 17;

// Mode timing: scatter/chase alternation (classic pattern)
const MODE_TIMES = [7, 20, 7, 20, 5, 20, 5]; // scatter, chase, scatter, chase...
let modePhase = 0;

// Audio
const wavPaths: string[] = [];
let sndChomp: Source | null = null;
let sndDeath: Source | null = null;
let sndGhost: Source | null = null;
let sndPower: Source | null = null;
let sndFruit: Source | null = null;

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
  const p = join(tmpdir(), `jove2d-pacman-${name}.wav`);
  writeFileSync(p, generateWav(dur, gen));
  wavPaths.push(p);
  return jove.audio.newSource(p, "static");
}

const chompPool: Source[] = [];
const ghostPool: Source[] = [];
function playPool(pool: Source[], src: Source | null, max: number) {
  for (const s of pool) { if (!s.isPlaying()) { s.play(); return; } }
  if (src && pool.length < max) { const c = src.clone(); pool.push(c); c.play(); }
}

function isWall(gx: number, gy: number): boolean {
  if (gy < 0 || gy >= ROWS) return true;
  // Tunnel wrap
  if (gx < 0 || gx >= COLS) return false;
  const ch = maze[gy][gx];
  return ch === "#" || ch === "-" || ch === "G";
}

function isWallForGhost(gx: number, gy: number, ghost: Ghost): boolean {
  if (gy < 0 || gy >= ROWS) return true;
  if (gx < 0 || gx >= COLS) return false;
  const ch = maze[gy][gx];
  if (ch === "#") return true;
  // Ghosts can pass through door when exiting or eaten
  if (ch === "-") return ghost.mode !== "eaten" && ghost.exitTimer > 0;
  return false;
}

function canMove(gx: number, gy: number, dir: Dir): boolean {
  const nx = gx + DIR_DX[dir];
  const ny = gy + DIR_DY[dir];
  return !isWall(nx, ny);
}

function wrapX(x: number): number {
  if (x < -1) return COLS;
  if (x > COLS) return -1;
  return x;
}

function resetMaze() {
  maze = [];
  dots = 0;
  totalDots = 0;
  for (let r = 0; r < ROWS; r++) {
    maze.push([...MAZE_TEMPLATE[r]]);
    for (let c = 0; c < COLS; c++) {
      if (maze[r][c] === "." || maze[r][c] === "o") totalDots++;
    }
  }
  dots = 0;
}

function resetPositions() {
  pacX = 14; pacY = 23;
  pacDir = "left"; pacNextDir = "left";
  pacMoveTimer = 0;

  ghosts = [
    { x: 14, y: 11, gridX: 14, gridY: 11, dir: "left", mode: "scatter", colorIdx: 0,
      speed: 0.14, scatterTarget: [25, 0], exitTimer: 0 },
    { x: 14, y: 14, gridX: 14, gridY: 14, dir: "up", mode: "scatter", colorIdx: 1,
      speed: 0.14, scatterTarget: [2, 0], exitTimer: 2 },
    { x: 12, y: 14, gridX: 12, gridY: 14, dir: "up", mode: "scatter", colorIdx: 2,
      speed: 0.14, scatterTarget: [27, 30], exitTimer: 5 },
    { x: 16, y: 14, gridX: 16, gridY: 14, dir: "up", mode: "scatter", colorIdx: 3,
      speed: 0.14, scatterTarget: [0, 30], exitTimer: 8 },
  ];

  frightenedTimer = 0;
  ghostsEatenCombo = 0;
  ghostModeTimer = 0;
  modePhase = 0;
  globalGhostMode = "scatter";
}

function initLevel(num: number) {
  levelNum = num;
  resetMaze();
  resetPositions();
  fruitActive = false;
  fruitTimer = 0;
}

function startGame() {
  score = 0;
  lives = 3;
  initLevel(1);
  state = "playing";
}

// Ghost AI: choose direction at intersection
function ghostTarget(g: Ghost): [number, number] {
  if (g.mode === "scatter") return g.scatterTarget;
  if (g.mode === "frightened") {
    // Random target
    return [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)];
  }
  if (g.mode === "eaten") {
    // Return to ghost house
    return [14, 11];
  }

  // Chase mode — each ghost has different targeting
  if (g.colorIdx === 0) {
    // Blinky: directly targets Pac-Man
    return [pacX, pacY];
  } else if (g.colorIdx === 1) {
    // Pinky: targets 4 cells ahead of Pac-Man
    return [pacX + DIR_DX[pacDir] * 4, pacY + DIR_DY[pacDir] * 4];
  } else if (g.colorIdx === 2) {
    // Inky: complex — uses Blinky's position
    const blinky = ghosts[0];
    const ax = pacX + DIR_DX[pacDir] * 2;
    const ay = pacY + DIR_DY[pacDir] * 2;
    return [ax + (ax - Math.floor(blinky.x)), ay + (ay - Math.floor(blinky.y))];
  } else {
    // Clyde: targets Pac-Man if far, scatter corner if close
    const dist = Math.hypot(g.x - pacX, g.y - pacY);
    if (dist > 8) return [pacX, pacY];
    return g.scatterTarget;
  }
}

function updateGhost(g: Ghost, dt: number) {
  // Exit ghost house
  if (g.exitTimer > 0) {
    g.exitTimer -= dt;
    if (g.exitTimer <= 0) {
      // Move up to exit
      g.x = 14; g.y = 11;
      g.gridX = 14; g.gridY = 11;
      g.dir = "left";
    }
    return;
  }

  // Eaten ghost returning to house
  if (g.mode === "eaten" && Math.floor(g.x) === 14 && Math.floor(g.y) === 11) {
    g.mode = globalGhostMode;
  }

  const speed = g.mode === "frightened" ? g.speed * 1.6 : g.mode === "eaten" ? g.speed * 0.6 : g.speed;

  // Move toward current grid target
  const dx = g.gridX - g.x;
  const dy = g.gridY - g.y;
  const dist = Math.abs(dx) + Math.abs(dy);

  if (dist < 0.02) {
    // Arrived at grid cell — choose next direction
    g.x = g.gridX;
    g.y = g.gridY;

    // Tunnel wrap
    g.x = wrapX(g.x);
    g.gridX = g.x;

    const [tx, ty] = ghostTarget(g);
    let bestDir: Dir = g.dir;
    let bestDist = Infinity;

    const dirs: Dir[] = ["up", "left", "down", "right"];
    for (const d of dirs) {
      if (d === OPPOSITE[g.dir]) continue; // can't reverse
      const nx = Math.floor(g.x) + DIR_DX[d];
      const ny = Math.floor(g.y) + DIR_DY[d];
      if (isWallForGhost(nx, ny, g)) continue;
      const dd = Math.hypot(nx - tx, ny - ty);
      if (dd < bestDist) { bestDist = dd; bestDir = d; }
    }

    g.dir = bestDir;
    g.gridX = Math.floor(g.x) + DIR_DX[g.dir];
    g.gridY = Math.floor(g.y) + DIR_DY[g.dir];
  } else {
    // Smooth movement toward grid target
    const step = dt / speed;
    if (Math.abs(dx) > 0.01) g.x += Math.sign(dx) * Math.min(step, Math.abs(dx));
    if (Math.abs(dy) > 0.01) g.y += Math.sign(dy) * Math.min(step, Math.abs(dy));
  }
}

await jove.run({
  load() {
    jove.window.setTitle("jove2d — Pac-Man");
    jove.graphics.setBackgroundColor(0, 0, 0);

    sndChomp = makeWav("chomp", 0.04, (t) =>
      Math.sin(2 * Math.PI * 500 * t) * (1 - t / 0.04) * 0.2);
    sndDeath = makeWav("death", 0.6, (t) => {
      const freq = 600 - t * 800;
      return Math.sin(2 * Math.PI * Math.max(50, freq) * t) * (1 - t / 0.6) * 0.4;
    });
    sndGhost = makeWav("ghost", 0.1, (t) =>
      Math.sin(2 * Math.PI * 300 * t) * (1 - t / 0.1) * 0.25);
    sndPower = makeWav("power", 0.2, (t) => {
      const freq = 200 + t * 800;
      return Math.sin(2 * Math.PI * freq * t) * (1 - t / 0.2) * 0.3;
    });
    sndFruit = makeWav("fruit", 0.15, (t) => {
      const freq = 800 + t * 1200;
      return Math.sin(2 * Math.PI * freq * t) * (1 - t / 0.15) * 0.3;
    });
  },

  update(dt) {
    if (state === "dying") {
      dyingTimer -= dt;
      if (dyingTimer <= 0) {
        if (lives <= 0) { state = "gameover"; }
        else { resetPositions(); state = "playing"; }
      }
      return;
    }
    if (state !== "playing") return;

    // Pac-Man mouth animation
    pacMouth = (pacMouth + dt * 8) % 2;

    // Ghost mode timer (scatter/chase alternation)
    if (frightenedTimer <= 0) {
      ghostModeTimer += dt;
      if (modePhase < MODE_TIMES.length && ghostModeTimer >= MODE_TIMES[modePhase]) {
        ghostModeTimer = 0;
        modePhase++;
        globalGhostMode = modePhase % 2 === 0 ? "scatter" : "chase";
        for (const g of ghosts) {
          if (g.mode !== "frightened" && g.mode !== "eaten" && g.exitTimer <= 0) {
            g.mode = globalGhostMode;
            // Reverse direction on mode change
            g.dir = OPPOSITE[g.dir];
            g.gridX = Math.floor(g.x) + DIR_DX[g.dir];
            g.gridY = Math.floor(g.y) + DIR_DY[g.dir];
          }
        }
      }
    }

    // Frightened timer
    if (frightenedTimer > 0) {
      frightenedTimer -= dt;
      if (frightenedTimer <= 0) {
        for (const g of ghosts) {
          if (g.mode === "frightened") g.mode = globalGhostMode;
        }
        ghostsEatenCombo = 0;
      }
    }

    // Move Pac-Man
    pacMoveTimer += dt;
    const pacSpeed = PAC_SPEED - Math.min(levelNum - 1, 5) * 0.008;
    if (pacMoveTimer >= pacSpeed) {
      pacMoveTimer = 0;

      // Try next direction first
      if (pacNextDir !== "none" && canMove(pacX, pacY, pacNextDir)) {
        pacDir = pacNextDir;
      }
      // Move in current direction
      if (canMove(pacX, pacY, pacDir)) {
        pacX += DIR_DX[pacDir];
        pacY += DIR_DY[pacDir];
        // Tunnel wrap
        if (pacX < 0) pacX = COLS - 1;
        else if (pacX >= COLS) pacX = 0;

        // Eat dot
        if (maze[pacY][pacX] === ".") {
          maze[pacY][pacX] = " ";
          dots++;
          score += 10;
          playPool(chompPool, sndChomp, 4);
        } else if (maze[pacY][pacX] === "o") {
          maze[pacY][pacX] = " ";
          dots++;
          score += 50;
          // Power pellet — frighten ghosts
          frightenedTimer = Math.max(3, 8 - levelNum);
          ghostsEatenCombo = 0;
          for (const g of ghosts) {
            if (g.mode !== "eaten" && g.exitTimer <= 0) {
              g.mode = "frightened";
              g.dir = OPPOSITE[g.dir];
              g.gridX = Math.floor(g.x) + DIR_DX[g.dir];
              g.gridY = Math.floor(g.y) + DIR_DY[g.dir];
            }
          }
          sndPower?.play();
        }
      }

      // Fruit spawn
      if (!fruitActive && (dots === 70 || dots === 170)) {
        fruitActive = true;
        fruitTimer = 10;
      }
    }

    // Fruit timer
    if (fruitActive) {
      fruitTimer -= dt;
      if (fruitTimer <= 0) fruitActive = false;
      // Eat fruit
      if (pacX === FRUIT_X && pacY === FRUIT_Y) {
        score += 100 * levelNum;
        fruitActive = false;
        sndFruit?.play();
      }
    }

    // Update ghosts
    for (const g of ghosts) {
      updateGhost(g, dt);

      // Collision with Pac-Man
      if (g.exitTimer > 0) continue;
      const gdist = Math.hypot(g.x - pacX, g.y - pacY);
      if (gdist < 0.8) {
        if (g.mode === "frightened") {
          // Eat ghost
          g.mode = "eaten";
          ghostsEatenCombo++;
          score += 200 * Math.pow(2, ghostsEatenCombo - 1);
          playPool(ghostPool, sndGhost, 4);
        } else if (g.mode !== "eaten") {
          // Pac-Man dies
          lives--;
          dyingTimer = 1.2;
          state = "dying";
          sndDeath?.play();
          return;
        }
      }
    }

    // Level complete
    if (dots >= totalDots) {
      initLevel(levelNum + 1);
    }
  },

  draw() {
    if (state === "title") {
      jove.graphics.setColor(255, 255, 0);
      jove.graphics.printf("PAC-MAN", 0, H / 2 - 80, W, "center");
      jove.graphics.setColor(200, 200, 200);
      jove.graphics.printf("Arrow keys to move", 0, H / 2 - 20, W, "center");
      jove.graphics.printf("Eat all dots, avoid ghosts!", 0, H / 2 + 10, W, "center");
      jove.graphics.printf("Power pellets let you eat ghosts", 0, H / 2 + 40, W, "center");
      jove.graphics.setColor(255, 255, 255);
      jove.graphics.printf("Press ENTER to start", 0, H / 2 + 80, W, "center");
      jove.graphics.printf("ESC to quit", 0, H / 2 + 110, W, "center");
      return;
    }

    // Draw maze
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const sx = MAZE_X + c * CELL, sy = MAZE_Y + r * CELL;
        const ch = maze[r][c];
        if (ch === "#") {
          jove.graphics.setColor(33, 33, 255);
          jove.graphics.rectangle("fill", sx, sy, CELL, CELL);
          // Inner highlight for depth
          jove.graphics.setColor(60, 60, 255);
          jove.graphics.rectangle("fill", sx + 1, sy + 1, CELL - 2, CELL - 2);
        } else if (ch === "-") {
          jove.graphics.setColor(255, 184, 174);
          jove.graphics.rectangle("fill", sx, sy + CELL / 2 - 1, CELL, 3);
        } else if (ch === ".") {
          jove.graphics.setColor(255, 255, 200);
          const dotR = Math.max(1, CELL / 8);
          jove.graphics.circle("fill", sx + CELL / 2, sy + CELL / 2, dotR);
        } else if (ch === "o") {
          // Power pellet — blink
          if (Math.floor(Date.now() / 250) % 2 === 0) {
            jove.graphics.setColor(255, 255, 200);
            jove.graphics.circle("fill", sx + CELL / 2, sy + CELL / 2, CELL / 3);
          }
        }
      }
    }

    // Draw fruit
    if (fruitActive) {
      const fx = MAZE_X + FRUIT_X * CELL + CELL / 2;
      const fy = MAZE_Y + FRUIT_Y * CELL + CELL / 2;
      jove.graphics.setColor(255, 0, 0);
      jove.graphics.circle("fill", fx, fy, CELL / 3);
      jove.graphics.setColor(0, 180, 0);
      jove.graphics.rectangle("fill", fx - 1, fy - CELL / 3 - 2, 2, 3);
    }

    // Draw Pac-Man
    if (state !== "dying" || Math.floor(dyingTimer * 6) % 2 === 0) {
      const px = MAZE_X + pacX * CELL + CELL / 2;
      const py = MAZE_Y + pacY * CELL + CELL / 2;
      const r = CELL / 2 - 1;

      // Mouth angle
      const mouthAngle = Math.abs(pacMouth - 1) * 0.8; // 0-0.8 radians

      // Direction angle
      const baseAngle = pacDir === "right" ? 0 : pacDir === "down" ? Math.PI / 2 :
        pacDir === "left" ? Math.PI : -Math.PI / 2;

      jove.graphics.setColor(255, 255, 0);

      if (state === "dying") {
        // Death animation — shrinking pac
        const shrink = dyingTimer / 1.2;
        jove.graphics.circle("fill", px, py, r * shrink);
      } else {
        // Draw as filled arc (pie shape with mouth)
        const startAngle = baseAngle + mouthAngle;
        const endAngle = baseAngle + Math.PI * 2 - mouthAngle;
        jove.graphics.arc("fill", px, py, r, startAngle, endAngle, 24, "pie");
      }
    }

    // Draw ghosts
    for (const g of ghosts) {
      if (g.exitTimer > 0 && g.y >= 13 && g.y <= 15) {
        // Draw inside ghost house
      }
      const gx = MAZE_X + g.x * CELL + CELL / 2;
      const gy = MAZE_Y + g.y * CELL + CELL / 2;
      const gr = CELL / 2 - 1;

      if (g.mode === "eaten") {
        // Just eyes
        jove.graphics.setColor(255, 255, 255);
        jove.graphics.circle("fill", gx - gr * 0.3, gy - gr * 0.2, gr * 0.25);
        jove.graphics.circle("fill", gx + gr * 0.3, gy - gr * 0.2, gr * 0.25);
        jove.graphics.setColor(0, 0, 200);
        jove.graphics.circle("fill", gx - gr * 0.3, gy - gr * 0.2, gr * 0.12);
        jove.graphics.circle("fill", gx + gr * 0.3, gy - gr * 0.2, gr * 0.12);
        continue;
      }

      if (g.mode === "frightened") {
        // Flashing when almost done
        if (frightenedTimer < 2 && Math.floor(frightenedTimer * 5) % 2 === 0) {
          jove.graphics.setColor(255, 255, 255);
        } else {
          jove.graphics.setColor(33, 33, 255);
        }
      } else {
        const [cr, cg, cb] = GHOST_COLORS[g.colorIdx];
        jove.graphics.setColor(cr, cg, cb);
      }

      // Ghost body — rounded top + wavy bottom
      jove.graphics.arc("fill", gx, gy - gr * 0.1, gr, Math.PI, 0, 16, "pie");
      jove.graphics.rectangle("fill", gx - gr, gy - gr * 0.1, gr * 2, gr * 0.9);
      // Wavy skirt
      const skirtY = gy + gr * 0.8;
      for (let i = 0; i < 3; i++) {
        const sx = gx - gr + (i * 2 + 1) * gr / 3;
        jove.graphics.circle("fill", sx, skirtY, gr / 3);
      }

      // Eyes
      if (g.mode !== "frightened") {
        jove.graphics.setColor(255, 255, 255);
        jove.graphics.circle("fill", gx - gr * 0.3, gy - gr * 0.25, gr * 0.3);
        jove.graphics.circle("fill", gx + gr * 0.3, gy - gr * 0.25, gr * 0.3);
        // Pupils — look toward pac-man
        const edx = Math.sign(pacX - g.x) * gr * 0.1;
        const edy = Math.sign(pacY - g.y) * gr * 0.1;
        jove.graphics.setColor(0, 0, 200);
        jove.graphics.circle("fill", gx - gr * 0.3 + edx, gy - gr * 0.25 + edy, gr * 0.15);
        jove.graphics.circle("fill", gx + gr * 0.3 + edx, gy - gr * 0.25 + edy, gr * 0.15);
      } else {
        // Frightened face
        jove.graphics.setColor(255, 200, 150);
        jove.graphics.circle("fill", gx - gr * 0.25, gy - gr * 0.2, gr * 0.12);
        jove.graphics.circle("fill", gx + gr * 0.25, gy - gr * 0.2, gr * 0.12);
        // Squiggly mouth
        for (let i = 0; i < 4; i++) {
          const mx = gx - gr * 0.5 + i * gr * 0.3;
          const my = gy + gr * 0.2 + (i % 2 === 0 ? -2 : 2);
          const mx2 = mx + gr * 0.3;
          const my2 = gy + gr * 0.2 + ((i + 1) % 2 === 0 ? -2 : 2);
          jove.graphics.line(mx, my, mx2, my2);
        }
      }
    }

    // HUD
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`SCORE: ${score}`, 15, 6);
    jove.graphics.printf(`LEVEL ${levelNum}`, 0, 6, W, "center");

    // Lives
    for (let i = 0; i < lives; i++) {
      jove.graphics.setColor(255, 255, 0);
      const lx = W - 30 - i * 22, ly = 8;
      jove.graphics.arc("fill", lx, ly + 7, 7, Math.PI * 0.2, Math.PI * 1.8, 12, "pie");
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

    if (key === "left") pacNextDir = "left";
    else if (key === "right") pacNextDir = "right";
    else if (key === "up") pacNextDir = "up";
    else if (key === "down") pacNextDir = "down";
  },

  quit() {
    for (const p of wavPaths) { try { unlinkSync(p); } catch {} }
    return false;
  },
});
