# FAMILYOS — STAGE 3.3.1 IMPLEMENTATION REPORT
## Family Home, People & Relationships — Cross-Platform Authoritative Implementation

**Date:** 2026-04-19  
**Stage:** Stage 3.3.1 — Family Home, People & Relationships  
**Firebase Project:** `gen-lang-client-0741697651`  
**Firestore Database:** `ai-studio-familyos-8f842ec0-cec0-443c-b279-e4955acacfaf`  
**Authoritative Gateway:** `server.ts` (`/api/v1/*`)

---

## 1. Executive Summary

Stage 3.3.1 transforms **Family Home** and **People & Relationships** from static demonstration data into live, end-to-end authoritative experiences across the Express/Firestore backend, the Android Kotlin + Jetpack Compose application, and the React web application.

All changes strictly preserve:
- All **39 Android Room entities** and existing SQLCipher-encrypted database migrations (`MIGRATION_1_2`, `MIGRATION_2_3`).
- Stage 3.2 zero-trust authentication, role-based access control (`serverResolvedRole`), atomic financial ledger integrity, and pre-3.2 backup/rollback protections.
- Strict privacy boundaries between **shared family records** (`SHARED` visibility) and **personal workspace records** (`PERSONAL` visibility, private notes, medical notes, and personal goals).

---

## 2. Backend & Authoritative Data Layer (`src/server/*`, `server.ts`, `firestore.rules`)

### 2.1 Authoritative Domain Schema Extensions (`src/server/backupAndMigration.ts`)
- **Extended `AuthoritativeWorkspace`**:
  - Added `motto`, `mission`, `vision`, `values: string[]`, `logoUrl`, `photoUrl`.
  - Added `announcements: AuthoritativeAnnouncement[]`, `reminders: AuthoritativeReminder[]`, and `approvedAiSuggestions: AuthoritativeAiSuggestion[]`.
- **Added `AuthoritativeFamilyMember`**:
  - Stores shared profile fields (`name`, `role`, `status`, `birthDate`, `phone`, `email`, `avatarUrl`, `bio`, `emergencyContact`, `importantDates`) and a segregated `personalInfo` block (`privateNotes`, `medicalNotes`, `personalGoals`, `dietaryNotes`, `visibility: 'PERSONAL'`).
- **Added `AuthoritativeFamilyRelationship`**:
  - Stores `sourceMemberId`, `targetMemberId`, `relationshipType` (`PARENT_CHILD`, `SPOUSE`, `SIBLING`, `GUARDIAN`), `createdAt`, `updatedAt`, `deletedAt`, and `version`.
- **Added `AuthoritativeInvitation`**:
  - Stores `familyId`, `inviteeEmail`, `inviteeName`, `proposedRole`, `status` (`PENDING`, `ACCEPTED`, `DECLINED`, `APPROVED`, `REVOKED`), `invitedBy`, and timestamps.
- **Added `AuthoritativeMediaAsset`**:
  - Stores `category` (`FAMILY_LOGO`, `FAMILY_BANNER`, `MEMBER_AVATAR`), `visibility` (`SHARED`, `PERSONAL`), `ownerAccountId`, `memberId`, `mimeType`, `sizeBytes`, and `dataUrl`.
- **Non-Destructive Reconciliation (`ensurePre32BackupAndMigrate`)**:
  - Hydrates default Stage 3.3.1 workspaces, members, relationships, invitations, and memberships by ID without overwriting existing family records or breaking the pre-3.2 SHA-256 backup (`02bdf02954e78adc71dcb02f9dd8bcbf6581f343901e1aa4ab047ff8d2cdb596`).

### 2.2 Zero-Trust Privacy, Governance & Graph Validation (`src/server/authAndRbac.ts`)
- **One-Family Membership Enforcement (`findActiveMembershipForUser`)**:
  - Verifies whether an authenticated account already holds an `ACTIVE` membership in any family workspace. Blocks joining or creating a second family with HTTP `409 ONE_FAMILY_RULE_VIOLATION`.
