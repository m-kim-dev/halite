# Halite: design and learning notes

Recorded: 2026-09-14. The first reader is now implemented. This document retains
the initial design reasoning; see the [implementation walkthrough](architecture.md)
and [run guide](../../README.md) for the actual code and current behavior.

## Product direction

Build a local project documentation reader that opens from the terminal. Its
main job is to make an existing collection of Markdown easy to read and move
through. Files remain in their original directories.

The requested priorities are rendering quality, a file explorer, convenient
navigation across many documents, and read-only operation. The motivating
workflow is already in a project in a terminal or Neovim. Opening that project's
documentation should take one command, without registering a docs location.

The proposed first delivery is a command-line launcher, a small local file
service, and a browser interface. A desktop package can come later if opening
folders from the operating system becomes a frequent need. This is an initial
design choice; it does not assume a browser interface was explicitly requested.

## What the example project teaches us

A private example project was inspected without changing it. An
`rg --files` inventory found 215 Markdown files, including 208 under `docs/`.
These counts reflect the working copy and normal ripgrep ignore rules on the
date above. A lightweight syntax scan and representative file reads identified
the following requirements; this was not a renderer compatibility test.

| Observation | Consequence for the reader |
| --- | --- |
| Nested `user`, `dev`, `research`, and `contracts` directories | Preserve the hierarchy and let users narrow the explorer to a subtree. |
| 21 Mermaid fences across 12 documents | Diagram rendering belongs in the first usable version. |
| Table-like syntax in approximately 48 docs | Give tables enough room and their own horizontal scroll area. |
| Local image references in 7 docs, including PNG and SVG plots | Resolve image paths relative to the containing Markdown file. |
| Dollar-delimited math and a separate document using `\(...\)` and `\[...\]` | Support both dialects without requiring source edits. |
| Documents up to 1,847 lines | An outline, in-document find, and restored scroll position are essential. |
| Many `text` fences containing trees, layouts, and operational examples | Preserve monospace alignment and whitespace; avoid forced code wrapping. |
| Links to directories, other Markdown, Python, and JSON | Navigation needs file-type handling as well as Markdown parsing. |

Representative documents included architecture flowcharts and sequence diagrams,
research equations in filenames with spaces, tables, PNG and SVG plots, and links
to source/configuration files. Private project names and paths are omitted here.

**Learning point:** start from actual documents. Supporting a Markdown feature
on a library's feature list does not establish that existing project documents
will render correctly. Syntax dialects, relative paths, and layout all matter.

## Opening a project without setup

The following commands are available after building and running `npm link`.
The same arguments work with `npm start --` from this repository.

```bash
halite .
halite /path/to/project
halite /path/to/project/docs/README.md
```

With no argument, use the current directory. Discover the nearest enclosing Git
root when available; otherwise use the supplied directory, or the parent of a
supplied file. An explicit `--root` option should override this discovery.

Keep two concepts separate:

- **Project root:** the directory within which the viewer may resolve files.
- **Explorer focus:** the subtree emphasized in the sidebar, initially `docs/`
  when opening a repository containing it.

This allows a reader to concentrate on documentation while following a link from
`docs/dev/learning/` to `backend/src/`. Focusing on `docs/` should not silently
make those project links inaccessible.

An explicitly supplied file always opens first. For a directory, restore its
last reading location if available; otherwise show a README in the focused
directory, then the project README, then a file list. A missing saved document
falls back to the file list with a short explanation.

Starting the command opens a loopback URL in the default browser. Keep the
process attached to the terminal initially; Ctrl-C stops it. A `--no-open`
option can print the URL for manual use. Opening another project can initially
use a separate process and browser tab.

## Reading and navigation

Use three areas on a wide display:

```text
Back  Forward     my-project / docs / dev / architecture
+----------------------+----------------------------------+------------------+
| Find a file          | Codebase Visualization           | On this page     |
|                      |                                  |                  |
| docs/                | Readable prose                   | System context   |
|   user/              |                                  | Internal modules |
|   dev/               | Diagrams, tables, and code       | Feature flows    |
|     architecture/    |                                  | Data ownership   |
|     learning/        |                                  |                  |
|   research/          |                                  |                  |
+----------------------+----------------------------------+------------------+
```

