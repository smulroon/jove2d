import { test, expect, describe, afterAll } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve, basename } from "path";
import { tmpdir } from "os";

const JOVE_ROOT = resolve(import.meta.dir, "..");
const CLI = join(JOVE_ROOT, "cli", "jove.ts");
const IS_WINDOWS = process.platform === "win32";

// Cross-platform zip listing (unzip -l on Linux, tar -tf on Windows)
function listZip(archivePath: string): string {
  if (IS_WINDOWS) {
    const r = Bun.spawnSync(["tar", "-tf", archivePath], { stdio: ["ignore", "pipe", "pipe"] });
    return new TextDecoder().decode(r.stdout);
  }
  const r = Bun.spawnSync(["unzip", "-l", archivePath], { stdio: ["ignore", "pipe", "pipe"] });
  return new TextDecoder().decode(r.stdout);
}

// Helper to run CLI and capture output
async function runCli(...args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", CLI, ...args], {
    cwd: JOVE_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

// Temp dirs to clean up
const tempDirs: string[] = [];
afterAll(() => {
  for (const d of tempDirs) {
    rmSync(d, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "jove-test-"));
  tempDirs.push(d);
  return d;
}

describe("jove CLI — flags", () => {
  test("--help shows usage", async () => {
    const { stdout, exitCode } = await runCli("--help");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("jove2d");
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("pack");
    expect(stdout).toContain("build");
  });

  test("-h shows usage", async () => {
    const { stdout, exitCode } = await runCli("-h");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
  });

  test("--version shows version", async () => {
    const { stdout, exitCode } = await runCli("--version");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^jove2d \d+\.\d+\.\d+$/);
  });

  test("-v shows version", async () => {
    const { stdout, exitCode } = await runCli("-v");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^jove2d \d+\.\d+\.\d+$/);
  });
});

describe("jove CLI — run validation", () => {
  test("missing directory errors", async () => {
    const { exitCode, stderr } = await runCli("/nonexistent/path");
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("not found");
  });

  test("folder without main.ts errors", async () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "other.ts"), "console.log('hi')");
    const { exitCode, stderr } = await runCli(tmp);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No main.ts");
  });

  test("missing .ts file errors", async () => {
    const { exitCode, stderr } = await runCli("/nonexistent/game.ts");
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("not found");
  });

  test("missing .jove file errors", async () => {
    const { exitCode, stderr } = await runCli("/nonexistent/game.jove");
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("not found");
  });
});

describe("jove CLI — run .ts file", () => {
  test("runs a standalone .ts file", async () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "hello.ts"), 'console.log("JOVE_TEST_OK");');
    const { stdout, exitCode } = await runCli(join(tmp, "hello.ts"));
    expect(exitCode).toBe(0);
    expect(stdout).toContain("JOVE_TEST_OK");
  });

  test("creates node_modules/jove2d symlink", async () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "hello.ts"), 'console.log("ok");');
    await runCli(join(tmp, "hello.ts"));
    expect(existsSync(join(tmp, "node_modules", "jove2d"))).toBe(true);
  });
});

describe("jove CLI — run folder", () => {
  test("runs main.ts from folder", async () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "main.ts"), 'console.log("FOLDER_OK");');
    const { stdout, exitCode } = await runCli(tmp);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("FOLDER_OK");
  });
});

describe("jove CLI — pack", () => {
  test("creates .jove archive from folder", async () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "main.ts"), 'console.log("PACKED");');
    writeFileSync(join(tmp, "sprite.png"), "fake-png-data");
    mkdirSync(join(tmp, "sounds"));
    writeFileSync(join(tmp, "sounds", "beep.wav"), "fake-wav-data");

    const outPath = join(tmp, "game.jove");
    const { exitCode, stdout } = await runCli("pack", tmp, "-o", outPath);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Created");
    expect(existsSync(outPath)).toBe(true);

    // Verify it's a valid zip containing main.ts
    const listing = listZip(outPath);
    expect(listing).toContain("main.ts");
    expect(listing).toContain("sprite.png");
    expect(listing).toContain("beep.wav");
  });

  test("excludes node_modules and .lua files", async () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "main.ts"), 'console.log("hi");');
    writeFileSync(join(tmp, "conf.lua"), "-- lua");
    mkdirSync(join(tmp, "node_modules", "foo"), { recursive: true });
    writeFileSync(join(tmp, "node_modules", "foo", "index.js"), "module.exports = 1;");

    const outPath = join(tmp, "test.jove");
    await runCli("pack", tmp, "-o", outPath);

    const listing = listZip(outPath);
    expect(listing).toContain("main.ts");
    expect(listing).not.toContain("conf.lua");
    expect(listing).not.toContain("node_modules");
  });

  test("errors on folder without main.ts", async () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "other.ts"), "1");
    const { exitCode, stderr } = await runCli("pack", tmp);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No main.ts");
  });
});

describe("jove CLI — pack + run round-trip", () => {
  test("pack then run .jove archive", async () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "main.ts"), 'console.log("ROUNDTRIP_OK");');

    const archivePath = join(tmp, "game.jove");
    await runCli("pack", tmp, "-o", archivePath);
    expect(existsSync(archivePath)).toBe(true);

    const { stdout, exitCode } = await runCli(archivePath);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("ROUNDTRIP_OK");
  });
});

describe("jove CLI — build validation", () => {
  test("errors on folder without main.ts", async () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "other.ts"), "1");
    const { exitCode, stderr } = await runCli("build", tmp);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No main.ts");
  });
});
