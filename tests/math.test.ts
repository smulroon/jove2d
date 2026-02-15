import { test, expect, describe } from "bun:test";
import * as math from "../src/jove/math.ts";

describe("jove.math", () => {
  describe("random", () => {
    test("random() returns a number in [0, 1)", () => {
      math.setRandomSeed(42);
      for (let i = 0; i < 100; i++) {
        const r = math.random();
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(1);
      }
    });

    test("random(max) returns integer in [1, max]", () => {
      math.setRandomSeed(42);
      for (let i = 0; i < 100; i++) {
        const r = math.random(6);
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(6);
        expect(Math.floor(r)).toBe(r); // integer
      }
    });

    test("random(min, max) returns integer in [min, max]", () => {
      math.setRandomSeed(42);
      for (let i = 0; i < 100; i++) {
        const r = math.random(10, 20);
        expect(r).toBeGreaterThanOrEqual(10);
        expect(r).toBeLessThanOrEqual(20);
      }
    });

    test("setRandomSeed produces deterministic results", () => {
      math.setRandomSeed(123);
      const a1 = math.random();
      const a2 = math.random();
      math.setRandomSeed(123);
      const b1 = math.random();
      const b2 = math.random();
      expect(a1).toBe(b1);
      expect(a2).toBe(b2);
    });
  });

  describe("randomNormal", () => {
    test("returns numbers centered around mean", () => {
      math.setRandomSeed(42);
      let sum = 0;
      const n = 1000;
      for (let i = 0; i < n; i++) {
        sum += math.randomNormal(1, 5);
      }
      const avg = sum / n;
      expect(avg).toBeGreaterThan(4);
      expect(avg).toBeLessThan(6);
    });
  });

  describe("newRandomGenerator", () => {
    test("creates independent generator", () => {
      const rng = math.newRandomGenerator(42);
      const r1 = rng.random();
      expect(typeof r1).toBe("number");
      expect(r1).toBeGreaterThanOrEqual(0);
      expect(r1).toBeLessThan(1);
    });

    test("independent generators don't affect each other", () => {
      const rng1 = math.newRandomGenerator(1);
      const rng2 = math.newRandomGenerator(2);
      const a = rng1.random();
      const b = rng2.random();
      // Different seeds should produce different values (with very high probability)
      expect(a).not.toBe(b);
    });

    test("setSeed makes generator deterministic", () => {
      const rng = math.newRandomGenerator();
      rng.setSeed(99);
      const a = rng.random();
      rng.setSeed(99);
      const b = rng.random();
      expect(a).toBe(b);
    });
  });

  describe("noise", () => {
    test("1D noise returns value in [-1, 1]", () => {
      for (let x = -10; x <= 10; x += 0.5) {
        const n = math.noise(x);
        expect(n).toBeGreaterThanOrEqual(-1);
        expect(n).toBeLessThanOrEqual(1);
      }
    });

    test("2D noise returns value in [-1, 1]", () => {
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const n = math.noise(x * 0.1, y * 0.1);
          expect(n).toBeGreaterThanOrEqual(-1);
          expect(n).toBeLessThanOrEqual(1);
        }
      }
    });

    test("3D noise returns value in [-1, 1]", () => {
      const n = math.noise(1.5, 2.5, 3.5);
      expect(n).toBeGreaterThanOrEqual(-1);
      expect(n).toBeLessThanOrEqual(1);
    });

    test("noise is deterministic", () => {
      const a = math.noise(1.23, 4.56);
      const b = math.noise(1.23, 4.56);
      expect(a).toBe(b);
    });

    test("noise varies with input", () => {
      const a = math.noise(0, 0);
      const b = math.noise(100, 100);
      // Different inputs should generally produce different outputs
      expect(a).not.toBe(b);
    });
  });

  describe("newTransform", () => {
    test("identity transform passes through points", () => {
      const t = math.newTransform();
      const [x, y] = t.transformPoint(5, 10);
      expect(x).toBe(5);
      expect(y).toBe(10);
    });

    test("translate moves points", () => {
      const t = math.newTransform();
      t.translate(10, 20);
      const [x, y] = t.transformPoint(5, 5);
      expect(x).toBe(15);
      expect(y).toBe(25);
    });

    test("scale transforms points", () => {
      const t = math.newTransform();
      t.scale(2, 3);
      const [x, y] = t.transformPoint(5, 5);
      expect(x).toBe(10);
      expect(y).toBe(15);
    });

    test("rotate transforms points", () => {
      const t = math.newTransform();
      t.rotate(Math.PI / 2); // 90 degrees
      const [x, y] = t.transformPoint(1, 0);
      expect(x).toBeCloseTo(0);
      expect(y).toBeCloseTo(1);
    });

    test("inverse undoes transform", () => {
      const t = math.newTransform();
      t.translate(10, 20);
      t.scale(2);
      const inv = t.inverse();
      const [x, y] = t.transformPoint(5, 5);
      const [rx, ry] = inv.transformPoint(x, y);
      expect(rx).toBeCloseTo(5);
      expect(ry).toBeCloseTo(5);
    });

    test("clone creates independent copy", () => {
      const t = math.newTransform();
      t.translate(10, 20);
      const c = t.clone();
      t.translate(100, 200); // Modify original
      const [x, y] = c.transformPoint(0, 0);
      expect(x).toBe(10);
      expect(y).toBe(20);
    });

    test("reset returns to identity", () => {
      const t = math.newTransform();
      t.translate(10, 20);
      t.scale(3);
      t.reset();
      const [x, y] = t.transformPoint(5, 5);
      expect(x).toBe(5);
      expect(y).toBe(5);
    });

    test("getMatrix returns transform values", () => {
      const t = math.newTransform();
      const [a, b, c, d, tx, ty] = t.getMatrix();
      expect(a).toBe(1);
      expect(b).toBe(0);
      expect(c).toBe(0);
      expect(d).toBe(1);
      expect(tx).toBe(0);
      expect(ty).toBe(0);
    });
  });

  describe("triangulate", () => {
    test("triangulates a quad", () => {
      const tris = math.triangulate([0, 0, 10, 0, 10, 10, 0, 10]);
      expect(tris.length).toBe(2);
    });

    test("returns empty for less than 3 points", () => {
      const tris = math.triangulate([0, 0, 10, 0]);
      expect(tris.length).toBe(0);
    });

    test("triangle returns single triangle", () => {
      const tris = math.triangulate([0, 0, 10, 0, 5, 10]);
      expect(tris.length).toBe(1);
      expect(tris[0]).toEqual([0, 1, 2]);
    });
  });

  describe("isConvex", () => {
    test("square is convex", () => {
      expect(math.isConvex([0, 0, 10, 0, 10, 10, 0, 10])).toBe(true);
    });

    test("triangle is convex", () => {
      expect(math.isConvex([0, 0, 10, 0, 5, 10])).toBe(true);
    });

    test("too few points is not convex", () => {
      expect(math.isConvex([0, 0, 10, 0])).toBe(false);
    });
  });

  describe("color conversion", () => {
    test("gammaToLinear converts correctly", () => {
      expect(math.gammaToLinear(0)).toBeCloseTo(0);
      expect(math.gammaToLinear(1)).toBeCloseTo(1);
    });

    test("linearToGamma converts correctly", () => {
      expect(math.linearToGamma(0)).toBeCloseTo(0);
      expect(math.linearToGamma(1)).toBeCloseTo(1);
    });

    test("round-trip preserves values", () => {
      for (const v of [0, 0.1, 0.5, 0.8, 1.0]) {
        expect(math.linearToGamma(math.gammaToLinear(v))).toBeCloseTo(v);
      }
    });
  });
});
