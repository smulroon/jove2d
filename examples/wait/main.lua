-- love2d event.wait example — animation only advances when events arrive
--
-- Uses love.event.wait() in a custom run loop so the spinning shapes
-- only animate while you move the mouse or press keys.

local angle = 0
local eventCount = 0
local lastEventType = "none"

function love.load()
  love.window.setTitle("event.wait — move mouse to animate")
  love.graphics.setBackgroundColor(15/255, 15/255, 30/255)
end

-- Override the main loop to use event.wait instead of event.poll
function love.run()
  if love.load then love.load() end

  love.timer.step()

  return function()
    -- Block until an event arrives
    local name, a, b, c, d, e, f = love.event.wait()
    local dt = love.timer.step()

    -- wait() can return nil on shutdown
    if not name then return 0 end

    -- Process the waited event
    eventCount = eventCount + 1
    lastEventType = name
    if name == "quit" then
      return 0
    end
    if love.handlers[name] then
      love.handlers[name](a, b, c, d, e, f)
    end

    -- Drain remaining events
    for name2, a2, b2, c2, d2, e2, f2 in love.event.poll() do
      eventCount = eventCount + 1
      lastEventType = name2
      if name2 == "quit" then
        return 0
      end
      if love.handlers[name2] then
        love.handlers[name2](a2, b2, c2, d2, e2, f2)
      end
    end

    angle = angle + dt * 2

    love.graphics.origin()
    love.graphics.clear(love.graphics.getBackgroundColor())

    local w, h = love.graphics.getDimensions()
    local cx, cy = w / 2, h / 2

    -- Spinning ring of circles
    for i = 0, 11 do
      local a = angle + (i * math.pi * 2) / 12
      local r = 120
      local x = cx + math.cos(a) * r
      local y = cy + math.sin(a) * r
      local shade = math.floor(128 + 127 * math.sin(a + angle))
      love.graphics.setColor(shade/255, 100/255, (255 - shade)/255)
      love.graphics.circle("fill", x, y, 20)
    end

    -- Inner spinning triangle
    love.graphics.push()
    love.graphics.translate(cx, cy)
    love.graphics.rotate(angle * -1.5)
    love.graphics.setColor(255/255, 220/255, 80/255)
    love.graphics.polygon("fill", -40, 30, 40, 30, 0, -40)
    love.graphics.pop()

    -- Info text
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("event.wait() demo", 10, 10)
    love.graphics.print("Animation only plays while you interact", 10, 30)
    love.graphics.print("Move mouse / press keys to animate. Stop to freeze.", 10, 50)

    love.graphics.setColor(180/255, 180/255, 180/255)
    love.graphics.print("Events received: " .. eventCount, 10, 80)
    love.graphics.print("Last event: " .. lastEventType, 10, 100)
    love.graphics.print(string.format("Angle: %.2f", angle), 10, 120)

    love.graphics.present()
  end
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
