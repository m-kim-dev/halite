# Halite: first revenue plan

Status: Linux desktop preview and MIT source published; tester recruitment
invitation posted in GitHub Discussions. No testers are confirmed at launch;
checkout, customers, and revenue are not active yet. Pricing below is a proposal.
Owner: [M. Kim / m-kim-dev](https://github.com/m-kim-dev).
Repository: [m-kim-dev/halite](https://github.com/m-kim-dev/halite).
Website: [Halite](https://halite-reader.pages.dev/).
Preview: [v0.2.0-preview.1](https://github.com/m-kim-dev/halite/releases/tag/v0.2.0-preview.1).
Recruitment: [Linux preview testers](https://github.com/m-kim-dev/halite/discussions/1).

## The offer

**Halite — a quiet place to read your project.**

Start with Linux developers and researchers who write Markdown in Neovim or
another editor and read documentation containing equations, diagrams, and links.
Sell the convenience of opening an existing project in a dedicated reader.
The free CLI already provides the core reading experience.

| Edition | Proposed price | What the user gets |
| --- | --- | --- |
| CLI / browser | Free | Local Markdown, math, Mermaid, navigation, themes, live refresh |
| Desktop preview | Free | Linux app, native file/folder picker, recent projects, project tabs/windows, document find, included example |
| Desktop 1.x | $19 once | Tested Linux installer, dedicated window, desktop conveniences, all 1.x updates |
| Optional support | Any amount | Support maintenance; no priority-support or feature promises |

Purchased versions should keep working without an account or activation server.
Later major upgrades can be optional purchases. The preview has no expiry or
payment enforcement. Before selling, make update entitlement and download
delivery match the promise on the checkout page.

The source policy is public MIT-licensed code, with payment for
convenient maintained downloads. Someone can build or redistribute the code;
willingness to support the project must carry the business. The owner selected
this model, and the full source is covered by the repository MIT license.

## Why someone might pay

There are close free alternatives. [Docview](https://github.com/simota/docview)
offers a local browser reader, and [Moremaid](https://github.com/thieso2/moremaid)
also serves local documents with diagrams. [md-viewer](https://github.com/aydiler/md-viewer)
targets native Linux reading. Halite must earn repeat use through rendering,
navigation, and easy installation. Markdown plus Mermaid alone is not a strong
paid offer. These comparisons come from project documentation, not hands-on
testing of the other apps.

## Validate before opening checkout

1. Sandboxed install, synthetic revision upgrade, and removal checks passed in
   Debian 12 and Ubuntu 24.04 containers. Validate real desktop installation with
   preview testers before asking anyone to pay.
2. Give the preview to ten relevant people with real documentation to read. The
   [GitHub Discussions invitation](https://github.com/m-kim-dev/halite/discussions/1)
   was published on 2026-09-14. Count people only after they respond; posting an
   invitation does not establish reach or recruitment success.
   The [first outreach draft and demo](outreach.md) are ready; publication outside
   Halite's repository awaits an appropriate signed-in account.
3. After a week, ask what they actually used and whether they returned without
   a reminder. Use the questions in the [preview guide](linux-preview.md).
4. Proceed toward paid v1 if at least three people use it on separate days and
   at least two would buy at $19. These are small decision rules, not statistical
   proof or forecasts. Fix the most repeated obstacle first.
5. Make the first five independent sales before expanding to another OS or
   adding services with recurring hosting/support costs.

Record anonymous tester IDs, distro/version, installation result, the task,
repeat use, the main blocker, and price response in a private note. Do not put
private project paths or feedback into a public repository. There is no analytics
SDK; validation can happen through conversations.

## Collecting money with little maintenance

Use a hosted digital-download checkout. Lemon Squeezy lists **5% + $0.50** per
transaction, no monthly ecommerce charge, and merchant-of-record sales-tax
handling; additional fees can apply. Verify eligibility and final fees during
setup. This does not cover the seller's own income-tax or business obligations.
[Pricing and features](https://www.lemonsqueezy.com/pricing).

At $19, the listed base fee leaves $17.55 per sale before extra fees, refunds,
taxes, and operating costs:

| Monthly sales | Gross | After listed base transaction fee |
| --- | ---: | ---: |
| 10 | $190 | $175.50 |
| 25 | $475 | $438.75 |
| 50 | $950 | $877.50 |

These are scenarios, not demand estimates. Avoid paid advertising initially.

If the source is public, GitHub Sponsors is an optional-support route. GitHub
states personal-account sponsorships have no GitHub fee; organization
sponsorships can carry fees. Eligibility/setup still needs to be completed.
[Sponsorships, fees, and taxes](https://docs.github.com/en/sponsors/sponsoring-open-source-contributors/about-sponsorships-fees-and-taxes).

## Before payment

- Public MIT source, Issues feedback form, and Discussions are available at
  `m-kim-dev/halite`.
- Container install/upgrade/removal checks passed with the sandbox enabled;
  real desktop feedback and ARM validation remain outstanding.
- Document find and project tabs/windows are included in 0.2.0. Consider file-manager opening if testers need it.
  Document tabs within a project and full-text project search remain later candidates.
- Checkout approval, finished download, and a test purchase that delivers it.
- Clear update entitlement, support expectations, refund policy, and tested
  refunds before taking real payments.

The Lemon Squeezy application is under review, with additional product
information requested. The public [marketing page](https://halite-reader.pages.dev/)
contains the demo, planned pricing, and developer verification links. The
[checkout setup packet](checkout-setup.md) contains the product fields, copy,
assets, and acceptance checks. Account creation, identity/business information,
and payout onboarding remain in the owner's Lemon Squeezy account; live selling
and fulfillment must be verified before opening checkout.

Do not promise automatic updates, macOS/Windows, cloud sync, or lifetime support.
Manual download-and-install updates are sufficient initially if stated clearly.
