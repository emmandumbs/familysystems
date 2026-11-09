package com.familyos.core.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * The 16 canonical FamilyOS navigation destinations.
 */
enum class FamilyOSDestination(
    val route: String,
    val title: String,
    val icon: ImageVector,
    val isCoreTab: Boolean = false // Appears in phone bottom bar
) {
    OVERVIEW("overview", "Overview", Icons.Default.Home, isCoreTab = true),
    FAMILY("family", "The Family", Icons.Default.People, isCoreTab = true),
    GOALS_PROJECTS("goals_projects", "Goals & Projects", Icons.Default.CheckCircle, isCoreTab = true),
    HOUSEHOLD("household", "Household", Icons.Default.Kitchen, isCoreTab = true),
    FINANCE("finance", "Finance", Icons.Default.AccountBalance, isCoreTab = true),
    
    // Extended Family Modules
    SPIRITUAL_GROWTH("spiritual_growth", "Spiritual Growth", Icons.Default.MenuBook),
    PERSONAL_DEV("personal_development", "Personal Development", Icons.Default.TrendingUp),
    COUPLES_PREP("couples_prep", "Couples Preparation", Icons.Default.Favorite),
    PARENTING("parenting", "Parenting & Children", Icons.Default.ChildCare),
    HEALTH_FITNESS("health_fitness", "Health & Fitness", Icons.Default.FavoriteBorder),
    FAMILY_SAFETY("family_safety", "Family Safety", Icons.Default.HealthAndSafety),
    INVESTMENTS("investments", "Investments", Icons.Default.ShowChart),
    
    // Core Cross-Cutting Systems
    CALENDAR("calendar", "Calendar", Icons.Default.CalendarMonth),
    DOCUMENTS("documents", "Documents", Icons.Default.Folder),
    REPORTS("reports", "Reports & Insights", Icons.Default.BarChart),
    USER_PROFILE("user_profile", "User Profile & Account", Icons.Default.Person),
    SETTINGS("settings", "Settings", Icons.Default.Settings),
    AUTH("auth", "Authentication", Icons.Default.Lock);

    companion object {
        fun fromRoute(route: String?): FamilyOSDestination {
            return entries.find { it.route == route } ?: OVERVIEW
        }
    }
}

/**
 * Canonical 7 Home Operational Dashboards (matching Web family_home subitems).
 */
enum class HomeDashboardSubDestination(val subId: String, val label: String) {
    MAIN_COMMAND_CENTER("home_command_center", "Main Command Center"),
    FINANCE_DASHBOARD("home_finance_dashboard", "Finance Dashboard"),
    HOUSEHOLD_DASHBOARD("home_house_dashboard", "Household Dashboard"),
    GOALS_PROJECTS_DASHBOARD("home_goals_dashboard", "Goals & Projects Dashboard"),
    RELATIONSHIP_DASHBOARD("home_relationship_dashboard", "Relationship Dashboard"),
    PARENTING_GROWTH_DASHBOARD("home_parenting_dashboard", "Parenting & Growth Dashboard"),
    LIFE_MANAGEMENT_DASHBOARD("home_life_dashboard", "Life Management Dashboard")
}

/**
 * Canonical 6 Family Section Destinations (matching Web people_relationships subitems).
 */
enum class FamilySectionSubDestination(val subId: String, val label: String) {
    FAMILY_HOME_OVERVIEW("home_overview", "Family Home Overview"),
    FAMILY_GALLERY("people_gallery", "Family Gallery"),
    FAMILY_CONSTITUTION("home_constitution", "Family Constitution"),
    FAMILY_TRADITIONS("people_traditions", "Family Traditions & Culture"),
    SHARED_ACTIVITIES("people_activities", "Shared Activities"),
    FAMILY_RULES("people_rules", "Family Rules & Principles")
}

