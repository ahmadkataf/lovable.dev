package com.dentora.app;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.CRC32;

/**
 * The plain-Java decisions of the Android shell: which asset answers a URL, its MIME type, how a saved file is
 * named, which files the picker offers, how a data: URL is split. No Android classes here, so that
 * android/test/WebFilesTest.java can check all of it on a desktop JVM (scripts/build-apk.sh runs it).
 */
final class WebFiles {
    private WebFiles() { }

    /** The origin the app is served from. Its storage (IndexedDB, localStorage) belongs to this name: never change it. */
    static final String HOST = "dentora.app";
    static final String START_URL = "https://" + HOST + "/index.html";
    static final String INDEX = "www/index.html";

    private static final Map<String, String> TYPES = new HashMap<>();
    /** The usual extension of a MIME type: the first one listed below (json, not map; jpg, not jpeg). */
    private static final Map<String, String> EXTENSIONS = new HashMap<>();
    static {
        String[][] t = {
            {"html", "text/html"}, {"htm", "text/html"}, {"js", "application/javascript"}, {"mjs", "application/javascript"},
            {"css", "text/css"}, {"json", "application/json"}, {"map", "application/json"}, {"webmanifest", "application/manifest+json"},
            {"txt", "text/plain"}, {"csv", "text/csv"}, {"xml", "application/xml"},
            {"svg", "image/svg+xml"}, {"png", "image/png"}, {"jpg", "image/jpeg"}, {"jpeg", "image/jpeg"}, {"gif", "image/gif"},
            {"webp", "image/webp"}, {"avif", "image/avif"}, {"bmp", "image/bmp"}, {"ico", "image/x-icon"},
            {"heic", "image/heic"}, {"heif", "image/heif"}, {"tif", "image/tiff"}, {"tiff", "image/tiff"},
            {"woff2", "font/woff2"}, {"woff", "font/woff"}, {"ttf", "font/ttf"}, {"otf", "font/otf"},
            {"mp3", "audio/mpeg"}, {"wav", "audio/wav"}, {"ogg", "audio/ogg"}, {"m4a", "audio/mp4"},
            {"mp4", "video/mp4"}, {"webm", "video/webm"}, {"wasm", "application/wasm"},
            {"pdf", "application/pdf"}, {"zip", "application/zip"}, {"dcm", "application/dicom"}, {"stl", "model/stl"},
            {"doc", "application/msword"}, {"docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
            {"xls", "application/vnd.ms-excel"}, {"xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
        };
        for (String[] p : t) {
            TYPES.put(p[0], p[1]);
            if (!EXTENSIONS.containsKey(p[1])) EXTENSIONS.put(p[1], p[0]);
        }
    }

    private static String extension(String name) {
        if (name == null) return "";
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        int dot = name.lastIndexOf('.');
        return dot > slash && dot < name.length() - 1 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
    }

    /** MIME type by file extension; application/octet-stream when unknown. */
    static String mimeFor(String path) {
        String m = TYPES.get(extension(path));
        return m == null ? "application/octet-stream" : m;
    }

    /** Text types are answered with a charset; binary ones (fonts, images) without. */
    static boolean isText(String mime) {
        return mime.startsWith("text/") || mime.equals("application/javascript") || mime.equals("application/json")
            || mime.equals("application/manifest+json") || mime.equals("application/xml") || mime.equals("image/svg+xml");
    }

    /**
     * The asset (under assets/) that answers a URL path of https://dentora.app, or null when the path tries to
     * leave www/. The app uses a hash router, so every page is index.html; a path without an extension also
     * gets index.html (a reload of a mistyped address still opens the app).
     */
    static String assetPath(String urlPath) {
        if (urlPath == null || urlPath.isEmpty() || urlPath.equals("/")) return INDEX;
        if (urlPath.indexOf('\\') >= 0 || urlPath.indexOf('\0') >= 0) return null;
        String p = urlPath;
        while (p.startsWith("/")) p = p.substring(1);
        for (String seg : p.split("/", -1)) {
            if (seg.equals("..") || seg.equals(".")) return null;
        }
        if (p.isEmpty() || p.endsWith("/")) return INDEX;
        if (extension(p).isEmpty()) return INDEX;
        return "www/" + p;
    }

    /** Vite names its bundles with a content hash (assets/index-AbC123.js): those can be cached for good. */
    static String cacheControl(String asset) {
        return asset.startsWith("www/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
    }

    /** "text/csv;charset=utf-8" → "text/csv"; anything that is not type/subtype → application/octet-stream. */
    static String baseMime(String mime) {
        if (mime == null) return "application/octet-stream";
        int semi = mime.indexOf(';');
        String m = (semi >= 0 ? mime.substring(0, semi) : mime).trim().toLowerCase(Locale.ROOT);
        int slash = m.indexOf('/');
        if (slash <= 0 || slash == m.length() - 1 || m.indexOf(' ') >= 0) return "application/octet-stream";
        return m;
    }

    /** A file name the system "save as" screen accepts: no folders, no characters Windows or Android refuse. */
    static String safeFileName(String name, String mime) {
        StringBuilder b = new StringBuilder();
        if (name != null) {
            for (int i = 0; i < name.length(); i++) {
                char c = name.charAt(i);
                if (c < 0x20 || c == 0x7f || "\\/:*?\"<>|".indexOf(c) >= 0) b.append('_');
                else b.append(c);
            }
        }
        String n = b.toString().trim();
        while (n.startsWith(".")) n = n.substring(1);
        if (n.isEmpty()) {
            String ext = EXTENSIONS.get(baseMime(mime));
            n = ext == null ? "Dentora" : "Dentora." + ext;
        }
        if (n.length() > 120) {
            String ext = extension(n);
            int keep = 120 - (ext.isEmpty() ? 0 : ext.length() + 1);
            n = n.substring(0, keep) + (ext.isEmpty() ? "" : "." + ext);
        }
        return n;
    }

    /**
     * The MIME filter for the system file picker, from an <input accept="..."> list. Images, video, audio and
     * PDF are filtered; anything else (a .json backup, a .csv) opens every file, because file managers and
     * cloud drives often report those as text/plain or application/octet-stream and a strict filter would hide
     * the very backup the clinic is trying to restore. The web app checks the content itself.
     */
    static String[] pickerMimes(String[] accept) {
        List<String> out = new ArrayList<>();
        if (accept != null) {
            for (String raw : accept) {
                if (raw == null) continue;
                for (String token : raw.split(",")) {
                    String t = token.trim().toLowerCase(Locale.ROOT);
                    if (t.isEmpty()) continue;
                    String m = t.startsWith(".") ? TYPES.get(t.substring(1)) : t;
                    if (m == null) return new String[] {"*/*"};
                    if (!(m.startsWith("image/") || m.startsWith("video/") || m.startsWith("audio/") || m.equals("application/pdf"))) return new String[] {"*/*"};
                    if (!out.contains(m)) out.add(m);
                }
            }
        }
        return out.isEmpty() ? new String[] {"*/*"} : out.toArray(new String[0]);
    }

    /** The picker intent's own type: the single MIME type, the shared family (image/*), or any file. */
    static String pickerType(String[] mimes) {
        if (mimes.length == 1) return mimes[0];
        String family = null;
        for (String m : mimes) {
            String f = m.substring(0, m.indexOf('/'));
            if (family == null) family = f;
            else if (!family.equals(f)) return "*/*";
        }
        return family == null ? "*/*" : family + "/*";
    }

    /** A parsed data: URL. The payload is still base64 text when base64 is true. */
    static final class DataUrl {
        final String mime;
        final boolean base64;
        final String payload;
        DataUrl(String mime, boolean base64, String payload) { this.mime = mime; this.base64 = base64; this.payload = payload; }
    }

    /** Splits "data:[mime][;params][;base64],payload"; null when it is not a data: URL. */
    static DataUrl parseDataUrl(String url) {
        if (url == null || !url.regionMatches(true, 0, "data:", 0, 5)) return null;
        int comma = url.indexOf(',');
        if (comma < 0) return null;
        String head = url.substring(5, comma);
        boolean b64 = false;
        String mime = "";
        String[] parts = head.split(";");
        for (int i = 0; i < parts.length; i++) {
            String p = parts[i].trim();
            if (i == 0) mime = p;
            else if (p.equalsIgnoreCase("base64")) b64 = true;
        }
        return new DataUrl(mime.isEmpty() ? "text/plain" : baseMime(mime), b64, url.substring(comma + 1));
    }

    /** Percent-decodes a non-base64 data: payload to bytes (UTF-8). '+' stays '+', unlike form decoding. */
    static byte[] percentDecode(String s) {
        ByteArrayOutputStream out = new ByteArrayOutputStream(s.length());
        byte[] raw = s.getBytes(StandardCharsets.UTF_8);
        for (int i = 0; i < raw.length; i++) {
            byte c = raw[i];
            if (c == '%' && i + 2 < raw.length) {
                int hi = Character.digit(raw[i + 1], 16), lo = Character.digit(raw[i + 2], 16);
                if (hi >= 0 && lo >= 0) { out.write(hi * 16 + lo); i += 2; continue; }
            }
            out.write(c);
        }
        return out.toByteArray();
    }

    /** A Java string as a JavaScript string literal (for evaluateJavascript). */
    static String jsString(String s) {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder(s.length() + 2).append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                case '<': b.append("\\u003c"); break;
                case '\u2028': b.append("\\u2028"); break;
                case '\u2029': b.append("\\u2029"); break;
                default:
                    if (c < 0x20) b.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        return b.append('"').toString();
    }

    /** True for addresses the app itself serves; everything else is handed to another app. */
    static boolean isAppUrl(String scheme, String host) {
        return scheme != null && host != null && (scheme.equalsIgnoreCase("https") || scheme.equalsIgnoreCase("http")) && host.equalsIgnoreCase(HOST);
    }

    /**
     * What the shell does with a navigation (shouldOverrideUrlLoading): "app" the app's own pages stay inside,
     * "allow" the WebView handles it (about:, javascript:, a frame inside the page), "data" / "blob" a file the
     * page tried to open is saved, "outside" handed to the app that handles it (tel:, mailto:, WhatsApp, the web).
     */
    static String linkAction(String scheme, String host, boolean mainFrame) {
        String s = scheme == null ? "" : scheme.toLowerCase(Locale.ROOT);
        if (isAppUrl(s, host)) return "app";
        if (s.equals("about") || s.equals("javascript")) return "allow";
        if (s.equals("data")) return "data";
        if (s.equals("blob")) return "blob";
        if (!mainFrame && (s.equals("http") || s.equals("https"))) return "allow";
        return "outside";
    }

    /** The intent action that suits a link handed to the system. */
    static String externalAction(String scheme) {
        String s = scheme == null ? "" : scheme.toLowerCase(Locale.ROOT);
        switch (s) {
            case "tel": return "android.intent.action.DIAL";
            case "mailto":
            case "sms":
            case "smsto": return "android.intent.action.SENDTO";
            default: return "android.intent.action.VIEW";
        }
    }

    /**
     * The Android back button, asked of the page first: an open dialog, drawer or menu is closed with Escape
     * (the web app closes them on that key). Answers "handled", "home" (the start page: leave the app) or "page".
     */
    static final String BACK_JS =
        "(function(){try{"
        + "if(typeof window.__dentoraBack==='function'&&window.__dentoraBack())return 'handled';"
        + "var open=document.querySelector('[aria-modal=\"true\"],.overlay,.drawer,.menu');"
        + "if(open){var t=document.activeElement||document.body;"
        + "t.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true}));"
        + "return 'handled';}"
        + "var h=location.hash||'';"
        + "if(h===''||h==='#'||h==='#/'||h.indexOf('#/login')===0||h.indexOf('#/setup')===0)return 'home';"
        + "}catch(e){}return 'page';})()";

    /**
     * Run on every page: window.print() does nothing in a WebView, so it goes to the bridge, as the platform layer
     * does. And the page's 'afterprint' handlers (which take the page out of its print layout) get a thin wrapper:
     * while an Android print job is open (window.__dentoraPrinting, set by PRINT_HOLD_JS) they ignore the WebView's
     * own afterprint, because the print screen renders the page again whenever the paper or orientation changes;
     * PRINT_DONE_JS runs them once, when the print screen closes. (A capture listener cannot do this: on window,
     * Chromium runs listeners in the order they were added.)
     */
    static final String PRINT_SHIM_JS =
        "(function(){try{if(!window.DentoraAndroid||window.__dentoraPrintShim)return;window.__dentoraPrintShim=true;"
        + "window.print=function(){window.DentoraAndroid.print();};"
        + "var add=window.addEventListener,rem=window.removeEventListener,held=new WeakMap();"
        + "var hold=function(l){var w=held.get(l);if(!w){w=function(e){if(window.__dentoraPrinting&&!e.__dentora)return;"
        + "return typeof l==='function'?l.call(this,e):l.handleEvent(e);};held.set(l,w);}return w;};"
        + "window.addEventListener=function(t,l,o){return t==='afterprint'&&l&&(typeof l==='function'||typeof l.handleEvent==='function')"
        + "?add.call(this,t,hold(l),o):add.apply(this,arguments);};"
        + "window.removeEventListener=function(t,l,o){return t==='afterprint'&&l&&held.has(l)?rem.call(this,t,held.get(l),o):rem.apply(this,arguments);};"
        + "}catch(e){}})()";

    /**
     * Run on every page (with the print shim): wraps window.DentoraAndroid. Saving goes in pieces (the contract in
     * src/platform/index.ts): saveBegin → saveChunk (base64, about 1 MB each) → saveEnd, which opens the system
     * "save as" screen; the end of the save arrives as the window event 'dentora:saved' {id, ok, cancelled, name,
     * reason}. whenSaved(id) gives a Promise for it. If the wrapper cannot be installed the page keeps the plain bridge.
     */
    static final String BRIDGE_JS =
        "(function(){try{var real=window.DentoraAndroid;if(!real||real.__dentora)return;"
        + "var w={__dentora:true,"
        + "deviceId:function(){return real.deviceId();},"
        + "appVersion:function(){return real.appVersion();},"
        + "print:function(){real.print();},"
        + "openExternal:function(u){real.openExternal(String(u));},"
        + "saveBegin:function(n,m,h,q){return real.saveBegin(String(n),String(m),String(h||0),q?'1':'');},"
        + "saveChunk:function(id,b){return real.saveChunk(String(id),String(b));},"
        + "saveEnd:function(id,s,c){return real.saveEnd(String(id),String(s),String(c));},"
        + "saveAbort:function(id){real.saveAbort(String(id));},"
        + "whenSaved:function(id){return new Promise(function(r){var on=function(e){var d=e.detail||{};if(d.id!==id)return;"
        + "window.removeEventListener('dentora:saved',on);r(d);};window.addEventListener('dentora:saved',on);});}};"
        + "try{window.DentoraAndroid=w;}catch(x){}"
        + "if(window.DentoraAndroid!==w)Object.defineProperty(window,'DentoraAndroid',{value:w,configurable:true,writable:true});"
        + "}catch(e){}})()";

    /** Before an Android print job: the page's afterprint handlers wait for PRINT_DONE_JS (see PRINT_SHIM_JS). */
    static final String PRINT_HOLD_JS = "(function(){try{window.__dentoraPrinting=true;}catch(e){}})()";

    /** When the print screen closes: the page's afterprint handlers run, once. */
    static final String PRINT_DONE_JS =
        "(function(){try{if(!window.__dentoraPrinting)return;window.__dentoraPrinting=false;"
        + "var e=new Event('afterprint');e.__dentora=true;window.dispatchEvent(e);}catch(x){}})()";

    /** After the file picker closed without a file: pickFile() (src/platform) stops waiting at once. A chosen file
     *  may reach the page well after the window regained focus, so the page never guesses from focus on Android. */
    static final String PICK_CANCELLED_JS = "window.dispatchEvent(new Event('dentora:pick-cancelled'))";

    /** A blob: download the shell intercepted: only the page can read a blob: URL, so it saves it itself, in chunks
     *  (window.__dentoraSaveBlob, installed by src/platform). */
    static String saveBlobJs(String blobUrl, String name) {
        return "(function(u,n){try{if(typeof window.__dentoraSaveBlob==='function')window.__dentoraSaveBlob(u,n);}catch(e){}})("
            + jsString(blobUrl) + "," + jsString(name) + ")";
    }

    /** Lets the page know how a save ended: window 'dentora:saved' event, detail { ok, cancelled, name }. */
    static String savedEventJs(boolean ok, boolean cancelled, String name) {
        return "window.dispatchEvent(new CustomEvent('dentora:saved',{detail:{ok:" + ok + ",cancelled:" + cancelled
            + ",name:" + jsString(name) + "}}))";
    }

    /** The same, for a save the page started (its id) and, when it failed, why: space, verify, io. */
    static String savedEventJs(boolean ok, boolean cancelled, String name, String id, String reason) {
        return "window.dispatchEvent(new CustomEvent('dentora:saved',{detail:{ok:" + ok + ",cancelled:" + cancelled
            + ",name:" + jsString(name) + ",id:" + jsString(id) + ",reason:" + jsString(reason == null ? "" : reason) + "}}))";
    }

    // ---- saving in pieces (plain Java, so android/test can check it on a desktop JVM) ---------------------

    private static final int[] B64 = new int[128];
    static {
        java.util.Arrays.fill(B64, -1);
        String a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        for (int i = 0; i < a.length(); i++) B64[a.charAt(i)] = i;
        B64['-'] = 62;
        B64['_'] = 63;
    }

    /** Standard (or URL-safe) base64 to bytes; whitespace is skipped, anything else is refused. */
    static byte[] decodeBase64(String s) {
        if (s == null) return new byte[0];
        int n = s.length();
        byte[] out = new byte[n / 4 * 3 + 3];
        int o = 0, acc = 0, bits = 0;
        for (int i = 0; i < n; i++) {
            char c = s.charAt(i);
            if (c == '=') break;
            if (c == ' ' || c == '\n' || c == '\r' || c == '\t') continue;
            int v = c < 128 ? B64[c] : -1;
            if (v < 0) throw new IllegalArgumentException("bad base64");
            acc = (acc << 6) | v;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out[o++] = (byte) ((acc >> bits) & 0xff);
            }
        }
        if (bits >= 6) throw new IllegalArgumentException("bad base64 length");
        if (o == out.length) return out;
        byte[] exact = new byte[o];
        System.arraycopy(out, 0, exact, 0, o);
        return exact;
    }

    /** "space" when the disk is full, otherwise "io": the reason the page shows for a failed write. */
    static String ioReason(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            String m = String.valueOf(t.getMessage());
            if (m.contains("ENOSPC") || m.contains("No space left") || m.contains("EDQUOT")) return "space";
        }
        return "io";
    }

    /**
     * A file written in pieces into the app's cache folder before it goes to the place the user picks: the page
     * sends it in base64 chunks, and its size and CRC-32 are kept as it grows so the result can be checked.
     */
    static final class ChunkFile {
        final File file;
        private final OutputStream out;
        private final CRC32 crc = new CRC32();
        private long size;
        private boolean closed;

        ChunkFile(File file) throws IOException {
            this.file = file;
            this.out = new FileOutputStream(file);
        }

        void append(String base64) throws IOException { write(decodeBase64(base64)); }

        void write(byte[] bytes) throws IOException {
            if (closed) throw new IOException("closed");
            out.write(bytes);
            crc.update(bytes, 0, bytes.length);
            size += bytes.length;
        }

        /** Flushes to the disk and closes; the bytes are then checked against what the page says it sent. */
        void close() throws IOException {
            if (closed) return;
            closed = true;
            out.flush();
            if (out instanceof FileOutputStream) ((FileOutputStream) out).getFD().sync();
            out.close();
        }

        void closeQuietly() {
            try { close(); } catch (IOException ignored) { }
        }

        long size() { return size; }
        long crc() { return crc.getValue(); }
    }

    /** Copies everything from in to out; returns the number of bytes. */
    static long copy(InputStream in, OutputStream out) throws IOException {
        byte[] buf = new byte[1024 * 1024];
        long total = 0;
        for (int n; (n = in.read(buf)) > 0; ) {
            out.write(buf, 0, n);
            total += n;
        }
        return total;
    }

    /** Size and CRC-32 of everything a stream holds: {size, crc}. Used to read a saved file back. */
    static long[] measure(InputStream in) throws IOException {
        CRC32 crc = new CRC32();
        byte[] buf = new byte[1024 * 1024];
        long size = 0;
        for (int n; (n = in.read(buf)) > 0; ) {
            crc.update(buf, 0, n);
            size += n;
        }
        return new long[] {size, crc.getValue()};
    }

    /** "123" → 123; anything else → fallback. */
    static long parseLong(String s, long fallback) {
        try { return Long.parseLong(s == null ? "" : s.trim()); } catch (NumberFormatException e) { return fallback; }
    }

    /** Messages the shell itself shows (toasts, the crash dialog), in the app's language: Arabic first. */
    static String text(String key, String lang) {
        boolean en = lang != null && lang.toLowerCase(Locale.ROOT).startsWith("en");
        switch (key) {
            case "saved_downloads": return en ? "Saved to Downloads: " : "حُفظ الملف في التنزيلات: ";
            case "save_failed": return en ? "Could not save the file" : "تعذّر حفظ الملف";
            case "save_busy": return en ? "Another file is being saved; try again in a moment" : "يُحفظ ملف آخر الآن، أعد المحاولة بعد قليل";
            case "save_space": return en ? "Not enough space to save the file" : "لا توجد مساحة كافية لحفظ الملف";
            case "save_verify": return en ? "The saved file did not match; it was removed. Try another place" : "لم يطابق الملف المحفوظ البيانات فحُذف. جرّب مكاناً آخر";
            case "no_app": return en ? "No app on this phone can open this" : "لا يوجد على الهاتف تطبيق يفتح هذا الرابط";
            case "no_picker": return en ? "No app on this phone can pick files" : "لا يوجد على الهاتف تطبيق لاختيار الملفات";
            case "no_print": return en ? "Printing is not available on this phone" : "الطباعة غير متاحة على هذا الهاتف";
            case "crash_title": return en ? "The app closed last time because of an error" : "أُغلق التطبيق في المرة السابقة بسبب خطأ";
            case "crash_body": return en ? "Send a screenshot of this message to support so it can be fixed:\n\n"
                : "أرسل صورة لهذه الرسالة إلى الدعم الفني ليُصلَح الخطأ:\n\n";
            case "copy": return en ? "Copy" : "نسخ";
            case "close": return en ? "Close" : "إغلاق";
            default: return key;
        }
    }
}
