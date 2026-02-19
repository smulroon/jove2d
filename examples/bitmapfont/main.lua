-- Bitmap font example — demonstrates newImageFont for pixel-art text

local glyphs = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:-'/()"

local bitmapFont = nil
local bitmapFontLarge = nil
local cachedText = nil
local time = 0

function love.load()
  love.window.setTitle("love2d — Bitmap Font Example")

  bitmapFont = love.graphics.newImageFont("pixelfont.png", glyphs)
  bitmapFontLarge = love.graphics.newImageFont("pixelfont.png", glyphs, 1)

  if bitmapFont then
    love.graphics.setFont(bitmapFont)
    cachedText = love.graphics.newText(bitmapFont, "Cached Text Object!")
  end
end

function love.update(dt)
  time = time + dt
end

function love.draw()
  local g = love.graphics

  -- Section 1: Basic bitmap font rendering
  g.setColor(1, 1, 0.39, 1)
  if bitmapFont then
    g.setFont(bitmapFont)
    g.print("Bitmap Font Demo", 20, 20)

    g.setColor(1, 1, 1, 1)
    g.print("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 20, 40)
    g.print("abcdefghijklmnopqrstuvwxyz", 20, 55)
    g.print("0123456789 .,!?:-'/()", 20, 70)
  end

  -- Section 2: Color tinting
  g.setColor(1, 0.39, 0.39, 1)
  g.print("Red tinted text", 20, 100)

  g.setColor(0.39, 1, 0.39, 1)
  g.print("Green tinted text", 20, 115)

  g.setColor(0.39, 0.39, 1, 1)
  g.print("Blue tinted text", 20, 130)

  g.setColor(1, 1, 1, 0.5)
  g.print("Semi-transparent text", 20, 145)

  -- Section 3: printf with alignment
  g.setColor(1, 1, 1, 1)
  g.print("printf alignment (200px box):", 20, 175)

  g.setColor(0.31, 0.31, 0.31, 1)
  g.rectangle("line", 20, 190, 200, 55)

  g.setColor(1, 1, 1, 1)
  g.printf("Left aligned", 20, 195, 200, "left")
  g.printf("Center aligned", 20, 210, 200, "center")
  g.printf("Right aligned", 20, 225, 200, "right")

  -- Section 4: Extra spacing comparison
  g.setColor(1, 0.78, 0.39, 1)
  g.print("Spacing comparison:", 20, 265)

  if bitmapFont then
    g.setFont(bitmapFont)
    g.setColor(1, 1, 1, 1)
    g.print("Normal spacing (0px)", 20, 280)
  end

  if bitmapFontLarge then
    g.setFont(bitmapFontLarge)
    g.setColor(0.78, 0.78, 1, 1)
    g.print("Extra spacing (1px)", 20, 295)
  end

  -- Section 5: Word wrap
  if bitmapFont then
    g.setFont(bitmapFont)
    g.setColor(1, 0.78, 0.39, 1)
    g.print("Word wrap (150px box):", 20, 325)

    g.setColor(0.31, 0.31, 0.31, 1)
    g.rectangle("line", 20, 340, 150, 50)

    g.setColor(1, 1, 1, 1)
    g.printf("The quick brown fox jumps over the lazy dog.", 20, 345, 150, "left")
  end

  -- Section 6: Font metrics
  if bitmapFont then
    g.setFont(bitmapFont)
    g.setColor(1, 0.78, 0.39, 1)
    g.print("Font metrics:", 400, 20)

    g.setColor(0.78, 0.78, 0.78, 1)
    g.print("Height: " .. bitmapFont:getHeight(), 400, 40)
    g.print("Ascent: " .. bitmapFont:getAscent(), 400, 55)
    g.print("Descent: " .. bitmapFont:getDescent(), 400, 70)
    g.print("Baseline: " .. bitmapFont:getBaseline(), 400, 85)
    g.print("Line height: " .. bitmapFont:getLineHeight(), 400, 100)
    g.print("'Hello' width: " .. bitmapFont:getWidth("Hello"), 400, 115)
  end

  -- Section 7: newText cached text with transforms
  if cachedText then
    g.setColor(1, 0.78, 0.39, 1)
    if bitmapFont then g.setFont(bitmapFont) end
    g.print("newText with transforms:", 400, 145)

    g.setColor(1, 1, 1, 1)
    g.draw(cachedText, 400, 170)

    g.setColor(0.39, 1, 0.78, 1)
    g.draw(cachedText, 500, 260, time, 1, 1, cachedText:getWidth() / 2, cachedText:getHeight() / 2)

    g.setColor(1, 0.78, 1, 1)
    g.draw(cachedText, 400, 310, 0, 2, 2)
  end

  -- Section 8: Multiline with newlines
  if bitmapFont then
    g.setFont(bitmapFont)
    g.setColor(1, 0.78, 0.39, 1)
    g.print("Multiline (newlines):", 400, 350)
    g.setColor(1, 1, 1, 1)
    g.print("Line 1\nLine 2\nLine 3", 400, 370)
  end

  -- Section 9: Dynamic text
  if bitmapFont then
    g.setFont(bitmapFont)
    g.setColor(1, 0.78, 0.39, 1)
    g.print("Dynamic:", 400, 430)

    local fps = love.timer.getFPS()
    local t = math.floor(time)
    g.setColor(1, 1, 1, 1)
    g.print("FPS: " .. fps, 400, 450)
    g.print("Time: " .. t .. "s", 400, 465)
  end

  -- Footer
  if bitmapFont then
    g.setFont(bitmapFont)
    g.setColor(0.5, 0.5, 0.5, 1)
    g.print("Press Escape to quit", 20, 580)
  end
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
