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

    test("triangle returns single triangle with coordinates", () => {
      const tris = math.triangulate([0, 0, 10, 0, 5, 10]);
      expect(tris.length).toBe(1);
      expect(tris[0]).toEqual([0, 0, 10, 0, 5, 10]);
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

  describe("colorFromBytes / colorToBytes", () => {
    test("colorFromBytes converts 0-255 to 0-1", () => {
      const [r, g, b] = math.colorFromBytes(255, 0, 128);
      expect(r).toBe(1);
      expect(g).toBe(0);
      expect(b).toBeCloseTo(0.502, 2);
    });

    test("colorToBytes converts 0-1 to 0-255", () => {
      const [r, g, b] = math.colorToBytes(1, 0, 0.5);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(128);
    });

    test("round-trip preserves values", () => {
      const [r, g, b] = math.colorToBytes(...math.colorFromBytes(200, 100, 50) as [number, number, number]);
      expect(r).toBe(200);
      expect(g).toBe(100);
      expect(b).toBe(50);
    });

    test("with alpha parameter", () => {
      const [r, g, b, a] = math.colorFromBytes(255, 128, 0, 64);
      expect(r).toBe(1);
      expect(a).toBeCloseTo(0.251, 2);
      expect(math.colorFromBytes(255, 128, 0, 64).length).toBe(4);

      const bytes = math.colorToBytes(1, 0.5, 0, 0.25);
      expect(bytes.length).toBe(4);
      expect(bytes[0]).toBe(255);
      expect(bytes[3]).toBe(64);
    });

    test("without alpha returns 3 values", () => {
      expect(math.colorFromBytes(255, 0, 0).length).toBe(3);
      expect(math.colorToBytes(1, 0, 0).length).toBe(3);
    });
  });

  describe("getRandomState / setRandomState", () => {
    test("get state, advance RNG, set state back, get same sequence", () => {
      math.setRandomSeed(42);
      const state = math.getRandomState();
      const a1 = math.random();
      const a2 = math.random();
      math.setRandomState(state);
      const b1 = math.random();
      const b2 = math.random();
      expect(a1).toBe(b1);
      expect(a2).toBe(b2);
    });

    test("state is a 32-char hex string", () => {
      math.setRandomSeed(42);
      const state = math.getRandomState();
      expect(state.length).toBe(32);
      expect(/^[0-9a-f]{32}$/.test(state)).toBe(true);
    });

    test("invalid state string throws", () => {
      expect(() => math.setRandomState("abc")).toThrow("Invalid random state");
      expect(() => math.setRandomState("")).toThrow("Invalid random state");
    });
  });

  describe("RandomGenerator getState / setState", () => {
    test("save and restore state", () => {
      const rng = math.newRandomGenerator(42);
      const state = rng.getState();
      const a1 = rng.random();
      const a2 = rng.random();
      rng.setState(state);
      const b1 = rng.random();
      const b2 = rng.random();
      expect(a1).toBe(b1);
      expect(a2).toBe(b2);
    });

    test("invalid state throws", () => {
      const rng = math.newRandomGenerator(42);
      expect(() => rng.setState("short")).toThrow("Invalid random state");
    });
  });

  describe("newBezierCurve", () => {
    test("basic properties", () => {
      const curve = math.newBezierCurve([0, 0, 100, 200, 200, 200, 300, 0]);
      expect(curve.getControlPointCount()).toBe(4);
      expect(curve.getDegree()).toBe(3);
    });

    test("evaluate(0) returns first control point", () => {
      const curve = math.newBezierCurve([10, 20, 100, 200, 200, 200, 300, 50]);
      const [x, y] = curve.evaluate(0);
      expect(x).toBeCloseTo(10);
      expect(y).toBeCloseTo(20);
    });

    test("evaluate(1) returns last control point", () => {
      const curve = math.newBezierCurve([10, 20, 100, 200, 200, 200, 300, 50]);
      const [x, y] = curve.evaluate(1);
      expect(x).toBeCloseTo(300);
      expect(y).toBeCloseTo(50);
    });

    test("evaluate(0.5) returns midpoint-ish value", () => {
      const curve = math.newBezierCurve([0, 0, 100, 200, 200, 200, 300, 0]);
      const [x, y] = curve.evaluate(0.5);
      expect(x).not.toBe(0);
      expect(x).not.toBe(300);
      // For symmetric cubic: midpoint x should be 150
      expect(x).toBeCloseTo(150);
    });

    test("render() returns flat array with even length", () => {
      const curve = math.newBezierCurve([0, 0, 100, 200, 200, 200, 300, 0]);
      const pts = curve.render();
      expect(pts.length % 2).toBe(0);
      expect(pts.length).toBeGreaterThan(2);
      // First point matches first control point
      expect(pts[0]).toBeCloseTo(0);
      expect(pts[1]).toBeCloseTo(0);
      // Last point matches last control point
      expect(pts[pts.length - 2]).toBeCloseTo(300);
      expect(pts[pts.length - 1]).toBeCloseTo(0);
    });

    test("getDerivative has degree n-1", () => {
      const curve = math.newBezierCurve([0, 0, 100, 200, 200, 200, 300, 0]);
      const deriv = curve.getDerivative();
      expect(deriv.getDegree()).toBe(2);
      expect(deriv.getControlPointCount()).toBe(3);
    });

    test("getControlPoint / setControlPoint round-trip", () => {
      const curve = math.newBezierCurve([0, 0, 100, 200, 200, 200, 300, 0]);
      curve.setControlPoint(1, 50, 100);
      const [x, y] = curve.getControlPoint(1);
      expect(x).toBe(50);
      expect(y).toBe(100);
    });

    test("insertControlPoint / removeControlPoint adjust count", () => {
      const curve = math.newBezierCurve([0, 0, 100, 200, 200, 200, 300, 0]);
      expect(curve.getControlPointCount()).toBe(4);
      curve.insertControlPoint(150, 100);
      expect(curve.getControlPointCount()).toBe(5);
      curve.removeControlPoint(4);
      expect(curve.getControlPointCount()).toBe(4);
    });

    test("insertControlPoint at specific index", () => {
      const curve = math.newBezierCurve([0, 0, 300, 0]);
      curve.insertControlPoint(150, 200, 1);
      expect(curve.getControlPointCount()).toBe(3);
      const [x, y] = curve.getControlPoint(1);
      expect(x).toBe(150);
      expect(y).toBe(200);
    });

    test("translate shifts all points", () => {
      const curve = math.newBezierCurve([0, 0, 100, 100]);
      curve.translate(10, 20);
      const [x0, y0] = curve.getControlPoint(0);
      const [x1, y1] = curve.getControlPoint(1);
      expect(x0).toBe(10);
      expect(y0).toBe(20);
      expect(x1).toBe(110);
      expect(y1).toBe(120);
    });

    test("rotate transforms correctly", () => {
      const curve = math.newBezierCurve([100, 0, 200, 0]);
      curve.rotate(Math.PI / 2, 0, 0);
      const [x0, y0] = curve.getControlPoint(0);
      expect(x0).toBeCloseTo(0);
      expect(y0).toBeCloseTo(100);
    });

    test("scale transforms correctly", () => {
      const curve = math.newBezierCurve([100, 100, 200, 200]);
      curve.scale(2, 0, 0);
      const [x0, y0] = curve.getControlPoint(0);
      const [x1, y1] = curve.getControlPoint(1);
      expect(x0).toBe(200);
      expect(y0).toBe(200);
      expect(x1).toBe(400);
      expect(y1).toBe(400);
    });

    test("getSegment produces valid sub-curve", () => {
      const curve = math.newBezierCurve([0, 0, 100, 200, 200, 200, 300, 0]);
      const seg = curve.getSegment(0.25, 0.75);
      expect(seg.getControlPointCount()).toBe(4);
      // Segment endpoints should match evaluate at t1, t2
      const [sx, sy] = seg.evaluate(0);
      const [ex, ey] = seg.evaluate(1);
      const [ox, oy] = curve.evaluate(0.25);
      const [fx, fy] = curve.evaluate(0.75);
      expect(sx).toBeCloseTo(ox, 4);
      expect(sy).toBeCloseTo(oy, 4);
      expect(ex).toBeCloseTo(fx, 4);
      expect(ey).toBeCloseTo(fy, 4);
    });

    test("renderSegment returns points", () => {
      const curve = math.newBezierCurve([0, 0, 100, 200, 200, 200, 300, 0]);
      const pts = curve.renderSegment(0.2, 0.8);
      expect(pts.length % 2).toBe(0);
      expect(pts.length).toBeGreaterThan(2);
    });

    test("throws on too few points", () => {
      expect(() => math.newBezierCurve([0, 0])).toThrow();
      expect(() => math.newBezierCurve([1])).toThrow();
    });
  });
});
