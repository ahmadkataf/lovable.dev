package com.zumurud.game

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.util.TypedValue
import android.view.ActionMode
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import androidx.core.content.pm.PackageInfoCompat
import androidx.core.graphics.Insets
import androidx.core.net.toUri
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebResourceErrorCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import kotlin.math.ceil
import org.json.JSONObject

/**
 * The whole app: one full-screen WebView showing the bundled game, plus the native pieces a web
 * page cannot do for itself (splash screen, system bars and cutouts, Back, saves, haptics,
 * lifecycle, recovery when the WebView's renderer dies).
 *
 * The page is served from the APK only (see [LocalContent]); it has no way to reach the network —
 * the app does hold the INTERNET permission (Google Play Billing and, in the "ads" flavour, the ad
 * SDK bring it), but this WebView blocks every network load and every request to another origin.
 * Purchases and ads are native ([StoreController]); the page only talks to them over the bridge.
 */
class MainActivity : ComponentActivity(), GameBridge.Host, StoreHost {

    private lateinit var root: FrameLayout
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var bridge: GameBridge
    private lateinit var store: StoreController
    private lateinit var saves: SaveStore

    private var webView: WebView? = null
    private var errorView: View? = null
    private var startUrl: String = LocalContent.GAME_URL

    private var resumed = false
    private var inBackground = false
    private var createdAt = 0L
    private var splashMaxMs = SPLASH_MAX_MS
    private var lastDensityDpi = 0
    private var lastStorePageAt = 0L

    /** Flips once: the page has drawn its first screen (or failed), so the splash screen may go. */
    private val pageReady = AtomicBoolean(false)

    /** uptimeMillis of recent renderer losses, to stop a crash loop from spinning forever. */
    private val rendererLosses = ArrayDeque<Long>()
    private var rendererRestarts = 0

