// jove CLI — build command (standalone executable)
import { existsSync, readdirSync, lstatSync, mkdirSync, copyFileSync, rmSync, symlinkSync } from "node:fs";
import { resolve, join, basename, extname, relative } from "path";
import { suffix } from "bun:ffi";

const JOVE_ROOT = join(import.meta.dir, "..");

// Native libs to copy (vendorSubdir → libName)
const NATIVE_LIBS: [string, string][] = [
  ["SDL3", "SDL3"],
  ["SDL_ttf", "SDL3_ttf"],
  ["SDL_image", "SDL3_image"],
  ["box2d", "box2d_jove"],
  ["audio_decode", "audio_decode"],
  ["pl_mpeg", "pl_mpeg_jove"],
];

// Engine assets to copy
const ENGINE_ASSETS = ["assets/Vera.ttf", "assets/pixelfont.png"];

// Extensions to exclude from game asset copy
const EXCLUDE_EXTS = new Set([".ts", ".lua"]);
const EXCLUDE_DIRS = new Set(["node_modules", ".git"]);

export async function build(folder: string, output?: string, target?: string): Promise<void> {
  const resolved = resolve(folder);

  if (!existsSync(resolved)) {
    throw new Error(`Directory not found: ${resolved}`);
  }

  const mainTs = join(resolved, "main.ts");
  if (!existsSync(mainTs)) {
    throw new Error(`No main.ts found in ${resolved}`);
  }

  const name = basename(resolved) === "." ? basename(resolve(resolved)) : basename(resolved);
  const outDir = output ? resolve(output) : resolve(`${name}-build`);

  // Ensure node_modules/jove2d symlink for module resolution during compile
  ensureBuildSymlink(resolved);

  // Create output directory
  mkdirSync(outDir, { recursive: true });

  // Generate temp entry wrapper that sets cwd to exe directory
  const wrapperPath = join(resolved, "__jove_build_entry.ts");
  try {
    await Bun.write(wrapperPath, `\
import { dirname } from "path";
process.chdir(dirname(Bun.argv[0]));
await import("./main.ts");
`);

    // Determine output executable name
    const isWindows = target?.includes("windows");
    const exeExt = isWindows ? ".exe" : "";
    const exePath = join(outDir, `${name}${exeExt}`);

    // Run bun build --compile
    const args = ["bun", "build", "--compile", wrapperPath, "--outfile", exePath];
    if (target) {
      args.push("--target", target);
    }

    console.log(`Compiling ${name}...`);
    const proc = Bun.spawn(args, {
      cwd: resolved,
      stdio: ["ignore", "inherit", "inherit"],
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error("bun build --compile failed (see output above)");
    }

    // Copy native libs
    copyNativeLibs(outDir, target);

    // Copy game assets (non-.ts, non-.lua, skip node_modules/.git)
    copyGameAssets(resolved, outDir);

    // Copy engine assets
    copyEngineAssets(outDir);

    console.log(`Build complete: ${outDir}/`);
  } finally {
    if (existsSync(wrapperPath)) {
      rmSync(wrapperPath);
    }
  }
}

function ensureBuildSymlink(gameDir: string): void {
  // Reuse run.ts symlink logic inline to avoid circular dependency concerns
  const nodeModules = join(gameDir, "node_modules");
  const symlinkPath = join(nodeModules, "jove2d");

  if (existsSync(symlinkPath)) return; // Already exists

  if (!existsSync(nodeModules)) {
    mkdirSync(nodeModules, { recursive: true });
  }

  symlinkSync(JOVE_ROOT, symlinkPath, "junction");
}

function copyNativeLibs(outDir: string, target?: string): void {
  const libDir = join(outDir, "lib");
  mkdirSync(libDir, { recursive: true });

  // Determine correct extension for target platform
  const ext = target?.includes("windows") ? ".dll"
    : target?.includes("darwin") ? ".dylib"
    : `.${suffix}`;
  const needsPrefix = ext !== ".dll";

  for (const [vendorSubdir, libName] of NATIVE_LIBS) {
    const fileName = `${needsPrefix ? "lib" : ""}${libName}${ext}`;
    const srcPath = join(JOVE_ROOT, "vendor", vendorSubdir, "install", "lib", fileName);

    if (existsSync(srcPath)) {
      copyFileSync(srcPath, join(libDir, fileName));
    }
    // Skip silently if lib not built — optional libs are fine to miss
  }

  const copied = readdirSync(libDir).length;
  console.log(`Copied ${copied} native lib(s) to lib/`);
}

function copyGameAssets(gameDir: string, outDir: string): void {
  let count = 0;

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      // Skip symlinks (e.g. node_modules/jove2d junction)
      if (lstatSync(full).isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (EXCLUDE_EXTS.has(extname(entry.name))) continue;
      const rel = relative(gameDir, full);
      const dest = join(outDir, rel);
      mkdirSync(join(dest, ".."), { recursive: true });
      copyFileSync(full, dest);
      count++;
    }
  }

  walk(gameDir);
  if (count > 0) {
    console.log(`Copied ${count} game asset(s)`);
  }
}

function copyEngineAssets(outDir: string): void {
  const assetsDir = join(outDir, "assets");
  mkdirSync(assetsDir, { recursive: true });

  for (const rel of ENGINE_ASSETS) {
    const src = join(JOVE_ROOT, rel);
    if (existsSync(src)) {
      copyFileSync(src, join(assetsDir, basename(rel)));
    }
  }
}
