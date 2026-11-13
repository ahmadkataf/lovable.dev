package com.zumurud.game

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.HapticFeedbackConstants
import android.webkit.JavascriptInterface
import java.util.concurrent.atomic.AtomicLong

/**
 * The object the page sees as `window.AndroidBridge`
 * (contracts: src/platform/types.ts "AndroidBridge", src/monetize/types.ts "MonetizeBridge").
 *
 * Rules every method keeps:
 *  - It is called on the WebView's private bridge thread, never on the main thread: anything that
 *    touches views or the activity is posted to the main looper; the rest only reads volatile
 *    snapshots or uses thread-safe storage.
 *  - It never throws into JavaScript, whatever the page passes in (arguments are nullable because
 *    JavaScript may pass null/undefined, and are validated before use).
 *  - It returns immediately.
 */
internal class GameBridge(
    private val host: Host,
    private val save: SaveStore,
    private val store: StoreController,
) {
    /** What the bridge needs from the activity. Every method is called on the main thread. */
    interface Host {
        fun onPageReady()
        fun onAtRootChanged(atRoot: Boolean)
        fun performHaptic(feedbackConstant: Int)
        fun openStorePage()
    }

    private val main = Handler(Looper.getMainLooper())
    private val lastHapticAt = AtomicLong(0)
    private val storeCapsJson: String = try {
        store.caps()
    } catch (_: Throwable) {
        NO_STORE_CAPS
    }

    /** Set to false when the activity is destroyed: late calls from a dying page are dropped. */
    @Volatile
    var active: Boolean = true

    /** JSON of AppInfo; refreshed by the activity on the main thread. */
    @Volatile
    var infoJson: String = "{}"

    /** JSON `{"top","right","bottom","left"}` in CSS pixels; refreshed by the activity. */
    @Volatile
    var insetsJson: String = ZERO_INSETS

    // ───────────────────────── platform ─────────────────────────

    @JavascriptInterface
    fun loadSave(): String = guarded("") { save.load() }

    @JavascriptInterface
    fun storeSave(json: String?) = guarded(Unit) {
        if (!save.store(json)) Log.w(TAG, "storeSave ignored: the payload is missing or larger than ${SaveStore.MAX_BYTES} bytes")
    }

    @JavascriptInterface
    fun haptic(kind: String?) = guarded(Unit) {
        val constant = hapticConstant(kind) ?: return@guarded
        // A cascade can ask for many ticks in one frame; the motor only needs one.
        val now = SystemClock.uptimeMillis()
        val last = lastHapticAt.get()
        if (now - last < MIN_HAPTIC_GAP_MS || !lastHapticAt.compareAndSet(last, now)) return@guarded
        onMain { host.performHaptic(constant) }
    }

    @JavascriptInterface
    fun setAtRoot(atRoot: Boolean) = guarded(Unit) {
        onMain { host.onAtRootChanged(atRoot) }
    }

    @JavascriptInterface
    fun info(): String = infoJson

    @JavascriptInterface
    fun rate() = guarded(Unit) {
        onMain { host.openStorePage() }
    }

    /** The first screen is built: the splash screen can go. */
    @JavascriptInterface
    fun ready() = guarded(Unit) {
        onMain { host.onPageReady() }
    }

    @JavascriptInterface
    fun insets(): String = insetsJson

    // ───────────────────────── store (purchases, ads) ─────────────────────────

    @JavascriptInterface
    fun storeCaps(): String = storeCapsJson

    /** The page listens for StoreEvents now: have the current 'ads' event sent (again). */
    @JavascriptInterface
    fun storeSync() = guarded(Unit) {
        onMain { store.storeSync() }
    }

    @JavascriptInterface
    fun iapQuery(idsJson: String?) = guarded(Unit) {
        if (idsJson == null || idsJson.isEmpty() || idsJson.length > MAX_QUERY_CHARS) return@guarded
        onMain { store.iapQuery(idsJson) }
    }

    @JavascriptInterface
    fun iapBuy(id: String?) = guarded(Unit) {
        if (id == null || !PRODUCT_ID.matches(id)) return@guarded
        onMain { store.iapBuy(id) }
    }

    @JavascriptInterface
    fun iapFinish(token: String?) = guarded(Unit) {
        if (token == null || token.isEmpty() || token.length > MAX_TOKEN_CHARS) return@guarded
        onMain { store.iapFinish(token) }
    }

    @JavascriptInterface
    fun iapRestore() = guarded(Unit) {
        onMain { store.iapRestore() }
    }

    @JavascriptInterface
    fun adShowRewarded(placement: String?) = guarded(Unit) {
        if (placement == null || !PLACEMENT.matches(placement)) return@guarded
        onMain { store.adShowRewarded(placement) }
    }

    @JavascriptInterface
    fun adShowInterstitial() = guarded(Unit) {
        onMain { store.adShowInterstitial() }
    }

    @JavascriptInterface
    fun adPrivacyOptions() = guarded(Unit) {
        onMain { store.adPrivacyOptions() }
    }

    // ───────────────────────── helpers ─────────────────────────

    private inline fun <T> guarded(fallback: T, block: () -> T): T = try {
        if (active) block() else fallback
    } catch (error: Throwable) {
        Log.w(TAG, "bridge call failed: ${error.javaClass.simpleName}")
        fallback
    }

    private fun onMain(action: () -> Unit) {
        main.post {
            if (!active) return@post
            try {
                action()
            } catch (error: Throwable) {
                Log.w(TAG, "bridge action failed: ${error.javaClass.simpleName}")
            }
        }
    }

    private fun hapticConstant(kind: String?): Int? = when (kind) {
        "light" -> HapticFeedbackConstants.CLOCK_TICK
        "medium" -> HapticFeedbackConstants.CONTEXT_CLICK
        "heavy" -> HapticFeedbackConstants.LONG_PRESS
        "success" -> if (android.os.Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.CONTEXT_CLICK
        "error" -> if (android.os.Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
        else -> null
    }

    companion object {
        const val JS_NAME = "AndroidBridge"
        const val ZERO_INSETS = """{"top":0,"right":0,"bottom":0,"left":0}"""
        private const val NO_STORE_CAPS = """{"billing":false,"ads":false}"""
        private const val TAG = "Zumurud"
        private const val MIN_HAPTIC_GAP_MS = 20L
        private const val MAX_QUERY_CHARS = 16 * 1024
        private const val MAX_TOKEN_CHARS = 4096
        private val PRODUCT_ID = Regex("[a-z0-9][a-z0-9_.]{0,99}")
        private val PLACEMENT = Regex("[A-Za-z][A-Za-z0-9_]{0,39}")
    }
}
