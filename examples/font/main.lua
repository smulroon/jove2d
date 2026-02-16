-- love2d equivalent of font example
-- Run with: SDL_VIDEODRIVER=x11 love examples/font

local smallFont
local defaultFont
local largeFont
local hugeFont
local cachedText
local rotatingText

function love.load()
  love.window.setTitle("Font Example — love2d")
  love.window.setMode(800, 600, { resizable = true })

  smallFont = love.graphics.newFont(10)
  defaultFont = love.graphics.getFont()
  largeFont = love.graphics.newFont(24)
  hugeFont = love.graphics.newFont(48)

  -- Create cached Text objects (newText)
  cachedText = love.graphics.newText(largeFont, "Cached Text (newText)")

  -- Multi-segment colored text
  rotatingText = love.graphics.newText(defaultFont)
  rotatingText:set({{1, 0.39, 0.39}, "Red "})
  rotatingText:add({{0.39, 1, 0.39}, "Green "}, rotatingText:getWidth(), 0)
  rotatingText:add({{0.39, 0.39, 1}, "Blue"}, rotatingText:getWidth(), 0)
end

function love.draw()
  local y = 10

  -- Default font (12pt Vera Sans)
  love.graphics.setColor(1, 1, 1)
  love.graphics.setFont(defaultFont)
  love.graphics.print("Default font (Vera Sans 12pt)", 10, y)
  y = y + 30

  -- Small font
  love.graphics.setColor(0.78, 0.78, 0.78)
  love.graphics.setFont(smallFont)
  love.graphics.print("Small font (10pt)", 10, y)
  y = y + 25

  -- Large font
  love.graphics.setColor(0.39, 0.78, 1)
  love.graphics.setFont(largeFont)
  love.graphics.print("Large font (24pt)", 10, y)
  y = y + 40

  -- Huge font
  love.graphics.setColor(1, 0.78, 0.39)
  love.graphics.setFont(hugeFont)
  love.graphics.print("Huge (48pt)", 10, y)
  y = y + 70

  -- Font metrics display
  love.graphics.setFont(defaultFont)
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("--- Font Metrics (default 12pt) ---", 10, y)
  y = y + 20
  love.graphics.print("Height: " .. defaultFont:getHeight(), 10, y)
  y = y + 16
  love.graphics.print("Ascent: " .. defaultFont:getAscent(), 10, y)
  y = y + 16
  love.graphics.print("Descent: " .. defaultFont:getDescent(), 10, y)
  y = y + 16
  love.graphics.print("Width of \"Hello\": " .. defaultFont:getWidth("Hello"), 10, y)
  y = y + 16
  love.graphics.print("Line height: " .. defaultFont:getLineHeight(), 10, y)
  y = y + 30

  -- printf alignment demo
  love.graphics.setColor(1, 1, 0.39)
  love.graphics.print("--- printf alignment (wraplimit=300) ---", 10, y)
  y = y + 20

  local demoText = "The quick brown fox jumps over the lazy dog."
  local limit = 300
  local boxX = 10

  -- Draw alignment guide box
  love.graphics.setColor(0.24, 0.24, 0.24)
  love.graphics.rectangle("fill", boxX, y, limit, 120)

  -- Left aligned
  love.graphics.setColor(1, 1, 1)
  love.graphics.printf(demoText, boxX, y, limit, "left")
  y = y + 40

  -- Center aligned
  love.graphics.setColor(0.39, 1, 0.39)
  love.graphics.printf(demoText, boxX, y, limit, "center")
  y = y + 40

  -- Right aligned
  love.graphics.setColor(1, 0.39, 0.39)
  love.graphics.printf(demoText, boxX, y, limit, "right")
  y = y + 50

  -- getWrap demo
  love.graphics.setColor(1, 1, 1)
  love.graphics.setFont(defaultFont)
  local maxW, lines = defaultFont:getWrap("This text gets wrapped at 200px width limit.", 200)
  love.graphics.print("getWrap(200): maxW=" .. maxW .. ", lines=" .. #lines, 10, y)
  y = y + 16
  for _, line in ipairs(lines) do
    love.graphics.print('  "' .. line .. '"', 10, y)
    y = y + 16
  end
  y = y + 20

  -- newText demo — cached text objects
  love.graphics.setColor(1, 1, 0.39)
  love.graphics.print("--- newText (cached text objects) ---", 10, y)
  y = y + 20

  -- Draw cached text (simple)
  love.graphics.setColor(1, 1, 1)
  love.graphics.draw(cachedText, 10, y)
  y = y + 35

  -- Draw cached text with rotation and scale
  love.graphics.setColor(0.78, 0.78, 1)
  local t = love.timer.getTime()
  love.graphics.draw(cachedText, 200, y + 20, math.sin(t) * 0.3, 0.8, 0.8,
    cachedText:getWidth() / 2, cachedText:getHeight() / 2)
  y = y + 50

  -- Draw multi-colored text
  love.graphics.setColor(1, 1, 1)
  love.graphics.draw(rotatingText, 10, y)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
