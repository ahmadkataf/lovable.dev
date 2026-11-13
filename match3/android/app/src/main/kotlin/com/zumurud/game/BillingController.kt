package com.zumurud.game

import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.activity.ComponentActivity
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONArray

/**
 * Google Play Billing (Billing Library 9, one-time products only) behind the store bridge.
 *
 * What the page asks for and what it gets back (StoreEvents, src/monetize/types.ts):
 *  - [query]   → 'products': the products Play can sell right now, each with Play's own localised
 *                price text. An empty list whenever billing is unavailable or nothing is configured.
 *  - [buy]     → exactly one 'purchase' event per attempt: purchased (with the token), pending,
 *                cancelled, alreadyOwned, unavailable or error.
 *  - [restore] and every onResume → 'owned' (acknowledged entitlements) followed by a 'purchase'
 *                event for every paid purchase that is not finished yet, so the page can grant it
 *                and call [finish]. A PENDING payment is only ever reported as "pending".
 *  - [finish]  → consume (consumable) or acknowledge (entitlement). Which one is decided by the
 *                kind the page declared for that product in [query]; nothing is hard-coded here.
 *                The save holding the grant is forced onto disk first; if that fails the purchase
 *                stays unfinished and is reported again at the next listing.
 *
 * Threads: this object's state belongs to the main thread. Every call into the Billing Library
 * that the library allows off the main thread — creating the client (it sets up logging and reads
 * from disk), connecting, querying, consuming, acknowledging — runs on one private worker thread;
 * only launchBillingFlow, which must, runs on the main thread. Library callbacks arrive on threads
 * of the library's choosing and are posted to the main thread first. After [onDestroy] nothing is
 * delivered any more and the activity is no longer referenced.
 *
 * Purchase tokens are never written to the log.
 */
