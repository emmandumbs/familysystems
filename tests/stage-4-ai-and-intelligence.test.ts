process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import { sanitizeFamilyContextForAi } from '../src/server/aiGatewayRoutes';
import { searchRouter } from '../src/server/searchRoutes';
import { exportRouter } from '../src/server/exportRoutes';
import { entitlementRouter, computeFamilyEntitlement } from '../src/server/entitlementRoutes';
import { loadStore } from '../server.js';

console.log('--- Starting Master Stage 4: AI, Intelligence & Premium Experience Test Suite ---');

// Setup test store in memory
const testFamilyId = 'fam-stage4-test';

const initialTestStore = {
  workspace: { id: testFamilyId, name: 'The Harrison Family', motto: 'Growing Together', mission: 'To love and build' },
  workspaces: {
    [testFamilyId]: { id: testFamilyId, name: 'The Harrison Family', motto: 'Growing Together', mission: 'To love and build' }
  },
  userAccounts: [
    { id: 'usr-parent-owner', email: 'owner@harrison.local' },
    { id: 'usr-parent-admin', email: 'admin@harrison.local' },
    { id: 'usr-member-teen', email: 'teen@harrison.local' },
    { id: 'usr-child-minor', email: 'child@harrison.local' },
    { id: 'usr-guest-care', email: 'guest@harrison.local' },
  ],
  familyMembers: [
    {
      id: 'mem-owner',
      familyId: testFamilyId,
      displayName: 'Alice Harrison',
      relationshipToPrimary: 'Parent',
      role: 'OWNER',
      allergies: ['Shellfish'],
      dietaryNotes: 'Pescatarian',
      isDeleted: false,
    },
    {
      id: 'mem-child',
      familyId: testFamilyId,
      displayName: 'Bobby Harrison',
      relationshipToPrimary: 'Child',
      role: 'CHILD',
      birthDate: '2016-04-12', // Approx 10 yrs old
      allergies: ['Peanuts'],
      dietaryNotes: 'Nut allergy - strict',
      isDeleted: false,
    },
    {
      id: 'mem-guest',
      familyId: testFamilyId,
      displayName: 'Grandpa Joe',
      relationshipToPrimary: 'Grandparent',
      role: 'GUEST',
      allergies: [],
      isDeleted: false,
    }
  ],
  familyMemberships: [
    { id: 'ms-owner', userAccountId: 'usr-parent-owner', familyId: testFamilyId, memberProfileId: 'mem-owner', role: 'OWNER', status: 'ACTIVE' },
    { id: 'ms-child', userAccountId: 'usr-child-minor', familyId: testFamilyId, memberProfileId: 'mem-child', role: 'CHILD', status: 'ACTIVE' },
    { id: 'ms-guest', userAccountId: 'usr-guest-care', familyId: testFamilyId, memberProfileId: 'mem-guest', role: 'GUEST', status: 'ACTIVE' },
  ],
  householdRecipes: [
    {
      id: 'rcp-pasta',
      familyId: testFamilyId,
      title: 'Creamy Lemon Pasta',
      description: 'Quick weeknight lemon parmesan pasta',
      category: 'DINNER',
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      servings: 4,
      ingredients: [
        { name: 'Fettuccine', quantity: 400, unit: 'g' },
        { name: 'Lemons', quantity: 2, unit: 'whole' },
        { name: 'Heavy Cream', quantity: 200, unit: 'ml' },
      ],
      instructions: ['Boil pasta', 'Simmer cream and lemon zest', 'Toss together with parmesan'],
      isDeleted: false,
    }
  ],
  householdChores: [
    {
      id: 'chr-dishes',
      familyId: testFamilyId,
      title: 'Empty Dishwasher',
      description: 'Unload clean dishes into cupboards',
      assignedMemberId: 'mem-child',
      frequency: 'DAILY',
      pointsValue: 15,
      isDeleted: false,
    },
    {
      id: 'chr-plants',
      familyId: testFamilyId,
      title: 'Water Balcony Plants',
      description: 'Water all herbs and flowers',
      assignedMemberId: 'mem-guest',
      frequency: 'WEEKLY',
      pointsValue: 10,
      isDeleted: false,
    }
  ],
  householdAssets: [
    {
      id: 'ast-boiler',
      familyId: testFamilyId,
      name: 'Main Gas Water Heater',
      category: 'GAS',
      location: 'Basement Mechanical Room',
      notes: 'Turn yellow valve 90 degrees clockwise to isolate main gas line.',
      isDeleted: false,
    }
  ],
  synchronizedEntities: {
    'ent-goal-1': {
      id: 'ent-goal-1',
      familyId: testFamilyId,
      entityType: 'GOAL',
      data: { title: 'Annual Family Camping Trek', category: 'ADVENTURE', description: 'Gear prep and site reservation' },
      version: 1,
      isDeleted: false,
    },
    'ent-task-1': {
      id: 'ent-task-1',
      familyId: testFamilyId,
      entityType: 'TASK',
      data: { title: 'Inspect 4-person tent and sleeping pads', priority: 'HIGH', description: 'Check seams for waterproofing' },
      version: 1,
      isDeleted: false,
    },
    'ent-tradition-1': {
      id: 'ent-tradition-1',
      familyId: testFamilyId,
      entityType: 'FAMILY_TRADITION',
      data: { title: 'Sunday Pancake Breakfast', season: 'YEAR_ROUND', description: 'Cooking pancakes together every Sunday morning' },
      version: 1,
      isDeleted: false,
    },
    'ent-contact-1': {
      id: 'ent-contact-1',
      familyId: testFamilyId,
      entityType: 'IMPORTANT_CONTACT',
      data: { name: 'Dr. Emily Watson (Pediatrician)', role: 'Pediatric Care', phone: '555-0199' },
      version: 1,
      isDeleted: false,
    }
  }
};

