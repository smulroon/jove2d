-- love2d benchmark — "Chaos Box" stress test
-- Physics bodies fall under gravity, particle bursts on collision, tiled background, audio
-- Compare frame times side-by-side with jove2d equivalent

local W, H = 800, 600
local MAX_BODIES = 300
local WALL = 15
local TILE_SIZE = 32
local GRID_W = math.ceil(W / TILE_SIZE) -- 25
local GRID_H = math.ceil(H / TILE_SIZE) -- 19
local PARTICLE_POOL = 8
local MAX_SOUNDS = 5
local FRAME_HISTORY = 120
local FIXED_DT = 1 / 60
local physicsAccum = 0

local world
local bodies = {}
local bumpSource = nil
local soundPool = {}
local batch = nil
local particles = {}
local particleIdx = 1
local spawning = true
local spawnRate = 20
local spawnAccum = 0
local muted = false
local frameTimes = {}
local frameIdx = 1
local totalParticles = 0

for i = 1, FRAME_HISTORY do frameTimes[i] = 0 end

-- Generate short bump WAV (0.05s 440Hz sine with exponential decay)
local function generateBumpWav()
  local sampleRate = 44100
  local duration = 0.05
  local numSamples = math.floor(sampleRate * duration)
  local dataSize = numSamples * 2
  local fileSize = 44 + dataSize

  local bytes = {}

  local function writeU16(val)
    bytes[#bytes+1] = string.char(val % 256)
    bytes[#bytes+1] = string.char(math.floor(val / 256) % 256)
  end
  local function writeU32(val)
    bytes[#bytes+1] = string.char(val % 256)
    bytes[#bytes+1] = string.char(math.floor(val / 256) % 256)
    bytes[#bytes+1] = string.char(math.floor(val / 65536) % 256)
    bytes[#bytes+1] = string.char(math.floor(val / 16777216) % 256)
  end
  local function writeTag(tag)
    for i = 1, #tag do bytes[#bytes+1] = tag:sub(i, i) end
  end

  writeTag("RIFF")
  writeU32(fileSize - 8)
  writeTag("WAVE")
  writeTag("fmt ")
  writeU32(16)
  writeU16(1) -- PCM
  writeU16(1) -- mono
  writeU32(sampleRate)
  writeU32(sampleRate * 2)
  writeU16(2)
  writeU16(16)
  writeTag("data")
  writeU32(dataSize)

  for i = 0, numSamples - 1 do
    local t = i / sampleRate
    local envelope = math.exp(-t * 60)
    local sample = envelope * math.sin(2 * math.pi * 440 * t)
    local s16 = math.max(-32768, math.min(32767, math.floor(sample * 32767)))
    if s16 < 0 then s16 = s16 + 65536 end
    writeU16(s16)
  end

  return table.concat(bytes)
end

local function spawnBody(x, y)
  local isCircle = math.random() > 0.4
  local color = {
    100 + math.floor(math.random() * 155),
    100 + math.floor(math.random() * 155),
    100 + math.floor(math.random() * 155),
  }

  if isCircle then
    local r = 8 + math.random() * 7
    local body = love.physics.newBody(world, x, y, "dynamic")
    local shape = love.physics.newCircleShape(r)
    local fix = love.physics.newFixture(body, shape, 1.0)
    fix:setRestitution(0.4 + math.random() * 0.4)
    fix:setFriction(0.3)
    table.insert(bodies, { body = body, kind = "circle", size = r, color = color })
  else
    local s = 10 + math.random() * 10
    local body = love.physics.newBody(world, x, y, "dynamic")
    local shape = love.physics.newRectangleShape(s, s)
    local fix = love.physics.newFixture(body, shape, 1.0)
    fix:setRestitution(0.3 + math.random() * 0.3)
    fix:setFriction(0.4)
    table.insert(bodies, { body = body, kind = "box", size = s, color = color })
  end
end

function love.load()
  love.window.setTitle("Benchmark — love2d")
  love.graphics.setBackgroundColor(20/255, 20/255, 30/255)

  -- Audio (may be disabled via conf.lua for WSL2)
  if love.audio then
    local wavData = generateBumpWav()
    love.filesystem.write("benchmark-bump.wav", wavData)
    bumpSource = love.audio.newSource("benchmark-bump.wav", "static")
    if bumpSource then
      for i = 1, MAX_SOUNDS do
        soundPool[i] = bumpSource:clone()
      end
    end
  end

  -- Physics world + walls
  world = love.physics.newWorld(0, 9.81 * 30, true)

  -- Ground
  local ground = love.physics.newBody(world, W/2, H - WALL/2, "static")
  love.physics.newFixture(ground, love.physics.newRectangleShape(W, WALL))
  -- Ceiling
  local ceiling = love.physics.newBody(world, W/2, WALL/2, "static")
  love.physics.newFixture(ceiling, love.physics.newRectangleShape(W, WALL))
  -- Left
  local left = love.physics.newBody(world, WALL/2, H/2, "static")
  love.physics.newFixture(left, love.physics.newRectangleShape(WALL, H))
  -- Right
  local right = love.physics.newBody(world, W - WALL/2, H/2, "static")
  love.physics.newFixture(right, love.physics.newRectangleShape(WALL, H))

  -- Contact callback
  world:setCallbacks(function(a, b, coll)
    local bA = a:getBody()
    local bB = b:getBody()
    if bA:getType() == "static" and bB:getType() == "static" then return end
    local ax, ay = bA:getPosition()
    local bx, by = bB:getPosition()
    local mx, my = (ax + bx) / 2, (ay + by) / 2

    -- Emit particles
    if #particles > 0 then
      local ps = particles[((particleIdx - 1) % #particles) + 1]
      ps:setPosition(mx, my)
      ps:emit(20)
      ps:start()
      particleIdx = particleIdx + 1
    end

    -- Play sound (reuse from pool)
    if not muted and #soundPool > 0 then
      for _, s in ipairs(soundPool) do
        if not s:isPlaying() then
          s:setPitch(0.8 + math.random() * 0.6)
          s:setVolume(0.3)
          s:play()
          break
        end
      end
    end
  end)

  -- Tileset + SpriteBatch
  local tileset = love.graphics.newCanvas(128, 128)
  love.graphics.setCanvas(tileset)
  love.graphics.clear(0, 0, 0, 0)
  local colors = {{45, 45, 55}, {40, 40, 50}, {50, 50, 60}, {35, 35, 45}}
  for i, c in ipairs(colors) do
    local tx = ((i - 1) % 2) * 32
    local ty = math.floor((i - 1) / 2) * 32
    love.graphics.setColor(c[1]/255, c[2]/255, c[3]/255)
    love.graphics.rectangle("fill", tx, ty, 32, 32)
    love.graphics.setColor((c[1]+15)/255, (c[2]+15)/255, (c[3]+15)/255)
    love.graphics.rectangle("line", tx + 1, ty + 1, 30, 30)
  end
  love.graphics.setCanvas()

  local quads = {
    love.graphics.newQuad(0, 0, 32, 32, 128, 128),
    love.graphics.newQuad(32, 0, 32, 32, 128, 128),
    love.graphics.newQuad(0, 32, 32, 32, 128, 128),
    love.graphics.newQuad(32, 32, 32, 32, 128, 128),
  }

  batch = love.graphics.newSpriteBatch(tileset, GRID_W * GRID_H)
  for y = 0, GRID_H - 1 do
    for x = 0, GRID_W - 1 do
      local tileIdx = ((x + y) % 4) + 1
      batch:add(quads[tileIdx], x * TILE_SIZE, y * TILE_SIZE)
    end
  end

  -- Particle image (8x8 white circle)
  local particleImg = love.graphics.newCanvas(8, 8)
  love.graphics.setCanvas(particleImg)
  love.graphics.clear(0, 0, 0, 0)
  love.graphics.setColor(1, 1, 1)
  love.graphics.circle("fill", 4, 4, 4)
  love.graphics.setCanvas()

  -- Particle pool
  for i = 1, PARTICLE_POOL do
    local ps = love.graphics.newParticleSystem(particleImg, 40)
    ps:setParticleLifetime(0.2, 0.4)
    ps:setEmissionRate(0)
    ps:setSpeed(60, 150)
    ps:setDirection(0)
    ps:setSpread(math.pi * 2)
    ps:setLinearAcceleration(-20, -40, 20, 40)
    ps:setSizes(1.2, 0.5, 0)
    ps:setSizeVariation(0.3)
    ps:setColors(
      1, 220/255, 80/255, 1,
      1, 120/255, 30/255, 200/255,
      200/255, 40/255, 10/255, 0
    )
    ps:setSpin(-4, 4)
    table.insert(particles, ps)
  end
end

function love.update(dt)
  -- Record frame time
  frameTimes[((frameIdx - 1) % FRAME_HISTORY) + 1] = dt
  frameIdx = frameIdx + 1

  -- Physics (fixed timestep)
  physicsAccum = physicsAccum + dt
  while physicsAccum >= FIXED_DT do
    world:update(FIXED_DT)
    physicsAccum = physicsAccum - FIXED_DT
  end

  -- Auto-spawn
  if spawning then
    spawnAccum = spawnAccum + dt
    local interval = 1 / spawnRate
    while spawnAccum >= interval do
      spawnAccum = spawnAccum - interval
      spawnBody(WALL + 20 + math.random() * (W - WALL * 2 - 40), WALL + 20)
    end
  end

  -- Cap bodies
  while #bodies > MAX_BODIES do
    bodies[1].body:destroy()
    table.remove(bodies, 1)
  end

  -- Update particles
  totalParticles = 0
  for _, ps in ipairs(particles) do
    ps:update(dt)
    totalParticles = totalParticles + ps:getCount()
  end
end

function love.draw()
  -- 1. Tiled background
  if batch then
    love.graphics.setColor(1, 1, 1)
    love.graphics.draw(batch)
  end

  -- 2. Physics bodies
  for _, b in ipairs(bodies) do
    local bx, by = b.body:getPosition()
    love.graphics.setColor(b.color[1]/255, b.color[2]/255, b.color[3]/255)
    if b.kind == "circle" then
      love.graphics.circle("fill", bx, by, b.size)
    else
      love.graphics.push()
      love.graphics.translate(bx, by)
      love.graphics.rotate(b.body:getAngle())
      love.graphics.rectangle("fill", -b.size/2, -b.size/2, b.size, b.size)
      love.graphics.pop()
    end
  end

  -- 3. Particles (additive)
  love.graphics.setBlendMode("add")
  love.graphics.setColor(1, 1, 1)
  for _, ps in ipairs(particles) do
    if ps:getCount() > 0 then
      love.graphics.draw(ps)
    end
  end
  love.graphics.setBlendMode("alpha")

  -- 4. HUD
  drawHUD()
end

function drawHUD()
  local fps = love.timer.getFPS()
  local avgDt = love.timer.getAverageDelta()
  local activeSounds = love.audio and love.audio.getActiveSourceCount() or 0

  -- Min/max over history
  local minDt, maxDt = math.huge, 0
  local count = math.min(frameIdx - 1, FRAME_HISTORY)
  for i = 1, count do
    local dt = frameTimes[i]
    if dt < minDt then minDt = dt end
    if dt > maxDt then maxDt = dt end
  end

  -- Background panel
  love.graphics.setColor(0, 0, 0, 180/255)
  love.graphics.rectangle("fill", 5, 5, 220, 120)

  love.graphics.setColor(1, 1, 1)
  love.graphics.print(string.format("FPS: %d  avg: %.1fms", fps, avgDt * 1000), 10, 8)
  love.graphics.print(string.format("Bodies: %d/%d", #bodies, MAX_BODIES), 10, 22)
  love.graphics.print(string.format("Particles: %d  Sounds: %d", totalParticles, activeSounds), 10, 36)
  love.graphics.print(string.format("Spawn: %d/s %s", spawnRate, spawning and "(ON)" or "(OFF)"), 10, 50)
  if count > 0 then
    love.graphics.print(string.format("dt: min %.1f max %.1fms", minDt * 1000, maxDt * 1000), 10, 64)
  end
  love.graphics.setColor(150/255, 150/255, 150/255)
  love.graphics.print("SPACE:spawn UP/DN:rate R:reset", 10, 82)
  love.graphics.print(string.format("Click:burst M:mute%s ESC:quit", muted and "(ON)" or ""), 10, 96)

  -- Frame time bar graph (bottom-right)
  local graphX = W - FRAME_HISTORY - 10
  local graphY = H - 70
  local graphH = 60

  love.graphics.setColor(0, 0, 0, 160/255)
  love.graphics.rectangle("fill", graphX - 2, graphY - 2, FRAME_HISTORY + 4, graphH + 4)

  -- Reference lines
  local line16 = graphY + graphH - (16 / 33) * graphH
  local line33 = graphY
  love.graphics.setColor(100/255, 100/255, 100/255, 100/255)
  love.graphics.line(graphX, line16, graphX + FRAME_HISTORY, line16)
  love.graphics.line(graphX, line33, graphX + FRAME_HISTORY, line33)

  for i = 0, FRAME_HISTORY - 1 do
    local idx = ((frameIdx - 1 - FRAME_HISTORY + i + FRAME_HISTORY * 2) % FRAME_HISTORY) + 1
    local dt = frameTimes[idx]
    local ms = dt * 1000
    local barH = math.min(graphH, (ms / 33) * graphH)

    if ms < 16 then
      love.graphics.setColor(80/255, 200/255, 80/255)
    elseif ms < 33 then
      love.graphics.setColor(200/255, 200/255, 80/255)
    else
      love.graphics.setColor(200/255, 80/255, 80/255)
    end
    love.graphics.rectangle("fill", graphX + i, graphY + graphH - barH, 1, barH)
  end

  love.graphics.setColor(150/255, 150/255, 150/255)
  love.graphics.print("33ms", graphX - 30, graphY - 4)
  love.graphics.print("16ms", graphX - 30, line16 - 4)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  elseif key == "space" then
    spawning = not spawning
  elseif key == "up" then
    spawnRate = math.min(50, spawnRate + 5)
  elseif key == "down" then
    spawnRate = math.max(5, spawnRate - 5)
  elseif key == "r" then
    for _, b in ipairs(bodies) do b.body:destroy() end
    bodies = {}
    spawnAccum = 0
    frameIdx = 1
    for i = 1, FRAME_HISTORY do frameTimes[i] = 0 end
  elseif key == "m" then
    muted = not muted
  end
end

function love.mousepressed(x, y, button)
  if button == 1 then
    for i = 1, 10 do
      spawnBody(x + (math.random() - 0.5) * 40, y + (math.random() - 0.5) * 40)
    end
  end
end