The explorer and outline should be collapsible. On narrower windows, move the
outline into a popover and the explorer into a drawer. Start with approximately
75 characters per prose line, comfortable line spacing, and adjustable text
size. Let tables and diagrams expand within the reading pane. Include light and
dark themes, visible keyboard focus, and keyboard-operable tree controls.

| Action | Proposed behavior |
| --- | --- |
| Browse folders | Show Markdown and folders containing Markdown; skip dependency/build noise and respect ignore rules. |
| Find a file | `Ctrl/Cmd+K` opens fuzzy search across filenames, paths, and document titles. Show the path under every result. |
| Read a section | Select an outline heading; indicate the current section while scrolling. |
| Follow a document link | Open it in the reader and reveal the file in the explorer. |
| Follow a directory link | Open its README when present; otherwise show its document list. |
| Return to earlier reading | Back/forward restores the document, heading, and reading position. |
| Search this document | Preserve normal browser `Ctrl/Cmd+F` behavior. |
| Read a linked source/config file | Show a bounded, read-only text preview with its path. |
| Inspect a large diagram or plot | Provide an expanded view with zoom and a clear return action. |
| See an external edit | Refresh the changed document while preserving the nearest heading and offset where possible. |

Keep a single document pane initially. Browser history and quick switching
should establish whether internal tabs or split panes are needed. Preserve
normal modified-click behavior so a document can open in another browser tab.

Remember expanded folders, last document, theme, and reading positions under a
canonical project identity. Preferences belong in the viewer's own user data,
outside the project. A proposed stable local service origin would simplify
browser storage; until that is chosen, do not assume localStorage survives
launches on changing ports.

**Learning point:** an explorer answers “where is this file?” Quick search
answers “how do I get there quickly?” History answers “how do I return?” The
reader needs all three because they solve different navigation problems.

## Rendering quality

Use CommonMark plus GitHub-style tables, task lists, strikethrough, and
autolinks. Task checkboxes remain disabled. Give headings stable, unique anchors
and use the same heading identifiers for the outline and document links.

Render code with language highlighting, copy controls, and horizontal scrolling.
Unknown languages fall back to plain text. Preserve text diagrams exactly. Load
local PNG and SVG references through the file service, displaying SVG as an
image rather than inserting arbitrary source SVG into the application DOM.

