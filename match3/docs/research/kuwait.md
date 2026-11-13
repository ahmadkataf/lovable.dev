# Country check: Kuwait (the owner's Google Play account country)

The owner stated on 2026-11-13 that their Google Play developer account is in **Kuwait**.
Checked the same day directly against Google's live pages:

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

## Owner's account status (stated by the owner on 2026-11-13)
- The owner already has an active Google Play developer account in Kuwait with published apps.
  So registration, the US$25 fee and identity verification are already done.
- Still to confirm with the owner (affects the guide, not the build):
  - Whether the account is a personal account created after 13 November 2023. If so, every new app must first
    complete a closed test (12 testers opted in for 14 continuous days) before production access; older personal
    accounts and organisation accounts are exempt. Play Console shows this on the new app's dashboard.
  - Whether a payments (merchant) profile is already set up. The existing apps are free and sell activation codes
    outside the store, so it may not be; it is required before in-app products can be created.
  - Whether an AdMob account exists (needed for the ad unit ids of the `ads` build).
