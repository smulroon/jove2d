-- love2d synth example — demonstrates SoundData + newQueueableSource
-- Polyphonic audio synthesis with keyboard piano, waveform display, ADSR envelope

local SAMPLE_RATE = 44100
local BUFFER_SIZE = 4096
local BUFFER_COUNT = 8
local MAX_VOICES = 13

local queueSource = nil
local soundData = nil
local currentWaveform = "sine"
local octave = 4
local volume = 0.5

-- ADSR envelope (times in seconds)
local ATTACK = 0.01
local DECAY = 0.08
local SUSTAIN = 0.7
local RELEASE = 0.05

local ATTACK_SAMPLES = math.floor(SAMPLE_RATE * ATTACK)
local DECAY_SAMPLES = math.floor(SAMPLE_RATE * DECAY)
local RELEASE_SAMPLES = math.floor(SAMPLE_RATE * RELEASE)

-- Voice pool
local voices = {}

local function findVoice(key)
  for _, v in ipairs(voices) do
    if v.key == key and v.envStage ~= "off" then return v end
  end
  return nil
end

local function noteOn(key, freq)
  -- If this key already has an active (non-releasing) voice, ignore (key repeat)
  local voice = findVoice(key)
  if voice and voice.envStage ~= "release" then return end
  -- Retrigger a releasing voice
  if voice then
    voice.freq = freq
    voice.phase = 0
    voice.envStage = "attack"
    voice.envPos = 0
    voice.envLevel = 0
    return
  end
  -- Reuse an "off" voice or create new
  for _, v in ipairs(voices) do
    if v.envStage == "off" then
      v.freq = freq
      v.phase = 0
      v.envStage = "attack"
      v.envPos = 0
      v.envLevel = 0
      v.key = key
      return
    end
  end
  if #voices < MAX_VOICES then
    table.insert(voices, {
      freq = freq, phase = 0,
      envStage = "attack", envPos = 0, envLevel = 0,
      key = key,
    })
  end
end

local function noteOff(key)
  local voice = findVoice(key)
  if voice and voice.envStage ~= "release" and voice.envStage ~= "off" then
    voice.envStage = "release"
    voice.envPos = 0
  end
end

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

-- Generate a raw waveform sample at phase p
local function waveformSample(waveform, p)
  local t = p % 1
  if waveform == "sine" then
    return math.sin(2 * math.pi * p)
  elseif waveform == "square" then
    return t < 0.5 and 0.8 or -0.8
  elseif waveform == "sawtooth" then
    return 2 * t - 1
  elseif waveform == "triangle" then
    return 4 * math.abs(t - 0.5) - 1
  end
  return 0
end

-- Advance envelope by one sample, return amplitude (0-1)
local function envTick(v)
  if v.envStage == "attack" then
    v.envLevel = v.envPos / ATTACK_SAMPLES
    v.envPos = v.envPos + 1
    if v.envPos >= ATTACK_SAMPLES then v.envStage = "decay"; v.envPos = 0 end
    return v.envLevel
  elseif v.envStage == "decay" then
    v.envLevel = 1 - (1 - SUSTAIN) * (v.envPos / DECAY_SAMPLES)
    v.envPos = v.envPos + 1
    if v.envPos >= DECAY_SAMPLES then v.envStage = "sustain"; v.envPos = 0 end
    return v.envLevel
  elseif v.envStage == "sustain" then
    return SUSTAIN
  elseif v.envStage == "release" then
    v.envLevel = SUSTAIN * (1 - v.envPos / RELEASE_SAMPLES)
    v.envPos = v.envPos + 1
    if v.envPos >= RELEASE_SAMPLES then v.envStage = "off"; v.envLevel = 0 end
    return v.envLevel
  else -- off
    return 0
  end
end

-- Count active voices
local function activeVoiceCount()
  local n = 0
  for _, v in ipairs(voices) do
    if v.envStage ~= "off" then n = n + 1 end
  end
  return n
end

-- Fill the SoundData by mixing all active voices
local function fillBuffer(waveform)
  -- Count active voices for normalization (prevent clipping)
  local numActive = 0
  for _, v in ipairs(voices) do
    if v.envStage ~= "off" then numActive = numActive + 1 end
  end
  local norm = numActive > 1 and (1 / math.sqrt(numActive)) or 1

  for i = 0, BUFFER_SIZE - 1 do
    local mix = 0
    for _, v in ipairs(voices) do
      if v.envStage ~= "off" then
        local inc = v.freq / SAMPLE_RATE
        local p = v.phase + i * inc
        mix = mix + waveformSample(waveform, p) * envTick(v)
      end
    end
    soundData:setSample(i, mix * norm * volume)
  end

  -- Advance phase for each voice
  for _, v in ipairs(voices) do
    if v.envStage ~= "off" then
      local inc = v.freq / SAMPLE_RATE
      v.phase = v.phase + BUFFER_SIZE * inc
      if v.phase > 1e6 then v.phase = v.phase - math.floor(v.phase) end
    end
  end
