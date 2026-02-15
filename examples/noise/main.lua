-- love2d equivalent of noise & math example
-- Demonstrates: love.math.noise, love.math.random, love.math.setRandomSeed,
-- love.math.newRandomGenerator, love.math.triangulate, love.math.isConvex

local t = 0
local seed = 42

-- Pre-generate random polygon for triangulation demo
local polyVerts = {200, 420, 280, 390, 340, 430, 320, 490, 240, 510, 180, 470}

function love.load()
  love.window.setTitle("Math & Noise Example")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(10/255, 10/255, 20/255)
  love.math.setRandomSeed(seed)
end

function love.update(dt)
  t = t + dt
end

function love.draw()
  -- --- 2D Simplex noise field (scrolling) ---
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("2D Simplex noise (scrolling)", 10, 10)

  local scale = 0.04
  local cellSize = 4
  local cols = 180
  local rows = 80

  for y = 0, rows - 1 do
    for x = 0, cols - 1 do
      local n = love.math.noise(x * scale + t * 0.3, y * scale + t * 0.1)
      -- love.math.noise returns [0,1] in love2d (unlike jove which returns [-1,1])
      local v = n * 255
      love.graphics.setColor(v/255, v * 0.7/255, v * 0.4/255)
      love.graphics.points(10 + x * cellSize, 30 + y * cellSize)
    end
  end

  -- --- 1D noise wave ---
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("1D noise wave", 10, 365)

  love.graphics.setColor(100/255, 200/255, 1)
  for x = 0, 349 do
    local n = love.math.noise((x + t * 50) * 0.02)
    -- Map from [0,1] to [-1,1] range for wave display
    local ny = 400 + (n - 0.5) * 60
    love.graphics.points(10 + x, ny)
  end

  -- --- Random distribution visualization ---
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print(string.format("RNG (seed: %d, R to re-seed)", seed), 400, 365)

  -- Use an independent random generator for the visualization
  local rng = love.math.newRandomGenerator(seed)
  love.graphics.setColor(1, 100/255, 100/255, 180/255)
  for i = 1, 200 do
    local x = rng:random() * 350
    local y = rng:random() * 100
    love.graphics.points(400 + x, 385 + y)
  end

  -- Normal distribution dots
  love.graphics.setColor(100/255, 1, 100/255, 180/255)
  for i = 1, 200 do
    local x = rng:randomNormal(50, 175)
    local y = rng:randomNormal(15, 50)
    if x >= 0 and x <= 350 and y >= 0 and y <= 100 then
      love.graphics.points(400 + x, 385 + y)
    end
  end

  -- --- Polygon triangulation demo ---
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("triangulate + isConvex", 400, 30)

  local isConvex = love.math.isConvex(polyVerts)
  love.graphics.print("Convex: " .. tostring(isConvex), 400, 50)

  -- Draw the polygon outline
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.polygon("line", polyVerts)

  -- Draw the triangulation
  local triangles = love.math.triangulate(polyVerts)
  local colors = {
    {1, 100/255, 100/255},
    {100/255, 1, 100/255},
    {100/255, 100/255, 1},
    {1, 1, 100/255},
    {1, 100/255, 1},
    {100/255, 1, 1},
  }

  for i, tri in ipairs(triangles) do
    local c = colors[((i - 1) % #colors) + 1]
    love.graphics.setColor(c[1], c[2], c[3], 80/255)
    love.graphics.polygon("fill", tri)
  end

  -- --- 3D noise time slice ---
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("3D noise (z = time)", 400, 170)

  for y = 0, 39 do
    for x = 0, 89 do
      local n = love.math.noise(x * 0.08, y * 0.08, t * 0.2)
      local v = n * 255
      love.graphics.setColor(v * 0.3/255, v * 0.6/255, v/255)
      love.graphics.points(400 + x * 4, 190 + y * 4)
    end
  end

  -- --- HUD ---
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 570)
  love.graphics.print(string.format("time: %.1fs", t), 10, 570)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
  if key == "r" then
    seed = math.floor(math.random() * 10000)
    love.math.setRandomSeed(seed)
  end
end
