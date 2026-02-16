// jove2d font example — default font, custom sizes, printf alignment, metrics

import jove from "../../src/index.ts";
import type { Font, Text } from "../../src/index.ts";

let smallFont: Font;
let defaultFont: Font;
let largeFont: Font;
let hugeFont: Font;
let cachedText: Text;
let rotatingText: Text;

await jove.run({
  load() {
    jove.window.setTitle("Font Example — jove2d");

    smallFont = jove.graphics.newFont(10)!;
    defaultFont = jove.graphics.getFont()!;
    largeFont = jove.graphics.newFont(24)!;
    hugeFont = jove.graphics.newFont(48)!;

    // Create cached Text objects (newText)
    cachedText = jove.graphics.newText(largeFont, "Cached Text (newText)")!;

    // Multi-segment colored text
    rotatingText = jove.graphics.newText(defaultFont)!;
    jove.graphics.setColor(255, 100, 100);
    rotatingText.set("Red ");
    jove.graphics.setColor(100, 255, 100);
    rotatingText.add("Green ", rotatingText.getWidth(), 0);
    jove.graphics.setColor(100, 100, 255);
    rotatingText.add("Blue", rotatingText.getWidth(), 0);
    jove.graphics.setColor(255, 255, 255);
  },

  draw() {
    let y = 10;

    // Default font (12pt Vera Sans)
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.setFont(defaultFont);
    jove.graphics.print("Default font (Vera Sans 12pt)", 10, y);
    y += 30;

    // Small font
    jove.graphics.setColor(200, 200, 200);
    jove.graphics.setFont(smallFont);
    jove.graphics.print("Small font (10pt)", 10, y);
    y += 25;

    // Large font
    jove.graphics.setColor(100, 200, 255);
    jove.graphics.setFont(largeFont);
    jove.graphics.print("Large font (24pt)", 10, y);
    y += 40;

    // Huge font
    jove.graphics.setColor(255, 200, 100);
    jove.graphics.setFont(hugeFont);
    jove.graphics.print("Huge (48pt)", 10, y);
    y += 70;

    // Font metrics display
    jove.graphics.setFont(defaultFont);
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("--- Font Metrics (default 12pt) ---", 10, y);
    y += 20;
    jove.graphics.print(`Height: ${defaultFont.getHeight()}`, 10, y);
    y += 16;
    jove.graphics.print(`Ascent: ${defaultFont.getAscent()}`, 10, y);
    y += 16;
    jove.graphics.print(`Descent: ${defaultFont.getDescent()}`, 10, y);
    y += 16;
    jove.graphics.print(`Width of "Hello": ${defaultFont.getWidth("Hello")}`, 10, y);
    y += 16;
    jove.graphics.print(`Line height: ${defaultFont.getLineHeight()}`, 10, y);
    y += 30;

    // printf alignment demo
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print("--- printf alignment (wraplimit=300) ---", 10, y);
    y += 20;

    const demoText = "The quick brown fox jumps over the lazy dog.";
    const limit = 300;
    const boxX = 10;

    // Draw alignment guide box
    jove.graphics.setColor(60, 60, 60);
    jove.graphics.rectangle("fill", boxX, y, limit, 120);

    // Left aligned
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.printf(demoText, boxX, y, limit, "left");
    y += 40;

    // Center aligned
    jove.graphics.setColor(100, 255, 100);
    jove.graphics.printf(demoText, boxX, y, limit, "center");
    y += 40;

    // Right aligned
    jove.graphics.setColor(255, 100, 100);
    jove.graphics.printf(demoText, boxX, y, limit, "right");
    y += 50;

    // getWrap demo
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.setFont(defaultFont);
    const [maxW, lines] = defaultFont.getWrap("This text gets wrapped at 200px width limit.", 200);
    jove.graphics.print(`getWrap(200): maxW=${maxW}, lines=${lines.length}`, 10, y);
    y += 16;
    for (const line of lines) {
      jove.graphics.print(`  "${line}"`, 10, y);
      y += 16;
    }
    y += 20;

    // newText demo — cached text objects
    jove.graphics.setColor(255, 255, 100);
    jove.graphics.print("--- newText (cached text objects) ---", 10, y);
    y += 20;

    // Draw cached text (simple)
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.draw(cachedText, 10, y);
    y += 35;

    // Draw cached text with rotation and scale
    jove.graphics.setColor(200, 200, 255);
    const t = jove.timer.getTime();
    jove.graphics.draw(cachedText, 200, y + 20, Math.sin(t) * 0.3, 0.8, 0.8,
      cachedText.getWidth() / 2, cachedText.getHeight() / 2);
    y += 50;

    // Draw multi-colored text
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.draw(rotatingText, 10, y);
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
