# Research: billing

_Read from primary sources on 2026-11-13 and re-checked by an independent second pass._

## Summary

Re-checked against primary sources on 2026-11-13. The earlier billing findings were largely correct; corrections are below.

Confirmed: Play Billing Library 9.1.0 (2026-06-18) is the latest stable for billing and billing-ktx (Maven metadata, no pre-releases). Every API name in the code notes exists in the 9.1.0 AAR (javap): enablePendingPurchases(PendingPurchasesParams) is the only overload, enableAutoServiceReconnection() exists, and QueryProductDetailsResult carries the unfetched list that the KTX wrapper drops. PBL 7 is past both deadlines; PBL 9 is accepted until 31 Aug 2028. Fees: first $1M = 10% + 5% billing fee for users in EEA/UK/US (since 30 Jun 2026) and AU/JP (since 30 Sep 2026); elsewhere 15% on the first $1M only for developers enrolled in the 15% tier. Client-only consume/acknowledge is a documented path; server verification is recommended, not mandatory. Billing choice and alternative billing are opt-in.

Corrected or added:
- compileSdk 35 is only the library's floor. New apps must target API 36 since 31 Aug 2026, so use compileSdk/targetSdk 36.
- Two quotes were attributed to the wrong help pages (fixed in facts).
- Buyer side is no longer unknown: Google's "Paid app availability" list does not include Syria, so players in Syria most likely cannot buy. IAP revenue would come from other countries; in Syria only ads can earn.
- Personal accounts created after 13 Nov 2023 need a closed test with 12 testers for 14 days before production.

Syria on Google's current lists:
- (a) Play developer registration: not listed.
- (b) Play merchant/payments profile: not listed (also absent from the Payments Center bank-country list).
- (c) AdMob: not listed among restricted countries (Google removed Syria in August 2025). Whether a Syria-address AdMob payments profile and payout work: could not verify.

Selling IAP therefore needs a payments profile and same-country bank account in a supported merchant country. The Kotlin outline was not compiled (no Android SDK here).

## Facts

- **Latest stable Play Billing Library (billing and billing-ktx)** — 9.1.0. maven-metadata.xml: latest=9.1.0, release=9.1.0, lastUpdated 20260618 for both artifacts; the version list ends ...8.2.1, 8.3.0, 9.0.0, 9.1.0 with no alpha/beta/rc entries. Google's own integrate guide also shows billing_version = "9.1.0".  
  Source: https://dl.google.com/dl/android/maven2/com/android/billingclient/billing/maven-metadata.xml (verified-primary-source)
- **Release dates and content of recent PBL versions** — 9.1.0 (2026-06-18): only Billing Choice APIs (getBillingChoiceInfoAsync, showBillingProgramInformationDialog, etc.). 9.0.0 (2026-05-19): Play-Store-blocked now returns BILLING_UNAVAILABLE instead of ERROR (needs androidx.core 1.9+), getLinkUri() @Nullable, targetSdkVersion 35, in-app messaging for opt-in price increases. 8.3.0 (2025-12-23), 8.2.1 (2025-12-15), 8.2.0 (2025-12-09), 8.1.0 (2025-11-06: minSdkVersion 23, Kotlin 2.2.0), 8.0.0 (2025-06-30).  
  Source: https://developer.android.com/google/play/billing/release-notes (verified-primary-source)
- **PBL 8.0.0 breaking changes that shape today's API** — 'In-app items' renamed 'one-time products'; onProductDetailsResponse signature changed and unfetched products are returned with a status code; new enableAutoServiceReconnection(); sub-response codes on launchBillingFlow; removed queryPurchaseHistory(), querySkuDetailsAsync(), no-arg enablePendingPurchases() and queryPurchasesAsync(String, ...). Pitfall: the Java samples on the integrate and errors pages still show the removed no-arg enablePendingPurchases(); only the Kotlin samples are right.  
  Source: https://developer.android.com/google/play/billing/release-notes (verified-primary-source)
- **Minimum Billing Library version Play accepts (two-year deprecation cycle)** — Table: v5 Aug 31 2024 / Nov 1 2024; v6 Aug 31 2025 / Nov 1 2025; v7 Aug 31 2026 / Nov 1 2026; v8 Aug 31 2027 / Nov 1 2027; v9 Aug 31 2028 / Nov 1 2028. 'new apps and updates must use supported versions'. On 2026-11-13 v7 is past both dates, so the floor is v8; 9.1.0 is safe. The merged manifest must contain com.google.android.play.billingclient.version.  
  Source: https://developer.android.com/google/play/billing/deprecation-faq (verified-primary-source)
- **PBL 9.1.0 library manifest (read from the AAR)** — uses-sdk minSdkVersion 23, targetSdkVersion 35; uses-permission com.android.vending.BILLING only; meta-data com.google.android.play.billingclient.version=9.1.0; <queries> for InAppBillingService.BIND and the Play Billing Lab override service; ProxyBillingActivity and ProxyBillingActivityV2 (exported=false). The app need not declare BILLING itself. App minSdk 24 is fine.  
  Source: https://dl.google.com/dl/android/maven2/com/android/billingclient/billing/9.1.0/billing-9.1.0.aar (verified-primary-source)
