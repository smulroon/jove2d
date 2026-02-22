-- love2d equivalent of ImageData example
-- Demonstrates: love.image.newImageData, getPixel, setPixel, mapPixel, paste,
-- love.graphics.newImage(imageData), replacePixels
-- Press R to toggle between replacePixels and recreate-each-frame for plasma

local t = 0

-- Static images (created once in load)
local gradientImg
local checkerImg
local compositeImg

-- Dynamic plasma
local plasmaData
local plasmaImg
local useReplacePixels = true

local PLASMA_W = 128
local PLASMA_H = 128

function love.load()
  love.window.setTitle("ImageData Example — love2d")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(20/255, 20/255, 30/255)

  -- 1. Gradient ImageData
  local gradData = love.image.newImageData(128, 128)
  gradData:mapPixel(function(x, y)
    local r = (x / 127)
    local g = (y / 127)
    return r, g, 128/255, 1
  end)
  gradientImg = love.graphics.newImage(gradData)

  -- 2. Checkerboard ImageData
  local checkData = love.image.newImageData(128, 128)
  checkData:mapPixel(function(x, y)
    local isWhite = ((math.floor(x / 16) + math.floor(y / 16)) % 2) == 0
    if isWhite then
      return 220/255, 220/255, 220/255, 1
    else
      return 40/255, 40/255, 40/255, 1
    end
  end)
  checkerImg = love.graphics.newImage(checkData)

  -- 3. Composite: paste checkerboard onto gradient
  local compData = love.image.newImageData(128, 128)
  compData:paste(gradData, 0, 0, 0, 0, 128, 128)
  compData:paste(checkData, 32, 32, 32, 32, 64, 64)
  compositeImg = love.graphics.newImage(compData)

  -- 4. Plasma (dynamic)
  plasmaData = love.image.newImageData(PLASMA_W, PLASMA_H)
  plasmaImg = love.graphics.newImage(plasmaData)
end

function love.update(dt)
  t = t + dt

  -- Update plasma pixels
  plasmaData:mapPixel(function(x, y)
    local cx = x / PLASMA_W
    local cy = y / PLASMA_H
    local v1 = math.sin(cx * 10 + t * 2)
    local v2 = math.sin(cy * 8 - t * 1.5)
    local v3 = math.sin((cx + cy) * 6 + t)
    local v4 = math.sin(math.sqrt((cx - 0.5) ^ 2 + (cy - 0.5) ^ 2) * 12 - t * 3)
    local v = (v1 + v2 + v3 + v4) / 4

    local r = math.sin(v * math.pi) * 0.5 + 0.5
    local g = math.sin(v * math.pi + 2.094) * 0.5 + 0.5
    local b = math.sin(v * math.pi + 4.189) * 0.5 + 0.5
    return r, g, b, 1
  end)

  -- Update GPU texture
  if useReplacePixels then
    -- replacePixels: update existing texture in-place (no alloc/free)
    plasmaImg:replacePixels(plasmaData)
  else
    -- Recreate: destroy + create new texture each frame
    if plasmaImg then plasmaImg:release() end
    plasmaImg = love.graphics.newImage(plasmaData)
  end
end

function love.draw()
  -- Labels
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("ImageData — procedural textures & pixel manipulation", 10, 10)

  -- Row 1: Static procedural textures
  local y1 = 50

  -- Gradient
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("mapPixel: gradient", 10, y1)
  if gradientImg then love.graphics.draw(gradientImg, 10, y1 + 18) end

  -- Checkerboard
  love.graphics.print("mapPixel: checker", 160, y1)
  if checkerImg then love.graphics.draw(checkerImg, 160, y1 + 18) end

  -- Composite (paste)
  love.graphics.print("paste: gradient + checker", 310, y1)
  if compositeImg then love.graphics.draw(compositeImg, 310, y1 + 18) end

  -- Row 2: Dynamic plasma (updated every frame)
  local y2 = 220
  love.graphics.setColor(1, 1, 1)
  local method = useReplacePixels and "replacePixels" or "recreate"
  love.graphics.print("Dynamic plasma — " .. method .. " (R to toggle)", 10, y2)
  if plasmaImg then
    -- Draw at 2x scale
    love.graphics.draw(plasmaImg, 10, y2 + 18, 0, 2, 2)
  end

  -- Row 3: Pixel info readback
  local y3 = 420
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Pixel readback from plasma center:", 10, y3)
  if plasmaData then
    local cx = math.floor(PLASMA_W / 2)
    local cy = math.floor(PLASMA_H / 2)
    local r, g, b, a = plasmaData:getPixel(cx, cy)
    -- love2d returns 0-1 range
    local r255 = math.floor(r * 255)
    local g255 = math.floor(g * 255)
    local b255 = math.floor(b * 255)
    local a255 = math.floor(a * 255)
    love.graphics.print(string.format("  getPixel(%d, %d) = [%d, %d, %d, %d]", cx, cy, r255, g255, b255, a255), 10, y3 + 18)

    -- Draw a large swatch of that color
    love.graphics.setColor(r, g, b, a)
    love.graphics.rectangle("fill", 10, y3 + 40, 60, 60)

    -- Show corner pixels
    love.graphics.setColor(200/255, 200/255, 200/255)
    local corners = {
      {0, 0, "top-left"},
      {PLASMA_W - 1, 0, "top-right"},
      {0, PLASMA_H - 1, "bot-left"},
      {PLASMA_W - 1, PLASMA_H - 1, "bot-right"},
    }
    local cx2 = 90
    for _, corner in ipairs(corners) do
      local px, py, label = corner[1], corner[2], corner[3]
      local cr, cg, cb = plasmaData:getPixel(px, py)
      love.graphics.setColor(cr, cg, cb)
      love.graphics.rectangle("fill", cx2, y3 + 40, 30, 30)
      love.graphics.setColor(200/255, 200/255, 200/255)
      love.graphics.print(label, cx2, y3 + 72)
      cx2 = cx2 + 80
    end
  end

  -- HUD
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 570)
end

function love.keypressed(key)
  if key == "r" then useReplacePixels = not useReplacePixels end
  if key == "escape" then
    love.event.quit()
  end
end
