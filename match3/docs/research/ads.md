# Research: ads

_Read from primary sources on 2026-11-13 and re-checked by an independent second pass._

## Summary

Re-checked on 2026-11-13 against Google's live pages and Google Maven.

Syria, from Google's own lists:
(a) Play developer registration: NOT LISTED (214-row table, no Syria).
(b) Play merchant / payments profile: NOT LISTED (same table; no Syria bank block in the payments centre).
(c) AdMob: not on the restricted-countries list (removed August 2025), but absent from every payment-method list, so sign-up and payout from a Syrian address: COULD NOT VERIFY.
The only legitimate routes remain a real residence, a real registered company, or a genuine publisher in a merchant-supported country. The profile country is permanent and false details breach the DDA.

Confirmed: US$25 fee; 12 testers for 14 days; Play fee 15% on the first US$1M after enrolment, and 10% + 5% billing fee in EEA/UK/US/Australia/Japan; Play payout around the 15th (US$1 local, US$100 wire); AdMob pays around the 21st at US$100 after identity, PIN and tax steps. Billing 9.1.0, UMP 4.0.0, play-services-ads 25.5.0 and ads-mobile-sdk 1.6.0 exist as stable releases, and the API names match the docs.

Corrected:
- The 1 December 2026 Japan deadline comes from the 29 October 2026 policy announcement; the payments page only says "the deadline stated in your invitation".
- Fee rollout: Korea, Türkiye and South Africa on 31 December 2026; rest of world 30 September 2027.
- Wire/EFT arrival times and the "not responsible for webview content" quote are not on the cited pages; dropped.
- AdMob's 45-day identity window and the frequency-cap example are on other pages than cited.
- Candy Crush prices were not verified; dropped.

Added:
- Legacy ads SDK v25 is deprecated 30 June 2027 and sunset 30 June 2028, so a new app should start on the Next-Gen SDK.
- Vietnam withholds 5% from foreign developers.
- Trader declaration starts November 2026.
- Package-name registration is required before submission.

## Facts

- **Syria: Google Play DEVELOPER registration** — NOT LISTED. The table 'Supported locations for developer and merchant registration' has 214 rows and no Syria (string absent from the page HTML). Iran, Cuba and North Korea are also absent. Sudan, South Sudan, Afghanistan, Iraq and Morocco are listed as developer-only (no merchant).  
  Source: https://support.google.com/googleplay/android-developer/answer/9306917?hl=en (verified-primary-source)
- **Syria: Google Play MERCHANT registration / payments profile (needed for coins and remove-ads)** — NOT LISTED on the same table. Nearby locations with both developer and merchant support: Türkiye (TRY), Jordan (USD), Lebanon (LBP, paid in USD or EUR), Egypt (EGP, paid in USD or EUR), UAE (AED, paid in USD or EUR), Saudi Arabia (SAR, paid in USD or EUR), Palestine, Kuwait, Qatar, Oman, Bahrain, Tunisia, Algeria, Libya, Yemen (all USD), Germany (EUR). Iraq and Morocco: developer yes, merchant no.  
  Source: https://support.google.com/googleplay/android-developer/answer/9306917?hl=en (verified-primary-source)
- **Syria: Google payments centre bank-account instructions** — NOT LISTED. The 'Enter merchant bank account information' page carries per-country bank blocks for about 100 country codes (including JO, LB, EG, TR, AE, SA, KW, QA, OM, TN, YE) and none for SY or IQ.  
  Source: https://support.google.com/paymentscenter/answer/7161440?hl=en (verified-primary-source)
- **Syria: AdMob country restrictions** — Not on the restricted list. AdMob is unavailable only in Crimea, Cuba, so-called DNR and LNR, Iran and North Korea. Change log: 'In August 2025, the Understanding AdMob country restrictions page will be updated to reflect the removal of Syria from the US Office of Foreign Asset Control sanctions list.' AdMob publishes no positive list of supported countries.  
  Source: https://support.google.com/admob/answer/6163675?hl=en (verified-primary-source)
- **Syria: AdMob/AdSense payout methods** — NOT LISTED, so sign-up and payout from a Syrian address COULD NOT BE VERIFIED. Google's 'What payment options are available in your country?' table (AdSense and YouTube payment accounts) lists Iraq, Jordan, Lebanon, Yemen, Egypt, Turkey, UAE, Libya, Tunisia but has no Syria row. The AdMob wire-transfer page has country blocks for about 130 codes (IQ, JO, LB, EG, PS, YE, LY) and none for SY. The EFT list (Jordan, Morocco, Tunisia, Turkey, UAE) has no Syria.  
  Source: https://support.google.com/adsense/answer/1714397?hl=en (verified-primary-source)
- **Syria: Google Play for users (downloads and purchases)** — COULD NOT VERIFY from Google. The developer-side page links to play.google.com/supported-locations, whose table is loaded by script and could not be read. A search summary of Syrian press (Enab Baladi, 18 January 2026; Erem News) reports the Play Store became reachable in Syria without VPN as Google restores services gradually; both articles returned HTTP 403 and were not opened. Nothing found on paid purchases for Syrian users.  
  Source: https://play.google.com/supported-locations?hl=en (unverified)
- **Play Console registration fee and eligibility** — US$25 one-time, by Mastercard, Visa, Amex, Discover (US only) or Visa Electron (outside US); 'Google Play does not accept prepaid cards.' Must be 18+. 'you may be asked for a valid government ID and a credit card, both under your legal name. If this information is determined to be invalid, your registration fee will not be refunded.'  
  Source: https://support.google.com/googleplay/android-developer/answer/6112435?hl=en (verified-primary-source)
- **Personal vs organisation account** — Both 'can monetize on Google Play using a payments profile'. Personal: 'student, hobbyist, or amateur developer'. Organisation requires a D-U-N-S number and is mandatory only for financial, health, VPN and government apps. A match-3 game may use a personal account. D-U-N-S is free and 'can take up to 30 days'.  
  Source: https://support.google.com/googleplay/android-developer/answer/13634885?hl=en (verified-primary-source)
- **Testing requirement for new personal accounts** — Personal accounts created after November 13, 2023 'must run a closed test for their app with a minimum of 12 testers who have been opted in continuously for at least 14 days', then apply for production access by answering questions. Personal accounts must also verify an Android device with the Play Console mobile app.  
  Source: https://support.google.com/googleplay/android-developer/answer/14151465?hl=en (verified-primary-source)
