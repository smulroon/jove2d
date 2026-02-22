// jove2d physics example — bouncing balls with Box2D
// Click to spawn dynamic circles. Ground + walls as static bodies.
// Left-click = red ball, right-click = blue ball (collision filtering).
// Red and blue balls pass through each other but bounce off same-color balls and walls.

import jove from "../../src/index.ts";

let world: ReturnType<typeof jove.physics.newWorld>;

// Collision categories
const CAT_WALL = 0x0001;
const CAT_RED  = 0x0002;
const CAT_BLUE = 0x0004;
// Red collides with walls + red; blue collides with walls + blue
const MASK_RED  = CAT_WALL | CAT_RED;
const MASK_BLUE = CAT_WALL | CAT_BLUE;

// Track bodies for rendering
interface Ball {
  body: ReturnType<typeof jove.physics.newBody>;
  fixture: ReturnType<typeof jove.physics.newFixture>;
  radius: number;
  color: [number, number, number];
  team: "red" | "blue";
}
const balls: Ball[] = [];
let ground: ReturnType<typeof jove.physics.newBody>;
let wallL: ReturnType<typeof jove.physics.newBody>;
let wallR: ReturnType<typeof jove.physics.newBody>;

const GROUND_Y = 550;
const WALL_THICKNESS = 20;
let contactFlashes: { x: number; y: number; timer: number }[] = [];

const FIXED_DT = 1 / 60;
let accumulator = 0;

// Saved transforms for save/load
let savedTransforms: { x: number; y: number; angle: number }[] | null = null;

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

    // Spawn a few initial balls (alternating red/blue)
    for (let i = 0; i < 5; i++) {
      spawnBall(200 + i * 80, 100 + i * 30, i % 2 === 0 ? "red" : "blue");
    }
  },

  update(dt) {
    accumulator += dt;
    while (accumulator >= FIXED_DT) {
      world.update(FIXED_DT);
      accumulator -= FIXED_DT;
    }

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
    jove.graphics.setColor(255, 120, 120);
    jove.graphics.print("Left-click = red ball", 20, 50);
    jove.graphics.setColor(120, 120, 255);
    jove.graphics.print("Right-click = blue ball", 20, 70);
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("Red/blue pass through each other (collision filter)", 20, 90);
    jove.graphics.print("T = teleport nearest ball to mouse", 20, 110);
    jove.graphics.print("S = save transforms, L = load transforms", 20, 130);
    jove.graphics.print("R = reset", 20, 150);

    if (savedTransforms) {
      jove.graphics.setColor(100, 255, 100);
      jove.graphics.print(`[${savedTransforms.length} transforms saved]`, 20, 170);
    }
  },

  mousepressed(x, y, button) {
    if (button === 1) {
      spawnBall(x, y, "red");
    } else if (button === 3) {
      spawnBall(x, y, "blue");
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
      savedTransforms = null;
    }

    if (key === "t" && balls.length > 0) {
      // Teleport nearest ball to mouse position using setX/setY
      const [mx, my] = jove.mouse.getPosition();
      let nearest = balls[0];
      let bestDist = Infinity;
      for (const ball of balls) {
        const dx = ball.body.getX() - mx;
        const dy = ball.body.getY() - my;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          nearest = ball;
        }
      }
      // Use setX/setY convenience methods
      nearest.body.setX(mx);
      nearest.body.setY(my);
      nearest.body.setLinearVelocity(0, 0);
      nearest.body.setAwake(true);
    }

    if (key === "s") {
      // Save all ball transforms using getTransform
      savedTransforms = balls.map(b => {
        const [x, y, angle] = b.body.getTransform();
        return { x, y, angle };
      });
    }

    if (key === "l" && savedTransforms) {
      // Load saved transforms using setTransform
      const count = Math.min(balls.length, savedTransforms.length);
      for (let i = 0; i < count; i++) {
        const t = savedTransforms[i];
        balls[i].body.setTransform(t.x, t.y, t.angle);
        balls[i].body.setLinearVelocity(0, 0);
        balls[i].body.setAngularVelocity(0);
        balls[i].body.setAwake(true);
      }
    }

    if (key === "escape") {
      jove.event.quit();
    }
  },
});

function spawnBall(x: number, y: number, team: "red" | "blue") {
  const radius = 10 + Math.random() * 20;
  const body = jove.physics.newBody(world, x, y, "dynamic");
  const shape = jove.physics.newCircleShape(radius);
  const fixture = jove.physics.newFixture(body, shape, 1.0);
  fixture.setRestitution(0.3 + Math.random() * 0.5);
  fixture.setFriction(0.3);

  // Set collision filter using individual convenience setters
  if (team === "red") {
    fixture.setCategory(CAT_RED);
    fixture.setMask(MASK_RED);
  } else {
    fixture.setCategory(CAT_BLUE);
    fixture.setMask(MASK_BLUE);
  }

  const color: [number, number, number] = team === "red"
    ? [200 + Math.floor(Math.random() * 55), 60 + Math.floor(Math.random() * 40), 60 + Math.floor(Math.random() * 40)]
    : [60 + Math.floor(Math.random() * 40), 60 + Math.floor(Math.random() * 40), 200 + Math.floor(Math.random() * 55)];

  balls.push({ body, fixture, radius, color, team });
}
