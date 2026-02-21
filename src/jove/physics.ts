// jove2d physics module — love2d-compatible Box2D v3 wrapper
// Provides World, Body, Fixture, Shape, Joint, Contact classes with meter scaling.
//
// Body/shape IDs are int indices into C-side static arrays (no BigInt).
// Joint IDs remain as packed u64 BigInt (infrequent operations).
// World.update() uses jove_World_UpdateFull for 1 FFI call per frame.

import { loadBox2D } from "../sdl/ffi_box2d.ts";
import { ptr, read } from "bun:ffi";
import type { Pointer } from "bun:ffi";

type Box2DLib = NonNullable<ReturnType<typeof loadBox2D>>;
let _lib: Box2DLib | null = null;

function lib(): Box2DLib {
  if (!_lib) throw new Error("love.physics: Box2D not available. Run 'bun run build-box2d' first.");
  return _lib;
}

/** Try to load Box2D. Called during init — non-fatal if missing. */
export function _init(): void {
  _lib = loadBox2D();
  if (_lib) _initEventBuffers();
}

/** Read C-side event buffer pointers (called once at init).
 *  Buffers are allocated in C to avoid bun:ffi ptr() heap corruption on Windows.
 *  JS reads from them via read.i32/read.f32 using these pointers. */
function _initEventBuffers(): void {
  const ptrsBase = lib().jove_World_GetEventPtrs() as Pointer;
  // Read 20 pointers from the C-side pointer table (8 bytes each on 64-bit)
  _moveBodyIdxPtr = read.ptr(ptrsBase, 0 * 8) as Pointer;
  _movePosXPtr    = read.ptr(ptrsBase, 1 * 8) as Pointer;
  _movePosYPtr    = read.ptr(ptrsBase, 2 * 8) as Pointer;
  _moveAnglePtr   = read.ptr(ptrsBase, 3 * 8) as Pointer;
  _beginShapeAPtr = read.ptr(ptrsBase, 4 * 8) as Pointer;
  _beginShapeBPtr = read.ptr(ptrsBase, 5 * 8) as Pointer;
  _endShapeAPtr   = read.ptr(ptrsBase, 6 * 8) as Pointer;
  _endShapeBPtr   = read.ptr(ptrsBase, 7 * 8) as Pointer;
  _hitShapeAPtr   = read.ptr(ptrsBase, 8 * 8) as Pointer;
  _hitShapeBPtr   = read.ptr(ptrsBase, 9 * 8) as Pointer;
  _hitNormXPtr    = read.ptr(ptrsBase, 10 * 8) as Pointer;
  _hitNormYPtr    = read.ptr(ptrsBase, 11 * 8) as Pointer;
  _hitPointXPtr   = read.ptr(ptrsBase, 12 * 8) as Pointer;
  _hitPointYPtr   = read.ptr(ptrsBase, 13 * 8) as Pointer;
  _hitSpeedPtr    = read.ptr(ptrsBase, 14 * 8) as Pointer;
  _preSolveShapeAPtr = read.ptr(ptrsBase, 15 * 8) as Pointer;
  _preSolveShapeBPtr = read.ptr(ptrsBase, 16 * 8) as Pointer;
  _preSolveNormXPtr  = read.ptr(ptrsBase, 17 * 8) as Pointer;
  _preSolveNormYPtr  = read.ptr(ptrsBase, 18 * 8) as Pointer;
  _outCountsPtr      = read.ptr(ptrsBase, 19 * 8) as Pointer;
}

/** Check if physics module is available */
export function isAvailable(): boolean {
  if (!_lib) _init();
  return _lib !== null;
}

// ── Meter scaling ───────────────────────────────────────────────────

let _meter = 30; // love2d default: 30 pixels = 1 meter

export function setMeter(m: number): void {
  if (m <= 0) throw new Error("Meter scale must be positive");
  _meter = m;
}

export function getMeter(): number {
  return _meter;
}

function toMeters(px: number): number { return px / _meter; }
function toPixels(m: number): number { return m * _meter; }

// love2d scales forces by 1/meter and torques by 1/meter² at the API boundary
function toForce(f: number): number { return f / _meter; }
function fromForce(f: number): number { return f * _meter; }
function toTorque(t: number): number { return t / (_meter * _meter); }
function fromTorque(t: number): number { return t * _meter * _meter; }

// ── Pre-allocated out-param buffers ─────────────────────────────────
// Each out-param gets its own single-element buffer to avoid bun:ffi
// subarray ptr() issues (ptr() gives a pointer to bun's internal copy).

const _outA = new Float32Array(1);
const _outAPtr = ptr(_outA);
const _outB = new Float32Array(1);
const _outBPtr = ptr(_outB);
const _outC = new Float32Array(1);
const _outCPtr = ptr(_outC);
const _outD = new Float32Array(1);
const _outDPtr = ptr(_outD);

const _outU16a = new Uint16Array(1);
const _outU16aPtr = ptr(_outU16a);
const _outU16b = new Uint16Array(1);
const _outU16bPtr = ptr(_outU16b);
const _outI16 = new Int16Array(1);
const _outI16Ptr = ptr(_outI16);

// ── Event buffer pointers (C-side allocated, read at init) ──────────
// Buffers live in C to avoid bun:ffi ptr() heap corruption on Windows.
// Pointers are read once from C at init via jove_World_GetEventPtrs().

const MAX_CONTACT_EVENTS = 256;

// These are assigned in _initEventBuffers() from C-side pointer table
let _moveBodyIdxPtr: Pointer = null as any;
let _movePosXPtr: Pointer = null as any;
let _movePosYPtr: Pointer = null as any;
let _moveAnglePtr: Pointer = null as any;
let _beginShapeAPtr: Pointer = null as any;
let _beginShapeBPtr: Pointer = null as any;
let _endShapeAPtr: Pointer = null as any;
let _endShapeBPtr: Pointer = null as any;
let _hitShapeAPtr: Pointer = null as any;
let _hitShapeBPtr: Pointer = null as any;
let _hitNormXPtr: Pointer = null as any;
let _hitNormYPtr: Pointer = null as any;
let _hitPointXPtr: Pointer = null as any;
let _hitPointYPtr: Pointer = null as any;
let _hitSpeedPtr: Pointer = null as any;
let _preSolveShapeAPtr: Pointer = null as any;
let _preSolveShapeBPtr: Pointer = null as any;
let _preSolveNormXPtr: Pointer = null as any;
let _preSolveNormYPtr: Pointer = null as any;
let _outCountsPtr: Pointer = null as any;

// PreSolve enable list (pairs to enable next frame — JS→C, uses ptr())
const _enableShapeA = new Int32Array(MAX_CONTACT_EVENTS);
const _enableShapeB = new Int32Array(MAX_CONTACT_EVENTS);

// Ray cast out-params
const _rayHitX = new Float32Array(1);
const _rayHitXPtr = ptr(_rayHitX);
const _rayHitY = new Float32Array(1);
const _rayHitYPtr = ptr(_rayHitY);
const _rayNX = new Float32Array(1);
const _rayNXPtr = ptr(_rayNX);
const _rayNY = new Float32Array(1);
const _rayNYPtr = ptr(_rayNY);
const _rayFrac = new Float32Array(1);
const _rayFracPtr = ptr(_rayFrac);
const _rayShape = new Int32Array(1);
const _rayShapePtr = ptr(_rayShape);

// AABB query out-params
const MAX_QUERY_SHAPES = 256;
const _queryShapes = new Int32Array(MAX_QUERY_SHAPES);
const _queryShapesPtr = ptr(_queryShapes);

