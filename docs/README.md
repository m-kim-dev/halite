# Halite documentation

Start with the [project README](../README.md) to run Halite, or visit the
[product website](https://halite-reader.pages.dev/) for the demo and downloads.

## Using Halite

- [0.3.0 release notes](releases/0.3.0.md): Markdown source view and copying.
- [Linux preview guide](guides/linux-preview.md): installation, usage, limitations,
  and feedback.
- [0.2.0 release notes](releases/0.2.0.md): project tabs, shared CLI service, and
  downloadable packages.

## Engineering

- [Design and rationale](engineering/design.md)
- [Implementation walkthrough](engineering/architecture.md)
- [Multiple-project architecture](engineering/multiple-projects.md)
- [Markdown source and copying](engineering/markdown-source.md)
- [Validation record](engineering/validation.md)
- [Preparing a release](engineering/releasing.md)

## Business and checkout

- [Revenue and pricing plan](business/monetization.md)
- [Account setup](business/account-setup.md)
- [Checkout setup](business/checkout-setup.md)

Local application correspondence is saved under `business/lemonsqueezy/`, with
`reply.txt`, `reply.md`, and a README containing preparation notes. These local
email drafts are not part of the published repository. The reply is saved, not sent.

## Marketing

- [Website design, build, and deployment](marketing/site.md)
- [Reusable launch copy](marketing/launch-copy.md)
- [Outreach plan and demo recording](marketing/outreach.md)

## Where things belong

| Folder | Contents |
| --- | --- |
| `guides/` | Instructions for people using Halite |
| `engineering/` | Product design, architecture, validation, and release process |
| `releases/` | Notes for individual application versions |
| `business/` | Pricing, accounts, checkout, and application correspondence |
| `marketing/` | Website maintenance, launch copy, and outreach |
| `images/` | Shared screenshots, demo video, and animation |

Keep shared media in `images/`; its public URLs are already used in release and
application materials. The root-level [Linux guide link](linux-preview.md) and
[validation link](validation.md) are compatibility pointers for published URLs.
New documentation links should use the topic folders above. Links pinned to
published Git tags deliberately retain the paths that existed in those releases.

Keep credentials, payout details, private business tracking, and customer
information out of public documentation. Private tracking remains in the
Git-ignored `.local-business/` directory.
