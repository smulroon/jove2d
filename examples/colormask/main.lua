-- love2d colorMask example — color channel masking
-- Compare with: bun examples/colormask/main.ts

local W = 800
local H = 600
local HALF_W = W / 2
local HALF_H = H / 2
local PAD = 10
local HEADER = 25

local panels = {
  { x = PAD, y = PAD + HEADER, label = "No mask (all channels)", mask = {true, true, true, true} },
  { x = HALF_W + PAD * 0.5, y = PAD + HEADER, label = "Red only", mask = {true, false, false, true} },
  { x = PAD, y = HALF_H + PAD * 0.5, label = "Alpha only (RGB masked)", mask = {false, false, false, true} },
  { x = HALF_W + PAD * 0.5, y = HALF_H + PAD * 0.5, label = "No red (GB only)", mask = {false, true, true, true} },
}

-- Compute panel sizes
for _, p in ipairs(panels) do
  p.w = HALF_W - PAD * 1.5
  p.h = HALF_H - PAD * 1.5 - HEADER
end

local function drawShapes(x, y, w, h)
  local cx = x + w / 2
  local cy = y + h / 2
  local sz = math.min(w, h) * 0.2

  -- Red rectangle (top-left)
  love.graphics.setColor(220/255, 50/255, 50/255)
  love.graphics.rectangle("fill", x + w * 0.1, y + h * 0.1, sz * 1.5, sz)

  -- Green circle (top-right)
  love.graphics.setColor(50/255, 220/255, 50/255)
  love.graphics.circle("fill", x + w * 0.75, y + h * 0.25, sz * 0.6)

  -- Blue circle (bottom-left)
  love.graphics.setColor(50/255, 80/255, 220/255)
  love.graphics.circle("fill", x + w * 0.25, y + h * 0.7, sz * 0.6)

  -- White rectangle (center)
  love.graphics.setColor(1, 1, 1)
  love.graphics.rectangle("fill", cx - sz * 0.4, cy - sz * 0.3, sz * 0.8, sz * 0.6)

  -- Yellow ellipse (bottom-right)
  love.graphics.setColor(1, 220/255, 50/255)
  love.graphics.ellipse("fill", x + w * 0.75, y + h * 0.7, sz * 0.7, sz * 0.4)
end

function love.load()
  love.window.setTitle("colorMask Example")
  love.graphics.setBackgroundColor(40/255, 44/255, 52/255)
end

function love.draw()
  for _, panel in ipairs(panels) do
    -- Panel background
    love.graphics.setColorMask(true, true, true, true)
    love.graphics.setColor(30/255, 33/255, 40/255)
    love.graphics.rectangle("fill", panel.x, panel.y, panel.w, panel.h)

    -- Panel border
    love.graphics.setColor(80/255, 80/255, 80/255)
    love.graphics.rectangle("line", panel.x, panel.y, panel.w, panel.h)

    -- Apply mask and draw shapes
    love.graphics.setColorMask(unpack(panel.mask))
    drawShapes(panel.x, panel.y, panel.w, panel.h)

    -- Reset mask for label
    love.graphics.setColorMask(true, true, true, true)
    love.graphics.setColor(200/255, 200/255, 200/255)
    local maskStr = "["
    for i, b in ipairs(panel.mask) do
      maskStr = maskStr .. (b and "T" or "F")
      if i < 4 then maskStr = maskStr .. "," end
    end
    maskStr = maskStr .. "]"
    love.graphics.print(panel.label .. "  " .. maskStr, panel.x + 5, panel.y + panel.h + 3)
  end

  -- HUD
  love.graphics.setColorMask(true, true, true, true)
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("colorMask GPU enforcement — compare panels", 10, 5)
  love.graphics.print("FPS: " .. love.timer.getFPS(), W - 80, 5)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