// ── Body type constants ─────────────────────────────────────────────

const BODY_TYPE_STATIC = 0;    // b2_staticBody
const BODY_TYPE_KINEMATIC = 1; // b2_kinematicBody
const BODY_TYPE_DYNAMIC = 2;   // b2_dynamicBody

function bodyTypeToInt(type: string): number {
  switch (type) {
    case "static": return BODY_TYPE_STATIC;
    case "kinematic": return BODY_TYPE_KINEMATIC;
    case "dynamic": return BODY_TYPE_DYNAMIC;
    default: throw new Error(`Unknown body type: ${type}`);
  }
}

function bodyTypeToString(type: number): string {
  switch (type) {
    case BODY_TYPE_STATIC: return "static";
    case BODY_TYPE_KINEMATIC: return "kinematic";
    case BODY_TYPE_DYNAMIC: return "dynamic";
    default: return "unknown";
  }
}

// ── Shape type constants (b2ShapeType) ──────────────────────────────

const SHAPE_TYPE_CIRCLE = 0;
const SHAPE_TYPE_CAPSULE = 1;
const SHAPE_TYPE_SEGMENT = 2;
const SHAPE_TYPE_POLYGON = 3;

function shapeTypeToString(type: number): string {
  switch (type) {
    case SHAPE_TYPE_CIRCLE: return "circle";
    case SHAPE_TYPE_CAPSULE: return "capsule";
    case SHAPE_TYPE_SEGMENT: return "edge";
    case SHAPE_TYPE_POLYGON: return "polygon";
    default: return "unknown";
  }
}

// ── Joint type constants (b2JointType) ──────────────────────────────

const JOINT_TYPE_DISTANCE = 0;
const JOINT_TYPE_FILTER = 1;
const JOINT_TYPE_MOTOR = 2;
const JOINT_TYPE_MOUSE = 3;
const JOINT_TYPE_PRISMATIC = 4;
const JOINT_TYPE_REVOLUTE = 5;
const JOINT_TYPE_WELD = 6;
const JOINT_TYPE_WHEEL = 7;

function jointTypeToString(type: number): string {
  switch (type) {
    case JOINT_TYPE_DISTANCE: return "distance";
    case JOINT_TYPE_FILTER: return "filter";
    case JOINT_TYPE_MOTOR: return "motor";
    case JOINT_TYPE_MOUSE: return "mouse";
    case JOINT_TYPE_PRISMATIC: return "prismatic";
    case JOINT_TYPE_REVOLUTE: return "revolute";
    case JOINT_TYPE_WELD: return "weld";
    case JOINT_TYPE_WHEEL: return "wheel";
    default: return "unknown";
  }
}

// ── Contact class ───────────────────────────────────────────────────

export class Contact {
  _fixtureA: Fixture;
  _fixtureB: Fixture;
  _normalX: number;
  _normalY: number;
  _pointX: number;
  _pointY: number;
  _approachSpeed: number;
  _enabled: boolean;

  constructor(fixtureA: Fixture, fixtureB: Fixture, nx: number = 0, ny: number = 0,
              px: number = 0, py: number = 0, approachSpeed: number = 0) {
    this._fixtureA = fixtureA;
    this._fixtureB = fixtureB;
    this._normalX = nx;
    this._normalY = ny;
    this._pointX = px;
    this._pointY = py;
    this._approachSpeed = approachSpeed;
    this._enabled = true;
  }

  getFixtures(): [Fixture, Fixture] {
    return [this._fixtureA, this._fixtureB];
  }

  getNormal(): [number, number] {
    return [this._normalX, this._normalY];
  }

  getPositions(): [number, number] {
    return [this._pointX * _meter, this._pointY * _meter];
  }

  getNormalImpulse(): number {
    return this._approachSpeed * _meter;
  }

  setEnabled(flag: boolean): void {
    this._enabled = flag;
  }

  isEnabled(): boolean {
    return this._enabled;
  }
}

// ── Shape class ─────────────────────────────────────────────────────

export class Shape {
  _type: string;
  _radius: number;
  _points: number[]; // flat [x1,y1,x2,y2,...] in pixels

  constructor(type: string, radius: number = 0, points: number[] = []) {
    this._type = type;
    this._radius = radius;
    this._points = points;
  }

  getType(): string { return this._type; }

  getRadius(): number { return this._radius; }

  getPoints(): number[] { return [...this._points]; }

  getChildCount(): number {
    if (this._type === "chain") return Math.max(0, this._points.length / 2 - 1);
    return 1;
  }
}

// ── Fixture class (wraps shape index) ───────────────────────────────

export class Fixture {
  _shapeId: number; // int index into C-side g_shapes[] (-1 = destroyed)
  _body: Body;
  _shape: Shape;
  _userData: any;
  _isChain: boolean;

  constructor(body: Body, shapeIdx: number, shape: Shape, isChain: boolean = false) {
    this._shapeId = shapeIdx;
    this._body = body;
    this._shape = shape;
    this._userData = null;
    this._isChain = isChain;
  }

  getBody(): Body { return this._body; }
  getShape(): Shape { return this._shape; }

  setSensor(s: boolean): void {
    if (this._shapeId < 0 || this._isChain) return;
    lib().jove_Shape_SetSensor(this._shapeId, s ? 1 : 0);
  }

  isSensor(): boolean {
    if (this._shapeId < 0 || this._isChain) return false;
    return lib().jove_Shape_IsSensor(this._shapeId) !== 0;
  }

  setFriction(f: number): void {
    if (this._shapeId < 0 || this._isChain) return;
    lib().jove_Shape_SetFriction(this._shapeId, f);
  }

  getFriction(): number {
    if (this._shapeId < 0 || this._isChain) return 0;
    return lib().jove_Shape_GetFriction(this._shapeId);
  }

  setRestitution(r: number): void {
    if (this._shapeId < 0 || this._isChain) return;
    lib().jove_Shape_SetRestitution(this._shapeId, r);
  }

  getRestitution(): number {
    if (this._shapeId < 0 || this._isChain) return 0;
    return lib().jove_Shape_GetRestitution(this._shapeId);
  }

  setDensity(d: number): void {
    if (this._shapeId < 0 || this._isChain) return;
    lib().jove_Shape_SetDensity(this._shapeId, d);
  }

  getDensity(): number {
    if (this._shapeId < 0 || this._isChain) return 0;
    return lib().jove_Shape_GetDensity(this._shapeId);
  }

  setFilterData(categories: number, mask: number, group: number): void {
    if (this._shapeId < 0 || this._isChain) return;
    lib().jove_Shape_SetFilter(this._shapeId, categories, mask, group);
  }

  getFilterData(): [number, number, number] {
    if (this._shapeId < 0 || this._isChain) return [0, 0, 0];
    lib().jove_Shape_GetFilter(this._shapeId, _outU16aPtr, _outU16bPtr, _outI16Ptr);
    return [
      read.u16(_outU16aPtr, 0),
      read.u16(_outU16bPtr, 0),
      read.i16(_outI16Ptr, 0),
    ];
  }

  testPoint(x: number, y: number): boolean {
    if (this._shapeId < 0 || this._isChain) return false;
    return lib().jove_Shape_TestPoint(this._shapeId, toMeters(x), toMeters(y)) !== 0;
  }

  setUserData(data: any): void { this._userData = data; }
  getUserData(): any { return this._userData; }

