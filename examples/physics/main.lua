-- love2d physics example — bouncing balls with Box2D
-- Left-click = red ball, right-click = blue ball (collision filtering).
-- Red and blue balls pass through each other but bounce off same-color balls and walls.

local world
local balls = {}
local ground, wallL, wallR
local GROUND_Y = 550
local WALL_THICKNESS = 20
local contactFlashes = {}

local FIXED_DT = 1 / 60
local accumulator = 0

-- Collision categories (love2d uses category numbers 1-16)
-- Category 1 = walls (default), Category 2 = red, Category 3 = blue
-- setMask takes categories to NOT collide with (inverted from Box2D)

-- Saved transforms for save/load
local savedTransforms = nil

function love.load()
    love.window.setTitle("love2d -- Physics (Box2D)")

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

    -- Initial balls (alternating red/blue)
    for i = 1, 5 do
        spawnBall(200 + (i - 1) * 80, 100 + (i - 1) * 30, i % 2 == 1 and "red" or "blue")
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
    love.graphics.setColor(1, 120/255, 120/255)
    love.graphics.print("Left-click = red ball", 20, 50)
    love.graphics.setColor(120/255, 120/255, 1)
    love.graphics.print("Right-click = blue ball", 20, 70)
    love.graphics.setColor(200/255, 200/255, 200/255)
    love.graphics.print("Red/blue pass through each other (collision filter)", 20, 90)
    love.graphics.print("T = teleport nearest ball to mouse", 20, 110)
    love.graphics.print("S = save transforms, L = load transforms", 20, 130)
    love.graphics.print("R = reset", 20, 150)

    if savedTransforms then
        love.graphics.setColor(100/255, 1, 100/255)
        love.graphics.print("[" .. #savedTransforms .. " transforms saved]", 20, 170)
    end
end

function love.mousepressed(x, y, button)
    if button == 1 then
        spawnBall(x, y, "red")
    elseif button == 2 then
        spawnBall(x, y, "blue")
    end
end

function love.keypressed(key)
    if key == "r" then
        for _, ball in ipairs(balls) do
            ball.body:destroy()
        end
        balls = {}
        contactFlashes = {}
        savedTransforms = nil
    end

    if key == "t" and #balls > 0 then
        -- Teleport nearest ball to mouse position using setX/setY
        local mx, my = love.mouse.getPosition()
        local nearest = balls[1]
        local bestDist = math.huge
        for _, ball in ipairs(balls) do
            local dx = ball.body:getX() - mx
            local dy = ball.body:getY() - my
            local dist = dx * dx + dy * dy
            if dist < bestDist then
                bestDist = dist
                nearest = ball
            end
        end
        nearest.body:setX(mx)
        nearest.body:setY(my)
        nearest.body:setLinearVelocity(0, 0)
        nearest.body:setAwake(true)
    end

    if key == "s" then
        -- Save all ball transforms using getTransform (x, y, angle)
        savedTransforms = {}
        for _, ball in ipairs(balls) do
            local x, y, angle = ball.body:getTransform()
            table.insert(savedTransforms, { x = x, y = y, angle = angle })
        end
    end

    if key == "l" and savedTransforms then
        -- Load saved transforms using setTransform
        local count = math.min(#balls, #savedTransforms)
        for i = 1, count do
            local t = savedTransforms[i]
            balls[i].body:setTransform(t.x, t.y, t.angle)
            balls[i].body:setLinearVelocity(0, 0)
            balls[i].body:setAngularVelocity(0)
            balls[i].body:setAwake(true)
        end
    end

    if key == "escape" then
        love.event.quit()
    end
end

function spawnBall(x, y, team)
    local radius = 10 + math.random() * 20
    local body = love.physics.newBody(world, x, y, "dynamic")
    local shape = love.physics.newCircleShape(radius)
    local fixture = love.physics.newFixture(body, shape, 1.0)
    fixture:setRestitution(0.3 + math.random() * 0.5)
    fixture:setFriction(0.3)

    -- Set collision filter using individual convenience setters
    -- love2d setMask = categories to NOT collide with
    if team == "red" then
        fixture:setCategory(2)    -- "I am category 2 (red)"
        fixture:setMask(3)        -- "Don't collide with category 3 (blue)"
    else
        fixture:setCategory(3)    -- "I am category 3 (blue)"
        fixture:setMask(2)        -- "Don't collide with category 2 (red)"
    end

    local color
    if team == "red" then
        color = {
            200 + math.floor(math.random() * 55),
            60 + math.floor(math.random() * 40),
            60 + math.floor(math.random() * 40),
        }
    else
        color = {
            60 + math.floor(math.random() * 40),
            60 + math.floor(math.random() * 40),
            200 + math.floor(math.random() * 55),
        }
    end

    table.insert(balls, { body = body, fixture = fixture, radius = radius, color = color, team = team })
end
