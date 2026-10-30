#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="/opt/exotic-win64-work"
STAGE_DIR="$WORK_DIR/stage"
LIGHT_DIR="$WORK_DIR/light-pkg"
RELEASES_DIR="$ROOT_DIR/releases"

mkdir -p "$RELEASES_DIR"
sudo mkdir -p "$WORK_DIR"
sudo chown -R "$(id -u):$(id -g)" "$WORK_DIR"

echo "==> [1/6] Generating Exotic monochrome (#000000 & #FFFFFF) brand assets..."
python3 "$ROOT_DIR/scripts/generate_branding.py"

echo "==> [2/6] Cross-compiling native Win64 Exotic.exe (MinGW-w64 C++20)..."
make -C "$ROOT_DIR/src/win11" clean all

echo "==> [3/6] Packaging Exotic Win11 Launcher & Engine Archive..."
rm -rf "$LIGHT_DIR"
mkdir -p "$LIGHT_DIR/Exotic-LauncherKit"
cp "$ROOT_DIR/bin/Exotic.exe" "$LIGHT_DIR/Exotic-LauncherKit/"
cp -r "$ROOT_DIR/engine" "$LIGHT_DIR/Exotic-LauncherKit/engine"
touch "$LIGHT_DIR/Exotic-LauncherKit/portable.mode"

cat > "$LIGHT_DIR/Exotic-LauncherKit/README-WIN11.txt" <<'TXT'
Exotic Browser for Windows 11 (64-bit)
======================================

Internal Pages:
- exotic://newtab     : New Tab
- exotic://welcome    : First-time Setup Guide
- exotic://settings   : Settings
- exotic://mods       : Exotic Mods
- exotic://bookmarks  : Bookmarks
- exotic://history    : History
- exotic://downloads  : Downloads
- exotic://about      : About Exotic
- exotic://private    : Private Window

Keyboard Shortcuts:
- Ctrl + L / Ctrl + T : Open floating address bar
- Alt + 1 / 2 / 3     : Switch workspaces (Personal / Work / Research)
- Alt + B             : Toggle auto-hide sidebar
- Alt + V             : Toggle compact sidebar
- Alt + S             : Toggle split view
- Alt + G             : Quick page preview
- Alt + M             : Open Exotic Mods
- Alt + ,             : Open Settings
- Alt + T             : Switch between Dark and Light theme
TXT

rm -f "$RELEASES_DIR/Exotic-Win11-LauncherKit.zip"
(cd "$LIGHT_DIR" && zip -qr "$RELEASES_DIR/Exotic-Win11-LauncherKit.zip" Exotic-LauncherKit)

echo "==> [4/6] Extracting Windows 11 x64 159.0 core runtime..."
if [ ! -f "$WORK_DIR/fx-win64.exe" ]; then
  curl -fsSL "https://download.mozilla.org/?product=firefox-latest-ssl&os=win64&lang=en-US" \
    -o "$WORK_DIR/fx-win64.exe"
fi

rm -rf "$STAGE_DIR" "$WORK_DIR/raw"
mkdir -p "$STAGE_DIR/runtime"
7z x -y "$WORK_DIR/fx-win64.exe" -o"$WORK_DIR/raw" >/dev/null
cp -a "$WORK_DIR/raw/core/." "$STAGE_DIR/runtime/"

rm -f \
  "$STAGE_DIR/runtime/pingsender.exe" \
  "$STAGE_DIR/runtime/crashreporter.exe" \
  "$STAGE_DIR/runtime/default-browser-agent.exe" \
  "$STAGE_DIR/runtime/updater.exe" \
  "$STAGE_DIR/runtime/maintenanceservice.exe" \
  "$STAGE_DIR/runtime/maintenanceservice_installer.exe"

echo "==> [5/6] Rebranding internal omnijar archives & icons to Exotic..."
python3 "$ROOT_DIR/scripts/rebrand_omnijar.py" "$STAGE_DIR/runtime"

cp -a "$ROOT_DIR/engine/." "$STAGE_DIR/runtime/"
mkdir -p "$WORK_DIR/asr-wasm" "$STAGE_DIR/runtime/exotic-assets/asr"
if [ ! -f "$WORK_DIR/asr-wasm/ort-wasm-simd-threaded.jsep.wasm" ]; then
  curl -fsSL "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.wasm" \
    -o "$WORK_DIR/asr-wasm/ort-wasm-simd-threaded.jsep.wasm"
fi
if [ ! -f "$WORK_DIR/asr-wasm/ort-wasm-simd-threaded.wasm" ]; then
  curl -fsSL "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.1/dist/ort-wasm-simd-threaded.wasm" \
    -o "$WORK_DIR/asr-wasm/ort-wasm-simd-threaded.wasm"
fi
cp "$WORK_DIR/asr-wasm/ort-wasm-simd-threaded.jsep.wasm" "$STAGE_DIR/runtime/exotic-assets/asr/"
cp "$WORK_DIR/asr-wasm/ort-wasm-simd-threaded.wasm" "$STAGE_DIR/runtime/exotic-assets/asr/"
cp "$ROOT_DIR/bin/Exotic.exe" "$STAGE_DIR/Exotic.exe"
cp "$LIGHT_DIR/Exotic-LauncherKit/README-WIN11.txt" "$STAGE_DIR/README-WIN11.txt"

echo "==> [6/6] Compiling Offline Windows 11 NSIS Setup Installer (Exotic-Win11-Setup-x64.exe)..."
rm -f "$WORK_DIR/Exotic-Win11-Setup-x64.exe"
mkdir -p "$WORK_DIR/tmp"
TMPDIR="$WORK_DIR/tmp" makensis -DROOT_DIR="$ROOT_DIR" -DSTAGE_DIR="$STAGE_DIR" -DOUT_FILE="$WORK_DIR/Exotic-Win11-Setup-x64.exe" "$ROOT_DIR/scripts/installer.nsi"
cp "$WORK_DIR/Exotic-Win11-Setup-x64.exe" "$RELEASES_DIR/Exotic-Win11-Setup-x64.exe"

rm -rf "$STAGE_DIR" "$WORK_DIR/raw" "$LIGHT_DIR" "$WORK_DIR/tmp"

(cd "$RELEASES_DIR" && sha256sum *.exe *.zip > SHA256SUMS.txt)

echo ""
echo "Build complete! Artifacts in $RELEASES_DIR:"
ls -lh "$RELEASES_DIR"