  destroy(): void {
    if (this._shapeId < 0) return;
    if (this._isChain) {
      lib().jove_DestroyChain(this._shapeId);
    } else {
      lib().jove_DestroyShape(this._shapeId);
    }
    // Remove from body's fixture list
    const idx = this._body._fixtures.indexOf(this);
    if (idx !== -1) this._body._fixtures.splice(idx, 1);
    // Remove from world's fixture index
    this._body._world._fixturesByIndex[this._shapeId] = null;
    this._shapeId = -1;
  }

  isDestroyed(): boolean { return this._shapeId < 0; }
}

// ── Body class ──────────────────────────────────────────────────────

export class Body {
  _id: number; // int index into C-side g_bodies[] (-1 = destroyed)
  _world: World;
  _fixtures: Fixture[];
  _userData: any;
  // Transform cache — updated from UpdateFull move events
  _cachedX: number;
  _cachedY: number;
  _cachedAngle: number;
  _cachedType: string;
  _transformCached: boolean;

  constructor(world: World, bodyIdx: number) {
    this._id = bodyIdx;
    this._world = world;
    this._fixtures = [];
    this._userData = null;
    this._cachedX = 0;
    this._cachedY = 0;
    this._cachedAngle = 0;
    this._cachedType = "static";
    this._transformCached = false;
  }

  getPosition(): [number, number] {
    if (this._transformCached) {
      return [this._cachedX * _meter, this._cachedY * _meter];
    }
    lib().jove_Body_GetPosition(this._id, _outAPtr, _outBPtr);
    return [read.f32(_outAPtr, 0) * _meter, read.f32(_outBPtr, 0) * _meter];
  }

  getX(): number { return this.getPosition()[0]; }
  getY(): number { return this.getPosition()[1]; }

  setPosition(x: number, y: number): void {
    const mx = toMeters(x), my = toMeters(y);
    lib().jove_Body_SetPosition(this._id, mx, my);
    this._cachedX = mx;
    this._cachedY = my;
  }

  getAngle(): number {
    if (this._transformCached) {
      return this._cachedAngle;
    }
    return lib().jove_Body_GetAngle(this._id);
  }

  setAngle(a: number): void {
    lib().jove_Body_SetAngle(this._id, a);
    this._cachedAngle = a;
  }

  getLinearVelocity(): [number, number] {
    lib().jove_Body_GetLinearVelocity(this._id, _outAPtr, _outBPtr);
    return [read.f32(_outAPtr, 0) * _meter, read.f32(_outBPtr, 0) * _meter];
  }

  setLinearVelocity(vx: number, vy: number): void {
    lib().jove_Body_SetLinearVelocity(this._id, toMeters(vx), toMeters(vy));
  }

  getAngularVelocity(): number {
    return lib().jove_Body_GetAngularVelocity(this._id);
  }

  setAngularVelocity(omega: number): void {
    lib().jove_Body_SetAngularVelocity(this._id, omega);
  }

  applyForce(fx: number, fy: number, x?: number, y?: number): void {
    if (x === undefined || y === undefined) {
      lib().jove_Body_ApplyForceToCenter(this._id, toForce(fx), toForce(fy), 1);
    } else {
      lib().jove_Body_ApplyForce(this._id, toForce(fx), toForce(fy), toMeters(x), toMeters(y), 1);
    }
  }

  applyTorque(t: number): void {
    lib().jove_Body_ApplyTorque(this._id, toTorque(t), 1);
  }

  applyLinearImpulse(ix: number, iy: number, x?: number, y?: number): void {
    if (x === undefined || y === undefined) {
      lib().jove_Body_ApplyLinearImpulseToCenter(this._id, toForce(ix), toForce(iy), 1);
    } else {
      lib().jove_Body_ApplyLinearImpulse(this._id, toForce(ix), toForce(iy), toMeters(x), toMeters(y), 1);
    }
  }

  applyAngularImpulse(impulse: number): void {
    lib().jove_Body_ApplyAngularImpulse(this._id, toTorque(impulse), 1);
  }

  getMass(): number {
    return lib().jove_Body_GetMass(this._id);
  }

  getMassData(): [number, number, number, number] {
    lib().jove_Body_GetMassData(this._id, _outAPtr, _outBPtr, _outCPtr, _outDPtr);
    return [
      read.f32(_outAPtr, 0),                          // mass (no scaling)
      read.f32(_outBPtr, 0) * _meter,                 // center x (pixels)
      read.f32(_outCPtr, 0) * _meter,                 // center y (pixels)
      fromTorque(read.f32(_outDPtr, 0)),               // inertia (*meter²)
    ];
  }

  getInertia(): number {
    return this.getMassData()[3];
  }

  setMassData(mass: number, x: number, y: number, inertia: number): void {
    if (this._id < 0) return;
    lib().jove_Body_SetMassData(this._id, mass, toMeters(x), toMeters(y), toTorque(inertia));
  }

  getType(): string {
    return this._cachedType;
  }

  setType(type: string): void {
    lib().jove_Body_SetType(this._id, bodyTypeToInt(type));
    this._cachedType = type;
  }

  isBullet(): boolean {
    return lib().jove_Body_IsBullet(this._id) !== 0;
  }

  setBullet(b: boolean): void {
    lib().jove_Body_SetBullet(this._id, b ? 1 : 0);
  }

  isActive(): boolean {
    return lib().jove_Body_IsEnabled(this._id) !== 0;
  }

  setActive(a: boolean): void {
    lib().jove_Body_SetEnabled(this._id, a ? 1 : 0);
  }

  isAwake(): boolean {
    return lib().jove_Body_IsAwake(this._id) !== 0;
  }

  setAwake(a: boolean): void {
    lib().jove_Body_SetAwake(this._id, a ? 1 : 0);
  }

  isFixedRotation(): boolean {
    return lib().jove_Body_IsFixedRotation(this._id) !== 0;
  }

  setFixedRotation(f: boolean): void {
    lib().jove_Body_SetFixedRotation(this._id, f ? 1 : 0);
  }

  isSleepingAllowed(): boolean {
    return lib().jove_Body_IsSleepingAllowed(this._id) !== 0;
  }

  setSleepingAllowed(allowed: boolean): void {
    lib().jove_Body_SetSleepingAllowed(this._id, allowed ? 1 : 0);
  }

  getGravityScale(): number {
    return lib().jove_Body_GetGravityScale(this._id);
  }

  setGravityScale(scale: number): void {
    lib().jove_Body_SetGravityScale(this._id, scale);
  }

  getLinearDamping(): number {
    return lib().jove_Body_GetLinearDamping(this._id);
  }

  setLinearDamping(damping: number): void {
    lib().jove_Body_SetLinearDamping(this._id, damping);
  }

  getAngularDamping(): number {
    return lib().jove_Body_GetAngularDamping(this._id);
  }

  setAngularDamping(damping: number): void {
    lib().jove_Body_SetAngularDamping(this._id, damping);
  }

  getWorldPoint(lx: number, ly: number): [number, number] {
    lib().jove_Body_GetWorldPoint(this._id, toMeters(lx), toMeters(ly), _outAPtr, _outBPtr);
    return [read.f32(_outAPtr, 0) * _meter, read.f32(_outBPtr, 0) * _meter];
  }

  getLocalPoint(wx: number, wy: number): [number, number] {
    lib().jove_Body_GetLocalPoint(this._id, toMeters(wx), toMeters(wy), _outAPtr, _outBPtr);
    return [read.f32(_outAPtr, 0) * _meter, read.f32(_outBPtr, 0) * _meter];
  }

