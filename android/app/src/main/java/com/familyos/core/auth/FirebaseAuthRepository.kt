package com.familyos.core.auth

import com.familyos.core.database.LocalUserProfileEntity
import com.familyos.core.database.UserProfileDao
import com.familyos.core.domain.AccountStatus
import com.familyos.core.domain.AuthProvider
import com.familyos.core.domain.AuthRepository
import com.familyos.core.domain.UserAccount
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

/**
 * Production Firebase Authentication Adapter.
 * Manages Google Sign-In and Email/Password flows without storing passwords in Room.
 * If Firebase is not yet provisioned with google-services.json, methods fail with
 * an explicit UnconfiguredFirebaseException rather than fake login.
 */
class FirebaseAuthRepositoryImpl(
    private val firebaseAuth: FirebaseAuth?,
    private val userProfileDao: UserProfileDao,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : AuthRepository {

    private fun resolveAuthProvider(firebaseUser: FirebaseUser): AuthProvider {
        val isGoogleUser = firebaseUser.providerData.any { profile ->
            profile.providerId == GoogleAuthProvider.PROVIDER_ID ||
                profile.providerId.equals("google.com", ignoreCase = true)
        }
        return if (isGoogleUser) {
            AuthProvider.FIREBASE_GOOGLE
        } else {
            AuthProvider.FIREBASE_EMAIL
        }
    }

    override fun observeAuthState(): Flow<UserAccount?> = callbackFlow {
        val auth = firebaseAuth
        if (auth == null) {
            trySend(null)
            close()
            return@callbackFlow
        }

        val listener = FirebaseAuth.AuthStateListener { currentAuth ->
            val firebaseUser = currentAuth.currentUser
            if (firebaseUser != null) {
                val authProvider = resolveAuthProvider(firebaseUser)
                trySend(
                    UserAccount(
                        id = firebaseUser.uid,
                        authenticationProvider = authProvider,
                        providerUserId = firebaseUser.uid,
                        email = firebaseUser.email ?: "",
                        displayName = firebaseUser.displayName,
                        profilePictureUri = firebaseUser.photoUrl?.toString(),
                        preferredLanguage = "en",
                        accountStatus = AccountStatus.ACTIVE,
                        createdAt = firebaseUser.metadata?.creationTimestamp ?: System.currentTimeMillis(),
                        updatedAt = System.currentTimeMillis(),
                        isEmailVerified = firebaseUser.isEmailVerified
                    )
                )
            } else {
                trySend(null)
            }
        }

        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    override suspend fun signInWithEmail(email: String, password: String): Result<UserAccount> = withContext(ioDispatcher) {
        val auth = firebaseAuth ?: return@withContext Result.failure(
            IllegalStateException("Firebase Auth is not configured. Please supply google-services.json.")
        )
        try {
            val result = auth.signInWithEmailAndPassword(email.trim(), password).await()
            val user = result.user ?: throw IllegalStateException("Firebase returned null user upon sign-in")
            val domainUser = UserAccount(
                id = user.uid,
                authenticationProvider = AuthProvider.FIREBASE_EMAIL,
                providerUserId = user.uid,
                email = user.email ?: "",
                displayName = user.displayName,
                profilePictureUri = user.photoUrl?.toString(),
                preferredLanguage = "en",
                accountStatus = AccountStatus.ACTIVE,
                createdAt = user.metadata?.creationTimestamp ?: System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis(),
                isEmailVerified = user.isEmailVerified
            )
            // Persist profile metadata locally (NO passwords stored)
            userProfileDao.insertOrUpdateUserProfile(
                LocalUserProfileEntity(
                    id = domainUser.id,
                    authenticationProvider = "FIREBASE_EMAIL",
                    providerUserId = domainUser.providerUserId,
                    email = domainUser.email,
                    displayName = domainUser.displayName,
                    profilePictureUri = domainUser.profilePictureUri
                )
            )
            Result.success(domainUser)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun registerWithEmail(email: String, password: String): Result<UserAccount> = withContext(ioDispatcher) {
        val auth = firebaseAuth ?: return@withContext Result.failure(
            IllegalStateException("Firebase Auth is not configured. Please supply google-services.json.")
        )
        try {
            val result = auth.createUserWithEmailAndPassword(email.trim(), password).await()
            val user = result.user ?: throw IllegalStateException("Firebase returned null user upon registration")
            val domainUser = UserAccount(
                id = user.uid,
                authenticationProvider = AuthProvider.FIREBASE_EMAIL,
                providerUserId = user.uid,
                email = user.email ?: "",
                displayName = user.displayName,
                profilePictureUri = user.photoUrl?.toString(),
                preferredLanguage = "en",
                accountStatus = AccountStatus.ACTIVE,
                createdAt = user.metadata?.creationTimestamp ?: System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis(),
                isEmailVerified = user.isEmailVerified
            )
            userProfileDao.insertOrUpdateUserProfile(
                LocalUserProfileEntity(
                    id = domainUser.id,
                    authenticationProvider = "FIREBASE_EMAIL",
                    providerUserId = domainUser.providerUserId,
                    email = domainUser.email,
                    displayName = domainUser.displayName,
                    profilePictureUri = domainUser.profilePictureUri
                )
            )
            Result.success(domainUser)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signInWithGoogle(idToken: String): Result<UserAccount> = withContext(ioDispatcher) {
        val auth = firebaseAuth ?: return@withContext Result.failure(
            IllegalStateException("Firebase Auth is not configured. Please supply google-services.json.")
        )
        try {
            val credential = GoogleAuthProvider.getCredential(idToken, null)
            val result = auth.signInWithCredential(credential).await()
            val user = result.user ?: throw IllegalStateException("Firebase returned null user upon Google sign-in")
            val domainUser = UserAccount(
                id = user.uid,
                authenticationProvider = AuthProvider.FIREBASE_GOOGLE,
                providerUserId = user.uid,
                email = user.email ?: "",
                displayName = user.displayName,
                profilePictureUri = user.photoUrl?.toString(),
                preferredLanguage = "en",
                accountStatus = AccountStatus.ACTIVE,
                createdAt = user.metadata?.creationTimestamp ?: System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis(),
                isEmailVerified = user.isEmailVerified
            )
            userProfileDao.insertOrUpdateUserProfile(
                LocalUserProfileEntity(
                    id = domainUser.id,
                    authenticationProvider = "FIREBASE_GOOGLE",
                    providerUserId = domainUser.providerUserId,
                    email = domainUser.email,
                    displayName = domainUser.displayName,
                    profilePictureUri = domainUser.profilePictureUri
                )
            )
            Result.success(domainUser)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun signOut(): Result<Unit> = withContext(ioDispatcher) {
        try {
            firebaseAuth?.signOut()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getCurrentUser(): UserAccount? = withContext(ioDispatcher) {
        val firebaseUser = firebaseAuth?.currentUser ?: return@withContext null
        val authProvider = resolveAuthProvider(firebaseUser)
        UserAccount(
            id = firebaseUser.uid,
            authenticationProvider = authProvider,
            providerUserId = firebaseUser.uid,
            email = firebaseUser.email ?: "",
            displayName = firebaseUser.displayName,
            profilePictureUri = firebaseUser.photoUrl?.toString(),
            preferredLanguage = "en",
            accountStatus = AccountStatus.ACTIVE,
            createdAt = firebaseUser.metadata?.creationTimestamp ?: System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis(),
            isEmailVerified = firebaseUser.isEmailVerified
        )
    }

    override suspend fun isEmailVerified(): Boolean = withContext(ioDispatcher) {
        val user = firebaseAuth?.currentUser ?: return@withContext false
        try {
            user.reload().await()
            user.isEmailVerified
        } catch (_: Exception) {
            user.isEmailVerified
        }
    }

    override suspend fun sendEmailVerification(): Result<Unit> = withContext(ioDispatcher) {
        val auth = firebaseAuth ?: return@withContext Result.failure(
            IllegalStateException("Firebase Auth is not configured. Please supply google-services.json.")
        )
        try {
            val user = auth.currentUser ?: throw IllegalStateException("No authenticated user to verify.")
            user.sendEmailVerification().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
