// jove2d ParticleSystem — love2d-compatible particle emitter
//
// Structure-of-Arrays (SoA) layout for cache-friendly iteration.
// Compact-swap pool: active particles at [0, _count), dead swapped to end.
// Renders via SDL_RenderGeometry (same vertex format as SpriteBatch).

import { newRandomGenerator } from "./math.ts";
import type { RandomGenerator } from "./math.ts";
import type { Image, Quad } from "./graphics.ts";

// ============================================================
// Types
// ============================================================

export type EmissionAreaDistribution =
  | "none"
  | "uniform"
  | "normal"
  | "ellipse"
  | "borderellipse"
  | "borderrectangle";

export type InsertMode = "top" | "bottom" | "random";

export interface ParticleSystem {
  _isParticleSystem: true;
  _texture: import("../sdl/types.ts").SDLTexture;

  // Lifecycle
  start(): void;
  stop(): void;
  pause(): void;
  reset(): void;
  isActive(): boolean;
  isPaused(): boolean;
  isStopped(): boolean;

  // Emission
  setEmissionRate(rate: number): void;
  getEmissionRate(): number;
  setEmitterLifetime(lifetime: number): void;
  getEmitterLifetime(): number;
  setParticleLifetime(min: number, max?: number): void;
  getParticleLifetime(): [number, number];

  // Position
  setPosition(x: number, y: number): void;
  getPosition(): [number, number];
  moveTo(x: number, y: number): void;
  setEmissionArea(distribution: EmissionAreaDistribution, dx: number, dy: number, angle?: number, directionRelative?: boolean): void;
  getEmissionArea(): [EmissionAreaDistribution, number, number, number, boolean];

  // Physics
  setDirection(direction: number): void;
  getDirection(): number;
  setSpeed(min: number, max?: number): void;
  getSpeed(): [number, number];
  setSpread(spread: number): void;
  getSpread(): number;
  setLinearAcceleration(xmin: number, ymin: number, xmax?: number, ymax?: number): void;
  getLinearAcceleration(): [number, number, number, number];
  setLinearDamping(min: number, max?: number): void;
  getLinearDamping(): [number, number];
  setRadialAcceleration(min: number, max?: number): void;
  getRadialAcceleration(): [number, number];
  setTangentialAcceleration(min: number, max?: number): void;
  getTangentialAcceleration(): [number, number];

  // Visual
  setTexture(texture: Image): void;
  getTexture(): Image;
  setColors(...rgba: number[]): void;
  getColors(): number[];
  setSizes(...sizes: number[]): void;
  getSizes(): number[];
  setSizeVariation(variation: number): void;
  getSizeVariation(): number;
  setRotation(min: number, max?: number): void;
  getRotation(): [number, number];
  setSpin(min: number, max?: number): void;
  getSpin(): [number, number];
  setSpinVariation(variation: number): void;
  getSpinVariation(): number;
  setRelativeRotation(enable: boolean): void;
  hasRelativeRotation(): boolean;
  setOffset(ox: number, oy: number): void;
  getOffset(): [number, number];
  setQuads(...quads: Quad[]): void;
  getQuads(): Quad[];

  // Buffer
  setBufferSize(size: number): void;
  getBufferSize(): number;
  emit(count: number): void;
  getCount(): number;

  // Other
  setInsertMode(mode: InsertMode): void;
  getInsertMode(): InsertMode;
  clone(): ParticleSystem;
  update(dt: number): void;

  // Internal — used by graphics.ts draw dispatch
  _getVertexData(): { vertices: Float32Array; indices: Int32Array; numVerts: number; numIndices: number } | null;
}

// ============================================================
// Constants
// ============================================================

const FLOATS_PER_VERTEX = 8; // x, y, r, g, b, a, u, v
const VERTS_PER_PARTICLE = 4;
const INDICES_PER_PARTICLE = 6;
const FLOATS_PER_PARTICLE = VERTS_PER_PARTICLE * FLOATS_PER_VERTEX; // 32