  getWorldVector(lx: number, ly: number): [number, number] {
    lib().jove_Body_GetWorldVector(this._id, lx, ly, _outAPtr, _outBPtr);
    return [read.f32(_outAPtr, 0), read.f32(_outBPtr, 0)];
  }

  getLocalVector(wx: number, wy: number): [number, number] {
    lib().jove_Body_GetLocalVector(this._id, wx, wy, _outAPtr, _outBPtr);
    return [read.f32(_outAPtr, 0), read.f32(_outBPtr, 0)];
  }

  getFixtures(): Fixture[] { return [...this._fixtures]; }
  getFixtureList(): Fixture[] { return this.getFixtures(); }

  getWorld(): World { return this._world; }

  setUserData(data: any): void { this._userData = data; }
  getUserData(): any { return this._userData; }

  destroy(): void {
    if (this._id < 0) return;
    // Free shape indices in C (body destroy also destroys shapes in Box2D)
    for (const f of this._fixtures) {
      if (f._shapeId >= 0) {
        this._world._fixturesByIndex[f._shapeId] = null;
        lib().jove_FreeShapeIndex(f._shapeId);
        f._shapeId = -1;
      }
    }
    this._fixtures.length = 0;
    lib().jove_DestroyBody(this._id);
    this._world._bodiesByIndex[this._id] = null;
    this._id = -1;
  }

  isDestroyed(): boolean { return this._id < 0; }
}

// ── Joint class ─────────────────────────────────────────────────────

export class Joint {
  _id: bigint; // packed u64 (0n = destroyed)
  _world: World;
  _bodyA: Body;
  _bodyB: Body;
  _userData: any;

  constructor(world: World, jointId: bigint, bodyA: Body, bodyB: Body) {
    this._id = jointId;
    this._world = world;
    this._bodyA = bodyA;
    this._bodyB = bodyB;
    this._userData = null;
  }

  getType(): string {
    if (this._id === 0n) return "unknown";
    return jointTypeToString(lib().jove_Joint_GetType(this._id));
  }

  getBodies(): [Body, Body] { return [this._bodyA, this._bodyB]; }

  /** Wake both bodies — Box2D v3 doesn't auto-wake on motor property changes */
  protected _wake(): void {
    this._bodyA.setAwake(true);
    this._bodyB.setAwake(true);
  }

  setCollideConnected(flag: boolean): void {
    if (this._id === 0n) return;
    lib().jove_Joint_SetCollideConnected(this._id, flag ? 1 : 0);
  }

  getCollideConnected(): boolean {
    if (this._id === 0n) return false;
    return lib().jove_Joint_GetCollideConnected(this._id) !== 0;
  }

  getAnchorA(): [number, number] {
    if (this._id === 0n) return [0, 0];
    lib().jove_Joint_GetAnchorA(this._id, _outAPtr, _outBPtr);
    return [read.f32(_outAPtr, 0) * _meter, read.f32(_outBPtr, 0) * _meter];
  }

  getAnchorB(): [number, number] {
    if (this._id === 0n) return [0, 0];
    lib().jove_Joint_GetAnchorB(this._id, _outAPtr, _outBPtr);
    return [read.f32(_outAPtr, 0) * _meter, read.f32(_outBPtr, 0) * _meter];
  }

  getReactionForce(dt: number): [number, number] {
    if (this._id === 0n) return [0, 0];
    const invDt = dt > 0 ? 1 / dt : 0;
    lib().jove_Joint_GetReactionForce(this._id, invDt, _outAPtr, _outBPtr);
    return [fromForce(read.f32(_outAPtr, 0)), fromForce(read.f32(_outBPtr, 0))];
  }

  getReactionTorque(dt: number): number {
    if (this._id === 0n) return 0;
    const invDt = dt > 0 ? 1 / dt : 0;
    return fromTorque(lib().jove_Joint_GetReactionTorque(this._id, invDt));
  }

  setUserData(data: any): void { this._userData = data; }
  getUserData(): any { return this._userData; }

  destroy(): void {
    if (this._id === 0n) return;
    lib().jove_DestroyJoint(this._id);
    this._world._joints.delete(this._id);
    this._id = 0n;
  }

  isDestroyed(): boolean { return this._id === 0n; }
}

export class DistanceJoint extends Joint {
  setLength(length: number): void {
    if (this._id === 0n) return;
    lib().jove_DistanceJoint_SetLength(this._id, toMeters(length));
  }

  getLength(): number {
    if (this._id === 0n) return 0;
    return toPixels(lib().jove_DistanceJoint_GetLength(this._id));
  }

  getFrequency(): number {
    if (this._id === 0n) return 0;
    return lib().jove_DistanceJoint_GetSpringHertz(this._id);
  }

  setFrequency(hz: number): void {
    if (this._id === 0n) return;
    lib().jove_DistanceJoint_SetSpringHertz(this._id, hz);
  }

  getDampingRatio(): number {
    if (this._id === 0n) return 0;
    return lib().jove_DistanceJoint_GetSpringDampingRatio(this._id);
  }

  setDampingRatio(ratio: number): void {
    if (this._id === 0n) return;
    lib().jove_DistanceJoint_SetSpringDampingRatio(this._id, ratio);
  }
}

export class RevoluteJoint extends Joint {
  getJointAngle(): number {
    if (this._id === 0n) return 0;
    return lib().jove_RevoluteJoint_GetAngle(this._id);
  }

  setLimitsEnabled(flag: boolean): void {
    if (this._id === 0n) return;
    lib().jove_RevoluteJoint_EnableLimit(this._id, flag ? 1 : 0);
  }

  setLimits(lower: number, upper: number): void {
    if (this._id === 0n) return;
    lib().jove_RevoluteJoint_SetLimits(this._id, lower, upper);
  }

  setMotorEnabled(flag: boolean): void {
    if (this._id === 0n) return;
    lib().jove_RevoluteJoint_EnableMotor(this._id, flag ? 1 : 0);
    this._wake();
  }

  setMotorSpeed(speed: number): void {
    if (this._id === 0n) return;
    lib().jove_RevoluteJoint_SetMotorSpeed(this._id, speed);
    this._wake();
  }

  setMaxMotorTorque(torque: number): void {
    if (this._id === 0n) return;
    lib().jove_RevoluteJoint_SetMaxMotorTorque(this._id, toTorque(torque));
    this._wake();
  }

  isLimitEnabled(): boolean {
    if (this._id === 0n) return false;
    return lib().jove_RevoluteJoint_IsLimitEnabled(this._id) !== 0;
  }

  getLowerLimit(): number {
    if (this._id === 0n) return 0;
    return lib().jove_RevoluteJoint_GetLowerLimit(this._id);
  }

  getUpperLimit(): number {
    if (this._id === 0n) return 0;
    return lib().jove_RevoluteJoint_GetUpperLimit(this._id);
  }

  getLimits(): [number, number] {
    return [this.getLowerLimit(), this.getUpperLimit()];
  }

  isMotorEnabled(): boolean {
    if (this._id === 0n) return false;
    return lib().jove_RevoluteJoint_IsMotorEnabled(this._id) !== 0;
  }

  getMotorSpeed(): number {
    if (this._id === 0n) return 0;
    return lib().jove_RevoluteJoint_GetMotorSpeed(this._id);
  }
}

export class PrismaticJoint extends Joint {
  setLimitsEnabled(flag: boolean): void {
    if (this._id === 0n) return;
    lib().jove_PrismaticJoint_EnableLimit(this._id, flag ? 1 : 0);
  }

  setLimits(lower: number, upper: number): void {
    if (this._id === 0n) return;
    lib().jove_PrismaticJoint_SetLimits(this._id, toMeters(lower), toMeters(upper));
  }