- **Information required and shown publicly (personal account)** — 'Google will display your legal name, your country (as per your legal address), and developer email address on Google Play. If you decide to monetize on Google Play then Google will display your full address.' Legal name and address come from the linked Google payments profile and must be verified before publishing. Contact email and phone are verified by one-time password. To receive payments you configure a payments profile 'which can either be the same one you used to create your developer account or a different one'.  
  Source: https://support.google.com/googleplay/android-developer/answer/13628312?hl=en (verified-primary-source)
- **Payments profile country is fixed; address must be real** — 'Provide your legal business address as it appears on official documents... We don't allow you to use a PO box address. Later, you'll need to make sure that your bank account is registered in the same country listed in your payments profile.' 'You can't change your business location country'.  
  Source: https://support.google.com/googleplay/android-developer/answer/7161426?hl=en (verified-primary-source)
- **DDA accuracy and sanctions clauses (effective September 15, 2025)** — 2.1: You 'will provide and maintain complete and accurate information in the Play Console'. 11.4: all information 'will be current, true, accurate, supportable and complete.' 10.3: Google may terminate immediately if 'You have breached any provision of this Agreement'. 16.5: 'YOU AGREE TO COMPLY WITH, AND NOT CAUSE GOOGLE TO VIOLATE, ALL EXPORT CONTROL AND SANCTIONS LAWS'.  
  Source: https://play.google/developer-distribution-agreement.html (verified-primary-source)
- **Play Console Requirements policy (account info, account trading, package names)** — You must 'Accurately provide your developer account information' including legal name and address, payment methods and the linked Google payment profile. Before submitting you must upload the privacy policy, fill out Data safety, and '3.4. Register your app package names via Play Console to comply with Android developer verification requirements.' Prohibited: 'Buying, leasing, and selling accounts obtained through illegitimate means on third-party marketplaces'.  
  Source: https://support.google.com/googleplay/android-developer/answer/10788890?hl=en (verified-primary-source)
- **Play service fee in markets not yet on the new structure (includes the Middle East until 30 September 2027)** — 'Developers enrolled in the 15% service fee tier: 15% for the first $1M (USD) revenue earned by the developer each year; 30% for earnings in excess of $1M'. Subscriptions 15%.  
  Source: https://support.google.com/googleplay/android-developer/answer/112622?hl=en (verified-primary-source)
- **New Play fee structure for buyers in Australia, EEA, Japan, UK, US** — Rollout June 30, 2026 (EEA, UK, US) and September 30, 2026 (Australia, Japan). First $1M of annual earnings: 10% + 5% billing fee. Standard above that: subscriptions 10% + 5%; other transactions 20% + 5% (new installs) and 25% + 5% (existing installs) or 20% for external web links. In Play Games Level Up / Apps Experience programs: 15% + 5% new, 20% + 5% existing. Billing fee applies when the purchase uses Google Play Billing.  
  Source: https://support.google.com/googleplay/android-developer/answer/112622?hl=en (verified-primary-source)
- **Fee rollout timeline (corrected)** — Help Center table: June 30, 2026 EEA, UK, US; September 30, 2026 AU, JP; December 31, 2026 KR, TR, ZA; September 30, 2027 Rest of World. The 4 March 2026 blog had listed 'By December 31: Korea and Japan'; Japan was moved earlier. The page does not say whether the first-$1M rate needs enrolment.  
  Source: https://support.google.com/googleplay/android-developer/answer/16954621?hl=en (verified-primary-source)
- **2026 fee announcement** — Blog of 04 March 2026 'A new era for choice and openness': billing fee separated from service fee (5% in EEA, UK, US); in-app purchase service fee 20% for new installs; subscriptions 10%; 'By September 30, 2027: The updates will reach the rest of the world.'  
  Source: https://android-developers.googleblog.com/2026/03/a-new-era-for-choice-and-openness.html (verified-primary-source)
- **Enrolment in the 15% tier** — Still documented: have a payments profile, create an Account Group (even for one account) on the Associated developer accounts page, accept the 15% tier Terms. 'For developers who complete enrollment after July 1, 2021 the 15% was applied starting from the date when enrollment was completed.' Earnings counted per calendar year.  
  Source: https://support.google.com/googleplay/android-developer/answer/10632485?hl=en (verified-primary-source)
- **Play payout schedule and minimum** — Orders from the 1st to month end 'will get paid out around the 15th of the following month'. Minimum balance: 'Merchants who receive local-currency payouts: US$1; Merchants who receive USD wire-transfer payouts: US$100'. No deposits on weekends or banking holidays. Buyers have two hours to cancel a purchase.  
  Source: https://support.google.com/googleplay/android-developer/answer/137997?hl=en (verified-primary-source)
- **Play wire-transfer payouts** — Wire locations include Jordan, Lebanon, Egypt, UAE, Saudi Arabia, Kuwait, Qatar, Oman, Bahrain, Tunisia, Algeria, Libya, Yemen. Paid in USD; a USD account 'is preferred'. Receiving-bank fees 'may range from US$0 to US$50 or more'. Türkiye is not on the wire list (payments centre shows a Turkish IBAN form, i.e. local bank transfer).  
  Source: https://support.google.com/googleplay/android-developer/answer/2700656?hl=en (verified-primary-source)
- **Play bank account requirements (corrected)** — Account must be 'Able to receive Electronic Funds Transfer (EFT) / Wire Transfer', 'In the same country or region where the merchant account is registered', 'Denominated in country's currency (EFT) or USD (Wire transfer)'. The earlier claim of '5 to 7 business days for wire, 2 to 3 for EFT' is NOT on this page and is dropped.  
  Source: https://support.google.com/paymentscenter/answer/7161440?hl=en (verified-primary-source)
- **Play payment-method verification (source corrected)** — 'Depending on your location, you will have to complete a deposit challenge or upload official bank documents to verify your payment method.' 'Verification can take up to 5 days'. This text is on the Play Console 'Required information' page, not the payments-centre page.  
  Source: https://support.google.com/googleplay/android-developer/answer/13628312?hl=en (verified-primary-source)
- **Merchant identity verification** — 'To receive payments from Google, you must complete the identity verification.' If not: 'You won't get future payouts. We may close your profile.' Documents may include government ID and proof of address; review 'typically takes 2–3 business days' once documents are received.  
  Source: https://support.google.com/paymentscenter/answer/7159033?hl=en (verified-primary-source)
