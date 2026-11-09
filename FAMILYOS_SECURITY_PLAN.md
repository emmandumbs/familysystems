# FAMILYOS — SECURITY & PRIVACY SPECIFICATION
**Version**: 1.0.0 (Stage 0 Baseline)  
**Standard**: Commercial-Grade, GDPR, COPPA & Play Integrity Compliant  

---

## 1. Foundational Security & Encryption Architecture

1. **Deny by Default**: Every API endpoint, database document, and domain use case rejects access unless explicit membership and role permissions are validated server-side.
2. **Server-Side Authorization Authority**: The Android client UI adapts to the user's role for usability, but security is strictly enforced on the server. No client-side assertion of role or permission is trusted without verifying the Firebase Auth JWT custom claims.
3. **Local Database Encryption Evaluation & Strategy**:
   - **SQLCipher with Room (`net.zetetic:sqlcipher-android:4.5.5`)**: Selected for production builds requiring 256-bit AES database encryption at rest. Integrates with Room via `SupportFactory`. Room itself does *not* encrypt SQLite databases natively without SQLCipher.
   - **Key Management**: Passphrase generated cryptographically (256-bit random) and secured in the hardware-backed **Android Keystore** (`MasterKey` with AES-256-GCM).
   - **Key Rotation**: Managed through atomic database export/re-keying (`PRAGMA rekey`) during scheduled app migrations.
   - **Backup & Recovery Policy**: Android Auto Backup (`allowBackup = false` for SQLite database file) prevents unencrypted database leakage to Google Drive backups. Legitimate user data is recovered by authenticating with Firebase and re-syncing from the authorized cloud partition.
   - **EncryptedSharedPreferences**: Used for storing local preference flags and non-sensitive token pointers.
4. **Zero Covert Surveillance**: Location features require explicit real-time opt-in and permanent notification bar status indicators. Covert child monitoring or silent tracking is architecturally barred.

---

## 2. AI Privacy, Data Minimization & Provider Boundaries (Gemini 2.5)

1. **No Guaranteed Anonymization Claims**: PII filtering significantly reduces exposure, but FamilyOS documentation acknowledges that algorithmic redaction cannot guarantee mathematical anonymity.
2. **Strict Exclusions by Default**:
   - Minor child profiles, private health records/medications, and financial transactions/account numbers are **strictly excluded** from AI prompts by default.
   - Explicit user consent and a clear contextual preview are required before sending any family data to AI.
3. **Data Minimization & Boundary Rules**:
   - Only contextual task or meal planning outlines are transmitted.
   - Zero storage of family prompts for model training.
   - All AI responses are prominently badged as "AI Draft" and require manual human approval before committing to the database.

---

## 3. Commercial Entitlement & Google Play Security

1. **Server-Authoritative Entitlements**: Google Play Billing purchase tokens are verified on the backend before granting premium family tier capabilities.
2. **Zero In-App Secrets**: No private keys or service account credentials exist in the client APK.
3. **Play Integrity API**: Validates genuine app licensing and hardware attestation verdicts before processing sensitive operations.

| Permission Key | OWNER | ADMIN (Spouse/Co-Parent) | MEMBER (Teen/Adult) | CHILD | GUEST (Babysitter) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Workspace Settings / Billing** | Full | View / Edit | Denied | Denied | Denied |
| **Invite / Remove Family Members** | Full | Invite / Edit | Denied | Denied | Denied |
| **Financial Accounts & Transactions**| Full | Full | View Only (Own) | Denied | Denied |
| **Cash-Flow & Net Worth Analytics** | Full | Full | Denied | Denied | Denied |
| **Goals, Projects & Tasks** | Full | Full | Full (Assigned) | View Chores | Assigned Chores |
| **Meal Planner & Recipes** | Full | Full | Full | View / Rate | View |
| **Chores & Point Redemptions** | Full | Full / Verify | Self-Complete | Self-Complete | Verify Assigned |
| **Private Journals / Reflections** | Author Only | Author Only | Author Only | Author Only | Denied |
| **Child Development & School Records**| Full | Full | View Only | Denied | Denied |
| **Emergency Directory & Home Safety** | Full | Full | Full | Emergency View | Emergency View |

---

## 4. Child Privacy & Guardian Protections (COPPA & GDPR-K Compliance)

1. **Decoupled Identity**: Children under 13 do not register email/password credentials or OAuth accounts. A guardian creates a `FamilyMember` profile with `linkedAccountId = null`.
2. **Guardian PIN / Biometric Switch**: Switching from a child's view to a parent's administrative mode requires local biometric authentication or the parent's security PIN.
3. **Zero AI Exposure of Minor Data**: When invoking Gemini AI assistance (e.g. for homework plans or chore suggestions), personal child names, birth dates, and location indicators are tokenized (e.g., replaced with "Child aged 8") before network transit.
4. **No Third-Party Trackers**: No third-party behavioral analytics, ad networks, or tracking SDKs exist within the app codebase.

---

## 5. Anti-Cloning & IP Protection Architecture

1. **R8 / ProGuard Code Obfuscation**: Full class, method, and field name obfuscation enabled on release builds.
2. **Play Integrity API**:
   - Verification token sent with sensitive backend requests (e.g., workspace creation, billing sync, invitation redemption).
   - Server verifies device verdict, app licensing verdict, and basic integrity to prevent modified, repackaged, or rooted bot runs from draining AI APIs.
3. **Server-Side Core Business Logic**: Complex algorithmic tasks (cash-flow allocations, AI prompt engineering, and receipt parsing) run exclusively server-side.
4. **Signed Release Certificates**: Dedicated Google Play App Signing key with multi-factor hardware security key protection.

---

## 6. Security Rules Blueprint (Firestore / Backend)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper Functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isFamilyMember(familyId) {
      return isSignedIn() && 
        exists(/databases/$(database)/documents/family_workspaces/$(familyId)/members/$(request.auth.uid));
    }
    
    function getMemberRole(familyId) {
      return get(/databases/$(database)/documents/family_workspaces/$(familyId)/members/$(request.auth.uid)).data.role;
    }
    
    function isOwnerOrAdmin(familyId) {
      return isFamilyMember(familyId) && 
        (getMemberRole(familyId) == 'OWNER' || getMemberRole(familyId) == 'ADMIN');
    }

    // Workspaces
    match /family_workspaces/{familyId} {
      allow read: if isFamilyMember(familyId);
      allow create: if isSignedIn();
      allow update: if isOwnerOrAdmin(familyId);
      allow delete: if isSignedIn() && getMemberRole(familyId) == 'OWNER';

      // Financial Subcollections (Owner / Admin Only)
      match /financial_accounts/{accountId} {
        allow read, write: if isOwnerOrAdmin(familyId);
      }
      
      // General Household Subcollections
      match /chores/{choreId} {
        allow read: if isFamilyMember(familyId);
        allow write: if isFamilyMember(familyId);
      }
    }
  }
}
```
