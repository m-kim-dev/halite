# First outreach for Halite

Status, 2026-09-17: GitHub source, downloads, and tester invitation are public.
The post below is a draft. No Reddit post or private message has been sent.
No signed-in Reddit browser is connected.

The draft below targets the 0.3.0 preview with project tabs and Markdown source/copy controls.
Account setup and manual posting notes are kept locally.

Ready assets: [20-second MP4](../images/halite-demo.mp4) and
[embeddable GIF](../images/halite-demo.gif). Both record the actual packaged app
using its public example, with no private project content.

## First destination

Use **r/SideProject** for one introduction with the real app recording. Its
purpose is sharing side projects, although this broad audience may produce fewer
Linux testers than a specialist community. Check the account's posting access
and any rules shown in the submission form before posting.
[Community](https://www.reddit.com/r/SideProject/about/).

The public sidebar checked September 16 requests titles in the format
`Project name - Short description`. The fetched page was cached; check the
current rules and any account restrictions in the signed-in composer before
submitting. Current rules and posting eligibility still need verification in
the signed-in browser.
[Sidebar](https://old.reddit.com/r/SideProject/).

Other channels were checked rather than assuming promotional posts are welcome:

| Community | Current finding | Decision |
| --- | --- | --- |
| [r/neovim](https://www.reddit.com/r/neovim/) | Rule 7 prohibits advertising/promoting products and services. | Exclude from this outreach. |
| [r/linux](https://www.reddit.com/r/linux/) | Own content is limited to 10% of posts; participation is required and surveys are prohibited. | Consider a release introduction only if the owner's existing account meets the rules; no pricing survey. |
| [r/opensource](https://www.reddit.com/r/opensource/) | Limited promotion with the Promotional flair is allowed; AI-generated content is prohibited. | Exclude this AI-assisted post. |
| [Show HN](https://news.ycombinator.com/showhn.html) | A runnable project fits the format; the owner must be available to discuss it. [HN guidelines](https://news.ycombinator.com/newsguidelines.html) prohibit generated or AI-edited text. | Reserve for the owner's own submission and conversation. |

The other-community findings above were checked September 14. No moderator
approval or account eligibility has been established. Do not manufacture account
activity to qualify for posting.

## Post draft for r/SideProject

**Title:** Halite - a Linux Markdown reader for equations and diagrams

I'm the developer of Halite, an early Linux desktop reader for local
Markdown projects. Open an existing folder, follow relative links, and read
equations and Mermaid diagrams while continuing to write in your editor.

The short demo shows the included example, diagram expansion, quick open,
equations, a linked Python source file, and dark mode. Halite also refreshes
when files change and remembers recent projects and reading positions.

- [Source and demo](https://github.com/m-kim-dev/halite)
- [Free Linux x64 download](https://github.com/m-kim-dev/halite/releases/tag/v0.3.0-preview.1)

The `.deb` and portable archive include Electron, so no Node installation is
needed. Downloads are about 121 MiB. The `.deb` passed sandboxed installation
and workflow checks in Debian 12 and Ubuntu 24.04 containers; feedback from real
desktop sessions is the next step. Project tabs, optional separate windows,
desktop find, and Markdown source/copy controls are included. Full-text project
search and automatic updates are not available yet.

The full source is MIT-licensed. I'm considering $19 one-time downloads for the
finished desktop release to support packaging and maintenance; the current
preview is free and has no expiry or activation requirement.

If you read technical Markdown on Linux, I'd like to hear what works and what
gets in the way on a real project. Reply here or join the
[GitHub preview discussion](https://github.com/m-kim-dev/halite/discussions/1).

## Posting from the owner's browser

1. Sign in to the chosen account and open the
   [r/SideProject text-post composer](https://www.reddit.com/r/SideProject/submit?selftext=true).
2. Check the current community rules and any eligibility or flair requirements
   shown there. Do not bypass a posting restriction.
3. Copy the title and body from the draft above. Confirm the linked release is
   public before posting. The GitHub page includes
   the existing demo; a native-video upload is optional if the composer supports it.
4. Review the preview, including disclosure that the author develops Halite and
   that this version is free. Submit once, then save the public post URL so its
   responses can be followed. No submission has been made by preparing this file.

## Handling the first responses

Start with this one post and answer people where they reply. Count someone as a
tester when they confirm trying Halite, rather than counting views, upvotes, or
downloads as users. The first useful milestone is three real installation and
reading reports. The overall target remains ten preview testers.

After a participant has tried it over several days, ask whether they returned
and what they used it for. Pricing feedback belongs in that later conversation.
Follow up in their existing thread only when appropriate; do not send unsolicited
private messages. Record public aggregate results in the launch plan and keep
personal details outside the repository. No future follow-up has been scheduled.

## Reproduce the demo

After building the Linux desktop package, run `node scripts/record-demo.mjs` on
a graphical Linux session with Playwright's Chromium/FFmpeg runtime and system
`ffmpeg` installed. It records the real packaged application and public example
with isolated settings, then writes MP4, WebM, and GIF files to `test-results/demo/`.
It does not change source documents or the app's normal launch settings.

On the current Ubuntu 26.04 recording host, the portable sandbox requires the
explicit recording-only `HALITE_DEMO_NO_SANDBOX=1` override. This demo is not
additional sandbox validation; the published package's sandboxed container
checks are documented in [the validation record](../engineering/validation.md).
