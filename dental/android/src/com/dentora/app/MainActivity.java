package com.dentora.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.Looper;
import android.os.Parcel;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Dentora on Android: one WebView showing the web app bundled in assets/www, served at https://dentora.app/
 * (a secure origin, so IndexedDB, crypto.subtle and module scripts behave exactly as in a browser).
 *
 * The page talks to the phone through window.DentoraAndroid (the contract in src/platform/index.ts):
 * deviceId · saveFile · print · appVersion · openExternal. File picking uses the WebView's own file chooser.
 *
 * Every callback is a named class (no lambdas or anonymous classes) so that d8 handles it on every JDK.
 */
public class MainActivity extends Activity {
    private static final int REQ_SAVE = 4101;
    private static final int REQ_PICK = 4102;
    private static final String PREFS = "dentora.shell";
    private static final String CRASHES = "crashes";
    private static final String PENDING_FILE = "pending-save.bin";
    private static final int MAX_SAVED_STATE = 256 * 1024;

    private WebView web;
    private FrameLayout root;
    private SharedPreferences prefs;
    /** The app's language as the page last reported it (html lang): native messages follow it. */
    private volatile String lang = "ar";

    // saveFile: the bytes wait here while the system "save as" screen is open. They are also written to the
    // cache folder, because Android may close the app behind that screen on a phone short of memory; a
    // backup that silently came out empty would be the worst possible failure for a clinic.
    private byte[] pendingBytes;
    private String pendingName;
    /** The page's <input type=file> waiting for the system picker. */
    private ValueCallback<Uri[]> pendingPick;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        keepCrashReports();
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        lang = prefs.getString("lang", "ar");
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener(new BarPadding());
        setContentView(root);
        styleBars();
        web = newWebView();
        if (!restore(savedInstanceState)) web.loadUrl(WebFiles.START_URL);
        showLastCrash();
    }

    // ---- crashes ---------------------------------------------------------------------------------------

    /** If the app ever stops on an error, the error is kept so that the next launch can show it. */
    private void keepCrashReports() {
        SharedPreferences crashes = getSharedPreferences(CRASHES, MODE_PRIVATE);
        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        if (previous instanceof CrashKeeper) return;
        Thread.setDefaultUncaughtExceptionHandler(new CrashKeeper(crashes, previous));
    }

    static final class CrashKeeper implements Thread.UncaughtExceptionHandler {
        private final SharedPreferences prefs;
        private final Thread.UncaughtExceptionHandler previous;
        CrashKeeper(SharedPreferences prefs, Thread.UncaughtExceptionHandler previous) { this.prefs = prefs; this.previous = previous; }

        @Override
        public void uncaughtException(Thread t, Throwable e) {
            try {
                StringWriter trace = new StringWriter();
                e.printStackTrace(new PrintWriter(trace));
                String text = "Dentora · Android " + Build.VERSION.RELEASE + " (SDK " + Build.VERSION.SDK_INT + ") · "
                    + Build.MANUFACTURER + " " + Build.MODEL + "\n" + trace;
                prefs.edit().putString("last", text.length() > 4000 ? text.substring(0, 4000) : text).commit();
            } catch (Throwable ignored) {
                // never let the reporter itself hide the original error
            }
            if (previous != null) previous.uncaughtException(t, e);
        }
    }

    /** Shows the error that closed the app last time, once, with a button to copy it for support. */
    private void showLastCrash() {
        SharedPreferences crashes = getSharedPreferences(CRASHES, MODE_PRIVATE);
        String last = crashes.getString("last", null);
        if (last == null) return;
        crashes.edit().remove("last").apply();
        new AlertDialog.Builder(this)
            .setTitle(WebFiles.text("crash_title", lang))
            .setMessage(WebFiles.text("crash_body", lang) + last)
            .setPositiveButton(WebFiles.text("copy", lang), new CopyText(this, last))
            .setNegativeButton(WebFiles.text("close", lang), null)
            .show();
    }

    static final class CopyText implements DialogInterface.OnClickListener {
        private final Activity host;
        private final String text;
        CopyText(Activity host, String text) { this.host = host; this.text = text; }

        @Override
        public void onClick(DialogInterface d, int which) {
            ClipboardManager cm = (ClipboardManager) host.getSystemService(CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Dentora error", text));
        }
    }

    // ---- window ----------------------------------------------------------------------------------------

    /** White system bars with dark icons; from Android 15 the app draws behind them, so the container is
     *  padded by their size (and by the keyboard's). Called after setContentView: before it the window has
     *  no decor view, and on Android 11–14 getInsetsController() then throws and the app closes at launch. */
    @SuppressWarnings("deprecation")
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
            } else {
                // Android 7 cannot draw dark navigation buttons: on a white bar they would be invisible
                w.setNavigationBarColor(Color.BLACK);
                decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            }
        } catch (RuntimeException ignored) {
            // only the colour of the bars: never a reason to stop the app
        }
    }

    /** Keeps the page clear of the status bar, the navigation bar, the camera cut-out and the keyboard. */
    static final class BarPadding implements View.OnApplyWindowInsetsListener {
        @Override
        @SuppressWarnings("deprecation")
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

    // ---- the WebView -----------------------------------------------------------------------------------

    @SuppressWarnings("deprecation")
    private WebView newWebView() {
        WebView v = new WebView(this);
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage (session, preferences)
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);           // the app is served from assets, never from file://
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);                    // the layout is designed for 100%; the phone's font size must not break it
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(false);    // target=_blank links come through shouldOverrideUrlLoading
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " Dentora/" + versionName());
        v.setBackgroundColor(Color.WHITE);
        v.setWebViewClient(new AppClient(this));
        v.setWebChromeClient(new ChromeClient(this));
        v.setDownloadListener(new Downloads(this));
        v.addJavascriptInterface(new Bridge(this), "DentoraAndroid");
        root.addView(v, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        return v;
    }

    /** After Android recreated the activity (the process was reclaimed in the background): reopen the same page. */
    private boolean restore(Bundle state) {
        if (state == null) return false;
        Bundle saved = state.getBundle("web");
        if (saved != null && web.restoreState(saved) != null) return true;
        String url = state.getString("url");
        if (url == null) return false;
        Uri u = Uri.parse(url);
        if (!WebFiles.isAppUrl(u.getScheme(), u.getHost())) return false;
        web.loadUrl(url);
        return true;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web == null) return;
        String url = web.getUrl();
        if (url != null) outState.putString("url", url);
        // the full history only when it is small: a saved state over ~1 MB makes Android stop the app
        Bundle saved = new Bundle();
        if (web.saveState(saved) != null && sizeOf(saved) < MAX_SAVED_STATE) outState.putBundle("web", saved);
    }

    private static int sizeOf(Bundle b) {
        Parcel p = Parcel.obtain();
        try {
            p.writeBundle(b);
            return p.dataSize();
        } catch (RuntimeException e) {
            return Integer.MAX_VALUE;
        } finally {
            p.recycle();
        }
    }

    /** The page's process was stopped (usually the phone ran short of memory): open the app's page again
     *  in a new WebView. Without this Android closes the whole app. */
    void restartPage(WebView dead) {
        if (dead != web) return;
        ValueCallback<Uri[]> pick = pendingPick;
        pendingPick = null;
        if (pick != null) {
            try { pick.onReceiveValue(null); } catch (RuntimeException ignored) { }
        }
        root.removeView(dead);
        dead.destroy();
        web = newWebView();
        web.loadUrl(WebFiles.START_URL);
    }

    /** Answers every request for https://dentora.app/… from assets/www. Never touches the network. */
    WebResourceResponse serve(String path) {
        Map<String, String> headers = new HashMap<>();
        String asset = WebFiles.assetPath(path);
        if (asset != null) {
            try {
                InputStream in = getAssets().open(asset);
                String mime = WebFiles.mimeFor(asset);
                headers.put("Cache-Control", WebFiles.cacheControl(asset));
                headers.put("Access-Control-Allow-Origin", "*");
                headers.put("X-Content-Type-Options", "nosniff");
                return new WebResourceResponse(mime, WebFiles.isText(mime) ? "utf-8" : null, 200, "OK", headers, in);
            } catch (IOException ignored) {
                // fall through to 404
            }
        }
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0]));
    }

    /** Where a link goes: the app's own pages stay inside; tel:, mailto:, WhatsApp and the web go to the phone. */
    boolean route(Uri u, boolean mainFrame) {
        switch (WebFiles.linkAction(u.getScheme(), u.getHost(), mainFrame)) {
            case "app":
            case "allow":
                return false;
            case "data":
                saveDataUrl(u.toString(), "");
                return true;
            case "blob":
                saveBlobUrl(u.toString(), "");
                return true;
            default:
                openOutside(u.toString());
                return true;
        }
    }

    /** What every page of the app gets from the shell: window.print → the phone's printing, and saveFile()
     *  answering when the save really ends. Run as soon as the page is visible and again when it has loaded
     *  (both scripts install themselves once per page). */
    void setUpPage(WebView view) {
        view.evaluateJavascript(WebFiles.PRINT_SHIM_JS, null);
        view.evaluateJavascript(WebFiles.BRIDGE_JS, null);
    }

    /** Hands a link to the app that handles it (WhatsApp, the dialer, e-mail, the browser). UI thread. */
    void openOutside(String url) {
        if (url == null || url.trim().isEmpty()) return;
        String clean = url.trim();
        Uri u = Uri.parse(clean);
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
        if (WebFiles.isAppUrl(scheme, u.getHost())) { if (web != null) web.loadUrl(clean); return; }
        if (scheme.isEmpty() || scheme.equals("javascript") || scheme.equals("file") || scheme.equals("content")) return;
        try {
            if (scheme.equals("intent")) {
                Intent i = Intent.parseUri(clean, Intent.URI_INTENT_SCHEME);
                i.addCategory(Intent.CATEGORY_BROWSABLE);
                i.setComponent(null);
                i.setSelector(null);
                try {
                    startActivity(i);
                } catch (ActivityNotFoundException e) {
                    String fallback = i.getStringExtra("browser_fallback_url");
                    if (fallback != null && (fallback.startsWith("https://") || fallback.startsWith("http://"))) openOutside(fallback);
                    else say("no_app");
                }
                return;
            }
            startActivity(new Intent(WebFiles.externalAction(scheme), u));
        } catch (ActivityNotFoundException e) {
            say("no_app");
        } catch (URISyntaxException | RuntimeException e) {
            say("no_app");
        }
    }

    /** Named (not anonymous) so that d8 handles it on every JDK. */
    static final class AppClient extends WebViewClient {
        private final MainActivity host;
        AppClient(MainActivity host) { this.host = host; }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (WebFiles.isAppUrl(u.getScheme(), u.getHost())) return host.serve(u.getPath());
            return null;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return host.route(request.getUrl(), request.isForMainFrame());
        }

        @Override
        public void onPageCommitVisible(WebView view, String url) {
            host.setUpPage(view);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            host.setUpPage(view);
            host.refreshLang();
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            host.restartPage(view);
            return true;
        }
    }

    // ---- file picking (<input type=file> and pickFile()) ------------------------------------------------

    static final class ChromeClient extends WebChromeClient {
        private final MainActivity host;
        ChromeClient(MainActivity host) { this.host = host; }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            return host.pickFiles(callback, params.getAcceptTypes(), params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
        }
    }

    boolean pickFiles(ValueCallback<Uri[]> callback, String[] accept, boolean multiple) {
        if (pendingPick != null) {
            try { pendingPick.onReceiveValue(null); } catch (RuntimeException ignored) { }
        }
        pendingPick = callback;
        String[] mimes = WebFiles.pickerMimes(accept);
        String[] actions = {Intent.ACTION_GET_CONTENT, Intent.ACTION_OPEN_DOCUMENT};
        for (String action : actions) {
            Intent i = new Intent(action);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(WebFiles.pickerType(mimes));
            if (mimes.length > 1) i.putExtra(Intent.EXTRA_MIME_TYPES, mimes);
            if (multiple) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(i, REQ_PICK);
                return true;
            } catch (ActivityNotFoundException e) {
                // a trimmed-down phone without a GET_CONTENT handler: try the documents screen next
            }
        }
        pendingPick = null;
        say("no_picker");
        return false;
    }

    private static Uri[] pickedUris(Intent data) {
        if (data == null) return null;
        ClipData clip = data.getClipData();
        if (clip != null && clip.getItemCount() > 0) {
            int n = 0;
            Uri[] all = new Uri[clip.getItemCount()];
            for (int i = 0; i < clip.getItemCount(); i++) {
                Uri u = clip.getItemAt(i).getUri();
                if (u != null) all[n++] = u;
            }
            if (n > 0) {
                Uri[] out = new Uri[n];
                System.arraycopy(all, 0, out, 0, n);
                return out;
            }
        }
        Uri u = data.getData();
        return u == null ? null : new Uri[] {u};
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_PICK) {
            ValueCallback<Uri[]> cb = pendingPick;
            pendingPick = null;
            Uri[] picked = resultCode == RESULT_OK ? pickedUris(data) : null;
            // always answer, even with null: an unanswered chooser stops <input type=file> from working
            if (cb != null) cb.onReceiveValue(picked);
            // pickFile() (src/platform) learns that the picker was cancelled from the window's focus event
            if (picked == null && web != null) web.evaluateJavascript(WebFiles.PICK_CANCELLED_JS, null);
            return;
        }
        if (requestCode == REQ_SAVE) {
            finishSave(resultCode == RESULT_OK && data != null ? data.getData() : null);
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ---- saving files (backups, CSV, PDFs) through the system "save as" screen --------------------------

    /** Keeps the bytes and opens the save screen. Any thread; returns at once (true = a dialog is shown). */
    boolean startSave(String name, String mime, byte[] bytes) {
        String type = WebFiles.baseMime(mime);
        String fileName = WebFiles.safeFileName(name, type);
        synchronized (this) {
            pendingBytes = bytes;
            pendingName = fileName;
        }
        keepPendingOnDisk(bytes, fileName);
        runOnUiThread(new LaunchSave(this, fileName, type));
        return true;
    }

    static final class LaunchSave implements Runnable {
        private final MainActivity host;
        private final String name;
        private final String type;
        LaunchSave(MainActivity host, String name, String type) { this.host = host; this.name = name; this.type = type; }

        @Override
        public void run() { host.launchSave(name, type); }
    }

    @SuppressWarnings("deprecation")
    void launchSave(String name, String type) {
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(type);
        i.putExtra(Intent.EXTRA_TITLE, name);
        try {
            startActivityForResult(i, REQ_SAVE);
        } catch (ActivityNotFoundException e) {
            // no documents screen on this phone: put the file in Downloads/Dentora instead
            new Thread(new DownloadsWriter(this, name, type), "dentora-save").start();
        } catch (RuntimeException e) {
            // the page waits for an answer (saveFile's Promise): always give one
            dropPending();
            say("save_failed");
            notifySaved(false, false, name);
        }
    }

    private void keepPendingOnDisk(byte[] bytes, String name) {
        File f = new File(getCacheDir(), PENDING_FILE);
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(bytes);
            prefs.edit().putString("pendingName", name).commit();
        } catch (IOException | RuntimeException e) {
            f.delete();
        }
    }

    /** The bytes waiting to be saved: from memory, or from the cache folder after Android recreated the app. */
    byte[] takePending() {
        byte[] b;
        synchronized (this) {
            b = pendingBytes;
            pendingBytes = null;
        }
        if (b != null) return b;
        File f = new File(getCacheDir(), PENDING_FILE);
        if (!f.isFile()) return null;
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] data = new byte[(int) f.length()];
            int off = 0;
            while (off < data.length) {
                int n = in.read(data, off, data.length - off);
                if (n < 0) break;
                off += n;
            }
            return off == data.length ? data : null;
        } catch (IOException | RuntimeException | OutOfMemoryError e) {
            return null;
        }
    }

    String pendingName() {
        synchronized (this) {
            if (pendingName != null) return pendingName;
        }
        return prefs.getString("pendingName", "Dentora");
    }

    void dropPending() {
        synchronized (this) {
            pendingBytes = null;
            pendingName = null;
        }
        new File(getCacheDir(), PENDING_FILE).delete();
        prefs.edit().remove("pendingName").apply();
    }

    /** The save screen closed: write the bytes to the chosen document (off the UI thread), or drop them. */
    void finishSave(Uri target) {
        String name = pendingName();
        if (target == null) {
            dropPending();
            notifySaved(false, true, name);
            return;
        }
        new Thread(new WriteFile(this, target, name), "dentora-save").start();
    }

    static final class WriteFile implements Runnable {
        private final MainActivity host;
        private final Uri target;
        private final String name;
        WriteFile(MainActivity host, Uri target, String name) { this.host = host; this.target = target; this.name = name; }

        @Override
        public void run() {
            boolean ok = false;
            byte[] data = host.takePending();
            if (data != null) {
                try (OutputStream out = host.getContentResolver().openOutputStream(target)) {
                    if (out != null) {
                        out.write(data);
                        out.flush();
                        ok = true;
                    }
                } catch (IOException | RuntimeException e) {
                    ok = false;
                }
            }
            if (!ok) {
                // do not leave an empty file behind that looks like a backup
                try { DocumentsContract.deleteDocument(host.getContentResolver(), target); } catch (Exception ignored) { }
            }
            host.dropPending();
            host.runOnUiThread(new Saved(host, ok, name, null));
        }
    }

    /** Fallback when the phone has no "save as" screen: Downloads/Dentora (no permission needed). */
    static final class DownloadsWriter implements Runnable {
        private final MainActivity host;
        private final String name;
        private final String type;
        DownloadsWriter(MainActivity host, String name, String type) { this.host = host; this.name = name; this.type = type; }

        @Override
        public void run() {
            byte[] data = host.takePending();
            boolean ok = data != null && host.writeToDownloads(name, type, data);
            host.dropPending();
            host.runOnUiThread(new Saved(host, ok, name, ok ? "saved_downloads" : null));
        }
    }

    boolean writeToDownloads(String name, String type, byte[] data) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                v.put(MediaStore.MediaColumns.MIME_TYPE, type);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Dentora");
                Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (u == null) return false;
                try (OutputStream out = getContentResolver().openOutputStream(u)) {
                    if (out == null) return false;
                    out.write(data);
                }
                return true;
            }
            File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) return false;
            dir.mkdirs();
            try (FileOutputStream out = new FileOutputStream(new File(dir, name))) {
                out.write(data);
            }
            return true;
        } catch (IOException | RuntimeException e) {
            return false;
        }
    }

    static final class Saved implements Runnable {
        private final MainActivity host;
        private final boolean ok;
        private final String name;
        private final String message;
        Saved(MainActivity host, boolean ok, String name, String message) { this.host = host; this.ok = ok; this.name = name; this.message = message; }

        @Override
        public void run() {
            // success needs no toast of the shell's own: the page confirms it (saveFile's Promise answers now)
            if (message != null) host.say(message, name);
            else if (!ok) host.say("save_failed");
            host.notifySaved(ok, false, name);
        }
    }

    void notifySaved(boolean ok, boolean cancelled, String name) {
        if (web != null) web.evaluateJavascript(WebFiles.savedEventJs(ok, cancelled, name), null);
    }

    /** A data: URL the page tried to open or download: decode it here and save it like any other file. */
    void saveDataUrl(String url, String name) {
        WebFiles.DataUrl d = WebFiles.parseDataUrl(url);
        if (d == null) return;
        try {
            byte[] bytes = d.base64 ? Base64.decode(d.payload, Base64.DEFAULT) : WebFiles.percentDecode(d.payload);
            startSave(name, d.mime, bytes);
        } catch (IllegalArgumentException | OutOfMemoryError e) {
            say("save_failed");
        }
    }

    /** A blob: URL only exists inside the page: ask the page to read it and call saveFile. */
    void saveBlobUrl(String url, String name) {
        if (web != null) web.evaluateJavascript(WebFiles.saveBlobJs(url, name), null);
    }

    static final class Downloads implements DownloadListener {
        private final MainActivity host;
        Downloads(MainActivity host) { this.host = host; }

        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
            if (url == null) return;
            String name = URLUtil.guessFileName(url, contentDisposition, mimetype);
            if (url.regionMatches(true, 0, "data:", 0, 5)) host.saveDataUrl(url, name);
            else if (url.regionMatches(true, 0, "blob:", 0, 5)) host.saveBlobUrl(url, name);
            else host.openOutside(url);
        }
    }

    // ---- printing --------------------------------------------------------------------------------------

    /** Prints what the page shows with its print styles (only .print-area), on A4, through the phone's
     *  print service (a printer, or "Save as PDF"). */
    void printPage() {
        if (web == null) return;
        // from here on the page's afterprint waits for printFinished(), which every path below reaches once
        web.evaluateJavascript(WebFiles.PRINT_HOLD_JS, null);
        try {
            PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
            if (pm == null) { say("no_print"); printFinished(); return; }
            String title = web.getTitle();
            String job = title == null || title.trim().isEmpty() || title.startsWith("Dentora") ? "Dentora" : "Dentora - " + title.trim();
            PrintDocumentAdapter adapter = new PrintJobAdapter(this, web.createPrintDocumentAdapter(job));
            PrintAttributes attrs = new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build();
            pm.print(job, adapter, attrs);
        } catch (RuntimeException e) {
            say("no_print");
            printFinished();
        }
    }

    /** The print screen closed (printed, saved as PDF or cancelled): the page may leave its print layout. */
    void printFinished() {
        if (web != null) web.evaluateJavascript(WebFiles.PRINT_DONE_JS, null);
    }

    /** The WebView's own print adapter, plus a call to printFinished() when the print screen is done with it. */
    static final class PrintJobAdapter extends PrintDocumentAdapter {
        private final MainActivity host;
        private final PrintDocumentAdapter page;
        PrintJobAdapter(MainActivity host, PrintDocumentAdapter page) { this.host = host; this.page = page; }

        @Override
        public void onStart() { page.onStart(); }

        @Override
        public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancel,
                             LayoutResultCallback callback, Bundle extras) {
            page.onLayout(oldAttributes, newAttributes, cancel, callback, extras);
        }

        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancel, WriteResultCallback callback) {
            page.onWrite(pages, destination, cancel, callback);
        }

        @Override
        public void onFinish() {
            try {
                page.onFinish();
            } finally {
                host.printFinished();
            }
        }
    }

    static final class PrintPage implements Runnable {
        private final MainActivity host;
        PrintPage(MainActivity host) { this.host = host; }

        @Override
        public void run() { host.printPage(); }
    }

    static final class OpenLink implements Runnable {
        private final MainActivity host;
        private final String url;
        OpenLink(MainActivity host, String url) { this.host = host; this.url = url; }

        @Override
        public void run() { host.openOutside(url); }
    }

    // ---- the bridge: window.DentoraAndroid --------------------------------------------------------------

    /** What the web app may ask of the phone. Called on the WebView's bridge thread, never the UI thread. */
    static final class Bridge {
        private final MainActivity host;
        Bridge(MainActivity host) { this.host = host; }

        /** ANDROID_ID: survives reinstalling the app; on Android 8+ it is tied to the app's signing key. */
        @JavascriptInterface
        public String deviceId() {
            try {
                String id = Settings.Secure.getString(host.getContentResolver(), Settings.Secure.ANDROID_ID);
                return id == null ? "" : id;
            } catch (RuntimeException e) {
                return "";
            }
        }

        /** Opens the system "save as" screen for the file; true = the screen is shown (the save ends later). */
        @JavascriptInterface
        public boolean saveFile(String name, String mime, String base64) {
            try {
                byte[] bytes = Base64.decode(base64 == null ? "" : base64, Base64.DEFAULT);
                return host.startSave(name, mime, bytes);
            } catch (IllegalArgumentException | OutOfMemoryError e) {
                host.say("save_failed");
                return false;
            }
        }

        @JavascriptInterface
        public void print() { host.runOnUiThread(new PrintPage(host)); }

        @JavascriptInterface
        public String appVersion() { return host.versionName(); }

        @JavascriptInterface
        public void openExternal(String url) { host.runOnUiThread(new OpenLink(host, url)); }
    }

    @SuppressWarnings("deprecation")
    String versionName() {
        try {
            PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            return pi.versionName == null ? "" : pi.versionName;
        } catch (PackageManager.NameNotFoundException | RuntimeException e) {
            return "";
        }
    }

    // ---- short messages in the app's language ------------------------------------------------------------

    void say(String key) { say(key, ""); }

    /** Shows a toast in the language the page is using (asked of the page first). Any thread. */
    void say(String key, String suffix) {
        if (Looper.myLooper() != Looper.getMainLooper()) { runOnUiThread(new Say(this, key, suffix)); return; }
        if (web == null) { toast(WebFiles.text(key, lang) + suffix); return; }
        web.evaluateJavascript("document.documentElement.lang", new Say(this, key, suffix));
    }

    /** Remembers the page's language (for messages shown before the page loads, like the crash dialog). */
    void refreshLang() {
        if (web != null) web.evaluateJavascript("document.documentElement.lang", new Say(this, null, ""));
    }

    void setLang(String value) {
        String v = value == null ? "" : value.replace("\"", "").trim();
        if (v.isEmpty() || v.equals("null")) return;
        if (!v.equals(lang)) {
            lang = v;
            prefs.edit().putString("lang", v).apply();
        }
    }

    void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }

    /** Runnable (to hop onto the UI thread) and the answer of evaluateJavascript (the page's language). */
    static final class Say implements Runnable, ValueCallback<String> {
        private final MainActivity host;
        private final String key;
        private final String suffix;
        Say(MainActivity host, String key, String suffix) { this.host = host; this.key = key; this.suffix = suffix; }

        @Override
        public void run() { if (key != null) host.say(key, suffix); }

        @Override
        public void onReceiveValue(String value) {
            host.setLang(value);
            if (key != null) host.toast(WebFiles.text(key, host.lang) + suffix);
        }
    }

    // ---- lifecycle --------------------------------------------------------------------------------------

    /** Back: first closes an open dialog or menu in the page, then goes back a page; on the start page the
     *  app goes to the background (like Home) instead of closing, so the session and the page stay as they were. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript(WebFiles.BACK_JS, new Back(this));
    }

    static final class Back implements ValueCallback<String> {
        private final MainActivity host;
        Back(MainActivity host) { this.host = host; }

        @Override
        public void onReceiveValue(String value) { host.afterBack(value); }
    }

    void afterBack(String answer) {
        String a = answer == null ? "" : answer.replace("\"", "");
        if (a.equals("handled")) return;
        if (!a.equals("home") && web != null && web.canGoBack()) { web.goBack(); return; }
        moveTaskToBack(true);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            root.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
