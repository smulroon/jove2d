-- love2d synth example — demonstrates SoundData + newQueueableSource
-- Procedural audio synthesis with keyboard piano, waveform display, multiple waveforms

local SAMPLE_RATE = 44100
local BUFFER_SIZE = 4096
local BUFFER_COUNT = 8

local queueSource = nil
local soundData = nil
local currentWaveform = "sine"
local currentFreq = 0
local currentNote = ""
local octave = 4
local phase = 0
local volume = 0.5

-- Note frequencies (equal temperament, A4 = 440 Hz)
local function noteFreq(note, oct)
  return 440 * math.pow(2, (oct - 4) + (note - 9) / 12)
end

-- Piano key mapping
local KEY_MAP = {
  z = {note = 0, label = "C"},
  s = {note = 1, label = "C#"},
  x = {note = 2, label = "D"},
  d = {note = 3, label = "D#"},
  c = {note = 4, label = "E"},
  v = {note = 5, label = "F"},
  g = {note = 6, label = "F#"},
  b = {note = 7, label = "G"},
  h = {note = 8, label = "G#"},
  n = {note = 9, label = "A"},
  j = {note = 10, label = "A#"},
  m = {note = 11, label = "B"},
  [","] = {note = 12, label = "C"},
}

-- Fill the SoundData with waveform samples
local function fillBuffer(waveform, freq)
  local inc = freq / SAMPLE_RATE

  for i = 0, BUFFER_SIZE - 1 do
    local val = 0
    local p = phase + i * inc
    local t = p % 1

    if waveform == "sine" then
      val = math.sin(2 * math.pi * p)
    elseif waveform == "square" then
      val = t < 0.5 and 0.8 or -0.8
    elseif waveform == "sawtooth" then
      val = 2 * t - 1
    elseif waveform == "triangle" then
      val = 4 * math.abs(t - 0.5) - 1
    end

    soundData:setSample(i, val * volume)
  end

  phase = phase + BUFFER_SIZE * inc
  if phase > 1e6 then phase = phase - math.floor(phase) end
end

-- Draw waveform oscilloscope
local function drawWaveform(x, y, w, h)
  -- Background
  love.graphics.setColor(15/255, 20/255, 30/255)
  love.graphics.rectangle("fill", x, y, w, h)

  -- Border
  love.graphics.setColor(60/255, 80/255, 120/255)
  love.graphics.rectangle("line", x, y, w, h)

  -- Center line
  love.graphics.setColor(40/255, 50/255, 70/255)
  love.graphics.line(x, y + h/2, x + w, y + h/2)

  -- Grid lines
  love.graphics.setColor(30/255, 40/255, 55/255)
  love.graphics.line(x, y + h/4, x + w, y + h/4)
  love.graphics.line(x, y + 3*h/4, x + w, y + 3*h/4)
  love.graphics.line(x + w/4, y, x + w/4, y + h)
  love.graphics.line(x + w/2, y, x + w/2, y + h)
  love.graphics.line(x + 3*w/4, y, x + 3*w/4, y + h)

  if currentFreq == 0 then
    love.graphics.setColor(80/255, 80/255, 80/255)
    love.graphics.print("No signal", x + w/2 - 30, y + h/2 - 5)
    return
  end

  -- Draw waveform — show ~4 cycles
  local samplesPerCycle = SAMPLE_RATE / currentFreq
  local displaySamples = math.min(math.floor(samplesPerCycle * 4), soundData:getSampleCount())

  love.graphics.setColor(80/255, 1, 160/255)

  local prevPx = x
  local prevPy = y + h/2

  for px = 0, w - 1 do
    local sampleIdx = math.floor((px / w) * displaySamples)
    local val = soundData:getSample(sampleIdx)
    local py = y + h/2 - val * (h/2 - 10)

    if px > 0 then
      love.graphics.line(prevPx, prevPy, x + px, py)
    end
    prevPx = x + px
    prevPy = py
  end
end

-- Draw a simple piano keyboard
local function drawKeyboard(x, y, w, h)
  local whiteKeys = {"z", "x", "c", "v", "b", "n", "m", ","}
  local blackKeys = {"s", "d", nil, "g", "h", "j", nil}
  local whiteW = w / #whiteKeys
  local blackW = whiteW * 0.6
  local blackH = h * 0.6

  -- White keys
  for i, key in ipairs(whiteKeys) do
    local kx = x + (i - 1) * whiteW
    local isActive = love.keyboard.isDown(key)

    if isActive then
      love.graphics.setColor(100/255, 200/255, 1)
    else
      love.graphics.setColor(240/255, 240/255, 240/255)
    end
    love.graphics.rectangle("fill", kx + 1, y, whiteW - 2, h)
    love.graphics.setColor(60/255, 60/255, 60/255)
    love.graphics.rectangle("line", kx + 1, y, whiteW - 2, h)

    love.graphics.setColor(100/255, 100/255, 100/255)
    local info = KEY_MAP[key]
    if info then
      love.graphics.print(info.label, kx + whiteW/2 - 4, y + h - 18)
    end
  end

  -- Black keys
  for i, key in ipairs(blackKeys) do
    if key then
      local kx = x + (i - 1 + 0.7) * whiteW
      local isActive = love.keyboard.isDown(key)

      if isActive then
        love.graphics.setColor(80/255, 160/255, 220/255)
      else
        love.graphics.setColor(30/255, 30/255, 35/255)
      end
      love.graphics.rectangle("fill", kx, y, blackW, blackH)
      love.graphics.setColor(20/255, 20/255, 25/255)
      love.graphics.rectangle("line", kx, y, blackW, blackH)
    end
  end
