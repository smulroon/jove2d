-- love2d equivalent of the canvas example
-- Demonstrates: newCanvas, setCanvas/getCanvas, drawing canvas with transforms

local miniScene = nil
local t = 0

function love.load()
  love.window.setTitle("Canvas Example")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(20/255, 20/255, 30/255)

  -- Create a small off-screen canvas
  miniScene = love.graphics.newCanvas(200, 200)
end

function love.update(dt)
  t = t + dt

  -- Render the mini scene to the canvas
  if miniScene then
    love.graphics.setCanvas(miniScene)
    love.graphics.clear(0, 0, 0, 0) -- Clear canvas with transparency

    -- Draw some shapes into the canvas
    love.graphics.setColor(1, 100/255, 50/255)
    love.graphics.rectangle("fill", 10, 10, 80, 80)

    love.graphics.setColor(50/255, 200/255, 1)
    love.graphics.circle("fill", 150, 50, 40)

    love.graphics.setColor(100/255, 1, 100/255)
    love.graphics.ellipse("fill", 100, 150, 60, 30)

    love.graphics.setColor(1, 1, 1)
    love.graphics.print("Canvas!", 60, 90)

    -- Switch back to screen rendering
    love.graphics.setCanvas()
  end
end

function love.draw()
  if not miniScene then return end

  love.graphics.setColor(1, 1, 1)
  love.graphics.print("Off-screen canvas drawn 3 times with transforms", 10, 10)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 10)

  -- Draw the canvas at its original size (top-left)
  love.graphics.setColor(1, 1, 1)
  love.graphics.draw(miniScene, 20, 40)

  -- Draw it again, rotated
  love.graphics.draw(miniScene, 400, 200, t * 0.5, 1, 1, 100, 100)

  -- Draw it scaled down (nearest filtering -- pixelated)
  love.graphics.draw(miniScene, 600, 400, 0, 0.5, 0.5)

  -- Draw scaled up with linear filtering for smooth result
  if miniScene then
    miniScene:setFilter("linear", "linear")
    love.graphics.draw(miniScene, 250, 300, 0, 1.5, 1.5)
    miniScene:setFilter("nearest", "nearest") -- restore
  end

  -- Outline where the canvases are drawn
  love.graphics.setColor(80/255, 80/255, 80/255)
  love.graphics.rectangle("line", 20, 40, 200, 200)
  love.graphics.print("1:1", 20, 250)
  love.graphics.print("rotated", 370, 350)
  love.graphics.print("0.5x scale", 590, 510)
  love.graphics.print("1.5x linear", 250, 310)

  -- Show current default filter
  local fMin, fMag = love.graphics.getDefaultFilter()
  love.graphics.print("Default filter: " .. fMin .. "/" .. fMag, 10, 580)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
