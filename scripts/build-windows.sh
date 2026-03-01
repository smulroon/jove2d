#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TOOLCHAIN="$SCRIPT_DIR/mingw-w64-x86_64.cmake"

# All Windows builds go under /tmp for speed on WSL
BUILD_ROOT="/tmp/jove2d-win64"

echo "=== jove2d Windows Cross-Compilation (MinGW-w64) ==="

# Check prerequisites
if ! command -v x86_64-w64-mingw32-gcc &>/dev/null; then
  echo "ERROR: MinGW-w64 not found. Install with:"
  echo "  sudo apt install mingw-w64"
  exit 1
fi

# ─── 1. SDL3 ────────────────────────────────────────────────────────────────

SDL3_SOURCE="$BUILD_ROOT/SDL3-source"
SDL3_BUILD="$BUILD_ROOT/SDL3-build"
SDL3_INSTALL="$PROJECT_DIR/vendor/SDL3/install"

echo ""
echo "=== [1/7] Building SDL3 ==="

if [ ! -d "$SDL3_SOURCE" ]; then
  echo "Cloning SDL3..."
  mkdir -p "$BUILD_ROOT"
  git clone --depth 1 https://github.com/libsdl-org/SDL.git "$SDL3_SOURCE"
fi

cmake -S "$SDL3_SOURCE" -B "$SDL3_BUILD" -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$SDL3_INSTALL" \
  -DSDL_SHARED=ON \
  -DSDL_STATIC=OFF \
  -DSDL_TEST_LIBRARY=OFF \
  -DSDL_TESTS=OFF

ninja -C "$SDL3_BUILD" -j"$(nproc)"
ninja -C "$SDL3_BUILD" install

# CMake installs DLLs to bin/ — copy to lib/ so libPath() finds them
if [ -f "$SDL3_INSTALL/bin/SDL3.dll" ]; then
  cp "$SDL3_INSTALL/bin/SDL3.dll" "$SDL3_INSTALL/lib/"
fi

echo "SDL3 done: $(ls "$SDL3_INSTALL"/lib/SDL3.dll 2>/dev/null || echo 'not found')"

# ─── 2. SDL_ttf (with vendored freetype) ────────────────────────────────────

SDL_TTF_SOURCE="$BUILD_ROOT/SDL_ttf-source"
SDL_TTF_BUILD="$BUILD_ROOT/SDL_ttf-build"
SDL_TTF_INSTALL="$PROJECT_DIR/vendor/SDL_ttf/install"

echo ""
echo "=== [2/7] Building SDL_ttf ==="

if [ ! -d "$SDL_TTF_SOURCE" ]; then
  echo "Cloning SDL_ttf (with vendored deps)..."
  git clone --depth 1 --recurse-submodules https://github.com/libsdl-org/SDL_ttf.git "$SDL_TTF_SOURCE"
fi

cmake -S "$SDL_TTF_SOURCE" -B "$SDL_TTF_BUILD" -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$SDL_TTF_INSTALL" \
  -DCMAKE_PREFIX_PATH="$SDL3_INSTALL" \
  -DSDL3_DIR="$SDL3_INSTALL/lib/cmake/SDL3" \
  -DSDLTTF_SHARED=ON \
  -DSDLTTF_STATIC=OFF \
  -DSDLTTF_SAMPLES=OFF \
  -DSDLTTF_VENDORED=ON

ninja -C "$SDL_TTF_BUILD" -j"$(nproc)"
ninja -C "$SDL_TTF_BUILD" install

if [ -f "$SDL_TTF_INSTALL/bin/SDL3_ttf.dll" ]; then
  cp "$SDL_TTF_INSTALL/bin/SDL3_ttf.dll" "$SDL_TTF_INSTALL/lib/"
fi

echo "SDL_ttf done: $(ls "$SDL_TTF_INSTALL"/lib/SDL3_ttf.dll 2>/dev/null || echo 'not found')"

# ─── 3. SDL_image (with vendored deps) ──────────────────────────────────────

SDL_IMAGE_SOURCE="$BUILD_ROOT/SDL_image-source"
SDL_IMAGE_BUILD="$BUILD_ROOT/SDL_image-build"
SDL_IMAGE_INSTALL="$PROJECT_DIR/vendor/SDL_image/install"

echo ""
echo "=== [3/7] Building SDL_image ==="

if [ ! -d "$SDL_IMAGE_SOURCE" ]; then
  echo "Cloning SDL_image (with vendored deps)..."
  git clone --depth 1 --recurse-submodules https://github.com/libsdl-org/SDL_image.git "$SDL_IMAGE_SOURCE"
fi

