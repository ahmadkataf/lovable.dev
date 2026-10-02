package com.alradwan.garage;

import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/** The Android app: the web app served from assets/www inside a WebView, with a small bridge for
 *  printing invoices, saving/sharing files (backups, Excel), picking files and using the camera. */
public class MainActivity extends Activity {
    private static final String HOST = "alradwan.app";
    private static final int PICK_FILE = 41;
    private static final int SAVE_FILE = 42;
    private byte[] pendingSave;
    private WebView web;
    private FrameLayout root;
    private ValueCallback<Uri[]> pendingPick;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener(new BarPadding());
        setContentView(root);
        styleBars();
        web = newWebView();
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl("https://" + HOST + "/index.html");
    }

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
        } catch (RuntimeException ignored) { }
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
        v.setWebChromeClient(new AppChrome(this));
        v.addJavascriptInterface(new Bridge(this), "GarageAndroid");
        root.addView(v, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        return v;
    }

    void restartPage(WebView dead) {
        if (dead != web) return;
        root.removeView(dead);
        dead.destroy();
        web = newWebView();
        web.loadUrl("https://" + HOST + "/index.html");
    }

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
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) { host.restartPage(view); return true; }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return false;
            try { host.startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
            return true;
        }
    }

    /** File picker (restoring a backup, importing Excel) and camera permission (barcode scanning). */
    static final class AppChrome extends WebChromeClient {
        private final MainActivity host;
        AppChrome(MainActivity host) { this.host = host; }

        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (host.pendingPick != null) host.pendingPick.onReceiveValue(null);
            host.pendingPick = callback;
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            try { host.startActivityForResult(Intent.createChooser(i, "اختر الملف"), PICK_FILE); }
            catch (Exception e) { host.pendingPick = null; return false; }
            return true;
        }

        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            for (String r : request.getResources()) {
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && host.checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        host.requestPermissions(new String[]{android.Manifest.permission.CAMERA}, 7);
                        request.deny();
                        return;
                    }
                    request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    return;
                }
            }
            request.deny();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == SAVE_FILE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                try {
                    java.io.OutputStream out = getContentResolver().openOutputStream(data.getData());
                    if (out != null) { out.write(bytes); out.close(); }
                } catch (Exception ignored) { }
            }
            return;
        }
        if (requestCode == PICK_FILE && pendingPick != null) {
            Uri[] result = (resultCode == RESULT_OK && data != null && data.getData() != null) ? new Uri[]{data.getData()} : null;
            pendingPick.onReceiveValue(result);
            pendingPick = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

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

    /** What the web app may ask the phone. */
    static final class Bridge {
        private final MainActivity host;
        Bridge(MainActivity host) { this.host = host; }

        @JavascriptInterface
        public String deviceId() {
            String id = Settings.Secure.getString(host.getContentResolver(), Settings.Secure.ANDROID_ID);
            return id == null ? "" : id;
        }

        /** Prints the current page (the invoice) through Android's print screen: any printer, or save as PDF. */
        @JavascriptInterface
        public void print() {
            host.runOnUiThread(new Runnable() { public void run() { host.doPrint(); } });
        }

        /** Saves a file (backup, Excel): the phone's "save as" screen lets the user choose the folder (Downloads, Drive…). */
        @JavascriptInterface
        public void saveFile(final String name, final String mime, final String base64) {
            host.runOnUiThread(new Runnable() { public void run() { host.saveAs(name, mime, base64); } });
        }
    }

    void doPrint() {
        try {
            PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
            pm.print("كراج الرضوان", web.createPrintDocumentAdapter("invoice"), new PrintAttributes.Builder().build());
        } catch (Exception ignored) { }
    }

    void saveAs(String name, String mime, String base64) {
        try {
            pendingSave = Base64.decode(base64, Base64.DEFAULT);
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
            i.putExtra(Intent.EXTRA_TITLE, name);
            startActivityForResult(i, SAVE_FILE);
        } catch (Exception e) { pendingSave = null; }
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
            return new WebResourceResponse(mime(rel), "utf-8", 200, "OK", headers, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new java.io.ByteArrayInputStream(new byte[0]));
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

    private long lastBack = 0;

    /** Back: the page closes its dialog or returns to the home screen; at the home screen the app only
     *  leaves after a second press within two seconds, so a stray tap never throws the cashier out. */
    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("(function(){try{return window.alradwanBack?String(window.alradwanBack()):'false'}catch(e){return 'false'}})()", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (value != null && value.contains("true")) return;
                long now = System.currentTimeMillis();
                if (now - lastBack < 2000) { finish(); return; }
                lastBack = now;
                android.widget.Toast.makeText(MainActivity.this, "اضغط رجوع مرة أخرى للخروج", android.widget.Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) { super.onSaveInstanceState(outState); if (web != null) web.saveState(outState); }
    @Override
    protected void onPause() { super.onPause(); if (web != null) web.onPause(); }
    @Override
    protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
}