- **PBL 9.1.0 dependencies and the compileSdk floor they impose** — POM: androidx.activity 1.2.3, androidx.core 1.15.0 (not in 8.3.0's POM), transport-api 3.0.0, transport-backend-cct 3.1.8, transport-runtime 3.1.8, play-services-base 18.5.0, basement 18.9.0, location 19.0.0, tasks 18.2.0. core-1.15.0.aar aar-metadata: minCompileSdk=35. billing-ktx 9.1.0 adds kotlin-stdlib 2.2.10 and kotlinx-coroutines-core 1.6.0.  
  Source: https://dl.google.com/dl/android/maven2/com/android/billingclient/billing/9.1.0/billing-9.1.0.pom (verified-primary-source)
- **CORRECTION: compileSdk/targetSdk actually required for a new app today** — 'Starting August 31, 2026: New apps and app updates must target Android 16 (API level 36) or higher'; the extension ran only to November 1, 2026. So the app needs targetSdk 36 and therefore compileSdk 36; the earlier 'compileSdk >= 35' is only the Billing Library's floor.  
  Source: https://support.google.com/googleplay/android-developer/answer/11926878?hl=en (verified-primary-source)
- **INTERNET permission and the Billing Library** — The billing AAR declares only BILLING. transport-backend-cct 3.1.8's manifest declares INTERNET and ACCESS_NETWORK_STATE (transport-runtime 3.1.8 declares ACCESS_NETWORK_STATE), so both are merged into the APK transitively.  
  Source: https://dl.google.com/dl/android/maven2/com/google/android/datatransport/transport-backend-cct/3.1.8/transport-backend-cct-3.1.8.aar (verified-primary-source)
- **Exact public API in billing 9.1.0 (javap on classes.jar, re-run by me)** — BillingClient.Builder: setListener, enablePendingPurchases(PendingPurchasesParams) [only overload], enableAutoServiceReconnection(), build(). PendingPurchasesParams.Builder: enableOneTimeProducts(), enablePrepaidPlans(). BillingClient: startConnection, endConnection, isReady, getConnectionState (DISCONNECTED=0, CONNECTING=1, CONNECTED=2, CLOSED=3), queryProductDetailsAsync(QueryProductDetailsParams, ProductDetailsResponseListener), queryPurchasesAsync(QueryPurchasesParams, PurchasesResponseListener), launchBillingFlow(Activity, BillingFlowParams), consumeAsync, acknowledgePurchase. ProductDetailsResponseListener.onProductDetailsResponse(BillingResult, QueryProductDetailsResult). UnfetchedProduct.StatusCode: UNKNOWN=0, INVALID_PRODUCT_ID_FORMAT=2, PRODUCT_NOT_FOUND=3, NO_ELIGIBLE_OFFER=4. Response codes: -3 SERVICE_TIMEOUT, -2 FEATURE_NOT_SUPPORTED, -1 SERVICE_DISCONNECTED, 0 OK, 1 USER_CANCELED, 2 SERVICE_UNAVAILABLE, 3 BILLING_UNAVAILABLE, 4 ITEM_UNAVAILABLE, 5 DEVELOPER_ERROR, 6 ERROR, 7 ITEM_ALREADY_OWNED, 8 ITEM_NOT_OWNED, 12 NETWORK_ERROR. PurchaseState: 0 UNSPECIFIED_STATE, 1 PURCHASED, 2 PENDING. ProductType.INAPP="inapp". No class with 'Sku' in its name remains; Purchase.getSkus() survives as a deprecated method.  
  Source: https://dl.google.com/dl/android/maven2/com/android/billingclient/billing/9.1.0/billing-9.1.0.aar (verified-primary-source)
- **Nullability in 9.1.0 that the Kotlin code must respect (class-file annotations)** — @Nullable: ProductDetails.getOneTimePurchaseOfferDetails(), getOneTimePurchaseOfferDetailsList(), OneTimePurchaseOfferDetails.getOfferToken(), the purchases list in PurchasesUpdatedListener.onPurchasesUpdated, Purchase.getOrderId(). @NonNull: getFormattedPrice(), getPriceCurrencyCode(), QueryProductDetailsResult.getProductDetailsList()/getUnfetchedProductList(), the list in onQueryPurchasesResponse, Purchase.getProducts()/getPurchaseToken().  
  Source: https://dl.google.com/dl/android/maven2/com/android/billingclient/billing/9.1.0/billing-9.1.0.aar (verified-primary-source)
- **billing-ktx 9.1.0 shape (pitfall confirmed)** — BillingClientKotlinKt.queryProductDetails() returns ProductDetailsResult(billingResult, productDetailsList) with no unfetched-product list; also queryPurchasesAsync -> PurchasesResult, consumePurchase -> ConsumeResult, acknowledgePurchase -> BillingResult. PRODUCT_NOT_FOUND / NO_ELIGIBLE_OFFER are visible only through the callback API. KTX is optional.  
  Source: https://dl.google.com/dl/android/maven2/com/android/billingclient/billing-ktx/9.1.0/billing-ktx-9.1.0.aar (verified-primary-source)
- **Offer token and price for one-time products** — 'you must set the offer token corresponding to the offer selected by the user when creating the BillingFlowParams object'. getOneTimePurchaseOfferDetailsList() returns only offers the user is eligible for; the singular getter returns the backwards compatible purchase option (by default the first buy option created); if none exists the product comes back as an UnfetchedProduct with NO_ELIGIBLE_OFFER. launchBillingFlow() must be called 'from your app's main thread'.  
  Source: https://developer.android.com/google/play/billing/one-time-product-multi-purchase-options-offers (verified-primary-source)
- **Automatic service reconnection** — 'Google Play strongly recommends that you use the automatic service reconnection feature ... If you enable automatic service reconnection, you should not manually call startConnection() in onBillingServiceDisconnected(). You can implement the method as a no-op'. The library re-establishes the connection 'if an API call is made while the service is disconnected'.  
  Source: https://developer.android.com/google/play/billing/integrate (verified-primary-source)
- **Pending purchases, 3-day rule, consume vs acknowledge** — 'Your app must enable and support pending transactions for one-time products.' Grant only when state is PURCHASED; 'don't acknowledge it while a purchase is in PENDING state. The three-day acknowledgement window begins only when the purchase state transitions from PENDING to PURCHASED.' Acknowledging 'must be done within three days so that the purchase isn't automatically refunded and entitlement revoked'. 'If your app is client-only without a backend, use consumeAsync()' (consumables; this also satisfies acknowledgement). 'If your app is client-only, use BillingClient.acknowledgePurchase()' after checking isAcknowledged() (non-consumables). Call queryPurchasesAsync() on each successful connection and in onResume(). 'Caching ProductDetails objects is not recommended, as stale objects can cause launchBillingFlow() failures.'  
  Source: https://developer.android.com/google/play/billing/integrate (verified-primary-source)
- **Required user notification and multi-quantity** — 'After granting entitlement to the user, your app should show a notification to acknowledge the successful purchase', e.g. 'You purchased 100 Gold Coins!'; delay it during gameplay action. Multi-quantity: 'Your app is expected to handle multi-quantity purchases and grant entitlement based on the specified purchase quantity' (Purchase.getQuantity()); enable it per product in Play Console only after the app honors it.  
  Source: https://developer.android.com/google/play/billing/integrate (verified-primary-source)
- **queryPurchasesAsync semantics** — 'Returns purchases details for currently owned items bought within your app. Only active subscriptions and non-consumed one-time purchases are returned.' The same reference says backend verification is recommended 'if you have one'. Using it as 'restore purchases' and dropping remove-ads when a revoked purchase is no longer returned is an inference from this wording.  
  Source: https://developer.android.com/reference/com/android/billingclient/api/BillingClient (verified-primary-source)
- **Error handling guidance** — BILLING_UNAVAILABLE causes: outdated Play Store, 'The user is in an unsupported country', enterprise restriction, payment method cannot be charged, Play Store blocked by the system. 'Automatic retries are unlikely to help'; show an error with a 'Try again' button. SERVICE_DISCONNECTED: enabling auto reconnection is 'highly recommended'; if it still occurs, retry (simple retry in session, exponential backoff in background).  
  Source: https://developer.android.com/google/play/billing/errors (verified-primary-source)
- **Is server-side verification required?** — No; it is a recommendation. The page 'describes recommendations to prevent attacks'. 'Note that while you can acknowledge or consume the purchase on the client side through your app, server side APIs provide additional protection'. Without a backend: client tampering is possible, there is no clawback (the Voided Purchases API is a server API), and a purchase auto-refunds if the app never processes it within three days.  
  Source: https://developer.android.com/google/play/billing/security (verified-primary-source)
- **Prerequisites before products can be created** — 'To sell paid apps and in-app purchases on Google Play, you must also set up a profile in the Google Payments Center and then link that profile to your Google Play developer account.' 'you must publish a version of your app that includes the Google Play Billing Library. This step is required to enable billing-related features in the Google Play Console' (any track, including internal testing).  
  Source: https://developer.android.com/google/play/billing/getting-ready (verified-primary-source)
- **Product ID rules, availability, and purchases made outside the app (source corrected)** — 'Product IDs must start with a number or lowercase letter and can contain numbers (0-9), lowercase letters (a-z), underscores (_), and periods (.).' 'You can't change or reuse a product ID after the product has been created.' IDs starting with android.test are unavailable. 'If you're in a supported location for merchant registration, you can use Google Play's billing system.' A product stays purchasable while active 'even if its app is unpublished'. The BILLING permission must be in the manifest. Cart Abandonment Reminder (on by default) can let users buy the SKU from the Play Store's Games Home, outside the app.  
  Source: https://support.google.com/googleplay/android-developer/answer/1153481?hl=en (verified-primary-source)
- **Console model for one-time products** — One-time product -> purchase option (buy/rent, price, regions; at least one required; states Draft/Active/Inactive) -> offer. Path Monetize with Play > Products > One-time products. Up to 100 purchase options and offers per product. 'The default price (available for in-app products) is no longer supported'; prices are per region with a bulk one-off currency conversion. Default availability is all regions, but 'Users can purchase one-time products only in the regions where your app is available'. The first buy purchase option is automatically backwards compatible.  
  Source: https://support.google.com/googleplay/android-developer/answer/16430488?hl=en (verified-primary-source)
- **License testers** — Manage account > Play apps settings > Monetization settings > License testing; email lists up to 2,000 addresses or Google Groups. 'your own publishing account is always considered a licensed tester'. The app must be on an open, closed, internal or production track (internal recommended). 'You must publish your one-time products and subscriptions before they can be tested.'  
  Source: https://support.google.com/googleplay/android-developer/answer/6062777?hl=en (verified-primary-source)
- **Test purchase behaviour** — License testers can sideload debug builds if the package name matches. Test instruments: always approves, always declines, slow card approves/declines after a few minutes, approves then charges back. 'For purchases from license testers, a purchase will be refunded after 3 minutes if your app does not acknowledge the purchase'. 'Users incur actual charges for their test track purchases unless the user is a license tester.' Draft and internal-track apps have daily spend limits. To re-buy a non-consumable, refund and revoke in Play Console. The static android.test.purchased IDs are not documented on this page.  
  Source: https://developer.android.com/google/play/billing/test (verified-primary-source)
- **ADDED: closed-testing gate for new personal accounts** — 'Developers with personal accounts created after November 13, 2023, must run a closed test for their app with a minimum of 12 testers who have been opted in continuously for at least 14 days' before applying for production access. Internal testing is available immediately, so billing can be tested there first.  
  Source: https://support.google.com/googleplay/android-developer/answer/14151465?hl=en (verified-primary-source)
- **Payments policy (current text): what must use Play Billing** — In-app purchases 'must use Google Play's billing system for those transactions unless Section 3, 8, or 9 applies'; examples include 'virtual currencies, extra lives' and 'an ad-free version of an app'. Apps 'may not lead users to a payment method other than Google Play's billing system'. 'In-app virtual currencies must only be used within the app or game title for which they were purchased.' 'In-app pricing must match the pricing displayed in the user-facing Play billing interface.' Listings mentioning paid features 'must clearly notify users that payment is required'. Randomized purchased items 'must clearly disclose the odds'.  
  Source: https://support.google.com/googleplay/android-developer/answer/9858738?hl=en (verified-primary-source)
- **Earned currency and countries without Play billing** — 'Earned or awarded points can be issued in-app without using Google Play's billing system ... if these points (or other types of virtual currency) are sold in-app, Google Play's billing system must be used.' 'As long as Google Play's billing system isn't available in a particular country, the Payments policy's requirement to use Google Play's billing system does not apply in that country. Google Play's billing system is not available in these countries' (link goes to the 'Rest of the world' list).  
  Source: https://support.google.com/googleplay/android-developer/answer/10281818?hl=en (verified-primary-source)
- **Service fee table (current)** — Users in AU, EEA, JP, UK, US (rollout June 30, 2026 for EEA/UK/US; September 30, 2026 for AU/JP): row 'First $1M (USD) of annual earnings' = 10% + 5% billing fee across all three columns. Standard: subscriptions 10% + 5%; other transactions 20% + 5% (new installs) or 25% + 5% (existing installs). Level Up / Apps Experience: 15% + 5% and 20% + 5%. 'Billing fee applies when a user completes a purchase of an in-app digital service or feature using Google Play Billing'. All remaining markets: 'Developers enrolled in the 15% service fee tier' pay 15% on the first $1M and 30% above. '97% of developers distribute their apps ... at no charge.' The page does not print the rate for non-enrolled developers; 30% is an inference. The first-$1M row links to the 15%-tier enrolment article.  
  Source: https://support.google.com/googleplay/android-developer/answer/112622?hl=en (verified-primary-source)
- **Fee rollout schedule (source corrected: this is on the 'lower service fees' page, not the fee table page)** — June 30, 2026: EEA, UK, US. September 30, 2026: AU, JP. December 31, 2026: KR, TR, ZA. September 30, 2027: Rest of World. 'In the currently launched markets ... the billing fee is currently set at 5%. Billing fee details for other regions are forthcoming.' A new install is one first made on or after the regional rollout date, so every install of a brand-new app is a new install.  
  Source: https://support.google.com/googleplay/android-developer/answer/16954621?hl=en (verified-primary-source)
- **The 15% tier needs enrolment** — 'To officially enroll for the 15% service fee tier, you must: Have a payments profile; create an Account Group ... and accept the Terms of Service for the 15% service fee tier.' Done on the Associated developer accounts page. 'If you enrolled after July 1, the 15% service fee applied as of the date you complete enrollment.' Earnings are counted per calendar year.  
  Source: https://support.google.com/googleplay/android-developer/answer/10632485?hl=en (verified-primary-source)
- **Payouts** — Orders 'processed, refunded, or charged-back from the 1st of a given month to the end of the month will get paid out around the 15th of the following month'. Minimum balance: US$1 for local-currency payouts, US$100 for USD wire-transfer payouts. Buyers have two hours to cancel an app or game purchase.  
  Source: https://support.google.com/googleplay/android-developer/answer/137997?hl=en (verified-primary-source)
- **Refunds** — 'you're also responsible for setting your own policies for refunds ... You must issue refunds in accordance with your policy.' Issued in Manage account > Play apps order management or the Play Console app. Partial refunds are possible for in-app purchases via the website; the refund percentage also applies to payout and service fee. (The Voided Purchases statement belongs to the billing security page, not this one.)  
  Source: https://support.google.com/googleplay/android-developer/answer/2741495?hl=en (verified-primary-source)
- **Data safety form with Play Billing only** — 'If your app uses a payment service such as PayPal, Google Pay, Google Play's billing system ... you don't need to declare collection of the data that the payment service collects ... if ... Your app never accesses this information; and The payment service collects this information directly from the user'. 'You should also consider whether your app collects other financial information, like purchase history'. Data 'only processed locally on the user's device and not sent off device does not need to be disclosed'. So purchase tokens and entitlements kept only on the device need no Financial info declaration; this changes if purchase events are sent to analytics, an ad SDK or a server.  
  Source: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en (verified-primary-source)
- **Android guidance names the Billing Library as a possible financial-info access path** — Under 'Financial info': 'Uses Google Play's Billing Library' is listed as an example of how an app or library 'may access user data related to financial information'; 'you alone are responsible for making complete and accurate declarations'. A prompt to check, not a mandatory declaration.  
  Source: https://developer.android.com/privacy-and-security/declare-data-use (verified-primary-source)
- **Content rating and IAP** — A new questionnaire is required for 'All app updates where there has been a change to your content or features that would affect the responses to the questionnaire'; 'Misrepresentation of your app's content may result in its removal or suspension.' ESRB: Interactive Elements 'do not influence the rating assignment of a product'; 'In-Game Purchases' covers virtual coins and upgrades '(e.g., to disable ads)'; a separate element covers random items. IARC assigns 'Age Rating, Content Descriptors, and Interactive Elements by region'. Exact Play Console question wording was not seen.  
  Source: https://support.google.com/googleplay/android-developer/answer/9859655?hl=en (verified-primary-source)
- **Store labels** — Consumer help: 'On the Google Play Store app, in-app purchases will be by the Price or Install button. On play.google.com/store, you'll see "Offers in-app purchases" below the name of the app.' No developer-side switch was found; automatic assignment is an assumption. The 'Contains ads' label is separate and 'isn't meant to cover ... offers to make in-app purchases' (answer/9859455).  
  Source: https://support.google.com/googleplay/answer/1061913?hl=en (verified-primary-source)
- **SYRIA (a) Play developer registration and (b) merchant registration** — NOT LISTED for either. The table (214 location rows, read from raw HTML) has no Syria row at all; Iran, Cuba and North Korea are also absent. Neighbours: Lebanon, Jordan, Türkiye, Egypt, UAE, Saudi Arabia, Palestine, Yemen, Libya = developer yes, merchant yes; Iraq and Sudan = developer yes, merchant no.  
  Source: https://support.google.com/googleplay/android-developer/answer/9306917?hl=en (verified-primary-source)
- **SYRIA (b) payments profile and bank account** — NOT LISTED: the Payments Center bank-information page has per-country sections (Egypt, Jordan, Lebanon, Türkiye, UAE and others; several receive USD wire from the US) and none for Syria. The bank account must be 'In the same country or region where the merchant account is registered'. Profile page: legal address as on official documents, no PO box, and 'You can't change your business location country'.  
  Source: https://support.google.com/paymentscenter/answer/7161440?hl=en (verified-primary-source)
- **SYRIA buyer side: can Play users in Syria pay? (upgraded from unverified)** — NOT LISTED. Google's consumer page 'Paid app availability' ('Paid apps are currently available to users in the following countries') does not include Syria; it does include Lebanon, Jordan, Iraq, Egypt, Turkey, Saudi Arabia, UAE, Yemen. Caveat: the page looks dated (still lists 'Netherlands Antilles'). Expect BILLING_UNAVAILABLE for players in Syria.  
  Source: https://support.google.com/googleplay/answer/143779?hl=en (verified-primary-source)
- **SYRIA in the Play Console distribution table** — COULD NOT VERIFY. The help page only links to play.google.com/supported-locations, which is a JavaScript app whose table could not be read. The separate 'Rest of the world' list (answer/12201481, 49 locations, the list the Payments FAQ calls countries without Play billing) does not contain Syria either.  
  Source: https://support.google.com/googleplay/android-developer/answer/12201481?hl=en (unverified)
- **SYRIA (c) AdMob** — NOT LISTED as a restricted country. Current list of places where 'AdMob is not available': Crimea, Cuba, so-called DNR and LNR, Iran, North Korea (same in the Arabic version). AdMob's policy change log: 'In August 2025, the Understanding AdMob country restrictions page will be updated to reflect the removal of Syria from the US Office of Foreign Asset Control sanctions list.' Google publishes no positive list of AdMob countries; whether sign-up and a payout method work for a Syria payments address COULD NOT BE VERIFIED.  
  Source: https://support.google.com/admob/answer/6163675?hl=en (verified-primary-source)
- **AdMob change-log entry on Syria** — Section 'Update to US Office of Foreign Asset Control Sanctions List (August 2025)', posted August 2025, text as quoted above.  
  Source: https://support.google.com/admob/answer/9391084?hl=en (verified-primary-source)
- **US court-ordered changes** — Since October 29, 2025, for US users on phones and tablets, Google 'will not require the use of Google Play Billing'. March 4, 2026 settlement with Epic; 'Our current policies and programs remain in effect'. Enrolled developers report and pay fees from October 1, 2026 (October 21, 2026 update: download reporting for external content links until February 1, 2027). Nothing to do for a developer using only Play Billing.  
  Source: https://support.google.com/googleplay/android-developer/answer/15582165?hl=en (verified-primary-source)
- **Billing choice program** — Markets: UK and EEA Jun 30, 2026; Australia and Japan Sep 30, 2026; US keeps its existing programs. 'Is this a required program? No, this is an opt-in program ... no action is required.' Opting in brings PCI-DSS, own support and refunds, and transaction reporting. It needs PBL 9.1 or higher (developer.android.com/google/play/billing/billingchoice).  
  Source: https://support.google.com/googleplay/android-developer/answer/17161464?hl=en (verified-primary-source)
- **Third-party US app store catalog sharing (opt-out)** — From July 22, 2026 the US listing is provided to enrolled third-party US Android app stores unless the developer opts out at Manage account > Play apps settings > General settings > Third-party app stores ('Do not publish any of my app listings on any third-party app stores'). Downloads still complete through Google Play and the service fee still applies.  
  Source: https://support.google.com/googleplay/android-developer/answer/17187609?hl=en (verified-primary-source)
- **No pending Play policy change on IAP or virtual currency** — Policy Deadlines page lists changes for contacts/location permissions, SMS/call log, foreground services, Local Network and Manage Contacts permissions, AppFunctions, subscription eligibility discounts (2027-01-27), app registration for developer verification (2026-09-30) and anonymous chat. Nothing touches one-time products or virtual currency.  
  Source: https://support.google.com/googleplay/android-developer/answer/9934569?hl=en (verified-primary-source)
- **EU CPC Network 'Key Principles on In-game Virtual Currencies'** — Published 21 March 2025; seven non-exhaustive principles based on UCPD/CRD/UCTD (clear price indication, no obscuring of cost, no forced purchase of unwanted currency, pre-contractual information, right of withdrawal, fair terms, respect for vulnerable consumers including minors); 'without prejudice to the applicable European consumer protection legislation'. Not a Google Play requirement.  
  Source: https://commission.europa.eu/document/download/8af13e88-6540-436c-b137-9853e7fe866a_en?filename=Key+principles+on+in-game+virtual+currencies.pdf (verified-primary-source)
- **EU Digital Fairness Act proposal (proposal only, not law)** — COM(2026) 1100 final, Brussels 11.11.2026, 2026/0356 (COD). Art. 14: traders offering paid-for virtual currencies 'shall indicate the corresponding monetary value of those virtual items'; where products are directed at or knowingly used by minors, 'paid-for virtual currencies are disabled by default for minors' and activated only on parent or guardian approval. Art. 15: probability disclosure for paid variable-reward systems, none for minors. Art. 16: no pay-to-progress or pay-to-win for minors. 'It shall apply from [12 months after the entry into force].'  
  Source: https://commission.europa.eu/document/download/0575d59f-554f-4a9e-b54b-e6b717175809_en (verified-primary-source)

## Action items

- BLOCKER, check first: confirm which country the existing Play developer account and its payments profile are registered in. Syria is not listed for developer or merchant registration. Selling coins or remove-ads needs a payments profile in a merchant-supported country with a bank account in that same country; the country cannot be changed later. Do not misstate the country or address (legal address as on official documents is required).
- Plan revenue around this: players in Syria most likely cannot pay (Syria is not on Google's paid-app availability list), so IAP income would come from users in other countries; in Syria only ads can earn. The game must stay fully playable and fair when the shop is unavailable.
- AdMob: Syria is no longer on AdMob's restricted-country list (removed August 2025), but confirm inside the AdMob account that a payments profile and payout method can actually be set up for the developer's real country before relying on ad revenue.
- Build: implementation("com.android.billingclient:billing:9.1.0"); skip billing-ktx. Set compileSdk = 36 and targetSdk = 36 (Play requirement for new apps since 31 Aug 2026; the library itself only needs compileSdk 35). Keep minSdk 24.
- Manifest: add nothing by hand. Check the merged manifest contains com.android.vending.BILLING and the meta-data com.google.android.play.billingclient.version = 9.1.0, and that no tools:node="remove" rule strips them.
- App (required): one BillingClient built with enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()) and enableAutoServiceReconnection(). Do not copy the Java samples in Google's docs that call the removed no-arg enablePendingPurchases(). Connect at launch, call queryPurchasesAsync(INAPP) after every successful connection and in onResume, endConnection in onDestroy.
- App (required): show only the price string Play returns (formattedPrice); never hard-code prices. Re-query product details when the shop opens rather than keeping old ProductDetails. Hide any product returned in unfetchedProductList, and hide or disable the shop on BILLING_UNAVAILABLE.
- App (required): coin packs. Only when purchaseState == PURCHASED: credit coins once per purchaseToken (token ledger and balance in one atomic write, multiplied by purchase.quantity), show a confirmation such as 'You received 550 coins', then consumeAsync. Retry failed consumes on next resume without re-crediting.
- App (required): remove_ads. Persist the entitlement, then acknowledgePurchase if !isAcknowledged, within 3 days. Treat queryPurchasesAsync as the source of truth so it restores on reinstall and drops after refund-with-revoke. Add a visible 'Restore purchases' button that re-runs the query.
- App (required): PENDING purchases get a 'payment pending' message only. No coins, no acknowledge, no consume until the state becomes PURCHASED.
- App (required): process purchases found at startup too, because users can buy outside the app (Play Store cart-abandonment reminders, promo codes, approvals on another device). Keep the authoritative coin balance on the native side or have the HTML game pull it on load, so a grant made before the page loads is not lost.
- App (required): error handling. USER_CANCELED is silent. ITEM_ALREADY_OWNED triggers a re-sync. NETWORK_ERROR, SERVICE_UNAVAILABLE, SERVICE_DISCONNECTED and ERROR show 'try again'. BILLING_UNAVAILABLE and ITEM_UNAVAILABLE show 'purchases are not available on this device/account'. Call launchBillingFlow on the main thread; @JavascriptInterface methods run on a background thread, so post to the main looper.
- Policy (required): sell coins and remove-ads only through Play Billing. No links, buttons, WebView pages or text leading to any other payment method. Coins usable only inside this game. Coins from rewarded ads are allowed. Do not sell randomised items; if that changes, show the odds next to the purchase button.
- Policy (required): decide a refund policy, state it on the listing or support page, and handle requests in Play Console > Play apps order management. If the store description mentions coins or ad removal, say plainly they are paid in-app purchases.
- Play Console order of work: (1) payments profile; (2) upload an AAB containing the Billing Library to internal testing; (3) Monetize with Play > Products > One-time products: create remove_ads and the coin packs (IDs a-z, 0-9, _ and . only, never changeable or reusable), one Buy purchase option each, set regional prices, add Arabic and English names, Activate; (4) add license testers under Monetization settings > License testing; (5) test; (6) if the account is a personal one created after 13 Nov 2023, run a closed test with at least 12 testers opted in for 14 continuous days, then apply for production access.
- Testing checklist with a license tester: always-approves, always-declines, slow card approves, slow card declines (PENDING path); buy the same coin pack twice; reinstall and restore remove_ads; refund and revoke remove_ads in Console and confirm ads return. A 'refunded after 3 minutes' email means acknowledge/consume is broken. Closed-test users who are not license testers are really charged.
- Fees: enrol in the 15% service fee tier (Play Console > Associated developer accounts: create an Account Group, accept the terms). It is not automatic, and the 10% + 5% first-$1M row for EEA/UK/US/AU/JP links to the same enrolment article.
- Data safety form: for billing alone declare no Financial info while purchase tokens, order IDs and entitlements stay on the device. Declare Purchase history if purchase events are ever sent to analytics, an ad SDK or a server. Ad SDK data is declared separately.
- Content rating: answer the IARC questionnaire stating the game offers digital purchases and no random paid items. Expect the 'In-Game Purchases' interactive element; it does not change the age rating.
- Optional, not needed for acceptance: billing choice, alternative billing, external links (all opt-in); a backend, Real-time developer notifications and the Voided Purchases API (hardening). Decide whether to opt out of third-party US app store catalog sharing.
- EU distribution (recommended, not a Play rule): one paid currency, a real-money equivalent next to coin-priced items, pack sizes that match item prices, and coins never required to progress. This follows the March 2025 CPC principles and anticipates the Digital Fairness Act proposal of 11 Nov 2026, which targets paid currencies for minors. Alternatively leave EEA countries out at launch.

## Code notes

Signatures and nullability re-verified with javap against billing-9.1.0.aar; flow checked against developer.android.com/google/play/billing/integrate. NOT compiled (no Android SDK here). Callback API only, no billing-ktx.

// app/build.gradle.kts
// android { compileSdk = 36; defaultConfig { minSdk = 24; targetSdk = 36 } }   // API 36 is required for new apps since 2026-08-31
// dependencies { implementation("com.android.billingclient:billing:9.1.0") }
// Manifest: add nothing. BILLING (plus INTERNET and ACCESS_NETWORK_STATE transitively) is merged in.
// Do NOT copy Google's Java samples that call .enablePendingPurchases() with no argument: that overload was removed in 8.0.0.

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.*
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType

class Billing(
    private val activity: Activity,
    private val ui: (event: String, data: String) -> Unit   // forwards to webView.evaluateJavascript; always invoked on the main thread
) : PurchasesUpdatedListener {

    private val coinPacks = mapOf("coins_small" to 100, "coins_medium" to 550, "coins_large" to 1200) // consumables
    private val removeAds = "remove_ads"                                                               // non-consumable
    private val main = Handler(Looper.getMainLooper())
    private val prefs = activity.getSharedPreferences("billing", Context.MODE_PRIVATE)
    private val catalog = HashMap<String, ProductDetails>()   // main thread only; refreshed on connect, resume and shop open; never persisted

    private val client: BillingClient = BillingClient.newBuilder(activity.applicationContext)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()

    fun connect() {
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(r: BillingResult) {
                main.post { if (r.responseCode == BillingResponseCode.OK) refresh() else ui("store_unavailable", r.responseCode.toString()) }
            }
            override fun onBillingServiceDisconnected() { /* no-op: auto reconnection is enabled */ }
        })
    }
    fun onResume() {
        if (client.isReady) refresh()
        else if (client.connectionState == BillingClient.ConnectionState.DISCONNECTED) connect()
    }
    fun onShopOpened() = queryCatalog()                       // docs: stale ProductDetails can make launchBillingFlow fail
    fun onDestroy() = client.endConnection()
    private fun refresh() { queryCatalog(); queryOwned() }

    private fun queryCatalog() {
        val products = (coinPacks.keys + removeAds).map {
            QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(ProductType.INAPP).build()
        }
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build()) { r, result ->
            main.post {
                if (r.responseCode != BillingResponseCode.OK) { ui("store_unavailable", r.responseCode.toString()); return@post }
                catalog.clear()
                result.productDetailsList.forEach { catalog[it.productId] = it }
                // result.unfetchedProductList: statusCode PRODUCT_NOT_FOUND (3) = not created/active in Play Console yet,
                // NO_ELIGIBLE_OFFER (4), INVALID_PRODUCT_ID_FORMAT (2). Do not show those items.
                ui("catalog", catalog.keys.joinToString(",") { "$it=${priceOf(it)}" })
            }
        }
    }

    private fun offerOf(pd: ProductDetails): ProductDetails.OneTimePurchaseOfferDetails? =
        pd.oneTimePurchaseOfferDetails ?: pd.oneTimePurchaseOfferDetailsList?.firstOrNull()   // both getters are @Nullable
    fun priceOf(id: String): String? = catalog[id]?.let { offerOf(it) }?.formattedPrice         // localized string from Play; show it verbatim

    fun buy(id: String) {                                   // MUST run on the main thread
        val pd = catalog[id] ?: return ui("purchase_unavailable", id)
        if (id == removeAds && prefs.getBoolean(removeAds, false)) return ui("already_owned", id)
        val pdp = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd)
        offerOf(pd)?.offerToken?.let { pdp.setOfferToken(it) }                                 // getOfferToken() is @Nullable
        val r = client.launchBillingFlow(activity,
            BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(pdp.build())).build())
        if (r.responseCode != BillingResponseCode.OK) onError(r)
    }

    override fun onPurchasesUpdated(r: BillingResult, purchases: List<Purchase>?) {            // list is @Nullable
        main.post {
            when (r.responseCode) {
                BillingResponseCode.OK -> purchases?.forEach { handle(it) }
                BillingResponseCode.USER_CANCELED -> Unit
                BillingResponseCode.ITEM_ALREADY_OWNED -> queryOwned()
                else -> onError(r)
            }
        }
    }

    private fun queryOwned() {                              // also covers purchases made outside the app
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.INAPP).build()) { r, list ->
            main.post {
                if (r.responseCode != BillingResponseCode.OK) return@post          // keep last known state; retry next resume
                list.forEach { handle(it) }
                val owned = list.any { removeAds in it.products && it.purchaseState == Purchase.PurchaseState.PURCHASED }
                prefs.edit().putBoolean(removeAds, owned).apply()                   // restores on reinstall, drops after refund+revoke
                ui("entitlements", "remove_ads=$owned")
            }
        }
    }

    private fun handle(p: Purchase) {
        if (p.purchaseState == Purchase.PurchaseState.PENDING) return ui("purchase_pending", p.products.joinToString(","))
        if (p.purchaseState != Purchase.PurchaseState.PURCHASED) return
        val id = p.products.firstOrNull() ?: return
        if (id == removeAds) {
            prefs.edit().putBoolean(removeAds, true).apply(); ui("entitlements", "remove_ads=true")
            if (!p.isAcknowledged) client.acknowledgePurchase(
                AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.purchaseToken).build()
            ) { /* not OK: retried by queryOwned() on next resume; must succeed within 3 days */ }
        } else coinPacks[id]?.let { coins ->
            val granted = prefs.getStringSet("granted", emptySet())!!
            if (p.purchaseToken !in granted) {                                       // credit once per token, in one atomic write
                prefs.edit().putInt("coins", prefs.getInt("coins", 0) + coins * p.quantity)
                    .putStringSet("granted", granted + p.purchaseToken).commit()
                ui("coins_granted", (coins * p.quantity).toString())                 // JS shows "You received N coins"
            }
            client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(p.purchaseToken).build()) { _, _ ->
                // OK: pack can be bought again. ITEM_NOT_OWNED: already consumed. Other codes: retried on next resume.
            }
        }
    }

    private fun onError(r: BillingResult) = when (r.responseCode) {
        BillingResponseCode.NETWORK_ERROR, BillingResponseCode.SERVICE_UNAVAILABLE,
        BillingResponseCode.SERVICE_DISCONNECTED, BillingResponseCode.ERROR -> ui("purchase_retry", r.responseCode.toString())
        else -> ui("purchase_unavailable", r.responseCode.toString())   // BILLING_UNAVAILABLE (e.g. user in an unsupported country), ITEM_UNAVAILABLE, DEVELOPER_ERROR, FEATURE_NOT_SUPPORTED
    }
}

