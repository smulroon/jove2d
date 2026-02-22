-- love2d equivalent of the drawing example
-- Demonstrates: all primitives, blend modes, scissor, and transform stack

local t = 0
local wireframe = false

function love.load()
  love.window.setTitle("Drawing Primitives")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(40/255, 44/255, 52/255)
end

function love.update(dt)
  t = t + dt
end

function love.draw()
  love.graphics.setWireframe(wireframe)

  -- --- Row 1: Basic shapes ---

  -- Red filled rectangle
  love.graphics.setColor(220/255, 50/255, 50/255)
  love.graphics.rectangle("fill", 20, 30, 120, 80)

  -- Green outlined rectangle
  love.graphics.setColor(50/255, 220/255, 50/255)
  love.graphics.rectangle("line", 160, 30, 120, 80)

  -- Blue filled circle (pulsing)
  local radius = 40 + math.sin(t * 2) * 8
  love.graphics.setColor(50/255, 100/255, 220/255)
  love.graphics.circle("fill", 360, 70, radius)

  -- Yellow outlined circle
  love.graphics.setColor(220/255, 220/255, 50/255)
  love.graphics.circle("line", 470, 70, 40)

  -- --- Row 2: New primitives ---

  -- Cyan filled ellipse
  love.graphics.setColor(50/255, 220/255, 220/255)
  love.graphics.ellipse("fill", 80, 190, 60, 35)

  -- Magenta outlined ellipse
  love.graphics.setColor(220/255, 50/255, 220/255)
  love.graphics.ellipse("line", 230, 190, 50, 30)

  -- Orange filled arc (pie slice)
  love.graphics.setColor(1, 160/255, 50/255)
  love.graphics.arc("fill", "pie", 370, 190, 45, 0, math.pi * 1.5)

  -- Pink outlined arc
  love.graphics.setColor(1, 128/255, 180/255)
  love.graphics.arc("line", "open", 480, 190, 45, -math.pi / 4, math.pi / 2)

  -- --- Row 3: Polygon, lines, points ---

  -- Green filled polygon (diamond)
  love.graphics.setColor(100/255, 220/255, 100/255)
  love.graphics.polygon("fill", 80, 280, 130, 310, 80, 360, 30, 310)

  -- White outlined polygon (pentagon)
  love.graphics.setColor(1, 1, 1)
  local cx, cy, pr = 230, 320, 40
  local pentVerts = {}
  for i = 0, 4 do
    local a = (i / 5) * math.pi * 2 - math.pi / 2
    table.insert(pentVerts, cx + math.cos(a) * pr)
    table.insert(pentVerts, cy + math.sin(a) * pr)
  end
  love.graphics.polygon("line", pentVerts)

  -- Line joins comparison (smooth lines, width=12, sharp zigzag)
  love.graphics.setLineWidth(12)
  love.graphics.setLineStyle("smooth")
  local joins = {"miter", "bevel", "none"}
  local colors = {{50,220,220}, {255,160,50}, {180,100,255}}
  for j = 1, 3 do
    love.graphics.setLineJoin(joins[j])
    love.graphics.setColor(colors[j][1]/255, colors[j][2]/255, colors[j][3]/255)
    local bx = 310 + (j-1) * 70
    love.graphics.line(bx, 290, bx + 40, 330, bx, 350, bx + 40, 370)
  end
  love.graphics.setLineWidth(1)
  love.graphics.setLineStyle("rough")
  love.graphics.setLineJoin("miter")

  -- --- Row 4: Transform stack demo ---

  love.graphics.push()
  love.graphics.translate(150, 450)
  love.graphics.rotate(t * 0.5)

  -- Spinning rectangle
  love.graphics.setColor(1, 100/255, 100/255)
  love.graphics.rectangle("fill", -30, -20, 60, 40)

  -- Spinning circle on the rectangle
  love.graphics.setColor(1, 1, 100/255)
  love.graphics.circle("fill", 0, 0, 8)
  love.graphics.pop()

  -- Scaled drawing
  love.graphics.push()
  love.graphics.translate(350, 450)
  local s = 0.7 + math.sin(t * 3) * 0.3
  love.graphics.scale(s, s)
  love.graphics.setColor(100/255, 200/255, 1)
  love.graphics.rectangle("fill", -25, -25, 50, 50)
  love.graphics.pop()

  -- Sheared drawing
  love.graphics.push()
  love.graphics.translate(500, 450)
  love.graphics.shear(math.sin(t) * 0.3, 0)
  love.graphics.setColor(200/255, 100/255, 1)
  love.graphics.rectangle("fill", -25, -25, 50, 50)
  love.graphics.pop()

  -- --- Row 5: Scissor + intersectScissor demo ---
  love.graphics.setScissor(560, 280, 200, 80)
  love.graphics.setColor(100/255, 1, 100/255)
  love.graphics.rectangle("fill", 540, 260, 240, 120)
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("clipped region", 570, 310)
  love.graphics.setScissor() -- Disable

  -- intersectScissor: two overlapping regions -> only the overlap is visible
  love.graphics.setScissor(560, 270, 80, 80)
  love.graphics.intersectScissor(600, 290, 80, 80)
  love.graphics.setColor(1, 200/255, 50/255)
  love.graphics.rectangle("fill", 540, 260, 200, 120)
  love.graphics.setScissor()

  -- --- Blend modes ---
  love.graphics.setColor(180/255, 180/255, 180/255)
  love.graphics.print("Blend: alpha(default) | add", 560, 380)

  -- Alpha blend (default)
  love.graphics.setBlendMode("alpha")
  love.graphics.setColor(1, 0, 0, 0.5)
  love.graphics.rectangle("fill", 560, 400, 50, 50)
  love.graphics.setColor(0, 0, 1, 0.5)
  love.graphics.rectangle("fill", 580, 420, 50, 50)

  -- Additive blend
  love.graphics.setBlendMode("add")
  love.graphics.setColor(1, 0, 0, 0.5)
  love.graphics.rectangle("fill", 650, 400, 50, 50)
  love.graphics.setColor(0, 0, 1, 0.5)
  love.graphics.rectangle("fill", 670, 420, 50, 50)

  -- --- HUD (use reset to cleanly restore all state) ---
  love.graphics.reset()
  love.graphics.setBackgroundColor(40/255, 44/255, 52/255)
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("love2d drawing primitives", 10, 10)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 10)
  love.graphics.print(string.format("time: %.1fs", t), 10, 580)
  love.graphics.print("wireframe: " .. (wireframe and "ON" or "OFF") .. " (W to toggle)", 10, 560)

  -- Labels
  love.graphics.setColor(160/255, 160/255, 160/255)
  love.graphics.print("rect  rect   circle circle", 20, 120)
  love.graphics.print("ellipse ellipse  arc    arc", 20, 230)
  love.graphics.print("polygon pentagon joins:miter/bevel/none", 20, 370)
  love.graphics.print("rotate     scale     shear", 100, 490)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
  if key == "w" then
    wireframe = not wireframe
  end
end
