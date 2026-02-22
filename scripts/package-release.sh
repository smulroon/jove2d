#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  echo "Usage: $0 <linux-x64|windows-x64> [version]"
  echo "  version defaults to the version field in package.json"
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

PLATFORM="$1"
if [[ "$PLATFORM" != "linux-x64" && "$PLATFORM" != "windows-x64" ]]; then
  echo "ERROR: Unknown platform '$PLATFORM'"
  usage
fi

# Read version from arg or package.json
if [ $# -ge 2 ]; then
  VERSION="$2"
else
  VERSION=$(grep '"version"' "$PROJECT_DIR/package.json" | head -1 | sed 's/.*"\([0-9][^"]*\)".*/\1/')
fi

RELEASE_NAME="jove2d-v${VERSION}-${PLATFORM}"
STAGING_DIR="/tmp/${RELEASE_NAME}"

echo "=== Packaging ${RELEASE_NAME} ==="

# Clean previous staging
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/lib"

# ─── Copy source files ────────────────────────────────────────────────────────

echo "Copying source files..."
cp -r "$PROJECT_DIR/src" "$STAGING_DIR/"
cp -r "$PROJECT_DIR/assets" "$STAGING_DIR/"
cp -r "$PROJECT_DIR/examples" "$STAGING_DIR/"
cp "$PROJECT_DIR/package.json" "$STAGING_DIR/"
cp "$PROJECT_DIR/tsconfig.json" "$STAGING_DIR/"
cp "$PROJECT_DIR/README.md" "$STAGING_DIR/"
cp "$PROJECT_DIR/LICENSE" "$STAGING_DIR/"

# Remove love2d .lua files from examples (not needed in release)
find "$STAGING_DIR/examples" -name "*.lua" -delete

# ─── Copy native libraries ────────────────────────────────────────────────────

echo "Copying native libraries..."

if [ "$PLATFORM" = "linux-x64" ]; then
  # Linux: follow symlinks with cp -L to get actual .so files
  LIBS=(
    "vendor/SDL3/install/lib/libSDL3.so.0"
    "vendor/SDL_ttf/install/lib/libSDL3_ttf.so.0"
    "vendor/SDL_image/install/lib/libSDL3_image.so.0"
    "vendor/box2d/install/lib/libbox2d_jove.so"
    "vendor/audio_decode/install/lib/libaudio_decode.so"
    "vendor/pl_mpeg/install/lib/libpl_mpeg_jove.so"
  )
  # Also create unversioned symlinks so dlopen finds them
  SYMLINKS=(
    "libSDL3.so"
    "libSDL3_ttf.so"
    "libSDL3_image.so"
    ""
    ""
    ""
  )

  for i in "${!LIBS[@]}"; do
    src="$PROJECT_DIR/${LIBS[$i]}"
    if [ -f "$src" ]; then
      cp -L "$src" "$STAGING_DIR/lib/"
      symlink="${SYMLINKS[$i]}"
      if [ -n "$symlink" ]; then
        base=$(basename "$src")
        ln -sf "$base" "$STAGING_DIR/lib/$symlink"
      fi
      echo "  + $(basename "$src")"
    else
      echo "  ! MISSING: ${LIBS[$i]}"
    fi
  done

elif [ "$PLATFORM" = "windows-x64" ]; then
  LIBS=(
    "vendor/SDL3/install/lib/SDL3.dll"
    "vendor/SDL_ttf/install/lib/SDL3_ttf.dll"
    "vendor/SDL_image/install/lib/SDL3_image.dll"
    "vendor/box2d/install/lib/box2d_jove.dll"
    "vendor/audio_decode/install/lib/audio_decode.dll"
    "vendor/pl_mpeg/install/lib/pl_mpeg_jove.dll"
  )

  for lib in "${LIBS[@]}"; do
    src="$PROJECT_DIR/$lib"
    if [ -f "$src" ]; then
      cp "$src" "$STAGING_DIR/lib/"
      echo "  + $(basename "$src")"
    else
      echo "  ! MISSING: $lib"
    fi
  done
fi

# ─── Create archive ───────────────────────────────────────────────────────────

echo "Creating archive..."

OUTPUT_DIR="${OUTPUT_DIR:-$PROJECT_DIR}"

if [ "$PLATFORM" = "linux-x64" ]; then
  ARCHIVE="${OUTPUT_DIR}/${RELEASE_NAME}.tar.gz"
  tar -czf "$ARCHIVE" -C /tmp "$RELEASE_NAME"
  echo "=== Created: $ARCHIVE ==="
  echo "Size: $(du -h "$ARCHIVE" | cut -f1)"
else
  ARCHIVE="${OUTPUT_DIR}/${RELEASE_NAME}.zip"
  (cd /tmp && zip -qr "$ARCHIVE" "$RELEASE_NAME")
  echo "=== Created: $ARCHIVE ==="
  echo "Size: $(du -h "$ARCHIVE" | cut -f1)"
fi

# Cleanup staging
rm -rf "$STAGING_DIR"

echo "Done."
