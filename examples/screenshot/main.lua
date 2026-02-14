-- love2d screenshot example — equivalent of main.ts for comparison

local captured = false

function love.load()
    love.window.setTitle("Screenshot Example")
    print("Will capture screenshot on first frame...")
end

function love.draw()
    if not captured then
        captured = true

        -- Save as PNG file
        love.graphics.captureScreenshot("screenshot.png")

        print("Screenshot queued — will be saved after this frame.")

        -- Quit after capture
        love.event.quit()
    end
end