  setMotorEnabled(flag: boolean): void {
    if (this._id === 0n) return;
    lib().jove_PrismaticJoint_EnableMotor(this._id, flag ? 1 : 0);
    this._wake();
  }

  setMotorSpeed(speed: number): void {
    if (this._id === 0n) return;
    lib().jove_PrismaticJoint_SetMotorSpeed(this._id, toMeters(speed));
    this._wake();
  }

  setMaxMotorForce(force: number): void {
    if (this._id === 0n) return;
    lib().jove_PrismaticJoint_SetMaxMotorForce(this._id, toForce(force));
    this._wake();
  }

  isLimitEnabled(): boolean {
    if (this._id === 0n) return false;
    return lib().jove_PrismaticJoint_IsLimitEnabled(this._id) !== 0;
  }

  getLowerLimit(): number {
    if (this._id === 0n) return 0;
    return toPixels(lib().jove_PrismaticJoint_GetLowerLimit(this._id));
  }

  getUpperLimit(): number {
    if (this._id === 0n) return 0;
    return toPixels(lib().jove_PrismaticJoint_GetUpperLimit(this._id));
  }

  getLimits(): [number, number] {
    return [this.getLowerLimit(), this.getUpperLimit()];
  }

  isMotorEnabled(): boolean {
    if (this._id === 0n) return false;
    return lib().jove_PrismaticJoint_IsMotorEnabled(this._id) !== 0;
  }

  getMotorSpeed(): number {
    if (this._id === 0n) return 0;
    return toPixels(lib().jove_PrismaticJoint_GetMotorSpeed(this._id));
  }

  getJointTranslation(): number {
    if (this._id === 0n) return 0;
    return toPixels(lib().jove_PrismaticJoint_GetTranslation(this._id));
  }
}

export class WeldJoint extends Joint {
  getFrequency(): number {
    if (this._id === 0n) return 0;
    return lib().jove_WeldJoint_GetLinearHertz(this._id);
  }

  setFrequency(hz: number): void {
    if (this._id === 0n) return;
    lib().jove_WeldJoint_SetLinearHertz(this._id, hz);
  }

  getDampingRatio(): number {
    if (this._id === 0n) return 0;
    return lib().jove_WeldJoint_GetLinearDampingRatio(this._id);
  }

  setDampingRatio(ratio: number): void {
    if (this._id === 0n) return;
    lib().jove_WeldJoint_SetLinearDampingRatio(this._id, ratio);
  }
}

export class MouseJoint extends Joint {
  setTarget(x: number, y: number): void {
    if (this._id === 0n) return;
    lib().jove_MouseJoint_SetTarget(this._id, toMeters(x), toMeters(y));
  }

  getTarget(): [number, number] {
    if (this._id === 0n) return [0, 0];
    lib().jove_MouseJoint_GetTarget(this._id, _outAPtr, _outBPtr);
    return [read.f32(_outAPtr, 0) * _meter, read.f32(_outBPtr, 0) * _meter];
  }

  getMaxForce(): number {
    if (this._id === 0n) return 0;
    return fromForce(lib().jove_MouseJoint_GetMaxForce(this._id));
  }

  setMaxForce(force: number): void {
    if (this._id === 0n) return;
    lib().jove_MouseJoint_SetMaxForce(this._id, toForce(force));
  }
}

export class WheelJoint extends Joint {
  setSpringEnabled(flag: boolean): void {
    if (this._id === 0n) return;
    lib().jove_WheelJoint_EnableSpring(this._id, flag ? 1 : 0);
  }

  setSpringFrequency(hz: number): void {
    if (this._id === 0n) return;
    lib().jove_WheelJoint_SetSpringHertz(this._id, hz);
  }

  getSpringFrequency(): number {
    if (this._id === 0n) return 0;
    return lib().jove_WheelJoint_GetSpringHertz(this._id);
  }

  setSpringDampingRatio(ratio: number): void {
    if (this._id === 0n) return;
    lib().jove_WheelJoint_SetSpringDampingRatio(this._id, ratio);
  }

  getSpringDampingRatio(): number {
    if (this._id === 0n) return 0;
    return lib().jove_WheelJoint_GetSpringDampingRatio(this._id);
  }

  setLimitsEnabled(flag: boolean): void {
    if (this._id === 0n) return;
    lib().jove_WheelJoint_EnableLimit(this._id, flag ? 1 : 0);
  }

  setLimits(lower: number, upper: number): void {
    if (this._id === 0n) return;
    lib().jove_WheelJoint_SetLimits(this._id, toMeters(lower), toMeters(upper));
  }

  setMotorEnabled(flag: boolean): void {
    if (this._id === 0n) return;
    lib().jove_WheelJoint_EnableMotor(this._id, flag ? 1 : 0);
    this._wake();
  }

  setMotorSpeed(speed: number): void {
    if (this._id === 0n) return;
    lib().jove_WheelJoint_SetMotorSpeed(this._id, speed);
    this._wake();
  }

  setMaxMotorTorque(torque: number): void {
    if (this._id === 0n) return;
    lib().jove_WheelJoint_SetMaxMotorTorque(this._id, toTorque(torque));
    this._wake();
  }

  getMotorTorque(): number {
    if (this._id === 0n) return 0;
    return fromTorque(lib().jove_WheelJoint_GetMotorTorque(this._id));
  }

  isLimitEnabled(): boolean {
    if (this._id === 0n) return false;
    return lib().jove_WheelJoint_IsLimitEnabled(this._id) !== 0;
  }

  getLowerLimit(): number {
    if (this._id === 0n) return 0;
    return toPixels(lib().jove_WheelJoint_GetLowerLimit(this._id));
  }

  getUpperLimit(): number {
    if (this._id === 0n) return 0;
    return toPixels(lib().jove_WheelJoint_GetUpperLimit(this._id));
  }

  getLimits(): [number, number] {
    return [this.getLowerLimit(), this.getUpperLimit()];
  }

  isMotorEnabled(): boolean {
    if (this._id === 0n) return false;
    return lib().jove_WheelJoint_IsMotorEnabled(this._id) !== 0;
  }

  getMotorSpeed(): number {
    if (this._id === 0n) return 0;
    return lib().jove_WheelJoint_GetMotorSpeed(this._id);
  }
}

export class MotorJoint extends Joint {
  setLinearOffset(x: number, y: number): void {
    if (this._id === 0n) return;
    lib().jove_MotorJoint_SetLinearOffset(this._id, toMeters(x), toMeters(y));
    this._wake();
  }

  getLinearOffset(): [number, number] {
    if (this._id === 0n) return [0, 0];
    lib().jove_MotorJoint_GetLinearOffset(this._id, _outAPtr, _outBPtr);
    return [read.f32(_outAPtr, 0) * _meter, read.f32(_outBPtr, 0) * _meter];
  }

  setAngularOffset(angle: number): void {
    if (this._id === 0n) return;
    lib().jove_MotorJoint_SetAngularOffset(this._id, angle);
    this._wake();
  }

  getAngularOffset(): number {
    if (this._id === 0n) return 0;
    return lib().jove_MotorJoint_GetAngularOffset(this._id);
  }

  setMaxForce(force: number): void {
    if (this._id === 0n) return;
    lib().jove_MotorJoint_SetMaxForce(this._id, toForce(force));
    this._wake();
  }

  setMaxTorque(torque: number): void {
    if (this._id === 0n) return;
    lib().jove_MotorJoint_SetMaxTorque(this._id, toTorque(torque));
    this._wake();
  }

