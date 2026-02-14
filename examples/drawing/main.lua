-- love2d equivalent of the drawing example

local t = 0

function love.load()
    love.window.setTitle("Drawing Primitives")
    love.graphics.setBackgroundColor(40/255, 44/255, 52/255)
end

function love.update(dt)
    t = t + dt
end

function love.draw()
    -- Red filled rectangle
    love.graphics.setColor(220/255, 50/255, 50/255)
    love.graphics.rectangle("fill", 50, 50, 150, 100)

    -- Green outlined rectangle
    love.graphics.setColor(50/255, 220/255, 50/255)
    love.graphics.rectangle("line", 250, 50, 150, 100)

    -- Blue filled circle (pulsing)
    local radius = 50 + math.sin(t * 2) * 10
    love.graphics.setColor(50/255, 100/255, 220/255)
    love.graphics.circle("fill", 400, 350, radius)

    -- Yellow outlined circle
    love.graphics.setColor(220/255, 220/255, 50/255)
    love.graphics.circle("line", 200, 350, 60)

    -- White diagonal line
    love.graphics.setColor(1, 1, 1)
    love.graphics.line(0, 0, 800, 600)

    -- Cyan multi-segment line
    love.graphics.setColor(50/255, 220/255, 220/255)
    love.graphics.line(600, 50, 700, 150, 650, 250, 750, 200)

    -- Magenta points
    love.graphics.setColor(220/255, 50/255, 220/255)
    for i = 0, 19 do
        love.graphics.points(500 + i * 10, 500)
    end

    -- White text
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("love2d drawing primitives!", 10, 10)
    love.graphics.print(string.format("time: %.1fs", t), 10, 580)
end
