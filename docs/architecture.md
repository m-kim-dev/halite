# How Halite works

The application has two running parts: a Node.js process that reads your project
and a React interface in your browser. Both run locally. The project directory
is the document store; the viewer maintains a separate, small preferences file.

This walkthrough explains the first implementation. The [design notes](design.md)
explain why these behaviors were chosen, and the [README](../README.md) contains
the commands needed to run it.

## Desktop and CLI entry points

[server/cli.ts](../server/cli.ts) uses [client.ts](../server/client.ts) to find or
start a single background [daemon](../server/daemon.ts). Commands travel over a
private Unix socket. The daemon owns one loopback HTTP listener and the
[workspace registry](../server/workspaces.ts). Each canonical root has one
[project session](../server/session.ts): index, watcher, and preference store.
Opening the same root through a file or symlink activates its existing tab.

[desktop/main.cjs](../desktop/main.cjs) connects to this service using Electron's
bundled Node runtime. Each native window displays one workspace. The browser
uses the same [Workspace](../src/Workspace.tsx) component. Its project readers
are separate frames, retained while inactive. One workspace event stream carries
all project changes; the workspace forwards updates to the relevant reader.
Moving a tab preserves its project session and restores the reader's saved place.

The desktop preload bridge is restricted to its exact workspace URL and top
frame. Document frames receive no bridge or Node access. Native navigation is
restricted to the workspace and local project routes. Find controllers route
panel IPC by sender, so multiple windows do not overwrite one another's handlers.
Clipboard writes are allowed for local readers; clipboard reads and device
permissions are denied. Scripts in documents are never executed.

New filesystem paths enter through the CLI or native picker over the private
control socket. Browser HTTP commands can manipulate workspaces and reopen known
recents, but cannot supply new roots. Host/origin checks and canonical-root file
checks apply to every project. The local HTTP origin is shared; project IDs are
routing identifiers, not a substitute for the filesystem checks.

Service discovery uses a private runtime directory and a versioned handshake.
A startup lock prevents duplicate daemons; a dead owner's lock is recovered.
When Electron starts the detached service, inherited descriptors are explicitly
replaced so Chromium sockets cannot keep the former desktop process alive.
The service persists until `halite stop`. Closed projects and disconnected
browser workspaces have a grace period before cleanup. Settings and recents live
in `workspace-settings.json` beside per-project preferences. Previous desktop
recents are imported when there are no new workspace settings.

See [the multiple-project design](multiple-projects.md) for lifecycle choices and
limitations. The production package bundles the daemon and CLI as well as the UI;
readers need no separate Node installation.

## Follow one document from disk to screen

```mermaid
flowchart LR
    CLI[CLI argument] --> Root[Discover project root]
    Root --> Service[Node HTTP service]
    Files[Project files] --> Service
    Service --> Index[File metadata]
    Service --> Text[Document text]
    Index --> Explorer[Explorer and quick open]
    Text --> Parser[Markdown syntax tree]
    Parser --> React[React document view]
    Parser --> Outline[Heading outline]
```

Start with [server/cli.ts](../server/cli.ts). It parses the path and options,
connects to the service, sends an open request, and exits. Development mode still
runs an isolated reader in the foreground and handles Ctrl-C. The
compiled entry point includes a shebang, so npm can expose it as `halite`.

[server/project.ts](../server/project.ts) resolves the path to its canonical
filesystem location. A containing `.git` marker identifies a project; otherwise
the supplied directory becomes the root. Every subsequent request uses this
same boundary.

The index contains path, title, and size. The first level-one heading supplies
the title when available. The scanner reads Markdown to collect titles; the
browser receives bodies only for opened files. The interface reconstructs the
folder hierarchy from the paths.

**Try it:** open a file under `docs/dev/`. Its ancestor folders expand, while a
relative link can still reach a source file elsewhere inside the repository.
The root and the sidebar's focus serve different purposes.

## The small HTTP API

[server/app.ts](../server/app.ts) uses Node's built-in HTTP server. During
development it delegates UI requests to Vite. After a build, it serves
`dist/client` itself. Production does not need a separate Vite process.

| Endpoint | Responsibility |
| --- | --- |
| `GET /api/projects/:id/bootstrap` | Project identity, initial selection, index, and preferences |
| `GET /api/projects/:id/files` | Updated Markdown metadata |
| `GET /api/projects/:id/document?path=…` | Markdown, supported text, or a folder listing |
| `GET /api/projects/:id/asset?path=…` | Supported image assets |
| `GET /api/projects/:id/events` | A persistent stream of file-change notifications |
| `POST /api/projects/:id/preferences` | Viewer state stored outside the project |

The workspace uses `GET /api/workspaces/:id`, a matching `/events` stream, and
validated POST actions. The old unprefixed project endpoints remain available
only for isolated development readers and regression fixtures.

The document endpoint opens a directory's README when present; otherwise it
lists immediate Markdown files and subdirectories. Missing or unsupported files
produce an HTTP status and a readable message.

The server validates local host/origin headers and checks path confinement both
before and after symlink resolution. There is no project write endpoint. The
preferences endpoint accepts only a bounded set of viewer fields. See
[server/preferences.ts](../server/preferences.ts) for validation, serialized
writes, and atomic replacement of the JSON file.

