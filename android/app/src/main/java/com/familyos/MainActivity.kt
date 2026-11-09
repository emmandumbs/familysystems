package com.familyos

import android.Manifest
import android.app.AlarmManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import com.familyos.core.auth.BiometricLockManager
import com.familyos.core.database.*
import com.familyos.core.designsystem.*
import com.familyos.core.domain.*
import com.familyos.core.navigation.DeepLinkResult
import com.familyos.core.navigation.FamilyOSAppShell
import com.familyos.core.navigation.FamilyOSDestination
import com.familyos.core.navigation.RecipeDeepLinkParser
import com.familyos.core.security.FamilySecurityPolicy
import com.familyos.core.viewmodel.FamilyOSViewModel
import com.familyos.feature.assets.HomeAssetsScreen
import com.familyos.feature.calendar.CalendarScreen
import com.familyos.feature.chores.ChoresScreen
import com.familyos.feature.dashboard.DashboardScreen
import com.familyos.feature.family.FamilyTreeScreen
import com.familyos.feature.finance.FinanceScreen
import com.familyos.feature.goals.GoalsScreen
import com.familyos.feature.meals.MealPlannerScreen
import com.familyos.feature.pantry.PantryScreen
import com.familyos.feature.recipes.RecipeLibraryScreen
import com.familyos.feature.safety.EmergencyScreen
import com.familyos.feature.auth.AuthScreen
import com.familyos.feature.wardrobe.WardrobeScreen
import com.familyos.feature.wellbeing.WellbeingScreen
import kotlinx.coroutines.launch
import java.util.UUID

class MainActivity : FragmentActivity() {

    private val viewModel: FamilyOSViewModel by viewModels()
    private lateinit var biometricLockManager: BiometricLockManager

