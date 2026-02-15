-- love2d equivalent of data example
-- Run with: love examples/data

local lines = {}

function love.load()
  love.window.setTitle("love.data demo")
  love.window.setMode(800, 600, { resizable = true })

  -- Compression
  local original = string.rep("Hello jove2d! ", 100)
  local originalSize = #original

  local zlibData = love.data.compress("string", "zlib", original)
  local gzipData = love.data.compress("string", "gzip", original)
  local deflateData = love.data.compress("string", "deflate", original)

  local restored = love.data.decompress("string", "zlib", zlibData)
  local match = (restored == original)

  table.insert(lines, "=== Compression ===")
  table.insert(lines, string.format("Original: %d bytes", originalSize))
  table.insert(lines, string.format("zlib:     %d bytes (%.1f%%)", #zlibData, (#zlibData / originalSize) * 100))
  table.insert(lines, string.format("gzip:     %d bytes (%.1f%%)", #gzipData, (#gzipData / originalSize) * 100))
  table.insert(lines, string.format("deflate:  %d bytes (%.1f%%)", #deflateData, (#deflateData / originalSize) * 100))
  table.insert(lines, string.format("Round-trip OK: %s", tostring(match)))
  table.insert(lines, "")

  -- Encoding
  local sample = "Hello, world!"
  local b64 = love.data.encode("string", "base64", sample)
  local hex = love.data.encode("string", "hex", sample)
  local b64Back = love.data.decode("string", "base64", b64)
  local hexBack = love.data.decode("string", "hex", hex)

  table.insert(lines, "=== Encoding ===")
  table.insert(lines, string.format('Original: "%s"', sample))
  table.insert(lines, string.format("Base64:   %s", b64))
  table.insert(lines, string.format("Hex:      %s", hex))
  table.insert(lines, string.format("Base64 decode OK: %s", tostring(b64Back == sample)))
  table.insert(lines, string.format("Hex decode OK:    %s", tostring(hexBack == sample)))
  table.insert(lines, "")

  -- Hashing
  local hashInput = "jove2d"
  table.insert(lines, "=== Hashing ===")
  table.insert(lines, string.format('Input: "%s"', hashInput))
  local function hexHash(algo, str)
    return love.data.encode("string", "hex", love.data.hash(algo, str))
  end
  table.insert(lines, string.format("MD5:    %s", hexHash("md5", hashInput)))
  table.insert(lines, string.format("SHA1:   %s", hexHash("sha1", hashInput)))
  table.insert(lines, string.format("SHA256: %s", hexHash("sha256", hashInput)))
  table.insert(lines, "")

  -- ByteData
  local bd = love.data.newByteData("jove2d data module")
  local bdClone = love.data.newByteData(bd:getString())
  table.insert(lines, "=== ByteData ===")
  table.insert(lines, string.format('String:  "%s"', bd:getString()))
  table.insert(lines, string.format("Size:    %d bytes", bd:getSize()))
  table.insert(lines, string.format('Clone:   "%s" (independent copy)', bdClone:getString()))
end

function love.draw()
  love.graphics.setColor(1, 1, 1)
  for i, line in ipairs(lines) do
    love.graphics.print(line, 10, 10 + (i - 1) * 18)
  end
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
