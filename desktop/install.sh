#!/bin/sh
set -eu

# Install for this user only. HALITE_INSTALL_ROOT is useful for portable/test installs.
install_root=${HALITE_INSTALL_ROOT:-"$HOME/.local"}
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
app_dir="$install_root/opt/halite"
bin_dir="$install_root/bin"
desktop_dir="$install_root/share/applications"
marker='Halite desktop installation'
if [ ! -x "$source_dir/halite" ] || [ ! -f "$source_dir/resources/app/package.json" ]; then
  echo 'Run install.sh from the extracted Halite release folder.' >&2
  exit 1
fi
case "$install_root" in /*) ;; *) echo 'HALITE_INSTALL_ROOT must be an absolute path.' >&2; exit 1 ;; esac
if [ -e "$app_dir" ] && { [ ! -f "$app_dir/.halite-install" ] || [ "$(cat "$app_dir/.halite-install")" != "$marker" ]; }; then
  echo "Refusing to replace an unrelated directory: $app_dir" >&2
  exit 1
fi
for existing in "$bin_dir/halite" "$bin_dir/halite-desktop" "$desktop_dir/halite.desktop"; do
  if [ -e "$existing" ] && ! grep -Fq "$marker" "$existing"; then
    echo "Refusing to replace an unrelated file: $existing" >&2
    exit 1
  fi
done
mkdir -p "$install_root/opt" "$bin_dir" "$desktop_dir"
stage=$(mktemp -d "$install_root/opt/.halite-XXXXXX")
trap 'rm -rf -- "$stage"' EXIT HUP INT TERM
cp -R -- "$source_dir" "$stage/app"
printf '%s\n' "$marker" > "$stage/app/.halite-install"
if [ -d "$app_dir" ]; then mv -- "$app_dir" "$stage/previous"; fi
if ! mv -- "$stage/app" "$app_dir"; then
  if [ -d "$stage/previous" ]; then mv -- "$stage/previous" "$app_dir"; fi
  exit 1
fi
# Quote for a POSIX shell string and, separately, a Desktop Entry Exec argument.
shell_path=$(printf '%s' "$app_dir/halite" | sed "s/'/'\\\\''/g")
printf '#!/bin/sh\n# %s\nexec '\''%s'\'' "$@"\n' "$marker" "$shell_path" > "$bin_dir/halite-desktop"
chmod 755 "$bin_dir/halite-desktop"
cli_path=$(printf '%s' "$app_dir/resources/app/dist/server/server/cli.js" | sed "s/'/'\\\\''/g")
printf '#!/bin/sh\n# %s\nELECTRON_RUN_AS_NODE=1 exec '\''%s'\'' '\''%s'\'' "$@"\n' "$marker" "$shell_path" "$cli_path" > "$bin_dir/halite"
chmod 755 "$bin_dir/halite"
exec_path=$(printf '%s' "$bin_dir/halite-desktop" | sed 's/\\/\\\\\\\\/g; s/"/\\\\"/g; s/`/\\\\`/g; s/\$/\\\\$/g; s/%/%%/g')
icon_path=$(printf '%s' "$app_dir/resources/app/desktop/icon.png" | sed 's/\\/\\\\/g')
cat > "$desktop_dir/halite.desktop" <<EOF
[Desktop Entry]
# $marker
Type=Application
Name=Halite
GenericName=Markdown Reader
Comment=Read local project documentation, equations, and diagrams
Exec="$exec_path"
Icon=$icon_path
Terminal=false
Categories=Development;Utility;
Keywords=Markdown;Documentation;Reader;
StartupWMClass=Halite
EOF
chmod 644 "$desktop_dir/halite.desktop"
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$desktop_dir" 2>/dev/null || true; fi
printf '\nInstalled Halite. Open it from your application menu, or run:\n  %s\n' "$bin_dir/halite-desktop"
