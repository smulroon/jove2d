// jove2d Physics Phase 3 example — "Joint Inspector"
// Demonstrates: joint getters, body vector transforms, angular impulse,
// fixture testPoint, world joint queries, mouse joint drag
// 5 panels: Revolute, Prismatic, Distance+Weld springs, Spinner+Vectors, testPoint+MouseJoint

import jove from "../../src/index.ts";

type World = ReturnType<typeof jove.physics.newWorld>;
type Body = ReturnType<typeof jove.physics.newBody>;
type RevoluteJoint = ReturnType<typeof jove.physics.newRevoluteJoint>;
type PrismaticJoint = ReturnType<typeof jove.physics.newPrismaticJoint>;
type DistanceJoint = ReturnType<typeof jove.physics.newDistanceJoint>;
type WeldJoint = ReturnType<typeof jove.physics.newWeldJoint>;
type MotorJoint = ReturnType<typeof jove.physics.newMotorJoint>;
type WheelJoint = ReturnType<typeof jove.physics.newWheelJoint>;
type MouseJoint = ReturnType<typeof jove.physics.newMouseJoint>;

let world: World;

// Panel 1 — Revolute Motor+Limits
let revAnchor: Body;
let revArm: Body;
let revJoint: RevoluteJoint;

// Panel 2 — Prismatic Slider
let priAnchor: Body;
let priSlider: Body;
let priJoint: PrismaticJoint;

// Panel 3 — Distance+Weld Springs
let distBodyA: Body;
let distBodyB: Body;
let distJoint: DistanceJoint;
let weldBodyA: Body;
let weldBodyB: Body;
let weldJoint: WeldJoint;
let springFreq = 3.0;

// Panel 4 — Spinner + Vectors
let spinnerBody: Body;

// Panel 5 — testPoint + Mouse Joint
let polyBody: Body;
let polyFixture: ReturnType<typeof jove.physics.newFixture>;
let mouseJointObj: MouseJoint | null = null;
let testPointResult = false;

// Extra: MotorJoint + WheelJoint for getter display
let motorAnchor: Body;
let motorBody: Body;
let motorJointObj: MotorJoint;
let wheelAnchor: Body;
let wheelBody: Body;
let wheelJointObj: WheelJoint;

const FIXED_DT = 1 / 60;
let accumulator = 0;

