// jove2d math module — mirrors love.math API
// Includes Simplex noise, seeded RNG, and 2D transform utilities

// --- Seeded PRNG (xoshiro128**) ---

let _seed = [1, 2, 3, 4]; // 4 x uint32 state

function _rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

function _next(): number {
  const s = _seed;
  const result = (_rotl((s[1] * 5) >>> 0, 7) * 9) >>> 0;
  const t = (s[1] << 9) >>> 0;
  s[2] ^= s[0];
  s[3] ^= s[1];
  s[1] ^= s[2];
  s[0] ^= s[3];
  s[2] ^= t;
  s[3] = _rotl(s[3], 11);
  return result;
}

/** Set the random seed. */
export function setRandomSeed(seed: number): void {
  // Use the seed to initialize the 4-word state via SplitMix32
  let s = seed >>> 0;
  for (let i = 0; i < 4; i++) {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = (((z >>> 16) ^ z) * 0x45d9f3b) >>> 0;
    z = (((z >>> 16) ^ z) * 0x45d9f3b) >>> 0;
    z = ((z >>> 16) ^ z) >>> 0;
    _seed[i] = z || 1; // Avoid zero state
  }
}

/** Get the current random seed state (as a single number for simplicity). */
export function getRandomSeed(): number {
  return _seed[0];
}

/** Generate a random number. No args: [0,1). One arg: [1,max]. Two args: [min,max]. */
export function random(min?: number, max?: number): number {
  const r = (_next() >>> 0) / 0x100000000; // [0, 1)
  if (min === undefined) return r;
  if (max === undefined) {
    // random(max) → integer in [1, max]
    return Math.floor(r * min) + 1;
  }
  // random(min, max) → integer in [min, max]
  return Math.floor(r * (max - min + 1)) + min;
}

/** Generate a random number from a normal distribution. */
export function randomNormal(stddev: number = 1, mean: number = 0): number {
  // Box-Muller transform
  const u1 = (_next() >>> 0) / 0x100000000 || 1e-10;
  const u2 = (_next() >>> 0) / 0x100000000;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z * stddev + mean;
}

// --- Random Generator object ---

export interface RandomGenerator {
  random(min?: number, max?: number): number;
  randomNormal(stddev?: number, mean?: number): number;
  setSeed(seed: number): void;
  getSeed(): number;
  getState(): string;
  setState(state: string): void;
}

/** Create an independent random number generator. */
export function newRandomGenerator(seed?: number): RandomGenerator {
  const state = [1, 2, 3, 4];

  function init(s: number): void {
    let v = s >>> 0;
    for (let i = 0; i < 4; i++) {
      v = (v + 0x9e3779b9) >>> 0;
      let z = v;
      z = (((z >>> 16) ^ z) * 0x45d9f3b) >>> 0;
      z = (((z >>> 16) ^ z) * 0x45d9f3b) >>> 0;
      z = ((z >>> 16) ^ z) >>> 0;
      state[i] = z || 1;
    }
  }

  function next(): number {
    const result = (_rotl((state[1] * 5) >>> 0, 7) * 9) >>> 0;
    const t = (state[1] << 9) >>> 0;
    state[2] ^= state[0];
    state[3] ^= state[1];
    state[1] ^= state[2];
    state[0] ^= state[3];
    state[2] ^= t;
    state[3] = _rotl(state[3], 11);
    return result;
  }

  if (seed !== undefined) init(seed);

  return {
    random(min?: number, max?: number): number {
      const r = (next() >>> 0) / 0x100000000;
      if (min === undefined) return r;
      if (max === undefined) return Math.floor(r * min) + 1;
      return Math.floor(r * (max - min + 1)) + min;
    },
    randomNormal(stddev: number = 1, mean: number = 0): number {
      const u1 = (next() >>> 0) / 0x100000000 || 1e-10;
      const u2 = (next() >>> 0) / 0x100000000;
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return z * stddev + mean;
    },
    setSeed(s: number): void {
      init(s);
    },
    getSeed(): number {
      return state[0];
    },
    getState(): string {
      return state.map(v => (v >>> 0).toString(16).padStart(8, "0")).join("");
    },
    setState(s: string): void {
      if (s.length !== 32) throw new Error("Invalid random state");
      for (let i = 0; i < 4; i++) {
        state[i] = parseInt(s.slice(i * 8, i * 8 + 8), 16) >>> 0;
      }
    },
  };
}

