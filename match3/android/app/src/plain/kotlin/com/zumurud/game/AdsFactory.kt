package com.zumurud.game

import androidx.activity.ComponentActivity

/**
 * "plain" flavour: the app contains no ad SDK at all (and therefore no advertising-id permission).
 * The "ads" flavour has its own `AdsFactory` with the same shape.
 */
@Suppress("UNUSED_PARAMETER") // same signature as the "ads" flavour, which needs all three
internal object AdsFactory {
    /** Reported to the page in storeCaps(). */
    const val HAS_ADS = false

    fun create(activity: ComponentActivity, host: StoreHost, sink: StoreEventSink): AdsController = NoAds(sink)
}

/** Answers every request at once with "no ads", so a page that asks anyway never waits. */
private class NoAds(private val sink: StoreEventSink) : AdsController {
    override fun start() = Unit

    override fun sync() = sink.emit(StoreEvents.NO_ADS)

    override fun showRewarded(placement: String) = sink.emit(StoreEvents.adResult("rewarded", "failed"))

    override fun showInterstitial() = sink.emit(StoreEvents.adResult("interstitial", "failed"))

    override fun showPrivacyOptions() = sink.emit(StoreEvents.NO_ADS)

    override fun onResume() = Unit

    override fun onPause() = Unit

    override fun onDestroy() = Unit
}
