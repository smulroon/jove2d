-- love2d equivalent of joystick/gamepad example
-- Demonstrates: joystick detection, axes, buttons, hats, gamepad mapping, vibration

local messages = {}
local selectedJoystick = nil

local function log(msg)
  table.insert(messages, msg)
  if #messages > 25 then table.remove(messages, 1) end
end

function love.load()
  love.window.setTitle("Joystick / Gamepad Example")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(20/255, 25/255, 35/255)

  local count = love.joystick.getJoystickCount()
  log("=== Joystick/Gamepad Example ===")
  log("Connected joysticks: " .. count)

  local joysticks = love.joystick.getJoysticks()
  for _, joy in ipairs(joysticks) do
    local id, instanceId = joy:getID()
    log("  [" .. id .. "] " .. joy:getName() .. " (gamepad: " .. tostring(joy:isGamepad()) .. ")")
    log("      axes: " .. joy:getAxisCount() .. ", buttons: " .. joy:getButtonCount() .. ", hats: " .. joy:getHatCount())
    if not selectedJoystick then selectedJoystick = joy end
  end

  if count == 0 then
    log("")
    log("No joystick detected. Connect a controller and restart.")
  end
  log("")
  log("Press buttons / move sticks to see events.")
  log("Press V to test vibration (if supported).")
  log("Press ESC to quit.")
end

function love.draw()
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("Joystick / Gamepad", 10, 10)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 10)

  -- Draw event log
  love.graphics.setColor(200/255, 220/255, 200/255)
  local y = 40
  for _, msg in ipairs(messages) do
    love.graphics.print(msg, 10, y)
    y = y + 18
  end

  -- Draw live joystick state if one is selected
  if selectedJoystick and selectedJoystick:isConnected() then
    local joy = selectedJoystick
    local baseX = 450
    local baseY = 200

    love.graphics.setColor(1, 1, 1)
    love.graphics.print("Live: " .. joy:getName(), baseX, baseY - 30)

    -- Draw axes
    local axisCount = joy:getAxisCount()
    for i = 1, math.min(axisCount, 6) do
      local val = joy:getAxis(i)
      local barY = baseY + (i - 1) * 25
      love.graphics.setColor(0.3, 0.3, 0.3)
      love.graphics.rectangle("fill", baseX, barY, 200, 18)
      love.graphics.setColor(0.2, 0.7, 0.3)
      local barW = val * 100
      love.graphics.rectangle("fill", baseX + 100, barY, barW, 18)
      love.graphics.setColor(1, 1, 1)
      love.graphics.print(string.format("Axis %d: %.2f", i, val), baseX + 210, barY)
    end

    -- Draw buttons
    local btnY = baseY + math.min(axisCount, 6) * 25 + 10
    local btnCount = joy:getButtonCount()
    for i = 1, math.min(btnCount, 16) do
      local row = math.floor((i - 1) / 8)
      local col = (i - 1) % 8
      local bx = baseX + col * 40
      local by = btnY + row * 30
      local pressed = joy:isDown(i)
      if pressed then
        love.graphics.setColor(0.2, 0.8, 0.2)
      else
        love.graphics.setColor(0.3, 0.3, 0.3)
      end
      love.graphics.rectangle("fill", bx, by, 30, 22)
      love.graphics.setColor(1, 1, 1)
      love.graphics.print(tostring(i), bx + 8, by + 3)
    end

    -- Draw hats
    local hatY = btnY + math.ceil(math.min(btnCount, 16) / 8) * 30 + 10
    local hatCount = joy:getHatCount()
    for i = 1, hatCount do
      local dir = joy:getHat(i)
      love.graphics.setColor(1, 1, 1)
      love.graphics.print(string.format("Hat %d: %s", i, dir), baseX, hatY + (i - 1) * 20)
    end

    -- Gamepad info
    if joy:isGamepad() then
      local gpY = hatY + hatCount * 20 + 10
      love.graphics.setColor(0.7, 0.7, 1)
      love.graphics.print("Gamepad mapped:", baseX, gpY)
      local gpAxes = {"leftx", "lefty", "rightx", "righty", "triggerleft", "triggerright"}
      for i, axisName in ipairs(gpAxes) do
        local val = joy:getGamepadAxis(axisName)
        love.graphics.print(string.format("  %s: %.2f", axisName, val), baseX, gpY + 18 + (i - 1) * 16)
      end
    end
  end
end

function love.joystickadded(joy)
  local id = joy:getID()
  log("+ Joystick added: [" .. id .. "] " .. joy:getName())
  log("  gamepad: " .. tostring(joy:isGamepad()) .. ", axes: " .. joy:getAxisCount() .. ", buttons: " .. joy:getButtonCount())
  if not selectedJoystick then selectedJoystick = joy end
end

function love.joystickremoved(joy)
  local id = joy:getID()
  log("- Joystick removed: [" .. id .. "] " .. joy:getName())
  if selectedJoystick == joy then selectedJoystick = nil end
end

function love.joystickpressed(joy, button)
  log("Button pressed: " .. button)
end

function love.joystickreleased(joy, button)
  log("Button released: " .. button)
end

function love.joystickaxis(joy, axis, value)
  if math.abs(value) > 0.1 then
    log(string.format("Axis %d: %.3f", axis, value))
  end
end

function love.joystickhat(joy, hat, direction)
  log(string.format("Hat %d: %s", hat, direction))
end

function love.gamepadpressed(joy, button)
  log("Gamepad button: " .. button)
end

function love.gamepadreleased(joy, button)
  log("Gamepad released: " .. button)
end

function love.gamepadaxis(joy, axis, value)
  if math.abs(value) > 0.1 then
    log(string.format("Gamepad axis %s: %.3f", axis, value))
  end
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
  if key == "v" and selectedJoystick then
    local supported = selectedJoystick:isVibrationSupported()
    if supported then
      selectedJoystick:setVibration(0.5, 0.5, 0.5)
      log("Vibration: 0.5s pulse")
    else
      log("Vibration not supported on this device")
    end
  end
end