- **Japan payment-collection authorisation: the 1 December 2026 deadline (source corrected)** — Policy announcement of October 29, 2026: 'If you sell into or out of Japan, you must complete authorization by December 1st, 2026, or your payments will be held globally.' The same announcement: 'Starting in November 2026, you must declare your trader status in Play Console'.  
  Source: https://support.google.com/googleplay/android-developer/answer/18100766?hl=en (verified-primary-source)
- **Japan authorisation: what the payments-centre guide says** — PSA authorisation applies to developers outside Japan selling to users in Japan; deadline is 'the deadline stated in your invitation', otherwise 'a global hold on all your earnings across all regions'. ISA disclosure: 'New developers: Your global payouts will be blocked the moment you earn money from a buyer in Japan for the first time if you haven't completed the disclosure.' Individuals confirm name and address and answer two yes/no legal-history questions.  
  Source: https://support.google.com/paymentscenter/answer/17595997?hl=en (verified-primary-source)
- **Consumption taxes Google remits itself on Play Billing purchases** — EU: Google charges and remits VAT; 'Even if you're not located in the EU, this VAT treatment still applies.' For developers located outside the country Google also remits in Australia (10% GST), Japan, South Korea (10%), Saudi Arabia (15%), Russia (20%), Bahrain, Egypt, India, Indonesia (11%) and others. Exceptions where the developer stays responsible: Switzerland, and Colombia for developers outside Colombia.  
  Source: https://support.google.com/googleplay/android-developer/answer/138000?hl=en (verified-primary-source)
- **Service fee and taxes** — DDA 3.4: the Service Fee 'will be calculated and charged on the sales price. The Service Fee is exclusive of Transaction Taxes'. Working rule (interpretation, not a quoted formula): proceeds ≈ price ÷ (1 + tax rate) × (1 − fee) where prices include tax.  
  Source: https://play.google/developer-distribution-agreement.html (verified-primary-source)
- **US tax form for non-US Play merchants** — 'You must submit the Certificate of Foreign Status form (W-8BEN) to the United States Internal Revenue Service (IRS)', completed inside the payments profile (Play Console > Payments profile > tax info). Year-end form for non-US developers: 1042-S.  
  Source: https://support.google.com/googleplay/android-developer/answer/7163598?hl=en (verified-primary-source)
- **US withholding rules for non-US payees** — 'only the portion of your revenue earned from US users is subject to US withholding taxes and reporting.' 'If a valid tax form isn't provided, Google may apply backup withholding at 24% or chapter 3 withholding at 30% on applicable payments. This rate may only be reduced if you're a tax resident of a country or region that has an income treaty with the US'. Forms refresh every 3 years. Income types: 'Other Copyright Royalties (such as YouTube Partner Program, Cloud Marketplace - Reseller Model and Play Pass)' vs 'Services or other business income (such as AdSense...)'.  
  Source: https://support.google.com/paymentscenter/answer/10349995?hl=en (verified-primary-source)
- **Google Play named under royalties on the YouTube tax page** — 'Other Copyright Royalties (such as YouTube Partner Program and Google Play)'. No Play-specific withholding rate is published; the actual rate appears in the payments profile after the W-8BEN.  
  Source: https://support.google.com/youtube/answer/10391362?hl=en (verified-primary-source)
- **US income tax treaties for likely countries** — IRS list (reviewed 03-Jan-2026) includes Turkey, Egypt, Germany, Morocco, Tunisia. Syria, Lebanon, Jordan, Iraq, UAE, Saudi Arabia, Kuwait, Qatar are not on it.  
  Source: https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z (verified-primary-source)
- **Local withholding taxes deducted from Play proceeds** — Brazil: IRRF and CIDE deducted if paid in non-BRL currency, plus 10% for tax residents of listed tax havens (list includes Lebanon and UAE). Taiwan: 3% without a Taiwan tax ID. Vietnam: 5% of gross sales to Vietnam users for developers outside Vietnam (missed earlier). Carrier billing: up to 20% Egypt, up to 5% Kuwait, up to 10% Sri Lanka, up to 2.5% Myanmar.  
  Source: https://support.google.com/googleplay/android-developer/answer/9384608?hl=en (verified-primary-source)
- **US withholding on AdMob earnings** — 'We rarely withhold United States federal tax from AdMob payments. However, we may be required to withhold up to 30%'. A foreign publisher with no US Activities: 'no tax forms are required.' The page is old (cites 2012); follow the tax tool in the account.  
  Source: https://support.google.com/admob/answer/4381375?hl=en (verified-primary-source)
- **AdMob payment thresholds (USD)** — Tax information $0; verification $0 (identity) / $10 (address); payment method $10; payment $100; cancellation $10. 'all thresholds are based on your payment history page rather than estimated earnings.'  
  Source: https://support.google.com/admob/answer/2772208?hl=en (verified-primary-source)
- **AdMob payment schedule** — Monthly. Earnings finalised by the 3rd; payment changes and hold removals 'on or before the 20th'; payment issued 'on or around the 21st'; EFT arrives 'up to seven business days after'. Balances under threshold roll over. 'Checks are only available in countries where EFT is not yet available.'  
  Source: https://support.google.com/admob/answer/2772140?hl=en (verified-primary-source)
- **AdMob identity verification (source corrected)** — Government-issued photo ID, possibly a video selfie. 'You'll have 45 days from the date we first ask you to verify your identity... After 45 days, if you haven't completed the verification process, we'll stop showing ads'. PIN is not sent until identity is verified.  
  Source: https://support.google.com/admob/answer/13030080?hl=en (verified-primary-source)
- **AdMob address (PIN) verification** — A 6-digit PIN is sent 'through international standard mail' with no tracking once earnings reach the verification threshold. 'It usually takes 3 weeks'. '4 months from the date your PIN is generated' or ads stop. 'You can request up to 3 additional replacement PINs.'  
  Source: https://support.google.com/admob/answer/2772302?hl=en (verified-primary-source)
- **AdMob forms of payment** — 'Depending on your payment address, the following forms of payment may be available to you: checks, electronic funds transfer (EFT), wire transfer, and EFT via Single Euro Payments Area (SEPA).' A method cannot be selected until payable earnings reach the threshold. Wire is sent 'in U.S. dollars or Euros' (wire page, answer/3372975).  
  Source: https://support.google.com/admob/answer/2772229?hl=en (verified-primary-source)
- **AdMob app readiness review** — A new app 'must be reviewed and approved before it can fully serve ads'. It must be published, listed in a supported store and linked in AdMob. 'Reviews typically take 2-3 days'; limited ad serving meanwhile. New accounts stay in 'Getting Ready' 'until your account is verified. Enter your payment details'.  
  Source: https://support.google.com/admob/answer/10564477?hl=en (verified-primary-source)
