package com.emar8.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.content.Intent;
import android.content.res.AssetManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.FrameLayout;
import android.view.Window;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.Uri;

import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.Map;

/** Minimal shell: serves the bundled web app from assets/www at https://emar8.app/ inside a WebView. */
public class MainActivity extends Activity {
    private static final String HOST = "emar8.app";
    private WebView web;
    private FrameLayout root;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        keepCrashReports();
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener(new BarPadding());
        setContentView(root);
        styleBars();
        web = newWebView();
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl("https://" + HOST + "/index.html");
        showLastCrash();
    }

    private static final String CRASHES = "crashes";

    /** If the app ever stops on an error, the error is kept so that the next launch can show it. */
    private void keepCrashReports() {
        final SharedPreferences prefs = getSharedPreferences(CRASHES, MODE_PRIVATE);
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new CrashKeeper(prefs, previous));
    }

    static final class CrashKeeper implements Thread.UncaughtExceptionHandler {
        private final SharedPreferences prefs;
        private final Thread.UncaughtExceptionHandler previous;
        CrashKeeper(SharedPreferences prefs, Thread.UncaughtExceptionHandler previous) { this.prefs = prefs; this.previous = previous; }

        @Override
        public void uncaughtException(Thread t, Throwable e) {
            StringWriter trace = new StringWriter();
            e.printStackTrace(new PrintWriter(trace));
            String text = "Android " + Build.VERSION.RELEASE + " (SDK " + Build.VERSION.SDK_INT + ") · " + Build.MANUFACTURER + " " + Build.MODEL + "\n" + trace;
            prefs.edit().putString("last", text.length() > 4000 ? text.substring(0, 4000) : text).commit();
            if (previous != null) previous.uncaughtException(t, e);
        }
    }

    /** Shows the error that closed the app last time, once, with a button to copy it for support. */
    private void showLastCrash() {
        final SharedPreferences prefs = getSharedPreferences(CRASHES, MODE_PRIVATE);
        final String last = prefs.getString("last", null);
        if (last == null) return;
        prefs.edit().remove("last").apply();
        new AlertDialog.Builder(this)
            .setTitle("أُغلق التطبيق في المرة السابقة بسبب خطأ")
            .setMessage("أرسل صورة لهذه الرسالة إلى الدعم الفني ليُصلَح الخطأ:\n\n" + last)
            .setPositiveButton("نسخ", new CopyText(this, last))
            .setNegativeButton("إغلاق", null)
            .show();
    }

    static final class CopyText implements DialogInterface.OnClickListener {
        private final Activity host;
        private final String text;
        CopyText(Activity host, String text) { this.host = host; this.text = text; }

        @Override
        public void onClick(DialogInterface d, int which) {
            ClipboardManager cm = (ClipboardManager) host.getSystemService(CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Emar error", text));
        }
    }

    /** White system bars with dark icons; from Android 15 the app draws behind them, so the container is
     *  padded by their size (and by the keyboard's). Called after setContentView: before it the window has
     *  no decor view, and on Android 11–14 getInsetsController() then throws and the app closes at launch. */
    private void styleBars() {
        try {
            Window w = getWindow();
            w.setStatusBarColor(Color.WHITE);
            w.setNavigationBarColor(Color.WHITE);
            View decor = w.getDecorView();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController c = decor.getWindowInsetsController();
                if (c != null) c.setSystemBarsAppearance(
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            }
        } catch (RuntimeException ignored) {
            // only the colour of the bars: never a reason to stop the app
        }
    }

    private WebView newWebView() {
        WebView v = new WebView(this);
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        v.setBackgroundColor(Color.WHITE);
        v.setWebViewClient(new AppClient(this));
        v.addJavascriptInterface(new Bridge(this), "EmarAndroid");
        root.addView(v, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        return v;
    }

    /** The page's process was stopped (usually the phone ran short of memory): open the app's page again
     *  in a new WebView. Without this Android closes the whole app. */
    void restartPage(WebView dead) {
        if (dead != web) return;
        root.removeView(dead);
        dead.destroy();
        web = newWebView();
        web.loadUrl("https://" + HOST + "/index.html");
    }

    /** Named (not anonymous) so that d8 handles it on every JDK. */
    static final class AppClient extends WebViewClient {
        private final MainActivity host;
        AppClient(MainActivity host) { this.host = host; }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return host.serve(u.getPath());
            return null;
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            host.restartPage(view);
            return true;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return false;
            // WhatsApp and other outside links open in their own app
            try { host.startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
            return true;
        }
    }

    /** Keeps the page clear of the status bar, the navigation bar and the keyboard. */
    static final class BarPadding implements View.OnApplyWindowInsetsListener {
        @Override
        public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = in.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            }
            v.setPadding(in.getSystemWindowInsetLeft(), in.getSystemWindowInsetTop(), in.getSystemWindowInsetRight(), in.getSystemWindowInsetBottom());
            return in.consumeSystemWindowInsets();
        }
    }

    /** What the web app may ask the phone: only its id, which stays the same when the app is reinstalled. */
    static final class Bridge {
        private final MainActivity host;
        Bridge(MainActivity host) { this.host = host; }

        @JavascriptInterface
        public String deviceId() {
            String id = Settings.Secure.getString(host.getContentResolver(), Settings.Secure.ANDROID_ID);
            return id == null ? "" : id;
        }
    }

    WebResourceResponse serve(String path) {
        if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
        String rel = "www" + path;
        AssetManager am = getAssets();
        try {
            InputStream in = am.open(rel);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "max-age=31536000");
            return new WebResourceResponse(mime(rel), rel.endsWith(".mp3") ? null : "utf-8", 200, "OK", headers, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new java.io.ByteArrayInputStream(new byte[0]));
        }
    }

    private static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onPause() { super.onPause(); if (web != null) web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
}
