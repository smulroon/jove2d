-- love2d equivalent of event example
-- Demonstrates: love.event.push, love.event.clear, love.event.quit,
-- textinput callback, filedropped callback, visible callback

local log = {}
local eventCount = 0

local function addLog(msg)
  table.insert(log, string.format("[%d] %s", eventCount, msg))
  eventCount = eventCount + 1
  if #log > 25 then table.remove(log, 1) end
end

function love.load()
  love.window.setTitle("Event System Example")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(25/255, 20/255, 35/255)
  love.keyboard.setTextInput(true)

  addLog("Event system ready.")
  addLog("Press 1: push custom focus event")
  addLog("Press 2: push custom textinput event")
  addLog("Press 3: clear all events")
  addLog("Press Q: push quit event (via event.quit())")
  addLog("Drop a file onto the window to see filedropped")
  addLog("Minimize/restore to see visible callback")
  addLog("---")
end

function love.update(dt)
  -- nothing
end

function love.draw()
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("Event System Demo", 10, 10)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 10)

  -- Controls
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("1=push focus | 2=push textinput | 3=clear | Q=quit | ESC=close", 10, 30)

  -- Event log
  love.graphics.setColor(160/255, 220/255, 160/255)
  for i, msg in ipairs(log) do
    love.graphics.print(msg, 10, 60 + (i - 1) * 18)
  end
end

function love.keypressed(key)
  addLog('keypressed: "' .. key .. '"')

  if key == "escape" then
    love.event.quit()
  elseif key == "1" then
    -- Inject custom focus events
    love.event.push("focus", false)
    love.event.push("focus", true)
    addLog("  -> pushed 2 focus events")
  elseif key == "2" then
    -- Inject a custom textinput event
    love.event.push("textinput", "injected!")
    addLog("  -> pushed textinput event")
  elseif key == "3" then
    love.event.clear()
    addLog("  -> cleared all events")
  elseif key == "q" then
    -- This will push a quit event, triggering the quit callback
    addLog("  -> calling event.quit()...")
    love.event.quit()
  end
end

function love.textinput(text)
  addLog('textinput: "' .. text .. '"')
end

function love.focus(hasFocus)
  addLog("focus: " .. tostring(hasFocus))
end

function love.filedropped(file)
  addLog("filedropped: " .. file:getFilename())
end

function love.visible(vis)
  addLog("visible: " .. tostring(vis))
end

function love.quit()
  addLog("quit callback fired!")
  -- Return true to cancel the quit (first time only for demo)
  if eventCount < 50 then
    addLog("  -> cancelled quit (press Q again or ESC to really quit)")
    return true
  end
end
