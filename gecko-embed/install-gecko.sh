#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/4] Installing Gecko / Firefox & SpiderMonkey system dependencies..."
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  xz-utils \
  pkg-config \
  build-essential \
  libgtk-3-0t64 \
  libasound2t64 \
  libdbus-glib-1-2 \
  libx11-xcb1 \
  libxtst6 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libegl1 \
  libpci3 \
  fonts-liberation \
  xvfb \
  libmozjs-128-dev

echo "==> [2/4] Downloading & installing latest Mozilla Firefox / Gecko runtime (/opt/firefox)..."
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fsSL "https://download.mozilla.org/?product=firefox-latest-ssl&os=linux64&lang=en-US" \
  -o "$TMP_DIR/firefox.tar.xz"
sudo rm -rf /opt/firefox
sudo mkdir -p /opt
sudo tar -xJf "$TMP_DIR/firefox.tar.xz" -C /opt
sudo ln -sf /opt/firefox/firefox /usr/local/bin/firefox

echo "==> [3/4] Downloading & installing latest Mozilla geckodriver (/usr/local/bin/geckodriver)..."
GECKODRIVER_URL="$(
  curl -fsSL https://api.github.com/repos/mozilla/geckodriver/releases/latest \
  | python3 -c "import sys, json; assets=json.load(sys.stdin)['assets']; print(next(a['browser_download_url'] for a in assets if a['name'].endswith('linux64.tar.gz')))"
)"
curl -fsSL "$GECKODRIVER_URL" -o "$TMP_DIR/geckodriver.tar.gz"
sudo tar -xzf "$TMP_DIR/geckodriver.tar.gz" -C /usr/local/bin geckodriver
sudo chmod +x /usr/local/bin/geckodriver

echo "==> [4/4] Verifying installed Gecko components..."
echo "Firefox / Gecko runtime : $(firefox --version)"
echo "Gecko core library      : $(ls -lh /opt/firefox/libxul.so | awk '{print $9, "(" $5 ")"}')"
echo "Geckodriver             : $(geckodriver --version | head -n 1)"
echo "SpiderMonkey C++ SDK    : mozjs-128 ($(pkg-config --modversion mozjs-128))"
echo "Done!"
