-- love2d equivalent of system example
-- Demonstrates: love.system.getOS, getProcessorCount, setClipboardText,
-- getClipboardText, getPowerInfo, love.math.gammaToLinear/linearToGamma,
-- love.window.getDisplayCount, getDisplayName, getFullscreenModes,
-- love.window.fromPixels, toPixels, requestAttention

local clipboardContent = ""
local messages = {}

local function log(msg)
  table.insert(messages, msg)
  if #messages > 30 then table.remove(messages, 1) end
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

  -- Display info
  local displayCount = love.window.getDisplayCount()
  log("Displays: " .. displayCount)
  for i = 1, displayCount do
    log("  Display " .. i .. ": " .. love.window.getDisplayName(i))
  end
  local modes = love.window.getFullscreenModes(1)
  if #modes > 0 then
    local top3 = {}
    for i = 1, math.min(3, #modes) do
      table.insert(top3, modes[i].width .. "x" .. modes[i].height)
    end
    local suffix = #modes > 3 and (" ... (" .. #modes .. " total)") or ""
    log("  Fullscreen modes: " .. table.concat(top3, ", ") .. suffix)
  end
  local _, _, flags = love.window.getMode()
  log("  VSync: " .. tostring(flags.vsync))
  log("  DPI scale: " .. love.window.getDPIScale())
  log("  100px from pixels: " .. love.window.fromPixels(100))
  log("  100 units to pixels: " .. love.window.toPixels(100))
  log("")

  -- Graphics capabilities
  local rName, rVersion, rVendor, rDevice = love.graphics.getRendererInfo()
  log("Renderer: " .. rName .. " (" .. rVendor .. ")")
  log("  Active: " .. tostring(love.graphics.isActive()) .. ", Gamma: " .. tostring(love.graphics.isGammaCorrect()))
  local limits = love.graphics.getSystemLimits()
  log("  Max texture: " .. limits.texturesize .. ", Point: " .. limits.pointsize .. ", MSAA: " .. limits.canvasmsaa)
  local supported = love.graphics.getSupported()
  local features = {}
  for k, v in pairs(supported) do
    if v then table.insert(features, k) end
  end
  log("  Features: " .. (#features > 0 and table.concat(features, ", ") or "(none)"))
  local texTypes = love.graphics.getTextureTypes()
  local types = {}
  for k, v in pairs(texTypes) do
    if v then table.insert(types, k) end
  end
  log("  Texture types: " .. table.concat(types, ", "))
  local canvasFmt = love.graphics.getCanvasFormats()
  local fmts = {}
  for k, v in pairs(canvasFmt) do
    if v then table.insert(fmts, k) end
  end
  log("  Canvas formats: " .. table.concat(fmts, ", "))
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
  log("C=copy FPS  O=open URL  F=flash window  V=toggle vsync")
end

function love.draw()
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("System Info", 10, 10)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 10)

  -- Display system info
  love.graphics.setColor(200/255, 220/255, 200/255)
  for i, msg in ipairs(messages) do
    love.graphics.print(msg, 10, 40 + (i - 1) * 16)
  end

  -- Gamma/linear color ramp visualization
  local rampY = 530
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Gamma ramp (top) vs Linear ramp (bottom)", 10, rampY)

  for x = 0, 255 do
    local norm = x / 255

    -- Gamma space (perceptually uniform)
    local gv = norm
    love.graphics.setColor(gv, gv, gv)
    love.graphics.points(10 + x * 3, rampY + 20)
    love.graphics.points(10 + x * 3, rampY + 21)
    love.graphics.points(10 + x * 3, rampY + 22)
    love.graphics.points(10 + x * 3, rampY + 23)

    -- Linear space
    local lv = love.math.gammaToLinear(norm)
    love.graphics.setColor(lv, lv, lv)
    love.graphics.points(10 + x * 3, rampY + 35)
    love.graphics.points(10 + x * 3, rampY + 36)
    love.graphics.points(10 + x * 3, rampY + 37)
    love.graphics.points(10 + x * 3, rampY + 38)
  end

  -- Clipboard display
  love.graphics.setColor(1, 1, 200/255)
  love.graphics.print('Clipboard: "' .. clipboardContent .. '"', 10, rampY + 55)
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
  elseif key == "f" then
    love.window.requestAttention(false)
    log("Flashed window (briefly)")
  elseif key == "v" then
    local _, _, flags = love.window.getMode()
    local next = flags.vsync == 0 and 1 or 0
    love.window.setMode(800, 600, { vsync = next })
    local _, _, newFlags = love.window.getMode()
    log("VSync: " .. (newFlags.vsync == 1 and "on" or "off"))
  end
end
