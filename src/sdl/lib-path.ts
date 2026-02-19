import { suffix } from "bun:ffi";
import { existsSync } from "node:fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..", "..");

export function libPath(vendorSubdir: string, libName: string): string {
  const ext = `.${suffix}`; // ".so" on linux, ".dll" on windows, ".dylib" on mac
  const prefix = ext === ".dll" ? "" : "lib";
  const fileName = `${prefix}${libName}${ext}`;

  // Release layout: flat lib/ directory
  const releasePath = join(ROOT, "lib", fileName);
  if (existsSync(releasePath)) return releasePath;

  // Dev layout: vendor/<subdir>/install/lib/
  return join(ROOT, "vendor", vendorSubdir, "install", "lib", fileName);
}
