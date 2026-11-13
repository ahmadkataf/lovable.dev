# Country check: Kuwait

Checked on 2026-11-13 directly against Google's live pages for a developer account in **Kuwait**:

| Question | Answer | Source |
|---|---|---|
| Google Play developer registration | Supported (✔) | https://support.google.com/googleplay/android-developer/answer/9306917?hl=en — table row "Kuwait ✔ ✔ USD" |
| Google Play merchant registration (paid apps, in-app purchases) | Supported (✔) | same row |
| Default payout currency for Play | USD | same row |
| How Play pays merchants in Kuwait | "Merchants in Kuwait receive payments via wire transfer from the United States. Payouts will arrive in US Dollars." | https://support.google.com/paymentscenter/answer/7161440?hl=en |
| Play minimum payout for USD wire | US$100 (see money.md) | https://support.google.com/googleplay/android-developer/answer/… (cited in money.md) |
| AdMob country restrictions | Kuwait is not on the restricted list | https://support.google.com/admob/answer/6163675?hl=en |
| AdMob/AdSense payment methods for Kuwait | Wire transfer available (table row "Kuwait: check Yes, EFT No, wire Yes, SEPA No") | https://support.google.com/adsense/answer/1714397?hl=en |
| AdMob wire instructions | Country-specific block for KW exists | https://support.google.com/admob/answer/3372975?hl=en |
| US income-tax treaty | Kuwait is not on the IRS treaty list (see ads.md) — so no treaty rate on any US-source withholding | IRS list cited in ads.md |

Consequences for the publishing and earnings guide:
- Nothing blocks publishing, selling in-app purchases, or earning from ads with a Kuwait account.
- The bank account must be in Kuwait and able to receive USD wire transfers; a USD-denominated account is preferred.
  Receiving-bank fees on international wires can be US$0–50 or more, so small monthly balances are best left to accumulate.
- The Syria findings in billing.md / ads.md / money.md apply to *players* in Syria (who most likely cannot buy), not to this developer account.

## Account notes for the guides
- The developer account predates 13 November 2023, so the closed-testing requirement (12 testers for 14 days,
  which applies only to personal accounts created after that date) does not apply; an internal test first is
  still recommended.
- A payments (merchant) profile is required before in-app products can be created; check it in Play Console.
- AdMob: a new app entry (App ID) plus one Rewarded and one Interstitial ad unit are needed for the `ads` build;
  the owner has deferred this until after the first release.
