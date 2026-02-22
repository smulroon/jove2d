-- Video playback example — Ogg Theora video with controls
--
-- Controls:
--   Space     — play / pause
--   R         — rewind to start
--   Left/Right — seek -5s / +5s
--   L         — toggle looping (audio source)

local video = nil
local statusMsg = ""
local statusTimer = 0
local looping = false

local function showStatus(msg)
    statusMsg = msg
    statusTimer = 2.0
end

local function formatTime(seconds)
    local m = math.floor(seconds / 60)
    local s = math.floor(seconds % 60)
    return string.format("%d:%02d", m, s)
end

-- Get duration from audio source (Video doesn't have getDuration)
local function getDuration()
    if not video then return 0 end
    local src = video:getSource()
    if src then
        return src:getDuration()
    end
    return 0
end

function love.load()
    love.window.setTitle("love2d — Video Playback")
    love.window.setMode(800, 600, { resizable = true })

    -- Try to load a video file
    local ok, v = pcall(love.graphics.newVideo, "sample.ogv")
    if ok and v then
        video = v
        video:play()
        showStatus("Playing")
    else
        showStatus("No video loaded — place sample.ogv in examples/video/")
    end
end

function love.keypressed(key)
    if not video then return end

    if key == "space" then
        if video:isPlaying() then
            video:pause()
            showStatus("Paused")
        else
            video:play()
            showStatus("Playing")
        end
    elseif key == "r" then
        video:rewind()
        video:play()
        showStatus("Rewound")
    elseif key == "left" then
        local t = math.max(0, video:tell() - 5)
        video:seek(t)
        showStatus(string.format("Seek to %.1fs", t))
    elseif key == "right" then
        local dur = getDuration()
        local t = math.min(dur, video:tell() + 5)
        video:seek(t)
        showStatus(string.format("Seek to %.1fs", t))
    elseif key == "l" then
        looping = not looping
        local src = video:getSource()
        if src then
            src:setLooping(looping)
        end
        if looping then
            showStatus("Looping ON")
        else
            showStatus("Looping OFF")
        end
    end
end

function love.update(dt)
    if statusTimer > 0 then statusTimer = statusTimer - dt end

    -- Restart video if looping and ended
    if video and looping and not video:isPlaying() then
        video:rewind()
        video:play()
    end
end

function love.draw()
    love.graphics.setBackgroundColor(20/255, 20/255, 30/255)

    local ww, wh = love.graphics.getDimensions()

    if video then
        -- Center the video, scaled to fit window
        local vw = video:getWidth()
        local vh = video:getHeight()
        local scale = math.min(ww / vw, (wh - 80) / vh)
        local dx = (ww - vw * scale) / 2
        local dy = (wh - 80 - vh * scale) / 2

        love.graphics.setColor(1, 1, 1)
        love.graphics.draw(video, dx, dy, 0, scale, scale)

        -- Progress bar
        local barY = wh - 50
        local barX = 40
        local barW = ww - 80
        local barH = 8
        local duration = getDuration()
        local pos = video:tell()
        local progress = duration > 0 and pos / duration or 0

        -- Bar background
        love.graphics.setColor(60/255, 60/255, 80/255)
        love.graphics.rectangle("fill", barX, barY, barW, barH)

        -- Bar fill
        love.graphics.setColor(100/255, 180/255, 1)
        love.graphics.rectangle("fill", barX, barY, barW * progress, barH)

        -- Time text
        love.graphics.setColor(200/255, 200/255, 220/255)
        local timeStr = formatTime(pos) .. " / " .. formatTime(duration)
        love.graphics.print(timeStr, barX, barY + 12)

        -- Status indicators
        local indicators = {}
        if video:isPlaying() then
            table.insert(indicators, "[Playing]")
        else
            table.insert(indicators, "[Paused]")
        end
        if looping then
            table.insert(indicators, "[Loop]")
        end
        love.graphics.print(table.concat(indicators, " "), barX + barW - 150, barY + 12)
    end

    -- Status message (fades out)
    if statusTimer > 0 then
        local alpha = math.min(1, statusTimer)
        love.graphics.setColor(1, 1, 100/255, alpha)
        love.graphics.print(statusMsg, 20, 20)
    end

    -- Controls help
    love.graphics.setColor(120/255, 120/255, 140/255)
    love.graphics.print("Space=Play/Pause  R=Rewind  Left/Right=Seek  L=Loop", 20, wh - 20)

    if not video then
        love.graphics.setColor(1, 100/255, 100/255)
        love.graphics.print("No video loaded", ww / 2 - 50, wh / 2 - 10)
        love.graphics.setColor(180/255, 180/255, 200/255)
        love.graphics.print("Place sample.ogv in examples/video/", ww / 2 - 120, wh / 2 + 10)
        love.graphics.print("Convert: ffmpeg -i input.mp4 -c:v libtheora -c:a libvorbis output.ogv", 20, wh / 2 + 40)
    end
end
