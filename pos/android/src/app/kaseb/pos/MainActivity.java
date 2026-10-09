package app.kaseb.pos;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintJob;
import android.print.PrintManager;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
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

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Kaseb POS — the Android shell. Serves the bundled web app from assets/www at https://kaseb.app/ inside a WebView,
 * grants it the camera (barcode scanning), and offers the phone's features through the "PosAndroid" bridge
 * (the PosAndroidBridge contract in src/vite-env.d.ts).
 */
public class MainActivity extends Activity {
    static final String HOST = "kaseb.app";
    static final String ORIGIN = "https://" + HOST + "/";
    private static final String CRASHES = "crashes";
    private static final String LICENSE_PREFS = "license";
    private static final String LICENSE_KEY = "token";
    private static final int REQ_CAMERA = 1;
    private static final int REQ_OPEN_FILE = 2;
    private static final int REQ_SAVE_FILE = 3;

    private WebView web;
    private FrameLayout root;
    private PermissionRequest pendingPermission;
    private ValueCallback<Uri[]> pendingFileChooser;
    private byte[] pendingSave;
    // the print WebView and job are kept here so the garbage collector does not take them mid-print
    private WebView printView;
    private PrintJob printJob;

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
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(ORIGIN + "index.html");
        showLastCrash();
    }

    // ---------------------------------------------------------------- crash keeper

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
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Kaseb error", text));
        }
    }

    // ---------------------------------------------------------------- window

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

    // ---------------------------------------------------------------- the WebView

    private WebView newWebView() {
        WebView v = new WebView(this);
        applySettings(v.getSettings());
        v.setBackgroundColor(Color.WHITE);
        v.setWebViewClient(new AppClient(this));
        v.setWebChromeClient(new ChromeClient(this));
        v.addJavascriptInterface(new Bridge(this), "PosAndroid");
        root.addView(v, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        return v;
    }

    private static void applySettings(WebSettings s) {
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setGeolocationEnabled(false);
    }

    /** The page's process was stopped (usually the phone ran short of memory): open the app's page again
     *  in a new WebView. Without this Android closes the whole app. */
    void restartPage(WebView dead) {
        if (dead != web) return;
        root.removeView(dead);
        dead.destroy();
        web = newWebView();
        web.loadUrl(ORIGIN + "index.html");
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
            host.openOutside(u);
            return true;
        }
    }

    /** Camera permission for the scanner, and the file picker for CSV imports / backup restore. */
    static final class ChromeClient extends WebChromeClient {
        private final MainActivity host;
        ChromeClient(MainActivity host) { this.host = host; }

        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            host.runOnUiThread(new Runnable() {
                @Override
                public void run() { host.handlePermissionRequest(request); }
            });
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            return host.openFileChooser(callback, params);
        }
    }

    // ---------------------------------------------------------------- camera permission

    void handlePermissionRequest(PermissionRequest request) {
        Uri origin = request.getOrigin();
        boolean ours = origin != null && HOST.equals(origin.getHost());
        boolean video = false;
        String[] resources = request.getResources();
        if (resources != null) for (String r : resources) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) video = true;
        if (!ours || !video) { request.deny(); return; }
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
            return;
        }
        if (pendingPermission != null) pendingPermission.deny();
        pendingPermission = request;
        requestPermissions(new String[] { Manifest.permission.CAMERA }, REQ_CAMERA);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_CAMERA || pendingPermission == null) return;
        PermissionRequest request = pendingPermission;
        pendingPermission = null;
        boolean granted = grantResults != null && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) request.grant(new String[] { PermissionRequest.RESOURCE_VIDEO_CAPTURE });
        else request.deny();
    }

    // ---------------------------------------------------------------- files

    /** <input type="file">: the system picker. Any type is allowed on purpose: CSV files are registered under several
     *  MIME types on Android (text/csv, text/comma-separated-values, application/vnd.ms-excel) and the page checks the content. */
    boolean openFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
        pendingFileChooser = callback;
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(acceptedType(params == null ? null : params.getAcceptTypes()));
        if (params != null && params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try {
            startActivityForResult(Intent.createChooser(intent, "اختر ملفًا"), REQ_OPEN_FILE);
            return true;
        } catch (Exception e) {
            pendingFileChooser = null;
            return false;
        }
    }

    /** A MIME type for the picker from the page's accept list; images stay images, everything else opens wide. */
    static String acceptedType(String[] accept) {
        if (accept == null) return "*/*";
        for (String a : accept) {
            if (a == null) continue;
            String t = a.trim().toLowerCase();
            if (t.startsWith("image/")) return t;
        }
        return "*/*";
    }

    /** Called by the bridge (on a background thread): keep the bytes, ask where to save. */
    void startSaveFile(final String name, final String mime, final byte[] bytes) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (pendingSave != null) notifyFileSaved(false);
                pendingSave = bytes;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                intent.putExtra(Intent.EXTRA_TITLE, name == null || name.isEmpty() ? "kaseb-file" : name);
                try {
                    startActivityForResult(intent, REQ_SAVE_FILE);
                } catch (Exception e) {
                    pendingSave = null;
                    notifyFileSaved(false);
                }
            }
        });
    }

    /** Tells the page that saveFile() finished (window.onPosFileSaved in src/lib/platform.ts). UI thread only. */
    void notifyFileSaved(boolean ok) {
        if (web == null) return;
        web.evaluateJavascript("window.onPosFileSaved && window.onPosFileSaved(" + (ok ? "true" : "false") + ")", null);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_OPEN_FILE) {
            ValueCallback<Uri[]> cb = pendingFileChooser;
            pendingFileChooser = null;
            if (cb != null) cb.onReceiveValue(pickedUris(resultCode, data));
        } else if (requestCode == REQ_SAVE_FILE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            boolean ok = false;
            Uri target = resultCode == RESULT_OK && data != null ? data.getData() : null;
            if (bytes != null && target != null) {
                try {
                    OutputStream out = getContentResolver().openOutputStream(target, "wt");
                    if (out != null) {
                        try { out.write(bytes); out.flush(); } finally { out.close(); }
                        ok = true;
                    }
                } catch (Exception ignored) {
                    ok = false;
                }
            }
            notifyFileSaved(ok);
        }
    }

    private static Uri[] pickedUris(int resultCode, Intent data) {
        if (resultCode != RESULT_OK || data == null) return null;
        ClipData clip = data.getClipData();
        if (clip != null && clip.getItemCount() > 0) {
            List<Uri> list = new ArrayList<>();
            for (int i = 0; i < clip.getItemCount(); i++) { Uri u = clip.getItemAt(i).getUri(); if (u != null) list.add(u); }
            return list.isEmpty() ? null : list.toArray(new Uri[0]);
        }
        Uri single = data.getData();
        return single == null ? null : new Uri[] { single };
    }

    // ---------------------------------------------------------------- printing

    /** Renders the receipt in an offscreen WebView and hands it to the Android print framework (system dialog:
     *  a Bluetooth/Wi-Fi printer with a print service, or "save as PDF"). UI thread only. */
    void printHtml(final String html) {
        // one hidden WebView per print: the previous one is released first (it is never shown, so nothing is lost)
        if (printView != null) { try { printView.destroy(); } catch (Exception ignored) { } printView = null; }
        final WebView view = new WebView(this);
        WebSettings s = view.getSettings();
        s.setJavaScriptEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        view.setWebViewClient(new PrintClient(this));
        printView = view;
        view.loadDataWithBaseURL(ORIGIN, html, "text/html", "utf-8", null);
    }

    static final class PrintClient extends WebViewClient {
        private final MainActivity host;
        PrintClient(MainActivity host) { this.host = host; }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return host.serve(u.getPath());
            return null;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (view != host.printView) return;
            host.startPrintJob(view);
        }
    }

    void startPrintJob(WebView view) {
        try {
            PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
            if (pm == null) return;
            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter("receipt");
            printJob = pm.print("Kaseb receipt", adapter, new PrintAttributes.Builder().build());
        } catch (Exception ignored) {
            // no print service on this phone: nothing else to do
        }
    }

    // ---------------------------------------------------------------- the bridge

    void openOutside(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
    }

    /** What the web app may ask the phone (window.PosAndroid). Every method runs on a WebView background thread,
     *  so anything touching views goes through runOnUiThread. */
    static final class Bridge {
        private final MainActivity host;
        Bridge(MainActivity host) { this.host = host; }

        @JavascriptInterface
        public String deviceId() {
            try {
                String id = Settings.Secure.getString(host.getContentResolver(), Settings.Secure.ANDROID_ID);
                return id == null ? "" : id;
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public String deviceName() {
            String name = (Build.MANUFACTURER + " " + Build.MODEL).trim();
            return name.isEmpty() ? "Android" : name;
        }

        @JavascriptInterface
        public String signature() { return host.signingCertificateSha256(); }

        @JavascriptInterface
        public String version() {
            try {
                PackageInfo pi = host.getPackageManager().getPackageInfo(host.getPackageName(), 0);
                return pi.versionName == null ? "" : pi.versionName;
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            byte[] bytes;
            try { bytes = Base64.decode(base64 == null ? "" : base64, Base64.DEFAULT); }
            catch (Exception e) { bytes = new byte[0]; }
            host.startSaveFile(name, mime, bytes);
        }

        @JavascriptInterface
        public void print(final String html) {
            if (html == null || html.isEmpty()) return;
            host.runOnUiThread(new Runnable() {
                @Override
                public void run() { host.printHtml(html); }
            });
        }

        @JavascriptInterface
        public void share(final String text) {
            host.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                    try { host.startActivity(Intent.createChooser(send, "مشاركة")); } catch (Exception ignored) { }
                }
            });
        }

        @JavascriptInterface
        public String licenseGet() {
            try { return host.getSharedPreferences(LICENSE_PREFS, MODE_PRIVATE).getString(LICENSE_KEY, ""); }
            catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public void licenseSet(String value) {
            try {
                SharedPreferences.Editor e = host.getSharedPreferences(LICENSE_PREFS, MODE_PRIVATE).edit();
                if (value == null || value.isEmpty()) e.remove(LICENSE_KEY); else e.putString(LICENSE_KEY, value);
                e.commit();
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void openUrl(String url) {
            if (url == null || url.isEmpty()) return;
            try { host.openOutside(Uri.parse(url)); } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            if (ms <= 0) return;
            long duration = Math.min(ms, 2000);
            try {
                Vibrator v;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibratorManager vm = (VibratorManager) host.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    v = vm == null ? null : vm.getDefaultVibrator();
                } else {
                    v = (Vibrator) host.getSystemService(Context.VIBRATOR_SERVICE);
                }
                if (v == null || !v.hasVibrator()) return;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE));
                else v.vibrate(duration);
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public void keepScreenOn(final boolean on) {
            host.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Window w = host.getWindow();
                    if (on) w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    else w.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }
    }

    /** SHA-256 (hex) of the first certificate this APK was signed with: the license server compares it with the
     *  seller's allow-list, so a re-signed (modified) APK cannot activate. */
    String signingCertificateSha256() {
        try {
            PackageManager pm = getPackageManager();
            Signature[] sigs;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo pi = pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                SigningInfo info = pi.signingInfo;
                if (info == null) return "";
                sigs = info.hasMultipleSigners() ? info.getApkContentsSigners() : info.getSigningCertificateHistory();
            } else {
                @SuppressWarnings("deprecation")
                PackageInfo pi = pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES);
                sigs = pi.signatures;
            }
            if (sigs == null || sigs.length == 0) return "";
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(sigs[0].toByteArray());
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(Character.forDigit((b >> 4) & 0xf, 16)).append(Character.forDigit(b & 0xf, 16));
            return hex.toString();
        } catch (Exception e) {
            return "";
        }
    }

    // ---------------------------------------------------------------- serving assets/www

    WebResourceResponse serve(String path) {
        if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
        String rel = "www" + path;
        AssetManager am = getAssets();
        try {
            InputStream in = am.open(rel);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "max-age=31536000");
            String mime = mime(rel);
            boolean text = mime.startsWith("text/") || mime.endsWith("javascript") || mime.endsWith("json") || mime.endsWith("xml");
            return new WebResourceResponse(mime, text ? "utf-8" : null, 200, "OK", headers, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
        }
    }

    private static String mime(String p) {
        String l = p.toLowerCase();
        if (l.endsWith(".html")) return "text/html";
        if (l.endsWith(".js") || l.endsWith(".mjs")) return "application/javascript";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".json") || l.endsWith(".webmanifest")) return "application/json";
        if (l.endsWith(".svg")) return "image/svg+xml";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".ico")) return "image/x-icon";
        if (l.endsWith(".webp")) return "image/webp";
        if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg";
        if (l.endsWith(".gif")) return "image/gif";
        if (l.endsWith(".woff2")) return "font/woff2";
        if (l.endsWith(".woff")) return "font/woff";
        if (l.endsWith(".ttf")) return "font/ttf";
        if (l.endsWith(".wasm")) return "application/wasm";
        if (l.endsWith(".mp3")) return "audio/mpeg";
        if (l.endsWith(".txt")) return "text/plain";
        if (l.endsWith(".xml")) return "application/xml";
        return "application/octet-stream";
    }

    // ---------------------------------------------------------------- lifecycle

    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        // the page closes its topmost dialog itself; otherwise go back in history, and at the root just leave the app
        // in the background (the cart and the open screen survive)
        web.evaluateJavascript("(function(){try{return !!(window.onPosBack&&window.onPosBack())}catch(e){return false}})()", value -> {
            if ("true".equals(value)) return;
            if (web.canGoBack()) web.goBack();
            else moveTaskToBack(true);
        });
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

    @Override
    protected void onDestroy() {
        if (printView != null) { try { printView.destroy(); } catch (Exception ignored) { } printView = null; }
        super.onDestroy();
    }
}