  setCorrectionFactor(factor: number): void {
    if (this._id === 0n) return;
    lib().jove_MotorJoint_SetCorrectionFactor(this._id, factor);
  }

  getMaxForce(): number {
    if (this._id === 0n) return 0;
    return fromForce(lib().jove_MotorJoint_GetMaxForce(this._id));
  }

  getMaxTorque(): number {
    if (this._id === 0n) return 0;
    return fromTorque(lib().jove_MotorJoint_GetMaxTorque(this._id));
  }

  getCorrectionFactor(): number {
    if (this._id === 0n) return 0;
    return lib().jove_MotorJoint_GetCorrectionFactor(this._id);
  }
}

// ── World class ─────────────────────────────────────────────────────

export class World {
  _id: number; // packed u32 (0 = destroyed)
  _bodiesByIndex: (Body | null)[];
  _fixturesByIndex: (Fixture | null)[];
  _joints: Map<bigint, Joint>;
  _callbacks: {
    beginContact?: (contact: Contact) => void;
    endContact?: (contact: Contact) => void;
    postSolve?: (contact: Contact, normalImpulse: number, tangentImpulse: number) => void;
    preSolve?: (contact: Contact) => void;
  };
  _enableCount: number;

  constructor(gx: number = 0, gy: number = 0, sleep: boolean = true) {
    this._id = lib().jove_CreateWorld(toMeters(gx), toMeters(gy), sleep ? 1 : 0, 0.01);
    this._bodiesByIndex = [];
    this._fixturesByIndex = [];
    this._joints = new Map();
    this._callbacks = {};
    this._enableCount = 0;
  }

  update(dt: number, subSteps: number = 4): void {
    if (this._id === 0) return;

    const b2 = lib();

    // Send enable list to C (pairs approved by JS last frame)
    if (this._callbacks.preSolve) {
      b2.jove_World_SetPreSolveEnableList(
        ptr(_enableShapeA), ptr(_enableShapeB), this._enableCount
      );
    } else if (this._enableCount > 0) {
      // Clear the enable list if preSolve was removed
      b2.jove_World_SetPreSolveEnableList(ptr(_enableShapeA), ptr(_enableShapeB), 0);
      this._enableCount = 0;
    }

    // Step + read all events using pre-registered buffers (3-param call).
    // Buffer pointers were registered once at init via jove_World_SetEventBuffers.
    b2.jove_World_UpdateFull2(this._id, dt, subSteps);

    // Read counts
    const moveCount = read.i32(_outCountsPtr, 0);
    const beginCount = read.i32(_outCountsPtr, 4);
    const endCount = read.i32(_outCountsPtr, 8);
    const hitCount = read.i32(_outCountsPtr, 12);
    const preSolveCount = read.i32(_outCountsPtr, 16);

    // Cache body transforms BEFORE dispatching contact events
    for (let i = 0; i < moveCount; i++) {
      const bodyIdx = read.i32(_moveBodyIdxPtr, i * 4);
      if (bodyIdx < 0) continue;
      const body = this._bodiesByIndex[bodyIdx];
      if (body) {
        body._cachedX = read.f32(_movePosXPtr, i * 4);
        body._cachedY = read.f32(_movePosYPtr, i * 4);
        body._cachedAngle = read.f32(_moveAnglePtr, i * 4);
        body._transformCached = true;
      }
    }

    // Dispatch contact events
    this._dispatchFromBuffers(beginCount, endCount, hitCount);

    // Dispatch preSolve events and build disable list for next frame
    this._dispatchPreSolve(preSolveCount);
  }

  private _dispatchFromBuffers(beginCount: number, endCount: number, hitCount: number): void {
    if (!this._callbacks.beginContact && !this._callbacks.endContact && !this._callbacks.postSolve && !this._callbacks.preSolve) return;

    // Begin events
    if (this._callbacks.beginContact && beginCount > 0) {
      for (let i = 0; i < beginCount; i++) {
        const idxA = read.i32(_beginShapeAPtr, i * 4);
        const idxB = read.i32(_beginShapeBPtr, i * 4);
        if (idxA < 0 || idxB < 0) continue;
        const fA = this._fixturesByIndex[idxA];
        const fB = this._fixturesByIndex[idxB];
        if (fA && fB) {
          this._callbacks.beginContact(new Contact(fA, fB));
        }
      }
    }

    // End events
    if (this._callbacks.endContact && endCount > 0) {
      for (let i = 0; i < endCount; i++) {
        const idxA = read.i32(_endShapeAPtr, i * 4);
        const idxB = read.i32(_endShapeBPtr, i * 4);
        if (idxA < 0 || idxB < 0) continue;
        const fA = this._fixturesByIndex[idxA];
        const fB = this._fixturesByIndex[idxB];
        if (fA && fB) {
          this._callbacks.endContact(new Contact(fA, fB));
        }
      }
    }

    // Hit events (≈ postSolve)
    if (this._callbacks.postSolve && hitCount > 0) {
      for (let i = 0; i < hitCount; i++) {
        const idxA = read.i32(_hitShapeAPtr, i * 4);
        const idxB = read.i32(_hitShapeBPtr, i * 4);
        if (idxA < 0 || idxB < 0) continue;
        const fA = this._fixturesByIndex[idxA];
        const fB = this._fixturesByIndex[idxB];
        if (fA && fB) {
          const nx = read.f32(_hitNormXPtr, i * 4);
          const ny = read.f32(_hitNormYPtr, i * 4);
          const px = read.f32(_hitPointXPtr, i * 4);
          const py = read.f32(_hitPointYPtr, i * 4);
          const speed = read.f32(_hitSpeedPtr, i * 4);
          this._callbacks.postSolve(new Contact(fA, fB, nx, ny, px, py, speed), speed, 0);
        }
      }
    }
  }

  private _dispatchPreSolve(preSolveCount: number): void {
    // Reset enable count for next frame
    this._enableCount = 0;

    if (!this._callbacks.preSolve || preSolveCount === 0) return;

    for (let i = 0; i < preSolveCount; i++) {
      const idxA = read.i32(_preSolveShapeAPtr, i * 4);
      const idxB = read.i32(_preSolveShapeBPtr, i * 4);
      if (idxA < 0 || idxB < 0) continue;
      const fA = this._fixturesByIndex[idxA];
      const fB = this._fixturesByIndex[idxB];
      if (fA && fB) {
        const nx = read.f32(_preSolveNormXPtr, i * 4);
        const ny = read.f32(_preSolveNormYPtr, i * 4);
        const contact = new Contact(fA, fB, nx, ny);
        this._callbacks.preSolve(contact);
        // Build enable list: pairs where user left contact enabled (default)
        // Pairs where user called setEnabled(false) are NOT added → C will disable them
        if (contact._enabled && this._enableCount < MAX_CONTACT_EVENTS) {
          _enableShapeA[this._enableCount] = idxA;
          _enableShapeB[this._enableCount] = idxB;
          this._enableCount++;
        }
      }
    }
  }

