import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import * as timer from "../src/jove/timer.ts";

describe("jove.timer", () => {
  beforeAll(() => {
    timer._init();
  });

  test("getDelta returns a number", () => {
    expect(typeof timer.getDelta()).toBe("number");
  });

  test("getFPS returns a number >= 0", () => {
    expect(timer.getFPS()).toBeGreaterThanOrEqual(0);
  });

  test("getTime returns time since init", () => {
    const t = timer.getTime();
    expect(t).toBeGreaterThanOrEqual(0);
  });

  test("step returns delta time", () => {
    const dt = timer.step();
    expect(typeof dt).toBe("number");
    expect(dt).toBeGreaterThanOrEqual(0);
  });

  test("getAverageDelta returns a number >= 0", () => {
    timer.step();
    timer.step();
    const avg = timer.getAverageDelta();
    expect(avg).toBeGreaterThanOrEqual(0);
  });

  test("sleep resolves without error", async () => {
    await timer.sleep(0.001); // 1ms
  });

  test("successive steps produce increasing time", () => {
    const t1 = timer.getTime();
    timer.step();
    const t2 = timer.getTime();
    expect(t2).toBeGreaterThanOrEqual(t1);
  });
});
