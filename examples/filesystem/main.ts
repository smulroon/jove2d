// jove2d filesystem example — save/load data, directory listing, File handles
//
// Demonstrates: jove.filesystem.write, read, append, getInfo, getSaveDirectory,
// getDirectoryItems, createDirectory, remove, setIdentity, lines,
// getWorkingDirectory, getUserDirectory, getAppdataDirectory,
// mount/unmount, newFileData, newFile

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

    // --- Directory queries ---
    log("=== Directory Queries ===");
    log(`Save dir:    ${saveDir}`);
    log(`Source dir:  ${jove.filesystem.getSourceBaseDirectory()}`);
    log(`Working dir: ${jove.filesystem.getWorkingDirectory()}`);
    log(`User dir:    ${jove.filesystem.getUserDirectory()}`);
    log(`Appdata dir: ${jove.filesystem.getAppdataDirectory()}`);
    log("");

    // --- Basic I/O ---
    log("=== File I/O ===");
    const ok = await jove.filesystem.write("hello.txt", "Hello from jove2d!\nLine two.\nLine three.");
    log(`write hello.txt: ${ok ? "OK" : "FAIL"}`);

    const content = await jove.filesystem.read("hello.txt");
    log(`read hello.txt: "${content?.slice(0, 30).replace(/\n/g, "\\n")}..."`);

    const lineArr = await jove.filesystem.lines("hello.txt");
    log(`lines: ${lineArr.length} lines`);

    const info = jove.filesystem.getInfo("hello.txt");
    if (info) log(`info: ${info.type}, ${info.size} bytes`);
    log("");

    // --- File handle ---
    log("=== File Handle ===");
    const fw = jove.filesystem.newFile("handle-test.txt");
    fw.open("w");
    fw.write("ABCDEFGHIJ");
    log(`File write: 10 bytes, tell=${fw.tell()}`);
    fw.close();

    const fr = jove.filesystem.newFile("handle-test.txt");
    fr.open("r");
    log(`File size: ${fr.getSize()}`);
    const first5 = fr.read(5);
    log(`read(5): "${first5}", tell=${fr.tell()}, eof=${fr.isEOF()}`);
    fr.seek(0);
    const all = fr.read();
    log(`seek(0)+read(): "${all}"`);
    fr.close();
    log("");

    // --- FileData ---
    log("=== FileData ===");
    const fd = jove.filesystem.newFileData("FileData content!", "demo.txt");
    log(`name: ${fd.getFilename()}, ext: ${fd.getExtension()}, size: ${fd.getSize()}`);
    log(`string: "${fd.getString()}"`);
    const fdClone = fd.clone();
    log(`clone: "${fdClone.getString()}" (independent)`);
    log("");

    // --- Cleanup ---
    jove.filesystem.remove("hello.txt");
    jove.filesystem.remove("handle-test.txt");

    log("Press ESC to quit");
  },

  draw() {
    jove.graphics.setColor(255, 255, 255);
    jove.graphics.print("Filesystem Operations", 10, 10);
    jove.graphics.print(`FPS: ${jove.timer.getFPS()}`, 700, 10);

    jove.graphics.setColor(200, 220, 200);
    let y = 40;
    for (let i = 0; i < messages.length; i++) {
      jove.graphics.print(messages[i], 10, y);
      y += 18;
    }
  },

  keypressed(key) {
    if (key === "escape") jove.window.close();
  },
});
