package com.familyos

import android.app.Application
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.familyos.core.data.*
import com.familyos.core.database.FamilyOSDatabase
import com.familyos.core.database.FamilySectionRepository
import com.familyos.core.database.FamilySectionRepositoryImpl
import com.familyos.core.database.SearchRepository
import com.familyos.core.database.SearchRepositoryImpl
import com.familyos.core.domain.*
import com.familyos.core.sync.HttpRemoteSyncGateway
import com.familyos.core.sync.SyncRepositoryImpl
import com.familyos.core.sync.SyncWorker

/**
 * Main Application class for FamilyOS.
 * Initializes the SQLCipher-encrypted Room database, domain repositories,
 * EncryptedSharedPreferences (AES256_GCM MasterKey) for sync credentials,
 * and background SyncWorker.
 */
class FamilyOSApplication : Application() {

    companion object {
        const val ENCRYPTED_SYNC_PREFS_NAME = "familyos_encrypted_sync_config"
        const val KEY_BACKEND_BASE_URL = "backend_base_url"
        const val KEY_AUTH_BEARER_TOKEN = "auth_bearer_token"
    }

    lateinit var database: FamilyOSDatabase
        private set

    lateinit var encryptedSyncPrefs: SharedPreferences
        private set

    lateinit var syncRepository: SyncRepository
        private set

    lateinit var workspaceRepository: FamilyWorkspaceRepository
        private set

    lateinit var memberRepository: FamilyMemberRepository
        private set

    lateinit var relationshipRepository: FamilyRelationshipRepository
        private set

    lateinit var goalsRepository: GoalsAndTasksRepository
        private set

    lateinit var recipeRepository: RecipeRepository
        private set

    lateinit var mealPlannerRepository: MealPlannerRepository
        private set

    lateinit var groceryRepository: GroceryListRepository
        private set

    lateinit var choresRepository: ChoresRepository
        private set

    lateinit var assetsRepository: HomeAssetsRepository
        private set

    lateinit var calendarRepository: CalendarRepository
        private set

    lateinit var financeRepository: FinanceRepository
        private set

    lateinit var wellbeingRepository: WellbeingRepository
        private set

    lateinit var emergencyRepository: EmergencyRepository
        private set

    lateinit var routineRepository: RoutineRepository
        private set

    lateinit var householdRepository: HouseholdRepository
        private set

    lateinit var familySectionRepository: FamilySectionRepository
        private set

    lateinit var searchRepository: SearchRepository
        private set

    lateinit var authRepository: AuthRepository
        private set

    override fun onCreate() {
        super.onCreate()
        database = FamilyOSDatabase.getInstance(this, useEncryption = true)

        val masterKey = MasterKey.Builder(applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        encryptedSyncPrefs = EncryptedSharedPreferences.create(
            applicationContext,
            ENCRYPTED_SYNC_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        val gateway = HttpRemoteSyncGateway(
            endpointUrlProvider = {
                encryptedSyncPrefs.getString(KEY_BACKEND_BASE_URL, null)
            },
            authTokenProvider = {
                encryptedSyncPrefs.getString(KEY_AUTH_BEARER_TOKEN, null)
            }
        )
        syncRepository = SyncRepositoryImpl(
            syncQueueDao = database.syncQueueDao(),
            remoteGateway = gateway
        )

        workspaceRepository = FamilyWorkspaceRepositoryImpl(database.familyWorkspaceDao())
        memberRepository = FamilyMemberRepositoryImpl(database.familyMemberDao())
        relationshipRepository = FamilyRelationshipRepositoryImpl(database.familyRelationshipDao())
        goalsRepository = GoalsAndTasksRepositoryImpl(database.goalsAndTasksDao())
        recipeRepository = RecipeRepositoryImpl(database.recipesDao())
        mealPlannerRepository = MealPlannerRepositoryImpl(
            mealDao = database.mealPlannerDao(),
            groceryDao = database.groceryListDao(),
            recipeDao = database.recipesDao()
        )
        groceryRepository = GroceryListRepositoryImpl(database.groceryListDao())
        choresRepository = ChoresRepositoryImpl(database.choresDao())
        assetsRepository = HomeAssetsRepositoryImpl(database.homeAssetsDao())
        calendarRepository = CalendarRepositoryImpl(database.calendarDao())
        financeRepository = FinanceRepositoryImpl(database.financeDao())
        wellbeingRepository = WellbeingRepositoryImpl(database.wellbeingDao())
        emergencyRepository = EmergencyRepositoryImpl(database.emergencyDao())
        routineRepository = RoutineRepositoryImpl(database.routineDao())
        householdRepository = HouseholdRepositoryImpl(
            pantryDao = database.pantryDao(),
            wardrobeDao = database.wardrobeDao(),
            outfitDao = database.outfitDao()
        )
        familySectionRepository = FamilySectionRepositoryImpl(database.familySectionDao())
        searchRepository = SearchRepositoryImpl(database.searchDao())
        authRepository = com.familyos.core.auth.FirebaseAuthRepositoryImpl(
            try { com.google.firebase.auth.FirebaseAuth.getInstance() } catch (_: Exception) { null },
            database.userProfileDao()
        )

        try {
            SyncWorker.schedulePeriodicSync(this)
        } catch (_: Exception) {
            // WorkManager may not be initialized in unit test environments
        }
    }

    fun updateEncryptedSyncConfig(backendBaseUrl: String?, authBearerToken: String?) {
        encryptedSyncPrefs.edit().apply {
            if (backendBaseUrl != null) putString(KEY_BACKEND_BASE_URL, backendBaseUrl.trim())
            if (authBearerToken != null) putString(KEY_AUTH_BEARER_TOKEN, authBearerToken.trim())
            apply()
        }
    }
}

