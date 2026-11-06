package com.dentora.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Where the phone's camera app puts a photo taken from the file chooser ("Take a photo" next to the files): a file in
 * the app's cache folder, handed to the camera as content://com.dentora.app.capture/photo-….jpg with a one-off write
 * grant. Not exported: only an app the shell grants a single photo's address can write it, and only that file.
 * No CAMERA permission is needed, because the system's camera app takes the picture.
 */
public final class CaptureProvider extends ContentProvider {
    static final String AUTHORITY = "com.dentora.app.capture";
    private static final String DIR = "capture";

    static File dir(Context c) {
        File d = new File(c.getCacheDir(), DIR);
        if (!d.isDirectory()) d.mkdirs();
        return d;
    }

    static Uri uriFor(File f) {
        return new Uri.Builder().scheme("content").authority(AUTHORITY).appendPath(f.getName()).build();
    }

    /** A new, unused file for the next photo. */
    static File newPhoto(Context c) {
        File d = dir(c);
        String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(new Date());
        for (int n = 1; n < 1000; n++) {
            File f = new File(d, WebFiles.captureName(stamp, n));
            if (!f.exists()) return f;
        }
        return new File(d, WebFiles.captureName(stamp, 999));
    }

    /** Photos of an earlier run: the page has long copied the ones it kept into its own storage. */
    static void clear(Context c) {
        File[] files = dir(c).listFiles();
        if (files == null) return;
        for (File f : files) f.delete();
    }

    private File fileFor(Uri uri) throws FileNotFoundException {
        List<String> segments = uri.getPathSegments();
        Context c = getContext();
        if (c == null || segments.size() != 1 || !WebFiles.isCaptureName(segments.get(0))) throw new FileNotFoundException(uri.toString());
        return new File(dir(c), segments.get(0));
    }

    @Override
    public boolean onCreate() { return true; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.parseMode(mode));
    }

    @Override
    public String getType(Uri uri) {
        return "image/jpeg";
    }

    /** The name and size the page sees for the photo (File.name in <input type=file>). */
    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        File f;
        try {
            f = fileFor(uri);
        } catch (FileNotFoundException e) {
            return null;
        }
        String[] wanted = projection == null ? new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
        List<String> cols = new ArrayList<>();
        List<Object> row = new ArrayList<>();
        for (String col : wanted) {
            if (OpenableColumns.DISPLAY_NAME.equals(col)) { cols.add(col); row.add(f.getName()); }
            else if (OpenableColumns.SIZE.equals(col)) { cols.add(col); row.add(f.length()); }
        }
        MatrixCursor cursor = new MatrixCursor(cols.toArray(new String[0]), 1);
        cursor.addRow(row.toArray());
        return cursor;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) { return null; }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { return 0; }
}
