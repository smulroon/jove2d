-- love2d equivalent of the input example
-- Demonstrates: keyboard, mouse, text input, cursor control

local rectX = 400
local rectY = 300
local speed = 200
local lastKey = "(none)"
local mouseLabel = ""
local typedText = ""
local cursorVisible = true
local mouseGrabbed = false
local cursorTypes = {"arrow", "ibeam", "hand", "crosshair", "wait", "no"}
local cursorIndex = 1

function love.load()
  love.window.setTitle("Input Example")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(30/255, 30/255, 40/255)
  -- Enable text input for textinput callback
  love.keyboard.setTextInput(true)
  -- Disable key repeat so keypressed only fires on initial press
  love.keyboard.setKeyRepeat(false)
end

function love.update(dt)
  -- Move rectangle with arrow keys
  if love.keyboard.isDown("up") then rectY = rectY - speed * dt end
  if love.keyboard.isDown("down") then rectY = rectY + speed * dt end
  if love.keyboard.isDown("left") then rectX = rectX - speed * dt end
  if love.keyboard.isDown("right") then rectX = rectX + speed * dt end

  local mx, my = love.mouse.getPosition()
  mouseLabel = string.format("mouse: %.0f, %.0f", mx, my)
end

function love.draw()
  -- Draw the movable rectangle in a local coordinate space
  love.graphics.push()
  love.graphics.translate(rectX, rectY)
  love.graphics.setColor(100/255, 180/255, 1)
  love.graphics.rectangle("fill", -25, -25, 50, 50)

  -- Show mouse position in local (rectangle) coords
  local mx, my = love.mouse.getPosition()
  local lx, ly = love.graphics.inverseTransformPoint(mx, my)
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print(string.format("local: %.0f,%.0f", lx, ly), -25, 30)
  love.graphics.pop()

  -- Draw crosshair at mouse position
  love.graphics.setColor(1, 1, 100/255)
  love.graphics.line(mx - 10, my, mx + 10, my)
  love.graphics.line(mx, my - 10, mx, my + 10)

  -- HUD text
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("Arrow keys: move | ESC: quit", 10, 10)
  love.graphics.print("Last key: " .. lastKey, 10, 30)
  love.graphics.print(mouseLabel, 10, 50)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 10)

  -- Text input display
  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Type something (textinput):", 10, 80)
  love.graphics.setColor(100/255, 1, 100/255)
  love.graphics.print(typedText .. "_", 10, 100)

  -- Mouse state info
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("Cursor visible: " .. tostring(cursorVisible) .. " (V to toggle)", 10, 520)
  love.graphics.print("Mouse grabbed: " .. tostring(mouseGrabbed) .. " (G to toggle)", 10, 540)
  love.graphics.print("Cursor type: " .. cursorTypes[cursorIndex] .. " (C to cycle)", 10, 560)
  love.graphics.print("Key repeat: OFF (only initial presses shown)", 10, 580)
end

function love.keypressed(key, scancode, isRepeat)
  lastKey = key

  if key == "escape" then
    love.event.quit()
  elseif key == "v" then
    cursorVisible = not cursorVisible
    love.mouse.setVisible(cursorVisible)
  elseif key == "g" then
    mouseGrabbed = not mouseGrabbed
    love.mouse.setGrabbed(mouseGrabbed)
  elseif key == "c" then
    cursorIndex = cursorIndex % #cursorTypes + 1
    love.mouse.setCursor(love.mouse.getSystemCursor(cursorTypes[cursorIndex]))
  elseif key == "backspace" then
    typedText = typedText:sub(1, -2)
  end
end

function love.textinput(text)
  typedText = typedText .. text
end

function love.mousepressed(x, y, button)
  print(string.format("Mouse button %d pressed at %.0f, %.0f", button, x, y))
end