Treat Mermaid as a separate block renderer. Offer an expanded view for complex
diagrams. If a diagram cannot parse, show the original fence and a local error
without losing the surrounding document. Mermaid provides strict security
settings and explicit rendering controls suitable for this integration.
[Mermaid usage documentation](https://mermaid.js.org/config/usage).

Math needs an explicit compatibility decision. `remark-math` and `rehype-katex`
provide a documented Markdown-to-math pipeline; KaTeX's separate auto-render
extension also documents backslash delimiters. These are distinct integration
paths. Do not assume enabling `remark-math` alone covers the example project's
`\(...\)` and `\[...\]` syntax.
[remark-math](https://github.com/remarkjs/remark-math),
[KaTeX auto-render](https://katex.org/docs/autorender).

For the proposed syntax-tree pipeline, recognize backslash-delimited math at
tokenization time, before normal Markdown escape handling. Exclude fenced code,
inline code, and link destinations. Avoid a global search-and-replace over the
document, which could corrupt code examples. Include currency values and escaped
dollar signs in compatibility checks. Unsupported equations retain readable
source and a local error.

Bundle rendering scripts, styles, and math fonts locally so project-local
content works offline. Loading external images, if present, still requires a
network connection. Arbitrary HTML and executable MDX are outside the initial
rendering contract; literal HTML examples inside code remain readable.

## Suggested implementation and why

Use TypeScript, React, and Vite for the interface, with a small Node.js service
for filesystem access. This keeps the initial implementation in one language
and allows the reader to start from an ordinary shell command.

A browser-only folder picker is possible, but `showDirectoryPicker()` still has
limited browser availability and requires explicit user interaction. The local
launcher is my recommendation because its directory argument fits the requested
terminal workflow. [MDN: showDirectoryPicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker).

| Part | Proposed tool or approach | Reason |
| --- | --- | --- |
| Markdown | `react-markdown` with `remark-gfm` | CommonMark rendering, GitHub-style extensions, and component overrides. |
| Code | Shiki | Language-aware highlighting with theme support. |
| Diagrams | Mermaid | Matches the existing diagram fences. |
| Math | `remark-math`, `rehype-katex`, and a scoped delimiter extension | Covers dollar math while making backslash support explicit. |
| File updates | Chokidar | Watches changes so external edits can refresh the reader. |
| File search | An in-memory filename/path/title index | A simple starting point for hundreds of documents. |
| Content search, later | A local in-memory text index | Add matching excerpts and section destinations after basic navigation works. |

The library capabilities above are documented by their maintainers:
[react-markdown](https://github.com/remarkjs/react-markdown),
[Shiki](https://shiki.style/guide/), and
[Chokidar](https://github.com/paulmillr/chokidar).

The core flow should be understandable without knowing those libraries:

```text
CLI path -> project root discovery -> local file service
                                         |
                     +-------------------+-------------------+
                     |                   |                   |
                 file index         document text         assets
                     |                   |                   |
              explorer/search     Markdown parser       image URLs
                                         |
                             headings, links, code, math
                                         |
                                React document view

External edit -> watcher -> invalidate affected content -> refresh view
```

The service owns discovery, path resolution, document reads, assets, and change
notifications. The interface owns selection, history, layout, and rendering.
Parse headings from Markdown structure so a `#` inside a code block does not
accidentally become an outline entry. Read document bodies on demand and avoid
rendering every document during initial indexing.

Relative links resolve from the current document directory. A leading `/`
means the selected project root, not the host filesystem root. Split URL query
and fragment components before resolving the path, and preserve percent-encoded
filenames correctly. Missing files, missing anchors, unsupported file types,
and links outside the root should each produce an understandable local result.

Read-only operation should be structural: expose no project write endpoints or
code execution. Bind the service to loopback, validate request host/origin, and
confine reads to the canonical project root, including after symlink resolution.
Use safe rendering defaults and validate custom link/asset handling; rendering
plugins can change the safety properties of the base renderer.
[react-markdown security guidance](https://github.com/remarkjs/react-markdown#security).

**Learning point:** parsing, rendering, and navigation are separate jobs. A
parser can identify a link perfectly while the application still opens the wrong
file. Keep those responsibilities separate so each is easy to reason about.

## Build order and acceptance scenarios

1. **Prove the rendering pipeline.** Open the diagram, math, table, and image
   examples above. Verify typography, overflow, both math dialects, and failure
   fallbacks in light and dark themes.
2. **Complete the first usable reader.** Add CLI opening, root discovery, the
   explorer, quick file search, breadcrumbs, outline, links, history, scroll
   restoration, and external-change refresh. Read-only linked text previews
   keep existing code and protocol links useful.
3. **Improve retrieval after using it.** Add full-text search with excerpts and
   recent projects. Decide on internal tabs, split views, or a desktop package
   from actual reading friction.

The first version is successful when these end-to-end scenarios work:

- Launch from the example repository with no setup and browse `docs/`.
- Open a specific file from the command line and reveal it in the explorer.
- Follow `docs/README.md` to a directory, then navigate back.
- Open the codebase visualization and inspect its largest diagrams.
- Render equations in both math example files without modifying either source.
- Open the research report and all four SVG plots through their relative paths.
- Follow the learning guide into a linked JSON or Python file inside the project.
- Search for a file among similarly named design documents and see its full path.
- Move between sections and documents, then return to the prior reading position.
- Save a change in Neovim and see it appear without the reader jumping to the top.
- Keep the application usable when a link, diagram, or formula is invalid.
- Reject out-of-root reads and executable content while preserving ordinary links.
- Leave the example repository unchanged throughout viewing.

Use small dedicated fixtures for duplicate headings, encoded filenames, invalid
syntax, and path confinement. The external example repository is useful for
manual compatibility checks, but automated checks should not require its private
contents or absolute location.

Defer editing, synchronization, a plugin system, graph navigation, and publishing.
The immediate learning goal is to understand how a reliable renderer and a small
set of navigation behaviors combine into an ergonomic project reader.
