-- love2d equivalent of filesystem example
-- Demonstrates: love.filesystem.write, read, append, getInfo, getSaveDirectory,
-- getDirectoryItems, createDirectory, remove, setIdentity, lines,
-- getWorkingDirectory, getUserDirectory, getAppdataDirectory,
-- newFileData, newFile

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

  -- Directory queries
  log("=== Directory Queries ===")
  log("Save dir:    " .. saveDir)
  log("Source dir:  " .. love.filesystem.getSourceBaseDirectory())
  log("Working dir: " .. love.filesystem.getWorkingDirectory())
  log("User dir:    " .. love.filesystem.getUserDirectory())
  log("Appdata dir: " .. love.filesystem.getAppdataDirectory())
  log("")

  -- Basic I/O
  log("=== File I/O ===")
  local ok, err = love.filesystem.write("hello.txt", "Hello from love2d!\nLine two.\nLine three.")
  log("write hello.txt: " .. (ok and "OK" or ("FAIL: " .. tostring(err))))

  local content, size = love.filesystem.read("hello.txt")
  if content then
    log('read hello.txt: "' .. content:sub(1, 30):gsub("\n", "\\n") .. '..."')
  else
    log("read hello.txt: FAIL")
  end

  local lineArr = {}
  for line in love.filesystem.lines("hello.txt") do
    table.insert(lineArr, line)
  end
  log("lines: " .. #lineArr .. " lines")

  local info = love.filesystem.getInfo("hello.txt")
  if info then
    log("info: " .. info.type .. ", " .. info.size .. " bytes")
  end
  log("")

  -- File handle
  log("=== File Handle ===")
  local fw = love.filesystem.newFile("handle-test.txt")
  fw:open("w")
  fw:write("ABCDEFGHIJ")
  log("File write: 10 bytes, tell=" .. fw:tell())
  fw:close()

  local fr = love.filesystem.newFile("handle-test.txt")
  fr:open("r")
  log("File size: " .. fr:getSize())
  local first5 = fr:read(5)
  log('read(5): "' .. first5 .. '", tell=' .. fr:tell() .. ", eof=" .. tostring(fr:isEOF()))
  fr:seek(0)
  local all = fr:read()
  log('seek(0)+read(): "' .. all .. '"')
  fr:close()
  log("")

  -- FileData
  log("=== FileData ===")
  local fd = love.filesystem.newFileData("FileData content!", "demo.txt")
  log("name: " .. fd:getFilename() .. ", ext: " .. fd:getExtension() .. ", size: " .. fd:getSize())
  log('string: "' .. fd:getString() .. '"')
  local fdClone = love.filesystem.newFileData(fd:getString(), fd:getFilename())
  log('clone: "' .. fdClone:getString() .. '" (independent)')
  log("")

  -- Cleanup
  love.filesystem.remove("hello.txt")
  love.filesystem.remove("handle-test.txt")

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
    y = y + 18
  end
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