// --- Simplex noise ---

// Permutation table for noise
const _perm = new Uint8Array(512);
const _grad3: [number, number, number][] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

// Initialize permutation table
(function initPerm() {
  const p = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
    140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
    247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
    57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
    74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
    60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
    65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
    200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
    52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
    207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
    119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
    129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
    218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
    81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
    184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
    222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
  ];
  for (let i = 0; i < 256; i++) {
    _perm[i] = p[i];
    _perm[i + 256] = p[i];
  }
})();

function _dot3(g: [number, number, number], x: number, y: number, z: number): number {
  return g[0] * x + g[1] * y + g[2] * z;
}

function _dot2(g: [number, number, number], x: number, y: number): number {
  return g[0] * x + g[1] * y;
}

/** Simplex noise. Supports 1D, 2D, and 3D. Returns value in [-1, 1]. */
export function noise(x: number, y?: number, z?: number): number {
  if (y === undefined) return _noise1(x);
  if (z === undefined) return _noise2(x, y);
  return _noise3(x, y, z);
}

function _noise1(x: number): number {
  return _noise2(x, 0);
}

function _noise2(xin: number, yin: number): number {
  const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;

  const X0 = i - t;
  const Y0 = j - t;
  const x0 = xin - X0;
  const y0 = yin - Y0;

  let i1: number, j1: number;
  if (x0 > y0) { i1 = 1; j1 = 0; }
  else { i1 = 0; j1 = 1; }

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2;
  const y2 = y0 - 1.0 + 2.0 * G2;

  const ii = (i & 255) >>> 0;
  const jj = (j & 255) >>> 0;
  const gi0 = _perm[ii + _perm[jj]] % 12;
  const gi1 = _perm[ii + i1 + _perm[jj + j1]] % 12;
  const gi2 = _perm[ii + 1 + _perm[jj + 1]] % 12;

  let n0: number, n1: number, n2: number;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 < 0) n0 = 0;
  else { t0 *= t0; n0 = t0 * t0 * _dot2(_grad3[gi0], x0, y0); }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 < 0) n1 = 0;
  else { t1 *= t1; n1 = t1 * t1 * _dot2(_grad3[gi1], x1, y1); }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 < 0) n2 = 0;
  else { t2 *= t2; n2 = t2 * t2 * _dot2(_grad3[gi2], x2, y2); }

  return 70.0 * (n0 + n1 + n2);
}

function _noise3(xin: number, yin: number, zin: number): number {
  const F3 = 1.0 / 3.0;
  const G3 = 1.0 / 6.0;

  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * G3;

  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;
  const x0 = xin - X0;
  const y0 = yin - Y0;
  const z0 = zin - Z0;

  let i1: number, j1: number, k1: number;
  let i2: number, j2: number, k2: number;

  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3;
  const y2 = y0 - j2 + 2.0 * G3;
  const z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3;
  const y3 = y0 - 1.0 + 3.0 * G3;
  const z3 = z0 - 1.0 + 3.0 * G3;

  const ii = (i & 255) >>> 0;
  const jj = (j & 255) >>> 0;
  const kk = (k & 255) >>> 0;
  const gi0 = _perm[ii + _perm[jj + _perm[kk]]] % 12;
  const gi1 = _perm[ii + i1 + _perm[jj + j1 + _perm[kk + k1]]] % 12;
  const gi2 = _perm[ii + i2 + _perm[jj + j2 + _perm[kk + k2]]] % 12;
  const gi3 = _perm[ii + 1 + _perm[jj + 1 + _perm[kk + 1]]] % 12;

  let n0: number, n1: number, n2: number, n3: number;

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 < 0) n0 = 0;
  else { t0 *= t0; n0 = t0 * t0 * _dot3(_grad3[gi0], x0, y0, z0); }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 < 0) n1 = 0;
  else { t1 *= t1; n1 = t1 * t1 * _dot3(_grad3[gi1], x1, y1, z1); }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 < 0) n2 = 0;
  else { t2 *= t2; n2 = t2 * t2 * _dot3(_grad3[gi2], x2, y2, z2); }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 < 0) n3 = 0;
  else { t3 *= t3; n3 = t3 * t3 * _dot3(_grad3[gi3], x3, y3, z3); }

  return 32.0 * (n0 + n1 + n2 + n3);
}