    private var currentDestination by mutableStateOf(FamilyOSDestination.OVERVIEW)
    // Household Hub sub-navigation: 0 = Meal Planner, 1 = Recipe Library, 2 = Food Pantry, 3 = Wardrobe & Outfits, 4 = Chores & Points, 5 = Home Assets
    private var householdSubTab by mutableStateOf(0)
    // Family Hub sub-navigation: 0 = Directory & Tree, 1 = Heritage Map, 2 = Gallery, 3 = Constitution, 4 = Traditions, 5 = Shared Activities, 6 = Family Rules
    private var familySubTab by mutableStateOf(0)
    private var deepLinkedRecipeId by mutableStateOf<String?>(null)
    private var biometricLockEnabled by mutableStateOf(false)
    private var canScheduleExactAlarmsState by mutableStateOf(true)
    private var pendingNotificationAction: (() -> Unit)? = null

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        pendingNotificationAction?.invoke()
        pendingNotificationAction = null
    }

    private fun refreshExactAlarmCapability() {
        canScheduleExactAlarmsState = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = getSystemService(AlarmManager::class.java)
            alarmManager?.canScheduleExactAlarms() ?: true
        } else {
            true
        }
    }

    private fun openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = getSystemService(AlarmManager::class.java)
            if (alarmManager == null || !alarmManager.canScheduleExactAlarms()) {
                val intent = Intent(
                    Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:$packageName")
                )
                startActivity(intent)
            }
        }
    }

    private fun ensureNotificationPermissionThenSchedule(action: () -> Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                pendingNotificationAction = action
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                return
            }
        }
        action()
    }

    private fun triggerBiometricPromptIfLocked() {
        if (biometricLockEnabled && !biometricLockManager.isUnlocked.value) {
            if (biometricLockManager.isBiometricReady()) {
                lifecycleScope.launch {
                    biometricLockManager.authenticate(this@MainActivity)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        refreshExactAlarmCapability()

        biometricLockManager = BiometricLockManager(this)
        val app = application as FamilyOSApplication
        biometricLockEnabled = app.encryptedSyncPrefs.getBoolean("biometric_lock_enabled", false)
        if (!biometricLockEnabled) {
            biometricLockManager.unlockManually()
        } else {
            biometricLockManager.lock()
            triggerBiometricPromptIfLocked()
        }

        val initialDeepLink = parseDeepLink(intent)
        if (initialDeepLink is DeepLinkResult.RecipeDetail) {
            deepLinkedRecipeId = initialDeepLink.recipeId
            currentDestination = FamilyOSDestination.HOUSEHOLD
            householdSubTab = 1
        }

        setContent {
            FamilyOSTheme {
                val activeWorkspace by viewModel.activeWorkspace.collectAsState()
                val pendingSyncCount by viewModel.pendingSyncCount.collectAsState()
                val members by viewModel.members.collectAsState()
                val relationships by viewModel.relationships.collectAsState()
                val goals by viewModel.goals.collectAsState()
                val projects by viewModel.projects.collectAsState()
                val tasks by viewModel.tasks.collectAsState()
                val taskChecklistItems by viewModel.taskChecklistItems.collectAsState()
                val recipes by viewModel.recipes.collectAsState()
                val mealPlans by viewModel.mealPlans.collectAsState()
                val groceryItems by viewModel.groceryItems.collectAsState()
                val chores by viewModel.chores.collectAsState()
                val assets by viewModel.assets.collectAsState()
                val wishlist by viewModel.wishlist.collectAsState()
                val calendarEvents by viewModel.calendarEvents.collectAsState()
                val accounts by viewModel.accounts.collectAsState()
                val budgets by viewModel.budgets.collectAsState()
                val transactions by viewModel.transactions.collectAsState()
                val bills by viewModel.bills.collectAsState()
                val savingsGoals by viewModel.savingsGoals.collectAsState()
                val investmentHoldings by viewModel.investmentHoldings.collectAsState()
                val wellbeingProfiles by viewModel.wellbeingProfiles.collectAsState()
                val allergies by viewModel.allergies.collectAsState()
                val medications by viewModel.medications.collectAsState()
                val vaccinations by viewModel.vaccinations.collectAsState()
                val appointments by viewModel.appointments.collectAsState()
                val emergencyContacts by viewModel.emergencyContacts.collectAsState()
                val emergencyPlan by viewModel.emergencyPlan.collectAsState()
                val emergencySupplies by viewModel.emergencySupplies.collectAsState()
                val emergencyChecklist by viewModel.emergencyChecklist.collectAsState()
                val currentActorMemberId by viewModel.currentActorMemberId.collectAsState()
                val currentActorRole by viewModel.currentActorRole.collectAsState()
                val milestones by viewModel.milestones.collectAsState()
                val checklistTemplates by viewModel.checklistTemplates.collectAsState()
                val rewardConfig by viewModel.rewardConfig.collectAsState()
                val announcements by viewModel.announcements.collectAsState()
                val reminders by viewModel.reminders.collectAsState()
                val approvedAiSuggestions by viewModel.approvedAiSuggestions.collectAsState()
                val invitations by viewModel.invitations.collectAsState()
                val recentAudits by viewModel.recentAudits.collectAsState()
                val routines by viewModel.routines.collectAsState()
                val routineOccurrences by viewModel.routineOccurrences.collectAsState()
                val pantryItems by viewModel.pantryItems.collectAsState()
                val wardrobeItems by viewModel.wardrobeItems.collectAsState()
                val outfitPlans by viewModel.outfitPlans.collectAsState()
                val galleryAlbums by viewModel.galleryAlbums.collectAsState()
                val galleryPhotos by viewModel.galleryPhotos.collectAsState()
                val constitutionVersions by viewModel.constitutionVersions.collectAsState()
                val traditions by viewModel.traditions.collectAsState()
                val sharedActivities by viewModel.sharedActivities.collectAsState()
                val familyRules by viewModel.familyRules.collectAsState()
                val extendedRelatives by viewModel.extendedRelatives.collectAsState()
                val searchQuery by viewModel.searchQuery.collectAsState()
                val searchResults by viewModel.searchResults.collectAsState()
                val isBiometricUnlocked by biometricLockManager.isUnlocked.collectAsState()

                // Interactive creation dialog & global search modal state
                var activeDialog by remember { mutableStateOf<String?>(null) }
                var dialogMemberIdTarget by remember { mutableStateOf<String?>(null) }
                var memberValidationError by remember { mutableStateOf<String?>(null) }
                var showGlobalSearchModal by remember { mutableStateOf(false) }

                val familyName = activeWorkspace?.name ?: "Family Workspace"
                val syncLabel = if (pendingSyncCount > 0) {
                    "Offline-First • $pendingSyncCount Queued"
                } else {
                    "Encrypted Room DB • Synced"
                }

                if (biometricLockEnabled && !isBiometricUnlocked) {
                    BiometricGateScreen(
                        familyName = familyName,
                        isBiometricHardwareReady = biometricLockManager.isBiometricReady(),
                        onAuthenticate = {
                            if (biometricLockManager.isBiometricReady()) {
                                lifecycleScope.launch {
                                    biometricLockManager.authenticate(this@MainActivity)
                                }
                            } else {
                                biometricLockManager.unlockManually()
                            }
                        },
                        onFallbackPasscodeUnlock = {
                            biometricLockManager.unlockManually()
                        }
                    )
                    return@FamilyOSTheme
                }

                FamilyOSAppShell(
                    currentDestination = currentDestination,
                    onNavigate = { destination ->
                        currentDestination = destination
                    },
                    activeFamilyName = familyName,
                    syncStatusLabel = syncLabel,
                    onOpenSearch = { showGlobalSearchModal = true },
                    onLockSession = if (biometricLockEnabled) {
                        { biometricLockManager.lock() }
                    } else null
                ) {
                    when (currentDestination) {
                        FamilyOSDestination.OVERVIEW -> {
                            DashboardScreen(
                                workspace = activeWorkspace,
                                members = members,
                                actorRole = currentActorRole,
                                calendarEvents = calendarEvents,
                                mealPlans = mealPlans,
                                tasks = tasks,
                                goals = goals,
                                projects = projects,
                                reminders = reminders,
                                announcements = announcements,
                                approvedAiSuggestions = approvedAiSuggestions,
                                recentAudits = recentAudits,
                                onToggleTaskComplete = { taskId, completed ->
                                    viewModel.toggleTaskCompleted(taskId, completed)
                                },
                                onToggleReminder = { reminderId ->
                                    viewModel.toggleReminderCompleted(reminderId)
                                },
                                onAddAnnouncement = { title, body ->
                                    viewModel.postFamilyAnnouncement(title, body, false)
                                },
                                onUpdateIdentity = { name, motto, mission, vision, values ->
                                    viewModel.updateFamilyIdentity(
                                        name = name,
                                        motto = motto,
                                        mission = mission,
                                        vision = vision,
                                        values = values
                                    )
                                },
                                onQuickAction = { action ->
                                    when (action) {
                                        "PLAN_MEAL" -> {
                                            householdSubTab = 0
                                            currentDestination = FamilyOSDestination.HOUSEHOLD
                                        }
                                        "ASSIGN_CHORE" -> {
                                            householdSubTab = 4
                                            currentDestination = FamilyOSDestination.HOUSEHOLD
                                        }
                                        "LOG_EXPENSE" -> currentDestination = FamilyOSDestination.FINANCE
                                        "ADD_MEMBER" -> currentDestination = FamilyOSDestination.FAMILY
                                        "VIEW_CALENDAR" -> currentDestination = FamilyOSDestination.CALENDAR
                                    }
                                }
                            )
                        }
                        FamilyOSDestination.FAMILY -> {
                            Column(modifier = Modifier.fillMaxSize()) {
                                val familyTabs = listOf(
                                    "Directory & Tree",
                                    "Heritage Map",
                                    "Family Gallery",
                                    "Constitution",
                                    "Traditions",
                                    "Shared Activities",
                                    "Family Rules"
                                )
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(FamilyOSColors.WarmIvoryDark)
                                        .horizontalScroll(rememberScrollState())
                                        .padding(horizontal = FamilyOSSpacing.md, vertical = FamilyOSSpacing.xs),
                                    horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)
                                ) {
                                    familyTabs.forEachIndexed { idx, label ->
                                        FilterChip(
                                            selected = familySubTab == idx,
                                            onClick = { familySubTab = idx },
                                            label = {
                                                Text(
                                                    text = label,
                                                    fontWeight = if (familySubTab == idx) FontWeight.Bold else FontWeight.Normal
                                                )
                                            },
                                            colors = FilterChipDefaults.filterChipColors(
                                                selectedContainerColor = FamilyOSColors.PrimaryForestGreen,
                                                selectedLabelColor = Color.White
                                            )
                                        )
                                    }
                                }

                                Box(modifier = Modifier.weight(1f)) {
                                    if (familySubTab == 0) {
                                        FamilyTreeScreen(
                                            members = members,
                                            relationships = relationships,
                                            invitations = invitations,
                                            actorMemberId = currentActorMemberId,
                                            actorRole = currentActorRole,
                                            onAddMember = { activeDialog = "ADD_MEMBER" },
                                            onCreateRelationship = { m1, m2, relType, notes ->
                                                viewModel.addFamilyRelationship(m1, m2, relType, notes)
                                            },
                                            onUpdateMemberProfile = { memberId, displayName, rel, resp, emName, emPhone, personalNotes, sharedBio ->
                                                viewModel.updateMemberProfile(
                                                    memberId = memberId,
                                                    displayName = displayName,
                                                    relationshipToPrimary = rel,
                                                    responsibilities = resp,
                                                    emergencyContactName = emName,
                                                    emergencyContactPhone = emPhone,
                                                    personalNotes = personalNotes,
                                                    sharedBio = sharedBio
                                                )
                                            },
                                            onRemoveMember = { memberId ->
                                                viewModel.removeFamilyMember(memberId)
                                            },
                                            onInviteMember = { email, name, role ->
                                                viewModel.inviteFamilyMember(email, name, role)
                                            },
                                            onApproveMembership = { memberId ->
                                                viewModel.approveMemberAccess(memberId)
                                            },
                                            onChangeRole = { memberId, newRole ->
                                                viewModel.changeMemberRole(memberId, newRole)
                                            }
                                        )
                                    } else {
                                        FamilyHeritageSectionView(
                                            subTab = familySubTab,
                                            extendedRelatives = extendedRelatives,
                                            galleryAlbums = galleryAlbums,
                                            galleryPhotos = galleryPhotos,
                                            constitutionVersions = constitutionVersions,
                                            traditions = traditions,
                                            sharedActivities = sharedActivities,
                                            familyRules = familyRules,
                                            viewModel = viewModel
                                        )
                                    }
                                }
                            }
                        }
                        FamilyOSDestination.GOALS_PROJECTS -> {
                            GoalsScreen(
                                workspace = activeWorkspace,
                                actorMemberId = currentActorMemberId,
                                actorRole = currentActorRole,
                                goals = goals,
                                projects = projects,
                                milestones = milestones,
                                tasks = tasks,
                                checklistItems = taskChecklistItems,
                                checklistTemplates = checklistTemplates,
                                rewardConfig = rewardConfig,
                                onAddGoal = { activeDialog = "ADD_GOAL" },
                                onAddTask = { activeDialog = "ADD_TASK" },
                                onToggleTaskComplete = { taskId, completed ->
                                    viewModel.toggleTaskCompleted(taskId, completed)
                                },
                                onAddChecklistItem = { taskId, title ->
                                    viewModel.addTaskChecklistItem(taskId, title)
                                },
                                onToggleChecklistItem = { itemId, isDone ->
                                    viewModel.toggleTaskChecklistItem(itemId, isDone)
                                },
                                onToggleMilestoneComplete = { milestoneId, completed ->
                                    viewModel.toggleMilestoneCompleted(milestoneId, completed)
                                },
                                onConfigureRewards = { enabled ->
                                    viewModel.configureRewardSystem(enabled)
                                }
                            )
                        }
                        FamilyOSDestination.HOUSEHOLD -> {
                            Column(modifier = Modifier.fillMaxSize()) {
                                // Household Hub Sub-Navigation Bar (Meals, Recipes, Pantry, Wardrobe, Chores, Home Assets)
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(FamilyOSColors.WarmIvoryDark)
                                        .horizontalScroll(rememberScrollState())
                                        .padding(horizontal = FamilyOSSpacing.md, vertical = FamilyOSSpacing.xs),
                                    horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.xs)
                                ) {
                                    val subTabs = listOf(
                                        "Meal Planner",
                                        "Recipe Library",
                                        "Food Pantry",
                                        "Wardrobe & Outfits",
                                        "Chores & Points",
                                        "Home Assets"
                                    )
                                    subTabs.forEachIndexed { idx, label ->
                                        FilterChip(
                                            selected = householdSubTab == idx,
                                            onClick = { householdSubTab = idx },
                                            label = {
                                                Text(
                                                    text = label,
                                                    fontWeight = if (householdSubTab == idx) FontWeight.Bold else FontWeight.Normal
                                                )
                                            },
                                            colors = FilterChipDefaults.filterChipColors(
                                                selectedContainerColor = FamilyOSColors.PrimaryForestGreen,
                                                selectedLabelColor = Color.White
                                            )
                                        )
                                    }
                                }

                                Box(modifier = Modifier.weight(1f)) {
                                    when (householdSubTab) {
                                        0 -> MealPlannerScreen(
                                            mealPlans = mealPlans,
                                            groceryItems = groceryItems,
                                            onAddMeal = { activeDialog = "ADD_MEAL" },
                                            onAddGroceryItem = { activeDialog = "ADD_GROCERY_ITEM" },
                                            onGenerateGroceryList = { viewModel.generateGroceryListFromWeek() },
                                            onToggleGroceryPurchased = { id, purchased ->
                                                viewModel.toggleGroceryPurchased(id, purchased)
                                            }
                                        )
                                        1 -> RecipeLibraryScreen(
                                            recipes = recipes,
                                            initialSelectedRecipeId = deepLinkedRecipeId,
                                            onAddRecipe = { activeDialog = "ADD_RECIPE" },
                                            onToggleFavorite = { id, fav ->
                                                viewModel.toggleRecipeFavorite(id, fav)
                                            }
                                        )
                                        2 -> PantryScreen(
                                            pantryItems = pantryItems,
                                            onAddItem = { activeDialog = "ADD_PANTRY_ITEM" },
                                            onConsumeItem = { id, qty ->
                                                viewModel.consumePantryItem(id, qty)
                                            },
                                            onDeleteItem = { id ->
                                                viewModel.deletePantryItem(id)
                                            }
                                        )
                                        3 -> WardrobeScreen(
                                            wardrobeItems = wardrobeItems,
                                            outfitPlans = outfitPlans,
                                            members = members,
                                            onAddWardrobeItem = { activeDialog = "ADD_WARDROBE_ITEM" },
                                            onToggleCleanStatus = { id, clean ->
                                                viewModel.toggleWardrobeCleanStatus(id, clean)
                                            },
                                            onSaveOutfitPlan = { memberId, day, name, itemIds, occasion, notes ->
                                                viewModel.saveOutfitPlan(
                                                    memberId = memberId,
                                                    date = day,
                                                    name = name,
                                                    itemIds = itemIds,
                                                    occasion = occasion,
                                                    notes = notes
                                                )
                                            }
                                        )
                                        4 -> ChoresScreen(
                                            chores = chores,
                                            onAddChore = { activeDialog = "ADD_CHORE" },
                                            onCompleteChore = { choreId ->
                                                viewModel.completeChore(choreId)
                                            }
                                        )
                                        5 -> HomeAssetsScreen(
                                            assets = assets,
                                            wishlist = wishlist,
                                            onAddAsset = { activeDialog = "ADD_ASSET" },
                                            onAddWishlistItem = { activeDialog = "ADD_WISHLIST" }
                                        )
                                    }
                                }
                            }
                        }
                        FamilyOSDestination.FINANCE -> {
                            FinanceScreen(
                                accounts = accounts,
                                budgets = budgets,
                                transactions = transactions,
                                bills = bills,
                                savingsGoals = savingsGoals,
                                investmentHoldings = investmentHoldings,
                                members = members,
                                currentRole = currentActorRole,
                                onAddAccount = { name, institution, balanceCents, accountType ->
                                    viewModel.addFinancialAccount(name, institution, balanceCents, accountType)
                                },
                                onAddTransaction = { title, amountCents, category, txType, accountId, paidByMemberId ->
                                    viewModel.recordFinancialTransaction(
                                        title = title,
                                        amountCents = amountCents,
                                        category = category,
                                        type = txType,
                                        accountId = accountId,
                                        paidByMemberId = paidByMemberId
                                    )
                                },
                                onTransfer = { amountCents, title, sourceAccountId, destinationAccountId ->
                                    viewModel.recordInternalTransfer(
                                        amountCents = amountCents,
                                        title = title,
                                        sourceAccountId = sourceAccountId,
                                        destinationAccountId = destinationAccountId
                                    )
                                },
                                onReverseTransaction = { txId, reason ->
                                    viewModel.reverseFinancialTransaction(txId, reason)
                                },
                                onAddBudget = { category, allocatedCents, threshold ->
                                    viewModel.addEnvelopeBudget(category, allocatedCents, threshold)
                                },
                                onAddSavingsGoal = { title, targetCents, monthlyCents, linkedAccountId ->
                                    viewModel.addSavingsGoal(title, targetCents, monthlyCents, linkedAccountId)
                                },
                                onContributeSavings = { goalId, amountCents ->
                                    viewModel.contributeToSavingsGoal(goalId, amountCents)
                                },
                                onAddBill = { payee, amountCents, cycle, isAutoPay ->
                                    viewModel.addRecurringBill(payee, amountCents, cycle, isAutoPay)
                                },
                                onAddInvestmentHolding = { symbol, name, type, microshares, costCents, priceCents ->
                                    viewModel.saveInvestmentHolding(symbol, name, type, microshares, costCents, priceCents)
                                },
                                onUpdateInvestmentPrice = { holdingId, newPriceCents ->
                                    viewModel.updateHoldingMarketPrice(holdingId, newPriceCents)
                                },
                                onDeleteInvestmentHolding = { holdingId ->
                                    viewModel.deleteInvestmentHolding(holdingId)
                                }
                            )
                        }
                        FamilyOSDestination.HEALTH_FITNESS -> {
                            WellbeingScreen(
                                members = members,
                                profiles = wellbeingProfiles,
                                allergies = allergies,
                                medications = medications,
                                vaccinations = vaccinations,
                                appointments = appointments,
                                onAddAllergy = { memberId ->
                                    dialogMemberIdTarget = memberId
                                    activeDialog = "ADD_ALLERGY"
                                },
                                onAddMedication = { memberId ->
                                    dialogMemberIdTarget = memberId
                                    activeDialog = "ADD_MEDICATION"
                                },
                                onAddVaccination = { memberId ->
                                    dialogMemberIdTarget = memberId
                                    activeDialog = "ADD_VACCINATION"
                                },
                                onAddAppointment = { memberId ->
                                    dialogMemberIdTarget = memberId
                                    activeDialog = "ADD_APPOINTMENT"
                                }
                            )
                        }
                        FamilyOSDestination.FAMILY_SAFETY -> {
                            EmergencyScreen(
                                contacts = emergencyContacts,
                                emergencyPlan = emergencyPlan,
                                supplies = emergencySupplies,
                                checklistItems = emergencyChecklist,
                                onAddContact = { activeDialog = "ADD_EMERGENCY_CONTACT" },
                                onAddEmergencySupply = { activeDialog = "ADD_EMERGENCY_SUPPLY" },
                                onAddEmergencyChecklistItem = { activeDialog = "ADD_EMERGENCY_CHECKLIST_ITEM" },
                                onToggleSupplyChecked = { id, checked ->
                                    viewModel.toggleEmergencySupplyChecked(id, checked)
                                },
                                onToggleChecklistCompleted = { id, completed ->
                                    viewModel.toggleEmergencyChecklistItem(id, completed)
                                }
                            )
                        }
                        FamilyOSDestination.CALENDAR -> {
                            CalendarScreen(
                                events = calendarEvents,
                                routines = routines,
                                occurrences = routineOccurrences,
                                onAddEvent = { title, dateMillis, cat, scope, isAllDay ->
                                    ensureNotificationPermissionThenSchedule {
                                        viewModel.createCalendarEvent(title, dateMillis, cat, null, scope, isAllDay)
                                    }
                                },
                                onAddRoutine = { title, cat, freq, timeOfDay, scope, steps, pointsReward ->
                                    ensureNotificationPermissionThenSchedule {
                                        viewModel.addRoutine(
                                            title = title,
                                            category = cat,
                                            frequency = freq,
                                            targetTimeOfDay = timeOfDay,
                                            scope = scope,
                                            steps = steps,
                                            pointsReward = pointsReward
                                        )
                                    }
                                },
                                onUpdateEvent = { eventId, title, dateMillis, cat, scope, isAllDay, tz, desc, loc, rrule, exceptions ->
                                    ensureNotificationPermissionThenSchedule {
                                        viewModel.updateCalendarEvent(
                                            eventId = eventId,
                                            title = title,
                                            eventDate = dateMillis,
                                            category = cat,
                                            description = desc,
                                            scope = scope,
                                            isAllDay = isAllDay,
                                            location = loc,
                                            timezone = tz,
                                            recurrenceRule = rrule,
                                            recurrenceExceptions = exceptions
                                        )
                                    }
                                },
                                onDeleteEvent = { eventId -> viewModel.deleteCalendarEvent(eventId) },
                                onCompleteRoutineOccurrence = { rId, occId -> viewModel.completeRoutineOccurrence(rId, occId) },
                                onSkipRoutineOccurrence = { rId, occId -> viewModel.skipRoutineOccurrence(rId, occId) },
                                onToggleRoutineStep = { rId, occId, sId, done -> viewModel.toggleRoutineStep(rId, occId, sId, done) },
                                onPauseResumeRoutine = { rId, paused ->
                                    if (!paused) {
                                        ensureNotificationPermissionThenSchedule {
                                            viewModel.pauseResumeRoutine(rId, paused)
                                        }
                                    } else {
                                        viewModel.pauseResumeRoutine(rId, paused)
                                    }
                                },
                                onConvertRoutineToTask = { rId, occId -> viewModel.convertRoutineToTask(rId, occId) }
                            )
                        }
                        FamilyOSDestination.INVESTMENTS -> {
                            FinanceScreen(
                                accounts = accounts,
                                budgets = budgets,
                                transactions = transactions,
                                bills = bills,
                                savingsGoals = savingsGoals,
                                investmentHoldings = investmentHoldings,
                                members = members,
                                currentRole = currentActorRole,
                                onAddAccount = { name, institution, balanceCents, accountType ->
                                    viewModel.addFinancialAccount(name, institution, balanceCents, accountType)
                                },
                                onAddTransaction = { title, amountCents, category, txType, accountId, paidByMemberId ->
                                    viewModel.recordFinancialTransaction(title, amountCents, category, txType, accountId, paidByMemberId)
                                },
                                onTransfer = { amountCents, title, sourceAccountId, destinationAccountId ->
                                    viewModel.recordInternalTransfer(amountCents, title, sourceAccountId, destinationAccountId)
                                },
                                onReverseTransaction = { txId, reason -> viewModel.reverseFinancialTransaction(txId, reason) },
                                onAddBudget = { category, allocatedCents, threshold -> viewModel.addEnvelopeBudget(category, allocatedCents, threshold) },
                                onAddSavingsGoal = { title, targetCents, monthlyCents, linkedAccountId ->
                                    viewModel.addSavingsGoal(title, targetCents, monthlyCents, linkedAccountId)
                                },
                                onContributeSavings = { goalId, amountCents -> viewModel.contributeToSavingsGoal(goalId, amountCents) },
                                onAddBill = { payee, amountCents, cycle, isAutoPay -> viewModel.addRecurringBill(payee, amountCents, cycle, isAutoPay) },
                                onAddInvestmentHolding = { symbol, name, type, microshares, costCents, priceCents ->
                                    viewModel.saveInvestmentHolding(symbol, name, type, microshares, costCents, priceCents)
                                },
                                onUpdateInvestmentPrice = { holdingId, newPriceCents ->
                                    viewModel.updateHoldingMarketPrice(holdingId, newPriceCents)
                                },
                                onDeleteInvestmentHolding = { holdingId -> viewModel.deleteInvestmentHolding(holdingId) }
                            )
                        }
                        FamilyOSDestination.SPIRITUAL_GROWTH,
                        FamilyOSDestination.PERSONAL_DEV,
                        FamilyOSDestination.COUPLES_PREP,
                        FamilyOSDestination.PARENTING -> {
                            FamilyLifeAndHeritageModuleScreen(
                                destination = currentDestination,
                                goals = goals,
                                tasks = tasks,
                                routines = routines,
                                traditions = traditions,
                                sharedActivities = sharedActivities,
                                familyRules = familyRules,
                                onAddGoal = { activeDialog = "ADD_GOAL" },
                                onAddTask = { activeDialog = "ADD_TASK" },
                                onToggleTaskComplete = { taskId, completed -> viewModel.toggleTaskCompleted(taskId, completed) },
                                viewModel = viewModel
                            )
                        }
                        FamilyOSDestination.DOCUMENTS -> {
                            FamilyDocumentsVaultScreen(
                                constitutionVersions = constitutionVersions,
                                assets = assets,
                                emergencyPlan = emergencyPlan,
                                galleryAlbums = galleryAlbums,
                                onNavigateToConstitution = {
                                    familySubTab = 3
                                    currentDestination = FamilyOSDestination.FAMILY
                                }
                            )
                        }
                        FamilyOSDestination.REPORTS -> {
                            FamilyAnalyticsReportsScreen(
                                accounts = accounts,
                                budgets = budgets,
                                transactions = transactions,
                                savingsGoals = savingsGoals,
                                investmentHoldings = investmentHoldings,
                                tasks = tasks,
                                chores = chores,
                                recentAudits = recentAudits
                            )
                        }
                        FamilyOSDestination.USER_PROFILE -> {
                            UserProfileAndSessionManagementScreen(
                                members = members,
                                actorMemberId = currentActorMemberId,
                                currentRole = currentActorRole,
                                onUpdateUserProfile = { displayName, email, lang ->
                                    viewModel.updateUserProfileAccount(displayName, email, lang)
                                },
                                onRevokeOtherSessions = { onDone ->
                                    viewModel.revokeAllOtherSessions(onDone)
                                },
                                onRequestAccountDeletion = { onDone ->
                                    viewModel.requestSelfServiceAccountDeletion(onDone)
                                },
                                onNavigateToSettings = {
                                    currentDestination = FamilyOSDestination.SETTINGS
                                }
                            )
                        }
                        FamilyOSDestination.SETTINGS -> {
                            val appInstance = application as FamilyOSApplication
                            FamilySecurityAndSyncSettingsScreen(
                                biometricLockEnabled = biometricLockEnabled,
                                isBiometricHardwareReady = biometricLockManager.isBiometricReady(),
                                canScheduleExactAlarms = canScheduleExactAlarmsState,
                                currentRole = currentActorRole,
                                initialBackendUrl = appInstance.encryptedSyncPrefs.getString(FamilyOSApplication.KEY_BACKEND_BASE_URL, "") ?: "",
                                initialBearerToken = appInstance.encryptedSyncPrefs.getString(FamilyOSApplication.KEY_AUTH_BEARER_TOKEN, "") ?: "",
                                onToggleBiometricLock = { enabled ->
                                    biometricLockEnabled = enabled
                                    appInstance.encryptedSyncPrefs.edit().putBoolean("biometric_lock_enabled", enabled).apply()
                                    if (!enabled) {
                                        biometricLockManager.unlockManually()
                                    }
                                },
                                onLockNow = {
                                    biometricLockEnabled = true
                                    appInstance.encryptedSyncPrefs.edit().putBoolean("biometric_lock_enabled", true).apply()
                                    biometricLockManager.lock()
                                },
                                onSaveEncryptedSyncConfig = { url, token ->
                                    appInstance.updateEncryptedSyncConfig(url, token)
                                },
                                onRequestNotificationPermission = {
                                    ensureNotificationPermissionThenSchedule {}
                                },
                                onOpenExactAlarmSettings = {
                                    openExactAlarmSettings()
                                },
                                onChangeActorRole = { role ->
                                    viewModel.setActorRole(role)
                                },
                                onOpenUserProfileAndAccount = {
                                    currentDestination = FamilyOSDestination.USER_PROFILE
                                },
                                onRevokeOtherSessions = { onDone ->
                                    viewModel.revokeAllOtherSessions(onDone)
                                },
                                onRequestAccountDeletion = { onDone ->
                                    viewModel.requestSelfServiceAccountDeletion(onDone)
                                }
                            )
                        }
                        FamilyOSDestination.AUTH -> {
                            var isAuthLoading by remember { mutableStateOf(false) }
                            var authError by remember { mutableStateOf<String?>(null) }
                            AuthScreen(
                                currentEmail = null,
                                isEmailVerified = true,
                                isLoading = isAuthLoading,
                                errorMessage = authError,
                                onSignInWithEmail = { email, pass ->
                                    isAuthLoading = true
                                    authError = null
                                    lifecycleScope.launch {
                                        viewModel.signInWithEmail(email, pass)
                                        isAuthLoading = false
                                        currentDestination = FamilyOSDestination.OVERVIEW
                                    }
                                },
                                onRegisterWithEmail = { email, pass ->
                                    isAuthLoading = true
                                    authError = null
                                    lifecycleScope.launch {
                                        viewModel.registerWithEmail(email, pass)
                                        isAuthLoading = false
                                        currentDestination = FamilyOSDestination.OVERVIEW
                                    }
                                },
                                onSignInWithGoogle = {
                                    currentDestination = FamilyOSDestination.OVERVIEW
                                },
                                onSendPasswordReset = { email ->
                                    lifecycleScope.launch {
                                        viewModel.sendPasswordResetEmail(email)
                                    }
                                },
                                onSendEmailVerification = {
                                    lifecycleScope.launch {
                                        viewModel.sendEmailVerification()
                                    }
                                },
                                onContinueOffline = {
                                    currentDestination = FamilyOSDestination.OVERVIEW
                                }
                            )
                        }
                    }
                }

                if (showGlobalSearchModal) {
                    GlobalSearchFtsModal(
                        query = searchQuery,
                        results = searchResults,
                        onQueryChange = { viewModel.updateSearchQuery(it) },
                        onDismiss = {
                            showGlobalSearchModal = false
                        },
                        onSelectResult = { result ->
                            showGlobalSearchModal = false
                            when (result.domain) {
                                "RECIPE" -> {
                                    deepLinkedRecipeId = result.id
                                    householdSubTab = 1
                                    currentDestination = FamilyOSDestination.HOUSEHOLD
                                }
                                "TASK", "GOAL" -> {
                                    currentDestination = FamilyOSDestination.GOALS_PROJECTS
                                }
                                "ASSET" -> {
                                    householdSubTab = 5
                                    currentDestination = FamilyOSDestination.HOUSEHOLD
                                }
                                "TRADITION" -> {
                                    familySubTab = 4
                                    currentDestination = FamilyOSDestination.FAMILY
                                }
                                "EMERGENCY_CONTACT" -> {
                                    currentDestination = FamilyOSDestination.FAMILY_SAFETY
                                }
                            }
                        }
                    )
                }

                // Shared Quick-Creation Modal Dialog wired directly to Room via FamilyOSViewModel
                if (activeDialog != null) {
                    val requiresMember = activeDialog in setOf(
                        "ADD_ALLERGY",
                        "ADD_MEDICATION",
                        "ADD_VACCINATION",
                        "ADD_APPOINTMENT",
                        "ADD_WARDROBE_ITEM"
                    )
                    val initialMemberId = dialogMemberIdTarget?.takeIf { target -> members.any { it.id == target } }
                        ?: currentActorMemberId.takeIf { actorId -> members.any { it.id == actorId } }
                        ?: members.firstOrNull()?.id
                        ?: ""

                    QuickCreateDialog(
                        dialogType = activeDialog!!,
                        members = members,
                        projects = projects,
                        recipes = recipes,
                        accounts = accounts,
                        actorMemberId = currentActorMemberId,
                        actorRole = currentActorRole,
                        initialMemberId = initialMemberId,
                        validationError = memberValidationError,
                        onDismiss = {
                            memberValidationError = null
                            activeDialog = null
                        },
                        onCheckRequiresMember = { selectedMemberId ->
                            if (requiresMember && selectedMemberId.isBlank()) {
                                memberValidationError = "Please create a family member first before adding member-scoped records."
                                false
                            } else {
                                memberValidationError = null
                                true
                            }
                        },
                        viewModel = viewModel,
                        onCompleted = {
                            memberValidationError = null
                            activeDialog = null
                        }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshExactAlarmCapability()
        triggerBiometricPromptIfLocked()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val deepLinkResult = parseDeepLink(intent)
        if (deepLinkResult is DeepLinkResult.RecipeDetail) {
            deepLinkedRecipeId = deepLinkResult.recipeId
            currentDestination = FamilyOSDestination.HOUSEHOLD
            householdSubTab = 1
        }
    }

    private fun parseDeepLink(intent: Intent?): DeepLinkResult {
        val uriString = intent?.dataString
        return RecipeDeepLinkParser.parse(uriString)
    }
}

private data class DraftIngredientInput(
    val itemName: String,
    val quantity: Double,
    val unit: String
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun QuickCreateDialog(
    dialogType: String,
    members: List<FamilyMember>,
    projects: List<Project>,
    recipes: List<Recipe>,
    accounts: List<FinancialAccount>,
    actorMemberId: String,
    actorRole: FamilyRole,
    initialMemberId: String,
    validationError: String? = null,
    onDismiss: () -> Unit,
    onCheckRequiresMember: (String) -> Boolean,
    viewModel: FamilyOSViewModel,
    onCompleted: () -> Unit
) {
    val assignableMembers = remember(members, actorRole, actorMemberId) {
        members.filter { m ->
            FamilySecurityPolicy.canAssignTaskToMember(actorRole, actorMemberId, m.id)
        }.ifEmpty { members }
    }

    // Shared & per-entity form state
    var primaryText by remember(dialogType) { mutableStateOf("") }
    var secondaryText by remember(dialogType) { mutableStateOf("") }
    var notesText by remember(dialogType) { mutableStateOf("") }

    // ADD_MEMBER (family_members)
    val relationshipOptions = remember { listOf("SELF", "SPOUSE", "CHILD", "PARENT", "OTHER") }
    var memberRelationship by remember(dialogType) { mutableStateOf("SPOUSE") }
    var isRestrictedProfile by remember(dialogType) { mutableStateOf(false) }
    var dietaryPrefsInput by remember(dialogType) { mutableStateOf("") }
    var memberAllergiesInput by remember(dialogType) { mutableStateOf("") }

    // ADD_GOAL & ADD_TASK (family_goals, tasks)
    var goalCategory by remember(dialogType) { mutableStateOf(GoalCategory.HOUSEHOLD) }
    var prioritySelection by remember(dialogType) { mutableStateOf(Priority.MEDIUM) }
    var selectedMemberId by remember(dialogType, initialMemberId) {
        mutableStateOf(initialMemberId.ifBlank { assignableMembers.firstOrNull()?.id ?: "" })
    }
    var selectedProjectId by remember(dialogType, projects) {
        mutableStateOf<String?>(projects.firstOrNull()?.id)
    }

    // ADD_MEAL (meal_plan_entries) & ADD_RECIPE (recipes, recipe_ingredients, recipe_instructions)
    var selectedMealType by remember(dialogType) { mutableStateOf(MealType.DINNER) }
    var selectedRecipeId by remember(dialogType) { mutableStateOf<String?>(null) }
    var servingsText by remember(dialogType) { mutableStateOf("4") }
    var recipeCategory by remember(dialogType) { mutableStateOf("DINNER") }
    var prepMinutesText by remember(dialogType) { mutableStateOf("15") }
    var cookMinutesText by remember(dialogType) { mutableStateOf("30") }
    var dietaryNotesText by remember(dialogType) { mutableStateOf("") }
    var draftIngredients by remember(dialogType) {
        mutableStateOf(listOf(DraftIngredientInput("Olive Oil", 2.0, "tbsp")))
    }
    var newIngName by remember(dialogType) { mutableStateOf("") }
    var newIngQty by remember(dialogType) { mutableStateOf("1") }
    var newIngUnit by remember(dialogType) { mutableStateOf("cups") }
    var draftSteps by remember(dialogType) {
        mutableStateOf(listOf("Prep ingredients and preheat cooking surface."))
    }
    var newStepText by remember(dialogType) { mutableStateOf("") }

    // ADD_PANTRY_ITEM (pantry_items) & ADD_GROCERY_ITEM (grocery_list_items)
    val pantryCategories = remember { listOf("PANTRY", "FRIDGE", "FREEZER", "SPICES", "SNACKS", "BEVERAGES", "OTHER") }
    val unitOptions = remember { listOf("pcs", "g", "kg", "ml", "L", "item") }
    var pantryCategory by remember(dialogType) {
        mutableStateOf(if (dialogType == "ADD_GROCERY_ITEM") "PRODUCE" else "PANTRY")
    }
    var quantityText by remember(dialogType) { mutableStateOf("1") }
    var selectedUnit by remember(dialogType) { mutableStateOf("item") }
    var storageLocationText by remember(dialogType) { mutableStateOf("Main Pantry Shelf") }
    var minThresholdText by remember(dialogType) { mutableStateOf("1") }
    var expiryDaysOffsetText by remember(dialogType) { mutableStateOf("") }

    // ADD_WARDROBE_ITEM (wardrobe_items)
    val wardrobeCategories = remember { listOf("TOPS", "BOTTOMS", "DRESSES", "OUTERWEAR", "SHOES", "ACCESSORIES", "OTHER") }
    val wardrobeSeasons = remember { listOf("SPRING", "SUMMER", "FALL", "WINTER", "ALL_SEASON") }
    var wardrobeCategory by remember(dialogType) { mutableStateOf("TOPS") }
    var wardrobeColor by remember(dialogType) { mutableStateOf("Navy") }
    var wardrobeSeason by remember(dialogType) { mutableStateOf("ALL_SEASON") }

    // ADD_CHORE (chores)
    val choreZones = remember { listOf("KITCHEN", "LIVING_ROOM", "BEDROOMS", "BATHROOMS", "OUTDOORS", "HOME") }
    var choreZone by remember(dialogType) { mutableStateOf("KITCHEN") }
    var choreFrequency by remember(dialogType) { mutableStateOf(ChoreFrequency.WEEKLY) }
    var rewardPointsText by remember(dialogType) { mutableStateOf("15") }
    var requiresVerification by remember(dialogType) { mutableStateOf(false) }

    // ADD_ACCOUNT & ADD_INCOME / ADD_EXPENSE / ADD_TRANSFER & ADD_ASSET / ADD_WISHLIST
    var selectedAccountType by remember(dialogType) { mutableStateOf(AccountType.CHECKING) }
    var selectedAccountId by remember(dialogType, accounts) { mutableStateOf(accounts.firstOrNull()?.id ?: "") }
    var selectedDestAccountId by remember(dialogType, accounts) {
        mutableStateOf(accounts.getOrNull(1)?.id ?: accounts.firstOrNull()?.id ?: "")
    }
    var amountCentsText by remember(dialogType) { mutableStateOf("2500") }
    var txCategoryText by remember(dialogType) {
        mutableStateOf(if (dialogType == "ADD_INCOME") "SALARY" else "GROCERIES")
    }

    // ADD_ALLERGY & ADD_MEDICATION & ADD_VACCINATION & ADD_APPOINTMENT
    val allergySeverities = remember { listOf("MILD", "MODERATE", "SEVERE_ANAPHYLACTIC") }
    var allergySeverity by remember(dialogType) { mutableStateOf("MODERATE") }
    var emergencyTreatmentText by remember(dialogType) { mutableStateOf("Administer antihistamine / EpiPen as prescribed") }
    var medScheduleFrequency by remember(dialogType) { mutableStateOf("DAILY") }
    var medScheduleTimesText by remember(dialogType) { mutableStateOf("08:00 AM, 08:00 PM") }

    // ADD_EMERGENCY_CONTACT & ADD_EMERGENCY_SUPPLY & ADD_EMERGENCY_CHECKLIST_ITEM
    var phonePrimaryText by remember(dialogType) { mutableStateOf("") }
    var phoneSecondaryText by remember(dialogType) { mutableStateOf("") }
    var isPrimaryContact by remember(dialogType) { mutableStateOf(false) }

    // Numeric field visibility and label aligned with prompt requirements
    val numericDialogTypes = remember {
        setOf(
            "ADD_MEAL",
            "ADD_RECIPE",
            "ADD_CHORE",
            "ADD_ASSET",
            "ADD_WISHLIST",
            "ADD_ACCOUNT",
            "ADD_INCOME",
            "ADD_EXPENSE",
            "ADD_TRANSFER",
            "ADD_PANTRY_ITEM"
        )
    }
    val showNumericField = dialogType in numericDialogTypes

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = dialogType.replace("_", " "),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (!validationError.isNullOrBlank()) {
                    Text(
                        text = validationError,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                when (dialogType) {
                    "ADD_MEMBER" -> {
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text("Display Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text("Relationship to Primary", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            relationshipOptions.forEach { rel ->
                                FilterChip(
                                    selected = memberRelationship == rel,
                                    onClick = {
                                        memberRelationship = rel
                                        if (rel == "CHILD") isRestrictedProfile = true
                                    },
                                    label = { Text(rel) }
                                )
                            }
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Restricted Profile (Auto-enabled for CHILD)", style = MaterialTheme.typography.bodySmall)
                            Switch(
                                checked = isRestrictedProfile || memberRelationship == "CHILD",
                                onCheckedChange = { isRestrictedProfile = it }
                            )
                        }
                        OutlinedTextField(
                            value = dietaryPrefsInput,
                            onValueChange = { dietaryPrefsInput = it },
                            label = { Text("Dietary Preferences (comma-separated, optional)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = memberAllergiesInput,
                            onValueChange = { memberAllergiesInput = it },
                            label = { Text("Allergies (comma-separated, optional)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    "ADD_GOAL", "ADD_TASK" -> {
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text(if (dialogType == "ADD_GOAL") "Goal Title" else "Task Title") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = secondaryText,
                            onValueChange = { secondaryText = it },
                            label = { Text("Description / Notes") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text("Category", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            GoalCategory.entries.forEach { cat ->
                                FilterChip(
                                    selected = goalCategory == cat,
                                    onClick = { goalCategory = cat },
                                    label = { Text(cat.name) }
                                )
                            }
                        }
                        Text("Priority", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Priority.entries.forEach { prio ->
                                FilterChip(
                                    selected = prioritySelection == prio,
                                    onClick = { prioritySelection = prio },
                                    label = { Text(prio.name) }
                                )
                            }
                        }
                        if (assignableMembers.isNotEmpty()) {
                            Text("Assigned Member", style = MaterialTheme.typography.labelMedium)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                assignableMembers.forEach { m ->
                                    FilterChip(
                                        selected = selectedMemberId == m.id,
                                        onClick = { selectedMemberId = m.id },
                                        label = { Text(m.displayName) }
                                    )
                                }
                            }
                        }
                        if (projects.isNotEmpty()) {
                            Text("Linked Project (Optional)", style = MaterialTheme.typography.labelMedium)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                FilterChip(
                                    selected = selectedProjectId == null,
                                    onClick = { selectedProjectId = null },
                                    label = { Text("None") }
                                )
                                projects.forEach { proj ->
                                    FilterChip(
                                        selected = selectedProjectId == proj.id,
                                        onClick = { selectedProjectId = proj.id },
                                        label = { Text(proj.name) }
                                    )
                                }
                            }
                        }
                    }

                    "ADD_MEAL" -> {
                        Text("Meal Type", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            MealType.entries.forEach { mt ->
                                FilterChip(
                                    selected = selectedMealType == mt,
                                    onClick = { selectedMealType = mt },
                                    label = { Text(mt.name) }
                                )
                            }
                        }
                        if (recipes.isNotEmpty()) {
                            Text("Link Recipe (or leave Custom below)", style = MaterialTheme.typography.labelMedium)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                FilterChip(
                                    selected = selectedRecipeId == null,
                                    onClick = { selectedRecipeId = null },
                                    label = { Text("Custom Meal") }
                                )
                                recipes.forEach { r ->
                                    FilterChip(
                                        selected = selectedRecipeId == r.id,
                                        onClick = {
                                            selectedRecipeId = r.id
                                            if (primaryText.isBlank()) primaryText = r.title
                                        },
                                        label = { Text(r.title) }
                                    )
                                }
                            }
                        }
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text("Custom Meal Title") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (showNumericField) {
                            OutlinedTextField(
                                value = servingsText,
                                onValueChange = { servingsText = it.filter { ch -> ch.isDigit() } },
                                label = { Text("Servings") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        OutlinedTextField(
                            value = notesText,
                            onValueChange = { notesText = it },
                            label = { Text("Meal Notes (Optional)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    "ADD_RECIPE" -> {
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text("Recipe Title") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text("Category", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("BREAKFAST", "LUNCH", "DINNER", "DESSERT", "SNACK").forEach { cat ->
                                FilterChip(
                                    selected = recipeCategory == cat,
                                    onClick = { recipeCategory = cat },
                                    label = { Text(cat) }
                                )
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = prepMinutesText,
                                onValueChange = { prepMinutesText = it.filter { ch -> ch.isDigit() } },
                                label = { Text("Prep (min)") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = cookMinutesText,
                                onValueChange = { cookMinutesText = it.filter { ch -> ch.isDigit() } },
                                label = { Text("Cook (min)") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            if (showNumericField) {
                                OutlinedTextField(
                                    value = servingsText,
                                    onValueChange = { servingsText = it.filter { ch -> ch.isDigit() } },
                                    label = { Text("Servings") },
                                    singleLine = true,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                        OutlinedTextField(
                            value = dietaryNotesText,
                            onValueChange = { dietaryNotesText = it },
                            label = { Text("Dietary Notes (e.g., Gluten-Free, Nut-Free)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text("Ingredients (${draftIngredients.size})", style = MaterialTheme.typography.labelMedium)
                        draftIngredients.forEachIndexed { idx, ing ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("• ${ing.quantity} ${ing.unit} ${ing.itemName}", style = MaterialTheme.typography.bodySmall)
                                IconButton(
                                    onClick = { draftIngredients = draftIngredients.filterIndexed { i, _ -> i != idx } },
                                    modifier = Modifier.size(48.dp)
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = "Remove ingredient ${ing.itemName}")
                                }
                            }
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            OutlinedTextField(
                                value = newIngName,
                                onValueChange = { newIngName = it },
                                label = { Text("Ingredient") },
                                singleLine = true,
                                modifier = Modifier.weight(1.4f)
                            )
                            OutlinedTextField(
                                value = newIngQty,
                                onValueChange = { newIngQty = it.filter { ch -> ch.isDigit() || ch == '.' } },
                                label = { Text("Qty") },
                                singleLine = true,
                                modifier = Modifier.weight(0.7f)
                            )
                            OutlinedTextField(
                                value = newIngUnit,
                                onValueChange = { newIngUnit = it },
                                label = { Text("Unit") },
                                singleLine = true,
                                modifier = Modifier.weight(0.8f)
                            )
                            IconButton(
                                onClick = {
                                    if (newIngName.isNotBlank()) {
                                        draftIngredients = draftIngredients + DraftIngredientInput(
                                            itemName = newIngName.trim(),
                                            quantity = newIngQty.toDoubleOrNull() ?: 1.0,
                                            unit = newIngUnit.trim().ifBlank { "pcs" }
                                        )
                                        newIngName = ""
                                    }
                                },
                                modifier = Modifier.size(48.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = "Add recipe ingredient")
                            }
                        }
                        Text("Ordered Instructions (${draftSteps.size})", style = MaterialTheme.typography.labelMedium)
                        draftSteps.forEachIndexed { idx, step ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("${idx + 1}. $step", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                                IconButton(
                                    onClick = { draftSteps = draftSteps.filterIndexed { i, _ -> i != idx } },
                                    modifier = Modifier.size(48.dp)
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = "Remove step ${idx + 1}")
                                }
                            }
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            OutlinedTextField(
                                value = newStepText,
                                onValueChange = { newStepText = it },
                                label = { Text("Add Instruction Step") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(
                                onClick = {
                                    if (newStepText.isNotBlank()) {
                                        draftSteps = draftSteps + newStepText.trim()
                                        newStepText = ""
                                    }
                                },
                                modifier = Modifier.size(48.dp)
                            ) {
                                Icon(Icons.Default.Add, contentDescription = "Add instruction step")
                            }
                        }
                    }

                    "ADD_PANTRY_ITEM", "ADD_GROCERY_ITEM" -> {
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text("Item Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text("Category", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            val cats = if (dialogType == "ADD_GROCERY_ITEM") {
                                listOf("PRODUCE", "DAIRY", "MEAT", "BAKERY", "PANTRY", "FROZEN", "HOUSEHOLD")
                            } else {
                                pantryCategories
                            }
                            cats.forEach { cat ->
                                FilterChip(
                                    selected = pantryCategory == cat,
                                    onClick = { pantryCategory = cat },
                                    label = { Text(cat) }
                                )
                            }
                        }
                        OutlinedTextField(
                            value = quantityText,
                            onValueChange = { quantityText = it.filter { ch -> ch.isDigit() || ch == '.' } },
                            label = { Text("Quantity") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text("Unit", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            unitOptions.forEach { u ->
                                FilterChip(
                                    selected = selectedUnit == u,
                                    onClick = { selectedUnit = u },
                                    label = { Text(u) }
                                )
                            }
                        }
                        if (dialogType == "ADD_PANTRY_ITEM") {
                            OutlinedTextField(
                                value = storageLocationText,
                                onValueChange = { storageLocationText = it },
                                label = { Text("Storage Location") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value = minThresholdText,
                                    onValueChange = { minThresholdText = it.filter { ch -> ch.isDigit() || ch == '.' } },
                                    label = { Text("Min Threshold") },
                                    singleLine = true,
                                    modifier = Modifier.weight(1f)
                                )
                                OutlinedTextField(
                                    value = expiryDaysOffsetText,
                                    onValueChange = { expiryDaysOffsetText = it.filter { ch -> ch.isDigit() } },
                                    label = { Text("Expiry (Days, Opt)") },
                                    singleLine = true,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }

                    "ADD_WARDROBE_ITEM" -> {
                        if (members.isNotEmpty()) {
                            Text("Family Member", style = MaterialTheme.typography.labelMedium)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                members.forEach { m ->
                                    FilterChip(
                                        selected = selectedMemberId == m.id,
                                        onClick = { selectedMemberId = m.id },
                                        label = { Text(m.displayName) }
                                    )
                                }
                            }
                        }
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text("Clothing Item Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text("Category", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            wardrobeCategories.forEach { cat ->
                                FilterChip(
                                    selected = wardrobeCategory == cat,
                                    onClick = { wardrobeCategory = cat },
                                    label = { Text(cat) }
                                )
                            }
                        }
                        OutlinedTextField(
                            value = wardrobeColor,
                            onValueChange = { wardrobeColor = it },
                            label = { Text("Color (Distinct from Category)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text("Season", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            wardrobeSeasons.forEach { s ->
                                FilterChip(
                                    selected = wardrobeSeason == s,
                                    onClick = { wardrobeSeason = s },
                                    label = { Text(s) }
                                )
                            }
                        }
                    }

                    "ADD_CHORE" -> {
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text("Chore Title") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text("Household Zone", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            choreZones.forEach { z ->
                                FilterChip(
                                    selected = choreZone == z,
                                    onClick = { choreZone = z },
                                    label = { Text(z) }
                                )
                            }
                        }
                        Text("Frequency", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            ChoreFrequency.entries.forEach { freq ->
                                FilterChip(
                                    selected = choreFrequency == freq,
                                    onClick = { choreFrequency = freq },
                                    label = { Text(freq.name) }
                                )
                            }
                        }
                        if (assignableMembers.isNotEmpty()) {
                            Text("Assigned Member", style = MaterialTheme.typography.labelMedium)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                assignableMembers.forEach { m ->
                                    FilterChip(
                                        selected = selectedMemberId == m.id,
                                        onClick = { selectedMemberId = m.id },
                                        label = { Text(m.displayName) }
                                    )
                                }
                            }
                        }
                        if (showNumericField) {
                            OutlinedTextField(
                                value = rewardPointsText,
                                onValueChange = { rewardPointsText = it.filter { ch -> ch.isDigit() } },
                                label = { Text("Reward Points") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Requires Parent Verification", style = MaterialTheme.typography.bodySmall)
                            Switch(
                                checked = requiresVerification,
                                onCheckedChange = { requiresVerification = it }
                            )
                        }
                    }

                    "ADD_ACCOUNT" -> {
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text("Account Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text("Account Type", style = MaterialTheme.typography.labelMedium)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            AccountType.entries.forEach { at ->
                                FilterChip(
                                    selected = selectedAccountType == at,
                                    onClick = { selectedAccountType = at },
                                    label = { Text(at.name) }
                                )
                            }
                        }
                        val isLiabilityAccount = selectedAccountType == AccountType.CREDIT_CARD || selectedAccountType == AccountType.LOAN
                        Text(
                            text = if (isLiabilityAccount) "is_liability = true (Auto-set for CREDIT_CARD / LOAN)" else "is_liability = false (Asset Account)",
                            style = MaterialTheme.typography.bodySmall,
                            color = FamilyOSColors.PrimaryForestGreen
                        )
                        OutlinedTextField(
                            value = secondaryText,
                            onValueChange = { secondaryText = it },
                            label = { Text("Financial Institution") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (showNumericField) {
                            OutlinedTextField(
                                value = amountCentsText,
                                onValueChange = { amountCentsText = it.filter { ch -> ch.isDigit() } },
                                label = { Text("Opening Balance (Integer Cents)") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    "ADD_INCOME", "ADD_EXPENSE", "ADD_TRANSFER" -> {
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text(if (dialogType == "ADD_TRANSFER") "Transfer Description" else "Merchant / Title") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (accounts.isNotEmpty()) {
                            Text(if (dialogType == "ADD_TRANSFER") "Source Account" else "Account", style = MaterialTheme.typography.labelMedium)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                accounts.forEach { acc ->
                                    FilterChip(
                                        selected = selectedAccountId == acc.id,
                                        onClick = { selectedAccountId = acc.id },
                                        label = { Text(acc.name) }
                                    )
                                }
                            }
                            if (dialogType == "ADD_TRANSFER") {
                                Text("Destination Account", style = MaterialTheme.typography.labelMedium)
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    accounts.forEach { acc ->
                                        FilterChip(
                                            selected = selectedDestAccountId == acc.id,
                                            onClick = { selectedDestAccountId = acc.id },
                                            label = { Text(acc.name) }
                                        )
                                    }
                                }
                            }
                        }
                        if (dialogType != "ADD_TRANSFER") {
                            OutlinedTextField(
                                value = txCategoryText,
                                onValueChange = { txCategoryText = it },
                                label = { Text("Category") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        if (showNumericField) {
                            OutlinedTextField(
                                value = amountCentsText,
                                onValueChange = { amountCentsText = it.filter { ch -> ch.isDigit() } },
                                label = { Text("Amount in Cents (Strict Long Integer)") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        if (members.isNotEmpty()) {
                            Text("Paid By Member", style = MaterialTheme.typography.labelMedium)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                members.forEach { m ->
                                    FilterChip(
                                        selected = selectedMemberId == m.id,
                                        onClick = { selectedMemberId = m.id },
                                        label = { Text(m.displayName) }
                                    )
                                }
                            }
                        }
                    }

                    "ADD_ALLERGY", "ADD_MEDICATION", "ADD_VACCINATION", "ADD_APPOINTMENT" -> {
                        if (members.isNotEmpty()) {
                            Text("Family Member", style = MaterialTheme.typography.labelMedium)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                members.forEach { m ->
                                    FilterChip(
                                        selected = selectedMemberId == m.id,
                                        onClick = { selectedMemberId = m.id },
                                        label = { Text(m.displayName) }
                                    )
                                }
                            }
                        }
                        when (dialogType) {
                            "ADD_ALLERGY" -> {
                                OutlinedTextField(
                                    value = primaryText,
                                    onValueChange = { primaryText = it },
                                    label = { Text("Allergen Name") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Text("Severity", style = MaterialTheme.typography.labelMedium)
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    allergySeverities.forEach { sev ->
                                        FilterChip(
                                            selected = allergySeverity == sev,
                                            onClick = { allergySeverity = sev },
                                            label = { Text(sev) }
                                        )
                                    }
                                }
                                OutlinedTextField(
                                    value = secondaryText,
                                    onValueChange = { secondaryText = it },
                                    label = { Text("Reaction") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = emergencyTreatmentText,
                                    onValueChange = { emergencyTreatmentText = it },
                                    label = { Text("Emergency Treatment") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                            "ADD_MEDICATION" -> {
                                OutlinedTextField(
                                    value = primaryText,
                                    onValueChange = { primaryText = it },
                                    label = { Text("Medication Name") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = secondaryText,
                                    onValueChange = { secondaryText = it },
                                    label = { Text("Dosage (e.g., 10mg, 1 tablet)") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = medScheduleFrequency,
                                    onValueChange = { medScheduleFrequency = it },
                                    label = { Text("Schedule Frequency (DAILY, TWICE_DAILY, AS_NEEDED)") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = medScheduleTimesText,
                                    onValueChange = { medScheduleTimesText = it },
                                    label = { Text("Schedule Times (comma-separated)") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = notesText,
                                    onValueChange = { notesText = it },
                                    label = { Text("Instructions") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                            "ADD_VACCINATION" -> {
                                OutlinedTextField(
                                    value = primaryText,
                                    onValueChange = { primaryText = it },
                                    label = { Text("Vaccine Name") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = secondaryText,
                                    onValueChange = { secondaryText = it },
                                    label = { Text("Provider / Clinic") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = notesText,
                                    onValueChange = { notesText = it },
                                    label = { Text("Lot Number (Optional)") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                            "ADD_APPOINTMENT" -> {
                                OutlinedTextField(
                                    value = primaryText,
                                    onValueChange = { primaryText = it },
                                    label = { Text("Doctor / Provider Name") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = secondaryText,
                                    onValueChange = { secondaryText = it },
                                    label = { Text("Medical Specialty") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = notesText,
                                    onValueChange = { notesText = it },
                                    label = { Text("Clinic Location / Notes") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }

                    "ADD_EMERGENCY_CONTACT" -> {
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text("Contact Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = secondaryText,
                            onValueChange = { secondaryText = it },
                            label = { Text("Relationship") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = phonePrimaryText,
                            onValueChange = { phonePrimaryText = it },
                            label = { Text("Primary Phone") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = phoneSecondaryText,
                            onValueChange = { phoneSecondaryText = it },
                            label = { Text("Secondary Phone (Optional)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Primary Emergency Guardian", style = MaterialTheme.typography.bodySmall)
                            Switch(
                                checked = isPrimaryContact,
                                onCheckedChange = { isPrimaryContact = it }
                            )
                        }
                    }

                    "ADD_EMERGENCY_SUPPLY", "ADD_EMERGENCY_CHECKLIST_ITEM" -> {
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text(if (dialogType == "ADD_EMERGENCY_SUPPLY") "Supply Item Name" else "Checklist Task Title") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = secondaryText,
                            onValueChange = { secondaryText = it },
                            label = { Text("Category (e.g., WATER, FIRST_AID, ANNUAL_REVIEW)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (dialogType == "ADD_EMERGENCY_SUPPLY") {
                            OutlinedTextField(
                                value = quantityText,
                                onValueChange = { quantityText = it },
                                label = { Text("Quantity Description (e.g., 12 gallons)") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = storageLocationText,
                                onValueChange = { storageLocationText = it },
                                label = { Text("Storage Location") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    else -> {
                        // ADD_ASSET, ADD_WISHLIST
                        OutlinedTextField(
                            value = primaryText,
                            onValueChange = { primaryText = it },
                            label = { Text("Title / Item Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = secondaryText,
                            onValueChange = { secondaryText = it },
                            label = { Text("Location / Category") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (showNumericField) {
                            OutlinedTextField(
                                value = amountCentsText,
                                onValueChange = { amountCentsText = it.filter { ch -> ch.isDigit() } },
                                label = {
                                    Text(
                                        if (dialogType == "ADD_ASSET") "Purchase Price (in Cents)"
                                        else "Estimated Cost (in Cents)"
                                    )
                                },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val trimmedTitle = primaryText.trim()
                    val canProceedTitle = trimmedTitle.isNotBlank() || (dialogType == "ADD_MEAL" && selectedRecipeId != null)
                    if (!canProceedTitle) return@TextButton
                    if (!onCheckRequiresMember(selectedMemberId)) return@TextButton

                    when (dialogType) {
                        "ADD_MEMBER" -> {
                            val dietaryList = dietaryPrefsInput.split(",").map { it.trim() }.filter { it.isNotBlank() }
                            val allergiesList = memberAllergiesInput.split(",").map { it.trim() }.filter { it.isNotBlank() }
                            viewModel.addFamilyMember(
                                displayName = trimmedTitle,
                                relationship = memberRelationship,
                                isRestricted = isRestrictedProfile || memberRelationship == "CHILD",
                                dietaryPreferences = dietaryList,
                                allergies = allergiesList
                            )
                        }
                        "ADD_GOAL" -> viewModel.createGoal(
                            title = trimmedTitle,
                            description = secondaryText.trim(),
                            category = goalCategory,
                            priority = prioritySelection,
                            assignedMemberId = selectedMemberId,
                            projectId = selectedProjectId
                        )
                        "ADD_TASK" -> viewModel.createTask(
                            title = trimmedTitle,
                            priority = prioritySelection,
                            assignedMemberId = selectedMemberId,
                            notes = secondaryText.trim(),
                            projectId = selectedProjectId,
                            category = goalCategory
                        )
                        "ADD_MEAL" -> viewModel.addMealPlan(
                            title = trimmedTitle,
                            mealType = selectedMealType,
                            servings = (servingsText.toIntOrNull() ?: 4).coerceAtLeast(1),
                            recipeId = selectedRecipeId,
                            notes = notesText.trim()
                        )
                        "ADD_GROCERY_ITEM" -> viewModel.addGroceryItem(
                            itemName = trimmedTitle,
                            category = pantryCategory,
                            quantity = (quantityText.toDoubleOrNull() ?: 1.0).coerceAtLeast(0.1),
                            unit = selectedUnit
                        )
                        "ADD_RECIPE" -> {
                            val finalIngredients = draftIngredients.map { d ->
                                RecipeIngredient(
                                    id = UUID.randomUUID().toString(),
                                    recipeId = "",
                                    itemName = d.itemName,
                                    quantity = d.quantity,
                                    unit = d.unit,
                                    notes = null
                                )
                            }
                            val finalInstructions = draftSteps.mapIndexed { idx, stepText ->
                                RecipeInstruction(
                                    id = UUID.randomUUID().toString(),
                                    recipeId = "",
                                    stepNumber = idx + 1,
                                    instructionText = stepText
                                )
                            }
                            viewModel.addRecipe(
                                title = trimmedTitle,
                                category = recipeCategory,
                                prepMinutes = prepMinutesText.toIntOrNull() ?: 15,
                                cookMinutes = cookMinutesText.toIntOrNull() ?: 30,
                                servings = (servingsText.toIntOrNull() ?: 4).coerceAtLeast(1),
                                dietaryNotes = dietaryNotesText.trim().ifBlank { null },
                                ingredients = finalIngredients,
                                instructions = finalInstructions
                            )
                        }
                        "ADD_PANTRY_ITEM" -> {
                            val expiryDays = expiryDaysOffsetText.toLongOrNull()
                            val expiryMillis = expiryDays?.let { System.currentTimeMillis() + it * 86_400_000L }
                            viewModel.addPantryItem(
                                name = trimmedTitle,
                                category = pantryCategory,
                                qty = (quantityText.toDoubleOrNull() ?: 1.0).coerceAtLeast(0.1),
                                unit = selectedUnit,
                                expiryDate = expiryMillis,
                                minThreshold = (minThresholdText.toDoubleOrNull() ?: 1.0).coerceAtLeast(0.0),
                                storageLocation = storageLocationText.trim()
                            )
                        }
                        "ADD_WARDROBE_ITEM" -> viewModel.addWardrobeItem(
                            memberId = selectedMemberId,
                            name = trimmedTitle,
                            category = wardrobeCategory,
                            color = wardrobeColor.trim().ifBlank { "Navy" },
                            season = wardrobeSeason
                        )
                        "ADD_CHORE" -> viewModel.addChore(
                            title = trimmedTitle,
                            zone = choreZone,
                            points = (rewardPointsText.toIntOrNull() ?: 15).coerceAtLeast(0),
                            frequency = choreFrequency,
                            assignedMemberId = selectedMemberId,
                            requiresVerification = requiresVerification
                        )
                        "ADD_ASSET" -> viewModel.addHomeAsset(
                            name = trimmedTitle,
                            location = secondaryText.trim().ifBlank { "Home" },
                            priceCents = amountCentsText.toLongOrNull() ?: 0L
                        )
                        "ADD_WISHLIST" -> viewModel.addWishlistItem(
                            itemName = trimmedTitle,
                            estimatedCostCents = amountCentsText.toLongOrNull() ?: 0L,
                            category = secondaryText.trim().ifBlank { "Household" }
                        )
                        "ADD_ACCOUNT" -> viewModel.addFinancialAccount(
                            name = trimmedTitle,
                            institution = secondaryText.trim().ifBlank { "Local Bank" },
                            balanceCents = amountCentsText.toLongOrNull() ?: 0L,
                            accountType = selectedAccountType
                        )
                        "ADD_INCOME" -> viewModel.recordFinancialTransaction(
                            title = trimmedTitle,
                            amountCents = amountCentsText.toLongOrNull() ?: 0L,
                            category = txCategoryText.trim().ifBlank { "SALARY" },
                            type = TransactionType.INCOME,
                            accountId = selectedAccountId,
                            paidByMemberId = selectedMemberId
                        )
                        "ADD_EXPENSE" -> viewModel.recordFinancialTransaction(
                            title = trimmedTitle,
                            amountCents = amountCentsText.toLongOrNull() ?: 0L,
                            category = txCategoryText.trim().ifBlank { "EXPENSE" },
                            type = TransactionType.EXPENSE,
                            accountId = selectedAccountId,
                            paidByMemberId = selectedMemberId
                        )
                        "ADD_TRANSFER" -> viewModel.recordInternalTransfer(
                            amountCents = amountCentsText.toLongOrNull() ?: 0L,
                            title = trimmedTitle,
                            sourceAccountId = selectedAccountId,
                            destinationAccountId = selectedDestAccountId,
                            paidByMemberId = selectedMemberId
                        )
                        "ADD_ALLERGY" -> viewModel.addHealthAllergy(
                            memberId = selectedMemberId,
                            allergen = trimmedTitle,
                            severity = allergySeverity,
                            reaction = secondaryText.trim().ifBlank { "Hives / Allergic reaction" },
                            treatment = emergencyTreatmentText.trim()
                        )
                        "ADD_MEDICATION" -> viewModel.addHealthMedication(
                            memberId = selectedMemberId,
                            medicationName = trimmedTitle,
                            dosage = secondaryText.trim().ifBlank { "1 dose" },
                            instructions = notesText.trim().ifBlank { "Take as scheduled" },
                            scheduleFrequency = medScheduleFrequency,
                            scheduleTimes = medScheduleTimesText.split(",").map { it.trim() }.filter { it.isNotBlank() }
                        )
                        "ADD_VACCINATION" -> viewModel.addHealthVaccination(
                            memberId = selectedMemberId,
                            vaccineName = trimmedTitle,
                            provider = secondaryText.trim().ifBlank { null },
                            lotNumber = notesText.trim().ifBlank { null }
                        )
                        "ADD_APPOINTMENT" -> viewModel.addHealthcareAppointment(
                            memberId = selectedMemberId,
                            providerName = trimmedTitle,
                            specialty = secondaryText.trim().ifBlank { "General Practice" },
                            location = notesText.trim().ifBlank { null }
                        )
                        "ADD_EMERGENCY_CONTACT" -> viewModel.addEmergencyContact(
                            name = trimmedTitle,
                            relationship = secondaryText.trim().ifBlank { "Emergency Contact" },
                            phone = phonePrimaryText.trim().ifBlank { "555-0199" },
                            isPrimary = isPrimaryContact,
                            phoneSecondary = phoneSecondaryText.trim().ifBlank { null }
                        )
                        "ADD_EMERGENCY_SUPPLY" -> viewModel.addEmergencySupply(
                            itemName = trimmedTitle,
                            category = secondaryText.trim().ifBlank { "WATER" },
                            quantity = quantityText.trim().ifBlank { "1 unit" },
                            storageLocation = storageLocationText.trim().ifBlank { "Basement pantry" }
                        )
                        "ADD_EMERGENCY_CHECKLIST_ITEM" -> viewModel.addEmergencyChecklistItem(
                            title = trimmedTitle,
                            category = secondaryText.trim().ifBlank { "ANNUAL_REVIEW" },
                            assignedMemberId = selectedMemberId.ifBlank { null }
                        )
                    }
                    onCompleted()
                }
            ) {
                Text("Save to Room DB")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GlobalSearchFtsModal(
    query: String,
    results: List<UnifiedSearchResult>,
    onQueryChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onSelectResult: (UnifiedSearchResult) -> Unit
) {
    var selectedDomain by remember { mutableStateOf("ALL") }
    val domains = listOf("ALL", "RECIPE", "TASK", "GOAL", "ASSET", "TRADITION", "EMERGENCY_CONTACT")
    val filteredResults = remember(results, selectedDomain) {
        if (selectedDomain == "ALL") results else results.filter { it.domain == selectedDomain }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Global Full-Text Search (FTS4)",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    label = { Text("Search recipes, tasks, goals, assets, traditions & contacts...") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    domains.forEach { dom ->
                        FilterChip(
                            selected = selectedDomain == dom,
                            onClick = { selectedDomain = dom },
                            label = { Text(dom.replace("_", " ")) }
                        )
                    }
                }
                if (query.isBlank()) {
                    Text(
                        text = "Powered by Room SQLite FTS4 virtual tables (recipes_fts, tasks_fts, family_goals_fts, home_assets_fts, family_traditions_fts).",
                        style = MaterialTheme.typography.bodySmall,
                        color = FamilyOSColors.TextSecondary
                    )
                } else if (filteredResults.isEmpty()) {
                    Text(
                        text = "No matching records found for \"$query\".",
                        style = MaterialTheme.typography.bodyMedium,
                        color = FamilyOSColors.TextSecondary
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 320.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        items(filteredResults, key = { "${it.domain}:${it.id}" }) { hit ->
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSelectResult(hit) },
                                color = FamilyOSColors.WarmIvoryLight,
                                shape = FamilyOSShapes.medium
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = hit.title,
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold
                                        )
                                        if (!hit.subtitle.isNullOrBlank()) {
                                            Text(
                                                text = hit.subtitle,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = FamilyOSColors.TextSecondary
                                            )
                                        }
                                    }
                                    FamilyOSStatusBadge(
                                        text = hit.domain,
                                        color = FamilyOSColors.PrimaryForestGreen
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}

@Composable
private fun BiometricGateScreen(
    familyName: String,
    isBiometricHardwareReady: Boolean,
    onAuthenticate: () -> Unit,
    onFallbackPasscodeUnlock: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(FamilyOSColors.WarmIvory)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        FamilyOSCard {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(16.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Fingerprint,
                    contentDescription = "Biometric Security Gate",
                    tint = FamilyOSColors.PrimaryForestGreen,
                    modifier = Modifier.size(56.dp)
                )
                Text(
                    text = "$familyName • Locked",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = if (isBiometricHardwareReady) {
                        "Hardware biometric authentication is required to unlock encrypted household records."
                    } else {
                        "Verify your identity to unlock encrypted household records."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = FamilyOSColors.TextSecondary
                )
                Button(
                    onClick = onAuthenticate,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Authenticate with Biometrics")
                }
                OutlinedButton(
                    onClick = onFallbackPasscodeUnlock,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Unlock Session")
                }
            }
        }
    }
}

@Composable
private fun FamilyHeritageSectionView(
    subTab: Int,
    extendedRelatives: List<FamilyExtendedRelativeEntity>,
    galleryAlbums: List<FamilyGalleryAlbumEntity>,
    galleryPhotos: List<FamilyGalleryPhotoEntity>,
    constitutionVersions: List<FamilyConstitutionVersionEntity>,
    traditions: List<FamilyTraditionEntity>,
    sharedActivities: List<FamilySharedActivityEntity>,
    familyRules: List<FamilyRuleEntity>,
    viewModel: FamilyOSViewModel
) {
    var titleInput by remember(subTab) { mutableStateOf("") }
    var detailInput by remember(subTab) { mutableStateOf("") }
    var categoryInput by remember(subTab) { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(FamilyOSSpacing.md),
        verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
    ) {
        when (subTab) {
            1 -> {
                FamilyOSSectionHeader(
                    title = "Extended Heritage Map (${extendedRelatives.size})",
                    actionText = "Add Relative",
                    onActionClick = {
                        if (titleInput.isNotBlank()) {
                            viewModel.addExtendedRelative(
                                fullName = titleInput,
                                relationshipLabel = detailInput.ifBlank { "Extended Relative" },
                                lineageSide = categoryInput.ifBlank { "MATERNAL" }
                            )
                            titleInput = ""
                            detailInput = ""
                        }
                    }
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = titleInput,
                        onValueChange = { titleInput = it },
                        label = { Text("Full Name") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = detailInput,
                        onValueChange = { detailInput = it },
                        label = { Text("Relationship Label") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = categoryInput,
                        onValueChange = { categoryInput = it },
                        label = { Text("Lineage (PATERNAL/MATERNAL)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                extendedRelatives.forEach { rel ->
                    FamilyOSCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(rel.fullName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                Text(
                                    "${rel.relationshipLabel} • ${rel.lineageSide} • ${rel.city ?: "Family Homestead"}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = FamilyOSColors.TextSecondary
                                )
                            }
                            FamilyOSStatusBadge(text = rel.generation, color = FamilyOSColors.PrimaryForestGreen)
                        }
                    }
                }
            }
            2 -> {
                FamilyOSSectionHeader(
                    title = "Family Gallery (${galleryAlbums.size} Albums • ${galleryPhotos.size} Photos)",
                    actionText = "Create Album",
                    onActionClick = {
                        if (titleInput.isNotBlank()) {
                            viewModel.addGalleryAlbum(titleInput, detailInput)
                            titleInput = ""
                            detailInput = ""
                        }
                    }
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = titleInput,
                        onValueChange = { titleInput = it },
                        label = { Text("Album or Photo Title") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = detailInput,
                        onValueChange = { detailInput = it },
                        label = { Text("Description / Caption") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                galleryAlbums.forEach { alb ->
                    FamilyOSCard {
                        Text(alb.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(alb.description ?: alb.category, style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
                    }
                }
            }
            3 -> {
                FamilyOSSectionHeader(
                    title = "Family Constitution (${constitutionVersions.size} Versions)",
                    actionText = "Publish New Version",
                    onActionClick = {
                        if (titleInput.isNotBlank()) {
                            viewModel.saveConstitutionVersion(
                                motto = titleInput,
                                missionStatement = detailInput.ifBlank { "Shared household mission" },
                                visionStatement = categoryInput.ifBlank { "Multi-generational flourishing" },
                                coreValues = listOf("Stewardship", "Kindness", "Integrity")
                            )
                            titleInput = ""
                            detailInput = ""
                        }
                    }
                )
                OutlinedTextField(
                    value = titleInput,
                    onValueChange = { titleInput = it },
                    label = { Text("Family Motto") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = detailInput,
                    onValueChange = { detailInput = it },
                    label = { Text("Mission Statement") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                constitutionVersions.forEach { ver ->
                    FamilyOSCard {
                        Text("Version v${ver.versionNumber}: ${ver.motto}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text("Mission: ${ver.missionStatement}", style = MaterialTheme.typography.bodySmall)
                        Text("Vision: ${ver.visionStatement}", style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
                    }
                }
            }
            4 -> {
                FamilyOSSectionHeader(
                    title = "Family Traditions & Culture (${traditions.size})",
                    actionText = "Add Tradition",
                    onActionClick = {
                        if (titleInput.isNotBlank()) {
                            viewModel.addFamilyTradition(
                                title = titleInput,
                                category = categoryInput.ifBlank { "Annual" },
                                cadence = categoryInput.ifBlank { "Annual" },
                                originStory = detailInput
                            )
                            titleInput = ""
                            detailInput = ""
                        }
                    }
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = titleInput,
                        onValueChange = { titleInput = it },
                        label = { Text("Tradition Title") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = detailInput,
                        onValueChange = { detailInput = it },
                        label = { Text("Origin Story") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                traditions.forEach { tr ->
                    FamilyOSCard {
                        Text(tr.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text("${tr.category} • ${tr.cadence}", style = MaterialTheme.typography.labelSmall, color = FamilyOSColors.PrimaryForestGreen)
                        if (!tr.originStory.isNullOrBlank()) {
                            Text(tr.originStory, style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
                        }
                    }
                }
            }
            5 -> {
                FamilyOSSectionHeader(
                    title = "Shared Family Activities (${sharedActivities.size})",
                    actionText = "Schedule Activity",
                    onActionClick = {
                        if (titleInput.isNotBlank()) {
                            viewModel.addSharedActivity(
                                title = titleInput,
                                category = "Outing",
                                dateIso = categoryInput.ifBlank { "2026-11-21" },
                                location = detailInput.ifBlank { "Community Park" },
                                budgetCents = 3500L
                            )
                            titleInput = ""
                            detailInput = ""
                        }
                    }
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = titleInput,
                        onValueChange = { titleInput = it },
                        label = { Text("Activity Title") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = detailInput,
                        onValueChange = { detailInput = it },
                        label = { Text("Location") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                sharedActivities.forEach { act ->
                    FamilyOSCard {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(act.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                Text("${act.dateIso} • ${act.location ?: "Family Home"}", style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
                            }
                            FamilyOSStatusBadge(text = FinancialPrecisionUtils.formatCents(act.budgetCents), color = FamilyOSColors.SoftGold)
                        }
                    }
                }
            }
            else -> {
                FamilyOSSectionHeader(
                    title = "Family Rules & Principles (${familyRules.size})",
                    actionText = "Add Rule",
                    onActionClick = {
                        if (titleInput.isNotBlank()) {
                            viewModel.addFamilyRule(
                                title = titleInput,
                                category = categoryInput.ifBlank { "Household" },
                                description = detailInput.ifBlank { "Shared household principle" }
                            )
                            titleInput = ""
                            detailInput = ""
                        }
                    }
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = titleInput,
                        onValueChange = { titleInput = it },
                        label = { Text("Rule / Principle Title") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = detailInput,
                        onValueChange = { detailInput = it },
                        label = { Text("Description") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                familyRules.forEach { rule ->
                    FamilyOSCard {
                        Text(rule.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(rule.description, style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
                    }
                }
            }
        }
    }
}

@Composable
private fun FamilyLifeAndHeritageModuleScreen(
    destination: FamilyOSDestination,
    goals: List<FamilyGoal>,
    tasks: List<Task>,
    routines: List<Routine>,
    traditions: List<FamilyTraditionEntity>,
    sharedActivities: List<FamilySharedActivityEntity>,
    familyRules: List<FamilyRuleEntity>,
    onAddGoal: () -> Unit,
    onAddTask: () -> Unit,
    onToggleTaskComplete: (String, Boolean) -> Unit,
    viewModel: FamilyOSViewModel
) {
    var newEntryTitle by remember(destination) { mutableStateOf("") }
    var newEntryNotes by remember(destination) { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(FamilyOSSpacing.md),
        verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
    ) {
        FamilyOSSectionHeader(
            title = destination.title,
            actionText = "New Goal",
            onActionClick = onAddGoal
        )
        FamilyOSCard {
            Text(
                text = "Add ${destination.title} Milestone or Tradition",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = newEntryTitle,
                onValueChange = { newEntryTitle = it },
                label = { Text("Title") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = newEntryNotes,
                onValueChange = { newEntryNotes = it },
                label = { Text("Reflection / Cadence / Notes") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        if (newEntryTitle.isNotBlank()) {
                            val targetCat = when (destination) {
                                FamilyOSDestination.SPIRITUAL_GROWTH -> GoalCategory.SPIRITUAL
                                FamilyOSDestination.PERSONAL_DEV -> GoalCategory.EDUCATION
                                else -> GoalCategory.HOUSEHOLD
                            }
                            viewModel.createGoal(
                                title = newEntryTitle,
                                description = newEntryNotes,
                                category = targetCat
                            )
                            newEntryTitle = ""
                            newEntryNotes = ""
                        }
                    }
                ) {
                    Text("Save Goal")
                }
                OutlinedButton(onClick = onAddTask) {
                    Text("Add Action Task")
                }
            }
        }

        Text("Active Goals & Milestones (${goals.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        goals.forEach { g ->
            FamilyOSCard {
                Text(g.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                if (!g.description.isNullOrBlank()) {
                    Text(g.description, style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
                }
            }
        }

        Text("Traditions, Shared Activities & Rules (${traditions.size + sharedActivities.size + familyRules.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        traditions.forEach { tr ->
            FamilyOSCard {
                Text(tr.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text("${tr.category} • ${tr.cadence}", style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
            }
        }
        routines.take(3).forEach { r ->
            FamilyOSCard {
                Text("Routine: ${r.title} (${r.targetTimeOfDay})", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            }
        }
        tasks.take(5).forEach { t ->
            FamilyOSCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text(t.title, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    Checkbox(checked = t.isCompleted, onCheckedChange = { onToggleTaskComplete(t.id, it) })
                }
            }
        }
    }
}

@Composable
private fun FamilyDocumentsVaultScreen(
    constitutionVersions: List<FamilyConstitutionVersionEntity>,
    assets: List<HomeAsset>,
    emergencyPlan: EmergencyPlan?,
    galleryAlbums: List<FamilyGalleryAlbumEntity>,
    onNavigateToConstitution: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(FamilyOSSpacing.md),
        verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
    ) {
        FamilyOSSectionHeader(
            title = "Family Document & Records Vault",
            actionText = "Edit Constitution",
            onActionClick = onNavigateToConstitution
        )
        constitutionVersions.forEach { ver ->
            FamilyOSCard {
                Text("Family Constitution v${ver.versionNumber}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Motto: ${ver.motto}", style = MaterialTheme.typography.bodySmall)
                Text("Mission: ${ver.missionStatement}", style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
            }
        }
        if (emergencyPlan != null) {
            FamilyOSCard {
                Text("Emergency Preparedness Plan", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Primary Meeting Point: ${emergencyPlan.primaryMeetingPoint}", style = MaterialTheme.typography.bodySmall)
                Text("Evacuation Route: ${emergencyPlan.evacuationRoute}", style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
            }
        }
        Text("Asset Warranties & Serial Registry (${assets.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        assets.forEach { asset ->
            FamilyOSCard {
                Text(asset.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text(
                    "Serial: ${asset.serialNumber ?: "On file"} • Location: ${asset.location} • Value: ${FinancialPrecisionUtils.formatCents(asset.purchasePriceCents)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            }
        }
        Text("Media Archive Albums (${galleryAlbums.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        galleryAlbums.forEach { album ->
            FamilyOSCard {
                Text(album.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text(album.description ?: album.category, style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
            }
        }
    }
}

@Composable
private fun FamilyAnalyticsReportsScreen(
    accounts: List<FinancialAccount>,
    budgets: List<EnvelopeBudget>,
    transactions: List<FinancialTransaction>,
    savingsGoals: List<SavingsGoal>,
    investmentHoldings: List<InvestmentHolding>,
    tasks: List<Task>,
    chores: List<Chore>,
    recentAudits: List<AuditEventEntity>
) {
    val totalAssetsCents = accounts.filter { !it.isLiability }.sumOf { it.currentBalanceCents }
    val totalLiabilitiesCents = accounts.filter { it.isLiability }.sumOf { kotlin.math.abs(it.currentBalanceCents) }
    val netWorthCents = totalAssetsCents - totalLiabilitiesCents
    val portfolioValuationCents = investmentHoldings.sumOf { it.currentValuationCents }
    val completedTasks = tasks.count { it.isCompleted }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(FamilyOSSpacing.md),
        verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
    ) {
        Text("Cross-Domain Household & Financial Reports", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        FamilyOSCard {
            Text("Net Worth & Integer-Cents Ledger Summary", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("Total Assets: ${FinancialPrecisionUtils.formatCents(totalAssetsCents)}", style = MaterialTheme.typography.bodyMedium)
            Text("Total Liabilities: ${FinancialPrecisionUtils.formatCents(totalLiabilitiesCents)}", style = MaterialTheme.typography.bodyMedium)
            Text("Net Worth: ${FinancialPrecisionUtils.formatCents(netWorthCents)}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = FamilyOSColors.PrimaryForestGreen)
            Text("Investment Portfolio Valuation: ${FinancialPrecisionUtils.formatCents(portfolioValuationCents)}", style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
        }
        FamilyOSCard {
            Text("Household Operations & Execution", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("Tasks Completed: $completedTasks / ${tasks.size}", style = MaterialTheme.typography.bodyMedium)
            Text("Active Chores: ${chores.size} • Envelope Budgets: ${budgets.size} • Savings Goals: ${savingsGoals.size}", style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
            Text("Posted Ledger Transactions: ${transactions.size}", style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
        }
        Text("Recent Immutable Audit Trail (${recentAudits.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        recentAudits.take(10).forEach { audit ->
            FamilyOSCard {
                Text(audit.summary, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Text("${audit.actionType} • ${audit.entityType}", style = MaterialTheme.typography.bodySmall, color = FamilyOSColors.TextSecondary)
            }
        }
    }
}

@Composable
private fun UserProfileAndSessionManagementScreen(
    members: List<FamilyMember>,
    actorMemberId: String,
    currentRole: FamilyRole,
    onUpdateUserProfile: (String, String, String) -> Unit,
    onRevokeOtherSessions: ((String) -> Unit) -> Unit,
    onRequestAccountDeletion: ((Boolean, String) -> Unit) -> Unit,
    onNavigateToSettings: () -> Unit
) {
    val activeMember = remember(members, actorMemberId) {
        members.find { it.id == actorMemberId } ?: members.firstOrNull()
    }
    var displayName by remember(activeMember) { mutableStateOf(activeMember?.displayName ?: "Sarah Henderson") }
    var email by remember { mutableStateOf("sarah@familyos.app") }
    var preferredLanguage by remember { mutableStateOf("en") }
    var statusBanner by remember { mutableStateOf<String?>(null) }
    var isDeletionError by remember { mutableStateOf(false) }
    var confirmDeleteChecked by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(FamilyOSSpacing.md),
        verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
    ) {
        FamilyOSSectionHeader(
            title = "User Profile, Sessions & GDPR Account (AUTH-06 / AUTH-07)",
            actionText = "Security Settings",
            onActionClick = onNavigateToSettings
        )

        if (!statusBanner.isNullOrBlank()) {
            FamilyOSCard {
                Text(
                    text = statusBanner!!,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isDeletionError) MaterialTheme.colorScheme.error else FamilyOSColors.PrimaryForestGreen
                )
            }
        }

        FamilyOSCard {
            Text("Personal Account Profile (`user_profiles`)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it },
                label = { Text("Display Name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Authenticated Account Email") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = preferredLanguage,
                onValueChange = { preferredLanguage = it },
                label = { Text("Preferred Language (ISO Code)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = {
                    onUpdateUserProfile(displayName, email, preferredLanguage)
                    isDeletionError = false
                    statusBanner = "Personal user profile saved to Room (`user_profiles`)."
                },
                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
            ) {
                Text("Save Personal Profile")
            }
        }

        FamilyOSCard {
            Text("Active Device & Session Management (AUTH-06)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                text = "Current Device: Android 15 (API 35) • Role: ${currentRole.name} • Status: ACTIVE",
                style = MaterialTheme.typography.bodySmall,
                color = FamilyOSColors.TextSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(
                onClick = {
                    onRevokeOtherSessions { message ->
                        isDeletionError = false
                        statusBanner = message
                    }
                },
                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
            ) {
                Text("Revoke All Other Device Sessions")
            }
        }

        FamilyOSCard {
            Text(
                text = "Self-Service Account & Data Deletion (AUTH-07 / GDPR)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.error
            )
            Text(
                text = "Permanently deletes your personal account profile, revokes active tokens, and anonymizes audit logs. Enforces the last-owner invariant (sole OWNER must transfer ownership before account deletion).",
                style = MaterialTheme.typography.bodySmall,
                color = FamilyOSColors.TextSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = confirmDeleteChecked,
                    onCheckedChange = { confirmDeleteChecked = it }
                )
                Text(
                    text = "I understand this action permanently erases my personal account data.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = {
                    onRequestAccountDeletion { ok, message ->
                        isDeletionError = !ok
                        statusBanner = message
                    }
                },
                enabled = confirmDeleteChecked,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
            ) {
                Text("Delete My Account & Purge Personal Data")
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FamilySecurityAndSyncSettingsScreen(
    biometricLockEnabled: Boolean,
    isBiometricHardwareReady: Boolean,
    canScheduleExactAlarms: Boolean,
    currentRole: FamilyRole,
    initialBackendUrl: String,
    initialBearerToken: String,
    onToggleBiometricLock: (Boolean) -> Unit,
    onLockNow: () -> Unit,
    onSaveEncryptedSyncConfig: (String, String) -> Unit,
    onRequestNotificationPermission: () -> Unit,
    onOpenExactAlarmSettings: () -> Unit,
    onChangeActorRole: (FamilyRole) -> Unit,
    onOpenUserProfileAndAccount: () -> Unit = {},
    onRevokeOtherSessions: ((String) -> Unit) -> Unit = {},
    onRequestAccountDeletion: ((Boolean, String) -> Unit) -> Unit = {}
) {
    var backendUrl by remember(initialBackendUrl) { mutableStateOf(initialBackendUrl) }
    var bearerToken by remember(initialBearerToken) { mutableStateOf(initialBearerToken) }
    var savedBanner by remember { mutableStateOf(false) }
    var accountActionBanner by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(FamilyOSSpacing.md),
        verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
    ) {
        Text("Security, Biometrics & Encrypted Sync Settings", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)

        FamilyOSCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Biometric App Lock (AUTH-05)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(
                        if (isBiometricHardwareReady) "Hardware biometric sensor ready" else "Device credential / biometric fallback ready",
                        style = MaterialTheme.typography.bodySmall,
                        color = FamilyOSColors.TextSecondary
                    )
                }
                Switch(
                    checked = biometricLockEnabled,
                    onCheckedChange = onToggleBiometricLock
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(
                onClick = onLockNow,
                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
            ) {
                Text("Lock Session Now")
            }
        }

        FamilyOSCard {
            Text("Encrypted Sync Configuration (AES256_GCM MasterKey)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = backendUrl,
                onValueChange = { backendUrl = it; savedBanner = false },
                label = { Text("Backend Base URL (backend_base_url)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = bearerToken,
                onValueChange = { bearerToken = it; savedBanner = false },
                label = { Text("Auth Bearer Token (auth_bearer_token)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = {
                    onSaveEncryptedSyncConfig(backendUrl, bearerToken)
                    savedBanner = true
                },
                modifier = Modifier.defaultMinSize(minHeight = 48.dp)
            ) {
                Text("Save to EncryptedSharedPreferences")
            }
            if (savedBanner) {
                Text(
                    text = "Saved to EncryptedSharedPreferences (AES256_SIV / AES256_GCM).",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.PrimaryForestGreen
                )
            }
        }

        FamilyOSCard {
            Text("Android 12–15 Notification & Exact Alarm Permissions", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "POST_NOTIFICATIONS is required on Android 13+ (TIRAMISU) and SCHEDULE_EXACT_ALARM on Android 12+ (S / Android 14+ user-granted).",
                style = MaterialTheme.typography.bodySmall,
                color = FamilyOSColors.TextSecondary
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = if (canScheduleExactAlarms) {
                    "Exact Alarm Status (`alarmManager.canScheduleExactAlarms()`): GRANTED"
                } else {
                    "Exact Alarm Status (`alarmManager.canScheduleExactAlarms()`): NOT GRANTED (Using inexact idle fallback)"
                },
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold,
                color = if (canScheduleExactAlarms) FamilyOSColors.PrimaryForestGreen else FamilyOSColors.SoftGold
            )
            Spacer(modifier = Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = onRequestNotificationPermission,
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Verify POST_NOTIFICATIONS Permission")
                }
                if (!canScheduleExactAlarms || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    Button(
                        onClick = onOpenExactAlarmSettings,
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = FamilyOSColors.PrimaryForestGreen)
                    ) {
                        Text("Configure Exact Alarms (ACTION_REQUEST_SCHEDULE_EXACT_ALARM)")
                    }
                }
            }
        }

        FamilyOSCard {
            Text("User Profile, Session Revocation & GDPR Account Deletion (AUTH-06 / AUTH-07)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "Manage your personal account profile, revoke other active sessions, or request self-service GDPR account deletion.",
                style = MaterialTheme.typography.bodySmall,
                color = FamilyOSColors.TextSecondary
            )
            if (!accountActionBanner.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = accountActionBanner!!,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    color = FamilyOSColors.PrimaryForestGreen
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onOpenUserProfileAndAccount,
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Open User Profile & Account")
                }
                OutlinedButton(
                    onClick = {
                        onRevokeOtherSessions { msg -> accountActionBanner = msg }
                    },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Revoke Other Sessions")
                }
                OutlinedButton(
                    onClick = {
                        onRequestAccountDeletion { _, msg -> accountActionBanner = msg }
                    },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp)
                ) {
                    Text("Self-Service Account Deletion")
                }
            }
        }

        FamilyOSCard {
            Text("Active RBAC Role (${currentRole.name})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FamilyRole.entries.forEach { role ->
                    FilterChip(
                        selected = currentRole == role,
                        onClick = { onChangeActorRole(role) },
                        label = { Text(role.name) }
                    )
                }
            }
        }
    }
}



