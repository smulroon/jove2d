import { describe, test, expect, afterEach } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { init, quit, window, graphics, image } from "../src/jove/index.ts";
import { _createRenderer } from "../src/jove/graphics.ts";
import { loadImage } from "../src/sdl/ffi_image.ts";

const sdlImageAvailable = loadImage() !== null;

function setupWindowAndRenderer() {
  init();
  window.setMode(320, 240);
  _createRenderer();
}

describe("jove.image.newImageData", () => {
  afterEach(() => { quit(); });

  test("creates blank ImageData with given dimensions", () => {
    init();
    const d = image.newImageData(16, 8);
    expect(d).not.toBeNull();
    expect(d!.width).toBe(16);
    expect(d!.height).toBe(8);
    expect(d!.getWidth()).toBe(16);
    expect(d!.getHeight()).toBe(8);
    expect(d!.getDimensions()).toEqual([16, 8]);
    expect(d!.format).toBe("rgba8888");
    expect(d!.getFormat()).toBe("rgba8");
    expect(d!.data.length).toBe(16 * 8 * 4);
  });

  test("blank ImageData is all zeros (transparent)", () => {
    init();
    const d = image.newImageData(4, 4)!;
    for (let i = 0; i < d.data.length; i++) {
      expect(d.data[i]).toBe(0);
    }
  });

  test("returns null for invalid dimensions", () => {
    init();
    expect(image.newImageData(0, 10)).toBeNull();
    expect(image.newImageData(10, 0)).toBeNull();
    expect(image.newImageData(-1, 10)).toBeNull();
  });
});

describe("jove.image.ImageData pixel access", () => {
  afterEach(() => { quit(); });

  test("getPixel returns zeros for blank image", () => {
    init();
    const d = image.newImageData(4, 4)!;
    expect(d.getPixel(0, 0)).toEqual([0, 0, 0, 0]);
    expect(d.getPixel(3, 3)).toEqual([0, 0, 0, 0]);
  });

  test("setPixel / getPixel round-trip", () => {
    init();
    const d = image.newImageData(4, 4)!;
    d.setPixel(1, 2, 255, 128, 64, 200);
    expect(d.getPixel(1, 2)).toEqual([255, 128, 64, 200]);
    // Other pixels unchanged
    expect(d.getPixel(0, 0)).toEqual([0, 0, 0, 0]);
  });

  test("setPixel modifies underlying data array", () => {
    init();
    const d = image.newImageData(2, 2)!;
    d.setPixel(1, 0, 10, 20, 30, 40);
    const i = (0 * 2 + 1) * 4;
    expect(d.data[i]).toBe(10);
    expect(d.data[i + 1]).toBe(20);
    expect(d.data[i + 2]).toBe(30);
    expect(d.data[i + 3]).toBe(40);
  });
});

describe("jove.image.ImageData.mapPixel", () => {
  afterEach(() => { quit(); });

  test("applies function to all pixels", () => {
    init();
    const d = image.newImageData(3, 3)!;
    // Fill with solid red
    d.mapPixel(() => [255, 0, 0, 255]);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(d.getPixel(x, y)).toEqual([255, 0, 0, 255]);
      }
    }
  });

  test("receives correct x, y, r, g, b, a", () => {
    init();
    const d = image.newImageData(2, 2)!;
    d.setPixel(0, 0, 10, 20, 30, 40);
    d.setPixel(1, 1, 50, 60, 70, 80);

    const calls: [number, number, number, number, number, number][] = [];
    d.mapPixel((x, y, r, g, b, a) => {
      calls.push([x, y, r, g, b, a]);
      return [r, g, b, a];
    });

    expect(calls.length).toBe(4);
    expect(calls[0]).toEqual([0, 0, 10, 20, 30, 40]);
    expect(calls[3]).toEqual([1, 1, 50, 60, 70, 80]);
  });

  test("gradient pattern via mapPixel", () => {
    init();
    const d = image.newImageData(10, 1)!;
    d.mapPixel((x) => [x * 25, 0, 0, 255]);
    expect(d.getPixel(0, 0)).toEqual([0, 0, 0, 255]);
    expect(d.getPixel(5, 0)).toEqual([125, 0, 0, 255]);
  });
});

describe("jove.image.ImageData.paste", () => {
  afterEach(() => { quit(); });

  test("copies pixels from source to destination", () => {
    init();
    const src = image.newImageData(4, 4)!;
    src.mapPixel(() => [255, 0, 0, 255]);
    const dst = image.newImageData(8, 8)!;
    dst.paste(src, 2, 2);

    // Pasted region
    expect(dst.getPixel(2, 2)).toEqual([255, 0, 0, 255]);
    expect(dst.getPixel(5, 5)).toEqual([255, 0, 0, 255]);
    // Outside
    expect(dst.getPixel(0, 0)).toEqual([0, 0, 0, 0]);
    expect(dst.getPixel(6, 6)).toEqual([0, 0, 0, 0]);
  });

  test("paste with source region", () => {
    init();
    const src = image.newImageData(4, 4)!;
    src.mapPixel((x, y) => [x * 60, y * 60, 0, 255]);
    const dst = image.newImageData(4, 4)!;
    dst.paste(src, 0, 0, 1, 1, 2, 2);

    // dst(0,0) should be src(1,1)
    expect(dst.getPixel(0, 0)).toEqual([60, 60, 0, 255]);
    expect(dst.getPixel(1, 1)).toEqual([120, 120, 0, 255]);
    // Outside pasted region
    expect(dst.getPixel(2, 2)).toEqual([0, 0, 0, 0]);
  });

  test("paste clips to destination bounds", () => {
    init();
    const src = image.newImageData(4, 4)!;
    src.mapPixel(() => [255, 0, 0, 255]);
    const dst = image.newImageData(2, 2)!;
    // Paste 4x4 at offset (0,0) into 2x2 — should clip
    dst.paste(src, 0, 0);
    expect(dst.getPixel(0, 0)).toEqual([255, 0, 0, 255]);
    expect(dst.getPixel(1, 1)).toEqual([255, 0, 0, 255]);
  });
});

