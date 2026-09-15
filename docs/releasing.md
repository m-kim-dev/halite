# Preparing a Halite release

## Build locally

Use Linux x64 with Node 22.12+ (24 recommended), npm, `tar`, and `dpkg-deb`.
Initial dependency/runtime setup needs the network; desktop users need no Node.

```sh
npm ci
npm run check
npm run test:e2e
node scripts/package-linux.mjs
npm run test:desktop
```

Install the Playwright browser once with `npx playwright install chromium`.
The desktop test extracts the actual archive, installs it under a temporary
prefix, removes the source extraction, and launches it with separate settings
and a temporary project. It checks welcome, example, document find, diagrams/math/source,
folder-picker callback, preferences, recents, restart, live refresh, and server
cleanup. Native dialogs are mocked; real picker interaction needs a manual pass.

After `npm run build`, `HALITE_TEST_SOURCE=1 npm run test:desktop` checks the
source app without packaging. This uses the local Electron runtime and does not
establish archive or package installation behavior. It has the same sandbox
requirements described below.

`npm run package:linux` combines the build and packaging. It bundles the server,
copies the client, includes upstream notices, and creates a portable archive,
Debian package, and SHA-256 files. Generated files are ignored by Git. Nothing
is uploaded by this command.

The Debian maintainer defaults to M. Kim's verified GitHub identity and GitHub
noreply address. Support is through GitHub Issues, not that email address.
Forks can set `HALITE_MAINTAINER='Name <email>'`. The full source is MIT-licensed.

## Linux sandbox validation

On this Ubuntu 26.04 host, the portable runtime aborted because its sandbox
helper was not root-owned with mode 4755. Workflow checks passed using:

```sh
HALITE_TEST_NO_SANDBOX=1 npm run test:desktop
```

This test override does **not** establish that normal Linux installation works.
The app and launchers never add `--no-sandbox`. The `.deb` records root ownership
and mode 4755 for `/opt/halite/chrome-sandbox`.

For reproducible package checks with Docker available:

```sh
npm run test:linux -- debian
npm run test:linux -- ubuntu
```

These build disposable Debian 12 / Ubuntu 24.04 containers, install the real
`.deb` through apt, and run the desktop workflow as a non-root user with the
Chromium sandbox enabled. They then upgrade to a synthetic higher package
revision carrying the same payload, repeat the workflow, remove the package,
and verify external state remains. This synthetic revision check does not prove
migration from an earlier released application.

Execution uses a virtual display, no host mounts, and no external network. The
test container adds `SYS_ADMIN` so Chromium's setuid helper can create nested
sandbox namespaces. This is a container test setting, not an application install
requirement. Containers share the host kernel; real desktop sessions, manual
native dialogs, and distribution-specific security policies need separate checks.
Do not make global kernel/AppArmor changes as part of installation.

## Before a public preview

1. Use the public `m-kim-dev/halite` repository, Issues feedback form, and Discussions.
   Review changes for private project contents before publishing.
2. Run checks, inspect screenshots, and complete sandboxed package tests.
   Only x64 is currently built and tested.
3. Update the tested-distribution list and disclose container/manual test limits.
4. Verify checksums from `release/` with `sha256sum -c FILE.sha256`.
5. Create a draft GitHub release with `launch-copy.md` notes, attach packages and
   checksums, and review it before publishing.
6. Keep checkout unavailable during free validation. Follow `monetization.md`
   before creating the paid offer.

The workflow template is in `scripts/ci/github-check.yml`. Copy it to
`.github/workflows/check.yml` using a GitHub credential with workflow permission
to enable CI. The connected OAuth credential can publish source and releases,
but GitHub rejected workflow publication because its `workflow` scope is absent.
The template is preserved without requesting broader account permissions.
Local checks and disposable Linux package tests run independently of GitHub CI.
