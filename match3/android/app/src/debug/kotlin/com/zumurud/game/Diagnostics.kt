package com.zumurud.game

import android.content.Intent
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView

/**
 * Debug builds only (the release source set has an empty twin of this object).
 *
 * Adds a self-test page that exercises the whole wrapper on a real device:
 *
 *     adb shell am start -n com.zumurud.game/.MainActivity --ez diag true
 *
 * (add `--ei splashMs 60000` to keep the splash screen up until the page calls ready()), and a few commands for an already running diagnostics session, used by tools/android/emu-smoke.sh:
 *
 *     adb shell am start -n com.zumurud.game/.MainActivity --es diagcmd crash    renderer crash
 *     … --es diagcmd kill      renderer killed (as the system does under memory pressure)
 *     … --es diagcmd badurl    main-frame load failure → native error screen
 *     … --es diagcmd retry     press the error screen's Retry button
 *     … --es diagcmd reload    reload the diagnostics page
 *     … --es diagcmd rate      call AndroidBridge.rate() (opens the store page, or does nothing)
 *     … --es diagcmd store-show | store-hide        open / close the page's store panel
 *     … --es diagcmd store-query | store-restore | store-buy | store-rewarded | store-interstitial |
 *                    store-privacy | store-sync       press the matching button of that panel
 *                                                     (store-buy buys the product selected there)
 */
internal object Diagnostics {
    private const val ROOT = "diag"
    private const val TAG = "ZumurudDiag"

    val EXTRA_ASSET_ROOTS: List<String> = listOf(ROOT)

    /** Debug builds also copy console.log / console.info to Logcat (tag ZumurudJS). */
    const val VERBOSE_CONSOLE = true

    private val DIAG_URL = LocalContent.urlFor(ROOT, "index.html")

    fun startUrl(intent: Intent?): String? =
        if (intent?.getBooleanExtra("diag", false) == true) DIAG_URL else null

    /** `--ei splashMs 60000` holds the splash screen longer, to study what a page can do behind it. */
    fun splashMaxMs(intent: Intent?): Long? =
        intent?.getIntExtra("splashMs", 0)?.takeIf { it in 1..120_000 }?.toLong()

    /** URLs the request filter refused, newest last (the diagnostics page asks how many matched). */
    private val blocked = java.util.concurrent.CopyOnWriteArrayList<String>()

    fun onWebViewCreated(activity: MainActivity, webView: WebView, startUrl: String) {
        WebView.setWebContentsDebuggingEnabled(true)
        LocalContent.onBlocked = { url ->
            if (blocked.size >= 200) blocked.removeAt(0)
            blocked.add(url)
        }
        if (startUrl == DIAG_URL) webView.addJavascriptInterface(DiagBridge(activity), "DiagBridge")
    }

    fun onNewIntent(activity: MainActivity, intent: Intent) {
        val command = intent.getStringExtra("diagcmd") ?: return
        val webView = activity.currentWebView
        Log.i(TAG, "command: $command")
        when (command) {
            "crash" -> webView?.loadUrl("chrome://crash")
            "kill" -> webView?.loadUrl("chrome://kill")
            "badurl" -> webView?.loadUrl(LocalContent.urlFor("www", "no-such-page.html"))
            "retry" -> activity.retryAfterError()
            "reload" -> webView?.reload()
            "rate" -> webView?.evaluateJavascript("AndroidBridge.rate()", null)
            "store-show", "store-hide", "store-query", "store-restore", "store-buy", "store-rewarded", "store-interstitial",
            "store-privacy", "store-sync",
            ->
                webView?.evaluateJavascript("window.__diagStore&&window.__diagStore('${command.removePrefix("store-")}')", null)
            else -> Log.w(TAG, "unknown command")
        }
    }

    /** Lets the diagnostics page look at the native side of what it has just asked for. */
    private class DiagBridge(private val activity: MainActivity) {
        @Volatile
        private var snapshot: String = "{}"

        /** How many requests containing [marker] the wrapper's request filter has refused so far. */
        @JavascriptInterface
        fun blockedCount(marker: String?): Int {
            val text = marker?.takeIf { it.isNotEmpty() } ?: return 0
            return blocked.count { it.contains(text) }
        }

        /** What iapFinish does before it consumes or acknowledges: force the save onto disk. (Bridge thread: may block.) */
        @JavascriptInterface
        fun flushSave(): Boolean = activity.flushSave()

        /** Asynchronous on purpose: the state is read on the main thread, then handed to `callback`. */
        @JavascriptInterface
        fun requestState(callbackName: String?) {
            val name = callbackName?.takeIf { Regex("[A-Za-z_][A-Za-z0-9_]{0,40}").matches(it) } ?: return
            activity.runOnUiThread {
                snapshot = activity.stateForDiagnostics()
                activity.currentWebView?.evaluateJavascript("window.$name&&window.$name($snapshot)", null)
            }
        }
    }
}