**Learning point:** read-only behavior is easier to maintain when the backend
has no project-writing operation. Removing an edit button alone would not
establish that property.

## Parsing and rendering are different steps

The Markdown pipeline uses `react-markdown` and unified/remark. Parsing produces
a syntax tree: headings, paragraphs, links, code, and math have separate node
types. React components turn those nodes into the reading UI.

[src/lib/markdown.ts](../src/lib/markdown.ts) supplies shared heading logic and
the math compatibility extension. Heading anchors and the outline use the same
slugging algorithm, including suffixes for duplicate headings. A heading-looking
line inside a code fence never enters the outline.

`remark-gfm` supplies GitHub-style tables, task lists, and related syntax.
`remark-math` handles dollar math, and `rehype-katex` renders equations. The added
micromark construct recognizes `\(...\)` and `\[...\]` before CommonMark treats
their backslashes as escapes. As a text construct it leaves code fences, inline
code, and link destinations to their normal parsing rules. Multiline tokens
emit line-ending events so the parser retains correct positions across lines.

Single-dollar boundaries cannot contain leading/trailing whitespace or close
immediately before a digit. This preserves financial prose such as
`$10,000 long and $5,000 short` while still rendering `$2+2$` and `$t+1$`.
Ambiguous currency can use escaped dollar signs.

[src/components/Markdown.tsx](../src/components/Markdown.tsx) owns block rendering:

- Shiki uses its JavaScript regex engine, loads languages on demand, and caches
  recent results. This works with the production policy against dynamic code
  evaluation.
- Mermaid uses strict settings. Rendering is serialized because the library has
  shared configuration. Every diagram owns its error/source fallback.
- Local image URLs resolve relative to the current document. SVG files are
  displayed as images with a restrictive response policy.
- Code and diagrams begin expensive rendering near the viewport.
- A React error boundary falls back to original Markdown if rendering fails.

KaTeX fonts are bundled locally. Raw document HTML is escaped, MDX is not
executed, and custom links allow only local paths and supported external URLs.

**Try it:** compare the math fixtures with their source. Backslash-delimited
equations render, while those same delimiters inside code remain literal. This
is why a global string replacement would be unreliable.

## Navigation preserves context

[src/lib/navigation.ts](../src/lib/navigation.ts) resolves links into a local
path/fragment, an external URL, or a blocked link with an explanation. The viewer
URL stores the project path in a query parameter so spaces and nested folders
remain unambiguous.

[src/App.tsx](../src/App.tsx) coordinates requests, history, the outline, and
reading positions. Requests have abort signals so an earlier response cannot
overwrite a newer selection.

A reading position contains a scroll offset and, when available, the nearest
heading plus the offset from it. The heading-relative position helps preserve
context when an edit changes earlier content. A short resize observer corrects
restoration while diagrams and images load; user scrolling stops corrections.

Browser history stores a position per navigation entry. Preferences store a
position per file. These solve different problems: returning to a particular
visit versus reopening a file later. Reload uses the current history position
so an old URL fragment does not pull you back to an earlier section.

[server/preferences.ts](../server/preferences.ts) keys each preferences file by
the canonical project root. Halite uses its own user state directory and reads
the former `markdown-viewer` file when no Halite file exists. The next save
retains those settings in the new directory without changing the original.
Explicit state directories take precedence; see [Preferences](../README.md#preferences)
for the environment variables and their precedence.

The [explorer](../src/components/Explorer.tsx) follows the project hierarchy.
[Quick open](../src/components/QuickOpen.tsx) searches filenames, paths, and
titles, ranking exact names before broader and fuzzy matches. A native modal
dialog provides focus handling and Escape behavior. Full-text search is future
work.

## An edit in Neovim reaches the browser

```mermaid
sequenceDiagram
    participant Editor as Neovim
    participant Disk as Project files
    participant Watcher as Chokidar
    participant Service as Local service
    participant Reader as Browser
    Editor->>Disk: Save document
    Disk-->>Watcher: File changed
    Watcher->>Service: Debounced change paths
    Service-->>Reader: Server-sent event
    Reader->>Service: Read updated document and index
    Service-->>Reader: Current content
    Reader->>Reader: Restore reading position
```

Server-sent events are one-way notifications. The browser does not need to poll;
ordinary HTTP requests fetch the changed content. Debouncing groups rapid
editor writes, and write-finish handling avoids reading during an incomplete
save. If the service becomes unavailable, the browser reports that it is
reconnecting.

## Files to read in order

1. [shared/types.ts](../shared/types.ts): server/UI data contracts.
2. [server/cli.ts](../server/cli.ts): starting the application.
3. [server/project.ts](../server/project.ts): discovery and bounded reads.
4. [server/app.ts](../server/app.ts): endpoints and change notifications.
5. [src/App.tsx](../src/App.tsx): selection, history, and layout.
6. [src/lib/markdown.ts](../src/lib/markdown.ts): syntax and heading extensions.
7. [src/components/Markdown.tsx](../src/components/Markdown.tsx): rendering blocks.
8. [tests](../tests/): behavioral checks and independent examples.

Styles live in `src/styles.css` and `src/reader.css`: interface tokens/layout in
the first, document typography in the second. This first version uses regular
CSS with scoped class conventions rather than CSS Modules. The separation keeps
document styling understandable without adding another component framework.
