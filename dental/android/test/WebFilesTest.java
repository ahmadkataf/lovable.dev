package com.dentora.app;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;

/**
 * Checks WebFiles on a desktop JVM (no Android needed). scripts/build-apk.sh runs it before packaging:
 *   javac -d out android/src/com/dentora/app/WebFiles.java android/test/WebFilesTest.java && java -cp out com.dentora.app.WebFilesTest
 */
public final class WebFilesTest {
    private static int checks;

    private static void eq(Object expected, Object actual, String what) {
        checks++;
        boolean same = expected == null ? actual == null
            : expected instanceof Object[] && actual instanceof Object[] ? Arrays.equals((Object[]) expected, (Object[]) actual)
            : expected instanceof byte[] && actual instanceof byte[] ? Arrays.equals((byte[]) expected, (byte[]) actual)
            : expected.equals(actual);
        if (!same) {
            String e = expected instanceof Object[] ? Arrays.toString((Object[]) expected) : String.valueOf(expected);
            String a = actual instanceof Object[] ? Arrays.toString((Object[]) actual) : String.valueOf(actual);
            throw new AssertionError(what + ": expected <" + e + "> but was <" + a + ">");
        }
    }

    /** requestAction for an address split as android.net.Uri splits it for MainActivity: scheme, host, encoded path. */
    private static String action(String url) {
        URI u = URI.create(url);
        return WebFiles.requestAction(u.getScheme(), u.getHost(), u.getRawPath());
    }

