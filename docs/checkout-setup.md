# Halite checkout setup packet

Prepared 2026-09-14. This is an unpublished setup draft for the proposed paid
1.x release. The 0.1.0 preview stays free. No merchant account, checkout, test
order, customer, or revenue exists yet.

## Owner setup

Create an account at [Lemon Squeezy](https://app.lemonsqueezy.com/register), using
an email you control. Keep passwords, identity documents, and payout details in
the provider's interface. A signed-in browser connection will let the remaining
product configuration be completed without sharing credentials in chat.

New stores start in test mode. Live selling requires the owner's business
questionnaire, identity verification, and store approval. Use the real business
and country details; a GitHub profile is not a substitute for those answers.
[Store activation](https://docs.lemonsqueezy.com/help/getting-started/activate-your-store).

Use **Halite — Markdown reader** as the public store identity if available.
The product website is <https://github.com/m-kim-dev/halite>.
Public technical support is <https://github.com/m-kim-dev/halite/issues>.
Add an owner-controlled private support email before taking payments; billing
details and refund requests do not belong in public GitHub issues.

## Product fields

| Field | Draft value |
| --- | --- |
| Name | Halite Desktop for Linux — 1.x |
| Pricing | Single payment, USD 19.00; no subscription |
| Variant | Linux x64 |
| Status | Draft while preparing; publish in test mode only for testing |
| License keys | Off; Halite has no activation requirement |
| Delivery | Hosted installer and checksum downloads |
| Updates | All 1.x versions, downloaded and installed manually |
| Support link | https://github.com/m-kim-dev/halite/issues |
| Installation link | https://github.com/m-kim-dev/halite/blob/main/docs/linux-preview.md |
| Source link | https://github.com/m-kim-dev/halite |

Select the appropriate software tax category in the dashboard and inspect how
tax is displayed before publishing a price claim. Upload the finalized 1.x
installer and checksum when ready; the free preview can exercise test-mode
configuration but must not be advertised as a finished 1.x build.
[Product setup](https://docs.lemonsqueezy.com/help/products/adding-products).

Ready media: [reader screenshot](images/halite-reader.png) and
[welcome screenshot](images/halite-welcome.png). Both show Halite's bundled
example rather than private documents.

## Checkout description

> A quiet place to read your project. Open existing Markdown files and folders,
> follow relative links, and read equations and Mermaid diagrams while you keep
> writing in your editor. Includes the Linux x64 desktop installer and all 1.x
> updates. No Node installation, subscription, or online activation is required.
> Updates are downloaded and installed manually. Halite's full source is public
> under MIT; your purchase supports convenient downloads and maintenance.

Before going live, add the actual supported distribution versions based on
desktop validation. Do not describe container checks as full desktop certification.
State current missing features clearly in the installation guide.

Draft support terms: community support through GitHub, with no guaranteed
response time or future-feature commitment. Draft refund offer for owner review:
request a refund within 14 days through the private support address, with the
order number. Publish the final contact and policy only after the owner chooses
them and the refund process has been exercised. This draft is not a live promise.

## Verification before public sales

1. Publish the product in **test mode**, open its hosted test checkout, and use
   the provider's documented test cards. Check success and declined-payment paths,
   the displayed price, order record, confirmation, and receipt.
2. **Test-mode downloads are disabled by Lemon Squeezy.** Record checkout testing
   and download-delivery testing separately; a test order cannot prove delivery.
   [Test mode](https://docs.lemonsqueezy.com/help/getting-started/test-mode).
3. After store approval and a finished 1.x build, copy the product to live mode
   and recheck every field and uploaded file. Do not publish its link yet.
4. Arrange an owner-approved live delivery check within the provider's rules.
   Verify the receipt's download, checksum, normal installation, and refund path.
   No real payment or refund has been authorized or attempted by this packet.
5. Test access after replacing a 1.x file for an existing purchaser. Keep 1.x
   delivery separate from any future paid major version so update entitlement
   stays accurate. [File versions](https://docs.lemonsqueezy.com/help/products/managing-file-versions).
6. Record the verified checkout URL and delivery/refund results, then add the
   purchase link to the README and release notes once the preview's usage
   criteria in [the revenue plan](monetization.md) are met.

Use the provider's hosted checkout and file delivery. This first offer needs no
payment backend, license server, webhooks, or billing code inside Halite.
