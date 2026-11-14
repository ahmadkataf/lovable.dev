package com.zumurud.game

import androidx.activity.ComponentActivity

/**
 * "ads" flavour: AdMob through the GMA Next-Gen SDK, behind Google's consent SDK (UMP).
 * The "plain" flavour has its own `AdsFactory` with the same shape and no ad SDK.
 */
internal object AdsFactory {
    /** Reported to the page in storeCaps(). */
    const val HAS_ADS = true

    fun create(activity: ComponentActivity, host: StoreHost, sink: StoreEventSink): AdsController =
        AdMobController(activity, host, sink)
}
