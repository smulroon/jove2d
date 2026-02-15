-- love2d ParticleSystem example — fire + smoke
--
-- Fire particles rise upward with orange→red→black fade.
-- Smoke particles drift up slowly with gray→transparent fade.
-- Both systems follow the mouse. Click to burst 50 fire particles.

local fire, smoke
local mouseX, mouseY = 400, 400

function love.load()
  love.window.setTitle("ParticleSystem Example — Fire & Smoke")
  love.graphics.setBackgroundColor(20/255, 20/255, 30/255)

  -- Create a small white particle texture
  local canvas = love.graphics.newCanvas(8, 8)
  love.graphics.setCanvas(canvas)
  love.graphics.clear(0, 0, 0, 0)
  love.graphics.setColor(1, 1, 1)
  love.graphics.circle("fill", 4, 4, 4)
  love.graphics.setCanvas()

  -- Fire system
  fire = love.graphics.newParticleSystem(canvas, 500)
  fire:setParticleLifetime(0.3, 0.8)
  fire:setEmissionRate(200)
  fire:setSpeed(80, 150)
  fire:setDirection(-math.pi / 2)
  fire:setSpread(math.pi / 4)
  fire:setLinearAcceleration(-20, -100, 20, -50)
  fire:setSizes(1.5, 1, 0.3)
  fire:setSizeVariation(0.5)
  fire:setColors(
    1, 220/255, 80/255, 1,
    1, 120/255, 20/255, 1,
    200/255, 40/255, 10/255, 200/255,
    80/255, 20/255, 10/255, 0
  )
  fire:setSpin(-3, 3)
  fire:setPosition(mouseX, mouseY)
  fire:setEmissionArea("normal", 10, 3)
  fire:start()

  -- Smoke system
  smoke = love.graphics.newParticleSystem(canvas, 300)
  smoke:setParticleLifetime(1, 2.5)
  smoke:setEmissionRate(30)
  smoke:setSpeed(20, 50)
  smoke:setDirection(-math.pi / 2)
  smoke:setSpread(math.pi / 6)
  smoke:setLinearAcceleration(-10, -30, 10, -10)
  smoke:setSizes(0.5, 1.5, 2.5)
  smoke:setSizeVariation(0.3)
  smoke:setColors(
    120/255, 120/255, 120/255, 100/255,
    80/255, 80/255, 80/255, 60/255,
    50/255, 50/255, 50/255, 0
  )
  smoke:setSpin(-1, 1)
  smoke:setPosition(mouseX, mouseY - 20)
  smoke:setEmissionArea("normal", 5, 2)
  smoke:start()
end

function love.update(dt)
  fire:moveTo(mouseX, mouseY)
  fire:update(dt)
  smoke:moveTo(mouseX, mouseY - 20)
  smoke:update(dt)
end

function love.draw()
  -- Draw smoke behind fire
  love.graphics.setColor(1, 1, 1)
  love.graphics.setBlendMode("add")
  love.graphics.draw(smoke)

  love.graphics.setColor(1, 1, 1)
  love.graphics.setBlendMode("add")
  love.graphics.draw(fire)

  love.graphics.setBlendMode("alpha")

  -- Info text
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("ParticleSystem Demo — Move mouse, click for burst", 10, 5)
  love.graphics.print(string.format("Fire: %d | Smoke: %d | FPS: %d",
    fire:getCount(), smoke:getCount(), love.timer.getFPS()), 10, 20)
end

function love.mousemoved(x, y)
  mouseX = x
  mouseY = y
end

function love.mousepressed(x, y, button)
  if button == 1 then
    fire:emit(50)
  end
end

function love.keypressed(key)
  if key == "escape" then love.event.quit() end
  if key == "space" then
    if fire:isActive() then
      fire:pause()
      smoke:pause()
    else
      fire:start()
      smoke:start()
    end
  end
end
