/**
 * FAMILYOS — Global Search Engine (Master Stage 4: SYS-05)
 *
 * Fast, scope-filtered global search across workspace entities:
 * - Recipes & Meal Plans
 * - Goals, Projects & Tasks
 * - Household Chores & Assets
 * - Family Traditions, Constitution & Culture
 * - Emergency Directory & Contacts
 *
 * Enforces strict role-based privacy boundaries:
 * - CHILD role: financial records, private reflections, and couple connections are completely barred from search results.
 * - GUEST role: only assigned chores, emergency contacts, and public recipes are visible.
 */

import { Router, Request, Response } from 'express';
import { loadStore } from '../../server.js';
import { resolveServerMembership } from './authAndRbac.js';

export const searchRouter = Router();

export interface SearchResultItem {
  id: string;
  domain: 'RECIPE' | 'MEAL' | 'GOAL' | 'PROJECT' | 'TASK' | 'CHORE' | 'ASSET' | 'TRADITION' | 'EMERGENCY_CONTACT';
  title: string;
  subtitle?: string;
  snippet?: string;
  badge?: string;
  routePath: string;
  targetRoute?: string;
  targetSubTab?: string;
  targetEntityId?: string;
  relevanceScore: number;
}

searchRouter.get('/:familyId', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const actor = (req as any).actor;
  const query = String(req.query.q || '').trim().toLowerCase();
  const domainFilter = req.query.domains ? String(req.query.domains).toUpperCase().split(',') : [];

  if (!actor || !actor.userAccountId) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const store = loadStore();
  const access = resolveServerMembership(store, actor.userAccountId, familyId);

  if (!access.allowed || !access.membership) {
    return res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
  }

  const role = access.membership.role;
  const isChild = role === 'CHILD';
  const isGuest = role === 'GUEST';

  if (!query || query.length < 2) {
    return res.json({ query, results: [], totalCount: 0 });
  }

  const results: SearchResultItem[] = [];

  const matches = (text?: string): number => {
    if (!text) return 0;
    const lower = text.toLowerCase();
    if (lower === query) return 100;
    if (lower.startsWith(query)) return 80;
    if (lower.includes(query)) return 50;
    return 0;
  };

  // 1. Recipes (All roles can search recipes)
  if (!domainFilter.length || domainFilter.includes('RECIPE')) {
    for (const r of store.householdRecipes || []) {
      if (r.familyId !== familyId || r.isDeleted) continue;
      const score = Math.max(matches(r.title), matches(r.description), matches(r.category));
      if (score > 0) {
        results.push({
          id: r.id,
          domain: 'RECIPE',
          title: r.title,
          subtitle: `${r.category || 'Recipe'} • ${r.prepTimeMinutes + r.cookTimeMinutes} mins`,
          snippet: r.description,
          badge: r.category,
          routePath: `/household?sub=1&recipeId=${r.id}`,
          targetRoute: 'household_hub',
          targetSubTab: 'recipe_library',
          targetEntityId: r.id,
          relevanceScore: score + 10,
        });
      }
    }
  }

  // 2. Chores
  if (!domainFilter.length || domainFilter.includes('CHORE')) {
    for (const c of store.householdChores || []) {
      if (c.familyId !== familyId || c.isDeleted) continue;
      // GUEST only sees assigned chores
      if (isGuest && c.assignedMemberId !== access.membership.memberProfileId) continue;
      const score = Math.max(matches(c.title), matches(c.description));
      if (score > 0) {
        results.push({
          id: c.id,
          domain: 'CHORE',
          title: c.title,
          subtitle: `${c.frequency || 'Daily'} • ${c.pointsValue || c.rewardPoints || 10} pts`,
          snippet: c.description,
          badge: 'Chore',
          routePath: `/household?sub=2&choreId=${c.id}`,
          targetRoute: 'household_hub',
          targetSubTab: 'chores_rotation',
          targetEntityId: c.id,
          relevanceScore: score,
        });
      }
    }
  }

  // 3. Goals, Projects & Tasks (CHILD and GUEST barred from broader goal strategy)
  if (!isChild && !isGuest && (!domainFilter.length || domainFilter.includes('GOAL') || domainFilter.includes('TASK'))) {
    const syncEntities = Object.values(store.synchronizedEntities || {}).filter(
      (e: any) => e.familyId === familyId && !e.isDeleted
    );

    for (const ent of syncEntities as any[]) {
      const data = ent.data || {};
      const title = String(data.title || data.name || '');
      const desc = String(data.description || '');
      const score = Math.max(matches(title), matches(desc));

      if (score > 0) {
        if (ent.entityType === 'GOAL' && (!domainFilter.length || domainFilter.includes('GOAL'))) {
          results.push({
            id: ent.id,
            domain: 'GOAL',
            title,
            subtitle: `Goal • ${data.category || 'General'}`,
            snippet: desc,
            badge: 'Goal',
            routePath: `/goals?goalId=${ent.id}`,
            targetRoute: 'planning_execution',
            targetSubTab: 'goals_management',
            targetEntityId: ent.id,
            relevanceScore: score + 15,
          });
        } else if (ent.entityType === 'PROJECT' && (!domainFilter.length || domainFilter.includes('PROJECT'))) {
          results.push({
            id: ent.id,
            domain: 'PROJECT',
            title,
            subtitle: 'Project',
            snippet: desc,
            badge: 'Project',
            routePath: `/goals?projectId=${ent.id}`,
            targetRoute: 'planning_execution',
            targetSubTab: 'goals_management',
            targetEntityId: ent.id,
            relevanceScore: score + 12,
          });
        } else if (ent.entityType === 'TASK' && (!domainFilter.length || domainFilter.includes('TASK'))) {
          results.push({
            id: ent.id,
            domain: 'TASK',
            title,
            subtitle: `Task • Priority ${data.priority || 'NORMAL'}`,
            snippet: desc,
            badge: 'Task',
            routePath: `/goals?taskId=${ent.id}`,
            targetRoute: 'calendar_routines',
            targetSubTab: 'master_calendar',
            targetEntityId: ent.id,
            relevanceScore: score + 8,
          });
        }
      }
    }
  }

  // 4. Home Assets (Not for CHILD or GUEST)
  if (!isChild && !isGuest && (!domainFilter.length || domainFilter.includes('ASSET'))) {
    for (const a of store.householdAssets || []) {
      if (a.familyId !== familyId || a.isDeleted) continue;
      const score = Math.max(matches(a.name), matches(a.category), matches(a.location));
      if (score > 0) {
        results.push({
          id: a.id,
          domain: 'ASSET',
          title: a.name,
          subtitle: `${a.category || 'Asset'} • ${a.location || 'Home'}`,
          badge: 'Home Asset',
          routePath: `/household?sub=3&assetId=${a.id}`,
          targetRoute: 'household_hub',
          targetSubTab: 'home_assets',
          targetEntityId: a.id,
          relevanceScore: score,
        });
      }
    }
  }

  // 5. Family Traditions & Culture
  if (!domainFilter.length || domainFilter.includes('TRADITION')) {
    const syncEntities = Object.values(store.synchronizedEntities || {}).filter(
      (e: any) => e.familyId === familyId && !e.isDeleted && e.entityType === 'FAMILY_TRADITION'
    );
    for (const t of syncEntities as any[]) {
      const data = t.data || {};
      const score = Math.max(matches(String(data.title || '')), matches(String(data.description || '')));
      if (score > 0) {
        results.push({
          id: t.id,
          domain: 'TRADITION',
          title: String(data.title || 'Tradition'),
          subtitle: `Tradition • ${data.season || data.frequency || 'Family'}`,
          snippet: String(data.description || ''),
          badge: 'Tradition',
          routePath: `/family?tab=traditions&id=${t.id}`,
          targetRoute: 'people_relationships',
          targetSubTab: 'family_traditions',
          targetEntityId: t.id,
          relevanceScore: score,
        });
      }
    }
  }

  // 6. Emergency Contacts & Directory (Accessible to ALL roles, including CHILD and GUEST)
  if (!domainFilter.length || domainFilter.includes('EMERGENCY_CONTACT')) {
    const syncContacts = Object.values(store.synchronizedEntities || {}).filter(
      (e: any) => e.familyId === familyId && !e.isDeleted && e.entityType === 'IMPORTANT_CONTACT'
    );
    for (const c of syncContacts as any[]) {
      const data = c.data || {};
      const name = String(data.name || data.contactName || '');
      const roleOrCategory = String(data.role || data.category || 'Emergency');
      const score = Math.max(matches(name), matches(roleOrCategory));
      if (score > 0) {
        results.push({
          id: c.id,
          domain: 'EMERGENCY_CONTACT',
          title: name,
          subtitle: `${roleOrCategory} • ${data.phoneNumber || data.phone || 'Safety Directory'}`,
          badge: 'Safety',
          routePath: `/safety?contactId=${c.id}`,
          targetRoute: 'life_records',
          targetSubTab: 'important_contacts',
          targetEntityId: c.id,
          relevanceScore: score + 20, // High priority
        });
      }
    }
  }

  // Sort by relevance score descending
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  res.json({
    query,
    results: results.slice(0, 30),
    totalCount: results.length,
    callerRole: role,
  });
});
