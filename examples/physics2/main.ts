// jove2d Physics Phase 2 example
// Demonstrates: WheelJoint (car), MotorJoint (tracker), joint anchors,
// reaction force, contact point + approach speed
// Hard-coded motor offset for stabilization comparison

import jove from "../../src/index.ts";

let world: ReturnType<typeof jove.physics.newWorld>;
let ground: ReturnType<typeof jove.physics.newBody>;
let rampBody: ReturnType<typeof jove.physics.newBody>;
let chassis: ReturnType<typeof jove.physics.newBody>;
let wheelL: ReturnType<typeof jove.physics.newBody>;
let wheelR: ReturnType<typeof jove.physics.newBody>;
let wheelJointL: ReturnType<typeof jove.physics.newWheelJoint>;
let wheelJointR: ReturnType<typeof jove.physics.newWheelJoint>;
let trackerAnchor: ReturnType<typeof jove.physics.newBody>;
let trackerBody: ReturnType<typeof jove.physics.newBody>;
let motorJoint: ReturnType<typeof jove.physics.newMotorJoint>;

const GROUND_Y = 450;
const CAR_X = 200;
const CAR_Y = 380;

// Hard-coded motor target offset (relative to anchor at 600,200)
const TARGET_X = 700;
const TARGET_Y = 350;

// Contact flash at exact point with intensity
const flashes: { x: number; y: number; speed: number; timer: number }[] = [];

// Track driving state for HUD
let driving = 0;

// Elapsed timer
let elapsed = 0;

const FIXED_DT = 1 / 60;
let accumulator = 0;

