// jove2d graphics batch module — SpriteBatch, Mesh, and their draw functions
// Extracted from graphics.ts to reduce file size; re-exported from graphics.ts.

import { ptr, read } from "bun:ffi";
import sdl from "../sdl/ffi.ts";
import {
  SDL_TEXTURE_ADDRESS_WRAP,
  SDL_TEXTURE_ADDRESS_CLAMP,
} from "../sdl/types.ts";
import type { SDLTexture } from "../sdl/types.ts";
import type { ParticleSystem } from "./particles.ts";
import {
  _getRenderer,
  _getDrawColor,
  _getEffectiveBlendModeSDL,
  _getPointSize,
  _transformPoint,
  _isIdentity,
} from "./graphics.ts";
import type { Image, Canvas, Quad } from "./graphics.ts";

// ============================================================
// SpriteBatch type
// ============================================================

const FLOATS_PER_SPRITE = 32; // 4 verts × 8 floats (SDL_Vertex: x,y,r,g,b,a,u,v)
const INDICES_PER_SPRITE = 6; // 2 triangles

export interface SpriteBatch {
  _isSpriteBatch: true;
  _texture: SDLTexture;
  add(quad: Quad, x?: number, y?: number, r?: number, sx?: number, sy?: number, ox?: number, oy?: number): number;
  add(x?: number, y?: number, r?: number, sx?: number, sy?: number, ox?: number, oy?: number): number;
  set(id: number, quad: Quad, x?: number, y?: number, r?: number, sx?: number, sy?: number, ox?: number, oy?: number): void;
  set(id: number, x?: number, y?: number, r?: number, sx?: number, sy?: number, ox?: number, oy?: number): void;
  clear(): void;
  flush(): void;
  getCount(): number;
  getBufferSize(): number;
  setBufferSize(size: number): void;
  getTexture(): Image;
  setTexture(image: Image): void;
  setColor(r: number, g: number, b: number, a?: number): void;
  setColor(): void;
  getColor(): [number, number, number, number] | null;
}

// Scratch buffer for transforming batch vertices at draw time
let _spriteBatchScratch = new Float32Array(0);

// ============================================================
// Mesh type
// ============================================================

export type MeshDrawMode = "fan" | "strip" | "triangles" | "points";

export interface Mesh {
  _isMesh: true;
  _texture: SDLTexture | null;
  setVertex(index: number, x: number, y: number, u?: number, v?: number, r?: number, g?: number, b?: number, a?: number): void;
  getVertex(index: number): [number, number, number, number, number, number, number, number];
  setVertices(vertices: Array<[number, number, number?, number?, number?, number?, number?, number?]>, startIndex?: number): void;
  setVertexMap(...indices: number[]): void;
  setVertexMapArray(map: number[]): void;
  getVertexMap(): number[] | null;
  setTexture(texture?: Image | Canvas | null): void;
  getTexture(): Image | Canvas | null;
  setDrawMode(mode: MeshDrawMode): void;
  getDrawMode(): MeshDrawMode;
  setDrawRange(start?: number, count?: number): void;
  getDrawRange(): [number, number] | null;
  setVertexAttribute(vertexIndex: number, attributeIndex: number, ...values: number[]): void;
  getVertexAttribute(vertexIndex: number, attributeIndex: number): number[];
  getVertexCount(): number;
  getVertexFormat(): Array<{ name: string; type: string; components: number }>;
  flush(): void;
  release(): void;
  /** @internal */
  _getDrawData(): { vertices: Float32Array; indices: Int32Array; numVerts: number; numIndices: number } | null;
}

// Scratch buffer for transforming mesh vertices at draw time
let _meshScratch = new Float32Array(0);

// ============================================================
// SpriteBatch creation
// ============================================================

// Buffers for SDL_GetTextureSize (local to this module)
const _texWBuf = new Float32Array(1);
const _texHBuf = new Float32Array(1);
const _texWPtr = ptr(_texWBuf);
const _texHPtr = ptr(_texHBuf);

