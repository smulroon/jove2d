// Video playback example — MPEG-1 video with controls
//
// Controls:
//   Space     — play / pause
//   R         — rewind to start
//   Left/Right — seek -5s / +5s
//   L         — toggle looping
//
// Requires: bun run build-pl_mpeg
// Video format: MPEG-1 (.mpg) — convert with:
//   ffmpeg -i input.mp4 -c:v mpeg1video -c:a mp2 -b:v 2M -b:a 192k output.mpg

import { join } from "path";
import { existsSync } from "node:fs";
import * as jove from "../../src/jove/index.ts";
import type { Video } from "../../src/jove/video.ts";
import { loadVideo } from "../../src/sdl/ffi_video.ts";

const DIR = import.meta.dir;

let video: Video | null = null;
let statusMsg = "";
let statusTimer = 0;

function showStatus(msg: string) {
  statusMsg = msg;
  statusTimer = 2.0;
}

jove.run({
  load() {
    jove.window.setTitle("jove2d — Video Playback");

    // Try to load a video file (use absolute path so it works from any cwd)
    const path = join(DIR, "sample.mpg");
    const libAvailable = loadVideo() !== null;
    const fileExists = existsSync(path);
    console.log(`[video] lib=${libAvailable}, file=${fileExists}, path=${path}`);

    video = jove.graphics.newVideo(path);
    if (video) {
      video.play();
      showStatus("Playing");
    } else {
      if (!libAvailable) showStatus("pl_mpeg library not found — run: bun run build-pl_mpeg");
      else if (!fileExists) showStatus(`sample.mpg not found at: ${path}`);
      else showStatus("Failed to open video file");
    }
  },

  keypressed(key: string) {
    if (!video) return;

    if (key === "space") {
      if (video.isPlaying()) {
        video.pause();
        showStatus("Paused");
      } else {
        video.play();
        showStatus("Playing");
      }
    } else if (key === "r") {
      video.rewind();
      video.play();
      showStatus("Rewound");
    } else if (key === "left") {
      const t = Math.max(0, video.tell() - 5);
      video.seek(t);
      showStatus(`Seek to ${t.toFixed(1)}s`);
    } else if (key === "right") {
      const t = Math.min(video.getDuration(), video.tell() + 5);
      video.seek(t);
      showStatus(`Seek to ${t.toFixed(1)}s`);
    } else if (key === "l") {
      video.setLooping(!video.isLooping());
      showStatus(video.isLooping() ? "Looping ON" : "Looping OFF");
    }
  },

  update(dt: number) {
    if (statusTimer > 0) statusTimer -= dt;
  },

  draw() {
    jove.graphics.setBackgroundColor(20, 20, 30);

    const [ww, wh] = jove.graphics.getDimensions();

    if (video && video._texture) {
      // Center the video, scaled to fit window
      const vw = video.getWidth();
      const vh = video.getHeight();
      const scale = Math.min(ww / vw, (wh - 80) / vh);
      const dx = (ww - vw * scale) / 2;
      const dy = (wh - 80 - vh * scale) / 2;

      jove.graphics.setColor(255, 255, 255);
      jove.graphics.draw(video, dx, dy, 0, scale, scale);

      // Progress bar
      const barY = wh - 50;
      const barX = 40;
      const barW = ww - 80;
      const barH = 8;
      const duration = video.getDuration();
      const pos = video.tell();
      const progress = duration > 0 ? pos / duration : 0;

      // Bar background
      jove.graphics.setColor(60, 60, 80);
      jove.graphics.rectangle("fill", barX, barY, barW, barH);

      // Bar fill
      jove.graphics.setColor(100, 180, 255);
      jove.graphics.rectangle("fill", barX, barY, barW * progress, barH);

      // Time text
      jove.graphics.setColor(200, 200, 220);
      const timeStr = `${formatTime(pos)} / ${formatTime(duration)}`;
      jove.graphics.print(timeStr, barX, barY + 12);

      // Status indicators
      const indicators: string[] = [];
      if (video.isPlaying()) indicators.push("[Playing]");
      else indicators.push("[Paused]");
      if (video.isLooping()) indicators.push("[Loop]");
      jove.graphics.print(indicators.join(" "), barX + barW - 150, barY + 12);
    }

    // Status message (fades out)
    if (statusTimer > 0) {
      const alpha = Math.min(1, statusTimer) * 255;
      jove.graphics.setColor(255, 255, 100, alpha);
      jove.graphics.print(statusMsg, 20, 20);
    }

    // Controls help
    jove.graphics.setColor(120, 120, 140);
    jove.graphics.print("Space=Play/Pause  R=Rewind  Left/Right=Seek  L=Loop", 20, wh - 20);

    if (!video) {
      jove.graphics.setColor(255, 100, 100);
      jove.graphics.print("No video loaded", ww / 2 - 50, wh / 2 - 10);
      jove.graphics.setColor(180, 180, 200);
      jove.graphics.print("Place sample.mpg in examples/video/", ww / 2 - 120, wh / 2 + 10);
      jove.graphics.print("Convert: ffmpeg -i input.mp4 -c:v mpeg1video -c:a mp2 -b:v 2M output.mpg", 20, wh / 2 + 40);
    }
  },
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