await jove.run({
  load() {
    jove.window.setTitle("Physics Phase 2 — jove2d");
    jove.graphics.setBackgroundColor(20, 20, 30);

    jove.physics.setMeter(30);
    world = jove.physics.newWorld(0, 9.81 * 30);

    // Contact callback with point + speed
    world.setCallbacks({
      postSolve(contact, normalImpulse, _tangentImpulse) {
        const [px, py] = contact.getPositions();
        const speed = contact.getNormalImpulse();
        if (speed > 0.5) {
          flashes.push({ x: px, y: py, speed: Math.min(speed, 20), timer: 0.3 });
        }
      },
    });

    // Ground (flat)
    ground = jove.physics.newBody(world, 400, GROUND_Y, "static");
    const groundShape = jove.physics.newRectangleShape(800, 20);
    jove.physics.newFixture(ground, groundShape, 1);

    // Ramp
    rampBody = jove.physics.newBody(world, 500, GROUND_Y - 30, "static");
    const rampShape = jove.physics.newPolygonShape(-80, 30, 80, 30, 80, -10);
    const rampFix = jove.physics.newFixture(rampBody, rampShape, 1);
    rampFix.setFriction(0.8);

    // === Car with WheelJoints ===
    // Chassis
    chassis = jove.physics.newBody(world, CAR_X, CAR_Y, "dynamic");
    const chassisShape = jove.physics.newRectangleShape(80, 20);
    const chassisFix = jove.physics.newFixture(chassis, chassisShape, 2);
    chassisFix.setFriction(0.3);

    // Left wheel
    wheelL = jove.physics.newBody(world, CAR_X - 30, CAR_Y + 20, "dynamic");
    const wheelShapeL = jove.physics.newCircleShape(12);
    const wheelFixL = jove.physics.newFixture(wheelL, wheelShapeL, 1);
    wheelFixL.setFriction(1.0);

    // Right wheel
    wheelR = jove.physics.newBody(world, CAR_X + 30, CAR_Y + 20, "dynamic");
    const wheelShapeR = jove.physics.newCircleShape(12);
    const wheelFixR = jove.physics.newFixture(wheelR, wheelShapeR, 1);
    wheelFixR.setFriction(1.0);

    // Wheel joints (axis = vertical for suspension)
    wheelJointL = jove.physics.newWheelJoint(chassis, wheelL, CAR_X - 30, CAR_Y + 20, 0, 1);
    wheelJointL.setSpringEnabled(true);
    wheelJointL.setSpringFrequency(4.0);
    wheelJointL.setSpringDampingRatio(0.7);
    wheelJointL.setMaxMotorTorque(1000);
    wheelJointL.setMotorSpeed(0);
    wheelJointL.setMotorEnabled(true);

    wheelJointR = jove.physics.newWheelJoint(chassis, wheelR, CAR_X + 30, CAR_Y + 20, 0, 1);
    wheelJointR.setSpringEnabled(true);
    wheelJointR.setSpringFrequency(4.0);
    wheelJointR.setSpringDampingRatio(0.7);
    wheelJointR.setMaxMotorTorque(1000);
    wheelJointR.setMotorSpeed(0);
    wheelJointR.setMotorEnabled(true);

    // === Motor Joint (tracker) ===
    trackerAnchor = jove.physics.newBody(world, 600, 200, "static");

    trackerBody = jove.physics.newBody(world, 600, 200, "dynamic");
    trackerBody.setGravityScale(0); // no gravity for tracker
    const trackerShape = jove.physics.newRectangleShape(40, 40);
    const trackerFix = jove.physics.newFixture(trackerBody, trackerShape, 1);
    trackerFix.setFriction(0.3);

    motorJoint = jove.physics.newMotorJoint(trackerAnchor, trackerBody, 0.3);
    motorJoint.setMaxForce(500);
    motorJoint.setMaxTorque(200);

    // Set hard-coded offset immediately
    const [ax, ay] = trackerAnchor.getPosition();
    motorJoint.setLinearOffset(TARGET_X - ax, TARGET_Y - ay);
  },

  update(dt) {
    elapsed += dt;

    // Drive car with arrow keys
    driving = 0;
    if (jove.keyboard.isDown("right")) driving = 1;
    if (jove.keyboard.isDown("left")) driving = -1;
    wheelJointL.setMotorSpeed(driving * 15);
    wheelJointR.setMotorSpeed(driving * 15);

    accumulator += dt;
    while (accumulator >= FIXED_DT) {
      world.update(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    // Fade flashes
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].timer -= dt;
      if (flashes[i].timer <= 0) flashes.splice(i, 1);
    }
  },

  draw() {
    // === Ground & Ramp ===
    jove.graphics.setColor(80, 80, 80);
    const [gx, gy] = ground.getPosition();
    jove.graphics.rectangle("fill", gx - 400, gy - 10, 800, 20);

    // Ramp (draw as polygon)
    jove.graphics.setColor(100, 80, 60);
    jove.graphics.push();
    const [rx, ry] = rampBody.getPosition();
    jove.graphics.translate(rx, ry);
    jove.graphics.polygon("fill", -80, 30, 80, 30, 80, -10);
    jove.graphics.pop();

    // === Car ===
    // Chassis
    jove.graphics.setColor(100, 150, 220);
    jove.graphics.push();
    const [cx, cy] = chassis.getPosition();
    jove.graphics.translate(cx, cy);
    jove.graphics.rotate(chassis.getAngle());
    jove.graphics.rectangle("fill", -40, -10, 80, 20);
    jove.graphics.pop();

    // Wheels
    jove.graphics.setColor(60, 60, 60);
    const [wlx, wly] = wheelL.getPosition();
    jove.graphics.circle("fill", wlx, wly, 12);
    const [wrx, wry] = wheelR.getPosition();
    jove.graphics.circle("fill", wrx, wry, 12);

    // Wheel spokes (show rotation)
    jove.graphics.setColor(200, 200, 200);
    const alL = wheelL.getAngle();
    jove.graphics.line(wlx, wly, wlx + Math.cos(alL) * 10, wly + Math.sin(alL) * 10);
    const alR = wheelR.getAngle();
    jove.graphics.line(wrx, wry, wrx + Math.cos(alR) * 10, wry + Math.sin(alR) * 10);

    // Joint anchors (small dots)
    jove.graphics.setColor(255, 255, 0);
    const [a1x, a1y] = wheelJointL.getAnchorA();
    const [b1x, b1y] = wheelJointL.getAnchorB();
    jove.graphics.circle("fill", a1x, a1y, 3);
    jove.graphics.circle("fill", b1x, b1y, 3);
    const [a2x, a2y] = wheelJointR.getAnchorA();
    const [b2x, b2y] = wheelJointR.getAnchorB();
    jove.graphics.circle("fill", a2x, a2y, 3);
    jove.graphics.circle("fill", b2x, b2y, 3);

    // Suspension lines (anchor A to anchor B)
    jove.graphics.setColor(255, 255, 0, 128);
    jove.graphics.line(a1x, a1y, b1x, b1y);
    jove.graphics.line(a2x, a2y, b2x, b2y);

    // === Motor Joint Tracker ===
    // Target crosshair (fixed position)
    jove.graphics.setColor(255, 100, 100, 128);
    jove.graphics.circle("line", TARGET_X, TARGET_Y, 15);
    jove.graphics.line(TARGET_X - 10, TARGET_Y, TARGET_X + 10, TARGET_Y);
    jove.graphics.line(TARGET_X, TARGET_Y - 10, TARGET_X, TARGET_Y + 10);

    // Tracker body
    jove.graphics.setColor(220, 100, 100);
    jove.graphics.push();
    const [tx, ty] = trackerBody.getPosition();
    jove.graphics.translate(tx, ty);
    jove.graphics.rotate(trackerBody.getAngle());
    jove.graphics.rectangle("fill", -20, -20, 40, 40);
    jove.graphics.pop();

    // Motor joint anchors
    jove.graphics.setColor(255, 200, 0);
    const [ma1x, ma1y] = motorJoint.getAnchorA();
    const [ma2x, ma2y] = motorJoint.getAnchorB();
    jove.graphics.circle("fill", ma1x, ma1y, 4);
    jove.graphics.circle("fill", ma2x, ma2y, 4);
    jove.graphics.line(ma1x, ma1y, ma2x, ma2y);

    // === Contact flashes ===
    for (const flash of flashes) {
      const alpha = Math.floor((flash.timer / 0.3) * 255);
      const r = Math.min(flash.speed / 5, 4) + 3;
      jove.graphics.setColor(255, 255, 128, alpha);
      jove.graphics.circle("fill", flash.x, flash.y, r);
    }

    // === HUD ===
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("Physics Phase 2 — WheelJoint + MotorJoint", 10, 10);
    jove.graphics.print("Arrow keys: drive car   |   R: reset   |   ESC: quit", 10, 30);

    // Timer
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print(`Time: ${elapsed.toFixed(2)}s`, 10, 50);

    // Tracker distance to target
    const [tbx, tby] = trackerBody.getPosition();
    const dist = Math.sqrt((tbx - TARGET_X) ** 2 + (tby - TARGET_Y) ** 2);
    jove.graphics.print(`Tracker dist to target: ${dist.toFixed(1)} px`, 10, 70);

    // Reaction force on left wheel joint
    jove.graphics.setColor(200, 200, 200);
    const [rfx, rfy] = wheelJointL.getReactionForce(1 / 60);
    jove.graphics.print(`Left wheel reaction: (${rfx.toFixed(1)}, ${rfy.toFixed(1)})`, 10, 90);

    // Spring info
    jove.graphics.print(`Spring: ${wheelJointL.getSpringFrequency().toFixed(1)} Hz, damping ${wheelJointL.getSpringDampingRatio().toFixed(1)}`, 10, 110);

    // Motor joint offset
    const [ox, oy] = motorJoint.getLinearOffset();
    jove.graphics.print(`Motor offset: (${ox.toFixed(0)}, ${oy.toFixed(0)})`, 10, 130);

    // Driving indicator
    let driveText = "IDLE";
    if (driving > 0) driveText = ">>> RIGHT >>>";
    else if (driving < 0) driveText = "<<< LEFT <<<";
    jove.graphics.print(`Drive: ${driveText}`, 10, 150);

    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 570);
  },

  keypressed(key) {
    if (key === "escape") jove.event.quit();
    if (key === "r") {
      elapsed = 0;
      // Reset car position
      chassis.setPosition(CAR_X, CAR_Y);
      chassis.setAngle(0);
      chassis.setLinearVelocity(0, 0);
      chassis.setAngularVelocity(0);
      wheelL.setPosition(CAR_X - 30, CAR_Y + 20);
      wheelL.setAngle(0);
      wheelL.setLinearVelocity(0, 0);
      wheelL.setAngularVelocity(0);
      wheelR.setPosition(CAR_X + 30, CAR_Y + 20);
      wheelR.setAngle(0);
      wheelR.setLinearVelocity(0, 0);
      wheelR.setAngularVelocity(0);
      // Reset tracker
      trackerBody.setPosition(600, 200);
      trackerBody.setLinearVelocity(0, 0);
      trackerBody.setAngularVelocity(0);
    }
  },
});
