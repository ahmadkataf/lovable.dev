package dev.raqeem.madar;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ServiceWorkerController;
import android.webkit.ServiceWorkerWebSettings;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;

/**
 * مَدار for Android: a thin shell around the live platform at https://app.madar.raqeem.dev/.
 *
 * The platform is the PWA served there; this activity hosts it in a WebView and adds only what a page cannot do
 * for itself on a phone: the launcher icon and a splash while the first page loads, the bundled Arabic
 * assets/offline.html when the page cannot be fetched and no cached copy answers, the back button walking the
 * page history, links to other sites handed to the phone's browser, the file picker behind <input type=file>,
 * and the saving of files the page produces (the CSV report) into the phone's downloads.
 * There is no Gradle project: build-apk.sh compiles this file with the Android build-tools alone.
 */
public class MainActivity extends Activity {
    static final String HOST = "app.madar.raqeem.dev";
    static final String APP_URL = "https://" + HOST + "/";
    /** The one link in assets/offline.html: it asks the shell to load the platform again. */
    static final String RETRY_URL = "madar://retry";
    static final int LIGHT = 0xFFF3F7FD;   // page background of the platform and of the pitch site
    static final int INK = 0xFF0E1A33;
    static final int BRAND = 0xFF2A5BEA;
    private static final int PICK_FILES = 1;
    private static final int MP = ViewGroup.LayoutParams.MATCH_PARENT;
    private static final int WC = ViewGroup.LayoutParams.WRAP_CONTENT;

