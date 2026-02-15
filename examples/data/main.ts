// jove2d data example — compression, encoding, and hashing

import jove from "../../src/index.ts";

let lines: string[] = [];

await jove.run({
  load() {
    jove.window.setTitle("jove.data demo");

    // --- Compression ---
    const original = "Hello jove2d! ".repeat(100);
    const originalSize = original.length;

    const zlibData = jove.data.compress("zlib", original);
    const gzipData = jove.data.compress("gzip", original);
    const deflateData = jove.data.compress("deflate", original);

    // Verify round-trip
    const restored = new TextDecoder().decode(jove.data.decompress("zlib", zlibData));
    const match = restored === original;

    lines.push("=== Compression ===");
    lines.push(`Original: ${originalSize} bytes`);
    lines.push(`zlib:     ${zlibData.byteLength} bytes (${((zlibData.byteLength / originalSize) * 100).toFixed(1)}%)`);
    lines.push(`gzip:     ${gzipData.byteLength} bytes (${((gzipData.byteLength / originalSize) * 100).toFixed(1)}%)`);
    lines.push(`deflate:  ${deflateData.byteLength} bytes (${((deflateData.byteLength / originalSize) * 100).toFixed(1)}%)`);
    lines.push(`Round-trip OK: ${match}`);
    lines.push("");

    // --- Encoding ---
    const sample = "Hello, world!";
    const b64 = jove.data.encode("base64", sample);
    const hex = jove.data.encode("hex", sample);
    const b64Back = new TextDecoder().decode(jove.data.decode("base64", b64));
    const hexBack = new TextDecoder().decode(jove.data.decode("hex", hex));

    lines.push("=== Encoding ===");
    lines.push(`Original: "${sample}"`);
    lines.push(`Base64:   ${b64}`);
    lines.push(`Hex:      ${hex}`);
    lines.push(`Base64 decode OK: ${b64Back === sample}`);
    lines.push(`Hex decode OK:    ${hexBack === sample}`);
    lines.push("");

    // --- Hashing ---
    const hashInput = "jove2d";
    lines.push("=== Hashing ===");
    lines.push(`Input: "${hashInput}"`);
    lines.push(`MD5:    ${jove.data.hash("md5", hashInput)}`);
    lines.push(`SHA1:   ${jove.data.hash("sha1", hashInput)}`);
    lines.push(`SHA256: ${jove.data.hash("sha256", hashInput)}`);
    lines.push("");

    // --- ByteData ---
    const bd = jove.data.newByteData("jove2d data module");
    const bdClone = bd.clone();
    lines.push("=== ByteData ===");
    lines.push(`String:  "${bd.getString()}"`);
    lines.push(`Size:    ${bd.getSize()} bytes`);
    lines.push(`Clone:   "${bdClone.getString()}" (independent copy)`);
  },

  draw() {
    jove.graphics.setColor(255, 255, 255);
    for (let i = 0; i < lines.length; i++) {
      jove.graphics.print(lines[i], 10, 10 + i * 18);
    }
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
