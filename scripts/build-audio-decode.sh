#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$PROJECT_DIR/vendor/audio_decode"
INSTALL_DIR="$SOURCE_DIR/install"

# Build in /tmp for speed on WSL (NTFS is slow)
BUILD_DIR="/tmp/audio-decode-build"

echo "=== Audio Decode Build Script ==="

echo "Building audio_decode shared library..."
cmake -S "$SOURCE_DIR" -B "$BUILD_DIR" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release

ninja -C "$BUILD_DIR" -j"$(nproc)"

# Install
echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR/lib"
cp "$BUILD_DIR/libaudio_decode.so" "$INSTALL_DIR/lib/"

echo "=== Audio decode build complete ==="
echo "Library: $INSTALL_DIR/lib/libaudio_decode.so"
