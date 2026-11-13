package com.zumurud.game

import androidx.activity.ComponentActivity
import org.json.JSONArray
import org.json.JSONObject

/**
 * The seam for real-money purchases and ads (contract: src/monetize/types.ts, "MonetizeBridge").
 *
 * The JS bridge validates its arguments, hops to the main thread and then calls one of these
 * methods; results travel back as JSON-encoded StoreEvents through [StoreEventSink], which the
 * activity delivers to the page as `window.__native.store(json)`.
 *
 * Every build ships [GameStore]: Google Play Billing ([BillingController]) plus whatever the build
 * flavour provides for ads ([AdsFactory]: the "ads" flavour brings AdMob, "plain" brings nothing).
 *
 * Threading: every method except [caps] is called on the main thread. [caps] is read once, when
 * the activity starts, and must describe what the build contains (not what is ready right now).
 */
interface StoreController {
    /** JSON `{"billing":boolean,"ads":boolean}` — what this build was compiled with. */
    fun caps(): String

    /** The page has installed `window.__native.store`: send the current 'ads' event again. */
    fun storeSync()

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

    /** A new document starts loading: whatever was sent to the old one is gone. */
    fun onPageStarted() {}

    fun onResume() {}

    fun onPause() {}

    fun onDestroy() {}
}

/** Delivers one JSON-encoded StoreEvent to the page. Safe to call from any thread. */
fun interface StoreEventSink {
    fun emit(eventJson: String)
}

/** What the store needs from the activity besides the activity itself. Main thread only. */
interface StoreHost {
    /** A full-screen ad or a consent form has closed: hide the system bars again. */
    fun restoreImmersiveMode()
}

/** The one place that decides which [StoreController] a build uses. */
internal object StoreControllers {
    fun create(activity: ComponentActivity, host: StoreHost, sink: StoreEventSink): StoreController =
        GameStore(activity, host, sink)
}

/**
 * Ads as the store sees them. The "ads" flavour implements it with AdMob and Google's consent SDK,
 * the "plain" flavour with an object that only ever answers "no ads" (each in its own source set,
 * behind `AdsFactory`). Main thread only.
 */
internal interface AdsController {
    /** Called once, when the activity is created: consent first, then the ad SDK, then the first ads. */
    fun start()

    /** Send the current 'ads' event, changed or not. */
    fun sync()

    fun showRewarded(placement: String)

    fun showInterstitial()

    fun showPrivacyOptions()

    fun onResume()

    fun onPause()

    fun onDestroy()
}

/** Purchases through Google Play in every build; ads from the build flavour. */
internal class GameStore(activity: ComponentActivity, host: StoreHost, sink: StoreEventSink) : StoreController {
    private val billing = BillingController(activity, sink)
    private val ads: AdsController = AdsFactory.create(activity, host, sink)

    /** False until the current document has been sent the 'ads' state it could not hear earlier. */
    private var pageSynced = false

    init {
        ads.start()
    }

    override fun caps(): String = JSONObject().put("billing", true).put("ads", AdsFactory.HAS_ADS).toString()

    override fun storeSync() {
        pageSynced = true
        ads.sync()
    }

    override fun iapQuery(idsJson: String) {
        syncOnce()
        billing.query(idsJson)
    }

    override fun iapBuy(id: String) = billing.buy(id)

    override fun iapFinish(token: String) = billing.finish(token)

    override fun iapRestore() {
        syncOnce()
        billing.restore()
    }

    override fun adShowRewarded(placement: String) = ads.showRewarded(placement)

    override fun adShowInterstitial() = ads.showInterstitial()

    override fun adPrivacyOptions() = ads.showPrivacyOptions()

    override fun onPageStarted() {
        pageSynced = false
    }

    override fun onResume() {
        billing.onResume()
        ads.onResume()
    }

    override fun onPause() {
        billing.onPause()
        ads.onPause()
    }

    override fun onDestroy() {
        billing.onDestroy()
        ads.onDestroy()
    }

    /** A page without storeSync() gets the 'ads' state with its first purchase request instead. */
    private fun syncOnce() {
        if (pageSynced) return
        pageSynced = true
        ads.sync()
    }
}

/**
 * The StoreEvents of src/monetize/types.ts as JSON text. Built with org.json only, so every value
 * is escaped; the activity then hands the text to the page as one quoted JavaScript string.
 */
internal object StoreEvents {
    fun products(items: List<Pair<String, String>>): String {
        val list = JSONArray()
        for ((id, price) in items) list.put(JSONObject().put("id", id).put("price", price))
        return JSONObject().put("type", "products").put("products", list).toString()
    }

    /**
     * @param token only with state "purchased": what the page passes to iapFinish
     * @param acknowledged only with a token: the store had acknowledged the purchase earlier
     * @param quantity only sent when above 1 (multi-quantity purchases, off by default in Play Console)
     */
    fun purchase(id: String, state: String, token: String? = null, acknowledged: Boolean = false, quantity: Int = 1): String {
        val event = JSONObject().put("type", "purchase").put("id", id).put("state", state)
        if (token != null) {
            event.put("token", token).put("acknowledged", acknowledged)
            if (quantity > 1) event.put("quantity", quantity)
        }
        return event.toString()
    }

    /** @param complete true only for the whole answer of a successful query of the store */
    fun owned(ids: Collection<String>, complete: Boolean): String {
        val event = JSONObject().put("type", "owned").put("ids", JSONArray(ids))
        if (complete) event.put("complete", true)
        return event.toString()
    }

    fun ads(canRequestAds: Boolean, rewardedReady: Boolean, interstitialReady: Boolean, privacyOptionsRequired: Boolean): String =
        JSONObject()
            .put("type", "ads")
            .put("canRequestAds", canRequestAds)
            .put("rewardedReady", rewardedReady)
            .put("interstitialReady", interstitialReady)
            .put("privacyOptionsRequired", privacyOptionsRequired)
            .toString()

    /** @param format "rewarded" | "interstitial"; @param result "earned" | "dismissed" | "failed" */
    fun adResult(format: String, result: String): String =
        JSONObject().put("type", "adResult").put("format", format).put("result", result).toString()

    const val NO_ADS: String =
        """{"type":"ads","canRequestAds":false,"rewardedReady":false,"interstitialReady":false,"privacyOptionsRequired":false}"""
}
