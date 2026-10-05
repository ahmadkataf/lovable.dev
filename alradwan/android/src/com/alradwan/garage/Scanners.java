package com.alradwan.garage;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.input.InputManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.InputDevice;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** The built-in barcode scanners of Android POS terminals and rugged phones (Sunmi, Zebra, Honeywell, Urovo,
 *  Newland…): every vendor broadcasts what it read, the page gets it as a 'garage-scan' event. Also lists the
 *  keyboard-type scanners plugged in (USB/Bluetooth) and looks a barcode up on UPCitemdb for the page. */
final class Scanners {
    /** The app's own action: the Zebra profile and the Honeywell claim use it, and any "custom intent" wedge can. */
    static final String OWN_ACTION = "com.alradwan.garage.SCAN";

    static final String[][] ACTIONS = {
        { OWN_ACTION, null },
        { "com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED", "Sunmi" },
        { "android.intent.ACTION_DECODE_DATA", "Urovo" },                     // also Unitech (Android 9 and older), many Chinese PDAs
        { "nlscan.action.SCANNER_RESULT", "Newland" },
        { "android.intent.action.SCANRESULT", "iData" },
        { "com.android.server.scannerservice.broadcast", "Seuic" },           // also M3 Mobile
        { "com.datalogic.decodewedge.decode_action", "Datalogic" },
        { "unitech.scanservice.data", "Unitech" },
        { "com.cipherlab.barcodebaseapi.PASS_DATA_2_APP", "CipherLab" },
        { "device.scanner.EVENT", "Point Mobile" },
        { "kr.co.bluebird.android.bbapi.action.BARCODE_CALLBACK_DECODING_DATA", "Bluebird" },
        { "scan.rcv.message", null },                                         // unbranded Chinese PDAs
        { "com.scanner.broadcast", "Chainway" },
        { "com.android.serial.BARCODEPORT_RECEIVEDDATA_ACTION", null },       // WEROCK / RT150 family
        { "com.proglove.api.BARCODE", "ProGlove" },
    };
    static final String[] TEXT_KEYS = {
        "data", "com.symbol.datawedge.data_string", "barcode_string", "SCAN_BARCODE1", "value",
        "scannerdata", "m3scannerdata", "com.datalogic.decode.intentwedge.barcode_string", "text",
        "Decoder_Data", "DATA", "com.proglove.api.extra.BARCODE_DATA", "barcodeData", "barcode",
    };
    static final String[] BYTE_KEYS = {
        "dataBytes", "source_byte", "barcode", "barocode", "scan_result_one_bytes",
        "com.datalogic.decode.intentwedge.barcode_data", "Decoder_DataArray", "EXTRA_EVENT_DECODE_VALUE",
        "EXTRA_BARCODE_DECODING_DATA",
    };
    static final String[] TYPE_KEYS = {
        "com.symbol.datawedge.label_type", "codeId", "aimId", "SCAN_BARCODE_TYPE", "barcodeType",
        "com.datalogic.decode.intentwedge.barcode_type", "Decoder_CodeType", "EXTRA_EVENT_SYMBOL_NAME",
        "EXTRA_INT_DATA2", "com.proglove.api.extra.BARCODE_SYMBOLOGY",
    };
    /** String extras that are never the barcode (the last-resort search skips them). */
    static final Set<String> NOT_TEXT = new HashSet<>(Arrays.asList(
        "SCAN_STATE", "charset", "aimid", "timestamp", "com.symbol.datawedge.source", "com.symbol.datawedge.decoded_mode",
        "com.symbol.datawedge.label_type", "codeId", "aimId", "com.datalogic.decode.intentwedge.barcode_type",
        "EXTRA_EVENT_SYMBOL_NAME", "com.proglove.api.extra.BARCODE_SYMBOLOGY"));
    static final String[][] MAKERS = {
        { "sunmi", "Sunmi" }, { "zebra", "Zebra" }, { "symbol", "Zebra" }, { "honeywell", "Honeywell" }, { "intermec", "Honeywell" },
        { "urovo", "Urovo" }, { "newland", "Newland" }, { "nlscan", "Newland" }, { "idata", "iData" }, { "seuic", "Seuic" },
        { "autoid", "Seuic" }, { "datalogic", "Datalogic" }, { "unitech", "Unitech" }, { "cipherlab", "CipherLab" },
        { "point mobile", "Point Mobile" }, { "pointmobile", "Point Mobile" }, { "bluebird", "Bluebird" }, { "chainway", "Chainway" },
    };
    private static boolean dataWedgeDone;