// --- 2D Affine Transform ---

/** A 2D affine transform matrix [a, b, c, d, tx, ty].
 *  Represents: x' = a*x + c*y + tx, y' = b*x + d*y + ty */
export interface Transform {
  /** Get the matrix components: [a, b, c, d, tx, ty]. */
  getMatrix(): [number, number, number, number, number, number];
  /** Reset to identity. */
  reset(): Transform;
  /** Apply translation. */
  translate(dx: number, dy: number): Transform;
  /** Apply rotation (radians). */
  rotate(angle: number): Transform;
  /** Apply scale. */
  scale(sx: number, sy?: number): Transform;
  /** Apply shear. */
  shear(kx: number, ky: number): Transform;
  /** Transform a point. */
  transformPoint(x: number, y: number): [number, number];
  /** Get the inverse transform. */
  inverse(): Transform;
  /** Clone this transform. */
  clone(): Transform;
}

/** Create a new 2D affine transform. */
export function newTransform(): Transform {
  let a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0;

  const t: Transform = {
    getMatrix(): [number, number, number, number, number, number] {
      return [a, b, c, d, tx, ty];
    },
    reset(): Transform {
      a = 1; b = 0; c = 0; d = 1; tx = 0; ty = 0;
      return t;
    },
    translate(dx: number, dy: number): Transform {
      tx += a * dx + c * dy;
      ty += b * dx + d * dy;
      return t;
    },
    rotate(angle: number): Transform {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const na = a * cos + c * sin;
      const nb = b * cos + d * sin;
      const nc = a * -sin + c * cos;
      const nd = b * -sin + d * cos;
      a = na; b = nb; c = nc; d = nd;
      return t;
    },
    scale(sx: number, sy?: number): Transform {
      const _sy = sy ?? sx;
      a *= sx; b *= sx;
      c *= _sy; d *= _sy;
      return t;
    },
    shear(kx: number, ky: number): Transform {
      const na = a + c * ky;
      const nb = b + d * ky;
      const nc = a * kx + c;
      const nd = b * kx + d;
      a = na; b = nb; c = nc; d = nd;
      return t;
    },
    transformPoint(x: number, y: number): [number, number] {
      return [a * x + c * y + tx, b * x + d * y + ty];
    },
    inverse(): Transform {
      const det = a * d - b * c;
      if (Math.abs(det) < 1e-12) return newTransform(); // Singular, return identity
      const inv = newTransform();
      const id = 1 / det;
      const [, , , , , ] = inv.getMatrix(); // unused, just init
      // Set directly by manipulating the returned transform
      const ia = d * id;
      const ib = -b * id;
      const ic = -c * id;
      const id2 = a * id;
      const itx = (c * ty - d * tx) * id;
      const ity = (b * tx - a * ty) * id;
      // Create new transform with these values
      const result = newTransform();
      // We need to set the internal state. Use scale+translate trick:
      // Actually, let's just return a fresh transform and manually set it
      return _createTransformFromValues(ia, ib, ic, id2, itx, ity);
    },
    clone(): Transform {
      return _createTransformFromValues(a, b, c, d, tx, ty);
    },
  };
  return t;
}