/** Create a new SpriteBatch for batched rendering of sprites sharing one texture. */
export function newSpriteBatch(image: Image, maxSprites: number = 1000): SpriteBatch | null {
  if (!_getRenderer()) return null;

  let _image = image;
  let _capacity = maxSprites;
  let _vertexData = new Float32Array(_capacity * FLOATS_PER_SPRITE);
  let _indexData = _buildIndexPattern(_capacity);
  let _count = 0;
  let _batchColor: [number, number, number, number] | null = null;

  // Get texture dimensions for UV normalization
  sdl.SDL_GetTextureSize(_image._texture, _texWPtr, _texHPtr);
  let _texW = read.f32(_texWPtr, 0);
  let _texH = read.f32(_texHPtr, 0);

  function _refreshTexSize(): void {
    sdl.SDL_GetTextureSize(_image._texture, _texWPtr, _texHPtr);
    _texW = read.f32(_texWPtr, 0);
    _texH = read.f32(_texHPtr, 0);
  }

  function _buildSpriteVertices(
    spriteIndex: number,
    quad: Quad | null,
    x: number, y: number, r: number,
    sx: number, sy: number,
    ox: number, oy: number,
  ): void {
    // Source region
    let srcX: number, srcY: number, srcW: number, srcH: number;
    if (quad) {
      srcX = quad._x; srcY = quad._y; srcW = quad._w; srcH = quad._h;
    } else {
      srcX = 0; srcY = 0; srcW = _image._width; srcH = _image._height;
    }

    // UV coordinates (normalized 0-1)
    const u0 = srcX / _texW;
    const v0 = srcY / _texH;
    const u1 = (srcX + srcW) / _texW;
    const v1 = (srcY + srcH) / _texH;

    // Vertex color
    const cr = _batchColor ? _batchColor[0] / 255 : 1;
    const cg = _batchColor ? _batchColor[1] / 255 : 1;
    const cb = _batchColor ? _batchColor[2] / 255 : 1;
    const ca = _batchColor ? _batchColor[3] / 255 : 1;

    // 4 corners with origin offset
    const corners: [number, number][] = [
      [-ox, -oy],
      [srcW - ox, -oy],
      [srcW - ox, srcH - oy],
      [-ox, srcH - oy],
    ];

    const uvs: [number, number][] = [
      [u0, v0], [u1, v0], [u1, v1], [u0, v1],
    ];

    // Per-sprite transform (scale → rotate → translate), NO global _transform
    const cos = Math.cos(r);
    const sin = Math.sin(r);

    const base = spriteIndex * FLOATS_PER_SPRITE;
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = corners[i]!;
      const scx = cx * sx;
      const scy = cy * sy;
      const rx = scx * cos - scy * sin + x;
      const ry = scx * sin + scy * cos + y;

      const off = base + i * 8;
      _vertexData[off + 0] = rx;
      _vertexData[off + 1] = ry;
      _vertexData[off + 2] = cr;
      _vertexData[off + 3] = cg;
      _vertexData[off + 4] = cb;
      _vertexData[off + 5] = ca;
      _vertexData[off + 6] = uvs[i]![0];
      _vertexData[off + 7] = uvs[i]![1];
    }
  }

  function _grow(newCapacity: number): void {
    const newVerts = new Float32Array(newCapacity * FLOATS_PER_SPRITE);
    newVerts.set(_vertexData.subarray(0, _count * FLOATS_PER_SPRITE));
    _vertexData = newVerts;
    _indexData = _buildIndexPattern(newCapacity);
    _capacity = newCapacity;
  }

  function _parseArgs(args: any[]): { quad: Quad | null; x: number; y: number; r: number; sx: number; sy: number; ox: number; oy: number } {
    let quad: Quad | null = null;
    let offset = 0;
    if (args.length > 0 && typeof args[0] === "object" && args[0] !== null && "_x" in args[0]) {
      quad = args[0] as Quad;
      offset = 1;
    }
    const x = (args[offset] as number) ?? 0;
    const y = (args[offset + 1] as number) ?? 0;
    const r = (args[offset + 2] as number) ?? 0;
    const sx = (args[offset + 3] as number) ?? 1;
    const sy = (args[offset + 4] as number) ?? sx;
    const ox = (args[offset + 5] as number) ?? 0;
    const oy = (args[offset + 6] as number) ?? 0;
    return { quad, x, y, r, sx, sy, ox, oy };
  }

  const batch: SpriteBatch & { _getBuffers(): { vertexData: Float32Array; indexData: Int32Array } } = {
    _isSpriteBatch: true as const,
    get _texture() { return _image._texture; },

    _getBuffers() {
      return { vertexData: _vertexData, indexData: _indexData };
    },

    add(...args: any[]): number {
      if (_count >= _capacity) {
        _grow(_capacity * 2);
      }
      const { quad, x, y, r, sx, sy, ox, oy } = _parseArgs(args);
      _buildSpriteVertices(_count, quad, x, y, r, sx, sy, ox, oy);
      _count++;
      return _count; // 1-based ID
    },

    set(id: number, ...rest: any[]): void {
      const idx = id - 1; // convert 1-based to 0-based
      if (idx < 0 || idx >= _count) return;
      const { quad, x, y, r, sx, sy, ox, oy } = _parseArgs(rest);
      _buildSpriteVertices(idx, quad, x, y, r, sx, sy, ox, oy);
    },

    clear(): void {
      _count = 0;
    },

    flush(): void {
      // No-op — love2d uses this to flush to GPU, but our batch is CPU-side
    },

    getCount(): number {
      return _count;
    },

    getBufferSize(): number {
      return _capacity;
    },

    setBufferSize(size: number): void {
      if (size > _capacity) {
        _grow(size);
      } else if (size < _capacity) {
        if (_count > size) _count = size;
        const newVerts = new Float32Array(size * FLOATS_PER_SPRITE);
        newVerts.set(_vertexData.subarray(0, _count * FLOATS_PER_SPRITE));
        _vertexData = newVerts;
        _indexData = _buildIndexPattern(size);
        _capacity = size;
      }
    },

    getTexture(): Image {
      return _image;
    },

    setTexture(img: Image): void {
      _image = img;
      _refreshTexSize();
    },

    setColor(r?: number, g?: number, b?: number, a?: number): void {
      if (r === undefined) {
        _batchColor = null;
      } else {
        _batchColor = [r, g ?? 255, b ?? 255, a ?? 255];
      }
    },

    getColor(): [number, number, number, number] | null {
      return _batchColor ? [..._batchColor] as [number, number, number, number] : null;
    },
  };

  return batch;
}

