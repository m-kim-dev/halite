#!/bin/sh
set -eu
test "$(id -u)" = 0
test "$(stat -c '%U:%G:%a' /opt/halite/chrome-sandbox)" = 'root:root:4755'
printf 'Distribution: '
. /etc/os-release
printf '%s\n' "$PRETTY_NAME"
runuser -u tester -- env HALITE_TEST_BINARY=/opt/halite/halite xvfb-run -a node scripts/check-desktop.mjs

# No older public build exists. Exercise dpkg's upgrade path with an explicitly
# synthetic higher package revision carrying the same application payload.
dpkg-deb --raw-extract /qa/package.deb /qa/upgrade
previous=$(dpkg-query -W -f='${Version}' halite-desktop)
sed -i "s/^Version: .*/Version: $previous.1/" /qa/upgrade/DEBIAN/control
dpkg-deb --root-owner-group -Zgzip --build /qa/upgrade /qa/upgrade.deb >/dev/null
mkdir -p /home/tester/.local/state/halite
printf 'preserve outside application\n' > /home/tester/.local/state/halite/qa-marker
dpkg -i /qa/upgrade.deb
test "$(stat -c '%U:%G:%a' /opt/halite/chrome-sandbox)" = 'root:root:4755'
runuser -u tester -- env HALITE_TEST_BINARY=/opt/halite/halite xvfb-run -a node scripts/check-desktop.mjs
dpkg --remove halite-desktop
test ! -e /opt/halite/halite
test ! -e /usr/bin/halite-desktop
test ! -e /usr/share/applications/halite.desktop
test "$(cat /home/tester/.local/state/halite/qa-marker)" = 'preserve outside application'
echo 'PASS: install, sandboxed workflows, synthetic revision upgrade, removal, and external state preservation.'
