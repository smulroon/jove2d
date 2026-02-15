// jove2d filesystem module — mirrors love.filesystem API
// Uses Bun.file and node:fs APIs for file I/O

import {
  existsSync, mkdirSync, readdirSync, statSync, unlinkSync, rmdirSync,
  appendFileSync, openSync, readSync, writeSync, closeSync, fstatSync, fsyncSync,
  readFileSync,
} from "node:fs";
import { resolve, dirname, extname } from "node:path";

let _identity = "jove2d";
let _saveDir: string | null = null;

// Mount search path entries
const _mounts: Array<{ archive: string; mountpoint: string }> = [];

// ---------------------------------------------------------------------------
// Identity / directory queries
// ---------------------------------------------------------------------------

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

  const home = getUserDirectory();
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

/** Get the current working directory. */
export function getWorkingDirectory(): string {
  return process.cwd();
}

/** Get the user's home directory. */
export function getUserDirectory(): string {
  return process.env.HOME || process.env.USERPROFILE || "/tmp";
}

/** Get the platform-specific application data directory. */
export function getAppdataDirectory(): string {
  const home = getUserDirectory();
  if (process.platform === "win32") {
    return process.env.APPDATA || resolve(home, "AppData", "Roaming");
  } else if (process.platform === "darwin") {
    return resolve(home, "Library", "Application Support");
  }
  return resolve(home, ".local", "share");
}

// ---------------------------------------------------------------------------
// Mount / unmount
// ---------------------------------------------------------------------------

/**
 * Mount a directory for reading. Mounted paths are searched when reading files.
 * @param archive - directory path to mount
 * @param mountpoint - virtual path prefix (empty string for root)
 * @param appendToSearchPath - if true, search this after existing mounts; if false, search first
 */
export function mount(archive: string, mountpoint: string = "", appendToSearchPath: boolean = true): boolean {
  const resolvedArchive = resolve(archive);
  if (!existsSync(resolvedArchive)) return false;

  const entry = { archive: resolvedArchive, mountpoint };
  if (appendToSearchPath) {
    _mounts.push(entry);
  } else {
    _mounts.unshift(entry);
  }
  return true;
}