// ============================================================
// Mesh creation
// ============================================================

// Floats per vertex: x, y, r, g, b, a, u, v = 8 (matches SDL_Vertex layout)
const MESH_FLOATS_PER_VERTEX = 8;

/**
 * Create a new Mesh for custom vertex geometry.
 * Overload 1: newMesh(vertexcount, mode?) — empty mesh with N vertices
 * Overload 2: newMesh(vertices, mode?) — mesh from vertex array
 */
export function newMesh(
  verticesOrCount: number | Array<[number, number, number?, number?, number?, number?, number?, number?]>,
  mode: MeshDrawMode = "fan",
): Mesh | null {
  if (!_getRenderer()) return null;

  let _vertexCount: number;
  let _vertexData: Float32Array;

  if (typeof verticesOrCount === "number") {
    _vertexCount = verticesOrCount;
    _vertexData = new Float32Array(_vertexCount * MESH_FLOATS_PER_VERTEX);
    // Default: position 0,0; UV 0,0; color white (1,1,1,1)
    for (let i = 0; i < _vertexCount; i++) {
      const base = i * MESH_FLOATS_PER_VERTEX;
      _vertexData[base + 2] = 1; // r
      _vertexData[base + 3] = 1; // g
      _vertexData[base + 4] = 1; // b
      _vertexData[base + 5] = 1; // a
    }
  } else {
    _vertexCount = verticesOrCount.length;
    _vertexData = new Float32Array(_vertexCount * MESH_FLOATS_PER_VERTEX);
    for (let i = 0; i < _vertexCount; i++) {
      const v = verticesOrCount[i];
      const base = i * MESH_FLOATS_PER_VERTEX;
      _vertexData[base + 0] = v![0]; // x
      _vertexData[base + 1] = v![1]; // y
      _vertexData[base + 2] = v![4] ?? 1; // r (love2d: index 4 = r)
      _vertexData[base + 3] = v![5] ?? 1; // g
      _vertexData[base + 4] = v![6] ?? 1; // b
      _vertexData[base + 5] = v![7] ?? 1; // a
      _vertexData[base + 6] = v![2] ?? 0; // u (love2d: index 2 = u)
      _vertexData[base + 7] = v![3] ?? 0; // v (love2d: index 3 = v)
    }
  }

  let _drawMode: MeshDrawMode = mode;
  let _vertexMap: number[] | null = null;
  let _textureImage: Image | Canvas | null = null;
  let _drawRangeStart: number | null = null;
  let _drawRangeCount: number | null = null;

  // Build indices for current draw mode + vertex map + draw range
  function _buildIndices(): Int32Array | null {
    // Determine the vertex sequence
    let sequence: number[];
    if (_vertexMap) {
      sequence = _vertexMap.map(i => i - 1); // love2d 1-based → 0-based
    } else {
      sequence = [];
      for (let i = 0; i < _vertexCount; i++) sequence.push(i);
    }

    // Apply draw range
    if (_drawRangeStart !== null && _drawRangeCount !== null) {
      const start = _drawRangeStart - 1; // love2d 1-based
      sequence = sequence.slice(start, start + _drawRangeCount);
    }

    const n = sequence.length;
    if (n < 1) return null;

    switch (_drawMode) {
      case "triangles": {
        if (n < 3) return null;
        const count = Math.floor(n / 3) * 3;
        const indices = new Int32Array(count);
        for (let i = 0; i < count; i++) indices[i] = sequence[i]!;
        return indices;
      }
      case "fan": {
        if (n < 3) return null;
        const triCount = n - 2;
        const indices = new Int32Array(triCount * 3);
        for (let i = 0; i < triCount; i++) {
          indices[i * 3 + 0] = sequence[0]!;
          indices[i * 3 + 1] = sequence[i + 1]!;
          indices[i * 3 + 2] = sequence[i + 2]!;
        }
        return indices;
      }
      case "strip": {
        if (n < 3) return null;
        const triCount = n - 2;
        const indices = new Int32Array(triCount * 3);
        for (let i = 0; i < triCount; i++) {
          if (i % 2 === 0) {
            indices[i * 3 + 0] = sequence[i]!;
            indices[i * 3 + 1] = sequence[i + 1]!;
            indices[i * 3 + 2] = sequence[i + 2]!;
          } else {
            indices[i * 3 + 0] = sequence[i + 1]!;
            indices[i * 3 + 1] = sequence[i]!;
            indices[i * 3 + 2] = sequence[i + 2]!;
          }
        }
        return indices;
      }
      case "points": {
        // Points mode: render each vertex as a small quad (2 triangles)
        // Returns null here — handled specially in _drawMesh
        return null;
      }
      default:
        return null;
    }
  }

  const mesh: Mesh = {
    _isMesh: true as const,
    get _texture() { return _textureImage?._texture ?? null; },

    setVertex(index: number, x: number, y: number, u?: number, v?: number, r?: number, g?: number, b?: number, a?: number) {
      const i = index - 1; // love2d 1-based
      if (i < 0 || i >= _vertexCount) return;
      const base = i * MESH_FLOATS_PER_VERTEX;
      _vertexData[base + 0] = x;
      _vertexData[base + 1] = y;
      _vertexData[base + 2] = r ?? 1;
      _vertexData[base + 3] = g ?? 1;
      _vertexData[base + 4] = b ?? 1;
      _vertexData[base + 5] = a ?? 1;
      _vertexData[base + 6] = u ?? 0;
      _vertexData[base + 7] = v ?? 0;
    },

    getVertex(index: number): [number, number, number, number, number, number, number, number] {
      const i = index - 1;
      if (i < 0 || i >= _vertexCount) return [0, 0, 0, 0, 1, 1, 1, 1];
      const base = i * MESH_FLOATS_PER_VERTEX;
      return [
        _vertexData[base + 0]!, // x
        _vertexData[base + 1]!, // y
        _vertexData[base + 6]!, // u (returned in love2d order)
        _vertexData[base + 7]!, // v
        _vertexData[base + 2]!, // r
        _vertexData[base + 3]!, // g
        _vertexData[base + 4]!, // b
        _vertexData[base + 5]!, // a
      ];
    },

    setVertices(vertices, startIndex = 1) {
      const start = startIndex - 1;
      for (let i = 0; i < vertices.length; i++) {
        const vi = start + i;
        if (vi >= _vertexCount) break;
        const v = vertices[i]!;
        const base = vi * MESH_FLOATS_PER_VERTEX;
        _vertexData[base + 0] = v[0]; // x
        _vertexData[base + 1] = v[1]; // y
        _vertexData[base + 2] = v[4] ?? 1; // r
        _vertexData[base + 3] = v[5] ?? 1; // g
        _vertexData[base + 4] = v[6] ?? 1; // b
        _vertexData[base + 5] = v[7] ?? 1; // a
        _vertexData[base + 6] = v[2] ?? 0; // u
        _vertexData[base + 7] = v[3] ?? 0; // v
      }
    },

    setVertexMap(...indices: number[]) {
      // Handle both variadic and single array arg
      if (indices.length === 1 && Array.isArray(indices[0])) {
        _vertexMap = (indices[0] as unknown as number[]).slice();
      } else {
        _vertexMap = indices.slice();
      }
    },

    setVertexMapArray(map: number[]) {
      _vertexMap = map.slice();
    },

    getVertexMap(): number[] | null {
      return _vertexMap ? _vertexMap.slice() : null;
    },

    setTexture(texture?: Image | Canvas | null) {
      _textureImage = texture ?? null;
    },

    getTexture(): Image | Canvas | null {
      return _textureImage;
    },

    setDrawMode(mode: MeshDrawMode) {
      _drawMode = mode;
    },

    getDrawMode(): MeshDrawMode {
      return _drawMode;
    },

    setDrawRange(start?: number, count?: number) {
      if (start === undefined) {
        _drawRangeStart = null;
        _drawRangeCount = null;
      } else {
        _drawRangeStart = start;
        _drawRangeCount = count ?? _vertexCount;
      }
    },

    getDrawRange(): [number, number] | null {
      if (_drawRangeStart === null) return null;
      return [_drawRangeStart, _drawRangeCount!];
    },

    setVertexAttribute(vertexIndex: number, attributeIndex: number, ...values: number[]) {
      const vi = vertexIndex - 1;
      if (vi < 0 || vi >= _vertexCount) return;
      const base = vi * MESH_FLOATS_PER_VERTEX;
      // Attribute 1: position (x,y) at offsets 0,1
      // Attribute 2: texcoord (u,v) at offsets 6,7
      // Attribute 3: color (r,g,b,a) at offsets 2,3,4,5
      const attrOffsets: number[][] = [
        [0, 1],       // VertexPosition
        [6, 7],       // VertexTexCoord
        [2, 3, 4, 5], // VertexColor
      ];
      const ai = attributeIndex - 1;
      if (ai < 0 || ai >= attrOffsets.length) return;
      const offsets = attrOffsets[ai];
      for (let i = 0; i < Math.min(values.length, offsets!.length); i++) {
        _vertexData[base + offsets![i]!] = values[i]!;
      }
    },

    getVertexAttribute(vertexIndex: number, attributeIndex: number): number[] {
      const vi = vertexIndex - 1;
      if (vi < 0 || vi >= _vertexCount) return [];
      const base = vi * MESH_FLOATS_PER_VERTEX;
      const attrOffsets: number[][] = [
        [0, 1],       // VertexPosition
        [6, 7],       // VertexTexCoord
        [2, 3, 4, 5], // VertexColor
      ];
      const ai = attributeIndex - 1;
      if (ai < 0 || ai >= attrOffsets.length) return [];
      return attrOffsets[ai]!.map(off => _vertexData[base + off]!) as number[];
    },

    getVertexCount(): number {
      return _vertexCount;
    },

    getVertexFormat() {
      return [
        { name: "VertexPosition", type: "float", components: 2 },
        { name: "VertexTexCoord", type: "float", components: 2 },
        { name: "VertexColor", type: "byte", components: 4 },
      ];
    },

    flush() {
      // No-op — we render directly from JS-side Float32Array each frame
    },

    release() {
      // Mesh doesn't own the texture, just clear references
      _textureImage = null;
      _vertexMap = null;
    },

    _getDrawData() {
      if (_vertexCount === 0) return null;
      if (_drawMode === "points") {
        // Build small quads for each point
        let sequence: number[];
        if (_vertexMap) {
          sequence = _vertexMap.map(i => i - 1);
        } else {
          sequence = [];
          for (let i = 0; i < _vertexCount; i++) sequence.push(i);
        }
        if (_drawRangeStart !== null && _drawRangeCount !== null) {
          const start = _drawRangeStart - 1;
          sequence = sequence.slice(start, start + _drawRangeCount);
        }
        const n = sequence.length;
        if (n === 0) return null;
        const ps = _getPointSize();
        const hp = ps / 2;
        const numVerts = n * 4;
        const numIndices = n * 6;
        const verts = new Float32Array(numVerts * MESH_FLOATS_PER_VERTEX);
        const idxs = new Int32Array(numIndices);
        for (let i = 0; i < n; i++) {
          const si = sequence[i]!;
          const srcBase = si * MESH_FLOATS_PER_VERTEX;
          const cx = _vertexData[srcBase + 0]!;
          const cy = _vertexData[srcBase + 1]!;
          const cr = _vertexData[srcBase + 2]!;
          const cg = _vertexData[srcBase + 3]!;
          const cb = _vertexData[srcBase + 4]!;
          const ca = _vertexData[srcBase + 5]!;
          const cu = _vertexData[srcBase + 6]!;
          const cv = _vertexData[srcBase + 7]!;
          // 4 corners of point quad
          const corners: [number, number][] = [
            [cx - hp, cy - hp], [cx + hp, cy - hp],
            [cx + hp, cy + hp], [cx - hp, cy + hp],
          ];
          for (let j = 0; j < 4; j++) {
            const dstBase = (i * 4 + j) * MESH_FLOATS_PER_VERTEX;
            verts[dstBase + 0] = corners[j]![0];
            verts[dstBase + 1] = corners[j]![1];
            verts[dstBase + 2] = cr;
            verts[dstBase + 3] = cg;
            verts[dstBase + 4] = cb;
            verts[dstBase + 5] = ca;
            verts[dstBase + 6] = cu;
            verts[dstBase + 7] = cv;
          }
          const bi = i * 4;
          const ii = i * 6;
          idxs[ii + 0] = bi; idxs[ii + 1] = bi + 1; idxs[ii + 2] = bi + 2;
          idxs[ii + 3] = bi; idxs[ii + 4] = bi + 2; idxs[ii + 5] = bi + 3;
        }
        return { vertices: verts, indices: idxs, numVerts, numIndices };
      }
      const indices = _buildIndices();
      if (!indices) return null;
      return { vertices: _vertexData, indices, numVerts: _vertexCount, numIndices: indices.length };
    },
  };

  return mesh;
}

