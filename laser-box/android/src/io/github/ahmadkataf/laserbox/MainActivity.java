package io.github.ahmadkataf.laserbox;

import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.content.pm.PackageInfo;
import android.view.Gravity;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebStorage;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Minimal shell: loads the bundled web app (one self-contained page in assets/www) into a WebView,
 * and saves the generated SVG/DXF files wherever the user picks (the system "create document" dialog,
 * so no storage permission is needed on any Android version).
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String BASE = "https://" + HOST + "/";
    private final StringBuilder log = new StringBuilder();
    private boolean ready;
    private View problem;
    private static final int SAVE_REQUEST = 7;
    private WebView web;
    private FrameLayout root;
    private String pendingText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener(new BarPadding());
        setContentView(root);
        styleBars();
        web = newWebView();
        load();
    }

    /** The page is one file with its script and styles inline, loaded directly: nothing to fetch, nothing to cache. */
    void load() {
        ready = false;
        hideProblem();
        try {
            InputStream in = getAssets().open("www/index.html");
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[16384];
            int n;
            try { while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n); } finally { in.close(); }
            web.loadDataWithBaseURL(BASE, new String(buf.toByteArray(), StandardCharsets.UTF_8), "text/html", "utf-8", null);
        } catch (IOException e) {
            note("assets: " + e);
        }
        root.removeCallbacks(watchdog);
        root.postDelayed(watchdog, 10000);
    }

    private final Runnable watchdog = new Watchdog(this);

    static final class Watchdog implements Runnable {
        private final MainActivity host;
        Watchdog(MainActivity host) { this.host = host; }
        @Override public void run() { if (!host.ready) host.showProblem(); }
    }

    void note(String line) {
        synchronized (log) {
            if (log.length() > 6000) log.delete(0, log.length() - 4000);
            log.append(line).append('\n');
        }
    }

    void markReady() { ready = true; hideProblem(); }

    private void hideProblem() { if (problem != null) { root.removeView(problem); problem = null; } }

    /** The page did not start: say so on a native screen, with what the phone runs, the errors seen, and two ways out. */
    void showProblem() {
        if (problem != null) return;
        String wv = "?";
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PackageInfo pi = WebView.getCurrentWebViewPackage();
                if (pi != null) wv = pi.packageName + " " + pi.versionName;
            }
        } catch (RuntimeException ignored) { }
        String details;
        synchronized (log) { details = log.toString(); }
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(40, 40, 40, 40);
        box.setBackgroundColor(Color.WHITE);
        TextView t = new TextView(this);
        t.setTextColor(Color.BLACK);
        t.setTextSize(16);
        t.setGravity(Gravity.RIGHT);
        t.setText("لم تبدأ واجهة التطبيق. جرّب «إعادة المحاولة»، ثم «مسح الإعدادات». إن بقيت المشكلة فحدّث «Android System WebView» و«Chrome» من متجر Play، وأرسل صورة لهذه الشاشة.");
        TextView d = new TextView(this);
        d.setTextColor(Color.DKGRAY);
        d.setTextSize(12);
        d.setTextIsSelectable(true);
        d.setText("Android " + Build.VERSION.RELEASE + " (SDK " + Build.VERSION.SDK_INT + "), " + Build.MANUFACTURER + " " + Build.MODEL + "\nWebView: " + wv + "\n" + details);
        Button retry = new Button(this);
        retry.setText("إعادة المحاولة");
        retry.setOnClickListener(new Action(this, false));
        Button reset = new Button(this);
        reset.setText("مسح الإعدادات وإعادة التشغيل");
        reset.setOnClickListener(new Action(this, true));
        box.addView(t);
        box.addView(retry);
        box.addView(reset);
        box.addView(d);
        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(Color.WHITE);
        sv.addView(box);
        problem = sv;
        root.addView(sv, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    static final class Action implements View.OnClickListener {
        private final MainActivity host;
        private final boolean wipe;
        Action(MainActivity host, boolean wipe) { this.host = host; this.wipe = wipe; }
        @Override public void onClick(View v) {
            if (wipe) { WebStorage.getInstance().deleteAllData(); host.web.clearCache(true); }
            host.load();
        }
    }

    static final class Chrome extends WebChromeClient {
        private final MainActivity host;
        Chrome(MainActivity host) { this.host = host; }
        @Override public boolean onConsoleMessage(ConsoleMessage m) {
            if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR || m.messageLevel() == ConsoleMessage.MessageLevel.WARNING)
                host.note(m.messageLevel() + ": " + m.message() + " @" + m.lineNumber());
            return false;
        }
    }

    /** White system bars with dark icons; the container is padded by their size and by the keyboard's. */
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
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        v.setBackgroundColor(Color.WHITE);
        v.setWebViewClient(new AppClient(this));
        v.setWebChromeClient(new Chrome(this));
        v.addJavascriptInterface(new Bridge(this), "LaserAndroid");
        root.addView(v, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        return v;
    }

    /** The page's process was stopped (usually the phone ran short of memory): open the page again. */
    void restartPage(WebView dead) {
        if (dead != web) return;
        root.removeView(dead);
        dead.destroy();
        web = newWebView();
        note("the page's process stopped; started again");
        load();
    }

    /** Named (not anonymous) classes throughout, so d8 handles them on every JDK. */
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
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            host.note("load error " + error.getErrorCode() + " " + error.getDescription() + " " + request.getUrl());
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

    /** What the web app may ask the phone: to save a text file under a name of its choosing. */
    static final class Bridge {
        private final MainActivity host;
        Bridge(MainActivity host) { this.host = host; }

        @JavascriptInterface
        public void ready() {
            host.runOnUiThread(new ReadyTask(host));
        }

        @JavascriptInterface
        public void save(String filename, String mime, String text) {
            host.runOnUiThread(new SaveTask(host, filename, mime, text));
        }
    }

    static final class ReadyTask implements Runnable {
        private final MainActivity host;
        ReadyTask(MainActivity host) { this.host = host; }
        @Override public void run() { host.markReady(); }
    }

    static final class SaveTask implements Runnable {
        private final MainActivity host;
        private final String filename, mime, text;
        SaveTask(MainActivity host, String filename, String mime, String text) { this.host = host; this.filename = filename; this.mime = mime; this.text = text; }

        @Override
        public void run() { host.startSave(filename, mime, text); }
    }

    void startSave(String filename, String mime, String text) {
        pendingText = text;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
        i.putExtra(Intent.EXTRA_TITLE, filename);
        try {
            startActivityForResult(i, SAVE_REQUEST);
        } catch (Exception e) {
            pendingText = null;
            Toast.makeText(this, "لا يوجد تطبيق ملفات لحفظ الملف", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != SAVE_REQUEST) return;
        String text = pendingText;
        pendingText = null;
        if (resultCode != RESULT_OK || data == null || data.getData() == null || text == null) return;
        try {
            OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt");
            if (out == null) throw new IOException("no stream");
            try { out.write(text.getBytes(StandardCharsets.UTF_8)); } finally { out.close(); }
            Toast.makeText(this, "حُفظ الملف", Toast.LENGTH_SHORT).show();
        } catch (IOException e) {
            Toast.makeText(this, "تعذّر حفظ الملف: " + e.getMessage(), Toast.LENGTH_LONG).show();
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
            // the page itself is never cached, so an updated app never loads an old page that names old scripts
            headers.put("Cache-Control", rel.endsWith(".html") ? "no-cache" : "max-age=31536000");
            return new WebResourceResponse(mime(rel), "utf-8", 200, "OK", headers, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
        }
    }

    private static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
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
    }

    @Override
    protected void onPause() { super.onPause(); if (web != null) web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
}
