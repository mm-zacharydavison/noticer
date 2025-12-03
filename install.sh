#!/bin/sh
set -e

REPO="zdavison/noticer"

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux*)  PLATFORM="linux" ;;
  Darwin*) PLATFORM="darwin" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Windows only supports x64
if [ "$PLATFORM" = "windows" ]; then
  ARCH="x64"
  BINARY="noticer-windows-x64.exe"
  INSTALL_NAME="noticer.exe"
else
  BINARY="noticer-${PLATFORM}-${ARCH}"
  INSTALL_NAME="noticer"
fi

# Prompt for install location
echo "Where would you like to install noticer?"
echo ""
echo "  1) Under this directory (default: ./bin/noticer)"
echo "  2) Global (~/.local/bin/noticer)"
echo ""
printf "Choice [1]: "
read -r CHOICE

case "$CHOICE" in
  2)
    INSTALL_DIR="$HOME/.local/bin"
    ;;
  *)
    printf "Install path [./bin]: "
    read -r CUSTOM_PATH
    INSTALL_DIR="${CUSTOM_PATH:-./bin}"
    ;;
esac

# Get latest release tag
LATEST=$(curl -sL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST" ]; then
  echo "Failed to fetch latest release"
  exit 1
fi

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST}/${BINARY}"

echo ""
echo "Installing noticer ${LATEST} for ${PLATFORM}-${ARCH}..."

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Download and install
curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/${INSTALL_NAME}"
chmod +x "${INSTALL_DIR}/${INSTALL_NAME}"

echo ""
echo "Installed to ${INSTALL_DIR}/${INSTALL_NAME}"

# Show usage hint
FULL_PATH="$(cd "$INSTALL_DIR" && pwd)/${INSTALL_NAME}"
echo ""
echo "Run '${FULL_PATH} --help' to get started."
