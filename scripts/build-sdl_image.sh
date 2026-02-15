#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="$PROJECT_DIR/vendor/SDL_image/install"
SDL3_DIR="$PROJECT_DIR/vendor/SDL3/install"

# Build in a fast filesystem (NTFS on WSL is slow)
BUILD_BASE="/tmp/sdl_image-build"
SOURCE_DIR="$BUILD_BASE/source"
BUILD_DIR="$BUILD_BASE/build"

echo "=== SDL_image Build Script ==="

# Verify SDL3 is installed
if [ ! -d "$SDL3_DIR" ]; then
  echo "ERROR: SDL3 not found at $SDL3_DIR"
  echo "Run 'bun run build-sdl3' first."
  exit 1
fi

# Clone if not already present
if [ ! -d "$SOURCE_DIR" ]; then
  echo "Cloning SDL_image..."
  mkdir -p "$BUILD_BASE"
  git clone --depth 1 https://github.com/libsdl-org/SDL_image.git "$SOURCE_DIR"
else
  echo "SDL_image source already present at $SOURCE_DIR"
fi

# Build
echo "Building SDL_image..."
cmake -S "$SOURCE_DIR" -B "$BUILD_DIR" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR" \
  -DCMAKE_PREFIX_PATH="$SDL3_DIR" \
  -DSDL3_DIR="$SDL3_DIR/lib/cmake/SDL3" \
  -DSDLIMAGE_SHARED=ON \
  -DSDLIMAGE_STATIC=OFF \
  -DSDLIMAGE_SAMPLES=OFF \
  -DSDLIMAGE_VENDORED=OFF

ninja -C "$BUILD_DIR" -j"$(nproc)"

# Install to project vendor directory
echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
ninja -C "$BUILD_DIR" install

echo "=== SDL_image build complete ==="
echo "Library: $(find "$INSTALL_DIR" -name 'libSDL3_image.so*' | head -1)"