// Seed store in memory
const store: any = loadStore();
store.workspaces = store.workspaces || {};
store.workspaces[testFamilyId] = initialTestStore.workspaces[testFamilyId];
store.userAccounts = store.userAccounts || [];
store.familyMembers = store.familyMembers || [];
store.familyMemberships = store.familyMemberships || [];
store.memberships = store.memberships || [];
store.householdRecipes = store.householdRecipes || [];
store.householdChores = store.householdChores || [];
store.householdAssets = store.householdAssets || [];
store.synchronizedEntities = store.synchronizedEntities || {};

for (const u of initialTestStore.userAccounts) {
  if (!store.userAccounts.some((x: any) => x.id === u.id)) store.userAccounts.push(u);
}
for (const m of initialTestStore.familyMembers) {
  if (!store.familyMembers.some((x: any) => x.id === m.id)) store.familyMembers.push(m as any);
}
for (const ms of initialTestStore.familyMemberships) {
  if (!store.familyMemberships.some((x: any) => x.id === ms.id)) store.familyMemberships.push(ms as any);
  if (!store.memberships.some((x: any) => x.id === ms.id)) store.memberships.push(ms as any);
}
for (const r of initialTestStore.householdRecipes) {
  if (!store.householdRecipes.some((x: any) => x.id === r.id)) store.householdRecipes.push(r as any);
}
for (const c of initialTestStore.householdChores) {
  if (!store.householdChores.some((x: any) => x.id === c.id)) store.householdChores.push(c as any);
}
for (const a of initialTestStore.householdAssets) {
  if (!store.householdAssets.some((x: any) => x.id === a.id)) store.householdAssets.push(a as any);
}
Object.assign(store.synchronizedEntities, initialTestStore.synchronizedEntities);

