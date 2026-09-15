# Halite validation record

## Unreleased 0.2.0 candidate — September 15, 2026

The standard 29 tests and production build passed. The new desktop find suite
passed against the installed 0.2.0 package in Debian 12 and Ubuntu 24.04.4 x64
containers, before and after a synthetic package revision upgrade. It covers
Ctrl+F through Electron input, result counts, next/previous wrapping, Enter/F3
shortcuts, case matching, clearing, Escape, document navigation, and renderer
isolation. The full reading/persistence workflow and package removal also passed.
Both container runs kept Chromium sandboxing enabled and used a non-root user.

Both local package checksums passed. The 0.2.0 portable archive workflow was
interrupted before execution and remains unverified. No 0.2.0 release has been
published. The six browser tests below are historical 0.1.0 results; this change
did not modify the shared browser UI. Native desktop dialogs, Wayland, and
real-user installation reports remain outstanding.

The find panel was visually inspected during source-app testing. Host-native
shortcut automation depended on window focus; the installed-package checks used
isolated virtual displays. Documentation changed after packaging, so rebuild
the candidate before publishing it to include the final installation guide.

## Previous 0.1.0 validation

Validated on 2026-09-14 with Node.js 24.16.0 and Chromium through Playwright.
The application's minimum declared Node version is 22.12.0; that minimum and
other operating systems/browser engines were not separately tested here.

## Automated checks

| Check | Result | What it covers |
| --- | --- | --- |
| Vitest | 29 passed | Math delimiters, currency, heading anchors, link resolution, search ranking, project discovery, ignore rules, file confinement, HTTP read-only behavior, preference migration/overrides, desktop trust boundaries, and installer collision/quoting behavior |
| TypeScript and Vite production build | Passed | Client/server type checking and bundled production assets |
| Playwright | 6 passed | Project navigation, quick open, encoded filenames, source highlighting, math, disabled tasks, image expansion, Mermaid, failure isolation, history, persistence, external edits, and narrow screens |
| Development command | Passed | Vite and the TypeScript service loaded the fixture reader without page errors |
| Halite CLI and branding | Passed | Matching package/lockfile command metadata, CLI help and error messages, and browser branding in light/dark themes |

Run the checks with:

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

The browser suite starts a service on port 4187 and works on a temporary copy of
the fixture project. Its external-edit test changes only that copy. The service
tests similarly use temporary directories. They verify that a PUT cannot change
a project document and that preferences are written outside the project.

The Halite rename was checked with the production build and all six browser
tests. Nine preference tests cover the new default directory, preservation of
legacy settings, precedence of current settings and directory overrides, and
project isolation. The header, sidebar, browser title, and desktop/mobile layouts
were also inspected; the branding smoke check reported no page JavaScript errors.

## Linux desktop preview

Built Linux x64 artifacts with Electron 44.3.0 on Ubuntu 26.04. The portable
archive and Debian package are approximately 121 MiB each and contain the MIT
license, upstream notices, and the bundled runtime. Both SHA-256 checksums pass.

The packaged desktop workflow check passed after extracting the archive to a
temporary directory, installing into a path containing spaces, and removing
the original extraction. It covered welcome/example loading, Mermaid, math,
source preview, the folder-picker callback, renderer IPC isolation, clipboard
permission boundaries, live edits, project switching, recent-project persistence
and clearing, restart, saved theme, and server cleanup. There were no page errors.
The [welcome screen](images/halite-welcome.png) and [reader](images/halite-reader.png)
were visually inspected. The browser suite also passed all six tests after the
shared crystal icon was added.

The portable archive workflow on this Ubuntu 26.04 host required the explicit
test-only `HALITE_TEST_NO_SANDBOX=1` override. The app and installed launchers do
not disable the sandbox. That archive check alone does not establish normal
installation compatibility.

The real `.deb` was then installed through apt into disposable containers:

| Environment (x64) | Install | Sandboxed desktop workflow | Synthetic revision upgrade | Removal / external state |
| --- | --- | --- | --- | --- |
| Debian 12 (bookworm) | Passed | Passed, before and after upgrade | Passed | Passed |
| Ubuntu 24.04.4 LTS | Passed | Passed, before and after upgrade | Passed | Passed |

The workflow ran as a non-root user. It asserted that `--no-sandbox` was absent,
renderer sandboxing was enabled, and the helper was root-owned with mode 4755.
Both runs covered the same reading, persistence, and isolation behavior above.
The upgrade used the same application payload with a higher Debian package
revision; compatibility with an older released application was not tested.

Docker execution used a virtual display, no host mounts or external networking,
and `SYS_ADMIN` to allow Chromium's helper to create nested namespaces. The
containers share the Ubuntu 26.04 host kernel. These checks establish package
and workflow behavior in those environments, not full desktop/VM certification.
Real native dialog interaction, Wayland, and distribution security policies
still need preview feedback. The GitHub CI workflow remains a template because
the connected OAuth credential lacks `workflow` scope; CI has not run on GitHub.

Testing found and fixed a distribution permission bug: Electron Packager's
0700 temporary root became root-owned after apt installation, preventing ordinary
users from launching the app. Packaging now normalizes directory permissions to
0755 before creating either artifact. The container checks exercise that boundary.

## Compatibility with the example project

Earlier compatibility checks indexed **214 Markdown files**, including **208 under
`docs/`**, in a private example project. All indexed files completed the parser
pipeline without errors. An initial ripgrep inventory counted 215; the viewer
excluded an ignored Markdown file. Names and paths are omitted for public docs.
This historical check was not repeated during desktop packaging.

Seven representative documents were opened in the production browser: a project
index, an architecture document with seven diagrams, a research document with
84 headings and 33 equations, an implementation document with four equations,
a report with a PNG, a plot collection with four SVGs, and a learning guide with
13 headings and a diagram. All diagrams and local images in that sample rendered.

There were no page JavaScript errors, math errors, missing-image fallbacks, or
diagram fallbacks in this seven-document pass. This establishes compatibility
with these samples, not complete visual validation of every indexed document.
No files in the example project were edited by this work.

The optional compatibility script can repeat the visual rendering checks against
an already running viewer:

```bash
node scripts/check-rendering.mjs http://127.0.0.1:4173 \
  docs/architecture.md docs/math.md
```

It prints rendering counts/errors and saves screenshots under
`test-results/compatibility/`. The normal Playwright suite clears its output
directory when it starts, so run the compatibility script afterward if you want
to retain those screenshots.

## What the checks taught us

Math compatibility required more than adding a renderer: multiline backslash
delimiters needed proper parser line-ending events, and financial amounts needed
single-dollar boundary rules. Both now have focused regression checks.

A longer real document revealed that progress updates could remount diagram
components while scrolling. Memoizing the Markdown view prevents unrelated
navigation-state updates from recreating rendered blocks. The browser suite now
checks that a diagram keeps its identity while scrolling.

Browser history and persisted per-file positions are tested separately. Reload
also restores the current reading position after scrolling beyond a URL's
original heading fragment.

## Limits of this validation

The browser suite checks behavior and representative layouts, including a
390-pixel-wide screen. It is not a full accessibility audit or a performance
benchmark for very large repositories. Remote/public hosting, authentication,
and collaboration are outside this local reader's current scope.
