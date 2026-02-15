// jove2d filesystem module — mirrors love.filesystem API
// Uses Bun.file and node:fs APIs for file I/O

import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, rmdirSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

let _identity = "jove2d";
let _saveDir: string | null = null;

/** Set the game identity (used for save directory name). */
export function setIdentity(name: string): void {
  _identity = name;
  _saveDir = null; // Reset so it gets recalculated
}

/** Get the game identity. */
export function getIdentity(): string {
  return _identity;
}

/** Get the save directory path (creates it if needed). */
export function getSaveDirectory(): string {
  if (_saveDir) return _saveDir;

  const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
  const platform = process.platform;

  if (platform === "win32") {
    _saveDir = resolve(process.env.APPDATA || home, _identity);
  } else if (platform === "darwin") {
    _saveDir = resolve(home, "Library", "Application Support", _identity);
  } else {
    _saveDir = resolve(home, `.local/share/${_identity}`);
  }

  if (!existsSync(_saveDir)) {
    mkdirSync(_saveDir, { recursive: true });
  }

  return _saveDir;
}

/** Get the source base directory (working directory). */
export function getSourceBaseDirectory(): string {
  return process.cwd();
}

function _resolvePath(path: string): string {
  // If absolute, use as-is; otherwise resolve relative to save directory
  if (path.startsWith("/") || path.startsWith("\\") || /^[a-zA-Z]:/.test(path)) {
    return path;
  }
  return resolve(getSaveDirectory(), path);
}

/** Read the contents of a file. Returns string content or null on failure. */
export async function read(path: string): Promise<string | null> {
  try {
    const resolved = _resolvePath(path);
    const file = Bun.file(resolved);
    return await file.text();
  } catch {
    return null;
  }
}

/** Write data to a file (overwrites). Returns true on success. */
export async function write(path: string, data: string | Uint8Array): Promise<boolean> {
  try {
    const resolved = _resolvePath(path);
    const dir = dirname(resolved);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await Bun.write(resolved, data);
    return true;
  } catch {
    return false;
  }
}

/** Append data to a file. Returns true on success. */
export function append(path: string, data: string | Uint8Array): boolean {
  try {
    const resolved = _resolvePath(path);
    const dir = dirname(resolved);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(resolved, data);
    return true;
  } catch {
    return false;
  }
}

/** Remove a file or empty directory. Returns true on success. */
export function remove(path: string): boolean {
  try {
    const resolved = _resolvePath(path);
    const stat = statSync(resolved);
    if (stat.isDirectory()) {
      rmdirSync(resolved);
    } else {
      unlinkSync(resolved);
    }
    return true;
  } catch {
    return false;
  }
}

/** Create a directory (and parents). Returns true on success. */
export function createDirectory(path: string): boolean {
  try {
    const resolved = _resolvePath(path);
    mkdirSync(resolved, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/** Get the list of items in a directory. Returns filenames (not full paths). */
export function getDirectoryItems(path: string): string[] {
  try {
    const resolved = _resolvePath(path);
    return readdirSync(resolved);
  } catch {
    return [];
  }
}

export interface FileInfo {
  type: "file" | "directory" | "symlink" | "other";
  size: number;
  modtime: number;
}

/** Get info about a file/directory. Returns null if not found. */
export function getInfo(path: string): FileInfo | null {
  try {
    const resolved = _resolvePath(path);
    const stat = statSync(resolved);
    let type: FileInfo["type"] = "other";
    if (stat.isFile()) type = "file";
    else if (stat.isDirectory()) type = "directory";
    else if (stat.isSymbolicLink()) type = "symlink";

    return {
      type,
      size: stat.size,
      modtime: Math.floor(stat.mtimeMs / 1000),
    };
  } catch {
    return null;
  }
}

/** Iterate lines of a file. Returns an array of lines. */
export async function lines(path: string): Promise<string[]> {
  const content = await read(path);
  if (content === null) return [];
  return content.split("\n");
}
