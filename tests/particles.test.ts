import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import sdl from "../src/sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../src/sdl/types.ts";
import * as window from "../src/jove/window.ts";
import * as graphics from "../src/jove/graphics.ts";
import type { ParticleSystem } from "../src/jove/particles.ts";

describe("jove.graphics — ParticleSystem", () => {
  let img: ReturnType<typeof graphics.newCanvas>;

  beforeAll(() => {
    sdl.SDL_Init(SDL_INIT_VIDEO);
    window.setMode(640, 480);
    graphics._createRenderer();
    img = graphics.newCanvas(16, 16);
  });

  afterAll(() => {
    if (img) img.release();
    graphics._destroyRenderer();
    window.close();
    sdl.SDL_Quit();
  });

  // --- Creation ---

  test("newParticleSystem creates a system with default capacity", () => {
    const ps = graphics.newParticleSystem(img!);
    expect(ps).not.toBeNull();
    expect(ps!.getBufferSize()).toBe(1000);
    expect(ps!.getCount()).toBe(0);
    expect(ps!._isParticleSystem).toBe(true);
  });

  test("newParticleSystem with custom capacity", () => {
    const ps = graphics.newParticleSystem(img!, 50);
    expect(ps).not.toBeNull();
    expect(ps!.getBufferSize()).toBe(50);
  });

  test("newParticleSystem returns null without renderer", () => {
    graphics._destroyRenderer();
    const ps = graphics.newParticleSystem(img!);
    expect(ps).toBeNull();
    graphics._createRenderer();
  });

  // --- Lifecycle ---

  test("isActive/isStopped/isPaused initial state", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    expect(ps.isActive()).toBe(false);
    expect(ps.isStopped()).toBe(true);
    expect(ps.isPaused()).toBe(false);
  });

  test("start makes active", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.start();
    expect(ps.isActive()).toBe(true);
    expect(ps.isStopped()).toBe(false);
  });

  test("stop makes stopped", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.start();
    ps.stop();
    expect(ps.isStopped()).toBe(true);
    expect(ps.isActive()).toBe(false);
  });

  test("pause makes paused", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.start();
    ps.pause();
    expect(ps.isPaused()).toBe(true);
    expect(ps.isActive()).toBe(false);
  });

  test("reset clears particles and stops", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(1);
    ps.start();
    ps.emit(10);
    expect(ps.getCount()).toBe(10);
    ps.reset();
    expect(ps.getCount()).toBe(0);
    expect(ps.isStopped()).toBe(true);
  });

  // --- Emission config ---

  test("setEmissionRate/getEmissionRate", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setEmissionRate(50);
    expect(ps.getEmissionRate()).toBe(50);
  });

  test("setEmitterLifetime/getEmitterLifetime", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setEmitterLifetime(5);
    expect(ps.getEmitterLifetime()).toBe(5);
  });

  test("setParticleLifetime/getParticleLifetime", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(0.5, 2);
    expect(ps.getParticleLifetime()).toEqual([0.5, 2]);
  });

  test("setParticleLifetime single value", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(1);
    expect(ps.getParticleLifetime()).toEqual([1, 1]);
  });

  // --- Position ---

  test("setPosition/getPosition", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setPosition(100, 200);
    expect(ps.getPosition()).toEqual([100, 200]);
  });

  test("moveTo updates position for lerping", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setPosition(0, 0);
    ps.moveTo(100, 200);
    expect(ps.getPosition()).toEqual([100, 200]);
  });

  // --- Emission area ---

  test("setEmissionArea/getEmissionArea", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setEmissionArea("uniform", 10, 20, 0.5, true);
    expect(ps.getEmissionArea()).toEqual(["uniform", 10, 20, 0.5, true]);
  });

  test("setEmissionArea defaults", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setEmissionArea("ellipse", 5, 5);
    expect(ps.getEmissionArea()).toEqual(["ellipse", 5, 5, 0, false]);
  });

  // --- Physics config ---

  test("setDirection/getDirection", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setDirection(Math.PI / 2);
    expect(ps.getDirection()).toBe(Math.PI / 2);
  });

  test("setSpeed/getSpeed", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setSpeed(50, 100);
    expect(ps.getSpeed()).toEqual([50, 100]);
  });

  test("setSpeed single value", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setSpeed(75);
    expect(ps.getSpeed()).toEqual([75, 75]);
  });

  test("setSpread/getSpread", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setSpread(Math.PI);
    expect(ps.getSpread()).toBe(Math.PI);
  });

  test("setLinearAcceleration/getLinearAcceleration", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setLinearAcceleration(-10, 50, 10, 100);
    expect(ps.getLinearAcceleration()).toEqual([-10, 50, 10, 100]);
  });

  test("setLinearDamping/getLinearDamping", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setLinearDamping(0.5, 1.0);
    expect(ps.getLinearDamping()).toEqual([0.5, 1.0]);
  });

  test("setRadialAcceleration/getRadialAcceleration", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setRadialAcceleration(-20, 20);
    expect(ps.getRadialAcceleration()).toEqual([-20, 20]);
  });

  test("setTangentialAcceleration/getTangentialAcceleration", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setTangentialAcceleration(-10, 10);
    expect(ps.getTangentialAcceleration()).toEqual([-10, 10]);
  });

  // --- Visual config ---

  test("getTexture returns the source image", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    expect(ps.getTexture()).toBe(img);
  });

  test("setTexture changes the texture", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    const img2 = graphics.newCanvas(32, 32);
    ps.setTexture(img2!);
    expect(ps.getTexture()).toBe(img2);
    img2!.release();
  });

  test("setColors/getColors", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setColors(255, 0, 0, 255, 0, 0, 255, 128);
    expect(ps.getColors()).toEqual([255, 0, 0, 255, 0, 0, 255, 128]);
  });

  test("setSizes/getSizes", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setSizes(0.5, 1, 2);
    expect(ps.getSizes()).toEqual([0.5, 1, 2]);
  });

  test("setSizeVariation/getSizeVariation clamps to 0-1", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setSizeVariation(0.75);
    expect(ps.getSizeVariation()).toBe(0.75);
    ps.setSizeVariation(2);
    expect(ps.getSizeVariation()).toBe(1);
    ps.setSizeVariation(-1);
    expect(ps.getSizeVariation()).toBe(0);
  });

  test("setRotation/getRotation", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setRotation(0, Math.PI * 2);
    expect(ps.getRotation()).toEqual([0, Math.PI * 2]);
  });

  test("setSpin/getSpin", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setSpin(1, 5);
    expect(ps.getSpin()).toEqual([1, 5]);
  });

  test("setSpinVariation/getSpinVariation", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setSpinVariation(0.5);
    expect(ps.getSpinVariation()).toBe(0.5);
  });

  test("setRelativeRotation/hasRelativeRotation", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    expect(ps.hasRelativeRotation()).toBe(false);
    ps.setRelativeRotation(true);
    expect(ps.hasRelativeRotation()).toBe(true);
  });

  test("setOffset/getOffset", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setOffset(8, 8);
    expect(ps.getOffset()).toEqual([8, 8]);
  });

  test("setQuads/getQuads", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    const q1 = graphics.newQuad(0, 0, 8, 8, 16, 16);
    const q2 = graphics.newQuad(8, 0, 8, 8, 16, 16);
    ps.setQuads(q1, q2);
    expect(ps.getQuads()).toEqual([q1, q2]);
  });

  // --- Insert mode ---

  test("setInsertMode/getInsertMode", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    expect(ps.getInsertMode()).toBe("top");
    ps.setInsertMode("bottom");
    expect(ps.getInsertMode()).toBe("bottom");
    ps.setInsertMode("random");
    expect(ps.getInsertMode()).toBe("random");
  });

  // --- Buffer ---

  test("setBufferSize/getBufferSize", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setBufferSize(200);
    expect(ps.getBufferSize()).toBe(200);
  });

  test("setBufferSize shrinks and clamps count", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(10);
    ps.emit(50);
    expect(ps.getCount()).toBe(50);
    ps.setBufferSize(20);
    expect(ps.getBufferSize()).toBe(20);
    expect(ps.getCount()).toBe(20);
  });

  // --- emit() ---

  test("emit spawns particles up to max", () => {
    const ps = graphics.newParticleSystem(img!, 10)!;
    ps.setParticleLifetime(1);
    ps.emit(5);
    expect(ps.getCount()).toBe(5);
    ps.emit(10); // only 5 more slots
    expect(ps.getCount()).toBe(10);
  });

  // --- update() ---

  test("update ages and kills particles", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(0.1, 0.1);
    ps.emit(10);
    expect(ps.getCount()).toBe(10);
    ps.update(0.2); // all particles should die
    expect(ps.getCount()).toBe(0);
  });

  test("update does not emit when paused", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(1);
    ps.setEmissionRate(100);
    ps.start();
    ps.pause();
    ps.update(1);
    expect(ps.getCount()).toBe(0);
  });

  test("update emits particles at rate", () => {
    const ps = graphics.newParticleSystem(img!, 1000)!;
    ps.setParticleLifetime(10);
    ps.setEmissionRate(100); // 100 per second
    ps.start();
    ps.update(0.1); // should emit ~10
    const count = ps.getCount();
    expect(count).toBeGreaterThanOrEqual(9);
    expect(count).toBeLessThanOrEqual(11);
  });

  test("update applies linear acceleration", () => {
    const ps = graphics.newParticleSystem(img!, 10)!;
    ps.setParticleLifetime(10);
    ps.setPosition(0, 0);
    ps.setSpeed(0);
    ps.setLinearAcceleration(0, 100, 0, 100); // gravity down
    ps.emit(1);
    ps.update(1); // 1 second
    // Particle should have moved downward
    const data = ps._getVertexData();
    expect(data).not.toBeNull();
    // Vertex Y values should be positive (moved down)
    // Average Y of the 4 vertices
    const avgY = (data!.vertices[1] + data!.vertices[9] + data!.vertices[17] + data!.vertices[25]) / 4;
    expect(avgY).toBeGreaterThan(0);
  });

  test("update applies damping", () => {
    const ps = graphics.newParticleSystem(img!, 10)!;
    ps.setParticleLifetime(10);
    ps.setPosition(0, 0);
    ps.setDirection(0);
    ps.setSpeed(100, 100);
    ps.setSpread(0);
    ps.setLinearDamping(5, 5);
    ps.emit(1);

    // After damping, particle should move less than 100 units
    ps.update(1);
    const data = ps._getVertexData();
    expect(data).not.toBeNull();
    const avgX = (data!.vertices[0] + data!.vertices[8] + data!.vertices[16] + data!.vertices[24]) / 4;
    // With heavy damping, should be much less than 100
    expect(avgX).toBeGreaterThan(0);
    expect(avgX).toBeLessThan(100);
  });

  // --- Emitter lifetime ---

  test("emitter stops after lifetime expires", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(10);
    ps.setEmissionRate(100);
    ps.setEmitterLifetime(0.1);
    ps.start();
    expect(ps.isActive()).toBe(true);
    ps.update(0.2); // emitter should have stopped
    const countAfterStop = ps.getCount();
    ps.update(0.1); // no new particles
    // Count should only decrease (particles dying) or stay same, not increase
    expect(ps.getCount()).toBeLessThanOrEqual(countAfterStop);
    expect(ps.isStopped()).toBe(true);
  });

  // --- clone() ---

  test("clone copies config but not particles", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setEmissionRate(50);
    ps.setParticleLifetime(1, 2);
    ps.setSpeed(100, 200);
    ps.setDirection(Math.PI);
    ps.setSpread(0.5);
    ps.setColors(255, 0, 0, 255);
    ps.setSizes(0.5, 1, 2);
    ps.setOffset(4, 4);
    ps.setInsertMode("bottom");
    ps.emit(10);

    const clone = ps.clone();
    expect(clone.getEmissionRate()).toBe(50);
    expect(clone.getParticleLifetime()).toEqual([1, 2]);
    expect(clone.getSpeed()).toEqual([100, 200]);
    expect(clone.getDirection()).toBe(Math.PI);
    expect(clone.getSpread()).toBe(0.5);
    expect(clone.getColors()).toEqual([255, 0, 0, 255]);
    expect(clone.getSizes()).toEqual([0.5, 1, 2]);
    expect(clone.getOffset()).toEqual([4, 4]);
    expect(clone.getInsertMode()).toBe("bottom");
    expect(clone.getCount()).toBe(0); // no particles cloned
    expect(clone.getBufferSize()).toBe(100);
  });

  // --- draw() integration ---

  test("draw() with empty system is no-op", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    expect(() => graphics.draw(ps, 0, 0)).not.toThrow();
  });

  test("draw() with particles does not throw", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(1);
    ps.emit(10);
    expect(() => graphics.draw(ps)).not.toThrow();
  });

  test("draw() with transform does not throw", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(1);
    ps.emit(5);
    expect(() => graphics.draw(ps, 100, 200, Math.PI / 4, 2, 2, 8, 8)).not.toThrow();
  });

  test("draw() with global transform does not throw", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(1);
    ps.emit(5);
    graphics.push();
    graphics.translate(100, 100);
    graphics.rotate(0.5);
    expect(() => graphics.draw(ps)).not.toThrow();
    graphics.pop();
  });

  // --- _getVertexData ---

  test("_getVertexData returns null when empty", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    expect(ps._getVertexData()).toBeNull();
  });

  test("_getVertexData returns correct counts", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(1);
    ps.emit(5);
    const data = ps._getVertexData();
    expect(data).not.toBeNull();
    expect(data!.numVerts).toBe(20); // 5 particles * 4 verts
    expect(data!.numIndices).toBe(30); // 5 particles * 6 indices
  });

  // --- Color interpolation ---

  test("single color produces consistent vertex colors", () => {
    const ps = graphics.newParticleSystem(img!, 10)!;
    ps.setParticleLifetime(10);
    ps.setColors(255, 128, 64, 200);
    ps.emit(1);
    const data = ps._getVertexData()!;
    // Check vertex color (r, g, b, a are at offsets 2,3,4,5)
    expect(data.vertices[2]).toBeCloseTo(1.0, 1);       // r = 255/255
    expect(data.vertices[3]).toBeCloseTo(128 / 255, 1);  // g
    expect(data.vertices[4]).toBeCloseTo(64 / 255, 1);   // b
    expect(data.vertices[5]).toBeCloseTo(200 / 255, 1);  // a
  });

  // --- Emission area distributions ---

  test("emission area uniform spawns within bounds", () => {
    const ps = graphics.newParticleSystem(img!, 1000)!;
    ps.setParticleLifetime(10);
    ps.setPosition(0, 0);
    ps.setSpeed(0);
    ps.setEmissionArea("uniform", 50, 50);
    ps.emit(100);
    const data = ps._getVertexData()!;
    // Check that all particle centers are within bounds (roughly)
    for (let i = 0; i < 100; i++) {
      const base = i * 32;
      const cx = (data.vertices[base] + data.vertices[base + 8] + data.vertices[base + 16] + data.vertices[base + 24]) / 4;
      const cy = (data.vertices[base + 1] + data.vertices[base + 9] + data.vertices[base + 17] + data.vertices[base + 25]) / 4;
      expect(cx).toBeGreaterThanOrEqual(-60);
      expect(cx).toBeLessThanOrEqual(60);
      expect(cy).toBeGreaterThanOrEqual(-60);
      expect(cy).toBeLessThanOrEqual(60);
    }
  });

  test("emission area ellipse spawns within ellipse", () => {
    const ps = graphics.newParticleSystem(img!, 1000)!;
    ps.setParticleLifetime(10);
    ps.setPosition(0, 0);
    ps.setSpeed(0);
    ps.setEmissionArea("ellipse", 30, 30);
    ps.emit(50);
    const data = ps._getVertexData()!;
    for (let i = 0; i < 50; i++) {
      const base = i * 32;
      const cx = (data.vertices[base] + data.vertices[base + 8] + data.vertices[base + 16] + data.vertices[base + 24]) / 4;
      const cy = (data.vertices[base + 1] + data.vertices[base + 9] + data.vertices[base + 17] + data.vertices[base + 25]) / 4;
      const dist = Math.sqrt(cx * cx + cy * cy);
      // Should be within the ellipse radius (with some margin for particle size)
      expect(dist).toBeLessThan(50);
    }
  });

  // --- Insert modes ---

  test("insert mode bottom works", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(10);
    ps.setInsertMode("bottom");
    ps.emit(5);
    expect(ps.getCount()).toBe(5);
  });

  test("insert mode random works", () => {
    const ps = graphics.newParticleSystem(img!, 100)!;
    ps.setParticleLifetime(10);
    ps.setInsertMode("random");
    ps.emit(5);
    expect(ps.getCount()).toBe(5);
  });
});
