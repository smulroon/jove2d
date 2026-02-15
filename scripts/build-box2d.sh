#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="$PROJECT_DIR/vendor/box2d/install"
WRAPPER_DIR="$PROJECT_DIR/vendor/box2d_jove"

# Build in /tmp for speed on WSL (NTFS is slow)
BUILD_BASE="/tmp/box2d-build"
SOURCE_DIR="$BUILD_BASE/source"
BUILD_DIR="$BUILD_BASE/build"
WRAPPER_BUILD_DIR="$BUILD_BASE/wrapper-build"

BOX2D_TAG="v3.1.1"

echo "=== Box2D Build Script ==="

# Clone Box2D v3 if not already present
if [ ! -d "$SOURCE_DIR" ]; then
  echo "Cloning Box2D $BOX2D_TAG..."
  mkdir -p "$BUILD_BASE"
  git clone --depth 1 --branch "$BOX2D_TAG" https://github.com/erincatto/box2d.git "$SOURCE_DIR"
else
  echo "Box2D source already present at $SOURCE_DIR"
fi

# Build Box2D as static lib
echo "Building Box2D static library..."
cmake -S "$SOURCE_DIR" -B "$BUILD_DIR" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
  -DBUILD_SHARED_LIBS=OFF \
  -DBOX2D_SAMPLES=OFF \
  -DBOX2D_BENCHMARKS=OFF \
  -DBOX2D_DOCS=OFF \
  -DBOX2D_PROFILE=OFF \
  -DBOX2D_VALIDATE=OFF \
  -DBOX2D_UNIT_TESTS=OFF

ninja -C "$BUILD_DIR" -j"$(nproc)"

# Build C wrapper as shared lib
echo "Building box2d_jove wrapper..."
cmake -S "$WRAPPER_DIR" -B "$WRAPPER_BUILD_DIR" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DBOX2D_BUILD_DIR="$BUILD_DIR" \
  -DBOX2D_SOURCE_DIR="$SOURCE_DIR"

ninja -C "$WRAPPER_BUILD_DIR" -j"$(nproc)"

# Install
echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR/lib"
cp "$WRAPPER_BUILD_DIR/libbox2d_jove.so" "$INSTALL_DIR/lib/"

echo "=== Box2D build complete ==="
echo "Library: $INSTALL_DIR/lib/libbox2d_jove.so"
