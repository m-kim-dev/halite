# Halite for Linux — desktop preview

This guide describes the **unreleased 0.2.0 candidate**. The currently published
download is [0.1.0](https://github.com/m-kim-dev/halite/releases/tag/v0.1.0-preview.1);
use its [matching installation guide](https://github.com/m-kim-dev/halite/blob/v0.1.0-preview.1/docs/linux-preview.md).

**A quiet place to read your project.** Open an existing folder and browse
Markdown, equations, and diagrams while you keep writing in your editor.

This is version 0.2.0, an early preview. It is free to try. Purchasing is not
available yet; the proposed desktop price is **$19 once**. There is no account,
subscription, activation service, telemetry, or automatic updater.

The 0.2.0 packages currently exist only as local build artifacts under `release/`.
Use the matching `.sha256` file to check the package in its download
directory with `sha256sum -c FILE.sha256`.

## Open Halite

For Debian/Ubuntu, open the `.deb` in your software installer, or run:

```sh
sudo apt install ./halite-0.2.0-linux-x64-preview.deb
```

This installs Halite under `/opt/halite`, adds an application-menu entry and
`halite-desktop` command, and installs Chromium's sandbox helper with its
required ownership and permissions. Only **x64** packages are published.

For the portable archive on other Linux distributions:

Extract the archive using your file manager. Open the extracted `Halite-linux-x64`
folder and run `halite`.

For an application-menu entry, open a terminal in that folder and run:

```sh
sh install.sh
```

This copies Halite to `~/.local/opt/halite` and adds an application-menu entry and
`~/.local/bin/halite-desktop`. It does not require Node.js, npm, or administrator
access. Run the installer again from a newer extracted release to update.

Requires a Linux graphical desktop and the usual Chromium system libraries
(GTK, NSS, GBM, ALSA). The runtime includes
Electron, so the download is larger than the command-line edition.
Distributions that restrict unprivileged user namespaces may reject the Chromium
sandbox in this portable build. This was observed on Ubuntu 26.04. Prefer the
`.deb` on Debian/Ubuntu. Disabling the sandbox is not a supported installation step.

## Installation testing

The `.deb` passed install, sandboxed reading workflows, a synthetic package
revision upgrade, and removal checks in Debian 12 and Ubuntu 24.04 x64 containers.
The containers share the host kernel and use a virtual display; this does not
establish compatibility with every desktop session or distribution security policy.
Real desktop installation and native dialog feedback are welcome. ARM, other
distributions, and Wayland-specific behavior have not been validated.
See the [validation record](https://github.com/m-kim-dev/halite/blob/main/docs/validation.md).

## First two minutes

1. Choose **Take a look around** to try the included example.
2. Choose **File → Open Folder** (`Ctrl+O`) to read a real project, or
   **File → Open Markdown File** (`Ctrl+Shift+O`) for a single document.
3. Press **Ctrl+K** to find another document by name, path, or title.
4. Press **Ctrl+F** to find text in the open document. Use **Enter/F3** for the
   next match, **Shift+Enter/Shift+F3** for the previous match, and **Escape** to
   close. The panel also has match buttons and a **Match case** option.
5. Change a Markdown file in your editor and save. Halite refreshes the preview.
6. Choose **File → Welcome** (`Ctrl+Shift+H`) to return to recent projects.

Halite reads your existing files and does not change them. It discovers the
enclosing Git root when one exists. Relative links stay inside that project.
No documents are uploaded. Remote images and external links in documents can
still contact their destinations.

## Local settings and removal

Recent paths are stored in `~/.config/halite-desktop/recent-projects.json`, or the
equivalent directory under `XDG_CONFIG_HOME`. Clear them from the welcome screen.
`HALITE_DESKTOP_STATE_DIR` overrides the desktop settings directory.

Reading preferences are shared with the CLI at `$XDG_STATE_HOME/halite`, falling
back to `~/.local/state/halite`. `HALITE_STATE_DIR` overrides that location.

For a Debian/Ubuntu installation, uninstall with `sudo apt remove halite-desktop`.
For a portable installation, close Halite and remove `~/.local/opt/halite`,
`~/.local/bin/halite-desktop`, and `~/.local/share/applications/halite.desktop`.
Your project files and reading preferences remain. If you set
`HALITE_INSTALL_ROOT`, use that directory in place of `~/.local`.

## Preview limits and feedback

There are no tabs, full-text project search, file-manager associations, or
automatic updates yet. Existing browser-mode
`Ctrl+F` is provided by the browser. macOS and Windows packages are not available.

After trying Halite on a real project, use **Help → Send Preview Feedback** or
the [feedback form](https://github.com/m-kim-dev/halite/issues/new?template=preview-feedback.yml):

- Your Linux distribution/version and whether installation worked.
- What you read and what you currently use for that task.
- Whether you used Halite again later without a reminder.
- The biggest thing stopping you from using it regularly.
- Whether you would buy this desktop experience for $19 once, and why.

Do not include private project contents in a report. Error text and a small
reproduction document are usually enough. Third-party notices are included in
the archive. Halite source is MIT-licensed. Ask questions or share your experience
in [GitHub Discussions](https://github.com/m-kim-dev/halite/discussions).
