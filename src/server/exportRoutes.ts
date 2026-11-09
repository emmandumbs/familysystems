/**
 * FAMILYOS — Printable Cards & Offline Packet Export Engine (Master Stage 4: DOC-01)
 *
 * Provides print-ready structured document formats for:
 * 1. Recipe Cards: ingredient scaling, instructions, and deep link (familyos://recipe/{id})
 * 2. Emergency Crisis Packet: offline contacts, member allergies & blood types, utility shutoffs, meeting points
 * 3. Family Constitution: motto, mission, core values, rules, and signature block
 *
 * COMMERCIAL INVARIANT: Emergency contacts, core safety directories, and local data export
 * are ALWAYS accessible on the FREE tier and never locked behind paywalls.
 */

import { Router, Request, Response } from 'express';
import { loadStore } from '../../server.js';
import { resolveServerMembership } from './authAndRbac.js';

export const exportRouter = Router();

// ============================================================================
// 1. GET /api/v1/export/:familyId/recipe/:recipeId — Print-Ready Recipe Card
// ============================================================================

exportRouter.get('/:familyId/recipe/:recipeId', (req: Request, res: Response) => {
  const { familyId, recipeId } = req.params;
  const actor = (req as any).actor;
  const scale = Math.max(0.5, Math.min(8, Number(req.query.scale || 1)));

  if (!actor || !actor.userAccountId) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const store = loadStore();
  const access = resolveServerMembership(store, actor.userAccountId, familyId);
  if (!access.allowed || !access.membership) {
    return res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
  }

  const recipe = (store.householdRecipes || []).find(
    (r) => r.id === recipeId && r.familyId === familyId && !r.isDeleted
  );

  if (!recipe) {
    return res.status(404).json({ error: 'RECIPE_NOT_FOUND', message: 'Recipe not found in workspace.' });
  }

  // Scale ingredients
  const scaledIngredients = (recipe.ingredients || []).map((ing: any) => {
    const rawQty = Number(ing.quantity || 1);
    const scaledQty = Number((rawQty * scale).toFixed(2));
    return {
      ...ing,
      originalQuantity: rawQty,
      quantity: scaledQty,
      displayQuantity: scaledQty % 1 === 0 ? String(scaledQty) : String(scaledQty),
    };
  });

  const deepLinkUri = `familyos://recipe/${recipe.id}`;
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(deepLinkUri)}`;

  res.json({
    documentType: 'RECIPE_CARD',
    familyId,
    recipe: {
      ...recipe,
      servingScale: scale,
      effectiveServings: Math.round((recipe.servings || 4) * scale),
      scaledIngredients,
      deepLinkUri,
      qrSvgUrl,
    },
    exportedAt: Date.now(),
    layoutConfig: {
      pageSize: 'A5_OR_4X6',
      orientation: 'PORTRAIT',
      printOptimized: true,
    },
  });
});

// ============================================================================
// 2. GET /api/v1/export/:familyId/emergency-packet — Offline Crisis Safety Packet
// ============================================================================

exportRouter.get('/:familyId/emergency-packet', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const actor = (req as any).actor;

  if (!actor || !actor.userAccountId) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const store = loadStore();
  const access = resolveServerMembership(store, actor.userAccountId, familyId);
  if (!access.allowed || !access.membership) {
    return res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
  }

  const workspace = store.workspaces?.[familyId] || store.workspace;
  const members = (store.familyMembers || []).filter(
    (m) => m.familyId === familyId && !m.isDeleted
  );

  // Extract medical alerts & allergies per member
  const memberMedicalAlerts = members.map((m) => ({
    displayName: m.displayName,
    relationship: m.relationshipToPrimary || 'Family Member',
    allergies: Array.isArray(m.allergies) ? m.allergies : [],
    dietaryNotes: (m as any).dietaryNotes || (m as any).dietaryPreferences?.join(', ') || 'None',
    emergencyContact: m.emergencyContact || {},
  }));

  // Important emergency contacts
  const syncContacts = Object.values(store.synchronizedEntities || {}).filter(
    (e) => e.familyId === familyId && !e.isDeleted && e.entityType === 'IMPORTANT_CONTACT'
  );
  const contacts = syncContacts.map((c) => ({
    name: c.data.name || c.data.contactName || 'Contact',
    role: c.data.role || c.data.category || 'Emergency',
    phone: c.data.phone || c.data.phoneNumber || '',
    notes: c.data.notes || '',
  }));

  // Utility shutoff instructions
  const assets = (store.householdAssets || []).filter((a) => a.familyId === familyId && !a.isDeleted);
  const utilityAssets = assets.filter((a) =>
    ['HVAC', 'PLUMBING', 'ELECTRICAL', 'GAS', 'SAFETY'].includes(String(a.category).toUpperCase())
  );

  res.json({
    documentType: 'EMERGENCY_CRISIS_PACKET',
    familyId,
    familyName: workspace?.name || 'FamilyOS Household',
    exportedAt: Date.now(),
    isFreeTierBenefit: true,
    commercialPolicyNote: 'Emergency safety packets are fundamental family protections and are never restricted by subscription tier.',
    memberMedicalAlerts,
    contacts: contacts.length > 0 ? contacts : [
      { name: 'National Emergency', role: 'Police / Fire / EMS', phone: '911', notes: 'Immediate life hazard' },
      { name: 'Poison Control Hotline', role: 'Medical Toxicology', phone: '1-800-222-1222', notes: 'Ingestion or exposure' },
    ],
    utilityShutoffs: utilityAssets.map((u) => ({
      name: u.name,
      location: u.location || 'Basement / Utility Room',
      procedure: u.notes || 'Shut off main lever clockwise to isolate supply in an emergency.',
    })),
    evacuationPlan: {
      primaryMeetingLocation: 'Front Yard Oak Tree (Near Mailbox)',
      neighborhoodMeetingLocation: 'Community Park Pavilion (North Entrance)',
    },
  });
});

// ============================================================================
// 3. GET /api/v1/export/:familyId/constitution — Official Family Constitution
// ============================================================================

exportRouter.get('/:familyId/constitution', (req: Request, res: Response) => {
  const { familyId } = req.params;
  const actor = (req as any).actor;

  if (!actor || !actor.userAccountId) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const store = loadStore();
  const access = resolveServerMembership(store, actor.userAccountId, familyId);
  if (!access.allowed || !access.membership) {
    return res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
  }

  const workspace = store.workspaces?.[familyId] || store.workspace;
  const members = (store.familyMembers || []).filter((m) => m.familyId === familyId && !m.isDeleted);

  // Constitution entities
  const syncEntities = Object.values(store.synchronizedEntities || {}).filter(
    (e) => e.familyId === familyId && !e.isDeleted
  );

  const constVersions = syncEntities
    .filter((e) => e.entityType === 'FAMILY_CONSTITUTION_VERSION')
    .map((e) => ({ ...e.data, versionNumber: e.version }))
    .sort((a: any, b: any) => (b.versionNumber || 0) - (a.versionNumber || 0));

  const rules = syncEntities
    .filter((e) => e.entityType === 'FAMILY_RULE')
    .map((e) => ({ ...e.data, id: e.id }));

  const currentDoc: any = constVersions[0] || {};
  const currentWorkspace: any = workspace || {};

  res.json({
    documentType: 'FAMILY_CONSTITUTION',
    familyId,
    familyName: currentWorkspace.name || 'FamilyOS Household',
    motto: currentWorkspace.motto || currentDoc.motto || 'Love, Trust, and Lifelong Growth',
    missionStatement: currentWorkspace.mission || currentDoc.mission || 'To nurture a home of unconditional encouragement, shared responsibility, and joyful learning.',
    vision: currentWorkspace.vision || currentDoc.vision || 'A united and flourishing family grounded in mutual respect and generous hearts.',
    coreValues: Array.isArray(currentWorkspace.values) ? currentWorkspace.values : [
      { name: 'Integrity', description: 'We speak truthfully and honor our commitments to one another.' },
      { name: 'Empathy', description: 'We listen first to understand and support each family member’s feelings.' },
      { name: 'Gratitude', description: 'We celebrate small daily gifts and express appreciation frequently.' },
      { name: 'Responsibility', description: 'We joyfully share the stewardship of our home and resources.' },
    ],
    agreedRules: rules.map((r: any) => ({
      title: r.title || 'Family Principle',
      category: r.category || 'General',
      description: r.description || '',
    })),
    signatureMembers: members.map((m) => ({
      memberProfileId: m.id,
      displayName: m.displayName,
      role: m.role,
      signedDateEpoch: Date.now(),
    })),
    exportedAt: Date.now(),
  });
});