    private final MainActivity host;
    private BroadcastReceiver receiver;
    private InputManager inputs;
    private InputManager.InputDeviceListener inputListener;

    Scanners(MainActivity host) { this.host = host; }

    // ---------- vendor broadcasts: listen while the app is in front ----------
    void onResume() {
        IntentFilter f = new IntentFilter();
        for (String[] a : ACTIONS) f.addAction(a[0]);
        f.addCategory(Intent.CATEGORY_DEFAULT);                          // the DataWedge profile sends DEFAULT
        f.addCategory("com.datalogic.decodewedge.decode_category");      // the Datalogic wedge sends its own category
        if (receiver == null) receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) { handle(i); }
        };
        try {
            if (Build.VERSION.SDK_INT >= 33) host.registerReceiver(receiver, f, Context.RECEIVER_EXPORTED);
            else host.registerReceiver(receiver, f);
        } catch (RuntimeException ignored) { }
        try { claimHoneywell(); } catch (RuntimeException ignored) { }
        if (!dataWedgeDone) { dataWedgeDone = true; try { configureDataWedge(); } catch (RuntimeException ignored) { } }
    }

    void onPause() {
        if (receiver != null) { try { host.unregisterReceiver(receiver); } catch (IllegalArgumentException ignored) { } }
        try { host.sendBroadcast(new Intent("com.honeywell.aidc.action.ACTION_RELEASE_SCANNER").setPackage("com.intermec.datacollectionservice")); }
        catch (RuntimeException ignored) { }
    }

    void handle(Intent i) {
        try {
            Bundle x = i.getExtras();
            if (x == null) return;
            if ("fail".equals(x.getString("SCAN_STATE"))) return;          // Newland also reports failed reads
            String text = null;
            for (String k : TEXT_KEYS) { Object v = x.get(k); if (v instanceof String && !((String) v).isEmpty()) { text = (String) v; break; } }
            if (text == null) for (String k : BYTE_KEYS) { Object v = x.get(k); if (v instanceof byte[]) { text = decode(x, (byte[]) v); if (text != null) break; } }
            // a wedge set up with its own extra name: any text it carries
            if (text == null) for (String k : x.keySet()) {
                if (NOT_TEXT.contains(k)) continue;
                Object v = x.get(k);
                if (v instanceof String && !((String) v).trim().isEmpty()) { text = (String) v; break; }
            }
            if (text == null) return;
            String type = null;
            for (String k : TYPE_KEYS) { Object v = x.get(k); if (v != null) { type = String.valueOf(v); break; } }
            deliver(text, i.getAction(), type, vendor(i.getAction(), x));
        } catch (RuntimeException ignored) { /* a vendor extra we cannot unparcel */ }
    }

    static String decode(Bundle x, byte[] b) {
        int len = x.getInt("length", b.length);
        if (len <= 0 || len > b.length) len = b.length;
        Charset cs = StandardCharsets.UTF_8;
        String name = x.getString("charset");
        if (name != null) { try { cs = Charset.forName(name); } catch (RuntimeException ignored) { } }
        String s = new String(b, 0, len, cs);
        return s.isEmpty() ? null : s;
    }

    /** The brand that sent it, from the action (the app's own action tells by its extras). */
    static String vendor(String action, Bundle x) {
        if (OWN_ACTION.equals(action)) {
            if (x.containsKey("com.symbol.datawedge.data_string")) return "Zebra";
            if (x.containsKey("codeId") || x.containsKey("aimId") || x.containsKey("dataBytes")) return "Honeywell";
            return null;
        }
        if ("com.android.server.scannerservice.broadcast".equals(action) && x.containsKey("m3scannerdata")) return "M3";
        for (String[] a : ACTIONS) if (a[0].equals(action)) return a[1];
        return null;
    }

    /** One scan into the page as a DOM event; JSON escaping keeps any barcode text inert. */
    void deliver(String text, String action, String type, String vendor) {
        if (text.length() > 4096) text = text.substring(0, 4096);
        try {
            JSONObject d = new JSONObject();
            d.put("text", text);
            d.put("source", "intent");
            d.put("action", action == null ? JSONObject.NULL : action);
            d.put("symbology", type == null ? JSONObject.NULL : type);
            d.put("vendor", vendor == null ? JSONObject.NULL : vendor);
            dispatch("garage-scan", d.toString());
        } catch (JSONException ignored) { }
    }

    /** Fires window event `name` with `json` as its detail, on the page that is showing now. */
    void dispatch(String name, String json) {
        WebView web = host.webView();
        if (web == null) return;
        json = json.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029");
        web.evaluateJavascript("window.dispatchEvent(new CustomEvent('" + name + "',{detail:" + json + "}))", null);
    }

    // ---------- Honeywell: claim the imager and ask for a data intent (no SDK needed) ----------
    void claimHoneywell() {
        Bundle p = new Bundle();
        p.putBoolean("DPR_DATA_INTENT", true);
        p.putString("DPR_DATA_INTENT_ACTION", OWN_ACTION);
        host.sendBroadcast(new Intent("com.honeywell.aidc.action.ACTION_CLAIM_SCANNER")
            .setPackage("com.intermec.datacollectionservice")
            .putExtra("com.honeywell.aidc.extra.EXTRA_SCANNER", "dcs.scanner.imager")
            .putExtra("com.honeywell.aidc.extra.EXTRA_PROFILE", "DEFAULT")
            .putExtra("com.honeywell.aidc.extra.EXTRA_PROPERTIES", p));
    }

    // ---------- Zebra: a DataWedge profile for this app with intent output instead of keystrokes ----------
    void configureDataWedge() {
        Bundle main = new Bundle();
        main.putString("PROFILE_NAME", "AlRadwanGarage");
        main.putString("PROFILE_ENABLED", "true");
        main.putString("CONFIG_MODE", "CREATE_IF_NOT_EXIST");
        Bundle app = new Bundle();
        app.putString("PACKAGE_NAME", host.getPackageName());
        app.putStringArray("ACTIVITY_LIST", new String[]{"*"});
        main.putParcelableArray("APP_LIST", new Bundle[]{app});
        ArrayList<Bundle> plugins = new ArrayList<>();
        plugins.add(plugin("BARCODE", "scanner_input_enabled", "true", "scanner_selection", "auto"));
        Bundle intentParams = new Bundle();
        intentParams.putString("intent_output_enabled", "true");
        intentParams.putString("intent_action", OWN_ACTION);
        intentParams.putString("intent_category", Intent.CATEGORY_DEFAULT);
        intentParams.putInt("intent_delivery", 2);                      // 2 = broadcast
        Bundle intentPlugin = new Bundle();
        intentPlugin.putString("PLUGIN_NAME", "INTENT");
        intentPlugin.putString("RESET_CONFIG", "true");
        intentPlugin.putBundle("PARAM_LIST", intentParams);
        plugins.add(intentPlugin);
        plugins.add(plugin("KEYSTROKE", "keystroke_output_enabled", "false", null, null));
        main.putParcelableArrayList("PLUGIN_CONFIG", plugins);
        host.sendBroadcast(new Intent("com.symbol.datawedge.api.ACTION").putExtra("com.symbol.datawedge.api.SET_CONFIG", main));
    }

    private static Bundle plugin(String name, String k1, String v1, String k2, String v2) {
        Bundle params = new Bundle();
        params.putString(k1, v1);
        if (k2 != null) params.putString(k2, v2);
        Bundle b = new Bundle();
        b.putString("PLUGIN_NAME", name);
        b.putString("RESET_CONFIG", "true");
        b.putBundle("PARAM_LIST", params);
        return b;
    }

    // ---------- keyboard-type scanners (USB/Bluetooth): list them, tell the page when one comes or goes ----------
    String inputDevicesJson() {
        JSONArray out = new JSONArray();
        for (int id : InputDevice.getDeviceIds()) {
            InputDevice d = InputDevice.getDevice(id);
            if (d == null || d.isVirtual()) continue;
            if ((d.getSources() & InputDevice.SOURCE_KEYBOARD) != InputDevice.SOURCE_KEYBOARD) continue;
            try {
                JSONObject o = new JSONObject();
                o.put("id", d.getId());
                o.put("descriptor", d.getDescriptor());
                o.put("name", d.getName());
                o.put("vendorId", d.getVendorId());
                o.put("productId", d.getProductId());
                o.put("alphabetic", d.getKeyboardType() == InputDevice.KEYBOARD_TYPE_ALPHABETIC);
                o.put("external", Build.VERSION.SDK_INT >= 29 ? d.isExternal() : JSONObject.NULL);
                out.put(o);
            } catch (JSONException ignored) { }
        }
        return out.toString();
    }

    void watchInputDevices() {
        inputs = (InputManager) host.getSystemService(Context.INPUT_SERVICE);
        if (inputs == null) return;
        inputListener = new InputManager.InputDeviceListener() {
            @Override public void onInputDeviceAdded(int id) { dispatch("garage-input-devices", inputDevicesJson()); }
            @Override public void onInputDeviceRemoved(int id) { dispatch("garage-input-devices", inputDevicesJson()); }
            @Override public void onInputDeviceChanged(int id) { dispatch("garage-input-devices", inputDevicesJson()); }
        };
        inputs.registerInputDeviceListener(inputListener, new Handler(Looper.getMainLooper()));
    }

    void onDestroy() {
        if (inputs != null && inputListener != null) inputs.unregisterInputDeviceListener(inputListener);
        inputListener = null;
    }

    /** JSON {maker, model, scanner}: scanner is the brand when the phone comes from a scanner maker. */
    static String scannerInfo() {
        String maker = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER;
        String hay = (maker + " " + (Build.BRAND == null ? "" : Build.BRAND)).toLowerCase(Locale.ROOT);
        String scanner = null;
        for (String[] m : MAKERS) if (hay.contains(m[0])) { scanner = m[1]; break; }
        if (scanner == null && hay.startsWith("m3")) scanner = "M3";                // M3 Mobile, "M3SKY"
        try {
            JSONObject o = new JSONObject();
            o.put("maker", maker);
            o.put("model", Build.MODEL == null ? "" : Build.MODEL);
            o.put("scanner", scanner == null ? JSONObject.NULL : scanner);
            return o.toString();
        } catch (JSONException e) { return "{}"; }
    }

    // ---------- UPCitemdb: a product name for a barcode the shop does not know yet ----------
    /** Only a barcode and a request id come from the page, never a URL; the answer comes back as 'garage-upc'. */
    void upcLookup(final String code, final String id) {
        if (code == null || id == null || !code.matches("^[0-9]{8,14}$") || !id.matches("^[a-z0-9]{1,32}$")) return;
        new Thread(new Runnable() { public void run() {
            int status = 0;
            String body = "";
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL("https://api.upcitemdb.com/prod/trial/lookup?upc=" + code).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setRequestProperty("Accept", "application/json");
                int s = c.getResponseCode();
                InputStream in = s >= 400 ? c.getErrorStream() : c.getInputStream();
                String text = "";
                if (in != null) {
                    ByteArrayOutputStream buf = new ByteArrayOutputStream();
                    byte[] chunk = new byte[8192];
                    for (int n; (n = in.read(chunk)) > 0 && buf.size() < 256 * 1024; ) buf.write(chunk, 0, Math.min(n, 256 * 1024 - buf.size()));
                    in.close();
                    text = new String(buf.toByteArray(), StandardCharsets.UTF_8);
                }
                status = s;
                body = text;
            } catch (IOException | RuntimeException ignored) {
            } finally { if (c != null) c.disconnect(); }
            final int st = status;
            final String b = body;
            host.runOnUiThread(new Runnable() { public void run() {
                try {
                    JSONObject d = new JSONObject();
                    d.put("id", id);
                    d.put("status", st);
                    d.put("body", b);
                    dispatch("garage-upc", d.toString());
                } catch (JSONException ignored) { }
            }});
        }}, "upc-lookup").start();
    }
}