cmake -S "$SDL_IMAGE_SOURCE" -B "$SDL_IMAGE_BUILD" -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$SDL_IMAGE_INSTALL" \
  -DCMAKE_PREFIX_PATH="$SDL3_INSTALL" \
  -DSDL3_DIR="$SDL3_INSTALL/lib/cmake/SDL3" \
  -DSDLIMAGE_SHARED=ON \
  -DSDLIMAGE_STATIC=OFF \
  -DSDLIMAGE_SAMPLES=OFF \
  -DSDLIMAGE_VENDORED=ON \
  -DSDLIMAGE_AVIF=OFF \
  -DSDLIMAGE_JXL=OFF \
  -DSDLIMAGE_TIF=OFF

ninja -C "$SDL_IMAGE_BUILD" -j"$(nproc)"
ninja -C "$SDL_IMAGE_BUILD" install

if [ -f "$SDL_IMAGE_INSTALL/bin/SDL3_image.dll" ]; then
  cp "$SDL_IMAGE_INSTALL/bin/SDL3_image.dll" "$SDL_IMAGE_INSTALL/lib/"
fi

echo "SDL_image done: $(ls "$SDL_IMAGE_INSTALL"/lib/SDL3_image.dll 2>/dev/null || echo 'not found')"

# ─── 4. Box2D + box2d_jove wrapper ──────────────────────────────────────────

BOX2D_SOURCE="$BUILD_ROOT/box2d-source"
BOX2D_BUILD="$BUILD_ROOT/box2d-build"
WRAPPER_BUILD="$BUILD_ROOT/box2d_jove-build"
BOX2D_INSTALL="$PROJECT_DIR/vendor/box2d/install"
BOX2D_TAG="v3.1.1"

echo ""
echo "=== [4/7] Building Box2D + wrapper ==="

if [ ! -d "$BOX2D_SOURCE" ]; then
  echo "Cloning Box2D $BOX2D_TAG..."
  git clone --depth 1 --branch "$BOX2D_TAG" https://github.com/erincatto/box2d.git "$BOX2D_SOURCE"
fi

# Build Box2D as static lib
cmake -S "$BOX2D_SOURCE" -B "$BOX2D_BUILD" -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
  -DBUILD_SHARED_LIBS=OFF \
  -DBOX2D_SAMPLES=OFF \
  -DBOX2D_BENCHMARKS=OFF \
  -DBOX2D_DOCS=OFF \
  -DBOX2D_PROFILE=OFF \
  -DBOX2D_VALIDATE=OFF \
  -DBOX2D_UNIT_TESTS=OFF

ninja -C "$BOX2D_BUILD" -j"$(nproc)"

# Build C wrapper as shared DLL
cmake -S "$PROJECT_DIR/vendor/box2d_jove" -B "$WRAPPER_BUILD" -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBOX2D_BUILD_DIR="$BOX2D_BUILD" \
  -DBOX2D_SOURCE_DIR="$BOX2D_SOURCE"

ninja -C "$WRAPPER_BUILD" -j"$(nproc)"

mkdir -p "$BOX2D_INSTALL/lib"
# MinGW produces libbox2d_jove.dll (with lib prefix) or box2d_jove.dll
for dll in "$WRAPPER_BUILD"/libbox2d_jove.dll "$WRAPPER_BUILD"/box2d_jove.dll; do
  if [ -f "$dll" ]; then
    cp "$dll" "$BOX2D_INSTALL/lib/box2d_jove.dll"
    break
  fi
done

echo "Box2D done: $(ls "$BOX2D_INSTALL"/lib/box2d_jove.dll 2>/dev/null || echo 'not found')"

# ─── 5. audio_decode ────────────────────────────────────────────────────────

AUDIO_SOURCE="$PROJECT_DIR/vendor/audio_decode"
AUDIO_BUILD="$BUILD_ROOT/audio_decode-build"
AUDIO_INSTALL="$AUDIO_SOURCE/install"

echo ""
echo "=== [5/7] Building audio_decode ==="

cmake -S "$AUDIO_SOURCE" -B "$AUDIO_BUILD" -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DCMAKE_BUILD_TYPE=Release

ninja -C "$AUDIO_BUILD" -j"$(nproc)"

mkdir -p "$AUDIO_INSTALL/lib"
# MinGW produces libaudio_decode.dll or audio_decode.dll
for dll in "$AUDIO_BUILD"/libaudio_decode.dll "$AUDIO_BUILD"/audio_decode.dll; do
  if [ -f "$dll" ]; then
    cp "$dll" "$AUDIO_INSTALL/lib/audio_decode.dll"
    break
  fi
done

echo "audio_decode done: $(ls "$AUDIO_INSTALL"/lib/audio_decode.dll 2>/dev/null || echo 'not found')"

# ─── 6. pl_mpeg ──────────────────────────────────────────────────────────────

echo ""
echo "=== [6/7] Building pl_mpeg ==="

