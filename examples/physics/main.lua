-- love2d physics example — bouncing balls with Box2D

local world
local balls = {}
local ground, wallL, wallR
local GROUND_Y = 550
local WALL_THICKNESS = 20
local contactFlashes = {}

local FIXED_DT = 1 / 60
local accumulator = 0

function love.load()
    love.window.setTitle("love2d — Physics (Box2D)")

    world = love.physics.newWorld(0, 9.81 * 30, true)

    world:setCallbacks(
        function(a, b, coll) -- beginContact
            local ax, ay = a:getBody():getPosition()
            local bx, by = b:getBody():getPosition()
            table.insert(contactFlashes, { x = (ax + bx) / 2, y = (ay + by) / 2, timer = 0.15 })
        end
    )

    -- Ground
    ground = love.physics.newBody(world, 400, GROUND_Y, "static")
    love.physics.newFixture(ground, love.physics.newRectangleShape(800, WALL_THICKNESS))

    -- Left wall
    wallL = love.physics.newBody(world, 0, 300, "static")
    love.physics.newFixture(wallL, love.physics.newRectangleShape(WALL_THICKNESS, 600))

    -- Right wall
    wallR = love.physics.newBody(world, 800, 300, "static")
    love.physics.newFixture(wallR, love.physics.newRectangleShape(WALL_THICKNESS, 600))

    -- Initial balls
    for i = 1, 5 do
        spawnBall(200 + (i - 1) * 80, 100 + (i - 1) * 30)
    end
end

function love.update(dt)
    accumulator = accumulator + dt
    while accumulator >= FIXED_DT do
        world:update(FIXED_DT)
        accumulator = accumulator - FIXED_DT
    end

    for i = #contactFlashes, 1, -1 do
        contactFlashes[i].timer = contactFlashes[i].timer - dt
        if contactFlashes[i].timer <= 0 then
            table.remove(contactFlashes, i)
        end
    end
end

function love.draw()
    -- Walls
    love.graphics.setColor(80/255, 80/255, 80/255)
    local gx, gy = ground:getPosition()
    love.graphics.rectangle("fill", gx - 400, gy - WALL_THICKNESS / 2, 800, WALL_THICKNESS)
    local lx, ly = wallL:getPosition()
    love.graphics.rectangle("fill", lx - WALL_THICKNESS / 2, ly - 300, WALL_THICKNESS, 600)
    local rx, ry = wallR:getPosition()
    love.graphics.rectangle("fill", rx - WALL_THICKNESS / 2, ry - 300, WALL_THICKNESS, 600)

    -- Balls
    for _, ball in ipairs(balls) do
        local bx, by = ball.body:getPosition()
        local angle = ball.body:getAngle()

        love.graphics.setColor(ball.color[1]/255, ball.color[2]/255, ball.color[3]/255)
        love.graphics.circle("fill", bx, by, ball.radius)

        love.graphics.setColor(1, 1, 1, 0.7)
        local dx = math.cos(angle) * ball.radius * 0.7
        local dy = math.sin(angle) * ball.radius * 0.7
        love.graphics.line(bx, by, bx + dx, by + dy)
    end

    -- Contact flashes
    for _, flash in ipairs(contactFlashes) do
        local alpha = flash.timer / 0.15
        love.graphics.setColor(1, 1, 100/255, alpha)
        love.graphics.circle("fill", flash.x, flash.y, 8)
    end

    -- HUD
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("FPS: " .. love.timer.getFPS(), 20, 10)
    love.graphics.print("Bodies: " .. #balls, 20, 30)
    love.graphics.print("Click to spawn balls", 20, 50)
    love.graphics.print("Press R to reset", 20, 70)
end

function love.mousepressed(x, y, button)
    if button == 1 then
        spawnBall(x, y)
    end
end

function love.keypressed(key)
    if key == "r" then
        for _, ball in ipairs(balls) do
            ball.body:destroy()
        end
        balls = {}
        contactFlashes = {}
    end
    if key == "escape" then
        love.event.quit()
    end
end

function spawnBall(x, y)
    local radius = 10 + math.random() * 20
    local body = love.physics.newBody(world, x, y, "dynamic")
    local shape = love.physics.newCircleShape(radius)
    local fixture = love.physics.newFixture(body, shape, 1.0)
    fixture:setRestitution(0.3 + math.random() * 0.5)
    fixture:setFriction(0.3)

    local color = {
        100 + math.floor(math.random() * 155),
        100 + math.floor(math.random() * 155),
        100 + math.floor(math.random() * 155),
    }

    table.insert(balls, { body = body, radius = radius, color = color })
end