- **app-ads.txt** — 'The app store listing must include a developer website'; AdMob crawls the domain of that URL for app-ads.txt.  
  Source: https://support.google.com/admob/answer/9363762?hl=en (verified-primary-source)
- **AdMob interstitial rules** — 'You should place no more than one interstitial ad after every two user actions within your app.' No interstitials on app load or exit, none immediately after another, only 'at logical breaks in between your app's content (e.g. pages, stages, or levels)'; preload in advance.  
  Source: https://support.google.com/admob/answer/6201362?hl=en (verified-primary-source)
- **AdMob frequency capping (source corrected)** — Caps can be set per app or per ad unit; 'For example, you can set a frequency cap to show no more than 2 impressions per 30 minutes.' Changes can take up to 24 hours.  
  Source: https://support.google.com/admob/answer/6244508?hl=en (verified-primary-source)
- **AdMob maximum ad content rating (added)** — Ratings G, PG, T, MA are cumulative and can be set per account or per app under Blocking controls. Use it so ads match the game's content rating, which Play's Ads policy requires.  
  Source: https://support.google.com/admob/answer/7562142?hl=en (verified-primary-source)
- **Google Play Ads policy on full-screen ads** — Not allowed: full-screen interstitials 'that show unexpectedly'; 'Ads that appear during game play at the beginning of a level'; interstitials 'not closeable after 15 seconds'; ads 'triggered by the home button' or on exit; interstitials after consecutive user actions ('Made for Ads'). 'This policy does not apply to rewarded ads which are explicitly opted-in by users'. Ads 'must be appropriate for the content rating of your app'.  
  Source: https://support.google.com/googleplay/android-developer/answer/9857753?hl=en (verified-primary-source)
- **AdMob rewarded-ad policies** — 'clear, accurate and conspicuous disclosure of the action(s) required and reward(s) offered prior to each instance'. Served only after the user 'affirmatively and unambiguously opts in'; skipping 'must not impede or interfere with the normal usage'. No steering text such as 'watch this ad to support our business'. 'Publishers must deliver the promised reward(s)'. Rewards must be in-app and non-transferable; 'Direct monetary items may not be offered'. Random rewards need the chance disclosed.  
  Source: https://support.google.com/admob/answer/7313578?hl=en (verified-primary-source)
- **AdMob ads beside a WebView (replaces an unverifiable quote)** — 'AdMob and Ad Manager in-app ads may be shown in an app next to a WebView as long as the Google Mobile Ads SDK is in use and the publisher is compliant with all other relevant program policies'. 'content in the WebView is subject to the same content policy requirement as when it is in a browser.' The earlier quote 'is not responsible for webview content' was not found.  
  Source: https://support.google.com/admob/answer/48182?hl=en (verified-primary-source)
- **Google Play Payments policy for coins and remove-ads** — In-app purchases of 'virtual currencies, extra lives, additional playtime' and 'an ad-free version of an app' must use Google Play's billing system. 'In-app virtual currencies must only be used within the app or game title for which they were purchased.' 'In-app pricing must match the pricing displayed in the user-facing Play billing interface.' Randomised paid items 'must clearly disclose the odds'. Apps may not lead users to other payment methods, including via 'In-app webviews, buttons, links'.  
  Source: https://support.google.com/googleplay/android-developer/answer/9858738?hl=en (verified-primary-source)
- **Customer support obligation** — DDA 4.7: 'For Your paid Products or in-app transactions, You agree to respond to customer support inquiries within 3 business days, and within 24 hours to any support or Product concerns stated to be urgent by Google.'  
  Source: https://play.google/developer-distribution-agreement.html (verified-primary-source)
- **Refunds handled by Google at the developer's cost** — DDA 3.8: 'You authorize Google to give users refunds in accordance with the Google Play refund policies... and You agree that Google may deduct the amount of those refunds from payments to You.' User policy: within 48 hours Google may refund; after 48 hours the user contacts the developer. The earlier EEA/UK 'faulty' sentence was not on the page as served and is dropped.  
  Source: https://support.google.com/googleplay/answer/15574908?hl=en (verified-primary-source)
- **Developer's own refund duties** — 'you're also responsible for setting your own policies for refunds... You must issue refunds in accordance with your policy.' Refunds are issued from Play apps order management; a partial refund returns the same percentage of payout and service fee.  
  Source: https://support.google.com/googleplay/android-developer/answer/2741495?hl=en (verified-primary-source)
- **Trader status declaration** — 'all active developer accounts must declare whether they are a trader or non-trader... by February 1, 2027, regardless of where apps are targeted'; 'All new developer accounts are required to submit the declaration immediately upon account creation.' Trader indicator: remuneration from 'paid apps, in-app purchases, ad-sponsored apps'. Traders self-certify and give a terms-of-service link per app. 'If you use a personal developer account, you must provide a contact phone number to be displayed on Google Play. Be aware that your address will also be publicly displayed.' 'If you don't distribute apps in the European Economic Area or the United Kingdom, you can declare as a non-trader.' Misrepresentation breaches DDA 11.4.  
  Source: https://support.google.com/googleplay/android-developer/answer/17594752?hl=en (verified-primary-source)
- **Listing changes from March 1, 2027** — For traders, users everywhere see contact details (phone and address for individual accounts), D-U-N-S if any, and the terms-of-service link. In the EEA and UK the developer name 'will replace Google in the "Offered by" field' as Play moves to an online marketplace model.  
  Source: https://support.google.com/googleplay/android-developer/answer/17594752?hl=en (verified-primary-source)
- **Privacy policy: Google Play requirements** — Link in Play Console and link or text in the app. Must include developer information and a privacy contact, data accessed/collected/used/shared, retention and deletion policy, be labelled 'privacy policy', name the developer or app, and be on 'an active, publicly accessible and non-geofenced URL (no PDFs) and is non-editable'. 'Apps that do not access any personal and sensitive user data must still submit a privacy policy.'  
  Source: https://support.google.com/googleplay/android-developer/answer/10144311?hl=en (verified-primary-source)
- **Privacy policy: Google publisher (AdMob) policies** — Publishers must 'have and abide by a privacy policy that clearly discloses any data collection, sharing, and usage that takes place as a consequence of your use of Google products and services, including... IP addresses, or other identifiers'. A prominent link to 'How Google uses data when you use our partners' sites or apps' satisfies the Google part.  
  Source: https://support.google.com/publisherpolicies/answer/10437486?hl=en (verified-primary-source)
