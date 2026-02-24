// jove CLI — pack command (create .jove archive)
import { existsSync, readdirSync, lstatSync, unlinkSync } from "node:fs";
import { resolve, basename, join, relative, extname } from "path";

const IS_WINDOWS = process.platform === "win32";
const EXCLUDE_DIRS = new Set(["node_modules", ".git"]);
const EXCLUDE_EXTS = new Set([".lua"]);

export async function pack(folder: string, output?: string): Promise<void> {
  const resolved = resolve(folder);

  if (!existsSync(resolved)) {
    throw new Error(`Directory not found: ${resolved}`);
  }

  const mainTs = resolve(resolved, "main.ts");
  if (!existsSync(mainTs)) {
    throw new Error(`No main.ts found in ${resolved}`);
  }

  const name = basename(resolved) === "." ? basename(resolve(resolved)) : basename(resolved);
  const outPath = output ? resolve(output) : resolve(`${name}.jove`);

  // Remove existing archive
  if (existsSync(outPath)) {
    unlinkSync(outPath);
  }

  // Collect files, skipping node_modules, .git, symlinks, .lua
  const files = collectFiles(resolved);

  if (files.length === 0) {
    throw new Error("No files to pack");
  }

  if (IS_WINDOWS) {
    await packWindows(resolved, files, outPath);
  } else {
    await packUnix(resolved, files, outPath);
  }

  console.log(`Created ${outPath}`);
}

async function packUnix(cwd: string, files: string[], outPath: string): Promise<void> {
  // Feed file list to zip via stdin to avoid symlink-following scan
  const proc = Bun.spawn(["zip", outPath, "-@"], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });

  proc.stdin!.write(files.join("\n") + "\n");
  proc.stdin!.end();

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to create archive: ${stderr.trim()}`);
  }
}

async function packWindows(cwd: string, files: string[], outPath: string): Promise<void> {
  // Windows 10+ has tar built-in; -a auto-detects zip from extension
  // Use backslashes for Windows paths in the file list
  const winFiles = files.map((f) => f.replace(/\//g, "\\"));
  const proc = Bun.spawn(["tar", "-a", "-cf", outPath, ...winFiles], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to create archive: ${stderr.trim()}`);
  }
}

function collectFiles(root: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;

      const full = join(dir, entry.name);
      const stat = lstatSync(full);

      // Skip symlinks entirely
      if (stat.isSymbolicLink()) continue;

      if (stat.isDirectory()) {
        walk(full);
        continue;
      }

      if (EXCLUDE_EXTS.has(extname(entry.name))) continue;

      results.push(relative(root, full));
    }
  }

  walk(root);
  return results;
}
