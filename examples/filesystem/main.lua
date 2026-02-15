-- love2d equivalent of filesystem example
-- Demonstrates: love.filesystem.write, read, append, getInfo, getSaveDirectory,
-- getDirectoryItems, createDirectory, remove, setIdentity, lines

local messages = {}
local saveDir = ""

local function log(msg)
  table.insert(messages, msg)
  if #messages > 30 then table.remove(messages, 1) end
end

function love.load()
  love.window.setTitle("Filesystem Example")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(20/255, 25/255, 35/255)

  -- Set game identity for save directory
  love.filesystem.setIdentity("jove2d-fs-example")
  saveDir = love.filesystem.getSaveDirectory()
  log("Save directory: " .. saveDir)
  log("Source directory: " .. love.filesystem.getSourceBaseDirectory())
  log("")

  -- Write a file
  local ok, err = love.filesystem.write("hello.txt", "Hello from love2d!\nLine two.\nLine three.")
  log("write hello.txt: " .. (ok and "OK" or ("FAIL: " .. tostring(err))))

  -- Read it back
  local content, size = love.filesystem.read("hello.txt")
  if content then
    log('read hello.txt: "' .. content:sub(1, 40) .. '..."')
  else
    log("read hello.txt: FAIL")
  end

  -- Read lines
  local lineArr = {}
  for line in love.filesystem.lines("hello.txt") do
    table.insert(lineArr, line)
  end
  log("lines: " .. #lineArr .. " lines")

  -- Append to a file
  love.filesystem.write("log.txt", "First entry\n")
  love.filesystem.append("log.txt", "Second entry\n")
  love.filesystem.append("log.txt", "Third entry\n")
  local logContent = love.filesystem.read("log.txt")
  if logContent then
    local lineCount = 0
    for _ in logContent:gmatch("[^\n]+") do lineCount = lineCount + 1 end
    log("append log.txt: " .. lineCount .. " lines")
  end

  -- Get file info
  local info = love.filesystem.getInfo("hello.txt")
  if info then
    log("info hello.txt: " .. info.type .. ", " .. info.size .. " bytes")
  end

  -- Create a subdirectory
  love.filesystem.createDirectory("subdir")
  local subInfo = love.filesystem.getInfo("subdir")
  log("mkdir subdir: " .. (subInfo and subInfo.type or "FAIL"))

  -- List directory contents
  local items = love.filesystem.getDirectoryItems("")
  log("directory items: " .. table.concat(items, ", "))

  -- Remove a file
  local removed = love.filesystem.remove("log.txt")
  log("remove log.txt: " .. (removed and "OK" or "FAIL"))

  -- Confirm removal
  local gone = love.filesystem.getInfo("log.txt")
  log("log.txt exists: " .. tostring(gone ~= nil))

  -- Non-existent file
  local missing = love.filesystem.read("does-not-exist.txt")
  log("read missing: " .. (missing == nil and "nil (correct)" or "unexpected"))

  log("")
  log("Press ESC to quit")
end

function love.draw()
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("Filesystem Operations", 10, 10)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 10)

  love.graphics.setColor(200/255, 220/255, 200/255)
  local y = 40
  for i, msg in ipairs(messages) do
    love.graphics.print(msg, 10, y)
    local _, lineBreaks = msg:gsub("\n", "")
    y = y + (lineBreaks + 1) * 20
  end
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
