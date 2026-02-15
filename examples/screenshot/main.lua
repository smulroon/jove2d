-- love2d screenshot example — draws content then captures a screenshot

local captured = false
local sourceDir = nil

function love.load()
    love.window.setTitle("Screenshot Example")
    love.graphics.setBackgroundColor(25/255, 50/255, 80/255)
    sourceDir = love.filesystem.getSource()
end

function love.draw()

    love.graphics.setColor(1, 200/255, 50/255)
    love.graphics.rectangle("fill", 100, 100, 200, 150)

    love.graphics.setColor(50/255, 200/255, 100/255)
    love.graphics.circle("fill", 500, 300, 80)

    love.graphics.setColor(200/255, 80/255, 80/255)
    love.graphics.polygon("fill", 350, 50, 450, 150, 250, 150)

    if not captured then
        captured = true
        love.graphics.captureScreenshot(function(imageData)
            local fileData = imageData:encode("png")
            local saveDir = love.filesystem.getSaveDirectory()
            local savePath = saveDir .. "/screenshot_love.png"
            love.filesystem.write("screenshot_love.png", fileData)
            -- Copy from save directory to source directory
            local destPath = sourceDir .. "/screenshot_love.png"
            os.execute('cp "' .. savePath .. '" "' .. destPath .. '"')
            print("Screenshot saved to " .. destPath)
            love.event.quit()
        end)
    end
end
