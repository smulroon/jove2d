-- love2d equivalent of hello example
-- Run with: love examples/hello

local frameCount = 0

function love.load()
  love.window.setTitle("Hello love2d!")
  love.window.setMode(800, 600, { resizable = true })
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
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
