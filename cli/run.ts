// jove CLI — run command
import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, realpathSync } from "node:fs";
import { join, resolve, dirname, basename } from "path";
import { tmpdir } from "os";

const JOVE_ROOT = join(import.meta.dir, "..");
const IS_WINDOWS = process.platform === "win32";

export async function run(target: string): Promise<void> {
  const resolved = resolve(target);

  if (resolved.endsWith(".jove")) {
    await runArchive(resolved);
    return;
  }

  if (resolved.endsWith(".ts")) {
    await runFile(resolved);
    return;
  }

  // Treat as folder
  await runFolder(resolved);
}

async function runFolder(folder: string): Promise<void> {
  if (!existsSync(folder)) {
    throw new Error(`Directory not found: ${folder}`);
  }
  const mainTs = join(folder, "main.ts");
  if (!existsSync(mainTs)) {
    throw new Error(`No main.ts found in ${folder}`);
  }
  ensureSymlink(folder);
  await spawn(mainTs, folder);
}

async function runFile(file: string): Promise<void> {
  if (!existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }
  const gameDir = dirname(file);
  ensureSymlink(gameDir);
  await spawn(file, gameDir);
}

async function runArchive(archivePath: string): Promise<void> {
  if (!existsSync(archivePath)) {
    throw new Error(`Archive not found: ${archivePath}`);
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "jove-"));
  try {
    // Extract .jove archive (zip format) — cross-platform
    await extractZip(archivePath, tmpDir);

    const mainTs = join(tmpDir, "main.ts");
    if (!existsSync(mainTs)) {
      throw new Error(`No main.ts found at root of ${basename(archivePath)}`);
    }

    ensureSymlink(tmpDir);
    await spawn(mainTs, tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function ensureSymlink(gameDir: string): void {
  const nodeModules = join(gameDir, "node_modules");
  const symlinkPath = join(nodeModules, "jove2d");

  // Already points to the right place?
  if (existsSync(symlinkPath)) {
    try {
      if (realpathSync(symlinkPath) === realpathSync(JOVE_ROOT)) return;
    } catch {
      // Broken symlink/junction — recreate
    }
    rmSync(symlinkPath, { recursive: true, force: true });
  }

  // Create node_modules/ if needed
  if (!existsSync(nodeModules)) {
    mkdirSync(nodeModules, { recursive: true });
  }

  // Use "junction" type for Windows compatibility (works without admin privileges)
  symlinkSync(JOVE_ROOT, symlinkPath, "junction");
}

async function extractZip(archivePath: string, destDir: string): Promise<void> {
  // tar works cross-platform (built into Windows 10+, Linux, macOS)
  const proc = IS_WINDOWS
    ? Bun.spawn(["tar", "-xf", archivePath, "-C", destDir], {
        stdio: ["ignore", "ignore", "pipe"],
      })
    : Bun.spawn(["unzip", "-q", archivePath, "-d", destDir], {
        stdio: ["ignore", "ignore", "pipe"],
      });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to extract ${basename(archivePath)}: ${stderr.trim()}`);
  }
}

async function spawn(mainTs: string, cwd: string): Promise<void> {
  const proc = Bun.spawn(["bun", mainTs], {
    cwd,
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env },
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
