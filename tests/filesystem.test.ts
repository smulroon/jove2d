import { test, expect, describe, afterAll } from "bun:test";
import * as filesystem from "../src/jove/filesystem.ts";
import { File, FileData } from "../src/jove/filesystem.ts";
import { unlinkSync, rmdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const testDir = resolve(import.meta.dir, ".tmp-fs-test");
const mountDir = resolve(import.meta.dir, ".tmp-fs-mount");

describe("jove.filesystem", () => {
  afterAll(() => {
    // Cleanup test files
    try {
      for (const dir of [testDir, mountDir]) {
        if (existsSync(resolve(dir, "sub"))) rmdirSync(resolve(dir, "sub"));
        for (const f of ["test.txt", "append.txt", "delete-me.txt", "file-handle.txt",
          "mounted.txt", "write-test.txt"]) {
          if (existsSync(resolve(dir, f))) unlinkSync(resolve(dir, f));
        }
        if (existsSync(dir)) rmdirSync(dir);
      }
    } catch {}
    // Unmount any leftover mounts
    try { filesystem.unmount(mountDir); } catch {}
  });

  // --- Existing tests ---

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

  // --- New: directory queries ---

  describe("directory queries", () => {
    test("getWorkingDirectory returns cwd", () => {
      expect(filesystem.getWorkingDirectory()).toBe(process.cwd());
    });

    test("getUserDirectory returns home", () => {
      const dir = filesystem.getUserDirectory();
      expect(typeof dir).toBe("string");
      expect(dir.length).toBeGreaterThan(0);
      // Should match HOME env var
      if (process.env.HOME) {
        expect(dir).toBe(process.env.HOME);
      }
    });

    test("getAppdataDirectory returns a path", () => {
      const dir = filesystem.getAppdataDirectory();
      expect(typeof dir).toBe("string");
      expect(dir.length).toBeGreaterThan(0);
    });
  });

  // --- New: mount / unmount ---

  describe("mount / unmount", () => {
    test("mount returns false for nonexistent directory", () => {
      expect(filesystem.mount("/nonexistent/path/abc123")).toBe(false);
    });

    test("mount and read from mounted directory", async () => {
      // Create mount source with a file
      mkdirSync(mountDir, { recursive: true });
      writeFileSync(resolve(mountDir, "mounted.txt"), "mounted content");

      // Mount it
      expect(filesystem.mount(mountDir, "mnt")).toBe(true);

      // Read through mount
      const content = await filesystem.read(resolve(mountDir, "mounted.txt"));
      expect(content).toBe("mounted content");

      // Cleanup
      filesystem.unmount(mountDir);
    });

    test("mount with mountpoint prefix resolves reads", async () => {
      mkdirSync(mountDir, { recursive: true });
      writeFileSync(resolve(mountDir, "mounted.txt"), "hello from mount");

      filesystem.mount(mountDir, "assets");

      // getInfo should find the file via mount
      const info = filesystem.getInfo(resolve(mountDir, "mounted.txt"));
      expect(info).not.toBeNull();
      expect(info!.type).toBe("file");

      filesystem.unmount(mountDir);
    });

    test("unmount returns false for not-mounted path", () => {
      expect(filesystem.unmount("/not/mounted")).toBe(false);
    });

    test("unmount removes the mount", () => {
      mkdirSync(mountDir, { recursive: true });
      filesystem.mount(mountDir, "test");
      expect(filesystem.unmount(mountDir)).toBe(true);
      // Second unmount should fail
      expect(filesystem.unmount(mountDir)).toBe(false);
    });

    test("mount with appendToSearchPath=false prepends", async () => {
      mkdirSync(mountDir, { recursive: true });
      writeFileSync(resolve(mountDir, "mounted.txt"), "prepended");

      filesystem.mount(mountDir, "", false);
      const content = await filesystem.read(resolve(mountDir, "mounted.txt"));
      expect(content).toBe("prepended");

      filesystem.unmount(mountDir);
    });
  });

  // --- New: FileData ---

  describe("FileData", () => {
    test("create from string + filename", () => {
      const fd = filesystem.newFileData("hello world", "test.txt");
      expect(fd.getFilename()).toBe("test.txt");
      expect(fd.getString()).toBe("hello world");
      expect(fd.getSize()).toBe(11);
    });

    test("create from Uint8Array + filename", () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const fd = filesystem.newFileData(bytes, "data.bin");
      expect(fd.getFilename()).toBe("data.bin");
      expect(fd.getSize()).toBe(4);
      expect(fd._data).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    test("create from filepath (single arg)", async () => {
      await filesystem.write(resolve(testDir, "test.txt"), "file content");
      const fd = filesystem.newFileData(resolve(testDir, "test.txt"));
      expect(fd.getString()).toBe("file content");
      expect(fd.getFilename()).toBe(resolve(testDir, "test.txt"));
    });

    test("getExtension extracts file extension", () => {
      const fd = new FileData("data", "image.png");
      expect(fd.getExtension()).toBe("png");
    });

    test("getExtension with no extension", () => {
      const fd = new FileData("data", "Makefile");
      expect(fd.getExtension()).toBe("");
    });

    test("clone creates independent copy", () => {
      const original = new FileData("test data", "test.txt");
      const cloned = original.clone();
      expect(cloned.getString()).toBe("test data");
      expect(cloned.getFilename()).toBe("test.txt");
      cloned._data[0] = 0;
      expect(original._data[0]).not.toBe(0);
    });
  });

  // --- New: File handle ---

  describe("File", () => {
    const filePath = resolve(testDir, "file-handle.txt");

    test("newFile creates a closed file", () => {
      const f = filesystem.newFile(filePath);
      expect(f.isOpen()).toBe(false);
      expect(f.getMode()).toBe("c");
      expect(f.getFilename()).toBe(filePath);
    });

    test("open for write, write, close", () => {
      const f = filesystem.newFile(filePath);
      expect(f.open("w")).toBe(true);
      expect(f.isOpen()).toBe(true);
      expect(f.getMode()).toBe("w");
      expect(f.write("Hello, File!")).toBe(true);
      expect(f.tell()).toBe(12);
      expect(f.close()).toBe(true);
      expect(f.isOpen()).toBe(false);
    });

    test("open for read, read all", () => {
      const f = filesystem.newFile(filePath);
      expect(f.open("r")).toBe(true);
      expect(f.getMode()).toBe("r");
      const content = f.read();
      expect(content).toBe("Hello, File!");
      expect(f.isEOF()).toBe(true);
      f.close();
    });

    test("read with count", () => {
      const f = filesystem.newFile(filePath);
      f.open("r");
      const chunk = f.read(5);
      expect(chunk).toBe("Hello");
      expect(f.tell()).toBe(5);
      expect(f.isEOF()).toBe(false);
      f.close();
    });

    test("seek and read", () => {
      const f = filesystem.newFile(filePath);
      f.open("r");
      f.seek(7);
      expect(f.tell()).toBe(7);
      const chunk = f.read(4);
      expect(chunk).toBe("File");
      f.close();
    });

    test("getSize returns file size", () => {
      const f = filesystem.newFile(filePath);
      f.open("r");
      expect(f.getSize()).toBe(12); // "Hello, File!" = 12 bytes
      f.close();
    });

    test("open for append adds to end", () => {
      const f = filesystem.newFile(filePath);
      f.open("a");
      f.write(" Appended.");
      f.close();

      // Verify
      const fr = filesystem.newFile(filePath);
      fr.open("r");
      expect(fr.read()).toBe("Hello, File! Appended.");
      fr.close();
    });

    test("lines splits content", () => {
      const f = filesystem.newFile(filePath);
      f.open("w");
      f.write("line1\nline2\nline3");
      f.close();

      const fr = filesystem.newFile(filePath);
      fr.open("r");
      const result = fr.lines();
      expect(result).toEqual(["line1", "line2", "line3"]);
      fr.close();
    });

    test("read returns null when not open", () => {
      const f = filesystem.newFile(filePath);
      expect(f.read()).toBeNull();
    });

    test("write returns false when not open", () => {
      const f = filesystem.newFile(filePath);
      expect(f.write("nope")).toBe(false);
    });

    test("read returns null in write mode", () => {
      const f = filesystem.newFile(filePath);
      f.open("w");
      expect(f.read()).toBeNull();
      f.close();
    });

    test("write returns false in read mode", () => {
      const f = filesystem.newFile(filePath);
      f.open("r");
      expect(f.write("nope")).toBe(false);
      f.close();
    });

    test("flush succeeds on open file", () => {
      const f = filesystem.newFile(filePath);
      f.open("w");
      f.write("flush test");
      expect(f.flush()).toBe(true);
      f.close();
    });

    test("open nonexistent file for read returns false", () => {
      const f = filesystem.newFile("/nonexistent/path/nope.txt");
      expect(f.open("r")).toBe(false);
      expect(f.isOpen()).toBe(false);
    });

    test("close returns false when already closed", () => {
      const f = filesystem.newFile(filePath);
      expect(f.close()).toBe(false);
    });

    test("isEOF returns true when closed", () => {
      const f = filesystem.newFile(filePath);
      expect(f.isEOF()).toBe(true);
    });

    test("read empty remainder returns empty string", () => {
      const f = filesystem.newFile(filePath);
      f.open("r");
      f.seek(f.getSize()); // seek to end
      expect(f.read()).toBe("");
      f.close();
    });
  });
});
