-- love2d equivalent of the audio example
-- Generates a sine wave WAV at load time for playback testing

local source = nil
local paused = false
local statusMsg = "Press SPACE to play"
local wavPath = ""

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

function love.load()
  love.window.setTitle("Audio Example")
  love.graphics.setBackgroundColor(25/255, 25/255, 35/255)

  -- Write WAV to save directory
  local wavData = generateWav(3.0, 261.63) -- 3 seconds, middle C
  love.filesystem.write("example-audio.wav", wavData)

  -- Load from save directory
  source = love.audio.newSource("example-audio.wav", "static")
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

  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Status: " .. statusMsg, x, y + 30)

  if source then
    love.graphics.print(string.format("Duration: %.2fs", source:getDuration()), x, y + 50)
    love.graphics.print(string.format("Position: %.2fs", source:tell()), x, y + 70)
    love.graphics.print(string.format("Volume: %d%%", source:getVolume() * 100), x, y + 90)
    love.graphics.print(string.format("Pitch: %.2fx", source:getPitch()), x, y + 110)
    love.graphics.print("Looping: " .. (source:isLooping() and "ON" or "OFF"), x, y + 130)
    love.graphics.print("Active sources: " .. love.audio.getActiveSourceCount(), x, y + 150)
    love.graphics.print(string.format("Master volume: %d%%", love.audio.getVolume() * 100), x, y + 170)
  end

  love.graphics.setColor(150/255, 200/255, 1)
  love.graphics.print("Controls:", x, y + 210)
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("SPACE  -- Play / Restart", x, y + 230)
  love.graphics.print("P      -- Pause / Resume", x, y + 250)
  love.graphics.print("S      -- Stop", x, y + 270)
  love.graphics.print("L      -- Toggle looping", x, y + 290)
  love.graphics.print("UP/DN  -- Pitch +/- 0.1", x, y + 310)
  love.graphics.print("LT/RT  -- Volume +/- 10%", x, y + 330)
  love.graphics.print("[/]    -- Master volume +/- 10%", x, y + 350)
  love.graphics.print("1-9    -- Seek to 0-100%", x, y + 370)
  love.graphics.print("C      -- Clone + play", x, y + 390)
  love.graphics.print("ESC    -- Quit", x, y + 410)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
    return
  end

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
  elseif key >= "1" and key <= "9" then
    local pct = tonumber(key) / 10
    source:seek(pct * source:getDuration())
  end
end