const MAX_COLORS = 8;
const MAX_SIZES = 8;

// ============================================================
// Factory
// ============================================================

export function createParticleSystem(image: Image, maxParticles: number): ParticleSystem {
  const rng: RandomGenerator = newRandomGenerator(Date.now());

  // --- Emitter config ---
  let _image = image;
  let _maxParticles = maxParticles;

  let _emissionRate = 0;
  let _emitterLifetime = -1; // -1 = infinite
  let _emitterLife = -1;     // remaining emitter life
  let _particleLifeMin = 0;
  let _particleLifeMax = 0;

  // Position
  let _posX = 0;
  let _posY = 0;
  let _prevPosX = 0;
  let _prevPosY = 0;

  // Emission area
  let _areaDist: EmissionAreaDistribution = "none";
  let _areaDX = 0;
  let _areaDY = 0;
  let _areaAngle = 0;
  let _areaRelative = false;

  // Physics
  let _direction = 0;
  let _speedMin = 0;
  let _speedMax = 0;
  let _spread = 0;
  let _linAccXMin = 0;
  let _linAccYMin = 0;
  let _linAccXMax = 0;
  let _linAccYMax = 0;
  let _dampingMin = 0;
  let _dampingMax = 0;
  let _radAccMin = 0;
  let _radAccMax = 0;
  let _tanAccMin = 0;
  let _tanAccMax = 0;

  // Visual
  let _colors: number[] = [255, 255, 255, 255]; // RGBA 0-255
  let _numColors = 1;
  let _sizes: number[] = [1];
  let _numSizes = 1;
  let _sizeVariation = 0;
  let _rotationMin = 0;
  let _rotationMax = 0;
  let _spinMin = 0;
  let _spinMax = 0;
  let _spinVariation = 0;
  let _relativeRotation = false;
  let _offsetX = 0;
  let _offsetY = 0;
  let _quads: Quad[] = [];

  // Insert mode
  let _insertMode: InsertMode = "top";

  // State
  let _active = false;
  let _paused = false;
  let _emitCounter = 0;

  // --- SoA particle data ---
  let _count = 0;
  let _posXArr = new Float32Array(_maxParticles);
  let _posYArr = new Float32Array(_maxParticles);
  let _originXArr = new Float32Array(_maxParticles);
  let _originYArr = new Float32Array(_maxParticles);
  let _velXArr = new Float32Array(_maxParticles);
  let _velYArr = new Float32Array(_maxParticles);
  let _accelXArr = new Float32Array(_maxParticles);
  let _accelYArr = new Float32Array(_maxParticles);
  let _radAccArr = new Float32Array(_maxParticles);
  let _tanAccArr = new Float32Array(_maxParticles);
  let _dampingArr = new Float32Array(_maxParticles);
  let _lifeArr = new Float32Array(_maxParticles);
  let _lifetimeArr = new Float32Array(_maxParticles);
  let _rotationArr = new Float32Array(_maxParticles);
  let _spinStartArr = new Float32Array(_maxParticles);
  let _spinEndArr = new Float32Array(_maxParticles);
  let _sizeOffsetArr = new Float32Array(_maxParticles);
  let _sizeIntervalArr = new Float32Array(_maxParticles);
  let _quadIdxArr = new Int32Array(_maxParticles);

  // --- Vertex / index buffers ---
  let _vertexData = new Float32Array(_maxParticles * FLOATS_PER_PARTICLE);
  let _indexData = _buildIndexPattern(_maxParticles);

  // --- Helpers ---

  function _randomRange(min: number, max: number): number {
    if (min === max) return min;
    return min + rng.random() * (max - min);
  }

  function _initParticle(t: number): void {
    // Find insertion index
    let idx: number;
    if (_insertMode === "top") {
      idx = _count;
    } else if (_insertMode === "bottom") {
      // Shift all particles up by 1
      if (_count > 0 && _count < _maxParticles) {
        for (let a = _count; a > 0; a--) {
          _copyParticle(a - 1, a);
        }
      }
      idx = 0;
    } else {
      // random — insert at random position
      idx = _count === 0 ? 0 : Math.floor(rng.random() * (_count + 1));
      if (idx < _count) {
        // Shift from idx to _count
        for (let a = _count; a > idx; a--) {
          _copyParticle(a - 1, a);
        }
      }
    }
    _count++;

    // Lerp emitter position for smooth emission across movement
    const px = _prevPosX + (_posX - _prevPosX) * t;
    const py = _prevPosY + (_posY - _prevPosY) * t;

    // Emission area offset
    let offX = 0;
    let offY = 0;
    if (_areaDist !== "none") {
      switch (_areaDist) {
        case "uniform":
          offX = _randomRange(-_areaDX, _areaDX);
          offY = _randomRange(-_areaDY, _areaDY);
          break;
        case "normal":
          offX = rng.randomNormal(1) * _areaDX;
          offY = rng.randomNormal(1) * _areaDY;
          break;
        case "ellipse": {
          const angle = rng.random() * Math.PI * 2;
          const r = Math.sqrt(rng.random());
          offX = Math.cos(angle) * _areaDX * r;
          offY = Math.sin(angle) * _areaDY * r;
          break;
        }
        case "borderellipse": {
          const angle = rng.random() * Math.PI * 2;
          offX = Math.cos(angle) * _areaDX;
          offY = Math.sin(angle) * _areaDY;
          break;
        }
        case "borderrectangle": {
          // Pick a random point on the rectangle perimeter
          const perim = 2 * (_areaDX + _areaDY);
          let p = rng.random() * perim;
          if (p < _areaDX) {
            offX = p - _areaDX / 2;
            offY = -_areaDY;
          } else if (p < _areaDX + _areaDY) {
            offX = _areaDX;
            offY = (p - _areaDX) - _areaDY / 2;
          } else if (p < 2 * _areaDX + _areaDY) {
            offX = (2 * _areaDX + _areaDY - p) - _areaDX / 2;
            offY = _areaDY;
          } else {
            offX = -_areaDX;
            offY = (perim - p) - _areaDY / 2;
          }
          break;
        }
      }
      // Rotate area offset by area angle
      if (_areaAngle !== 0) {
        const cos = Math.cos(_areaAngle);
        const sin = Math.sin(_areaAngle);
        const rx = offX * cos - offY * sin;
        const ry = offX * sin + offY * cos;
        offX = rx;
        offY = ry;
      }
    }

    _posXArr[idx] = px + offX;
    _posYArr[idx] = py + offY;
    _originXArr[idx] = px + offX;
    _originYArr[idx] = py + offY;

    // Lifetime
    const lifetime = _randomRange(_particleLifeMin, _particleLifeMax);
    _lifetimeArr[idx] = lifetime;
    _lifeArr[idx] = lifetime;

    // Direction + spread + speed
    let dir = _direction;
    if (_areaRelative && _areaDist !== "none") {
      dir += Math.atan2(offY, offX);
    }
    const spreadAngle = dir + _randomRange(-_spread / 2, _spread / 2);
    const speed = _randomRange(_speedMin, _speedMax);
    _velXArr[idx] = Math.cos(spreadAngle) * speed;
    _velYArr[idx] = Math.sin(spreadAngle) * speed;

    // Linear acceleration
    _accelXArr[idx] = _randomRange(_linAccXMin, _linAccXMax);
    _accelYArr[idx] = _randomRange(_linAccYMin, _linAccYMax);

    // Radial / tangential acceleration
    _radAccArr[idx] = _randomRange(_radAccMin, _radAccMax);
    _tanAccArr[idx] = _randomRange(_tanAccMin, _tanAccMax);

    // Damping
    _dampingArr[idx] = _randomRange(_dampingMin, _dampingMax);

    // Rotation
    _rotationArr[idx] = _randomRange(_rotationMin, _rotationMax);

    // Spin
    const spinBase = _randomRange(_spinMin, _spinMax);
    const spinRange = spinBase * _spinVariation;
    _spinStartArr[idx] = spinBase - spinRange;
    _spinEndArr[idx] = spinBase + spinRange;

    // Size variation
    const sizeVar = _sizeVariation * rng.random();
    _sizeOffsetArr[idx] = sizeVar;
    _sizeIntervalArr[idx] = 1 - sizeVar;

    // Quad index
    _quadIdxArr[idx] = _quads.length > 0 ? Math.floor(rng.random() * _quads.length) : -1;
  }

  function _copyParticle(from: number, to: number): void {
    _posXArr[to] = _posXArr[from];
    _posYArr[to] = _posYArr[from];
    _originXArr[to] = _originXArr[from];
    _originYArr[to] = _originYArr[from];
    _velXArr[to] = _velXArr[from];
    _velYArr[to] = _velYArr[from];
    _accelXArr[to] = _accelXArr[from];
    _accelYArr[to] = _accelYArr[from];
    _radAccArr[to] = _radAccArr[from];
    _tanAccArr[to] = _tanAccArr[from];
    _dampingArr[to] = _dampingArr[from];
    _lifeArr[to] = _lifeArr[from];
    _lifetimeArr[to] = _lifetimeArr[from];
    _rotationArr[to] = _rotationArr[from];
    _spinStartArr[to] = _spinStartArr[from];
    _spinEndArr[to] = _spinEndArr[from];
    _sizeOffsetArr[to] = _sizeOffsetArr[from];
    _sizeIntervalArr[to] = _sizeIntervalArr[from];
    _quadIdxArr[to] = _quadIdxArr[from];
  }

  function _removeParticle(idx: number): void {
    _count--;
    if (idx < _count) {
      // Swap with last active particle
      _copyParticle(_count, idx);
    }
  }

  function _resizeArrays(newSize: number): void {
    const copyCount = Math.min(_count, newSize);
    function resize(old: Float32Array): Float32Array {
      const arr = new Float32Array(newSize);
      arr.set(old.subarray(0, copyCount));
      return arr;
    }
    function resizeI32(old: Int32Array): Int32Array {
      const arr = new Int32Array(newSize);
      arr.set(old.subarray(0, copyCount));
      return arr;
    }
    _posXArr = resize(_posXArr);
    _posYArr = resize(_posYArr);
    _originXArr = resize(_originXArr);
    _originYArr = resize(_originYArr);
    _velXArr = resize(_velXArr);
    _velYArr = resize(_velYArr);
    _accelXArr = resize(_accelXArr);
    _accelYArr = resize(_accelYArr);
    _radAccArr = resize(_radAccArr);
    _tanAccArr = resize(_tanAccArr);
    _dampingArr = resize(_dampingArr);
    _lifeArr = resize(_lifeArr);
    _lifetimeArr = resize(_lifetimeArr);
    _rotationArr = resize(_rotationArr);
    _spinStartArr = resize(_spinStartArr);
    _spinEndArr = resize(_spinEndArr);
    _sizeOffsetArr = resize(_sizeOffsetArr);
    _sizeIntervalArr = resize(_sizeIntervalArr);
    _quadIdxArr = resizeI32(_quadIdxArr);

    _vertexData = new Float32Array(newSize * FLOATS_PER_PARTICLE);
    _indexData = _buildIndexPattern(newSize);
    _maxParticles = newSize;
    if (_count > newSize) _count = newSize;
  }

  function _interpolateColor(t: number): [number, number, number, number] {
    if (_numColors === 1) {
      return [_colors[0], _colors[1], _colors[2], _colors[3]];
    }
    const segment = t * (_numColors - 1);
    const i = Math.min(Math.floor(segment), _numColors - 2);
    const frac = segment - i;
    const i0 = i * 4;
    const i1 = (i + 1) * 4;
    return [
      _colors[i0] + (_colors[i1] - _colors[i0]) * frac,
      _colors[i0 + 1] + (_colors[i1 + 1] - _colors[i0 + 1]) * frac,
      _colors[i0 + 2] + (_colors[i1 + 2] - _colors[i0 + 2]) * frac,
      _colors[i0 + 3] + (_colors[i1 + 3] - _colors[i0 + 3]) * frac,
    ];
  }

  function _interpolateSize(t: number, sizeOffset: number, sizeInterval: number): number {
    const adjT = sizeOffset + t * sizeInterval;
    if (_numSizes === 1) {
      return _sizes[0];
    }
    const segment = adjT * (_numSizes - 1);
    const i = Math.min(Math.floor(segment), _numSizes - 2);
    const frac = segment - i;
    return _sizes[i] + (_sizes[i + 1] - _sizes[i]) * frac;
  }

  function _buildVertices(): number {
    if (_count === 0) return 0;

    // Get texture dimensions for UV computation
    const texW = _image._width;
    const texH = _image._height;

    for (let i = 0; i < _count; i++) {
      const life = _lifeArr[i];
      const lifetime = _lifetimeArr[i];
      const t = lifetime > 0 ? 1 - life / lifetime : 0; // 0=born, 1=dead

      // Color interpolation (0-255 internally, convert to 0-1 for vertex data)
      const [cr, cg, cb, ca] = _interpolateColor(t);
      const r01 = cr / 255;
      const g01 = cg / 255;
      const b01 = cb / 255;
      const a01 = ca / 255;

      // Size interpolation
      const size = _interpolateSize(t, _sizeOffsetArr[i], _sizeIntervalArr[i]);

      // Quad region
      let srcX = 0, srcY = 0, srcW = texW, srcH = texH;
      const qi = _quadIdxArr[i];
      if (qi >= 0 && qi < _quads.length) {
        const q = _quads[qi];
        srcX = q._x; srcY = q._y; srcW = q._w; srcH = q._h;
      }

      const u0 = srcX / texW;
      const v0 = srcY / texH;
      const u1 = (srcX + srcW) / texW;
      const v1 = (srcY + srcH) / texH;

      // Half-sizes for quad corners
      const hw = (srcW * size) / 2;
      const hh = (srcH * size) / 2;

      // Rotation
      const rot = _rotationArr[i];
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);

      // Position with offset
      const px = _posXArr[i];
      const py = _posYArr[i];

      // 4 corners: TL, TR, BR, BL (relative to center, with offset)
      const cx0 = -hw - _offsetX * size;
      const cy0 = -hh - _offsetY * size;
      const cx1 = hw - _offsetX * size;
      const cy1 = -hh - _offsetY * size;
      const cx2 = hw - _offsetX * size;
      const cy2 = hh - _offsetY * size;
      const cx3 = -hw - _offsetX * size;
      const cy3 = hh - _offsetY * size;

      const base = i * FLOATS_PER_PARTICLE;

      // Vertex 0: TL
      _vertexData[base + 0] = cx0 * cos - cy0 * sin + px;
      _vertexData[base + 1] = cx0 * sin + cy0 * cos + py;
      _vertexData[base + 2] = r01;
      _vertexData[base + 3] = g01;
      _vertexData[base + 4] = b01;
      _vertexData[base + 5] = a01;
      _vertexData[base + 6] = u0;
      _vertexData[base + 7] = v0;

      // Vertex 1: TR
      _vertexData[base + 8] = cx1 * cos - cy1 * sin + px;
      _vertexData[base + 9] = cx1 * sin + cy1 * cos + py;
      _vertexData[base + 10] = r01;
      _vertexData[base + 11] = g01;
      _vertexData[base + 12] = b01;
      _vertexData[base + 13] = a01;
      _vertexData[base + 14] = u1;
      _vertexData[base + 15] = v0;

      // Vertex 2: BR
      _vertexData[base + 16] = cx2 * cos - cy2 * sin + px;
      _vertexData[base + 17] = cx2 * sin + cy2 * cos + py;
      _vertexData[base + 18] = r01;
      _vertexData[base + 19] = g01;
      _vertexData[base + 20] = b01;
      _vertexData[base + 21] = a01;
      _vertexData[base + 22] = u1;
      _vertexData[base + 23] = v1;

      // Vertex 3: BL
      _vertexData[base + 24] = cx3 * cos - cy3 * sin + px;
      _vertexData[base + 25] = cx3 * sin + cy3 * cos + py;
      _vertexData[base + 26] = r01;
      _vertexData[base + 27] = g01;
      _vertexData[base + 28] = b01;
      _vertexData[base + 29] = a01;
      _vertexData[base + 30] = u0;
      _vertexData[base + 31] = v1;
    }

    return _count;
  }

  // --- The ParticleSystem object ---

  const ps: ParticleSystem = {
    _isParticleSystem: true as const,
    get _texture() { return _image._texture; },

    // Lifecycle
    start() {
      _active = true;
      _paused = false;
      if (_emitterLifetime >= 0) {
        _emitterLife = _emitterLifetime;
      }
    },
    stop() {
      _active = false;
      _emitCounter = 0;
    },
    pause() {
      _paused = true;
    },
    reset() {
      _count = 0;
      _active = false;
      _paused = false;
      _emitCounter = 0;
      if (_emitterLifetime >= 0) {
        _emitterLife = _emitterLifetime;
      } else {
        _emitterLife = -1;
      }
    },
    isActive() {
      return _active && !_paused;
    },
    isPaused() {
      return _paused;
    },
    isStopped() {
      return !_active;
    },

    // Emission
    setEmissionRate(rate: number) {
      _emissionRate = rate;
    },
    getEmissionRate() {
      return _emissionRate;
    },
    setEmitterLifetime(lifetime: number) {
      _emitterLifetime = lifetime;
      _emitterLife = lifetime;
    },
    getEmitterLifetime() {
      return _emitterLifetime;
    },
    setParticleLifetime(min: number, max?: number) {
      _particleLifeMin = min;
      _particleLifeMax = max ?? min;
    },
    getParticleLifetime() {
      return [_particleLifeMin, _particleLifeMax];
    },

    // Position
    setPosition(x: number, y: number) {
      _posX = x;
      _posY = y;
      _prevPosX = x;
      _prevPosY = y;
    },
    getPosition() {
      return [_posX, _posY];
    },
    moveTo(x: number, y: number) {
      _prevPosX = _posX;
      _prevPosY = _posY;
      _posX = x;
      _posY = y;
    },
    setEmissionArea(distribution: EmissionAreaDistribution, dx: number, dy: number, angle?: number, directionRelative?: boolean) {
      _areaDist = distribution;
      _areaDX = dx;
      _areaDY = dy;
      _areaAngle = angle ?? 0;
      _areaRelative = directionRelative ?? false;
    },
    getEmissionArea() {
      return [_areaDist, _areaDX, _areaDY, _areaAngle, _areaRelative];
    },

    // Physics
    setDirection(direction: number) {
      _direction = direction;
    },
    getDirection() {
      return _direction;
    },
    setSpeed(min: number, max?: number) {
      _speedMin = min;
      _speedMax = max ?? min;
    },
    getSpeed() {
      return [_speedMin, _speedMax];
    },
    setSpread(spread: number) {
      _spread = spread;
    },
    getSpread() {
      return _spread;
    },
    setLinearAcceleration(xmin: number, ymin: number, xmax?: number, ymax?: number) {
      _linAccXMin = xmin;
      _linAccYMin = ymin;
      _linAccXMax = xmax ?? xmin;
      _linAccYMax = ymax ?? ymin;
    },
    getLinearAcceleration() {
      return [_linAccXMin, _linAccYMin, _linAccXMax, _linAccYMax];
    },
    setLinearDamping(min: number, max?: number) {
      _dampingMin = min;
      _dampingMax = max ?? min;
    },
    getLinearDamping() {
      return [_dampingMin, _dampingMax];
    },
    setRadialAcceleration(min: number, max?: number) {
      _radAccMin = min;
      _radAccMax = max ?? min;
    },
    getRadialAcceleration() {
      return [_radAccMin, _radAccMax];
    },
    setTangentialAcceleration(min: number, max?: number) {
      _tanAccMin = min;
      _tanAccMax = max ?? min;
    },
    getTangentialAcceleration() {
      return [_tanAccMin, _tanAccMax];
    },

    // Visual
    setTexture(texture: Image) {
      _image = texture;
    },
    getTexture() {
      return _image;
    },
    setColors(...rgba: number[]) {
      // Accept flat RGBA values (0-255): r, g, b, a, r, g, b, a, ...
      if (rgba.length < 4) return;
      const count = Math.min(Math.floor(rgba.length / 4), MAX_COLORS);
      _colors = rgba.slice(0, count * 4);
      _numColors = count;
    },
    getColors() {
      return _colors.slice(0, _numColors * 4);
    },
    setSizes(...sizes: number[]) {
      if (sizes.length === 0) return;
      const count = Math.min(sizes.length, MAX_SIZES);
      _sizes = sizes.slice(0, count);
      _numSizes = count;
    },
    getSizes() {
      return _sizes.slice(0, _numSizes);
    },
    setSizeVariation(variation: number) {
      _sizeVariation = Math.max(0, Math.min(1, variation));
    },
    getSizeVariation() {
      return _sizeVariation;
    },
    setRotation(min: number, max?: number) {
      _rotationMin = min;
      _rotationMax = max ?? min;
    },
    getRotation() {
      return [_rotationMin, _rotationMax];
    },
    setSpin(min: number, max?: number) {
      _spinMin = min;
      _spinMax = max ?? min;
    },
    getSpin() {
      return [_spinMin, _spinMax];
    },
    setSpinVariation(variation: number) {
      _spinVariation = Math.max(0, Math.min(1, variation));
    },
    getSpinVariation() {
      return _spinVariation;
    },
    setRelativeRotation(enable: boolean) {
      _relativeRotation = enable;
    },
    hasRelativeRotation() {
      return _relativeRotation;
    },
    setOffset(ox: number, oy: number) {
      _offsetX = ox;
      _offsetY = oy;
    },
    getOffset() {
      return [_offsetX, _offsetY];
    },
    setQuads(...quads: Quad[]) {
      _quads = quads.slice();
    },
    getQuads() {
      return _quads.slice();
    },

    // Buffer
    setBufferSize(size: number) {
      if (size !== _maxParticles) {
        _resizeArrays(size);
      }
    },
    getBufferSize() {
      return _maxParticles;
    },
    emit(count: number) {
      for (let i = 0; i < count && _count < _maxParticles; i++) {
        _initParticle(1); // t=1 means use current position
      }
    },
    getCount() {
      return _count;
    },

    // Other
    setInsertMode(mode: InsertMode) {
      _insertMode = mode;
    },
    getInsertMode() {
      return _insertMode;
    },
    clone() {
      const c = createParticleSystem(_image, _maxParticles);
      c.setEmissionRate(_emissionRate);
      c.setEmitterLifetime(_emitterLifetime);
      c.setParticleLifetime(_particleLifeMin, _particleLifeMax);
      c.setPosition(_posX, _posY);
      c.setEmissionArea(_areaDist, _areaDX, _areaDY, _areaAngle, _areaRelative);
      c.setDirection(_direction);
      c.setSpeed(_speedMin, _speedMax);
      c.setSpread(_spread);
      c.setLinearAcceleration(_linAccXMin, _linAccYMin, _linAccXMax, _linAccYMax);
      c.setLinearDamping(_dampingMin, _dampingMax);
      c.setRadialAcceleration(_radAccMin, _radAccMax);
      c.setTangentialAcceleration(_tanAccMin, _tanAccMax);
      c.setColors(..._colors.slice(0, _numColors * 4));
      c.setSizes(..._sizes.slice(0, _numSizes));
      c.setSizeVariation(_sizeVariation);
      c.setRotation(_rotationMin, _rotationMax);
      c.setSpin(_spinMin, _spinMax);
      c.setSpinVariation(_spinVariation);
      c.setRelativeRotation(_relativeRotation);
      c.setOffset(_offsetX, _offsetY);
      if (_quads.length > 0) c.setQuads(..._quads);
      c.setInsertMode(_insertMode);
      return c;
    },

    update(dt: number) {
      if (_paused) return;

      // Age and kill particles (iterate backwards for compact-swap)
      for (let i = _count - 1; i >= 0; i--) {
        _lifeArr[i] -= dt;
        if (_lifeArr[i] <= 0) {
          _removeParticle(i);
          continue;
        }

        // Physics: radial + tangential acceleration
        const radAcc = _radAccArr[i];
        const tanAcc = _tanAccArr[i];
        if (radAcc !== 0 || tanAcc !== 0) {
          let rdx = _posXArr[i] - _originXArr[i];
          let rdy = _posYArr[i] - _originYArr[i];
          const dist = Math.sqrt(rdx * rdx + rdy * rdy);
          if (dist > 0.0001) {
            rdx /= dist;
            rdy /= dist;
          }
          // Radial acceleration (outward from origin)
          _velXArr[i] += rdx * radAcc * dt;
          _velYArr[i] += rdy * radAcc * dt;
          // Tangential acceleration (perpendicular to radial)
          _velXArr[i] += -rdy * tanAcc * dt;
          _velYArr[i] += rdx * tanAcc * dt;
        }

        // Linear acceleration
        _velXArr[i] += _accelXArr[i] * dt;
        _velYArr[i] += _accelYArr[i] * dt;

        // Damping
        const damp = _dampingArr[i];
        if (damp !== 0) {
          const factor = 1 / (1 + damp * dt);
          _velXArr[i] *= factor;
          _velYArr[i] *= factor;
        }

        // Position integration
        _posXArr[i] += _velXArr[i] * dt;
        _posYArr[i] += _velYArr[i] * dt;

        // Spin (interpolate between start and end spin)
        const lifetime = _lifetimeArr[i];
        const ageT = lifetime > 0 ? 1 - _lifeArr[i] / lifetime : 0;
        const spin = _spinStartArr[i] + (_spinEndArr[i] - _spinStartArr[i]) * ageT;
        _rotationArr[i] += spin * dt;

        // Relative rotation: face velocity direction
        if (_relativeRotation) {
          _rotationArr[i] = Math.atan2(_velYArr[i], _velXArr[i]);
        }
      }

      // Emission (only if active)
      if (_active) {
        // Check emitter lifetime
        if (_emitterLifetime >= 0) {
          _emitterLife -= dt;
          if (_emitterLife <= 0) {
            _active = false;
            _emitCounter = 0;
            // Update prevPos so moveTo works properly next frame
            _prevPosX = _posX;
            _prevPosY = _posY;
            return;
          }
        }

        if (_emissionRate > 0) {
          const interval = 1 / _emissionRate;
          _emitCounter += dt;
          while (_emitCounter >= interval && _count < _maxParticles) {
            const t = 1 - (_emitCounter - interval) / (dt || 1);
            _initParticle(Math.max(0, Math.min(1, t)));
            _emitCounter -= interval;
          }
        }
      }

      // Update prevPos for moveTo lerping
      _prevPosX = _posX;
      _prevPosY = _posY;
    },

    // Internal
    _getVertexData() {
      if (_count === 0) return null;
      _buildVertices();
      return {
        vertices: _vertexData,
        indices: _indexData,
        numVerts: _count * VERTS_PER_PARTICLE,
        numIndices: _count * INDICES_PER_PARTICLE,
      };
    },
  };

  return ps;
}

// ============================================================
// Shared helpers
// ============================================================

function _buildIndexPattern(numParticles: number): Int32Array {
  const data = new Int32Array(numParticles * INDICES_PER_PARTICLE);
  for (let i = 0; i < numParticles; i++) {
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