internal class BillingController(
    activity: ComponentActivity,
    private val sink: StoreEventSink,
    /** Blocks until the game's save is on disk; false when it could not be written. Background threads only. */
    private val flushSave: () -> Boolean,
) : PurchasesUpdatedListener {

    private enum class Kind { CONSUMABLE, ENTITLEMENT }

    /** What is known about one purchase the store has reported. */
    private class Known(val productId: String, val purchased: Boolean, var acknowledged: Boolean)

    /** A request waiting for the connection to Google Play. */
    private class Waiter(val run: (BillingClient) -> Unit, val fail: (Int) -> Unit) {
        var done = false
    }

    private val appContext = activity.applicationContext
    private var activity: ComponentActivity? = activity

    private val main = Handler(Looper.getMainLooper())
    private val workerThread = HandlerThread("zumurud-billing").apply { start() }
    private val worker = Handler(workerThread.looper)

    @Volatile
    private var destroyed = false

    /** Created on the worker thread, on first use. */
    @Volatile
    private var client: BillingClient? = null

    // ── main-thread state ──
    private var resumed = false
    private var connecting = false

    /** The current client has been connected at least once: from then on the library reconnects by itself. */
    private var connectedOnce = false
    private var connectAttempt = 0
    private var connectFailures = 0
    private val waiters = ArrayList<Waiter>()

    /** Product id → what the page said it is. Only ever grows. */
    private val kinds = HashMap<String, Kind>()

    /** The products of the page's last query, to answer it again once Play becomes reachable. */
    private var lastQuery: List<String> = emptyList()
    private var productsStale = false

    /** Purchase token → what the store said about it, from the last listing and from new purchases. */
    private val known = HashMap<String, Known>()
    private val finishing = HashSet<String>()

    private var buying: String? = null
    private var buyingSince = 0L

    private var ownedQueryRunning = false

    private val reconnect = Runnable {
        if (!destroyed && resumed && !connectedOnce) connect()
    }

    // ───────────────────────── the bridge's requests (main thread) ─────────────────────────

    /** [idsJson]: `[{"id":"coins_small","kind":"consumable"}, …]` → a 'products' event. */
    fun query(idsJson: String) {
        if (destroyed) return
        val ids = declareProducts(idsJson)
        lastQuery = ids
        queryProducts(ids)
    }

    fun buy(id: String) {
        if (destroyed) return
        if (activity == null || !resumed) return emitPurchase(id, "error")
        val current = buying
        if (current != null) {
            // One purchase at a time. A flow that never reported back is given up once this app is
            // on screen again (so Play's sheet has gone) and a minute has passed.
            val stale = SystemClock.elapsedRealtime() - buyingSince > STALE_BUY_MS
            if (!stale) return emitPurchase(id, "error")
            Log.w(TAG, "giving up on a purchase flow that never reported back")
        }
        buying = id
        buyingSince = SystemClock.elapsedRealtime()
        // Product details are fetched fresh for every purchase: Play refuses stale ones.
        withClient(
            fail = { code -> endBuy(id, stateFor(code)) },
            run = { c ->
                c.queryProductDetailsAsync(productParams(listOf(id))) { result, details ->
                    onMain { launch(c, id, result, details) }
                }
            },
        )
    }

    fun finish(token: String) {
        if (destroyed || !finishing.add(token)) return
        val purchase = known[token]
        if (purchase != null) return finishKnown(token, purchase, attempt = 1)
        // Not from this session's listings: ask Play what it is before touching it.
        withClient(
            fail = { finishing.remove(token) },
            run = { c ->
                c.queryPurchasesAsync(PURCHASES_PARAMS) { result, purchases ->
                    onMain {
                        if (result.responseCode == BillingResponseCode.OK) for (p in purchases) remember(p)
                        val found = known[token]
                        if (found == null) {
                            finishing.remove(token)
                            Log.w(TAG, "finish: Google Play does not know this purchase (already consumed?)")
                        } else {
                            finishKnown(token, found, attempt = 1)
                        }
                    }
                }
            },
        )
    }

    /** → 'owned', then a 'purchase' event for every purchase that still has to be granted or finished. */
    fun restore() {
        // A listing that is already under way answers this request too.
        if (destroyed || ownedQueryRunning) return
        ownedQueryRunning = true
        withClient(
            fail = { ownedDone(null) },
            run = { c ->
                c.queryPurchasesAsync(PURCHASES_PARAMS) { result, purchases ->
                    onMain { ownedDone(if (result.responseCode == BillingResponseCode.OK) purchases else null, result) }
                }
            },
        )
    }

    fun onResume() {
        if (destroyed) return
        resumed = true
        // A payment may have completed, or a purchase been made outside the app, while it was away.
        restore()
    }

    fun onPause() {
        resumed = false
        main.removeCallbacks(reconnect)
    }

    fun onDestroy() {
        destroyed = true
        activity = null
        main.removeCallbacksAndMessages(null)
        waiters.clear()
        worker.removeCallbacksAndMessages(null)
        worker.post {
            try {
                client?.endConnection()
            } catch (error: Throwable) {
                Log.w(TAG, "endConnection failed: ${error.javaClass.simpleName}")
            }
            client = null
            workerThread.quitSafely()
        }
    }

    // ───────────────────────── products ─────────────────────────

    /** Remember what kind each product is; return the valid ids in the order the page gave them. */
    private fun declareProducts(idsJson: String): List<String> {
        val ids = ArrayList<String>()
        try {
            val array = JSONArray(idsJson)
            for (i in 0 until array.length()) {
                val item = array.optJSONObject(i) ?: continue
                val id = item.optString("id")
                if (!PRODUCT_ID.matches(id) || id in ids) continue
                val kind = when (item.optString("kind")) {
                    "consumable" -> Kind.CONSUMABLE
                    "entitlement" -> Kind.ENTITLEMENT
                    else -> continue
                }
                if (ids.size == MAX_PRODUCTS) {
                    Log.w(TAG, "query: more than $MAX_PRODUCTS products, the rest is ignored")
                    break
                }
                kinds[id] = kind
                ids.add(id)
            }
        } catch (_: Exception) {
            Log.w(TAG, "query: the product list is not valid JSON")
        }
        return ids
    }

    private fun queryProducts(ids: List<String>) {
        if (ids.isEmpty()) return sink.emit(StoreEvents.products(emptyList()))
        withClient(
            fail = { code ->
                productsStale = true
                Log.i(TAG, "products: Google Play billing is not available (${codeName(code)})")
                sink.emit(StoreEvents.products(emptyList()))
            },
            run = { c ->
                c.queryProductDetailsAsync(productParams(ids)) { result, details ->
                    onMain { productsDone(ids, result, details) }
                }
            },
        )
    }

    private fun productsDone(ids: List<String>, result: BillingResult, details: QueryProductDetailsResult) {
        if (result.responseCode != BillingResponseCode.OK) {
            productsStale = true
            Log.w(TAG, "products: ${describe(result)}")
            return sink.emit(StoreEvents.products(emptyList()))
        }
        productsStale = false
        val prices = HashMap<String, String>()
        for (product in details.productDetailsList) {
            val price = offerOf(product)?.formattedPrice
            if (!price.isNullOrBlank()) prices[product.productId] = price
        }
        // Not created or not active in Play Console, or not on offer to this account: not shown.
        for (missing in details.unfetchedProductList) {
            Log.i(TAG, "products: ${missing.productId} cannot be sold (status ${missing.statusCode})")
        }
        sink.emit(StoreEvents.products(ids.mapNotNull { id -> prices[id]?.let { id to it } }))
    }

    /** The plain "buy" offer of a one-time product: Play's backwards-compatible one, else the first that is not a rental or pre-order. */
    private fun offerOf(product: ProductDetails): ProductDetails.OneTimePurchaseOfferDetails? =
        product.oneTimePurchaseOfferDetails
            ?: product.oneTimePurchaseOfferDetailsList?.firstOrNull { it.rentalDetails == null && it.preorderDetails == null }

    private fun productParams(ids: List<String>): QueryProductDetailsParams =
        QueryProductDetailsParams.newBuilder()
            .setProductList(
                ids.map { QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(ProductType.INAPP).build() },
            )
            .build()

    // ───────────────────────── buying ─────────────────────────

    /** Main thread, as the Billing Library demands for launchBillingFlow. */
    private fun launch(c: BillingClient, id: String, result: BillingResult, details: QueryProductDetailsResult) {
        if (buying != id) return
        val host = activity
        if (host == null || !resumed || host.isFinishing) return endBuy(id, "error")
        if (result.responseCode != BillingResponseCode.OK) {
            Log.w(TAG, "buy $id: ${describe(result)}")
            return endBuy(id, stateFor(result.responseCode))
        }
        val product = details.productDetailsList.firstOrNull { it.productId == id }
        val offer = product?.let { offerOf(it) }
        if (product == null || offer == null) {
            Log.w(TAG, "buy $id: Google Play does not offer this product")
            return endBuy(id, "unavailable")
        }
        val item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product)
        offer.offerToken?.let { item.setOfferToken(it) }
        val launched = try {
            c.launchBillingFlow(host, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(item.build())).build())
        } catch (error: Throwable) {
            Log.w(TAG, "buy $id: launchBillingFlow threw ${error.javaClass.simpleName}")
            return endBuy(id, "error")
        }
        if (launched.responseCode != BillingResponseCode.OK) {
            Log.w(TAG, "buy $id: ${describe(launched)}")
            endBuy(id, stateFor(launched.responseCode))
            if (launched.responseCode == BillingResponseCode.ITEM_ALREADY_OWNED) restore()
        }
        // OK: Play's purchase sheet is up; the outcome arrives in onPurchasesUpdated.
    }

    /** Any thread. Also called for purchases that complete outside a flow started here. */
    override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        onMain {
            val id = buying
            when (result.responseCode) {
                BillingResponseCode.OK -> {
                    for (purchase in purchases.orEmpty()) {
                        report(purchase)
                        // The flow started here has its answer. (An update about another product —
                        // a pending payment completing meanwhile — leaves the open flow alone.)
                        if (id != null && id in purchase.products) buying = null
                    }
                    if (id != null && purchases.isNullOrEmpty()) {
                        // "OK" with nothing in it: no token to grant with. The listing will tell.
                        endBuy(id, "error")
                        restore()
                    }
                }
                BillingResponseCode.ITEM_ALREADY_OWNED -> {
                    if (id != null) endBuy(id, "alreadyOwned")
                    restore() // deliver the purchase that is already there, so it can be granted and finished
                }
                else -> {
                    if (result.responseCode != BillingResponseCode.USER_CANCELED) Log.w(TAG, "purchase: ${describe(result)}")
                    if (id != null) endBuy(id, stateFor(result.responseCode))
                }
            }
        }
    }

    private fun endBuy(id: String, state: String) {
        if (buying == id) buying = null
        emitPurchase(id, state)
    }

    private fun emitPurchase(id: String, state: String) = sink.emit(StoreEvents.purchase(id, state))

    // ───────────────────────── what the player owns ─────────────────────────

    private fun remember(purchase: Purchase): Known? {
        val id = purchase.products.firstOrNull() ?: return null
        if (purchase.products.size > 1) Log.w(TAG, "a purchase with ${purchase.products.size} products: only $id is reported")
        val entry = Known(id, purchase.purchaseState == Purchase.PurchaseState.PURCHASED, purchase.isAcknowledged)
        known[purchase.purchaseToken] = entry
        return entry
    }

    /** One purchase → its 'purchase' event. Paid: with the token. Pending: "pending" and nothing else. */
    private fun report(purchase: Purchase) {
        val entry = remember(purchase) ?: return
        when (purchase.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> sink.emit(
                StoreEvents.purchase(entry.productId, "purchased", purchase.purchaseToken, purchase.isAcknowledged, purchase.quantity),
            )
            Purchase.PurchaseState.PENDING -> emitPurchase(entry.productId, "pending")
            else -> Unit
        }
    }

    /** [purchases] is null when Play could not be asked. */
    private fun ownedDone(purchases: List<Purchase>?, result: BillingResult? = null) {
        ownedQueryRunning = false
        if (purchases == null) {
            if (result != null) Log.w(TAG, "owned: ${describe(result)}")
            // Not an answer about ownership: an empty list without "complete" takes nothing away.
            sink.emit(StoreEvents.owned(emptyList(), complete = false))
        } else {
            known.clear()
            val owned = LinkedHashSet<String>()
            val unfinished = ArrayList<Purchase>()
            var entitlementInLimbo = false
            for (purchase in purchases) {
                val entry = remember(purchase) ?: continue
                if (!entry.purchased) {
                    unfinished.add(purchase) // pending: reported as such
                    continue
                }
                val kind = kinds[entry.productId]
                if (entry.acknowledged && kind != Kind.CONSUMABLE) {
                    owned.add(entry.productId)
                } else {
                    // A consumable not consumed yet, or an entitlement not acknowledged yet.
                    unfinished.add(purchase)
                    if (kind != Kind.CONSUMABLE) entitlementInLimbo = true
                }
            }
            // "complete" lets the page drop entitlements that are not listed (refunds). While a paid
            // entitlement is still waiting to be acknowledged the list is not the whole truth yet.
            sink.emit(StoreEvents.owned(owned, complete = !entitlementInLimbo))
            for (purchase in unfinished) report(purchase)
        }
    }

    // ───────────────────────── finishing: consume / acknowledge ─────────────────────────

    private fun finishKnown(token: String, purchase: Known, attempt: Int) {
        val kind = kinds[purchase.productId]
        if (!purchase.purchased || kind == null) {
            // Never finish a payment that is still pending, nor a product the page did not declare.
            finishing.remove(token)
            Log.w(TAG, "finish ${purchase.productId}: refused (${if (kind == null) "kind not declared" else "not paid yet"})")
            return
        }
        if (kind == Kind.ENTITLEMENT && purchase.acknowledged) {
            finishing.remove(token)
            return
        }
        withClient(
            fail = { code -> finishDone(token, purchase, kind, attempt, code, null) },
            run = { c ->
                // On the worker thread. The page has granted the purchase and stored its save, but
                // that write may still be queued: put it on disk before Play is told "delivered".
                if (!saveIsOnDisk()) {
                    onMain {
                        finishing.remove(token)
                        Log.w(TAG, "finish ${purchase.productId}: the save could not be written, the purchase stays open")
                    }
                } else if (kind == Kind.CONSUMABLE) {
                    c.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build()) { result, _ ->
                        onMain { finishDone(token, purchase, kind, attempt, result.responseCode, result) }
                    }
                } else {
                    c.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build()) { result ->
                        onMain { finishDone(token, purchase, kind, attempt, result.responseCode, result) }
                    }
                }
            },
        )
    }

    private fun finishDone(token: String, purchase: Known, kind: Kind, attempt: Int, code: Int, result: BillingResult?) {
        val what = if (kind == Kind.CONSUMABLE) "consume" else "acknowledge"
        when {
            code == BillingResponseCode.OK || code == BillingResponseCode.ITEM_NOT_OWNED -> {
                // ITEM_NOT_OWNED: consumed earlier — the pack can be bought again either way.
                finishing.remove(token)
                if (kind == Kind.CONSUMABLE) known.remove(token) else purchase.acknowledged = true
                Log.i(TAG, "$what ${purchase.productId}: done")
            }
            isTransient(code) && attempt < FINISH_ATTEMPTS -> {
                Log.w(TAG, "$what ${purchase.productId}: ${codeName(code)}, trying again")
                main.postDelayed({ if (!destroyed) finishKnown(token, purchase, attempt + 1) }, FINISH_RETRY_MS shl (attempt - 1))
            }
            else -> {
                // Left unfinished: the next listing (every resume, every start) reports it again
                // and the page asks again. Play refunds a purchase nobody finishes within 3 days.
                finishing.remove(token)
                Log.w(TAG, "$what ${purchase.productId}: gave up (${result?.let { describe(it) } ?: codeName(code)})")
            }
        }
    }

    private fun saveIsOnDisk(): Boolean = try {
        flushSave()
    } catch (_: Throwable) {
        false
    }

    // ───────────────────────── connection ─────────────────────────

    /**
     * Run [run] on the worker thread with a connected client, or [fail] on the main thread with the
     * BillingResponseCode that says why not. Exactly one of the two is called (none after destroy).
     */
    private fun withClient(fail: (Int) -> Unit, run: (BillingClient) -> Unit) {
        if (destroyed) return
        // Once connected, a dropped connection is the library's business (enableAutoServiceReconnection):
        // it reconnects with the next call, or answers that call with an error code. Until the first
        // connection has succeeded the connecting is done here, so the real reason for a failure
        // (BILLING_UNAVAILABLE on a device without Google Play, say) is known at once. BillingClient
        // .isReady is no help for telling the two apart: with auto-reconnection it is always true.
        val usable = client?.takeIf { connectedOnce }
        if (usable != null) return runOnWorker(usable, run, fail)
        val waiter = Waiter(run, fail)
        waiters.add(waiter)
        main.postDelayed({ timeOut(waiter) }, CONNECT_TIMEOUT_MS)
        connect()
    }

    private fun runOnWorker(c: BillingClient, run: (BillingClient) -> Unit, fail: (Int) -> Unit) {
        worker.post {
            if (destroyed) return@post
            try {
                run(c)
            } catch (error: Throwable) {
                Log.w(TAG, "billing call failed: ${error.javaClass.simpleName}")
                onMain { fail(BillingResponseCode.ERROR) }
            }
        }
    }

    private fun timeOut(waiter: Waiter) {
        if (waiter.done || destroyed) return
        waiter.done = true
        waiters.remove(waiter)
        waiter.fail(BillingResponseCode.SERVICE_UNAVAILABLE)
    }

    private fun connect() {
        if (connecting || destroyed) return
        connecting = true
        val attempt = ++connectAttempt
        main.removeCallbacks(reconnect)
        // A connection that never answers must not block later attempts.
        main.postDelayed({ if (connecting && attempt == connectAttempt) connectionDone(attempt, BillingResponseCode.SERVICE_UNAVAILABLE, "no answer", discard = true) }, CONNECT_TIMEOUT_MS)
        worker.post {
            if (destroyed) return@post
            try {
                val c = client ?: newClient().also { client = it }
                c.startConnection(object : BillingClientStateListener {
                    override fun onBillingSetupFinished(result: BillingResult) {
                        onMain { connectionDone(attempt, result.responseCode, result.debugMessage, discard = false) }
                    }

                    // The library reconnects by itself (enableAutoServiceReconnection) with the next call.
                    override fun onBillingServiceDisconnected() = Unit
                })
            } catch (error: Throwable) {
                // Seen on devices where Google Play is missing or broken: treat as "no billing here".
                Log.w(TAG, "connecting to Google Play failed: ${error.javaClass.simpleName}")
                onMain { connectionDone(attempt, BillingResponseCode.BILLING_UNAVAILABLE, "", discard = true) }
            }
        }
    }

    private fun newClient(): BillingClient =
        BillingClient.newBuilder(appContext)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build()

    private fun connectionDone(attempt: Int, code: Int, message: String, discard: Boolean) {
        if (attempt != connectAttempt) {
            // A late answer of an attempt that was given up, or the library reporting a reconnection.
            if (code == BillingResponseCode.OK && !connecting) connected()
            return
        }
        if (!connecting && code != BillingResponseCode.OK) return
        connecting = false
        if (code == BillingResponseCode.OK) return connected()

        connectFailures++
        Log.i(TAG, "Google Play billing is not available: ${codeName(code)}${if (message.isBlank()) "" else " ($message)"}")
        if (discard) {
            // Start the next attempt with a fresh client.
            val old = client
            client = null
            connectedOnce = false
            worker.post {
                try {
                    old?.endConnection()
                } catch (_: Throwable) {
                }
            }
        }
        val pending = waiters.toList()
        waiters.clear()
        for (waiter in pending) {
            if (waiter.done) continue
            waiter.done = true
            waiter.fail(code)
        }
        // A failure that may pass is retried with growing pauses while the app is on screen. "Billing
        // unavailable" (no Play Store, unsupported country, …) is only retried by the next request.
        if (isTransient(code) && connectFailures <= MAX_AUTO_RECONNECTS && resumed) {
            main.postDelayed(reconnect, (RECONNECT_BASE_MS shl (connectFailures - 1)).coerceAtMost(RECONNECT_MAX_MS))
        }
    }

    private fun connected() {
        connectFailures = 0
        val c = client
        connectedOnce = c != null
        val pending = waiters.toList()
        waiters.clear()
        for (waiter in pending) {
            if (waiter.done) continue
            waiter.done = true
            if (c != null) runOnWorker(c, waiter.run, waiter.fail) else waiter.fail(BillingResponseCode.SERVICE_DISCONNECTED)
        }
        // Play has just become reachable: give the page the prices it could not get earlier, and —
        // as Play asks for after every new connection — what the player owns (unless one of the
        // requests that were waiting is that very listing).
        if (productsStale && lastQuery.isNotEmpty()) queryProducts(lastQuery)
        restore()
    }

    // ───────────────────────── helpers ─────────────────────────

    private fun onMain(action: () -> Unit) {
        main.post {
            if (destroyed) return@post
            try {
                action()
            } catch (error: Throwable) {
                Log.w(TAG, "billing callback failed: ${error.javaClass.simpleName}")
            }
        }
    }

    /** The StoreEvent purchase state for a failed purchase attempt. */
    private fun stateFor(code: Int): String = when (code) {
        BillingResponseCode.USER_CANCELED -> "cancelled"
        BillingResponseCode.ITEM_ALREADY_OWNED -> "alreadyOwned"
        // Not possible on this device, account or product — trying again will not help.
        BillingResponseCode.BILLING_UNAVAILABLE,
        BillingResponseCode.ITEM_UNAVAILABLE,
        BillingResponseCode.FEATURE_NOT_SUPPORTED,
        BillingResponseCode.DEVELOPER_ERROR,
        -> "unavailable"
        // Network, service or unknown trouble — trying again may help.
        else -> "error"
    }

    private fun isTransient(code: Int): Boolean = when (code) {
        LEGACY_SERVICE_TIMEOUT,
        BillingResponseCode.SERVICE_DISCONNECTED,
        BillingResponseCode.SERVICE_UNAVAILABLE,
        BillingResponseCode.NETWORK_ERROR,
        BillingResponseCode.ERROR,
        -> true
        else -> false
    }

    private fun describe(result: BillingResult): String =
        codeName(result.responseCode) + if (result.debugMessage.isNullOrBlank()) "" else " (${result.debugMessage})"

    private fun codeName(code: Int): String = when (code) {
        LEGACY_SERVICE_TIMEOUT -> "SERVICE_TIMEOUT"
        BillingResponseCode.FEATURE_NOT_SUPPORTED -> "FEATURE_NOT_SUPPORTED"
        BillingResponseCode.SERVICE_DISCONNECTED -> "SERVICE_DISCONNECTED"
        BillingResponseCode.OK -> "OK"
        BillingResponseCode.USER_CANCELED -> "USER_CANCELED"
        BillingResponseCode.SERVICE_UNAVAILABLE -> "SERVICE_UNAVAILABLE"
        BillingResponseCode.BILLING_UNAVAILABLE -> "BILLING_UNAVAILABLE"
        BillingResponseCode.ITEM_UNAVAILABLE -> "ITEM_UNAVAILABLE"
        BillingResponseCode.DEVELOPER_ERROR -> "DEVELOPER_ERROR"
        BillingResponseCode.ERROR -> "ERROR"
        BillingResponseCode.ITEM_ALREADY_OWNED -> "ITEM_ALREADY_OWNED"
        BillingResponseCode.ITEM_NOT_OWNED -> "ITEM_NOT_OWNED"
        BillingResponseCode.NETWORK_ERROR -> "NETWORK_ERROR"
        else -> "code $code"
    }

    private companion object {
        const val TAG = "ZumurudStore"
        val PRODUCT_ID = Regex("[a-z0-9][a-z0-9_.]{0,99}")
        val PURCHASES_PARAMS: QueryPurchasesParams = QueryPurchasesParams.newBuilder().setProductType(ProductType.INAPP).build()

        /** BillingResponseCode.SERVICE_TIMEOUT: deprecated in the library, but older Play Store versions still send it. */
        const val LEGACY_SERVICE_TIMEOUT = -3

        const val MAX_PRODUCTS = 20
        const val CONNECT_TIMEOUT_MS = 30_000L
        const val RECONNECT_BASE_MS = 2_000L
        const val RECONNECT_MAX_MS = 300_000L
        const val MAX_AUTO_RECONNECTS = 8
        const val STALE_BUY_MS = 60_000L
        const val FINISH_ATTEMPTS = 3
        const val FINISH_RETRY_MS = 3_000L
    }
}
