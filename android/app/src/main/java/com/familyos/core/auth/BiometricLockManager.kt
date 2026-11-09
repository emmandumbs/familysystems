package com.familyos.core.auth

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Production Biometric Lock Manager for FamilyOS Android (AUTH-05).
 * Encapsulates AndroidX BiometricPrompt for cryptographic/biometric app unlock,
 * supporting fingerprint, facial recognition, and device credential fallback.
 */
class BiometricLockManager(
    private val context: Context
) {

    private val biometricManager = BiometricManager.from(context)

    private val _isUnlocked = MutableStateFlow(false)
    val isUnlocked: StateFlow<Boolean> = _isUnlocked.asStateFlow()

    enum class BiometricAvailability {
        AVAILABLE,
        NONE_ENROLLED,
        NO_HARDWARE,
        HARDWARE_UNAVAILABLE,
        SECURITY_UPDATE_REQUIRED,
        UNSUPPORTED
    }

    /**
     * Checks if biometric authentication can be performed on this device.
     */
    fun checkBiometricAvailability(): BiometricAvailability {
        val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        return when (biometricManager.canAuthenticate(authenticators)) {
            BiometricManager.BIOMETRIC_SUCCESS -> BiometricAvailability.AVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> BiometricAvailability.NONE_ENROLLED
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> BiometricAvailability.NO_HARDWARE
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> BiometricAvailability.HARDWARE_UNAVAILABLE
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> BiometricAvailability.SECURITY_UPDATE_REQUIRED
            else -> BiometricAvailability.UNSUPPORTED
        }
    }

    /**
     * Determines whether biometric authentication is ready to prompt.
     */
    fun isBiometricReady(): Boolean {
        return checkBiometricAvailability() == BiometricAvailability.AVAILABLE
    }

    /**
     * Creates standard PromptInfo for FamilyOS biometric unlock.
     */
    fun createPromptInfo(
        title: String = "FamilyOS Biometric Unlock",
        subtitle: String = "Verify your identity to access family data",
        negativeButtonText: String? = null
    ): BiometricPrompt.PromptInfo {
        val builder = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)

        if (negativeButtonText != null) {
            builder.setNegativeButtonText(negativeButtonText)
            builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        } else {
            builder.setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
        }

        return builder.build()
    }

    /**
     * Launches the biometric prompt on the supplied FragmentActivity using coroutines.
     * Returns Result.success(true) when authenticated, or Result.failure on error/cancel.
     */
    suspend fun authenticate(
        activity: FragmentActivity,
        promptInfo: BiometricPrompt.PromptInfo = createPromptInfo()
    ): Result<Boolean> = suspendCancellableCoroutine { continuation ->
        val executor = ContextCompat.getMainExecutor(activity)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                _isUnlocked.value = true
                if (continuation.isActive) {
                    continuation.resume(Result.success(true))
                }
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                if (continuation.isActive) {
                    continuation.resume(Result.failure(BiometricAuthenticationException(errorCode, errString.toString())))
                }
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                // Do not resume yet: user can retry until max attempts reached or dismissed
            }
        }

        val prompt = BiometricPrompt(activity, executor, callback)
        prompt.authenticate(promptInfo)

        continuation.invokeOnCancellation {
            prompt.cancelAuthentication()
        }
    }

    /**
     * Locks the app session immediately.
     */
    fun lock() {
        _isUnlocked.value = false
    }

    /**
     * Marks the session as unlocked programmatically (e.g. after password fallback).
     */
    fun unlockManually() {
        _isUnlocked.value = true
    }
}

class BiometricAuthenticationException(
    val errorCode: Int,
    override val message: String
) : Exception("Biometric prompt error ($errorCode): $message")
