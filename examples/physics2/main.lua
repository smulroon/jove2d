-- love2d Physics Phase 2 example
-- Demonstrates: WheelJoint (car), MotorJoint (tracker), joint anchors,
-- reaction force, contact point + approach speed
-- Hard-coded motor offset for stabilization comparison

local world
local ground, rampBody
local chassis, wheelL, wheelR
local wheelJointL, wheelJointR
local trackerAnchor, trackerBody, motorJoint

local GROUND_Y = 450
local CAR_X = 200
local CAR_Y = 380

-- Hard-coded motor target (absolute position)
local TARGET_X = 700
local TARGET_Y = 350

-- Contact flash at exact point with intensity
local flashes = {}

-- Track key state for HUD
local driving = 0

-- Elapsed timer
local elapsed = 0

function love.load()
  love.window.setTitle("Physics Phase 2 — love2d")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(20/255, 20/255, 30/255)
  love.physics.setMeter(30)

  world = love.physics.newWorld(0, 9.81 * 30, true)

  -- Contact callback with point + speed (postSolve is 4th callback)
  world:setCallbacks(nil, nil, nil, function(a, b, contact, ni1, ti1, ni2, ti2)
    local x1, y1 = contact:getPositions()
    if x1 and y1 then
      local speed = math.abs(ni1 or 0)
      if speed > 0.5 then
        table.insert(flashes, { x = x1, y = y1, speed = math.min(speed, 20), timer = 0.3 })
      end
    end
  end)

  -- Ground (flat)
  ground = love.physics.newBody(world, 400, GROUND_Y, "static")
  local groundShape = love.physics.newRectangleShape(800, 20)
  love.physics.newFixture(ground, groundShape, 1)

  -- Ramp
  rampBody = love.physics.newBody(world, 500, GROUND_Y - 30, "static")
  local rampShape = love.physics.newPolygonShape(-80, 30, 80, 30, 80, -10)
  local rampFix = love.physics.newFixture(rampBody, rampShape, 1)
  rampFix:setFriction(0.8)

  -- === Car with WheelJoints ===
  -- Chassis
  chassis = love.physics.newBody(world, CAR_X, CAR_Y, "dynamic")
  local chassisShape = love.physics.newRectangleShape(80, 20)
  local chassisFix = love.physics.newFixture(chassis, chassisShape, 2)
  chassisFix:setFriction(0.3)

  -- Left wheel
  wheelL = love.physics.newBody(world, CAR_X - 30, CAR_Y + 20, "dynamic")
  local wheelShapeL = love.physics.newCircleShape(12)
  local wheelFixL = love.physics.newFixture(wheelL, wheelShapeL, 1)
  wheelFixL:setFriction(1.0)

  -- Right wheel
  wheelR = love.physics.newBody(world, CAR_X + 30, CAR_Y + 20, "dynamic")
  local wheelShapeR = love.physics.newCircleShape(12)
  local wheelFixR = love.physics.newFixture(wheelR, wheelShapeR, 1)
  wheelFixR:setFriction(1.0)

  -- Wheel joints (axis = vertical for suspension)
  wheelJointL = love.physics.newWheelJoint(chassis, wheelL, CAR_X - 30, CAR_Y + 20, 0, 1, false)
  wheelJointL:setSpringFrequency(4.0)
  wheelJointL:setSpringDampingRatio(0.7)
  wheelJointL:setMaxMotorTorque(1000)
  wheelJointL:setMotorSpeed(0)
  wheelJointL:setMotorEnabled(true)

  wheelJointR = love.physics.newWheelJoint(chassis, wheelR, CAR_X + 30, CAR_Y + 20, 0, 1, false)
  wheelJointR:setSpringFrequency(4.0)
  wheelJointR:setSpringDampingRatio(0.7)
  wheelJointR:setMaxMotorTorque(1000)
  wheelJointR:setMotorSpeed(0)
  wheelJointR:setMotorEnabled(true)

  -- === Motor Joint (tracker) ===
  trackerAnchor = love.physics.newBody(world, 600, 200, "static")

  trackerBody = love.physics.newBody(world, 600, 200, "dynamic")
  trackerBody:setGravityScale(0)
  local trackerShape = love.physics.newRectangleShape(40, 40)
  local trackerFix = love.physics.newFixture(trackerBody, trackerShape, 1)
  trackerFix:setFriction(0.3)

  motorJoint = love.physics.newMotorJoint(trackerAnchor, trackerBody, 0.3)
  motorJoint:setMaxForce(500)
  motorJoint:setMaxTorque(200)

  -- Set hard-coded offset immediately
  local ax, ay = trackerAnchor:getPosition()
  motorJoint:setLinearOffset(TARGET_X - ax, TARGET_Y - ay)
