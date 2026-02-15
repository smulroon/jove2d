// jove2d Font object — love2d-compatible font methods

import { ptr, read } from "bun:ffi";
import type { Pointer } from "bun:ffi";

// TTF symbols type — imported lazily from graphics.ts
type TTFSymbols = NonNullable<ReturnType<typeof import("../sdl/ffi_ttf.ts").loadTTF>>;

// Reusable out-param buffers for measuring text
const _wBuf = new Int32Array(1);
const _hBuf = new Int32Array(1);
const _wPtr = ptr(_wBuf);
const _hPtr = ptr(_hBuf);

export interface Font {
  /** Internal TTF_Font pointer */
  readonly _font: Pointer;
  /** Font point size */
  readonly _size: number;

  /** Get the height of a line of text (in pixels). */
  getHeight(): number;
  /** Get the width of the given text string (in pixels). */
  getWidth(text: string): number;
  /** Get the font ascent (pixels above baseline). */
  getAscent(): number;
  /** Get the font descent (pixels below baseline, typically negative). */
  getDescent(): number;
  /** Get the baseline position (same as ascent). */
  getBaseline(): number;
  /** Get the line height multiplier. */
  getLineHeight(): number;
  /** Set the line height multiplier. */
  setLineHeight(height: number): void;
  /**
   * Get word-wrapped lines and the max width.
   * Returns [maxWidth, lines[]].
   */
  getWrap(text: string, wraplimit: number): [number, string[]];
  /** Release the font resources. */
  release(): void;
}

export function _createFont(
  fontPtr: Pointer,
  size: number,
  ttf: TTFSymbols,
): Font {
  let _lineHeightMult = 1.0;
  // Cache the native line skip so we can compute lineHeight ratio
  const _nativeLineSkip = ttf.TTF_GetFontLineSkip(fontPtr);

  return {
    _font: fontPtr,
    _size: size,

    getHeight(): number {
      return ttf.TTF_GetFontHeight(fontPtr);
    },

    getWidth(text: string): number {
      const buf = Buffer.from(text + "\0");
      ttf.TTF_GetStringSize(fontPtr, buf, 0, _wPtr, _hPtr);
      return read.i32(_wPtr, 0);
    },

    getAscent(): number {
      return ttf.TTF_GetFontAscent(fontPtr);
    },

    getDescent(): number {
      return ttf.TTF_GetFontDescent(fontPtr);
    },

    getBaseline(): number {
      return ttf.TTF_GetFontAscent(fontPtr);
    },

    getLineHeight(): number {
      return _lineHeightMult;
    },

    setLineHeight(height: number): void {
      _lineHeightMult = height;
      // Update the native line skip based on the multiplier
      ttf.TTF_SetFontLineSkip(fontPtr, Math.round(_nativeLineSkip * height));
    },

    getWrap(text: string, wraplimit: number): [number, string[]] {
      // Split on explicit newlines first, then wrap each section
      const sections = text.split("\n");
      const allLines: string[] = [];
      let maxWidth = 0;

      for (const section of sections) {
        if (section.length === 0) {
          allLines.push("");
          continue;
        }

        // Use TTF_GetStringSizeWrapped for measuring, but we need to
        // figure out the line breaks ourselves for returning the lines array.
        // We do a word-wrap algorithm matching love2d's behavior.
        const words = section.split(" ");
        let currentLine = "";

        for (const word of words) {
          const testLine = currentLine.length === 0 ? word : currentLine + " " + word;
          const testBuf = Buffer.from(testLine + "\0");
          ttf.TTF_GetStringSize(fontPtr, testBuf, 0, _wPtr, _hPtr);
          const testWidth = read.i32(_wPtr, 0);

          if (testWidth > wraplimit && currentLine.length > 0) {
            // Measure current line for maxWidth
            const lineBuf = Buffer.from(currentLine + "\0");
            ttf.TTF_GetStringSize(fontPtr, lineBuf, 0, _wPtr, _hPtr);
            const lineWidth = read.i32(_wPtr, 0);
            if (lineWidth > maxWidth) maxWidth = lineWidth;

            allLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        // Push remaining line
        if (currentLine.length > 0) {
          const lineBuf = Buffer.from(currentLine + "\0");
          ttf.TTF_GetStringSize(fontPtr, lineBuf, 0, _wPtr, _hPtr);
          const lineWidth = read.i32(_wPtr, 0);
          if (lineWidth > maxWidth) maxWidth = lineWidth;
          allLines.push(currentLine);
        }
      }

      return [maxWidth, allLines];
    },

    release(): void {
      ttf.TTF_CloseFont(fontPtr);
    },
  };
}
