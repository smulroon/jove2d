-- love2d equivalent of the input example

local rectX = 400
local rectY = 300
local speed = 200
local lastKey = "(none)"
local mouseLabel = ""

function love.load()
    love.window.setTitle("Input Example")
    love.graphics.setBackgroundColor(30/255, 30/255, 40/255)
end

function love.update(dt)
    if love.keyboard.isDown("up") then rectY = rectY - speed * dt end
    if love.keyboard.isDown("down") then rectY = rectY + speed * dt end
    if love.keyboard.isDown("left") then rectX = rectX - speed * dt end
    if love.keyboard.isDown("right") then rectX = rectX + speed * dt end

    local mx, my = love.mouse.getPosition()
    mouseLabel = string.format("mouse: %.0f, %.0f", mx, my)
end

function love.draw()
    love.graphics.setColor(100/255, 180/255, 1)
    love.graphics.rectangle("fill", rectX - 25, rectY - 25, 50, 50)

    local mx, my = love.mouse.getPosition()
    love.graphics.setColor(1, 1, 100/255)
    love.graphics.line(mx - 10, my, mx + 10, my)
    love.graphics.line(mx, my - 10, mx, my + 10)

    love.graphics.setColor(1, 1, 1)
    love.graphics.print("Arrow keys to move, ESC to quit", 10, 10)
    love.graphics.print("Last key: " .. lastKey, 10, 30)
    love.graphics.print(mouseLabel, 10, 50)
end

function love.keypressed(key, scancode, isRepeat)
    lastKey = key
    if isRepeat then lastKey = lastKey .. " (repeat)" end
    if key == "escape" then
        love.event.quit()
    end
end

function love.mousepressed(x, y, button)
    print(string.format("Mouse button %d pressed at %.0f, %.0f", button, x, y))
end