describe("jove.image.ImageData.encode", () => {
  afterEach(() => {
    quit();
    const files = ["/tmp/jove2d-test-imagedata.png", "/tmp/jove2d-test-imagedata.bmp"];
    for (const f of files) { try { unlinkSync(f); } catch {} }
  });

  test("encode to PNG file", () => {
    init();
    const d = image.newImageData(8, 8)!;
    d.mapPixel(() => [255, 0, 0, 255]);
    d.encode("png", "/tmp/jove2d-test-imagedata.png");
    expect(existsSync("/tmp/jove2d-test-imagedata.png")).toBe(true);
  });

  test("encode to BMP file", () => {
    init();
    const d = image.newImageData(8, 8)!;
    d.mapPixel(() => [0, 255, 0, 255]);
    d.encode("bmp", "/tmp/jove2d-test-imagedata.bmp");
    expect(existsSync("/tmp/jove2d-test-imagedata.bmp")).toBe(true);
  });

  test("encode to PNG returns bytes", () => {
    init();
    const d = image.newImageData(4, 4)!;
    d.mapPixel(() => [0, 0, 255, 255]);
    const bytes = d.encode("png");
    expect(bytes).not.toBeNull();
    expect(bytes!.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(bytes![0]).toBe(0x89);
    expect(bytes![1]).toBe(0x50); // P
    expect(bytes![2]).toBe(0x4e); // N
    expect(bytes![3]).toBe(0x47); // G
  });
});

describe("jove.image.ImageData.getString", () => {
  afterEach(() => { quit(); });

  test("returns string of correct length", () => {
    init();
    const d = image.newImageData(2, 2)!;
    const s = d.getString();
    expect(s.length).toBe(2 * 2 * 4);
  });
});

describe("jove.image.newImageData from file", () => {
  afterEach(() => { quit(); });

  test("loads BMP file", () => {
    init();
    // Create a test BMP first
    const src = image.newImageData(4, 4)!;
    src.mapPixel(() => [100, 150, 200, 255]);
    src.encode("bmp", "/tmp/jove2d-test-load.bmp");

    const loaded = image.newImageData("/tmp/jove2d-test-load.bmp");
    expect(loaded).not.toBeNull();
    expect(loaded!.width).toBe(4);
    expect(loaded!.height).toBe(4);
    const [r, g, b, a] = loaded!.getPixel(0, 0);
    expect(r).toBe(100);
    expect(g).toBe(150);
    expect(b).toBe(200);
    expect(a).toBe(255);
    try { unlinkSync("/tmp/jove2d-test-load.bmp"); } catch {}
  });

  test("returns null for nonexistent file", () => {
    init();
    expect(image.newImageData("/nonexistent/file.png")).toBeNull();
  });

  if (sdlImageAvailable) {
    test("loads PNG file", () => {
      init();
      const src = image.newImageData(8, 8)!;
      src.mapPixel(() => [50, 100, 200, 255]);
      src.encode("png", "/tmp/jove2d-test-load.png");

      const loaded = image.newImageData("/tmp/jove2d-test-load.png");
      expect(loaded).not.toBeNull();
      expect(loaded!.width).toBe(8);
      expect(loaded!.height).toBe(8);
      const [r, g, b, a] = loaded!.getPixel(0, 0);
      expect(r).toBe(50);
      expect(g).toBe(100);
      expect(b).toBe(200);
      expect(a).toBe(255);
      try { unlinkSync("/tmp/jove2d-test-load.png"); } catch {}
    });
  }
});

describe("jove.graphics.newImage from ImageData", () => {
  afterEach(() => { quit(); });

  test("creates Image from ImageData", () => {
    setupWindowAndRenderer();
    const d = image.newImageData(16, 16)!;
    d.mapPixel(() => [255, 0, 0, 255]);
    const img = graphics.newImage(d);
    expect(img).not.toBeNull();
    expect(img!.getWidth()).toBe(16);
    expect(img!.getHeight()).toBe(16);
    img!.release();
  });

  test("ImageData image can be drawn", () => {
    setupWindowAndRenderer();
    const d = image.newImageData(8, 8)!;
    d.mapPixel(() => [0, 255, 0, 255]);
    const img = graphics.newImage(d)!;
    expect(() => graphics.draw(img, 10, 10)).not.toThrow();
    img.release();
  });
});