- **Personal Workspace Privacy (`canViewPersonalMemberInfo` & `sanitizeMemberForCaller`)**:
  - Strips `personalInfo` on the server before returning member payloads to any caller except:
    1. The member themselves (`caller.accountId === member.accountId`), or
    2. A verified parent/guardian of a minor (`CHILD`) within the same family.
  - Even `OWNER` and `ADMIN` callers have `personalInfo` redacted when inspecting another adult member's profile.
- **Profile Mutation Governance (`canEditMemberProfile`)**:
  - Allows self-profile updates and authorized `OWNER`/`ADMIN` updates on shared profile fields, while blocking non-self mutations to `personalInfo` (`403 PERSONAL_WORKSPACE_PRIVACY_VIOLATION`) and blocking role self-promotion (`403 SELF_PROMOTION_FORBIDDEN`).
- **Relationship Graph Integrity (`validateRelationshipGraph`)**:
  - Rejects self-relationships (`400 SELF_RELATIONSHIP_FORBIDDEN`).
  - Rejects duplicate edges (`409 DUPLICATE_RELATIONSHIP`).
  - Performs depth-first cycle detection across `PARENT_CHILD` and `GUARDIAN` edges to block direct or transitive ancestry loops (`400 RELATIONSHIP_CYCLE_DETECTED`).

### 2.3 Stage 3.3.1 Express Endpoints (`server.ts`)
- `GET /api/v1/session/restore`: Restores authenticated identity, active family membership, and full workspace snapshot across restarts.
- `GET /api/v1/workspace/:familyId`: Returns role-filtered workspace data (`homeSummary`, sanitized `members`, `relationships`, `invitations`, `memberships`, `mediaAssets`, and redacts finance records for `CHILD`/`GUEST`).
- `POST /api/v1/workspaces`: Creates a new family workspace and `OWNER` membership while enforcing the one-family rule.
- `PUT /api/v1/workspace/:familyId/identity`: Updates family name, motto, mission, vision, values, logo, and photo (`OWNER`/`ADMIN` required).
- `POST /api/v1/workspace/:familyId/announcements` & `POST /api/v1/workspace/:familyId/reminders`: Creates live household announcements and reminders.
- `POST /api/v1/members/:familyId`, `PUT /api/v1/members/:familyId/:memberId`, `DELETE /api/v1/members/:familyId/:memberId`: Full member lifecycle with privacy and role-escalation enforcement.
- `POST /api/v1/members/invite`, `POST /api/v1/invitations/:invitationId/respond`, `POST /api/v1/memberships/:membershipId/approve`: Complete invitation -> invitee acceptance -> admin/owner approval workflow.
- `PUT /api/v1/memberships/:membershipId/role` & `POST /api/v1/memberships/:membershipId/revoke`: Role assignment (`OWNER` required for `OWNER`/`ADMIN` promotions; protects last `OWNER`) and immediate access revocation.
- `POST /api/v1/relationships/:familyId` & `DELETE /api/v1/relationships/:familyId/:relationshipId`: Validated relationship creation and soft deletion.
- `POST /api/v1/media/:familyId/upload` & `GET /api/v1/media/:familyId/:mediaId`: Validated media storage (`image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`, max 2 MB) with `SHARED` vs `PERSONAL` access control.
- `POST /api/v1/sync/push` & `GET /api/v1/sync/pull`: Extended bidirectional synchronization for `FAMILY_MEMBER`, `FAMILY_RELATIONSHIP`, `FAMILY_WORKSPACE`, `INVITATION`, and `MEDIA_ASSET`.

---

## 3. Android Implementation (`android/app/src/main/java/com/familyos/...`)