end

function love.update(dt)
  elapsed = elapsed + dt

  -- Drive car with arrow keys
  driving = 0
  if love.keyboard.isDown("right") then driving = 1 end
  if love.keyboard.isDown("left") then driving = -1 end
  wheelJointL:setMotorSpeed(driving * 15)
  wheelJointR:setMotorSpeed(driving * 15)

  -- Motor joint offset is fixed — no mouse tracking

  world:update(dt)

  -- Fade flashes
  for i = #flashes, 1, -1 do
    flashes[i].timer = flashes[i].timer - dt
    if flashes[i].timer <= 0 then
      table.remove(flashes, i)
    end
  end
end

function love.draw()
  -- === Ground & Ramp ===
  love.graphics.setColor(80/255, 80/255, 80/255)
  local gx, gy = ground:getPosition()
  love.graphics.rectangle("fill", gx - 400, gy - 10, 800, 20)

  -- Ramp (draw as polygon)
  love.graphics.setColor(100/255, 80/255, 60/255)
  love.graphics.push()
  love.graphics.translate(rampBody:getPosition())
  love.graphics.polygon("fill", -80, 30, 80, 30, 80, -10)
  love.graphics.pop()

  -- === Car ===
  -- Chassis
  love.graphics.setColor(100/255, 150/255, 220/255)
  love.graphics.push()
  love.graphics.translate(chassis:getPosition())
  love.graphics.rotate(chassis:getAngle())
  love.graphics.rectangle("fill", -40, -10, 80, 20)
  love.graphics.pop()

  -- Wheels
  love.graphics.setColor(60/255, 60/255, 60/255)
  local wlx, wly = wheelL:getPosition()
  love.graphics.circle("fill", wlx, wly, 12)
  local wrx, wry = wheelR:getPosition()
  love.graphics.circle("fill", wrx, wry, 12)

  -- Wheel spokes (show rotation)
  love.graphics.setColor(200/255, 200/255, 200/255)
  local alL = wheelL:getAngle()
  love.graphics.line(wlx, wly, wlx + math.cos(alL) * 10, wly + math.sin(alL) * 10)
  local alR = wheelR:getAngle()
  love.graphics.line(wrx, wry, wrx + math.cos(alR) * 10, wry + math.sin(alR) * 10)

  -- Joint anchors (small dots)
  love.graphics.setColor(1, 1, 0)
  local a1x, a1y, b1x, b1y = wheelJointL:getAnchors()
  love.graphics.circle("fill", a1x, a1y, 3)
  love.graphics.circle("fill", b1x, b1y, 3)
  local a2x, a2y, b2x, b2y = wheelJointR:getAnchors()
  love.graphics.circle("fill", a2x, a2y, 3)
  love.graphics.circle("fill", b2x, b2y, 3)

  -- Suspension lines (anchor A to anchor B)
  love.graphics.setColor(1, 1, 0, 0.5)
  love.graphics.line(a1x, a1y, b1x, b1y)
  love.graphics.line(a2x, a2y, b2x, b2y)

  -- === Motor Joint Tracker ===
  -- Target crosshair (fixed position)
  love.graphics.setColor(1, 0.4, 0.4, 0.5)
  love.graphics.circle("line", TARGET_X, TARGET_Y, 15)
  love.graphics.line(TARGET_X - 10, TARGET_Y, TARGET_X + 10, TARGET_Y)
  love.graphics.line(TARGET_X, TARGET_Y - 10, TARGET_X, TARGET_Y + 10)

  -- Tracker body
  love.graphics.setColor(220/255, 100/255, 100/255)
  love.graphics.push()
  love.graphics.translate(trackerBody:getPosition())
  love.graphics.rotate(trackerBody:getAngle())
  love.graphics.rectangle("fill", -20, -20, 40, 40)
  love.graphics.pop()

  -- Motor joint anchor
  love.graphics.setColor(1, 0.8, 0)
  local ma1x, ma1y, ma2x, ma2y = motorJoint:getAnchors()
  love.graphics.circle("fill", ma1x, ma1y, 4)
  love.graphics.circle("fill", ma2x, ma2y, 4)
  love.graphics.line(ma1x, ma1y, ma2x, ma2y)

  -- === Contact flashes ===
  for _, flash in ipairs(flashes) do
    local alpha = flash.timer / 0.3
    local r = math.min(flash.speed / 5, 4) + 3
    love.graphics.setColor(1, 1, 0.5, alpha)
    love.graphics.circle("fill", flash.x, flash.y, r)
  end

  -- === HUD ===
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Physics Phase 2 — WheelJoint + MotorJoint", 10, 10)
  love.graphics.print("Arrow keys: drive car   |   R: reset   |   ESC: quit", 10, 30)

  -- Timer
  love.graphics.setColor(1, 1, 0.4)
  love.graphics.print(string.format("Time: %.2fs", elapsed), 10, 50)

  -- Tracker distance to target
  local tbx, tby = trackerBody:getPosition()
  local dist = math.sqrt((tbx - TARGET_X)^2 + (tby - TARGET_Y)^2)
  love.graphics.print(string.format("Tracker dist to target: %.1f px", dist), 10, 70)

  -- Reaction force on left wheel joint (inverseDt = 60 for 1/60s timestep)
  love.graphics.setColor(200/255, 200/255, 200/255)
  local rfx, rfy = wheelJointL:getReactionForce(60)
  love.graphics.print(string.format("Left wheel reaction: (%.1f, %.1f)", rfx, rfy), 10, 90)

  -- Spring info
  love.graphics.print(string.format("Spring: %.1f Hz, damping %.1f",
    wheelJointL:getSpringFrequency(), wheelJointL:getSpringDampingRatio()), 10, 110)

  -- Motor joint offset
  local ox, oy = motorJoint:getLinearOffset()
  love.graphics.print(string.format("Motor offset: (%.0f, %.0f)", ox, oy), 10, 130)

  -- Driving indicator
  local driveText = "IDLE"
  if driving > 0 then driveText = ">>> RIGHT >>>"
  elseif driving < 0 then driveText = "<<< LEFT <<<"
  end
  love.graphics.print("Drive: " .. driveText, 10, 150)

  love.graphics.setColor(1, 1, 1)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 570)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  elseif key == "r" then
    elapsed = 0
    chassis:setPosition(CAR_X, CAR_Y)
    chassis:setAngle(0)
    chassis:setLinearVelocity(0, 0)
    chassis:setAngularVelocity(0)
    wheelL:setPosition(CAR_X - 30, CAR_Y + 20)
    wheelL:setAngle(0)
    wheelL:setLinearVelocity(0, 0)
    wheelL:setAngularVelocity(0)
    wheelR:setPosition(CAR_X + 30, CAR_Y + 20)
    wheelR:setAngle(0)
    wheelR:setLinearVelocity(0, 0)
    wheelR:setAngularVelocity(0)
    -- Reset tracker
    trackerBody:setPosition(600, 200)
    trackerBody:setLinearVelocity(0, 0)
    trackerBody:setAngularVelocity(0)
  end
end
