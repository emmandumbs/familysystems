import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const STORE_PATH = path.resolve(process.cwd(), 'data', 'familyos-shared-store.json');

interface GateResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: GateResult[] = [];

function recordGate(id: string, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const badge = passed ? 'PASS' : 'FAIL';
  console.log(`[${badge}] ${id} — ${name}: ${details}`);
}

async function getToken(userAccountId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAccountId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to get session token for ${userAccountId}: ${res.status}`);
  }
  const data = await res.json();
  return data.token as string;
}

async function runVerification() {
  console.log('==================================================================');
  console.log('FAMILYOS STAGE 3.3.2 — AUTOMATED VERIFICATION SUITE (TESTS 1–15)');
  console.log('==================================================================');

  const originalStoreSnapshot = fs.existsSync(STORE_PATH)
    ? fs.readFileSync(STORE_PATH, 'utf-8')
    : null;

  try {
    const sarahOwnerToken = await getToken('usr-sarah-owner');
    const davidAdminToken = await getToken('usr-david-admin');
    const mayaMemberToken = await getToken('usr-maya-member');
    const lucasChildToken = await getToken('usr-lucas-child');
    const marthaGuestToken = await getToken('usr-martha-guest');
    const revokedToken = await getToken('usr-revoked-former');
    const fam2Token = await getToken('usr-fam2-owner');

    // ------------------------------------------------------------------
    // P332-01: Goal CRUD, Mission/Vision Linkage, Measurable Metrics & Reviews
    // ------------------------------------------------------------------
    const createGoalRes = await fetch(`${BASE_URL}/api/v1/goals/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        title: 'Establish 100% Renewable Home Energy Storage',
        description: 'Install 13.5kWh battery backup tied to Family Mission of calm preparedness',
        category: 'HOUSEHOLD',
        scope: 'FAMILY',
        horizon: 'LONG_TERM',
        priority: 'HIGH',
        isMeasurable: true,
        targetMetricValue: 13.5,
        currentMetricValue: 4.5,
        metricUnit: 'kWh',
        linkedToMission: true,
        linkedToVision: true,
      }),
    });
    const createGoalData = await createGoalRes.json();
    const createdGoalId = createGoalData.goal?.id;

    const addReviewRes = await fetch(`${BASE_URL}/api/v1/goals/fam-1/${createdGoalId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        notes: 'Completed initial electrical load calculation and vendor comparison.',
      }),
    });
    const addReviewData = await addReviewRes.json();

    const p332_01_pass =
      createGoalRes.status === 201 &&
      Boolean(createdGoalId) &&
      createGoalData.goal?.linkedToMission === true &&
      createGoalData.goal?.linkedToVision === true &&
      createGoalData.goal?.isMeasurable === true &&
      addReviewRes.status === 201 &&
      Array.isArray(addReviewData.goal?.reviews) &&
      addReviewData.goal.reviews.length === 1;

    recordGate(
      'P332-01',
      'Goal CRUD, Mission/Vision Linkage, Measurable Metrics & Reviews',
      p332_01_pass,
      `Goal ${createdGoalId} created (linkedToMission=${createGoalData.goal?.linkedToMission}, reviews=${addReviewData.goal?.reviews?.length})`
    );

    // ------------------------------------------------------------------
    // P332-02: Personal and Couple Goal Privacy Enforcement
    // ------------------------------------------------------------------
    // Create a PERSONAL goal owned by David (mem-david)
    const davidPersonalGoalRes = await fetch(`${BASE_URL}/api/v1/goals/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${davidAdminToken}`,
      },
      body: JSON.stringify({
        title: 'David Private Executive Coaching & Marathon Prep',
        scope: 'PERSONAL',
        horizon: 'SHORT_TERM',
        category: 'WELLBEING',
      }),
    });
    const davidPersonalGoalData = await davidPersonalGoalRes.json();
    const davidPersonalGoalId = davidPersonalGoalData.goal?.id;

    // Create a COUPLE goal owned by Sarah
    const coupleGoalRes = await fetch(`${BASE_URL}/api/v1/goals/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        title: '10th Anniversary Autumn Retreat & Estate Review',
        scope: 'COUPLE',
        horizon: 'SHORT_TERM',
        category: 'RELATIONSHIP',
      }),
    });
    const coupleGoalData = await coupleGoalRes.json();
    const coupleGoalId = coupleGoalData.goal?.id;

    // Fetch planning as Sarah (OWNER), David (ADMIN), Lucas (CHILD), Martha (GUEST)
    const [sarahPlanRes, davidPlanRes, lucasPlanRes, marthaPlanRes] = await Promise.all([
      fetch(`${BASE_URL}/api/v1/planning/fam-1`, { headers: { Authorization: `Bearer ${sarahOwnerToken}` } }),
      fetch(`${BASE_URL}/api/v1/planning/fam-1`, { headers: { Authorization: `Bearer ${davidAdminToken}` } }),
      fetch(`${BASE_URL}/api/v1/planning/fam-1`, { headers: { Authorization: `Bearer ${lucasChildToken}` } }),
      fetch(`${BASE_URL}/api/v1/planning/fam-1`, { headers: { Authorization: `Bearer ${marthaGuestToken}` } }),
    ]);
    const [sarahPlan, davidPlan, lucasPlan, marthaPlan] = await Promise.all([
      sarahPlanRes.json(),
      davidPlanRes.json(),
      lucasPlanRes.json(),
      marthaPlanRes.json(),
    ]);

    const davidSeesOwnPersonal = davidPlan.goals?.some((g: any) => g.id === davidPersonalGoalId);
    const sarahSeesDavidPersonal = sarahPlan.goals?.some((g: any) => g.id === davidPersonalGoalId);
    const lucasSeesDavidPersonal = lucasPlan.goals?.some((g: any) => g.id === davidPersonalGoalId);

    const sarahSeesCouple = sarahPlan.goals?.some((g: any) => g.id === coupleGoalId);
    const davidSeesCouple = davidPlan.goals?.some((g: any) => g.id === coupleGoalId);
    const lucasSeesCouple = lucasPlan.goals?.some((g: any) => g.id === coupleGoalId);
    const marthaSeesCouple = marthaPlan.goals?.some((g: any) => g.id === coupleGoalId);

    // Verify Sarah cannot mutate David's personal goal
    const sarahMutateDavidPersonalRes = await fetch(
      `${BASE_URL}/api/v1/goals/fam-1/${davidPersonalGoalId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahOwnerToken}`,
        },
        body: JSON.stringify({ title: 'Unauthorized Edit of Personal Goal' }),
      }
    );

    const p332_02_pass =
      davidSeesOwnPersonal === true &&
      sarahSeesDavidPersonal === false &&
      lucasSeesDavidPersonal === false &&
      sarahSeesCouple === true &&
      davidSeesCouple === true &&
      lucasSeesCouple === false &&
      marthaSeesCouple === false &&
      sarahMutateDavidPersonalRes.status === 403;

    recordGate(
      'P332-02',
      'Personal & Couple Goal Privacy Enforcement',
      p332_02_pass,
      `David sees own PERSONAL=${davidSeesOwnPersonal}, Sarah sees David PERSONAL=${sarahSeesDavidPersonal}, COUPLE visible to Sarah/David=(${sarahSeesCouple}/${davidSeesCouple}), hidden from Child/Guest=(${!lucasSeesCouple}/${!marthaSeesCouple}), cross-owner edit=${sarahMutateDavidPersonalRes.status}`
    );

    // ------------------------------------------------------------------
    // P332-03: Goal-to-Project Relationships, Dependencies, Comments, Attachments & Archival
    // ------------------------------------------------------------------
    const createProjRes = await fetch(`${BASE_URL}/api/v1/projects/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        goalId: createdGoalId,
        name: 'Solar Inverter & Battery Wall Installation',
        description: 'Mount hybrid inverter and sub-panel transfer switch',
        budgetCents: 450000,
        dependencyProjectIds: ['proj-1'],
        attachments: [{ name: 'Electrical_Schematic_v2.pdf', uri: 'familyos://docs/schematic-v2.pdf' }],
      }),
    });
    const createProjData = await createProjRes.json();
    const createdProjectId = createProjData.project?.id;

    // Add comment and then test archive toggle
    const updateProjRes = await fetch(`${BASE_URL}/api/v1/projects/fam-1/${createdProjectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${davidAdminToken}`,
      },
      body: JSON.stringify({
        commentText: 'Confirmed licensed electrician permit inspection window.',
      }),
    });
    const updateProjData = await updateProjRes.json();

    const p332_03_pass =
      createProjRes.status === 201 &&
      createProjData.project?.goalId === createdGoalId &&
      createProjData.project?.dependencyProjectIds?.includes('proj-1') &&
      createProjData.project?.attachments?.length === 1 &&
      updateProjRes.status === 200 &&
      updateProjData.project?.comments?.length === 1;

    recordGate(
      'P332-03',
      'Goal-to-Project Relationships, Dependencies, Comments & Attachments',
      p332_03_pass,
      `Project ${createdProjectId} linked to Goal ${createdGoalId}, deps=${createProjData.project?.dependencyProjectIds?.length}, comments=${updateProjData.project?.comments?.length}`
    );

    // ------------------------------------------------------------------
    // P332-04: Project and Milestone Progress Rollup from Tasks
    // ------------------------------------------------------------------
    const ms1Res = await fetch(`${BASE_URL}/api/v1/milestones/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        projectId: createdProjectId,
        title: 'Sub-Panel Wiring & Permit Sign-Off',
        orderIndex: 0,
      }),
    });
    const ms1Data = await ms1Res.json();
    const createdMilestoneId = ms1Data.milestone?.id;

    // Create 2 tasks under createdProjectId and createdMilestoneId
    const tA_Res = await fetch(`${BASE_URL}/api/v1/tasks/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        goalId: createdGoalId,
        projectId: createdProjectId,
        milestoneId: createdMilestoneId,
        title: 'Install 60A breaker in main panel',
        priority: 'HIGH',
      }),
    });
    const tA_Data = await tA_Res.json();
    const taskAId = tA_Data.task?.id;

    const tB_Res = await fetch(`${BASE_URL}/api/v1/tasks/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        goalId: createdGoalId,
        projectId: createdProjectId,
        milestoneId: createdMilestoneId,
        title: 'Run conduit to garage battery mount',
        priority: 'HIGH',
      }),
    });
    const tB_Data = await tB_Res.json();
    const taskBId = tB_Data.task?.id;

    // Complete taskA (1 of 2 tasks = 50% milestone, 50% project, 50% goal)
    await fetch(`${BASE_URL}/api/v1/tasks/fam-1/${taskAId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({ isCompleted: true }),
    });

    const rollupCheckRes = await fetch(`${BASE_URL}/api/v1/planning/fam-1`, {
      headers: { Authorization: `Bearer ${sarahOwnerToken}` },
    });
    const rollupCheck = await rollupCheckRes.json();
    const rolledMilestone = rollupCheck.milestones?.find((m: any) => m.id === createdMilestoneId);
    const rolledProject = rollupCheck.projects?.find((p: any) => p.id === createdProjectId);
    const rolledGoal = rollupCheck.goals?.find((g: any) => g.id === createdGoalId);

    const p332_04_pass =
      rolledMilestone?.progressPercent === 50 &&
      rolledProject?.progressPercent === 50 &&
      rolledGoal?.progressPercent === 50;

    recordGate(
      'P332-04',
      'Deterministic Milestone, Project & Goal Progress Rollup',
      p332_04_pass,
      `After completing 1/2 tasks: Milestone=${rolledMilestone?.progressPercent}%, Project=${rolledProject?.progressPercent}%, Goal=${rolledGoal?.progressPercent}%`
    );

    // ------------------------------------------------------------------
    // P332-05: Task Creation, Assignment & Child Assignment/Delete Restrictions
    // ------------------------------------------------------------------
    // Child Lucas can create a task assigned to himself (mem-lucas)
    const childSelfTaskRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lucasChildToken}`,
      },
      body: JSON.stringify({
        title: 'Lucas Science Fair Poster Layout',
        assignedMemberId: 'mem-lucas',
        sourceModule: 'PARENTING',
      }),
    });
    const childSelfTaskData = await childSelfTaskRes.json();

    // Child Lucas CANNOT assign a task to Sarah (mem-sarah)
    const childAssignOtherRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lucasChildToken}`,
      },
      body: JSON.stringify({
        title: 'Unauthorized Task Assigned to Parent',
        assignedMemberId: 'mem-sarah',
      }),
    });

    // Child Lucas CANNOT delete a shared family task owned by Sarah
    const childDeleteSharedRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1/${taskBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${lucasChildToken}` },
    });

    const p332_05_pass =
      childSelfTaskRes.status === 201 &&
      childSelfTaskData.task?.assignedMemberId === 'mem-lucas' &&
      childAssignOtherRes.status === 403 &&
      childDeleteSharedRes.status === 403;

    recordGate(
      'P332-05',
      'Task Assignment & Child Governance Restrictions',
      p332_05_pass,
      `Child self-task=${childSelfTaskRes.status}, Child assign-to-parent=${childAssignOtherRes.status}, Child delete shared task=${childDeleteSharedRes.status}`
    );

    // ------------------------------------------------------------------
    // P332-06: Checklist Completion, Ordering, Reusable Templates & Rollup
    // ------------------------------------------------------------------
    // Apply reusable template 'tpl-weekly-home-reset' (4 items) to taskBId
    const applyTplRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1/${taskBId}/checklist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({ applyTemplateId: 'tpl-weekly-home-reset' }),
    });
    const applyTplData = await applyTplRes.json();
    const checklistItems: any[] = applyTplData.task?.checklist || [];

    // Mark 2 of 4 checklist items done -> taskB progress becomes 50%
    await fetch(`${BASE_URL}/api/v1/tasks/fam-1/${taskBId}/checklist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({ itemId: checklistItems[0]?.id, isDone: true }),
    });
    const toggleSecondRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1/${taskBId}/checklist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({ itemId: checklistItems[1]?.id, isDone: true }),
    });
    const toggleSecondData = await toggleSecondRes.json();

    // Reorder checklist items in reverse
    const reversedIds = [...checklistItems].reverse().map((c) => c.id);
    const reorderRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1/${taskBId}/checklist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({ reorderIds: reversedIds }),
    });
    const reorderData = await reorderRes.json();

    const p332_06_pass =
      checklistItems.length === 4 &&
      toggleSecondData.task?.progressPercent === 50 &&
      reorderData.task?.checklist?.[0]?.id === reversedIds[0];

    recordGate(
      'P332-06',
      'Checklist Items, Reusable Templates, Ordering & Task Rollup',
      p332_06_pass,
      `Template applied (${checklistItems.length} items), 2/4 done -> task progress=${toggleSecondData.task?.progressPercent}%, reorder verified`
    );

    // ------------------------------------------------------------------
    // P332-07: Canonical Task Reuse Across All 7 FamilyOS Modules
    // ------------------------------------------------------------------
    const modulesToTest = [
      'GOALS_PROJECTS',
      'HOME_MANAGEMENT',
      'MARRIAGE',
      'PARENTING',
      'SPIRITUAL_GROWTH',
      'FAMILY_GOVERNANCE',
      'PERSONAL_PLANNING',
    ];

    for (const mod of modulesToTest) {
      await fetch(`${BASE_URL}/api/v1/tasks/fam-1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahOwnerToken}`,
        },
        body: JSON.stringify({
          title: `Canonical Task for ${mod}`,
          sourceModule: mod,
          scope: mod === 'MARRIAGE' ? 'COUPLE' : mod === 'PERSONAL_PLANNING' ? 'PERSONAL' : 'FAMILY',
        }),
      });
    }

    const afterModulesRes = await fetch(`${BASE_URL}/api/v1/planning/fam-1`, {
      headers: { Authorization: `Bearer ${sarahOwnerToken}` },
    });
    const afterModulesData = await afterModulesRes.json();
    const presentModules = new Set((afterModulesData.tasks || []).map((t: any) => t.sourceModule));

    const p332_07_pass = modulesToTest.every((m) => presentModules.has(m));
    recordGate(
      'P332-07',
      'Canonical Task Reuse Across All 7 FamilyOS Modules',
      p332_07_pass,
      `All ${modulesToTest.length}/7 modules stored in single canonical tasks system: ${Array.from(presentModules).join(', ')}`
    );

    // ------------------------------------------------------------------
    // P332-08: Bidirectional Calendar Integration & Personal Task Calendar Privacy
    // ------------------------------------------------------------------
    const calTaskRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        title: 'Annual Chimney & Fireplace Safety Inspection',
        dueDate: '2026-11-20T15:00:00.000Z',
        timezone: 'America/New_York',
        scope: 'FAMILY',
      }),
    });
    const calTaskData = await calTaskRes.json();
    const calTaskId = calTaskData.task?.id;
    const linkedCalEventId = `cal-task-${calTaskId}`;

    // Reschedule the calendar event directly -> must update the canonical task dueDate
    const newCalendarDate = '2026-11-28T16:30:00.000Z';
    const updateCalRes = await fetch(`${BASE_URL}/api/v1/calendar/fam-1/${linkedCalEventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({ date: newCalendarDate }),
    });
    const updateCalData = await updateCalRes.json();

    // Also create a PERSONAL task with dueDate owned by David -> verify its calendar event is hidden from Lucas (CHILD) and Sarah (OWNER)
    const davidPrivateCalTaskRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${davidAdminToken}`,
      },
      body: JSON.stringify({
        title: 'David Private Cardiology Follow-up Notes',
        dueDate: '2026-11-25T14:00:00.000Z',
        scope: 'PERSONAL',
        sourceModule: 'PERSONAL_PLANNING',
      }),
    });
    const davidPrivateCalTaskData = await davidPrivateCalTaskRes.json();
    const davidPrivateEventId = `cal-task-${davidPrivateCalTaskData.task?.id}`;

    const sarahCalCheckRes = await fetch(`${BASE_URL}/api/v1/planning/fam-1`, {
      headers: { Authorization: `Bearer ${sarahOwnerToken}` },
    });
    const sarahCalCheck = await sarahCalCheckRes.json();
    const sarahSeesDavidPrivateCal = (sarahCalCheck.calendarEvents || []).some(
      (ev: any) => ev.id === davidPrivateEventId
    );

    const p332_08_pass =
      updateCalRes.status === 200 &&
      updateCalData.updatedTask?.dueDate === newCalendarDate &&
      sarahSeesDavidPrivateCal === false;

    recordGate(
      'P332-08',
      'Bidirectional Calendar Integration & Private Task Calendar Filtering',
      p332_08_pass,
      `Calendar update synced task dueDate=${updateCalData.updatedTask?.dueDate}, David private calendar event hidden from Sarah=${!sarahSeesDavidPrivateCal}`
    );

    // ------------------------------------------------------------------
    // P332-09: Recurring Task Completion Spawns Next Occurrence with Timezone
    // ------------------------------------------------------------------
    const recurringTaskRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        title: 'Weekly Family Budget & Calendar Sync',
        dueDate: '2026-11-01T18:00:00.000Z',
        timezone: 'America/New_York',
        recurrenceRule: 'FREQ=WEEKLY',
        checklist: [{ id: 'chk-r1', title: 'Reconcile checking transactions', isDone: false, position: 0 }],
      }),
    });
    const recurringTaskData = await recurringTaskRes.json();
    const recurringTaskId = recurringTaskData.task?.id;

    const completeRecurringRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1/${recurringTaskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({ isCompleted: true }),
    });
    const completeRecurringData = await completeRecurringRes.json();
    const spawned = completeRecurringData.spawnedRecurringTask;

    const p332_09_pass =
      completeRecurringRes.status === 200 &&
      Boolean(spawned?.id) &&
      spawned?.dueDate === '2026-11-08T18:00:00.000Z' &&
      spawned?.timezone === 'America/New_York' &&
      spawned?.isCompleted === false &&
      spawned?.checklist?.[0]?.isDone === false;

    recordGate(
      'P332-09',
      'Recurring Task Completion & Next-Instance Spawning',
      p332_09_pass,
      `Completed WEEKLY task -> spawned ${spawned?.id} due ${spawned?.dueDate} (${spawned?.timezone})`
    );

    // ------------------------------------------------------------------
    // P332-10: Role Restrictions (GUEST Read-Only & REVOKED Member Blocked)
    // ------------------------------------------------------------------
    const guestCreateGoalRes = await fetch(`${BASE_URL}/api/v1/goals/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${marthaGuestToken}`,
      },
      body: JSON.stringify({ title: 'Guest Unauthorized Goal' }),
    });

    const guestCreateTaskRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${marthaGuestToken}`,
      },
      body: JSON.stringify({ title: 'Guest Unauthorized Task' }),
    });

    const revokedPlanRes = await fetch(`${BASE_URL}/api/v1/planning/fam-1`, {
      headers: { Authorization: `Bearer ${revokedToken}` },
    });

    const p332_10_pass =
      guestCreateGoalRes.status === 403 &&
      guestCreateTaskRes.status === 403 &&
      revokedPlanRes.status === 403;

    recordGate(
      'P332-10',
      'Role Restrictions (GUEST Read-Only & REVOKED Member Blocked)',
      p332_10_pass,
      `Guest create goal=${guestCreateGoalRes.status}, Guest create task=${guestCreateTaskRes.status}, Revoked read=${revokedPlanRes.status}`
    );

    // ------------------------------------------------------------------
    // P332-11: Multi-Family Workspace Isolation (fam-1 vs fam-2)
    // ------------------------------------------------------------------
    const fam2CrossReadRes = await fetch(`${BASE_URL}/api/v1/planning/fam-1`, {
      headers: { Authorization: `Bearer ${fam2Token}` },
    });
    const fam2CrossWriteRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${fam2Token}`,
      },
      body: JSON.stringify({ title: 'Cross-Tenant Task Injection Attempt' }),
    });

    const p332_11_pass = fam2CrossReadRes.status === 403 && fam2CrossWriteRes.status === 403;
    recordGate(
      'P332-11',
      'Multi-Family Workspace Isolation (fam-1 vs fam-2)',
      p332_11_pass,
      `fam-2 owner read fam-1=${fam2CrossReadRes.status}, fam-2 owner write fam-1=${fam2CrossWriteRes.status}`
    );

    // ------------------------------------------------------------------
    // P332-12: Optional Family Reward System (Disabled by Default, Non-Punitive, Redemption & Approval)
    // ------------------------------------------------------------------
    // 1. Verify disabled by default
    const initialRewardsRes = await fetch(`${BASE_URL}/api/v1/planning/fam-1`, {
      headers: { Authorization: `Bearer ${sarahOwnerToken}` },
    });
    const initialRewardsData = await initialRewardsRes.json();
    const initiallyDisabled = initialRewardsData.rewardConfig?.enabled === false;

    // 2. Verify punitive deduction config is rejected (400 PUNITIVE_SCORING_FORBIDDEN)
    const punitiveRes = await fetch(`${BASE_URL}/api/v1/rewards/fam-1/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        enabled: true,
        disallowPunitiveDeductions: false,
      }),
    });

    // 3. Enable positive-only reward system
    const enableRewardsRes = await fetch(`${BASE_URL}/api/v1/rewards/fam-1/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        enabled: true,
        currencyName: 'Family Coins',
        requireApprovalForRedemption: true,
      }),
    });

    // 4. Child requests redemption -> status PENDING_APPROVAL -> Owner approves
    const redeemRes = await fetch(`${BASE_URL}/api/v1/rewards/fam-1/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lucasChildToken}`,
      },
      body: JSON.stringify({
        memberId: 'mem-lucas',
        pointsCost: 20,
        reason: 'Choose Saturday Family Board Game',
      }),
    });
    const redeemData = await redeemRes.json();
    const redemptionEntryId = redeemData.entry?.id;

    const approveRedeemRes = await fetch(
      `${BASE_URL}/api/v1/rewards/fam-1/redemptions/${redemptionEntryId}/approve`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${sarahOwnerToken}` },
      }
    );
    const approveRedeemData = await approveRedeemRes.json();

    const p332_12_pass =
      initiallyDisabled === true &&
      punitiveRes.status === 400 &&
      enableRewardsRes.status === 200 &&
      redeemRes.status === 201 &&
      redeemData.entry?.status === 'PENDING_APPROVAL' &&
      approveRedeemRes.status === 200 &&
      approveRedeemData.entry?.status === 'APPROVED';

    recordGate(
      'P332-12',
      'Optional Family Reward System (Disabled by Default, Non-Punitive & Approval Flow)',
      p332_12_pass,
      `Initially disabled=${initiallyDisabled}, punitive config=${punitiveRes.status}, redemption=${redeemData.entry?.status} -> ${approveRedeemData.entry?.status}`
    );

    // Reset rewards config to disabled
    await fetch(`${BASE_URL}/api/v1/rewards/fam-1/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({ enabled: false }),
    });

    // ------------------------------------------------------------------
    // P332-13: Offline Sync & Concurrent Checklist EVENT_BASED_MERGE Resolution
    // ------------------------------------------------------------------
    // Simulate Device 1 pushing a TASK with checklist item 1 done
    const syncNonce = Date.now();
    const syncTaskId = `task-sync-merge-332-${syncNonce}`;
    await fetch(`${BASE_URL}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        operationId: `op-332-dev1-${syncNonce}`,
        idempotencyKey: `idem-332-dev1-${syncNonce}`,
        familyId: 'fam-1',
        entityType: 'TASK',
        entityId: syncTaskId,
        operationType: 'INSERT',
        baseVersion: 0,
        clientTimestamp: Date.now() - 1000,
        payloadJson: JSON.stringify({
          title: 'Concurrent Checklist Merge Verification Task',
          scope: 'FAMILY',
          sourceModule: 'HOME_MANAGEMENT',
          checklist: [
            { id: 'c-1', title: 'Check generator fuel stabilizer', isDone: true, position: 0 },
            { id: 'c-2', title: 'Test sump pump backup battery', isDone: false, position: 1 },
          ],
        }),
      }),
    });

    // Simulate Device 2 pushing an offline update with stale baseVersion=0 where c-2 is done and c-3 is added
    const mergePushRes = await fetch(`${BASE_URL}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${davidAdminToken}`,
      },
      body: JSON.stringify({
        operationId: `op-332-dev2-${syncNonce}`,
        idempotencyKey: `idem-332-dev2-${syncNonce}`,
        familyId: 'fam-1',
        entityType: 'TASK',
        entityId: syncTaskId,
        operationType: 'UPDATE',
        baseVersion: 0, // Stale baseVersion triggers EVENT_BASED_MERGE
        clientTimestamp: Date.now(),
        payloadJson: JSON.stringify({
          title: 'Concurrent Checklist Merge Verification Task',
          scope: 'FAMILY',
          sourceModule: 'HOME_MANAGEMENT',
          checklist: [
            { id: 'c-1', title: 'Check generator fuel stabilizer', isDone: false, position: 0 },
            { id: 'c-2', title: 'Test sump pump backup battery', isDone: true, position: 1 },
            { id: 'c-3', title: 'Inspect window storm shutters', isDone: true, position: 2 },
          ],
        }),
      }),
    });
    const mergePushData = await mergePushRes.json();

    // Pull and verify merged checklist preserved c-1=true, c-2=true, c-3=true
    const pullAfterMergeRes = await fetch(`${BASE_URL}/api/v1/sync/pull?familyId=fam-1&sinceVersion=0`, {
      headers: { Authorization: `Bearer ${sarahOwnerToken}` },
    });
    const pullAfterMerge = await pullAfterMergeRes.json();
    const mergedTaskEntity = (pullAfterMerge.entities || []).find((e: any) => e.entityId === syncTaskId);
    const mergedChecklist: any[] = mergedTaskEntity?.data?.checklist || [];

    const p332_13_pass =
      mergePushData.conflictDetected === true &&
      mergePushData.resolutionStrategy === 'EVENT_BASED_MERGE' &&
      mergedChecklist.length === 3 &&
      mergedChecklist.every((c) => c.isDone === true);

    recordGate(
      'P332-13',
      'Offline Sync & Concurrent Checklist EVENT_BASED_MERGE Resolution',
      p332_13_pass,
      `Conflict detected=${mergePushData.conflictDetected}, strategy=${mergePushData.resolutionStrategy}, merged items done=${mergedChecklist.filter((c) => c.isDone).length}/${mergedChecklist.length}`
    );

    // ------------------------------------------------------------------
    // P332-14: Cross-Platform Sync Pull Privacy Filtering & Tombstone Deletion
    // ------------------------------------------------------------------
    // Pull as Child (Lucas) -> must NOT receive David's PERSONAL goal or Sarah's COUPLE goal in /api/v1/sync/pull
    const lucasPullRes = await fetch(`${BASE_URL}/api/v1/sync/pull?familyId=fam-1&sinceVersion=0`, {
      headers: { Authorization: `Bearer ${lucasChildToken}` },
    });
    const lucasPullData = await lucasPullRes.json();
    const lucasPulledIds = new Set((lucasPullData.entities || []).map((e: any) => e.entityId));

    // Delete syncTaskId and verify tombstone propagation
    const deleteTaskRes = await fetch(`${BASE_URL}/api/v1/tasks/fam-1/${syncTaskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sarahOwnerToken}` },
    });
    const pullTombstoneRes = await fetch(`${BASE_URL}/api/v1/sync/pull?familyId=fam-1&sinceVersion=0`, {
      headers: { Authorization: `Bearer ${sarahOwnerToken}` },
    });
    const pullTombstoneData = await pullTombstoneRes.json();
    const tombstonedTask = (pullTombstoneData.entities || []).find((e: any) => e.entityId === syncTaskId);

    const p332_14_pass =
      !lucasPulledIds.has(davidPersonalGoalId) &&
      !lucasPulledIds.has(coupleGoalId) &&
      deleteTaskRes.status === 200 &&
      tombstonedTask?.isDeleted === true;

    recordGate(
      'P332-14',
      'Cross-Platform Sync Pull Privacy Filtering & Tombstone Deletion',
      p332_14_pass,
      `Child sync pull excluded PERSONAL=${!lucasPulledIds.has(davidPersonalGoalId)} & COUPLE=${!lucasPulledIds.has(coupleGoalId)}, deleted task tombstone=${tombstonedTask?.isDeleted}`
    );

    // ------------------------------------------------------------------
    // P332-15: Stage 3.2 & Stage 3.3.1 Regression Integrity Check
    // ------------------------------------------------------------------
    const wsCheckRes = await fetch(`${BASE_URL}/api/v1/workspace/fam-1`, {
      headers: { Authorization: `Bearer ${sarahOwnerToken}` },
    });
    const wsCheckData = await wsCheckRes.json();

    const p332_15_pass =
      wsCheckRes.status === 200 &&
      typeof wsCheckData.netWorth?.netWorthCents === 'number' &&
      Array.isArray(wsCheckData.members) &&
      wsCheckData.members.length >= 4 &&
      Array.isArray(wsCheckData.goals) &&
      Array.isArray(wsCheckData.tasks);

    recordGate(
      'P332-15',
      'Stage 3.2 & Stage 3.3.1 Regression Integrity',
      p332_15_pass,
      `Workspace fam-1 healthy: netWorthCents=${wsCheckData.netWorth?.netWorthCents}, members=${wsCheckData.members?.length}, goals=${wsCheckData.goals?.length}, tasks=${wsCheckData.tasks?.length}`
    );
  } finally {
    if (originalStoreSnapshot !== null) {
      fs.writeFileSync(STORE_PATH, originalStoreSnapshot, 'utf-8');
    }
  }

  console.log('------------------------------------------------------------------');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`STAGE 3.3.2 VERIFICATION SUMMARY: ${passedCount}/${results.length} GATES PASSED`);
  console.log('------------------------------------------------------------------');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal error in verify-stage-3-3-2:', err);
  process.exit(1);
});