- **Data the ads SDK collects (for the Data safety form)** — Collected and shared automatically: IP address, user product interactions, diagnostic information, device and account identifiers (advertising ID, app set ID). Purposes: advertising, analytics, fraud prevention. Encrypted in transit (TLS). Page covers legacy SDK 25.5.0; a Next-Gen version of the page exists and was not read.  
  Source: https://developers.google.com/admob/android/privacy/play-data-disclosure (verified-primary-source)
- **Consent requirement for EEA, UK, Switzerland** — AdMob publishers 'are required to use a consent management platform (CMP) that has been certified by Google and integrates with the IAB's Transparency and Consent Framework (TCF) when serving personalized ads' (EEA and UK since 16 January 2024, Switzerland since 31 July 2024). Non-certified traffic 'may be eligible for non-personalized ads or limited ads'.  
  Source: https://support.google.com/admob/answer/13554116?hl=en (verified-primary-source)
- **UMP consent SDK obligations** — com.google.android.ump:user-messaging-platform:4.0.0. Create the message in AdMob > Privacy & messaging. 'Requesting an update to consent information should be called on every app launch.' 'canRequestAds() always returns false until you have called requestConsentInfoUpdate()'. If getPrivacyOptionsRequirementStatus() is REQUIRED, offer an entry that calls showPrivacyOptionsForm(). With the Next-Gen SDK the app ID is still needed in AndroidManifest.xml for UMP ('you must provide the app ID in two locations').  
  Source: https://developers.google.com/admob/android/privacy (verified-primary-source)
- **US state privacy (restricted data processing)** — 'When an RDP signal is present, AdMob will not serve ads that are based on a user's prior behavior'. Enable through a CMP sending GPP signals (Privacy & messaging > US states regulations) or per request. The SharedPreferences int key gad_rdp = 1 is documented for the legacy SDK (developers.google.com/admob/android/privacy/us-states); Next-Gen equivalent not checked.  
  Source: https://support.google.com/admob/answer/9561022?hl=en (verified-primary-source)
- **Target audience and children** — Target audience must be declared before publishing. 'if you choose to include imagery and terminology in your app that could be considered targeting children, this may impact Google Play's assessment'. Misrepresentation 'may result in removal or suspension'. If children are a target audience: only Families Self-Certified Ads SDKs, no interest-based ads, no advertising ID from children, COPPA and GDPR compliance.  
  Source: https://support.google.com/googleplay/android-developer/answer/9893335?hl=en (verified-primary-source)
- **EU guidance on in-game virtual currencies (CPC Network, 21 March 2025)** — Seven principles: real-money price shown for currency and for items priced in currency; no obscuring of cost; no forcing of unwanted currency purchases; clear pre-contractual information; 14-day right of withdrawal including unused currency; fair terms; respect for vulnerable players. It 'does therefore by no means bind the national authorities or the European Commission'.  
  Source: https://commission.europa.eu/document/download/8af13e88-6540-436c-b137-9853e7fe866a_en (verified-primary-source)
- **Play Billing Library versions and deadlines** — Google Maven lists billing and billing-ktx up to 9.1.0 (stable; released 2026-06-18). Deadlines: v7 new apps/updates until August 31, 2026 (extension November 1, 2026, now past); v8 until August 31, 2027; v9 until August 31, 2028. 8.1.0 raised minSdkVersion to 23; 9.0.0 set targetSdkVersion 35.  
  Source: https://developer.android.com/google/play/billing/deprecation-faq (verified-primary-source)
- **Billing API names in 9.1.0 (checked in integrate guide, release notes and reference)** — enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()), enableAutoServiceReconnection(), startConnection(BillingClientStateListener), queryProductDetailsAsync returning QueryProductDetailsResult (productDetailsList, unfetchedProductList), launchBillingFlow(activity, params) on the main thread, queryPurchasesAsync(QueryPurchasesParams, listener), consumeAsync / ktx consumePurchase, acknowledgePurchase, OneTimePurchaseOfferDetails.getFormattedPrice(). Removed in 8.0.0: querySkuDetailsAsync, queryPurchaseHistory, no-argument enablePendingPurchases().  
  Source: https://developer.android.com/google/play/billing/release-notes (verified-primary-source)
- **Purchases must be acknowledged or consumed within three days** — Acknowledgement 'must be done within three days so that the purchase isn't automatically refunded and entitlement revoked'. Client-only apps: consumeAsync() for consumables, acknowledgePurchase() for non-consumables. 'Only grant entitlement when the purchase transitions from PENDING to PURCHASED.' Call queryPurchasesAsync on connection/foreground. A secure backend is recommended, not required.  
  Source: https://developer.android.com/google/play/billing/integrate (verified-primary-source)
- **Ads SDK versions on Google Maven** — play-services-ads 25.5.0 (legacy; banner: 'Google Mobile Ads SDK is in maintenance mode. For the latest updates and features, migrate and set up GMA Next-Gen SDK'). GMA Next-Gen SDK ads-mobile-sdk 1.6.0 (stable 1.x since 1.0.0). UMP 4.0.0. Both ads SDKs require minSdk 24 and compileSdk 35; Next-Gen needs Kotlin 1.9+.  
  Source: https://developers.google.com/admob/android/quick-start (verified-primary-source)
- **Legacy ads SDK lifecycle (added)** — v25.x.x: released February 17, 2026; deprecation June 30, 2027; sunset June 30, 2028; migration guide 'Migrate to GMA Next-Gen SDK'. After sunset 'ad traffic from that version is at risk of receiving automatic no fill'.  
  Source: https://developers.google.com/admob/android/deprecation (verified-primary-source)
- **GMA Next-Gen SDK API (added)** — MobileAds.initialize(context, InitializationConfig.Builder(appId).build()) must run on a background thread. RewardedAd.load(AdRequest.Builder(adUnitId).build(), AdLoadCallback<RewardedAd>); show(activity, OnUserEarnedRewardListener); events via RewardedAdEventCallback. InterstitialAd.load(AdRequest.Builder(adUnitId).build(), AdLoadCallback<InterstitialAd>); show(activity). Test units: rewarded ca-app-pub-3940256099942544/5224354917, interstitial ca-app-pub-3940256099942544/1033173712. 'If you don't use the test ad unit ID, Google can suspend your account.' Preloader APIs are marked beta.  
  Source: https://developers.google.com/admob/android/next-gen/rewarded/single-load (verified-primary-source)