function createWorld() {
  jove.physics.setMeter(30);
  world = jove.physics.newWorld(0, 9.81 * 30);

  // === Panel 1: Revolute Motor+Limits (top-left) ===
  revAnchor = jove.physics.newBody(world, 130, 120, "static");
  const anchorShape1 = jove.physics.newCircleShape(5);
  jove.physics.newFixture(revAnchor, anchorShape1, 1);

  revArm = jove.physics.newBody(world, 130, 120, "dynamic");
  const armShape = jove.physics.newRectangleShape(100, 12);
  jove.physics.newFixture(revArm, armShape, 2);

  revJoint = jove.physics.newRevoluteJoint(revAnchor, revArm, 130, 120);
  revJoint.setMotorEnabled(true);
  revJoint.setMotorSpeed(3.0);
  revJoint.setMaxMotorTorque(1500);
  revJoint.setLimitsEnabled(false);
  revJoint.setLimits(-Math.PI * 0.75, Math.PI * 0.75);

  // === Panel 2: Prismatic Slider (top-center) ===
  priAnchor = jove.physics.newBody(world, 390, 80, "static");
  const anchorShape2 = jove.physics.newCircleShape(5);
  jove.physics.newFixture(priAnchor, anchorShape2, 1);

  priSlider = jove.physics.newBody(world, 390, 130, "dynamic");
  const sliderShape = jove.physics.newRectangleShape(40, 40);
  jove.physics.newFixture(priSlider, sliderShape, 2);

  priJoint = jove.physics.newPrismaticJoint(priAnchor, priSlider, 390, 80, 0, 1);
  priJoint.setLimitsEnabled(true);
  priJoint.setLimits(-20, 120);
  priJoint.setMotorEnabled(true);
  priJoint.setMotorSpeed(-120);
  priJoint.setMaxMotorForce(3000);

  // === Panel 3: Distance+Weld Springs (top-right) ===
  // Distance spring
  distBodyA = jove.physics.newBody(world, 620, 60, "static");
  const distShapeA = jove.physics.newCircleShape(10);
  jove.physics.newFixture(distBodyA, distShapeA, 1);

  distBodyB = jove.physics.newBody(world, 620, 140, "dynamic");
  const distShapeB = jove.physics.newCircleShape(12);
  jove.physics.newFixture(distBodyB, distShapeB, 1);

  distJoint = jove.physics.newDistanceJoint(distBodyA, distBodyB, 620, 60, 620, 140);
  distJoint.setLength(40); // shorter than initial distance — creates initial stretch
  distJoint.setFrequency(springFreq);
  distJoint.setDampingRatio(0.1);

  // Weld spring — two dynamic bodies joined at their meeting point
  weldBodyA = jove.physics.newBody(world, 720, 70, "dynamic");
  const weldShapeA = jove.physics.newRectangleShape(20, 30);
  jove.physics.newFixture(weldBodyA, weldShapeA, 1);

  weldBodyB = jove.physics.newBody(world, 740, 120, "dynamic");
  weldBodyB.setAngle(0.3);
  const weldShapeB = jove.physics.newRectangleShape(20, 30);
  const weldFixB = jove.physics.newFixture(weldBodyB, weldShapeB, 3);

  // Pin top body to world so only the bottom wobbles
  const weldPin = jove.physics.newBody(world, 720, 55, "static");
  jove.physics.newRevoluteJoint(weldPin, weldBodyA, 720, 55);

  weldJoint = jove.physics.newWeldJoint(weldBodyA, weldBodyB, 720, 95);
  weldJoint.setFrequency(springFreq);
  weldJoint.setDampingRatio(0.05);

  // === Panel 4: Spinner + Vectors (bottom-left) ===
  spinnerBody = jove.physics.newBody(world, 140, 420, "dynamic");
  spinnerBody.setGravityScale(0);
  spinnerBody.setAngularDamping(0.5);
  const spinnerShape = jove.physics.newCircleShape(30);
  jove.physics.newFixture(spinnerBody, spinnerShape, 1);

  // === Panel 5: testPoint + Mouse Joint (bottom-right) ===
  polyBody = jove.physics.newBody(world, 580, 430, "dynamic");
  polyBody.setGravityScale(0);
  polyBody.setAngularDamping(1.0);
  polyBody.setLinearDamping(1.0);
  // Hexagon
  const r = 50;
  const hexVerts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    hexVerts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hexShape = jove.physics.newPolygonShape(...hexVerts);
  polyFixture = jove.physics.newFixture(polyBody, hexShape, 1);

  // === Extra: MotorJoint (for getter display) ===
  motorAnchor = jove.physics.newBody(world, 340, 350, "static");
  motorBody = jove.physics.newBody(world, 340, 350, "dynamic");
  motorBody.setGravityScale(0);
  const motorShape = jove.physics.newRectangleShape(20, 20);
  jove.physics.newFixture(motorBody, motorShape, 1);

  motorJointObj = jove.physics.newMotorJoint(motorAnchor, motorBody, 0.5);
  motorJointObj.setMaxForce(300);
  motorJointObj.setMaxTorque(100);
  motorJointObj.setLinearOffset(20, 30);

  // === Extra: WheelJoint (for getter display) ===
  wheelAnchor = jove.physics.newBody(world, 340, 420, "static");
  const wheelAnchorShape = jove.physics.newCircleShape(5);
  jove.physics.newFixture(wheelAnchor, wheelAnchorShape, 1);

  wheelBody = jove.physics.newBody(world, 340, 450, "dynamic");
  const wheelShape = jove.physics.newCircleShape(12);
  jove.physics.newFixture(wheelBody, wheelShape, 1);

  wheelJointObj = jove.physics.newWheelJoint(wheelAnchor, wheelBody, 340, 420, 0, 1);
  wheelJointObj.setSpringEnabled(true);
  wheelJointObj.setSpringFrequency(4.0);
  wheelJointObj.setSpringDampingRatio(0.7);
  wheelJointObj.setMotorEnabled(true);
  wheelJointObj.setMotorSpeed(5.0);
  wheelJointObj.setMaxMotorTorque(500);
  wheelJointObj.setLimitsEnabled(true);
  wheelJointObj.setLimits(-30, 30);
}