// ============================================================
// Index pattern builder
// ============================================================

/** Build the repeating index pattern for N sprites: [0,1,2, 0,2,3, 4,5,6, 4,6,7, ...] */
function _buildIndexPattern(numSprites: number): Int32Array {
  const data = new Int32Array(numSprites * INDICES_PER_SPRITE);
  for (let i = 0; i < numSprites; i++) {
    const vi = i * 4;
    const ii = i * 6;
    data[ii + 0] = vi;
    data[ii + 1] = vi + 1;
    data[ii + 2] = vi + 2;
    data[ii + 3] = vi;
    data[ii + 4] = vi + 2;
    data[ii + 5] = vi + 3;
  }
  return data;
}

// ============================================================
// SpriteBatch drawing
// ============================================================

/** Render a SpriteBatch with optional batch-level transform and global transform. */
export function _drawSpriteBatch(
  batch: SpriteBatch,
  x: number, y: number, r: number,
  sx: number, sy: number,
  ox: number, oy: number,
): void {
  const renderer = _getRenderer();
  if (!renderer) return;

  // Access closure state via the batch interface
  const count = batch.getCount();
  if (count === 0) return;

  const numVerts = count * 4;
  const numIndices = count * INDICES_PER_SPRITE;
  const numFloats = count * FLOATS_PER_SPRITE;

  // Ensure scratch buffer is large enough
  if (_spriteBatchScratch.length < numFloats) {
    _spriteBatchScratch = new Float32Array(numFloats);
  }

  // Determine if we need batch-level transform
  const hasBatchTransform = x !== 0 || y !== 0 || r !== 0 || sx !== 1 || sy !== 1 || ox !== 0 || oy !== 0;
  const hasGlobalTransform = !_isIdentity();

  const buffers = (batch as any)._getBuffers();
  const vertexData: Float32Array = buffers.vertexData;
  const indexData: Int32Array = buffers.indexData;

  if (!hasBatchTransform && !hasGlobalTransform) {
    // Fast path: no transforms needed, render directly
    const [cr, cg, cb, ca] = _getDrawColor();
    sdl.SDL_SetTextureColorModFloat(batch._texture, cr / 255, cg / 255, cb / 255);
    sdl.SDL_SetTextureAlphaModFloat(batch._texture, ca / 255);
    sdl.SDL_RenderGeometry(
      renderer, batch._texture,
      ptr(vertexData), numVerts,
      ptr(indexData), numIndices,
    );
    return;
  }

  // Batch-level transform: origin → scale → rotate → translate
  const bcos = Math.cos(r);
  const bsin = Math.sin(r);

  for (let i = 0; i < numVerts; i++) {
    const srcOff = i * 8;
    const dstOff = i * 8;

    let vx = vertexData[srcOff + 0]!;
    let vy = vertexData[srcOff + 1]!;

    if (hasBatchTransform) {
      // Apply batch-level transform: origin → scale → rotate → translate
      vx -= ox;
      vy -= oy;
      const scx = vx * sx;
      const scy = vy * sy;
      vx = scx * bcos - scy * bsin + x;
      vy = scx * bsin + scy * bcos + y;
    }

    if (hasGlobalTransform) {
      const [tx, ty] = _transformPoint(vx, vy);
      vx = tx;
      vy = ty;
    }

    _spriteBatchScratch[dstOff + 0] = vx;
    _spriteBatchScratch[dstOff + 1] = vy;
    // Copy color + UV unchanged
    _spriteBatchScratch[dstOff + 2] = vertexData[srcOff + 2]!;
    _spriteBatchScratch[dstOff + 3] = vertexData[srcOff + 3]!;
    _spriteBatchScratch[dstOff + 4] = vertexData[srcOff + 4]!;
    _spriteBatchScratch[dstOff + 5] = vertexData[srcOff + 5]!;
    _spriteBatchScratch[dstOff + 6] = vertexData[srcOff + 6]!;
    _spriteBatchScratch[dstOff + 7] = vertexData[srcOff + 7]!;
  }

  // Apply draw color modulation
  const [cr, cg, cb, ca] = _getDrawColor();
  sdl.SDL_SetTextureColorModFloat(batch._texture, cr / 255, cg / 255, cb / 255);
  sdl.SDL_SetTextureAlphaModFloat(batch._texture, ca / 255);

  // Call ptr() fresh for each render (bun:ffi caveat — JS wrote to scratch)
  sdl.SDL_RenderGeometry(
    renderer, batch._texture,
    ptr(_spriteBatchScratch), numVerts,
    ptr(indexData), numIndices,
  );
}

