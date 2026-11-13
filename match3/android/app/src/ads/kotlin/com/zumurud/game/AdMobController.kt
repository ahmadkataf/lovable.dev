package com.zumurud.game

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.activity.ComponentActivity
import com.google.android.libraries.ads.mobile.sdk.MobileAds
import com.google.android.libraries.ads.mobile.sdk.common.Ad
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError
import com.google.android.libraries.ads.mobile.sdk.common.RequestConfiguration
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAd
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAdEventCallback
import com.google.android.libraries.ads.mobile.sdk.rewarded.OnUserEarnedRewardListener
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardItem
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAd
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAdEventCallback
import com.google.android.ump.ConsentDebugSettings
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * AdMob for the "ads" flavour: one rewarded and one interstitial ad kept ready, shown on request.
 *
 * Order of things, every launch:
 *  1. Consent (Google's UMP SDK): requestConsentInfoUpdate → loadAndShowConsentFormIfRequired.
 *  2. Only when `canRequestAds()` says so — from this launch's answer or from an earlier
 *     session's — the ad SDK is initialised, once, on a background thread.
 *  3. Then one rewarded and one interstitial ad are loaded. A failed load is retried with growing
 *     pauses; a shown ad is replaced; an ad older than 55 minutes is thrown away and replaced
 *     (AdMob does not pay for ads shown more than an hour after loading).
 *  Nothing is requested from the ad servers before step 2, ever.
 *
 * What the page hears (StoreEvents, src/monetize/types.ts):
 *  - 'ads' {canRequestAds, rewardedReady, interstitialReady, privacyOptionsRequired} at start,
 *    whenever one of the four changes, on storeSync() and after the privacy-options form;
 *  - 'adResult' once for every showRewarded / showInterstitial: for a rewarded ad "earned" only if
 *    the SDK reported the reward and the ad was closed; "dismissed" when it was closed without;
 *    "failed" when no ad could be shown.
 *
 * Rules kept here: no ad and no form while the activity is not resumed; one full-screen thing at
 * a time; the system bars are hidden again after every ad and every form; audience 13+, so ads are
 * limited to content rating PG and no child-directed tag is set; test-device settings exist in
 * debug builds only.
 *
 * Threads: all state belongs to the main thread. The GMA Next-Gen SDK delivers its callbacks on
 * background threads, so every callback is posted to the main thread first; SDK initialisation and
 * ad loading are started from one private background thread, as Google asks.
 */
internal class AdMobController(
    activity: ComponentActivity,
    private val host: StoreHost,
    private val sink: StoreEventSink,
) : AdsController {

    private enum class Sdk { IDLE, STARTING, READY }

    /** One ad format: the ad that is ready (if any) and the state of its loading. */
    private inner class Slot<T : Ad>(
        val format: String,
        val unitId: String,
        val request: (AdRequest, AdLoadCallback<T>) -> Unit,
    ) {
        var ad: T? = null
        var loadedAt = 0L
        var loading = false
        var loadId = 0
        var failures = 0

        /** A load was due while the app was in the background: do it when it returns. */
        var loadWanted = false

        val retry = Runnable { load(this) }
        val expire = Runnable { dropExpired(this) }

        fun fresh(): Boolean = ad != null && SystemClock.elapsedRealtime() - loadedAt < MAX_AD_AGE_MS
    }

    /** The full-screen ad that is on screen (or about to be). */
    private class Showing(val format: String) {
        var shown = false
        var earned = false
        var dismissed = false
        var settled = false
    }

    private val appContext: Context = activity.applicationContext
    private var activity: ComponentActivity? = activity

    private val main = Handler(Looper.getMainLooper())
    private val background: ExecutorService =
        Executors.newSingleThreadExecutor { task -> Thread(task, "zumurud-ads").apply { isDaemon = true } }

    private var destroyed = false
    private var resumed = false

    // ── consent ──
    private val consent: ConsentInformation? = try {
        UserMessagingPlatform.getConsentInformation(appContext)
    } catch (error: Throwable) {
        Log.w(TAG, "the consent SDK is not usable: ${error.javaClass.simpleName}")
        null
    }
    private var consentRequestRunning = false
    private var consentUpToDate = false
    private var consentFailures = 0
    private var nextConsentAttemptAt = 0L
    private var formWanted = false
    private var formShowing = false

    // ── ad SDK ──
    private var sdk = Sdk.IDLE
    private var sdkFailures = 0
    private var nextSdkAttemptAt = 0L

    private val rewarded = Slot<RewardedAd>("rewarded", BuildConfig.ADMOB_REWARDED_ID) { request, callback ->
        RewardedAd.load(request, callback)
    }
    private val interstitial = Slot<InterstitialAd>("interstitial", BuildConfig.ADMOB_INTERSTITIAL_ID) { request, callback ->
        InterstitialAd.load(request, callback)
    }

    private var showing: Showing? = null
    private var lastAdsEvent: String? = null

    // ───────────────────────── AdsController (main thread) ─────────────────────────

    override fun start() {
        if (BuildConfig.ADS_TEST) {
            Log.w(TAG, "TEST ADS: this build uses Google's sample AdMob ids — test ads only, not for release")
        }
        if (BuildConfig.ADS_DIAG_FORCE_INIT) {
            Log.w(TAG, "VERIFICATION BUILD: the ad SDK is started without waiting for consent — test bench only")
        }
        emitAds(force = true)
        // Consent from an earlier session lets ads start right away; this launch's answer follows.
        afterConsentChange()
        requestConsentUpdate()
    }

    override fun sync() = emitAds(force = true)

    override fun showRewarded(placement: String) {
        val ad = takeForShow(rewarded) ?: return
        val state = Showing(rewarded.format).also { showing = it }
        emitAds()
        Log.i(TAG, "showing a rewarded ad ($placement)")
        ad.adEventCallback = object : RewardedAdEventCallback {
            override fun onAdShowedFullScreenContent() = onMain { state.shown = true }

            override fun onAdDismissedFullScreenContent() = onMain { dismissed(state, ad, rewarded) }

            override fun onAdFailedToShowFullScreenContent(fullScreenContentError: FullScreenContentError) =
                onMain { showFailed(state, ad, rewarded, fullScreenContentError.code.name) }
        }
        val onReward = object : OnUserEarnedRewardListener {
            override fun onUserEarnedReward(reward: RewardItem) = onMain {
                state.earned = true
                // The two callbacks come from different threads: the reward may trail the dismissal.
                if (state.dismissed) settle(state, rewarded)
            }
        }
        present(state, ad, rewarded) { host ->
            ad.setImmersiveMode(true)
            ad.show(host, onReward)
        }
    }

    override fun showInterstitial() {
        val ad = takeForShow(interstitial) ?: return
        val state = Showing(interstitial.format).also { showing = it }
        emitAds()
        Log.i(TAG, "showing an interstitial ad")
        ad.adEventCallback = object : InterstitialAdEventCallback {
            override fun onAdShowedFullScreenContent() = onMain { state.shown = true }

            override fun onAdDismissedFullScreenContent() = onMain { dismissed(state, ad, interstitial) }

            override fun onAdFailedToShowFullScreenContent(fullScreenContentError: FullScreenContentError) =
                onMain { showFailed(state, ad, interstitial, fullScreenContentError.code.name) }
        }
        present(state, ad, interstitial) { host ->
            ad.setImmersiveMode(true)
            ad.show(host)
        }
    }

    override fun showPrivacyOptions() {
        val host = activity
        if (destroyed || host == null || !resumed || showing != null || formShowing) return emitAds(force = true)
        formShowing = true
        try {
            UserMessagingPlatform.showPrivacyOptionsForm(host) { error ->
                onMain {
                    if (error != null) Log.w(TAG, "privacy options: ${error.message} (code ${error.errorCode})")
                    formClosed()
                    emitAds(force = true) // the page waits for this event, changed or not
                }
            }
        } catch (error: Throwable) {
            Log.w(TAG, "privacy options failed: ${error.javaClass.simpleName}")
            formShowing = false
            emitAds(force = true)
        }
    }

    override fun onResume() {
        if (destroyed) return
        resumed = true
        if (formWanted) showConsentFormIfRequired()
        val now = SystemClock.elapsedRealtime()
        if (!consentUpToDate && !consentRequestRunning && now >= nextConsentAttemptAt) requestConsentUpdate()
        if (sdk == Sdk.IDLE && now >= nextSdkAttemptAt) afterConsentChange()
        for (slot in listOf(rewarded, interstitial)) {
            dropExpired(slot)
            if (slot.loadWanted) load(slot)
        }
        // Back on screen with an ad still marked as showing: its "dismissed" callback is due now.
        showing?.let { state ->
            main.postDelayed({
                if (showing === state && !state.settled && resumed && state.shown) {
                    Log.w(TAG, "the ${state.format} ad closed without reporting it")
                    host.restoreImmersiveMode()
                    settle(state, slotOf(state))
                }
            }, RETURN_GRACE_MS)
        }
    }

    override fun onPause() {
        resumed = false
    }

    override fun onDestroy() {
        destroyed = true
        activity = null
        main.removeCallbacksAndMessages(null)
        for (slot in listOf(rewarded, interstitial)) discard(slot)
        background.shutdown()
    }

    // ───────────────────────── consent ─────────────────────────

    private fun canRequestAds(): Boolean = try {
        consent?.canRequestAds() == true
    } catch (_: Throwable) {
        false
    }

    private fun privacyOptionsRequired(): Boolean = try {
        consent?.privacyOptionsRequirementStatus == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
    } catch (_: Throwable) {
        false
    }

    /** Ads may be requested: consent allows it (or this is a verification build, see ADS_DIAG_FORCE_INIT). */
    private fun adsAllowed(): Boolean = canRequestAds() || BuildConfig.ADS_DIAG_FORCE_INIT

    private fun requestConsentUpdate() {
        val host = activity
        val info = consent
        if (destroyed || host == null || info == null || consentRequestRunning) return
        consentRequestRunning = true
        try {
            info.requestConsentInfoUpdate(
                host,
                consentParameters(),
                { onMain { consentUpdateDone(null) } },
                { error -> onMain { consentUpdateDone("${error.message} (code ${error.errorCode})") } },
            )
        } catch (error: Throwable) {
            consentUpdateDone(error.javaClass.simpleName)
        }
    }

    private fun consentUpdateDone(problem: String?) {
        consentRequestRunning = false
        if (problem == null) {
            consentUpToDate = true
            consentFailures = 0
            showConsentFormIfRequired()
        } else {
            // Usually: no network. Tried again when the app returns to the screen, with growing pauses.
            consentFailures++
            nextConsentAttemptAt = SystemClock.elapsedRealtime() + backoff(CONSENT_RETRY_BASE_MS, consentFailures, CONSENT_RETRY_MAX_MS)
            Log.i(TAG, "consent information could not be updated: $problem")
        }
        afterConsentChange()
    }

    private fun showConsentFormIfRequired() {
        val host = activity
        if (destroyed || host == null || formShowing) return
        if (!resumed || showing != null) {
            formWanted = true // shown when the game is back on screen
            return
        }
        formWanted = false
        formShowing = true
        try {
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(host) { error ->
                onMain {
                    if (error != null) Log.w(TAG, "consent form: ${error.message} (code ${error.errorCode})")
                    formClosed()
                }
            }
        } catch (error: Throwable) {
            Log.w(TAG, "consent form failed: ${error.javaClass.simpleName}")
            formShowing = false
        }
    }

    private fun formClosed() {
        formShowing = false
        host.restoreImmersiveMode()
        afterConsentChange()
    }

    /** Consent may have changed: start the ad SDK if it is allowed now, drop the ads if it no longer is. */
    private fun afterConsentChange() {
        if (destroyed) return
        if (adsAllowed()) {
            startSdk()
        } else {
            for (slot in listOf(rewarded, interstitial)) discard(slot)
        }
        emitAds()
    }

    private fun consentParameters(): ConsentRequestParameters {
        val parameters = ConsentRequestParameters.Builder()
        if (BuildConfig.DEBUG) {
            // Debug builds only: test devices and a pretended region, to see the consent form anywhere.
            val geography = when (BuildConfig.UMP_DEBUG_GEOGRAPHY) {
                "EEA" -> ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_EEA
                "REGULATED_US_STATE" -> ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_REGULATED_US_STATE
                "OTHER" -> ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_OTHER
                else -> null
            }
            val devices = testDevices()
            if (geography != null || devices.isNotEmpty()) {
                val debug = ConsentDebugSettings.Builder(appContext)
                geography?.let { debug.setDebugGeography(it) }
                devices.forEach { debug.addTestDeviceHashedId(it) }
                parameters.setConsentDebugSettings(debug.build())
            }
        }
        return parameters.build()
    }

    private fun testDevices(): List<String> =
        if (BuildConfig.DEBUG) BuildConfig.ADS_TEST_DEVICE_IDS.split(',').map { it.trim() }.filter { it.isNotEmpty() } else emptyList()

    // ───────────────────────── ad SDK ─────────────────────────

    private fun startSdk() {
        if (sdk != Sdk.IDLE || destroyed) return
        sdk = Sdk.STARTING
        val configuration = RequestConfiguration.Builder()
            // The game is for players of 13 and over: general-audience ads up to "parental guidance".
            // No child-directed / under-age tag is set, because the audience does not include children.
            .setMaxAdContentRating(RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_PG)
            .apply { testDevices().takeIf { it.isNotEmpty() }?.let { setTestDeviceIds(it) } }
            .build()
        background.execute {
            // Must not run on the main thread (Google: it can cause an ANR there).
            val problem = try {
                if (!MobileAds.isInitialized) {
                    MobileAds.initialize(
                        appContext,
                        InitializationConfig.Builder(BuildConfig.ADMOB_APP_ID).setRequestConfiguration(configuration).build(),
                    ) { /* adapters done — there is no mediation, nothing to wait for */ }
                }
                null
            } catch (error: Throwable) {
                error.javaClass.simpleName
            }
            main.post {
                if (destroyed) return@post
                if (problem == null) {
                    sdk = Sdk.READY
                    sdkFailures = 0
                    Log.i(TAG, "ad SDK ready")
                    load(rewarded)
                    load(interstitial)
                } else {
                    sdk = Sdk.IDLE
                    sdkFailures++
                    nextSdkAttemptAt = SystemClock.elapsedRealtime() + backoff(SDK_RETRY_BASE_MS, sdkFailures, SDK_RETRY_MAX_MS)
                    Log.w(TAG, "the ad SDK did not start: $problem")
                }
                emitAds()
            }
        }
    }

    // ───────────────────────── loading ─────────────────────────

    private fun <T : Ad> load(slot: Slot<T>) {
        main.removeCallbacks(slot.retry)
        if (destroyed || sdk != Sdk.READY || !adsAllowed() || slot.loading || slot.fresh()) return
        if (!resumed) {
            slot.loadWanted = true
            return
        }
        slot.loadWanted = false
        slot.loading = true
        val id = ++slot.loadId
        // A load that never answers counts as failed, so the slot does not stay stuck.
        main.postDelayed({ if (slot.loading && slot.loadId == id) loadFailed(slot, id, "no answer") }, LOAD_TIMEOUT_MS)
        background.execute {
            try {
                slot.request(
                    AdRequest.Builder(slot.unitId).build(),
                    object : AdLoadCallback<T> {
                        override fun onAdLoaded(ad: T) {
                            main.post { loaded(slot, id, ad) }
                        }

                        override fun onAdFailedToLoad(adError: LoadAdError) = onMain { loadFailed(slot, id, adError.code.name) }
                    },
                )
            } catch (error: Throwable) {
                onMain { loadFailed(slot, id, error.javaClass.simpleName) }
            }
        }
    }

    private fun <T : Ad> loaded(slot: Slot<T>, id: Int, ad: T) {
        val late = id != slot.loadId || !slot.loading
        if (destroyed || !adsAllowed() || (late && (slot.ad != null || slot.loading))) {
            // Nobody is waiting for this one any more.
            destroy(ad)
            return
        }
        slot.loading = false
        slot.failures = 0
        slot.ad = ad
        slot.loadedAt = SystemClock.elapsedRealtime()
        main.removeCallbacks(slot.retry)
        main.removeCallbacks(slot.expire)
        main.postDelayed(slot.expire, MAX_AD_AGE_MS)
        Log.i(TAG, "${slot.format} ad loaded")
        emitAds()
    }

    private fun loadFailed(slot: Slot<*>, id: Int, reason: String) {
        if (id != slot.loadId || !slot.loading) return
        slot.loading = false
        slot.failures++
        val pause = backoff(LOAD_RETRY_BASE_MS, slot.failures, LOAD_RETRY_MAX_MS)
        Log.i(TAG, "${slot.format} ad did not load ($reason), next try in ${pause / 1000} s")
        main.removeCallbacks(slot.retry)
        main.postDelayed(slot.retry, pause)
    }

    /** An ad kept for too long is worthless: replace it. */
    private fun dropExpired(slot: Slot<*>) {
        if (slot.ad == null || slot.fresh()) return
        Log.i(TAG, "${slot.format} ad expired unused")
        discard(slot)
        emitAds()
        load(slot)
    }

    private fun discard(slot: Slot<*>) {
        main.removeCallbacks(slot.retry)
        main.removeCallbacks(slot.expire)
        slot.ad?.let { destroy(it) }
        slot.ad = null
    }

    private fun destroy(ad: Ad) {
        try {
            ad.destroy()
        } catch (_: Throwable) {
        }
    }

    // ───────────────────────── showing ─────────────────────────

    /** The ad to show, taken out of its slot — or null after reporting "failed". */
    private fun <T : Ad> takeForShow(slot: Slot<T>): T? {
        val ad = slot.ad
        val ok = !destroyed && activity != null && resumed && showing == null && !formShowing && adsAllowed() && ad != null && slot.fresh()
        if (!ok) {
            sink.emit(StoreEvents.adResult(slot.format, "failed"))
            if (!destroyed) {
                dropExpired(slot)
                load(slot)
            }
            return null
        }
        slot.ad = null
        main.removeCallbacks(slot.expire)
        return ad
    }

    private fun present(state: Showing, ad: Ad, slot: Slot<*>, show: (ComponentActivity) -> Unit) {
        val host = activity
        if (host == null) return showFailed(state, ad, slot, "no activity")
        try {
            show(host)
        } catch (error: Throwable) {
            return showFailed(state, ad, slot, error.javaClass.simpleName)
        }
        // If the ad never opens (this activity is still in front and nothing was reported), give up.
        main.postDelayed({
            if (showing === state && !state.settled && !state.shown && resumed) showFailed(state, ad, slot, "did not open")
        }, SHOW_TIMEOUT_MS)
    }

    private fun dismissed(state: Showing, ad: Ad, slot: Slot<*>) {
        if (state.settled || state.dismissed) return
        state.dismissed = true
        destroy(ad)
        host.restoreImmersiveMode()
        if (state.format == rewarded.format && !state.earned) {
            // Give a reward callback that is still on its way a moment to arrive.
            main.postDelayed({ settle(state, slot) }, REWARD_GRACE_MS)
        } else {
            settle(state, slot)
        }
    }

    private fun showFailed(state: Showing, ad: Ad, slot: Slot<*>, reason: String) {
        if (state.settled) return
        state.settled = true
        if (showing === state) showing = null
        Log.w(TAG, "${state.format} ad could not be shown: $reason")
        destroy(ad)
        host.restoreImmersiveMode()
        sink.emit(StoreEvents.adResult(state.format, "failed"))
        emitAds()
        load(slot)
    }

    private fun settle(state: Showing, slot: Slot<*>) {
        if (state.settled) return
        state.settled = true
        if (showing === state) showing = null
        val result = if (state.format == rewarded.format && state.earned) "earned" else "dismissed"
        Log.i(TAG, "${state.format} ad closed: $result")
        sink.emit(StoreEvents.adResult(state.format, result))
        emitAds()
        load(slot) // the next one
    }

    private fun slotOf(state: Showing): Slot<*> = if (state.format == rewarded.format) rewarded else interstitial

    // ───────────────────────── helpers ─────────────────────────

    private fun emitAds(force: Boolean = false) {
        if (destroyed) return
        val allowed = adsAllowed()
        val event = StoreEvents.ads(
            canRequestAds = canRequestAds(),
            rewardedReady = allowed && rewarded.fresh(),
            interstitialReady = allowed && interstitial.fresh(),
            privacyOptionsRequired = privacyOptionsRequired(),
        )
        if (!force && event == lastAdsEvent) return
        lastAdsEvent = event
        sink.emit(event)
    }

    private fun onMain(action: () -> Unit) {
        main.post {
            if (destroyed) return@post
            try {
                action()
            } catch (error: Throwable) {
                Log.w(TAG, "ad callback failed: ${error.javaClass.simpleName}")
            }
        }
    }

    /** base, 2·base, 4·base … capped at [max]. */
    private fun backoff(base: Long, failures: Int, max: Long): Long =
        (base shl (failures - 1).coerceIn(0, 16)).coerceAtMost(max)

    private companion object {
        const val TAG = "ZumurudAds"

        /** AdMob counts an ad as expired one hour after loading; keep a margin. */
        const val MAX_AD_AGE_MS = 55 * 60_000L
        const val LOAD_TIMEOUT_MS = 90_000L
        const val LOAD_RETRY_BASE_MS = 15_000L
        const val LOAD_RETRY_MAX_MS = 15 * 60_000L
        const val SHOW_TIMEOUT_MS = 10_000L
        const val REWARD_GRACE_MS = 500L
        const val RETURN_GRACE_MS = 4_000L
        const val CONSENT_RETRY_BASE_MS = 30_000L
        const val CONSENT_RETRY_MAX_MS = 10 * 60_000L
        const val SDK_RETRY_BASE_MS = 30_000L
        const val SDK_RETRY_MAX_MS = 10 * 60_000L
    }
}
