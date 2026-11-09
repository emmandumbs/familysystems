# FamilyOS Firestore Security Specification (Stage 3.2)

1. **Default Deny**: All unmapped paths are denied (`allow read, write: if false`).
2. **Authentication & Bootstrapped Admin**:
   - Every access requires `request.auth != null`.
   - Bootstrapped primary admin (`emmanuelsillah19@gmail.com` with `email_verified == true`) or workspace membership doc at `/workspaces/{familyId}/memberships/{request.auth.uid}` establishes role (`OWNER`, `ADMIN`, `MEMBER`, `CHILD`, `GUEST`) and `ACTIVE` status.
3. **Tenant Isolation (`/workspaces/{familyId}`)**:
   - Only `ACTIVE` members of `{familyId}` can read workspace metadata.
   - Only `OWNER` or `ADMIN` of `{familyId}` can create or update workspace metadata.
4. **RBAC Membership Security (`/workspaces/{familyId}/memberships/{userId}`)**:
   - Users can read their own membership document or any membership within their active family workspace.
   - Only `OWNER` or `ADMIN` can create, update, or revoke memberships (preventing self-escalation).
5. **Financial Ledger Security (`/workspaces/{familyId}/accounts/{accountId}` & `/workspaces/{familyId}/transactions/{transactionId}`)**:
   - Only `OWNER` and `ADMIN` can create or mutate financial accounts and transactions.
   - `amountCents` must be a positive integer (`int`).
   - Posted transactions in `/transactions/{transactionId}` are immutable (no `update` or `delete`; corrections require a compensating reversal transaction).
6. **Synchronized Household Entities (`/workspaces/{familyId}/entities/{entityKey}`)**:
   - Active members of `{familyId}` can read shared household entities (`TASK`, `CHORE`, `MEAL_PLAN`, `RECIPE`, `EMERGENCY_CONTACT`, `EMERGENCY_PLAN`).
   - Minor health records (`WELLBEING_PROFILE`, `HEALTH_ALLERGY`, `HEALTH_MEDICATION`) and financial records require `OWNER` or `ADMIN` (or verified guardian via backend gateway).
