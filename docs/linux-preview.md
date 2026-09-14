# Halite for Linux — desktop preview

**A quiet place to read your project.** Open an existing folder and browse
Markdown, equations, and diagrams while you keep writing in your editor.

This is version 0.1.0, an early preview. It is free to try. Purchasing is not
available yet; the proposed desktop price is **$19 once**. There is no account,
subscription, activation service, telemetry, or automatic updater.

## Open Halite

For Debian/Ubuntu, open the `.deb` in your software installer, or run:

```sh
sudo apt install ./halite-0.1.0-linux-x64-preview.deb
```

This installs Halite under `/opt/halite`, adds an application-menu entry and
`halite-desktop` command, and installs Chromium's sandbox helper with its
required ownership and permissions. Use the `arm64` file on an ARM machine.
This package is prepared for native installation testing; it has not yet been
validated by installing it into the host operating system.

For the portable archive on other Linux distributions:

Extract the archive using your file manager. Open the extracted `Halite-linux-x64`
folder (or `Halite-linux-arm64` for an ARM build) and run `halite`.

For an application-menu entry, open a terminal in that folder and run:

```sh
sh install.sh
```

This copies Halite to `~/.local/opt/halite` and adds an application-menu entry and
`~/.local/bin/halite-desktop`. It does not require Node.js, npm, or administrator
access. Run the installer again from a newer extracted release to update.

Requires a Linux graphical desktop and the usual Chromium system libraries
(GTK, NSS, GBM, ALSA). Choose the archive matching your CPU. The runtime includes
Electron, so the download is larger than the command-line edition.
Distributions that restrict unprivileged user namespaces may reject the Chromium
sandbox in this portable build. This was observed on Ubuntu 26.04; use the `.deb`
package for native installation testing there. Disabling the sandbox is not a
supported installation step.

## First two minutes

1. Choose **Take a look around** to try the included example.
2. Choose **File → Open Folder** (`Ctrl+O`) to read a real project, or
   **File → Open Markdown File** (`Ctrl+Shift+O`) for a single document.
3. Press **Ctrl+K** to find another document by name, path, or title.
4. Change a Markdown file in your editor and save. Halite refreshes the preview.
5. Choose **File → Welcome** (`Ctrl+Shift+H`) to return to recent projects.

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

There are no tabs, full-text project search, in-document desktop find bar,
file-manager associations, or automatic updates yet. Existing browser-mode
`Ctrl+F` is provided by the browser. macOS and Windows packages are not available.

After trying Halite on a real project, tell the person who shared this preview:

- Your Linux distribution/version and whether installation worked.
- What you read and what you currently use for that task.
- Whether you used Halite again later without a reminder.
- The biggest thing stopping you from using it regularly.
- Whether you would buy this desktop experience for $19 once, and why.

Do not include private project contents in a report. Error text and a small
reproduction document are usually enough. Third-party notices are included in
the archive. Halite source is MIT-licensed. The public support channel is still
to be set before public distribution.
