#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="$PROJECT_DIR/vendor/shaderc/install"
WRAPPER_DIR="$PROJECT_DIR/vendor/shaderc_jove"

# Build in /tmp for speed on WSL (NTFS is slow)
BUILD_BASE="/tmp/shaderc-build"
SOURCE_DIR="$BUILD_BASE/source"
BUILD_DIR="$BUILD_BASE/build"
WRAPPER_BUILD_DIR="$BUILD_BASE/wrapper-build"

echo "=== Shaderc Build Script ==="

# Check prerequisites
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 required for shaderc dependency sync"
  exit 1
fi

# Clone shaderc if not already present
if [ ! -d "$SOURCE_DIR" ]; then
  echo "Cloning google/shaderc..."
  mkdir -p "$BUILD_BASE"
  git clone https://github.com/google/shaderc.git "$SOURCE_DIR"
else
  echo "Shaderc source already present at $SOURCE_DIR"
fi

# Sync dependencies (glslang, spirv-tools, spirv-headers)
echo "Syncing shaderc dependencies..."
pushd "$SOURCE_DIR" > /dev/null
python3 utils/git-sync-deps
popd > /dev/null

# Build shaderc as static lib
echo "Building shaderc static library (this may take a while)..."
cmake -S "$SOURCE_DIR" -B "$BUILD_DIR" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
  -DSHADERC_SKIP_TESTS=ON \
  -DSHADERC_SKIP_EXAMPLES=ON \
  -DSHADERC_SKIP_COPYRIGHT_CHECK=ON \
  -DSPIRV_SKIP_TESTS=ON \
  -DSPIRV_SKIP_EXECUTABLES=ON

ninja -C "$BUILD_DIR" -j"$(nproc)"

# Verify the combined static lib was produced
if [ ! -f "$BUILD_DIR/libshaderc/libshaderc_combined.a" ]; then
  echo "ERROR: libshaderc_combined.a not found"
  exit 1
fi

# Build C wrapper as shared lib
echo "Building shaderc_jove wrapper..."
cmake -S "$WRAPPER_DIR" -B "$WRAPPER_BUILD_DIR" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DSHADERC_BUILD_DIR="$BUILD_DIR" \
  -DSHADERC_SOURCE_DIR="$SOURCE_DIR"

ninja -C "$WRAPPER_BUILD_DIR" -j"$(nproc)"

# Install
echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR/lib"
cp "$WRAPPER_BUILD_DIR/libshaderc_jove.so" "$INSTALL_DIR/lib/"

echo "=== Shaderc build complete ==="
echo "Library: $INSTALL_DIR/lib/libshaderc_jove.so"
