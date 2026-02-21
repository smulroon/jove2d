-- love2d Physics Phase 3 example — "Joint Inspector"
-- Demonstrates: joint getters, body vector transforms, angular impulse,
-- fixture testPoint, world joint queries, mouse joint drag
-- 5 panels: Revolute, Prismatic, Distance+Weld springs, Spinner+Vectors, testPoint+MouseJoint

local world

-- Panel 1 — Revolute Motor+Limits
local revAnchor, revArm, revJoint

-- Panel 2 — Prismatic Slider
local priAnchor, priSlider, priJoint

-- Panel 3 — Distance+Weld Springs
local distBodyA, distBodyB, distJoint
local weldBodyA, weldBodyB, weldJoint
local springFreq = 3.0

-- Panel 4 — Spinner + Vectors
local spinnerBody

-- Panel 5 — testPoint + Mouse Joint
local polyBody, polyFixture
local mouseJointObj = nil
local testPointResult = false

-- Extra: MotorJoint + WheelJoint for getter display
local motorAnchor, motorBody, motorJointObj
local wheelAnchor, wheelBody, wheelJointObj

local FIXED_DT = 1 / 60
local accumulator = 0

local function createWorld()
  love.physics.setMeter(30)
  world = love.physics.newWorld(0, 9.81 * 30, true)

  -- === Panel 1: Revolute Motor+Limits (top-left) ===
  revAnchor = love.physics.newBody(world, 130, 120, "static")
  local anchorShape1 = love.physics.newCircleShape(5)
  love.physics.newFixture(revAnchor, anchorShape1, 1)

  revArm = love.physics.newBody(world, 130, 120, "dynamic")
  local armShape = love.physics.newRectangleShape(100, 12)
  love.physics.newFixture(revArm, armShape, 2)

  revJoint = love.physics.newRevoluteJoint(revAnchor, revArm, 130, 120, false)
  revJoint:setMotorEnabled(true)
  revJoint:setMotorSpeed(3.0)
  revJoint:setMaxMotorTorque(1500)
  revJoint:setLimitsEnabled(false)
  revJoint:setLimits(-math.pi * 0.75, math.pi * 0.75)

  -- === Panel 2: Prismatic Slider (top-center) ===
  priAnchor = love.physics.newBody(world, 390, 80, "static")
  local anchorShape2 = love.physics.newCircleShape(5)
  love.physics.newFixture(priAnchor, anchorShape2, 1)

  priSlider = love.physics.newBody(world, 390, 130, "dynamic")
  local sliderShape = love.physics.newRectangleShape(40, 40)
  love.physics.newFixture(priSlider, sliderShape, 2)

  priJoint = love.physics.newPrismaticJoint(priAnchor, priSlider, 390, 80, 0, 1, false)
  priJoint:setLimitsEnabled(true)
  priJoint:setLimits(-20, 120)
  priJoint:setMotorEnabled(true)
  priJoint:setMotorSpeed(-120)
  priJoint:setMaxMotorForce(3000)

  -- === Panel 3: Distance+Weld Springs (top-right) ===
  distBodyA = love.physics.newBody(world, 620, 60, "static")
  local distShapeA = love.physics.newCircleShape(10)
  love.physics.newFixture(distBodyA, distShapeA, 1)

  distBodyB = love.physics.newBody(world, 620, 140, "dynamic")
  local distShapeB = love.physics.newCircleShape(12)
  love.physics.newFixture(distBodyB, distShapeB, 1)

  distJoint = love.physics.newDistanceJoint(distBodyA, distBodyB, 620, 60, 620, 140, false)
  distJoint:setLength(40) -- shorter than initial distance — creates initial stretch
  distJoint:setFrequency(springFreq)
  distJoint:setDampingRatio(0.1)

  -- Weld spring — two dynamic bodies joined at their meeting point
  weldBodyA = love.physics.newBody(world, 720, 70, "dynamic")
  local weldShapeA = love.physics.newRectangleShape(20, 30)
  love.physics.newFixture(weldBodyA, weldShapeA, 1)

  weldBodyB = love.physics.newBody(world, 740, 120, "dynamic")
  weldBodyB:setAngle(0.3)
  local weldShapeB = love.physics.newRectangleShape(20, 30)
  local weldFixB = love.physics.newFixture(weldBodyB, weldShapeB, 3)

  -- Pin top body to world so only the bottom wobbles
  local weldPin = love.physics.newBody(world, 720, 55, "static")
  love.physics.newRevoluteJoint(weldPin, weldBodyA, 720, 55, false)

  weldJoint = love.physics.newWeldJoint(weldBodyA, weldBodyB, 720, 95, false)
  weldJoint:setFrequency(springFreq)
  weldJoint:setDampingRatio(0.05)

  -- === Panel 4: Spinner + Vectors (bottom-left) ===
  spinnerBody = love.physics.newBody(world, 140, 420, "dynamic")
  spinnerBody:setGravityScale(0)
  spinnerBody:setAngularDamping(0.5)
  local spinnerShape = love.physics.newCircleShape(30)
  love.physics.newFixture(spinnerBody, spinnerShape, 1)

  -- === Panel 5: testPoint + Mouse Joint (bottom-right) ===
  polyBody = love.physics.newBody(world, 580, 430, "dynamic")
  polyBody:setGravityScale(0)
  polyBody:setAngularDamping(1.0)
  polyBody:setLinearDamping(1.0)
  -- Hexagon
  local r = 50
  local hexVerts = {}
  for i = 0, 5 do
    local a = (i / 6) * math.pi * 2 - math.pi / 2
    table.insert(hexVerts, math.cos(a) * r)
    table.insert(hexVerts, math.sin(a) * r)
  end
  local hexShape = love.physics.newPolygonShape(unpack(hexVerts))
  polyFixture = love.physics.newFixture(polyBody, hexShape, 1)

  -- === Extra: MotorJoint (for getter display) ===
  motorAnchor = love.physics.newBody(world, 340, 350, "static")
  motorBody = love.physics.newBody(world, 340, 350, "dynamic")
  motorBody:setGravityScale(0)
  local motorShape = love.physics.newRectangleShape(20, 20)
  love.physics.newFixture(motorBody, motorShape, 1)

  motorJointObj = love.physics.newMotorJoint(motorAnchor, motorBody, 0.5)
  motorJointObj:setMaxForce(300)
  motorJointObj:setMaxTorque(100)
  motorJointObj:setLinearOffset(20, 30)

  -- === Extra: WheelJoint (for getter display) ===
  wheelAnchor = love.physics.newBody(world, 340, 420, "static")
  local wheelAnchorShape = love.physics.newCircleShape(5)
  love.physics.newFixture(wheelAnchor, wheelAnchorShape, 1)

  wheelBody = love.physics.newBody(world, 340, 450, "dynamic")
  local wheelShape = love.physics.newCircleShape(12)
  love.physics.newFixture(wheelBody, wheelShape, 1)

  wheelJointObj = love.physics.newWheelJoint(wheelAnchor, wheelBody, 340, 420, 0, 1, false)
  wheelJointObj:setSpringFrequency(4.0)
  wheelJointObj:setSpringDampingRatio(0.7)
  wheelJointObj:setMotorEnabled(true)
  wheelJointObj:setMotorSpeed(5.0)
  wheelJointObj:setMaxMotorTorque(500)
  -- Note: WheelJoint limits not available in love2d (Box2D v2)
