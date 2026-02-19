// Bitmap font example — demonstrates newImageFont for pixel-art text
import jove from "../../src/index.ts";
import type { Font, Text } from "../../src/index.ts";

const GLYPHS = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:-'/()" ;

let bitmapFont: Font | null = null;
let bitmapFontLarge: Font | null = null;
let cachedText: Text | null = null;
let time = 0;

await jove.run({
  load() {
    jove.window.setTitle("jove2d — Bitmap Font Example");

    // Load the bitmap font from PNG
    bitmapFont = jove.graphics.newImageFont("assets/pixelfont.png", GLYPHS);
    // Load again for a second instance (could use same image with different spacing)
    bitmapFontLarge = jove.graphics.newImageFont("assets/pixelfont.png", GLYPHS, 1);

    // Create a cached Text object from the bitmap font
    if (bitmapFont) {
      jove.graphics.setFont(bitmapFont);
      cachedText = jove.graphics.newText(bitmapFont, "Cached Text Object!");
    }
  },

  update(dt: number) {
    time += dt;
  },

  draw() {
    const g = jove.graphics;

    // Section 1: Basic bitmap font rendering
    g.setColor(255, 255, 100, 255);
    if (bitmapFont) {
      g.setFont(bitmapFont);
      g.print("Bitmap Font Demo", 20, 20);

      g.setColor(255, 255, 255, 255);
      g.print("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 20, 40);
      g.print("abcdefghijklmnopqrstuvwxyz", 20, 55);
      g.print("0123456789 .,!?:-'/()", 20, 70);
    }

    // Section 2: Color tinting
    g.setColor(255, 100, 100, 255);
    g.print("Red tinted text", 20, 100);

    g.setColor(100, 255, 100, 255);
    g.print("Green tinted text", 20, 115);

    g.setColor(100, 100, 255, 255);
    g.print("Blue tinted text", 20, 130);

    g.setColor(255, 255, 255, 128);
    g.print("Semi-transparent text", 20, 145);

    // Section 3: printf with alignment
    g.setColor(255, 255, 255, 255);
    g.print("printf alignment (200px box):", 20, 175);

    // Draw alignment guide box
    g.setColor(80, 80, 80, 255);
    g.rectangle("line", 20, 190, 200, 55);

    g.setColor(255, 255, 255, 255);
    g.printf("Left aligned", 20, 195, 200, "left");
    g.printf("Center aligned", 20, 210, 200, "center");
    g.printf("Right aligned", 20, 225, 200, "right");

    // Section 4: Extra spacing comparison
    g.setColor(255, 200, 100, 255);
    g.print("Spacing comparison:", 20, 265);

    if (bitmapFont) {
      g.setFont(bitmapFont);
      g.setColor(255, 255, 255, 255);
      g.print("Normal spacing (0px)", 20, 280);
    }

    if (bitmapFontLarge) {
      g.setFont(bitmapFontLarge);
      g.setColor(200, 200, 255, 255);
      g.print("Extra spacing (1px)", 20, 295);
    }

    // Section 5: Word wrap
    if (bitmapFont) {
      g.setFont(bitmapFont);
      g.setColor(255, 200, 100, 255);
      g.print("Word wrap (150px box):", 20, 325);

      g.setColor(80, 80, 80, 255);
      g.rectangle("line", 20, 340, 150, 50);

      g.setColor(255, 255, 255, 255);
      g.printf("The quick brown fox jumps over the lazy dog.", 20, 345, 150, "left");
    }

    // Section 6: Font metrics
    if (bitmapFont) {
      g.setFont(bitmapFont);
      g.setColor(255, 200, 100, 255);
      g.print("Font metrics:", 400, 20);

      g.setColor(200, 200, 200, 255);
      g.print("Height: " + bitmapFont.getHeight(), 400, 40);
      g.print("Ascent: " + bitmapFont.getAscent(), 400, 55);
      g.print("Descent: " + bitmapFont.getDescent(), 400, 70);
      g.print("Baseline: " + bitmapFont.getBaseline(), 400, 85);
      g.print("Line height: " + bitmapFont.getLineHeight(), 400, 100);
      g.print("'Hello' width: " + bitmapFont.getWidth("Hello"), 400, 115);
    }

    // Section 7: newText cached text with transforms
    if (cachedText) {
      g.setColor(255, 200, 100, 255);
      if (bitmapFont) g.setFont(bitmapFont);
      g.print("newText with transforms:", 400, 145);

      // Static cached text
      g.setColor(255, 255, 255, 255);
      g.draw(cachedText, 400, 170);

      // Rotating cached text
      g.setColor(100, 255, 200, 255);
      g.draw(cachedText, 500, 260, time, 1, 1, cachedText.getWidth() / 2, cachedText.getHeight() / 2);

      // Scaled cached text
      g.setColor(255, 200, 255, 255);
      g.draw(cachedText, 400, 310, 0, 2, 2);
    }

    // Section 8: Multiline with newlines
    if (bitmapFont) {
      g.setFont(bitmapFont);
      g.setColor(255, 200, 100, 255);
      g.print("Multiline (newlines):", 400, 350);
      g.setColor(255, 255, 255, 255);
      g.print("Line 1\nLine 2\nLine 3", 400, 370);
    }

    // Section 9: Dynamic text
    if (bitmapFont) {
      g.setFont(bitmapFont);
      g.setColor(255, 200, 100, 255);
      g.print("Dynamic:", 400, 430);

      const fps = jove.timer.getFPS();
      const t = Math.floor(time);
      g.setColor(255, 255, 255, 255);
      g.print("FPS: " + fps, 400, 450);
      g.print("Time: " + t + "s", 400, 465);
    }

    // Footer
    if (bitmapFont) {
      g.setFont(bitmapFont);
      g.setColor(128, 128, 128, 255);
      g.print("Press Escape to quit", 20, 580);
    }
  },

  keypressed(key: string) {
    if (key === "escape") {
      jove.window.close();
    }
  },
});