- **Google AdMob rewarded-ads playbook (guidance, not a rule)** — 'Users are 20-40% more likely to opt in to rewarded ads versus other ad formats.' 'Well-performing ads should have over 50% of Daily Active Users engaging, and an 80% completion rate.' 'The rewards you offer should not be so valuable that they hurt your in-app purchases (IAPs).' Suggested spots: home page, end of session, after losing a round, in the store.  
  Source: https://admob.google.com/home/resources/rewarded-ads-playbook/ (verified-primary-source)
- **Price ladder of a leading match-3 game (industry reference)** — Royal Match, US App Store: $0.99, $1.99 (Mini Coin Package), $2.99, $5.99, $6.99, $9.99, $19.99 (Queen's Treasure), Royal Pass $9.99. Candy Crush figures from the earlier findings were not re-verified and are dropped.  
  Source: https://apps.apple.com/us/app/royal-match/id1482155847 (secondary-source)
- **Coin ladder and remove-ads price in a casual puzzle game (industry snapshot, checked 2026-04-03)** — Puzzledom: Remove Ads $2.99; 120 coins $0.99; Starter Pack $1.99; 660 coins $4.99; 1440 coins $9.99; 3120 coins $19.99 (about 121 coins per dollar at the bottom, 156 at the top, +29%). Other remove-ads prices quoted earlier ($4.99, $5.99) were not re-verified.  
  Source: https://apppricinglab.com/iap/apple/1261300725 (secondary-source)
- **Coins per dollar and price of a continue (industry reference, 13 October 2017)** — Homescapes: coins 'come in bundles ranging from $0.99 for 1,000 to $99.99 for 150,000'. 'One Life costs 900 Coins, which is around $0.90'. The article implies, but does not state, that five extra moves also cost 900.  
  Source: https://www.pocketgamer.biz/how-does-homescapes-monetise/ (secondary-source)
- **Out-of-moves 'fail offers' (industry guidance, AppMagic, 18 March 2026)** — Color Block Jam: $4.99 fail offer 'more than 20%' of IAP revenue and about 27% of first purchases, second to the $1.99 coin pack at 'around 40%'. Pixel Flow: $5.99 fail offer 'around 33%'. Screwdom: $4.99 offer about 14.5%.  
  Source: https://appmagic.rocks/blog/fail-offers (secondary-source)
- **Rewarded placements in match-3 (industry guidance, Unity, 27 July 2021)** — Extra moves after failing ('Typically we see 3 to 5 moves'), extra life, start-of-level bonus, double or triple the end-of-level reward, daily bonus, free currency in the store. 'if you offer 5 moves for $1.99 in the store, give up to 3 as a reward for watching your ads'; cap uses per session.  
  Source: https://unity.com/blog/rewarded-video-monetization-lessons-from-meta-match-3-games (secondary-source)
- **Interstitial grace period and payer exclusion (industry guidance, ironSource, 7 March 2021)** — Casual, midcore, hardcore: 'we recommend waiting at least two weeks before showing interstitial ads'. Showing the first ad 'from Level 3 to Level 8' beat Level 1. 'serving interstitials to paying users isn't worth the incremental revenue uplift'. A/B tests: 'around 2 weeks is usually enough'.  
  Source: https://unity.com/blog/best-practices-for-maximizing-revenue-from-interstitial-ads-in-your-app (secondary-source)
- **Share of players who pay (industry guidance, Unity, 7 May 2025)** — 'only 1-3% of daily active users engage in IAPs'. Unity 'recommends first implementing rewarded ads before looking to include system-initiated ads.'  
  Source: https://unity.com/blog/iap-to-hybrid-monetization (secondary-source)
- **Revenue per daily active user (industry benchmark, October 2026)** — GameAnalytics, global mobile games with at least 10,000 monthly users: ARPDAU P25 $0.0012, median $0.0106, P75 $0.0729, P95 $0.69. Revenue per paying user median $10.93. Retention medians: day 1 20.78%, day 7 3.80%, day 30 0.87%. Not split by genre.  
  Source: https://www.gameanalytics.com/benchmarks-hub (secondary-source)
- **ARPDAU ranges by game type (directional)** — Hypercasual $0.01 to $0.05; casual (ad-heavy) $0.02 to $0.10; mid-core $0.10 to $0.50. 'directional reference points, not hard rules'.  
  Source: https://tenjin.com/glossary/average-revenue-per-daily-active-user-arpdau/ (secondary-source)

## Action items

- STEP 0, BEFORE ANYTHING ELSE: settle the country question. Syria is NOT LISTED for Google Play developer registration or merchant registration, and no Syrian payout route is documented for AdMob. Legitimate routes: (a) the developer's own real legal residence in a merchant-supported country, with matching ID, address and bank account there; (b) a genuinely registered company there (organisation account, D-U-N-S, company bank account); (c) a real publisher or partner resident there who owns the account, is the merchant and trader, and pays a contractual revenue share (common practice, not from a Google page). Do not use a false address, VPN, borrowed identity, or a bought or rented account: it breaches DDA 2.1 and 11.4 and Play's account policy, and the payments-profile country can never be changed.
- STEP 0b: check where the developer's existing Play Console account (the school-curriculum apps) is registered. If its payments profile is in a developer-only location (for example Iraq or Morocco) or cannot become a merchant, in-app products cannot be sold from it.
- REQUIRED BEFORE FIRST RELEASE: verified Play Console account (US$25, government ID, contact email and phone verified by one-time password; personal accounts also verify an Android device in the Play Console app).
- REQUIRED BEFORE FIRST RELEASE (personal accounts created after 13 November 2023): closed test with at least 12 testers opted in continuously for 14 days, then apply for production access.
- REQUIRED BEFORE FIRST RELEASE: trader status declaration (new accounts declare at creation; existing accounts by 1 February 2027), at account level and per app. A game with purchases and ads meets Google's profit-seeking indicator, so expect 'trader': provide a terms-of-service link, and accept that a personal account's phone number and address are shown publicly.
- REQUIRED BEFORE FIRST RELEASE: register the app's package name in Play Console (Android developer verification, Play Console Requirements 3.4).
- REQUIRED BEFORE FIRST RELEASE: privacy policy on a public, non-PDF, non-geofenced, non-editable URL, linked in Play Console and inside the game. Cover developer identity and contact, data collected by the ads SDK (IP address, advertising ID and app set ID, ad interactions, diagnostics), purchases handled by Google Play, sharing with Google and ad partners, retention and deletion, consent and opt-out choices, a link to 'How Google uses data', and that the game is not directed to children under 13.
- REQUIRED BEFORE FIRST RELEASE: fill in App content truthfully: Data safety form, target audience (13 and over only), content rating questionnaire, ads declaration, advertising ID declaration. Keep store art and wording from looking child-directed.
- REQUIRED BEFORE FIRST RELEASE: sell coins and remove-ads only through Google Play Billing with Billing Library 8 or newer (use 9.1.0). Show the price string Google returns, consume coin purchases and acknowledge remove-ads within 3 days, handle PENDING purchases, and query purchases on every connect or resume so remove-ads restores after reinstall. The bundled HTML game must contain no other payment link or checkout.
- REQUIRED BEFORE FIRST RELEASE: run the UMP consent flow on every launch before any ad request, request ads only when canRequestAds() is true, and show a 'Privacy settings' button when the SDK reports the privacy options entry point is REQUIRED. Create the European message and the US states message in AdMob > Privacy & messaging.
- REQUIRED BEFORE FIRST RELEASE: ad placement rules. No interstitial at launch, on exit, at the start of a level or during play; only at a level-end break, closeable, never two in a row and no more than one per two user actions. Rewarded ads only after an explicit tap on a button that states the exact reward, with a no-penalty decline. Set AdMob's maximum ad content rating to match the game's rating. Use Google's test ad unit IDs until release; live ads in testing can get the account suspended.
- REQUIRED BEFORE FIRST RELEASE: coins usable only inside this game, no paid random rewards without disclosed odds, and a working support email answered within 3 business days.
- REQUIRED BEFORE EARNING (Play): merchant payments profile with the true legal name and address in a merchant-supported country; bank account in that same country (USD account where payouts arrive by wire; local-currency account in EFT countries such as Türkiye); verify it by deposit challenge or bank documents (up to 5 days).
- REQUIRED BEFORE EARNING (Play): complete merchant identity verification when Google emails for it, and submit US tax information (W-8BEN for a non-US individual) in the payments profile.
- REQUIRED BEFORE EARNING (Play): complete the Japan payment-collection authorisation when invited (announced deadline 1 December 2026) and the Installment Sales Act disclosure, or leave Japan out of distribution until done; otherwise payouts are held globally.
- STRONGLY RECOMMENDED, FREE (Play): enrol in the 15% service fee tier (Associated developer accounts > create account group > accept terms). The reduced fee applies only from the enrolment date, and outside the new-fee markets the documented alternative is 30%.
- REQUIRED BEFORE EARNING (AdMob): AdMob account with a payments profile matching the real identity and address; add the published app and link it to its Play listing for the app readiness review (2 to 3 days); put app-ads.txt on the developer website named in the store listing.
- REQUIRED BEFORE EARNING (AdMob): identity verification within 45 days of the request; enter the mailed PIN within 4 months (the address must receive untracked international mail); submit tax information; choose a payment method once the balance reaches US$10. Payment follows around the 21st once the balance reaches US$100.
- BUILD CHOICE: start on the GMA Next-Gen SDK (ads-mobile-sdk 1.6.0). The legacy SDK (play-services-ads 25.5.0) is in maintenance mode, is deprecated on 30 June 2027 and sunset on 30 June 2028. Both need minSdk 24 and compileSdk 35.
- DESIGN (industry guidance, not rules): coin packs at $0.99, $1.99, $4.99, $9.99 and $19.99 with a rising coin bonus per dollar (about +30% to +50% at the top in the reference games); price a +5 moves continue just under the smallest pack; add a one-time starter pack at $1.99 to $2.99 and an out-of-moves bundle at about $4.99.
- DESIGN (industry guidance): non-consumable remove-ads at about $2.99 that removes interstitials only and keeps opt-in rewarded ads. Also stop interstitials for anyone who has bought anything.
- DESIGN (industry guidance): rewarded placements: +3 moves after failing (once per level, fewer than the paid +5), refill a life, double the end-of-level coins, daily bonus, and a free-coins button in the shop capped at once or twice a day.
- DESIGN (industry guidance): give new players an interstitial-free grace period (first several levels or first days), then no more than one per two levels with a minimum time gap. Set AdMob's server-side frequency cap as a safety net and A/B test for about two weeks while watching day-1 retention.
- DESIGN (EU guidance, non-binding): show the real-money equivalent next to every coin price, use a single purchasable currency, make pack sizes match item prices, and avoid countdown pressure and direct 'buy now' appeals to young players.
- PLANNING: budget on roughly US$0.01 revenue per daily active user (median), US$0.02 to US$0.10 for a well-tuned ad-heavy casual game. At 1,000 daily players that is about US$300 to US$3,000 a month across ads and purchases, before Google's fee on the purchase part. Rough net per purchase: price ÷ (1 + local tax) × 0.85. Reaching the US$100 thresholds can take time at launch.
- NOT REQUIRED: a backend server, server-side purchase validation, rewarded server-side verification, ad mediation, subscriptions or a season pass, an organisation account or D-U-N-S (for a game), analytics, remote config, the Play Games Level Up program, Play Age Signals API, ad preloading APIs (beta).

## Code notes

Versions confirmed in Google Maven group-index.xml on 2026-11-13 (stable only):
- com.android.billingclient:billing and billing-ktx 9.1.0 (8.1.0+ needs minSdk 23)
- com.google.android.ump:user-messaging-platform 4.0.0
- com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk 1.6.0 (GMA Next-Gen; recommended for a new app)
- com.google.android.gms:play-services-ads 25.5.0 (legacy, maintenance mode)
Both ads SDKs: minSdk 24, compileSdk 35. Next-Gen: Kotlin 1.9+.

Gradle (Kotlin DSL):
implementation("com.android.billingclient:billing-ktx:9.1.0")
implementation("com.google.android.ump:user-messaging-platform:4.0.0")
implementation("com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk:1.6.0")

Manifest (required by UMP even with Next-Gen):
<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"/>

BILLING 9.1.0
val billingClient = BillingClient.newBuilder(context)
    .setListener(purchasesUpdatedListener)
    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
    .enableAutoServiceReconnection()
    .build()
billingClient.startConnection(object : BillingClientStateListener {
    override fun onBillingSetupFinished(billingResult: BillingResult) { /* query products, then purchases */ }
    override fun onBillingServiceDisconnected() {}
})
val params = QueryProductDetailsParams.newBuilder().setProductList(listOf(
    QueryProductDetailsParams.Product.newBuilder()
        .setProductId("coins_small").setProductType(BillingClient.ProductType.INAPP).build())).build()
billingClient.queryProductDetailsAsync(params) { billingResult, queryProductDetailsResult ->
    if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
        queryProductDetailsResult.productDetailsList      // sellable
        queryProductDetailsResult.unfetchedProductList    // not available
    }
}
- Price and offer: take an offer from ProductDetails.getOneTimePurchaseOfferDetailsList(); show its getFormattedPrice(); pass its getOfferToken() to setOfferToken(). Never hard-code prices.
- Buy (main thread): billingClient.launchBillingFlow(activity, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd).setOfferToken(token).build())).build())
- Listener: override fun onPurchasesUpdated(billingResult: BillingResult, purchases: List<Purchase>?)
- On connect and on resume: billingClient.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()) { result, purchases -> }
- Only when purchase.purchaseState == Purchase.PurchaseState.PURCHASED:
  coins: grant, then billingClient.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()) { result, token -> }  (ktx suspend: consumePurchase(params))
  remove ads: if (!purchase.isAcknowledged) billingClient.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()) { result -> }
  PENDING: show 'pending', grant nothing. Unacknowledged purchases are refunded after 3 days.
