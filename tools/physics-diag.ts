// Diagnostic: test Box2D with C-side buffers fix on Windows
// Run: bun tools/physics-diag.ts
import * as jove from "../src/jove/index.ts";

process.on("exit", (code) => {
  console.log(`PROCESS EXIT with code ${code}`);
});

console.log("=== Physics Diagnostic (C-side buffers) ===");

jove.init();
jove.window.setMode(800, 600, { resizable: true });
jove.graphics._createRenderer();
jove.physics._init();

if (!jove.physics.isAvailable()) {
  console.log("FAIL: Box2D not available");
  process.exit(1);
}

const world = jove.physics.newWorld(0, 9.81 * 30);

// Walls
const ground = jove.physics.newBody(world, 400, 590, "static");
jove.physics.newFixture(ground, jove.physics.newRectangleShape(800, 20));
const left = jove.physics.newBody(world, 5, 300, "static");
jove.physics.newFixture(left, jove.physics.newRectangleShape(10, 600));
const right = jove.physics.newBody(world, 795, 300, "static");
jove.physics.newFixture(right, jove.physics.newRectangleShape(10, 600));

// 10 dynamic bodies
const balls: any[] = [];
for (let i = 0; i < 10; i++) {
  const body = jove.physics.newBody(world, 100 + i * 70, 50 + (i % 3) * 40, "dynamic");
  jove.physics.newFixture(body, jove.physics.newCircleShape(15), 1.0);
  balls.push(body);
}

// Enable callbacks (this was crashing before)
let beginCount = 0, hitCount = 0;
world.setCallbacks({
  beginContact() { beginCount++; },
  postSolve() { hitCount++; },
});

let elapsed = 0, frameCount = 0;
console.log("Running game loop with callbacks (30 seconds)...");

jove.run({
  load() { console.log("load() called"); },
  update(dt) {
    world.update(dt);
    elapsed += dt;
    frameCount++;
    if (elapsed > 30) {
      console.log("30 seconds reached, quitting normally");
      jove.event.quit();
    }
    if (frameCount % 120 === 0) {
      console.log(`t=${elapsed.toFixed(1)}s frames=${frameCount} begin=${beginCount} hit=${hitCount} FPS=${jove.timer.getFPS()}`);
    }
  },
  draw() {
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`t=${elapsed.toFixed(1)}s | begin=${beginCount} hit=${hitCount} | FPS=${jove.timer.getFPS()}`, 20, 20);
    jove.graphics.setColor(200, 100, 100);
    for (const b of balls) {
      const [x, y] = b.getPosition();
      jove.graphics.circle("fill", x, y, 15);
    }
    jove.graphics.setColor(80, 80, 80);
    jove.graphics.rectangle("fill", 0, 580, 800, 20);
    jove.graphics.rectangle("fill", 0, 0, 10, 600);
    jove.graphics.rectangle("fill", 790, 0, 10, 600);
  },
});
