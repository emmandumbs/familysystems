process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server';
import { CATEGORY_1_CORE_ITEMS, DEFAULT_SUBITEM_BY_TAB, SUBITEM_LABELS } from '../src/components/SidebarNavigation';

const tokenCache = new Map<string, string>();

async function getSignedToken(baseUrl: string, userAccountId: string): Promise<string> {
  if (userAccountId.startsWith('Bearer ') || userAccountId.includes('.')) {
    return userAccountId.replace(/^Bearer\s+/i, '');
  }
  const cached = tokenCache.get(userAccountId);
  if (cached) return cached;
  const res = await fetch(`${baseUrl}/api/v1/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAccountId,
      email: `${userAccountId}@familyos.test`,
      displayName: userAccountId,
    }),
  });
  const data = await res.json();
  const signed = data.token as string;
  tokenCache.set(userAccountId, signed);
  return signed;
}

async function requestJson(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
  userOrToken = 'usr-sarah-owner'
): Promise<{ status: number; data: any }> {
  const jwt = await getSignedToken(baseUrl, userOrToken);
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('================================================================');
  console.log('FAMILYOS — HOME & FAMILY EXPERIENCE REBUILD VERIFICATION SUITE');
  console.log('================================================================');

  const app = await createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let passed = 0;
  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      passed++;
      console.log(`  ✅ PASS [${passed}]: ${name}`);
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(err);
      server.close();
      process.exit(1);
    }
  };

  try {
    // =========================================================================
    // 1. NAVIGATION ARCHITECTURE TESTS
    // =========================================================================
    await test('Home menu contains exactly the 7 required dashboard submenu items and no Online Presence', () => {
      const homeMenu = CATEGORY_1_CORE_ITEMS.find((i) => i.id === 'family_home');
      assert.ok(homeMenu, 'Home menu item must exist');
      const subitems = homeMenu.subitems || [];
      assert.equal(subitems.length, 7, `Expected 7 Home submenu items, got ${subitems.length}`);

      const expectedHomeSubitems = [
        { id: 'home_command_center', label: 'Main Command Center' },
        { id: 'home_finance_dashboard', label: 'Finance Dashboard' },
        { id: 'home_house_dashboard', label: 'Household Dashboard' },
        { id: 'home_goals_dashboard', label: 'Goals & Projects Dashboard' },
        { id: 'home_relationship_dashboard', label: 'Relationship Dashboard' },
        { id: 'home_parenting_dashboard', label: 'Parenting & Growth Dashboard' },
        { id: 'home_life_dashboard', label: 'Life Management Dashboard' },
      ];

      assert.deepEqual(
        subitems.map((s) => ({ id: s.id, label: s.label })),
        expectedHomeSubitems
      );
      assert.ok(
        !subitems.some((s) => s.id === 'home_online_presence'),
        'Family Online Status must be removed from Home menu'
      );
      assert.equal(DEFAULT_SUBITEM_BY_TAB.family_home, 'home_command_center');
    });

    await test('Family menu contains exactly the 6 required submenu items and no Daily Activity Stream', () => {
      const familyMenu = CATEGORY_1_CORE_ITEMS.find((i) => i.id === 'people_relationships');
      assert.ok(familyMenu, 'Family menu item must exist');
      const subitems = familyMenu.subitems || [];
      assert.equal(subitems.length, 6, `Expected 6 Family submenu items, got ${subitems.length}`);

      const expectedFamilySubitems = [
        { id: 'home_overview', label: 'Family Home Overview' },
        { id: 'people_gallery', label: 'Family Gallery' },
        { id: 'home_constitution', label: 'Family Constitution' },
        { id: 'people_traditions', label: 'Family Traditions & Culture' },
        { id: 'people_activities', label: 'Shared Activities' },
        { id: 'people_rules', label: 'Family Rules & Principles' },
      ];

      assert.deepEqual(
        subitems.map((s) => ({ id: s.id, label: s.label })),
        expectedFamilySubitems
      );
      assert.ok(
        !subitems.some((s) => s.id === 'home_activity'),
        'Daily Activity Stream must be removed from Family menu'
      );
      assert.equal(DEFAULT_SUBITEM_BY_TAB.people_relationships, 'home_overview');
      for (const item of expectedFamilySubitems) {
        assert.ok(SUBITEM_LABELS[item.id], `SUBITEM_LABELS must define ${item.id}`);
      }
    });

    // =========================================================================
    // 2. HOME DASHBOARDS TESTS (ALL 7 DASHBOARDS)
    // =========================================================================
    await test('GET /api/v1/home-dashboards/:familyId hydrates all 7 Home Dashboards from real backend engines', async () => {
      const { status, data } = await requestJson(baseUrl, 'GET', '/api/v1/home-dashboards/fam-1', undefined, 'usr-sarah-owner');
      assert.equal(status, 200);
      assert.equal(data.familyId, 'fam-1');
      assert.ok(data.workspace?.name);

      // 1. Command Center aggregates
      assert.ok(Array.isArray(data.calendarEvents));
      assert.ok(Array.isArray(data.upcomingCelebrations));
      assert.ok(Array.isArray(data.workspace.reminders));

      // 2. Finance Dashboard
      assert.equal(data.financeDashboard.authorized, true);
      assert.equal(typeof data.financeDashboard.netWorthCents, 'number');
      assert.equal(typeof data.financeDashboard.availableCashCents, 'number');
      assert.equal(typeof data.financeDashboard.monthlyIncomeCents, 'number');
      assert.equal(typeof data.financeDashboard.monthlyExpensesCents, 'number');
      assert.ok(Array.isArray(data.financeDashboard.budgets));
      assert.ok(Array.isArray(data.financeDashboard.savingsGoals));
      assert.ok(Array.isArray(data.financeDashboard.recurringRules));
      assert.ok(Array.isArray(data.financeDashboard.recentTransactions));

      // 3. Household Dashboard
      assert.ok(Array.isArray(data.householdDashboard.meals));
      assert.ok(Array.isArray(data.householdDashboard.recipes));
      assert.ok(Array.isArray(data.householdDashboard.chores));
      assert.ok(Array.isArray(data.householdDashboard.pantry));
      assert.ok(Array.isArray(data.householdDashboard.groceries));
      assert.ok(Array.isArray(data.householdDashboard.assets));

      // 4. Goals & Projects Dashboard
      assert.ok(Array.isArray(data.goalsDashboard.goals));
      assert.ok(Array.isArray(data.goalsDashboard.projects));
      assert.ok(Array.isArray(data.goalsDashboard.tasks));
      assert.ok(Array.isArray(data.goalsDashboard.milestones));

      // 5. Relationship Dashboard
      assert.ok(Array.isArray(data.relationshipDashboard.checkins));
      assert.ok(Array.isArray(data.relationshipDashboard.gratitude));
      assert.equal(data.relationshipDashboard.canAccessCoupleEnclave, true);

      // 6. Parenting & Growth Dashboard
      assert.ok(Array.isArray(data.parentingDashboard.childProfiles));
      assert.ok(Array.isArray(data.parentingDashboard.childRoutines));
      assert.ok(Array.isArray(data.parentingDashboard.studyItems));

      // 7. Life Management Dashboard
      assert.ok(Array.isArray(data.lifeDashboard.personalTasks));
      assert.ok(Array.isArray(data.lifeDashboard.documents));
      assert.ok(Array.isArray(data.lifeDashboard.contacts));
      assert.ok(Array.isArray(data.lifeDashboard.vehicles));
    });

    await test('Main Command Center reminder lifecycle (create, toggle complete, dismiss) persists on server', async () => {
      const createRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/workspace/fam-1/reminders',
        { title: 'Verify HVAC Filter Before Winter', dueLabel: '2026-11-15', category: 'MAINTENANCE' },
        'usr-sarah-owner'
      );
      assert.equal(createRes.status, 201);
      const remId = createRes.data.reminder.id;
      assert.ok(remId);

      // Toggle complete
      const toggleRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/workspace/fam-1/reminders',
        { reminderId: remId, toggleCompleted: true },
        'usr-sarah-owner'
      );
      assert.equal(toggleRes.status, 200);
      assert.equal(toggleRes.data.reminder.isCompleted, true);

      // Dismiss reminder
      const dismissRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/workspace/fam-1/reminders',
        { reminderId: remId, dismiss: true },
        'usr-sarah-owner'
      );
      assert.equal(dismissRes.status, 200);
      assert.equal(dismissRes.data.dismissed, true);
    });

    // =========================================================================
    // 3. FAMILY SECTION TESTS (ALL 6 DESTINATIONS)
    // =========================================================================
    await test('1. Family Home Overview: identity update, member directory, and announcement persistence', async () => {
      const idRes = await requestJson(
        baseUrl,
        'PUT',
        '/api/v1/workspace/fam-1/identity',
        {
          name: 'The Henderson Household',
          motto: 'Together in Stewardship, Kindness, and Purpose',
          description: 'Multi-generational family home.',
        },
        'usr-sarah-owner'
      );
      assert.equal(idRes.status, 200);
      assert.equal(idRes.data.workspace.motto, 'Together in Stewardship, Kindness, and Purpose');

      const annRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/workspace/fam-1/announcements',
        {
          title: 'Sunday Family Charter Review',
          body: 'We will review our updated Family Constitution after dinner at 6:30 PM.',
          priority: 'IMPORTANT',
        },
        'usr-sarah-owner'
      );
      assert.equal(annRes.status, 201);
      assert.equal(annRes.data.announcement.title, 'Sunday Family Charter Review');
    });

    await test('2. Family Gallery: create album, upload photo, verify persistence, favorite toggle, and delete', async () => {
      // Create album
      const albRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/family-section/fam-1/albums',
        {
          title: '2026 Summer Mountain Retreat',
          description: 'Hiking and cabin memories.',
          category: 'Vacations',
        },
        'usr-sarah-owner'
      );
      assert.equal(albRes.status, 201);
      const albumId = albRes.data.album.id;
      assert.ok(albumId);

      // Upload photo into album with real PNG image payload
      const validPngDataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const phoRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/family-section/fam-1/photos',
        {
          albumId,
          title: 'Summit Trail Group Photo',
          caption: 'Reached the overlook at 8,200 ft together!',
          eventName: 'Mountain Hike',
          takenDate: '2026-07-18',
          imageUrl: validPngDataUrl,
          visibility: 'FAMILY',
        },
        'usr-sarah-owner'
      );
      assert.equal(phoRes.status, 201);
      assert.equal(phoRes.data.persisted, true);
      const photoId = phoRes.data.photo.id;

      // Favorite toggle
      const favRes = await requestJson(
        baseUrl,
        'PUT',
        `/api/v1/family-section/fam-1/photos/${photoId}`,
        { isFavorite: true },
        'usr-sarah-owner'
      );
      assert.equal(favRes.status, 200);
      assert.equal(favRes.data.photo.isFavorite, true);

      // Verify persisted in GET /api/v1/family-section/fam-1
      const getRes = await requestJson(baseUrl, 'GET', '/api/v1/family-section/fam-1', undefined, 'usr-sarah-owner');
      assert.equal(getRes.status, 200);
      assert.ok(getRes.data.photos.some((p: any) => p.id === photoId && p.isFavorite === true));

      // Delete photo
      const delRes = await requestJson(
        baseUrl,
        'DELETE',
        `/api/v1/family-section/fam-1/photos/${photoId}`,
        undefined,
        'usr-sarah-owner'
      );
      assert.equal(delRes.status, 200);
      assert.equal(delRes.data.deleted, true);
    });

    await test('3. Family Constitution: versioned revision, RBAC protection, and member acknowledgment', async () => {
      // Non-admin member cannot revise constitution
      const forbiddenRes = await requestJson(
        baseUrl,
        'PUT',
        '/api/v1/family-section/fam-1/constitution',
        { motto: 'Unauthorized Motto' },
        'usr-maya-member'
      );
      assert.equal(forbiddenRes.status, 403);

      // OWNER revises constitution and creates a new version
      const revRes = await requestJson(
        baseUrl,
        'PUT',
        '/api/v1/family-section/fam-1/constitution',
        {
          motto: 'Together in Stewardship, Kindness, and Purpose',
          missionStatement: 'To nurture a calm, loving, and financially wise household.',
          visionStatement: 'Generations united by integrity, curiosity, and service.',
          coreValues: ['Respect', 'Stewardship', 'Curiosity', 'Gratitude'],
          legacyStatement: 'We build habits of kindness and wisdom that endure across generations.',
        },
        'usr-sarah-owner'
      );
      assert.equal(revRes.status, 200);
      assert.ok(revRes.data.versionNumber >= 2);

      // Adult member Maya acknowledges the constitution
      const ackRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/family-section/fam-1/constitution/acknowledge',
        {},
        'usr-maya-member'
      );
      assert.equal(ackRes.status, 200);
      assert.ok(
        ackRes.data.constitution.acknowledgments.some((a: any) => a.userAccountId === 'usr-maya-member')
      );
    });

    await test('4. Family Traditions & Culture: create, edit, archive, and restore tradition', async () => {
      const createRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/family-section/fam-1/traditions',
        {
          title: 'First Day of School Pancake Breakfast',
          category: 'Annual Tradition',
          frequency: 'Annually in September',
          nextPlannedDate: '2026-09-02',
          meaningAndOrigin: 'Celebrating every new school year with homemade blueberry pancakes and goal setting.',
          linkedRecipeTitle: 'Grandma’s Buttermilk Pancakes',
        },
        'usr-sarah-owner'
      );
      assert.equal(createRes.status, 201);
      const tradId = createRes.data.tradition.id;

      // Archive tradition
      const archRes = await requestJson(
        baseUrl,
        'PUT',
        `/api/v1/family-section/fam-1/traditions/${tradId}`,
        { status: 'ARCHIVED' },
        'usr-sarah-owner'
      );
      assert.equal(archRes.status, 200);
      assert.equal(archRes.data.tradition.status, 'ARCHIVED');

      // Restore tradition
      const restRes = await requestJson(
        baseUrl,
        'PUT',
        `/api/v1/family-section/fam-1/traditions/${tradId}`,
        { status: 'ACTIVE' },
        'usr-sarah-owner'
      );
      assert.equal(restRes.status, 200);
      assert.equal(restRes.data.tradition.status, 'ACTIVE');
    });

    await test('5. Shared Activities: create activity, verify automatic Master Calendar sync, and RSVP', async () => {
      const createRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/family-section/fam-1/activities',
        {
          title: 'Saturday Family Kayaking & Lake Picnic',
          description: 'Morning paddle on Emerald Lake followed by a picnic lunch.',
          dateIso: '2026-11-21',
          startTime: '09:30',
          endTime: '13:30',
          location: 'Emerald Lake Boathouse',
          category: 'Outdoor Excursion',
          budgetCents: 6500,
          preparationChecklist: [{ id: 'c1', text: 'Pack life jackets and sunscreen', completed: false }],
        },
        'usr-sarah-owner'
      );
      assert.equal(createRes.status, 201);
      const actId = createRes.data.activity.id;
      const calEventId = createRes.data.linkedCalendarEventId;
      assert.ok(calEventId.startsWith('cal-act-'));

      // Verify event exists in Master Family Calendar (/api/v1/calendar/fam-1)
      const calRes = await requestJson(baseUrl, 'GET', '/api/v1/calendar/fam-1', undefined, 'usr-sarah-owner');
      assert.equal(calRes.status, 200);
      const syncedEvent = (calRes.data.events || []).find((e: any) => e.id === calEventId);
      assert.ok(syncedEvent, 'Shared Activity must automatically synchronize to the Master Family Calendar');
      assert.equal(syncedEvent.title, 'Saturday Family Kayaking & Lake Picnic');

      // RSVP by Co-Parent Admin David
      const rsvpRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/family-section/fam-1/activities/${actId}/rsvp`,
        { status: 'GOING' },
        'usr-david-admin'
      );
      assert.equal(rsvpRes.status, 200);
      assert.ok(rsvpRes.data.activity.rsvps.some((r: any) => r.status === 'GOING'));
    });

    await test('6. Family Rules & Principles: OWNER/ADMIN creation, non-admin block, and member acknowledgment', async () => {
      // Non-admin cannot create rule
      const deniedRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/family-section/fam-1/rules',
        { title: 'Unauthorized Rule' },
        'usr-maya-member'
      );
      assert.equal(deniedRes.status, 403);

      // OWNER creates rule
      const createRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/family-section/fam-1/rules',
        {
          title: 'Homework & Study Before Gaming',
          category: 'Age-Appropriate Responsibilities',
          principleStatement: 'We complete daily reading and school assignments before recreational gaming.',
          practicalExpectations: ['Review school planner at 4:00 PM', 'Ask for help early if stuck on an assignment'],
        },
        'usr-sarah-owner'
      );
      assert.equal(createRes.status, 201);
      const ruleId = createRes.data.rule.id;

      // Member acknowledges rule
      const ackRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/family-section/fam-1/rules/${ruleId}/acknowledge`,
        {},
        'usr-maya-member'
      );
      assert.equal(ackRes.status, 200);
      assert.ok(ackRes.data.rule.acknowledgments.length >= 2);
    });

    await test('7. Extended Family Heritage Map: dual-lineage relatives, rounded portraits, age/job/city recognition, and collaborative growth areas', async () => {
      // 1. Verify seeded Paternal & Maternal relatives in GET /api/v1/family-section/fam-1
      const secRes = await requestJson(baseUrl, 'GET', '/api/v1/family-section/fam-1', undefined, 'usr-sarah-owner');
      assert.equal(secRes.status, 200);
      const relatives = secRes.data.extendedRelatives || [];
      assert.ok(relatives.length >= 6, 'Must seed extended relatives across Father’s and Mother’s sides');
      assert.ok(relatives.some((r: any) => r.lineageSide === 'PATERNAL'), 'Must include Paternal lineage');
      assert.ok(relatives.some((r: any) => r.lineageSide === 'MATERNAL'), 'Must include Maternal lineage');
      assert.ok(
        relatives.every(
          (r: any) =>
            r.avatarUrl &&
            typeof r.age === 'number' &&
            r.occupation &&
            r.city &&
            r.country &&
            Array.isArray(r.growthAreas)
        ),
        'Every relative must have a rounded portrait avatarUrl, age, occupation, city, country, and growthAreas'
      );

      // 2. Add a new Extended Relative on Mother's side
      const createRelRes = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/family-section/fam-1/extended-relatives',
        {
          fullName: 'Uncle Kwame Okafor',
          preferredTitle: 'Uncle Kwame',
          lineageSide: 'MATERNAL',
          generationTier: 'PARENTS_AUNTS_UNCLES',
          relationshipToChildren: 'Maternal Uncle (Mother’s Brother)',
          age: 39,
          occupation: 'Solar Microgrid & Clean Energy Architect',
          workplaceOrSpecialty: 'West African Renewable Grid Initiative',
          city: 'Accra',
          country: 'Ghana',
          bioAndHeritageStory: 'Designs solar energy systems for schools and hospitals and loves teaching kids electronics.',
          sharedInterests: ['Solar Engineering', 'Chess', 'Highlife Guitar'],
          conversationStarters: ['Ask Uncle Kwame how solar panels power a school at night.'],
          growthAreas: [
            {
              title: 'Mentoring Youth in Renewable Energy & Electronics',
              category: 'EDUCATION_MENTORSHIP',
              description: 'Hosting monthly virtual STEM build sessions for the nieces and nephews.',
              howKidsCanSupport: 'Prepare questions and share school science projects before the call.',
            },
          ],
        },
        'usr-sarah-owner'
      );
      assert.equal(createRelRes.status, 201);
      const relId = createRelRes.data.relative.id;
      assert.equal(createRelRes.data.relative.lineageSide, 'MATERNAL');
      assert.equal(createRelRes.data.relative.city, 'Accra');
      assert.ok(createRelRes.data.relative.avatarUrl.startsWith('data:image/svg+xml;base64,'));

      // 3. Child role ('usr-lucas-child') identifies a new potential growth area & posts an encouragement note
      const childGrowthRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/family-section/fam-1/extended-relatives/${relId}/growth`,
        {
          action: 'ADD_GROWTH_AREA',
          title: 'Training for the Accra 10K Charity Run',
          category: 'WELLBEING_HEALTH',
          description: 'Building stamina for the community clean-water charity race.',
          howKidsCanSupport: 'Run a weekend 2K practice run and track our times together!',
        },
        'usr-lucas-child'
      );
      assert.equal(childGrowthRes.status, 200);
      assert.equal(childGrowthRes.data.relative.growthAreas.length, 2);

      const childNoteRes = await requestJson(
        baseUrl,
        'POST',
        `/api/v1/family-section/fam-1/extended-relatives/${relId}/growth`,
        {
          action: 'ADD_ENCOURAGEMENT_NOTE',
          message: 'We love learning about solar panels from you, Uncle Kwame!',
        },
        'usr-lucas-child'
      );
      assert.equal(childNoteRes.status, 200);
      assert.equal(childNoteRes.data.relative.encouragementNotes.length, 1);
    });

    // =========================================================================
    // 4. SECURITY, PRIVACY & ROLE ISOLATION TESTS
    // =========================================================================
    await test('Security: CHILD role has financial data redacted in /api/v1/home-dashboards/:familyId', async () => {
      const childRes = await requestJson(
        baseUrl,
        'GET',
        '/api/v1/home-dashboards/fam-1',
        undefined,
        'usr-lucas-child'
      );
      assert.equal(childRes.status, 200);
      assert.equal(childRes.data.financeDashboard.authorized, false);
      assert.equal(childRes.data.financeDashboard.accounts.length, 0);
      assert.equal(childRes.data.relationshipDashboard.canAccessCoupleEnclave, false);
      assert.equal(childRes.data.relationshipDashboard.couplePlans.length, 0);
    });

    await test('Security: Cross-family access to /api/v1/family-section/:familyId and /api/v1/home-dashboards/:familyId is rejected with 403', async () => {
      const outsiderToken = `usr-outsider-${Date.now()}`;
      // Create outsider's own single family
      const createFam = await requestJson(
        baseUrl,
        'POST',
        '/api/v1/workspaces',
        { name: 'Outsider Family' },
        outsiderToken
      );
      assert.equal(createFam.status, 201);

      // Outsider attempts to access fam-1 Home Dashboards
      const homeDenied = await requestJson(
        baseUrl,
        'GET',
        '/api/v1/home-dashboards/fam-1',
        undefined,
        outsiderToken
      );
      assert.equal(homeDenied.status, 403);

      // Outsider attempts to access fam-1 Family Section
      const famDenied = await requestJson(
        baseUrl,
        'GET',
        '/api/v1/family-section/fam-1',
        undefined,
        outsiderToken
      );
      assert.equal(famDenied.status, 403);
    });

    console.log('================================================================');
    console.log(`ALL ${passed}/${passed} HOME & FAMILY REBUILD TESTS PASSED!`);
    console.log('================================================================');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
