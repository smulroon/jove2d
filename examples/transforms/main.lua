-- love2d equivalent of transform example
-- Demonstrates: nested push/pop, translate, rotate, scale, shear

local t = 0

function love.load()
  love.window.setTitle("Transform Stack")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(25/255, 25/255, 40/255)
end

function love.update(dt)
  t = t + dt
end

local earthScreenX, earthScreenY = 0, 0

function love.draw()
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Nested transforms: solar system model", 10, 10)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 10)
  love.graphics.print("Stack depth: " .. love.graphics.getStackDepth(), 700, 30)

  -- --- Solar system: nested rotations ---

  -- Sun at center
  love.graphics.push()
  love.graphics.translate(400, 280)

  -- Sun body (slowly rotating)
  love.graphics.push()
  love.graphics.rotate(t * 0.2)
  love.graphics.setColor(1, 200/255, 50/255)
  love.graphics.circle("fill", 0, 0, 40)
  -- Sun rays
  love.graphics.setColor(1, 220/255, 100/255)
  for i = 0, 7 do
    love.graphics.push()
    love.graphics.rotate(i * math.pi / 4)
    love.graphics.line(45, 0, 55, 0)
    love.graphics.pop()
  end
  love.graphics.pop()

  -- Earth orbit
  love.graphics.setColor(60/255, 60/255, 80/255)
  love.graphics.circle("line", 0, 0, 120)

  -- Earth
  love.graphics.push()
  love.graphics.rotate(t * 0.5) -- Orbit speed
  love.graphics.translate(120, 0) -- Orbit radius

  -- Earth body -- show screen position via transformPoint
  love.graphics.setColor(50/255, 130/255, 1)
  love.graphics.circle("fill", 0, 0, 15)
  earthScreenX, earthScreenY = love.graphics.transformPoint(0, 0)

  -- Moon orbit
  love.graphics.setColor(50/255, 50/255, 70/255)
  love.graphics.circle("line", 0, 0, 30)

  -- Moon
  love.graphics.push()
  love.graphics.rotate(t * 2.0) -- Moon orbits faster
  love.graphics.translate(30, 0)
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.circle("fill", 0, 0, 5)
  love.graphics.pop() -- moon

  love.graphics.pop() -- earth

  -- Mars orbit
  love.graphics.setColor(60/255, 60/255, 80/255)
  love.graphics.circle("line", 0, 0, 200)

  -- Mars
  love.graphics.push()
  love.graphics.rotate(t * 0.3)
  love.graphics.translate(200, 0)
  love.graphics.setColor(220/255, 100/255, 50/255)
  love.graphics.circle("fill", 0, 0, 10)

  -- Mars moons
  love.graphics.push()
  love.graphics.rotate(t * 3.0)
  love.graphics.translate(18, 0)
  love.graphics.setColor(180/255, 150/255, 130/255)
  love.graphics.circle("fill", 0, 0, 3)
  love.graphics.pop()

  love.graphics.push()
  love.graphics.rotate(-t * 2.5)
  love.graphics.translate(25, 0)
  love.graphics.setColor(160/255, 140/255, 120/255)
  love.graphics.circle("fill", 0, 0, 2)
  love.graphics.pop()

  love.graphics.pop() -- mars

  love.graphics.pop() -- sun center

  -- Show Earth's screen coords (computed via transformPoint above)
  love.graphics.setColor(150/255, 200/255, 1)
  love.graphics.print(string.format("Earth screen pos: %.0f, %.0f", earthScreenX, earthScreenY), 10, 30)

  -- --- Shear demo ---
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("Shear:", 10, 520)

  for i = 0, 4 do
    love.graphics.push()
    love.graphics.translate(80 + i * 80, 550)
    love.graphics.shear(math.sin(t + i * 0.5) * 0.5, 0)
    local hue = (i / 5) * 255
    love.graphics.setColor(1, hue/255, (255 - hue)/255)
    love.graphics.rectangle("fill", -15, -15, 30, 30)
    love.graphics.pop()
  end

  -- --- Scale animation ---
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("Scale:", 500, 520)

  for i = 0, 3 do
    love.graphics.push()
    love.graphics.translate(560 + i * 60, 555)
    local s = 0.5 + math.abs(math.sin(t * 2 + i * 0.8)) * 0.8
    love.graphics.scale(s)
    love.graphics.setColor((100 + i * 40)/255, 200/255, (255 - i * 40)/255)
    love.graphics.circle("fill", 0, 0, 12)
    love.graphics.pop()
  end
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