end

function love.load()
  love.window.setTitle("Synth Example — Procedural Audio")
  love.graphics.setBackgroundColor(20/255, 22/255, 30/255)

  -- Create queueable audio source and reusable SoundData buffer
  queueSource = love.audio.newQueueableSource(SAMPLE_RATE, 16, 1, BUFFER_COUNT)
  soundData = love.sound.newSoundData(BUFFER_SIZE, SAMPLE_RATE, 16, 1)
end

function love.update(dt)
  if not queueSource or not soundData then return end

  -- Fill available buffer slots with audio data
  if currentFreq > 0 then
    local queued = false
    while queueSource:getFreeBufferCount() > 0 do
      fillBuffer(currentWaveform, currentFreq)
      if not queueSource:queue(soundData) then break end
      queued = true
    end
    -- love2d auto-stops QueueableSources when they drain, so re-play after queuing
    if queued and not queueSource:isPlaying() then
      queueSource:play()
    end
  end
end

function love.draw()
  local margin = 20
  local winW = love.graphics.getWidth()
  local y = margin

  -- Title
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("=== Procedural Audio Synth ===   FPS: " .. love.timer.getFPS(), margin, y)
  y = y + 28

  -- Waveform display
  drawWaveform(margin, y, winW - margin * 2, 180)
  y = y + 195

  -- Info panel
  love.graphics.setColor(1, 220/255, 100/255)
  love.graphics.print("Waveform: " .. currentWaveform, margin, y)
  y = y + 20

  if currentFreq > 0 then
    love.graphics.setColor(100/255, 1, 160/255)
    love.graphics.print(string.format("Note: %s%d (%.1f Hz)", currentNote, octave, currentFreq), margin, y)
  else
    love.graphics.setColor(120/255, 120/255, 120/255)
    love.graphics.print("Note: --", margin, y)
  end
  y = y + 20

  love.graphics.setColor(200/255, 200/255, 200/255)
  love.graphics.print("Octave: " .. octave, margin, y)
  love.graphics.print(string.format("Volume: %d%%", volume * 100), margin + 120, y)
  y = y + 20

  if queueSource then
    love.graphics.setColor(150/255, 180/255, 1)
    love.graphics.print(string.format("Free buffers: %d/%d", queueSource:getFreeBufferCount(), BUFFER_COUNT), margin, y)
    local state = queueSource:isPlaying() and "playing" or "stopped"
    love.graphics.print("Source: " .. state, margin + 200, y)
  end
  y = y + 20

  love.graphics.setColor(140/255, 140/255, 140/255)
  love.graphics.print(string.format(
    "SoundData: %d samples, %d Hz, %d-bit, %dch, %.3fs",
    soundData:getSampleCount(), soundData:getSampleRate(),
    soundData:getBitDepth(), soundData:getChannelCount(),
    soundData:getDuration()
  ), margin, y)
  y = y + 30

  -- Piano keyboard
  drawKeyboard(margin, y, winW - margin * 2, 100)
  y = y + 115

  -- Controls
  love.graphics.setColor(150/255, 200/255, 1)
  love.graphics.print("Controls:", margin, y)
  y = y + 20
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("Z-M        Piano keys (C to C)", margin, y); y = y + 16
  love.graphics.print("1-4        Waveform (sine/square/saw/tri)", margin, y); y = y + 16
  love.graphics.print("UP/DOWN    Octave +/-", margin, y); y = y + 16
  love.graphics.print("LEFT/RIGHT Volume +/-", margin, y); y = y + 16
  love.graphics.print("ESC        Quit", margin, y)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
    return
  end

  -- Waveform selection
  if key == "1" then currentWaveform = "sine"; return end
  if key == "2" then currentWaveform = "square"; return end
  if key == "3" then currentWaveform = "sawtooth"; return end
  if key == "4" then currentWaveform = "triangle"; return end

  -- Octave
  if key == "up" then octave = math.min(7, octave + 1); return end
  if key == "down" then octave = math.max(1, octave - 1); return end

  -- Volume
  if key == "right" then volume = math.min(1.0, volume + 0.1); return end
  if key == "left" then volume = math.max(0.0, volume - 0.1); return end

  -- Piano keys
  local noteInfo = KEY_MAP[key]
  if noteInfo then
    local oct = noteInfo.note >= 12 and octave + 1 or octave
    local note = noteInfo.note % 12
    currentFreq = noteFreq(note, oct)
    currentNote = noteInfo.label
    phase = 0
  end
end

function love.keyreleased(key)
  if KEY_MAP[key] then
    currentFreq = 0
    currentNote = ""
  end
end
