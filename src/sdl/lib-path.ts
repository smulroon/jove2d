import { suffix } from "bun:ffi";
import { join } from "path";

const ROOT = join(import.meta.dir, "..", "..");

export function libPath(vendorSubdir: string, libName: string): string {
  const ext = `.${suffix}`; // ".so" on linux, ".dll" on windows, ".dylib" on mac
  const prefix = ext === ".dll" ? "" : "lib";
  return join(ROOT, "vendor", vendorSubdir, "install", "lib", `${prefix}${libName}${ext}`);
}