PLMPEG_SOURCE="$PROJECT_DIR/vendor/pl_mpeg"
PLMPEG_BUILD="$BUILD_ROOT/pl_mpeg"
PLMPEG_INSTALL="$PLMPEG_SOURCE/install"

# Download pl_mpeg.h if not present
if [ ! -f "$PLMPEG_SOURCE/pl_mpeg.h" ]; then
  echo "Downloading pl_mpeg.h..."
  curl -fsSL -o "$PLMPEG_SOURCE/pl_mpeg.h" \
    "https://raw.githubusercontent.com/phoboslab/pl_mpeg/master/pl_mpeg.h"
fi

cmake -S "$PLMPEG_SOURCE" -B "$PLMPEG_BUILD" -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DCMAKE_BUILD_TYPE=Release

ninja -C "$PLMPEG_BUILD" -j"$(nproc)"

mkdir -p "$PLMPEG_INSTALL/lib"
for dll in "$PLMPEG_BUILD"/libpl_mpeg_jove.dll "$PLMPEG_BUILD"/pl_mpeg_jove.dll; do
  if [ -f "$dll" ]; then
    cp "$dll" "$PLMPEG_INSTALL/lib/pl_mpeg_jove.dll"
    break
  fi
done

echo "pl_mpeg done: $(ls "$PLMPEG_INSTALL"/lib/pl_mpeg_jove.dll 2>/dev/null || echo 'not found')"

# ─── 7. shaderc + shaderc_jove wrapper ──────────────────────────────────────

SHADERC_SOURCE="$BUILD_ROOT/shaderc-source"
SHADERC_BUILD="$BUILD_ROOT/shaderc-build"
SHADERC_WRAPPER_BUILD="$BUILD_ROOT/shaderc_jove-build"
SHADERC_INSTALL="$PROJECT_DIR/vendor/shaderc/install"

echo ""
echo "=== [7/7] Building shaderc + wrapper ==="

if ! command -v python3 &>/dev/null; then
  echo "WARNING: python3 not found — skipping shaderc build"
else
  if [ ! -d "$SHADERC_SOURCE" ]; then
    echo "Cloning google/shaderc..."
    git clone https://github.com/google/shaderc.git "$SHADERC_SOURCE"
  fi

  echo "Syncing shaderc dependencies..."
  pushd "$SHADERC_SOURCE" > /dev/null
  python3 utils/git-sync-deps
  popd > /dev/null

  # Build shaderc as static lib
  cmake -S "$SHADERC_SOURCE" -B "$SHADERC_BUILD" -G Ninja \
    -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
    -DSHADERC_SKIP_TESTS=ON \
    -DSHADERC_SKIP_EXAMPLES=ON \
    -DSHADERC_SKIP_COPYRIGHT_CHECK=ON \
    -DSPIRV_SKIP_TESTS=ON \
    -DSPIRV_SKIP_EXECUTABLES=ON

  ninja -C "$SHADERC_BUILD" -j"$(nproc)"

  # Build C wrapper as shared DLL
  cmake -S "$PROJECT_DIR/vendor/shaderc_jove" -B "$SHADERC_WRAPPER_BUILD" -G Ninja \
    -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
    -DCMAKE_BUILD_TYPE=Release \
    -DSHADERC_BUILD_DIR="$SHADERC_BUILD" \
    -DSHADERC_SOURCE_DIR="$SHADERC_SOURCE"

  ninja -C "$SHADERC_WRAPPER_BUILD" -j"$(nproc)"

  mkdir -p "$SHADERC_INSTALL/lib"
  for dll in "$SHADERC_WRAPPER_BUILD"/libshaderc_jove.dll "$SHADERC_WRAPPER_BUILD"/shaderc_jove.dll; do
    if [ -f "$dll" ]; then
      cp "$dll" "$SHADERC_INSTALL/lib/shaderc_jove.dll"
      break
    fi
  done
fi

echo "shaderc done: $(ls "$SHADERC_INSTALL"/lib/shaderc_jove.dll 2>/dev/null || echo 'not found')"

# ─── Summary ────────────────────────────────────────────────────────────────

echo ""
echo "=== Windows cross-compilation complete ==="
echo "DLLs:"
for f in \
  "$SDL3_INSTALL/lib/SDL3.dll" \
  "$SDL_TTF_INSTALL/lib/SDL3_ttf.dll" \
  "$SDL_IMAGE_INSTALL/lib/SDL3_image.dll" \
  "$BOX2D_INSTALL/lib/box2d_jove.dll" \
  "$AUDIO_INSTALL/lib/audio_decode.dll" \
  "$PLMPEG_INSTALL/lib/pl_mpeg_jove.dll" \
  "$SHADERC_INSTALL/lib/shaderc_jove.dll"; do
  if [ -f "$f" ]; then
    echo "  ✓ $f"
  else
    echo "  ✗ $f (MISSING)"
  fi
done
