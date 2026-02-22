// jove2d drawing example — all primitives, blend modes, scissor, and transform stack

import jove from "../../src/index.ts";

let t = 0;
let wireframe = false;

await jove.run({
  load() {
    jove.window.setTitle("Drawing Primitives");
    jove.graphics.setBackgroundColor(40, 44, 52);
  },

  update(dt) {
    t += dt;
  },

  draw() {
    jove.graphics.setWireframe(wireframe);

    // --- Row 1: Basic shapes ---

    // Red filled rectangle
    jove.graphics.setColor(220, 50, 50);
    jove.graphics.rectangle("fill", 20, 30, 120, 80);

    // Green outlined rectangle
    jove.graphics.setColor(50, 220, 50);
    jove.graphics.rectangle("line", 160, 30, 120, 80);

    // Blue filled circle (pulsing)
    const radius = 40 + Math.sin(t * 2) * 8;
    jove.graphics.setColor(50, 100, 220);
    jove.graphics.circle("fill", 360, 70, radius);

    // Yellow outlined circle
    jove.graphics.setColor(220, 220, 50);
    jove.graphics.circle("line", 470, 70, 40);

    // --- Row 2: New primitives ---

    // Cyan filled ellipse
    jove.graphics.setColor(50, 220, 220);
    jove.graphics.ellipse("fill", 80, 190, 60, 35);

    // Magenta outlined ellipse
    jove.graphics.setColor(220, 50, 220);
    jove.graphics.ellipse("line", 230, 190, 50, 30);

    // Orange filled arc (pie slice)
    jove.graphics.setColor(255, 160, 50);
    jove.graphics.arc("fill", 370, 190, 45, 0, Math.PI * 1.5);

    // Pink outlined arc
    jove.graphics.setColor(255, 128, 180);
    jove.graphics.arc("line", 480, 190, 45, -Math.PI / 4, Math.PI / 2);

    // --- Row 3: Polygon, lines, points ---

    // Green filled polygon (diamond)
    jove.graphics.setColor(100, 220, 100);
    jove.graphics.polygon("fill", 80, 280, 130, 310, 80, 360, 30, 310);

    // White outlined polygon (pentagon)
    jove.graphics.setColor(255, 255, 255);
    const cx = 230, cy = 320, pr = 40;
    const pentVerts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      pentVerts.push(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr);
    }
    jove.graphics.polygon("line", ...pentVerts);

    // Line joins comparison (smooth lines, width=12, sharp zigzag)
    jove.graphics.setLineWidth(12);
    jove.graphics.setLineStyle("smooth");
    const joins = ["miter", "bevel", "none"] as const;
    for (let j = 0; j < 3; j++) {
      jove.graphics.setLineJoin(joins[j]);
      jove.graphics.setColor(j === 0 ? 50 : j === 1 ? 255 : 180,
                             j === 0 ? 220 : j === 1 ? 160 : 100,
                             j === 0 ? 220 : j === 1 ? 50 : 255);
      const bx = 310 + j * 70;
      jove.graphics.line(bx, 290, bx + 40, 330, bx, 350, bx + 40, 370);
    }
    jove.graphics.setLineWidth(1);
    jove.graphics.setLineStyle("rough");
    jove.graphics.setLineJoin("miter");

    // --- Row 4: Transform stack demo ---

    jove.graphics.push();
    jove.graphics.translate(150, 450);
    jove.graphics.rotate(t * 0.5);

    // Spinning rectangle
    jove.graphics.setColor(255, 100, 100);
    jove.graphics.rectangle("fill", -30, -20, 60, 40);

    // Spinning circle on the rectangle
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.circle("fill", 0, 0, 8);
    jove.graphics.pop();

    // Scaled drawing
    jove.graphics.push();
    jove.graphics.translate(350, 450);
    const s = 0.7 + Math.sin(t * 3) * 0.3;
    jove.graphics.scale(s, s);
    jove.graphics.setColor(100, 200, 255);
    jove.graphics.rectangle("fill", -25, -25, 50, 50);
    jove.graphics.pop();

    // Sheared drawing
    jove.graphics.push();
    jove.graphics.translate(500, 450);
    jove.graphics.shear(Math.sin(t) * 0.3, 0);
    jove.graphics.setColor(200, 100, 255);
    jove.graphics.rectangle("fill", -25, -25, 50, 50);
    jove.graphics.pop();

    // --- Row 5: Scissor + intersectScissor demo ---
    jove.graphics.setScissor(560, 280, 200, 80);
    jove.graphics.setColor(100, 255, 100);
    jove.graphics.rectangle("fill", 540, 260, 240, 120); // Clipped to scissor
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("clipped region", 570, 310);
    jove.graphics.setScissor(); // Disable

    // intersectScissor: two overlapping regions → only the overlap is visible
    jove.graphics.setScissor(560, 270, 80, 80);
    jove.graphics.intersectScissor(600, 290, 80, 80);
    jove.graphics.setColor(255, 200, 50);
    jove.graphics.rectangle("fill", 540, 260, 200, 120);
    jove.graphics.setScissor();

    // --- Blend modes ---
    jove.graphics.setColor(180, 180, 180);
    jove.graphics.print("Blend: alpha(default) | add", 560, 380);

    // Alpha blend (default)
    jove.graphics.setBlendMode("alpha");
    jove.graphics.setColor(255, 0, 0, 128);
    jove.graphics.rectangle("fill", 560, 400, 50, 50);
    jove.graphics.setColor(0, 0, 255, 128);
    jove.graphics.rectangle("fill", 580, 420, 50, 50);

    // Additive blend
    jove.graphics.setBlendMode("add");
    jove.graphics.setColor(255, 0, 0, 128);
    jove.graphics.rectangle("fill", 650, 400, 50, 50);
    jove.graphics.setColor(0, 0, 255, 128);
    jove.graphics.rectangle("fill", 670, 420, 50, 50);

    // --- HUD (use reset to cleanly restore all state) ---
    jove.graphics.reset();
    jove.graphics.setBackgroundColor(40, 44, 52);
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("jove2d drawing primitives", 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 10);
    jove.graphics.print(`time: ${t.toFixed(1)}s`, 10, 580);
    jove.graphics.print(`wireframe: ${wireframe ? "ON" : "OFF"} (W to toggle)`, 10, 560);

    // Labels
    jove.graphics.setColor(160, 160, 160);
    jove.graphics.print("rect  rect   circle circle", 20, 120);
    jove.graphics.print("ellipse ellipse  arc    arc", 20, 230);
    jove.graphics.print("polygon pentagon joins:miter/bevel/none", 20, 370);
    jove.graphics.print("rotate     scale     shear", 100, 490);
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
    if (key === "w") wireframe = !wireframe;
  },
});
