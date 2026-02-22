-- love2d equivalent of the mesh example
-- Demonstrates: colored triangle, textured quad, vertex map, draw modes, transforms, wrap mode
-- Press W to toggle wrap mode on the tiling quad (clamp vs repeat)

local triMesh, quadMesh, starMesh, stripMesh, tileMesh
local canvas
local wrapRepeat = false
local time = 0

function love.load()
  love.window.setTitle("Mesh Example")
  love.graphics.setBackgroundColor(25/255, 25/255, 35/255)

  -- 1. Colored triangle (untextured, fan mode)
  triMesh = love.graphics.newMesh({
    {0,   -80, 0, 0, 1, 0.2, 0.2, 1},   -- top red
    {80,   60, 0, 0, 0.2, 1, 0.2, 1},   -- bottom-right green
    {-80,  60, 0, 0, 0.2, 0.2, 1, 1},   -- bottom-left blue
  }, "fan")

  -- 2. Textured quad with vertex map
  canvas = love.graphics.newCanvas(64, 64)
  love.graphics.setCanvas(canvas)
  for y = 0, 3 do
    for x = 0, 3 do
      if (x + y) % 2 == 0 then
        love.graphics.setColor(200/255, 100/255, 50/255)
      else
        love.graphics.setColor(50/255, 100/255, 200/255)
      end
      love.graphics.rectangle("fill", x * 16, y * 16, 16, 16)
    end
  end
  love.graphics.setCanvas()

  quadMesh = love.graphics.newMesh(4, "triangles")
  quadMesh:setVertex(1, 0, 0, 0, 0, 1, 1, 1, 1)
  quadMesh:setVertex(2, 120, 0, 1, 0, 1, 1, 1, 1)
  quadMesh:setVertex(3, 120, 120, 1, 1, 1, 1, 1, 1)
  quadMesh:setVertex(4, 0, 120, 0, 1, 1, 1, 1, 1)
  quadMesh:setVertexMap(1, 2, 3, 1, 3, 4)
  quadMesh:setTexture(canvas)

  -- 3. Star shape (fan mode)
  starMesh = love.graphics.newMesh(11, "fan")
  starMesh:setVertex(1, 0, 0, 0, 0, 1, 1, 0.5, 1) -- center
  for i = 0, 9 do
    local angle = (i / 10) * math.pi * 2 - math.pi / 2
    local radius = i % 2 == 0 and 70 or 35
    local x = math.cos(angle) * radius
    local y = math.sin(angle) * radius
    local r = i % 2 == 0 and 1 or 0.8
    local g = i % 2 == 0 and 0.8 or 0.4
    starMesh:setVertex(i + 2, x, y, 0, 0, r, g, 0.1, 1)
  end

  -- 4. Triangle strip — wavy ribbon
  local stripVerts = {}
  for i = 0, 19 do
    local x = i * 15
    local yOff = i % 2 == 0 and 0 or 30
    local t = i / 19
    table.insert(stripVerts, {x, yOff, 0, 0, t, 0.5 + t * 0.5, 1 - t, 1})
  end
  stripMesh = love.graphics.newMesh(stripVerts, "strip")

  -- 5b. Tiling textured quad — UVs go to 3x3, wrap mode toggleable
  tileMesh = love.graphics.newMesh(4, "triangles")
  tileMesh:setVertex(1, 0, 0, 0, 0, 1, 1, 1, 1)
  tileMesh:setVertex(2, 150, 0, 3, 0, 1, 1, 1, 1)
  tileMesh:setVertex(3, 150, 150, 3, 3, 1, 1, 1, 1)
  tileMesh:setVertex(4, 0, 150, 0, 3, 1, 1, 1, 1)
  tileMesh:setVertexMap(1, 2, 3, 1, 3, 4)
  tileMesh:setTexture(canvas)
end

function love.update(dt)
  time = time + dt
end

function love.draw()
  love.graphics.setColor(1, 1, 1)

  -- Title
  love.graphics.print("=== Mesh Example ===", 20, 10)

  -- 1. Colored triangle with rotation
  love.graphics.print("Colored Triangle (fan)", 20, 40)
  love.graphics.push()
  love.graphics.translate(150, 180)
  love.graphics.rotate(time * 0.5)
  love.graphics.draw(triMesh)
  love.graphics.pop()

  -- 2. Textured quad
  love.graphics.print("Textured Quad (vertex map)", 320, 40)
  love.graphics.draw(quadMesh, 350, 60)

  -- 3. Star (fan)
  love.graphics.print("Star (fan)", 550, 40)
  love.graphics.push()
  love.graphics.translate(630, 150)
  love.graphics.rotate(-time * 0.3)
  local s = 1 + math.sin(time * 2) * 0.15
  love.graphics.scale(s, s)
  love.graphics.draw(starMesh)
  love.graphics.pop()

  -- 4. Triangle strip
  love.graphics.print("Triangle Strip", 20, 290)
  love.graphics.draw(stripMesh, 20, 320)

  -- 5b. Tiling quad with wrap mode toggle
  local wrapLabel = wrapRepeat and "repeat" or "clamp"
  love.graphics.print("Tiling Quad — wrap: " .. wrapLabel .. " (W to toggle)", 320, 230)
  love.graphics.draw(tileMesh, 350, 250)

  -- 6. Dynamic mesh — sine wave
  love.graphics.print("Dynamic Sine Wave (strip)", 20, 400)
  local dynMesh = love.graphics.newMesh(40, "strip")
  for i = 0, 19 do
    local x = i * 18
    local yBase = math.sin(time * 3 + i * 0.4) * 30
    dynMesh:setVertex(i * 2 + 1, x, 460 + yBase - 15, 0, 0, 0.3, 0.8, 1, 1)
    dynMesh:setVertex(i * 2 + 2, x, 460 + yBase + 15, 0, 0, 0.1, 0.3, 0.8, 1)
  end
  love.graphics.draw(dynMesh)

  -- Info
  love.graphics.setColor(150/255, 150/255, 150/255)
  love.graphics.print(string.format("FPS: %d", love.timer.getFPS()), 20, 560)
  love.graphics.print("ESC to quit", 20, 580)
end

function love.keypressed(key)
  if key == "w" then
    wrapRepeat = not wrapRepeat
    canvas:setWrap(wrapRepeat and "repeat" or "clamp")
  end
  if key == "escape" then
    love.event.quit()
  end
end
