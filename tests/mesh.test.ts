import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import sdl from "../src/sdl/ffi.ts";
import { SDL_INIT_VIDEO } from "../src/sdl/types.ts";
import * as window from "../src/jove/window.ts";
import * as graphics from "../src/jove/graphics.ts";
import type { Mesh, MeshDrawMode } from "../src/jove/graphics.ts";

describe("jove.graphics — Mesh", () => {
  beforeAll(() => {
    sdl.SDL_Init(SDL_INIT_VIDEO);
    window.setMode(640, 480);
    graphics._createRenderer();
  });

  afterAll(() => {
    graphics._destroyRenderer();
    window.close();
    sdl.SDL_Quit();
  });

  // --- Creation ---

  test("newMesh with vertex count creates mesh with correct count", () => {
    const mesh = graphics.newMesh(4);
    expect(mesh).not.toBeNull();
    expect(mesh!.getVertexCount()).toBe(4);
  });

  test("newMesh with vertex count defaults to fan mode", () => {
    const mesh = graphics.newMesh(4)!;
    expect(mesh.getDrawMode()).toBe("fan");
  });

  test("newMesh with vertex count initializes white color", () => {
    const mesh = graphics.newMesh(3)!;
    const [x, y, u, v, r, g, b, a] = mesh.getVertex(1);
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(r).toBe(1);
    expect(g).toBe(1);
    expect(b).toBe(1);
    expect(a).toBe(1);
  });

  test("newMesh with vertex array", () => {
    const mesh = graphics.newMesh([
      [10, 20, 0.5, 0.5, 1, 0, 0, 1],
      [30, 40, 1.0, 1.0, 0, 1, 0, 0.5],
    ])!;
    expect(mesh.getVertexCount()).toBe(2);
    const [x, y, u, v, r, g, b, a] = mesh.getVertex(1);
    expect(x).toBe(10);
    expect(y).toBe(20);
    expect(u).toBeCloseTo(0.5);
    expect(v).toBeCloseTo(0.5);
    expect(r).toBe(1);
    expect(g).toBe(0);
    expect(b).toBe(0);
    expect(a).toBe(1);
  });

  test("newMesh with custom draw mode", () => {
    const mesh = graphics.newMesh(6, "triangles")!;
    expect(mesh.getDrawMode()).toBe("triangles");
  });

  test("newMesh returns null without renderer", () => {
    graphics._destroyRenderer();
    const mesh = graphics.newMesh(3);
    expect(mesh).toBeNull();
    graphics._createRenderer();
  });

  // --- setVertex / getVertex ---

  test("setVertex and getVertex round-trip", () => {
    const mesh = graphics.newMesh(3)!;
    mesh.setVertex(1, 100, 200, 0.25, 0.75, 0.5, 0.6, 0.7, 0.8);
    const [x, y, u, v, r, g, b, a] = mesh.getVertex(1);
    expect(x).toBe(100);
    expect(y).toBe(200);
    expect(u).toBeCloseTo(0.25);
    expect(v).toBeCloseTo(0.75);
    expect(r).toBeCloseTo(0.5);
    expect(g).toBeCloseTo(0.6);
    expect(b).toBeCloseTo(0.7);
    expect(a).toBeCloseTo(0.8);
  });

  test("setVertex with default color/UV", () => {
    const mesh = graphics.newMesh(3)!;
    mesh.setVertex(2, 50, 60);
    const [x, y, u, v, r, g, b, a] = mesh.getVertex(2);
    expect(x).toBe(50);
    expect(y).toBe(60);
    expect(u).toBe(0);
    expect(v).toBe(0);
    expect(r).toBe(1);
    expect(g).toBe(1);
    expect(b).toBe(1);
    expect(a).toBe(1);
  });

  test("getVertex with out-of-range index returns defaults", () => {
    const mesh = graphics.newMesh(2)!;
    const v = mesh.getVertex(99);
    expect(v).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });

  // --- setVertices ---

  test("setVertices replaces multiple vertices", () => {
    const mesh = graphics.newMesh(4)!;
    mesh.setVertices([
      [10, 20],
      [30, 40],
    ], 2); // start at vertex 2
    const [x1, y1] = mesh.getVertex(2);
    const [x2, y2] = mesh.getVertex(3);
    expect(x1).toBe(10);
    expect(y1).toBe(20);
    expect(x2).toBe(30);
    expect(y2).toBe(40);
  });

  // --- setVertexMap / getVertexMap ---

  test("vertex map is null by default", () => {
    const mesh = graphics.newMesh(4)!;
    expect(mesh.getVertexMap()).toBeNull();
  });

  test("setVertexMap and getVertexMap round-trip", () => {
    const mesh = graphics.newMesh(4)!;
    mesh.setVertexMap(1, 2, 3, 1, 3, 4);
    expect(mesh.getVertexMap()).toEqual([1, 2, 3, 1, 3, 4]);
  });

  test("setVertexMapArray works", () => {
    const mesh = graphics.newMesh(4)!;
    mesh.setVertexMapArray([1, 2, 3]);
    expect(mesh.getVertexMap()).toEqual([1, 2, 3]);
  });

  // --- Texture ---

  test("texture is null by default", () => {
    const mesh = graphics.newMesh(3)!;
    expect(mesh.getTexture()).toBeNull();
  });

  test("setTexture and getTexture round-trip", () => {
    const mesh = graphics.newMesh(3)!;
    const canvas = graphics.newCanvas(16, 16)!;
    mesh.setTexture(canvas);
    expect(mesh.getTexture()).toBe(canvas);
    mesh.setTexture(null);
    expect(mesh.getTexture()).toBeNull();
    canvas.release();
  });

  // --- Draw mode ---

  test("setDrawMode and getDrawMode", () => {
    const mesh = graphics.newMesh(6)!;
    mesh.setDrawMode("triangles");
    expect(mesh.getDrawMode()).toBe("triangles");
    mesh.setDrawMode("strip");
    expect(mesh.getDrawMode()).toBe("strip");
    mesh.setDrawMode("points");
    expect(mesh.getDrawMode()).toBe("points");
  });

  // --- Draw range ---

  test("draw range is null by default", () => {
    const mesh = graphics.newMesh(4)!;
    expect(mesh.getDrawRange()).toBeNull();
  });

  test("setDrawRange and getDrawRange", () => {
    const mesh = graphics.newMesh(10)!;
    mesh.setDrawRange(2, 5);
    expect(mesh.getDrawRange()).toEqual([2, 5]);
    mesh.setDrawRange();
    expect(mesh.getDrawRange()).toBeNull();
  });

  // --- Vertex attributes ---

  test("setVertexAttribute and getVertexAttribute for position", () => {
    const mesh = graphics.newMesh(3)!;
    mesh.setVertexAttribute(1, 1, 42, 99); // vertex 1, attr 1 (position)
    const pos = mesh.getVertexAttribute(1, 1);
    expect(pos).toEqual([42, 99]);
  });

  test("setVertexAttribute and getVertexAttribute for texcoord", () => {
    const mesh = graphics.newMesh(3)!;
    mesh.setVertexAttribute(1, 2, 0.25, 0.75); // vertex 1, attr 2 (texcoord)
    const uv = mesh.getVertexAttribute(1, 2);
    expect(uv[0]).toBeCloseTo(0.25);
    expect(uv[1]).toBeCloseTo(0.75);
  });

  test("setVertexAttribute and getVertexAttribute for color", () => {
    const mesh = graphics.newMesh(3)!;
    mesh.setVertexAttribute(1, 3, 0.1, 0.2, 0.3, 0.4); // vertex 1, attr 3 (color)
    const color = mesh.getVertexAttribute(1, 3);
    expect(color[0]).toBeCloseTo(0.1);
    expect(color[1]).toBeCloseTo(0.2);
    expect(color[2]).toBeCloseTo(0.3);
    expect(color[3]).toBeCloseTo(0.4);
  });

  // --- Vertex format ---

  test("getVertexFormat returns standard format", () => {
    const mesh = graphics.newMesh(3)!;
    const fmt = mesh.getVertexFormat();
    expect(fmt).toHaveLength(3);
    expect(fmt[0]).toEqual({ name: "VertexPosition", type: "float", components: 2 });
    expect(fmt[1]).toEqual({ name: "VertexTexCoord", type: "float", components: 2 });
    expect(fmt[2]).toEqual({ name: "VertexColor", type: "byte", components: 4 });
  });

  // --- _isMesh ---

  test("_isMesh flag is true", () => {
    const mesh = graphics.newMesh(3)!;
    expect(mesh._isMesh).toBe(true);
  });

  // --- _getDrawData (internal) ---

  test("fan mode generates correct triangle indices", () => {
    const mesh = graphics.newMesh(4, "fan")!;
    mesh.setVertex(1, 0, 0);
    mesh.setVertex(2, 100, 0);
    mesh.setVertex(3, 100, 100);
    mesh.setVertex(4, 0, 100);
    const data = mesh._getDrawData()!;
    expect(data.numVerts).toBe(4);
    expect(data.numIndices).toBe(6); // 2 triangles
    // Fan: [0,1,2, 0,2,3]
    expect(Array.from(data.indices)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  test("strip mode generates correct triangle indices", () => {
    const mesh = graphics.newMesh(4, "strip")!;
    for (let i = 0; i < 4; i++) mesh.setVertex(i + 1, i * 10, 0);
    const data = mesh._getDrawData()!;
    expect(data.numIndices).toBe(6); // 2 triangles
    // Strip: [0,1,2, 2,1,3]
    expect(Array.from(data.indices)).toEqual([0, 1, 2, 2, 1, 3]);
  });

  test("triangles mode generates correct indices", () => {
    const mesh = graphics.newMesh(6, "triangles")!;
    for (let i = 0; i < 6; i++) mesh.setVertex(i + 1, i * 10, 0);
    const data = mesh._getDrawData()!;
    expect(data.numIndices).toBe(6);
    expect(Array.from(data.indices)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("points mode generates quad vertices", () => {
    const mesh = graphics.newMesh(2, "points")!;
    mesh.setVertex(1, 10, 20, 0, 0, 1, 0, 0, 1);
    mesh.setVertex(2, 30, 40, 0, 0, 0, 1, 0, 1);
    const data = mesh._getDrawData()!;
    expect(data.numVerts).toBe(8); // 2 points × 4 verts each
    expect(data.numIndices).toBe(12); // 2 points × 6 indices each
  });

  test("vertex map affects draw data", () => {
    const mesh = graphics.newMesh(4, "triangles")!;
    mesh.setVertex(1, 0, 0);
    mesh.setVertex(2, 100, 0);
    mesh.setVertex(3, 100, 100);
    mesh.setVertex(4, 0, 100);
    mesh.setVertexMap(1, 2, 3, 1, 3, 4);
    const data = mesh._getDrawData()!;
    expect(data.numIndices).toBe(6);
    // Vertex map [1,2,3,1,3,4] → 0-based [0,1,2,0,2,3]
    expect(Array.from(data.indices)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  test("draw range limits rendered vertices", () => {
    const mesh = graphics.newMesh(6, "triangles")!;
    for (let i = 0; i < 6; i++) mesh.setVertex(i + 1, i * 10, 0);
    mesh.setDrawRange(1, 3); // Only first triangle
    const data = mesh._getDrawData()!;
    expect(data.numIndices).toBe(3);
  });

  // --- Drawing (smoke test — just verify no crash) ---

  test("draw untextured mesh does not crash", () => {
    const mesh = graphics.newMesh([
      [0, 0, 0, 0, 1, 0, 0, 1],
      [100, 0, 0, 0, 0, 1, 0, 1],
      [50, 100, 0, 0, 0, 0, 1, 1],
    ], "fan")!;
    graphics._beginFrame();
    graphics.draw(mesh);
    graphics._endFrame();
  });

  test("draw textured mesh does not crash", () => {
    const canvas = graphics.newCanvas(16, 16)!;
    const mesh = graphics.newMesh([
      [0, 0, 0, 0, 1, 1, 1, 1],
      [100, 0, 1, 0, 1, 1, 1, 1],
      [100, 100, 1, 1, 1, 1, 1, 1],
      [0, 100, 0, 1, 1, 1, 1, 1],
    ], "fan")!;
    mesh.setTexture(canvas);
    graphics._beginFrame();
    graphics.draw(mesh);
    graphics._endFrame();
    canvas.release();
  });

  test("draw mesh with transform does not crash", () => {
    const mesh = graphics.newMesh([
      [0, 0, 0, 0, 1, 0, 0, 1],
      [100, 0, 0, 0, 0, 1, 0, 1],
      [50, 100, 0, 0, 0, 0, 1, 1],
    ], "triangles")!;
    graphics._beginFrame();
    graphics.draw(mesh, 100, 100, Math.PI / 4, 2, 2);
    graphics._endFrame();
  });

  // --- flush / release ---

  test("flush does not crash", () => {
    const mesh = graphics.newMesh(3)!;
    mesh.flush(); // no-op but shouldn't crash
  });

  test("release clears texture reference", () => {
    const canvas = graphics.newCanvas(16, 16)!;
    const mesh = graphics.newMesh(3)!;
    mesh.setTexture(canvas);
    mesh.release();
    expect(mesh.getTexture()).toBeNull();
    canvas.release();
  });
});
