#!/usr/bin/env bun
// jove2d CLI — love2d-style distribution tool

import { run } from "./run.ts";
import { pack } from "./pack.ts";
import { build } from "./build.ts";

const VERSION = "0.6.0";

const HELP = `\
jove2d ${VERSION} — love2d-style game engine for TypeScript

Usage:
  jove                         Run game in current directory
  jove <folder/>               Run game from folder
  jove <file.ts>               Run a TypeScript file directly
  jove <game.jove>             Run a .jove archive
  jove pack <folder/> [-o x]   Create a .jove archive
  jove build <folder/> [-o x] [--target t]  Build standalone executable

Options:
  -h, --help       Show this help
  -v, --version    Show version

Build targets:
  --target bun-linux-x64       Linux x86_64
  --target bun-linux-arm64     Linux ARM64
  --target bun-windows-x64     Windows x86_64
  --target bun-darwin-x64      macOS x86_64
  --target bun-darwin-arm64    macOS ARM64`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await run(".");
    return;
  }

  const first = args[0]!;

  if (first === "-h" || first === "--help") {
    console.log(HELP);
    return;
  }

  if (first === "-v" || first === "--version") {
    console.log(`jove2d ${VERSION}`);
    return;
  }

  if (first === "pack") {
    const folder = args[1] || ".";
    const outputIdx = args.indexOf("-o");
    const output = outputIdx !== -1 ? args[outputIdx + 1] : undefined;
    await pack(folder, output);
    return;
  }

  if (first === "build") {
    const folder = args[1] || ".";
    const outputIdx = args.indexOf("-o");
    const output = outputIdx !== -1 ? args[outputIdx + 1] : undefined;
    const targetIdx = args.indexOf("--target");
    const target = targetIdx !== -1 ? args[targetIdx + 1] : undefined;
    await build(folder, output, target);
    return;
  }

  // Default: run command
  await run(first);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
