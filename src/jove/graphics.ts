// jove2d graphics module — renderer lifecycle, drawing primitives, transform stack,
// image loading, canvases, blend modes, scissor, and screenshot capture

import { ptr, read, toArrayBuffer } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import { resolve } from "path";
import sdl from "../sdl/ffi.ts";
import { loadTTF } from "../sdl/ffi_ttf.ts";
import { loadImage } from "../sdl/ffi_image.ts";
import { _createFont } from "./font.ts";
import type { Font } from "./font.ts";
import {
  SDL_SURFACE_OFFSET_W,
  SDL_SURFACE_OFFSET_H,
  SDL_SURFACE_OFFSET_PITCH,
  SDL_SURFACE_OFFSET_PIXELS,
  SDL_SURFACE_OFFSET_FORMAT,
  SDL_BLENDMODE_NONE,
  SDL_BLENDMODE_BLEND,
  SDL_BLENDMODE_ADD,
  SDL_BLENDMODE_MOD,
  SDL_BLENDMODE_MUL,
  SDL_FLIP_NONE,
  SDL_TEXTUREACCESS_TARGET,
  SDL_PIXELFORMAT_RGBA8888,
  SDL_SCALEMODE_NEAREST,
  SDL_SCALEMODE_LINEAR,
  SDL_GPU_SHADERFORMAT_SPIRV,
} from "../sdl/types.ts";
import type { SDLRenderer, SDLTexture } from "../sdl/types.ts";
import { _getSDLWindow, getMode } from "./window.ts";
import type { ImageData as BaseImageData } from "./types.ts";
import type { ImageData as RichImageData } from "./image.ts";
import type { Transform } from "./math.ts";
import type { Shader } from "./shader.ts";
import { createShader } from "./shader.ts";
import type { ParticleSystem } from "./particles.ts";
import { createParticleSystem } from "./particles.ts";

export type FilterMode = "nearest" | "linear";

// ============================================================
// Internal renderer state
// ============================================================

let _renderer: SDLRenderer | null = null;
let _gpuDevice: Pointer | null = null;
let _activeShader: Shader | null = null;
let _bgColor: [number, number, number, number] = [0, 0, 0, 255];
let _drawColor: [number, number, number, number] = [255, 255, 255, 255];
let _lineWidth = 1;
let _pointSize = 1;

type LineStyle = "rough" | "smooth";
let _lineStyle: LineStyle = "rough";

// Default texture filter mode (applied to new images/canvases)
let _defaultFilterMin: FilterMode = "nearest";
let _defaultFilterMag: FilterMode = "nearest";

// Color write mask (JS-side only — no SDL3 API available)
let _colorMask: [boolean, boolean, boolean, boolean] = [true, true, true, true];

// Blend mode name mapping
type BlendModeName = "alpha" | "add" | "multiply" | "replace" | "screen";
let _blendMode: BlendModeName = "alpha";

const BLEND_NAME_TO_SDL: Record<BlendModeName, number> = {
  alpha: SDL_BLENDMODE_BLEND,
  add: SDL_BLENDMODE_ADD,
  multiply: SDL_BLENDMODE_MUL,
  replace: SDL_BLENDMODE_NONE,
  screen: SDL_BLENDMODE_MOD,
};

// SDL_image state
let _img: ReturnType<typeof loadImage> = null;

// TTF state
let _ttf: ReturnType<typeof loadTTF> = null;
let _ttfEngine: Pointer | null = null;
let _defaultFont: Font | null = null;
let _currentFont: Font | null = null;

// Default font path (Vera.ttf bundled with jove2d)
const _defaultFontPath = resolve(import.meta.dir, "../../assets/Vera.ttf");
const _defaultFontSize = 12;

// Reusable SDL_FRect buffer (x, y, w, h as f32).
const _rectBuf = new Float32Array(4);

// Reusable SDL_Rect (int32) buffer for scissor
const _scissorBuf = new Int32Array(4);

// Scissor state
let _scissorEnabled = false;
let _scissor: [number, number, number, number] | null = null;

// Stencil state (canvas-based simulation)
export type CompareMode = "greater" | "gequal" | "equal" | "notequal" | "less" | "lequal" | "always" | "never";
export type StencilAction = "replace" | "increment" | "decrement" | "incrementwrap" | "decrementwrap" | "invert";

let _stencilCanvas: Canvas | null = null;        // normal: white inside mask, transparent outside
let _stencilInvCanvas: Canvas | null = null;      // inverted: created lazily only when needed
let _stencilContentCanvas: Canvas | null = null;
let _stencilCompare: CompareMode | null = null;
let _stencilValue: number = 0;
let _stencilOrigCanvas: Canvas | null = null;
let _stencilActive = false;
let _stencilPendingFn: (() => void) | null = null; // stored for lazy inverted canvas
let _stencilPendingKeep = false;

/** SDL_PixelFormat enum → string mapping (common formats) */
const PIXEL_FORMAT_NAMES: Record<number, string> = {
  0x16161804: "xrgb8888",
  0x16261804: "xbgr8888",
  0x16362004: "rgba8888",
  0x16462004: "abgr8888",
  0x16762004: "bgra8888",
  0x16862004: "argb8888",
};

// ============================================================
// Transform stack
// ============================================================

// 2D affine transform: [a, b, c, d, tx, ty]
// x' = a*x + c*y + tx
// y' = b*x + d*y + ty
type Matrix = [number, number, number, number, number, number];

let _transform: Matrix = [1, 0, 0, 1, 0, 0];
const _transformStack: Matrix[] = [];

function _transformPoint(x: number, y: number): [number, number] {
  const [a, b, c, d, tx, ty] = _transform;
  return [a * x + c * y + tx, b * x + d * y + ty];
}

function _isIdentity(): boolean {
  const [a, b, c, d, tx, ty] = _transform;
  return a === 1 && b === 0 && c === 0 && d === 1 && tx === 0 && ty === 0;
}

/** Push the current transform state onto the stack. */
export function push(): void {
  _transformStack.push([..._transform] as Matrix);
}

/** Pop the transform state from the stack. */
export function pop(): void {
  const prev = _transformStack.pop();
  if (prev) {
    _transform = prev;
  }
}

/** Apply a translation. */
export function translate(dx: number, dy: number): void {
  const [a, b, c, d, tx, ty] = _transform;
  _transform[4] = a * dx + c * dy + tx;
  _transform[5] = b * dx + d * dy + ty;
}

/** Apply a rotation (radians). */
export function rotate(angle: number): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const [a, b, c, d] = _transform;
  _transform[0] = a * cos + c * sin;
  _transform[1] = b * cos + d * sin;
  _transform[2] = a * -sin + c * cos;
  _transform[3] = b * -sin + d * cos;
}

/** Apply a scale. */
export function scale(sx: number, sy?: number): void {
  const _sy = sy ?? sx;
  _transform[0] *= sx;
  _transform[1] *= sx;
  _transform[2] *= _sy;
  _transform[3] *= _sy;
}

/** Apply a shear. */
export function shear(kx: number, ky: number): void {
  const [a, b, c, d] = _transform;
  _transform[0] = a + c * ky;
  _transform[1] = b + d * ky;
  _transform[2] = a * kx + c;
  _transform[3] = b * kx + d;
}

/** Reset the transform to identity. */
export function origin(): void {
  _transform = [1, 0, 0, 1, 0, 0];
}

/** Multiply the current transform by a Transform object's matrix. */
export function applyTransform(transform: Transform): void {
  const [a1, b1, c1, d1, tx1, ty1] = _transform;
  const [a2, b2, c2, d2, tx2, ty2] = transform.getMatrix();
  _transform[0] = a1 * a2 + c1 * b2;
  _transform[1] = b1 * a2 + d1 * b2;
  _transform[2] = a1 * c2 + c1 * d2;
  _transform[3] = b1 * c2 + d1 * d2;
  _transform[4] = a1 * tx2 + c1 * ty2 + tx1;
  _transform[5] = b1 * tx2 + d1 * ty2 + ty1;
}

/** Replace the current transform with a Transform object's matrix. */
export function replaceTransform(transform: Transform): void {
  const [a, b, c, d, tx, ty] = transform.getMatrix();
  _transform[0] = a;
  _transform[1] = b;
  _transform[2] = c;
  _transform[3] = d;
  _transform[4] = tx;
  _transform[5] = ty;
}

// ============================================================
// Image type
// ============================================================

export interface Image {
  _texture: SDLTexture;
  _width: number;
  _height: number;
  getWidth(): number;
  getHeight(): number;
  getDimensions(): [number, number];
  setFilter(min: FilterMode, mag: FilterMode): void;
  getFilter(): [FilterMode, FilterMode];
  release(): void;
}

function _createImageObject(texture: SDLTexture, w: number, h: number): Image {
  let _filterMin: FilterMode = "nearest";
  let _filterMag: FilterMode = "nearest";

  return {
    _texture: texture,
    _width: w,
    _height: h,
    getWidth() { return w; },
    getHeight() { return h; },
    getDimensions() { return [w, h]; },
    setFilter(min: FilterMode, mag: FilterMode) {
      _filterMin = min;
      _filterMag = mag;
      // Use the mag filter for the SDL scale mode (SDL doesn't distinguish min/mag)
      const mode = mag === "linear" ? SDL_SCALEMODE_LINEAR : SDL_SCALEMODE_NEAREST;
      sdl.SDL_SetTextureScaleMode(texture, mode);
    },
    getFilter() { return [_filterMin, _filterMag]; },
    release() {
      sdl.SDL_DestroyTexture(texture);
    },
  };
}

// ============================================================
// Quad type
// ============================================================

export interface Quad {
  _x: number;
  _y: number;
  _w: number;
  _h: number;
  _sw: number;
  _sh: number;
  getViewport(): [number, number, number, number];
  setViewport(x: number, y: number, w: number, h: number): void;
}

/** Create a new Quad for sprite sheet regions. */
export function newQuad(x: number, y: number, w: number, h: number, sw: number, sh: number): Quad {
  return {
    _x: x, _y: y, _w: w, _h: h, _sw: sw, _sh: sh,
    getViewport() { return [this._x, this._y, this._w, this._h]; },
    setViewport(nx: number, ny: number, nw: number, nh: number) {
      this._x = nx; this._y = ny; this._w = nw; this._h = nh;
    },
  };
}

// ============================================================
// Canvas type (off-screen render target)
// ============================================================

export interface Canvas extends Image {
  _isCanvas: true;
}

// ============================================================
// Text type (cached text object — love.graphics.newText)
// ============================================================

export interface Text {
  _isText: true;
  _texture: SDLTexture;
  _width: number;
  _height: number;
  set(text: string): void;
  setf(text: string, wraplimit: number, align?: "left" | "center" | "right"): void;
  add(text: string, x?: number, y?: number): number;
  addf(text: string, wraplimit: number, align: "left" | "center" | "right", x?: number, y?: number): number;
  clear(): void;
  getWidth(): number;
  getHeight(): number;
  getDimensions(): [number, number];
  getFont(): Font;
  setFont(font: Font): void;
  release(): void;
  /** @internal — re-render to canvas if dirty */
  _flush(): void;
}

interface TextSegment {
  text: string;
  color: [number, number, number, number];
  x: number;
  y: number;
  wrapLimit: number; // 0 = no wrap
  align: "left" | "center" | "right";
}

let _activeCanvas: Canvas | null = null;

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

/** Create a new off-screen canvas (render target). */
export function newCanvas(w: number, h: number): Canvas | null {
  if (!_renderer) return null;
  const texture = sdl.SDL_CreateTexture(
    _renderer, SDL_PIXELFORMAT_RGBA8888, SDL_TEXTUREACCESS_TARGET, w, h
  ) as SDLTexture | null;
  if (!texture) return null;

  sdl.SDL_SetTextureBlendMode(texture, SDL_BLENDMODE_BLEND);

  const base = _createImageObject(texture, w, h);
  base.setFilter(_defaultFilterMin, _defaultFilterMag);
  return {
    ...base,
    _isCanvas: true as const,
  };
}

/** Set the active canvas (render target). Pass null to render to screen. */
export function setCanvas(canvas: Canvas | null): void {
  if (!_renderer) return;
  _activeCanvas = canvas;
  _statCanvasSwitches++;
  sdl.SDL_SetRenderTarget(_renderer, canvas ? canvas._texture : null);
}

/** Get the active canvas (null = rendering to screen). */
export function getCanvas(): Canvas | null {
  return _activeCanvas;
}

// ============================================================
// SpriteBatch creation
// ============================================================