end

function love.load()
  love.window.setTitle("Physics Phase 3 — Joint Inspector — love2d")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(20/255, 20/255, 30/255)
  createWorld()
end

function love.update(dt)
  -- Update testPoint with current mouse position
  local mx, my = love.mouse.getPosition()
  testPointResult = polyFixture:testPoint(mx, my)

  -- Update mouse joint target
  if mouseJointObj then
    mouseJointObj:setTarget(mx, my)
  end

  -- Reverse revolute motor direction at limits
  if revJoint:areLimitsEnabled() and revJoint:isMotorEnabled() then
    local angle = revJoint:getJointAngle()
    local lo, hi = revJoint:getLimits()
    if angle >= hi * 0.95 then
      revJoint:setMotorSpeed(-math.abs(revJoint:getMotorSpeed()))
    elseif angle <= lo * 0.95 then
      revJoint:setMotorSpeed(math.abs(revJoint:getMotorSpeed()))
    end
  end

  accumulator = accumulator + dt
  while accumulator >= FIXED_DT do
    world:update(FIXED_DT)
    accumulator = accumulator - FIXED_DT
  end
end

function love.draw()
  local mx, my = love.mouse.getPosition()

  -- Panel 1: Revolute (top-left)
  love.graphics.setColor(60/255, 60/255, 80/255)
  love.graphics.rectangle("line", 5, 5, 250, 250)
  love.graphics.setColor(180/255, 180/255, 200/255)
  love.graphics.print("1: Revolute Motor+Limits", 10, 8)

  -- Anchor dot
  love.graphics.setColor(1, 1, 0)
  local ra1x, ra1y = revAnchor:getPosition()
  love.graphics.circle("fill", ra1x, ra1y, 5)

  -- Arm
  love.graphics.setColor(100/255, 180/255, 100/255)
  love.graphics.push()
  local rax, ray = revArm:getPosition()
  love.graphics.translate(rax, ray)
  love.graphics.rotate(revArm:getAngle())
  love.graphics.rectangle("fill", -50, -6, 100, 12)
  love.graphics.pop()

  -- Limit arc
  if revJoint:areLimitsEnabled() then
    love.graphics.setColor(1, 0.8, 0, 0.24)
    love.graphics.arc("fill", ra1x, ra1y, 40,
      revJoint:getLowerLimit(), revJoint:getUpperLimit())
  end

  -- HUD
  local y = 165
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print(string.format("Motor: %s [M]", revJoint:isMotorEnabled() and "ON" or "OFF"), 10, y); y = y + 16
  love.graphics.setColor(1, 1, 0.4)
  love.graphics.print(string.format("  speed: %.1f rad/s", revJoint:getMotorSpeed()), 10, y); y = y + 16
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print(string.format("Limits: %s [L]", revJoint:areLimitsEnabled() and "ON" or "OFF"), 10, y); y = y + 16
  love.graphics.setColor(1, 1, 0.4)
  love.graphics.print(string.format("  %.2f .. %.2f", revJoint:getLowerLimit(), revJoint:getUpperLimit()), 10, y); y = y + 16
  love.graphics.print(string.format("  angle: %.2f rad", revJoint:getJointAngle()), 10, y)

  -- Panel 2: Prismatic (top-center)
  love.graphics.setColor(60/255, 60/255, 80/255)
  love.graphics.rectangle("line", 265, 5, 250, 250)
  love.graphics.setColor(180/255, 180/255, 200/255)
  love.graphics.print("2: Prismatic Slider", 270, 8)

  -- Rail line
  love.graphics.setColor(80/255, 80/255, 80/255)
  love.graphics.line(390, 20, 390, 200)

  -- Anchor dot
  love.graphics.setColor(1, 1, 0)
  local pa1x, pa1y = priAnchor:getPosition()
  love.graphics.circle("fill", pa1x, pa1y, 5)

  -- Slider body
  love.graphics.setColor(100/255, 130/255, 220/255)
  love.graphics.push()
  local psx, psy = priSlider:getPosition()
  love.graphics.translate(psx, psy)
  love.graphics.rotate(priSlider:getAngle())
  love.graphics.rectangle("fill", -20, -20, 40, 40)
  love.graphics.pop()

  -- HUD
  y = 165
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print(string.format("Motor: %s [N]", priJoint:isMotorEnabled() and "ON" or "OFF"), 270, y); y = y + 16
  love.graphics.setColor(1, 1, 0.4)
  love.graphics.print(string.format("  speed: %.1f px/s", priJoint:getMotorSpeed()), 270, y); y = y + 16
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print(string.format("Limits: %s", priJoint:areLimitsEnabled() and "ON" or "OFF"), 270, y); y = y + 16
  love.graphics.setColor(1, 1, 0.4)
  love.graphics.print(string.format("  %.0f..%.0f px", priJoint:getLowerLimit(), priJoint:getUpperLimit()), 270, y); y = y + 16
  love.graphics.print(string.format("  translation: %.1f px", priJoint:getJointTranslation()), 270, y)

  -- Panel 3: Distance+Weld Springs (top-right)
  love.graphics.setColor(60/255, 60/255, 80/255)
  love.graphics.rectangle("line", 525, 5, 270, 250)
  love.graphics.setColor(180/255, 180/255, 200/255)
  love.graphics.print("3: Springs [Up/Down freq]", 530, 8)

  -- Distance spring
  local dax, day = distBodyA:getPosition()
  local dbx, dby = distBodyB:getPosition()
  love.graphics.setColor(1, 0.8, 0.4, 0.5)
  love.graphics.line(dax, day, dbx, dby)
  love.graphics.setColor(200/255, 100/255, 100/255)
  love.graphics.circle("fill", dax, day, 10)
  love.graphics.setColor(1, 120/255, 80/255)
  love.graphics.circle("fill", dbx, dby, 12)

  -- Weld bodies (both dynamic, pinned at top)
  local wax, way = weldBodyA:getPosition()
  love.graphics.setColor(100/255, 100/255, 200/255)
  love.graphics.push()
  love.graphics.translate(wax, way)
  love.graphics.rotate(weldBodyA:getAngle())
  love.graphics.rectangle("fill", -10, -15, 20, 30)
  love.graphics.pop()

  local wbx, wby = weldBodyB:getPosition()
  love.graphics.setColor(120/255, 120/255, 1)
  love.graphics.push()
  love.graphics.translate(wbx, wby)
  love.graphics.rotate(weldBodyB:getAngle())
  love.graphics.rectangle("fill", -10, -15, 20, 30)
  love.graphics.pop()

  love.graphics.setColor(150/255, 150/255, 1, 0.5)
  love.graphics.line(wax, way, wbx, wby)

  -- HUD
  y = 165
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Distance:", 530, y); y = y + 16
  love.graphics.setColor(1, 1, 0.4)
  love.graphics.print(string.format("  freq: %.1f Hz", distJoint:getFrequency()), 530, y); y = y + 16
  love.graphics.print(string.format("  damp: %.2f", distJoint:getDampingRatio()), 530, y); y = y + 16
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Weld:", 530, y); y = y + 16
  love.graphics.setColor(1, 1, 0.4)
  love.graphics.print(string.format("  freq: %.1f Hz", weldJoint:getFrequency()), 530, y); y = y + 16
  love.graphics.print(string.format("  damp: %.2f", weldJoint:getDampingRatio()), 530, y)

  -- Panel 4: Spinner + Vectors (bottom-left)
  love.graphics.setColor(60/255, 60/255, 80/255)
  love.graphics.rectangle("line", 5, 265, 260, 330)
  love.graphics.setColor(180/255, 180/255, 200/255)
  love.graphics.print("4: Spinner [Space impulse]", 10, 268)

  -- Spinner body
  local sx, sy = spinnerBody:getPosition()
  love.graphics.setColor(150/255, 150/255, 150/255)
  love.graphics.circle("fill", sx, sy, 30)

  -- Direction indicator
  local spinAngle = spinnerBody:getAngle()
  love.graphics.setColor(80/255, 80/255, 80/255)
  love.graphics.line(sx, sy, sx + math.cos(spinAngle) * 28, sy + math.sin(spinAngle) * 28)

  -- World vector arrows
  local wxX, wxY = spinnerBody:getWorldVector(1, 0)
  local wyX, wyY = spinnerBody:getWorldVector(0, 1)
  local arrowLen = 50

  -- Green arrow = local X
  love.graphics.setColor(0, 1, 0)
  love.graphics.line(sx, sy, sx + wxX * arrowLen, sy + wxY * arrowLen)
  local axTipX, axTipY = sx + wxX * arrowLen, sy + wxY * arrowLen
  love.graphics.circle("fill", axTipX, axTipY, 4)
  love.graphics.print("X", axTipX + 5, axTipY - 8)

  -- Blue arrow = local Y
  love.graphics.setColor(80/255, 150/255, 1)
  love.graphics.line(sx, sy, sx + wyX * arrowLen, sy + wyY * arrowLen)
  local ayTipX, ayTipY = sx + wyX * arrowLen, sy + wyY * arrowLen
  love.graphics.circle("fill", ayTipX, ayTipY, 4)
  love.graphics.print("Y", ayTipX + 5, ayTipY - 8)

  -- Round-trip test
  local rlx, rly = spinnerBody:getLocalVector(wxX, wxY)

  -- HUD
  y = 490
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print(string.format("angVel: %.2f rad/s", spinnerBody:getAngularVelocity()), 10, y); y = y + 16
  love.graphics.setColor(0, 1, 0)
  love.graphics.print(string.format("worldVec(1,0): (%.2f, %.2f)", wxX, wxY), 10, y); y = y + 16
  love.graphics.setColor(80/255, 150/255, 1)
  love.graphics.print(string.format("worldVec(0,1): (%.2f, %.2f)", wyX, wyY), 10, y); y = y + 16
  love.graphics.setColor(1, 1, 0.4)
  love.graphics.print(string.format("localVec roundtrip: (%.2f, %.2f)", rlx, rly), 10, y)

  -- Panel 5: testPoint + Mouse Joint (bottom-right)
  love.graphics.setColor(60/255, 60/255, 80/255)
  love.graphics.rectangle("line", 400, 265, 395, 330)
  love.graphics.setColor(180/255, 180/255, 200/255)
  love.graphics.print("6: testPoint [RightClick drag]", 405, 268)

  -- Hexagon
  local px, py = polyBody:getPosition()
  local pAngle = polyBody:getAngle()
  if testPointResult then
    love.graphics.setColor(80/255, 1, 80/255)
  else
    love.graphics.setColor(130/255, 130/255, 130/255)
  end

  local r = 50
  local hexPts = {}
  for i = 0, 5 do
    local a = (i / 6) * math.pi * 2 - math.pi / 2 + pAngle
    table.insert(hexPts, px + math.cos(a) * r)
    table.insert(hexPts, py + math.sin(a) * r)
  end
  love.graphics.polygon("fill", unpack(hexPts))

  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.polygon("line", unpack(hexPts))

  -- Mouse joint line
  if mouseJointObj then
    love.graphics.setColor(1, 1, 0)
    local tx, ty = mouseJointObj:getTarget()
    love.graphics.line(px, py, tx, ty)
    love.graphics.circle("fill", tx, ty, 4)
  end

  -- HUD
  y = 490
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print(string.format("testPoint: %s", tostring(testPointResult)), 405, y); y = y + 16
  if mouseJointObj then
    love.graphics.setColor(1, 1, 0.4)
    love.graphics.print(string.format("mouseJoint maxForce: %.0f", mouseJointObj:getMaxForce()), 405, y); y = y + 16
  else
    love.graphics.setColor(120/255, 120/255, 120/255)
    love.graphics.print("mouseJoint: none (right-click)", 405, y); y = y + 16
  end
  love.graphics.setColor(1, 0.8, 0.4)
  love.graphics.print(string.format("jointCount: %d", #world:getJoints()), 405, y); y = y + 16
  love.graphics.print(string.format("getJoints().length: %d", #world:getJoints()), 405, y)

  -- Motor/Wheel joint getters (center bottom)
  love.graphics.setColor(60/255, 60/255, 80/255)
  love.graphics.rectangle("line", 275, 290, 115, 200)
  love.graphics.setColor(180/255, 180/255, 200/255)
  love.graphics.print("5: Motor+Wheel", 280, 293)

  -- Motor joint body
  local mbx, mby = motorBody:getPosition()
  love.graphics.setColor(220/255, 100/255, 100/255)
  love.graphics.push()
  love.graphics.translate(mbx, mby)
  love.graphics.rotate(motorBody:getAngle())
  love.graphics.rectangle("fill", -10, -10, 20, 20)
  love.graphics.pop()

  -- Motor anchor
  local max2, may2 = motorAnchor:getPosition()
  love.graphics.setColor(1, 1, 0, 0.5)
  love.graphics.line(max2, may2, mbx, mby)
  love.graphics.circle("fill", max2, may2, 3)

  -- Wheel joint body
  local wbx2, wby2 = wheelBody:getPosition()
  love.graphics.setColor(100/255, 200/255, 100/255)
  love.graphics.circle("fill", wbx2, wby2, 12)
  local wa = wheelBody:getAngle()
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.line(wbx2, wby2, wbx2 + math.cos(wa) * 10, wby2 + math.sin(wa) * 10)

  -- Wheel anchor
  local wa2x, wa2y = wheelAnchor:getPosition()
  love.graphics.setColor(1, 1, 0, 0.5)
  love.graphics.line(wa2x, wa2y, wbx2, wby2)
  love.graphics.circle("fill", wa2x, wa2y, 3)

  -- HUD
  y = 370
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Motor:", 280, y); y = y + 14
  love.graphics.setColor(1, 1, 0.4)
  love.graphics.print(string.format(" mxF:%.0f", motorJointObj:getMaxForce()), 280, y); y = y + 14
  love.graphics.print(string.format(" mxT:%.0f", motorJointObj:getMaxTorque()), 280, y); y = y + 14
  love.graphics.print(string.format(" cor:%.1f", motorJointObj:getCorrectionFactor()), 280, y); y = y + 18
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Wheel:", 280, y); y = y + 14
  love.graphics.setColor(1, 1, 0.4)
  love.graphics.print(" lim:N/A", 280, y); y = y + 14
  love.graphics.print(string.format(" mot:%s", wheelJointObj:isMotorEnabled() and "ON" or "OFF"), 280, y); y = y + 14
  love.graphics.print(string.format(" spd:%.1f", wheelJointObj:getMotorSpeed()), 280, y)

  -- Global HUD
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("M:revolute motor  L:limits  N:prismatic motor  Space:spin  Up/Down:freq  R:reset  ESC:quit", 10, 580)

  love.graphics.setColor(1, 1, 1)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 730, 560)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  elseif key == "m" then
    revJoint:setMotorEnabled(not revJoint:isMotorEnabled())
  elseif key == "l" then
    if not revJoint:areLimitsEnabled() then
      -- Reset arm angle before enabling limits (cumulative angle would be huge)
      revArm:setAngle(0)
      revArm:setAngularVelocity(0)
    end
    revJoint:setLimitsEnabled(not revJoint:areLimitsEnabled())
  elseif key == "n" then
    priJoint:setMotorEnabled(not priJoint:isMotorEnabled())
  elseif key == "space" then
    spinnerBody:applyAngularImpulse(50000)
  elseif key == "up" then
    springFreq = math.min(springFreq + 0.5, 20)
    distJoint:setFrequency(springFreq)
    weldJoint:setFrequency(springFreq)
  elseif key == "down" then
    springFreq = math.max(springFreq - 0.5, 0.5)
    distJoint:setFrequency(springFreq)
    weldJoint:setFrequency(springFreq)
  elseif key == "r" then
    if mouseJointObj then
      mouseJointObj:destroy()
      mouseJointObj = nil
    end
    world:destroy()
    accumulator = 0
    createWorld()
  end
end

function love.mousepressed(x, y, button)
  if button == 2 and not mouseJointObj then
    mouseJointObj = love.physics.newMouseJoint(polyBody, x, y)
    mouseJointObj:setMaxForce(100000)
  end
end

function love.mousereleased(x, y, button)
  if button == 2 and mouseJointObj then
    mouseJointObj:destroy()
    mouseJointObj = nil
  end
end
