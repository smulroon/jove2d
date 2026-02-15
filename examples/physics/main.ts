// jove2d physics example — bouncing balls with Box2D
// Click to spawn dynamic circles. Ground + walls as static bodies.

import jove from "../../src/index.ts";

let world: ReturnType<typeof jove.physics.newWorld>;

// Track bodies for rendering
const balls: { body: ReturnType<typeof jove.physics.newBody>; radius: number; color: [number, number, number] }[] = [];
let ground: ReturnType<typeof jove.physics.newBody>;
let wallL: ReturnType<typeof jove.physics.newBody>;
let wallR: ReturnType<typeof jove.physics.newBody>;

const GROUND_Y = 550;
const WALL_THICKNESS = 20;
let contactFlashes: { x: number; y: number; timer: number }[] = [];

jove.run({
  load() {
    jove.window.setTitle("jove2d — Physics (Box2D v3)");

    // Create world with gravity (pixels/s²)
    world = jove.physics.newWorld(0, 9.81 * 30);

    // Ground
    ground = jove.physics.newBody(world, 400, GROUND_Y, "static");
    const groundShape = jove.physics.newRectangleShape(800, WALL_THICKNESS);
    jove.physics.newFixture(ground, groundShape);

    // Left wall
    wallL = jove.physics.newBody(world, 0, 300, "static");
    const wallLShape = jove.physics.newRectangleShape(WALL_THICKNESS, 600);
    jove.physics.newFixture(wallL, wallLShape);

    // Right wall
    wallR = jove.physics.newBody(world, 800, 300, "static");
    const wallRShape = jove.physics.newRectangleShape(WALL_THICKNESS, 600);
    jove.physics.newFixture(wallR, wallRShape);

    // Contact callback — flash on collision
    world.setCallbacks({
      beginContact(_contact) {
        const [fA, fB] = _contact.getFixtures();
        const bA = fA.getBody();
        const bB = fB.getBody();
        // Flash at midpoint of the two bodies
        const [ax, ay] = bA.getPosition();
        const [bx, by] = bB.getPosition();
        contactFlashes.push({ x: (ax + bx) / 2, y: (ay + by) / 2, timer: 0.15 });
      },
    });

    // Spawn a few initial balls
    for (let i = 0; i < 5; i++) {
      spawnBall(200 + i * 80, 100 + i * 30);
    }
  },

  update(dt) {
    world.update(dt);

    // Fade contact flashes
    for (let i = contactFlashes.length - 1; i >= 0; i--) {
      contactFlashes[i].timer -= dt;
      if (contactFlashes[i].timer <= 0) {
        contactFlashes.splice(i, 1);
      }
    }
  },

  draw() {
    // Draw walls (dark gray)
    jove.graphics.setColor(80, 80, 80);
    const [gx, gy] = ground.getPosition();
    jove.graphics.rectangle("fill", gx - 400, gy - WALL_THICKNESS / 2, 800, WALL_THICKNESS);
    const [lx, ly] = wallL.getPosition();
    jove.graphics.rectangle("fill", lx - WALL_THICKNESS / 2, ly - 300, WALL_THICKNESS, 600);
    const [rx, ry] = wallR.getPosition();
    jove.graphics.rectangle("fill", rx - WALL_THICKNESS / 2, ry - 300, WALL_THICKNESS, 600);

    // Draw balls
    for (const ball of balls) {
      const [bx, by] = ball.body.getPosition();
      const angle = ball.body.getAngle();

      jove.graphics.setColor(ball.color[0], ball.color[1], ball.color[2]);
      jove.graphics.circle("fill", bx, by, ball.radius);

      // Direction indicator
      jove.graphics.setColor(255, 255, 255, 180);
      const dx = Math.cos(angle) * ball.radius * 0.7;
      const dy = Math.sin(angle) * ball.radius * 0.7;
      jove.graphics.line(bx, by, bx + dx, by + dy);
    }

    // Draw contact flashes
    for (const flash of contactFlashes) {
      const alpha = Math.floor((flash.timer / 0.15) * 255);
      jove.graphics.setColor(255, 255, 100, alpha);
      jove.graphics.circle("fill", flash.x, flash.y, 8);
    }

    // HUD
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 20, 10);
    jove.graphics.print(`Bodies: ${balls.length}`, 20, 30);
    jove.graphics.print("Click to spawn balls", 20, 50);
    jove.graphics.print("Press R to reset", 20, 70);
  },

  mousepressed(x, y, button) {
    if (button === 1) {
      spawnBall(x, y);
    }
  },

  keypressed(key) {
    if (key === "r") {
      // Remove all balls
      for (const ball of balls) {
        ball.body.destroy();
      }
      balls.length = 0;
      contactFlashes.length = 0;
    }
    if (key === "escape") {
      jove.event.quit();
    }
  },
});

function spawnBall(x: number, y: number) {
  const radius = 10 + Math.random() * 20;
  const body = jove.physics.newBody(world, x, y, "dynamic");
  const shape = jove.physics.newCircleShape(radius);
  const fixture = jove.physics.newFixture(body, shape, 1.0);
  fixture.setRestitution(0.3 + Math.random() * 0.5);
  fixture.setFriction(0.3);

  // Random color
  const color: [number, number, number] = [
    100 + Math.floor(Math.random() * 155),
    100 + Math.floor(Math.random() * 155),
    100 + Math.floor(Math.random() * 155),
  ];

  balls.push({ body, radius, color });
}