    private FrameLayout root;
    private WebView web;
    /** A second WebView that shows offline.html over the page, so the page's own history is left alone; made when first needed. */
    private WebView offline;
    private View splash;
    /** The current load failed for the main frame; the callbacks that follow for its error page must not hide offline.html. */
    private boolean failed;
    private long failedAt;
    private ValueCallback<Uri[]> pendingFiles;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(false);
        root = new FrameLayout(this);
        root.setBackgroundColor(LIGHT);
        setContentView(root);
        // the theme's window background (the icon on light) covered the cold start; from here a plain colour is enough
        getWindow().setBackgroundDrawable(new ColorDrawable(LIGHT));
        styleBars();
        web = newWebView();
        showSplash();
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(APP_URL);
    }

    /** Light system bars with dark icons, like the page. Only the look of the bars: never a reason to stop the app. */
    private void styleBars() {
        try {
            Window w = getWindow();
            w.setStatusBarColor(LIGHT);
            w.setNavigationBarColor(LIGHT);
            View decor = w.getDecorView();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController c = decor.getWindowInsetsController();
                int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                if (c != null) c.setSystemBarsAppearance(light, light);
            } else {
                int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                decor.setSystemUiVisibility(decor.getSystemUiVisibility() | flags);
            }
        } catch (RuntimeException ignored) {
        }
    }

    private WebView newWebView() {
        WebView v = new WebView(this);
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);              // localStorage and IndexedDB: the token, the cached timetable, the outbox
        s.setCacheMode(WebSettings.LOAD_DEFAULT);  // the service worker answers from its cache when the network cannot
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(true);            // pinch to zoom for weak eyes…
        s.setDisplayZoomControls(false);           // …without the +/- buttons
        s.setTextZoom(100);
        // service workers are on by default (API 24+); they get the same restrictions as the page
        ServiceWorkerWebSettings sw = ServiceWorkerController.getInstance().getServiceWorkerWebSettings();
        sw.setAllowContentAccess(false);
        sw.setAllowFileAccess(false);
        sw.setCacheMode(WebSettings.LOAD_DEFAULT);
        v.setBackgroundColor(LIGHT);
        v.setWebViewClient(new AppClient(this));
        v.setWebChromeClient(new AppChrome(this));
        v.setDownloadListener(new Downloads(this));
        v.addJavascriptInterface(new Shell(this), "MadarShell");
        root.addView(v, 0, new FrameLayout.LayoutParams(MP, MP));   // index 0: under the splash and offline.html
        return v;
    }

    // ---- splash: the icon and the name over everything until the first page is on screen

    private void showSplash() {
        if (splash != null) return;
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(LIGHT);
        box.setClickable(true);   // touches stop here instead of reaching the half-loaded page
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.splash_icon);
        box.addView(icon, new LinearLayout.LayoutParams(dp(132), dp(132)));
        TextView name = new TextView(this);
        name.setText(R.string.app_name);
        name.setTextColor(INK);
        name.setTypeface(Typeface.DEFAULT_BOLD);
        name.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
        LinearLayout.LayoutParams nameLp = new LinearLayout.LayoutParams(WC, WC);
        nameLp.topMargin = dp(16);
        box.addView(name, nameLp);
        ProgressBar spinner = new ProgressBar(this);
        spinner.setIndeterminateTintList(ColorStateList.valueOf(BRAND));
        LinearLayout.LayoutParams spinLp = new LinearLayout.LayoutParams(dp(28), dp(28));
        spinLp.topMargin = dp(28);
        box.addView(spinner, spinLp);
        splash = box;
        root.addView(splash, new FrameLayout.LayoutParams(MP, MP));
    }

    private void hideSplash() {
        View s = splash;
        if (s == null) return;
        splash = null;
        s.animate().alpha(0f).setDuration(220).withEndAction(new RemoveView(root, s)).start();
    }

    /** Named (not anonymous) classes throughout, so that d8 handles them the same on every JDK. */
    static final class RemoveView implements Runnable {
        private final ViewGroup parent;
        private final View view;
        RemoveView(ViewGroup parent, View view) { this.parent = parent; this.view = view; }
        @Override public void run() { parent.removeView(view); }
    }

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    // ---- offline.html: the platform could not be fetched and no cached copy answered

    void showOffline(boolean serverError) {
        hideSplash();
        if (offline == null) {
            offline = new WebView(this);
            WebSettings s = offline.getSettings();
            s.setJavaScriptEnabled(false);   // one static page with one link: nothing to script
            s.setAllowFileAccess(false);
            s.setAllowContentAccess(false);
            offline.setBackgroundColor(LIGHT);
            offline.setWebViewClient(new OfflineClient(this));
            root.addView(offline, new FrameLayout.LayoutParams(MP, MP));
        }
        String html = asset("offline.html");
        if (serverError) html = html.replace("data-why=\"offline\"", "data-why=\"server\"");
        offline.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        offline.setVisibility(View.VISIBLE);
    }

    private String asset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[8192];
            for (int n; (n = in.read(b)) > 0; ) buf.write(b, 0, n);
            return new String(buf.toByteArray(), StandardCharsets.UTF_8);
        } catch (IOException e) {   // the asset is always in the APK; this only keeps a bare page if it ever is not
            return "<!doctype html><html dir=\"rtl\"><body style=\"font-family:sans-serif;padding:2em;text-align:center\"><h2>"
                + getString(R.string.offline_title) + "</h2><p><a href=\"" + RETRY_URL + "\">" + getString(R.string.retry) + "</a></p></body></html>";
        }
    }

    /** offline.html's link: load the platform again — the address that failed, or the start page if there is none. */
    void retry() {
        if (offline != null) offline.setVisibility(View.GONE);
        failed = false;
        showSplash();
        String current = web.getUrl();
        if (current != null && current.startsWith(APP_URL)) web.reload(); else web.loadUrl(APP_URL);
    }

    void pageStarted() {
        // a load that follows a failure within a second is the failure's own error page committing, not a new attempt
        if (failed && SystemClock.uptimeMillis() - failedAt > 1000) failed = false;
    }

    void pageFailed(boolean serverError) {
        failed = true;
        failedAt = SystemClock.uptimeMillis();
        showOffline(serverError);
    }

    /** Something of the page is on screen: the splash and offline.html have done their job. */
    void pageShown() {
        if (failed) return;
        hideSplash();
        if (offline != null) offline.setVisibility(View.GONE);
    }

    // ---- links, the page process, files

    static boolean isApp(Uri u) {
        return "https".equalsIgnoreCase(u.getScheme()) && HOST.equalsIgnoreCase(u.getHost());
    }

    /** Anything that is not the platform goes to the phone: the browser for other sites, the dialler for tel:, WhatsApp for its links… */
    void openOutside(Uri u) {
        try {
            Intent i;
            if ("intent".equals(u.getScheme())) {
                i = Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME);
                i.addCategory(Intent.CATEGORY_BROWSABLE);   // a page may only reach apps that offer themselves to browsers
                i.setComponent(null);
                i.setSelector(null);
            } else {
                i = new Intent(Intent.ACTION_VIEW, u);
            }
            startActivity(i);
        } catch (ActivityNotFoundException | URISyntaxException | SecurityException e) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show();
        }
    }

    /** The page's process was killed (usually the phone ran short of memory): open the platform again in a fresh
     *  WebView. Without this Android closes the whole app. */
    void restartPage(WebView dead) {
        if (dead != web) return;
        root.removeView(dead);
        dead.destroy();
        web = newWebView();
        failed = false;
        showSplash();
        web.loadUrl(APP_URL);
    }

    boolean pickFiles(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (pendingFiles != null) pendingFiles.onReceiveValue(null);
        pendingFiles = callback;
        try {
            startActivityForResult(params.createIntent(), PICK_FILES);
            return true;
        } catch (ActivityNotFoundException e) {
            pendingFiles = null;
            return false;
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        if (request != PICK_FILES) {
            super.onActivityResult(request, result, data);
            return;
        }
        if (pendingFiles == null) return;
        Uri[] files = null;
        if (result == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                files = new Uri[clip.getItemCount()];
                for (int i = 0; i < files.length; i++) files[i] = clip.getItemAt(i).getUri();
            } else if (data.getData() != null) {
                files = new Uri[] { data.getData() };
            }
        }
        pendingFiles.onReceiveValue(files);
        pendingFiles = null;
    }

    /** A download the page started. The CSV report is made by the page itself (fetch with the token, then a Blob),
     *  so a blob: address is read back through the page and handed to saveFile; a plain https address goes to the
     *  system's download manager. */
    void download(String url, String userAgent, String contentDisposition, String mime) {
        String name = safeName(URLUtil.guessFileName(url, contentDisposition, mime));
        if (url.startsWith("blob:") || url.startsWith("data:")) {
            String js = "(function(u,n,m){fetch(u).then(function(r){return r.blob()}).then(function(b){var f=new FileReader();"
                + "f.onload=function(){MadarShell.saveFile(n,m||b.type||'',String(f.result).split(',')[1]||'')};"
                + "f.readAsDataURL(b)})})(" + JSONObject.quote(url) + "," + JSONObject.quote(name) + ","
                + JSONObject.quote(mime == null ? "" : mime) + ")";
            web.evaluateJavascript(js, null);
            return;
        }
        if (!url.startsWith("http")) {
            openOutside(Uri.parse(url));
            return;
        }
        try {
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            if (mime != null && !mime.isEmpty()) r.setMimeType(mime);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) r.addRequestHeader("Cookie", cookies);
            if (userAgent != null) r.addRequestHeader("User-Agent", userAgent);
            r.setTitle(name);
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            else r.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name);   // needs no storage permission
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (dm == null) throw new IllegalStateException("no download manager");
            dm.enqueue(r);
            Toast.makeText(this, getString(R.string.downloading, name), Toast.LENGTH_SHORT).show();
        } catch (RuntimeException e) {
            openOutside(Uri.parse(url));   // let the browser try
        }
    }

    /** Writes a file the page produced into the phone's downloads. Runs on the page's bridge thread. */
    void saveFile(String name, String mime, byte[] bytes) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver cr = getContentResolver();
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                v.put(MediaStore.MediaColumns.IS_PENDING, 1);
                Uri item = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (item == null) throw new IOException("no downloads collection");
                try (OutputStream out = cr.openOutputStream(item)) {
                    if (out == null) throw new IOException("cannot open " + item);
                    out.write(bytes);
                }
                v.clear();
                v.put(MediaStore.MediaColumns.IS_PENDING, 0);
                cr.update(item, v, null, null);
            } else {
                // Android 7–9: the app's own external folder needs no permission; the download manager lists the
                // file in the system's Downloads app and shows the finished notification
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) dir = getFilesDir();
                File f = new File(dir, name);
                try (OutputStream out = new FileOutputStream(f)) {
                    out.write(bytes);
                }
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) dm.addCompletedDownload(name, getString(R.string.app_name), true, mime, f.getAbsolutePath(), f.length(), true);
            }
            runOnUiThread(new Say(this, getString(R.string.saved, name)));
        } catch (IOException | RuntimeException e) {
            runOnUiThread(new Say(this, getString(R.string.save_failed)));
        }
    }

    static String safeName(String name) {
        String n = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        return n.isEmpty() ? "madar-file" : n;
    }

    static final class Say implements Runnable {
        private final Activity host;
        private final CharSequence text;
        Say(Activity host, CharSequence text) { this.host = host; this.text = text; }
        @Override public void run() { Toast.makeText(host, text, Toast.LENGTH_LONG).show(); }
    }

    // ---- the WebView's callbacks

    static final class AppClient extends WebViewClient {
        private final MainActivity host;
        AppClient(MainActivity host) { this.host = host; }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (isApp(u) || !request.isForMainFrame()) return false;   // the platform, and whatever its iframes embed
            host.openOutside(u);
            return true;
        }

        @Override public void onPageStarted(WebView view, String url, Bitmap favicon) { host.pageStarted(); }
        @Override public void onPageCommitVisible(WebView view, String url) { host.pageShown(); }
        @Override public void onPageFinished(WebView view, String url) { host.pageShown(); }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) host.pageFailed(false);
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request.isForMainFrame() && response.getStatusCode() >= 500) host.pageFailed(true);
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            host.restartPage(view);
            return true;
        }
    }

    static final class AppChrome extends WebChromeClient {
        private final MainActivity host;
        AppChrome(MainActivity host) { this.host = host; }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            return host.pickFiles(callback, params);
        }
    }

    static final class Downloads implements DownloadListener {
        private final MainActivity host;
        Downloads(MainActivity host) { this.host = host; }

        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
            host.download(url, userAgent, contentDisposition, mimetype);
        }
    }

    /** What the page may ask the shell (window.MadarShell): to keep a file it produced, such as the CSV report. */
    static final class Shell {
        private final MainActivity host;
        Shell(MainActivity host) { this.host = host; }

        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            byte[] bytes;
            try {
                bytes = Base64.decode(base64 == null ? "" : base64, Base64.DEFAULT);
            } catch (IllegalArgumentException e) {
                return;
            }
            host.saveFile(safeName(name), mime == null || mime.isEmpty() ? "application/octet-stream" : mime, bytes);
        }
    }

    /** offline.html never navigates anywhere itself: its one link is the retry, anything else goes outside. */
    static final class OfflineClient extends WebViewClient {
        private final MainActivity host;
        OfflineClient(MainActivity host) { this.host = host; }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (RETRY_URL.equals(u.toString())) host.retry(); else host.openOutside(u);
            return true;
        }
    }

    // ---- back button and lifecycle

    @Override
    public void onBackPressed() {
        if (offline != null && offline.getVisibility() == View.VISIBLE) {
            // leave the page that failed: back to the last one that did load, or out of the app
            if (web != null && web.canGoBack()) {
                offline.setVisibility(View.GONE);
                failed = false;
                web.goBack();
            } else {
                super.onBackPressed();
            }
            return;
        }
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override protected void onPause() { super.onPause(); if (web != null) web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }

    @Override
    protected void onDestroy() {
        if (web != null) { root.removeView(web); web.destroy(); web = null; }
        if (offline != null) { root.removeView(offline); offline.destroy(); offline = null; }
        super.onDestroy();
    }
}
