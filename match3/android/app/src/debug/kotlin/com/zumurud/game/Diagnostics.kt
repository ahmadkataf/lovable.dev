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

    fun onWebViewCreated(activity: MainActivity, webView: WebView, startUrl: String) {
        WebView.setWebContentsDebuggingEnabled(true)
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
            else -> Log.w(TAG, "unknown command")
        }
    }

    /** Lets the diagnostics page look at the native side of what it has just asked for. */
    private class DiagBridge(private val activity: MainActivity) {
        @Volatile
        private var snapshot: String = "{}"

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
