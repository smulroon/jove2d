// jove2d data module — mirrors love.data API
// Provides compression, encoding, hashing, and ByteData utilities

import { ptr } from "bun:ffi";
import type { Pointer } from "bun:ffi";
import { deflateSync, inflateSync, gzipSync, gunzipSync } from "zlib";

export type CompressedDataFormat = "zlib" | "gzip" | "deflate";
export type EncodeFormat = "base64" | "hex";
export type HashFunction = "md5" | "sha1" | "sha224" | "sha256" | "sha384" | "sha512";

/**
 * ByteData — a simple wrapper around a Uint8Array with love2d-compatible API.
 */
export class ByteData {
  _data: Uint8Array;

  constructor(sizeOrData: number | Uint8Array | string) {
    if (typeof sizeOrData === "number") {
      this._data = new Uint8Array(sizeOrData);
    } else if (typeof sizeOrData === "string") {
      this._data = new TextEncoder().encode(sizeOrData);
    } else {
      this._data = new Uint8Array(sizeOrData);
    }
  }

  getSize(): number {
    return this._data.byteLength;
  }

  getString(): string {
    return new TextDecoder().decode(this._data);
  }

  getPointer(): Pointer {
    return ptr(this._data);
  }

  clone(): ByteData {
    return new ByteData(new Uint8Array(this._data));
  }
}

function _toBuffer(data: string | Uint8Array | ByteData): Buffer {
  if (data instanceof ByteData) return Buffer.from(data._data);
  if (typeof data === "string") return Buffer.from(data);
  return Buffer.from(data);
}

/**
 * Compress data using the specified format.
 * @param format - "zlib", "gzip", or "deflate" (raw deflate)
 * @param data - string or Uint8Array to compress
 * @param level - compression level 0-9 (default: -1 for zlib default)
 */
export function compress(
  format: CompressedDataFormat,
  data: string | Uint8Array | ByteData,
  level: number = -1,
): Uint8Array {
  const buf = _toBuffer(data);
  const opts = level >= 0 ? { level } : undefined;
  switch (format) {
    case "zlib":
      return new Uint8Array(deflateSync(buf, opts));
    case "gzip":
      return new Uint8Array(gzipSync(buf, opts));
    case "deflate":
      return new Uint8Array(deflateSync(buf, { ...opts, raw: true } as any));
    default:
      throw new Error(`Unknown compression format: ${format}`);
  }
}

/**
 * Decompress data using the specified format.
 * @param format - "zlib", "gzip", or "deflate" (raw deflate)
 * @param data - compressed data
 */
export function decompress(
  format: CompressedDataFormat,
  data: Uint8Array | ByteData,
): Uint8Array {
  const buf = _toBuffer(data);
  switch (format) {
    case "zlib":
      return new Uint8Array(inflateSync(buf));
    case "gzip":
      return new Uint8Array(gunzipSync(buf));
    case "deflate":
      return new Uint8Array(inflateSync(buf, { raw: true } as any));
    default:
      throw new Error(`Unknown compression format: ${format}`);
  }
}

/**
 * Encode data as a string in the specified format.
 * @param format - "base64" or "hex"
 * @param data - data to encode
 */
export function encode(
  format: EncodeFormat,
  data: string | Uint8Array | ByteData,
): string {
  const buf = _toBuffer(data);
  switch (format) {
    case "base64":
      return buf.toString("base64");
    case "hex":
      return buf.toString("hex");
    default:
      throw new Error(`Unknown encode format: ${format}`);
  }
}

/**
 * Decode a string from the specified format.
 * @param format - "base64" or "hex"
 * @param str - encoded string
 */
export function decode(format: EncodeFormat, str: string): Uint8Array {
  switch (format) {
    case "base64":
      return new Uint8Array(Buffer.from(str, "base64"));
    case "hex":
      return new Uint8Array(Buffer.from(str, "hex"));
    default:
      throw new Error(`Unknown decode format: ${format}`);
  }
}

/**
 * Compute a hash of the data using the specified algorithm.
 * @param algorithm - hash function name
 * @param data - data to hash
 * @returns hex-encoded hash string
 */
export function hash(
  algorithm: HashFunction,
  data: string | Uint8Array | ByteData,
): string {
  const hasher = new Bun.CryptoHasher(algorithm);
  if (data instanceof ByteData) {
    hasher.update(data._data);
  } else {
    hasher.update(data);
  }
  return hasher.digest("hex");
}

/**
 * Create a new ByteData object.
 * @param sizeOrData - byte count, Uint8Array, or string
 */
export function newByteData(sizeOrData: number | Uint8Array | string): ByteData {
  return new ByteData(sizeOrData);
}
