# Multiple projects: design and behavior

Halite uses one background service per user state directory. CLI commands and
desktop windows connect to it; projects do not start their own HTTP listeners.
The service owns project discovery, indexes, watchers, and reading preferences.
Workspaces own tab order and the active project. A window displays a workspace.

Opening defaults to a tab. Users can choose windows as their saved default or
override the choice for one open. Reopening a canonical project activates its
existing tab. Moving a tab changes its workspace without restarting its project.
Each reader retains its document, navigation history, and scroll position while
switching tabs. Closing a tab releases its project after a grace period if no
workspace still uses it. Recent projects are paths, not running watchers.

The CLI starts the service on demand, sends its command over a private local
socket, and exits. A lock and a versioned handshake prevent competing starts.
`halite status` inspects the service and `halite stop` stops it. The service binds
one HTTP port on 127.0.0.1. Desktop and CLI share it when their state directory
matches. Browser or Electron renderer processes are additional to this backend.

HTTP reader routes include a project ID. All document, asset, preference, and
refresh requests resolve through that session's canonical root. The workspace
receives a single event stream and forwards refresh events to its readers, so
many tabs do not exhaust the browser's HTTP connection limit. Native IPC is
available only to the desktop workspace's top frame, never document frames.
Only the local control socket accepts new filesystem paths. The browser can
reopen previously registered recent projects, but cannot register arbitrary roots.

The workspace keeps inactive readers mounted. A moved reader remounts in its
destination and restores its saved document and position; its server-side index
and watcher are reused. Browser window creation and foreground activation depend
on the browser's popup and focus policies. Desktop windows are managed directly.

Validation must cover concurrent CLI startup, canonical-root deduplication,
project isolation, preferences and refresh isolation, tab and window operations,
failure recovery, last-view cleanup, native find, packaged operation, and restart.
Session restoration after a service restart is deferred; recents and preferences
persist. A service restart closes all live sessions and old URLs must be reopened.
