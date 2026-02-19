-- love2d preSolve example — one-way platforms
-- Balls land on platforms from above but pass through from below.
-- Press Space to launch all balls upward. Click to spawn balls.

local world
local balls = {}
local platforms = {}
local ground, wallL, wallR

local GROUND_Y = 580
local WALL_THICK = 20
local PLAT_H = 12

local PLAT_YS = {450, 320, 190}
local PLAT_WIDTHS = {240, 200, 160}
local PLAT_XS = {250, 500, 350}

function love.load()
    love.window.setTitle("love2d — PreSolve (One-Way Platforms)")

    world = love.physics.newWorld(0, 9.81 * 30, true)

    -- Solid ground
    ground = love.physics.newBody(world, 400, GROUND_Y, "static")
    love.physics.newFixture(ground, love.physics.newRectangleShape(800, WALL_THICK))

    -- Walls
    wallL = love.physics.newBody(world, 0, 300, "static")
    love.physics.newFixture(wallL, love.physics.newRectangleShape(WALL_THICK, 600))
    wallR = love.physics.newBody(world, 800, 300, "static")
    love.physics.newFixture(wallR, love.physics.newRectangleShape(WALL_THICK, 600))

    -- One-way platforms
    for i = 1, #PLAT_YS do
        local body = love.physics.newBody(world, PLAT_XS[i], PLAT_YS[i], "static")
        local shape = love.physics.newRectangleShape(PLAT_WIDTHS[i], PLAT_H)
        local fixture = love.physics.newFixture(body, shape)
        fixture:setUserData("oneway")
        fixture:setFriction(0.5)
        table.insert(platforms, { body = body, fixture = fixture, w = PLAT_WIDTHS[i], h = PLAT_H })
    end

    -- preSolve callback
    world:setCallbacks(
        nil, -- beginContact
        nil, -- endContact
        function(fA, fB, contact) -- preSolve
            local udA = fA:getUserData()
            local udB = fB:getUserData()

            local platFixture, ballBody
            if udA == "oneway" then
                platFixture = fA
                ballBody = fB:getBody()
            elseif udB == "oneway" then
                platFixture = fB
                ballBody = fA:getBody()
            end

            if not platFixture or not ballBody then return end

            local _, platY = platFixture:getBody():getPosition()
            local _, ballY = ballBody:getPosition()

            -- Find ball radius
            local ballRadius = 15
            for _, b in ipairs(balls) do
                if b.body == ballBody then
                    ballRadius = b.radius
                    break
                end
            end

            -- Disable contact if ball center is below platform top
            if ballY + ballRadius * 0.3 > platY then
                contact:setEnabled(false)
            end
        end
    )

    -- Initial balls
    for i = 1, 3 do
        spawnBall(300 + (i - 1) * 100, 80)
    end
end

function love.update(dt)
    world:update(dt)

    -- Remove balls off screen
    for i = #balls, 1, -1 do
        local _, by = balls[i].body:getPosition()
        if by > 700 then
            balls[i].body:destroy()
            table.remove(balls, i)
        end
    end
end

function love.draw()
    -- Background
    love.graphics.setBackgroundColor(30/255, 30/255, 45/255)

    -- Ground
    love.graphics.setColor(80/255, 80/255, 80/255)
    local gx, gy = ground:getPosition()
    love.graphics.rectangle("fill", gx - 400, gy - WALL_THICK / 2, 800, WALL_THICK)

    -- Walls
    love.graphics.setColor(60/255, 60/255, 60/255)
    local lx, ly = wallL:getPosition()
    love.graphics.rectangle("fill", lx - WALL_THICK / 2, ly - 300, WALL_THICK, 600)
    local rx, ry = wallR:getPosition()
    love.graphics.rectangle("fill", rx - WALL_THICK / 2, ry - 300, WALL_THICK, 600)

    -- One-way platforms
    for _, plat in ipairs(platforms) do
        local px, py = plat.body:getPosition()

        -- Platform body
        love.graphics.setColor(100/255, 180/255, 100/255)
        love.graphics.rectangle("fill", px - plat.w / 2, py - plat.h / 2, plat.w, plat.h)

        -- Top edge highlight
        love.graphics.setColor(140/255, 220/255, 140/255)
        love.graphics.rectangle("fill", px - plat.w / 2, py - plat.h / 2, plat.w, 3)

        -- Upward arrows
        love.graphics.setColor(60/255, 130/255, 60/255)
        local arrowSpacing = 40
        local startX = px - plat.w / 2 + 20
        local endX = px + plat.w / 2 - 20
        for ax = startX, endX, arrowSpacing do
            local ay = py
            love.graphics.line(ax, ay + 3, ax, ay - 3)
            love.graphics.line(ax - 3, ay, ax, ay - 3)
            love.graphics.line(ax + 3, ay, ax, ay - 3)
        end
    end

    -- Balls
    for _, ball in ipairs(balls) do
        local bx, by = ball.body:getPosition()
        local angle = ball.body:getAngle()

        love.graphics.setColor(ball.color[1]/255, ball.color[2]/255, ball.color[3]/255)
        love.graphics.circle("fill", bx, by, ball.radius)

        love.graphics.setColor(1, 1, 1, 0.7)
        local dx = math.cos(angle) * ball.radius * 0.6
        local dy = math.sin(angle) * ball.radius * 0.6
        love.graphics.line(bx, by, bx + dx, by + dy)
    end

    -- HUD
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("FPS: " .. love.timer.getFPS(), 20, 10)
    love.graphics.print("Balls: " .. #balls, 20, 30)
    love.graphics.print("Click to spawn balls", 20, 50)
    love.graphics.print("Space = launch upward", 20, 70)
    love.graphics.print("R = reset", 20, 90)

    love.graphics.setColor(100/255, 180/255, 100/255)
    love.graphics.print("Green platforms are one-way (pass through from below)", 20, 570)
end

function love.mousepressed(x, y, button)
    if button == 1 then
        spawnBall(x, y)
    end
end

function love.keypressed(key)
    if key == "space" then
        for _, ball in ipairs(balls) do
            ball.body:applyLinearImpulse(0, -ball.body:getMass() * 400)
        end
    end
    if key == "r" then
        for _, ball in ipairs(balls) do
            ball.body:destroy()
        end
        balls = {}
        for i = 1, 3 do
            spawnBall(300 + (i - 1) * 100, 80)
        end
    end
    if key == "escape" then
        love.event.quit()
    end
end

function spawnBall(x, y)
    local radius = 12 + math.random() * 10
    local body = love.physics.newBody(world, x, y, "dynamic")
    local shape = love.physics.newCircleShape(radius)
    local fixture = love.physics.newFixture(body, shape, 1.0)
    fixture:setRestitution(0.1)
    fixture:setFriction(0.3)

    local color = {
        120 + math.floor(math.random() * 135),
        120 + math.floor(math.random() * 135),
        120 + math.floor(math.random() * 135),
    }

    table.insert(balls, { body = body, radius = radius, color = color })
end
