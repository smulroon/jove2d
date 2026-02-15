// jove2d filesystem example — save/load data, directory listing
//
// Demonstrates: jove.filesystem.write, read, append, getInfo, getSaveDirectory,
// getDirectoryItems, createDirectory, remove, setIdentity, lines

import jove from "../../src/index.ts";

let messages: string[] = [];
let saveDir = "";

function log(msg: string) {
  messages.push(msg);
  if (messages.length > 30) messages.shift();
}

await jove.run({
  async load() {
    jove.window.setTitle("Filesystem Example");
    jove.graphics.setBackgroundColor(20, 25, 35);

    // Set game identity for save directory
    jove.filesystem.setIdentity("jove2d-fs-example");
    saveDir = jove.filesystem.getSaveDirectory();
    log(`Save directory: ${saveDir}`);
    log(`Source directory: ${jove.filesystem.getSourceBaseDirectory()}`);
    log("");

    // Write a file
    const ok = await jove.filesystem.write("hello.txt", "Hello from jove2d!\nLine two.\nLine three.");
    log(`write hello.txt: ${ok ? "OK" : "FAIL"}`);

    // Read it back
    const content = await jove.filesystem.read("hello.txt");
    log(`read hello.txt: "${content?.slice(0, 40)}..."`);

    // Read lines
    const lineArr = await jove.filesystem.lines("hello.txt");
    log(`lines: ${lineArr.length} lines`);

    // Append to a file
    await jove.filesystem.write("log.txt", "First entry\n");
    jove.filesystem.append("log.txt", "Second entry\n");
    jove.filesystem.append("log.txt", "Third entry\n");
    const logContent = await jove.filesystem.read("log.txt");
    log(`append log.txt: ${logContent?.split("\n").length ?? 0} lines`);

    // Get file info
    const info = jove.filesystem.getInfo("hello.txt");
    if (info) {
      log(`info hello.txt: ${info.type}, ${info.size} bytes`);
    }

    // Create a subdirectory
    jove.filesystem.createDirectory("subdir");
    const subInfo = jove.filesystem.getInfo("subdir");
    log(`mkdir subdir: ${subInfo?.type ?? "FAIL"}`);

    // List directory contents
    const items = jove.filesystem.getDirectoryItems(saveDir);
    log(`directory items: ${items.join(", ")}`);

    // Remove a file
    const removed = jove.filesystem.remove("log.txt");
    log(`remove log.txt: ${removed ? "OK" : "FAIL"}`);

    // Confirm removal
    const gone = jove.filesystem.getInfo("log.txt");
    log(`log.txt exists: ${gone !== null}`);

    // Non-existent file
    const missing = await jove.filesystem.read("does-not-exist.txt");
    log(`read missing: ${missing === null ? "null (correct)" : "unexpected"}`);

    log("");
    log("Press ESC to quit, R to re-run");
  },

  draw() {
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("Filesystem Operations", 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 10);

    jove.graphics.setColor(200, 220, 200);
    for (let i = 0; i < messages.length; i++) {
      jove.graphics.print(messages[i], 10, 40 + i * 16);
    }
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
