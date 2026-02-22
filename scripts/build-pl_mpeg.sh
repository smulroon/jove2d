#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$PROJECT_DIR/vendor/pl_mpeg"
INSTALL_DIR="$SOURCE_DIR/install"
BUILD_DIR="/tmp/pl_mpeg-build"

echo "=== pl_mpeg Build Script ==="

# Download pl_mpeg.h if not present
if [ ! -f "$SOURCE_DIR/pl_mpeg.h" ]; then
  echo "Downloading pl_mpeg.h..."
  curl -fsSL -o "$SOURCE_DIR/pl_mpeg.h" \
    "https://raw.githubusercontent.com/phoboslab/pl_mpeg/master/pl_mpeg.h"
fi

echo "Building pl_mpeg_jove shared library..."
cmake -S "$SOURCE_DIR" -B "$BUILD_DIR" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release

ninja -C "$BUILD_DIR" -j"$(nproc)"

echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR/lib"
cp "$BUILD_DIR/libpl_mpeg_jove.so" "$INSTALL_DIR/lib/"

echo "=== pl_mpeg build complete ==="
echo "Library: $INSTALL_DIR/lib/libpl_mpeg_jove.so"
