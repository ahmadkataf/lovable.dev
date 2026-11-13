package com.zumurud.game

import androidx.activity.ComponentActivity

/**
 * The seam for real-money purchases and ads (contract: src/monetize/types.ts, "MonetizeBridge").
 *
 * The JS bridge validates its arguments, hops to the main thread and then calls one of these
 * methods; results travel back as JSON-encoded StoreEvents through [StoreEventSink], which the
 * activity delivers to the page as `window.__native.store(json)`.
 *
 * This build ships [NoStore]. A build with Google Play Billing and/or an ad SDK provides its own
 * implementation and returns it from [StoreControllers.create] — nothing else has to change.
 *
 * Threading: every method except [caps] is called on the main thread. [caps] is read once, when
 * the activity starts, and must describe what the build contains (not what is ready right now).
 */
interface StoreController {
    /** JSON `{"billing":boolean,"ads":boolean}` — what this build was compiled with. */
    fun caps(): String

    /** [idsJson]: JSON array of `{id, kind: 'consumable' | 'entitlement'}` → a 'products' event. */
    fun iapQuery(idsJson: String)

    /** Start the purchase flow → 'purchase' event(s). */
    fun iapBuy(id: String)

    /** The game has granted and saved this purchase: consume or acknowledge it. */
    fun iapFinish(token: String)

    /** Re-report what the store knows → an 'owned' event plus 'purchase' events for unfinished ones. */
    fun iapRestore()

    /** → an 'adResult' event. */
    fun adShowRewarded(placement: String)

    /** → an 'adResult' event. */
    fun adShowInterstitial()

    /** Open the consent "privacy options" form → an 'ads' event afterwards. */
    fun adPrivacyOptions()

    fun onResume() {}

    fun onPause() {}

    fun onDestroy() {}
}

/** Delivers one JSON-encoded StoreEvent to the page. Safe to call from any thread. */
fun interface StoreEventSink {
    fun emit(eventJson: String)
}

/** The one place that decides which [StoreController] a build uses. */
internal object StoreControllers {
    @Suppress("UNUSED_PARAMETER") // the activity is what a real store needs to show its purchase and ad screens
    fun create(activity: ComponentActivity, sink: StoreEventSink): StoreController = NoStore(sink)
}

/**
 * A build without billing or ads: says so in [caps] and answers every request with the
 * "unavailable" form of its event, so a page that asks anyway never waits for a reply.
 */
internal class NoStore(private val sink: StoreEventSink) : StoreController {
    override fun caps(): String = """{"billing":false,"ads":false}"""

    override fun iapQuery(idsJson: String) = sink.emit("""{"type":"products","products":[]}""")

    override fun iapBuy(id: String) =
        sink.emit("""{"type":"purchase","id":${org.json.JSONObject.quote(id)},"state":"unavailable"}""")

    override fun iapFinish(token: String) = Unit

    override fun iapRestore() = sink.emit("""{"type":"owned","ids":[]}""")

    override fun adShowRewarded(placement: String) =
        sink.emit("""{"type":"adResult","format":"rewarded","result":"failed"}""")

    override fun adShowInterstitial() =
        sink.emit("""{"type":"adResult","format":"interstitial","result":"failed"}""")

    override fun adPrivacyOptions() = sink.emit(
        """{"type":"ads","canRequestAds":false,"rewardedReady":false,"interstitialReady":false,"privacyOptionsRequired":false}""",
    )
}