// ============================================================
// ParticleSystem drawing
// ============================================================

// Scratch buffer for transforming particle vertices at draw time
let _particleScratch = new Float32Array(0);

/** Render a ParticleSystem with optional draw-level transform and global transform. */
export function _drawParticleSystem(
  ps: ParticleSystem,
  x: number, y: number, r: number,
  sx: number, sy: number,
  ox: number, oy: number,
): void {
  const renderer = _getRenderer();
  if (!renderer) return;

  const data = ps._getVertexData();
  if (!data) return;

  const { vertices, indices, numVerts, numIndices } = data;
  const numFloats = numVerts * 8;

  const hasDrawTransform = x !== 0 || y !== 0 || r !== 0 || sx !== 1 || sy !== 1 || ox !== 0 || oy !== 0;
  const hasGlobalTransform = !_isIdentity();

  if (!hasDrawTransform && !hasGlobalTransform) {
    // Fast path: no transforms, render directly
    const [cr, cg, cb, ca] = _getDrawColor();
    sdl.SDL_SetTextureColorModFloat(ps._texture, cr / 255, cg / 255, cb / 255);
    sdl.SDL_SetTextureAlphaModFloat(ps._texture, ca / 255);
    sdl.SDL_RenderGeometry(
      renderer, ps._texture,
      ptr(vertices), numVerts,
      ptr(indices), numIndices,
    );
    return;
  }

  // Ensure scratch buffer is large enough
  if (_particleScratch.length < numFloats) {
    _particleScratch = new Float32Array(numFloats);
  }

  const dcos = Math.cos(r);
  const dsin = Math.sin(r);

  for (let i = 0; i < numVerts; i++) {
    const srcOff = i * 8;
    const dstOff = i * 8;

    let vx = vertices[srcOff + 0]!;
    let vy = vertices[srcOff + 1]!;

    if (hasDrawTransform) {
      vx -= ox;
      vy -= oy;
      const scx = vx * sx;
      const scy = vy * sy;
      vx = scx * dcos - scy * dsin + x;
      vy = scx * dsin + scy * dcos + y;
    }

    if (hasGlobalTransform) {
      const [tx, ty] = _transformPoint(vx, vy);
      vx = tx;
      vy = ty;
    }

    _particleScratch[dstOff + 0] = vx;
    _particleScratch[dstOff + 1] = vy;
    // Copy color + UV unchanged
    _particleScratch[dstOff + 2] = vertices[srcOff + 2]!;
    _particleScratch[dstOff + 3] = vertices[srcOff + 3]!;
    _particleScratch[dstOff + 4] = vertices[srcOff + 4]!;
    _particleScratch[dstOff + 5] = vertices[srcOff + 5]!;
    _particleScratch[dstOff + 6] = vertices[srcOff + 6]!;
    _particleScratch[dstOff + 7] = vertices[srcOff + 7]!;
  }

  const [cr, cg, cb, ca] = _getDrawColor();
  sdl.SDL_SetTextureColorModFloat(ps._texture, cr / 255, cg / 255, cb / 255);
  sdl.SDL_SetTextureAlphaModFloat(ps._texture, ca / 255);

  // Call ptr() fresh for each render (bun:ffi caveat — JS wrote to scratch)
  sdl.SDL_RenderGeometry(
    renderer, ps._texture,
    ptr(_particleScratch), numVerts,
    ptr(indices), numIndices,
  );
}

