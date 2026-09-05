#!/usr/bin/env bash
set -euo pipefail

UUID="codex-usage@malingxspace.github.com"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing $UUID to $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -a "$SOURCE_DIR"/. "$DEST"/
rm -rf "$DEST/.git" "$DEST/dist"

glib-compile-schemas "$DEST/schemas"

echo
echo "Installed. Enable it with:"
echo "  gnome-extensions enable $UUID"
echo
echo "On Wayland, log out and back in if GNOME Shell has not discovered the extension yet."
