# Halite

**A quiet place to read your project.**

Halite is a local, read-only Markdown reader for developers and researchers.
Open an existing project, follow its links, and read its equations and diagrams.
Keep writing in Neovim or your favourite editor; Halite refreshes as you save.
Your documents stay in their original directories.

Named after halite, the crystalline form of sodium chloride (NaCl).
By [M. Kim](https://github.com/m-kim-dev).

Source is available under the [MIT license](LICENSE). The planned paid desktop
downloads support packaging and maintenance; building from source stays an option.

![Halite reading the included example with its explorer, outline, and Mermaid diagram](docs/images/halite-reader.png)

## Linux desktop preview

The desktop preview adds a native folder/file picker, recent projects, and a
built-in example. Its packages include the runtime, so readers do not need Node.
See the [Linux installation guide](docs/linux-preview.md) for installation,
preview limitations, and feedback prompts.

[Download the Linux x64 preview](https://github.com/m-kim-dev/halite/releases/tag/v0.1.0-preview.1) ·
[Report a problem or share feedback](https://github.com/m-kim-dev/halite/issues/new?template=preview-feedback.yml)

The current preview and CLI are free to try. The proposed desktop price is
**$19 once** after installation and usage have been validated. Purchasing is not
available yet. See the [launch plan](docs/monetization.md).

To build locally on Linux (requires Node, npm, `tar`, and `dpkg-deb`):

```bash
npm ci
npm run package:linux
```

This produces `.deb` and `.tar.gz` files with SHA-256 checksums under `release/`.
The `.deb` passed installation, sandboxed workflows, a synthetic revision upgrade,
and removal in Debian 12 and Ubuntu 24.04 x64 containers. Real desktop sessions
still need tester feedback; see the [validation record](docs/validation.md).

## Run the CLI

Requires Node.js **22.12 or newer** and npm. From this repository:

```bash
npm ci
npm run build
npm start -- /path/to/project
```

The app opens your browser at **http://127.0.0.1:4173**. Keep the terminal running;
Ctrl-C stops the service. Use `--no-open` to print the URL without opening a
browser.

Other entry points:

```bash
# Read the current directory (this viewer's own docs, when run here).
npm start

# Start with a particular document.
npm start -- /path/to/project/docs/README.md

# Open a directory without discovering a containing repository.
npm start -- /path/to/docs --root /path/to/docs

# Choose another port, or use 0 to choose an available port.
npm start -- /path/to/project --port 4174 --no-open
```

To make the `halite` command available in your npm environment, run `npm link`
once from this directory after building. Then use it from any project:

```bash
halite .
halite docs/README.md
halite --help
```

`npm link` uses your configured npm global prefix. The application itself does not
require administrator privileges.
If you previously linked the `mdview` command, rerun `npm link` to register `halite`.

## Reading features

- A Markdown file explorer, folder filtering, and fuzzy quick open across
  filenames, paths, and document titles.
- A heading outline, breadcrumbs, and back/forward navigation with restored
  reading positions.
- GitHub-style tables and task lists; highlighted code with copy controls.
- Mermaid diagrams and local PNG, JPEG, GIF, WebP, AVIF, and SVG images, with
  expanded views and zoom.
- KaTeX math using `$...$`, `$$...$$`, `\(...\)`, and `\[...\]`.
- Relative document and directory links, project-root links, and read-only
  previews of linked source/configuration files.
- Refresh after external file edits, light/dark themes, adjustable text size,
  and collapsible sidebars.

Press **Ctrl+K** or **Cmd+K** to find a document. Use arrow keys and Enter in quick
open. The explorer supports arrow-key movement, left/right expansion, and Enter
to open a file. Normal browser **Ctrl/Cmd+F** searches the current document.

## Self-hosting and file access

The Node service and browser UI run on your machine. The server listens only on
`127.0.0.1`. There are no accounts, cloud storage, uploads, or external rendering
services. Scripts, styles, and math fonts are served locally. Remote images and
external links contained in a document still need their respective network
destinations.

The accessible root is the nearest enclosing Git repository, or the supplied
directory when no repository is found. `--root` overrides this. The explorer
initially focuses on `docs/` when appropriate, while links can reach other files
inside the root. Leading `/` in document links means the project root. Paths and
symlinks leaving that root are rejected.

The explorer hides dotfiles, dependency/build directories, symlinks, and ignored
files. It reads nested `.gitignore` files. Files hidden from the explorer are not
an access-control boundary: a supported direct link inside the root can still
open them.

To run on your own remote machine while retaining loopback-only access, start
the app there with `--no-open`, then forward the same port from your computer:

```bash
ssh -N -L 4173:127.0.0.1:4173 user@your-server
```

Open `http://127.0.0.1:4173` locally. Direct LAN/public binding and built-in
authentication are not implemented.

## Preferences

Viewer state is separate from project files. It stores theme, text size, expanded
folders, last document, and up to 200 reading positions in a JSON file keyed by
the canonical project root.

The default directory is `$XDG_STATE_HOME/halite`, or
`~/.local/state/halite`. Set `HALITE_STATE_DIR` to use another directory:

```bash
HALITE_STATE_DIR=/tmp/halite-state npm start -- /path/to/project
```

When upgrading from Markdown Viewer, Halite reads the project's old preferences
from the `markdown-viewer` state directory if no Halite preferences exist yet.
The next preference save writes them to `halite`, preserving the original file.
The old `MDVIEW_STATE_DIR` override is still supported; `HALITE_STATE_DIR` takes
precedence when both are set. When either variable is set, Halite reads and writes
only that directory.

The API provides no project write or command-execution endpoints. Task-list
checkboxes are disabled. Edit files in Neovim or your preferred editor; the
viewer follows those changes.

## Development and checks

For the desktop shell, first run `npm run build` and `npm run desktop:setup`,
then `npm run desktop`. The setup command downloads Electron's runtime.
`npm run test:desktop` verifies a built Linux archive in a temporary installation;
see [release instructions](docs/releasing.md) for its sandbox requirements.

```bash
# TypeScript server and Vite UI with development refresh.
npm run dev -- /path/to/project --no-open

# Unit/integration checks and the production build.
npm run check

# Browser checks against a temporary copy of the bundled fixtures.
npx playwright install chromium
npm run test:e2e
```

Browser checks use port 4187 and require a production build first. They cover
navigation, math, diagrams, images, source previews, reading positions, file
watching, and a narrow layout. They do not modify your real projects.

## Current limits

Markdown and text previews are limited to 2 MB; image assets to 30 MB. The reader
supports `.md` and `.markdown` in its index. Linked MDX files are shown as text;
JSX is never executed. Arbitrary embedded HTML is displayed as source. Invalid
diagrams or math show a local fallback. Math follows the supported KaTeX syntax.

Search currently covers names, paths, and titles. Full-text project search,
internal tabs, split panes, editing, and synchronization are
future work. Large code blocks and tables scroll horizontally. Extremely large
repositories may take longer to index because discovery and watching are local.

## Learn the implementation

- [Design and rationale](docs/design.md): the original requirements and tradeoffs.
- [Implementation walkthrough](docs/architecture.md): follow a command, request,
  document, and file-change notification through the code.
- [Validation record](docs/validation.md): what has been checked and what the
  results establish.
