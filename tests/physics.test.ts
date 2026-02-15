import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadBox2D } from "../src/sdl/ffi_box2d.ts";
import * as physics from "../src/jove/physics.ts";

const box2dAvailable = loadBox2D() !== null;

describe("jove.physics", () => {
  if (!box2dAvailable) {
    test.skip("Box2D not available (run 'bun run build-box2d')", () => {});
    return;
  }

  // Initialize physics module
  physics._init();

  let world: physics.World;

  beforeEach(() => {
    physics.setMeter(30); // reset to default
    world = physics.newWorld(0, 9.81 * 30); // gravity in pixels
  });

  afterEach(() => {
    if (!world.isDestroyed()) {
      world.destroy();
    }
  });

  // ── Meter scaling ──────────────────────────────────────────────

  describe("meter scaling", () => {
    test("getMeter returns default", () => {
      expect(physics.getMeter()).toBe(30);
    });

    test("setMeter changes scale", () => {
      physics.setMeter(64);
      expect(physics.getMeter()).toBe(64);
    });

    test("setMeter rejects non-positive", () => {
      expect(() => physics.setMeter(0)).toThrow();
      expect(() => physics.setMeter(-1)).toThrow();
    });
  });

  // ── World ──────────────────────────────────────────────────────

  describe("World", () => {
    test("create and destroy", () => {
      expect(world.isDestroyed()).toBe(false);
      world.destroy();
      expect(world.isDestroyed()).toBe(true);
    });

    test("gravity get/set", () => {
      const [gx, gy] = world.getGravity();
      expect(gx).toBeCloseTo(0, 1);
      expect(gy).toBeCloseTo(9.81 * 30, 0);

      world.setGravity(0, 0);
      const [gx2, gy2] = world.getGravity();
      expect(gx2).toBeCloseTo(0, 1);
      expect(gy2).toBeCloseTo(0, 1);
    });

    test("getBodyCount", () => {
      expect(world.getBodyCount()).toBeGreaterThanOrEqual(0);
      const body = physics.newBody(world, 0, 0, "dynamic");
      expect(world.getBodyCount()).toBeGreaterThanOrEqual(1);
      body.destroy();
    });

    test("getBodies returns all bodies", () => {
      const b1 = physics.newBody(world, 0, 0, "static");
      const b2 = physics.newBody(world, 100, 100, "dynamic");
      const bodies = world.getBodies();
      expect(bodies.length).toBe(2);
      b1.destroy();
      b2.destroy();
    });

    test("step with gravity moves body", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const circleShape = physics.newCircleShape(15);
      physics.newFixture(body, circleShape);

      const [, y0] = body.getPosition();
      // Step multiple times
      for (let i = 0; i < 10; i++) {
        world.update(1 / 60);
      }
      const [, y1] = body.getPosition();
      expect(y1).toBeGreaterThan(y0); // should have fallen
    });

    test("setCallbacks for beginContact", () => {
      let contactCount = 0;

      // Create ground
      const ground = physics.newBody(world, 400, 550, "static");
      const groundShape = physics.newRectangleShape(800, 20);
      physics.newFixture(ground, groundShape);

      // Create falling ball
      const ball = physics.newBody(world, 400, 100, "dynamic");
      const circleShape = physics.newCircleShape(15);
      physics.newFixture(ball, circleShape);

      world.setCallbacks({
        beginContact: (_contact) => { contactCount++; },
      });

      // Step until contact
      for (let i = 0; i < 300; i++) {
        world.update(1 / 60);
      }

      expect(contactCount).toBeGreaterThan(0);
    });

    test("destroy cascades to bodies", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(10);
      const fixture = physics.newFixture(body, shape);

      world.destroy();
      expect(body.isDestroyed()).toBe(true);
      expect(fixture.isDestroyed()).toBe(true);
    });
  });

  // ── Body ───────────────────────────────────────────────────────

  describe("Body", () => {
    test("position get/set", () => {
      const body = physics.newBody(world, 100, 200, "static");
      const [x, y] = body.getPosition();
      expect(x).toBeCloseTo(100, 0);
      expect(y).toBeCloseTo(200, 0);

      body.setPosition(300, 400);
      const [x2, y2] = body.getPosition();
      expect(x2).toBeCloseTo(300, 0);
      expect(y2).toBeCloseTo(400, 0);
    });

    test("getX and getY", () => {
      const body = physics.newBody(world, 50, 75, "static");
      expect(body.getX()).toBeCloseTo(50, 0);
      expect(body.getY()).toBeCloseTo(75, 0);
    });

    test("angle get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      body.setAngle(Math.PI / 4);
      expect(body.getAngle()).toBeCloseTo(Math.PI / 4, 2);
    });

    test("velocity get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      body.setLinearVelocity(60, 90); // pixels/sec
      const [vx, vy] = body.getLinearVelocity();
      expect(vx).toBeCloseTo(60, 0);
      expect(vy).toBeCloseTo(90, 0);
    });

    test("angular velocity get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      body.setAngularVelocity(2.0);
      expect(body.getAngularVelocity()).toBeCloseTo(2.0, 1);
    });

    test("type get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      expect(body.getType()).toBe("dynamic");
      body.setType("kinematic");
      expect(body.getType()).toBe("kinematic");
      body.setType("static");
      expect(body.getType()).toBe("static");
    });

    test("bullet get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      expect(body.isBullet()).toBe(false);
      body.setBullet(true);
      expect(body.isBullet()).toBe(true);
    });

    test("active get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      expect(body.isActive()).toBe(true);
      body.setActive(false);
      expect(body.isActive()).toBe(false);
    });

    test("awake get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      expect(body.isAwake()).toBe(true);
      body.setAwake(false);
      expect(body.isAwake()).toBe(false);
    });

    test("fixedRotation get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      expect(body.isFixedRotation()).toBe(false);
      body.setFixedRotation(true);
      expect(body.isFixedRotation()).toBe(true);
    });

    test("sleepingAllowed get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      body.setSleepingAllowed(false);
      expect(body.isSleepingAllowed()).toBe(false);
      body.setSleepingAllowed(true);
      expect(body.isSleepingAllowed()).toBe(true);
    });

    test("gravityScale get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      expect(body.getGravityScale()).toBeCloseTo(1.0);
      body.setGravityScale(0.5);
      expect(body.getGravityScale()).toBeCloseTo(0.5);
    });

    test("linearDamping get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      body.setLinearDamping(0.5);
      expect(body.getLinearDamping()).toBeCloseTo(0.5);
    });

    test("angularDamping get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      body.setAngularDamping(0.3);
      expect(body.getAngularDamping()).toBeCloseTo(0.3);
    });

    test("getMass with fixture", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(15);
      physics.newFixture(body, shape, 1.0);
      expect(body.getMass()).toBeGreaterThan(0);
    });

    test("applyForce doesn't throw", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(15);
      physics.newFixture(body, shape);
      expect(() => body.applyForce(100, 0)).not.toThrow();
      expect(() => body.applyForce(100, 0, 0, 0)).not.toThrow();
    });

    test("applyLinearImpulse doesn't throw", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(15);
      physics.newFixture(body, shape);
      expect(() => body.applyLinearImpulse(100, 0)).not.toThrow();
    });

    test("applyTorque doesn't throw", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(15);
      physics.newFixture(body, shape);
      expect(() => body.applyTorque(10)).not.toThrow();
    });

    test("world/local point conversion", () => {
      const body = physics.newBody(world, 100, 200, "static");
      const [wx, wy] = body.getWorldPoint(0, 0);
      expect(wx).toBeCloseTo(100, 0);
      expect(wy).toBeCloseTo(200, 0);

      const [lx, ly] = body.getLocalPoint(100, 200);
      expect(lx).toBeCloseTo(0, 0);
      expect(ly).toBeCloseTo(0, 0);
    });

    test("getFixtures returns list", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      expect(body.getFixtures()).toHaveLength(0);
      const shape = physics.newCircleShape(10);
      physics.newFixture(body, shape);
      expect(body.getFixtures()).toHaveLength(1);
    });

    test("userData get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      expect(body.getUserData()).toBeNull();
      body.setUserData({ name: "test" });
      expect(body.getUserData()).toEqual({ name: "test" });
    });

    test("destroy", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      body.destroy();
      expect(body.isDestroyed()).toBe(true);
    });
  });

  // ── Shapes ─────────────────────────────────────────────────────

  describe("Shapes", () => {
    test("newCircleShape", () => {
      const shape = physics.newCircleShape(20);
      expect(shape.getType()).toBe("circle");
      expect(shape.getRadius()).toBe(20);
    });

    test("newCircleShape with offset", () => {
      const shape = physics.newCircleShape(5, 10, 20);
      expect(shape.getType()).toBe("circle");
      expect(shape.getRadius()).toBe(20);
      expect(shape.getPoints()).toEqual([5, 10]);
    });

    test("newRectangleShape", () => {
      const shape = physics.newRectangleShape(40, 20);
      expect(shape.getType()).toBe("polygon");
      expect(shape.getPoints()).toHaveLength(8); // 4 vertices * 2
    });

    test("newPolygonShape", () => {
      const shape = physics.newPolygonShape(0, -20, 20, 20, -20, 20);
      expect(shape.getType()).toBe("polygon");
      expect(shape.getPoints()).toHaveLength(6);
    });

    test("newEdgeShape", () => {
      const shape = physics.newEdgeShape(0, 0, 100, 0);
      expect(shape.getType()).toBe("edge");
      expect(shape.getPoints()).toEqual([0, 0, 100, 0]);
    });

    test("newChainShape", () => {
      const shape = physics.newChainShape(true, 0, 0, 100, 0, 100, 100, 0, 100);
      expect(shape.getType()).toBe("chain");
      expect(shape.getPoints()).toHaveLength(8);
    });
  });

  // ── Fixtures ───────────────────────────────────────────────────

  describe("Fixtures", () => {
    test("circle fixture creation", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(15);
      const fixture = physics.newFixture(body, shape);
      expect(fixture.isDestroyed()).toBe(false);
      expect(fixture.getBody()).toBe(body);
      expect(fixture.getShape()).toBe(shape);
    });

    test("box fixture creation", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newRectangleShape(30, 20);
      const fixture = physics.newFixture(body, shape);
      expect(fixture.isDestroyed()).toBe(false);
    });

    test("polygon fixture creation", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newPolygonShape(0, -20, 20, 20, -20, 20);
      const fixture = physics.newFixture(body, shape);
      expect(fixture.isDestroyed()).toBe(false);
    });

    test("edge fixture creation", () => {
      const body = physics.newBody(world, 0, 0, "static");
      const shape = physics.newEdgeShape(0, 0, 100, 0);
      const fixture = physics.newFixture(body, shape);
      expect(fixture.isDestroyed()).toBe(false);
    });

    test("friction get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(10);
      const fixture = physics.newFixture(body, shape);
      fixture.setFriction(0.5);
      expect(fixture.getFriction()).toBeCloseTo(0.5);
    });

    test("restitution get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(10);
      const fixture = physics.newFixture(body, shape);
      fixture.setRestitution(0.8);
      expect(fixture.getRestitution()).toBeCloseTo(0.8);
    });

    test("density get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(10);
      const fixture = physics.newFixture(body, shape, 2.0);
      expect(fixture.getDensity()).toBeCloseTo(2.0);
      fixture.setDensity(3.0);
      expect(fixture.getDensity()).toBeCloseTo(3.0);
    });

    test("sensor at creation", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(10);
      // Non-sensor by default
      const fixture = physics.newFixture(body, shape);
      expect(fixture.isSensor()).toBe(false);
    });

    test("userData get/set", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(10);
      const fixture = physics.newFixture(body, shape);
      fixture.setUserData("hello");
      expect(fixture.getUserData()).toBe("hello");
    });

    test("destroy fixture", () => {
      const body = physics.newBody(world, 0, 0, "dynamic");
      const shape = physics.newCircleShape(10);
      const fixture = physics.newFixture(body, shape);
      fixture.destroy();
      expect(fixture.isDestroyed()).toBe(true);
      expect(body.getFixtures()).toHaveLength(0);
    });
  });

  // ── Joints ─────────────────────────────────────────────────────

  describe("Joints", () => {
    test("distance joint", () => {
      const b1 = physics.newBody(world, 100, 100, "dynamic");
      const s1 = physics.newCircleShape(10);
      physics.newFixture(b1, s1);

      const b2 = physics.newBody(world, 200, 100, "dynamic");
      const s2 = physics.newCircleShape(10);
      physics.newFixture(b2, s2);

      const joint = physics.newDistanceJoint(b1, b2, 100, 100, 200, 100);
      expect(joint.isDestroyed()).toBe(false);
      expect(joint.getType()).toBe("distance");
      const [bodyA, bodyB] = joint.getBodies();
      expect(bodyA).toBe(b1);
      expect(bodyB).toBe(b2);
    });

    test("revolute joint", () => {
      const b1 = physics.newBody(world, 100, 100, "static");
      const b2 = physics.newBody(world, 100, 100, "dynamic");
      const s = physics.newCircleShape(10);
      physics.newFixture(b2, s);

      const joint = physics.newRevoluteJoint(b1, b2, 100, 100);
      expect(joint.getType()).toBe("revolute");
    });

    test("weld joint", () => {
      const b1 = physics.newBody(world, 100, 100, "dynamic");
      const s1 = physics.newCircleShape(10);
      physics.newFixture(b1, s1);

      const b2 = physics.newBody(world, 120, 100, "dynamic");
      const s2 = physics.newCircleShape(10);
      physics.newFixture(b2, s2);

      const joint = physics.newWeldJoint(b1, b2, 110, 100);
      expect(joint.getType()).toBe("weld");
    });

    test("mouse joint", () => {
      const body = physics.newBody(world, 100, 100, "dynamic");
      const s = physics.newCircleShape(10);
      physics.newFixture(body, s);

      const joint = physics.newMouseJoint(body, 100, 100);
      expect(joint.getType()).toBe("mouse");
    });

    test("destroy joint", () => {
      const b1 = physics.newBody(world, 100, 100, "dynamic");
      const s1 = physics.newCircleShape(10);
      physics.newFixture(b1, s1);

      const b2 = physics.newBody(world, 200, 100, "dynamic");
      const s2 = physics.newCircleShape(10);
      physics.newFixture(b2, s2);

      const joint = physics.newDistanceJoint(b1, b2, 100, 100, 200, 100);
      joint.destroy();
      expect(joint.isDestroyed()).toBe(true);
    });
  });

  // ── Queries ────────────────────────────────────────────────────

  describe("Queries", () => {
    test("queryBoundingBox finds fixtures", () => {
      const body = physics.newBody(world, 100, 100, "static");
      const shape = physics.newCircleShape(20);
      const fixture = physics.newFixture(body, shape);

      const found: physics.Fixture[] = [];
      world.queryBoundingBox(50, 50, 150, 150, (f) => {
        found.push(f);
        return true;
      });
      expect(found.length).toBeGreaterThan(0);
      expect(found[0]).toBe(fixture);
    });

    test("rayCast hits fixture", () => {
      const body = physics.newBody(world, 100, 100, "static");
      const shape = physics.newCircleShape(20);
      physics.newFixture(body, shape);

      let hitFixture: physics.Fixture | null = null;
      world.rayCast(0, 100, 200, 100, (fixture, _x, _y, _nx, _ny, _frac) => {
        hitFixture = fixture;
        return 0;
      });
      expect(hitFixture).not.toBeNull();
    });
  });

  // ── newWorld convenience ───────────────────────────────────────

  describe("newWorld", () => {
    test("defaults to zero gravity and sleep enabled", () => {
      const w = physics.newWorld();
      const [gx, gy] = w.getGravity();
      expect(gx).toBeCloseTo(0);
      expect(gy).toBeCloseTo(0);
      w.destroy();
    });
  });
});