await jove.run({
  load() {
    jove.window.setTitle("Physics Phase 3 — Joint Inspector — jove2d");
    jove.graphics.setBackgroundColor(20, 20, 30);
    createWorld();
  },

  update(dt) {
    // Update testPoint with current mouse position
    const [mx, my] = jove.mouse.getPosition();
    testPointResult = polyFixture.testPoint(mx, my);

    // Update mouse joint target
    if (mouseJointObj) {
      mouseJointObj.setTarget(mx, my);
    }

    // Reverse revolute motor direction at limits
    if (revJoint.isLimitEnabled() && revJoint.isMotorEnabled()) {
      const angle = revJoint.getJointAngle();
      const lo = revJoint.getLowerLimit();
      const hi = revJoint.getUpperLimit();
      if (angle >= hi * 0.95) {
        revJoint.setMotorSpeed(-Math.abs(revJoint.getMotorSpeed()));
      } else if (angle <= lo * 0.95) {
        revJoint.setMotorSpeed(Math.abs(revJoint.getMotorSpeed()));
      }
    }

    accumulator += dt;
    while (accumulator >= FIXED_DT) {
      world.update(FIXED_DT);
      accumulator -= FIXED_DT;
    }
  },

  draw() {
    const [mx, my] = jove.mouse.getPosition();

    // ─── Panel 1: Revolute (top-left) ───
    // Panel border
    jove.graphics.setColor(60, 60, 80);
    jove.graphics.rectangle("line", 5, 5, 250, 250);
    jove.graphics.setColor(180, 180, 200);
    jove.graphics.print("1: Revolute Motor+Limits", 10, 8);

    // Anchor dot
    jove.graphics.setColor(255, 255, 0);
    const [ra1x, ra1y] = revAnchor.getPosition();
    jove.graphics.circle("fill", ra1x, ra1y, 5);

    // Arm
    jove.graphics.setColor(100, 180, 100);
    jove.graphics.push();
    const [rax, ray] = revArm.getPosition();
    jove.graphics.translate(rax, ray);
    jove.graphics.rotate(revArm.getAngle());
    jove.graphics.rectangle("fill", -50, -6, 100, 12);
    jove.graphics.pop();

    // Limit arc (visual indicator)
    if (revJoint.isLimitEnabled()) {
      jove.graphics.setColor(255, 200, 0, 60);
      jove.graphics.arc("fill", ra1x, ra1y, 40,
        revJoint.getLowerLimit(), revJoint.getUpperLimit());
    }

    // HUD
    let y = 165;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print(`Motor: ${revJoint.isMotorEnabled() ? "ON" : "OFF"} [M]`, 10, y); y += 16;
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print(`  speed: ${revJoint.getMotorSpeed().toFixed(1)} rad/s`, 10, y); y += 16;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print(`Limits: ${revJoint.isLimitEnabled() ? "ON" : "OFF"} [L]`, 10, y); y += 16;
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print(`  ${revJoint.getLowerLimit().toFixed(2)} .. ${revJoint.getUpperLimit().toFixed(2)}`, 10, y); y += 16;
    jove.graphics.print(`  angle: ${revJoint.getJointAngle().toFixed(2)} rad`, 10, y);

    // ─── Panel 2: Prismatic (top-center) ───
    jove.graphics.setColor(60, 60, 80);
    jove.graphics.rectangle("line", 265, 5, 250, 250);
    jove.graphics.setColor(180, 180, 200);
    jove.graphics.print("2: Prismatic Slider", 270, 8);

    // Rail line
    jove.graphics.setColor(80, 80, 80);
    jove.graphics.line(390, 20, 390, 200);

    // Anchor dot
    jove.graphics.setColor(255, 255, 0);
    const [pa1x, pa1y] = priAnchor.getPosition();
    jove.graphics.circle("fill", pa1x, pa1y, 5);

    // Slider body
    jove.graphics.setColor(100, 130, 220);
    jove.graphics.push();
    const [psx, psy] = priSlider.getPosition();
    jove.graphics.translate(psx, psy);
    jove.graphics.rotate(priSlider.getAngle());
    jove.graphics.rectangle("fill", -20, -20, 40, 40);
    jove.graphics.pop();

    // HUD
    y = 165;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print(`Motor: ${priJoint.isMotorEnabled() ? "ON" : "OFF"} [N]`, 270, y); y += 16;
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print(`  speed: ${priJoint.getMotorSpeed().toFixed(1)} px/s`, 270, y); y += 16;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print(`Limits: ${priJoint.isLimitEnabled() ? "ON" : "OFF"}`, 270, y); y += 16;
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print(`  ${priJoint.getLowerLimit().toFixed(0)}..${priJoint.getUpperLimit().toFixed(0)} px`, 270, y); y += 16;
    jove.graphics.print(`  translation: ${priJoint.getJointTranslation().toFixed(1)} px`, 270, y);

    // ─── Panel 3: Distance+Weld Springs (top-right) ───
    jove.graphics.setColor(60, 60, 80);
    jove.graphics.rectangle("line", 525, 5, 270, 250);
    jove.graphics.setColor(180, 180, 200);
    jove.graphics.print("3: Springs [Up/Down freq]", 530, 8);

    // Distance spring line + bodies
    const [dax, day] = distBodyA.getPosition();
    const [dbx, dby] = distBodyB.getPosition();
    jove.graphics.setColor(255, 200, 100, 128);
    jove.graphics.line(dax, day, dbx, dby);
    jove.graphics.setColor(200, 100, 100);
    jove.graphics.circle("fill", dax, day, 10);
    jove.graphics.setColor(255, 120, 80);
    jove.graphics.circle("fill", dbx, dby, 12);

    // Weld bodies (both dynamic, pinned at top)
    const [wax, way] = weldBodyA.getPosition();
    jove.graphics.setColor(100, 100, 200);
    jove.graphics.push();
    jove.graphics.translate(wax, way);
    jove.graphics.rotate(weldBodyA.getAngle());
    jove.graphics.rectangle("fill", -10, -15, 20, 30);
    jove.graphics.pop();

    const [wbx, wby] = weldBodyB.getPosition();
    jove.graphics.setColor(120, 120, 255);
    jove.graphics.push();
    jove.graphics.translate(wbx, wby);
    jove.graphics.rotate(weldBodyB.getAngle());
    jove.graphics.rectangle("fill", -10, -15, 20, 30);
    jove.graphics.pop();

    // Weld connection line
    jove.graphics.setColor(150, 150, 255, 128);
    jove.graphics.line(wax, way, wbx, wby);

    // HUD
    y = 165;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("Distance:", 530, y); y += 16;
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print(`  freq: ${distJoint.getFrequency().toFixed(1)} Hz`, 530, y); y += 16;
    jove.graphics.print(`  damp: ${distJoint.getDampingRatio().toFixed(2)}`, 530, y); y += 16;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("Weld:", 530, y); y += 16;
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print(`  freq: ${weldJoint.getFrequency().toFixed(1)} Hz`, 530, y); y += 16;
    jove.graphics.print(`  damp: ${weldJoint.getDampingRatio().toFixed(2)}`, 530, y);

    // ─── Panel 4: Spinner + Vectors (bottom-left) ───
    jove.graphics.setColor(60, 60, 80);
    jove.graphics.rectangle("line", 5, 265, 260, 330);
    jove.graphics.setColor(180, 180, 200);
    jove.graphics.print("4: Spinner [Space impulse]", 10, 268);

    // Spinner body
    const [sx, sy] = spinnerBody.getPosition();
    jove.graphics.setColor(150, 150, 150);
    jove.graphics.circle("fill", sx, sy, 30);

    // Draw direction indicator on spinner
    const spinAngle = spinnerBody.getAngle();
    jove.graphics.setColor(80, 80, 80);
    jove.graphics.line(sx, sy, sx + Math.cos(spinAngle) * 28, sy + Math.sin(spinAngle) * 28);

    // World vector arrows (body's local axes in world space)
    const [wxX, wxY] = spinnerBody.getWorldVector(1, 0);
    const [wyX, wyY] = spinnerBody.getWorldVector(0, 1);
    const arrowLen = 50;

    // Green arrow = local X axis
    jove.graphics.setColor(0, 255, 0);
    jove.graphics.line(sx, sy, sx + wxX * arrowLen, sy + wxY * arrowLen);
    // Arrowhead
    const axTip = { x: sx + wxX * arrowLen, y: sy + wxY * arrowLen };
    jove.graphics.circle("fill", axTip.x, axTip.y, 4);
    jove.graphics.print("X", axTip.x + 5, axTip.y - 8);

    // Blue arrow = local Y axis
    jove.graphics.setColor(80, 150, 255);
    jove.graphics.line(sx, sy, sx + wyX * arrowLen, sy + wyY * arrowLen);
    const ayTip = { x: sx + wyX * arrowLen, y: sy + wyY * arrowLen };
    jove.graphics.circle("fill", ayTip.x, ayTip.y, 4);
    jove.graphics.print("Y", ayTip.x + 5, ayTip.y - 8);

    // Round-trip test: getWorldVector → getLocalVector
    const [rlx, rly] = spinnerBody.getLocalVector(wxX, wxY);

    // HUD
    y = 490;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print(`angVel: ${spinnerBody.getAngularVelocity().toFixed(2)} rad/s`, 10, y); y += 16;
    jove.graphics.setColor(0, 255, 0);
    jove.graphics.print(`worldVec(1,0): (${wxX.toFixed(2)}, ${wxY.toFixed(2)})`, 10, y); y += 16;
    jove.graphics.setColor(80, 150, 255);
    jove.graphics.print(`worldVec(0,1): (${wyX.toFixed(2)}, ${wyY.toFixed(2)})`, 10, y); y += 16;
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print(`localVec roundtrip: (${rlx.toFixed(2)}, ${rly.toFixed(2)})`, 10, y);

    // ─── Panel 5: testPoint + Mouse Joint (bottom-right) ───
    jove.graphics.setColor(60, 60, 80);
    jove.graphics.rectangle("line", 400, 265, 395, 330);
    jove.graphics.setColor(180, 180, 200);
    jove.graphics.print("6: testPoint [RightClick drag]", 405, 268);

    // Hexagon body — glow green when mouse inside
    const [px, py] = polyBody.getPosition();
    const pAngle = polyBody.getAngle();
    if (testPointResult) {
      jove.graphics.setColor(80, 255, 80);
    } else {
      jove.graphics.setColor(130, 130, 130);
    }

    // Draw hexagon
    const r = 50;
    const hexPts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2 + pAngle;
      hexPts.push(px + Math.cos(a) * r, py + Math.sin(a) * r);
    }
    jove.graphics.polygon("fill", ...hexPts);

    // Outline
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.polygon("line", ...hexPts);

    // Mouse joint line
    if (mouseJointObj) {
      jove.graphics.setColor(255, 255, 0);
      const [tx, ty] = mouseJointObj.getTarget();
      jove.graphics.line(px, py, tx, ty);
      jove.graphics.circle("fill", tx, ty, 4);
    }

    // HUD
    y = 490;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print(`testPoint: ${testPointResult}`, 405, y); y += 16;
    if (mouseJointObj) {
      jove.graphics.setColor(255, 255, 100);
      jove.graphics.print(`mouseJoint maxForce: ${mouseJointObj.getMaxForce().toFixed(0)}`, 405, y); y += 16;
    } else {
      jove.graphics.setColor(120, 120, 120);
      jove.graphics.print("mouseJoint: none (right-click)", 405, y); y += 16;
    }
    jove.graphics.setColor(255, 200, 100);
    jove.graphics.print(`jointCount: ${world.getJointCount()}`, 405, y); y += 16;
    jove.graphics.print(`getJoints().length: ${world.getJoints().length}`, 405, y);

    // ─── Motor/Wheel joint getters (center bottom) ───
    jove.graphics.setColor(60, 60, 80);
    jove.graphics.rectangle("line", 275, 290, 115, 200);
    jove.graphics.setColor(180, 180, 200);
    jove.graphics.print("5: Motor+Wheel", 280, 293);

    // Motor joint body (small square)
    const [mbx, mby] = motorBody.getPosition();
    jove.graphics.setColor(220, 100, 100);
    jove.graphics.push();
    jove.graphics.translate(mbx, mby);
    jove.graphics.rotate(motorBody.getAngle());
    jove.graphics.rectangle("fill", -10, -10, 20, 20);
    jove.graphics.pop();

    // Motor anchor
    const [max2, may2] = motorAnchor.getPosition();
    jove.graphics.setColor(255, 255, 0, 128);
    jove.graphics.line(max2, may2, mbx, mby);
    jove.graphics.circle("fill", max2, may2, 3);

    // Wheel joint body
    const [wbx2, wby2] = wheelBody.getPosition();
    jove.graphics.setColor(100, 200, 100);
    jove.graphics.circle("fill", wbx2, wby2, 12);
    // Spoke
    const wa = wheelBody.getAngle();
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.line(wbx2, wby2, wbx2 + Math.cos(wa) * 10, wby2 + Math.sin(wa) * 10);

    // Wheel anchor
    const [wa2x, wa2y] = wheelAnchor.getPosition();
    jove.graphics.setColor(255, 255, 0, 128);
    jove.graphics.line(wa2x, wa2y, wbx2, wby2);
    jove.graphics.circle("fill", wa2x, wa2y, 3);

    // HUD
    y = 370;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("Motor:", 280, y); y += 14;
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print(` mxF:${motorJointObj.getMaxForce().toFixed(0)}`, 280, y); y += 14;
    jove.graphics.print(` mxT:${motorJointObj.getMaxTorque().toFixed(0)}`, 280, y); y += 14;
    jove.graphics.print(` cor:${motorJointObj.getCorrectionFactor().toFixed(1)}`, 280, y); y += 18;
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("Wheel:", 280, y); y += 14;
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print(` lim:${wheelJointObj.isLimitEnabled() ? "ON" : "OFF"}`, 280, y); y += 14;
    jove.graphics.print(` mot:${wheelJointObj.isMotorEnabled() ? "ON" : "OFF"}`, 280, y); y += 14;
    jove.graphics.print(` spd:${wheelJointObj.getMotorSpeed().toFixed(1)}`, 280, y);

    // ─── Global HUD ───
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.print("M:revolute motor  L:limits  N:prismatic motor  Space:spin  Up/Down:freq  R:reset  ESC:quit", 10, 580);

    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 730, 560);
  },

  keypressed(key) {
    if (key === "escape") jove.event.quit();

    // M — toggle revolute motor
    if (key === "m") {
      revJoint.setMotorEnabled(!revJoint.isMotorEnabled());
    }

    // L — toggle revolute limits
    if (key === "l") {
      if (!revJoint.isLimitEnabled()) {
        // Reset arm angle before enabling limits (cumulative angle would be huge)
        revArm.setAngle(0);
        revArm.setAngularVelocity(0);
      }
      revJoint.setLimitsEnabled(!revJoint.isLimitEnabled());
    }

    // N — toggle prismatic motor
    if (key === "n") {
      priJoint.setMotorEnabled(!priJoint.isMotorEnabled());
    }

    // Space — angular impulse on spinner
    if (key === "space") {
      spinnerBody.applyAngularImpulse(50000);
    }

    // Up/Down — adjust spring frequency
    if (key === "up") {
      springFreq = Math.min(springFreq + 0.5, 20);
      distJoint.setFrequency(springFreq);
      weldJoint.setFrequency(springFreq);
    }
    if (key === "down") {
      springFreq = Math.max(springFreq - 0.5, 0.5);
      distJoint.setFrequency(springFreq);
      weldJoint.setFrequency(springFreq);
    }

    // R — reset
    if (key === "r") {
      if (mouseJointObj) {
        mouseJointObj.destroy();
        mouseJointObj = null;
      }
      world.destroy();
      accumulator = 0;
      createWorld();
    }
  },

  mousepressed(_x, _y, button) {
    // Right-click to create mouse joint on polygon body
    // SDL3: right-click = button 3 (love2d remaps to 2)
    if (button === 3 && !mouseJointObj) {
      const [mx, my] = jove.mouse.getPosition();
      polyBody.setAwake(true);
      mouseJointObj = jove.physics.newMouseJoint(polyBody, mx, my);
      mouseJointObj.setMaxForce(100000);
    }
  },

  mousereleased(_x, _y, button) {
    // Release right-click to destroy mouse joint
    if (button === 3 && mouseJointObj) {
      mouseJointObj.destroy();
      mouseJointObj = null;
    }
  },
});
