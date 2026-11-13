package com.zumurud.game

import android.content.Context
import android.content.res.AssetManager
import android.net.Uri
import android.util.Log
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.IOException
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger

/**
 * Everything the WebView is allowed to load.
 *
 * The game is served from the APK's assets under one fixed https origin
 * (https://appassets.androidplatform.net/assets/www/…) so it gets a real same-origin policy, ES
 * modules, fetch() and localStorage — and nothing else is reachable: every request that is not a
 * bundled file is answered right here with an empty error response, so no request ever gets as
 * far as the network stack. That matters: the app holds the INTERNET permission for Google Play
 * Billing (and, in the "ads" flavour, for the ad SDK), and the page must still be offline.
 */
internal object LocalContent {
    const val HOST: String = WebViewAssetLoader.DEFAULT_DOMAIN
    private const val GAME_ROOT = "www"

    /** The one page the app shows. */
    const val GAME_URL: String = "https://$HOST/assets/$GAME_ROOT/index.html"

    fun urlFor(assetRoot: String, file: String): String = "https://$HOST/assets/$assetRoot/$file"

    /**
     * @param extraRoots further asset directories to serve next to the game (the debug build adds
     * its diagnostics page); empty in release builds.
     */
    fun createLoader(context: Context, extraRoots: List<String>): WebViewAssetLoader {
        val builder = WebViewAssetLoader.Builder().setDomain(HOST).setHttpAllowed(false)
        for (root in listOf(GAME_ROOT) + extraRoots) {
            builder.addPathHandler("/assets/$root/", BundledFiles(context.assets, root))
        }
        return builder.build()
    }

    /** True for pages the WebView may navigate to: bundled files only. */
    fun isLocalPage(url: Uri?, extraRoots: List<String>): Boolean {
        if (url == null || !isLocalOrigin(url)) return false
        val path = url.path ?: return false
        return (listOf(GAME_ROOT) + extraRoots).any { path.startsWith("/assets/$it/") }
    }

    /**
     * The answer to a request made by the page (called on a WebView worker thread).
     * `null` means "let the WebView handle it" and is only returned for URLs that live in memory.
     */
    fun respond(loader: WebViewAssetLoader, url: Uri?): WebResourceResponse? {
        if (url == null) return blocked(null)
        when (url.scheme?.lowercase(Locale.ROOT)) {
            // In-memory URLs (canvas.toDataURL images, Blob URLs): no network involved.
            "data", "blob", "about" -> return null
        }
        if (!isLocalOrigin(url)) return blocked(url)
        return loader.shouldInterceptRequest(url) ?: notFound()
    }

    /** Debug builds count refused requests here (the diagnostics page asks for them). */
    @Volatile
    var onBlocked: ((String) -> Unit)? = null

    private val blockedLogLines = AtomicInteger()

    private fun isLocalOrigin(url: Uri): Boolean =
        url.scheme.equals("https", ignoreCase = true) &&
            url.host.equals(HOST, ignoreCase = true) &&
            (url.port == -1 || url.port == 443)

    /**
     * The page asked for something outside the APK. The bundled game never does, so the first few
     * are worth a line in the log (scheme and host only).
     */
    private fun blocked(url: Uri?): WebResourceResponse {
        if (blockedLogLines.incrementAndGet() <= MAX_BLOCKED_LOG_LINES) {
            Log.w(TAG, "blocked a request of the page to ${url?.scheme}://${url?.host}")
        }
        onBlocked?.invoke(url?.toString().orEmpty())
        return empty(403, "Blocked")
    }

    private fun notFound() = empty(404, "Not Found")

    private fun empty(status: Int, reason: String) = WebResourceResponse(
        "text/plain",
        "utf-8",
        status,
        reason,
        mapOf("Cache-Control" to "no-store"),
        ByteArrayInputStream(ByteArray(0)),
    )

    /**
     * Serves one asset directory. Unlike the stock AssetsPathHandler it does not ask the OS for the
     * MIME type: the platform tables differ between Android versions (and do not know .woff2 or
     * .mjs everywhere), while module scripts are refused unless they arrive as JavaScript.
     */
    private class BundledFiles(private val assets: AssetManager, private val root: String) : WebViewAssetLoader.PathHandler {
        override fun handle(path: String): WebResourceResponse? {
            val file = cleanPath(path) ?: return notFound()
            val stream = try {
                assets.open("$root/$file", AssetManager.ACCESS_STREAMING)
            } catch (_: IOException) {
                return notFound()
            }
            val mime = mimeType(file)
            val headers = if (mime == "text/html") HTML_HEADERS else NO_HEADERS
            return WebResourceResponse(mime, if (isText(mime)) "utf-8" else null, 200, "OK", headers, stream)
        }

        /** The asset-relative file for a URL path, or null when the path tries to leave the directory. */
        private fun cleanPath(path: String): String? {
            val trimmed = path.trimStart('/')
            if (trimmed.isEmpty() || trimmed.endsWith("/")) return trimmed + "index.html"
            if (trimmed.indexOf('\\') >= 0 || trimmed.indexOf('\u0000') >= 0) return null
            if (trimmed.split('/').any { it.isEmpty() || it == "." || it == ".." }) return null
            return trimmed
        }
    }

    private val NO_HEADERS: Map<String, String> = emptyMap()

    /**
     * Sent with every bundled HTML page: fetch / XMLHttpRequest / WebSocket / EventSource /
     * sendBeacon may only talk to the bundled origin, and frames may only show bundled pages.
     * It is a second lock on top of the request filter above and of WebSettings.blockNetworkLoads,
     * and the only one that also covers WebSockets now that the app carries the INTERNET permission
     * for its billing and ad libraries.
     */
    private val HTML_HEADERS: Map<String, String> = mapOf(
        "Content-Security-Policy" to "connect-src 'self' data: blob:; frame-src 'self' data: blob:",
    )

    private const val TAG = "Zumurud"
    private const val MAX_BLOCKED_LOG_LINES = 20

    private val MIME_TYPES: Map<String, String> = mapOf(
        "html" to "text/html",
        "htm" to "text/html",
        "js" to "text/javascript",
        "mjs" to "text/javascript",
        "css" to "text/css",
        "json" to "application/json",
        "map" to "application/json",
        "webmanifest" to "application/manifest+json",
        "txt" to "text/plain",
        "xml" to "application/xml",
        "svg" to "image/svg+xml",
        "png" to "image/png",
        "jpg" to "image/jpeg",
        "jpeg" to "image/jpeg",
        "gif" to "image/gif",
        "webp" to "image/webp",
        "avif" to "image/avif",
        "ico" to "image/x-icon",
        "woff2" to "font/woff2",
        "woff" to "font/woff",
        "ttf" to "font/ttf",
        "otf" to "font/otf",
        "mp3" to "audio/mpeg",
        "ogg" to "audio/ogg",
        "oga" to "audio/ogg",
        "opus" to "audio/ogg",
        "wav" to "audio/wav",
        "m4a" to "audio/mp4",
        "aac" to "audio/aac",
        "flac" to "audio/flac",
        "mp4" to "video/mp4",
        "webm" to "video/webm",
        "wasm" to "application/wasm",
    )

    internal fun mimeType(file: String): String {
        val extension = file.substringAfterLast('/').substringAfterLast('.', "").lowercase(Locale.ROOT)
        return MIME_TYPES[extension] ?: "application/octet-stream"
    }

    private fun isText(mime: String): Boolean =
        mime.startsWith("text/") || mime == "application/json" || mime == "application/manifest+json" ||
            mime == "application/xml" || mime == "image/svg+xml"
}
