import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import sdl from "../src/sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../src/sdl/types.ts";
import * as window from "../src/jove/window.ts";
import * as graphics from "../src/jove/graphics.ts";

describe("jove.graphics — Stencil", () => {
  beforeAll(() => {
    sdl.SDL_Init(SDL_INIT_VIDEO);
    window.setMode(640, 480);
    graphics._createRenderer();
  });

  afterAll(() => {
    graphics._destroyRenderer();
    window.close();
    sdl.SDL_Quit();
  });

  // --- getStencilTest defaults ---

  test("getStencilTest returns ['always', 0] when disabled", () => {
    const [mode, value] = graphics.getStencilTest();
    expect(mode).toBe("always");
    expect(value).toBe(0);
  });

  // --- stencil() basic ---

  test("stencil() executes the drawing function", () => {
    let called = false;
    graphics._beginFrame();
    graphics.stencil(() => {
      called = true;
      graphics.rectangle("fill", 10, 10, 50, 50);
    });
    graphics._endFrame();
    expect(called).toBe(true);
  });

  test("stencil() with default parameters does not crash", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.circle("fill", 100, 100, 50);
    });
    graphics._endFrame();
  });

  test("stencil() with explicit action and value does not crash", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.rectangle("fill", 0, 0, 100, 100);
    }, "replace", 1, false);
    graphics._endFrame();
  });

  test("stencil() with keepvalues=true does not crash", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.circle("fill", 100, 100, 50);
    }, "replace", 1, false);
    graphics.stencil(() => {
      graphics.circle("fill", 200, 200, 50);
    }, "replace", 1, true);
    graphics._endFrame();
  });

  // --- setStencilTest / getStencilTest ---

  test("setStencilTest enables stencil testing", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.rectangle("fill", 0, 0, 100, 100);
    });
    graphics.setStencilTest("greater", 0);
    const [mode, value] = graphics.getStencilTest();
    expect(mode).toBe("greater");
    expect(value).toBe(0);
    graphics.setStencilTest(); // disable
    graphics._endFrame();
  });

  test("setStencilTest() disables stencil testing", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.rectangle("fill", 0, 0, 100, 100);
    });
    graphics.setStencilTest("greater", 0);
    graphics.setStencilTest(); // disable
    const [mode, value] = graphics.getStencilTest();
    expect(mode).toBe("always");
    expect(value).toBe(0);
    graphics._endFrame();
  });

  // --- Full stencil workflow ---

  test("full stencil workflow: stencil + test + draw + disable", () => {
    graphics._beginFrame();

    // Draw stencil mask
    graphics.stencil(() => {
      graphics.circle("fill", 320, 240, 100);
    }, "replace", 1);

    // Enable stencil test
    graphics.setStencilTest("greater", 0);

    // Draw content (should be clipped to circle)
    graphics.setColor(255, 0, 0);
    graphics.rectangle("fill", 0, 0, 640, 480);

    // Disable stencil test
    graphics.setStencilTest();

    graphics.setColor(255, 255, 255);
    graphics._endFrame();
  });

  test("inverted stencil: equal to 0", () => {
    graphics._beginFrame();

    graphics.stencil(() => {
      graphics.circle("fill", 320, 240, 100);
    });

    // Draw everywhere EXCEPT the circle
    graphics.setStencilTest("equal", 0);
    graphics.setColor(0, 255, 0);
    graphics.rectangle("fill", 0, 0, 640, 480);
    graphics.setStencilTest();

    graphics.setColor(255, 255, 255);
    graphics._endFrame();
  });

  // --- Compare modes ---

  test("compare mode 'always' does not mask", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.rectangle("fill", 0, 0, 10, 10);
    });
    graphics.setStencilTest("always", 0);
    // All content should be visible
    graphics.rectangle("fill", 0, 0, 640, 480);
    graphics.setStencilTest();
    graphics._endFrame();
  });

  test("compare mode 'never' masks everything", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.rectangle("fill", 0, 0, 640, 480);
    });
    graphics.setStencilTest("never", 0);
    graphics.rectangle("fill", 0, 0, 640, 480);
    graphics.setStencilTest();
    graphics._endFrame();
  });

  // --- State preservation ---

  test("stencil() preserves draw color", () => {
    graphics.setColor(100, 150, 200, 250);
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.rectangle("fill", 0, 0, 10, 10);
    });
    const color = graphics.getColor();
    expect(color[0]).toBe(100);
    expect(color[1]).toBe(150);
    expect(color[2]).toBe(200);
    expect(color[3]).toBe(250);
    graphics._endFrame();
    graphics.setColor(255, 255, 255);
  });

  test("stencil() preserves blend mode", () => {
    graphics.setBlendMode("add");
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.rectangle("fill", 0, 0, 10, 10);
    });
    expect(graphics.getBlendMode()).toBe("add");
    graphics._endFrame();
    graphics.setBlendMode("alpha");
  });

  // --- Stencil actions ---

  test("increment action does not crash", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.rectangle("fill", 0, 0, 100, 100);
    }, "increment");
    graphics._endFrame();
  });

  test("decrement action does not crash", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.rectangle("fill", 0, 0, 100, 100);
    }, "decrement");
    graphics._endFrame();
  });

  test("invert action does not crash", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.rectangle("fill", 0, 0, 100, 100);
    }, "invert");
    graphics._endFrame();
  });

  // --- Multiple stencil operations ---

  test("multiple stencil/test cycles in one frame", () => {
    graphics._beginFrame();

    // First mask + draw
    graphics.stencil(() => {
      graphics.circle("fill", 200, 240, 80);
    });
    graphics.setStencilTest("greater", 0);
    graphics.setColor(255, 0, 0);
    graphics.rectangle("fill", 0, 0, 640, 480);
    graphics.setStencilTest();

    // Second mask + draw
    graphics.stencil(() => {
      graphics.circle("fill", 440, 240, 80);
    });
    graphics.setStencilTest("greater", 0);
    graphics.setColor(0, 0, 255);
    graphics.rectangle("fill", 0, 0, 640, 480);
    graphics.setStencilTest();

    graphics.setColor(255, 255, 255);
    graphics._endFrame();
  });

  // --- reset() clears stencil ---

  test("reset() disables active stencil test", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.rectangle("fill", 0, 0, 100, 100);
    });
    graphics.setStencilTest("greater", 0);
    graphics.reset();
    const [mode, value] = graphics.getStencilTest();
    expect(mode).toBe("always");
    expect(value).toBe(0);
    graphics._endFrame();
  });

  // --- Drawing with stencil and transforms ---

  test("stencil with push/pop transforms does not crash", () => {
    graphics._beginFrame();
    graphics.stencil(() => {
      graphics.push();
      graphics.translate(320, 240);
      graphics.circle("fill", 0, 0, 100);
      graphics.pop();
    });
    graphics.setStencilTest("greater", 0);
    graphics.push();
    graphics.translate(100, 100);
    graphics.rectangle("fill", 0, 0, 200, 200);
    graphics.pop();
    graphics.setStencilTest();
    graphics._endFrame();
  });
});
