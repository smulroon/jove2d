import { suffix } from "bun:ffi";
import { existsSync } from "node:fs";
import { join, dirname } from "path";

const ROOT = join(import.meta.dir, "..", "..");
const EXE_DIR = typeof Bun !== "undefined" && Bun.argv[0]
  ? dirname(Bun.argv[0])
  : import.meta.dir;

export function libPath(vendorSubdir: string, libName: string): string {
  const ext = `.${suffix}`; // ".so" on linux, ".dll" on windows, ".dylib" on mac
  const prefix = ext === ".dll" ? "" : "lib";
  const fileName = `${prefix}${libName}${ext}`;

  // Compiled exe layout: lib/ next to executable
  const exePath = join(EXE_DIR, "lib", fileName);
  if (existsSync(exePath)) return exePath;

  // Release layout: flat lib/ directory
  const releasePath = join(ROOT, "lib", fileName);
  if (existsSync(releasePath)) return releasePath;

  // Dev layout: vendor/<subdir>/install/lib/
  return join(ROOT, "vendor", vendorSubdir, "install", "lib", fileName);
}
