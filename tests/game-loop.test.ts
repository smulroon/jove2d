import { describe, test, expect } from "bun:test";
import { run, window } from "../src/jove/index.ts";

describe("jove.run game loop", () => {
  test("load callback fires and loop runs frames", async () => {
    let loadCalled = false;
    let updateCount = 0;
    let drawCount = 0;

    await run({
      load() {
        loadCalled = true;
        window.setTitle("Game Loop Test");
      },
      update(dt) {
        updateCount++;
        // Close the window after 5 frames to exit the loop
        if (updateCount >= 5) {
          window.close();
        }
      },
      draw() {
        drawCount++;
      },
    });

    expect(loadCalled).toBe(true);
    expect(updateCount).toBeGreaterThanOrEqual(5);
    expect(drawCount).toBeGreaterThanOrEqual(4);
  });
});
