import { test, expect, describe, afterAll } from "bun:test";
import * as filesystem from "../src/jove/filesystem.ts";
import { unlinkSync, rmdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const testDir = resolve(import.meta.dir, ".tmp-fs-test");

describe("jove.filesystem", () => {
  afterAll(() => {
    // Cleanup test files
    try {
      if (existsSync(resolve(testDir, "test.txt"))) unlinkSync(resolve(testDir, "test.txt"));
      if (existsSync(resolve(testDir, "append.txt"))) unlinkSync(resolve(testDir, "append.txt"));
      if (existsSync(resolve(testDir, "sub"))) rmdirSync(resolve(testDir, "sub"));
      if (existsSync(testDir)) rmdirSync(testDir);
    } catch {}
  });

  test("getSaveDirectory returns a path", () => {
    const dir = filesystem.getSaveDirectory();
    expect(typeof dir).toBe("string");
    expect(dir.length).toBeGreaterThan(0);
  });

  test("getSourceBaseDirectory returns cwd", () => {
    expect(filesystem.getSourceBaseDirectory()).toBe(process.cwd());
  });

  test("setIdentity/getIdentity round-trip", () => {
    filesystem.setIdentity("test-game");
    expect(filesystem.getIdentity()).toBe("test-game");
    filesystem.setIdentity("jove2d"); // Reset
  });

  test("write and read a file", async () => {
    const ok = await filesystem.write(resolve(testDir, "test.txt"), "hello world");
    expect(ok).toBe(true);

    const content = await filesystem.read(resolve(testDir, "test.txt"));
    expect(content).toBe("hello world");
  });

  test("append to a file", async () => {
    await filesystem.write(resolve(testDir, "append.txt"), "line1\n");
    filesystem.append(resolve(testDir, "append.txt"), "line2\n");
    const content = await filesystem.read(resolve(testDir, "append.txt"));
    expect(content).toBe("line1\nline2\n");
  });

  test("getInfo returns file info", async () => {
    await filesystem.write(resolve(testDir, "test.txt"), "data");
    const info = filesystem.getInfo(resolve(testDir, "test.txt"));
    expect(info).not.toBeNull();
    expect(info!.type).toBe("file");
    expect(info!.size).toBeGreaterThan(0);
  });

  test("createDirectory creates a directory", () => {
    const ok = filesystem.createDirectory(resolve(testDir, "sub"));
    expect(ok).toBe(true);
    const info = filesystem.getInfo(resolve(testDir, "sub"));
    expect(info).not.toBeNull();
    expect(info!.type).toBe("directory");
  });

  test("getDirectoryItems lists files", () => {
    const items = filesystem.getDirectoryItems(testDir);
    expect(items.length).toBeGreaterThan(0);
  });

  test("remove deletes a file", async () => {
    await filesystem.write(resolve(testDir, "delete-me.txt"), "bye");
    const ok = filesystem.remove(resolve(testDir, "delete-me.txt"));
    expect(ok).toBe(true);
    expect(filesystem.getInfo(resolve(testDir, "delete-me.txt"))).toBeNull();
  });

  test("lines returns array of lines", async () => {
    await filesystem.write(resolve(testDir, "test.txt"), "a\nb\nc");
    const result = await filesystem.lines(resolve(testDir, "test.txt"));
    expect(result).toEqual(["a", "b", "c"]);
  });

  test("read returns null for nonexistent file", async () => {
    const content = await filesystem.read("/nonexistent/path/file.txt");
    expect(content).toBeNull();
  });

  test("getInfo returns null for nonexistent path", () => {
    expect(filesystem.getInfo("/nonexistent/path")).toBeNull();
  });
});