    public static void main(String[] args) throws IOException {
        // which asset answers a URL path
        eq("www/index.html", WebFiles.assetPath(null), "null path");
        eq("www/index.html", WebFiles.assetPath(""), "empty path");
        eq("www/index.html", WebFiles.assetPath("/"), "root");
        eq("www/index.html", WebFiles.assetPath("/index.html"), "index");
        eq("www/assets/index-AbC123.js", WebFiles.assetPath("/assets/index-AbC123.js"), "bundle");
        eq("www/assets/inter-latin-400-normal.woff2", WebFiles.assetPath("//assets/inter-latin-400-normal.woff2"), "double slash");
        eq("www/index.html", WebFiles.assetPath("/patients"), "route without extension");
        eq("www/index.html", WebFiles.assetPath("/assets/"), "folder");
        eq(null, WebFiles.assetPath("/../shared_prefs/x.xml"), "traversal");
        eq(null, WebFiles.assetPath("/assets/../../x.js"), "nested traversal");
        eq(null, WebFiles.assetPath("/assets/./x.js"), "dot segment");
        eq(null, WebFiles.assetPath("/assets\\x.js"), "backslash");

        // MIME types
        eq("text/html", WebFiles.mimeFor("www/index.html"), "html");
        eq("application/javascript", WebFiles.mimeFor("www/assets/a.js"), "js");
        eq("text/css", WebFiles.mimeFor("www/assets/a.css"), "css");
        eq("application/json", WebFiles.mimeFor("www/data.json"), "json");
        eq("image/svg+xml", WebFiles.mimeFor("www/icon.svg"), "svg");
        eq("image/png", WebFiles.mimeFor("www/apple-touch-icon.PNG"), "png upper case");
        eq("font/woff2", WebFiles.mimeFor("www/assets/f.woff2"), "woff2");
        eq("font/woff", WebFiles.mimeFor("www/assets/f.woff"), "woff");
        eq("application/manifest+json", WebFiles.mimeFor("www/manifest.webmanifest"), "manifest");
        eq("image/x-icon", WebFiles.mimeFor("www/favicon.ico"), "ico");
        eq("application/octet-stream", WebFiles.mimeFor("www/LICENSE"), "no extension");
        eq("application/octet-stream", WebFiles.mimeFor("www/x.unknownext"), "unknown");
        eq(true, WebFiles.isText("application/javascript"), "js is text");
        eq(true, WebFiles.isText("image/svg+xml"), "svg is text");
        eq(false, WebFiles.isText("font/woff2"), "font is binary");
        eq(false, WebFiles.isText("image/png"), "png is binary");
        eq("public, max-age=31536000, immutable", WebFiles.cacheControl("www/assets/index-AbC.js"), "hashed cache");
        eq("no-cache", WebFiles.cacheControl("www/index.html"), "index not cached");

        // saved file names and types
        eq("text/csv", WebFiles.baseMime("text/csv;charset=utf-8"), "mime params");
        eq("application/json", WebFiles.baseMime(" Application/JSON "), "mime case");
        eq("application/octet-stream", WebFiles.baseMime(""), "empty mime");
        eq("application/octet-stream", WebFiles.baseMime("garbage"), "bad mime");
        eq("application/octet-stream", WebFiles.baseMime(null), "null mime");
        eq("dentora-backup-2026-10-10.json", WebFiles.safeFileName("dentora-backup-2026-10-10.json", "application/json"), "plain name");
        eq("فاتورة INV-000012.pdf", WebFiles.safeFileName("فاتورة INV-000012.pdf", "application/pdf"), "arabic name kept");
        eq("a_b_c_.csv", WebFiles.safeFileName("a/b\\c:.csv", "text/csv"), "separators");
        eq("Dentora.json", WebFiles.safeFileName("", "application/json"), "empty name");
        eq("Dentora.csv", WebFiles.safeFileName(null, "text/csv;charset=utf-8"), "null name");
        eq("hidden.json", WebFiles.safeFileName("..hidden.json", "application/json"), "leading dots");
        String longName = WebFiles.safeFileName(new String(new char[200]).replace('\0', 'x') + ".json", "application/json");
        eq(120, longName.length(), "long name length");
        eq(true, longName.endsWith(".json"), "long name keeps extension");

        // the file picker filter
        eq(new String[] {"*/*"}, WebFiles.pickerMimes(null), "no accept");
        eq(new String[] {"*/*"}, WebFiles.pickerMimes(new String[] {""}), "empty accept");
        eq(new String[] {"*/*"}, WebFiles.pickerMimes(new String[] {".json,application/json"}), "backup opens any file");
        eq(new String[] {"*/*"}, WebFiles.pickerMimes(new String[] {"*/*"}), "any");
        eq(new String[] {"image/*"}, WebFiles.pickerMimes(new String[] {"image/*"}), "images");
        eq(new String[] {"image/png", "image/jpeg"}, WebFiles.pickerMimes(new String[] {".png", ".jpg", ".jpeg"}), "image extensions");
        eq(new String[] {"image/*", "application/pdf"}, WebFiles.pickerMimes(new String[] {"image/*,.pdf"}), "images and pdf");
        eq(new String[] {"*/*"}, WebFiles.pickerMimes(new String[] {"image/*,.stl"}), "a scan file opens any file");
        eq("image/*", WebFiles.pickerType(new String[] {"image/*"}), "type single");
        eq("image/*", WebFiles.pickerType(new String[] {"image/png", "image/jpeg"}), "type family");
        eq("*/*", WebFiles.pickerType(new String[] {"image/*", "application/pdf"}), "type mixed");

        // data: URLs
        WebFiles.DataUrl d = WebFiles.parseDataUrl("data:application/json;base64,eyJhIjoxfQ==");
        eq("application/json", d.mime, "data mime");
        eq(true, d.base64, "data base64");
        eq("eyJhIjoxfQ==", d.payload, "data payload");
        d = WebFiles.parseDataUrl("data:text/csv;charset=utf-8,a%2Cb%0A1+2");
        eq("text/csv", d.mime, "csv mime");
        eq(false, d.base64, "csv not base64");
        eq("a,b\n1+2", new String(WebFiles.percentDecode(d.payload), StandardCharsets.UTF_8), "percent decode keeps +");
        eq("مرحبا", new String(WebFiles.percentDecode("%D9%85%D8%B1%D8%AD%D8%A8%D8%A7"), StandardCharsets.UTF_8), "percent decode utf-8");
        eq("text/plain", WebFiles.parseDataUrl("DATA:,hello").mime, "default data mime");
        eq(null, WebFiles.parseDataUrl("https://dentora.app/"), "not data");
        eq(null, WebFiles.parseDataUrl("data:text/plain"), "no comma");

        // links
        eq(true, WebFiles.isAppUrl("https", "dentora.app"), "own host");
        eq(true, WebFiles.isAppUrl("HTTPS", "Dentora.App"), "own host any case");
        eq(false, WebFiles.isAppUrl("https", "wa.me"), "whatsapp is outside");
        eq(false, WebFiles.isAppUrl("https", "evil-dentora.app"), "look-alike host");
        eq(false, WebFiles.isAppUrl("tel", null), "tel");
        // shouldOverrideUrlLoading: the app stays inside; tel:, mailto:, WhatsApp and other sites go to the phone
        eq("app", WebFiles.linkAction("https", "dentora.app", true), "own page stays inside");
        eq("app", WebFiles.linkAction("https", "dentora.app", false), "own frame stays inside");
        eq("outside", WebFiles.linkAction("tel", null, true), "tel goes to the dialer");
        eq("outside", WebFiles.linkAction("mailto", null, true), "mailto goes to e-mail");
        eq("outside", WebFiles.linkAction("https", "wa.me", true), "wa.me goes to WhatsApp");
        eq("outside", WebFiles.linkAction("whatsapp", null, true), "whatsapp: goes to WhatsApp");
        eq("outside", WebFiles.linkAction("https", "example.com", true), "other site goes to the browser");
        eq("outside", WebFiles.linkAction("http", "dentora.app.evil.com", true), "look-alike goes outside");
        eq("outside", WebFiles.linkAction("intent", null, true), "intent: goes outside (checked there)");
        eq("outside", WebFiles.linkAction(null, null, true), "no scheme is not loaded inside");
        eq("block", WebFiles.linkAction("https", "maps.example.com", false), "a frame of another site is not loaded");
        eq("block", WebFiles.linkAction("http", "evil.com", false), "an http frame of another site is not loaded");
        eq("block", WebFiles.linkAction("intent", null, false), "a frame never starts another app");
        eq("allow", WebFiles.linkAction("about", null, true), "about:blank");
        eq("allow", WebFiles.linkAction("JavaScript", null, true), "javascript:");
        eq("data", WebFiles.linkAction("data", null, true), "data: is saved");
        eq("blob", WebFiles.linkAction("blob", null, true), "blob: is saved");

        // shouldInterceptRequest: the app's files, nothing from the internet but the licence-key activation
        eq("app", WebFiles.requestAction("https", "dentora.app", "/index.html"), "own files served");
        eq("block", WebFiles.requestAction("https", "evil.com", "/"), "another site refused");
        eq("block", WebFiles.requestAction("http", "dentora.app.evil.com", "/"), "look-alike refused");
        eq("block", WebFiles.requestAction("wss", "evil.com", "/"), "websocket refused");
        eq("pass", WebFiles.requestAction("data", null, null), "data: stays in the WebView");
        eq("pass", WebFiles.requestAction("blob", null, null), "blob: stays in the WebView");
        eq(true, WebFiles.CSP.contains("script-src 'self';") && WebFiles.CSP.contains("default-src 'self'") && WebFiles.CSP.contains("object-src 'none'") && WebFiles.CSP.contains("form-action 'none'"), "csp");

        // the activation (docs/LICENCE-KEYS.md): exactly https://dentora.raqeem.dev/api/activate reaches the network
        eq("pass", WebFiles.requestAction("https", "dentora.raqeem.dev", "/api/activate"), "activation goes to the network");
        eq("pass", WebFiles.requestAction("HTTPS", "Dentora.Raqeem.Dev", "/api/activate"), "scheme and host in any case");
        eq("block", WebFiles.requestAction("http", "dentora.raqeem.dev", "/api/activate"), "activation over http refused");
        eq("block", WebFiles.requestAction("wss", "dentora.raqeem.dev", "/api/activate"), "websocket to the server refused");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev", "/activate"), "the activation page is not loaded inside");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev", "/"), "the website is not loaded inside");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev", "/api/licences"), "the seller's panel API refused");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev", "/api/activate/"), "another path (trailing slash) refused");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev", "/api/activate/x"), "a longer path refused");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev", "/API/activate"), "paths are exact (case)");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev", "/api/%61ctivate"), "a percent-escaped spelling refused");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev", "/api/activate;x"), "path parameters refused");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev", ""), "empty path refused");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev", null), "no path refused");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev.evil.com", "/api/activate"), "look-alike host (suffix) refused");
        eq("block", WebFiles.requestAction("https", "evil-dentora.raqeem.dev", "/api/activate"), "another subdomain refused");
        eq("block", WebFiles.requestAction("https", "raqeem.dev", "/api/activate"), "the parent domain refused");
        eq("block", WebFiles.requestAction("https", "dentora.raqeem.dev.", "/api/activate"), "the host with a trailing dot refused");
        eq("block", WebFiles.requestAction("https", "evil.com", "/dentora.raqeem.dev/api/activate"), "the host inside another site's path refused");
        eq("block", WebFiles.requestAction("https", "evil.com", "/api/activate"), "the same path on another site refused");
        eq("block", WebFiles.requestAction("https", null, "/api/activate"), "no host refused");
        // what android.net.Uri gives MainActivity for real addresses (host, getEncodedPath(); the query is not part of it)
        eq("pass", action("https://dentora.raqeem.dev/api/activate"), "the app's request");
        eq("pass", action("https://dentora.raqeem.dev/api/activate?lang=ar"), "a query is not looked at (the server reads only the body)");
        eq("block", action("https://dentora.raqeem.dev.evil.com/api/activate"), "uri: look-alike host");
        eq("block", action("https://evil.com/dentora.raqeem.dev/api/activate"), "uri: host in the path");
        eq("block", action("https://dentora.raqeem.dev@evil.com/api/activate"), "uri: the host as a user name");
        eq("block", action("https://evil.com/api/activate?https://dentora.raqeem.dev/api/activate"), "uri: the address in a query");
        eq("block", action("http://dentora.raqeem.dev/api/activate"), "uri: http");
        eq("block", action("https://dentora.raqeem.dev/api/activate/../licences"), "uri: dot segments are not the activation");
        eq(true, WebFiles.CSP.contains("connect-src 'self' data: blob: https://dentora.raqeem.dev;"), "csp: the page may send requests to the activation server");

        eq("android.intent.action.DIAL", WebFiles.externalAction("tel"), "tel action");
        eq("android.intent.action.SENDTO", WebFiles.externalAction("mailto"), "mailto action");
        eq("android.intent.action.SENDTO", WebFiles.externalAction("smsto"), "sms action");
        eq("android.intent.action.VIEW", WebFiles.externalAction("https"), "web action");
        eq("android.intent.action.VIEW", WebFiles.externalAction("whatsapp"), "whatsapp action");

        // JavaScript built from Java strings
        eq("\"a\\\"b\\\\c\\n\\u003c/script>\"", WebFiles.jsString("a\"b\\c\n</script>"), "js string escaping");
        eq("\"\\u2028\"", WebFiles.jsString("\u2028"), "line separator");
        eq("null", WebFiles.jsString(null), "js null");
        eq(true, WebFiles.saveBlobJs("blob:https://dentora.app/x", "b\"k.json").contains("\"b\\\"k.json\""), "blob js quotes the name");
        eq("window.dispatchEvent(new CustomEvent('dentora:saved',{detail:{ok:true,cancelled:false,name:\"x.json\"}}))",
            WebFiles.savedEventJs(true, false, "x.json"), "saved event");

        // scripts run in every page
        eq(true, WebFiles.BRIDGE_JS.contains("dentora:saved") && WebFiles.BRIDGE_JS.contains("new Promise"), "saveFile answers with a Promise");
        eq(true, WebFiles.PRINT_SHIM_JS.contains("__dentoraPrinting") && WebFiles.PRINT_HOLD_JS.contains("__dentoraPrinting=true"), "afterprint held while printing");
        eq(true, WebFiles.PRINT_DONE_JS.contains("afterprint"), "afterprint released at the end");

        // the back key: the page's own handler first, popups it does not register second (once), then the page
        eq(true, WebFiles.BACK_JS.indexOf("__dentoraBack()") < WebFiles.BACK_JS.indexOf("querySelector"), "page handler asked first");
        eq(true, WebFiles.BACK_JS.contains("[role=\"menu\"]") && WebFiles.BACK_JS.contains("[role=\"dialog\"]"), "menus and small dialogs close on back");
        eq(true, WebFiles.BACK_JS.contains("__dentoraBackLast") && WebFiles.BACK_JS.contains("1500"), "a popup that ignores Escape does not trap the back key");
        eq(true, WebFiles.BRIDGE_JS.contains("real.print(String(n))"), "print passes the job name");

        // print job names ("Save as PDF" offers them as the file name)
        eq("فاتورة INV-000034 - محمد العلي", WebFiles.printJobName("فاتورة INV-000034 - محمد العلي", "Dentora — x"), "page's name");
        eq("a b c", WebFiles.printJobName("  a/b\nc  ", null), "no separators or line breaks");
        eq("Dentora", WebFiles.printJobName(null, "Dentora — نظام إدارة عيادات الأسنان"), "app title gives the app name");
        eq("Dentora", WebFiles.printJobName("", ""), "nothing gives the app name");
        eq("وصفة طبية", WebFiles.printJobName(" ", "وصفة طبية"), "page title");
        eq(120, WebFiles.printJobName(new String(new char[300]).replace('\0', 'x'), null).length(), "long job name");

        // the camera next to the files
        eq(true, WebFiles.offersCamera(WebFiles.pickerMimes(new String[] {"image/*"})), "photos: camera offered");
        eq(true, WebFiles.offersCamera(WebFiles.pickerMimes(new String[] {"image/*,.pdf,application/pdf"})), "files tab: camera offered");
        eq(true, WebFiles.offersCamera(WebFiles.pickerMimes(new String[] {".jpg"})), "jpeg: camera offered");
        eq(false, WebFiles.offersCamera(WebFiles.pickerMimes(new String[] {".json,application/json"})), "backup: no camera");
        eq(false, WebFiles.offersCamera(WebFiles.pickerMimes(new String[] {".png"})), "png only: no camera");
        eq(false, WebFiles.offersCamera(null), "nothing: no camera");
        eq("photo-20261011-153012.jpg", WebFiles.captureName("20261011-153012", 1), "photo name");
        eq("photo-20261011-153012-2.jpg", WebFiles.captureName("20261011-153012", 2), "second photo in a second");
        eq(true, WebFiles.isCaptureName("photo-20261011-153012-2.jpg"), "photo name served");
        eq(false, WebFiles.isCaptureName("../pending-save.bin"), "no other cache file");
        eq(false, WebFiles.isCaptureName("photo-20261011-153012.jpg/../x"), "no path");
        eq(false, WebFiles.isCaptureName(null), "no name");

        // a save over a longer older file: "w" without truncation must not leave the old tail
        File f = File.createTempFile("dentora-trunc", ".json");
        try {
            Files.write(f.toPath(), new byte[5000]);
            byte[] fresh = "{\"app\":\"dentora\"}".getBytes(StandardCharsets.UTF_8);
            try (RandomAccessFile raf = new RandomAccessFile(f, "rw"); FileOutputStream out = new FileOutputStream(raf.getFD())) {
                eq((long) fresh.length, WebFiles.copyAndTruncate(new ByteArrayInputStream(fresh), out), "bytes written");
            }
            eq((long) fresh.length, f.length(), "old tail cut off");
            eq(new String(fresh, StandardCharsets.UTF_8), new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8), "file is exactly the new one");
            try (FileOutputStream out = new FileOutputStream(f)) {
                WebFiles.copyAndTruncate(new ByteArrayInputStream(new byte[10]), out);
            }
            eq(10L, f.length(), "a truncating open stays as written");
        } finally {
            f.delete();
        }

        // text size: the phone's font scale, from 85 % up to 130 %
        eq(100, WebFiles.textZoomFor(1f), "normal font size");
        eq(115, WebFiles.textZoomFor(1.15f), "large font size");
        eq(130, WebFiles.textZoomFor(1.3f), "larger font size");
        eq(130, WebFiles.textZoomFor(2f), "the largest font size is capped at 130 %");
        eq(85, WebFiles.textZoomFor(0.85f), "small font size");
        eq(85, WebFiles.textZoomFor(0.5f), "never below 85 %");
        eq(100, WebFiles.textZoomFor(0f), "an unknown scale is 100 %");
        eq(100, WebFiles.textZoomFor(Float.NaN), "an unreadable scale is 100 %");

        // messages
        eq("تعذّر حفظ الملف", WebFiles.text("save_failed", "ar"), "arabic message");
        eq("Could not save the file", WebFiles.text("save_failed", "en"), "english message");
        eq("تعذّر حفظ الملف", WebFiles.text("save_failed", null), "arabic by default");
        eq("تعذّر حفظ الملف", WebFiles.text("save_failed", "fr"), "arabic for other languages");
        String[] keys = {"saved_downloads", "save_failed", "no_app", "no_picker", "no_print", "crash_title", "crash_body", "copy", "close", "pick_title"};
        for (String k : keys) {
            eq(false, WebFiles.text(k, "ar").equals(k) || WebFiles.text(k, "en").equals(k), "message " + k + " in both languages");
            eq(false, WebFiles.text(k, "ar").equals(WebFiles.text(k, "en")), "message " + k + " translated");
        }

        System.out.println("WebFilesTest: " + checks + " checks passed");
    }
}
