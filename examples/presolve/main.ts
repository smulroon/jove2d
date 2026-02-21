// jove2d preSolve example — one-way platforms
// Balls land on platforms from above but pass through from below.
// Press Space to launch all balls upward. Click to spawn balls.

import jove from "../../src/index.ts";

let world: ReturnType<typeof jove.physics.newWorld>;

// Track objects
const balls: { body: ReturnType<typeof jove.physics.newBody>; radius: number; color: [number, number, number] }[] = [];

// Platforms: { body, width, height, y } — one-way
const platforms: { body: ReturnType<typeof jove.physics.newBody>; fixture: ReturnType<typeof jove.physics.newFixture>; w: number; h: number }[] = [];

// Ground is solid (not one-way)
let ground: ReturnType<typeof jove.physics.newBody>;
let wallL: ReturnType<typeof jove.physics.newBody>;
let wallR: ReturnType<typeof jove.physics.newBody>;

const GROUND_Y = 580;
const WALL_THICK = 20;
const PLAT_H = 12;

// Platform Y positions
const PLAT_YS = [450, 320, 190];
const PLAT_WIDTHS = [240, 200, 160];
const PLAT_XS = [250, 500, 350];

const FIXED_DT = 1 / 60;
let accumulator = 0;

jove.run({
  load() {
    jove.window.setTitle("jove2d — PreSolve (One-Way Platforms)");

    world = jove.physics.newWorld(0, 9.81 * 30);

    // Solid ground
    ground = jove.physics.newBody(world, 400, GROUND_Y, "static");
    jove.physics.newFixture(ground, jove.physics.newRectangleShape(800, WALL_THICK));

    // Walls
    wallL = jove.physics.newBody(world, 0, 300, "static");
    jove.physics.newFixture(wallL, jove.physics.newRectangleShape(WALL_THICK, 600));
    wallR = jove.physics.newBody(world, 800, 300, "static");
    jove.physics.newFixture(wallR, jove.physics.newRectangleShape(WALL_THICK, 600));

    // One-way platforms
    for (let i = 0; i < PLAT_YS.length; i++) {
      const body = jove.physics.newBody(world, PLAT_XS[i], PLAT_YS[i], "static");
      const shape = jove.physics.newRectangleShape(PLAT_WIDTHS[i], PLAT_H);
      const fixture = jove.physics.newFixture(body, shape);
      fixture.setUserData("oneway");
      fixture.setFriction(0.5);
      platforms.push({ body, fixture, w: PLAT_WIDTHS[i], h: PLAT_H });
    }

    // preSolve callback — disable contact when ball is below the platform
    world.setCallbacks({
      preSolve(contact) {
        const [fA, fB] = contact.getFixtures();
        const udA = fA.getUserData();
        const udB = fB.getUserData();

        // Identify which fixture is the one-way platform
        let platFixture: typeof fA | null = null;
        let ballBody: ReturnType<typeof fA.getBody> | null = null;

        if (udA === "oneway") {
          platFixture = fA;
          ballBody = fB.getBody();
        } else if (udB === "oneway") {
          platFixture = fB;
          ballBody = fA.getBody();
        }

        if (!platFixture || !ballBody) return;

        const [, platY] = platFixture.getBody().getPosition();
        const [, ballY] = ballBody.getPosition();

        // Find the ball's radius
        let ballRadius = 15;
        for (const b of balls) {
          if (b.body === ballBody) {
            ballRadius = b.radius;
            break;
          }
        }

        // Disable contact if ball center is below platform top
        // (ball center Y > platform top Y means ball is below in screen coords)
        if (ballY + ballRadius * 0.3 > platY) {
          contact.setEnabled(false);
        }
      },
    });

    // Spawn initial balls
    for (let i = 0; i < 3; i++) {
      spawnBall(300 + i * 100, 80);
    }
  },

  update(dt) {
    accumulator += dt;
    while (accumulator >= FIXED_DT) {
      world.update(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    // Remove balls that fall off screen
    for (let i = balls.length - 1; i >= 0; i--) {
      const [, by] = balls[i].body.getPosition();
      if (by > 700) {
        balls[i].body.destroy();
        balls.splice(i, 1);
      }
    }
  },

  draw() {
    // Background
    jove.graphics.setBackgroundColor(30, 30, 45);

    // Ground (solid — darker)
    jove.graphics.setColor(80, 80, 80);
    const [gx, gy] = ground.getPosition();
    jove.graphics.rectangle("fill", gx - 400, gy - WALL_THICK / 2, 800, WALL_THICK);

    // Walls
    jove.graphics.setColor(60, 60, 60);
    const [lx, ly] = wallL.getPosition();
    jove.graphics.rectangle("fill", lx - WALL_THICK / 2, ly - 300, WALL_THICK, 600);
    const [rx, ry] = wallR.getPosition();
    jove.graphics.rectangle("fill", rx - WALL_THICK / 2, ry - 300, WALL_THICK, 600);

    // One-way platforms — drawn with upward arrows to indicate direction
    for (const plat of platforms) {
      const [px, py] = plat.body.getPosition();

      // Platform body
      jove.graphics.setColor(100, 180, 100);
      jove.graphics.rectangle("fill", px - plat.w / 2, py - plat.h / 2, plat.w, plat.h);

      // Top edge highlight
      jove.graphics.setColor(140, 220, 140);
      jove.graphics.rectangle("fill", px - plat.w / 2, py - plat.h / 2, plat.w, 3);

      // Upward arrows
      jove.graphics.setColor(60, 130, 60);
      const arrowSpacing = 40;
      const startX = px - plat.w / 2 + 20;
      const endX = px + plat.w / 2 - 20;
      for (let ax = startX; ax <= endX; ax += arrowSpacing) {
        const ay = py;
        jove.graphics.line(ax, ay + 3, ax, ay - 3);
        jove.graphics.line(ax - 3, ay, ax, ay - 3);
        jove.graphics.line(ax + 3, ay, ax, ay - 3);
      }
    }

    // Balls
    for (const ball of balls) {
      const [bx, by] = ball.body.getPosition();
      const angle = ball.body.getAngle();

      jove.graphics.setColor(ball.color[0], ball.color[1], ball.color[2]);
      jove.graphics.circle("fill", bx, by, ball.radius);

      // Direction indicator
      jove.graphics.setColor(255, 255, 255, 180);
      const dx = Math.cos(angle) * ball.radius * 0.6;
      const dy = Math.sin(angle) * ball.radius * 0.6;
      jove.graphics.line(bx, by, bx + dx, by + dy);
    }

    // HUD
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 20, 10);
    jove.graphics.print(`Balls: ${balls.length}`, 20, 30);
    jove.graphics.print("Click to spawn balls", 20, 50);
    jove.graphics.print("Space = launch upward", 20, 70);
    jove.graphics.print("R = reset", 20, 90);

    jove.graphics.setColor(100, 180, 100);
    jove.graphics.print("Green platforms are one-way (pass through from below)", 20, 570);
  },

  mousepressed(x, y, button) {
    if (button === 1) {
      spawnBall(x, y);
    }
  },

  keypressed(key) {
    if (key === "space") {
      // Launch all balls upward
      for (const ball of balls) {
        ball.body.applyLinearImpulse(0, -ball.body.getMass() * 400);
      }
    }
    if (key === "r") {
      for (const ball of balls) {
        ball.body.destroy();
      }
      balls.length = 0;
      for (let i = 0; i < 3; i++) {
        spawnBall(300 + i * 100, 80);
      }
    }
    if (key === "escape") {
      jove.event.quit();
    }
  },
});

function spawnBall(x: number, y: number) {
  const radius = 12 + Math.random() * 10;
  const body = jove.physics.newBody(world, x, y, "dynamic");
  const shape = jove.physics.newCircleShape(radius);
  const fixture = jove.physics.newFixture(body, shape, 1.0);
  fixture.setRestitution(0.1);
  fixture.setFriction(0.3);

  const color: [number, number, number] = [
    120 + Math.floor(Math.random() * 135),
    120 + Math.floor(Math.random() * 135),
    120 + Math.floor(Math.random() * 135),
  ];

  balls.push({ body, radius, color });
}
