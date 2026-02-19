-- love2d equivalent of hello example
-- Run with: love examples/hello

local frameCount = 0

function love.load()
  love.window.setTitle("Hello love2d!")
  love.window.setMode(800, 600, { resizable = true })

  -- Set a simple procedural window icon (32x32 "J" on purple)
  local icon = love.image.newImageData(32, 32)
  icon:mapPixel(function(x, y)
    local cx, cy = x - 15.5, y - 15.5
    local dist = math.max(math.abs(cx), math.abs(cy))
    if dist > 14.5 then return 0, 0, 0, 0 end
    if dist > 13.5 then return 80/255, 40/255, 140/255, 1 end

    local inTopBar = y >= 6 and y <= 9 and x >= 8 and x <= 24
    local inStem = x >= 16 and x <= 21 and y >= 6 and y <= 23
    local inCurve = y >= 21 and y <= 26 and x >= 8 and x <= 21
      and math.sqrt((x - 14)^2 + (y - 21)^2) <= 9
      and math.sqrt((x - 14)^2 + (y - 21)^2) >= 3
    if inTopBar or inStem or inCurve then return 1, 1, 1, 1 end

    return 120/255, 60/255, 200/255, 1
  end)
  love.window.setIcon(icon)

  print("love2d " .. love.getVersion())
  print("Platform: " .. love.system.getOS())
  print("CPU cores: " .. love.system.getProcessorCount())
end

function love.update(dt)
  frameCount = frameCount + 1
end

function love.draw()
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("Hello love2d!", 10, 10)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 10, 30)
  love.graphics.print(string.format("Time: %.1fs", love.timer.getTime()), 10, 50)
  love.graphics.print("Frames: " .. frameCount, 10, 70)
  love.graphics.print(string.format("Avg dt: %.1fms", love.timer.getAverageDelta() * 1000), 10, 90)

  -- Renderer info
  local name, version, vendor, device = love.graphics.getRendererInfo()
  love.graphics.setColor(180/255, 200/255, 1)
  love.graphics.print("Renderer: " .. name, 10, 130)
  love.graphics.print("GPU driver: " .. (device or "N/A"), 10, 150)

  -- DPI / pixel dimensions
  local dpi = love.graphics.getDPIScale()
  local w, h = love.graphics.getDimensions()
  local pw, ph = love.graphics.getPixelDimensions()
  love.graphics.setColor(180/255, 1, 200/255)
  love.graphics.print(string.format("Window: %dx%d  Pixels: %dx%d  DPI: %.2f", w, h, pw, ph, dpi), 10, 190)

  -- Draw stats
  local stats = love.graphics.getStats()
  love.graphics.setColor(1, 220/255, 180/255)
  love.graphics.print(string.format("Draw calls: %d  Canvas switches: %d", stats.drawcalls, stats.canvasswitches), 10, 210)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
