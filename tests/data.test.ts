import { test, expect, describe } from "bun:test";
import * as data from "../src/jove/data.ts";
import { ByteData } from "../src/jove/data.ts";

const sampleText = "Hello, jove2d! This is a test string for compression.";
const sampleBytes = new TextEncoder().encode(sampleText);

describe("jove.data", () => {
  describe("compress / decompress", () => {
    test("zlib round-trip", () => {
      const compressed = data.compress("zlib", sampleText);
      const decompressed = data.decompress("zlib", compressed);
      expect(new TextDecoder().decode(decompressed)).toBe(sampleText);
    });

    test("gzip round-trip", () => {
      const compressed = data.compress("gzip", sampleBytes);
      const decompressed = data.decompress("gzip", compressed);
      expect(decompressed).toEqual(sampleBytes);
    });

    test("deflate (raw) round-trip", () => {
      const compressed = data.compress("deflate", sampleText);
      const decompressed = data.decompress("deflate", compressed);
      expect(new TextDecoder().decode(decompressed)).toBe(sampleText);
    });

    test("compress with level 1 (fast)", () => {
      const compressed = data.compress("zlib", sampleText, 1);
      const decompressed = data.decompress("zlib", compressed);
      expect(new TextDecoder().decode(decompressed)).toBe(sampleText);
    });

    test("compress with level 9 (best)", () => {
      const compressed = data.compress("zlib", sampleText, 9);
      const decompressed = data.decompress("zlib", compressed);
      expect(new TextDecoder().decode(decompressed)).toBe(sampleText);
    });

    test("compressed is smaller than original for repetitive data", () => {
      const repetitive = "AAAA".repeat(1000);
      const compressed = data.compress("zlib", repetitive);
      expect(compressed.byteLength).toBeLessThan(repetitive.length);
    });

    test("empty data round-trip", () => {
      const compressed = data.compress("zlib", "");
      const decompressed = data.decompress("zlib", compressed);
      expect(decompressed.byteLength).toBe(0);
    });

    test("invalid format throws", () => {
      expect(() => data.compress("lz4" as any, "test")).toThrow();
      expect(() => data.decompress("lz4" as any, new Uint8Array(0))).toThrow();
    });

    test("compress/decompress with ByteData input", () => {
      const bd = new ByteData(sampleText);
      const compressed = data.compress("zlib", bd);
      const decompressed = data.decompress("zlib", new ByteData(compressed));
      expect(new TextDecoder().decode(decompressed)).toBe(sampleText);
    });
  });

  describe("encode / decode", () => {
    test("base64 round-trip", () => {
      const encoded = data.encode("base64", sampleText);
      const decoded = data.decode("base64", encoded);
      expect(new TextDecoder().decode(decoded)).toBe(sampleText);
    });

    test("hex round-trip", () => {
      const encoded = data.encode("hex", sampleText);
      const decoded = data.decode("hex", encoded);
      expect(new TextDecoder().decode(decoded)).toBe(sampleText);
    });

    test("base64 known value", () => {
      expect(data.encode("base64", "Hello")).toBe("SGVsbG8=");
    });

    test("hex known value", () => {
      expect(data.encode("hex", "Hello")).toBe("48656c6c6f");
    });

    test("decode base64 known value", () => {
      const decoded = data.decode("base64", "SGVsbG8=");
      expect(new TextDecoder().decode(decoded)).toBe("Hello");
    });

    test("decode hex known value", () => {
      const decoded = data.decode("hex", "48656c6c6f");
      expect(new TextDecoder().decode(decoded)).toBe("Hello");
    });

    test("encode empty data", () => {
      expect(data.encode("base64", "")).toBe("");
      expect(data.encode("hex", "")).toBe("");
    });

    test("encode Uint8Array", () => {
      const bytes = new Uint8Array([0xff, 0x00, 0xab]);
      expect(data.encode("hex", bytes)).toBe("ff00ab");
    });

    test("invalid format throws", () => {
      expect(() => data.encode("utf16" as any, "test")).toThrow();
      expect(() => data.decode("utf16" as any, "test")).toThrow();
    });
  });

  describe("hash", () => {
    test("md5 known vector", () => {
      // MD5("") = d41d8cd98f00b204e9800998ecf8427e
      expect(data.hash("md5", "")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    });

    test("md5 hello", () => {
      // MD5("Hello") = 8b1a9953c4611296a827abf8c47804d7
      expect(data.hash("md5", "Hello")).toBe("8b1a9953c4611296a827abf8c47804d7");
    });

    test("sha1 known vector", () => {
      // SHA1("") = da39a3ee5e6b4b0d3255bfef95601890afd80709
      expect(data.hash("sha1", "")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    });

    test("sha256 known vector", () => {
      // SHA256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      expect(data.hash("sha256", "")).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      );
    });

    test("sha256 hello", () => {
      expect(data.hash("sha256", "Hello")).toBe(
        "185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969",
      );
    });

    test("sha512 known vector", () => {
      const expected =
        "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce" +
        "47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
      expect(data.hash("sha512", "")).toBe(expected);
    });

    test("hash Uint8Array input", () => {
      const bytes = new TextEncoder().encode("Hello");
      expect(data.hash("md5", bytes)).toBe("8b1a9953c4611296a827abf8c47804d7");
    });

    test("hash ByteData input", () => {
      const bd = new ByteData("Hello");
      expect(data.hash("md5", bd)).toBe("8b1a9953c4611296a827abf8c47804d7");
    });
  });

  describe("ByteData", () => {
    test("create from size", () => {
      const bd = data.newByteData(16);
      expect(bd.getSize()).toBe(16);
      expect(bd._data.every((b) => b === 0)).toBe(true);
    });

    test("create from Uint8Array", () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const bd = data.newByteData(bytes);
      expect(bd.getSize()).toBe(4);
      expect(bd._data).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    test("create from string", () => {
      const bd = data.newByteData("Hello");
      expect(bd.getSize()).toBe(5);
      expect(bd.getString()).toBe("Hello");
    });

    test("getString round-trip", () => {
      const bd = new ByteData("jove2d rocks");
      expect(bd.getString()).toBe("jove2d rocks");
    });

    test("clone creates independent copy", () => {
      const original = new ByteData("test");
      const cloned = original.clone();
      expect(cloned.getString()).toBe("test");
      cloned._data[0] = 0;
      expect(original._data[0]).not.toBe(0);
    });

    test("getPointer returns a pointer", () => {
      const bd = new ByteData(8);
      const p = bd.getPointer();
      expect(p).toBeTruthy();
    });
  });
});
