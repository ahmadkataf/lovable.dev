package com.zumurud.game

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit

/**
 * The player's progress: one opaque string the game writes through the bridge.
 *
 * It lives in its own SharedPreferences file so the backup rules (res/xml/backup_rules.xml and
 * data_extraction_rules.xml) can include exactly this file and nothing else. SharedPreferences is
 * safe to use from the bridge thread; apply() updates memory at once and writes to disk behind.
 */
internal class SaveStore(context: Context) {
    private val prefs: SharedPreferences = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    /** The stored save, or "" when there is none (or it cannot be read). */
    fun load(): String = try {
        prefs.getString(KEY, null) ?: ""
    } catch (_: ClassCastException) {
        ""
    }

    /** Stores [value]; returns false (and keeps the previous save) when it is missing or larger than [MAX_BYTES]. */
    fun store(value: String?): Boolean {
        if (value == null || value.length > MAX_BYTES || utf8Length(value) > MAX_BYTES) return false
        prefs.edit { putString(KEY, value) } // apply(): memory now, disk in the background
        return true
    }

    private fun utf8Length(text: String): Int {
        var bytes = 0
        var i = 0
        while (i < text.length) {
            val c = text[i]
            when {
                c.code < 0x80 -> bytes += 1
                c.code < 0x800 -> bytes += 2
                Character.isHighSurrogate(c) && i + 1 < text.length && Character.isLowSurrogate(text[i + 1]) -> {
                    bytes += 4
                    i++
                }
                else -> bytes += 3
            }
            i++
        }
        return bytes
    }

    companion object {
        /** Also named in the backup rule files — change all three together. */
        const val FILE = "zumurud_save"
        private const val KEY = "save"

        /** Far above any real save (a few kilobytes); a larger payload is a bug, not progress. */
        const val MAX_BYTES = 1 shl 20
    }
}
