# Halite marketing site

Public URL: <https://halite-reader.pages.dev/>

Hosting: Cloudflare Pages, project `halite-reader`, production branch `main`.

## Design and content

The page gives prospective users and application reviewers one place to see the
working product, watch its demo, understand pricing, download the preview, and
contact its developer. It uses Halite's existing cobalt-blue cube identity,
large serif introductory type, restrained sans-serif body text, and actual
application screenshots. The dark demo section separates the product tour from
the rest of the page. Layouts stack on narrow screens.

The primary action downloads the free Linux x64 preview. The planned US$19
Desktop 1.x offer is explicitly unavailable for purchase. It includes all 1.x
updates, installed manually, with no subscription or online activation. Future
major upgrades are optional separate purchases. The CLI and current preview
remain free, and the complete source remains MIT licensed.

The page does not collect signups or payments. Planned digital delivery through
Lemon Squeezy is described in the FAQ. Do not turn on purchasing or promise
refund terms until the paid product and merchant fulfillment are ready.

Developer verification links point to the existing GitHub and linked Mastodon
profiles. The support email is the existing Halite business contact. No new
social profiles were created for the page.

## Source and build

- `marketing/public/index.html`: all product content and semantic page structure.
- `marketing/public/styles.css`: brand tokens, layouts, and responsive styles.
- `marketing/public/site.js`: optional video metadata loading on demo navigation.
- `marketing/public/_headers`: Cloudflare security and resource policy headers.
- `marketing/public/404.html`: a real not-found page; unknown paths are not an SPA.
- `marketing/config.json`: canonical public URL and deployment identifiers.
- `scripts/build-marketing.mjs`: produces the static `dist/marketing` directory.

Run from the repository root:

```bash
npm run build:marketing
python3 -m http.server 8788 --bind 127.0.0.1 --directory dist/marketing
```

Open <http://127.0.0.1:8788>. The build uses Node's standard library; it does not
bundle or run the Halite application and needs no additional npm dependencies.
There are no Pages Functions, backend processes, database, third-party fonts,
analytics scripts, or embedded external video players. Page navigation,
downloads, native video controls, and FAQ disclosures work without JavaScript.
Cloudflare still handles ordinary hosting requests and platform logging.

The build copies the two screenshots and MP4 from `docs/images`, and the icon
from `desktop/icon.svg`. Those remain the authoritative assets. Screenshots use
public examples. The 20-second silent demo shows core reading features and
predates project tabs; the separate 0.2.0 screenshot demonstrates those tabs.
A text description next to the video provides its visual sequence.

Only `dist/marketing` is uploaded. Repository files, private business notes,
desktop binaries, and local credentials are excluded from the site bundle.
Large installers remain on GitHub Releases. The build also generates a canonical
link, Open Graph URL, robots.txt, and sitemap.xml from `marketing/config.json`.

## Deployment

The project uses Cloudflare Pages Direct Upload. It was created once with:

```bash
npx --yes wrangler@4.124.0 pages project create halite-reader --production-branch main
```

Do not recreate the project for updates. With an existing Wrangler login and the
intended source committed on `main`, deploy from the repository root:

```bash
npm run build:marketing
npx --yes wrangler@4.124.0 pages deploy dist/marketing --project-name halite-reader --branch main
npx --yes wrangler@4.124.0 pages deployment list --project-name halite-reader
```

Wrangler 4.124.0 was used for the first deployment. Credentials stay in Wrangler's
local credential store, never in repository files. Deployments are manual; a
GitHub push by itself does not deploy this Direct Upload project. If automatic
deployments are needed later, use a scoped Cloudflare token in CI secrets and
run the same build and upload commands. Do not publish credentials in workflow
files. See Cloudflare's [Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/).

After publishing, verify the production URL anonymously, the response headers,
the `/assets/halite-demo.mp4` media response, navigation, pricing status, downloads,
and the not-found page. The stable URL is `https://halite-reader.pages.dev/`;
deployment-specific URLs are useful for inspecting a particular revision.

## Updating product information

When publishing a new application version, update the release number and GitHub
Release/installation links in `index.html`. Rebuild to pick up changed media.
If a custom domain is added, update `marketing/config.json`, README, package
homepage, checkout setup, and the application reply before deploying again.

Keep the demo directly downloadable for application reviews. Recheck the free
preview and planned paid offer together whenever pricing changes. Avoid claiming
that container checks certify all Linux desktops or that external document
images and links never contact the network.

## Validation

The local page was checked at 1440, 1024, 768, 390, and 320 CSS pixels, plus 200%
text enlargement. Navigation anchors, current release target, planned-sale
status, native FAQ disclosures without JavaScript, loaded screenshots, and
20-second MP4 playback passed. Desktop and mobile screenshots were inspected.
No browser console or page errors were reported.
