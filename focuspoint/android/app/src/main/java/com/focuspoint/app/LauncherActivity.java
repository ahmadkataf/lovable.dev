package com.focuspoint.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

/**
 * Opens the Focus Point web app in a Trusted Web Activity, but first — on Android 13+ — asks for the notification
 * permission natively, once, like any installed app. With the permission granted, Chrome reports notifications as
 * allowed to the site, so the booking and team notifications register themselves without a button.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final int REQUEST_NOTIFICATIONS = 7001;
    private static final String PREFS = "focuspoint";
    private static final String ASKED = "notification_permission_asked";
    private boolean launched;

    private boolean shouldAskForNotifications() {
        if (Build.VERSION.SDK_INT < 33) return false;   // before Android 13 notifications are allowed by default
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return false;
        return !getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(ASKED, false);
    }

    @Override
    protected boolean shouldLaunchImmediately() {
        return !shouldAskForNotifications();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (isFinishing()) return;   // the library closed this screen (the app was already open)
        if (shouldAskForNotifications()) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(ASKED, true).apply();
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST_NOTIFICATIONS);
        }
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
        if (requestCode == REQUEST_NOTIFICATIONS) launchTwa();   // granted or not, open the app
    }
}