/** Create a new SpriteBatch for batched rendering of sprites sharing one texture. */
export function newSpriteBatch(image: Image, maxSprites: number = 1000): SpriteBatch | null {
  if (!_renderer) return null;

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
      const [cx, cy] = corners[i];
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
      _vertexData[off + 6] = uvs[i][0];
      _vertexData[off + 7] = uvs[i][1];
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
  if (!_renderer) return null;

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
      _vertexData[base + 0] = v[0]; // x
      _vertexData[base + 1] = v[1]; // y
      _vertexData[base + 2] = v[4] ?? 1; // r (love2d: index 4 = r)
      _vertexData[base + 3] = v[5] ?? 1; // g
      _vertexData[base + 4] = v[6] ?? 1; // b
      _vertexData[base + 5] = v[7] ?? 1; // a
      _vertexData[base + 6] = v[2] ?? 0; // u (love2d: index 2 = u)
      _vertexData[base + 7] = v[3] ?? 0; // v (love2d: index 3 = v)
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
        for (let i = 0; i < count; i++) indices[i] = sequence[i];
        return indices;
      }
      case "fan": {
        if (n < 3) return null;
        const triCount = n - 2;
        const indices = new Int32Array(triCount * 3);
        for (let i = 0; i < triCount; i++) {
          indices[i * 3 + 0] = sequence[0];
          indices[i * 3 + 1] = sequence[i + 1];
          indices[i * 3 + 2] = sequence[i + 2];
        }
        return indices;
      }
      case "strip": {
        if (n < 3) return null;
        const triCount = n - 2;
        const indices = new Int32Array(triCount * 3);
        for (let i = 0; i < triCount; i++) {
          if (i % 2 === 0) {
            indices[i * 3 + 0] = sequence[i];
            indices[i * 3 + 1] = sequence[i + 1];
            indices[i * 3 + 2] = sequence[i + 2];
          } else {
            indices[i * 3 + 0] = sequence[i + 1];
            indices[i * 3 + 1] = sequence[i];
            indices[i * 3 + 2] = sequence[i + 2];
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
        _vertexData[base + 0], // x
        _vertexData[base + 1], // y
        _vertexData[base + 6], // u (returned in love2d order)
        _vertexData[base + 7], // v
        _vertexData[base + 2], // r
        _vertexData[base + 3], // g
        _vertexData[base + 4], // b
        _vertexData[base + 5], // a
      ];
    },

    setVertices(vertices, startIndex = 1) {
      const start = startIndex - 1;
      for (let i = 0; i < vertices.length; i++) {
        const vi = start + i;
        if (vi >= _vertexCount) break;
        const v = vertices[i];
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
      for (let i = 0; i < Math.min(values.length, offsets.length); i++) {
        _vertexData[base + offsets[i]] = values[i];
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
      return attrOffsets[ai].map(off => _vertexData[base + off]);
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
        const ps = _pointSize;
        const hp = ps / 2;
        const numVerts = n * 4;
        const numIndices = n * 6;
        const verts = new Float32Array(numVerts * MESH_FLOATS_PER_VERTEX);
        const idxs = new Int32Array(numIndices);
        for (let i = 0; i < n; i++) {
          const si = sequence[i];
          const srcBase = si * MESH_FLOATS_PER_VERTEX;
          const cx = _vertexData[srcBase + 0];
          const cy = _vertexData[srcBase + 1];
          const cr = _vertexData[srcBase + 2];
          const cg = _vertexData[srcBase + 3];
          const cb = _vertexData[srcBase + 4];
          const ca = _vertexData[srcBase + 5];
          const cu = _vertexData[srcBase + 6];
          const cv = _vertexData[srcBase + 7];
          // 4 corners of point quad
          const corners: [number, number][] = [
            [cx - hp, cy - hp], [cx + hp, cy - hp],
            [cx + hp, cy + hp], [cx - hp, cy + hp],
          ];
          for (let j = 0; j < 4; j++) {
            const dstBase = (i * 4 + j) * MESH_FLOATS_PER_VERTEX;
            verts[dstBase + 0] = corners[j][0];
            verts[dstBase + 1] = corners[j][1];
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

/** Create a new ParticleSystem for particle effects. */
export function newParticleSystem(image: Image, maxParticles: number = 1000): ParticleSystem | null {
  if (!_renderer) return null;
  return createParticleSystem(image, maxParticles);
}

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

/** Render a SpriteBatch with optional batch-level transform and global transform. */
function _drawSpriteBatch(
  batch: SpriteBatch,
  x: number, y: number, r: number,
  sx: number, sy: number,
  ox: number, oy: number,
): void {
  if (!_renderer) return;

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

  // We need to read from the batch's internal vertex data.
  // Since SpriteBatch is a closure, we access _vertexData through
  // the fact that it was created by newSpriteBatch — we'll use a cast
  // to access the internal buffer via a helper.
  // Actually, we need to expose the internal buffers. Let's add them
  // to the interface as internal properties.

  // For now, we need to get at the raw vertex/index data.
  // We'll use the batch object which has these as closure vars.
  // The simplest approach: add _getBuffers() to the batch.
  const buffers = (batch as any)._getBuffers();
  const vertexData: Float32Array = buffers.vertexData;
  const indexData: Int32Array = buffers.indexData;

  if (!hasBatchTransform && !hasGlobalTransform) {
    // Fast path: no transforms needed, render directly
    const [cr, cg, cb, ca] = _drawColor;
    sdl.SDL_SetTextureColorModFloat(batch._texture, cr / 255, cg / 255, cb / 255);
    sdl.SDL_SetTextureAlphaModFloat(batch._texture, ca / 255);
    sdl.SDL_RenderGeometry(
      _renderer, batch._texture,
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

    let vx = vertexData[srcOff + 0];
    let vy = vertexData[srcOff + 1];

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
    _spriteBatchScratch[dstOff + 2] = vertexData[srcOff + 2];
    _spriteBatchScratch[dstOff + 3] = vertexData[srcOff + 3];
    _spriteBatchScratch[dstOff + 4] = vertexData[srcOff + 4];
    _spriteBatchScratch[dstOff + 5] = vertexData[srcOff + 5];
    _spriteBatchScratch[dstOff + 6] = vertexData[srcOff + 6];
    _spriteBatchScratch[dstOff + 7] = vertexData[srcOff + 7];
  }

  // Apply draw color modulation
  const [cr, cg, cb, ca] = _drawColor;
  sdl.SDL_SetTextureColorModFloat(batch._texture, cr / 255, cg / 255, cb / 255);
  sdl.SDL_SetTextureAlphaModFloat(batch._texture, ca / 255);

  // Call ptr() fresh for each render (bun:ffi caveat — JS wrote to scratch)
  sdl.SDL_RenderGeometry(
    _renderer, batch._texture,
    ptr(_spriteBatchScratch), numVerts,
    ptr(indexData), numIndices,
  );
}

// Scratch buffer for transforming particle vertices at draw time
let _particleScratch = new Float32Array(0);

/** Render a ParticleSystem with optional draw-level transform and global transform. */
function _drawParticleSystem(
  ps: ParticleSystem,
  x: number, y: number, r: number,
  sx: number, sy: number,
  ox: number, oy: number,
): void {
  if (!_renderer) return;

  const data = ps._getVertexData();
  if (!data) return;

  const { vertices, indices, numVerts, numIndices } = data;
  const numFloats = numVerts * 8;

  const hasDrawTransform = x !== 0 || y !== 0 || r !== 0 || sx !== 1 || sy !== 1 || ox !== 0 || oy !== 0;
  const hasGlobalTransform = !_isIdentity();

  if (!hasDrawTransform && !hasGlobalTransform) {
    // Fast path: no transforms, render directly
    const [cr, cg, cb, ca] = _drawColor;
    sdl.SDL_SetTextureColorModFloat(ps._texture, cr / 255, cg / 255, cb / 255);
    sdl.SDL_SetTextureAlphaModFloat(ps._texture, ca / 255);
    sdl.SDL_RenderGeometry(
      _renderer, ps._texture,
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

    let vx = vertices[srcOff + 0];
    let vy = vertices[srcOff + 1];

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
    _particleScratch[dstOff + 2] = vertices[srcOff + 2];
    _particleScratch[dstOff + 3] = vertices[srcOff + 3];
    _particleScratch[dstOff + 4] = vertices[srcOff + 4];
    _particleScratch[dstOff + 5] = vertices[srcOff + 5];
    _particleScratch[dstOff + 6] = vertices[srcOff + 6];
    _particleScratch[dstOff + 7] = vertices[srcOff + 7];
  }

  const [cr, cg, cb, ca] = _drawColor;
  sdl.SDL_SetTextureColorModFloat(ps._texture, cr / 255, cg / 255, cb / 255);
  sdl.SDL_SetTextureAlphaModFloat(ps._texture, ca / 255);

  // Call ptr() fresh for each render (bun:ffi caveat — JS wrote to scratch)
  sdl.SDL_RenderGeometry(
    _renderer, ps._texture,
    ptr(_particleScratch), numVerts,
    ptr(indices), numIndices,
  );
}

// ============================================================
// Mesh drawing
// ============================================================

function _drawMesh(
  mesh: Mesh,
  x: number, y: number, r: number,
  sx: number, sy: number,
  ox: number, oy: number,
): void {
  if (!_renderer) return;

  const data = mesh._getDrawData();
  if (!data) return;

  const { vertices, indices, numVerts, numIndices } = data;
  const numFloats = numVerts * MESH_FLOATS_PER_VERTEX;

  const hasDrawTransform = x !== 0 || y !== 0 || r !== 0 || sx !== 1 || sy !== 1 || ox !== 0 || oy !== 0;
  const hasGlobalTransform = !_isIdentity();

  const texture = mesh._texture;

  if (!hasDrawTransform && !hasGlobalTransform) {
    // Fast path: no transforms, render directly
    if (texture) {
      const [cr, cg, cb, ca] = _drawColor;
      sdl.SDL_SetTextureColorModFloat(texture, cr / 255, cg / 255, cb / 255);
      sdl.SDL_SetTextureAlphaModFloat(texture, ca / 255);
      sdl.SDL_SetTextureBlendMode(texture, BLEND_NAME_TO_SDL[_blendMode] ?? SDL_BLENDMODE_BLEND);
    }
    sdl.SDL_RenderGeometry(
      _renderer, texture,
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

    let vx = vertices[srcOff + 0];
    let vy = vertices[srcOff + 1];

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
    _meshScratch[dstOff + 2] = vertices[srcOff + 2];
    _meshScratch[dstOff + 3] = vertices[srcOff + 3];
    _meshScratch[dstOff + 4] = vertices[srcOff + 4];
    _meshScratch[dstOff + 5] = vertices[srcOff + 5];
    _meshScratch[dstOff + 6] = vertices[srcOff + 6];
    _meshScratch[dstOff + 7] = vertices[srcOff + 7];
  }

  if (texture) {
    const [cr, cg, cb, ca] = _drawColor;
    sdl.SDL_SetTextureColorModFloat(texture, cr / 255, cg / 255, cb / 255);
    sdl.SDL_SetTextureAlphaModFloat(texture, ca / 255);
    sdl.SDL_SetTextureBlendMode(texture, BLEND_NAME_TO_SDL[_blendMode] ?? SDL_BLENDMODE_BLEND);
  }

  sdl.SDL_RenderGeometry(
    _renderer, texture,
    ptr(_meshScratch), numVerts,
    ptr(indices), numIndices,
  );
}

// ============================================================
// Image loading
// ============================================================

// Buffers for SDL_GetTextureSize
const _texWBuf = new Float32Array(1);
const _texHBuf = new Float32Array(1);
const _texWPtr = ptr(_texWBuf);
const _texHPtr = ptr(_texHBuf);

/** Load an image file and return an Image object. Supports PNG, JPG, WebP, etc. when SDL_image is available; falls back to BMP-only. */
export function newImage(pathOrData: string | BaseImageData | RichImageData): Image | null {
  if (!_renderer) return null;

  // ImageData path — create texture from pixel buffer
  if (typeof pathOrData !== "string") {
    const { data, width, height } = pathOrData;
    const surface = sdl.SDL_CreateSurfaceFrom(
      width, height, SDL_PIXELFORMAT_RGBA8888, ptr(data), width * 4
    ) as Pointer | null;
    if (!surface) return null;
    const texture = sdl.SDL_CreateTextureFromSurface(_renderer, surface) as SDLTexture | null;
    sdl.SDL_DestroySurface(surface);
    if (!texture) return null;

    sdl.SDL_SetTextureBlendMode(texture, SDL_BLENDMODE_BLEND);
    const img = _createImageObject(texture, width, height);
    img.setFilter(_defaultFilterMin, _defaultFilterMag);
    return img;
  }

  // File path — load from disk
  const path = pathOrData;
  let texture: SDLTexture | null = null;

  // Try SDL_image first (supports PNG, JPG, WebP, GIF, etc.)
  if (!_img) _img = loadImage();
  if (_img) {
    texture = _img.IMG_LoadTexture(_renderer, Buffer.from(path + "\0")) as SDLTexture | null;
  }

  // Fallback to SDL_LoadBMP for BMP files
  if (!texture) {
    const surface = sdl.SDL_LoadBMP(Buffer.from(path + "\0")) as Pointer | null;
    if (!surface) return null;
    texture = sdl.SDL_CreateTextureFromSurface(_renderer, surface) as SDLTexture | null;
    sdl.SDL_DestroySurface(surface);
    if (!texture) return null;
  }

  sdl.SDL_SetTextureBlendMode(texture, SDL_BLENDMODE_BLEND);

  // Get texture dimensions
  sdl.SDL_GetTextureSize(texture, _texWPtr, _texHPtr);
  const w = read.f32(_texWPtr, 0);
  const h = read.f32(_texHPtr, 0);

  const img = _createImageObject(texture, Math.round(w), Math.round(h));
  img.setFilter(_defaultFilterMin, _defaultFilterMag);
  return img;
}

// ============================================================
// Drawing images (the draw() function)
// ============================================================

/**
 * Draw a drawable (Image, Canvas, SpriteBatch, or ParticleSystem) at the given position with optional transform.
 *
 * Overloads:
 * - draw(drawable, x, y, r, sx, sy, ox, oy)
 * - draw(drawable, quad, x, y, r, sx, sy, ox, oy)
 */
export function draw(
  drawable: Image | SpriteBatch | ParticleSystem | Mesh | Text,
  quadOrX?: Quad | number,
  xOrY?: number,
  yOrR?: number,
  rOrSx?: number,
  sxOrSy?: number,
  syOrOx?: number,
  oxOrOy?: number,
  oyOrKx?: number,
): void {
  if (!_renderer) return;

  // Text path — flush cached canvas, then fall through to texture drawing
  if ("_isText" in drawable) {
    (drawable as Text)._flush();
  }

  // Mesh path — may be untextured (null _texture is OK)
  if ("_isMesh" in drawable && drawable._isMesh) {
    const x = (quadOrX as number) ?? 0;
    const y = xOrY ?? 0;
    const r = yOrR ?? 0;
    const sx = rOrSx ?? 1;
    const sy = sxOrSy ?? sx;
    const ox = syOrOx ?? 0;
    const oy = oxOrOy ?? 0;
    _drawMesh(drawable, x, y, r, sx, sy, ox, oy);
    return;
  }

  if (!drawable?._texture) return;
  _statDrawCalls++;

  // Apply current blend mode to the texture (SDL_RenderGeometry / SDL_RenderTexture
  // use the texture's blend mode, not the renderer's draw blend mode)
  sdl.SDL_SetTextureBlendMode(drawable._texture, BLEND_NAME_TO_SDL[_blendMode] ?? SDL_BLENDMODE_BLEND);

  // ParticleSystem path — no quad overload, just positional args
  if ("_isParticleSystem" in drawable && drawable._isParticleSystem) {
    const x = (quadOrX as number) ?? 0;
    const y = xOrY ?? 0;
    const r = yOrR ?? 0;
    const sx = rOrSx ?? 1;
    const sy = sxOrSy ?? sx;
    const ox = syOrOx ?? 0;
    const oy = oxOrOy ?? 0;
    _drawParticleSystem(drawable, x, y, r, sx, sy, ox, oy);
    return;
  }

  // SpriteBatch path — no quad overload, just positional args
  if ("_isSpriteBatch" in drawable && drawable._isSpriteBatch) {
    const x = (quadOrX as number) ?? 0;
    const y = xOrY ?? 0;
    const r = yOrR ?? 0;
    const sx = rOrSx ?? 1;
    const sy = sxOrSy ?? sx;
    const ox = syOrOx ?? 0;
    const oy = oxOrOy ?? 0;
    _drawSpriteBatch(drawable, x, y, r, sx, sy, ox, oy);
    return;
  }

  let quad: Quad | null = null;
  let x: number, y: number, r: number, sx: number, sy: number, ox: number, oy: number;

  if (quadOrX !== undefined && typeof quadOrX === "object" && "_x" in quadOrX) {
    // draw(drawable, quad, x, y, r, sx, sy, ox, oy)
    quad = quadOrX;
    x = xOrY ?? 0;
    y = yOrR ?? 0;
    r = rOrSx ?? 0;
    sx = sxOrSy ?? 1;
    sy = syOrOx ?? sx;
    ox = oxOrOy ?? 0;
    oy = oyOrKx ?? 0;
  } else {
    // draw(drawable, x, y, r, sx, sy, ox, oy)
    x = (quadOrX as number) ?? 0;
    y = xOrY ?? 0;
    r = yOrR ?? 0;
    sx = rOrSx ?? 1;
    sy = sxOrSy ?? sx;
    ox = syOrOx ?? 0;
    oy = oxOrOy ?? 0;
  }

  // Source rect
  let srcRect: Float32Array | null = null;
  let drawW: number, drawH: number;

  if (quad) {
    srcRect = new Float32Array([quad._x, quad._y, quad._w, quad._h]);
    drawW = quad._w;
    drawH = quad._h;
  } else {
    drawW = drawable._width;
    drawH = drawable._height;
  }

  // Apply color modulation
  const [cr, cg, cb, ca] = _drawColor;
  sdl.SDL_SetTextureColorModFloat(drawable._texture, cr / 255, cg / 255, cb / 255);
  sdl.SDL_SetTextureAlphaModFloat(drawable._texture, ca / 255);

  // If we have a non-identity transform or rotation/scale, use SDL_RenderGeometry for full control
  if (!_isIdentity() || r !== 0 || sx !== 1 || sy !== 1 || ox !== 0 || oy !== 0) {
    _drawTexturedQuad(drawable._texture, srcRect, drawW, drawH, x, y, r, sx, sy, ox, oy);
  } else {
    // Simple case: no transform, just blit
    const dstRect = new Float32Array([x, y, drawW, drawH]);
    sdl.SDL_RenderTexture(
      _renderer,
      drawable._texture,
      srcRect ? ptr(srcRect) : null,
      ptr(dstRect),
    );
  }
}

function _drawTexturedQuad(
  texture: SDLTexture,
  srcRect: Float32Array | null,
  w: number, h: number,
  x: number, y: number, r: number,
  sx: number, sy: number,
  ox: number, oy: number,
): void {
  if (!_renderer) return;

  // Build local quad corners (relative to origin)
  const corners: [number, number][] = [
    [-ox, -oy],
    [w - ox, -oy],
    [w - ox, h - oy],
    [-ox, h - oy],
  ];

  // Apply local scale and rotation
  const cos = Math.cos(r);
  const sin = Math.sin(r);

  const transformed: [number, number][] = corners.map(([cx, cy]) => {
    const scx = cx * sx;
    const scy = cy * sy;
    const rx = scx * cos - scy * sin + x;
    const ry = scx * sin + scy * cos + y;
    // Apply global transform
    return _transformPoint(rx, ry);
  });

  // UV coordinates
  let u0 = 0, v0 = 0, u1 = 1, v1 = 1;
  if (srcRect) {
    // SDL_RenderGeometry expects pixel coordinates for UV with textures
    // Actually, SDL uses 0-1 UV range when using SDL_RenderGeometry with textures
    // No — SDL_RenderGeometry uses the texture's actual pixel coordinates
    // But SDL_Vertex tex_coord is in normalized 0..1 range
    // Actually looking at SDL3 docs: tex_coord is normalized (0..1)
    const tw = w; // texture region width
    const th = h; // texture region height
    u0 = srcRect[0] / (srcRect[0] + tw); // Hmm, we need the full texture size
    // Simpler: pass srcRect to RenderTexture variant
    // Let's use SDL_RenderTextureRotated for the simple case
  }

  // For textured quads, use SDL_RenderGeometry
  // SDL_Vertex: { float x, y; SDL_FColor color; float tex_u, tex_v; }
  // SDL_FColor: { float r, g, b, a; }
  // SDL_Vertex = 8 floats = 32 bytes

  // Apply draw color via vertex colors (SDL_RenderGeometry uses vertex colors,
  // not texture color mod set via SDL_SetTextureColorModFloat)
  const [dr, dg, db, da] = _drawColor;
  const cr = dr / 255, cg = dg / 255, cb = db / 255, ca = da / 255;

  // UV mapping
  if (srcRect) {
    // Get the actual full texture size for UV normalization
    sdl.SDL_GetTextureSize(texture, _texWPtr, _texHPtr);
    const fullW = read.f32(_texWPtr, 0);
    const fullH = read.f32(_texHPtr, 0);
    u0 = srcRect[0] / fullW;
    v0 = srcRect[1] / fullH;
    u1 = (srcRect[0] + srcRect[2]) / fullW;
    v1 = (srcRect[1] + srcRect[3]) / fullH;
  }

  const uvs: [number, number][] = [
    [u0, v0], [u1, v0], [u1, v1], [u0, v1],
  ];

  // 2 triangles = 6 vertices (or 4 vertices + 6 indices)
  const vertBuf = new Float32Array(4 * 8);
  for (let i = 0; i < 4; i++) {
    const base = i * 8;
    vertBuf[base + 0] = transformed[i][0];
    vertBuf[base + 1] = transformed[i][1];
    vertBuf[base + 2] = cr;
    vertBuf[base + 3] = cg;
    vertBuf[base + 4] = cb;
    vertBuf[base + 5] = ca;
    vertBuf[base + 6] = uvs[i][0];
    vertBuf[base + 7] = uvs[i][1];
  }

  const indexBuf = new Int32Array([0, 1, 2, 0, 2, 3]);

  sdl.SDL_RenderGeometry(
    _renderer, texture,
    ptr(vertBuf), 4,
    ptr(indexBuf), 6,
  );
}

// ============================================================
// Renderer lifecycle (internal, called by index.ts)
// ============================================================

/** Create the SDL renderer for the current window. */
export function _createRenderer(): void {
  const win = _getSDLWindow();
  if (!win) return;

  // Try GPU renderer first (enables shader support)
  // Skip if dummy driver (crashes) or JOVE_NO_GPU is set (for benchmarking)
  const videoDriver = process.env.SDL_VIDEODRIVER;
  if (videoDriver !== "dummy" && !process.env.JOVE_NO_GPU) {
    try {
      // Step 1: Create GPU device requesting SPIRV format (Vulkan backend)
      const device = sdl.SDL_CreateGPUDevice(
        SDL_GPU_SHADERFORMAT_SPIRV,
        false,
        null
      ) as Pointer | null;
      if (device) {
        // Step 2: Claim the window for the GPU device
        const claimed = sdl.SDL_ClaimWindowForGPUDevice(device, win);
        if (claimed) {
          // Step 3: Create the GPU-backed renderer
          _renderer = sdl.SDL_CreateGPURenderer(device, win) as SDLRenderer | null;
          if (_renderer) {
            _gpuDevice = device;
          } else {
            sdl.SDL_DestroyGPUDevice(device);
          }
        } else {
          sdl.SDL_DestroyGPUDevice(device);
        }
      }
    } catch {
      _renderer = null;
      _gpuDevice = null;
    }
  }
  if (!_renderer) {
    // Fallback: regular renderer (no shader support)
    _renderer = sdl.SDL_CreateRenderer(win, null) as SDLRenderer | null;
    _gpuDevice = null;
  }
  if (!_renderer) {
    throw new Error(`SDL_CreateRenderer failed: ${sdl.SDL_GetError()}`);
  }
  sdl.SDL_SetRenderDrawBlendMode(_renderer, SDL_BLENDMODE_BLEND);

  // Try to init SDL_ttf for proper font rendering
  _ttf = loadTTF();
  if (_ttf) {
    _ttf.TTF_Init();
    _ttfEngine = _ttf.TTF_CreateRendererTextEngine(_renderer) as Pointer | null;
    if (_ttfEngine) {
      // Load default font (Vera Sans 12pt, matching love2d)
      const fontPtr = _ttf.TTF_OpenFont(
        Buffer.from(_defaultFontPath + "\0"),
        _defaultFontSize,
      ) as Pointer | null;
      if (fontPtr) {
        _defaultFont = _createFont(fontPtr, _defaultFontSize, _ttf);
        _currentFont = _defaultFont;
      }
    }
  }
}

/** Destroy the renderer. */
export function _destroyRenderer(): void {
  // Clean up stencil canvases
  if (_stencilCanvas) { _stencilCanvas.release(); _stencilCanvas = null; }
  if (_stencilInvCanvas) { _stencilInvCanvas.release(); _stencilInvCanvas = null; }
  if (_stencilContentCanvas) { _stencilContentCanvas.release(); _stencilContentCanvas = null; }
  _stencilActive = false;
  _stencilCompare = null;

  // Clean up active shader
  _activeShader = null;

  // Clean up TTF resources before renderer
  if (_defaultFont) {
    _defaultFont.release();
    _defaultFont = null;
  }
  _currentFont = null;
  if (_ttfEngine && _ttf) {
    _ttf.TTF_DestroyRendererTextEngine(_ttfEngine);
    _ttfEngine = null;
  }
  if (_ttf) {
    _ttf.TTF_Quit();
    _ttf = null;
  }
  if (_renderer) {
    sdl.SDL_DestroyRenderer(_renderer);
    _renderer = null;
  }
  if (_gpuDevice) {
    sdl.SDL_DestroyGPUDevice(_gpuDevice);
    _gpuDevice = null;
  }
  _activeCanvas = null;
  _transformStack.length = 0;
  _transform = [1, 0, 0, 1, 0, 0];
  _defaultFilterMin = "nearest";
  _defaultFilterMag = "nearest";
  _colorMask = [true, true, true, true];
  _spriteBatchScratch = new Float32Array(0);
}

/** Begin a frame: clear with background color. */
export function _beginFrame(): void {
  if (!_renderer) return;
  _statReset();
  const [br, bg, bb, ba] = _bgColor;
  sdl.SDL_SetRenderDrawColor(_renderer, br, bg, bb, ba);
  sdl.SDL_RenderClear(_renderer);
  // Restore draw color
  const [dr, dg, db, da] = _drawColor;
  sdl.SDL_SetRenderDrawColor(_renderer, dr, dg, db, da);
}

/** End a frame: flush captures, present. */
export function _endFrame(): void {
  if (!_renderer) return;
  _flushCaptures();
  sdl.SDL_RenderPresent(_renderer);
}

/** Get the renderer pointer (for internal use). */
export function _getRenderer(): SDLRenderer | null {
  return _renderer;
}

// ============================================================
// Color API
// ============================================================

/** Set the background clear color (0–255 range). */
export function setBackgroundColor(r: number, g: number, b: number, a: number = 255): void {
  _bgColor = [r, g, b, a];
}

/** Get the background clear color. */
export function getBackgroundColor(): [number, number, number, number] {
  return [..._bgColor] as [number, number, number, number];
}

/** Set the current drawing color (0–255 range). */
export function setColor(r: number, g: number, b: number, a: number = 255): void {
  _drawColor = [r, g, b, a];
  if (_renderer) {
    sdl.SDL_SetRenderDrawColor(_renderer, r, g, b, a);
  }
}

/** Get the current drawing color. */
export function getColor(): [number, number, number, number] {
  return [..._drawColor] as [number, number, number, number];
}

// ============================================================
// Blend modes
// ============================================================

/** Set the blend mode for drawing. */
export function setBlendMode(mode: BlendModeName): void {
  _blendMode = mode;
  if (_renderer) {
    sdl.SDL_SetRenderDrawBlendMode(_renderer, BLEND_NAME_TO_SDL[mode] ?? SDL_BLENDMODE_BLEND);
  }
}

/** Get the current blend mode. */
export function getBlendMode(): BlendModeName {
  return _blendMode;
}

// ============================================================
// Scissor (clipping rectangle)
// ============================================================

/** Set a scissor (clipping) rectangle. Disables scissor if called with no arguments. */
export function setScissor(x?: number, y?: number, w?: number, h?: number): void {
  if (!_renderer) return;
  if (x === undefined) {
    // Disable scissor
    sdl.SDL_SetRenderClipRect(_renderer, null);
    _scissorEnabled = false;
    _scissor = null;
  } else {
    _scissorBuf[0] = x!;
    _scissorBuf[1] = y!;
    _scissorBuf[2] = w!;
    _scissorBuf[3] = h!;
    sdl.SDL_SetRenderClipRect(_renderer, ptr(_scissorBuf));
    _scissorEnabled = true;
    _scissor = [x!, y!, w!, h!];
  }
}

/** Get the current scissor rectangle, or null if not set. */
export function getScissor(): [number, number, number, number] | null {
  return _scissor ? [..._scissor] as [number, number, number, number] : null;
}

// ============================================================
// Stencil (canvas-based simulation)
// ============================================================

function _ensureStencilCanvas(): void {
  if (!_renderer) return;
  const mode = getMode();
  const w = mode.width;
  const h = mode.height;

  // Recreate if size changed or doesn't exist
  if (_stencilCanvas && (_stencilCanvas._width !== w || _stencilCanvas._height !== h)) {
    _stencilCanvas.release();
    _stencilCanvas = null;
  }
  if (!_stencilCanvas) {
    _stencilCanvas = newCanvas(w, h);
  }

  // Inverted canvas is created lazily in _ensureStencilInvCanvas() only when needed
  if (_stencilInvCanvas && (_stencilInvCanvas._width !== w || _stencilInvCanvas._height !== h)) {
    _stencilInvCanvas.release();
    _stencilInvCanvas = null;
  }

  if (_stencilContentCanvas && (_stencilContentCanvas._width !== w || _stencilContentCanvas._height !== h)) {
    _stencilContentCanvas.release();
    _stencilContentCanvas = null;
  }
  if (!_stencilContentCanvas) {
    _stencilContentCanvas = newCanvas(w, h);
  }
}

/**
 * Lazily prepare the inverted stencil canvas by replaying the stored fn.
 * Only called when the compare mode actually needs the inverted mask.
 */
function _prepareInvertedStencil(): Canvas | null {
  if (!_renderer || !_stencilPendingFn) return _stencilInvCanvas;

  const mode = getMode();
  if (!_stencilInvCanvas) {
    _stencilInvCanvas = newCanvas(mode.width, mode.height);
  }
  if (!_stencilInvCanvas) return null;

  // Save state
  const savedCanvas = _activeCanvas;
  const savedColor: [number, number, number, number] = [..._drawColor] as [number, number, number, number];
  const savedBlend = _blendMode;

  // Draw transparent holes on white background
  setCanvas(_stencilInvCanvas);
  if (!_stencilPendingKeep) {
    sdl.SDL_SetRenderDrawColor(_renderer, 255, 255, 255, 255);
    sdl.SDL_RenderClear(_renderer);
  }
  setColor(0, 0, 0, 0);
  setBlendMode("replace");
  _stencilPendingFn();

  // Restore state
  setCanvas(savedCanvas);
  _drawColor = savedColor;
  _blendMode = savedBlend;
  sdl.SDL_SetRenderDrawColor(_renderer, savedColor[0], savedColor[1], savedColor[2], savedColor[3]);
  sdl.SDL_SetRenderDrawBlendMode(_renderer, BLEND_NAME_TO_SDL[savedBlend] ?? SDL_BLENDMODE_BLEND);

  return _stencilInvCanvas;
}

/**
 * Draw geometry into the stencil buffer. Mirrors love.graphics.stencil().
 * Uses canvas-based simulation: shapes drawn by fn() write to an internal stencil canvas.
 *
 * Limitations: Only binary masking (shape vs no-shape). Multi-level stencil values
 * (increment/decrement) are approximated. "invert" action not supported.
 */
export function stencil(
  fn: () => void,
  action: StencilAction = "replace",
  value: number = 1,
  keepvalues: boolean = false,
): void {
  if (!_renderer) return;
  _ensureStencilCanvas();

  // Save state
  const savedCanvas = _activeCanvas;
  const savedColor: [number, number, number, number] = [..._drawColor] as [number, number, number, number];
  const savedBlend = _blendMode;

  if (_stencilCanvas) {
    // Draw white shapes on transparent background to stencil canvas
    setCanvas(_stencilCanvas);
    if (!keepvalues) {
      sdl.SDL_SetRenderDrawColor(_renderer, 0, 0, 0, 0);
      sdl.SDL_RenderClear(_renderer);
    }
    setColor(255, 255, 255, 255);
    setBlendMode("replace");
    fn();

    // Store fn for lazy inverted canvas creation (only if setStencilTest needs it)
    _stencilPendingFn = fn;
    _stencilPendingKeep = keepvalues;
  } else {
    // No canvas support — still call fn() for side effects
    fn();
  }

  // Restore state
  setCanvas(savedCanvas);
  _drawColor = savedColor;
  _blendMode = savedBlend;
  if (_renderer) {
    sdl.SDL_SetRenderDrawColor(_renderer, savedColor[0], savedColor[1], savedColor[2], savedColor[3]);
    sdl.SDL_SetRenderDrawBlendMode(_renderer, BLEND_NAME_TO_SDL[savedBlend] ?? SDL_BLENDMODE_BLEND);
  }
}

/**
 * Enable or disable stencil testing. Mirrors love.graphics.setStencilTest().
 *
 * When enabled, subsequent drawing is captured to an internal canvas. When disabled,
 * the captured content is composited with the stencil mask and drawn to the actual target.
 *
 * Call with no arguments to disable stencil testing.
 */
export function setStencilTest(comparemode?: CompareMode, comparevalue?: number): void {
  if (!_renderer) return;

  if (comparemode === undefined) {
    // Disable stencil test
    if (!_stencilActive) return;

    // Composite: apply stencil mask to content via MOD blend, then draw to screen
    if (_stencilContentCanvas && _stencilCanvas) {
      const useInverse = _needsInverseMask(_stencilCompare!, _stencilValue);

      if (_stencilCompare === "never") {
        // Nothing passes — don't draw content at all
      } else if (_stencilCompare === "always") {
        // Everything passes — draw content directly to original target
        setCanvas(_stencilOrigCanvas);
        sdl.SDL_SetTextureBlendMode(_stencilContentCanvas._texture, SDL_BLENDMODE_BLEND);
        sdl.SDL_RenderTexture(_renderer, _stencilContentCanvas._texture, null, null);
      } else {
        // Pick the right mask canvas (normal or inverted)
        let maskCanvas: Canvas | null;
        if (useInverse) {
          // Lazily create inverted canvas from stored fn
          maskCanvas = _prepareInvertedStencil();
        } else {
          maskCanvas = _stencilCanvas;
        }
        if (maskCanvas) {
          // Step 1: Draw content onto mask canvas with MOD blend
          // MOD: result_rgb = content_rgb * mask_rgb, result_alpha = mask_alpha
          setCanvas(maskCanvas);
          sdl.SDL_SetTextureBlendMode(_stencilContentCanvas._texture, SDL_BLENDMODE_MOD);
          sdl.SDL_RenderTexture(_renderer, _stencilContentCanvas._texture, null, null);

          // Step 2: Draw masked result to original target
          setCanvas(_stencilOrigCanvas);
          sdl.SDL_SetTextureBlendMode(maskCanvas._texture, SDL_BLENDMODE_BLEND);
          sdl.SDL_RenderTexture(_renderer, maskCanvas._texture, null, null);
        }
      }
    }

    _stencilActive = false;
    _stencilCompare = null;
    _stencilValue = 0;
    _stencilPendingFn = null;

    // Restore draw state
    const [dr, dg, db, da] = _drawColor;
    sdl.SDL_SetRenderDrawColor(_renderer, dr, dg, db, da);
    sdl.SDL_SetRenderDrawBlendMode(_renderer, BLEND_NAME_TO_SDL[_blendMode] ?? SDL_BLENDMODE_BLEND);
    return;
  }

  // Enable stencil test
  _ensureStencilCanvas();

  _stencilCompare = comparemode;
  _stencilValue = comparevalue ?? 0;
  _stencilOrigCanvas = _activeCanvas;
  _stencilActive = true;

  if (_stencilContentCanvas) {
    // Redirect rendering to content canvas
    setCanvas(_stencilContentCanvas);
    sdl.SDL_SetRenderDrawColor(_renderer, 0, 0, 0, 0);
    sdl.SDL_RenderClear(_renderer);

    // Restore draw color/blend for user drawing
    const [dr, dg, db, da] = _drawColor;
    sdl.SDL_SetRenderDrawColor(_renderer, dr, dg, db, da);
    sdl.SDL_SetRenderDrawBlendMode(_renderer, BLEND_NAME_TO_SDL[_blendMode] ?? SDL_BLENDMODE_BLEND);
  }
}

/** Get the current stencil test settings. Returns ["always", 0] if disabled. */
export function getStencilTest(): [CompareMode, number] {
  if (!_stencilActive || !_stencilCompare) return ["always", 0];
  return [_stencilCompare, _stencilValue];
}

/**
 * Determine if we need the inverted mask blend for a given compare mode + value.
 * Normal mask: keep content where stencil is drawn (alpha > 0)
 * Inverted mask: keep content where stencil is NOT drawn (alpha == 0)
 */
function _needsInverseMask(compare: CompareMode, value: number): boolean {
  // For binary stencil (0 or 1):
  // "greater" + 0: pass where stencil > 0 → normal mask
  // "gequal" + 1: pass where stencil >= 1 → normal mask
  // "equal" + 0: pass where stencil == 0 → inverted mask
  // "equal" + 1: pass where stencil == 1 → normal mask (with value > 0)
  // "notequal" + 0: pass where stencil != 0 → normal mask
  // "notequal" + 1: pass where stencil != 1 → inverted mask
  // "less" + 1: pass where stencil < 1 → inverted mask
  // "lequal" + 0: pass where stencil <= 0 → inverted mask
  switch (compare) {
    case "greater": return false;   // pass where drawn
    case "gequal": return value > 1; // if value > 1, nothing passes → inverse is closest
    case "equal": return value === 0; // pass where NOT drawn
    case "notequal": return value !== 0; // if comparing to non-zero, pass where NOT drawn
    case "less": return true;        // pass where stencil < value → not drawn
    case "lequal": return value === 0; // pass where stencil <= 0 → not drawn
    default: return false;
  }
}

// ============================================================
// Line width & point size
// ============================================================

/** Set the line width for drawing. */
export function setLineWidth(width: number): void {
  _lineWidth = width;
}

/** Get the current line width. */
export function getLineWidth(): number {
  return _lineWidth;
}

/** Set the point size for drawing. */
export function setPointSize(size: number): void {
  _pointSize = size;
}

/** Get the current point size. */
export function getPointSize(): number {
  return _pointSize;
}

/** Set the line style ("rough" = aliased, "smooth" = anti-aliased). */
export function setLineStyle(style: LineStyle): void {
  _lineStyle = style;
}

/** Get the current line style. */
export function getLineStyle(): LineStyle {
  return _lineStyle;
}

// ============================================================
// Default filter
// ============================================================

/** Set the default filter mode applied to new images and canvases. */
export function setDefaultFilter(min: FilterMode, mag?: FilterMode): void {
  _defaultFilterMin = min;
  _defaultFilterMag = mag ?? min;
}

/** Get the default filter mode. */
export function getDefaultFilter(): [FilterMode, FilterMode] {
  return [_defaultFilterMin, _defaultFilterMag];
}

// ============================================================
// Color mask
// ============================================================

/** Set the color write mask. Call with no args to reset to all true. */
export function setColorMask(r?: boolean, g?: boolean, b?: boolean, a?: boolean): void {
  if (r === undefined) {
    _colorMask = [true, true, true, true];
  } else {
    _colorMask = [r, g ?? true, b ?? true, a ?? true];
  }
}

/** Get the color write mask. */
export function getColorMask(): [boolean, boolean, boolean, boolean] {
  return [..._colorMask] as [boolean, boolean, boolean, boolean];
}

// ============================================================
// Transform queries
// ============================================================

/** Transform a point from local to screen coordinates using the current transform. */
export function transformPoint(x: number, y: number): [number, number] {
  return _transformPoint(x, y);
}

/** Transform a point from screen to local coordinates (inverse of current transform). */
export function inverseTransformPoint(x: number, y: number): [number, number] {
  const [a, b, c, d, tx, ty] = _transform;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return [x, y];
  const id = 1 / det;
  const rx = x - tx;
  const ry = y - ty;
  return [( d * rx - c * ry) * id, (-b * rx + a * ry) * id];
}

/** Get the depth of the transform stack (number of push() calls without matching pop()). */
export function getStackDepth(): number {
  return _transformStack.length;
}

// ============================================================
// Intersect scissor
// ============================================================

/** Intersect the current scissor with a new rectangle. If no scissor is set, acts like setScissor. */
export function intersectScissor(x: number, y: number, w: number, h: number): void {
  if (!_scissor) {
    setScissor(x, y, w, h);
    return;
  }
  const [sx, sy, sw, sh] = _scissor;
  const x1 = Math.max(x, sx);
  const y1 = Math.max(y, sy);
  const x2 = Math.min(x + w, sx + sw);
  const y2 = Math.min(y + h, sy + sh);
  const iw = Math.max(0, x2 - x1);
  const ih = Math.max(0, y2 - y1);
  setScissor(x1, y1, iw, ih);
}

// ============================================================
// Graphics state reset
// ============================================================

/** Reset all graphics state to defaults. */
export function reset(): void {
  _bgColor = [0, 0, 0, 255];
  _drawColor = [255, 255, 255, 255];
  if (_renderer) {
    sdl.SDL_SetRenderDrawColor(_renderer, 255, 255, 255, 255);
  }
  _blendMode = "alpha";
  if (_renderer) {
    sdl.SDL_SetRenderDrawBlendMode(_renderer, SDL_BLENDMODE_BLEND);
  }
  // Clear active shader
  if (_activeShader && _renderer) {
    sdl.SDL_SetGPURenderState(_renderer, null);
  }
  _activeShader = null;
  _lineWidth = 1;
  _pointSize = 1;
  _lineStyle = "rough";
  setScissor();
  if (_stencilActive) setStencilTest(); // disable stencil
  _transform = [1, 0, 0, 1, 0, 0];
  _transformStack.length = 0;
  setCanvas(null);
  _currentFont = _defaultFont;
  _defaultFilterMin = "nearest";
  _defaultFilterMag = "nearest";
  _colorMask = [true, true, true, true];
}

// ============================================================
// Anti-aliased line rendering via textured quads
// ============================================================

/**
 * Draw anti-aliased lines using SDL_RenderGeometry with per-vertex alpha fringe.
 * Points must be in screen-space (pre-transformed). Uses miter joins at interior vertices.
 */
function _smoothLines(points: Float32Array, numPoints: number, loop: boolean): void {
  if (!_renderer || numPoints < 2) return;

  const hw = _lineWidth / 2;
  const fringe = 0.75; // AA fringe width in pixels
  const [dr, dg, db, da] = _drawColor;
  const cr = dr / 255, cg = dg / 255, cb = db / 255, ca = da / 255;

  const numSegments = loop ? numPoints : numPoints - 1;
  const totalVerts = numPoints * 4;
  const totalIndices = numSegments * 18;

  // SDL_Vertex = 8 floats: x, y, r, g, b, a, u, v
  const vertBuf = new Float32Array(totalVerts * 8);
  const idxBuf = new Int32Array(totalIndices);

  // Compute normals and vertex positions for each point
  for (let i = 0; i < numPoints; i++) {
    let nx = 0, ny = 0;
    const hasPrev = loop || i > 0;
    const hasNext = loop || i < numPoints - 1;

    if (hasPrev) {
      const pi = loop ? ((i - 1 + numPoints) % numPoints) : (i - 1);
      const dx = points[i * 2] - points[pi * 2];
      const dy = points[i * 2 + 1] - points[pi * 2 + 1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) { nx += -dy / len; ny += dx / len; }
    }

    if (hasNext) {
      const ni = loop ? ((i + 1) % numPoints) : (i + 1);
      const dx = points[ni * 2] - points[i * 2];
      const dy = points[ni * 2 + 1] - points[i * 2 + 1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) { nx += -dy / len; ny += dx / len; }
    }

    // Normalize the averaged normal
    const nlen = Math.sqrt(nx * nx + ny * ny);
    if (nlen > 0) { nx /= nlen; ny /= nlen; }

    // Compute miter scale to maintain constant line width at joins
    let miterScale = 1;
    if (hasPrev && hasNext) {
      const ni = loop ? ((i + 1) % numPoints) : (i + 1);
      const dx = points[ni * 2] - points[i * 2];
      const dy = points[ni * 2 + 1] - points[i * 2 + 1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const snx = -dy / len, sny = dx / len;
        const dot = nx * snx + ny * sny;
        if (dot > 0.1) miterScale = 1 / dot;
        if (miterScale > 4) miterScale = 4; // Clamp extreme miters
      }
    }

    const px = points[i * 2], py = points[i * 2 + 1];
    const outerDist = (hw + fringe) * miterScale;
    const innerDist = hw * miterScale;

    // Vertex 0: outer+ (α=0)
    const v0 = i * 4 * 8;
    vertBuf[v0] = px + nx * outerDist;
    vertBuf[v0 + 1] = py + ny * outerDist;
    vertBuf[v0 + 2] = cr; vertBuf[v0 + 3] = cg;
    vertBuf[v0 + 4] = cb; vertBuf[v0 + 5] = 0;

    // Vertex 1: inner+ (α=full)
    const v1 = v0 + 8;
    vertBuf[v1] = px + nx * innerDist;
    vertBuf[v1 + 1] = py + ny * innerDist;
    vertBuf[v1 + 2] = cr; vertBuf[v1 + 3] = cg;
    vertBuf[v1 + 4] = cb; vertBuf[v1 + 5] = ca;

    // Vertex 2: inner- (α=full)
    const v2 = v1 + 8;
    vertBuf[v2] = px - nx * innerDist;
    vertBuf[v2 + 1] = py - ny * innerDist;
    vertBuf[v2 + 2] = cr; vertBuf[v2 + 3] = cg;
    vertBuf[v2 + 4] = cb; vertBuf[v2 + 5] = ca;

    // Vertex 3: outer- (α=0)
    const v3 = v2 + 8;
    vertBuf[v3] = px - nx * outerDist;
    vertBuf[v3 + 1] = py - ny * outerDist;
    vertBuf[v3 + 2] = cr; vertBuf[v3 + 3] = cg;
    vertBuf[v3 + 4] = cb; vertBuf[v3 + 5] = 0;
  }

  // Build index buffer — 3 quads (6 triangles) per segment
  for (let s = 0; s < numSegments; s++) {
    const i0 = s;
    const i1 = loop ? ((s + 1) % numPoints) : (s + 1);
    const base = s * 18;

    // Top fringe quad (outer+ → inner+)
    idxBuf[base] = i0 * 4;
    idxBuf[base + 1] = i1 * 4;
    idxBuf[base + 2] = i1 * 4 + 1;
    idxBuf[base + 3] = i0 * 4;
    idxBuf[base + 4] = i1 * 4 + 1;
    idxBuf[base + 5] = i0 * 4 + 1;

    // Core quad (inner+ → inner-)
    idxBuf[base + 6] = i0 * 4 + 1;
    idxBuf[base + 7] = i1 * 4 + 1;
    idxBuf[base + 8] = i1 * 4 + 2;
    idxBuf[base + 9] = i0 * 4 + 1;
    idxBuf[base + 10] = i1 * 4 + 2;
    idxBuf[base + 11] = i0 * 4 + 2;

    // Bottom fringe quad (inner- → outer-)
    idxBuf[base + 12] = i0 * 4 + 2;
    idxBuf[base + 13] = i1 * 4 + 2;
    idxBuf[base + 14] = i1 * 4 + 3;
    idxBuf[base + 15] = i0 * 4 + 2;
    idxBuf[base + 16] = i1 * 4 + 3;
    idxBuf[base + 17] = i0 * 4 + 3;
  }

  sdl.SDL_RenderGeometry(_renderer, null, ptr(vertBuf), totalVerts, ptr(idxBuf), totalIndices);
}

// ============================================================
// Drawing primitives
// ============================================================

/** Clear the screen with the background color. */
export function clear(): void;
export function clear(r: number, g: number, b: number, a?: number): void;
export function clear(r?: number, g?: number, b?: number, a?: number): void {
  if (!_renderer) return;
  if (r !== undefined) {
    sdl.SDL_SetRenderDrawColor(_renderer, r, g!, b!, a ?? 255);
  } else {
    const [br, bg, bb, ba] = _bgColor;
    sdl.SDL_SetRenderDrawColor(_renderer, br, bg, bb, ba);
  }
  sdl.SDL_RenderClear(_renderer);
  // Restore draw color
  const [dr, dg, db, da] = _drawColor;
  sdl.SDL_SetRenderDrawColor(_renderer, dr, dg, db, da);
}

/** Draw a rectangle. */
export function rectangle(mode: "fill" | "line", x: number, y: number, w: number, h: number): void {
  if (!_renderer) return;
  _statDrawCalls++;
  if (_isIdentity()) {
    // Fast path: no transform
    if (mode === "fill") {
      _rectBuf[0] = x;
      _rectBuf[1] = y;
      _rectBuf[2] = w;
      _rectBuf[3] = h;
      sdl.SDL_RenderFillRect(_renderer, ptr(_rectBuf));
    } else if (_lineStyle === "smooth") {
      const buf = new Float32Array(8);
      buf[0] = x; buf[1] = y;
      buf[2] = x + w; buf[3] = y;
      buf[4] = x + w; buf[5] = y + h;
      buf[6] = x; buf[7] = y + h;
      _smoothLines(buf, 4, true);
    } else {
      _rectBuf[0] = x;
      _rectBuf[1] = y;
      _rectBuf[2] = w;
      _rectBuf[3] = h;
      sdl.SDL_RenderRect(_renderer, ptr(_rectBuf));
    }
  } else {
    // Transform the 4 corners
    const corners: [number, number][] = [
      _transformPoint(x, y),
      _transformPoint(x + w, y),
      _transformPoint(x + w, y + h),
      _transformPoint(x, y + h),
    ];

    if (mode === "fill") {
      _fillQuad(corners);
    } else {
      _strokePolygon(corners);
    }
  }
}

/** Draw line(s). Variadic: line(x1, y1, x2, y2, ...) like love2d. */
export function line(...coords: number[]): void {
  if (!_renderer || coords.length < 4) return;
  _statDrawCalls++;

  const numPoints = coords.length / 2;
  const identity = _isIdentity();

  if (_lineStyle === "smooth") {
    const buf = new Float32Array(numPoints * 2);
    if (identity) {
      for (let i = 0; i < coords.length; i++) buf[i] = coords[i];
    } else {
      for (let i = 0; i < numPoints; i++) {
        const [tx, ty] = _transformPoint(coords[i * 2], coords[i * 2 + 1]);
        buf[i * 2] = tx;
        buf[i * 2 + 1] = ty;
      }
    }
    _smoothLines(buf, numPoints, false);
    return;
  }

  // Rough path
  if (identity) {
    if (coords.length === 4) {
      sdl.SDL_RenderLine(_renderer, coords[0], coords[1], coords[2], coords[3]);
      return;
    }
    const buf = new Float32Array(numPoints * 2);
    for (let i = 0; i < coords.length; i++) buf[i] = coords[i];
    sdl.SDL_RenderLines(_renderer, ptr(buf), numPoints);
  } else {
    const buf = new Float32Array(numPoints * 2);
    for (let i = 0; i < numPoints; i++) {
      const [tx, ty] = _transformPoint(coords[i * 2], coords[i * 2 + 1]);
      buf[i * 2] = tx;
      buf[i * 2 + 1] = ty;
    }
    if (numPoints === 2) {
      sdl.SDL_RenderLine(_renderer, buf[0], buf[1], buf[2], buf[3]);
    } else {
      sdl.SDL_RenderLines(_renderer, ptr(buf), numPoints);
    }
  }
}

/** Draw a circle approximated with line segments. */
export function circle(mode: "fill" | "line", cx: number, cy: number, radius: number, segments?: number): void {
  if (!_renderer) return;
  _statDrawCalls++;
  const n = segments ?? Math.min(256, Math.max(16, Math.ceil(radius * 2)));
  const angleStep = (Math.PI * 2) / n;

  if (mode === "line") {
    const identity = _isIdentity();
    if (_lineStyle === "smooth") {
      const buf = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const angle = i * angleStep;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        const [tx, ty] = identity ? [px, py] : _transformPoint(px, py);
        buf[i * 2] = tx;
        buf[i * 2 + 1] = ty;
      }
      _smoothLines(buf, n, true);
    } else {
      const buf = new Float32Array((n + 1) * 2);
      for (let i = 0; i <= n; i++) {
        const angle = i * angleStep;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        const [tx, ty] = identity ? [px, py] : _transformPoint(px, py);
        buf[i * 2] = tx;
        buf[i * 2 + 1] = ty;
      }
      sdl.SDL_RenderLines(_renderer, ptr(buf), n + 1);
    }
  } else {
    _fillCircle(cx, cy, radius, n, angleStep);
  }
}

function _fillCircle(cx: number, cy: number, radius: number, n: number, angleStep: number): void {
  const numTris = n;
  const numVerts = numTris * 3;
  const vertBuf = new Float32Array(numVerts * 8);
  const [dr, dg, db, da] = _drawColor;
  const cr = dr / 255;
  const cg = dg / 255;
  const cb = db / 255;
  const ca = da / 255;
  const identity = _isIdentity();

  const [tcx, tcy] = identity ? [cx, cy] : _transformPoint(cx, cy);

  for (let i = 0; i < numTris; i++) {
    const a1 = i * angleStep;
    const a2 = (i + 1) * angleStep;
    const base = i * 3 * 8;

    const p1x = cx + Math.cos(a1) * radius;
    const p1y = cy + Math.sin(a1) * radius;
    const p2x = cx + Math.cos(a2) * radius;
    const p2y = cy + Math.sin(a2) * radius;

    const [tp1x, tp1y] = identity ? [p1x, p1y] : _transformPoint(p1x, p1y);
    const [tp2x, tp2y] = identity ? [p2x, p2y] : _transformPoint(p2x, p2y);

    // Center vertex
    vertBuf[base + 0] = tcx;
    vertBuf[base + 1] = tcy;
    vertBuf[base + 2] = cr;
    vertBuf[base + 3] = cg;
    vertBuf[base + 4] = cb;
    vertBuf[base + 5] = ca;

    // Edge vertex 1
    vertBuf[base + 8] = tp1x;
    vertBuf[base + 9] = tp1y;
    vertBuf[base + 10] = cr;
    vertBuf[base + 11] = cg;
    vertBuf[base + 12] = cb;
    vertBuf[base + 13] = ca;

    // Edge vertex 2
    vertBuf[base + 16] = tp2x;
    vertBuf[base + 17] = tp2y;
    vertBuf[base + 18] = cr;
    vertBuf[base + 19] = cg;
    vertBuf[base + 20] = cb;
    vertBuf[base + 21] = ca;
  }

  sdl.SDL_RenderGeometry(_renderer!, null, ptr(vertBuf), numVerts, null, 0);
}

/** Draw an ellipse. */
export function ellipse(mode: "fill" | "line", cx: number, cy: number, rx: number, ry: number, segments?: number): void {
  if (!_renderer) return;
  _statDrawCalls++;
  const n = segments ?? Math.min(256, Math.max(16, Math.ceil(Math.max(rx, ry) * 2)));
  const angleStep = (Math.PI * 2) / n;

  if (mode === "line") {
    const identity = _isIdentity();
    if (_lineStyle === "smooth") {
      const buf = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const angle = i * angleStep;
        const px = cx + Math.cos(angle) * rx;
        const py = cy + Math.sin(angle) * ry;
        const [tx, ty] = identity ? [px, py] : _transformPoint(px, py);
        buf[i * 2] = tx;
        buf[i * 2 + 1] = ty;
      }
      _smoothLines(buf, n, true);
    } else {
      const buf = new Float32Array((n + 1) * 2);
      for (let i = 0; i <= n; i++) {
        const angle = i * angleStep;
        const px = cx + Math.cos(angle) * rx;
        const py = cy + Math.sin(angle) * ry;
        const [tx, ty] = identity ? [px, py] : _transformPoint(px, py);
        buf[i * 2] = tx;
        buf[i * 2 + 1] = ty;
      }
      sdl.SDL_RenderLines(_renderer, ptr(buf), n + 1);
    }
  } else {
    // Triangle fan from center
    const numTris = n;
    const numVerts = numTris * 3;
    const vertBuf = new Float32Array(numVerts * 8);
    const [dr, dg, db, da] = _drawColor;
    const cr = dr / 255, cg = dg / 255, cb = db / 255, ca = da / 255;
    const identity = _isIdentity();
    const [tcx, tcy] = identity ? [cx, cy] : _transformPoint(cx, cy);

    for (let i = 0; i < numTris; i++) {
      const a1 = i * angleStep;
      const a2 = (i + 1) * angleStep;
      const base = i * 3 * 8;

      const p1x = cx + Math.cos(a1) * rx;
      const p1y = cy + Math.sin(a1) * ry;
      const p2x = cx + Math.cos(a2) * rx;
      const p2y = cy + Math.sin(a2) * ry;
      const [tp1x, tp1y] = identity ? [p1x, p1y] : _transformPoint(p1x, p1y);
      const [tp2x, tp2y] = identity ? [p2x, p2y] : _transformPoint(p2x, p2y);

      vertBuf[base + 0] = tcx; vertBuf[base + 1] = tcy;
      vertBuf[base + 2] = cr; vertBuf[base + 3] = cg;
      vertBuf[base + 4] = cb; vertBuf[base + 5] = ca;
      vertBuf[base + 8] = tp1x; vertBuf[base + 9] = tp1y;
      vertBuf[base + 10] = cr; vertBuf[base + 11] = cg;
      vertBuf[base + 12] = cb; vertBuf[base + 13] = ca;
      vertBuf[base + 16] = tp2x; vertBuf[base + 17] = tp2y;
      vertBuf[base + 18] = cr; vertBuf[base + 19] = cg;
      vertBuf[base + 20] = cb; vertBuf[base + 21] = ca;
    }
    sdl.SDL_RenderGeometry(_renderer, null, ptr(vertBuf), numVerts, null, 0);
  }
}

/** Draw an arc. arctype: "open" (default for line), "closed", or "pie" (default for fill). */
export function arc(mode: "fill" | "line", cx: number, cy: number, radius: number, angle1: number, angle2: number, segments?: number, arctype?: "open" | "closed" | "pie"): void {
  if (!_renderer) return;
  _statDrawCalls++;
  const arcLength = angle2 - angle1;
  const n = segments ?? Math.min(256, Math.max(8, Math.ceil(Math.abs(arcLength) * radius)));
  const angleStep = arcLength / n;
  const identity = _isIdentity();
  const type = arctype ?? (mode === "line" ? "open" : "pie");

  if (mode === "line") {
    if (_lineStyle === "smooth") {
      // Build point array based on arc type
      if (type === "pie") {
        // center → arc points → (loop closes back to center)
        const [tcx, tcy] = identity ? [cx, cy] : _transformPoint(cx, cy);
        const buf = new Float32Array((n + 2) * 2);
        buf[0] = tcx; buf[1] = tcy;
        for (let i = 0; i <= n; i++) {
          const angle = angle1 + i * angleStep;
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius;
          const [tx, ty] = identity ? [px, py] : _transformPoint(px, py);
          buf[(i + 1) * 2] = tx;
          buf[(i + 1) * 2 + 1] = ty;
        }
        _smoothLines(buf, n + 2, true);
      } else if (type === "closed") {
        // arc points, loop closes chord
        const buf = new Float32Array((n + 1) * 2);
        for (let i = 0; i <= n; i++) {
          const angle = angle1 + i * angleStep;
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius;
          const [tx, ty] = identity ? [px, py] : _transformPoint(px, py);
          buf[i * 2] = tx;
          buf[i * 2 + 1] = ty;
        }
        _smoothLines(buf, n + 1, true);
      } else {
        // "open" — no closing
        const buf = new Float32Array((n + 1) * 2);
        for (let i = 0; i <= n; i++) {
          const angle = angle1 + i * angleStep;
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius;
          const [tx, ty] = identity ? [px, py] : _transformPoint(px, py);
          buf[i * 2] = tx;
          buf[i * 2 + 1] = ty;
        }
        _smoothLines(buf, n + 1, false);
      }
    } else {
      // Rough path
      if (type === "pie") {
        const buf = new Float32Array((n + 3) * 2);
        const [tcx, tcy] = identity ? [cx, cy] : _transformPoint(cx, cy);
        buf[0] = tcx; buf[1] = tcy;
        for (let i = 0; i <= n; i++) {
          const angle = angle1 + i * angleStep;
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius;
          const [tx, ty] = identity ? [px, py] : _transformPoint(px, py);
          buf[(i + 1) * 2] = tx;
          buf[(i + 1) * 2 + 1] = ty;
        }
        buf[(n + 2) * 2] = tcx;
        buf[(n + 2) * 2 + 1] = tcy;
        sdl.SDL_RenderLines(_renderer, ptr(buf), n + 3);
      } else if (type === "closed") {
        const buf = new Float32Array((n + 2) * 2);
        for (let i = 0; i <= n; i++) {
          const angle = angle1 + i * angleStep;
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius;
          const [tx, ty] = identity ? [px, py] : _transformPoint(px, py);
          buf[i * 2] = tx;
          buf[i * 2 + 1] = ty;
        }
        buf[(n + 1) * 2] = buf[0];
        buf[(n + 1) * 2 + 1] = buf[1];
        sdl.SDL_RenderLines(_renderer, ptr(buf), n + 2);
      } else {
        const buf = new Float32Array((n + 1) * 2);
        for (let i = 0; i <= n; i++) {
          const angle = angle1 + i * angleStep;
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius;
          const [tx, ty] = identity ? [px, py] : _transformPoint(px, py);
          buf[i * 2] = tx;
          buf[i * 2 + 1] = ty;
        }
        sdl.SDL_RenderLines(_renderer, ptr(buf), n + 1);
      }
    }
  } else {
    // Triangle fan from center
    const numTris = n;
    const numVerts = numTris * 3;
    const vertBuf = new Float32Array(numVerts * 8);
    const [dr, dg, db, da] = _drawColor;
    const cr = dr / 255, cg = dg / 255, cb = db / 255, ca = da / 255;
    const [tcx, tcy] = identity ? [cx, cy] : _transformPoint(cx, cy);

    for (let i = 0; i < numTris; i++) {
      const a1 = angle1 + i * angleStep;
      const a2 = angle1 + (i + 1) * angleStep;
      const base = i * 3 * 8;

      const p1x = cx + Math.cos(a1) * radius;
      const p1y = cy + Math.sin(a1) * radius;
      const p2x = cx + Math.cos(a2) * radius;
      const p2y = cy + Math.sin(a2) * radius;
      const [tp1x, tp1y] = identity ? [p1x, p1y] : _transformPoint(p1x, p1y);
      const [tp2x, tp2y] = identity ? [p2x, p2y] : _transformPoint(p2x, p2y);

      vertBuf[base + 0] = tcx; vertBuf[base + 1] = tcy;
      vertBuf[base + 2] = cr; vertBuf[base + 3] = cg;
      vertBuf[base + 4] = cb; vertBuf[base + 5] = ca;
      vertBuf[base + 8] = tp1x; vertBuf[base + 9] = tp1y;
      vertBuf[base + 10] = cr; vertBuf[base + 11] = cg;
      vertBuf[base + 12] = cb; vertBuf[base + 13] = ca;
      vertBuf[base + 16] = tp2x; vertBuf[base + 17] = tp2y;
      vertBuf[base + 18] = cr; vertBuf[base + 19] = cg;
      vertBuf[base + 20] = cb; vertBuf[base + 21] = ca;
    }
    sdl.SDL_RenderGeometry(_renderer, null, ptr(vertBuf), numVerts, null, 0);
  }
}

/** Draw a polygon from flat vertex coordinates [x1, y1, x2, y2, ...]. */
export function polygon(mode: "fill" | "line", ...vertices: number[]): void {
  if (!_renderer || vertices.length < 6) return; // Need at least 3 points
  _statDrawCalls++;

  const numPoints = vertices.length / 2;
  const identity = _isIdentity();

  if (mode === "line") {
    const buf = new Float32Array(numPoints * 2);
    for (let i = 0; i < numPoints; i++) {
      const [tx, ty] = identity
        ? [vertices[i * 2], vertices[i * 2 + 1]]
        : _transformPoint(vertices[i * 2], vertices[i * 2 + 1]);
      buf[i * 2] = tx;
      buf[i * 2 + 1] = ty;
    }
    if (_lineStyle === "smooth") {
      _smoothLines(buf, numPoints, true);
    } else {
      // Rough: close by appending first point
      const closedBuf = new Float32Array((numPoints + 1) * 2);
      closedBuf.set(buf);
      closedBuf[numPoints * 2] = buf[0];
      closedBuf[numPoints * 2 + 1] = buf[1];
      sdl.SDL_RenderLines(_renderer, ptr(closedBuf), numPoints + 1);
    }
  } else {
    // Triangle fan from first vertex
    const numTris = numPoints - 2;
    const numVerts = numTris * 3;
    const vertBuf = new Float32Array(numVerts * 8);
    const [dr, dg, db, da] = _drawColor;
    const cr = dr / 255, cg = dg / 255, cb = db / 255, ca = da / 255;

    const [p0x, p0y] = identity
      ? [vertices[0], vertices[1]]
      : _transformPoint(vertices[0], vertices[1]);

    for (let i = 0; i < numTris; i++) {
      const base = i * 3 * 8;
      const [p1x, p1y] = identity
        ? [vertices[(i + 1) * 2], vertices[(i + 1) * 2 + 1]]
        : _transformPoint(vertices[(i + 1) * 2], vertices[(i + 1) * 2 + 1]);
      const [p2x, p2y] = identity
        ? [vertices[(i + 2) * 2], vertices[(i + 2) * 2 + 1]]
        : _transformPoint(vertices[(i + 2) * 2], vertices[(i + 2) * 2 + 1]);

      vertBuf[base + 0] = p0x; vertBuf[base + 1] = p0y;
      vertBuf[base + 2] = cr; vertBuf[base + 3] = cg;
      vertBuf[base + 4] = cb; vertBuf[base + 5] = ca;
      vertBuf[base + 8] = p1x; vertBuf[base + 9] = p1y;
      vertBuf[base + 10] = cr; vertBuf[base + 11] = cg;
      vertBuf[base + 12] = cb; vertBuf[base + 13] = ca;
      vertBuf[base + 16] = p2x; vertBuf[base + 17] = p2y;
      vertBuf[base + 18] = cr; vertBuf[base + 19] = cg;
      vertBuf[base + 20] = cb; vertBuf[base + 21] = ca;
    }
    sdl.SDL_RenderGeometry(_renderer, null, ptr(vertBuf), numVerts, null, 0);
  }
}

/** Draw a single pixel. */
export function point(x: number, y: number): void {
  if (!_renderer) return;
  const [tx, ty] = _isIdentity() ? [x, y] : _transformPoint(x, y);
  sdl.SDL_RenderPoint(_renderer, tx, ty);
}

/** Draw multiple points with optional per-point colors. */
export function points(...coords: number[]): void {
  if (!_renderer) return;
  _statDrawCalls++;
  const identity = _isIdentity();
  for (let i = 0; i < coords.length; i += 2) {
    const [tx, ty] = identity
      ? [coords[i], coords[i + 1]]
      : _transformPoint(coords[i], coords[i + 1]);
    sdl.SDL_RenderPoint(_renderer, tx, ty);
  }
}

/** Draw text at the given position. Uses TTF fonts when available, falls back to SDL debug text. */
export function print(text: string, x: number, y: number): void {
  if (!_renderer) return;
  _statDrawCalls++;

  if (_ttf && _ttfEngine && _currentFont) {
    _printTTF(String(text), x, y);
  } else {
    _printDebug(String(text), x, y);
  }
}

/**
 * Draw word-wrapped and aligned text (like love.graphics.printf).
 * align: "left" (default), "center", "right".
 */
export function printf(text: string, x: number, y: number, limit: number, align: "left" | "center" | "right" = "left"): void {
  if (!_renderer) return;
  _statDrawCalls++;

  if (_ttf && _ttfEngine && _currentFont) {
    _printfTTF(String(text), x, y, limit, align);
  } else {
    // Fallback: just print without wrapping
    _printDebug(String(text), x, y);
  }
}

function _printDebug(text: string, x: number, y: number): void {
  const lines = text.split("\n");
  const lineHeight = 8; // SDL debug font is 8px tall
  for (let i = 0; i < lines.length; i++) {
    const [tx, ty] = _isIdentity() ? [x, y + i * lineHeight] : _transformPoint(x, y + i * lineHeight);
    sdl.SDL_RenderDebugText(_renderer!, tx, ty, Buffer.from(lines[i] + "\0"));
  }
}

function _printTTF(text: string, x: number, y: number): void {
  const font = _currentFont!;
  const lineSkip = _ttf!.TTF_GetFontLineSkip(font._font);
  const lines = text.split("\n");
  const [dr, dg, db, da] = _drawColor;

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    if (lineText.length === 0) continue;

    const ttfText = _ttf!.TTF_CreateText(
      _ttfEngine!, font._font,
      Buffer.from(lineText + "\0"), 0,
    ) as Pointer | null;
    if (!ttfText) continue;

    _ttf!.TTF_SetTextColor(ttfText, dr, dg, db, da);
    const [tx, ty] = _isIdentity() ? [x, y + i * lineSkip] : _transformPoint(x, y + i * lineSkip);
    _ttf!.TTF_DrawRendererText(ttfText, tx, ty);
    _ttf!.TTF_DestroyText(ttfText);
  }
}

function _printfTTF(text: string, x: number, y: number, limit: number, align: "left" | "center" | "right"): void {
  const font = _currentFont!;
  const [, wrappedLines] = font.getWrap(text, limit);
  const lineSkip = _ttf!.TTF_GetFontLineSkip(font._font);
  const [dr, dg, db, da] = _drawColor;

  for (let i = 0; i < wrappedLines.length; i++) {
    const lineText = wrappedLines[i];
    if (lineText.length === 0) continue;

    const ttfText = _ttf!.TTF_CreateText(
      _ttfEngine!, font._font,
      Buffer.from(lineText + "\0"), 0,
    ) as Pointer | null;
    if (!ttfText) continue;

    _ttf!.TTF_SetTextColor(ttfText, dr, dg, db, da);

    let lx = x;
    if (align === "center" || align === "right") {
      const lineWidth = font.getWidth(lineText);
      if (align === "center") {
        lx = x + (limit - lineWidth) / 2;
      } else {
        lx = x + limit - lineWidth;
      }
    }

    const [tx, ty] = _isIdentity() ? [lx, y + i * lineSkip] : _transformPoint(lx, y + i * lineSkip);
    _ttf!.TTF_DrawRendererText(ttfText, tx, ty);
    _ttf!.TTF_DestroyText(ttfText);
  }
}

// ============================================================
// Font management
// ============================================================

/**
 * Create a new Font from a TTF file path and point size.
 * If only a number is passed, creates the default font at that size.
 */
export function newFont(pathOrSize?: string | number, size?: number): Font | null {
  if (!_ttf) return null;

  let fontPath: string;
  let fontSize: number;

  if (typeof pathOrSize === "number") {
    fontPath = _defaultFontPath;
    fontSize = pathOrSize;
  } else if (typeof pathOrSize === "string") {
    fontPath = pathOrSize;
    fontSize = size ?? _defaultFontSize;
  } else {
    fontPath = _defaultFontPath;
    fontSize = _defaultFontSize;
  }

  const fontPtr = _ttf.TTF_OpenFont(
    Buffer.from(fontPath + "\0"),
    fontSize,
  ) as Pointer | null;
  if (!fontPtr) return null;

  return _createFont(fontPtr, fontSize, _ttf);
}

/** Set the active font for drawing. */
export function setFont(font: Font): void {
  _currentFont = font;
}

/** Get the active font. */
export function getFont(): Font | null {
  return _currentFont;
}

/**
 * Create a cached Text object. Renders text to an internal Canvas so
 * subsequent draw() calls are cheap and support full transforms.
 */
export function newText(font: Font, text?: string): Text | null {
  if (!_ttf || !_ttfEngine || !_renderer) return null;

  let _font = font;
  let _segments: TextSegment[] = [];
  let _dirty = true;
  let _canvas: Canvas | null = null;
  let _w = 0;
  let _h = 0;

  if (text !== undefined && text.length > 0) {
    _segments.push({
      text,
      color: [..._drawColor] as [number, number, number, number],
      x: 0,
      y: 0,
      wrapLimit: 0,
      align: "left",
    });
  }

  function _computeBounds(): { width: number; height: number } {
    if (_segments.length === 0) return { width: 0, height: 0 };
    const lineSkip = _ttf!.TTF_GetFontLineSkip(_font._font);
    let maxRight = 0;
    let maxBottom = 0;

    for (const seg of _segments) {
      let segW: number;
      let segH: number;

      if (seg.wrapLimit > 0) {
        const [, lines] = _font.getWrap(seg.text, seg.wrapLimit);
        segW = seg.wrapLimit;
        segH = lines.length * lineSkip;
      } else {
        const lines = seg.text.split("\n");
        segW = 0;
        for (const line of lines) {
          const w = _font.getWidth(line);
          if (w > segW) segW = w;
        }
        segH = lines.length * lineSkip;
      }

      const right = seg.x + segW;
      const bottom = seg.y + segH;
      if (right > maxRight) maxRight = right;
      if (bottom > maxBottom) maxBottom = bottom;
    }

    return { width: Math.ceil(maxRight), height: Math.ceil(maxBottom) };
  }

  function _flush(): void {
    if (!_dirty) return;
    if (!_ttf || !_ttfEngine || !_renderer) return;
    _dirty = false;

    const bounds = _computeBounds();
    _w = bounds.width;
    _h = bounds.height;

    if (_w <= 0 || _h <= 0 || _segments.length === 0) {
      if (_canvas) { _canvas.release(); _canvas = null; }
      _w = 0;
      _h = 0;
      return;
    }

    // Create or resize canvas
    if (_canvas && (_canvas._width !== _w || _canvas._height !== _h)) {
      _canvas.release();
      _canvas = null;
    }
    if (!_canvas) {
      _canvas = newCanvas(_w, _h);
      if (!_canvas) return;
      _canvas.setFilter("linear", "linear");
    }

    // Save state
    const savedCanvas = _activeCanvas;
    const savedColor = [..._drawColor] as [number, number, number, number];
    const savedFont = _currentFont;
    const savedBlend = _blendMode;
    const savedTransform = _transform;

    // Set up for canvas rendering
    _transform = [1, 0, 0, 1, 0, 0];
    setCanvas(_canvas);
    sdl.SDL_SetRenderDrawColor(_renderer!, 0, 0, 0, 0);
    sdl.SDL_RenderClear(_renderer!);
    setBlendMode("alpha");
    _currentFont = _font;

    for (const seg of _segments) {
      setColor(seg.color[0], seg.color[1], seg.color[2], seg.color[3]);
      if (seg.wrapLimit > 0) {
        _printfTTF(seg.text, seg.x, seg.y, seg.wrapLimit, seg.align);
      } else {
        _printTTF(seg.text, seg.x, seg.y);
      }
    }

    // Restore state
    _transform = savedTransform;
    setCanvas(savedCanvas);
    _currentFont = savedFont;
    setColor(savedColor[0], savedColor[1], savedColor[2], savedColor[3]);
    setBlendMode(savedBlend);
  }

  const textObj: Text = {
    _isText: true as const,
    get _texture() { return _canvas?._texture ?? (null as unknown as SDLTexture); },
    get _width() { if (_dirty) _flush(); return _w; },
    get _height() { if (_dirty) _flush(); return _h; },

    set(text: string) {
      _segments = [{
        text,
        color: [..._drawColor] as [number, number, number, number],
        x: 0, y: 0,
        wrapLimit: 0,
        align: "left",
      }];
      _dirty = true;
    },

    setf(text: string, wraplimit: number, align: "left" | "center" | "right" = "left") {
      _segments = [{
        text,
        color: [..._drawColor] as [number, number, number, number],
        x: 0, y: 0,
        wrapLimit: wraplimit,
        align,
      }];
      _dirty = true;
    },

    add(text: string, x: number = 0, y: number = 0): number {
      _segments.push({
        text,
        color: [..._drawColor] as [number, number, number, number],
        x, y,
        wrapLimit: 0,
        align: "left",
      });
      _dirty = true;
      return _segments.length;
    },

    addf(text: string, wraplimit: number, align: "left" | "center" | "right", x: number = 0, y: number = 0): number {
      _segments.push({
        text,
        color: [..._drawColor] as [number, number, number, number],
        x, y,
        wrapLimit: wraplimit,
        align,
      });
      _dirty = true;
      return _segments.length;
    },

    clear() {
      _segments = [];
      _dirty = true;
    },

    getWidth(): number {
      if (_dirty) _flush();
      return _w;
    },

    getHeight(): number {
      if (_dirty) _flush();
      return _h;
    },

    getDimensions(): [number, number] {
      if (_dirty) _flush();
      return [_w, _h];
    },

    getFont(): Font {
      return _font;
    },

    setFont(font: Font) {
      _font = font;
      _dirty = true;
    },

    release() {
      if (_canvas) { _canvas.release(); _canvas = null; }
      _segments = [];
    },

    _flush,
  };

  return textObj;
}

// ============================================================
// Shader API
// ============================================================

/** Get the GPU device pointer (for shader module). Returns null if GPU renderer unavailable. */
export function _getGPUDevice(): Pointer | null {
  return _gpuDevice;
}

/**
 * Create a shader from love2d-style GLSL fragment code.
 * Returns null if the GPU renderer is not available.
 *
 * Note: This is async because SPIR-V compilation may require async WASM initialization.
 */
export async function newShader(
  fragmentCode: string
): Promise<Shader | null> {
  if (!_renderer || !_gpuDevice) return null;
  return createShader(fragmentCode, _renderer, _gpuDevice);
}

/** Set the active shader for subsequent draw calls. Pass null to disable. */
export function setShader(shader: Shader | null): void {
  if (!_renderer) return;
  _activeShader = shader;
  sdl.SDL_SetGPURenderState(_renderer, shader ? shader._state : null);
}

/** Get the active shader, or null if none. */
export function getShader(): Shader | null {
  return _activeShader;
}

// ============================================================
// Window size helpers
// ============================================================

/** Get the window width. */
export function getWidth(): number {
  return getMode().width;
}

/** Get the window height. */
export function getHeight(): number {
  return getMode().height;
}

/** Get the window dimensions. */
export function getDimensions(): [number, number] {
  const mode = getMode();
  return [mode.width, mode.height];
}

// Pre-allocated buffers for pixel dimension queries
const _pixW = new Int32Array(1);
const _pixH = new Int32Array(1);
const _pixWPtr = ptr(_pixW);
const _pixHPtr = ptr(_pixH);

/** Get the window width in pixels (not DPI-scaled). */
export function getPixelWidth(): number {
  if (!_renderer) return 0;
  sdl.SDL_GetRenderOutputSize(_renderer, _pixWPtr, _pixHPtr);
  return read.i32(_pixWPtr, 0);
}

/** Get the window height in pixels (not DPI-scaled). */
export function getPixelHeight(): number {
  if (!_renderer) return 0;
  sdl.SDL_GetRenderOutputSize(_renderer, _pixWPtr, _pixHPtr);
  return read.i32(_pixHPtr, 0);
}

/** Get the window dimensions in pixels (not DPI-scaled). */
export function getPixelDimensions(): [number, number] {
  if (!_renderer) return [0, 0];
  sdl.SDL_GetRenderOutputSize(_renderer, _pixWPtr, _pixHPtr);
  return [read.i32(_pixWPtr, 0), read.i32(_pixHPtr, 0)];
}

/** Get the DPI scale factor of the window. */
export function getDPIScale(): number {
  const win = _getSDLWindow();
  if (!win) return 1.0;
  return sdl.SDL_GetWindowDisplayScale(win);
}

/** Get renderer information. Returns name, version, vendor, device. */
export function getRendererInfo(): { name: string; version: string; vendor: string; device: string } {
  const name = _renderer ? String(sdl.SDL_GetRendererName(_renderer) ?? "") : "";
  const device = _gpuDevice ? String(sdl.SDL_GetGPUDeviceDriver(_gpuDevice) ?? "") : "";
  return { name, version: "SDL3", vendor: device, device };
}

// Stats tracking (reset each frame in _beginFrame)
let _statDrawCalls = 0;
let _statCanvasSwitches = 0;

/** Increment draw call counter (called internally). */
export function _statDraw(): void { _statDrawCalls++; }
/** Increment canvas switch counter (called internally). */
export function _statCanvasSwitch(): void { _statCanvasSwitches++; }
/** Reset stats at start of frame (called internally). */
export function _statReset(): void { _statDrawCalls = 0; _statCanvasSwitches = 0; }

/** Get rendering statistics for the current frame. */
export function getStats(): { drawcalls: number; canvasswitches: number; texturememory: number; images: number; canvases: number; fonts: number } {
  return {
    drawcalls: _statDrawCalls,
    canvasswitches: _statCanvasSwitches,
    texturememory: 0, // not tracked
    images: 0, // not tracked
    canvases: 0, // not tracked
    fonts: 0, // not tracked
  };
}

// ============================================================
// Internal helpers for transformed drawing
// ============================================================

function _fillQuad(corners: [number, number][]): void {
  if (!_renderer) return;
  const [dr, dg, db, da] = _drawColor;
  const cr = dr / 255, cg = dg / 255, cb = db / 255, ca = da / 255;

  // 2 triangles (0,1,2) and (0,2,3)
  const vertBuf = new Float32Array(6 * 8);
  const indices = [0, 1, 2, 0, 2, 3];
  for (let t = 0; t < 6; t++) {
    const i = indices[t];
    const base = t * 8;
    vertBuf[base + 0] = corners[i][0];
    vertBuf[base + 1] = corners[i][1];
    vertBuf[base + 2] = cr;
    vertBuf[base + 3] = cg;
    vertBuf[base + 4] = cb;
    vertBuf[base + 5] = ca;
  }
  sdl.SDL_RenderGeometry(_renderer, null, ptr(vertBuf), 6, null, 0);
}

function _strokePolygon(corners: [number, number][]): void {
  if (!_renderer) return;
  const buf = new Float32Array(corners.length * 2);
  for (let i = 0; i < corners.length; i++) {
    buf[i * 2] = corners[i][0];
    buf[i * 2 + 1] = corners[i][1];
  }
  if (_lineStyle === "smooth") {
    _smoothLines(buf, corners.length, true);
  } else {
    const closedBuf = new Float32Array((corners.length + 1) * 2);
    closedBuf.set(buf);
    closedBuf[corners.length * 2] = corners[0][0];
    closedBuf[corners.length * 2 + 1] = corners[0][1];
    sdl.SDL_RenderLines(_renderer, ptr(closedBuf), corners.length + 1);
  }
}

// ============================================================
// Screenshot capture
// ============================================================

type CaptureRequest =
  | { kind: "file"; path: string }
  | { kind: "callback"; fn: (imageData: BaseImageData) => void };

const _pendingCaptures: CaptureRequest[] = [];

/**
 * Queue a screenshot capture. Matches love.graphics.captureScreenshot().
 *
 * - `captureScreenshot("path.png")` — saves to file (PNG or BMP based on extension)
 * - `captureScreenshot(callback)` — calls back with raw pixel data
 *
 * The actual capture happens at the end of the current frame (after draw()).
 */
export function captureScreenshot(target: string | ((imageData: BaseImageData) => void)): void {
  if (typeof target === "string") {
    _pendingCaptures.push({ kind: "file", path: target });
  } else {
    _pendingCaptures.push({ kind: "callback", fn: target });
  }
}

/**
 * Flush all pending screenshot captures. Called internally by _endFrame()
 * — do not call directly.
 */
export function _flushCaptures(): void {
  if (_pendingCaptures.length === 0) return;

  if (!_renderer) {
    _pendingCaptures.length = 0;
    return;
  }

  // SDL_RenderReadPixels returns a new SDL_Surface* (caller must free it)
  const surface = sdl.SDL_RenderReadPixels(_renderer, null) as Pointer | null;
  if (!surface) {
    _pendingCaptures.length = 0;
    return;
  }

  while (_pendingCaptures.length > 0) {
    const req = _pendingCaptures.shift()!;

    if (req.kind === "file") {
      const pathBuf = Buffer.from(req.path + "\0");
      const ext = req.path.toLowerCase();
      if (ext.endsWith(".bmp")) {
        sdl.SDL_SaveBMP(surface, pathBuf);
      } else {
        sdl.SDL_SavePNG(surface, pathBuf);
      }
    } else {
      if (!sdl.SDL_LockSurface(surface)) continue;

      const w = read.i32(surface, SDL_SURFACE_OFFSET_W);
      const h = read.i32(surface, SDL_SURFACE_OFFSET_H);
      const pitch = read.i32(surface, SDL_SURFACE_OFFSET_PITCH);
      const pixelsPtr = read.ptr(surface, SDL_SURFACE_OFFSET_PIXELS);
      const formatVal = read.u32(surface, SDL_SURFACE_OFFSET_FORMAT);

      const format = PIXEL_FORMAT_NAMES[formatVal] ?? `unknown(0x${formatVal.toString(16)})`;

      if (pixelsPtr) {
        const size = pitch * h;
        const rawBuf = toArrayBuffer(pixelsPtr, 0, size);
        const data = new Uint8Array(rawBuf.slice(0));
        req.fn({ data, width: w, height: h, format });
      }

      sdl.SDL_UnlockSurface(surface);
    }
  }

  sdl.SDL_DestroySurface(surface);
}