  setCallbacks(callbacks: {
    beginContact?: (contact: Contact) => void;
    endContact?: (contact: Contact) => void;
    postSolve?: (contact: Contact, normalImpulse: number, tangentImpulse: number) => void;
    preSolve?: (contact: Contact) => void;
  }): void {
    const hadPostSolve = !!this._callbacks.postSolve;
    const hadPreSolve = !!this._callbacks.preSolve;
    this._callbacks = callbacks;
    const b2 = lib();
    // Enable hit events on all existing shapes when postSolve is newly registered
    if (callbacks.postSolve && !hadPostSolve) {
      for (const fixture of this._fixturesByIndex) {
        if (fixture && fixture._shapeId >= 0 && !fixture._isChain) {
          b2.jove_Shape_EnableHitEvents(fixture._shapeId, 1);
        }
      }
    }
    // Enable preSolve events on all existing shapes when preSolve is newly registered
    if (callbacks.preSolve && !hadPreSolve) {
      for (const fixture of this._fixturesByIndex) {
        if (fixture && fixture._shapeId >= 0 && !fixture._isChain) {
          b2.jove_Shape_EnablePreSolveEvents(fixture._shapeId, 1);
        }
      }
    }
    // Clear enable list when preSolve is removed
    if (!callbacks.preSolve && hadPreSolve) {
      this._enableCount = 0;
    }
  }

  setGravity(gx: number, gy: number): void {
    if (this._id === 0) return;
    lib().jove_World_SetGravity(this._id, toMeters(gx), toMeters(gy));
  }

  getGravity(): [number, number] {
    if (this._id === 0) return [0, 0];
    lib().jove_World_GetGravity(this._id, _outAPtr, _outBPtr);
    return [read.f32(_outAPtr, 0) * _meter, read.f32(_outBPtr, 0) * _meter];
  }

  getBodyCount(): number {
    if (this._id === 0) return 0;
    return lib().jove_World_GetBodyCount(this._id);
  }

  getBodies(): Body[] {
    const result: Body[] = [];
    for (const body of this._bodiesByIndex) {
      if (body && body._id >= 0) result.push(body);
    }
    return result;
  }

  getBodyList(): Body[] {
    return this.getBodies();
  }

  getJoints(): Joint[] {
    return Array.from(this._joints.values());
  }

  getJointCount(): number {
    return this._joints.size;
  }

  queryBoundingBox(x1: number, y1: number, x2: number, y2: number,
                   callback: (fixture: Fixture) => boolean): void {
    if (this._id === 0) return;
    const count = lib().jove_World_QueryAABB(
      this._id,
      toMeters(Math.min(x1, x2)), toMeters(Math.min(y1, y2)),
      toMeters(Math.max(x1, x2)), toMeters(Math.max(y1, y2)),
      _queryShapesPtr, MAX_QUERY_SHAPES
    );
    for (let i = 0; i < count; i++) {
      const shapeIdx = read.i32(_queryShapesPtr, i * 4);
      if (shapeIdx < 0) continue;
      const fixture = this._fixturesByIndex[shapeIdx];
      if (fixture) {
        if (!callback(fixture)) break;
      }
    }
  }

  rayCast(x1: number, y1: number, x2: number, y2: number,
          callback: (fixture: Fixture, x: number, y: number, nx: number, ny: number, fraction: number) => number): void {
    if (this._id === 0) return;
    const hit = lib().jove_World_RayCast(
      this._id,
      toMeters(x1), toMeters(y1), toMeters(x2), toMeters(y2),
      _rayHitXPtr, _rayHitYPtr,
      _rayNXPtr, _rayNYPtr,
      _rayFracPtr, _rayShapePtr
    );
    if (hit) {
      const hx = read.f32(_rayHitXPtr, 0) * _meter;
      const hy = read.f32(_rayHitYPtr, 0) * _meter;
      const nx = read.f32(_rayNXPtr, 0);
      const ny = read.f32(_rayNYPtr, 0);
      const frac = read.f32(_rayFracPtr, 0);
      const shapeIdx = read.i32(_rayShapePtr, 0);
      if (shapeIdx >= 0) {
        const fixture = this._fixturesByIndex[shapeIdx];
        if (fixture) {
          callback(fixture, hx, hy, nx, ny, frac);
        }
      }
    }
  }

  destroy(): void {
    if (this._id === 0) return;
    const b2 = lib();
    // Free all body/shape indices in C
    for (const body of this._bodiesByIndex) {
      if (body && body._id >= 0) {
        for (const f of body._fixtures) {
          if (f._shapeId >= 0) {
            b2.jove_FreeShapeIndex(f._shapeId);
            f._shapeId = -1;
          }
        }
        body._fixtures.length = 0;
        b2.jove_FreeBodyIndex(body._id);
        body._id = -1;
      }
    }
    // Mark all joints as destroyed
    for (const joint of this._joints.values()) {
      joint._id = 0n;
    }
    this._bodiesByIndex.length = 0;
    this._fixturesByIndex.length = 0;
    this._joints.clear();
    b2.jove_DestroyWorld(this._id);
    this._id = 0;
  }

  isDestroyed(): boolean { return this._id === 0; }
}

// ── Factory functions (love2d API) ──────────────────────────────────

export function newWorld(gx: number = 0, gy: number = 0, sleep: boolean = true): World {
  return new World(gx, gy, sleep);
}

export function newBody(world: World, x: number = 0, y: number = 0, type: string = "static"): Body {
  const mx = toMeters(x), my = toMeters(y);
  const bodyIdx = lib().jove_CreateBody(
    world._id,
    bodyTypeToInt(type),
    mx, my,
    0 // angle
  );
  const body = new Body(world, bodyIdx);
  body._cachedX = mx;
  body._cachedY = my;
  body._cachedAngle = 0;
  body._cachedType = type;
  body._transformCached = true;
  world._bodiesByIndex[bodyIdx] = body;
  return body;
}

// ── Shape factories ─────────────────────────────────────────────────

export function newCircleShape(radius: number): Shape;
export function newCircleShape(x: number, y: number, radius: number): Shape;
export function newCircleShape(...args: number[]): Shape {
  if (args.length === 1) {
    return new Shape("circle", args[0], [0, 0]);
  }
  return new Shape("circle", args[2], [args[0], args[1]]);
}

export function newRectangleShape(width: number, height: number): Shape;
export function newRectangleShape(x: number, y: number, width: number, height: number): Shape;
export function newRectangleShape(...args: number[]): Shape {
  let x = 0, y = 0, w: number, h: number;
  if (args.length === 2) {
    [w, h] = args;
  } else {
    [x, y, w, h] = args;
  }
  // Rectangle as 4-vertex polygon (centered at x,y)
  const hw = w / 2, hh = h / 2;
  return new Shape("polygon", 0, [
    x - hw, y - hh,
    x + hw, y - hh,
    x + hw, y + hh,
    x - hw, y + hh,
  ]);
}

export function newPolygonShape(...vertices: number[]): Shape {
  // Flatten if passed as pairs
  const verts = vertices.length === 1 && Array.isArray(vertices[0])
    ? vertices[0] as number[]
    : vertices;
  return new Shape("polygon", 0, [...verts]);
}

export function newEdgeShape(x1: number, y1: number, x2: number, y2: number): Shape {
  return new Shape("edge", 0, [x1, y1, x2, y2]);
}

export function newChainShape(loop: boolean, ...vertices: number[]): Shape {
  const verts = vertices.length === 1 && Array.isArray(vertices[0])
    ? vertices[0] as number[]
    : vertices;
  const shape = new Shape("chain", 0, [...verts]);
  (shape as any)._loop = loop;
  return shape;
}

// ── Fixture factory ─────────────────────────────────────────────────

