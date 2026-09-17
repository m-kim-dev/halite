# Changelog

## 0.2.0 — project tabs and a shared local service

- Open projects in tabs by default, or choose separate windows. Move tabs between
  windows, search recent projects, and save the preferred opening mode.
- Share one backend process and one loopback port between CLI commands and desktop
  windows. Commands exit after opening; use `halite status` and `halite stop`.
- Include a `halite` CLI launcher in Linux packages, using the bundled runtime.
- Keep per-project indexes, watchers, preferences, and file boundaries separate.
- Preserve readers while switching tabs and restore their place when moving.
- Find text in the desktop reader with Ctrl+F or Edit → Find in Document.
- Show match counts; move forward/back with buttons, Enter/Shift+Enter, or
  F3/Shift+F3; optionally match case; close with Escape.
- Clear find results when opening another document or returning to Welcome.
- Keep document content separate from the find panel's privileged controls.

This release remains a free preview. Checkout and real-desktop feedback are
still pending. Session restoration after a service restart and Windows shared-service
support are not implemented. Stop the service before upgrading or uninstalling.

## 0.1.0 — Linux desktop preview

- Open local Markdown projects in a dedicated desktop window or a browser.
- Native folder/file picker, recent projects, and a built-in example.
- Git-aware file explorer, quick open, outline, and reading history.
- Mermaid diagrams, KaTeX equations, source previews, and image zoom.
- Live refresh, light/dark themes, and saved reading positions.
- Debian/Ubuntu package and portable Linux x64 archive.
- MIT-licensed source. The preview is free; a $19 desktop offering is planned.

This is an early preview. There is no checkout, automatic updater, in-document
desktop find bar, or file-manager association yet.