async function runTests() {
  // =========================================================================
  // 1. PII Redaction & Zero-Trust Tokenization
  // =========================================================================
  console.log('1. Testing PII stripping & zero-trust tokenization for AI prompts...');
  {
    const sanitized = sanitizeFamilyContextForAi(loadStore(), testFamilyId);
    
    // Check that real names are tokenized
    const allNamesTokenized = sanitized.tokenizedMembers.every((m: any) => 
      m.token.startsWith('Member_') || m.token.startsWith('Child_')
    );
    assert.equal(allNamesTokenized, true, 'All personal names must be tokenized (e.g. Member_A, Child_1)');
    
    // Check that exact birth dates are stripped
    for (const m of sanitized.tokenizedMembers) {
      assert.equal((m as any).birthDate, undefined, 'Raw birth dates must never be in AI context');
      assert.equal((m as any).displayName, undefined, 'Display names must never be in AI context');
    }

    // Check minor medical records / financial accounts are not present
    assert.equal((sanitized as any).financialAccounts, undefined, 'Financial accounts must never be sent to AI');
    assert.equal((sanitized as any).transactions, undefined, 'Financial transactions must never be sent to AI');
  }

  // =========================================================================
  // 2. AI Gateway RBAC Gate
  // =========================================================================
  console.log('2. Testing AI Gateway RBAC enforcement (blocking CHILD & GUEST)...');
  {
    // Mock request/response for CHILD role
    const makeReqRes = (userAccountId: string) => {
      let statusCode = 200;
      let jsonBody: any = null;
      const req = {
        params: { familyId: testFamilyId },
        actor: { userAccountId },
        body: { days: 7, dietaryPreferences: ['vegetarian'] },
      } as any;
      const res = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: any) {
          jsonBody = data;
          return this;
        }
      } as any;
      return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
    };

    // CHILD test
    const childMock = makeReqRes('usr-child-minor');
    const { aiGatewayRouter } = await import('../src/server/aiGatewayRoutes');
    
    // We invoke the handler via route matching or directly
    // Let's test the route handler for /:familyId/meal-plan-draft
    const routes = (aiGatewayRouter as any).stack;
    const mealPlanRoute = routes.find((r: any) => r.route?.path === '/:familyId/meal-plan-draft')?.route;
    assert.ok(mealPlanRoute, 'Meal plan route must be defined on aiGatewayRouter');

    const handler = mealPlanRoute.stack[0].handle;

    await handler(childMock.req, childMock.res);
    assert.equal(childMock.getStatus(), 403, 'Child profile must be rejected with 403');
    assert.equal(childMock.getBody().error, 'CHILD_AI_ACCESS_DENIED');

    // GUEST test
    const guestMock = makeReqRes('usr-guest-care');
    await handler(guestMock.req, guestMock.res);
    assert.equal(guestMock.getStatus(), 403, 'Guest profile must be rejected with 403');
    assert.equal(guestMock.getBody().error, 'GUEST_AI_ACCESS_DENIED');
  }

  // =========================================================================
  // 3. AI Consent Enforcement
  // =========================================================================
  console.log('3. Testing AI Consent Requirement & Consent Verification...');
  {
    const { aiGatewayRouter } = await import('../src/server/aiGatewayRoutes');
    (store.workspaces[testFamilyId] as any).aiConsentGiven = false;

    const makeReqRes = (userAccountId: string, bodyExtra: any = {}) => {
      let statusCode = 200;
      let jsonBody: any = null;
      const req = {
        params: { familyId: testFamilyId },
        actor: { userAccountId },
        body: { days: 7, ...bodyExtra },
      } as any;
      const res = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: any) {
          jsonBody = data;
          return this;
        }
      } as any;
      return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
    };

    const routes = (aiGatewayRouter as any).stack;
    const mealPlanRoute = routes.find((r: any) => r.route?.path === '/:familyId/meal-plan-draft')?.route;
    const handler = mealPlanRoute.stack[0].handle;

    // OWNER without consent
    const ownerNoConsent = makeReqRes('usr-parent-owner');
    await handler(ownerNoConsent.req, ownerNoConsent.res);
    assert.equal(ownerNoConsent.getStatus(), 400, 'Must require AI consent before generating drafts');
    assert.equal(ownerNoConsent.getBody().error, 'AI_CONSENT_REQUIRED');

    // Grant consent via route or body
    const ownerWithConsent = makeReqRes('usr-parent-owner', { consentConfirmed: true });
    await handler(ownerWithConsent.req, ownerWithConsent.res);
    assert.equal(ownerWithConsent.getStatus(), 200, 'Must succeed when consent is granted');
    assert.equal(ownerWithConsent.getBody().isAiDraft, true, 'Response must be marked isAiDraft: true');
    assert.equal(ownerWithConsent.getBody().requiresHumanApproval, true, 'Response must require human approval');
  }

  // =========================================================================
  // 4. Non-Persistence Invariant: AI endpoints never persist directly
  // =========================================================================
  console.log('4. Testing Non-Persistence Invariant (Human-in-the-Loop Gate)...');
  {
    const storeBefore = JSON.stringify(loadStore().householdRecipes);
    const { aiGatewayRouter } = await import('../src/server/aiGatewayRoutes');
    const routes = (aiGatewayRouter as any).stack;
    const goalRoute = routes.find((r: any) => r.route?.path === '/:familyId/goal-breakdown-draft')?.route;
    const handler = goalRoute.stack[0].handle;

    let statusCode = 200;
    let jsonBody: any = null;
    const req = {
      params: { familyId: testFamilyId },
      actor: { userAccountId: 'usr-parent-owner' },
      body: { goalTitle: 'Build Backyard Greenhouse', consentConfirmed: true },
    } as any;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { jsonBody = data; return this; }
    } as any;

    await handler(req, res);
    assert.equal(statusCode, 200);
    assert.equal(jsonBody.isAiDraft, true);
    assert.equal(jsonBody.requiresHumanApproval, true);

    // Verify database was NOT modified
    const storeAfter = JSON.stringify(loadStore().householdRecipes);
    assert.equal(storeBefore, storeAfter, 'AI generation must NEVER persist records directly without human approval');
  }

  // =========================================================================
  // 5. Multi-Domain Scope-Safe Global Search (SYS-05)
  // =========================================================================
  console.log('5. Testing Multi-Domain Scope-Safe Global Search & Privacy Scoping...');
  {
    const searchStack = (searchRouter as any).stack;
    const searchHandler = searchStack.find((r: any) => r.route?.path === '/:familyId')?.route.stack[0].handle;
    assert.ok(searchHandler, 'Search handler must be registered');

    // Search query "lemon" as OWNER -> finds Lemon Pasta recipe
    {
      let statusCode = 200;
      let body: any = null;
      const req = {
        params: { familyId: testFamilyId },
        actor: { userAccountId: 'usr-parent-owner' },
        query: { q: 'lemon' },
      } as any;
      const res = {
        status(code: number) { statusCode = code; return this; },
        json(data: any) { body = data; return this; }
      } as any;

      searchHandler(req, res);
      assert.equal(statusCode, 200);
      assert.ok(body.results.length >= 1, 'Should find recipe for "lemon"');
      assert.equal(body.results[0].domain, 'RECIPE');
      assert.equal(body.results[0].title, 'Creamy Lemon Pasta');
    }

    // Search query "camping" as CHILD -> bar from Goal results
    {
      let statusCode = 200;
      let body: any = null;
      const req = {
        params: { familyId: testFamilyId },
        actor: { userAccountId: 'usr-child-minor' },
        query: { q: 'camping' },
      } as any;
      const res = {
        status(code: number) { statusCode = code; return this; },
        json(data: any) { body = data; return this; }
      } as any;

      searchHandler(req, res);
      assert.equal(statusCode, 200);
      // Goals are barred for CHILD
      const hasGoal = body.results.some((r: any) => r.domain === 'GOAL');
      assert.equal(hasGoal, false, 'CHILD role must NOT see GOAL search results');
    }

    // Search query "pediatrician" as CHILD -> EMERGENCY_CONTACT is allowed
    {
      let statusCode = 200;
      let body: any = null;
      const req = {
        params: { familyId: testFamilyId },
        actor: { userAccountId: 'usr-child-minor' },
        query: { q: 'pediatrician' },
      } as any;
      const res = {
        status(code: number) { statusCode = code; return this; },
        json(data: any) { body = data; return this; }
      } as any;

      searchHandler(req, res);
      assert.equal(statusCode, 200);
      assert.ok(body.results.length >= 1, 'Emergency contacts must be accessible to CHILD');
      assert.equal(body.results[0].domain, 'EMERGENCY_CONTACT');
    }
  }

  // =========================================================================
  // 6. Printable Cards & Offline Emergency Packet Engine (DOC-01)
  // =========================================================================
  console.log('6. Testing Printable Recipe Cards, Emergency Packet & Constitution Export...');
  {
    const exportRoutes = (exportRouter as any).stack;

    // 6a. Recipe Card with 2x Scaling & QR Deep Link
    {
      const recipeRoute = exportRoutes.find((r: any) => r.route?.path === '/:familyId/recipe/:recipeId')?.route.stack[0].handle;
      assert.ok(recipeRoute, 'Recipe card route must be registered');

      let body: any = null;
      const req = {
        params: { familyId: testFamilyId, recipeId: 'rcp-pasta' },
        actor: { userAccountId: 'usr-parent-owner' },
        query: { scale: '2' },
      } as any;
      const res = {
        status(code: number) { return this; },
        json(data: any) { body = data; return this; }
      } as any;

      recipeRoute(req, res);
      assert.equal(body.documentType, 'RECIPE_CARD');
      assert.equal(body.recipe.servingScale, 2);
      assert.equal(body.recipe.effectiveServings, 8); // 4 * 2
      // Check scaled ingredient: 400g * 2 = 800
      const fettuccine = body.recipe.scaledIngredients.find((i: any) => i.name === 'Fettuccine');
      assert.equal(fettuccine.quantity, 800);
      assert.equal(body.recipe.deepLinkUri, 'familyos://recipe/rcp-pasta');
      assert.ok(body.recipe.qrSvgUrl.includes('familyos%3A%2F%2Frecipe%2Frcp-pasta'));
    }

    // 6b. Offline Emergency Crisis Packet
    {
      const emergencyRoute = exportRoutes.find((r: any) => r.route?.path === '/:familyId/emergency-packet')?.route.stack[0].handle;
      assert.ok(emergencyRoute, 'Emergency packet route must be registered');

      let body: any = null;
      const req = {
        params: { familyId: testFamilyId },
        actor: { userAccountId: 'usr-parent-owner' },
      } as any;
      const res = {
        status(code: number) { return this; },
        json(data: any) { body = data; return this; }
      } as any;

      emergencyRoute(req, res);
      assert.equal(body.documentType, 'EMERGENCY_CRISIS_PACKET');
      assert.equal(body.isFreeTierBenefit, true);
      assert.ok(body.memberMedicalAlerts.length >= 2);
      // Bobby's allergy is included
      const bobbyAlert = body.memberMedicalAlerts.find((m: any) => m.displayName === 'Bobby Harrison');
      assert.ok(bobbyAlert.allergies.includes('Peanuts'));
      // Utility shutoff instructions
      assert.ok(body.utilityShutoffs.some((u: any) => u.name === 'Main Gas Water Heater'));
    }

    // 6c. Family Constitution
    {
      const constitutionRoute = exportRoutes.find((r: any) => r.route?.path === '/:familyId/constitution')?.route.stack[0].handle;
      assert.ok(constitutionRoute, 'Constitution route must be registered');

      let body: any = null;
      const req = {
        params: { familyId: testFamilyId },
        actor: { userAccountId: 'usr-parent-owner' },
      } as any;
      const res = {
        status(code: number) { return this; },
        json(data: any) { body = data; return this; }
      } as any;

      constitutionRoute(req, res);
      assert.equal(body.documentType, 'FAMILY_CONSTITUTION');
      assert.equal(body.motto, 'Growing Together');
      assert.ok(body.signatureMembers.length >= 3);
    }
  }

  // =========================================================================
  // 7. Commercial Entitlements & Google Play Billing (COMM-01)
  // =========================================================================
  console.log('7. Testing Commercial Invariant & Google Play Purchase Verification...');
  {
    // 7a. Universal Free Invariant
    const freeEntitlement = computeFamilyEntitlement(testFamilyId, 'FREE', 'DEFAULT_FREE');
    assert.equal(freeEntitlement.features.offlineEmergencyPacket, true, 'Emergency packet must be free on FREE tier');
    assert.equal(freeEntitlement.features.fullDataExport, true, 'Data export must be free on FREE tier');
    assert.equal(freeEntitlement.features.canUseAiDrafts, false, 'AI drafts must be restricted on FREE tier');

    // 7b. Family Plan Entitlement
    const familyEntitlement = computeFamilyEntitlement(testFamilyId, 'FAMILY', 'GOOGLE_PLAY');
    assert.equal(familyEntitlement.features.offlineEmergencyPacket, true);
    assert.equal(familyEntitlement.features.canUseAiDrafts, true);
    assert.equal(familyEntitlement.features.multiParentAdmin, true);
    assert.ok(familyEntitlement.signature, 'Entitlement must include cryptographic HMAC signature');

    // 7c. Google Play Purchase Token Verification Route
    const billingRoutes = (entitlementRouter as any).stack;
    const verifyRoute = billingRoutes.find((r: any) => r.route?.path === '/verify-purchase')?.route.stack[0].handle;
    assert.ok(verifyRoute, 'Verify purchase route must be registered');

    let verifyStatusCode = 200;
    let verifyBody: any = null;
    const verifyReq = {
      actor: { userAccountId: 'usr-parent-owner' },
      body: {
        familyId: testFamilyId,
        purchaseToken: 'gplay-token-test-12345',
        productId: 'familyos_premium_family_annual',
        packageName: 'com.familyos',
      },
    } as any;
    const verifyRes = {
      status(code: number) { verifyStatusCode = code; return this; },
      json(data: any) { verifyBody = data; return this; }
    } as any;

    verifyRoute(verifyReq, verifyRes);
    assert.equal(verifyStatusCode, 200);
    assert.equal(verifyBody.verified, true);
    assert.equal(verifyBody.entitlement.tier, 'FAMILY');
    assert.equal(verifyBody.entitlement.features.canUseAiDrafts, true);
    assert.equal(verifyBody.entitlement.features.offlineEmergencyPacket, true);

    // 7d. Restore Purchases Route
    const restoreRoute = billingRoutes.find((r: any) => r.route?.path === '/:familyId/restore')?.route.stack[0].handle;
    assert.ok(restoreRoute, 'Restore purchases route must be registered');

    let restoreStatusCode = 200;
    let restoreBody: any = null;
    const restoreReq = {
      params: { familyId: testFamilyId },
      actor: { userAccountId: 'usr-parent-owner' },
    } as any;
    const restoreRes = {
      status(code: number) { restoreStatusCode = code; return this; },
      json(data: any) { restoreBody = data; return this; }
    } as any;

    restoreRoute(restoreReq, restoreRes);
    assert.equal(restoreStatusCode, 200);
    assert.equal(restoreBody.restored, true);
    assert.ok(restoreBody.entitlement.signature);
  }

  console.log('--- All Master Stage 4 Automated Verification Tests Passed! ---');
}

runTests().catch((err) => {
  console.error('Master Stage 4 Test Failure:', err);
  process.exit(1);
});