function _createTransformFromValues(
  a: number, b: number, c: number, d: number, tx: number, ty: number
): Transform {
  const t: Transform = {
    getMatrix() { return [a, b, c, d, tx, ty]; },
    reset() { a = 1; b = 0; c = 0; d = 1; tx = 0; ty = 0; return t; },
    translate(dx, dy) { tx += a * dx + c * dy; ty += b * dx + d * dy; return t; },
    rotate(angle) {
      const cos = Math.cos(angle); const sin = Math.sin(angle);
      const na = a * cos + c * sin; const nb = b * cos + d * sin;
      const nc = a * -sin + c * cos; const nd = b * -sin + d * cos;
      a = na; b = nb; c = nc; d = nd; return t;
    },
    scale(sx, sy?) {
      const _sy = sy ?? sx; a *= sx; b *= sx; c *= _sy; d *= _sy; return t;
    },
    shear(kx, ky) {
      const na = a + c * ky; const nb = b + d * ky;
      const nc = a * kx + c; const nd = b * kx + d;
      a = na; b = nb; c = nc; d = nd; return t;
    },
    transformPoint(x, y) { return [a * x + c * y + tx, b * x + d * y + ty]; },
    inverse() {
      const det = a * d - b * c;
      if (Math.abs(det) < 1e-12) return newTransform();
      const id = 1 / det;
      return _createTransformFromValues(d * id, -b * id, -c * id, a * id,
        (c * ty - d * tx) * id, (b * tx - a * ty) * id);
    },
    clone() { return _createTransformFromValues(a, b, c, d, tx, ty); },
  };
  return t;
}

// --- Geometry utilities ---

/** Triangulate a simple polygon into triangles. Returns array of index triples. */
export function triangulate(vertices: number[]): number[][] {
  // Ear clipping triangulation matching love2d's algorithm.
  // Uses linked-list prev/next arrays, detects winding, advances to next after clip.
  // Returns array of triangles, each triangle is [x1, y1, x2, y2, x3, y3].
  const n = vertices.length / 2;
  if (n < 3) return [];
  if (n === 3) return [[vertices[0], vertices[1], vertices[2], vertices[3], vertices[4], vertices[5]]];

  // Build circular linked list via next/prev index arrays
  const nextIdx = new Array<number>(n);
  const prevIdx = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    nextIdx[i] = i + 1;
    prevIdx[i] = i - 1;
  }
  nextIdx[n - 1] = 0;
  prevIdx[0] = n - 1;

  // Find leftmost vertex to determine winding
  let lm = 0;
  for (let i = 1; i < n; i++) {
    if (vertices[i * 2] < vertices[lm * 2] ||
        (vertices[i * 2] === vertices[lm * 2] && vertices[i * 2 + 1] < vertices[lm * 2 + 1])) {
      lm = i;
    }
  }

  // Check if CCW at leftmost vertex
  const lmPrev = prevIdx[lm], lmNext = nextIdx[lm];
  const isCCW = _isCCW(
    vertices[lmPrev * 2], vertices[lmPrev * 2 + 1],
    vertices[lm * 2], vertices[lm * 2 + 1],
    vertices[lmNext * 2], vertices[lmNext * 2 + 1],
  );

  // If clockwise, swap prev/next to reverse traversal (matches love2d)
  if (!isCCW) {
    const tmp = nextIdx.slice();
    for (let i = 0; i < n; i++) { nextIdx[i] = prevIdx[i]; prevIdx[i] = tmp[i]; }
  }

  const triangles: number[][] = [];
  let nVerts = n;
  // LOVE2D COMPAT HACK: love2d's C++ ear clipper starts at index 1 instead of 0,
  // likely a vestige of Lua's 1-based indexing. We match this to produce identical triangulations.
  let current = 1;
  let skipped = 0;

  while (nVerts > 3) {
    const prev = prevIdx[current];
    const next = nextIdx[current];

    const ax = vertices[prev * 2], ay = vertices[prev * 2 + 1];
    const bx = vertices[current * 2], by = vertices[current * 2 + 1];
    const cx = vertices[next * 2], cy = vertices[next * 2 + 1];

    if (_isCCW(ax, ay, bx, by, cx, cy)) {
      let isEar = true;
      let test = nextIdx[next];
      while (test !== prev) {
        const tx = vertices[test * 2], ty = vertices[test * 2 + 1];
        if (_pointInTriangle(tx, ty, ax, ay, bx, by, cx, cy)) {
          isEar = false;
          break;
        }
        test = nextIdx[test];
      }
      if (isEar) {
        triangles.push([ax, ay, bx, by, cx, cy]);
        // Remove current vertex from linked list
        nextIdx[prev] = next;
        prevIdx[next] = prev;
        nVerts--;
        current = next;
        skipped = 0;
        continue;
      }
    }

    current = nextIdx[current];
    skipped++;
    if (skipped > nVerts) break; // no ear found, bail
  }

  // Final triangle
  if (nVerts === 3) {
    const prev = prevIdx[current];
    const next = nextIdx[current];
    triangles.push([
      vertices[prev * 2], vertices[prev * 2 + 1],
      vertices[current * 2], vertices[current * 2 + 1],
      vertices[next * 2], vertices[next * 2 + 1],
    ]);
  }

  return triangles;
}

