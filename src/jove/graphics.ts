// jove2d graphics module — renderer lifecycle, drawing primitives, transform stack,
// image loading, canvases, blend modes, scissor, and screenshot capture

import { ptr, read, toArrayBuffer } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import { resolve } from "path";
import sdl from "../sdl/ffi.ts";
import { loadTTF } from "../sdl/ffi_ttf.ts";
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
} from "../sdl/types.ts";
import type { SDLRenderer, SDLTexture } from "../sdl/types.ts";
import { _getSDLWindow, getMode } from "./window.ts";
import type { ImageData } from "./types.ts";

// ============================================================
// Internal renderer state
// ============================================================

let _renderer: SDLRenderer | null = null;
let _bgColor: [number, number, number, number] = [0, 0, 0, 255];
let _drawColor: [number, number, number, number] = [255, 255, 255, 255];
let _lineWidth = 1;
let _pointSize = 1;

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

export type FilterMode = "nearest" | "linear";

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

let _activeCanvas: Canvas | null = null;

/** Create a new off-screen canvas (render target). */
export function newCanvas(w: number, h: number): Canvas | null {
  if (!_renderer) return null;
  const texture = sdl.SDL_CreateTexture(
    _renderer, SDL_PIXELFORMAT_RGBA8888, SDL_TEXTUREACCESS_TARGET, w, h
  ) as SDLTexture | null;
  if (!texture) return null;

  sdl.SDL_SetTextureBlendMode(texture, SDL_BLENDMODE_BLEND);

  const base = _createImageObject(texture, w, h);
  return {
    ...base,
    _isCanvas: true as const,
  };
}

/** Set the active canvas (render target). Pass null to render to screen. */
export function setCanvas(canvas: Canvas | null): void {
  if (!_renderer) return;
  _activeCanvas = canvas;
  sdl.SDL_SetRenderTarget(_renderer, canvas ? canvas._texture : null);
}

/** Get the active canvas (null = rendering to screen). */
export function getCanvas(): Canvas | null {
  return _activeCanvas;
}

// ============================================================
// Image loading
// ============================================================

// Buffers for SDL_GetTextureSize
const _texWBuf = new Float32Array(1);
const _texHBuf = new Float32Array(1);
const _texWPtr = ptr(_texWBuf);
const _texHPtr = ptr(_texHBuf);

/** Load an image from a BMP file and return an Image object. */
export function newImage(path: string): Image | null {
  if (!_renderer) return null;
  const surface = sdl.SDL_LoadBMP(Buffer.from(path + "\0")) as Pointer | null;
  if (!surface) return null;

  const texture = sdl.SDL_CreateTextureFromSurface(_renderer, surface) as SDLTexture | null;
  sdl.SDL_DestroySurface(surface);
  if (!texture) return null;

  sdl.SDL_SetTextureBlendMode(texture, SDL_BLENDMODE_BLEND);

  // Get texture dimensions
  sdl.SDL_GetTextureSize(texture, _texWPtr, _texHPtr);
  const w = read.f32(_texWPtr, 0);
  const h = read.f32(_texHPtr, 0);

  return _createImageObject(texture, Math.round(w), Math.round(h));
}

// ============================================================
// Drawing images (the draw() function)
// ============================================================

/**
 * Draw a drawable (Image or Canvas) at the given position with optional transform.
 *
 * Overloads:
 * - draw(drawable, x, y, r, sx, sy, ox, oy)
 * - draw(drawable, quad, x, y, r, sx, sy, ox, oy)
 */
export function draw(
  drawable: Image,
  quadOrX?: Quad | number,
  xOrY?: number,
  yOrR?: number,
  rOrSx?: number,
  sxOrSy?: number,
  syOrOx?: number,
  oxOrOy?: number,
  oyOrKx?: number,
): void {
  if (!_renderer || !drawable?._texture) return;

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

  // Color (already modulated via texture color mod, use white here)
  const cr = 1.0, cg = 1.0, cb = 1.0, ca = 1.0;

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
  _renderer = sdl.SDL_CreateRenderer(win, null) as SDLRenderer | null;
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
  _activeCanvas = null;
  _transformStack.length = 0;
  _transform = [1, 0, 0, 1, 0, 0];
}

