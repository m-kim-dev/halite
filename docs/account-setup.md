# Halite account setup — owner instructions

Updated September 15, 2026. Set up a separate Halite identity, sell from South
Korea, and use English copy with USD pricing for international customers.

Do these in order: **Halite inbox → Lemon Squeezy account and activation → Reddit
account while store approval is pending**. No paid domain or subscription is
needed for this setup.

## 1. Create a Halite inbox

1. Create a dedicated inbox or email alias with your preferred provider. Use a
   name based on `halite.reader` or `halite.markdown` if available. These are
   suggestions; no address or handle has been reserved.
2. Choose an address you are comfortable publishing as Halite's support contact.
   It must receive messages and let you reply to customers.
3. Send a test email to it and reply from it. Check the sender display name is
   **Halite**, rather than an unintended personal display name.
4. Save the password and recovery information in your password manager. Enable
   the provider's account protection options.

Use this inbox for the Halite Reddit and Lemon Squeezy accounts. A separate
browser profile named **Halite** can help avoid posting from your personal account.

This separates your Reddit posting history. The existing public GitHub repository
still credits [M. Kim / m-kim-dev](https://github.com/m-kim-dev/halite).

## 2. Create the Lemon Squeezy account and store

1. Open [Lemon Squeezy](https://www.lemonsqueezy.com/) and choose **Get started**.
2. Sign up with the Halite email address and a password you choose. Follow the
   confirmation email to verify the account.
3. Create a store. Use **Halite — Markdown reader** as its name, and try
   `halite-reader` or `halite-markdown` for its subdomain if available.
   [Official signup and store guide](https://docs.lemonsqueezy.com/guides/getting-started).

Use these values where the setup asks for them:

| Field | Enter |
| --- | --- |
| Public store name | Halite — Markdown reader |
| Website | `https://github.com/m-kim-dev/halite` |
| Public support email | Your new Halite inbox |
| Seller country | South Korea / Republic of Korea |
| Store currency | USD |
| Product type | Downloadable software |
| Intended customers | Developers and researchers worldwide who read technical Markdown |
| Legal owner / business details | Your real details, matching the documents requested |

Choose the individual/company option that matches your actual situation. Halite
is the product name; use your legal identity in fields asking for the account
owner or business entity. If a registration or tax field is unclear, save your
progress and send me the field's label and help text, without personal numbers.

Set **Settings → General → Currency** to **USD**. Set
**Design → Checkout → Language** to **English** for the initial storefront.
The store currency and bank payout currency are separate settings.
[Currencies](https://docs.lemonsqueezy.com/help/payments/currencies),
[checkout language](https://docs.lemonsqueezy.com/help/online-store/customization).

If asked for a short store description, use this factual draft:

> Halite is a desktop reader for local Markdown projects, equations, and Mermaid
> diagrams. I am preparing to sell convenient Linux desktop downloads to
> developers and researchers. The full source is available under the MIT license,
> and a free preview is already available on GitHub. Paid products will be
> delivered as downloadable software files.

Optional branding asset: [Halite icon](../desktop/icon.png).

## 3. Request store activation and set up payouts

New stores start in **test mode**. Email verification creates a usable account;
**store activation** is what permits live selling.

1. In the dashboard, choose **Activate your store**.
2. Complete the business/product questionnaire truthfully. Link the public
   repository and [existing Linux preview](https://github.com/m-kim-dev/halite/releases/tag/v0.1.0-preview.1)
   when asked for evidence of the product. Do not describe it as a stable 1.x release.
3. Complete the identity verification in the provider's interface. Supply the
   identification it requests there; the exact requirements can vary.
4. Submit the application and check the dashboard/email for further requests.
   The dedicated activation guide says approvals typically take 2–3 business
   days; this is an estimate, not a promised approval date.

[Activation requirements](https://docs.lemonsqueezy.com/help/getting-started/activate-your-store),
[identity verification](https://docs.lemonsqueezy.com/help/getting-started/verify-your-identity).

For payouts:

1. Open **Settings → Payouts** and choose the bank option if available.
2. Use **South Korea / Republic of Korea** and complete the provider's bank
   onboarding with your actual details. South Korea appears on the supported
   bank-payout list. This does not replace individual merchant approval.
3. If offered a settlement-currency choice, choose one your bank account accepts.
   USD pricing and bank settlement currency are separate; use your actual Korean
   bank details.
4. Confirm the payout method shows as connected or note any pending verification.

[Supported countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries),
[payout setup and timing](https://docs.lemonsqueezy.com/help/getting-started/getting-paid).

The published fee schedule lists 1% for bank payouts outside the US, compared
with 3% capped at $30 for PayPal payouts outside the US. Check the terms actually
shown for your account. If bank setup is unavailable, the provider also supports
a verified PayPal account where eligible.
[Payout fees](https://docs.lemonsqueezy.com/help/getting-started/fees).

Enable **Account Settings → Two-Factor Authentication** and keep its recovery
codes in your password manager.
[2FA instructions](https://docs.lemonsqueezy.com/help/getting-started/two-factor-authentication).

The product copy and checkout checks are already prepared in
[checkout setup](checkout-setup.md). You can hand the account back at this point;
you do not need to design the storefront or configure an API integration yourself.
If activation requires a product entry first, use that document for a test-mode
draft and label any uploaded 0.1.0 build as the free preview. Live paid delivery
still needs its own verification.

## 4. Create the separate Halite Reddit account

1. Open [Reddit signup](https://www.reddit.com/register/) in your Halite browser
   profile, or choose **Log In → Sign up** on Reddit.
2. Choose email signup, enter the Halite inbox, and complete the email verification.
3. Try `halite_reader`, `halite_markdown`, or `halite_app` as a username if
   available. Check it carefully before confirming: Reddit usernames cannot be
   changed after they are finalized.
4. Set a password, complete the remaining account prompts, and confirm you can
   sign in as the new account.
5. Set the public display name to **Halite** and use this short bio:

   > Building Halite, a local Markdown reader for Linux. MIT source on GitHub.

6. Add `https://github.com/m-kim-dev/halite` as the profile's project link where
   the profile editor allows it.

[Official Reddit signup instructions](https://support.reddithelp.com/hc/en-us/articles/360060420092-How-do-I-sign-up-for-a-Reddit-account).

The first introduction is already written in [the outreach document](outreach.md#post-draft-for-rsideproject).
We will use the new account for that post and replies. A new account may face
posting restrictions; report any actual message rather than trying to bypass it.
Keep your personal account out of voting on Halite's posts.
[Reddit guidance on multiple accounts](https://support.reddithelp.com/hc/en-us/articles/204535759-Is-it-ok-to-create-multiple-accounts).

## 5. Tell me what is ready

Reply in our conversation using this template. Do not fill private account
details into this repository file.

```text
Halite public support email:
Reddit username:
Reddit email verified: yes / no
Lemon Squeezy account email verified: yes / no
Store URL or subdomain:
Store status: test mode / activation submitted / approved / action requested
Payout method: bank / PayPal / not set up
Payout setup status: connected / verification pending / blocked
Anything the provider is asking me to resolve:
```

I need the public email, username, store URL and status—not passwords, login
codes, recovery codes, ID documents, bank numbers, or API keys.

Account creation does not automatically give me browser access. If a connected
browser is available in our session, sign in there yourself and tell me which
tabs are ready. Otherwise, send the checklist above and I will guide any remaining
dashboard steps while you operate the account. There is currently no signed-in
account browser available to me.
