import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import sdl from "../src/sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../src/sdl/types.ts";
import * as event from "../src/jove/event.ts";

describe("jove.event — push/clear/quit", () => {
  beforeAll(() => {
    sdl.SDL_Init(SDL_INIT_VIDEO);
  });

  afterAll(() => {
    sdl.SDL_Quit();
  });

  test("push injects a custom event", () => {
    event.push({ type: "quit" });
    const events = event.pollEvents();
    expect(events.some(e => e.type === "quit")).toBe(true);
  });

  test("push multiple events preserves order", () => {
    event.push({ type: "focus", hasFocus: true });
    event.push({ type: "focus", hasFocus: false });
    const events = event.pollEvents();
    const focusEvents = events.filter(e => e.type === "focus");
    expect(focusEvents.length).toBeGreaterThanOrEqual(2);
    expect((focusEvents[0] as any).hasFocus).toBe(true);
    expect((focusEvents[1] as any).hasFocus).toBe(false);
  });

  test("clear removes all pending events", () => {
    event.push({ type: "quit" });
    event.push({ type: "quit" });
    event.clear();
    const events = event.pollEvents();
    // Should have no injected quit events (SDL events might still be present)
    const quitEvents = events.filter(e => e.type === "quit");
    expect(quitEvents.length).toBe(0);
  });

  test("quit() injects a quit event", () => {
    event.quit();
    const events = event.pollEvents();
    expect(events.some(e => e.type === "quit")).toBe(true);
  });

  test("push textinput event", () => {
    event.push({ type: "textinput", text: "hello" });
    const events = event.pollEvents();
    const textEvents = events.filter(e => e.type === "textinput");
    expect(textEvents.length).toBe(1);
    expect((textEvents[0] as any).text).toBe("hello");
  });

  test("push filedropped event", () => {
    event.push({ type: "filedropped", path: "/tmp/test.txt" });
    const events = event.pollEvents();
    const dropEvents = events.filter(e => e.type === "filedropped");
    expect(dropEvents.length).toBe(1);
    expect((dropEvents[0] as any).path).toBe("/tmp/test.txt");
  });

});
