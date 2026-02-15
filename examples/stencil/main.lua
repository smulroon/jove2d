-- love2d stencil example — masking operations
--
-- Demonstrates stencil(), setStencilTest(), getStencilTest().
-- Shows circular mask, inverted mask, and multiple stencil regions.

local t = 0
local mode = 0 -- 0=normal mask, 1=inverted mask, 2=multiple regions
local modeNames = {"Circle Mask (greater > 0)", "Inverted Mask (equal = 0)", "Multiple Regions"}

function love.load()
  love.window.setTitle("Stencil Example")
  love.graphics.setBackgroundColor(30/255, 30/255, 40/255)
end

function love.update(dt)
  t = t + dt
end

function love.draw()
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("Mode: " .. modeNames[mode + 1] .. "  (Press 1/2/3 to switch)", 10, 10)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 10)

  if mode == 0 then
    -- Normal mask: draw only inside a circle
    local cx = 400 + math.cos(t) * 100
    local cy = 300 + math.sin(t * 0.7) * 80

    love.graphics.stencil(function()
      love.graphics.circle("fill", cx, cy, 120)
    end, "replace", 1)

    love.graphics.setStencilTest("greater", 0)

    love.graphics.setColor(1, 80/255, 80/255)
    love.graphics.rectangle("fill", 100, 100, 250, 200)

    love.graphics.setColor(80/255, 1, 80/255)
    love.graphics.rectangle("fill", 300, 200, 250, 200)

    love.graphics.setColor(80/255, 80/255, 1)
    love.graphics.rectangle("fill", 200, 300, 250, 200)

    for x = 0, 799, 40 do
      for y = 50, 599, 40 do
        if (x / 40 + y / 40) % 2 == 0 then
          love.graphics.setColor(200/255, 200/255, 50/255, 100/255)
          love.graphics.rectangle("fill", x, y, 40, 40)
        end
      end
    end

    love.graphics.setStencilTest()

    love.graphics.setColor(1, 1, 1, 120/255)
    love.graphics.circle("line", cx, cy, 120)

  elseif mode == 1 then
    -- Inverted mask: draw everywhere EXCEPT inside a circle
    local cx = 400
    local cy = 300
    local r = 100 + math.sin(t * 2) * 30

    love.graphics.stencil(function()
      love.graphics.circle("fill", cx, cy, r)
    end, "replace", 1)

    love.graphics.setStencilTest("equal", 0)

    for y = 50, 599, 4 do
      local f = (y - 50) / 550
      love.graphics.setColor(1 - f, (100 + 155 * f) / 255, f)
      love.graphics.rectangle("fill", 0, y, 800, 4)
    end

    love.graphics.setStencilTest()

    love.graphics.setColor(1, 1, 1, 120/255)
    love.graphics.circle("line", cx, cy, r)
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("Everything outside the circle", cx - 100, cy - 10)

  elseif mode == 2 then
    -- Multiple stencil regions

    love.graphics.stencil(function()
      love.graphics.circle("fill", 250, 300, 100)
    end, "replace", 1)
    love.graphics.setStencilTest("greater", 0)
    love.graphics.setColor(1, 60/255, 60/255)
    love.graphics.rectangle("fill", 0, 0, 800, 600)
    love.graphics.setStencilTest()

    love.graphics.stencil(function()
      love.graphics.circle("fill", 550, 300, 100)
    end, "replace", 1)
    love.graphics.setStencilTest("greater", 0)
    love.graphics.setColor(60/255, 60/255, 1)
    love.graphics.rectangle("fill", 0, 0, 800, 600)
    love.graphics.setStencilTest()

    love.graphics.stencil(function()
      love.graphics.rectangle("fill", 300, 100, 200, 100)
    end, "replace", 1)
    love.graphics.setStencilTest("greater", 0)
    love.graphics.setColor(60/255, 1, 60/255)
    love.graphics.rectangle("fill", 0, 0, 800, 600)
    love.graphics.setStencilTest()

    love.graphics.setColor(1, 1, 1, 120/255)
    love.graphics.circle("line", 250, 300, 100)
    love.graphics.circle("line", 550, 300, 100)
    love.graphics.rectangle("line", 300, 100, 200, 100)
  end

  love.graphics.setColor(1, 1, 1)
  local cmp, val = love.graphics.getStencilTest()
  love.graphics.print("Stencil state: " .. tostring(cmp) .. ", " .. tostring(val), 10, 580)
end

function love.keypressed(key)
  if key == "escape" then love.event.quit() end
  if key == "1" then mode = 0 end
  if key == "2" then mode = 1 end
  if key == "3" then mode = 2 end
end