/** Begin a frame: clear with background color. */
export function _beginFrame(): void {
  if (!_renderer) return;
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

  if (_isIdentity()) {
    // Fast path: no transform
    _rectBuf[0] = x;
    _rectBuf[1] = y;
    _rectBuf[2] = w;
    _rectBuf[3] = h;
    const p = ptr(_rectBuf);
    if (mode === "fill") {
      sdl.SDL_RenderFillRect(_renderer, p);
    } else {
      sdl.SDL_RenderRect(_renderer, p);
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

  if (_isIdentity()) {
    if (coords.length === 4) {
      sdl.SDL_RenderLine(_renderer, coords[0], coords[1], coords[2], coords[3]);
      return;
    }
    const numPoints = coords.length / 2;
    const buf = new Float32Array(numPoints * 2);
    for (let i = 0; i < coords.length; i++) {
      buf[i] = coords[i];
    }
    sdl.SDL_RenderLines(_renderer, ptr(buf), numPoints);
  } else {
    // Transform all points
    const numPoints = coords.length / 2;
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
  const n = segments ?? Math.min(256, Math.max(16, Math.ceil(radius * 2)));
  const angleStep = (Math.PI * 2) / n;

  if (mode === "line") {
    const buf = new Float32Array((n + 1) * 2);
    for (let i = 0; i <= n; i++) {
      const angle = i * angleStep;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      const [tx, ty] = _isIdentity() ? [px, py] : _transformPoint(px, py);
      buf[i * 2] = tx;
      buf[i * 2 + 1] = ty;
    }
    sdl.SDL_RenderLines(_renderer, ptr(buf), n + 1);
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
  const n = segments ?? Math.min(256, Math.max(16, Math.ceil(Math.max(rx, ry) * 2)));
  const angleStep = (Math.PI * 2) / n;

  if (mode === "line") {
    const buf = new Float32Array((n + 1) * 2);
    for (let i = 0; i <= n; i++) {
      const angle = i * angleStep;
      const px = cx + Math.cos(angle) * rx;
      const py = cy + Math.sin(angle) * ry;
      const [tx, ty] = _isIdentity() ? [px, py] : _transformPoint(px, py);
      buf[i * 2] = tx;
      buf[i * 2 + 1] = ty;
    }
    sdl.SDL_RenderLines(_renderer, ptr(buf), n + 1);
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
  const arcLength = angle2 - angle1;
  const n = segments ?? Math.min(256, Math.max(8, Math.ceil(Math.abs(arcLength) * radius)));
  const angleStep = arcLength / n;
  const identity = _isIdentity();
  const type = arctype ?? (mode === "line" ? "open" : "pie");

  if (mode === "line") {
    if (type === "pie") {
      // Lines from center → arc → back to center
      const buf = new Float32Array((n + 3) * 2);
      const [tcx, tcy] = identity ? [cx, cy] : _transformPoint(cx, cy);
      buf[0] = tcx;
      buf[1] = tcy;
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
      // Arc curve with a chord connecting the endpoints
      const buf = new Float32Array((n + 2) * 2);
      for (let i = 0; i <= n; i++) {
        const angle = angle1 + i * angleStep;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        const [tx, ty] = identity ? [px, py] : _transformPoint(px, py);
        buf[i * 2] = tx;
        buf[i * 2 + 1] = ty;
      }
      // Close back to first arc point
      buf[(n + 1) * 2] = buf[0];
      buf[(n + 1) * 2 + 1] = buf[1];
      sdl.SDL_RenderLines(_renderer, ptr(buf), n + 2);
    } else {
      // "open" — just the arc curve, no closing lines
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

  const numPoints = vertices.length / 2;
  const identity = _isIdentity();

  if (mode === "line") {
    // Close the polygon by adding the first point at the end
    const buf = new Float32Array((numPoints + 1) * 2);
    for (let i = 0; i < numPoints; i++) {
      const [tx, ty] = identity
        ? [vertices[i * 2], vertices[i * 2 + 1]]
        : _transformPoint(vertices[i * 2], vertices[i * 2 + 1]);
      buf[i * 2] = tx;
      buf[i * 2 + 1] = ty;
    }
    // Close
    buf[numPoints * 2] = buf[0];
    buf[numPoints * 2 + 1] = buf[1];
    sdl.SDL_RenderLines(_renderer, ptr(buf), numPoints + 1);
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
  const buf = new Float32Array((corners.length + 1) * 2);
  for (let i = 0; i < corners.length; i++) {
    buf[i * 2] = corners[i][0];
    buf[i * 2 + 1] = corners[i][1];
  }
  buf[corners.length * 2] = corners[0][0];
  buf[corners.length * 2 + 1] = corners[0][1];
  sdl.SDL_RenderLines(_renderer, ptr(buf), corners.length + 1);
}

// ============================================================
// Screenshot capture
// ============================================================

type CaptureRequest =
  | { kind: "file"; path: string }
  | { kind: "callback"; fn: (imageData: ImageData) => void };

const _pendingCaptures: CaptureRequest[] = [];

/**
 * Queue a screenshot capture. Matches love.graphics.captureScreenshot().
 *
 * - `captureScreenshot("path.png")` — saves to file (PNG or BMP based on extension)
 * - `captureScreenshot(callback)` — calls back with raw pixel data
 *
 * The actual capture happens at the end of the current frame (after draw()).
 */
export function captureScreenshot(target: string | ((imageData: ImageData) => void)): void {
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