    /**
     * Enabled while the game has something of its own to close (a dialog, a level…): Back then goes
     * to the page. Disabled at the game's root screen — and until the page says otherwise — so the
     * system runs its own Back, including the predictive back-to-home animation.
     */
    private val backToPage = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() = callPageHook("back")
    }

    // ───────────────────────── lifecycle ─────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        createdAt = SystemClock.uptimeMillis()
        splashMaxMs = Diagnostics.splashMaxMs(intent) ?: SPLASH_MAX_MS
        splash.setKeepOnScreenCondition { splashUp() }
        lastDensityDpi = resources.configuration.densityDpi

        setUpWindow()

        // A native root in the game's night colour sits behind the WebView, so there is never a
        // white frame: not before the first paint, not while a WebView is being replaced.
        root = FrameLayout(this)
        root.setBackgroundColor(ContextCompat.getColor(this, R.color.night))
        setContentView(root, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        // The listener sits on the root, not on the WebView: on Android 9–11 the WebView installs
        // its own insets listener and a second one would replace it. Insets are passed on untouched
        // and nothing is padded natively — the game paints edge to edge and pads its own UI.
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            publishInsets(insets)
            insets
        }

        saves = SaveStore(this)
        // Purchases and ads. Events go to the page as window.__native.store("<json>"): the JSON
        // text is passed as one quoted JavaScript string (see callPageHook / jsString).
        store = StoreControllers.create(this, this) { eventJson ->
            runOnUiThread { if (!isDestroyed) callPageHook("store", eventJson) }
        }
        bridge = GameBridge(this, saves, store)
        publishInfo()

        assetLoader = LocalContent.createLoader(this, Diagnostics.EXTRA_ASSET_ROOTS)
        startUrl = Diagnostics.startUrl(intent) ?: LocalContent.GAME_URL

        onBackPressedDispatcher.addCallback(this, backToPage)
        applyOrientationPolicy(resources.configuration)
        createWebView()
        // The splash screen's condition is only asked again when a frame is about to be drawn, and
        // a page that has stopped changing (or never started) draws none. Ask for a frame when
        // the time limit is up, and once more a little later, so the splash screen always leaves.
        root.postDelayed(redrawForSplash, splashMaxMs + 20)
        root.postDelayed(redrawForSplash, splashMaxMs + 500)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        Diagnostics.onNewIntent(this, intent)
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        inBackground = false
        hideSystemBars()
        webView?.onResume()
        callPageHook("resume")
        store.onResume()
    }

    override fun onPause() {
        // The page stops its music and its loop in the hook; WebView.onPause() then makes the
        // document hidden. pauseTimers() is deliberately not used: it would freeze every WebView in
        // the process, including the ones an ad SDK owns.
        callPageHook("pause")
        webView?.onPause()
        store.onPause()
        resumed = false
        inBackground = true
        super.onPause()
    }

    override fun onDestroy() {
        bridge.active = false
        root.removeCallbacks(redrawForSplash)
        store.onDestroy()
        destroyWebView()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    /**
     * Rotation, resizing, folding, density, locale, font scale and dark mode all arrive here (see
     * android:configChanges): the activity and its WebView are never recreated for them, so a level
     * in progress survives.
     */
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        applyOrientationPolicy(newConfig)
        publishInfo()
        hideSystemBars()
        ViewCompat.requestApplyInsets(root)
        if (newConfig.densityDpi != lastDensityDpi) {
            lastDensityDpi = newConfig.densityDpi
            root.postDelayed({ repairViewportScale(VIEWPORT_REPAIR_ATTEMPTS) }, VIEWPORT_REPAIR_DELAY_MS)
        }
    }

    /**
     * The splash screen stays until the page calls AndroidBridge.ready(), but never longer than
     * [splashMaxMs]: a page that fails to start must not hide behind the logo.
     */
    private fun splashUp(): Boolean = !pageReady.get() && SystemClock.uptimeMillis() - createdAt < splashMaxMs

    private val redrawForSplash = Runnable {
        if (!isDestroyed) root.invalidate()
    }

    /**
     * The WebView converts its size to CSS pixels only when its pixel size changes. When the screen
     * density changes and the pixel size does not (the "display size" setting, a second screen with
     * another density), that conversion goes stale: the page is laid out for the old density and
     * painted into a corner of the view. Detect it — the page's width must equal the view's width
     * in dp — and repair it by resizing the WebView by one pixel for a single layout pass.
     */
    private fun repairViewportScale(attemptsLeft: Int) {
        val view = webView ?: return
        if (view.width == 0 || isDestroyed) return
        view.evaluateJavascript("window.innerWidth") { value ->
            val cssWidth = value?.toFloatOrNull()
            if (view !== webView || cssWidth == null || view.width == 0) return@evaluateJavascript
            val expected = view.width / resources.displayMetrics.density
            if (abs(cssWidth - expected) <= 1.5f) return@evaluateJavascript
            view.layout(view.left, view.top, view.right, view.bottom - 1)
            view.requestLayout()
            if (attemptsLeft > 1) root.postDelayed({ repairViewportScale(attemptsLeft - 1) }, VIEWPORT_REPAIR_DELAY_MS)
        }
    }

    // ───────────────────────── window ─────────────────────────

    private fun setUpWindow() {
        // Edge to edge on every Android version (it is mandatory from Android 15 on anyway).
        WindowCompat.enableEdgeToEdge(window)
        // No translucent scrim behind a three-button navigation bar when it slides in.
        if (Build.VERSION.SDK_INT >= 29) window.isNavigationBarContrastEnforced = false
        if (Build.VERSION.SDK_INT >= 28) {
            // Draw into the camera cutout in every state, so the layout does not jump when the
            // system bars come and go. The themes in values-v28 / values-v30 say the same.
            val attributes = window.attributes
            attributes.layoutInDisplayCutoutMode = if (Build.VERSION.SDK_INT >= 30) {
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            } else {
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
            window.attributes = attributes
        }
        hideSystemBars()
    }

    /** Immersive: bars hidden, a swipe from the edge shows them for a moment over the game. */
    private fun hideSystemBars() {
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }

    /**
     * Phones play in portrait. Anything with a smallest width of 600dp or more (tablets, unfolded
     * foldables, desktop windows) rotates and resizes freely; so does any multi-window mode.
     */
    private fun applyOrientationPolicy(config: Configuration) {
        val phone = config.smallestScreenWidthDp in 1 until LARGE_SCREEN_MIN_WIDTH_DP && !isInMultiWindowMode
        val wanted = if (phone) ActivityInfo.SCREEN_ORIENTATION_PORTRAIT else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        if (requestedOrientation != wanted) requestedOrientation = wanted
    }

    /**
     * Tell the page how much of each edge is covered: the union of the display cutout and of the
     * system bars that are currently visible (hidden bars count as 0; a desktop caption bar counts),
     * in CSS pixels.
     */
    private fun publishInsets(insets: WindowInsetsCompat) {
        val covered = Insets.max(
            insets.getInsets(WindowInsetsCompat.Type.systemBars()),
            insets.getInsets(WindowInsetsCompat.Type.displayCutout()),
        )
        val density = resources.displayMetrics.density.takeIf { it > 0f } ?: 1f
        fun css(px: Int): Int = ceil(px / density).toInt().coerceAtLeast(0)
        val json = """{"top":${css(covered.top)},"right":${css(covered.right)},"bottom":${css(covered.bottom)},"left":${css(covered.left)}}"""
        if (json == bridge.insetsJson) return
        bridge.insetsJson = json
        callPageHook("insets", json)
    }

    private fun publishInfo() {
        try {
            val info = packageManager.getPackageInfo(packageName, 0)
            val locale = resources.configuration.locales[0]
            bridge.infoJson = JSONObject()
                .put("versionName", info.versionName ?: "")
                .put("versionCode", PackageInfoCompat.getLongVersionCode(info))
                .put("locale", locale.toLanguageTag())
                .toString()
        } catch (error: Exception) {
            Log.w(TAG, "could not read the app info: ${error.javaClass.simpleName}")
        }
    }

    // ───────────────────────── WebView ─────────────────────────

    private fun createWebView() {
        val view = try {
            GameWebView(this)
        } catch (error: Throwable) {
            // No usable WebView on the device right now — typically while "Android System WebView"
            // is being updated or is disabled. Say so instead of crashing; Retry tries again.
            Log.e(TAG, "the WebView could not be created: ${error.javaClass.simpleName}")
            showError("no WebView")
            return
        }
        // Once per process, before the first page loads (needs the WebView library loaded).
        LocalContent.lockServiceWorkers(hasOtherWebContent = AdsFactory.HAS_ADS)
        view.setBackgroundColor(ContextCompat.getColor(this, R.color.night))
        view.overScrollMode = View.OVER_SCROLL_NEVER
        view.isVerticalScrollBarEnabled = false
        view.isHorizontalScrollBarEnabled = false
        // No long-press behaviour of any kind: no text selection, no context menu, and no buzz
        // (a consumed long click would otherwise vibrate each time a finger rests on the board).
        view.isHapticFeedbackEnabled = false
        view.setOnLongClickListener { true }
        view.isFocusable = true
        view.isFocusableInTouchMode = true

        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            // Already the default on every supported Android version; stated because it matters.
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = false
            // The page must never reach the network, although the app has the INTERNET permission
            // (billing and ad libraries need it). Without this line the default would be "allow".
            // Bundled files still load: they are answered by shouldInterceptRequest, not fetched.
            blockNetworkLoads = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            // Game text is laid out in CSS pixels; the system font size must not rescale it.
            textZoom = 100
            // Web Audio starts without waiting for a tap (the game still resumes it on first touch).
            mediaPlaybackRequiresUserGesture = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            setGeolocationEnabled(false)
            // Only bundled files are ever loaded, so there is nothing for Safe Browsing to check.
            if (Build.VERSION.SDK_INT >= 26) safeBrowsingEnabled = false
        }

        view.webViewClient = PageClient()
        view.webChromeClient = ChromeClient()
        view.addJavascriptInterface(bridge, GameBridge.JS_NAME)
        Diagnostics.onWebViewCreated(this, view, startUrl)

        root.addView(view, 0, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        webView = view
        backToPage.isEnabled = false
        // Created while the app is in the background (after a renderer loss): start it paused.
        if (inBackground) view.onPause()
        view.loadUrl(startUrl)
        view.requestFocus()
    }

    private fun destroyWebView() {
        val view = webView ?: return
        webView = null
        root.removeView(view)
        view.removeJavascriptInterface(GameBridge.JS_NAME)
        view.destroy()
    }

    /**
     * Call `window.__native.<name>(arg?)` if the page has installed that hook. Main thread only.
     * [name] is always one of our own constants; [arg] is passed as a JavaScript string literal.
     */
    private fun callPageHook(name: String, arg: String? = null) {
        val view = webView ?: return
        val argument = if (arg == null) "" else jsString(arg)
        view.evaluateJavascript(
            "(function(){var h=window.__native;if(h&&typeof h.$name==='function'){try{h.$name($argument)}" +
                "catch(e){console.error('[native] $name hook failed: '+e)}}})()",
            null,
        )
    }

    private fun jsString(text: String): String =
        // JSONObject.quote escapes quotes, backslashes and control characters; the two Unicode line
        // separators are legal in JSON but end a string literal in older JavaScript engines.
        JSONObject.quote(text).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")

    private inner class PageClient : WebViewClientCompat() {
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
            LocalContent.respond(assetLoader, request.url)

        /** Returning true cancels the navigation: only bundled pages may be opened. */
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            !LocalContent.isLocalPage(request.url, Diagnostics.EXTRA_ASSET_ROOTS)

        override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
            // A fresh document has not said where it is yet: treat it as the root screen.
            if (view !== webView) return
            backToPage.isEnabled = false
            store.onPageStarted()
        }

        override fun onPageFinished(view: WebView, url: String?) {
            if (view !== webView) return
            Log.i(TAG, "page loaded ${SystemClock.uptimeMillis() - createdAt} ms after start")
            callPageHook("insets", bridge.insetsJson)
            if (!resumed) callPageHook("pause")
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceErrorCompat) {
            if (request.isForMainFrame && view === webView) showError("load error")
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
            if (request.isForMainFrame && view === webView) showError("HTTP ${errorResponse.statusCode}")
        }

        /**
         * The WebView's renderer process crashed or was killed by the system to reclaim memory.
         * Returning true keeps the app alive; the dead WebView is replaced and the game reloads
         * (its progress is in the save file).
         */
        @RequiresApi(Build.VERSION_CODES.O) // the platform only makes this call on Android 8+
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            Log.w(TAG, "WebView renderer gone (${if (detail.didCrash()) "crashed" else "killed by the system"})")
            if (view === webView) {
                destroyWebView()
                root.post { recoverFromRendererLoss() }
            } else {
                (view.parent as? android.view.ViewGroup)?.removeView(view)
                view.destroy()
            }
            return true
        }
    }

    private fun recoverFromRendererLoss() {
        if (isFinishing || isDestroyed || webView != null) return
        val now = SystemClock.uptimeMillis()
        while (rendererLosses.isNotEmpty() && now - rendererLosses.first() > RENDERER_LOSS_WINDOW_MS) rendererLosses.removeFirst()
        rendererLosses.addLast(now)
        rendererRestarts++
        if (rendererLosses.size > MAX_RENDERER_LOSSES) {
            // It keeps dying: stop retrying on our own and let the player decide.
            showError("renderer lost repeatedly")
        } else {
            createWebView()
        }
    }

    private inner class ChromeClient : WebChromeClient() {
        /** Page warnings and errors go to Logcat (tag ZumurudJS); returning true stops the default log line. */
        override fun onConsoleMessage(message: ConsoleMessage): Boolean {
            val level = message.messageLevel()
            val important = level == ConsoleMessage.MessageLevel.ERROR || level == ConsoleMessage.MessageLevel.WARNING
            if (!important && !Diagnostics.VERBOSE_CONSOLE) return true
            val source = message.sourceId()?.substringAfterLast('/')?.substringBefore('?').orEmpty()
            val text = message.message().orEmpty().take(MAX_CONSOLE_CHARS) +
                if (source.isEmpty()) "" else " ($source:${message.lineNumber()})"
            when (level) {
                ConsoleMessage.MessageLevel.ERROR -> Log.e(JS_TAG, text)
                ConsoleMessage.MessageLevel.WARNING -> Log.w(JS_TAG, text)
                else -> Log.i(JS_TAG, text)
            }
            return true
        }

        // A game has no use for browser dialogs or device permissions: answer them without any UI.
        override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
            result?.confirm()
            return true
        }

        override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
            result?.cancel()
            return true
        }

        override fun onJsPrompt(view: WebView?, url: String?, message: String?, defaultValue: String?, result: JsPromptResult?): Boolean {
            result?.cancel()
            return true
        }

        override fun onJsBeforeUnload(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
            result?.confirm()
            return true
        }

        override fun onPermissionRequest(request: PermissionRequest?) {
            request?.deny()
        }
    }

    // ───────────────────────── error screen ─────────────────────────

    /** Shown instead of a blank page when the game itself could not be loaded. */
    private fun showError(reason: String) {
        Log.e(TAG, "the game page could not be shown: $reason")
        pageReady.set(true) // never leave the splash screen up over an error
        webView?.visibility = View.INVISIBLE
        if (errorView != null) return

        val night = ContextCompat.getColor(this, R.color.night)
        val gold = ContextCompat.getColor(this, R.color.gold)
        val cream = ContextCompat.getColor(this, R.color.cream)
        fun dp(value: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

        val title = TextView(this).apply {
            setText(R.string.error_title)
            setTextColor(gold)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            gravity = Gravity.CENTER
        }
        val message = TextView(this).apply {
            setText(R.string.error_message)
            setTextColor(cream)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, dp(24))
        }
        val retry = Button(this).apply {
            setText(R.string.error_retry)
            setTextColor(night)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            isAllCaps = false
            minHeight = dp(56)
            minWidth = dp(180)
            setPadding(dp(32), 0, dp(32), 0)
            background = GradientDrawable().apply {
                setColor(gold)
                cornerRadius = dp(28).toFloat()
            }
            stateListAnimator = null
            setOnClickListener { retryAfterError() }
        }
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(night)
            setPadding(dp(32), dp(32), dp(32), dp(32))
            isClickable = true // swallow touches meant for whatever lies underneath
            addView(title, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
            addView(message, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
            addView(retry, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT))
        }
        root.addView(column, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        errorView = column
        backToPage.isEnabled = false
    }

    internal fun retryAfterError() {
        errorView?.let { root.removeView(it) }
        errorView = null
        rendererLosses.clear()
        val view = webView
        if (view == null) {
            createWebView()
        } else {
            view.visibility = View.VISIBLE
            view.loadUrl(startUrl)
        }
    }

    // ───────────────────────── GameBridge.Host (main thread) ─────────────────────────

    override fun onPageReady() {
        if (pageReady.compareAndSet(false, true)) root.invalidate()
    }

    override fun onAtRootChanged(atRoot: Boolean) {
        backToPage.isEnabled = !atRoot && errorView == null
    }

    /**
     * View haptics need no VIBRATE permission and follow the user's system-wide touch-feedback
     * setting. Performed on the root because the WebView's own haptics are switched off.
     */
    override fun performHaptic(feedbackConstant: Int) {
        root.performHapticFeedback(feedbackConstant)
    }

    /** The game's page on Google Play (for rating), in the Play Store app or else a browser. */
    override fun openStorePage() {
        val now = SystemClock.uptimeMillis()
        if (!resumed || now - lastStorePageAt < STORE_PAGE_MIN_GAP_MS) return
        lastStorePageAt = now
        val market = Intent(Intent.ACTION_VIEW, "market://details?id=$packageName".toUri())
        val web = Intent(Intent.ACTION_VIEW, "https://play.google.com/store/apps/details?id=$packageName".toUri())
        if (!tryStart(market)) tryStart(web)
    }

    private fun tryStart(intent: Intent): Boolean = try {
        startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (_: ActivityNotFoundException) {
        false
    } catch (_: SecurityException) {
        false
    }

    // ───────────────────────── StoreHost ─────────────────────────

    /** A full-screen ad or a consent form took the system bars out of hiding: hide them again. */
    override fun restoreImmersiveMode() {
        if (!isDestroyed) hideSystemBars()
    }

    /** Called on the store's worker thread, before a purchase is consumed or acknowledged. */
    override fun flushSave(): Boolean = saves.flush()

    // ───────────────────────── diagnostics (debug builds only use these) ─────────────────────────

    internal val currentWebView: WebView? get() = webView

    internal fun stateForDiagnostics(): String = JSONObject()
        .put("backToPage", backToPage.isEnabled)
        .put("resumed", resumed)
        .put("rendererRestarts", rendererRestarts)
        .put("errorShown", errorView != null)
        .put("requestedOrientation", requestedOrientation)
        .put("smallestWidthDp", resources.configuration.smallestScreenWidthDp)
        .put("fontScale", resources.configuration.fontScale.toDouble())
        .put("pageReady", pageReady.get())
        .put("splashUp", splashUp())
        .put("densityDpi", resources.configuration.densityDpi)
        .put("sdk", Build.VERSION.SDK_INT)
        .toString()

    /** A WebView that never starts a text-selection or context action mode. */
    private class GameWebView(context: Context) : WebView(context) {
        override fun startActionMode(callback: ActionMode.Callback?): ActionMode? = null

        override fun startActionMode(callback: ActionMode.Callback?, type: Int): ActionMode? = null
    }

    private companion object {
        const val TAG = "Zumurud"
        const val JS_TAG = "ZumurudJS"
        const val SPLASH_MAX_MS = 3000L
        const val LARGE_SCREEN_MIN_WIDTH_DP = 600
        const val STORE_PAGE_MIN_GAP_MS = 1500L
        const val MAX_CONSOLE_CHARS = 2000
        const val MAX_RENDERER_LOSSES = 3
        const val RENDERER_LOSS_WINDOW_MS = 60_000L
        const val VIEWPORT_REPAIR_ATTEMPTS = 5
        const val VIEWPORT_REPAIR_DELAY_MS = 300L
    }
}
