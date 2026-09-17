# Neovim integration

The separately distributed [halite.nvim](https://github.com/m-kim-dev/halite.nvim)
plugin uses the Halite CLI. The plugin repository owns Lua commands, editor
configuration, help, and editor integration tests; this repository owns the
shared service, rendering, and installers.

Explicit commands use ordinary CLI opening: the current file or project opens
in a tab by default, and an explicit window request can override that preference.
Files remain read-only to Halite. Neovim saves trigger the existing watcher.

## Background navigation in 0.4.0

`halite /path/to/file.md --background` sends a private control-socket `navigate`
command without calling `ensureService`. It discovers the canonical project root,
requires an already-registered project with a connected workspace, selects its
tab, and sends the existing document activation event. It never creates a
session/workspace or requests browser/desktop focus. `--root` selects explicit
scope for projects originally opened with an override.

Missing services, unregistered projects, disconnected workspaces, and non-Markdown
targets fail with a nonzero exit status. The plugin pauses Follow and explains
how to reopen the project. The browser HTTP interface cannot issue this command
or introduce filesystem paths. No new port, background process, state format,
or HTTP endpoint is needed.

This is intentionally distinct from `--no-open`, which suppresses the browser
launcher but can start a service and register projects. Using that option for
automatic Follow could still create native desktop windows through workspace sync.

Old running services do not know `navigate`, so upgrading requires `halite stop`
and closing/reopening the desktop. Protocol version remains 1 because existing
commands stay compatible; the new command fails safely on older services.

Follow is opt-in and uses saved buffers only. Unsaved overlays and cursor/scroll
synchronization remain future extensions. Multiple editors share the same reader
state; the most recent navigation request wins.
