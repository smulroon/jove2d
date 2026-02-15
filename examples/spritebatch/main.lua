-- love2d equivalent of the SpriteBatch tilemap example
-- Demonstrates: newSpriteBatch for efficient tile-based rendering

local tileset = nil
local batch = nil
local quads = {}
local t = 0

local TILE_SIZE = 32
local GRID_W = 20
local GRID_H = 15

function love.load()
  love.window.setTitle("SpriteBatch Example — Tilemap")
  love.graphics.setBackgroundColor(30/255, 30/255, 40/255)

  -- Create a 128x128 canvas tileset with 4 colored tiles (2x2 grid)
  tileset = love.graphics.newCanvas(128, 128)

  love.graphics.setCanvas(tileset)
  love.graphics.clear(0, 0, 0, 0)

  -- Tile 0: Red
  love.graphics.setColor(200/255, 60/255, 60/255)
  love.graphics.rectangle("fill", 0, 0, 32, 32)
  love.graphics.setColor(160/255, 40/255, 40/255)
  love.graphics.rectangle("line", 1, 1, 30, 30)

  -- Tile 1: Green
  love.graphics.setColor(60/255, 200/255, 60/255)
  love.graphics.rectangle("fill", 32, 0, 32, 32)
  love.graphics.setColor(40/255, 160/255, 40/255)
  love.graphics.rectangle("line", 33, 1, 30, 30)

  -- Tile 2: Blue
  love.graphics.setColor(60/255, 60/255, 200/255)
  love.graphics.rectangle("fill", 0, 32, 32, 32)
  love.graphics.setColor(40/255, 40/255, 160/255)
  love.graphics.rectangle("line", 1, 33, 30, 30)

  -- Tile 3: Yellow
  love.graphics.setColor(200/255, 200/255, 60/255)
  love.graphics.rectangle("fill", 32, 32, 32, 32)
  love.graphics.setColor(160/255, 160/255, 40/255)
  love.graphics.rectangle("line", 33, 33, 30, 30)

  love.graphics.setCanvas()

  -- Create quads for each tile
  quads[1] = love.graphics.newQuad(0, 0, 32, 32, 128, 128)
  quads[2] = love.graphics.newQuad(32, 0, 32, 32, 128, 128)
  quads[3] = love.graphics.newQuad(0, 32, 32, 32, 128, 128)
  quads[4] = love.graphics.newQuad(32, 32, 32, 32, 128, 128)

  -- Create SpriteBatch for the tilemap
  batch = love.graphics.newSpriteBatch(tileset, GRID_W * GRID_H)

  -- Fill the grid with a checkerboard-like pattern
  for y = 0, GRID_H - 1 do
    for x = 0, GRID_W - 1 do
      local tileIdx = ((x + y) % 4) + 1
      batch:add(quads[tileIdx], x * TILE_SIZE, y * TILE_SIZE + 60)
    end
  end
end

function love.update(dt)
  t = t + dt
end

function love.draw()
  if not batch or not tileset then return end

  -- Draw the tilemap with a single draw call
  love.graphics.setColor(1, 1, 1)
  love.graphics.draw(batch)

  -- Draw info text
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("SpriteBatch Tilemap Demo", 10, 5)
  love.graphics.print("Tiles: " .. batch:getCount() .. " | Buffer: " .. batch:getBufferSize() .. " | FPS: " .. love.timer.getFPS(), 10, 20)
  love.graphics.print("All " .. batch:getCount() .. " tiles rendered in 1 draw call", 10, 35)

  -- Draw the tileset preview in bottom-right
  love.graphics.setColor(1, 1, 1)
  love.graphics.draw(tileset, 640, 450, 0, 1, 1)
  love.graphics.setColor(150/255, 150/255, 150/255)
  love.graphics.rectangle("line", 640, 450, 128, 128)
  love.graphics.print("Tileset", 640, 440)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
