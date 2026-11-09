# FAMILYOS — COMMERCIAL RELEASE & GOOGLE PLAY CHECKLIST
**Version**: 2.0.0 (Stage 5 Engineering & Compliance Verified)  
**Target Marketplace**: Google Play Store (Production Distribution)  

---

## 1. Google Play Developer Policy Compliance

- [x] **Target API Level**: Compiled and targeted against API 35 (Android 15) per latest Play Console enforcement (`android/app/build.gradle.kts`).
- [x] **Families Policy Compliance (In-App Engineering)**:
  - [x] App designed for family use with appropriate neutral age screen or guardian gate.
  - [x] Zero behavioral advertising SDKs or third-party ad networks bundled.
  - [x] Child profiles strictly restricted from public sharing or non-guardian access (`tests/stage-5-compliance-audit.test.ts`).
- [ ] **Google Play Data Safety Disclosures (Play Console Store Listing)**:
  - [ ] Data collection explicitly categorized in Play Console: Financial info (user-provided, encrypted in transit and at rest, not shared with third parties).
  - [ ] Personal info (Names, email, profile photos) declared in Play Console as necessary for app functionality.
  - [x] Account deletion URL and in-app automated self-service deletion option (`DELETE /api/v1/account/me` & `UserProfilePage.tsx`) fully functional (`AUTH-07`).
- [x] **Financial & Commercial Billing Policy**:
  - [x] Google Play Billing Library (v7.1.1) integrated for all digital subscription tiers (`FREE`, `INDIVIDUAL`, & `FAMILY` in `BillingManager.kt` & `entitlementRoutes.ts`).
  - [x] Transparent pricing disclosures: Free tier vs Premium capabilities clearly enumerated.
  - [x] Functional "Restore Purchases" button on subscription screen.
  - [x] Core safety, emergency contacts, and local data export never locked behind paywalls (`COMM-01`).

---

## 2. Security, Cryptography & Anti-Abuse Verification

- [x] **No Hardcoded Credentials**: Source repository audited for zero embedded API keys, Google Cloud secrets, or keystores (`tests/stage-5-compliance-audit.test.ts`).
- [x] **R8 Code Shrinking & Obfuscation**: ProGuard rules verified; reflection models preserved via `@Keep` or Kotlinx Serialization.
- [ ] **Play Integrity API Live Console Binding**: Server backend linked to production Play Console hardware attestation project for release APK/AAB signing key.
- [x] **Firebase Security Rules Audited**: Verified zero open read/write access and strict family membership boundaries (`firestore.rules`).
- [x] **Android Keystore Hardware Validation**: `MasterKey` verified with fail-closed `IllegalStateException` enforcement in `DatabaseKeyManager.kt`.

---

## 3. Engineering Quality Gates

- [x] **Zero Floating-Point Financials**: Codebase audit confirms `Double`/`Float` absent from financial entities and arithmetic (`tests/stage-5-compliance-audit.test.ts`).
- [x] **17 Mission-Critical Test Scenarios**: 100% automated test suite passing in CI pipeline (`.github/workflows/azure-webapps-node.yml` & `.github/workflows/android.yml`).
- [x] **Room Database Migration Integrity**: All incremental migration scripts (`MIGRATION_1_2` through `MIGRATION_8_9`, exported schemas `1.json`–`9.json`) validated in `FamilyOSMigrationInstrumentedTest.kt` and `Migration7To8Test.kt`.
- [x] **Accessibility AA Compliance**: Touch targets >= 48dp, minimum contrast ratio >= 4.5:1, screen reader labels and keyboard navigation on interactive controls (`TEST-A11Y`).
- [x] **Offline Flight Mode Stress Test**: Complete creation of meals, chores, tasks, and expense records with network disconnected, followed by deterministic queue sync upon reconnect (`SYS-01`).
- [x] **Clean Production Artifact**: No debug logs, mock authentication routines, or demo databases present in production pathways.

