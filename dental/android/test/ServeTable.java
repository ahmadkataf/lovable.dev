package com.dentora.app;

import java.io.File;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Prints, as JSON, how MainActivity.serve() answers URL paths of https://dentora.app, using the very same WebFiles
 * rules, for the files unpacked from an APK. android/test/webview-sim.mjs uses it to serve the packaged app to
 * Chromium exactly as the Android shell would.
 *   java -cp <classes> com.dentora.app.ServeTable <unpacked-apk>/assets [extra url paths…]
 */
public final class ServeTable {
    public static void main(String[] args) {
        File assets = new File(args[0]);
        List<String> paths = new ArrayList<>();
        if (args.length > 1) {
            for (int i = 1; i < args.length; i++) paths.add(args[i]);
        } else {
            paths.add("/");
            collect(new File(assets, "www"), "", paths);
        }
        Map<String, String> routes = new LinkedHashMap<>();
        for (String p : paths) {
            String asset = WebFiles.assetPath(p);
            boolean found = asset != null && new File(assets, asset).isFile();
            if (!found) {
                routes.put(p, "{\"status\":404}");
                continue;
            }
            String mime = WebFiles.mimeFor(asset);
            routes.put(p, "{\"status\":200,\"asset\":" + WebFiles.jsString(asset) + ",\"mime\":" + WebFiles.jsString(mime)
                + ",\"charset\":" + (WebFiles.isText(mime) ? "\"utf-8\"" : "null") + ",\"cache\":" + WebFiles.jsString(WebFiles.cacheControl(asset)) + "}");
        }
        StringBuilder b = new StringBuilder("{\"routes\":{");
        boolean first = true;
        for (Map.Entry<String, String> e : routes.entrySet()) {
            if (!first) b.append(',');
            first = false;
            b.append(WebFiles.jsString(e.getKey())).append(':').append(e.getValue());
        }
        b.append("},\"js\":{\"back\":").append(WebFiles.jsString(WebFiles.BACK_JS))
            .append(",\"printShim\":").append(WebFiles.jsString(WebFiles.PRINT_SHIM_JS))
            .append(",\"bridge\":").append(WebFiles.jsString(WebFiles.BRIDGE_JS))
            .append(",\"printHold\":").append(WebFiles.jsString(WebFiles.PRINT_HOLD_JS))
            .append(",\"printDone\":").append(WebFiles.jsString(WebFiles.PRINT_DONE_JS))
            .append(",\"pickCancelled\":").append(WebFiles.jsString(WebFiles.PICK_CANCELLED_JS))
            .append(",\"savedOk\":").append(WebFiles.jsString(WebFiles.savedEventJs(true, false, "__NAME__")))
            .append(",\"savedCancelled\":").append(WebFiles.jsString(WebFiles.savedEventJs(false, true, "__NAME__")))
            .append(",\"saveBlob\":").append(WebFiles.jsString(WebFiles.saveBlobJs("__URL__", "__NAME__")))
            .append(",\"startUrl\":").append(WebFiles.jsString(WebFiles.START_URL)).append("}}");
        System.out.println(b);
    }

    private static void collect(File dir, String prefix, List<String> out) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) collect(f, prefix + "/" + f.getName(), out);
            else out.add(prefix + "/" + f.getName());
        }
    }
}