- Removed since 8.0.0: querySkuDetailsAsync, queryPurchaseHistory, enablePendingPurchases() with no argument, queryPurchasesAsync(String, ...).

UMP 4.0.0 (every launch, before ads)
val consentInformation = UserMessagingPlatform.getConsentInformation(context)
consentInformation.requestConsentInfoUpdate(activity, ConsentRequestParameters.Builder().build(),
    { UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { formError ->
          if (consentInformation.canRequestAds()) initAdsOnce() } },
    { requestConsentError -> })
if (consentInformation.canRequestAds()) initAdsOnce()   // consent from a previous session; guard with a boolean
Privacy button: show when consentInformation.privacyOptionsRequirementStatus == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED; on tap UserMessagingPlatform.showPrivacyOptionsForm(activity) { formError -> }

GMA NEXT-GEN 1.6.0 (package com.google.android.libraries.ads.mobile.sdk)
CoroutineScope(Dispatchers.IO).launch {
    MobileAds.initialize(context, InitializationConfig.Builder(ADMOB_APP_ID).build()) { }
}
RewardedAd.load(AdRequest.Builder(adUnitId).build(), object : AdLoadCallback<RewardedAd> {
    override fun onAdLoaded(ad: RewardedAd) { rewardedAd = ad }
    override fun onAdFailedToLoad(adError: LoadAdError) { rewardedAd = null }
})
ad.adEventCallback = object : RewardedAdEventCallback { override fun onAdDismissedFullScreenContent() { rewardedAd = null } }
ad.show(activity, object : OnUserEarnedRewardListener {
    override fun onUserEarnedReward(rewardItem: RewardItem) { /* grant here only */ }
})
InterstitialAd.load(AdRequest.Builder(adUnitId).build(), object : AdLoadCallback<InterstitialAd> { ... }); ad.adEventCallback = object : InterstitialAdEventCallback { ... }; ad.show(activity)
Test IDs: app ca-app-pub-3940256099942544~3347511713; rewarded ca-app-pub-3940256099942544/5224354917; interstitial ca-app-pub-3940256099942544/1033173712.
RewardedAdPreloader / InterstitialAdPreloader (start, pollAd) exist but are marked beta. One snippet on the Next-Gen rewarded page (server-side verification) still shows the legacy load signature; follow the single-load pages.

