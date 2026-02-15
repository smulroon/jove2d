-- love2d equivalent of system example
-- Demonstrates: love.system.getOS, getProcessorCount, setClipboardText,
-- getClipboardText, getPowerInfo, love.math.gammaToLinear/linearToGamma

local clipboardContent = ""
local messages = {}

local function log(msg)
  table.insert(messages, msg)
  if #messages > 20 then table.remove(messages, 1) end
end

function love.load()
  love.window.setTitle("System Info Example")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(25/255, 30/255, 40/255)

  -- System info
  log("OS: " .. love.system.getOS())
  log("CPU cores: " .. love.system.getProcessorCount())
  log("love2d version: " .. love.getVersion())
  log("")

  -- Power info
  local state, percent, seconds = love.system.getPowerInfo()
  log("Power state: " .. tostring(state))
  log("Battery: " .. tostring(percent) .. "%")
  log("Time remaining: " .. tostring(seconds) .. "s")
  log("")

  -- Clipboard
  love.system.setClipboardText("Hello from love2d!")
  clipboardContent = love.system.getClipboardText()
  log('Clipboard set to: "' .. clipboardContent .. '"')
  log("")

  -- Color space conversion demo
  local gamma = 0.5
  local linear = love.math.gammaToLinear(gamma)
  local back = love.math.linearToGamma(linear)
  log(string.format("Color: gamma(%.1f) -> linear(%.4f) -> gamma(%.4f)", gamma, linear, back))
  log("")
  log("Press C to copy FPS to clipboard")
  log("Press O to open love2d website (if supported)")
end

function love.draw()
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("System Info", 10, 10)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 10)

  -- Display system info
  love.graphics.setColor(200/255, 220/255, 200/255)
  for i, msg in ipairs(messages) do
    love.graphics.print(msg, 10, 40 + (i - 1) * 18)
  end

  -- Gamma/linear color ramp visualization
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Gamma ramp (top) vs Linear ramp (bottom)", 10, 420)

  for x = 0, 255 do
    local norm = x / 255

    -- Gamma space (perceptually uniform)
    local gv = norm
    love.graphics.setColor(gv, gv, gv)
    love.graphics.points(10 + x * 3, 440)
    love.graphics.points(10 + x * 3, 441)
    love.graphics.points(10 + x * 3, 442)
    love.graphics.points(10 + x * 3, 443)

    -- Linear space
    local lv = love.math.gammaToLinear(norm)
    love.graphics.setColor(lv, lv, lv)
    love.graphics.points(10 + x * 3, 455)
    love.graphics.points(10 + x * 3, 456)
    love.graphics.points(10 + x * 3, 457)
    love.graphics.points(10 + x * 3, 458)
  end

  -- Clipboard display
  love.graphics.setColor(1, 1, 200/255)
  love.graphics.print('Clipboard: "' .. clipboardContent .. '"', 10, 480)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  elseif key == "c" then
    local fps = "FPS: " .. love.timer.getFPS()
    love.system.setClipboardText(fps)
    clipboardContent = fps
    log('Copied "' .. fps .. '" to clipboard')
  elseif key == "o" then
    love.system.openURL("https://github.com")
    log("Opened URL in browser")
  end
end
