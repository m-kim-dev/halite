import { chmod, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export async function packageDeb({ bundle, release, version, arch }) {
  const stage = path.join(release, 'deb-stage');
  await rm(stage, { recursive: true, force: true });
  const destination = path.join(stage, 'opt/halite');
  await mkdir(path.join(stage, 'DEBIAN'), { recursive: true });
  await mkdir(path.join(stage, 'usr/bin'), { recursive: true });
  await mkdir(path.join(stage, 'usr/share/applications'), { recursive: true });
  await cp(bundle, destination, { recursive: true });
  // dpkg installs this helper as root:root. Launchers keep sandboxing enabled.
  await chmod(path.join(destination, 'chrome-sandbox'), 0o4755);
  const maintainer = process.env.HALITE_MAINTAINER || 'M. Kim <217003149+m-kim-dev@users.noreply.github.com>';
  if (/[\r\n]/.test(maintainer)) throw new Error('HALITE_MAINTAINER must be one line: Name <email>.');
  const control = [
    'Package: halite-desktop', `Version: ${version}~preview`, `Architecture: ${arch === 'x64' ? 'amd64' : 'arm64'}`,
    `Maintainer: ${maintainer}`, 'Section: editors', 'Priority: optional',
    'Homepage: https://github.com/m-kim-dev/halite',
    'Depends: libgtk-3-0t64 | libgtk-3-0, libnss3, libnspr4, libgbm1, libasound2t64 | libasound2, libatk-bridge2.0-0t64 | libatk-bridge2.0-0, libcups2t64 | libcups2, libx11-6, libxcb1, libxcomposite1, libxdamage1, libxext6, libxfixes3, libxrandr2, libxkbcommon0, libudev1, libatomic1',
    'Description: Halite local Markdown reader (desktop preview)',
    ' Read project documentation, equations, and diagrams without importing files.',
    ' Free preview. Support: https://github.com/m-kim-dev/halite/issues', '',
  ].join('\n');
  await writeFile(path.join(stage, 'DEBIAN/control'), control);
  await writeFile(path.join(stage, 'usr/bin/halite-desktop'), '#!/bin/sh\nexec /opt/halite/halite "$@"\n', { mode: 0o755 });
  await writeFile(path.join(stage, 'usr/share/applications/halite.desktop'), '[Desktop Entry]\nType=Application\nName=Halite\nGenericName=Markdown Reader\nComment=Read local project documentation, equations, and diagrams\nExec=/usr/bin/halite-desktop\nIcon=/opt/halite/resources/app/desktop/icon.png\nTerminal=false\nCategories=Development;Utility;\nKeywords=Markdown;Documentation;Reader;\nStartupWMClass=Halite\n');
  const name = `halite-${version}-linux-${arch}-preview.deb`;
  execFileSync('dpkg-deb', ['--root-owner-group', '-Zgzip', '--build', stage, path.join(release, name)], { stdio: 'inherit' });
  await rm(stage, { recursive: true, force: true });
  return name;
}