end

-- Get display frequency (highest active sustained voice, for oscilloscope)
local function displayFreq()
  local freq = 0
  for _, v in ipairs(voices) do
    if v.envStage ~= "off" and v.envStage ~= "release" and v.freq > freq then
      freq = v.freq
    end
  end
  return freq
end

-- Draw waveform oscilloscope
local function drawWaveform(x, y, w, h)
  love.graphics.setColor(15/255, 20/255, 30/255)
  love.graphics.rectangle("fill", x, y, w, h)

  love.graphics.setColor(60/255, 80/255, 120/255)
  love.graphics.rectangle("line", x, y, w, h)

  love.graphics.setColor(40/255, 50/255, 70/255)
  love.graphics.line(x, y + h/2, x + w, y + h/2)

  love.graphics.setColor(30/255, 40/255, 55/255)
  love.graphics.line(x, y + h/4, x + w, y + h/4)
  love.graphics.line(x, y + 3*h/4, x + w, y + 3*h/4)
  love.graphics.line(x + w/4, y, x + w/4, y + h)
  love.graphics.line(x + w/2, y, x + w/2, y + h)
  love.graphics.line(x + 3*w/4, y, x + 3*w/4, y + h)

  local dFreq = displayFreq()
  if dFreq == 0 then
    love.graphics.setColor(80/255, 80/255, 80/255)
    love.graphics.print("No signal", x + w/2 - 30, y + h/2 - 5)
    return
  end

  local samplesPerCycle = SAMPLE_RATE / dFreq
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

  queueSource = love.audio.newQueueableSource(SAMPLE_RATE, 16, 1, BUFFER_COUNT)
  soundData = love.sound.newSoundData(BUFFER_SIZE, SAMPLE_RATE, 16, 1)
end

function love.update(dt)
  if not queueSource or not soundData then return end

  if activeVoiceCount() > 0 then
    local queued = false
    while queueSource:getFreeBufferCount() > 0 do
      fillBuffer(currentWaveform)
      if not queueSource:queue(soundData) then break end
      queued = true
    end
    if queued and not queueSource:isPlaying() then
      queueSource:play()
    end
  end
end

function love.draw()
  local margin = 20
  local winW = love.graphics.getWidth()
  local y = margin

  love.graphics.setColor(1, 1, 1)
  love.graphics.print("=== Procedural Audio Synth ===   FPS: " .. love.timer.getFPS(), margin, y)
  y = y + 28

  drawWaveform(margin, y, winW - margin * 2, 180)
  y = y + 195

  love.graphics.setColor(1, 220/255, 100/255)
  love.graphics.print("Waveform: " .. currentWaveform, margin, y)
  y = y + 20

  local active = activeVoiceCount()
  if active > 0 then
    love.graphics.setColor(100/255, 1, 160/255)
    love.graphics.print("Voices: " .. active, margin, y)
  else
    love.graphics.setColor(120/255, 120/255, 120/255)
    love.graphics.print("Voices: --", margin, y)
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

  drawKeyboard(margin, y, winW - margin * 2, 100)
  y = y + 115

  love.graphics.setColor(150/255, 200/255, 1)
  love.graphics.print("Controls:", margin, y)
  y = y + 20
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("Z-M        Piano keys (C to C) — polyphonic!", margin, y); y = y + 16
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

  if key == "1" then currentWaveform = "sine"; return end
  if key == "2" then currentWaveform = "square"; return end
  if key == "3" then currentWaveform = "sawtooth"; return end
  if key == "4" then currentWaveform = "triangle"; return end

  if key == "up" then octave = math.min(7, octave + 1); return end
  if key == "down" then octave = math.max(1, octave - 1); return end

  if key == "right" then volume = math.min(1.0, volume + 0.1); return end
  if key == "left" then volume = math.max(0.0, volume - 0.1); return end

  local noteInfo = KEY_MAP[key]
  if noteInfo then
    local oct = noteInfo.note >= 12 and octave + 1 or octave
    local note = noteInfo.note % 12
    noteOn(key, noteFreq(note, oct))
  end
end

function love.keyreleased(key)
  if KEY_MAP[key] then
    noteOff(key)
  end
end
