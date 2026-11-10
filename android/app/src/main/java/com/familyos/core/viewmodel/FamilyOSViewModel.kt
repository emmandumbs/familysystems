package com.familyos.core.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.familyos.FamilyOSApplication
import com.familyos.core.database.*
import com.familyos.core.domain.*
import com.familyos.core.notification.CalendarReminderScheduler
import com.familyos.core.sync.SyncWorker
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Unified Production ViewModel for FamilyOS (Stages 1–3.3.1).
 * Connects all Jetpack Compose screens (including Family Home and People & Relationships)
 * to encrypted Room SQLite repositories, records offline SyncOperations and AuditEvents on every write,
 * enforces the one-family membership rule and role privacy, and manages active FamilyWorkspace session state.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class FamilyOSViewModel(application: Application) : AndroidViewModel(application) {

    private val app = application as FamilyOSApplication
    private val prefs = application.getSharedPreferences("familyos_session_prefs", Application.MODE_PRIVATE)

    private val _activeFamilyId = MutableStateFlow(prefs.getString("active_family_id", "fam-1") ?: "fam-1")
    val activeFamilyId: StateFlow<String> = _activeFamilyId.asStateFlow()

    init {
        viewModelScope.launch {
            try {
                val familyId = _activeFamilyId.value
                app.routineRepository.seedDefaultRoutinesIfEmpty(familyId)
                app.routineRepository.getOrCreateOccurrence("rtn-morning", "2026-11-01", familyId)
                app.routineRepository.getOrCreateOccurrence("rtn-evening", "2026-11-01", familyId)
            } catch (_: Exception) {}
        }
    }

    private val _currentActorRole = MutableStateFlow(FamilyRole.OWNER)
    val currentActorRole: StateFlow<FamilyRole> = _currentActorRole.asStateFlow()

    private val _currentActorMemberId = MutableStateFlow("mem-sarah")
    val currentActorMemberId: StateFlow<String> = _currentActorMemberId.asStateFlow()

    private val _milestones = MutableStateFlow<List<ProjectMilestone>>(
        listOf(
            ProjectMilestone(
                id = "ms-1",
                familyId = "fam-1",
                projectId = "proj-1",
                title = "Finalize monthly subscription budget envelope",
                description = "Audit digital streaming & utility services",
                dueDate = System.currentTimeMillis() + 604800000L,
                status = "PENDING",
                orderIndex = 1,
                progressPercentage = 0
            )
        )
    )
    val milestones: StateFlow<List<ProjectMilestone>> = _milestones.asStateFlow()

    private val _checklistTemplates = MutableStateFlow<List<ChecklistTemplate>>(
        listOf(
            ChecklistTemplate(
                id = "tmpl-1",
                familyId = "fam-1",
                title = "Weekly Household Reset",
                description = "Core weekend family chores and pantry check",
                items = listOf("Pantry Inventory", "Deep Clean Kitchen", "Review Master Calendar")
            )
        )
    )
    val checklistTemplates: StateFlow<List<ChecklistTemplate>> = _checklistTemplates.asStateFlow()

    private val _rewardConfig = MutableStateFlow(
        FamilyRewardConfig(
            familyId = "fam-1",
            enabled = true,
            currencyName = "Family Coins",
            defaultTaskPoints = 15,
            requiresApproval = true
        )
    )
    val rewardConfig: StateFlow<FamilyRewardConfig> = _rewardConfig.asStateFlow()

    val authSessions: StateFlow<List<AuthSessionEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.database.authSessionDao().observeSessionsForUser("usr-sarah-owner") }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())


    private val _announcements = MutableStateFlow(
        listOf(
            FamilyAnnouncement(
                id = "ann-1",
                title = "Autumn Family Council & Sunday Roast",
                body = "Grandma Martha and Grandpa Edward are joining us this Sunday at 4:00 PM.",
                authorName = "Sarah Henderson",
                priority = "IMPORTANT",
                pinned = true
            ),
            FamilyAnnouncement(
                id = "ann-2",
                title = "Winter Emergency Kit & Smoke Detector Check Complete",
                body = "All basement water reserves and dual-sensor smoke detectors verified.",
                authorName = "David Henderson",
                priority = "NORMAL",
                pinned = false
            )
        )
    )
    val announcements: StateFlow<List<FamilyAnnouncement>> = _announcements.asStateFlow()

    private val _reminders = MutableStateFlow(
        listOf(
            HouseholdReminder(
                id = "rem-1",
                title = "Sign Lucas permission slip for Science Museum field trip",
                dueLabel = "Today, 5:00 PM",
                category = "SCHOOL",
                isCompleted = false
            ),
            HouseholdReminder(
                id = "rem-2",
                title = "Replace HVAC MERV-13 air filter in attic unit",
                dueLabel = "Saturday, 10:00 AM",
                category = "MAINTENANCE",
                isCompleted = false
            )
        )
    )
    val reminders: StateFlow<List<HouseholdReminder>> = _reminders.asStateFlow()

    private val _approvedAiSuggestions = MutableStateFlow(
        listOf(
            ApprovedAiSuggestion(
                id = "ai-1",
                title = "Batch Prep Quinoa & Herb Chicken on Wednesday Evening",
                summary = "Approved schedule optimization: shifts 25 mins of prep to Wednesday so Thursday soccer practice stays calm.",
                category = "MEAL_PLAN",
                approvedBy = "Sarah Henderson"
            ),
            ApprovedAiSuggestion(
                id = "ai-2",
                title = "Auto-Sweep $350 Surplus to High-Yield Emergency Reserve",
                summary = "Approved monthly cash-flow rule based on utility envelope savings.",
                category = "BUDGET",
                approvedBy = "David Henderson"
            )
        )
    )
    val approvedAiSuggestions: StateFlow<List<ApprovedAiSuggestion>> = _approvedAiSuggestions.asStateFlow()

    private val _invitations = MutableStateFlow(
        listOf(
            FamilyInvitation(
                id = "inv-uncle-james",
                familyId = "fam-1",
                invitationToken = "fos_inv_james_2026",
                invitedEmail = "james.henderson@familyos.local",
                invitedDisplayName = "Uncle James Henderson",
                targetRole = FamilyRole.MEMBER,
                status = "PENDING",
                expiresAt = System.currentTimeMillis() + 604800000L,
                createdAt = System.currentTimeMillis() - 36000000L
            )
        )
    )
    val invitations: StateFlow<List<FamilyInvitation>> = _invitations.asStateFlow()

    val workspaces: StateFlow<List<FamilyWorkspace>> = app.workspaceRepository
        .observeWorkspaces()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val activeWorkspace: StateFlow<FamilyWorkspace?> = _activeFamilyId
        .flatMapLatest { familyId -> app.workspaceRepository.observeActiveWorkspace(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val pendingSyncCount: StateFlow<Int> = app.syncRepository
        .observePendingSyncCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    val members: StateFlow<List<FamilyMember>> = _activeFamilyId
        .flatMapLatest { familyId -> app.memberRepository.observeMembers(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val familyMembers: StateFlow<List<FamilyMember>> = members

    val relationships: StateFlow<List<FamilyRelationship>> = _activeFamilyId
        .flatMapLatest { familyId -> app.relationshipRepository.observeRelationships(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val goals: StateFlow<List<FamilyGoal>> = _activeFamilyId
        .flatMapLatest { familyId -> app.goalsRepository.observeGoals(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val projects: StateFlow<List<Project>> = _activeFamilyId
        .flatMapLatest { familyId -> app.goalsRepository.observeProjects(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val tasks: StateFlow<List<Task>> = _activeFamilyId
        .flatMapLatest { familyId -> app.goalsRepository.observeTasks(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val taskChecklistItems: StateFlow<List<TaskChecklistItem>> = tasks
        .flatMapLatest { taskList ->
            if (taskList.isEmpty()) {
                flowOf(emptyList())
            } else {
                combine(
                    taskList.map { t ->
                        app.database.goalsAndTasksDao().observeChecklistItems(t.id).map { entities ->
                            entities.map { e ->
                                TaskChecklistItem(
                                    id = e.id,
                                    taskId = e.taskId,
                                    title = e.title,
                                    isDone = e.isDone,
                                    position = e.position
                                )
                            }
                        }
                    }
                ) { lists -> lists.flatMap { it } }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val recipes: StateFlow<List<Recipe>> = _activeFamilyId
        .flatMapLatest { familyId -> app.recipeRepository.observeRecipes(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val mealPlans: StateFlow<List<MealPlanEntry>> = _activeFamilyId
        .flatMapLatest { familyId ->
            app.mealPlannerRepository.observeWeekMealPlans(familyId, 0L, Long.MAX_VALUE)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val groceryItems: StateFlow<List<GroceryListItem>> = _activeFamilyId
        .flatMapLatest { familyId -> app.groceryRepository.observeGroceryItems(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val chores: StateFlow<List<Chore>> = _activeFamilyId
        .flatMapLatest { familyId -> app.choresRepository.observeChores(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val assets: StateFlow<List<HomeAsset>> = _activeFamilyId
        .flatMapLatest { familyId -> app.assetsRepository.observeAssets(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val wishlist: StateFlow<List<HouseholdWishlist>> = _activeFamilyId
        .flatMapLatest { familyId -> app.assetsRepository.observeWishlist(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val calendarEvents: StateFlow<List<CalendarEvent>> = _activeFamilyId
        .flatMapLatest { familyId -> app.calendarRepository.observeAllEvents(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val routines: StateFlow<List<Routine>> = _activeFamilyId
        .flatMapLatest { familyId -> app.routineRepository.observeRoutines(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val routineOccurrences: StateFlow<List<RoutineOccurrence>> = _activeFamilyId
        .flatMapLatest { familyId -> app.routineRepository.observeOccurrencesForDate(familyId, "2026-11-01") }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Master Stage 2 Milestone 2.A: Food Pantry & Wardrobe StateFlows
    val pantryItems: StateFlow<List<com.familyos.core.database.PantryItemEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.householdRepository.observePantryItems(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val wardrobeItems: StateFlow<List<com.familyos.core.database.WardrobeItemEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.householdRepository.observeWardrobeItems(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val outfitPlans: StateFlow<List<com.familyos.core.database.OutfitPlanEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.householdRepository.observeOutfitPlans(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())



    val accounts: StateFlow<List<FinancialAccount>> = _activeFamilyId
        .flatMapLatest { familyId -> app.financeRepository.observeAccounts(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val transactions: StateFlow<List<FinancialTransaction>> = _activeFamilyId
        .flatMapLatest { familyId -> app.financeRepository.observeTransactions(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val budgets: StateFlow<List<EnvelopeBudget>> = combine(
        _activeFamilyId.flatMapLatest { familyId -> app.financeRepository.observeBudgets(familyId) },
        transactions
    ) { budgetList, txList ->
        budgetList.map { budget ->
            val computedSpent = txList
                .filter {
                    it.transactionType == TransactionType.EXPENSE &&
                        !it.isReversal &&
                        it.category.equals(budget.category, ignoreCase = true)
                }
                .sumOf { it.amountCents }
            budget.copy(spentCents = if (computedSpent > 0L || txList.isNotEmpty()) computedSpent else budget.spentCents)
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val bills: StateFlow<List<BillSubscription>> = _activeFamilyId
        .flatMapLatest { familyId -> app.financeRepository.observeBills(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val savingsGoals: StateFlow<List<SavingsGoal>> = _activeFamilyId
        .flatMapLatest { familyId -> app.financeRepository.observeSavingsGoals(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val investmentHoldings: StateFlow<List<InvestmentHolding>> = _activeFamilyId
        .flatMapLatest { familyId -> app.financeRepository.observeInvestmentHoldings(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val wellbeingProfiles: StateFlow<List<MemberWellbeingProfile>> = _activeFamilyId
        .flatMapLatest { familyId -> app.wellbeingRepository.observeProfiles(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allergies: StateFlow<List<HealthAllergy>> = members
        .flatMapLatest { memberList ->
            if (memberList.isEmpty()) {
                flowOf(emptyList())
            } else {
                combine(memberList.map { m -> app.wellbeingRepository.observeAllergiesForMember(m.id) }) { lists ->
                    lists.flatMap { it }
                }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val medications: StateFlow<List<HealthMedication>> = members
        .flatMapLatest { memberList ->
            if (memberList.isEmpty()) {
                flowOf(emptyList())
            } else {
                combine(memberList.map { m -> app.wellbeingRepository.observeMedicationsForMember(m.id) }) { lists ->
                    lists.flatMap { it }
                }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val vaccinations: StateFlow<List<HealthVaccination>> = members
        .flatMapLatest { memberList ->
            if (memberList.isEmpty()) {
                flowOf(emptyList())
            } else {
                combine(memberList.map { m -> app.wellbeingRepository.observeVaccinationsForMember(m.id) }) { lists ->
                    lists.flatMap { it }
                }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val appointments: StateFlow<List<HealthcareAppointment>> = _activeFamilyId
        .flatMapLatest { familyId -> app.wellbeingRepository.observeAppointments(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val emergencyContacts: StateFlow<List<EmergencyContact>> = _activeFamilyId
        .flatMapLatest { familyId -> app.emergencyRepository.observeContacts(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val emergencyPlan: StateFlow<EmergencyPlan?> = _activeFamilyId
        .flatMapLatest { familyId -> app.emergencyRepository.observePlan(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val emergencySupplies: StateFlow<List<EmergencySupply>> = _activeFamilyId
        .flatMapLatest { familyId -> app.emergencyRepository.observeSupplies(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val emergencyChecklist: StateFlow<List<EmergencyChecklistItem>> = _activeFamilyId
        .flatMapLatest { familyId -> app.emergencyRepository.observeChecklist(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val recentAudits: StateFlow<List<AuditEventEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.database.auditEventDao().observeRecentAudits(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Stage 3.4 Family Section & Extended Heritage Map StateFlows (backed by FamilySectionRepository)
    val galleryAlbums: StateFlow<List<FamilyGalleryAlbumEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.familySectionRepository.observeAlbums(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val galleryPhotos: StateFlow<List<FamilyGalleryPhotoEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.familySectionRepository.observePhotos(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val constitutionVersions: StateFlow<List<FamilyConstitutionVersionEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.familySectionRepository.observeConstitutionVersions(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val traditions: StateFlow<List<FamilyTraditionEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.familySectionRepository.observeTraditions(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val sharedActivities: StateFlow<List<FamilySharedActivityEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.familySectionRepository.observeSharedActivities(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val familyRules: StateFlow<List<FamilyRuleEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.familySectionRepository.observeRules(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val extendedRelatives: StateFlow<List<FamilyExtendedRelativeEntity>> = _activeFamilyId
        .flatMapLatest { familyId -> app.familySectionRepository.observeExtendedRelatives(familyId) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Master Stage 4/5 Global Full-Text Search (FTS4) StateFlows (backed by SearchRepository)
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    val searchResults: StateFlow<List<UnifiedSearchResult>> = combine(_activeFamilyId, _searchQuery) { familyId, query ->
        familyId to query
    }.flatMapLatest { (familyId, query) ->
        app.searchRepository.searchAll(familyId, query)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        ensureInitialWorkspaceSeeded()
    }

    private fun ensureInitialWorkspaceSeeded() {
        viewModelScope.launch {
            val existingWorkspaces = app.workspaceRepository.observeWorkspaces().first()
            if (existingWorkspaces.isNotEmpty()) {
                val currentId = _activeFamilyId.value
                if (existingWorkspaces.none { it.id == currentId }) {
                    setActiveWorkspace(existingWorkspaces.first().id)
                }
                return@launch
            }

            // Seed initial persistent workspace into Room on first cold launch so all screens are backed by real SQLite data
            val created = app.workspaceRepository.createWorkspace(
                name = "The Henderson Household",
                currencyCode = "USD",
                ownerUserId = "usr-sarah-owner"
            ).getOrNull() ?: return@launch

            app.workspaceRepository.updateWorkspace(
                workspaceId = created.id,
                name = "The Henderson Household",
                description = "Stewardship, Kindness, and Calm Preparedness in Every Season."
            )

            setActiveWorkspace(created.id)
            val familyId = created.id

            val sarah = app.memberRepository.addMember(familyId, "Sarah Henderson", "SPOUSE", false).getOrNull()
            val lucas = app.memberRepository.addMember(familyId, "Lucas Henderson", "CHILD", true).getOrNull()
            val maya = app.memberRepository.addMember(familyId, "Maya Henderson", "CHILD", false).getOrNull()
            val martha = app.memberRepository.addMember(familyId, "Grandma Martha", "GRANDPARENT", false).getOrNull()

            if (sarah != null && lucas != null) {
                app.relationshipRepository.addRelationship(familyId, sarah.id, lucas.id, RelationshipType.PARENT_CHILD, "Mother & Son")
            }
            if (sarah != null && maya != null) {
                app.relationshipRepository.addRelationship(familyId, sarah.id, maya.id, RelationshipType.PARENT_CHILD, "Mother & Daughter")
            }
            if (martha != null && sarah != null) {
                app.relationshipRepository.addRelationship(familyId, martha.id, sarah.id, RelationshipType.PARENT_CHILD, "Grandmother & Mother")
            }

            // Initial Calendar Events (Today's Agenda & Upcoming Events)
            app.calendarRepository.addEvent(
                CalendarEvent(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    title = "Morning School Drop-off & Instrument Check",
                    eventDate = System.currentTimeMillis(),
                    eventTimeMillis = System.currentTimeMillis(),
                    category = CalendarEventCategory.FAMILY_EVENT,
                    sourceEntityId = null,
                    description = "07:45 AM • Oakridge Academy"
                )
            )
            app.calendarRepository.addEvent(
                CalendarEvent(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    title = "Sunday Multi-Generational Roast with Grandma Martha",
                    eventDate = System.currentTimeMillis() + 172800000L,
                    eventTimeMillis = System.currentTimeMillis() + 172800000L,
                    category = CalendarEventCategory.FAMILY_EVENT,
                    sourceEntityId = null,
                    description = "04:00 PM • Family Dining Room"
                )
            )

            // Initial Goals & Tasks (including an Overdue task for Family Home verification)
            val goal = app.goalsRepository.createGoal(
                familyId = familyId,
                title = "Build 6-Month Emergency Reserve",
                description = "Reach $35,000 in high-yield liquid family savings",
                category = GoalCategory.FINANCIAL,
                targetDate = System.currentTimeMillis() + 15552000000L,
                priority = Priority.HIGH,
                ownerMemberId = sarah?.id
            ).getOrNull()

            val proj = app.goalsRepository.createProject(
                familyId = familyId,
                goalId = goal?.id,
                name = "Automate Monthly Savings Sweep",
                budgetCents = 150000L,
                targetDate = System.currentTimeMillis() + 2592000000L
            ).getOrNull()

            app.goalsRepository.createTask(
                familyId = familyId,
                projectId = proj?.id,
                parentTaskId = null,
                title = "Review recurring utility & streaming subscriptions",
                assignedMemberId = sarah?.id,
                priority = Priority.HIGH,
                dueDate = System.currentTimeMillis() + 604800000L
            )

            app.goalsRepository.createTask(
                familyId = familyId,
                projectId = proj?.id,
                parentTaskId = null,
                title = "Flush basement tankless water heater descaling loop",
                assignedMemberId = sarah?.id,
                priority = Priority.URGENT,
                dueDate = System.currentTimeMillis() - 86400000L // Overdue task
            )

            // Initial Recipe, Meal & Grocery
            val recipe = app.recipeRepository.createRecipe(
                Recipe(
                    id = "sample-recipe-1",
                    familyId = familyId,
                    title = "Herb-Roasted Lemon Chicken & Quinoa",
                    description = "One-pan Mediterranean weeknight family dinner",
                    imageUri = null,
                    prepTimeMinutes = 15,
                    cookTimeMinutes = 35,
                    servings = 4,
                    difficulty = RecipeDifficulty.EASY,
                    category = "Dinner",
                    dietaryNotes = "Gluten-Free, Nut-Free",
                    familyRating = 5,
                    isFavorite = true,
                    source = "Family Kitchen Binder",
                    storageInstructions = "Refrigerate in airtight glass container up to 3 days",
                    ingredients = listOf(
                        RecipeIngredient("ing-1", "sample-recipe-1", "Organic Chicken Breast", 1.5, "lbs", null),
                        RecipeIngredient("ing-2", "sample-recipe-1", "Tri-Color Quinoa", 2.0, "cups", "Rinsed"),
                        RecipeIngredient("ing-3", "sample-recipe-1", "Fresh Meyer Lemons", 2.0, "whole", "Juiced")
                    ),
                    instructions = listOf(
                        RecipeInstruction("inst-1", "sample-recipe-1", 1, "Preheat oven to 400°F and season chicken with herbs and lemon."),
                        RecipeInstruction("inst-2", "sample-recipe-1", 2, "Simmer rinsed quinoa for 15 minutes until fluffy and serve warm.")
                    )
                )
            ).getOrNull()

            app.mealPlannerRepository.addMealPlan(
                MealPlanEntry(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    planDate = System.currentTimeMillis(),
                    mealType = MealType.DINNER,
                    recipeId = recipe?.id,
                    customMealTitle = "Herb-Roasted Lemon Chicken & Quinoa",
                    servings = 4,
                    notes = "Serve with steamed broccoli"
                )
            )

            app.groceryRepository.addGroceryItem(familyId, "Organic Chicken Breast", "MEAT", 1.5, "lbs", recipe?.id)
            app.groceryRepository.addGroceryItem(familyId, "Tri-Color Quinoa", "PANTRY", 2.0, "cups", recipe?.id)

            // Initial Chores & Home Assets
            app.choresRepository.createChore(
                Chore(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    title = "Empty Dishwasher & Wipe Counters",
                    description = "Before school bus arrives",
                    assignedMemberId = lucas?.id,
                    zone = "KITCHEN",
                    frequency = ChoreFrequency.DAILY,
                    rewardPoints = 15,
                    nextDueDate = System.currentTimeMillis() + 86400000L,
                    requiresVerification = true,
                    isCompleted = false
                )
            )

            app.assetsRepository.addAsset(
                HomeAsset(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    name = "Bosch 800 Series Dishwasher",
                    category = AssetCategory.APPLIANCES,
                    description = "Stainless steel ultra-quiet",
                    purchaseDate = System.currentTimeMillis() - 31536000000L,
                    purchasePriceCents = 129900L,
                    warrantyExpiryDate = System.currentTimeMillis() + 31536000000L,
                    serialNumber = "BSH-800-99281",
                    location = "Kitchen",
                    nextMaintenanceDate = System.currentTimeMillis() + 7776000000L
                )
            )

            // Initial Finance Accounts, Budgets & Transactions
            val checkingId = "acc-checking-$familyId"
            val savingsId = "acc-savings-$familyId"
            app.financeRepository.createAccount(
                FinancialAccount(
                    id = checkingId,
                    familyId = familyId,
                    name = "Household Main Checking",
                    accountType = AccountType.CHECKING,
                    currentBalanceCents = 845250L,
                    isLiability = false,
                    currency = "USD",
                    institution = "Heritage Credit Union",
                    isArchived = false,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )
            )
            app.financeRepository.createAccount(
                FinancialAccount(
                    id = savingsId,
                    familyId = familyId,
                    name = "High-Yield Family Emergency Reserve",
                    accountType = AccountType.SAVINGS,
                    currentBalanceCents = 3420000L,
                    isLiability = false,
                    currency = "USD",
                    institution = "Ally Bank",
                    isArchived = false,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )
            )
            app.financeRepository.setBudget(
                EnvelopeBudget(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    category = "FOOD",
                    allocatedCents = 120000L,
                    spentCents = 0L,
                    monthEpoch = 1700000000000L,
                    alertThresholdPercentage = 85
                )
            )
            app.financeRepository.setBudget(
                EnvelopeBudget(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    category = "UTILITIES",
                    allocatedCents = 45000L,
                    spentCents = 0L,
                    monthEpoch = 1700000000000L,
                    alertThresholdPercentage = 85
                )
            )
            app.financeRepository.recordExpense(
                FinancialTransaction(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    accountId = checkingId,
                    destinationAccountId = null,
                    title = "Organic Valley Weekly Groceries",
                    amountCents = 14250L,
                    transactionType = TransactionType.EXPENSE,
                    category = "FOOD",
                    transactionDate = System.currentTimeMillis(),
                    isCleared = true,
                    isReversal = false,
                    reversalOfId = null,
                    notes = "Weekly produce and pantry run",
                    paidByMemberId = sarah?.id,
                    createdAt = System.currentTimeMillis()
                )
            )

            // Initial Investment Holdings & Portfolio Account (INV-01)
            val invAccId = "acc-inv-$familyId"
            app.financeRepository.createAccount(
                FinancialAccount(
                    id = invAccId,
                    familyId = familyId,
                    name = "Family Investment Portfolio",
                    accountType = AccountType.INVESTMENT,
                    currentBalanceCents = 1649500L,
                    isLiability = false,
                    currency = "USD",
                    institution = "Vanguard",
                    isArchived = false,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )
            )
            app.financeRepository.saveInvestmentHolding(
                InvestmentHolding(
                    id = "hold-vti-$familyId",
                    familyId = familyId,
                    accountId = invAccId,
                    symbol = "VTI",
                    assetName = "Vanguard Total Stock Market Index ETF",
                    assetType = "ETF",
                    quantityMicroshares = 25_500_000L,
                    costBasisCents = 550_000L,
                    currentPriceCents = 24_000L,
                    currency = "USD",
                    notes = "Core index holding"
                )
            )
            app.financeRepository.saveInvestmentHolding(
                InvestmentHolding(
                    id = "hold-aapl-$familyId",
                    familyId = familyId,
                    accountId = invAccId,
                    symbol = "AAPL",
                    assetName = "Apple Inc.",
                    assetType = "STOCK",
                    quantityMicroshares = 10_000_000L,
                    costBasisCents = 180_000L,
                    currentPriceCents = 22_500L,
                    currency = "USD",
                    notes = "Individual tech holding"
                )
            )
            app.financeRepository.saveInvestmentHolding(
                InvestmentHolding(
                    id = "hold-btc-$familyId",
                    familyId = familyId,
                    accountId = invAccId,
                    symbol = "BTC",
                    assetName = "Bitcoin",
                    assetType = "CRYPTO",
                    quantityMicroshares = 125_000L,
                    costBasisCents = 600_000L,
                    currentPriceCents = 6_500_000L,
                    currency = "USD",
                    notes = "Digital store of value"
                )
            )

            // Initial Savings Goals
            app.financeRepository.saveSavingsGoal(
                SavingsGoal(
                    id = "goal-college-$familyId",
                    familyId = familyId,
                    linkedAccountId = savingsId,
                    title = "Lucas College Fund (529 Plan)",
                    targetCents = 5_000_000L,
                    currentCents = 1_850_000L,
                    plannedMonthlyContributionCents = 50_000L,
                    targetDate = System.currentTimeMillis() + 315360000000L
                )
            )
            app.financeRepository.saveSavingsGoal(
                SavingsGoal(
                    id = "goal-vacation-$familyId",
                    familyId = familyId,
                    linkedAccountId = savingsId,
                    title = "Summer Family Trip to National Parks",
                    targetCents = 600_000L,
                    currentCents = 420_000L,
                    plannedMonthlyContributionCents = 30_000L,
                    targetDate = System.currentTimeMillis() + 15552000000L
                )
            )

            // Initial Emergency Contact & Plan
            app.emergencyRepository.saveContact(
                EmergencyContact(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    name = "Sarah Henderson (Primary Guardian)",
                    relationship = "Mother",
                    phonePrimary = "555-123-4567",
                    phoneSecondary = null,
                    isPrimary = true,
                    notes = "Direct mobile"
                )
            )
            app.emergencyRepository.savePlan(
                EmergencyPlan(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    primaryMeetingPoint = "Front lawn beneath large oak tree by sidewalk",
                    secondaryMeetingPoint = "Community Park East Gazebo (Corner of 5th & Pine)",
                    evacuationRoute = "Main hallway and front porch exit",
                    gasShutoffLocation = "Outside meter on east exterior wall (Wrench attached)",
                    waterShutoffLocation = "Basement north wall by street meter",
                    electricalPanelLocation = "Garage west wall next to entry door (200A main toggle)",
                    notes = "Test smoke detectors monthly"
                )
            )
            app.emergencyRepository.saveSupply(
                EmergencySupply(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    itemName = "Drinking Water Reserve (12 Gallons)",
                    category = "WATER",
                    quantity = "12 gallons (4-day supply)",
                    storageLocation = "Basement pantry",
                    expiryDate = System.currentTimeMillis() + 15552000000L,
                    isChecked = true
                )
            )
            app.emergencyRepository.saveChecklistItem(
                EmergencyChecklistItem(
                    id = UUID.randomUUID().toString(),
                    familyId = familyId,
                    title = "Test smoke and CO detectors on all floors",
                    category = "ANNUAL_REVIEW",
                    isCompleted = true,
                    assignedMemberId = sarah?.displayName,
                    completedAt = System.currentTimeMillis()
                )
            )

            // Initial Family Section & Extended Heritage Map records (Room v7/v9 + FTS4 traditions)
            app.familySectionRepository.saveConstitutionVersion(
                FamilyConstitutionVersionEntity(
                    id = "const-v1-$familyId",
                    familyId = familyId,
                    versionNumber = 1,
                    motto = "Stewardship, Kindness, and Calm Preparedness in Every Season.",
                    missionStatement = "To cultivate a loving, resilient, and generous household where every member thrives.",
                    visionStatement = "A multi-generational family anchored in trust, wisdom, and shared purpose.",
                    coreValuesJson = "[\"Stewardship\",\"Gratitude\",\"Integrity\",\"Hospitality\"]",
                    acknowledgmentsJson = "[\"Sarah Henderson\",\"Lucas Henderson\",\"Maya Henderson\"]",
                    editedByUserId = "usr-sarah-owner"
                )
            )
            app.familySectionRepository.saveTradition(
                FamilyTraditionEntity(
                    id = "trad-sunday-roast-$familyId",
                    familyId = familyId,
                    title = "Sunday Multi-Generational Roast & Storytelling",
                    category = "Weekly",
                    cadence = "Every Sunday 4:00 PM",
                    nextOccurrenceDate = "2026-11-15",
                    originStory = "Started by Grandma Martha to gather all generations around the table each week.",
                    linkedRecipeId = recipe?.id
                )
            )
            app.familySectionRepository.saveAlbum(
                FamilyGalleryAlbumEntity(
                    id = "alb-autumn-$familyId",
                    familyId = familyId,
                    title = "Autumn Harvest & Family Reunions",
                    description = "Milestones, orchard visits, and Sunday dinners.",
                    category = "Family Memories",
                    createdByUserId = "usr-sarah-owner"
                )
            )
            app.familySectionRepository.saveSharedActivity(
                FamilySharedActivityEntity(
                    id = "act-park-$familyId",
                    familyId = familyId,
                    title = "Saturday Botanical Garden Walk & Picnic",
                    category = "Outdoors",
                    dateIso = "2026-11-14",
                    location = "Oakridge Botanical Gardens",
                    budgetCents = 4500L,
                    status = "PLANNED"
                )
            )
            app.familySectionRepository.saveRule(
                FamilyRuleEntity(
                    id = "rule-devices-$familyId",
                    familyId = familyId,
                    title = "Device-Free Family Dining Table",
                    category = "Digital Wellbeing",
                    description = "All phones and tablets rest in the charging basket during family meals.",
                    appliesToRole = "ALL"
                )
            )
            app.familySectionRepository.saveExtendedRelative(
                FamilyExtendedRelativeEntity(
                    id = "ext-martha-$familyId",
                    familyId = familyId,
                    fullName = "Martha Evelyn Henderson",
                    relationshipLabel = "Maternal Grandmother",
                    lineageSide = "MATERNAL",
                    generation = "GRANDPARENTS",
                    birthYear = 1954,
                    occupation = "Retired Botanist & Master Gardener",
                    city = "Savannah",
                    country = "USA",
                    growthAreasJson = "[\"Heirloom seed preservation\",\"Family oral history\"]",
                    encouragementNotesJson = "[\"Call every Sunday afternoon\"]"
                )
            )
        }
    }

    fun setActiveWorkspace(workspaceId: String) {
        _activeFamilyId.value = workspaceId
        prefs.edit().putString("active_family_id", workspaceId).apply()
    }

    fun setActorRole(role: FamilyRole, memberId: String = _currentActorMemberId.value) {
        _currentActorRole.value = role
        _currentActorMemberId.value = memberId
    }

    fun updateFamilyIdentity(
        name: String,
        motto: String,
        mission: String = "",
        vision: String = "",
        values: List<String> = emptyList()
    ) {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canManageFamilyMembers(_currentActorRole.value)) return@launch
            val familyId = _activeFamilyId.value
            val summaryDesc = buildString {
                append(motto.trim())
                if (mission.isNotBlank()) append(" | Mission: ${mission.trim()}")
                if (vision.isNotBlank()) append(" | Vision: ${vision.trim()}")
            }
            app.workspaceRepository.updateWorkspace(familyId, name.trim(), summaryDesc)
            enqueueSyncAndAudit(
                "FAMILY_WORKSPACE",
                familyId,
                "UPDATE",
                """{"name":"${name.trim()}","motto":"${motto.trim()}","mission":"${mission.trim()}","vision":"${vision.trim()}","valuesCount":${values.size}}""",
                "Updated family identity, mission & vision"
            )
        }
    }

    fun postAnnouncement(title: String, body: String, priority: String = "IMPORTANT") {
        viewModelScope.launch {
            val ann = FamilyAnnouncement(
                id = "ann-${System.currentTimeMillis()}",
                title = title.trim(),
                body = body.trim(),
                authorName = members.value.firstOrNull()?.displayName ?: "Family Head",
                priority = priority,
                pinned = priority == "IMPORTANT"
            )
            _announcements.value = listOf(ann) + _announcements.value
            enqueueSyncAndAudit("ANNOUNCEMENT", ann.id, "INSERT", """{"title":"${ann.title}"}""", "Posted announcement ${ann.title}")
        }
    }

    fun postFamilyAnnouncement(title: String, body: String, isPinned: Boolean = false) {
        postAnnouncement(title, body, if (isPinned) "IMPORTANT" else "NORMAL")
    }

    fun toggleReminderCompleted(reminderId: String) {
        _reminders.value = _reminders.value.map { r ->
            if (r.id == reminderId) r.copy(isCompleted = !r.isCompleted) else r
        }
    }

    fun addReminder(title: String, dueLabel: String) {
        viewModelScope.launch {
            val rem = HouseholdReminder(
                id = "rem-${System.currentTimeMillis()}",
                title = title.trim(),
                dueLabel = dueLabel.ifBlank { "Today" }
            )
            _reminders.value = listOf(rem) + _reminders.value
            enqueueSyncAndAudit("REMINDER", rem.id, "INSERT", """{"title":"${rem.title}"}""", "Added reminder ${rem.title}")
        }
    }

    fun createNewWorkspace(
        name: String,
        currencyCode: String = "USD",
        ownerUserId: String = "usr-owner-${System.currentTimeMillis()}",
        ownerDisplayName: String? = null,
        motto: String? = null
    ) {
        viewModelScope.launch {
            val result = app.workspaceRepository.createWorkspace(
                name = name,
                currencyCode = currencyCode,
                ownerUserId = ownerUserId,
                ownerDisplayName = ownerDisplayName,
                motto = motto
            )
            result.onSuccess { ws ->
                setActiveWorkspace(ws.id)
                enqueueSyncAndAudit("FAMILY_WORKSPACE", ws.id, "INSERT", """{"name":"${ws.name}"}""", "Created workspace ${ws.name}")
            }
        }
    }

    fun addFamilyMember(
        displayName: String,
        relationship: String,
        isRestricted: Boolean,
        dietaryPreferences: List<String> = emptyList(),
        allergies: List<String> = emptyList()
    ) {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canManageFamilyMembers(_currentActorRole.value)) return@launch
            val familyId = _activeFamilyId.value
            val normalizedRel = relationship.uppercase().trim().ifBlank { "OTHER" }
            val effectiveRestricted = isRestricted || normalizedRel == "CHILD"
            val result = app.memberRepository.addMember(familyId, displayName.trim(), normalizedRel, effectiveRestricted)
            result.onSuccess { member ->
                val cleanDietary = dietaryPreferences.map { it.trim() }.filter { it.isNotBlank() }
                val cleanAllergies = allergies.map { it.trim() }.filter { it.isNotBlank() }
                if (cleanDietary.isNotEmpty() || cleanAllergies.isNotEmpty()) {
                    app.memberRepository.updateMember(
                        member.copy(
                            dietaryPreferences = cleanDietary,
                            allergies = cleanAllergies,
                            isRestrictedProfile = effectiveRestricted
                        )
                    )
                }
                val dietaryJson = "[${cleanDietary.joinToString(",") { "\"$it\"" }}]"
                val allergiesJson = "[${cleanAllergies.joinToString(",") { "\"$it\"" }}]"
                enqueueSyncAndAudit(
                    "FAMILY_MEMBER",
                    member.id,
                    "INSERT",
                    """{"displayName":"${member.displayName}","relationshipToPrimary":"$normalizedRel","isRestrictedProfile":$effectiveRestricted,"dietaryPreferences":$dietaryJson,"allergies":$allergiesJson}""",
                    "Added member ${member.displayName} ($normalizedRel)"
                )
            }
        }
    }

    fun updateFamilyMemberProfile(member: FamilyMember) {
        viewModelScope.launch {
            val result = app.memberRepository.updateMember(member)
            result.onSuccess {
                enqueueSyncAndAudit(
                    "FAMILY_MEMBER",
                    member.id,
                    "UPDATE",
                    """{"displayName":"${member.displayName}","relationshipToPrimary":"${member.relationshipToPrimary}","pointsBalance":${member.pointsBalance}}""",
                    "Updated profile for ${member.displayName}"
                )
            }
        }
    }

    fun updateMemberProfile(
        memberId: String,
        displayName: String,
        relationshipToPrimary: String,
        responsibilities: List<String>,
        emergencyContactName: String,
        emergencyContactPhone: String,
        personalNotes: String,
        sharedBio: String
    ) {
        viewModelScope.launch {
            val existing = members.value.find { it.id == memberId } ?: return@launch
            val updated = existing.copy(
                displayName = displayName.trim(),
                relationshipToPrimary = relationshipToPrimary.trim(),
                responsibilities = responsibilities,
                emergencyContactName = emergencyContactName.trim(),
                emergencyContactPhone = emergencyContactPhone.trim(),
                personalNotes = personalNotes.trim(),
                sharedBio = sharedBio.trim()
            )
            updateFamilyMemberProfile(updated)
        }
    }

    fun removeFamilyMember(memberId: String) {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canManageFamilyMembers(_currentActorRole.value)) return@launch
            val result = app.memberRepository.removeMember(memberId)
            result.onSuccess {
                enqueueSyncAndAudit(
                    "FAMILY_MEMBER",
                    memberId,
                    "DELETE",
                    """{"id":"$memberId","isDeleted":true}""",
                    "Removed member & revoked access ($memberId)"
                )
            }
        }
    }

    fun inviteMember(email: String, displayName: String, targetRole: FamilyRole = FamilyRole.MEMBER) {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canManageFamilyMembers(_currentActorRole.value)) return@launch
            val inv = FamilyInvitation(
                id = "inv-${System.currentTimeMillis()}",
                familyId = _activeFamilyId.value,
                invitationToken = "fos_inv_${System.currentTimeMillis()}",
                invitedEmail = email.trim(),
                invitedDisplayName = displayName.trim(),
                targetRole = targetRole,
                status = "PENDING",
                expiresAt = System.currentTimeMillis() + 604800000L,
                createdAt = System.currentTimeMillis()
            )
            _invitations.value = listOf(inv) + _invitations.value
            enqueueSyncAndAudit("INVITATION", inv.id, "INSERT", """{"invitedEmail":"${inv.invitedEmail}","targetRole":"${inv.targetRole.name}"}""", "Invited ${inv.invitedDisplayName}")
        }
    }

    fun inviteFamilyMember(email: String, displayName: String, role: FamilyRole = FamilyRole.MEMBER) {
        inviteMember(email, displayName, role)
    }

    fun approveInvitation(invitationId: String) {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canManageFamilyMembers(_currentActorRole.value)) return@launch
            val inv = _invitations.value.find { it.id == invitationId } ?: return@launch
            _invitations.value = _invitations.value.map {
                if (it.id == invitationId) it.copy(status = "APPROVED") else it
            }
            addFamilyMember(inv.invitedDisplayName, "OTHER", inv.targetRole == FamilyRole.GUEST)
        }
    }

    fun approveMemberAccess(memberId: String) {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canManageFamilyMembers(_currentActorRole.value)) return@launch
            val existing = members.value.find { it.id == memberId } ?: return@launch
            updateFamilyMemberProfile(existing.copy(membershipStatus = "ACTIVE"))
        }
    }

    fun changeMemberRole(memberId: String, newRole: FamilyRole) {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canManageFamilyMembers(_currentActorRole.value)) return@launch
            val existing = members.value.find { it.id == memberId } ?: return@launch
            updateFamilyMemberProfile(existing.copy(role = newRole, isRestrictedProfile = (newRole == FamilyRole.GUEST)))
        }
    }

    fun revokeInvitation(invitationId: String) {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canManageFamilyMembers(_currentActorRole.value)) return@launch
            _invitations.value = _invitations.value.map {
                if (it.id == invitationId) it.copy(status = "REVOKED") else it
            }
        }
    }

    fun addFamilyRelationship(person1Id: String, person2Id: String, type: RelationshipType, notes: String? = null) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val result = app.relationshipRepository.addRelationship(familyId, person1Id, person2Id, type, notes)
            result.onSuccess { rel ->
                enqueueSyncAndAudit(
                    "FAMILY_RELATIONSHIP",
                    rel.id,
                    "INSERT",
                    """{"person1MemberId":"$person1Id","person2MemberId":"$person2Id","relationshipType":"${type.name}"}""",
                    "Linked ${type.name}"
                )
            }
        }
    }

    fun createGoal(
        title: String,
        description: String,
        category: GoalCategory = GoalCategory.HOUSEHOLD,
        priority: Priority = Priority.HIGH,
        scope: GoalScope = GoalScope.FAMILY,
        horizon: GoalHorizon = GoalHorizon.LONG_TERM,
        assignedMemberId: String? = null,
        projectId: String? = null
    ) {
        viewModelScope.launch {
            val actorRole = _currentActorRole.value
            val actorMemberId = _currentActorMemberId.value.ifBlank { members.value.firstOrNull()?.id ?: "mem-sarah" }
            if (actorRole == FamilyRole.GUEST) return@launch
            val requestedAssignee = assignedMemberId?.ifBlank { null } ?: actorMemberId
            val ownerId = if (FamilySecurityPolicy.canAssignTaskToMember(actorRole, actorMemberId, requestedAssignee)) {
                requestedAssignee
            } else {
                actorMemberId
            }
            val familyId = _activeFamilyId.value
            val result = app.goalsRepository.createGoal(
                familyId = familyId,
                title = title,
                description = description,
                category = category,
                targetDate = System.currentTimeMillis() + 7776000000L,
                priority = priority,
                ownerMemberId = ownerId
            )
            result.onSuccess { goal ->
                enqueueSyncAndAudit(
                    "GOAL",
                    goal.id,
                    "INSERT",
                    """{"title":"${goal.title}","category":"${category.name}","priority":"${priority.name}","scope":"${scope.name}","horizon":"${horizon.name}","ownerMemberId":"$ownerId","projectId":"${projectId ?: ""}"}""",
                    "Created ${scope.name} goal ${goal.title}"
                )
            }
        }
    }

    fun createProjectForGoal(
        goalId: String?,
        name: String,
        budgetCents: Long = 0L,
        scope: GoalScope = GoalScope.FAMILY
    ) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val familyId = _activeFamilyId.value
            val result = app.goalsRepository.createProject(
                familyId = familyId,
                goalId = goalId,
                name = name,
                budgetCents = budgetCents,
                targetDate = System.currentTimeMillis() + 2592000000L
            )
            result.onSuccess { proj ->
                enqueueSyncAndAudit(
                    "PROJECT",
                    proj.id,
                    "INSERT",
                    """{"name":"${proj.name}","goalId":"${goalId ?: ""}","scope":"${scope.name}"}""",
                    "Created project ${proj.name}"
                )
            }
        }
    }

    fun createMilestone(projectId: String, title: String, description: String = "") {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val familyId = _activeFamilyId.value
            val milestone = ProjectMilestone(
                id = "ms-${UUID.randomUUID()}",
                familyId = familyId,
                projectId = projectId,
                title = title.trim(),
                description = description.trim().ifBlank { null },
                targetDate = System.currentTimeMillis() + 1209600000L,
                isCompleted = false,
                completedAt = null,
                orderIndex = _milestones.value.count { it.projectId == projectId },
                progressPercent = 0
            )
            _milestones.value = _milestones.value + milestone
            enqueueSyncAndAudit(
                "MILESTONE",
                milestone.id,
                "INSERT",
                """{"projectId":"$projectId","title":"${milestone.title}"}""",
                "Created milestone ${milestone.title}"
            )
        }
    }

    fun toggleMilestoneCompleted(milestoneId: String, isCompleted: Boolean) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val now = System.currentTimeMillis()
            _milestones.value = _milestones.value.map { ms ->
                if (ms.id == milestoneId) {
                    ms.copy(
                        isCompleted = isCompleted,
                        completedAt = if (isCompleted) now else null,
                        progressPercent = if (isCompleted) 100 else 0
                    )
                } else ms
            }
            enqueueSyncAndAudit(
                "MILESTONE",
                milestoneId,
                "UPDATE",
                """{"isCompleted":$isCompleted}""",
                "Updated milestone $milestoneId completion"
            )
        }
    }

    fun createTask(
        title: String,
        priority: Priority = Priority.MEDIUM,
        sourceModule: CanonicalTaskSourceModule = CanonicalTaskSourceModule.GOALS_PROJECTS,
        scope: GoalScope = GoalScope.FAMILY,
        assignedMemberId: String? = null,
        dueDateMillis: Long? = System.currentTimeMillis() + 259200000L,
        recurrenceRule: String? = null,
        notes: String? = null,
        projectId: String? = null,
        category: GoalCategory = GoalCategory.HOUSEHOLD,
        checklistItems: List<String> = emptyList()
    ) {
        viewModelScope.launch {
            val actorRole = _currentActorRole.value
            val actorMemberId = _currentActorMemberId.value.ifBlank { members.value.firstOrNull()?.id ?: "mem-sarah" }
            if (actorRole == FamilyRole.GUEST) return@launch
            val targetAssignee = assignedMemberId?.ifBlank { null } ?: members.value.firstOrNull()?.id ?: actorMemberId
            val verifiedAssignee = if (FamilySecurityPolicy.canAssignTaskToMember(actorRole, actorMemberId, targetAssignee)) {
                targetAssignee
            } else {
                actorMemberId
            }

            val familyId = _activeFamilyId.value
            val effectiveProjectId = projectId?.ifBlank { null } ?: projects.value.firstOrNull()?.id
            val result = app.goalsRepository.createTask(
                familyId = familyId,
                projectId = effectiveProjectId,
                parentTaskId = null,
                title = title,
                assignedMemberId = verifiedAssignee,
                priority = priority,
                dueDate = dueDateMillis
            )
            result.onSuccess { task ->
                checklistItems.map { it.trim() }.filter { it.isNotBlank() }.forEach { stepTitle ->
                    app.goalsRepository.addChecklistItem(task.id, stepTitle)
                }
                if (dueDateMillis != null) {
                    app.calendarRepository.addEvent(
                        CalendarEvent(
                            id = "cal-task-${task.id}",
                            familyId = familyId,
                            title = "Task Due: ${task.title}",
                            eventDate = dueDateMillis,
                            eventTimeMillis = dueDateMillis,
                            category = CalendarEventCategory.GOAL_DUE,
                            sourceEntityId = task.id,
                            description = notes?.ifBlank { null } ?: "Category: ${category.name} • Module: ${sourceModule.name} • Scope: ${scope.name}"
                        )
                    )
                }
                enqueueSyncAndAudit(
                    "TASK",
                    task.id,
                    "INSERT",
                    """{"title":"${task.title}","category":"${category.name}","priority":"${priority.name}","assignedMemberId":"$verifiedAssignee","projectId":"${effectiveProjectId ?: ""}","sourceModule":"${sourceModule.name}","scope":"${scope.name}","recurrenceRule":"${recurrenceRule ?: ""}"}""",
                    "Created canonical task ${task.title} (${sourceModule.name})"
                )
            }
        }
    }

    fun toggleTaskCompleted(taskId: String, isCompleted: Boolean) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val actorMemberId = _currentActorMemberId.value.ifBlank { members.value.firstOrNull()?.id ?: "mem-sarah" }
            app.goalsRepository.setTaskCompleted(taskId, isCompleted, actorMemberId)
            enqueueSyncAndAudit("TASK", taskId, "UPDATE", """{"isCompleted":$isCompleted}""", "Updated task completion")
        }
    }

    fun addTaskChecklistItem(taskId: String, title: String) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val cleanTitle = title.trim()
            if (cleanTitle.isBlank()) return@launch
            val result = app.goalsRepository.addChecklistItem(taskId, cleanTitle)
            result.onSuccess { item ->
                enqueueSyncAndAudit(
                    "TASK_CHECKLIST_ITEM",
                    item.id,
                    "INSERT",
                    """{"taskId":"$taskId","title":"${item.title}","position":${item.position}}""",
                    "Added task checklist item ${item.title}"
                )
            }
        }
    }

    fun toggleTaskChecklistItem(itemId: String, isDone: Boolean) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            app.goalsRepository.setChecklistItemDone(itemId, isDone)
            enqueueSyncAndAudit(
                "TASK_CHECKLIST_ITEM",
                itemId,
                "UPDATE",
                """{"isDone":$isDone}""",
                "Toggled task checklist item $itemId (isDone=$isDone)"
            )
        }
    }

    fun createCalendarEvent(
        title: String,
        eventDate: Long,
        category: CalendarEventCategory = CalendarEventCategory.FAMILY_EVENT,
        description: String? = null,
        scope: String = "FAMILY",
        isAllDay: Boolean = false,
        location: String? = null,
        timezone: String = "America/Los_Angeles",
        recurrenceRule: String? = null,
        recurrenceExceptions: List<String> = emptyList(),
        reminders: List<Int> = listOf(15)
    ) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val familyId = _activeFamilyId.value
            val eventId = "cal-${UUID.randomUUID()}"
            val newEvent = CalendarEvent(
                id = eventId,
                familyId = familyId,
                title = title.trim(),
                eventDate = eventDate,
                eventTimeMillis = if (isAllDay) null else eventDate,
                category = category,
                description = description?.trim(),
                scope = scope,
                isAllDay = isAllDay,
                location = location?.trim(),
                timezone = timezone,
                recurrenceRule = recurrenceRule,
                recurrenceExceptions = recurrenceExceptions,
                reminders = reminders
            )
            app.calendarRepository.addEvent(newEvent)
            enqueueSyncAndAudit(
                "CALENDAR_EVENT",
                eventId,
                "INSERT",
                """{"title":"${newEvent.title}","category":"${category.name}","scope":"$scope","isAllDay":$isAllDay,"timezone":"$timezone"}""",
                "Created calendar event ${newEvent.title}"
            )
            try {
                CalendarReminderScheduler.scheduleEventReminder(getApplication(), newEvent)
            } catch (_: Exception) {}
        }
    }

    fun updateCalendarEvent(
        eventId: String,
        title: String,
        eventDate: Long,
        category: CalendarEventCategory = CalendarEventCategory.FAMILY_EVENT,
        description: String? = null,
        scope: String = "FAMILY",
        isAllDay: Boolean = false,
        location: String? = null,
        timezone: String = "America/Los_Angeles",
        recurrenceRule: String? = null,
        recurrenceExceptions: List<String> = emptyList(),
        reminders: List<Int> = listOf(15)
    ) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val familyId = _activeFamilyId.value
            val updated = CalendarEvent(
                id = eventId,
                familyId = familyId,
                title = title.trim(),
                eventDate = eventDate,
                eventTimeMillis = if (isAllDay) null else eventDate,
                category = category,
                description = description?.trim(),
                scope = scope,
                isAllDay = isAllDay,
                location = location?.trim(),
                timezone = timezone,
                recurrenceRule = recurrenceRule,
                recurrenceExceptions = recurrenceExceptions,
                reminders = reminders
            )
            app.calendarRepository.updateEvent(updated)
            enqueueSyncAndAudit(
                "CALENDAR_EVENT",
                eventId,
                "UPDATE",
                """{"title":"${updated.title}","category":"${category.name}","scope":"$scope","eventDate":$eventDate,"isAllDay":$isAllDay,"timezone":"$timezone"}""",
                "Updated calendar event ${updated.title}"
            )
            try {
                CalendarReminderScheduler.rescheduleEventReminder(getApplication(), updated)
            } catch (_: Exception) {}
        }
    }

    fun deleteCalendarEvent(eventId: String) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            app.calendarRepository.deleteEvent(eventId)
            enqueueSyncAndAudit("CALENDAR_EVENT", eventId, "DELETE", "{}", "Deleted calendar event $eventId")
            try {
                CalendarReminderScheduler.cancelEventReminder(getApplication(), eventId)
            } catch (_: Exception) {}
        }
    }

    fun completeRoutineOccurrence(routineId: String, occurrenceId: String) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val actorMemberId = _currentActorMemberId.value.ifBlank { "mem-sarah" }

            val routine = routines.value.find { it.id == routineId }
            val points = routine?.pointsReward ?: 15

            // Persist locally in encrypted Room SQLite first
            app.routineRepository.completeOccurrence(routineId, occurrenceId, actorMemberId)

            // Award member points in memory
            _familyMembers.value = _familyMembers.value.map { m ->
                if (m.id == actorMemberId) m.copy(pointsBalance = m.pointsBalance + points) else m
            }

            enqueueSyncAndAudit(
                "ROUTINE_OCCURRENCE",
                occurrenceId,
                "UPDATE",
                """{"status":"COMPLETED","points":$points,"routineId":"$routineId","targetDate":"2026-11-01","completedByMemberId":"$actorMemberId"}""",
                "Completed routine occurrence $occurrenceId"
            )
        }
    }

    fun skipRoutineOccurrence(routineId: String, occurrenceId: String, reason: String = "Skipped") {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            app.routineRepository.skipOccurrence(routineId, occurrenceId, reason)
            enqueueSyncAndAudit(
                "ROUTINE_OCCURRENCE",
                occurrenceId,
                "UPDATE",
                """{"status":"SKIPPED","reason":"$reason","routineId":"$routineId","targetDate":"2026-11-01"}""",
                "Skipped routine occurrence $occurrenceId"
            )
        }
    }

    fun toggleRoutineStep(routineId: String, occurrenceId: String, stepId: String, isDone: Boolean) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            app.routineRepository.toggleStep(routineId, occurrenceId, stepId, isDone)
            enqueueSyncAndAudit(
                "ROUTINE_OCCURRENCE",
                occurrenceId,
                "UPDATE",
                """{"routineId":"$routineId","stepId":"$stepId","isDone":$isDone}""",
                "Toggled routine step $stepId on occurrence $occurrenceId"
            )
        }
    }

    fun addRoutine(
        title: String,
        category: RoutineCategory = RoutineCategory.HOUSEHOLD,
        frequency: RoutineFrequency = RoutineFrequency.DAILY,
        targetTimeOfDay: String = "08:00",
        scope: String = "FAMILY",
        steps: List<String> = emptyList(),
        pointsReward: Int = 15,
        description: String? = null
    ) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val familyId = _activeFamilyId.value
            val ownerId = _currentActorMemberId.value.ifBlank { members.value.firstOrNull()?.id ?: "mem-sarah" }
            val routineId = "rtn-${UUID.randomUUID()}"
            val cleanSteps = steps.map { it.trim() }.filter { it.isNotBlank() }
                .ifEmpty { listOf("Prepare & review checklist", "Complete core routine step") }
                .mapIndexed { idx, stepTitle ->
                    RoutineStep(
                        id = "step-${UUID.randomUUID()}",
                        title = stepTitle,
                        orderIndex = idx
                    )
                }
            val routine = Routine(
                id = routineId,
                familyId = familyId,
                title = title.trim(),
                description = description?.trim()?.ifBlank { null },
                category = category,
                frequency = frequency,
                targetTimeOfDay = targetTimeOfDay.trim().ifBlank { "08:00" },
                scope = scope.uppercase().trim().ifBlank { "FAMILY" },
                ownerMemberId = ownerId,
                assignedMemberIds = listOf(ownerId),
                steps = cleanSteps,
                pointsReward = pointsReward.coerceAtLeast(0),
                isPaused = false
            )
            app.routineRepository.saveRoutine(routine)
            app.routineRepository.getOrCreateOccurrence(routineId, "2026-11-01", familyId)
            val stepsJson = "[${cleanSteps.joinToString(",") { "\"${it.title}\"" }}]"
            enqueueSyncAndAudit(
                "ROUTINE",
                routineId,
                "INSERT",
                """{"title":"${routine.title}","category":"${category.name}","frequency":"${frequency.name}","targetTimeOfDay":"${routine.targetTimeOfDay}","scope":"${routine.scope}","pointsReward":${routine.pointsReward},"steps":$stepsJson}""",
                "Created routine ${routine.title}"
            )
            try {
                CalendarReminderScheduler.scheduleRoutineReminder(getApplication(), routine)
            } catch (_: Exception) {}
        }
    }

    fun pauseResumeRoutine(routineId: String, isPaused: Boolean) {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canManageFamilyMembers(_currentActorRole.value)) return@launch
            app.routineRepository.setRoutinePaused(routineId, isPaused)
            enqueueSyncAndAudit("ROUTINE", routineId, "UPDATE", """{"isPaused":$isPaused}""", "Toggled routine paused: $isPaused")
            try {
                if (isPaused) {
                    CalendarReminderScheduler.cancelRoutineReminder(getApplication(), routineId)
                } else {
                    val r = routines.value.find { it.id == routineId }
                    if (r != null) CalendarReminderScheduler.scheduleRoutineReminder(getApplication(), r)
                }
            } catch (_: Exception) {}
        }
    }

    fun convertRoutineToTask(routineId: String, occurrenceId: String) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val routine = routines.value.find { it.id == routineId } ?: return@launch
            val newTaskId = "task-from-$occurrenceId"
            createTask(
                title = "Routine: ${routine.title}",
                priority = Priority.MEDIUM,
                sourceModule = CanonicalTaskSourceModule.GOALS_PROJECTS,
                scope = GoalScope.FAMILY,
                checklistItems = routine.steps.map { it.title }
            )
            app.routineRepository.convertOccurrenceToTask(routineId, occurrenceId, newTaskId)
        }
    }

    fun configureRewardSystem(enabled: Boolean, currencyName: String = "Family Coins") {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canConfigureRewards(_currentActorRole.value)) return@launch
            _rewardConfig.value = _rewardConfig.value.copy(
                enabled = enabled,
                currencyName = currencyName.ifBlank { "Family Coins" }
            )
            enqueueSyncAndAudit(
                "REWARD_CONFIG",
                _activeFamilyId.value,
                "UPDATE",
                """{"enabled":$enabled,"currencyName":"$currencyName","disallowPunitiveDeductions":true}""",
                "Updated optional family reward system (enabled=$enabled)"
            )
        }
    }

    fun addMealPlan(
        title: String,
        mealType: MealType,
        servings: Int,
        recipeId: String? = null,
        notes: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val resolvedRecipeId = recipeId?.ifBlank { null }
            val resolvedTitle = title.trim().ifBlank {
                recipes.value.find { it.id == resolvedRecipeId }?.title ?: "Household Meal"
            }
            val entry = MealPlanEntry(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                planDate = System.currentTimeMillis(),
                mealType = mealType,
                recipeId = resolvedRecipeId,
                customMealTitle = resolvedTitle,
                servings = servings.coerceAtLeast(1),
                notes = notes?.trim()?.ifBlank { null }
            )
            app.mealPlannerRepository.addMealPlan(entry)
            enqueueSyncAndAudit(
                "MEAL_PLAN",
                entry.id,
                "INSERT",
                """{"title":"$resolvedTitle","mealType":"${mealType.name}","recipeId":"${resolvedRecipeId ?: ""}","servings":${entry.servings},"notes":"${entry.notes ?: ""}"}""",
                "Scheduled ${mealType.name} meal $resolvedTitle"
            )
        }
    }

    fun addGroceryItem(
        itemName: String,
        category: String = "PRODUCE",
        quantity: Double = 1.0,
        unit: String = "pcs",
        sourceRecipeId: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val cleanName = itemName.trim()
            if (cleanName.isBlank()) return@launch
            val cleanCat = category.uppercase().trim().ifBlank { "PRODUCE" }
            val cleanUnit = unit.trim().ifBlank { "pcs" }
            val safeQty = if (quantity > 0.0) quantity else 1.0
            val result = app.groceryRepository.addGroceryItem(
                familyId = familyId,
                itemName = cleanName,
                category = cleanCat,
                quantity = safeQty,
                unit = cleanUnit,
                sourceRecipeId = sourceRecipeId
            )
            result.onSuccess { item ->
                enqueueSyncAndAudit(
                    "GROCERY_ITEM",
                    item.id,
                    "INSERT",
                    """{"itemName":"${item.itemName}","category":"${item.category}","quantity":${item.quantity},"unit":"${item.unit}"}""",
                    "Added grocery item ${item.itemName}"
                )
            }
        }
    }

    fun generateGroceryListFromWeek() {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            app.mealPlannerRepository.generateGroceryListFromWeek(familyId, 0L, Long.MAX_VALUE)
            enqueueSyncAndAudit(
                "GROCERY_LIST",
                familyId,
                "UPDATE",
                """{"action":"GENERATE_FROM_WEEK"}""",
                "Generated weekly grocery list from meal plan"
            )
        }
    }

    fun toggleGroceryPurchased(itemId: String, isPurchased: Boolean) {
        viewModelScope.launch {
            app.groceryRepository.setPurchased(itemId, isPurchased)
            enqueueSyncAndAudit(
                "GROCERY_ITEM",
                itemId,
                "UPDATE",
                """{"isPurchased":$isPurchased}""",
                "Toggled grocery item $itemId purchased=$isPurchased"
            )
        }
    }

    fun addRecipe(
        title: String,
        category: String,
        prepMinutes: Int,
        cookMinutes: Int,
        servings: Int,
        dietaryNotes: String? = null,
        ingredients: List<RecipeIngredient> = emptyList(),
        instructions: List<RecipeInstruction> = emptyList()
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val recipeId = UUID.randomUUID().toString()
            val normalizedIngredients = if (ingredients.isNotEmpty()) {
                ingredients.map { ing ->
                    ing.copy(
                        id = ing.id.ifBlank { UUID.randomUUID().toString() },
                        recipeId = recipeId
                    )
                }
            } else {
                listOf(
                    RecipeIngredient(UUID.randomUUID().toString(), recipeId, "$title Main Ingredient", 2.0, "cups", null)
                )
            }
            val normalizedInstructions = if (instructions.isNotEmpty()) {
                instructions.mapIndexed { idx, ins ->
                    ins.copy(
                        id = ins.id.ifBlank { UUID.randomUUID().toString() },
                        recipeId = recipeId,
                        stepNumber = idx + 1
                    )
                }
            } else {
                listOf(
                    RecipeInstruction(UUID.randomUUID().toString(), recipeId, 1, "Prepare ingredients and cook for $cookMinutes minutes.")
                )
            }
            val recipe = Recipe(
                id = recipeId,
                familyId = familyId,
                title = title.trim(),
                description = dietaryNotes?.trim()?.ifBlank { "Family recipe added to library" } ?: "Family recipe added to library",
                imageUri = null,
                prepTimeMinutes = prepMinutes.coerceAtLeast(0),
                cookTimeMinutes = cookMinutes.coerceAtLeast(0),
                servings = servings.coerceAtLeast(1),
                difficulty = RecipeDifficulty.MEDIUM,
                category = category.uppercase().trim().ifBlank { "DINNER" },
                dietaryNotes = dietaryNotes?.trim()?.ifBlank { null },
                familyRating = 5,
                isFavorite = false,
                source = "Family Kitchen",
                storageInstructions = null,
                ingredients = normalizedIngredients,
                instructions = normalizedInstructions
            )
            app.recipeRepository.createRecipe(recipe)
            enqueueSyncAndAudit(
                "RECIPE",
                recipe.id,
                "INSERT",
                """{"title":"${recipe.title}","category":"${recipe.category}","prepTimeMinutes":${recipe.prepTimeMinutes},"cookTimeMinutes":${recipe.cookTimeMinutes},"servings":${recipe.servings},"ingredientCount":${normalizedIngredients.size},"instructionCount":${normalizedInstructions.size}}""",
                "Added recipe ${recipe.title}"
            )
        }
    }

    fun toggleRecipeFavorite(recipeId: String, isFavorite: Boolean) {
        viewModelScope.launch {
            app.recipeRepository.setFavorite(recipeId, isFavorite)
            enqueueSyncAndAudit(
                "RECIPE",
                recipeId,
                "UPDATE",
                """{"isFavorite":$isFavorite}""",
                "Toggled recipe favorite ($recipeId)"
            )
        }
    }

    fun addChore(
        title: String,
        zone: String,
        points: Int,
        frequency: ChoreFrequency = ChoreFrequency.WEEKLY,
        assignedMemberId: String? = null,
        requiresVerification: Boolean = false,
        description: String? = null
    ) {
        viewModelScope.launch {
            val actorRole = _currentActorRole.value
            val actorMemberId = _currentActorMemberId.value.ifBlank { members.value.firstOrNull()?.id ?: "mem-sarah" }
            if (actorRole == FamilyRole.GUEST) return@launch
            val requestedAssignee = assignedMemberId?.ifBlank { null } ?: members.value.firstOrNull()?.id ?: actorMemberId
            val verifiedAssignee = if (FamilySecurityPolicy.canAssignTaskToMember(actorRole, actorMemberId, requestedAssignee)) {
                requestedAssignee
            } else {
                actorMemberId
            }
            val familyId = _activeFamilyId.value
            val chore = Chore(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                title = title.trim(),
                description = description?.trim()?.ifBlank { null },
                assignedMemberId = verifiedAssignee,
                zone = zone.uppercase().trim().ifBlank { "HOME" },
                frequency = frequency,
                rewardPoints = points.coerceAtLeast(0),
                nextDueDate = System.currentTimeMillis() + 86400000L,
                requiresVerification = requiresVerification,
                isCompleted = false
            )
            app.choresRepository.createChore(chore)
            enqueueSyncAndAudit(
                "CHORE",
                chore.id,
                "INSERT",
                """{"title":"${chore.title}","zone":"${chore.zone}","frequency":"${frequency.name}","assignedMemberId":"$verifiedAssignee","points":${chore.rewardPoints},"requiresVerification":$requiresVerification}""",
                "Created chore ${chore.title}"
            )
        }
    }

    fun completeChore(choreId: String) {
        viewModelScope.launch {
            val memberId = members.value.firstOrNull()?.id ?: "mem-default"
            app.choresRepository.completeChore(choreId, memberId)
            enqueueSyncAndAudit("CHORE", choreId, "UPDATE", """{"completedBy":"$memberId"}""", "Completed chore $choreId")
        }
    }

    fun addHomeAsset(
        name: String,
        location: String,
        priceCents: Long,
        category: AssetCategory = AssetCategory.APPLIANCES,
        description: String? = null,
        serialNumber: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val asset = HomeAsset(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                name = name.trim(),
                category = category,
                description = description?.trim()?.ifBlank { null },
                purchaseDate = System.currentTimeMillis(),
                purchasePriceCents = priceCents.coerceAtLeast(0L),
                warrantyExpiryDate = System.currentTimeMillis() + 31536000000L,
                serialNumber = serialNumber?.trim()?.ifBlank { null },
                location = location.trim().ifBlank { "Home" },
                nextMaintenanceDate = System.currentTimeMillis() + 15552000000L
            )
            app.assetsRepository.addAsset(asset)
            enqueueSyncAndAudit(
                "ASSET",
                asset.id,
                "INSERT",
                """{"name":"${asset.name}","category":"${category.name}","location":"${asset.location}","priceCents":${asset.purchasePriceCents}}""",
                "Added home asset ${asset.name}"
            )
        }
    }

    fun addWishlistItem(
        itemName: String,
        estimatedCostCents: Long,
        category: String = "Household",
        priority: Priority = Priority.MEDIUM
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val item = HouseholdWishlist(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                itemName = itemName.trim(),
                estimatedCostCents = estimatedCostCents.coerceAtLeast(0L),
                priority = priority,
                category = category.trim().ifBlank { "Household" },
                url = null
            )
            app.assetsRepository.addWishlistItem(item)
            enqueueSyncAndAudit(
                "WISHLIST_ITEM",
                item.id,
                "INSERT",
                """{"itemName":"${item.itemName}","estimatedCostCents":${item.estimatedCostCents},"category":"${item.category}","priority":"${priority.name}"}""",
                "Added wishlist item ${item.itemName}"
            )
        }
    }

    fun addCalendarEvent(title: String, category: CalendarEventCategory = CalendarEventCategory.FAMILY_EVENT) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val event = CalendarEvent(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                title = title,
                eventDate = System.currentTimeMillis() + 86400000L,
                eventTimeMillis = System.currentTimeMillis() + 86400000L,
                category = category,
                sourceEntityId = null,
                description = "Household scheduled event"
            )
            app.calendarRepository.addEvent(event)
            enqueueSyncAndAudit("CALENDAR_EVENT", event.id, "INSERT", """{"title":"$title"}""", "Added calendar event $title")
        }
    }

    fun addFinancialAccount(
        name: String,
        institution: String,
        balanceCents: Long,
        accountType: AccountType = AccountType.CHECKING
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val isLiability = accountType == AccountType.CREDIT_CARD || accountType == AccountType.LOAN
            val signedBalance = if (isLiability && balanceCents > 0L) -balanceCents else balanceCents
            val account = FinancialAccount(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                name = name.trim(),
                accountType = accountType,
                currentBalanceCents = signedBalance,
                isLiability = isLiability,
                currency = "USD",
                institution = institution.trim().ifBlank { "Local Institution" },
                isArchived = false,
                createdAt = System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis()
            )
            app.financeRepository.createAccount(account)
            enqueueSyncAndAudit(
                "FINANCIAL_ACCOUNT",
                account.id,
                "INSERT",
                """{"name":"${account.name}","accountType":"${accountType.name}","institution":"${account.institution}","balanceCents":$signedBalance,"isLiability":$isLiability}""",
                "Created financial account ${account.name}"
            )
        }
    }

    fun recordFinancialTransaction(
        title: String,
        amountCents: Long,
        category: String,
        type: TransactionType,
        accountId: String? = null,
        paidByMemberId: String? = null,
        notes: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val resolvedAccountId = accountId?.ifBlank { null } ?: accounts.value.firstOrNull()?.id ?: return@launch
            val resolvedPaidBy = paidByMemberId?.ifBlank { null } ?: members.value.firstOrNull()?.id
            val tx = FinancialTransaction(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                accountId = resolvedAccountId,
                destinationAccountId = null,
                title = title.trim(),
                amountCents = kotlin.math.abs(amountCents),
                transactionType = type,
                category = category.uppercase().trim().ifBlank { "OTHER" },
                transactionDate = System.currentTimeMillis(),
                isCleared = true,
                isReversal = false,
                reversalOfId = null,
                notes = notes?.trim()?.ifBlank { null },
                paidByMemberId = resolvedPaidBy,
                createdAt = System.currentTimeMillis()
            )
            if (type == TransactionType.INCOME) {
                app.financeRepository.recordIncome(tx)
            } else {
                app.financeRepository.recordExpense(tx)
            }
            enqueueSyncAndAudit(
                type.name,
                tx.id,
                "INSERT",
                """{"title":"${tx.title}","accountId":"$resolvedAccountId","category":"${tx.category}","amountCents":${tx.amountCents},"paidByMemberId":"${resolvedPaidBy ?: ""}"}""",
                "Recorded ${type.name} ${tx.title}"
            )
        }
    }

    fun recordInternalTransfer(
        amountCents: Long,
        title: String,
        sourceAccountId: String? = null,
        destinationAccountId: String? = null,
        paidByMemberId: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val currentAccounts = accounts.value
            val resolvedSourceId = sourceAccountId?.ifBlank { null } ?: currentAccounts.firstOrNull()?.id ?: return@launch
            val resolvedDestId = destinationAccountId?.ifBlank { null }
                ?: currentAccounts.firstOrNull { it.id != resolvedSourceId }?.id
                ?: currentAccounts.getOrNull(1)?.id
                ?: return@launch
            if (resolvedSourceId == resolvedDestId) return@launch
            val cleanCents = kotlin.math.abs(amountCents)
            app.financeRepository.recordInternalTransfer(
                familyId = familyId,
                sourceAccountId = resolvedSourceId,
                destinationAccountId = resolvedDestId,
                amountCents = cleanCents,
                title = title.trim().ifBlank { "Internal Transfer" },
                notes = "Internal household transfer${paidByMemberId?.let { " by $it" } ?: ""}"
            )
            enqueueSyncAndAudit(
                "TRANSFER",
                UUID.randomUUID().toString(),
                "INSERT",
                """{"sourceAccountId":"$resolvedSourceId","destinationAccountId":"$resolvedDestId","amountCents":$cleanCents,"paidByMemberId":"${paidByMemberId ?: ""}"}""",
                "Transferred $cleanCents cents from $resolvedSourceId to $resolvedDestId"
            )
        }
    }

    fun reverseFinancialTransaction(transactionId: String, reason: String = "User requested audit reversal") {
        viewModelScope.launch {
            app.financeRepository.reverseTransaction(transactionId, reason)
            enqueueSyncAndAudit("REVERSAL", transactionId, "INSERT", """{"originalId":"$transactionId"}""", "Reversed transaction $transactionId")
        }
    }

    fun saveInvestmentHolding(
        symbol: String,
        assetName: String,
        assetType: String,
        quantityMicroshares: Long,
        costBasisCents: Long,
        currentPriceCents: Long,
        accountId: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val targetAccId = accountId ?: accounts.value.firstOrNull { it.accountType == AccountType.INVESTMENT }?.id ?: accounts.value.firstOrNull()?.id ?: "acc-inv"
            val holding = InvestmentHolding(
                id = "hold-${symbol.lowercase()}-${UUID.randomUUID()}",
                familyId = familyId,
                accountId = targetAccId,
                symbol = symbol.uppercase().trim(),
                assetName = assetName.trim(),
                assetType = assetType.uppercase().trim(),
                quantityMicroshares = quantityMicroshares,
                costBasisCents = costBasisCents,
                currentPriceCents = currentPriceCents,
                currency = "USD",
                notes = "Recorded investment holding"
            )
            app.financeRepository.saveInvestmentHolding(holding)
            enqueueSyncAndAudit("INVESTMENT_HOLDING", holding.id, "INSERT", """{"symbol":"$symbol","valCents":${holding.currentValuationCents}}""", "Added investment holding $symbol")
        }
    }

    fun updateHoldingMarketPrice(holdingId: String, newPriceCents: Long) {
        viewModelScope.launch {
            app.financeRepository.updateHoldingMarketPrice(holdingId, newPriceCents)
            enqueueSyncAndAudit("INVESTMENT_HOLDING", holdingId, "UPDATE", """{"newPriceCents":$newPriceCents}""", "Updated holding market price")
        }
    }

    fun deleteInvestmentHolding(holdingId: String) {
        viewModelScope.launch {
            app.financeRepository.deleteInvestmentHolding(holdingId)
            enqueueSyncAndAudit("INVESTMENT_HOLDING", holdingId, "DELETE", "{}", "Deleted investment holding")
        }
    }

    fun addSavingsGoal(
        title: String,
        targetCents: Long,
        plannedMonthlyContributionCents: Long,
        linkedAccountId: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val resolvedAccountId = linkedAccountId?.ifBlank { null }
                ?: accounts.value.firstOrNull { it.accountType == AccountType.SAVINGS }?.id
                ?: accounts.value.firstOrNull()?.id
            val goal = SavingsGoal(
                id = "goal-${UUID.randomUUID()}",
                familyId = familyId,
                linkedAccountId = resolvedAccountId,
                title = title.trim(),
                targetCents = targetCents.coerceAtLeast(0L),
                currentCents = 0L,
                plannedMonthlyContributionCents = plannedMonthlyContributionCents.coerceAtLeast(0L),
                targetDate = System.currentTimeMillis() + 31536000000L
            )
            app.financeRepository.saveSavingsGoal(goal)
            enqueueSyncAndAudit(
                "SAVINGS_GOAL",
                goal.id,
                "INSERT",
                """{"title":"${goal.title}","targetCents":${goal.targetCents},"linkedAccountId":"${resolvedAccountId ?: ""}","plannedMonthlyContributionCents":${goal.plannedMonthlyContributionCents}}""",
                "Created savings goal ${goal.title}"
            )
        }
    }

    fun contributeToSavingsGoal(goalId: String, amountCents: Long) {
        viewModelScope.launch {
            app.financeRepository.contributeToSavingsGoal(goalId, amountCents)
            enqueueSyncAndAudit("SAVINGS_GOAL", goalId, "UPDATE", """{"contributedCents":$amountCents}""", "Contributed to savings goal")
        }
    }

    fun addEnvelopeBudget(category: String, allocatedCents: Long, alertThresholdPercentage: Int = 85) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val cleanCategory = category.uppercase().trim().ifBlank { "GENERAL" }
            val dynamicSpent = transactions.value
                .filter {
                    it.transactionType == TransactionType.EXPENSE &&
                        !it.isReversal &&
                        it.category.equals(cleanCategory, ignoreCase = true)
                }
                .sumOf { it.amountCents }
            val budget = EnvelopeBudget(
                id = "budget-${UUID.randomUUID()}",
                familyId = familyId,
                category = cleanCategory,
                allocatedCents = allocatedCents.coerceAtLeast(0L),
                spentCents = dynamicSpent,
                monthEpoch = System.currentTimeMillis(),
                alertThresholdPercentage = alertThresholdPercentage.coerceIn(1, 100)
            )
            app.financeRepository.setBudget(budget)
            enqueueSyncAndAudit(
                "ENVELOPE_BUDGET",
                budget.id,
                "INSERT",
                """{"category":"$cleanCategory","allocatedCents":${budget.allocatedCents},"alertThresholdPercentage":${budget.alertThresholdPercentage}}""",
                "Set budget for $cleanCategory"
            )
        }
    }

    fun addRecurringBill(
        payee: String,
        amountCents: Long,
        billingCycle: String = "MONTHLY",
        isAutoPay: Boolean = false,
        accountId: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val resolvedAccountId = accountId?.ifBlank { null } ?: accounts.value.firstOrNull()?.id ?: "acc-1"
            val bill = BillSubscription(
                id = "bill-${UUID.randomUUID()}",
                familyId = familyId,
                accountId = resolvedAccountId,
                payee = payee.trim().ifBlank { "Recurring Service" },
                amountCents = amountCents.coerceAtLeast(0L),
                billingCycle = billingCycle.uppercase().trim().ifBlank { "MONTHLY" },
                nextDueDate = System.currentTimeMillis() + 2592000000L,
                isSubscription = true,
                isAutoPay = isAutoPay,
                reminderDaysBefore = 3
            )
            app.financeRepository.saveBill(bill)
            enqueueSyncAndAudit(
                "RECURRING_BILL",
                bill.id,
                "INSERT",
                """{"payee":"${bill.payee}","amountCents":${bill.amountCents},"billingCycle":"${bill.billingCycle}","isAutoPay":$isAutoPay}""",
                "Added recurring bill ${bill.payee}"
            )
        }
    }

    fun addHealthAllergy(
        memberId: String,
        allergen: String,
        severity: String,
        reaction: String,
        treatment: String
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val resolvedMemberId = memberId.ifBlank { members.value.firstOrNull()?.id ?: "mem-sarah" }
            val allergy = HealthAllergy(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                memberId = resolvedMemberId,
                allergen = allergen.trim(),
                severity = severity.uppercase().trim().ifBlank { "MODERATE" },
                reaction = reaction.trim(),
                emergencyTreatment = treatment.trim().ifBlank { null }
            )
            app.wellbeingRepository.addAllergy(allergy)
            enqueueSyncAndAudit(
                "HEALTH_ALLERGY",
                allergy.id,
                "INSERT",
                """{"memberId":"$resolvedMemberId","allergen":"${allergy.allergen}","severity":"${allergy.severity}"}""",
                "Added allergy record ${allergy.allergen}"
            )
        }
    }

    fun addHealthMedication(
        memberId: String,
        medicationName: String,
        dosage: String,
        instructions: String,
        scheduleFrequency: String = "DAILY",
        scheduleTimes: List<String> = listOf("08:00 AM")
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val resolvedMemberId = memberId.ifBlank { members.value.firstOrNull()?.id ?: "mem-sarah" }
            val cleanTimes = scheduleTimes.map { it.trim() }.filter { it.isNotBlank() }.ifEmpty { listOf("08:00 AM") }
            val med = HealthMedication(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                memberId = resolvedMemberId,
                medicationName = medicationName.trim(),
                dosage = dosage.trim(),
                scheduleFrequency = scheduleFrequency.uppercase().trim().ifBlank { "DAILY" },
                scheduleTimes = cleanTimes,
                instructions = instructions.trim().ifBlank { null },
                isActive = true
            )
            app.wellbeingRepository.saveMedication(med)
            val timesJson = "[${cleanTimes.joinToString(",") { "\"$it\"" }}]"
            enqueueSyncAndAudit(
                "HEALTH_MEDICATION",
                med.id,
                "INSERT",
                """{"memberId":"$resolvedMemberId","medicationName":"${med.medicationName}","dosage":"${med.dosage}","scheduleFrequency":"${med.scheduleFrequency}","scheduleTimes":$timesJson}""",
                "Added medication schedule ${med.medicationName}"
            )
        }
    }

    fun addHealthVaccination(
        memberId: String,
        vaccineName: String,
        provider: String? = null,
        lotNumber: String? = null,
        dateAdministered: Long = System.currentTimeMillis(),
        nextBoosterDate: Long? = System.currentTimeMillis() + 31536000000L
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val resolvedMemberId = memberId.ifBlank { members.value.firstOrNull()?.id ?: "mem-sarah" }
            val vaccination = HealthVaccination(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                memberId = resolvedMemberId,
                vaccineName = vaccineName.trim(),
                dateAdministered = dateAdministered,
                nextBoosterDate = nextBoosterDate,
                provider = provider?.trim()?.ifBlank { null },
                lotNumber = lotNumber?.trim()?.ifBlank { null }
            )
            app.wellbeingRepository.recordVaccination(vaccination)
            enqueueSyncAndAudit(
                "HEALTH_VACCINATION",
                vaccination.id,
                "INSERT",
                """{"memberId":"$resolvedMemberId","vaccineName":"${vaccination.vaccineName}","provider":"${vaccination.provider ?: ""}","lotNumber":"${vaccination.lotNumber ?: ""}"}""",
                "Recorded vaccination ${vaccination.vaccineName}"
            )
        }
    }

    fun addHealthcareAppointment(
        memberId: String,
        providerName: String,
        specialty: String,
        appointmentTime: Long = System.currentTimeMillis() + 604800000L,
        location: String? = null,
        notes: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val resolvedMemberId = memberId.ifBlank { members.value.firstOrNull()?.id ?: "mem-sarah" }
            val appt = HealthcareAppointment(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                memberId = resolvedMemberId,
                providerName = providerName.trim(),
                specialty = specialty.trim(),
                appointmentTime = appointmentTime,
                location = location?.trim()?.ifBlank { null },
                notes = notes?.trim()?.ifBlank { null }
            )
            app.wellbeingRepository.scheduleAppointment(appt)
            enqueueSyncAndAudit(
                "HEALTHCARE_APPOINTMENT",
                appt.id,
                "INSERT",
                """{"memberId":"$resolvedMemberId","providerName":"${appt.providerName}","specialty":"${appt.specialty}","location":"${appt.location ?: ""}"}""",
                "Scheduled healthcare appointment with ${appt.providerName}"
            )
        }
    }

    fun addEmergencyContact(
        name: String,
        relationship: String,
        phone: String,
        isPrimary: Boolean,
        phoneSecondary: String? = null,
        notes: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val contact = EmergencyContact(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                name = name.trim(),
                relationship = relationship.trim(),
                phonePrimary = phone.trim(),
                phoneSecondary = phoneSecondary?.trim()?.ifBlank { null },
                isPrimary = isPrimary,
                notes = notes?.trim()?.ifBlank { null }
            )
            app.emergencyRepository.saveContact(contact)
            enqueueSyncAndAudit(
                "EMERGENCY_CONTACT",
                contact.id,
                "INSERT",
                """{"name":"${contact.name}","relationship":"${contact.relationship}","phonePrimary":"${contact.phonePrimary}","phoneSecondary":"${contact.phoneSecondary ?: ""}","isPrimary":$isPrimary}""",
                "Added emergency contact ${contact.name}"
            )
        }
    }

    fun addEmergencySupply(
        itemName: String,
        category: String = "WATER",
        quantity: String = "1 unit",
        storageLocation: String = "Basement pantry",
        expiryDate: Long? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val supply = EmergencySupply(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                itemName = itemName.trim(),
                category = category.uppercase().trim().ifBlank { "WATER" },
                quantity = quantity.trim().ifBlank { "1 unit" },
                storageLocation = storageLocation.trim().ifBlank { "Basement pantry" },
                expiryDate = expiryDate,
                isChecked = true
            )
            app.emergencyRepository.saveSupply(supply)
            enqueueSyncAndAudit(
                "EMERGENCY_SUPPLY",
                supply.id,
                "INSERT",
                """{"itemName":"${supply.itemName}","category":"${supply.category}","quantity":"${supply.quantity}","storageLocation":"${supply.storageLocation}"}""",
                "Added emergency supply ${supply.itemName}"
            )
        }
    }

    fun addEmergencyChecklistItem(
        title: String,
        category: String = "ANNUAL_REVIEW",
        assignedMemberId: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val item = EmergencyChecklistItem(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                title = title.trim(),
                category = category.uppercase().trim().ifBlank { "ANNUAL_REVIEW" },
                isCompleted = false,
                assignedMemberId = assignedMemberId?.ifBlank { null },
                completedAt = null
            )
            app.emergencyRepository.saveChecklistItem(item)
            enqueueSyncAndAudit(
                "EMERGENCY_CHECKLIST_ITEM",
                item.id,
                "INSERT",
                """{"title":"${item.title}","category":"${item.category}","assignedMemberId":"${item.assignedMemberId ?: ""}"}""",
                "Added emergency readiness item ${item.title}"
            )
        }
    }

    fun toggleEmergencySupplyChecked(supplyId: String, isChecked: Boolean) {
        viewModelScope.launch {
            app.emergencyRepository.toggleSupplyChecked(supplyId, isChecked)
            enqueueSyncAndAudit(
                "EMERGENCY_SUPPLY",
                supplyId,
                "UPDATE",
                """{"isChecked":$isChecked}""",
                "Toggled emergency supply $supplyId checked=$isChecked"
            )
        }
    }

    fun toggleEmergencyChecklistItem(itemId: String, isCompleted: Boolean) {
        viewModelScope.launch {
            app.emergencyRepository.toggleChecklistItem(itemId, isCompleted)
            enqueueSyncAndAudit(
                "EMERGENCY_CHECKLIST_ITEM",
                itemId,
                "UPDATE",
                """{"isCompleted":$isCompleted}""",
                "Toggled emergency checklist item $itemId completed=$isCompleted"
            )
        }
    }

    // Master Stage 2 Milestone 2.A Household Actions
    fun addPantryItem(
        name: String,
        category: String = "PANTRY",
        qty: Double = 1.0,
        unit: String = "item",
        expiryDate: Long? = null,
        minThreshold: Double = 1.0,
        storageLocation: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val cleanCategory = category.uppercase().trim().ifBlank { "PANTRY" }
            val cleanUnit = unit.trim().ifBlank { "item" }
            val item = com.familyos.core.database.PantryItemEntity(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                itemName = name.trim(),
                category = cleanCategory,
                quantity = qty,
                unit = cleanUnit,
                storageLocation = storageLocation?.trim()?.ifBlank { null },
                expiryDate = expiryDate,
                minThreshold = minThreshold,
                isLowStock = qty <= minThreshold
            )
            app.householdRepository.addPantryItem(item)
            enqueueSyncAndAudit(
                "PANTRY_ITEM",
                item.id,
                "INSERT",
                """{"itemName":"${item.itemName}","category":"$cleanCategory","quantity":$qty,"unit":"$cleanUnit","storageLocation":"${item.storageLocation ?: ""}","minThreshold":$minThreshold}""",
                "Added pantry item ${item.itemName}"
            )
        }
    }

    fun consumePantryItem(id: String, amount: Double = 1.0) {
        viewModelScope.launch {
            app.householdRepository.consumePantryItem(id, amount)
            enqueueSyncAndAudit(
                "PANTRY_ITEM",
                id,
                "UPDATE",
                """{"consumedAmount":$amount}""",
                "Consumed $amount from pantry item $id"
            )
        }
    }

    fun deletePantryItem(id: String) {
        viewModelScope.launch {
            app.householdRepository.deletePantryItem(id)
            enqueueSyncAndAudit(
                "PANTRY_ITEM",
                id,
                "DELETE",
                """{"id":"$id"}""",
                "Deleted pantry item $id"
            )
        }
    }

    fun addWardrobeItem(
        memberId: String,
        name: String,
        category: String = "TOPS",
        color: String? = null,
        season: String = "ALL_SEASON",
        notes: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val resolvedMemberId = memberId.ifBlank { members.value.firstOrNull()?.id ?: "mem-sarah" }
            val cleanCategory = category.uppercase().trim().ifBlank { "TOPS" }
            val cleanSeason = season.uppercase().trim().ifBlank { "ALL_SEASON" }
            val item = com.familyos.core.database.WardrobeItemEntity(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                memberId = resolvedMemberId,
                itemName = name.trim(),
                category = cleanCategory,
                color = color?.trim()?.ifBlank { null },
                season = cleanSeason,
                isClean = true,
                notes = notes?.trim()?.ifBlank { null }
            )
            app.householdRepository.addWardrobeItem(item)
            enqueueSyncAndAudit(
                "WARDROBE_ITEM",
                item.id,
                "INSERT",
                """{"memberId":"$resolvedMemberId","itemName":"${item.itemName}","category":"$cleanCategory","color":"${item.color ?: ""}","season":"$cleanSeason"}""",
                "Added wardrobe item ${item.itemName}"
            )
        }
    }

    fun toggleWardrobeCleanStatus(id: String, isClean: Boolean) {
        viewModelScope.launch {
            app.householdRepository.toggleWardrobeCleanStatus(id, isClean)
            enqueueSyncAndAudit(
                "WARDROBE_ITEM",
                id,
                "UPDATE",
                """{"isClean":$isClean}""",
                "Toggled wardrobe item $id clean=$isClean"
            )
        }
    }

    fun saveOutfitPlan(
        memberId: String,
        date: String,
        name: String,
        itemIds: List<String>,
        occasion: String = "DAILY",
        notes: String? = null
    ) {
        viewModelScope.launch {
            val familyId = _activeFamilyId.value
            val resolvedMemberId = memberId.ifBlank { members.value.firstOrNull()?.id ?: "mem-sarah" }
            val plan = com.familyos.core.database.OutfitPlanEntity(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                memberId = resolvedMemberId,
                planDate = date,
                outfitName = name.trim(),
                itemIdsJson = "[${itemIds.joinToString(",") { "\"$it\"" }}]",
                occasion = occasion.uppercase().trim().ifBlank { "DAILY" },
                notes = notes?.trim()?.ifBlank { null }
            )
            app.householdRepository.saveOutfitPlan(plan)
            enqueueSyncAndAudit(
                "OUTFIT_PLAN",
                plan.id,
                "INSERT",
                """{"memberId":"$resolvedMemberId","planDate":"$date","outfitName":"${plan.outfitName}","occasion":"${plan.occasion}","itemCount":${itemIds.size}}""",
                "Saved outfit plan ${plan.outfitName} (${plan.occasion}) for $date"
            )
        }
    }

    // AUTH-06 & AUTH-07: User Profile, Session Revocation & Self-Service Account Deletion
    fun updateUserProfileAccount(displayName: String, email: String, preferredLanguage: String = "en") {
        viewModelScope.launch {
            val now = System.currentTimeMillis()
            val existing = app.database.userProfileDao().getUserProfileById("usr-sarah-owner")
            val updated = LocalUserProfileEntity(
                id = existing?.id ?: "usr-sarah-owner",
                authenticationProvider = existing?.authenticationProvider ?: "FIREBASE_GOOGLE",
                providerUserId = existing?.providerUserId ?: "uid-sarah-owner",
                email = email.trim().ifBlank { existing?.email ?: "sarah@familyos.app" },
                displayName = displayName.trim().ifBlank { existing?.displayName ?: "Sarah Henderson" },
                profilePictureUri = existing?.profilePictureUri,
                preferredLanguage = preferredLanguage.trim().ifBlank { "en" },
                accountStatus = existing?.accountStatus ?: "ACTIVE",
                createdAt = existing?.createdAt ?: now,
                updatedAt = now
            )
            app.database.userProfileDao().insertOrUpdateUserProfile(updated)
            enqueueSyncAndAudit(
                "USER_PROFILE",
                updated.id,
                "UPDATE",
                """{"displayName":"${updated.displayName}","email":"${updated.email}","preferredLanguage":"${updated.preferredLanguage}"}""",
                "Updated user account profile (${updated.displayName})"
            )
        }
    }

    fun revokeAllOtherSessions(onComplete: (String) -> Unit = {}) {
        viewModelScope.launch {
            enqueueSyncAndAudit(
                "AUTH_SESSION",
                "usr-sarah-owner",
                "DELETE",
                """{"action":"REVOKE_ALL_OTHER_SESSIONS","userId":"usr-sarah-owner"}""",
                "Revoked all other active device sessions (AUTH-06)"
            )
            onComplete("All other active device sessions revoked and queued for server invalidation.")
        }
    }

    fun requestSelfServiceAccountDeletion(onResult: (Boolean, String) -> Unit = { _, _ -> }) {
        viewModelScope.launch {
            val role = _currentActorRole.value
            val ownerMembers = members.value.filter { it.relationshipToPrimary.equals("SELF", ignoreCase = true) }
            if (role == FamilyRole.OWNER && ownerMembers.size <= 1) {
                onResult(
                    false,
                    "LAST_OWNER_CANNOT_DELETE: Cannot delete the sole OWNER account while the family workspace is active. Transfer ownership first."
                )
                return@launch
            }
            val now = System.currentTimeMillis()
            val existing = app.database.userProfileDao().getUserProfileById("usr-sarah-owner")
            if (existing != null) {
                app.database.userProfileDao().insertOrUpdateUserProfile(
                    existing.copy(
                        displayName = "[Deleted Account]",
                        email = "deleted-${existing.id}@anonymized.familyos.local",
                        accountStatus = "PENDING_DELETION",
                        updatedAt = now
                    )
                )
            }
            app.updateEncryptedSyncConfig(
                app.encryptedSyncPrefs.getString(FamilyOSApplication.KEY_BACKEND_BASE_URL, "") ?: "",
                ""
            )
            enqueueSyncAndAudit(
                "USER_ACCOUNT",
                existing?.id ?: "usr-sarah-owner",
                "DELETE",
                """{"action":"ACCOUNT_DELETED","gdprErase":true}""",
                "Executed GDPR self-service account deletion & PII purge (AUTH-07)"
            )
            onResult(true, "Account marked PENDING_DELETION, PII anonymized, and sync bearer token revoked.")
        }
    }

    // Master Stage 4/5 Global Full-Text Search (FTS4) Actions
    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun clearSearch() {
        _searchQuery.value = ""
    }

    // Stage 3.4 Family Section & Extended Heritage Map Actions
    fun addGalleryAlbum(title: String, description: String?, category: String = "Family Memories") {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val familyId = _activeFamilyId.value
            val album = FamilyGalleryAlbumEntity(
                id = "alb-${UUID.randomUUID()}",
                familyId = familyId,
                title = title.trim(),
                description = description?.trim()?.ifBlank { null },
                category = category.trim().ifBlank { "Family Memories" },
                createdByUserId = "usr-sarah-owner"
            )
            app.familySectionRepository.saveAlbum(album)
            enqueueSyncAndAudit(
                "FAMILY_GALLERY_ALBUM",
                album.id,
                "INSERT",
                """{"title":"${album.title}","category":"${album.category}"}""",
                "Created family album ${album.title}"
            )
        }
    }

    fun addGalleryPhoto(title: String, caption: String?, imageUrl: String, albumId: String? = null, visibility: String = "FAMILY") {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val familyId = _activeFamilyId.value
            val photo = FamilyGalleryPhotoEntity(
                id = "pho-${UUID.randomUUID()}",
                familyId = familyId,
                albumId = albumId ?: galleryAlbums.value.firstOrNull()?.id,
                title = title.trim(),
                caption = caption?.trim()?.ifBlank { null },
                imageUrl = imageUrl.trim().ifBlank { "content://familyos/gallery/default" },
                visibility = visibility.uppercase().trim().ifBlank { "FAMILY" },
                uploadedByUserId = "usr-sarah-owner",
                uploadedByMemberId = _currentActorMemberId.value
            )
            app.familySectionRepository.savePhoto(photo)
            enqueueSyncAndAudit(
                "FAMILY_GALLERY_PHOTO",
                photo.id,
                "INSERT",
                """{"title":"${photo.title}","visibility":"${photo.visibility}"}""",
                "Added family gallery photo ${photo.title}"
            )
        }
    }

    fun saveConstitutionVersion(motto: String, missionStatement: String, visionStatement: String, coreValues: List<String>) {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canManageFamilyMembers(_currentActorRole.value)) return@launch
            val familyId = _activeFamilyId.value
            val nextVersion = (constitutionVersions.value.maxOfOrNull { it.versionNumber } ?: 0) + 1
            val valuesJson = "[${coreValues.map { it.trim() }.filter { it.isNotBlank() }.joinToString(",") { "\"$it\"" }}]"
            val version = FamilyConstitutionVersionEntity(
                id = "const-v$nextVersion-${UUID.randomUUID()}",
                familyId = familyId,
                versionNumber = nextVersion,
                motto = motto.trim(),
                missionStatement = missionStatement.trim(),
                visionStatement = visionStatement.trim(),
                coreValuesJson = valuesJson,
                acknowledgmentsJson = "[\"${members.value.firstOrNull()?.displayName ?: "Family Owner"}\"]",
                editedByUserId = "usr-sarah-owner"
            )
            app.familySectionRepository.saveConstitutionVersion(version)
            enqueueSyncAndAudit(
                "FAMILY_CONSTITUTION",
                version.id,
                "INSERT",
                """{"versionNumber":$nextVersion,"motto":"${version.motto}"}""",
                "Published Family Constitution v$nextVersion"
            )
        }
    }

    fun addFamilyTradition(title: String, category: String, cadence: String, originStory: String?, nextOccurrenceDate: String? = null) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val familyId = _activeFamilyId.value
            val tradition = FamilyTraditionEntity(
                id = "trad-${UUID.randomUUID()}",
                familyId = familyId,
                title = title.trim(),
                category = category.trim().ifBlank { "Annual" },
                cadence = cadence.trim().ifBlank { "Annual" },
                nextOccurrenceDate = nextOccurrenceDate?.trim()?.ifBlank { null },
                originStory = originStory?.trim()?.ifBlank { null }
            )
            app.familySectionRepository.saveTradition(tradition)
            enqueueSyncAndAudit(
                "FAMILY_TRADITION",
                tradition.id,
                "INSERT",
                """{"title":"${tradition.title}","category":"${tradition.category}","cadence":"${tradition.cadence}"}""",
                "Added family tradition ${tradition.title}"
            )
        }
    }

    fun addSharedActivity(title: String, category: String, dateIso: String, location: String?, budgetCents: Long) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val familyId = _activeFamilyId.value
            val activity = FamilySharedActivityEntity(
                id = "act-${UUID.randomUUID()}",
                familyId = familyId,
                title = title.trim(),
                category = category.trim().ifBlank { "Outing" },
                dateIso = dateIso.trim().ifBlank { "2026-11-20" },
                location = location?.trim()?.ifBlank { null },
                budgetCents = budgetCents.coerceAtLeast(0L),
                status = "PLANNED"
            )
            app.familySectionRepository.saveSharedActivity(activity)
            enqueueSyncAndAudit(
                "FAMILY_SHARED_ACTIVITY",
                activity.id,
                "INSERT",
                """{"title":"${activity.title}","dateIso":"${activity.dateIso}","budgetCents":${activity.budgetCents}}""",
                "Scheduled shared family activity ${activity.title}"
            )
        }
    }

    fun addFamilyRule(title: String, category: String, description: String, appliesToRole: String = "ALL") {
        viewModelScope.launch {
            if (!FamilySecurityPolicy.canManageFamilyMembers(_currentActorRole.value)) return@launch
            val familyId = _activeFamilyId.value
            val rule = FamilyRuleEntity(
                id = "rule-${UUID.randomUUID()}",
                familyId = familyId,
                title = title.trim(),
                category = category.trim().ifBlank { "General" },
                description = description.trim(),
                appliesToRole = appliesToRole.uppercase().trim().ifBlank { "ALL" }
            )
            app.familySectionRepository.saveRule(rule)
            enqueueSyncAndAudit(
                "FAMILY_RULE",
                rule.id,
                "INSERT",
                """{"title":"${rule.title}","category":"${rule.category}","appliesToRole":"${rule.appliesToRole}"}""",
                "Added family rule ${rule.title}"
            )
        }
    }

    fun addExtendedRelative(
        fullName: String,
        relationshipLabel: String,
        lineageSide: String,
        generation: String = "GRANDPARENTS",
        birthYear: Int? = null,
        occupation: String? = null,
        city: String? = null,
        country: String? = null
    ) {
        viewModelScope.launch {
            if (_currentActorRole.value == FamilyRole.GUEST) return@launch
            val familyId = _activeFamilyId.value
            val relative = FamilyExtendedRelativeEntity(
                id = "ext-${UUID.randomUUID()}",
                familyId = familyId,
                fullName = fullName.trim(),
                relationshipLabel = relationshipLabel.trim().ifBlank { "Extended Relative" },
                lineageSide = lineageSide.uppercase().trim().ifBlank { "SHARED" },
                generation = generation.uppercase().trim().ifBlank { "PARENTS_SIBLINGS" },
                birthYear = birthYear,
                occupation = occupation?.trim()?.ifBlank { null },
                city = city?.trim()?.ifBlank { null },
                country = country?.trim()?.ifBlank { null }
            )
            app.familySectionRepository.saveExtendedRelative(relative)
            enqueueSyncAndAudit(
                "FAMILY_EXTENDED_RELATIVE",
                relative.id,
                "INSERT",
                """{"fullName":"${relative.fullName}","lineageSide":"${relative.lineageSide}","relationshipLabel":"${relative.relationshipLabel}"}""",
                "Added extended relative ${relative.fullName}"
            )
        }
    }

    private suspend fun enqueueSyncAndAudit(
        entityType: String,
        entityId: String,
        operationType: String,
        payloadJson: String,
        summary: String
    ) {
        val familyId = _activeFamilyId.value
        val opId = UUID.randomUUID().toString()
        val idempotencyKey = "$entityType:$entityId:$operationType:${System.currentTimeMillis()}"
        app.syncRepository.enqueue(
            SyncOperation(
                operationId = opId,
                idempotencyKey = idempotencyKey,
                familyId = familyId,
                entityType = entityType,
                entityId = entityId,
                operationType = operationType,
                payloadJson = payloadJson
            )
        )
        app.database.auditEventDao().logEvent(
            AuditEventEntity(
                id = UUID.randomUUID().toString(),
                familyId = familyId,
                actorUserId = "usr-sarah-owner",
                actionType = "${entityType}_${operationType}",
                entityType = entityType,
                entityId = entityId,
                summary = summary,
                metadataJson = payloadJson
            )
        )
        try {
            SyncWorker.enqueueImmediateSync(getApplication())
        } catch (_: Exception) {}
    }

    suspend fun signInWithEmail(email: String, pass: String): Result<UserAccount> {
        val result = app.authRepository.signInWithEmail(email, pass)
        val freshToken = app.authRepository.getFreshIdToken(forceRefresh = true).getOrNull()
        if (freshToken != null) {
            app.updateEncryptedSyncConfig(null, freshToken)
        }
        return result
    }

    suspend fun registerWithEmail(email: String, pass: String): Result<UserAccount> {
        val result = app.authRepository.registerWithEmail(email, pass)
        val freshToken = app.authRepository.getFreshIdToken(forceRefresh = true).getOrNull()
        if (freshToken != null) {
            app.updateEncryptedSyncConfig(null, freshToken)
        }
        return result
    }

    suspend fun sendPasswordResetEmail(email: String): Result<Unit> {
        return app.authRepository.sendPasswordResetEmail(email)
    }

    suspend fun sendEmailVerification(): Result<Unit> {
        return app.authRepository.sendEmailVerification()
    }
}


