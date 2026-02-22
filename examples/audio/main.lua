-- love2d equivalent of the audio example
-- Demonstrates play/pause/stop, pitch, volume, looping, seek
-- Also demonstrates OGG/MP3/FLAC codec support (F1-F4 to switch formats)
-- and static vs stream source types (T to toggle)
-- Generates a sine wave WAV at load time, converts to other formats via ffmpeg

local source = nil
local paused = false
local statusMsg = "Press SPACE to play"
local currentFormat = 1
local sourceType = "static"
local formats = {}

-- Get love2d save directory path for ffmpeg conversion
local function getSavePath()
  return love.filesystem.getSaveDirectory()
end

-- Generate a WAV file programmatically
local function generateWav(durationSec, freq)
  local sampleRate = 44100
  local numSamples = math.floor(sampleRate * durationSec)
  local dataSize = numSamples * 2
  local fileSize = 44 + dataSize

  local bytes = {}

  -- Helper: write little-endian 16-bit
  local function writeU16(val)
    bytes[#bytes+1] = string.char(val % 256)
    bytes[#bytes+1] = string.char(math.floor(val / 256) % 256)
  end
  -- Helper: write little-endian 32-bit
  local function writeU32(val)
    bytes[#bytes+1] = string.char(val % 256)
    bytes[#bytes+1] = string.char(math.floor(val / 256) % 256)
    bytes[#bytes+1] = string.char(math.floor(val / 65536) % 256)
    bytes[#bytes+1] = string.char(math.floor(val / 16777216) % 256)
  end
  -- Helper: write big-endian 4-char tag
  local function writeTag(tag)
    for i = 1, #tag do
      bytes[#bytes+1] = tag:sub(i, i)
    end
  end

  -- RIFF header
  writeTag("RIFF")
  writeU32(fileSize - 8)
  writeTag("WAVE")

  -- fmt chunk
  writeTag("fmt ")
  writeU32(16)
  writeU16(1) -- PCM
  writeU16(1) -- mono
  writeU32(sampleRate)
  writeU32(sampleRate * 2) -- byte rate
  writeU16(2) -- block align
  writeU16(16) -- bits per sample

  -- data chunk
  writeTag("data")
  writeU32(dataSize)

  -- Sine wave samples (S16 LE)
  for i = 0, numSamples - 1 do
    local t = i / sampleRate
    local sample = 0.6 * math.sin(2 * math.pi * freq * t)
                 + 0.3 * math.sin(2 * math.pi * freq * 2 * t)
                 + 0.1 * math.sin(2 * math.pi * freq * 3 * t)
    local s16 = math.max(-32768, math.min(32767, math.floor(sample * 32767)))
    if s16 < 0 then s16 = s16 + 65536 end
    writeU16(s16)
  end

  return table.concat(bytes)
end

-- Try converting WAV to another format via ffmpeg
local function tryConvert(wavAbsPath, ext, ffmpegArgs)
  local outPath = getSavePath() .. "/example-audio." .. ext
  local cmd = "ffmpeg -y -i " .. wavAbsPath .. " " .. ffmpegArgs .. " " .. outPath .. " 2>/dev/null"
  local ok = os.execute(cmd)
  if ok then
    -- Verify file exists via love.filesystem
    return love.filesystem.getInfo("example-audio." .. ext) ~= nil
  end
  return false
end

local function switchFormat(index, force)
  if index < 1 or index > #formats or not formats[index].available then return end
  if index == currentFormat and source and not force then return end

  -- Stop and release current source
  if source then
    source:stop()
    source = nil
  end

  currentFormat = index
  local fmt = formats[currentFormat]
  local ok, src = pcall(love.audio.newSource, fmt.filename, sourceType)
  if ok and src then
    source = src
    statusMsg = "Loaded " .. fmt.label .. " (" .. sourceType .. ") -- press SPACE to play"
    paused = false
  else
    source = nil
    statusMsg = "Failed to load " .. fmt.label .. "!"
  end
end

function love.load()
  love.window.setTitle("Audio Example")
  love.graphics.setBackgroundColor(25/255, 25/255, 35/255)

  -- Write WAV to save directory
  local wavData = generateWav(3.0, 261.63) -- 3 seconds, middle C
  love.filesystem.write("example-audio.wav", wavData)

  local wavAbsPath = getSavePath() .. "/example-audio.wav"

  -- WAV is always available
  formats[1] = { ext = "wav", label = "WAV", filename = "example-audio.wav", available = true }

  -- Try creating OGG/MP3/FLAC via ffmpeg
  local oggOk = tryConvert(wavAbsPath, "ogg", "-c:a libvorbis -q:a 2")
  formats[2] = { ext = "ogg", label = "OGG Vorbis", filename = "example-audio.ogg", available = oggOk }

  local mp3Ok = tryConvert(wavAbsPath, "mp3", "-c:a libmp3lame -q:a 9")
  formats[3] = { ext = "mp3", label = "MP3", filename = "example-audio.mp3", available = mp3Ok }

  local flacOk = tryConvert(wavAbsPath, "flac", "-c:a flac")
  formats[4] = { ext = "flac", label = "FLAC", filename = "example-audio.flac", available = flacOk }

  -- Load initial WAV source
  source = love.audio.newSource("example-audio.wav", sourceType)
  if not source then
    statusMsg = "Failed to create audio source!"
  end
end

function love.update(dt)
  if not source then return end

  if source:isPlaying() then
    statusMsg = "Playing"
  elseif paused then
    statusMsg = "Paused"
  else
    statusMsg = "Stopped"
    paused = false
  end
end

function love.draw()
  local y = 20
  local x = 20

  love.graphics.setColor(1, 1, 1)
  love.graphics.print("=== Audio Example ===", x, y)

  -- Format info
  love.graphics.setColor(1, 220/255, 100/255)
  local fmt = formats[currentFormat]
  love.graphics.print("Format: " .. (fmt and fmt.label or "none") .. "  |  Type: " .. sourceType, x, y + 22)

  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Status: " .. statusMsg, x, y + 44)

  if source then
    love.graphics.print(string.format("Duration: %.2fs", source:getDuration()), x, y + 64)
    love.graphics.print(string.format("Position: %.2fs", source:tell()), x, y + 84)
    love.graphics.print(string.format("Volume: %d%%", source:getVolume() * 100), x, y + 104)
    love.graphics.print(string.format("Pitch: %.2fx", source:getPitch()), x, y + 124)
    love.graphics.print("Looping: " .. (source:isLooping() and "ON" or "OFF"), x, y + 144)
    love.graphics.print("Active sources: " .. love.audio.getActiveSourceCount(), x, y + 164)
    love.graphics.print(string.format("Master volume: %d%%", love.audio.getVolume() * 100), x, y + 184)
  end

  -- Format selection
  love.graphics.setColor(150/255, 200/255, 1)
  love.graphics.print("Format (F1-F4):", x, y + 216)
  for i = 1, #formats do
    local f = formats[i]
    if i == currentFormat then
      love.graphics.setColor(100/255, 1, 100/255)
    elseif f.available then
      love.graphics.setColor(180/255, 180/255, 180/255)
    else
      love.graphics.setColor(100/255, 100/255, 100/255)
    end
    local marker = i == currentFormat and ">" or " "
    local avail = f.available and "" or " (needs ffmpeg)"
    love.graphics.print(marker .. " F" .. i .. " " .. f.label .. avail, x + 10, y + 236 + (i - 1) * 18)
  end

  -- Controls
  love.graphics.setColor(150/255, 200/255, 1)
  love.graphics.print("Controls:", x, y + 316)
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("SPACE  -- Play / Restart", x, y + 336)
  love.graphics.print("P      -- Pause / Resume", x, y + 356)
  love.graphics.print("S      -- Stop", x, y + 376)
  love.graphics.print("L      -- Toggle looping", x, y + 396)
  love.graphics.print("UP/DN  -- Pitch +/- 0.1", x, y + 416)
  love.graphics.print("LT/RT  -- Volume +/- 10%", x, y + 436)
  love.graphics.print("[/]    -- Master volume +/- 10%", x, y + 456)
  love.graphics.print("1-9    -- Seek to 0-100%", x, y + 476)
  love.graphics.print("C      -- Clone + play", x, y + 496)
  love.graphics.print("T      -- Toggle static/stream", x, y + 516)
  love.graphics.print("ESC    -- Quit", x, y + 536)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
    return
  end

  -- Format switching
  if key == "f1" then switchFormat(1); return end
  if key == "f2" then switchFormat(2); return end
  if key == "f3" then switchFormat(3); return end
  if key == "f4" then switchFormat(4); return end

  if not source then return end

  if key == "space" then
    source:play()
    paused = false
  elseif key == "p" then
    if source:isPlaying() then
      source:pause()
      paused = true
    elseif paused then
      source:play()
      paused = false
    end
  elseif key == "s" then
    source:stop()
    paused = false
  elseif key == "l" then
    source:setLooping(not source:isLooping())
  elseif key == "up" then
    source:setPitch(math.min(3.0, source:getPitch() + 0.1))
  elseif key == "down" then
    source:setPitch(math.max(0.1, source:getPitch() - 0.1))
  elseif key == "right" then
    source:setVolume(math.min(1.0, source:getVolume() + 0.1))
  elseif key == "left" then
    source:setVolume(math.max(0.0, source:getVolume() - 0.1))
  elseif key == "]" then
    love.audio.setVolume(math.min(1.0, love.audio.getVolume() + 0.1))
  elseif key == "[" then
    love.audio.setVolume(math.max(0.0, love.audio.getVolume() - 0.1))
  elseif key == "c" then
    local cloned = source:clone()
    cloned:setPitch(1.5)
    cloned:play()
  elseif key == "t" then
    sourceType = sourceType == "static" and "stream" or "static"
    switchFormat(currentFormat, true)
  elseif key >= "1" and key <= "9" then
    local pct = tonumber(key) / 10
    source:seek(pct * source:getDuration())
  end
end
