package com.focuspoint.app;

import android.Manifest;
import android.app.NotificationManager;
import android.net.Uri;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import com.google.androidbrowserhelper.trusted.PrefUtils;

/**
 * Opens the Focus Point web app in a Trusted Web Activity, but first — on Android 13+ — asks for the notification
 * permission natively, like any installed app, on every launch until it is allowed (Android itself stops showing the
 * prompt after the user refuses twice; the app then opens straight away and the panel explains how to turn it on).
 * With the permission granted, Chrome reports notifications as allowed to the site, so the booking and team
 * notifications register themselves without a button.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final int REQUEST_NOTIFICATIONS = 7001;
    private static final String KEY_ASKING = "fp_asking_notifications";
    private static final String HAS_REQUESTED_KEY = "HAS_REQUESTED_NOTIFICATION_PERMISSION";   // PrefUtils' key
    private boolean launched;
    private boolean asking;   // the system prompt is on screen (survives a rotation, so we never ask twice at once)

    private boolean shouldAskForNotifications() {
        if (Build.VERSION.SDK_INT < 33) return false;   // before Android 13 notifications are allowed by default
        return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED;
    }

    @Override
    protected boolean shouldLaunchImmediately() {
        return !shouldAskForNotifications();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (isFinishing()) return;   // the library closed this screen (the app was already open)
        asking = savedInstanceState != null && savedInstanceState.getBoolean(KEY_ASKING);
        if (!asking && !launched && shouldAskForNotifications()) {
            asking = true;
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST_NOTIFICATIONS);
        }
    }

    /**
     * Tells the site whether this app may show notifications ("np=1" / "np=0"). Chrome only re-reads the app's
     * permission once per Chrome process, so right after the user allows (or refuses) it here the page can still see
     * a stale "not asked yet". With the hint, the page registers by itself when allowed — Chrome passes the request
     * to this app, which answers at once without a dialog — and does not ask a second time right after a refusal.
     */
    @Override
    protected Uri getLaunchingUrl() {
        Uri url = super.getLaunchingUrl();
        NotificationManager nm = getSystemService(NotificationManager.class);
        boolean allowed = nm != null && nm.areNotificationsEnabled();
        // While notifications are allowed, forget android-browser-helper's "already asked" flag (its permission screen
        // sets it even when it answers without a dialog). If the user later turns notifications off, Chrome then
        // reports "not asked" (the page can ask again) instead of caching "blocked" until Chrome restarts.
        if (allowed) PrefUtils.getAppSharedPreferences(this).edit().remove(HAS_REQUESTED_KEY).apply();
        return url.buildUpon().appendQueryParameter("np", allowed ? "1" : "0").build();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putBoolean(KEY_ASKING, asking);
    }

    @Override
    protected void launchTwa() {
        if (launched) return;   // a screen rotation during the prompt must not open the app twice
        launched = true;
        super.launchTwa();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_NOTIFICATIONS) return;
        asking = false;
        // The user has just answered a dialog, so the enter animation is long over. A screen recreated during the
        // dialog never gets this callback, and the splash would otherwise wait for it forever.
        onEnterAnimationComplete();
        launchTwa();   // granted or not, open the app
    }
}
