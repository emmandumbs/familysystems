package com.familyos.core.database

import android.content.Context
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.sqlite.db.SupportSQLiteOpenHelper
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory
import java.security.SecureRandom

/**
 * Manages the 256-bit SQLCipher database encryption key backed by the Android Hardware Keystore.
 */
object DatabaseKeyManager {
    private const val PREFS_FILE_NAME = "familyos_secure_db_prefs"
    private const val KEY_DB_PASSPHRASE = "sqlcipher_db_passphrase_v1"
    private const val PASSPHRASE_LENGTH_BYTES = 32 // 256-bit key

    /**
     * Builds the SQLCipher SupportOpenHelperFactory using a hardware-backed MasterKey.
     * When [useEncryption] is true in non-test builds, any failure to load sqlcipher or initialize
     * the Android Keystore MasterKey throws a fatal [IllegalStateException] instead of silently
     * falling back to an unencrypted SQLite database.
     */
    fun createEncryptedOpenHelperFactory(
        context: Context,
        useEncryption: Boolean = true
    ): SupportSQLiteOpenHelper.Factory? {
        if (!useEncryption) {
            return null
        }
        return try {
            System.loadLibrary("sqlcipher")
            val passphrase = getOrCreatePassphrase(context)
            SupportOpenHelperFactory(passphrase)
        } catch (e: Throwable) {
            throw IllegalStateException(
                "CRITICAL_SECURITY_FAILURE: Failed to load sqlcipher or initialize Android Keystore MasterKey while useEncryption=true. Refusing to fall back to an unencrypted SQLite database.",
                e
            )
        }
    }

    private fun getOrCreatePassphrase(context: Context): ByteArray {
        val masterKey = MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        val sharedPreferences = EncryptedSharedPreferences.create(
            context.applicationContext,
            PREFS_FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        val existingEncoded = sharedPreferences.getString(KEY_DB_PASSPHRASE, null)
        if (!existingEncoded.isNullOrBlank()) {
            return Base64.decode(existingEncoded, Base64.NO_WRAP)
        }

        val newPassphrase = ByteArray(PASSPHRASE_LENGTH_BYTES)
        SecureRandom().nextBytes(newPassphrase)
        val encoded = Base64.encodeToString(newPassphrase, Base64.NO_WRAP)
        sharedPreferences.edit().putString(KEY_DB_PASSPHRASE, encoded).apply()
        return newPassphrase
    }
}
