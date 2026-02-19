import { describe, test, expect, afterEach } from "bun:test";
import { run, window } from "../src/jove/index.ts";
import { setErrorHandler } from "../src/jove/index.ts";
import { push } from "../src/jove/event.ts";

describe("jove.run game loop", () => {
  afterEach(() => {
    setErrorHandler(null);
  });

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

  test("error in load() triggers error handler", async () => {
    let caughtError: unknown = null;
    setErrorHandler((err) => { caughtError = err; });

    await run({
      load() {
        throw new Error("Test load error");
      },
    });

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("Test load error");
  });

  test("error in update() triggers error handler", async () => {
    let caughtError: unknown = null;
    let updateCount = 0;
    setErrorHandler((err) => { caughtError = err; });

    await run({
      update(dt) {
        updateCount++;
        if (updateCount === 3) {
          throw new Error("Test update error");
        }
      },
      draw() {},
    });

    expect(updateCount).toBe(3);
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("Test update error");
  });

  test("error in draw() triggers error handler", async () => {
    let caughtError: unknown = null;
    let drawCount = 0;
    setErrorHandler((err) => { caughtError = err; });

    await run({
      update(dt) {},
      draw() {
        drawCount++;
        if (drawCount === 2) {
          throw new Error("Test draw error");
        }
      },
    });

    expect(drawCount).toBe(2);
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("Test draw error");
  });

  test("error in event callback triggers error handler", async () => {
    let caughtError: unknown = null;
    let threw = false;
    setErrorHandler((err) => { caughtError = err; });

    await run({
      keypressed(key: string) {
        threw = true;
        throw new Error("Test keypressed error");
      },
      update(dt) {
        if (!threw) {
          push({ type: "keypressed", key: "a", scancode: "a", isRepeat: false });
        }
      },
      draw() {},
    });

    expect(threw).toBe(true);
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("Test keypressed error");
  });

  test("non-Error thrown is handled gracefully", async () => {
    let caughtError: unknown = null;
    setErrorHandler((err) => { caughtError = err; });

    await run({
      load() {
        throw "string error";
      },
    });

    expect(caughtError).toBe("string error");
  });
});
