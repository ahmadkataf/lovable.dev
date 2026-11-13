package com.zumurud.game

import android.content.Intent
import android.webkit.WebView

/**
 * Release builds have no diagnostics: no extra page, no extra bridge, no intent commands.
 * (The debug source set has the real one; this twin keeps MainActivity free of build checks.)
 */
@Suppress("UNUSED_PARAMETER")
internal object Diagnostics {
    val EXTRA_ASSET_ROOTS: List<String> = emptyList()
    const val VERBOSE_CONSOLE = false

    fun startUrl(intent: Intent?): String? = null

    fun onWebViewCreated(activity: MainActivity, webView: WebView, startUrl: String) = Unit

    fun onNewIntent(activity: MainActivity, intent: Intent) = Unit
}