export function newFixture(body: Body, shape: Shape, density: number = 1): Fixture {
  const b2 = lib();
  const type = shape.getType();
  const pts = shape._points;
  let shapeIdx: number;
  let isChain = false;
  const hitEvents = body._world._callbacks.postSolve ? 1 : 0;
  const preSolveEvents = body._world._callbacks.preSolve ? 1 : 0;

  switch (type) {
    case "circle": {
      const cx = pts.length >= 2 ? toMeters(pts[0]) : 0;
      const cy = pts.length >= 2 ? toMeters(pts[1]) : 0;
      shapeIdx = b2.jove_CreateCircleShape(
        body._id, density, 0.2, 0, 0, hitEvents, preSolveEvents,
        cx, cy, toMeters(shape._radius)
      );
      break;
    }
    case "polygon": {
      if (pts.length === 8) {
        // Check if it's an axis-aligned rectangle (from newRectangleShape)
        const [x0, y0, x1, y1, x2, y2, x3, y3] = pts;
        const isRect = x0 === x3 && x1 === x2 && y0 === y1 && y2 === y3;
        if (isRect) {
          const hw = toMeters(Math.abs(x1 - x0) / 2);
          const hh = toMeters(Math.abs(y2 - y1) / 2);
          shapeIdx = b2.jove_CreateBoxShape(
            body._id, density, 0.2, 0, 0, hitEvents, preSolveEvents, hw, hh
          );
          break;
        }
      }
      // General polygon
      const vertBuf = new Float32Array(pts.length);
      for (let i = 0; i < pts.length; i++) {
        vertBuf[i] = toMeters(pts[i]);
      }
      shapeIdx = b2.jove_CreatePolygonShape(
        body._id, density, 0.2, 0, 0, hitEvents, preSolveEvents,
        ptr(vertBuf), pts.length / 2
      );
      break;
    }
    case "edge": {
      shapeIdx = b2.jove_CreateEdgeShape(
        body._id, density, 0.2, 0, 0, hitEvents, preSolveEvents,
        toMeters(pts[0]), toMeters(pts[1]),
        toMeters(pts[2]), toMeters(pts[3])
      );
      break;
    }
    case "chain": {
      isChain = true;
      const vertBuf = new Float32Array(pts.length);
      for (let i = 0; i < pts.length; i++) {
        vertBuf[i] = toMeters(pts[i]);
      }
      shapeIdx = b2.jove_CreateChainShape(
        body._id, 0.2, 0,
        ptr(vertBuf), pts.length / 2,
        (shape as any)._loop ? 1 : 0
      );
      break;
    }
    default:
      throw new Error(`Unknown shape type: ${type}`);
  }

  const fixture = new Fixture(body, shapeIdx, shape, isChain);
  body._fixtures.push(fixture);
  body._world._fixturesByIndex[shapeIdx] = fixture;
  return fixture;
}

// ── Joint factories ─────────────────────────────────────────────────

export function newDistanceJoint(bodyA: Body, bodyB: Body,
                                  x1: number, y1: number,
                                  x2: number, y2: number,
                                  collideConnected: boolean = false): DistanceJoint {
  const world = bodyA._world;
  // Convert world-space anchor points to local anchors
  const [lax, lay] = bodyA.getLocalPoint(x1, y1);
  const [lbx, lby] = bodyB.getLocalPoint(x2, y2);
  const jointId = lib().jove_CreateDistanceJoint(
    world._id, bodyA._id, bodyB._id,
    toMeters(lax), toMeters(lay), toMeters(lbx), toMeters(lby),
    collideConnected ? 1 : 0
  );
  const joint = new DistanceJoint(world, jointId, bodyA, bodyB);
  world._joints.set(jointId, joint);
  return joint;
}

export function newRevoluteJoint(bodyA: Body, bodyB: Body,
                                  x: number, y: number,
                                  collideConnected: boolean = false): RevoluteJoint {
  const world = bodyA._world;
  const [lax, lay] = bodyA.getLocalPoint(x, y);
  const [lbx, lby] = bodyB.getLocalPoint(x, y);
  const jointId = lib().jove_CreateRevoluteJoint(
    world._id, bodyA._id, bodyB._id,
    toMeters(lax), toMeters(lay), toMeters(lbx), toMeters(lby),
    collideConnected ? 1 : 0
  );
  const joint = new RevoluteJoint(world, jointId, bodyA, bodyB);
  world._joints.set(jointId, joint);
  return joint;
}

export function newPrismaticJoint(bodyA: Body, bodyB: Body,
                                   x: number, y: number,
                                   ax: number, ay: number,
                                   collideConnected: boolean = false): PrismaticJoint {
  const world = bodyA._world;
  const [lax, lay] = bodyA.getLocalPoint(x, y);
  const [lbx, lby] = bodyB.getLocalPoint(x, y);
  const jointId = lib().jove_CreatePrismaticJoint(
    world._id, bodyA._id, bodyB._id,
    toMeters(lax), toMeters(lay), toMeters(lbx), toMeters(lby),
    ax, ay,
    collideConnected ? 1 : 0
  );
  const joint = new PrismaticJoint(world, jointId, bodyA, bodyB);
  world._joints.set(jointId, joint);
  return joint;
}

export function newWeldJoint(bodyA: Body, bodyB: Body,
                              x: number, y: number,
                              collideConnected: boolean = false): WeldJoint {
  const world = bodyA._world;
  const [lax, lay] = bodyA.getLocalPoint(x, y);
  const [lbx, lby] = bodyB.getLocalPoint(x, y);
  const jointId = lib().jove_CreateWeldJoint(
    world._id, bodyA._id, bodyB._id,
    toMeters(lax), toMeters(lay), toMeters(lbx), toMeters(lby),
    collideConnected ? 1 : 0
  );
  const joint = new WeldJoint(world, jointId, bodyA, bodyB);
  world._joints.set(jointId, joint);
  return joint;
}

export function newMouseJoint(body: Body, x: number, y: number): MouseJoint {
  const world = body._world;
  // MouseJoint needs a static body as bodyA — create a temp static body
  const groundIdx = lib().jove_CreateBody(world._id, BODY_TYPE_STATIC, 0, 0, 0);
  const ground = new Body(world, groundIdx);
  ground._cachedType = "static";
  ground._transformCached = true;
  world._bodiesByIndex[groundIdx] = ground;

  const jointId = lib().jove_CreateMouseJoint(
    world._id, groundIdx, body._id,
    toMeters(x), toMeters(y)
  );
  const joint = new MouseJoint(world, jointId, ground, body);
  world._joints.set(jointId, joint);
  return joint;
}

export function newWheelJoint(bodyA: Body, bodyB: Body,
                               x: number, y: number,
                               ax: number, ay: number,
                               collideConnected: boolean = false): WheelJoint {
  const world = bodyA._world;
  const [lax, lay] = bodyA.getLocalPoint(x, y);
  const [lbx, lby] = bodyB.getLocalPoint(x, y);
  const jointId = lib().jove_CreateWheelJoint(
    world._id, bodyA._id, bodyB._id,
    toMeters(lax), toMeters(lay), toMeters(lbx), toMeters(lby),
    ax, ay,
    collideConnected ? 1 : 0
  );
  const joint = new WheelJoint(world, jointId, bodyA, bodyB);
  world._joints.set(jointId, joint);
  return joint;
}

export function newMotorJoint(bodyA: Body, bodyB: Body,
                               correctionFactor: number = 0.3,
                               collideConnected: boolean = false): MotorJoint {
  const world = bodyA._world;
  const jointId = lib().jove_CreateMotorJoint(
    world._id, bodyA._id, bodyB._id,
    correctionFactor,
    collideConnected ? 1 : 0
  );
  const joint = new MotorJoint(world, jointId, bodyA, bodyB);
  world._joints.set(jointId, joint);
  return joint;
}