LEGACY 25.5.0 names, if used instead: MobileAds.initialize(context) {}; RewardedAd.load(context, adUnitId, AdRequest.Builder().build(), RewardedAdLoadCallback); FullScreenContentCallback; show(activity, OnUserEarnedRewardListener). The AD_ID permission is merged in automatically. gad_rdp = 1 in default SharedPreferences forces restricted data processing (documented for legacy only).

WebView wrapper: ads are native full-screen views shown by the SDK over the Activity, which AdMob allows 'next to a WebView'. Expose buy / showRewarded / showInterstitial to the HTML game through your own JavaScript bridge and hop to the main thread before launchBillingFlow or show (the bridge threading detail is standard Android behaviour, not re-checked today).

## Open questions

- Does AdMob accept a Syrian payments address at sign-up, and which payout method would it offer? Syria left the restricted list in August 2025, but it is missing from the payment-options-by-country table, the wire-transfer country blocks and the EFT list. Only the country selector at sign-up or AdMob support can confirm.
- Will Google Play add Syria to developer or merchant registration? Nothing on the supported-locations page, the 29 October 2026 policy announcement or the sanctions FAQ says so. Ask Play Console support before choosing a route.
- In which country is the developer's existing Play Console account registered, and is its payments profile in a merchant-supported country? That decides whether in-app products can be created at all.
- Can users in Syria buy in-app products? Google's user-side supported-locations table is script-rendered and could not be read; press reports of the Play Store returning to Syria in January 2026 could not be opened (HTTP 403) and say nothing about purchases.
- Is the first-US$1M rate (10% + 5%) in the new-fee markets automatic, or does it depend on enrolling in the 15% tier? Neither fee page says; enrolling is free and removes the doubt.
- What billing fee and timing will apply in the Middle East? Google says the rest of the world moves to the new structure by 30 September 2027 and that 'Billing fee details for other regions are forthcoming'.
- Is US withholding applied to ordinary in-app purchase proceeds from US buyers, and at what rate? Google's pages classify Google Play / Play Pass under royalties but publish no Play-specific rate. The rate appears in the payments profile after the W-8BEN; a resident of a non-treaty country should assume up to 30% on the US-buyer share until confirmed.
- Restricted data processing with the Next-Gen SDK: the gad_rdp key is documented for the legacy SDK only; the Next-Gen US-states page was not read.
- The trader declaration publishes a personal account's address and phone number. Whether that is acceptable, or an organisation account is preferable, is a decision for the developer and a local adviser; Google states it cannot give legal or tax advice.
- No reliable published split of ads versus purchases revenue exists for small match-3 titles, and no source gave eCPM figures for Arabic-speaking markets; treat revenue figures as rough planning ranges.
- Note: the GameAnalytics benchmarks page appears to carry embedded prompt-style text. It came from the web page, not from the user or the task, and was not acted on; only the published numbers were used.
