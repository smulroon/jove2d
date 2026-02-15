-- love2d equivalent of the shader example
-- Demonstrates: newShader, setShader/getShader, Shader:send, sendColor

local scene = nil
local colorShader = nil
local waveShader = nil
local vignetteShader = nil
local t = 0
local activeEffect = 1
local effectNames = {"Color Cycle", "Wave Distort", "Vignette", "No Shader"}

function love.load()
  love.window.setTitle("Shader Example")
  love.window.setMode(800, 600)
  love.graphics.setBackgroundColor(20/255, 20/255, 30/255)

  -- Create a scene to apply shaders to
  scene = love.graphics.newCanvas(400, 300)

  -- Effect 1: Color cycling
  colorShader = love.graphics.newShader([[
    extern float time;
    vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
        vec4 pixel = Texel(tex, tc);
        pixel.r *= 0.5 + 0.5 * sin(time);
        pixel.g *= 0.5 + 0.5 * sin(time + 2.094);
        pixel.b *= 0.5 + 0.5 * sin(time + 4.189);
        return pixel * color;
    }
  ]])

  -- Effect 2: Wave distortion
  waveShader = love.graphics.newShader([[
    extern float time;
    extern float amplitude;
    extern float frequency;
    vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
        vec2 uv = tc;
        uv.x += sin(uv.y * frequency + time) * amplitude;
        uv.y += cos(uv.x * frequency + time * 0.7) * amplitude;
        return Texel(tex, uv) * color;
    }
  ]])
  waveShader:send("amplitude", 0.02)
  waveShader:send("frequency", 15.0)

  -- Effect 3: Vignette with tint
  vignetteShader = love.graphics.newShader([[
    extern float radius;
    extern float softness;
    extern vec4 tintColor;
    vec4 effect(vec4 color, Image tex, vec2 tc, vec2 sc) {
        vec4 pixel = Texel(tex, tc);
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(tc, center);
        float vignette = smoothstep(radius, radius - softness, dist);
        pixel.rgb *= vignette;
        pixel.rgb = mix(pixel.rgb, tintColor.rgb * pixel.rgb, tintColor.a);
        return pixel * color;
    }
  ]])
  vignetteShader:send("radius", 0.75)
  vignetteShader:send("softness", 0.45)
  vignetteShader:send("tintColor", {1.0, 0.9, 0.7, 0.3})
end

function love.update(dt)
  t = t + dt

  -- Update shader uniforms
  colorShader:send("time", t * 2)
  waveShader:send("time", t * 3)

  -- Render scene to canvas
  if scene then
    love.graphics.setCanvas(scene)
    love.graphics.clear(40/255, 40/255, 60/255)

    love.graphics.setColor(1, 100/255, 50/255)
    love.graphics.rectangle("fill", 20, 20, 120, 80)

    love.graphics.setColor(50/255, 200/255, 1)
    love.graphics.circle("fill", 280, 80, 60)

    love.graphics.setColor(100/255, 1, 100/255)
    love.graphics.ellipse("fill", 200, 200, 80, 40)

    love.graphics.setColor(1, 1, 100/255)
    love.graphics.polygon("fill", 50, 200, 100, 260, 20, 280)

    love.graphics.setColor(1, 1, 1)
    love.graphics.print("Shader Demo", 140, 140)
    love.graphics.print("Press 1-4 to switch effects", 100, 160)

    love.graphics.setCanvas()
  end
end

function love.draw()
  if not scene then return end

  local shaders = {colorShader, waveShader, vignetteShader, nil}
  local shader = shaders[activeEffect]

  -- Draw the scene with the active shader
  love.graphics.setColor(1, 1, 1)
  if shader then
    love.graphics.setShader(shader)
  end
  love.graphics.draw(scene, 200, 120)
  if shader then
    love.graphics.setShader()
  end

  -- Draw without shader as reference (small, bottom-left)
  love.graphics.draw(scene, 10, 440, 0, 0.35, 0.35)

  -- HUD
  love.graphics.setColor(1, 1, 1)
  love.graphics.print("Active effect: " .. effectNames[activeEffect], 10, 10)
  love.graphics.print("FPS: " .. love.timer.getFPS(), 700, 10)
  love.graphics.print("Press 1-4 to switch | ESC to quit", 10, 30)
  love.graphics.print(string.format("Time: %.1fs", t), 10, 50)

  -- Labels
  love.graphics.setColor(150/255, 150/255, 150/255)
  love.graphics.print("Original (no shader)", 10, 425)
  love.graphics.rectangle("line", 200, 120, 400, 300)
end

function love.keypressed(key)
  if key == "escape" then love.event.quit() end
  if key == "1" then activeEffect = 1 end
  if key == "2" then activeEffect = 2 end
  if key == "3" then activeEffect = 3 end
  if key == "4" then activeEffect = 4 end
end