function _isCCW(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  return ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) >= 0;
}

function _pointInTriangle(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number
): boolean {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

/** Check if a polygon is convex. Vertices as [x1, y1, x2, y2, ...]. */
export function isConvex(vertices: number[]): boolean {
  const n = vertices.length / 2;
  if (n < 3) return false;

  let sign = 0;
  for (let i = 0; i < n; i++) {
    const x1 = vertices[i * 2], y1 = vertices[i * 2 + 1];
    const x2 = vertices[((i + 1) % n) * 2], y2 = vertices[((i + 1) % n) * 2 + 1];
    const x3 = vertices[((i + 2) % n) * 2], y3 = vertices[((i + 2) % n) * 2 + 1];
    const cross = (x2 - x1) * (y3 - y2) - (y2 - y1) * (x3 - x2);
    if (cross !== 0) {
      if (sign === 0) sign = cross > 0 ? 1 : -1;
      else if ((cross > 0 ? 1 : -1) !== sign) return false;
    }
  }
  return true;
}

/** Convert gamma-space color to linear. */
export function gammaToLinear(c: number): number {
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Convert linear color to gamma-space. */
export function linearToGamma(c: number): number {
  if (c <= 0.0031308) return c * 12.92;
  return 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
}

// --- RNG state serialization ---

/** Get the global RNG state as a 32-char hex string. */
export function getRandomState(): string {
  return _seed.map(v => (v >>> 0).toString(16).padStart(8, "0")).join("");
}

/** Set the global RNG state from a 32-char hex string. */
export function setRandomState(state: string): void {
  if (state.length !== 32) throw new Error("Invalid random state");
  for (let i = 0; i < 4; i++) {
    _seed[i] = parseInt(state.slice(i * 8, i * 8 + 8), 16) >>> 0;
  }
}

// --- Color byte conversion ---

/** Convert 0-255 color values to 0-1 range. */
export function colorFromBytes(r: number, g: number, b: number, a?: number): number[] {
  if (a !== undefined) return [r / 255, g / 255, b / 255, a / 255];
  return [r / 255, g / 255, b / 255];
}

/** Convert 0-1 color values to 0-255 range. */
export function colorToBytes(r: number, g: number, b: number, a?: number): number[] {
  if (a !== undefined) return [Math.floor(r * 255 + 0.5), Math.floor(g * 255 + 0.5), Math.floor(b * 255 + 0.5), Math.floor(a * 255 + 0.5)];
  return [Math.floor(r * 255 + 0.5), Math.floor(g * 255 + 0.5), Math.floor(b * 255 + 0.5)];
}

// --- BezierCurve ---

export interface BezierCurve {
  evaluate(t: number): [number, number];
  render(depth?: number): number[];
  renderSegment(startT: number, endT: number, depth?: number): number[];
  getDerivative(): BezierCurve;
  getControlPoint(index: number): [number, number];
  setControlPoint(index: number, x: number, y: number): void;
  insertControlPoint(x: number, y: number, index?: number): void;
  removeControlPoint(index: number): void;
  getControlPointCount(): number;
  getDegree(): number;
  getSegment(t1: number, t2: number): BezierCurve;
  translate(dx: number, dy: number): void;
  rotate(angle: number, ox?: number, oy?: number): void;
  scale(s: number, ox?: number, oy?: number): void;
}

/** Create a new Bezier curve from control points [x1, y1, x2, y2, ...]. */
export function newBezierCurve(points: number[]): BezierCurve {
  if (points.length < 4 || points.length % 2 !== 0) {
    throw new Error("Need at least 2 control points (4 numbers)");
  }
  // Internal copy of control points
  const cp = points.slice();

  function evaluateAt(t: number, pts: number[]): [number, number] {
    // De Casteljau's algorithm
    const n = pts.length / 2;
    const work = pts.slice();
    for (let r = 1; r < n; r++) {
      for (let i = 0; i < n - r; i++) {
        work[i * 2] = (1 - t) * work[i * 2] + t * work[(i + 1) * 2];
        work[i * 2 + 1] = (1 - t) * work[i * 2 + 1] + t * work[(i + 1) * 2 + 1];
      }
    }
    return [work[0], work[1]];
  }

  function subdivide(pts: number[], depth: number, out: number[]): void {
    if (depth <= 0) {
      // Add the endpoint
      const [x, y] = evaluateAt(1, pts);
      out.push(x, y);
      return;
    }
    // Split at t=0.5 using de Casteljau
    const n = pts.length / 2;
    const left: number[] = [];
    const right: number[] = [];
    const work = pts.slice();

    left.push(work[0], work[1]);
    right.push(work[(n - 1) * 2], work[(n - 1) * 2 + 1]);

    for (let r = 1; r < n; r++) {
      for (let i = 0; i < n - r; i++) {
        work[i * 2] = 0.5 * work[i * 2] + 0.5 * work[(i + 1) * 2];
        work[i * 2 + 1] = 0.5 * work[i * 2 + 1] + 0.5 * work[(i + 1) * 2 + 1];
      }
      left.push(work[0], work[1]);
      right.push(work[(n - 1 - r) * 2], work[(n - 1 - r) * 2 + 1]);
    }

    // Reverse right to get correct order
    const rightOrdered: number[] = [];
    for (let i = right.length / 2 - 1; i >= 0; i--) {
      rightOrdered.push(right[i * 2], right[i * 2 + 1]);
    }

    subdivide(left, depth - 1, out);
    subdivide(rightOrdered, depth - 1, out);
  }

  function getSegmentPoints(t1: number, t2: number): number[] {
    // Use de Casteljau to extract a sub-curve from t1 to t2
    // First split at t1, take right part; then split that at adjusted t2
    const n = cp.length / 2;

    // Split at t1 → right half
    let work = cp.slice();
    const rightPts: number[] = [];
    for (let r = 1; r < n; r++) {
      rightPts.push(work[(n - r) * 2], work[(n - r) * 2 + 1]); // will be reversed
      for (let i = 0; i < n - r; i++) {
        work[i * 2] = (1 - t1) * work[i * 2] + t1 * work[(i + 1) * 2];
        work[i * 2 + 1] = (1 - t1) * work[i * 2 + 1] + t1 * work[(i + 1) * 2 + 1];
      }
    }
    // Right half control points: work[0] + collected from top-right of triangle
    // Actually let me redo this properly.

    // Split at t1
    function splitAt(pts: number[], t: number): { left: number[]; right: number[] } {
      const nn = pts.length / 2;
      const w = pts.slice();
      const left: number[] = [w[0], w[1]];
      const right: number[] = [w[(nn - 1) * 2], w[(nn - 1) * 2 + 1]];

      for (let r = 1; r < nn; r++) {
        for (let i = 0; i < nn - r; i++) {
          w[i * 2] = (1 - t) * w[i * 2] + t * w[(i + 1) * 2];
          w[i * 2 + 1] = (1 - t) * w[i * 2 + 1] + t * w[(i + 1) * 2 + 1];
        }
        left.push(w[0], w[1]);
        right.push(w[(nn - 1 - r) * 2], w[(nn - 1 - r) * 2 + 1]);
      }

      // Reverse right
      const ro: number[] = [];
      for (let i = right.length / 2 - 1; i >= 0; i--) {
        ro.push(right[i * 2], right[i * 2 + 1]);
      }
      return { left, right: ro };
    }

    const { right: afterT1 } = splitAt(cp, t1);
    // Now split afterT1 at adjusted parameter
    const adjustedT2 = t1 < 1 ? (t2 - t1) / (1 - t1) : 0;
    const { left: segment } = splitAt(afterT1, adjustedT2);
    return segment;
  }

  const curve: BezierCurve = {
    evaluate(t: number): [number, number] {
      return evaluateAt(t, cp);
    },

    render(depth: number = 5): number[] {
      const out: number[] = [cp[0], cp[1]]; // Start point
      subdivide(cp, depth, out);
      return out;
    },

    renderSegment(startT: number, endT: number, depth: number = 5): number[] {
      const segPts = getSegmentPoints(startT, endT);
      const out: number[] = [segPts[0], segPts[1]];
      subdivide(segPts, depth, out);
      return out;
    },

    getDerivative(): BezierCurve {
      const n = cp.length / 2;
      if (n < 2) throw new Error("Cannot get derivative of curve with less than 2 control points");
      const degree = n - 1;
      const deriv: number[] = [];
      for (let i = 0; i < degree; i++) {
        deriv.push(
          degree * (cp[(i + 1) * 2] - cp[i * 2]),
          degree * (cp[(i + 1) * 2 + 1] - cp[i * 2 + 1]),
        );
      }
      return newBezierCurve(deriv);
    },

    getControlPoint(index: number): [number, number] {
      if (index < 0 || index >= cp.length / 2) throw new Error("Control point index out of range");
      return [cp[index * 2], cp[index * 2 + 1]];
    },

    setControlPoint(index: number, x: number, y: number): void {
      if (index < 0 || index >= cp.length / 2) throw new Error("Control point index out of range");
      cp[index * 2] = x;
      cp[index * 2 + 1] = y;
    },

    insertControlPoint(x: number, y: number, index?: number): void {
      const i = index !== undefined ? index : cp.length / 2;
      cp.splice(i * 2, 0, x, y);
    },

    removeControlPoint(index: number): void {
      if (cp.length / 2 <= 2) throw new Error("Cannot remove: need at least 2 control points");
      if (index < 0 || index >= cp.length / 2) throw new Error("Control point index out of range");
      cp.splice(index * 2, 2);
    },

    getControlPointCount(): number {
      return cp.length / 2;
    },

    getDegree(): number {
      return cp.length / 2 - 1;
    },

    getSegment(t1: number, t2: number): BezierCurve {
      return newBezierCurve(getSegmentPoints(t1, t2));
    },

    translate(dx: number, dy: number): void {
      for (let i = 0; i < cp.length; i += 2) {
        cp[i] += dx;
        cp[i + 1] += dy;
      }
    },

    rotate(angle: number, ox: number = 0, oy: number = 0): void {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (let i = 0; i < cp.length; i += 2) {
        const x = cp[i] - ox;
        const y = cp[i + 1] - oy;
        cp[i] = x * cos - y * sin + ox;
        cp[i + 1] = x * sin + y * cos + oy;
      }
    },

    scale(s: number, ox: number = 0, oy: number = 0): void {
      for (let i = 0; i < cp.length; i += 2) {
        cp[i] = (cp[i] - ox) * s + ox;
        cp[i + 1] = (cp[i + 1] - oy) * s + oy;
      }
    },
  };

  return curve;
}
