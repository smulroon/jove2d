-- love2d equivalent of hello example
-- Run with: love examples/hello

function love.load()
  love.window.setTitle("Hello love2d!")
  love.window.setMode(800, 600, { resizable = true })
end

function love.draw()
  love.graphics.print("Hello from love2d!", 10, 10)
end

-- Auto-quit after 2 seconds
local timer = 0
function love.update(dt)
  timer = timer + dt
  if timer >= 2 then
    love.event.quit()
  end
end