| File | Summary of Changes |
| :--- | :--- |
| `core/domain/Models.kt` | Extended `FamilyWorkspace` (motto, mission, vision, values, logoUrl, photoUrl, announcements, reminders, approvedAiSuggestions) and `FamilyMember` (status, phone, email, bio, emergencyContact, importantDates, personalNotes, medicalNotes, personalGoals, visibility) with backward-compatible defaults; added `MembershipStatus`, `FamilyAnnouncement`, `HouseholdReminder`, `ApprovedAiSuggestion`, `FamilyInvitation`, and `ImportantDateEntry`. |
| `core/domain/FamilySecurityPolicy.kt` | Added `canViewPersonalInfo`, `canEditMemberProfile`, `canAssignRole`, and `canJoinOrCreateFamily` enforcing personal workspace privacy and role governance on Android. |
| `core/viewmodel/FamilyOSViewModel.kt` | Added reactive `StateFlow`s (`invitations`, `memberPersonalVisibility`) and live actions (`updateFamilyIdentity`, `addAnnouncement`, `addHouseholdReminder`, `saveMemberProfile`, `removeFamilyMember`, `inviteMember`, `respondToInvitation`, `approveMember`, `assignMemberRole`, `addRelationship`, `removeRelationship`, `createNewFamilyWorkspace`). |
| `feature/dashboard/DashboardScreen.kt` | Replaced static demonstration cards with live data bound to `FamilyWorkspace`, `FamilyMember`, `CalendarEvent`, `TaskItem`, `Goal`, `Project`, `Transaction` (hidden for `CHILD`/`GUEST`), `AuditLogEntry`, and `ApprovedAiSuggestion`, plus interactive dialogs for editing Family Identity and posting Announcements/Reminders. |
| `feature/family/FamilyTreeScreen.kt` | Removed `defaultSampleMembers` and `defaultSampleRelationships`; implemented 3 sub-views (**Directory & Profiles**, **Relationship Graph**, **Invitations & Governance**) with personal vs shared workspace privacy gating, emergency contact & important dates editing, cycle-safe relationship linking, and member approval/revocation. |
| `MainActivity.kt` | Connected all Stage 3.3.1 `StateFlow` states and mutation callbacks from `FamilyOSViewModel` into `DashboardScreen` and `FamilyTreeScreen`. |

---

## 4. Web Implementation (`src/components/Stage331FamilyExperience.tsx`, `src/App.tsx`)

- Created `src/components/Stage331FamilyExperience.tsx` providing two dedicated, live workspaces backed by `/api/v1/workspace/:familyId`:
  1. **Family Home (`mode="home"`)**:
     - Displays and edits Family Identity (name, motto, mission, vision, core values, logo, and family banner photo upload).
     - Live Today's Agenda, Upcoming Events, Active & Overdue Tasks, Goal & Project Progress, Household Reminders, Important Announcements, Quick Actions, Recent Activity (audit log), Approved AI Suggestions, and Role-Gated Financial Snapshot (automatically hidden for `CHILD`/`GUEST`).
  2. **People & Relationships (`mode="people"`)**:
     - **Members & Profiles**: Member directory, full profile inspector/editor, avatar upload, Emergency Contact card, Birthdays & Important Dates, and strictly segregated **Personal Workspace** (`privateNotes`, `medicalNotes`, `personalGoals`) vs **Shared Family Workspace**.
     - **Relationship Graph**: Interactive relationship creator (`PARENT_CHILD`, `SPOUSE`, `SIBLING`, `GUARDIAN`) with live server-side cycle/self-link error reporting and visual graph cards.
     - **Invitations & Roles**: Send invitations, simulate invitee acceptance, approve `PENDING_APPROVAL` memberships, assign roles, and revoke access.
     - **Create / Join Family**: Demonstrates and enforces the One-Family Membership Rule (`409 ONE_FAMILY_RULE_VIOLATION` when already active in a family).
- Updated `src/App.tsx` to expose **Family Home** (`family_home`) and **People & Relationships** (`people_relationships`) in the top navigation bar and replaced the static Stage 2 tree sub-tab with the live `Stage331FamilyExperience` component.