/** Unmount a previously mounted directory. */
export function unmount(archive: string): boolean {
  const resolvedArchive = resolve(archive);
  const idx = _mounts.findIndex(m => m.archive === resolvedArchive);
  if (idx === -1) return false;
  _mounts.splice(idx, 1);
  return true;
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function _isAbsolute(path: string): boolean {
  return path.startsWith("/") || path.startsWith("\\") || /^[a-zA-Z]:/.test(path);
}

/** Resolve a path for writing (always targets save directory). */
function _resolveWritePath(path: string): string {
  if (_isAbsolute(path)) return path;
  return resolve(getSaveDirectory(), path);
}

/**
 * Resolve a path for reading — searches mounts, save dir, then source dir.
 * Returns the first existing match, or falls back to save directory path.
 */
function _resolveReadPath(path: string): string {
  if (_isAbsolute(path)) return path;

  // Check mounted paths in order
  for (const m of _mounts) {
    let candidate: string | null = null;
    if (m.mountpoint === "") {
      candidate = resolve(m.archive, path);
    } else if (path.startsWith(m.mountpoint + "/")) {
      candidate = resolve(m.archive, path.slice(m.mountpoint.length + 1));
    } else if (path === m.mountpoint) {
      candidate = m.archive;
    }
    if (candidate && existsSync(candidate)) return candidate;
  }

  // Check save directory
  const savePath = resolve(getSaveDirectory(), path);
  if (existsSync(savePath)) return savePath;

  // Check source base directory
  const sourcePath = resolve(getSourceBaseDirectory(), path);
  if (existsSync(sourcePath)) return sourcePath;

  // Fall back to save directory path (caller will handle missing file)
  return savePath;
}

// ---------------------------------------------------------------------------
// File I/O functions
// ---------------------------------------------------------------------------

/** Read the contents of a file. Returns string content or null on failure. */
export async function read(path: string): Promise<string | null> {
  try {
    const resolved = _resolveReadPath(path);
    const file = Bun.file(resolved);
    return await file.text();
  } catch {
    return null;
  }
}

/** Write data to a file (overwrites). Returns true on success. */
export async function write(path: string, data: string | Uint8Array): Promise<boolean> {
  try {
    const resolved = _resolveWritePath(path);
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
    const resolved = _resolveWritePath(path);
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
    const resolved = _resolveWritePath(path);
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
    const resolved = _resolveWritePath(path);
    mkdirSync(resolved, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/** Get the list of items in a directory. Returns filenames (not full paths). */
export function getDirectoryItems(path: string): string[] {
  try {
    const resolved = _resolveReadPath(path);
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
    const resolved = _resolveReadPath(path);
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

// ---------------------------------------------------------------------------
// FileData
// ---------------------------------------------------------------------------

/** A data object containing the contents of a file with associated filename. */
export class FileData {
  _data: Uint8Array;
  _filename: string;

  constructor(data: string | Uint8Array, filename: string) {
    if (typeof data === "string") {
      this._data = new TextEncoder().encode(data);
    } else {
      this._data = new Uint8Array(data);
    }
    this._filename = filename;
  }

  getFilename(): string {
    return this._filename;
  }

  getExtension(): string {
    const ext = extname(this._filename);
    return ext.startsWith(".") ? ext.slice(1) : ext;
  }

  getString(): string {
    return new TextDecoder().decode(this._data);
  }

  getSize(): number {
    return this._data.byteLength;
  }

  clone(): FileData {
    return new FileData(new Uint8Array(this._data), this._filename);
  }
}

/**
 * Create a new FileData.
 * - `newFileData(filepath)` — reads from file
 * - `newFileData(contents, filename)` — wraps existing data
 */
export function newFileData(contentsOrPath: string | Uint8Array, filename?: string): FileData {
  if (filename !== undefined) {
    return new FileData(contentsOrPath, filename);
  }
  // Single arg: read from file
  const filepath = contentsOrPath as string;
  const resolved = _resolveReadPath(filepath);
  const data = readFileSync(resolved);
  return new FileData(new Uint8Array(data), filepath);
}

// ---------------------------------------------------------------------------
// File handle
// ---------------------------------------------------------------------------

export type FileMode = "r" | "w" | "a" | "c";

/** A file handle object for streaming read/write access. */
export class File {
  _filename: string;
  _fd: number | null = null;
  _mode: FileMode = "c";
  _pos: number = 0;

  constructor(filename: string) {
    this._filename = filename;
  }

  /** Open the file in the given mode ("r", "w", or "a"). */
  open(mode: "r" | "w" | "a"): boolean {
    if (this._fd !== null) this.close();

    try {
      let resolved: string;

      if (mode === "r") {
        resolved = _resolveReadPath(this._filename);
      } else {
        resolved = _resolveWritePath(this._filename);
        const dir = dirname(resolved);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      }

      this._fd = openSync(resolved, mode === "w" ? "w" : mode === "a" ? "a" : "r");
      this._mode = mode;
      this._pos = mode === "a" ? fstatSync(this._fd).size : 0;
      return true;
    } catch {
      return false;
    }
  }

  /** Close the file. */
  close(): boolean {
    if (this._fd === null) return false;
    try {
      closeSync(this._fd);
    } catch {}
    this._fd = null;
    this._mode = "c";
    this._pos = 0;
    return true;
  }

  /**
   * Read from the file.
   * - `read()` — reads all remaining bytes
   * - `read(count)` — reads up to count bytes
   */
  read(count?: number): string | null {
    if (this._fd === null || this._mode !== "r") return null;
    try {
      const size = fstatSync(this._fd).size;
      const toRead = count !== undefined ? Math.min(count, size - this._pos) : (size - this._pos);
      if (toRead <= 0) return "";
      const buf = Buffer.alloc(toRead);
      const bytesRead = readSync(this._fd, buf, 0, toRead, this._pos);
      this._pos += bytesRead;
      return buf.toString("utf8", 0, bytesRead);
    } catch {
      return null;
    }
  }

  /** Write data to the file. Only works in "w" or "a" mode. */
  write(data: string | Uint8Array): boolean {
    if (this._fd === null || (this._mode !== "w" && this._mode !== "a")) return false;
    try {
      const buf = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
      const written = writeSync(this._fd, buf);
      this._pos += written;
      return true;
    } catch {
      return false;
    }
  }

  /** Seek to a byte position in the file. */
  seek(pos: number): boolean {
    if (this._fd === null) return false;
    this._pos = pos;
    return true;
  }

  /** Return the current read/write position. */
  tell(): number {
    return this._pos;
  }

  /** Get the file size in bytes. */
  getSize(): number {
    if (this._fd === null) return 0;
    try {
      return fstatSync(this._fd).size;
    } catch {
      return 0;
    }
  }

  /** Check if the file is currently open. */
  isOpen(): boolean {
    return this._fd !== null;
  }

  /** Get the current file mode ("r", "w", "a", or "c" if closed). */
  getMode(): FileMode {
    return this._mode;
  }

  /** Get the filename this File was created with. */
  getFilename(): string {
    return this._filename;
  }

  /** Check if the read position is at end of file. */
  isEOF(): boolean {
    if (this._fd === null) return true;
    try {
      return this._pos >= fstatSync(this._fd).size;
    } catch {
      return true;
    }
  }

  /** Flush buffered writes to disk. */
  flush(): boolean {
    if (this._fd === null) return false;
    try {
      fsyncSync(this._fd);
      return true;
    } catch {
      return false;
    }
  }

  /** Read all remaining content and split into lines. */
  lines(): string[] {
    const content = this.read();
    if (content === null) return [];
    return content.split("\n");
  }
}

/** Create a new File handle. Must call open() before reading/writing. */
export function newFile(filename: string): File {
  return new File(filename);
}
