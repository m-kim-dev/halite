# Halite 0.2.0 — project tabs and one shared service

Read several projects in tabs, or give them separate windows. Tabs are the
initial default; change **Open projects in** on Welcome or in the File menu.
Right-click a project tab to move it to a new or existing window.

The CLI now reuses one local backend process and one port, shared with the
desktop app. Commands return after opening. The Linux packages include both
`halite` and `halite-desktop`, with no separate Node installation needed.

```sh
halite /path/to/project-a
halite /path/to/project-b
halite /path/to/project-c --window
halite status
halite stop
```

This preview also adds desktop document find with Ctrl+F, match counts,
next/previous matches, and case matching. Existing Markdown, math, Mermaid,
source previews, live refresh, and per-project reading preferences remain.

Download the Linux x64 `.deb` or portable `.tar.gz` and its matching `.sha256`.
Verify with `sha256sum -c FILE.sha256`. The [installation guide](https://github.com/m-kim-dev/halite/blob/v0.2.0-preview.1/docs/linux-preview.md)
explains both options and the Chromium sandbox requirements.

Before upgrading or uninstalling a shared-service version, run `halite stop`
and close the desktop. Existing recent projects and reading preferences are
preserved. Open tabs are not restored after a service restart; open Halite again
to obtain a fresh workspace URL. Moving between windows restores the document
and reading position, but starts a new navigation history in that window.

Validation covers 36 unit/integration tests, six reader browser tests, eight
simultaneous project tabs, concurrent CLI startup, and the installed archive.
The Debian package is checked in Debian 12 and Ubuntu 24.04 containers with the
Chromium sandbox enabled, including a synthetic revision upgrade and removal.
Native folder selections are mocked; real desktop sessions, Wayland, macOS,
Windows, and ARM packages have not been validated for this release.

The preview is free. Source remains MIT-licensed. There is no checkout,
automatic updater, or telemetry. [Report feedback](https://github.com/m-kim-dev/halite/issues/new?template=preview-feedback.yml).