// ============================================================
// Mesh drawing
// ============================================================

export function _drawMesh(
  mesh: Mesh,
  x: number, y: number, r: number,
  sx: number, sy: number,
  ox: number, oy: number,
): void {
  const renderer = _getRenderer();
  if (!renderer) return;

  const data = mesh._getDrawData();
  if (!data) return;

  const { vertices, indices, numVerts, numIndices } = data;
  const numFloats = numVerts * MESH_FLOATS_PER_VERTEX;

  const hasDrawTransform = x !== 0 || y !== 0 || r !== 0 || sx !== 1 || sy !== 1 || ox !== 0 || oy !== 0;
  const hasGlobalTransform = !_isIdentity();

  const texture = mesh._texture;

  // Apply wrap mode from the mesh's texture image
  const texImg = mesh.getTexture();
  if (texImg && "_wrapH" in texImg) {
    const u = texImg._wrapH === "repeat" ? SDL_TEXTURE_ADDRESS_WRAP : SDL_TEXTURE_ADDRESS_CLAMP;
    const v = texImg._wrapV === "repeat" ? SDL_TEXTURE_ADDRESS_WRAP : SDL_TEXTURE_ADDRESS_CLAMP;
    sdl.SDL_SetRenderTextureAddressMode(renderer, u, v);
  }

  if (!hasDrawTransform && !hasGlobalTransform) {
    // Fast path: no transforms, render directly
    if (texture) {
      const [cr, cg, cb, ca] = _getDrawColor();
      sdl.SDL_SetTextureColorModFloat(texture, cr / 255, cg / 255, cb / 255);
      sdl.SDL_SetTextureAlphaModFloat(texture, ca / 255);
      sdl.SDL_SetTextureBlendMode(texture, _getEffectiveBlendModeSDL());
    }
    sdl.SDL_RenderGeometry(
      renderer, texture,
      ptr(vertices), numVerts,
      ptr(indices), numIndices,
    );
    return;
  }

  // Slow path: transform vertices
  if (_meshScratch.length < numFloats) {
    _meshScratch = new Float32Array(numFloats);
  }

  const dcos = Math.cos(r);
  const dsin = Math.sin(r);

  for (let i = 0; i < numVerts; i++) {
    const srcOff = i * MESH_FLOATS_PER_VERTEX;
    const dstOff = i * MESH_FLOATS_PER_VERTEX;

    let vx = vertices[srcOff + 0]!;
    let vy = vertices[srcOff + 1]!;

    if (hasDrawTransform) {
      vx -= ox;
      vy -= oy;
      const scx = vx * sx;
      const scy = vy * sy;
      vx = scx * dcos - scy * dsin + x;
      vy = scx * dsin + scy * dcos + y;
    }

    if (hasGlobalTransform) {
      const [tx, ty] = _transformPoint(vx, vy);
      vx = tx;
      vy = ty;
    }

    _meshScratch[dstOff + 0] = vx;
    _meshScratch[dstOff + 1] = vy;
    // Copy color + UV unchanged
    _meshScratch[dstOff + 2] = vertices[srcOff + 2]!;
    _meshScratch[dstOff + 3] = vertices[srcOff + 3]!;
    _meshScratch[dstOff + 4] = vertices[srcOff + 4]!;
    _meshScratch[dstOff + 5] = vertices[srcOff + 5]!;
    _meshScratch[dstOff + 6] = vertices[srcOff + 6]!;
    _meshScratch[dstOff + 7] = vertices[srcOff + 7]!;
  }

  if (texture) {
    const [cr, cg, cb, ca] = _getDrawColor();
    sdl.SDL_SetTextureColorModFloat(texture, cr / 255, cg / 255, cb / 255);
    sdl.SDL_SetTextureAlphaModFloat(texture, ca / 255);
    sdl.SDL_SetTextureBlendMode(texture, _getEffectiveBlendModeSDL());
  }

  sdl.SDL_RenderGeometry(
    renderer, texture,
    ptr(_meshScratch), numVerts,
    ptr(indices), numIndices,
  );
}
