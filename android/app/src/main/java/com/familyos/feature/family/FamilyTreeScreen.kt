package com.familyos.feature.family

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.familyos.core.designsystem.*
import com.familyos.core.domain.*

/**
 * Stage 3.3.1: People & Relationships Screen
 * Connected exclusively to authoritative Room + Firebase synchronized records.
 * Supports:
 * - Multi-generational Family Tree & Accessible Directory
 * - Member Profiles (Shared vs Personal workspace privacy, Emergency contact, Birthdays, Responsibilities)
 * - Profile Editing & Member Removal / Access Revocation
 * - Relationship Graph Management (with DAG cycle validation)
 * - Invitations, Membership Approvals, Role Assignments (blocking self-promotion)
 */
@Composable
fun FamilyTreeScreen(
    members: List<FamilyMember> = emptyList(),
    relationships: List<FamilyRelationship> = emptyList(),
    invitations: List<FamilyInvitation> = emptyList(),
    actorMemberId: String = "mem-sarah",
    actorRole: FamilyRole = FamilyRole.OWNER,
    onAddMember: () -> Unit = {},
    onCreateRelationship: (String, String, RelationshipType, String?) -> Unit = { _, _, _, _ -> },
    onUpdateMemberProfile: (String, String, String, List<String>, String?, String?, String?, String?) -> Unit = { _, _, _, _, _, _, _, _ -> },
    onRemoveMember: (String) -> Unit = {},
    onInviteMember: (String, String, FamilyRole) -> Unit = { _, _, _ -> },
    onApproveMembership: (String) -> Unit = {},
    onChangeRole: (String, FamilyRole) -> Unit = { _, _ -> }
) {
    var viewMode by remember { mutableStateOf("TREE") }
    var selectedMember by remember(members) { mutableStateOf(members.firstOrNull()) }
    var showMemberDetailsDialog by remember { mutableStateOf(false) }
    var showRelationshipModal by remember { mutableStateOf(false) }
    var showInviteModal by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(FamilyOSSpacing.md)
    ) {
        // Section Header with View Mode Toggle
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "People & Relationships",
                    style = MaterialTheme.typography.headlineLarge,
                    color = FamilyOSColors.TextPrimary
                )
                Text(
                    text = "${members.size} active members • ${relationships.size} relationships • Role: ${actorRole.name}",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
            }

            // View Mode Switcher (TREE / LIST / GOVERNANCE)
            Row(
                modifier = Modifier
                    .clip(FamilyOSShapes.medium)
                    .background(FamilyOSColors.SageLight)
                    .padding(4.dp)
            ) {
                IconButton(
                    onClick = { viewMode = "TREE" },
                    modifier = Modifier
                        .size(36.dp)
                        .background(if (viewMode == "TREE") Color.White else Color.Transparent, FamilyOSShapes.small)
                ) {
                    Icon(
                        imageVector = Icons.Default.AccountTree,
                        contentDescription = "Tree View",
                        tint = if (viewMode == "TREE") FamilyOSColors.PrimaryForestGreen else FamilyOSColors.TextSecondary
                    )
                }
                IconButton(
                    onClick = { viewMode = "LIST" },
                    modifier = Modifier
                        .size(36.dp)
                        .background(if (viewMode == "LIST") Color.White else Color.Transparent, FamilyOSShapes.small)
                ) {
                    Icon(
                        imageVector = Icons.Default.FormatListBulleted,
                        contentDescription = "List View",
                        tint = if (viewMode == "LIST") FamilyOSColors.PrimaryForestGreen else FamilyOSColors.TextSecondary
                    )
                }
                IconButton(
                    onClick = { viewMode = "GOVERNANCE" },
                    modifier = Modifier
                        .size(36.dp)
                        .background(if (viewMode == "GOVERNANCE") Color.White else Color.Transparent, FamilyOSShapes.small)
                ) {
                    Icon(
                        imageVector = Icons.Default.AdminPanelSettings,
                        contentDescription = "Invitations & Roles",
                        tint = if (viewMode == "GOVERNANCE") FamilyOSColors.PrimaryForestGreen else FamilyOSColors.TextSecondary
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.md))

        if (members.isEmpty()) {
            Box(modifier = Modifier.weight(1f)) {
                FamilyOSEmptyState(
                    title = "No Family Members Yet",
                    description = "Add your first household member or send an invitation to begin building your family tree.",
                    actionText = "Add Family Member",
                    onActionClick = onAddMember,
                    icon = Icons.Default.People
                )
            }
        } else {
            when (viewMode) {
                "TREE" -> {
                    FamilyVisualTreeView(
                        members = members,
                        selectedMember = selectedMember,
                        onSelectMember = {
                            selectedMember = it
                            showMemberDetailsDialog = true
                        },
                        modifier = Modifier.weight(1f)
                    )
                }
                "LIST" -> {
                    FamilyAccessibleListView(
                        members = members,
                        relationships = relationships,
                        actorMemberId = actorMemberId,
                        actorRole = actorRole,
                        onSelectMember = {
                            selectedMember = it
                            showMemberDetailsDialog = true
                        },
                        modifier = Modifier.weight(1f)
                    )
                }
                else -> {
                    FamilyGovernanceAndInvitationsView(
                        members = members,
                        invitations = invitations,
                        actorMemberId = actorMemberId,
                        actorRole = actorRole,
                        onInviteClick = { showInviteModal = true },
                        onApproveMembership = onApproveMembership,
                        onChangeRole = onChangeRole,
                        onRemoveMember = onRemoveMember,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(FamilyOSSpacing.sm))

        // Action Buttons Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
        ) {
            FamilyOSPrimaryButton(
                text = "Add Member",
                icon = Icons.Default.PersonAdd,
                onClick = onAddMember,
                modifier = Modifier.weight(1f)
            )
            FamilyOSSecondaryButton(
                text = "Link Relationship",
                onClick = { showRelationshipModal = true },
                modifier = Modifier.weight(1f)
            )
            if (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) {
                FamilyOSSecondaryButton(
                    text = "Invite",
                    onClick = { showInviteModal = true },
                    modifier = Modifier.weight(0.8f)
                )
            }
        }
    }

    // Member Profile & Edit Modal
    if (showMemberDetailsDialog && selectedMember != null) {
        val member = members.find { it.id == selectedMember?.id } ?: selectedMember!!
        val canViewPersonal = FamilySecurityPolicy.canViewPersonalInfo(actorMemberId, actorRole, member)
        val canEdit = FamilySecurityPolicy.canEditMemberProfile(actorMemberId, actorRole, member.id)
        val canRemove = (actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN) && member.role != FamilyRole.OWNER

        MemberProfileEditDialog(
            member = member,
            canViewPersonal = canViewPersonal,
            canEdit = canEdit,
            canRemove = canRemove,
            onDismiss = { showMemberDetailsDialog = false },
            onSave = { name, relation, responsibilities, emergencyName, emergencyPhone, personalNotes, sharedBio ->
                onUpdateMemberProfile(
                    member.id,
                    name,
                    relation,
                    responsibilities,
                    emergencyName,
                    emergencyPhone,
                    personalNotes,
                    sharedBio
                )
                showMemberDetailsDialog = false
            },
            onRemove = {
                onRemoveMember(member.id)
                showMemberDetailsDialog = false
            }
        )
    }

    // Interactive Relationship Link Modal
    if (showRelationshipModal && members.size >= 2) {
        AddRelationshipModal(
            members = members,
            onDismiss = { showRelationshipModal = false },
            onConfirm = { m1, m2, relType, notes ->
                onCreateRelationship(m1, m2, relType, notes)
                showRelationshipModal = false
            }
        )
    }

    // Invite Member Modal
    if (showInviteModal) {
        InviteMemberModal(
            onDismiss = { showInviteModal = false },
            onConfirm = { email, name, role ->
                onInviteMember(email, name, role)
                showInviteModal = false
            }
        )
    }
}

@Composable
private fun FamilyVisualTreeView(
    members: List<FamilyMember>,
    selectedMember: FamilyMember?,
    onSelectMember: (FamilyMember) -> Unit,
    modifier: Modifier = Modifier
) {
    val grandparents = members.filter { it.relationshipToPrimary.equals("GRANDPARENT", ignoreCase = true) }
    val parents = members.filter {
        it.relationshipToPrimary.uppercase() in listOf("SELF", "SPOUSE", "PARENT")
    }
    val children = members.filter {
        it.relationshipToPrimary.uppercase() !in listOf("GRANDPARENT", "SELF", "SPOUSE", "PARENT")
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .clip(FamilyOSShapes.large)
            .background(Color.White)
            .border(1.dp, FamilyOSColors.BorderSubtle, FamilyOSShapes.large)
            .padding(FamilyOSSpacing.md)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (grandparents.isNotEmpty()) {
            TreeGenerationTier(
                tierLabel = "GENERATION I • ELDERS",
                members = grandparents,
                selectedMember = selectedMember,
                onSelectMember = onSelectMember
            )
            TreeConnectingLine()
        }

        TreeGenerationTier(
            tierLabel = "GENERATION II • HOUSEHOLD HEADS",
            members = parents.ifEmpty { members.take(2) },
            selectedMember = selectedMember,
            onSelectMember = onSelectMember
        )

        if (children.isNotEmpty()) {
            TreeConnectingLine()
            TreeGenerationTier(
                tierLabel = "GENERATION III • CHILDREN & EXTENDED",
                members = children,
                selectedMember = selectedMember,
                onSelectMember = onSelectMember
            )
        }
    }
}

@Composable
private fun TreeGenerationTier(
    tierLabel: String,
    members: List<FamilyMember>,
    selectedMember: FamilyMember?,
    onSelectMember: (FamilyMember) -> Unit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = tierLabel,
            style = MaterialTheme.typography.labelSmall,
            color = FamilyOSColors.SecondarySage,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = FamilyOSSpacing.xs)
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md),
            verticalAlignment = Alignment.CenterVertically
        ) {
            members.forEach { member ->
                val isSelected = member.id == selectedMember?.id
                Surface(
                    onClick = { onSelectMember(member) },
                    shape = FamilyOSShapes.medium,
                    color = if (isSelected) FamilyOSColors.SageLight else FamilyOSColors.WarmIvoryLight,
                    border = androidx.compose.foundation.BorderStroke(
                        if (isSelected) 2.dp else 1.dp,
                        if (isSelected) FamilyOSColors.PrimaryForestGreen else FamilyOSColors.BorderSubtle
                    ),
                    modifier = Modifier.width(148.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(FamilyOSSpacing.sm),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        FamilyOSAvatar(name = member.displayName, size = 48.dp)
                        Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
                        Text(
                            text = member.displayName,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${member.relationshipToPrimary} • ${member.role.name}",
                            style = MaterialTheme.typography.bodySmall,
                            color = FamilyOSColors.TextSecondary
                        )
                        if (member.isRestrictedProfile) {
                            Spacer(modifier = Modifier.height(4.dp))
                            FamilyOSStatusBadge(text = "Minor", color = FamilyOSColors.SecondarySage)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TreeConnectingLine() {
    Box(
        modifier = Modifier
            .padding(vertical = FamilyOSSpacing.xs)
            .width(2.dp)
            .height(24.dp)
            .background(FamilyOSColors.BorderStrong)
    )
}

@Composable
private fun FamilyAccessibleListView(
    members: List<FamilyMember>,
    relationships: List<FamilyRelationship>,
    actorMemberId: String,
    actorRole: FamilyRole,
    onSelectMember: (FamilyMember) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.sm)
    ) {
        items(members) { member ->
            val canSeePersonal = FamilySecurityPolicy.canViewPersonalInfo(actorMemberId, actorRole, member)
            val memberRels = relationships.filter { it.member1Id == member.id || it.member2Id == member.id }
            FamilyOSCard(
                onClick = { onSelectMember(member) }
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        FamilyOSAvatar(name = member.displayName, size = 44.dp)
                        Spacer(modifier = Modifier.width(FamilyOSSpacing.md))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = member.displayName,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${member.relationshipToPrimary} • Role: ${member.role.name} • ${member.pointsBalance} pts",
                                style = MaterialTheme.typography.bodySmall,
                                color = FamilyOSColors.TextSecondary
                            )
                        }
                        FamilyOSStatusBadge(
                            text = member.membershipStatus.name,
                            color = if (member.membershipStatus == MembershipStatus.ACTIVE) FamilyOSColors.PrimaryForestGreen else FamilyOSColors.SoftGold
                        )
                    }
                    if (member.responsibilities.isNotEmpty()) {
                        Text(
                            text = "Responsibilities: ${member.responsibilities.joinToString(", ")}",
                            style = MaterialTheme.typography.bodySmall,
                            color = FamilyOSColors.TextPrimary
                        )
                    }
                    if (!member.emergencyContactName.isNullOrBlank()) {
                        Text(
                            text = "Emergency Contact: ${member.emergencyContactName} (${member.emergencyContactPhone ?: "N/A"})",
                            style = MaterialTheme.typography.bodySmall,
                            color = FamilyOSColors.TextSecondary
                        )
                    }
                    Text(
                        text = if (canSeePersonal) {
                            "Personal Workspace: ${member.personalNotes ?: "Accessible to you"}"
                        } else {
                            "Personal Workspace: [Private to ${member.displayName}]"
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = FamilyOSColors.SecondarySage
                    )
                    if (memberRels.isNotEmpty()) {
                        Text(
                            text = "${memberRels.size} family relationship link(s) recorded",
                            style = MaterialTheme.typography.labelSmall,
                            color = FamilyOSColors.TextSecondary
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FamilyGovernanceAndInvitationsView(
    members: List<FamilyMember>,
    invitations: List<FamilyInvitation>,
    actorMemberId: String,
    actorRole: FamilyRole,
    onInviteClick: () -> Unit,
    onApproveMembership: (String) -> Unit,
    onChangeRole: (String, FamilyRole) -> Unit,
    onRemoveMember: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val isAdminOrOwner = actorRole == FamilyRole.OWNER || actorRole == FamilyRole.ADMIN

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(FamilyOSSpacing.md)
    ) {
        item {
            FamilyOSCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Invitations & Approvals",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "One-Family Membership Rule enforced • Self-promotion blocked",
                            style = MaterialTheme.typography.bodySmall,
                            color = FamilyOSColors.TextSecondary
                        )
                    }
                    if (isAdminOrOwner) {
                        TextButton(onClick = onInviteClick) {
                            Text("+ Invite Member", fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(FamilyOSSpacing.xs))
                if (invitations.isEmpty()) {
                    Text(
                        text = "No pending invitations.",
                        style = MaterialTheme.typography.bodySmall,
                        color = FamilyOSColors.TextSecondary
                    )
                } else {
                    invitations.forEach { inv ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "${inv.inviteeName} (${inv.inviteeEmail})",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    text = "Proposed Role: ${inv.proposedRole.name} • Status: ${inv.status}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = FamilyOSColors.TextSecondary
                                )
                            }
                            FamilyOSStatusBadge(text = inv.status, color = FamilyOSColors.SoftGold)
                        }
                    }
                }
            }
        }

        item {
            Text(
                text = "Member Roles & Access Control",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }

        items(members) { member ->
            FamilyOSCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = member.displayName,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Role: ${member.role.name} • Status: ${member.membershipStatus.name}",
                            style = MaterialTheme.typography.bodySmall,
                            color = FamilyOSColors.TextSecondary
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (isAdminOrOwner && member.membershipStatus == MembershipStatus.PENDING_APPROVAL) {
                            TextButton(onClick = { onApproveMembership(member.id) }) {
                                Text("Approve", color = FamilyOSColors.PrimaryForestGreen, fontWeight = FontWeight.Bold)
                            }
                        }
                        if (isAdminOrOwner && member.id != actorMemberId && member.role != FamilyRole.OWNER) {
                            val nextRole = if (member.role == FamilyRole.MEMBER) FamilyRole.ADMIN else FamilyRole.MEMBER
                            if (actorRole == FamilyRole.OWNER || nextRole != FamilyRole.ADMIN) {
                                TextButton(onClick = { onChangeRole(member.id, nextRole) }) {
                                    Text("Set ${nextRole.name}")
                                }
                            }
                            TextButton(onClick = { onRemoveMember(member.id) }) {
                                Text("Revoke", color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MemberProfileEditDialog(
    member: FamilyMember,
    canViewPersonal: Boolean,
    canEdit: Boolean,
    canRemove: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String, List<String>, String?, String?, String?, String?) -> Unit,
    onRemove: () -> Unit
) {
    var displayName by remember(member) { mutableStateOf(member.displayName) }
    var relationship by remember(member) { mutableStateOf(member.relationshipToPrimary) }
    var responsibilitiesText by remember(member) { mutableStateOf(member.responsibilities.joinToString(", ")) }
    var emergencyName by remember(member) { mutableStateOf(member.emergencyContactName ?: "") }
    var emergencyPhone by remember(member) { mutableStateOf(member.emergencyContactPhone ?: "") }
    var personalNotes by remember(member) { mutableStateOf(member.personalNotes ?: "") }
    var sharedBio by remember(member) { mutableStateOf(member.sharedBio ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "${member.displayName} • ${member.role.name}",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Status: ${member.membershipStatus.name} • Points: ${member.pointsBalance} pts",
                    style = MaterialTheme.typography.bodySmall,
                    color = FamilyOSColors.TextSecondary
                )
                OutlinedTextField(
                    value = displayName,
                    onValueChange = { displayName = it },
                    label = { Text("Display Name") },
                    enabled = canEdit,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = relationship,
                    onValueChange = { relationship = it },
                    label = { Text("Household Relationship (SELF, SPOUSE, CHILD, GRANDPARENT)") },
                    enabled = canEdit,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = sharedBio,
                    onValueChange = { sharedBio = it },
                    label = { Text("Shared Family Bio") },
                    enabled = canEdit,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = responsibilitiesText,
                    onValueChange = { responsibilitiesText = it },
                    label = { Text("Responsibilities (comma-separated)") },
                    enabled = canEdit,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = emergencyName,
                    onValueChange = { emergencyName = it },
                    label = { Text("Emergency Contact Name") },
                    enabled = canEdit,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = emergencyPhone,
                    onValueChange = { emergencyPhone = it },
                    label = { Text("Emergency Contact Phone") },
                    enabled = canEdit,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                if (canViewPersonal) {
                    OutlinedTextField(
                        value = personalNotes,
                        onValueChange = { personalNotes = it },
                        label = { Text("Personal Workspace Notes (Private)") },
                        enabled = canEdit,
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    Text(
                        text = "Personal Workspace: Private to ${member.displayName} (Restricted by FamilySecurityPolicy)",
                        style = MaterialTheme.typography.bodySmall,
                        color = FamilyOSColors.SecondarySage
                    )
                }
                if (canRemove) {
                    Spacer(modifier = Modifier.height(4.dp))
                    TextButton(onClick = onRemove) {
                        Text(
                            text = "Remove Member & Revoke Family Access",
                            color = MaterialTheme.colorScheme.error,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        },
        confirmButton = {
            if (canEdit) {
                TextButton(
                    onClick = {
                        val respList = responsibilitiesText.split(",").map { it.trim() }.filter { it.isNotBlank() }
                        onSave(
                            displayName.trim(),
                            relationship.trim(),
                            respList,
                            emergencyName.trim().ifBlank { null },
                            emergencyPhone.trim().ifBlank { null },
                            if (canViewPersonal) personalNotes.trim().ifBlank { null } else member.personalNotes,
                            sharedBio.trim().ifBlank { null }
                        )
                    }
                ) {
                    Text("Save Profile")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}

@Composable
private fun AddRelationshipModal(
    members: List<FamilyMember>,
    onDismiss: () -> Unit,
    onConfirm: (String, String, RelationshipType, String?) -> Unit
) {
    var member1Id by remember { mutableStateOf(members.firstOrNull()?.id ?: "") }
    var member2Id by remember { mutableStateOf(members.getOrNull(1)?.id ?: "") }
    var selectedType by remember { mutableStateOf(RelationshipType.PARENT_CHILD) }
    var notes by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Link Family Relationship",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("First Member:", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    members.take(4).forEach { m ->
                        FilterChip(
                            selected = member1Id == m.id,
                            onClick = { member1Id = m.id },
                            label = { Text(m.displayName.substringBefore(" ")) }
                        )
                    }
                }
                Text("Second Member:", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    members.take(4).forEach { m ->
                        FilterChip(
                            selected = member2Id == m.id,
                            onClick = { member2Id = m.id },
                            label = { Text(m.displayName.substringBefore(" ")) }
                        )
                    }
                }
                Text("Relationship Type:", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(
                        RelationshipType.PARENT_CHILD,
                        RelationshipType.SPOUSE_PARTNER,
                        RelationshipType.SIBLING,
                        RelationshipType.GUARDIAN_WARD
                    ).forEach { relType ->
                        FilterChip(
                            selected = selectedType == relType,
                            onClick = { selectedType = relType },
                            label = { Text(relType.name.substringBefore("_")) }
                        )
                    }
                }
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Relationship Notes (Optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (member1Id.isNotBlank() && member2Id.isNotBlank() && member1Id != member2Id) {
                        onConfirm(member1Id, member2Id, selectedType, notes.trim().ifBlank { null })
                    }
                }
            ) {
                Text("Link Relationship")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
private fun InviteMemberModal(
    onDismiss: () -> Unit,
    onConfirm: (String, String, FamilyRole) -> Unit
) {
    var email by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var role by remember { mutableStateOf(FamilyRole.MEMBER) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Invite Family Member",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Invitee Full Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email Address") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Text("Proposed Role:", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(FamilyRole.MEMBER, FamilyRole.CHILD, FamilyRole.GUEST).forEach { r ->
                        FilterChip(
                            selected = role == r,
                            onClick = { role = r },
                            label = { Text(r.name) }
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (email.isNotBlank() && name.isNotBlank()) {
                        onConfirm(email.trim(), name.trim(), role)
                    }
                }
            ) {
                Text("Send Invitation")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
