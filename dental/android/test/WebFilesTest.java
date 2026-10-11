package com.dentora.app;

import java.nio.charset.StandardCharsets;
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

    public static void main(String[] args) {
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
        eq("allow", WebFiles.linkAction("https", "maps.example.com", false), "a frame inside the page loads");
        eq("allow", WebFiles.linkAction("about", null, true), "about:blank");
        eq("allow", WebFiles.linkAction("JavaScript", null, true), "javascript:");
        eq("data", WebFiles.linkAction("data", null, true), "data: is saved");
        eq("blob", WebFiles.linkAction("blob", null, true), "blob: is saved");

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

        // messages
        eq("تعذّر حفظ الملف", WebFiles.text("save_failed", "ar"), "arabic message");
        eq("Could not save the file", WebFiles.text("save_failed", "en"), "english message");
        eq("تعذّر حفظ الملف", WebFiles.text("save_failed", null), "arabic by default");
        eq("تعذّر حفظ الملف", WebFiles.text("save_failed", "fr"), "arabic for other languages");
        String[] keys = {"saved_downloads", "save_failed", "no_app", "no_picker", "no_print", "crash_title", "crash_body", "copy", "close"};
        for (String k : keys) {
            eq(false, WebFiles.text(k, "ar").equals(k) || WebFiles.text(k, "en").equals(k), "message " + k + " in both languages");
            eq(false, WebFiles.text(k, "ar").equals(WebFiles.text(k, "en")), "message " + k + " translated");
        }

        System.out.println("WebFilesTest: " + checks + " checks passed");
    }
}
