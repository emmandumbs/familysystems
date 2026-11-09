package com.familyos.core.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * FamilyOS Google Play Billing 7.1.1 Manager (Master Stage 4: COMM-01)
 *
 * Implements Google Play Billing subscription management, server-side purchase token
 * verification, local cached entitlement synchronization, and "Restore Purchases" workflow.
 *
 * COMMERCIAL INVARIANT: Emergency contacts, core safety directories, and local data export
 * are ALWAYS accessible on the FREE tier and never locked behind paywalls.
 */

enum class SubscriptionTier {
    FREE,
    INDIVIDUAL,
    FAMILY
}

data class FamilyOSEntitlements(
    val tier: SubscriptionTier = SubscriptionTier.FREE,
    val isFamilyPlan: Boolean = false,
    val maxMembers: Int = 2,
    val aiMealPlanningEnabled: Boolean = false,
    val aiGoalBreakdownEnabled: Boolean = false,
    val advancedInvestmentTracking: Boolean = false,
    // Universal Free Protections (Never Paywalled)
    val offlineEmergencyPacket: Boolean = true,
    val fullDataExport: Boolean = true,
    val expirationEpoch: Long = Long.MAX_VALUE
)

class BillingManager(
    private val context: Context,
    private val scope: CoroutineScope,
    private val apiBaseUrl: String = "http://10.0.2.2:3000"
) : PurchasesUpdatedListener {

    private val _entitlements = MutableStateFlow(FamilyOSEntitlements())
    val entitlements: StateFlow<FamilyOSEntitlements> = _entitlements.asStateFlow()

    private val _productDetailsList = MutableStateFlow<List<ProductDetails>>(emptyList())
    val productDetailsList: StateFlow<List<ProductDetails>> = _productDetailsList.asStateFlow()

    private val _billingConnected = MutableStateFlow(false)
    val billingConnected: StateFlow<Boolean> = _billingConnected.asStateFlow()

    private val billingClient: BillingClient = BillingClient.newBuilder(context)
        .setListener(this)
        .enablePendingPurchases()
        .build()

    companion object {
        const val PRODUCT_FAMILY_ANNUAL = "familyos_premium_family_annual"
        const val PRODUCT_FAMILY_MONTHLY = "familyos_premium_family_monthly"
        const val PRODUCT_INDIVIDUAL_MONTHLY = "familyos_premium_individual_monthly"
    }

    init {
        startBillingConnection()
    }

    private fun startBillingConnection() {
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    _billingConnected.value = true
                    queryAvailableProducts()
                    queryActivePurchases()
                } else {
                    _billingConnected.value = false
                }
            }

            override fun onBillingServiceDisconnected() {
                _billingConnected.value = false
            }
        })
    }

    private fun queryAvailableProducts() {
        val productList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_FAMILY_ANNUAL)
                .setProductType(BillingClient.ProductType.SUBS)
                .build(),
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_FAMILY_MONTHLY)
                .setProductType(BillingClient.ProductType.SUBS)
                .build(),
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_INDIVIDUAL_MONTHLY)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        )

        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        billingClient.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                _productDetailsList.value = productDetailsList
            }
        }
    }

    override fun onPurchasesUpdated(billingResult: BillingResult, purchases: MutableList<Purchase>?) {
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (purchase in purchases) {
                scope.launch(Dispatchers.IO) {
                    handlePurchaseVerification(purchase)
                }
            }
        }
    }

    fun launchPurchaseFlow(activity: Activity, productDetails: ProductDetails, offerToken: String) {
        val productDetailsParamsList = listOf(
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(productDetails)
                .setOfferToken(offerToken)
                .build()
        )

        val billingFlowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(productDetailsParamsList)
            .build()

        billingClient.launchBillingFlow(activity, billingFlowParams)
    }

    /**
     * Restore Purchases action: Queries Play Store active subscriptions and re-verifies them.
     */
    fun restorePurchases(familyId: String, onComplete: (Boolean, String) -> Unit) {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()

        billingClient.queryPurchasesAsync(params) { billingResult, purchases ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases.isNotEmpty()) {
                scope.launch(Dispatchers.IO) {
                    var restoredAny = false
                    for (purchase in purchases) {
                        val verified = verifyPurchaseWithBackend(purchase, familyId)
                        if (verified) restoredAny = true
                    }
                    scope.launch(Dispatchers.Main) {
                        if (restoredAny) {
                            onComplete(true, "Purchases restored successfully.")
                        } else {
                            onComplete(false, "No active subscriptions found to restore.")
                        }
                    }
                }
            } else {
                onComplete(false, "No active Google Play subscriptions found.")
            }
        }
    }

    private fun queryActivePurchases() {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()

        billingClient.queryPurchasesAsync(params) { billingResult, purchases ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases.isNotEmpty()) {
                for (p in purchases) {
                    scope.launch(Dispatchers.IO) {
                        handlePurchaseVerification(p)
                    }
                }
            }
        }
    }

    private suspend fun handlePurchaseVerification(purchase: Purchase) {
        verifyPurchaseWithBackend(purchase, "")
    }

    private fun verifyPurchaseWithBackend(purchase: Purchase, targetFamilyId: String): Boolean {
        return try {
            val url = URL("$apiBaseUrl/api/v1/billing/verify-purchase")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true

            val productId = purchase.products.firstOrNull() ?: PRODUCT_FAMILY_MONTHLY
            val isFamily = productId.contains("family")

            val jsonBody = JSONObject().apply {
                put("familyId", targetFamilyId.ifEmpty { "default_workspace" })
                put("purchaseToken", purchase.purchaseToken)
                put("productId", productId)
                put("orderId", purchase.orderId ?: "GPA.mock.000")
                put("packageName", context.packageName)
            }

            OutputStreamWriter(conn.outputStream).use { it.write(jsonBody.toString()) }

            if (conn.responseCode == 200) {
                _entitlements.value = FamilyOSEntitlements(
                    tier = if (isFamily) SubscriptionTier.FAMILY else SubscriptionTier.INDIVIDUAL,
                    isFamilyPlan = isFamily,
                    maxMembers = if (isFamily) 12 else 1,
                    aiMealPlanningEnabled = true,
                    aiGoalBreakdownEnabled = true,
                    advancedInvestmentTracking = true,
                    offlineEmergencyPacket = true, // Permanent invariant
                    fullDataExport = true           // Permanent invariant
                )
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }
}