// WebView bridge: @JavascriptInterface methods run on a background thread, so hop to main:
//   @JavascriptInterface fun buy(id: String) { Handler(Looper.getMainLooper()).post { billing.buy(id) } }
//   @JavascriptInterface fun getCoins(): Int = prefs.getInt("coins", 0)     // let the page pull the balance on load
// Activity: onCreate -> billing.connect(); onResume -> billing.onResume(); onDestroy -> billing.onDestroy().
// onResume and onPurchasesUpdated can both deliver the same purchase after the Play dialog closes; the token ledger prevents a double credit,
// and a second consume/acknowledge call is harmless.
// Why callbacks, not KTX: billing-ktx 9.1.0 queryProductDetails() returns ProductDetailsResult(billingResult, productDetailsList) with no unfetched list.
// The AAR ships its own consumer ProGuard rules (proguard.txt); none need to be added.

## Open questions

- Which country are the developer's existing Play Console account and payments profile registered in? Syria is not on Google's developer or merchant registration list, so this decides whether IAP can be sold at all.
- Is Syria a selectable distribution country in Play Console, and what does its row say in the buyer-side table at play.google.com/supported-locations? That table is rendered by JavaScript and could not be read; it needs a look in a real browser or in Play Console > Production > Countries/regions. The consumer 'Paid app availability' list (which omits Syria) looks dated.
- Can an AdMob payments profile with a Syria address be created and paid out? Syria is off AdMob's restricted list since August 2025, but Google publishes no positive country list and payout methods depend on the payments address.
- Does the 10% + 5% first-$1M rate in EEA/UK/US/AU/JP require the same Account Group enrolment as the 15% tier? The fee table links that row to the enrolment article but does not say so in words.
- What rate applies in the 'remaining markets' to a developer who has not enrolled in the 15% tier? The fee page prints only the enrolled rate; 30% is inferred. The billing fee for markets rolling out on 31 Dec 2026 and 30 Sep 2027 is 'forthcoming'.
- With enableAutoServiceReconnection(), does the library retry after a failed initial startConnection, or only after an established connection drops? The docs describe reconnection on API calls; the outline also reconnects manually in onResume.
- Exact wording of the purchase questions in the Play Console IARC questionnaire was not seen; only the resulting interactive elements are confirmed from IARC and ESRB.
- Is the 'In-app purchases' label on the listing applied automatically once active products exist? No developer-side page describing this was found.
- Tax and identity paperwork tied to the payments profile (tax forms, verification documents) was not researched and may add steps before the first payout.
- Will the game be distributed in the EEA? If yes, the CPC principles and the Digital Fairness Act proposal of 11 Nov 2026 matter for a 13+ audience; the proposal's adoption timeline is unknown.
