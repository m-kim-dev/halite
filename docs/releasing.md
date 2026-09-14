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
and a temporary project. It checks welcome, example, diagrams/math/source,
folder-picker callback, preferences, recents, restart, live refresh, and server
cleanup. Native dialogs are mocked; real picker interaction needs a manual pass.

`npm run package:linux` combines the build and packaging. It bundles the server,
copies the client, includes upstream notices, and creates a portable archive,
Debian package, and SHA-256 files. Generated files are ignored by Git. Nothing
is uploaded by this command.

Set `HALITE_MAINTAINER='Name <support@example.com>'` to the real public identity
when building a public Debian package. Without it the package explicitly uses
`Halite local preview <noreply@localhost>`: temporary build metadata, not a support
channel. The full source is MIT-licensed.

## Linux sandbox validation

On this Ubuntu 26.04 host, the portable runtime aborted because its sandbox
helper was not root-owned with mode 4755. Workflow checks passed using:

```sh
HALITE_TEST_NO_SANDBOX=1 npm run test:desktop
```

This test override does **not** establish that normal Linux installation works.
The app and launchers never add `--no-sandbox`. The `.deb` records root ownership
and mode 4755 for `/opt/halite/chrome-sandbox`; native installation, launch,
upgrade, and uninstall still need verification in a disposable Ubuntu/Debian VM.
Do not make global kernel/AppArmor changes as part of installation.

## Before a public preview

1. Create `m-kim-dev/halite` under M. Kim's account and establish its support
   contact. The account identity is verified and MIT licensing is set.
2. Review content before the first push. Private project names and paths have
   been removed from the design/validation history; original notes are backed
   up outside the repository in `/tmp/halite-public-docs-before`.
3. Run checks, inspect screenshots, and complete normal sandboxed package tests
   on the distributions you intend to support. Only x64 was built here.
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
