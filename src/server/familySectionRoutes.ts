import type { Express, Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import type { SharedStore, SynchronizedEntityRecord } from './backupAndMigration';
import {
  canAccessCoupleEnclave,
  canManageMemberships,
  canPerformFinanceMutation,
  resolveServerMembership,
  sanitizeMemberForCaller,
} from './authAndRbac';
import { getFinanceStore } from './financeData';
import { getHouseholdStore, computeExpiryStatus } from './householdData';
import {
  computeAuthoritativeNetWorth,
  computeAuthoritativeCashFlow,
  computeAuthoritativeRecurringForecast,
  computeAuthoritativeBudgetStatusBigInt,
  readEntityBigInt,
} from './financeCalculations';
import {
  formatCentsDecimal,
  serializeBigIntToDecimalString,
  toSafeNumberOrNull,
} from '../utils/financeFormatting';
import {
  canViewGoal,
  canViewProject,
  canViewTask,
} from './planningAndExecution';
import { canViewCalendarEvent } from './calendarAndRoutines';
import { canCallerReadDomainEntity } from './domainModulesRoutes';

export interface FamilySectionRouteDependencies {
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  loadStore: () => SharedStore;
  withAtomicStoreTransaction: <T>(fn: (store: SharedStore) => Promise<T> | T) => Promise<T>;
  bumpWorkspaceVersion: (store: SharedStore, familyId: string, now?: number) => number;
  mirrorEntityToFirestore: (record: SynchronizedEntityRecord) => Promise<void>;
}

export const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MiB binary limit
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export interface ImageUploadValidationResult {
  valid: boolean;
  httpStatus: number;
  errorCode?: string;
  errorMessage?: string;
  mimeType?: string;
  sizeBytes?: number;
  normalizedDataUrl?: string;
}

export function validateUploadedImageDataUrl(rawInput: unknown): ImageUploadValidationResult {
  const raw = typeof rawInput === 'string' ? rawInput.trim() : '';
  if (!raw) {
    return {
      valid: false,
      httpStatus: 400,
      errorCode: 'IMAGE_FILE_REQUIRED',
      errorMessage: 'An actual uploaded image file is required.',
    };
  }

  if (
    /^https?:\/\//i.test(raw) ||
    raw.startsWith('//') ||
    raw.startsWith('ftp://') ||
    raw.startsWith('javascript:')
  ) {
    return {
      valid: false,
      httpStatus: 400,
      errorCode: 'EXTERNAL_URL_FORBIDDEN',
      errorMessage: 'External URLs are forbidden; upload an actual image file.',
    };
  }

  if (raw.length > Math.ceil((MAX_MEDIA_UPLOAD_BYTES * 4) / 3) + 4096) {
    return {
      valid: false,
      httpStatus: 413,
      errorCode: 'PAYLOAD_TOO_LARGE',
      errorMessage: `Uploaded image exceeds maximum size of ${MAX_MEDIA_UPLOAD_BYTES} bytes (5 MB).`,
    };
  }

  const match = /^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(raw);
  if (!match) {
    return {
      valid: false,
      httpStatus: 400,
      errorCode: 'INVALID_PHOTO_FORMAT',
      errorMessage: 'Uploaded file must be a base64-encoded image data URL (PNG, JPEG, WEBP, or GIF).',
    };
  }

  const declaredMime = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(declaredMime)) {
    return {
      valid: false,
      httpStatus: 400,
      errorCode: 'UNSUPPORTED_MEDIA_TYPE',
      errorMessage: `Unsupported image MIME type "${declaredMime}". Allowed types: image/png, image/jpeg, image/webp, image/gif.`,
    };
  }

  const base64Body = match[2].replace(/[\r\n\s]/g, '');
  if (!base64Body || base64Body.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64Body)) {
    return {
      valid: false,
      httpStatus: 400,
      errorCode: 'INVALID_BASE64_PAYLOAD',
      errorMessage: 'Uploaded image base64 payload is malformed.',
    };
  }

  const buffer = Buffer.from(base64Body, 'base64');
  if (buffer.length === 0) {
    return {
      valid: false,
      httpStatus: 400,
      errorCode: 'EMPTY_IMAGE_FILE',
      errorMessage: 'Uploaded image file is empty.',
    };
  }

  if (buffer.length > MAX_MEDIA_UPLOAD_BYTES) {
    return {
      valid: false,
      httpStatus: 413,
      errorCode: 'PAYLOAD_TOO_LARGE',
      errorMessage: `Uploaded image binary size (${buffer.length} bytes) exceeds maximum limit of ${MAX_MEDIA_UPLOAD_BYTES} bytes.`,
    };
  }

  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const isGif =
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61;

  const isWebp =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  const canonicalMime = declaredMime === 'image/jpg' ? 'image/jpeg' : declaredMime;
  const signatureMatches =
    (canonicalMime === 'image/png' && isPng) ||
    (canonicalMime === 'image/jpeg' && isJpeg) ||
    (canonicalMime === 'image/gif' && isGif) ||
    (canonicalMime === 'image/webp' && isWebp);

  if (!signatureMatches) {
    return {
      valid: false,
      httpStatus: 400,
      errorCode: 'INVALID_FILE_SIGNATURE',
      errorMessage: `File binary signature (magic bytes) does not match declared MIME type "${declaredMime}".`,
    };
  }

  // Enforce image decoding, dimension limits, and decompression bomb prevention
  const MAX_IMAGE_DIMENSION_PX = 8192;
  const MAX_IMAGE_TOTAL_PIXELS = 16_777_216; // 16 MP
  const dims = extractImageDimensions(buffer, canonicalMime);
  if (dims) {
    if (dims.width > MAX_IMAGE_DIMENSION_PX || dims.height > MAX_IMAGE_DIMENSION_PX) {
      return {
        valid: false,
        httpStatus: 400,
        errorCode: 'IMAGE_DIMENSIONS_EXCEEDED',
        errorMessage: `Image dimensions (${dims.width}x${dims.height}) exceed maximum allowed dimension of ${MAX_IMAGE_DIMENSION_PX}px.`,
      };
    }
    if (dims.totalPixels > MAX_IMAGE_TOTAL_PIXELS) {
      return {
        valid: false,
        httpStatus: 400,
        errorCode: 'IMAGE_PIXEL_LIMIT_EXCEEDED',
        errorMessage: `Image total pixels (${dims.totalPixels}) exceed maximum limit of ${MAX_IMAGE_TOTAL_PIXELS} pixels (16 Megapixels). Decompression bomb prevention triggered.`,
      };
    }
  }

  return {
    valid: true,
    httpStatus: 200,
    mimeType: canonicalMime,
    sizeBytes: buffer.length,
    normalizedDataUrl: `data:${canonicalMime};base64,${base64Body}`,
  };
}

export async function validateUploadedImageDataUrlAsync(rawInput: unknown): Promise<ImageUploadValidationResult> {
  const syncResult = validateUploadedImageDataUrl(rawInput);
  if (!syncResult.valid) {
    return syncResult;
  }

  const match = /^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(rawInput).trim());
  if (!match) return syncResult;

  const base64Body = match[2].replace(/[\r\n\s]/g, '');
  const buffer = Buffer.from(base64Body, 'base64');

  try {
    const meta = await sharp(buffer).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    const MAX_IMAGE_DIMENSION_PX = 8192;
    const MAX_IMAGE_TOTAL_PIXELS = 16_777_216;

    if (width > MAX_IMAGE_DIMENSION_PX || height > MAX_IMAGE_DIMENSION_PX) {
      return {
        valid: false,
        httpStatus: 400,
        errorCode: 'IMAGE_DIMENSIONS_EXCEEDED',
        errorMessage: `Image dimensions (${width}x${height}) exceed maximum allowed dimension of ${MAX_IMAGE_DIMENSION_PX}px.`,
      };
    }

    if (width * height > MAX_IMAGE_TOTAL_PIXELS) {
      return {
        valid: false,
        httpStatus: 400,
        errorCode: 'IMAGE_PIXEL_LIMIT_EXCEEDED',
        errorMessage: `Image total pixels (${width * height}) exceed maximum limit of ${MAX_IMAGE_TOTAL_PIXELS} pixels (16 Megapixels). Decompression bomb prevention triggered.`,
      };
    }

    const strippedBuffer = await sharp(buffer).rotate().toBuffer();
    const mime = syncResult.mimeType || 'image/jpeg';
    return {
      valid: true,
      httpStatus: 200,
      mimeType: mime,
      sizeBytes: strippedBuffer.length,
      normalizedDataUrl: `data:${mime};base64,${strippedBuffer.toString('base64')}`,
    };
  } catch (err: any) {
    return {
      valid: false,
      httpStatus: 400,
      errorCode: 'CORRUPTED_IMAGE_FILE',
      errorMessage: `Failed to decode image stream: ${err?.message || 'Corrupted or truncated image file.'}`,
    };
  }
}

export interface ImageDimensions {
  width: number;
  height: number;
  totalPixels: number;
}

export function extractImageDimensions(buffer: Buffer, mimeType: string): ImageDimensions | null {
  try {
    if (mimeType === 'image/png' && buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height, totalPixels: width * height };
    }
    if (mimeType === 'image/gif' && buffer.length >= 10) {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      return { width, height, totalPixels: width * height };
    }
    if (mimeType === 'image/webp' && buffer.length >= 30) {
      const format = buffer.toString('ascii', 12, 16);
      if (format === 'VP8X' && buffer.length >= 30) {
        const width = 1 + buffer.readUIntLE(24, 3);
        const height = 1 + buffer.readUIntLE(27, 3);
        return { width, height, totalPixels: width * height };
      }
      if (format === 'VP8 ' && buffer.length >= 30) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height, totalPixels: width * height };
      }
      if (format === 'VP8L' && buffer.length >= 25) {
        const b1 = buffer[21];
        const b2 = buffer[22];
        const b3 = buffer[23];
        const b4 = buffer[24];
        const width = 1 + (((b2 & 0x3f) << 8) | b1);
        const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
        return { width, height, totalPixels: width * height };
      }
    }
    if (mimeType === 'image/jpeg' && buffer.length >= 4) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height, totalPixels: width * height };
        }
        if (marker === 0xd9 || marker === 0xda) break;
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function createSampleSvgDataUrl(title: string, subtitle: string, bgHex = '#173D35', accentHex = '#C39A60'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgHex}" />
        <stop offset="100%" stop-color="#0F2922" />
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#bg)" rx="24" />
    <circle cx="680" cy="110" r="140" fill="${accentHex}" opacity="0.16" />
    <circle cx="120" cy="400" r="180" fill="#A8BDAA" opacity="0.12" />
    <rect x="56" y="56" width="88" height="6" rx="3" fill="${accentHex}" />
    <text x="56" y="250" fill="#F7F4EC" font-family="Georgia, serif" font-size="38" font-weight="bold">${title
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</text>
    <text x="56" y="298" fill="#E7D1AA" font-family="sans-serif" font-size="20">${subtitle
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</text>
    <text x="56" y="440" fill="#A8BDAA" font-family="sans-serif" font-size="14" letter-spacing="2">FAMILYOS HERITAGE GALLERY</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

function createRelativePortraitSvgDataUrl(opts: {
  initials: string;
  bgHex: string;
  ringHex: string;
  skinHex: string;
  hairHex: string;
  shirtHex: string;
  hasGlasses?: boolean;
  hasBeard?: boolean;
}): string {
  const safeInitials = String(opts.initials || 'FM')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 2)
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <defs>
      <radialGradient id="pbg" cx="50%" cy="35%" r="70%">
        <stop offset="0%" stop-color="${opts.bgHex}" />
        <stop offset="100%" stop-color="#0F2620" />
      </radialGradient>
      <clipPath id="circleClip">
        <circle cx="120" cy="120" r="112" />
      </clipPath>
    </defs>
    <circle cx="120" cy="120" r="118" fill="${opts.ringHex}" />
    <g clip-path="url(#circleClip)">
      <rect width="240" height="240" fill="url(#pbg)" />
      <circle cx="185" cy="48" r="46" fill="${opts.ringHex}" opacity="0.18" />
      <!-- Shoulders / Attire -->
      <path d="M42 242 C42 184, 198 184, 198 242 Z" fill="${opts.shirtHex}" />
      <path d="M96 188 L120 218 L144 188" fill="#F7F4EC" opacity="0.88" />
      <!-- Neck -->
      <rect x="104" y="146" width="32" height="34" rx="12" fill="${opts.skinHex}" />
      <!-- Hair Back -->
      <ellipse cx="120" cy="98" rx="48" ry="48" fill="${opts.hairHex}" />
      <!-- Face -->
      <ellipse cx="120" cy="112" rx="40" ry="46" fill="${opts.skinHex}" />
      <!-- Hair Top -->
      <path d="M78 102 C78 64, 162 64, 162 102 C148 82, 92 82, 78 102 Z" fill="${opts.hairHex}" />
      <!-- Eyes -->
      <circle cx="104" cy="108" r="4.2" fill="#1C1917" />
      <circle cx="136" cy="108" r="4.2" fill="#1C1917" />
      ${
        opts.hasGlasses
          ? `<rect x="91" y="99" width="26" height="18" rx="6" fill="none" stroke="#D6B377" stroke-width="2.6" />
             <rect x="123" y="99" width="26" height="18" rx="6" fill="none" stroke="#D6B377" stroke-width="2.6" />
             <line x1="117" y1="107" x2="123" y2="107" stroke="#D6B377" stroke-width="2.6" />`
          : ''
      }
      ${
        opts.hasBeard
          ? `<path d="M84 122 C86 158, 154 158, 156 122 C146 138, 94 138, 84 122 Z" fill="${opts.hairHex}" opacity="0.88" />`
          : ''
      }
      <!-- Warm Smile -->
      <path d="M106 130 Q120 141 134 130" fill="none" stroke="#5C2D24" stroke-width="3.2" stroke-linecap="round" />
      <!-- Corner Monogram Badge -->
      <circle cx="188" cy="188" r="22" fill="#173D35" stroke="${opts.ringHex}" stroke-width="2.5" />
      <text x="188" y="194" text-anchor="middle" fill="#F7F4EC" font-family="Georgia, serif" font-size="14" font-weight="bold">${safeInitials}</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

/**
 * Ensures initial baseline records exist for a family's Gallery, Constitution, Traditions, Shared Activities, and Rules
 * so the Family section immediately renders rich, real database records that can be edited, archived, or deleted.
 */
export function ensureFamilySectionSeedData(store: SharedStore, familyId: string): boolean {
  if (process.env.NODE_ENV === 'production' || familyId !== 'fam-1') {
    return false;
  }
  store.synchronizedEntities = store.synchronizedEntities || {};
  const ws = store.workspaces?.[familyId] || (store.workspace?.id === familyId ? store.workspace : null);
  const familyName = ws?.name || 'Our Family';
  const ownerUserId = ws?.ownerUserId || 'usr-sarah-owner';
  const members = (store.familyMembers || []).filter((m) => m.familyId === familyId && !m.isDeleted);
  const primaryMember = members.find((m) => m.role === 'OWNER') || members[0];
  const primaryMemberId = primaryMember?.id || 'mem-owner';
  const primaryMemberName = primaryMember?.displayName || 'Family Head';

  const existingForFamily = Object.values(store.synchronizedEntities).filter(
    (e) => e.familyId === familyId
  );

  let mutated = false;
  const now = Date.now();

  // 1. Seed Gallery Albums & Photos if none exist for this family
  const hasAlbums = existingForFamily.some((e) => e.entityType === 'FAMILY_GALLERY_ALBUM');
  if (!hasAlbums) {
    const album1Id = `alb-${familyId}-milestones`;
    const album2Id = `alb-${familyId}-gatherings`;
    const albums = [
      {
        id: album1Id,
        familyId,
        title: `${familyName} Milestones & Celebrations`,
        description: 'Cherished family milestones, birthdays, graduations, and achievements.',
        category: 'Milestones',
        coverPhotoUrl: createSampleSvgDataUrl(`${familyName} Milestones`, 'Celebrations & Achievements', '#173D35', '#C39A60'),
        createdByUserId: ownerUserId,
        createdByName: primaryMemberName,
        createdAt: now - 86400000 * 30,
        updatedAt: now - 86400000 * 5,
      },
      {
        id: album2Id,
        familyId,
        title: 'Sunday Dinners & Seasonal Retreats',
        description: 'Photos from our weekly family table, outdoor adventures, and holiday traditions.',
        category: 'Traditions',
        coverPhotoUrl: createSampleSvgDataUrl('Sunday Family Table', 'Shared Meals & Retreats', '#2C4A3E', '#D97757'),
        createdByUserId: ownerUserId,
        createdByName: primaryMemberName,
        createdAt: now - 86400000 * 14,
        updatedAt: now - 86400000 * 2,
      },
    ];

    for (const alb of albums) {
      store.synchronizedEntities[`FAMILY_GALLERY_ALBUM:${alb.id}`] = {
        id: alb.id,
        familyId,
        entityType: 'FAMILY_GALLERY_ALBUM',
        version: 1,
        isDeleted: false,
        updatedAt: alb.updatedAt,
        updatedByUserId: ownerUserId,
        data: alb,
      };
    }

    const photos = [
      {
        id: `pho-${familyId}-1`,
        familyId,
        albumId: album1Id,
        title: 'Annual Family Charter Signing & Dinner',
        caption: 'Celebrating another year of shared stewardship, gratitude, and togetherness around the home table.',
        eventName: 'Founder Day Dinner',
        takenDate: new Date(now - 86400000 * 12).toISOString().slice(0, 10),
        imageUrl: createSampleSvgDataUrl('Annual Charter Dinner', `${familyName} • Together in Stewardship`, '#173D35', '#C39A60'),
        taggedMemberIds: members.slice(0, 3).map((m) => m.id),
        taggedMemberNames: members.slice(0, 3).map((m) => m.displayName),
        isFavorite: true,
        visibility: 'FAMILY',
        uploadedByUserId: ownerUserId,
        uploadedByMemberId: primaryMemberId,
        uploadedByName: primaryMemberName,
        createdAt: now - 86400000 * 12,
        updatedAt: now - 86400000 * 12,
      },
      {
        id: `pho-${familyId}-2`,
        familyId,
        albumId: album2Id,
        title: 'Autumn Botanical Garden Walk',
        caption: 'Saturday morning outdoor exploration and family picnic under the redwoods.',
        eventName: 'Weekend Family Excursion',
        takenDate: new Date(now - 86400000 * 4).toISOString().slice(0, 10),
        imageUrl: createSampleSvgDataUrl('Autumn Garden Walk', 'Weekend Excursion & Picnic', '#234B3C', '#D97757'),
        taggedMemberIds: members.map((m) => m.id),
        taggedMemberNames: members.map((m) => m.displayName),
        isFavorite: false,
        visibility: 'FAMILY',
        uploadedByUserId: ownerUserId,
        uploadedByMemberId: primaryMemberId,
        uploadedByName: primaryMemberName,
        createdAt: now - 86400000 * 4,
        updatedAt: now - 86400000 * 4,
      },
    ];

    for (const pho of photos) {
      store.synchronizedEntities[`FAMILY_GALLERY_PHOTO:${pho.id}`] = {
        id: pho.id,
        familyId,
        entityType: 'FAMILY_GALLERY_PHOTO',
        version: 1,
        isDeleted: false,
        updatedAt: pho.updatedAt,
        updatedByUserId: ownerUserId,
        data: pho,
      };
    }
    mutated = true;
  }

  // 2. Seed Family Constitution if none exists
  const hasConstitution = existingForFamily.some((e) => e.entityType === 'FAMILY_CONSTITUTION_VERSION');
  if (!hasConstitution) {
    const constId = `const-${familyId}-v1`;
    const constitutionData = {
      id: constId,
      familyId,
      versionNumber: 1,
      motto: ws?.motto || 'Together in Stewardship, Kindness, and Purpose',
      missionStatement:
        ws?.mission ||
        'To cultivate a warm, resilient, and intellectually curious home where every member is supported to grow, contribute, and thrive.',
      visionStatement:
        ws?.vision ||
        'A multi-generational family anchored by trust, financial wisdom, shared service, and lifelong mutual support.',
      coreValues: Array.isArray(ws?.values) && ws.values.length > 0
        ? ws.values
        : ['Unconditional Respect', 'Honest Communication', 'Financial Stewardship', 'Lifelong Curiosity', 'Generosity & Gratitude'],
      familyIdentityStatement: `${familyName} stands for intentional living, calm cooperation, and celebrating every person's unique strengths.`,
      sharedAspirations: [
        'Gather for unhurried family meals at least four evenings every week.',
        'Support each member’s educational, creative, and personal wellbeing goals.',
        'Maintain a debt-free, transparent, and generous household economy.',
      ],
      memberCommitments: [
        'We listen first with empathy before offering correction or advice.',
        'We honor our shared home spaces and leave rooms better than we found them.',
        'We repair misunderstandings quickly and never let resentment linger overnight.',
      ],
      legacyStatement:
        'May the habits of kindness, courage, and stewardship we practice in this home ripple outward to bless our community and future generations.',
      editedByUserId: ownerUserId,
      editedByName: primaryMemberName,
      acknowledgments: [
        {
          memberId: primaryMemberId,
          userAccountId: ownerUserId,
          displayName: primaryMemberName,
          acknowledgedAt: now - 86400000 * 7,
          versionNumber: 1,
        },
      ],
      createdAt: now - 86400000 * 14,
      updatedAt: now - 86400000 * 7,
    };

    store.synchronizedEntities[`FAMILY_CONSTITUTION_VERSION:${constId}`] = {
      id: constId,
      familyId,
      entityType: 'FAMILY_CONSTITUTION_VERSION',
      version: 1,
      isDeleted: false,
      updatedAt: constitutionData.updatedAt,
      updatedByUserId: ownerUserId,
      data: constitutionData,
    };
    mutated = true;
  }

  // 3. Seed Family Traditions & Culture if none exist
  const hasTraditions = existingForFamily.some((e) => e.entityType === 'FAMILY_TRADITION');
  if (!hasTraditions) {
    const traditions = [
      {
        id: `trad-${familyId}-sunday-feast`,
        familyId,
        title: 'Sunday Evening Gratitude & Roast Dinner',
        category: 'Special Family Meal',
        frequency: 'Weekly (Sundays at 6:00 PM)',
        nextPlannedDate: new Date(now + 86400000 * 3).toISOString().slice(0, 10),
        meaningAndOrigin:
          'Started when our household was founded so that no matter how busy the week becomes, we close Sunday with homemade food and each person sharing three things they appreciated.',
        culturalBackground: 'Multi-generational family hospitality tradition',
        linkedRecipeId: 'rec-1',
        linkedRecipeTitle: 'Herb-Crusted Sunday Roast & Root Vegetables',
        responsibleMemberIds: [primaryMemberId],
        responsibleMemberNames: [primaryMemberName],
        memoriesAndNotes: [
          'Everyone takes turns lighting the table candle and reading the weekly gratitude jar notes.',
        ],
        status: 'ACTIVE',
        createdByUserId: ownerUserId,
        createdAt: now - 86400000 * 30,
        updatedAt: now - 86400000 * 3,
      },
      {
        id: `trad-${familyId}-solstice-retreat`,
        familyId,
        title: 'Annual Year-End Reflection & Vision Retreat',
        category: 'Annual Tradition',
        frequency: 'Annually (Last weekend of December)',
        nextPlannedDate: `${new Date().getFullYear()}-12-27`,
        meaningAndOrigin:
          'A two-day family retreat where we review our photo gallery from the past 12 months, celebrate milestones, and set our shared goals for the coming year.',
        culturalBackground: 'Family Stewardship & Heritage Practice',
        linkedRecipeId: '',
        linkedRecipeTitle: 'Spiced Mulled Cider & Cinnamon Rolls',
        responsibleMemberIds: members.slice(0, 2).map((m) => m.id),
        responsibleMemberNames: members.slice(0, 2).map((m) => m.displayName),
        memoriesAndNotes: [
          'Includes writing time-capsule letters to open the following December.',
        ],
        status: 'ACTIVE',
        createdByUserId: ownerUserId,
        createdAt: now - 86400000 * 60,
        updatedAt: now - 86400000 * 10,
      },
    ];

    for (const tr of traditions) {
      store.synchronizedEntities[`FAMILY_TRADITION:${tr.id}`] = {
        id: tr.id,
        familyId,
        entityType: 'FAMILY_TRADITION',
        version: 1,
        isDeleted: false,
        updatedAt: tr.updatedAt,
        updatedByUserId: ownerUserId,
        data: tr,
      };
    }
    mutated = true;
  }

  // 4. Seed Shared Activities if none exist
  const hasActivities = existingForFamily.some((e) => e.entityType === 'FAMILY_SHARED_ACTIVITY');
  if (!hasActivities) {
    const actDateIso = new Date(now + 86400000 * 2).toISOString().slice(0, 10);
    const actId = `act-${familyId}-game-night`;
    const calEventId = `cal-act-${actId}`;
    const activity = {
      id: actId,
      familyId,
      title: 'Friday Family Strategy Board Game & Homemade Pizza Night',
      description: 'Unplugged evening of cooperative board games, homemade sourdough pizzas, and family trivia.',
      dateIso: actDateIso,
      startTime: '18:30',
      endTime: '21:00',
      location: 'Family Living Room & Kitchen',
      category: 'Game Night',
      organizerMemberId: primaryMemberId,
      organizerName: primaryMemberName,
      participantMemberIds: members.map((m) => m.id),
      rsvps: members.map((m) => ({
        memberId: m.id,
        displayName: m.displayName,
        status: 'GOING',
      })),
      budgetCents: 3500,
      preparationChecklist: [
        { id: 'chk-1', text: 'Prep pizza dough in the afternoon', completed: true },
        { id: 'chk-2', text: 'Pick two board games together', completed: false },
        { id: 'chk-3', text: 'Dock phones in charging station at 6:15 PM', completed: false },
      ],
      status: 'PLANNED',
      recurrence: 'WEEKLY',
      memoryNotes: '',
      linkedCalendarEventId: calEventId,
      createdByUserId: ownerUserId,
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 1,
    };

    store.synchronizedEntities[`FAMILY_SHARED_ACTIVITY:${actId}`] = {
      id: actId,
      familyId,
      entityType: 'FAMILY_SHARED_ACTIVITY',
      version: 1,
      isDeleted: false,
      updatedAt: activity.updatedAt,
      updatedByUserId: ownerUserId,
      data: activity,
    };
    mutated = true;
  }

  // 5. Seed Family Rules & Principles if none exist
  const hasRules = existingForFamily.some((e) => e.entityType === 'FAMILY_RULE');
  if (!hasRules) {
    const rules = [
      {
        id: `rule-${familyId}-devices`,
        familyId,
        title: 'Device-Free Meals & Restful Bedrooms',
        category: 'Digital & Devices',
        principleStatement:
          'We prioritize face-to-face connection during meals and protect restful sleep by docking phones and tablets in the kitchen charging station by 9:00 PM.',
        practicalExpectations: [
          'All phones, tablets, and earbuds stay off the dining table during breakfast and dinner.',
          'Youth devices dock in the common charging station 45 minutes before bedtime.',
        ],
        appliesTo: 'All Family Members',
        ownerMemberId: primaryMemberId,
        ownerName: primaryMemberName,
        status: 'ACTIVE',
        revisionDate: new Date(now - 86400000 * 10).toISOString().slice(0, 10),
        acknowledgments: [
          {
            memberId: primaryMemberId,
            displayName: primaryMemberName,
            acknowledgedAt: now - 86400000 * 10,
          },
        ],
        createdByUserId: ownerUserId,
        createdAt: now - 86400000 * 20,
        updatedAt: now - 86400000 * 10,
      },
      {
        id: `rule-${familyId}-spaces`,
        familyId,
        title: 'Shared Spaces Evening Reset',
        category: 'Shared Spaces',
        principleStatement:
          'A calm morning begins the night before. Every member contributes 10 minutes after dinner to reset the kitchen, living room, and entryway.',
        practicalExpectations: [
          'Clear personal items, backpacks, and shoes from the living room and hallway.',
          'Load dishes into the dishwasher and wipe kitchen counters before winding down.',
        ],
        appliesTo: 'All Family Members',
        ownerMemberId: primaryMemberId,
        ownerName: primaryMemberName,
        status: 'ACTIVE',
        revisionDate: new Date(now - 86400000 * 15).toISOString().slice(0, 10),
        acknowledgments: [
          {
            memberId: primaryMemberId,
            displayName: primaryMemberName,
            acknowledgedAt: now - 86400000 * 15,
          },
        ],
        createdByUserId: ownerUserId,
        createdAt: now - 86400000 * 25,
        updatedAt: now - 86400000 * 15,
      },
      {
        id: `rule-${familyId}-communication`,
        familyId,
        title: 'Kind Speech & Constructive Repair',
        category: 'Respect & Communication',
        principleStatement:
          'We speak to one another with dignity even when frustrated. Disagreements are addressed calmly without दरवाजे slamming, name-calling, or sarcasm.',
        practicalExpectations: [
          'Ask for a 10-minute cool-down pause if emotions are running too high.',
          'Offer a genuine apology and repair when we make a mistake.',
        ],
        appliesTo: 'All Family Members',
        ownerMemberId: primaryMemberId,
        ownerName: primaryMemberName,
        status: 'ACTIVE',
        revisionDate: new Date(now - 86400000 * 20).toISOString().slice(0, 10),
        acknowledgments: [
          {
            memberId: primaryMemberId,
            displayName: primaryMemberName,
            acknowledgedAt: now - 86400000 * 20,
          },
        ],
        createdByUserId: ownerUserId,
        createdAt: now - 86400000 * 30,
        updatedAt: now - 86400000 * 20,
      },
    ];

    for (const rule of rules) {
      store.synchronizedEntities[`FAMILY_RULE:${rule.id}`] = {
        id: rule.id,
        familyId,
        entityType: 'FAMILY_RULE',
        version: 1,
        isDeleted: false,
        updatedAt: rule.updatedAt,
        updatedByUserId: ownerUserId,
        data: rule,
      };
    }
    mutated = true;
  }

  // 6. Seed Extended Family Heritage Map Relatives (Father's & Mother's Lineages) if none exist
  const hasExtendedRelatives = existingForFamily.some((e) => e.entityType === 'FAMILY_EXTENDED_RELATIVE');
  if (!hasExtendedRelatives) {
    const currentYear = new Date().getFullYear();
    const relatives = [
      {
        id: `rel-ext-${familyId}-paternal-grandpa`,
        familyId,
        fullName: 'Arthur Henderson',
        preferredTitle: 'Grandpa Arthur',
        lineageSide: 'PATERNAL',
        generationTier: 'ELDERS_GRANDPARENTS',
        relationshipToChildren: 'Paternal Grandfather (Father’s Dad)',
        birthYear: currentYear - 68,
        age: 68,
        occupation: 'Retired Structural Architect & Master Woodworker',
        workplaceOrSpecialty: 'Historic Timber & Stone Civic Architecture',
        city: 'Edinburgh',
        country: 'Scotland, UK',
        regionTag: 'Europe',
        mapCoordinates: { xPercent: 47, yPercent: 26 },
        avatarUrl: createRelativePortraitSvgDataUrl({
          initials: 'AH',
          bgHex: '#25443B',
          ringHex: '#C39A60',
          skinHex: '#E0B596',
          hairHex: '#D6D3D1',
          shirtHex: '#334155',
          hasGlasses: true,
          hasBeard: true,
        }),
        bioAndHeritageStory:
          'Taught your father how to sketch buildings, measure twice before cutting once, and value patience. He still builds heirloom oak bookshelves in his workshop.',
        sharedInterests: ['Woodworking', 'Architectural Sketching', 'Chess', 'Scottish History'],
        conversationStarters: [
          'Ask Grandpa Arthur what was the tallest building he ever helped design.',
          'Ask him to show you how he carves dovetail joints in his workshop.',
        ],
        growthAreas: [
          {
            id: `gr-${familyId}-1`,
            title: 'Digitizing 40 Years of Architectural Blueprints & Family Letters',
            category: 'EDUCATION_MENTORSHIP',
            description: 'Helping Grandpa organize and scan his hand-drawn sketches and family history journals into digital archives.',
            howKidsCanSupport: 'Interview him for 15 minutes on video call and label each sketch together.',
            status: 'ACTIVE_SUPPORT',
            addedByName: primaryMemberName,
            createdAt: now - 86400000 * 14,
          },
          {
            id: `gr-${familyId}-2`,
            title: 'Daily Mobility & Knee Strengthening Walks',
            category: 'WELLBEING_HEALTH',
            description: 'Maintaining daily 30-minute morning walks after his knee physical therapy.',
            howKidsCanSupport: 'Share weekend step counts and cheer him on during Sunday family calls.',
            status: 'ACTIVE_SUPPORT',
            addedByName: primaryMemberName,
            createdAt: now - 86400000 * 7,
          },
        ],
        encouragementNotes: [
          {
            id: `enc-${familyId}-1`,
            authorName: primaryMemberName,
            authorRole: 'OWNER',
            message: 'Thank you for teaching the kids how to play chess with patience and grace!',
            createdAt: now - 86400000 * 5,
          },
        ],
        createdByUserId: ownerUserId,
        createdAt: now - 86400000 * 30,
        updatedAt: now - 86400000 * 5,
      },
      {
        id: `rel-ext-${familyId}-paternal-grandma`,
        familyId,
        fullName: 'Beatrice Henderson',
        preferredTitle: 'Grandma Bea',
        lineageSide: 'PATERNAL',
        generationTier: 'ELDERS_GRANDPARENTS',
        relationshipToChildren: 'Paternal Grandmother (Father’s Mom)',
        birthYear: currentYear - 65,
        age: 65,
        occupation: 'Botanical Illustrator & Community Garden Director',
        workplaceOrSpecialty: 'Royal Botanic Conservatory & Youth Seed Library',
        city: 'Edinburgh',
        country: 'Scotland, UK',
        regionTag: 'Europe',
        mapCoordinates: { xPercent: 49, yPercent: 28 },
        avatarUrl: createRelativePortraitSvgDataUrl({
          initials: 'BH',
          bgHex: '#2C4A3E',
          ringHex: '#C39A60',
          skinHex: '#E6BFA4',
          hairHex: '#E7E5E4',
          shirtHex: '#7C2D12',
          hasGlasses: true,
          hasBeard: false,
        }),
        bioAndHeritageStory:
          'Grew up tending orchards and paints watercolor illustrations of medicinal and heirloom plants. She started our Sunday roast dinner tradition.',
        sharedInterests: ['Watercolor Painting', 'Heirloom Gardening', 'Sourdough Baking', 'Choir'],
        conversationStarters: [
          'Ask Grandma Bea which vegetables are easiest for kids to grow at home.',
          'Ask her about the secret spice in her Sunday apple crumble.',
        ],
        growthAreas: [
          {
            id: `gr-${familyId}-3`,
            title: 'Publishing Her Illustrated Family Recipe & Herb Book',
            category: 'CAREER_SKILL',
            description: 'Compiling her botanical drawings and family recipes into a printed keepsake book.',
            howKidsCanSupport: 'Test-bake her recipes together and send photos for the book pages.',
            status: 'ACTIVE_SUPPORT',
            addedByName: primaryMemberName,
            createdAt: now - 86400000 * 12,
          },
        ],
        encouragementNotes: [],
        createdByUserId: ownerUserId,
        createdAt: now - 86400000 * 30,
        updatedAt: now - 86400000 * 6,
      },
      {
        id: `rel-ext-${familyId}-paternal-uncle`,
        familyId,
        fullName: 'Samuel Henderson',
        preferredTitle: 'Uncle Sam',
        lineageSide: 'PATERNAL',
        generationTier: 'PARENTS_AUNTS_UNCLES',
        relationshipToChildren: 'Paternal Uncle (Father’s Younger Brother)',
        birthYear: currentYear - 41,
        age: 41,
        occupation: 'Senior Civil & Renewable Infrastructure Engineer',
        workplaceOrSpecialty: 'Thames Clean Water & Suspension Bridge Projects',
        city: 'London',
        country: 'United Kingdom',
        regionTag: 'Europe',
        mapCoordinates: { xPercent: 48, yPercent: 32 },
        avatarUrl: createRelativePortraitSvgDataUrl({
          initials: 'SH',
          bgHex: '#1E3A34',
          ringHex: '#C39A60',
          skinHex: '#D9A987',
          hairHex: '#44403C',
          shirtHex: '#1E3A8A',
          hasGlasses: false,
          hasBeard: true,
        }),
        bioAndHeritageStory:
          'Your father’s younger brother who loves building suspension bridges, running marathons, and mentoring young engineers in STEM.',
        sharedInterests: ['Bridge Engineering', 'Distance Running', 'Science Museums', 'Acoustic Guitar'],
        conversationStarters: [
          'Ask Uncle Sam how engineers keep giant bridges from swaying in strong winds.',
          'Ask him what his favorite science experiment was when he was 10 years old.',
        ],
        growthAreas: [
          {
            id: `gr-${familyId}-4`,
            title: 'Executive Leadership Transition & Work-Life Rest Rhythm',
            category: 'CAREER_SKILL',
            description: 'Stepping into Regional Engineering Director while protecting restful weekends.',
            howKidsCanSupport: 'Send him encouraging voice notes before his big project presentations.',
            status: 'EXPLORING',
            addedByName: primaryMemberName,
            createdAt: now - 86400000 * 9,
          },
        ],
        encouragementNotes: [
          {
            id: `enc-${familyId}-2`,
            authorName: primaryMemberName,
            authorRole: 'OWNER',
            message: 'Praying for wisdom and calm as you lead the new bridge safety team in London!',
            createdAt: now - 86400000 * 3,
          },
        ],
        createdByUserId: ownerUserId,
        createdAt: now - 86400000 * 28,
        updatedAt: now - 86400000 * 3,
      },
      {
        id: `rel-ext-${familyId}-maternal-grandma`,
        familyId,
        fullName: 'Grace Okafor-Vance',
        preferredTitle: 'Grandma Grace',
        lineageSide: 'MATERNAL',
        generationTier: 'ELDERS_GRANDPARENTS',
        relationshipToChildren: 'Maternal Grandmother (Mother’s Mom)',
        birthYear: currentYear - 64,
        age: 64,
        occupation: 'University Comparative Literature Professor & Author',
        workplaceOrSpecialty: 'Storytelling, African & Diaspora Folklore, and Youth Literacy',
        city: 'Toronto',
        country: 'Canada',
        regionTag: 'North America',
        mapCoordinates: { xPercent: 27, yPercent: 33 },
        avatarUrl: createRelativePortraitSvgDataUrl({
          initials: 'GV',
          bgHex: '#173D35',
          ringHex: '#2E6F5E',
          skinHex: '#8D5524',
          hairHex: '#292524',
          shirtHex: '#0F766E',
          hasGlasses: true,
          hasBeard: false,
        }),
        bioAndHeritageStory:
          'Raised your mother with a deep love for books, proverbs, hospitality, and music. She has mentored hundreds of university students and writes children’s fables.',
        sharedInterests: ['Folklore & Storytelling', 'Poetry', 'Piano', 'Community Literacy'],
        conversationStarters: [
          'Ask Grandma Grace to tell you her favorite childhood proverb and what it means.',
          'Ask her what books your mother loved reading most when she was a child.',
        ],
        growthAreas: [
          {
            id: `gr-${familyId}-5`,
            title: 'Recording Audio Stories of Maternal Family Origins',
            category: 'FAMILY_BOND',
            description: 'Capturing Grandma Grace’s oral histories and songs so the children and future generations know their maternal roots.',
            howKidsCanSupport: 'Pick one question each month for Grandma Grace’s audio story podcast.',
            status: 'ACTIVE_SUPPORT',
            addedByName: primaryMemberName,
            createdAt: now - 86400000 * 15,
          },
        ],
        encouragementNotes: [
          {
            id: `enc-${familyId}-3`,
            authorName: primaryMemberName,
            authorRole: 'OWNER',
            message: 'Your stories at dinner inspire the children to read and write with such imagination!',
            createdAt: now - 86400000 * 4,
          },
        ],
        createdByUserId: ownerUserId,
        createdAt: now - 86400000 * 28,
        updatedAt: now - 86400000 * 4,
      },
      {
        id: `rel-ext-${familyId}-maternal-aunt`,
        familyId,
        fullName: 'Dr. Elena Vance',
        preferredTitle: 'Auntie Elena',
        lineageSide: 'MATERNAL',
        generationTier: 'PARENTS_AUNTS_UNCLES',
        relationshipToChildren: 'Maternal Aunt (Mother’s Sister)',
        birthYear: currentYear - 36,
        age: 36,
        occupation: 'Pediatrician & Child Wellness Specialist',
        workplaceOrSpecialty: 'Children’s Hospital Preventive Care & Nutrition Clinic',
        city: 'Boston',
        country: 'United States',
        regionTag: 'North America',
        mapCoordinates: { xPercent: 29, yPercent: 37 },
        avatarUrl: createRelativePortraitSvgDataUrl({
          initials: 'EV',
          bgHex: '#1F4B3F',
          ringHex: '#2E6F5E',
          skinHex: '#A56B46',
          hairHex: '#1C1917',
          shirtHex: '#047857',
          hasGlasses: false,
          hasBeard: false,
        }),
        bioAndHeritageStory:
          'Your mother’s younger sister who takes care of newborn babies and children at the hospital and loves organizing summer family beach trips.',
        sharedInterests: ['Pediatric Medicine', 'Healthy Cooking', 'Kayaking', 'Photography'],
        conversationStarters: [
          'Ask Auntie Elena why she decided to become a children’s doctor.',
          'Ask her how the human heart and lungs work when we exercise.',
        ],
        growthAreas: [
          {
            id: `gr-${familyId}-6`,
            title: 'Launching Community Youth Health & Nutrition Workshops',
            category: 'EDUCATION_MENTORSHIP',
            description: 'Building a weekend preventative wellness program for local families in Boston.',
            howKidsCanSupport: 'Help design kid-friendly healthy snack cards for her clinic.',
            status: 'ACTIVE_SUPPORT',
            addedByName: primaryMemberName,
            createdAt: now - 86400000 * 10,
          },
        ],
        encouragementNotes: [],
        createdByUserId: ownerUserId,
        createdAt: now - 86400000 * 25,
        updatedAt: now - 86400000 * 2,
      },
      {
        id: `rel-ext-${familyId}-maternal-cousin`,
        familyId,
        fullName: 'Maya Vance',
        preferredTitle: 'Cousin Maya',
        lineageSide: 'MATERNAL',
        generationTier: 'CHILDREN_COUSINS',
        relationshipToChildren: 'Maternal First Cousin (Auntie Elena’s Daughter)',
        birthYear: currentYear - 14,
        age: 14,
        occupation: 'High School Honors Student & Youth Robotics Captain',
        workplaceOrSpecialty: 'STEM Robotics Club & Youth Symphony Cello Section',
        city: 'Boston',
        country: 'United States',
        regionTag: 'North America',
        mapCoordinates: { xPercent: 30, yPercent: 38 },
        avatarUrl: createRelativePortraitSvgDataUrl({
          initials: 'MV',
          bgHex: '#234B3C',
          ringHex: '#2E6F5E',
          skinHex: '#A56B46',
          hairHex: '#1C1917',
          shirtHex: '#B45309',
          hasGlasses: false,
          hasBeard: false,
        }),
        bioAndHeritageStory:
          'Loves coding autonomous Lego/VEX robots, playing classical cello, and teaming up with her cousins for summer coding and trivia challenges.',
        sharedInterests: ['Robotics & Coding', 'Cello', 'Strategy Board Games', 'Astronomy'],
        conversationStarters: [
          'Ask Cousin Maya what her robot has to do in this year’s competition.',
          'Ask her what song she is practicing on the cello right now.',
        ],
        growthAreas: [
          {
            id: `gr-${familyId}-7`,
            title: 'Preparing for Regional Robotics Championship & Confidence in Public Speaking',
            category: 'EDUCATION_MENTORSHIP',
            description: 'Practicing her engineering judge presentation and leading her 6-student team.',
            howKidsCanSupport: 'Do a practice presentation together on video call and cheer her team on!',
            status: 'ACTIVE_SUPPORT',
            addedByName: primaryMemberName,
            createdAt: now - 86400000 * 6,
          },
        ],
        encouragementNotes: [],
        createdByUserId: ownerUserId,
        createdAt: now - 86400000 * 20,
        updatedAt: now - 86400000 * 2,
      },
    ];

    for (const rel of relatives) {
      store.synchronizedEntities[`FAMILY_EXTENDED_RELATIVE:${rel.id}`] = {
        id: rel.id,
        familyId,
        entityType: 'FAMILY_EXTENDED_RELATIVE',
        version: 1,
        isDeleted: false,
        updatedAt: rel.updatedAt,
        updatedByUserId: ownerUserId,
        data: rel,
      };
    }
    mutated = true;
  }

  // 7. Seed Relationships Domain Records if none exist
  const hasRelCheckins = existingForFamily.some((e) => e.entityType === 'REL_CHECKIN');
  if (!hasRelCheckins) {
    const checkins = [
      {
        id: `ci-${familyId}-1`,
        familyId,
        author: primaryMemberName,
        partnerOrMember: `${primaryMemberName} (Weekly Reflection)`,
        type: 'WEEKLY',
        date: new Date(now - 86400000 * 2).toISOString().slice(0, 10),
        isPrivate: false,
        highlights: 'Balanced a busy school & work week with unhurried evening family dinners.',
        weekSummary: 'Balanced a busy school & work week with unhurried evening family dinners.',
        wentWell: 'Everyone pitched in with the 10-minute evening kitchen reset without reminders.',
        couldImprove: 'Leaving 10 minutes earlier on Tuesday mornings for school drop-off.',
        supportNeeded: 'Help coordinating Friday grocery pickup before youth sports practice.',
        gratitude: 'Thankful for calm teamwork and bedtime story reading.',
        togetherIdea: 'Saturday morning autumn trail walk and hot cocoa.',
        followUpAction: 'Prep school backpacks on Sunday night.',
        actionCompleted: false,
        ownerUserId,
        ownerMemberId: primaryMemberId,
      },
      {
        id: `ci-${familyId}-2`,
        familyId,
        author: members[1]?.displayName || 'Co-Steward',
        partnerOrMember: `${members[1]?.displayName || 'Family Partner'} (Weekly Check-in)`,
        type: 'WEEKLY',
        date: new Date(now - 86400000 * 4).toISOString().slice(0, 10),
        isPrivate: false,
        highlights: 'Completed home budget review and supported kids with science & history projects.',
        weekSummary: 'Completed home budget review and supported kids with science & history projects.',
        wentWell: 'Great Saturday afternoon family yard & garden reset.',
        couldImprove: 'Protecting 30 minutes of device-free wind-down before 9:30 PM.',
        supportNeeded: 'Quiet focus block on Wednesday afternoon.',
        gratitude: `Appreciative of ${primaryMemberName}'s meal planning this week.`,
        togetherIdea: 'Friday evening strategy board game night.',
        followUpAction: 'Schedule quarterly vehicle maintenance.',
        actionCompleted: true,
        ownerUserId,
        ownerMemberId: members[1]?.id || primaryMemberId,
      },
    ];
    for (const ci of checkins) {
      store.synchronizedEntities[`REL_CHECKIN:${ci.id}`] = {
        id: ci.id,
        familyId,
        entityType: 'REL_CHECKIN',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 2,
        updatedByUserId: ownerUserId,
        data: ci,
      };
    }

    const gratitudes = [
      {
        id: `grat-${familyId}-1`,
        familyId,
        from: primaryMemberName,
        authorName: primaryMemberName,
        to: members[1]?.displayName || 'Whole Family',
        toMember: members[1]?.displayName || 'Whole Family',
        category: 'Appreciation',
        message: 'Thank you for leading bedtime reading and keeping our mornings calm and cheerful all week!',
        date: new Date(now - 86400000 * 1).toISOString().slice(0, 10),
      },
      {
        id: `grat-${familyId}-2`,
        familyId,
        from: members[1]?.displayName || primaryMemberName,
        authorName: members[1]?.displayName || primaryMemberName,
        to: 'Whole Family',
        toMember: 'Whole Family',
        category: 'Encouragement',
        message: 'So proud of how everyone helped set the table and shared highlights during Sunday dinner.',
        date: new Date(now - 86400000 * 3).toISOString().slice(0, 10),
      },
    ];
    for (const gr of gratitudes) {
      store.synchronizedEntities[`REL_GRATITUDE:${gr.id}`] = {
        id: gr.id,
        familyId,
        entityType: 'REL_GRATITUDE',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000,
        updatedByUserId: ownerUserId,
        data: gr,
      };
    }

    const couplePlanId = `cp-${familyId}-1`;
    store.synchronizedEntities[`REL_COUPLE_PLAN:${couplePlanId}`] = {
      id: couplePlanId,
      familyId,
      entityType: 'REL_COUPLE_PLAN',
      version: 1,
      isDeleted: false,
      updatedAt: now - 86400000 * 2,
      updatedByUserId: ownerUserId,
      data: {
        id: couplePlanId,
        familyId,
        title: 'Saturday Evening Botanical Walk & Coffee Date',
        activity: 'Saturday Evening Botanical Walk & Coffee Date',
        date: new Date(now + 86400000 * 3).toISOString().slice(0, 10),
        category: 'Date Night',
        status: 'Planned',
        notes: 'Review upcoming holiday travel and enjoy an unhurried evening walk together.',
        isPrivate: false,
        completed: false,
      },
    };

    const meetingId = `mtg-${familyId}-1`;
    store.synchronizedEntities[`REL_MEETING:${meetingId}`] = {
      id: meetingId,
      familyId,
      entityType: 'REL_MEETING',
      version: 1,
      isDeleted: false,
      updatedAt: now - 86400000 * 3,
      updatedByUserId: ownerUserId,
      data: {
        id: meetingId,
        familyId,
        title: 'Sunday Evening Family Council & Week Preview',
        topic: 'Sunday Evening Family Council & Week Preview',
        date: new Date(now + 86400000 * 2).toISOString().slice(0, 10),
        facilitator: primaryMemberName,
        participants: 'All Family Members',
        agendaItems: ['Celebrate weekly wins & gratitude notes', 'Coordinate upcoming school & sports rides', 'Pick Friday family meal'],
        decisions: ['Rotate dish-loading duty between youth members'],
        followUpTasks: ['Post 7-day meal plan on kitchen board'],
        completed: false,
      },
    };
    mutated = true;
  }

  const hasRelExperiences = existingForFamily.some((e) => e.entityType === 'REL_EXPERIENCE');
  if (!hasRelExperiences) {
    const exp1Id = `exp-${familyId}-1`;
    store.synchronizedEntities[`REL_EXPERIENCE:${exp1Id}`] = {
      id: exp1Id,
      familyId,
      entityType: 'REL_EXPERIENCE',
      version: 1,
      isDeleted: false,
      updatedAt: now - 86400000 * 2,
      updatedByUserId: ownerUserId,
      data: {
        id: exp1Id,
        familyId,
        title: 'Friday Night Homemade Pizza & Strategy Board Games',
        category: 'Game Night',
        date: 'Every Friday • 6:30 PM',
        location: 'Family Kitchen & Dining Table',
        participants: 'Whole Family',
        notes: 'Everyone builds their own flatbread pizza followed by a cooperative board game.',
        attachments: [],
        completed: false,
      },
    };
    const exp2Id = `exp-${familyId}-2`;
    store.synchronizedEntities[`REL_EXPERIENCE:${exp2Id}`] = {
      id: exp2Id,
      familyId,
      entityType: 'REL_EXPERIENCE',
      version: 1,
      isDeleted: false,
      updatedAt: now - 86400000 * 5,
      updatedByUserId: ownerUserId,
      data: {
        id: exp2Id,
        familyId,
        title: 'Saturday Morning Pine Lake Trail Walk & Hot Cocoa',
        category: 'Outdoor',
        date: new Date(now - 86400000 * 3).toISOString().slice(0, 10),
        location: 'Pine Lake Nature Reserve',
        participants: 'All Family Members',
        notes: 'Collected autumn leaves and shared thermoses of spiced apple cider at the overlook.',
        attachments: [],
        completed: true,
      },
    };
    mutated = true;
  }

  const hasRelAgreements = existingForFamily.some((e) => e.entityType === 'REL_AGREEMENT');
  if (!hasRelAgreements) {
    const agr1Id = `agr-${familyId}-1`;
    store.synchronizedEntities[`REL_AGREEMENT:${agr1Id}`] = {
      id: agr1Id,
      familyId,
      entityType: 'REL_AGREEMENT',
      version: 1,
      isDeleted: false,
      updatedAt: now - 86400000 * 4,
      updatedByUserId: ownerUserId,
      data: {
        id: agr1Id,
        familyId,
        topic: 'Screen-Free Family Dinner Table',
        category: 'Tech & Presence',
        reflectionPrompt: 'How can we make evening meals feel unhurried, welcoming, and connected for everyone?',
        sharedAgreement: 'All phones, tablets, and laptops rest in the charging basket from 6:00 PM to 7:15 PM.',
        commitments: [
          'Silence notifications and place devices in the hallway basket before sitting down',
          'Take turns sharing one highlight and one gratitude from the day',
          'Clear dishes together as a 10-minute team reset',
        ],
        followUpAction: 'Use conversation starter prompts on Wednesday and Sunday evenings.',
        reviewDate: 'Monthly Review • First Sunday',
        versionNumber: 1,
        versionHistory: [
          {
            version: 1,
            date: new Date(now - 86400000 * 14).toISOString().slice(0, 10),
            updatedBy: primaryMemberName,
            summary: 'Initial family charter agreed upon during Sunday huddle.',
          },
        ],
        reflections: [
          {
            id: `ref-${familyId}-1`,
            author: primaryMemberName,
            date: new Date(now - 86400000 * 3).toISOString().slice(0, 10),
            note: 'Noticeably calmer conversations at dinner this week; the kids loved picking the table questions.',
          },
        ],
        completed: false,
      },
    };
    mutated = true;
  }

  const hasRelNetworkContacts = existingForFamily.some((e) => e.entityType === 'REL_NETWORK_CONTACT');
  if (!hasRelNetworkContacts) {
    const contacts = [
      {
        id: `net-${familyId}-1`,
        familyId,
        name: 'Aunt Clara & Uncle Mateo',
        category: 'EXTENDED_FAMILY',
        tags: ['Holiday Hosting', 'Extended Family', 'Support Circle'],
        phone: '+1 (555) 234-8891',
        email: 'clara.mateo@familymail.org',
        location: 'Portland, OR',
        birthday: '1978-05-19',
        importantEvent: 'Thanksgiving Family Gathering',
        checkInCadence: 'MONTHLY',
        lastCheckedIn: new Date(now - 86400000 * 9).toISOString().slice(0, 10),
        nextFollowUpDate: new Date(now + 86400000 * 14).toISOString().slice(0, 10),
        notes: 'Coordinate Thanksgiving potluck dishes and guest room dates.',
        interactionHistory: [
          {
            id: 'ih-seed-1',
            date: new Date(now - 86400000 * 9).toISOString().slice(0, 10),
            method: 'Call',
            summary: 'Confirmed November travel dates and shared autumn school photos.',
          },
        ],
      },
      {
        id: `net-${familyId}-2`,
        familyId,
        name: 'Arthur & Helen Pendelton',
        category: 'NEIGHBOR',
        tags: ['Trusted Neighbor', 'Emergency Keyholder', 'Garden Share'],
        phone: '+1 (555) 345-6789',
        email: 'arthur.p@suburbanmail.net',
        location: 'Next Door (404 Oak Lane)',
        checkInCadence: 'MONTHLY',
        lastCheckedIn: new Date(now - 86400000 * 6).toISOString().slice(0, 10),
        nextFollowUpDate: new Date(now + 86400000 * 20).toISOString().slice(0, 10),
        notes: 'Has spare house key; loves fresh sourdough and garden tomatoes.',
        interactionHistory: [
          {
            id: 'ih-seed-2',
            date: new Date(now - 86400000 * 6).toISOString().slice(0, 10),
            method: 'Coffee / Meetup',
            summary: 'Dropped off cinnamon rolls and coordinated winter snow-shoveling help.',
          },
        ],
      },
    ];
    for (const c of contacts) {
      store.synchronizedEntities[`REL_NETWORK_CONTACT:${c.id}`] = {
        id: c.id,
        familyId,
        entityType: 'REL_NETWORK_CONTACT',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 3,
        updatedByUserId: ownerUserId,
        data: c,
      };
    }
    mutated = true;
  }

  // 8. Seed Parenting & Growth Domain Records if none exist
  const hasParProfiles = existingForFamily.some((e) => e.entityType === 'PAR_CHILD_PROFILE');
  if (!hasParProfiles) {
    const childMembers = members.filter((m) => m.role === 'CHILD' || m.role === 'MEMBER');
    const firstChildName = childMembers[0]?.displayName || 'Maya Jenkins';
    const secondChildName = childMembers[1]?.displayName || 'Lucas Jenkins';

    const childProfiles = [
      {
        id: `cd-${familyId}-1`,
        familyId,
        name: secondChildName,
        childName: secondChildName,
        age: 9,
        grade: 'Grade 4 • Elementary',
        gradeOrStage: 'Grade 4 • Age 9',
        currentMilestone: 'Completed first 200-page chapter book & mastered multiplication tables 1–12',
        milestones: ['Completed first 200-page chapter book independently', 'Mastered multiplication tables 1–12'],
        learningActivities: ['LEGO Robotics Builders Club', 'Weekly library reading log'],
        interests: ['Soccer', 'Space Exploration', 'LEGO Engineering'],
        readingProgress: '25 minutes daily • Reading "The Wild Robot"',
        skillsDevelopment: ['Teamwork & sportsmanship', 'Morning routine independence'],
        achievements: ['Student of the Month — Kindness Award'],
      },
      {
        id: `cd-${familyId}-2`,
        familyId,
        name: firstChildName,
        childName: firstChildName,
        age: 16,
        grade: 'Grade 10 • High School',
        gradeOrStage: 'Grade 10 • Age 16',
        currentMilestone: 'Regional Youth Photography Exhibition & Financial Literacy Portfolio',
        milestones: ['Selected for Regional Youth Photography Exhibition', 'First Aid Certification'],
        learningActivities: ['AP World History seminar', 'Personal budgeting & savings stewardship'],
        interests: ['Digital Photography', 'Track & Field', 'Acoustic Guitar'],
        readingProgress: '35 minutes daily • Reading "Atomic Habits"',
        skillsDevelopment: ['Time blocking for exams', 'Public speaking'],
        achievements: ['Honor Roll Fall Semester'],
      },
    ];
    for (const cp of childProfiles) {
      store.synchronizedEntities[`PAR_CHILD_PROFILE:${cp.id}`] = {
        id: cp.id,
        familyId,
        entityType: 'PAR_CHILD_PROFILE',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 3,
        updatedByUserId: ownerUserId,
        data: cp,
      };
    }

    const childRoutines = [
      {
        id: `cr-${familyId}-1`,
        familyId,
        childName: secondChildName,
        title: 'Morning School Readiness Routine',
        routineName: 'Morning School Readiness Routine',
        schedule: 'Weekdays • 7:00 AM – 7:45 AM',
        timeOfDay: 'Weekdays 7:00 AM',
        status: 'Active',
        steps: [
          { id: 's1', text: 'Make bed and open curtains', completed: true },
          { id: 's2', text: 'Brush teeth and get dressed', completed: true },
          { id: 's3', text: 'Pack homework folder and water bottle', completed: false },
        ],
      },
      {
        id: `cr-${familyId}-2`,
        familyId,
        childName: firstChildName,
        title: 'Evening Study & Device Wind-Down',
        routineName: 'Evening Study & Device Wind-Down',
        schedule: 'Sun–Thu • 8:00 PM – 9:15 PM',
        timeOfDay: 'Evenings 8:00 PM',
        status: 'Active',
        steps: [
          { id: 's1', text: 'Review tomorrow’s planner & prep backpack', completed: true },
          { id: 's2', text: 'Dock phone & tablet at kitchen charging station by 9:00 PM', completed: true },
        ],
      },
    ];
    for (const cr of childRoutines) {
      store.synchronizedEntities[`PAR_CHILD_ROUTINE:${cr.id}`] = {
        id: cr.id,
        familyId,
        entityType: 'PAR_CHILD_ROUTINE',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 2,
        updatedByUserId: ownerUserId,
        data: cr,
      };
    }

    const studyItems = [
      {
        id: `std-${familyId}-1`,
        familyId,
        title: 'Fractions & STEM Robotics Gear Ratios Lab',
        childName: secondChildName,
        subject: 'Mathematics & STEM',
        dueDate: new Date(now + 86400000 * 3).toISOString().slice(0, 10),
        status: 'In Progress',
      },
      {
        id: `std-${familyId}-2`,
        familyId,
        title: 'Primary Source Essay & Civic Architecture Sketch',
        childName: firstChildName,
        subject: 'World History & Design',
        dueDate: new Date(now + 86400000 * 4).toISOString().slice(0, 10),
        status: 'In Progress',
      },
    ];
    for (const st of studyItems) {
      store.synchronizedEntities[`PAR_STUDY_ITEM:${st.id}`] = {
        id: st.id,
        familyId,
        entityType: 'PAR_STUDY_ITEM',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000,
        updatedByUserId: ownerUserId,
        data: st,
      };
    }

    const famLearningId = `fl-${familyId}-1`;
    store.synchronizedEntities[`PAR_FAMILY_LEARNING:${famLearningId}`] = {
      id: famLearningId,
      familyId,
      entityType: 'PAR_FAMILY_LEARNING',
      version: 1,
      isDeleted: false,
      updatedAt: now - 86400000 * 2,
      updatedByUserId: ownerUserId,
      data: {
        id: famLearningId,
        familyId,
        topic: 'Financial Stewardship, Generosity & Compounding',
        title: 'Financial Stewardship, Generosity & Compounding',
        category: 'Financial Literacy',
        schedule: 'Sundays • 4:30 PM',
        progress: 'Module 3 of 5 • Active Weekly Dinner Discussion',
        modules: [
          { id: 'mod-1', text: 'Understanding Save, Spend, and Share Buckets', completed: true },
          { id: 'mod-2', text: 'Reading Household Utility & Grocery Budgets Together', completed: true },
          { id: 'mod-3', text: 'How Long-Term Compounding & Patience Work', completed: true },
          { id: 'mod-4', text: 'Planning a Shared Family Giving Project', completed: false },
          { id: 'mod-5', text: 'Setting Next Quarter Personal Savings Milestones', completed: false },
        ],
      },
    };

    const personalGoals = [
      {
        id: `pg-${familyId}-1`,
        familyId,
        member: 'Sarah Jenkins',
        audienceType: 'ADULT',
        ownerUserId,
        category: 'Leadership & Wellbeing',
        title: 'Mindful Family Presence & Half-Marathon Training',
        progress: 75,
        nextAction: 'Complete Saturday 10km trail run and evening reflection journal',
        skills: ['Unhurried active listening', 'Endurance pacing', 'Restful boundaries'],
        reflectionLogs: [
          {
            id: 'rl-1',
            date: new Date(now - 86400000 * 2).toISOString().slice(0, 10),
            note: 'Keeping phones docked during dinner made our evening conversations feel much more grounded.',
          },
        ],
        isPrivate: false,
      },
      {
        id: `pg-${familyId}-2`,
        familyId,
        member: firstChildName,
        audienceType: 'CHILD',
        ownerUserId,
        category: 'Creative & Life Skills',
        title: 'Documentary Photography & Independent Study Planning',
        progress: 80,
        nextAction: 'Curate 5 natural-light portraits for the school exhibition',
        skills: ['Manual exposure & framing', 'Weekly calendar time-blocking', 'Self-advocacy with teachers'],
        reflectionLogs: [
          {
            id: 'rl-2',
            date: new Date(now - 86400000).toISOString().slice(0, 10),
            note: 'Planning my week on Sunday evening helped me finish AP History readings without rushing.',
          },
        ],
        isPrivate: false,
      },
    ];
    for (const pg of personalGoals) {
      store.synchronizedEntities[`PAR_PERSONAL_GOAL:${pg.id}`] = {
        id: pg.id,
        familyId,
        entityType: 'PAR_PERSONAL_GOAL',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 2,
        updatedByUserId: ownerUserId,
        data: pg,
      };
    }

    const microLessons = [
      {
        id: `ml-${familyId}-1`,
        familyId,
        topic: 'Reflective Listening Before Problem-Solving',
        category: 'Communication',
        format: 'Article',
        durationMinutes: 5,
        objective: 'Acknowledge feelings and perspective first before jumping to solutions.',
        explanation: 'When children and adults feel genuinely heard, emotional regulation comes naturally and problem-solving becomes collaborative.',
        practicalExample: 'Try saying: "It sounds like that project felt overwhelming today—tell me what part felt hardest."',
        reflectionQuestion: 'When did you feel most understood by a family member this week?',
        suggestedActivity: 'Practice a 3-minute uninterrupted listening turn during dinner tonight.',
        bookmarked: true,
        completed: true,
        userReflection: 'Helped us talk calmly through school exam schedules.',
      },
      {
        id: `ml-${familyId}-2`,
        familyId,
        topic: 'Designing Calm Screen-Free Evening Transitions',
        category: 'Wellbeing & Sleep',
        format: 'Interactive Guide',
        durationMinutes: 6,
        objective: 'Build a gentle 30-minute wind-down rhythm before sleep.',
        explanation: 'Dimming lights, docking devices, and reading together cues the nervous system for restorative rest.',
        practicalExample: 'At 8:15 PM, place devices at the kitchen charging station, pack tomorrow’s bags, and read a chapter book.',
        reflectionQuestion: 'Which evening ritual helps you wake up feeling most rested?',
        suggestedActivity: 'Try an 8:30 PM household device dock and herbal tea ritual.',
        bookmarked: false,
        completed: false,
        userReflection: '',
      },
    ];
    for (const ml of microLessons) {
      store.synchronizedEntities[`PAR_MICRO_LESSON:${ml.id}`] = {
        id: ml.id,
        familyId,
        entityType: 'PAR_MICRO_LESSON',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 2,
        updatedByUserId: ownerUserId,
        data: ml,
      };
    }

    const habits = [
      {
        id: `hb-${familyId}-1`,
        familyId,
        title: 'Unhurried Evening Reading & Wind-Down',
        category: 'Sleep & Rest',
        member: secondChildName,
        rhythmTarget: 'Evenings before 8:30 PM',
        supportiveNote: 'Reading 20 minutes in bed with warm lamp light',
        completedToday: true,
        recentCheckInDates: [new Date(now).toISOString().slice(0, 10)],
      },
      {
        id: `hb-${familyId}-2`,
        familyId,
        title: 'Outdoor Movement & Fresh Air Walk',
        category: 'Physical Activity',
        member: 'Whole Family',
        rhythmTarget: '30 minutes daily',
        supportiveNote: 'Focused on energy and enjoyment rather than competition',
        completedToday: true,
        recentCheckInDates: [new Date(now).toISOString().slice(0, 10)],
      },
    ];
    for (const hb of habits) {
      store.synchronizedEntities[`PAR_HABIT:${hb.id}`] = {
        id: hb.id,
        familyId,
        entityType: 'PAR_HABIT',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000,
        updatedByUserId: ownerUserId,
        data: hb,
      };
    }

    const resources = [
      {
        id: `pr-${familyId}-1`,
        familyId,
        topic: 'Emotion Coaching Through Daily Transitions',
        category: 'Emotional Development',
        ageGroup: 'Ages 6–12',
        summary: 'Support children in naming their emotions before guiding behavior during transitions from play to study or bedtime.',
        practiceTip: 'Offer a calm 10-minute heads-up before switching activities and validate their focus.',
        parentNotes: 'Works wonderfully for Lucas when wrapping up LEGO builds before dinner.',
        bookmarked: true,
        attachments: [],
      },
      {
        id: `pr-${familyId}-2`,
        familyId,
        topic: 'Supporting Teen Autonomy & Self-Advocacy',
        category: 'Parent-Child Connection',
        ageGroup: 'Ages 13–18',
        summary: 'Shift from managing every detail to acting as a trusted consultant while teens design their own study and personal schedules.',
        practiceTip: 'Hold a relaxed 15-minute Sunday tea chat where your teen leads the weekly preview.',
        parentNotes: 'Maya appreciates choosing her own AP study blocks.',
        bookmarked: true,
        attachments: [],
      },
    ];
    for (const pr of resources) {
      store.synchronizedEntities[`PAR_RESOURCE:${pr.id}`] = {
        id: pr.id,
        familyId,
        entityType: 'PAR_RESOURCE',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 2,
        updatedByUserId: ownerUserId,
        data: pr,
      };
    }

    mutated = true;
  }

  // 9. Seed Life Management Domain Records if none exist
  const hasLifeDocs = existingForFamily.some((e) => e.entityType === 'LIFE_DOCUMENT');
  if (!hasLifeDocs) {
    const docs = [
      {
        id: `doc-${familyId}-1`,
        familyId,
        title: 'Household Passports & Birth Certificates Vault',
        category: 'Identification',
        expirationDate: '2031-08-14',
        renewalReminder: '6 months prior to expiry',
        accessLevel: 'Owner & Admin Only',
        fileName: 'family_passports_vault.pdf',
        fileSizeKb: 420,
        encryptedAtRest: true,
      },
      {
        id: `doc-${familyId}-2`,
        familyId,
        title: 'Comprehensive Homeowners & Umbrella Policy',
        category: 'Insurance',
        expirationDate: '2027-03-01',
        renewalReminder: '45 days prior to renewal',
        accessLevel: 'Adult Members',
        fileName: 'homeowners_umbrella_policy.pdf',
        fileSizeKb: 890,
        encryptedAtRest: true,
      },
      {
        id: `doc-${familyId}-3`,
        familyId,
        title: 'Family Emergency Medical & Pediatric Immunization Records',
        category: 'Legal',
        expirationDate: 'Permanent Record',
        renewalReminder: 'Annual review',
        accessLevel: 'All Household',
        fileName: 'family_medical_readiness.pdf',
        fileSizeKb: 310,
        encryptedAtRest: true,
      },
    ];
    for (const doc of docs) {
      store.synchronizedEntities[`LIFE_DOCUMENT:${doc.id}`] = {
        id: doc.id,
        familyId,
        entityType: 'LIFE_DOCUMENT',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 5,
        updatedByUserId: ownerUserId,
        data: doc,
      };
    }

    const vehicles = [
      {
        id: `veh-${familyId}-1`,
        familyId,
        name: '2024 Volvo XC90 Recharge (Family SUV)',
        vehicle: '2024 Volvo XC90 Recharge (Family SUV)',
        registration: 'Valid through Oct 2027',
        registrationRenewal: 'Oct 2027',
        insuranceRenewal: '2027-03-01',
        inspectionDate: '2026-10-15',
        nextMaintenance: '45,000 mi Tire Rotation & Brake Check',
        nextService: '45,000 mi Tire Rotation & Brake Check',
        serviceHistory: 'All scheduled maintenance up to date',
        monthlyFuelCents: 14500,
      },
      {
        id: `veh-${familyId}-2`,
        familyId,
        name: '2023 Honda CR-V Hybrid (Commuter)',
        vehicle: '2023 Honda CR-V Hybrid (Commuter)',
        registration: 'Valid through Aug 2027',
        registrationRenewal: 'Aug 2027',
        insuranceRenewal: '2027-03-01',
        inspectionDate: '2026-08-20',
        nextMaintenance: '30,000 mi Oil & Cabin Filter Service',
        nextService: '30,000 mi Oil & Cabin Filter Service',
        serviceHistory: 'Hybrid battery & brake inspection passed',
        monthlyFuelCents: 11000,
      },
    ];
    for (const v of vehicles) {
      store.synchronizedEntities[`LIFE_VEHICLE:${v.id}`] = {
        id: v.id,
        familyId,
        entityType: 'LIFE_VEHICLE',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 4,
        updatedByUserId: ownerUserId,
        data: v,
      };
    }

    const trips = [
      {
        id: `trp-${familyId}-1`,
        familyId,
        destination: 'Summer Extended Family Heritage Reunion (Edinburgh & Highlands)',
        title: 'Summer Extended Family Heritage Reunion (Edinburgh & Highlands)',
        dates: 'Jul 12 – Jul 22, 2027',
        startDate: '2027-07-12',
        status: 'Planning & Saving',
        accommodation: 'Highland Stone Cottage & Edinburgh Townhouse',
        budgetCents: 680000,
        spentCents: 240000,
        activities: ['Visit Grandpa Arthur’s architectural landmarks', 'Botanical garden tour with Grandma Bea'],
        packingList: [
          { id: 'pk-1', item: 'Passports & travel insurance', packed: true },
          { id: 'pk-2', item: 'Rain jackets & walking boots', packed: false },
        ],
      },
    ];
    for (const tr of trips) {
      store.synchronizedEntities[`LIFE_TRAVEL_PLAN:${tr.id}`] = {
        id: tr.id,
        familyId,
        entityType: 'LIFE_TRAVEL_PLAN',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 3,
        updatedByUserId: ownerUserId,
        data: tr,
      };
    }

    const contacts = [
      {
        id: `cnt-${familyId}-1`,
        familyId,
        name: 'Dr. Elena Vance — Pediatric & Family Wellness',
        category: 'Emergency',
        role: 'Pediatrician & Family Doctor',
        phone: '(555) 234-8910',
        notes: '24/7 On-Call Pediatric Advice Line',
      },
      {
        id: `cnt-${familyId}-2`,
        familyId,
        name: 'Westfield Regional Fire, EMS & Neighbor Watch',
        category: 'Emergency',
        role: 'Emergency Dispatch & Neighborhood Coordinator',
        phone: '(555) 911-0000',
        notes: 'Primary household emergency response contact',
      },
      {
        id: `cnt-${familyId}-3`,
        familyId,
        name: 'Master HVAC, Plumbing & Electrical Home Service',
        category: 'Contractors',
        role: 'Trusted Home Maintenance Contractor',
        phone: '(555) 482-1920',
        notes: 'Annual furnace, roof & water heater inspection',
      },
    ];
    for (const c of contacts) {
      store.synchronizedEntities[`LIFE_CONTACT:${c.id}`] = {
        id: c.id,
        familyId,
        entityType: 'LIFE_CONTACT',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 6,
        updatedByUserId: ownerUserId,
        data: c,
      };
    }

    const personalTasks = [
      {
        id: `lpt-${familyId}-1`,
        familyId,
        title: 'Verify Emergency Go-Bag Water & First-Aid Expiry Dates',
        category: 'Preparedness',
        dueDate: new Date(now + 86400000 * 5).toISOString().slice(0, 10),
        priority: 'High',
        status: 'Pending',
        scope: 'FAMILY',
        isPrivate: false,
        ownerUserId,
        ownerMemberId: primaryMemberId,
      },
      {
        id: `lpt-${familyId}-2`,
        familyId,
        title: 'Upload Annual Home Insurance Renewal Declaration to Vault',
        category: 'Records',
        dueDate: new Date(now + 86400000 * 9).toISOString().slice(0, 10),
        priority: 'Medium',
        status: 'Pending',
        scope: 'FAMILY',
        isPrivate: false,
        ownerUserId,
        ownerMemberId: primaryMemberId,
      },
    ];
    for (const pt of personalTasks) {
      store.synchronizedEntities[`LIFE_PERSONAL_TASK:${pt.id}`] = {
        id: pt.id,
        familyId,
        entityType: 'LIFE_PERSONAL_TASK',
        version: 1,
        isDeleted: false,
        updatedAt: now - 86400000 * 2,
        updatedByUserId: ownerUserId,
        data: pt,
      };
    }
    mutated = true;
  }

  // 10. Ensure newly created families also have baseline accounts, budgets, goals, and reminders if none exist yet
  store.accounts = store.accounts || [];
  if (!store.accounts.some((a) => a.familyId === familyId)) {
    store.accounts.push(
      {
        id: `acc-${familyId}-checking`,
        familyId,
        name: 'Household Operating Checking',
        accountType: 'CHECKING',
        currentBalanceCents: 845250,
        currentBalanceCentsDecimal: '845250',
        isLiability: false,
        institution: 'First Heritage Bank',
        updatedAt: now,
      } as any,
      {
        id: `acc-${familyId}-savings`,
        familyId,
        name: 'Family Emergency & Reserve Savings',
        accountType: 'SAVINGS',
        currentBalanceCents: 2450000,
        currentBalanceCentsDecimal: '2450000',
        isLiability: false,
        institution: 'First Heritage Bank',
        updatedAt: now,
      } as any
    );
    mutated = true;
  }

  store.budgets = store.budgets || [];
  if (!store.budgets.some((b) => b.familyId === familyId)) {
    store.budgets.push(
      {
        id: `b-${familyId}-food`,
        familyId,
        category: 'FOOD',
        allocatedCents: 120000,
        allocatedCentsDecimal: '120000',
        spentCents: 64500,
        spentCentsDecimal: '64500',
        alertThresholdPercentage: 80,
        updatedAt: now,
      } as any,
      {
        id: `b-${familyId}-utilities`,
        familyId,
        category: 'UTILITIES',
        allocatedCents: 45000,
        allocatedCentsDecimal: '45000',
        spentCents: 31000,
        spentCentsDecimal: '31000',
        alertThresholdPercentage: 85,
        updatedAt: now,
      } as any
    );
    mutated = true;
  }

  store.transactions = store.transactions || [];
  if (!store.transactions.some((t) => t.familyId === familyId)) {
    store.transactions.push(
      {
        id: `tx-${familyId}-income`,
        familyId,
        accountId: `acc-${familyId}-checking`,
        destinationAccountId: null,
        title: 'Monthly Household Salary Deposit',
        amountCents: 920000,
        amountCentsDecimal: '920000',
        transactionType: 'INCOME',
        category: 'SALARY',
        transactionDate: now - 86400000 * 5,
        isReversal: false,
        reversalOfId: null,
        paidBy: primaryMemberName,
      } as any,
      {
        id: `tx-${familyId}-grocery`,
        familyId,
        accountId: `acc-${familyId}-checking`,
        destinationAccountId: null,
        title: 'Weekly Farmers Market & Family Groceries',
        amountCents: 18500,
        amountCentsDecimal: '18500',
        transactionType: 'EXPENSE',
        category: 'FOOD',
        transactionDate: now - 86400000 * 2,
        isReversal: false,
        reversalOfId: null,
        paidBy: primaryMemberName,
      } as any
    );
    mutated = true;
  }

  store.goals = store.goals || [];
  if (!store.goals.some((g) => g.familyId === familyId && !g.isDeleted)) {
    const goalId = `goal-${familyId}-stewardship`;
    const projId = `proj-${familyId}-home-harmony`;
    const taskId = `tsk-${familyId}-weekly-reset`;
    store.goals.push({
      id: goalId,
      familyId,
      title: 'Build a Calm, Debt-Free & Connected Family Home',
      description: 'Maintain 6-month emergency reserves, 4 weekly family dinners, and shared household routines.',
      category: 'FAMILY_GOVERNANCE',
      scope: 'FAMILY',
      horizon: 'LONG_TERM',
      isMeasurable: true,
      metricUnit: '%',
      targetValue: 100,
      currentValue: 65,
      startDate: new Date(now - 86400000 * 30).toISOString().slice(0, 10),
      targetDate: `${new Date().getFullYear()}-12-31`,
      priority: 'HIGH',
      ownerMemberId: primaryMemberId,
      ownerName: primaryMemberName,
      linkedMissionStatement: ws?.mission || 'Aligned with Family Mission',
      linkedVisionStatement: ws?.vision || 'Aligned with Family Vision',
      linkedToMission: true,
      linkedToVision: true,
      alignedValues: ['Stewardship', 'Unity'],
      status: 'ACTIVE',
      progressPercentage: 65,
      progressPercent: 65,
      reviews: [],
      completionHistory: [],
      isArchived: false,
      imageUrl: null,
      bannerUrl: null,
      version: 1,
      createdAt: now - 86400000 * 30,
      updatedAt: now,
      isDeleted: false,
    } as any);

    store.projects = store.projects || [];
    store.projects.push({
      id: projId,
      familyId,
      goalId,
      title: 'Weekly Household Rhythm & Pantry Organization',
      description: 'Streamline Sunday meal prep, chore rotation, and family council check-ins.',
      scope: 'FAMILY',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      ownerMemberId: primaryMemberId,
      ownerName: primaryMemberName,
      startDate: new Date(now - 86400000 * 14).toISOString().slice(0, 10),
      dueDate: new Date(now + 86400000 * 30).toISOString().slice(0, 10),
      progressPercentage: 50,
      progressPercent: 50,
      isArchived: false,
      version: 1,
      createdAt: now - 86400000 * 14,
      updatedAt: now,
      isDeleted: false,
    } as any);

    store.planningTasks = store.planningTasks || [];
    store.planningTasks.push({
      id: taskId,
      familyId,
      title: 'Confirm 7-Day Family Meal Plan & Grocery Restock',
      description: 'Review pantry inventory and finalize dinners for the week ahead.',
      notes: '',
      creatorMemberId: primaryMemberId,
      assignedMemberId: primaryMemberId,
      assignedToName: primaryMemberName,
      scope: 'SHARED',
      priority: 'HIGH',
      status: 'TODO',
      isCompleted: false,
      completedAt: null,
      completedByMemberId: null,
      startDate: new Date(now).toISOString().slice(0, 10),
      dueDate: new Date(now + 86400000 * 2).toISOString().slice(0, 10),
      dueLabel: new Date(now + 86400000 * 2).toISOString().slice(0, 10),
      dueEpoch: now + 86400000 * 2,
      timezone: 'America/New_York',
      isOverdue: false,
      recurrenceRule: 'WEEKLY',
      estimatedDurationMinutes: 25,
      actualDurationMinutes: null,
      goalId,
      projectId: projId,
      milestoneId: null,
      parentTaskId: null,
      dependencyTaskIds: [],
      sourceModule: 'HOME_MANAGEMENT',
      checklistItems: [],
      checklist: [],
      progressPercentage: 0,
      progressPercent: 0,
      comments: [],
      attachments: [],
      reminders: [],
      linkedCalendarEventId: null,
      rewardPoints: 15,
      activityHistory: [],
      isArchived: false,
      version: 1,
      createdAt: now - 86400000,
      updatedAt: now,
      isDeleted: false,
    } as any);
    mutated = true;
  }

  if (ws && (!Array.isArray(ws.reminders) || ws.reminders.length === 0)) {
    ws.reminders = [
      {
        id: `rem-${familyId}-1`,
        title: 'Review weekly family calendar & confirm school rides',
        dueLabel: 'Today • 6:00 PM',
        assignedMemberId: primaryMemberId,
        category: 'HOUSEHOLD',
        isCompleted: false,
        createdAt: now - 86400000,
      },
      {
        id: `rem-${familyId}-2`,
        title: 'Check pantry expiring items before grocery run',
        dueLabel: 'Tomorrow',
        assignedMemberId: primaryMemberId,
        category: 'HOUSEHOLD',
        isCompleted: false,
        createdAt: now - 43200000,
      },
    ];
    mutated = true;
  }

  return mutated;
}

/**
 * Synchronizes a Shared Activity (`FAMILY_SHARED_ACTIVITY`) into the canonical Family Calendar
 * (`store.calendarEvents` and `store.synchronizedEntities['CALENDAR_EVENT:...']`).
 */
function syncSharedActivityToCalendar(
  store: SharedStore,
  familyId: string,
  activity: Record<string, any>,
  actorUserId: string,
  isDeleted = false
): string {
  const calEventId = String(activity.linkedCalendarEventId || `cal-act-${activity.id}`);
  const now = Date.now();
  store.calendarEvents = store.calendarEvents || [];
  store.synchronizedEntities = store.synchronizedEntities || {};

  if (isDeleted || activity.status === 'CANCELLED') {
    const existingCal = store.calendarEvents.find((e) => e.id === calEventId && e.familyId === familyId);
    if (existingCal) {
      existingCal.isDeleted = true;
      existingCal.updatedAt = now;
    }
    if (store.synchronizedEntities[`CALENDAR_EVENT:${calEventId}`]) {
      store.synchronizedEntities[`CALENDAR_EVENT:${calEventId}`].isDeleted = true;
      store.synchronizedEntities[`CALENDAR_EVENT:${calEventId}`].updatedAt = now;
    }
    return calEventId;
  }

  const dateIso = String(activity.dateIso || new Date(now).toISOString().slice(0, 10));
  const startTime = String(activity.startTime || '18:00');
  const endTime = String(activity.endTime || '20:00');
  const eventEpoch = Date.parse(`${dateIso}T${startTime}:00`) || now;
  const endEpoch = Date.parse(`${dateIso}T${endTime}:00`) || eventEpoch + 7200000;
  const todayIso = new Date().toISOString().slice(0, 10);

  const calRecordData: any = {
    id: calEventId,
    familyId,
    title: String(activity.title || 'Family Shared Activity'),
    description: String(activity.description || ''),
    category: 'FAMILY_EVENT',
    scope: 'FAMILY',
    dateIso,
    date: dateIso,
    dateLabel: dateIso === todayIso ? 'Today' : dateIso,
    startTime,
    endTime,
    timeRange: `${startTime} - ${endTime}`,
    eventEpoch,
    endEpoch,
    isAllDay: false,
    isToday: dateIso === todayIso,
    location: String(activity.location || 'Home'),
    organizerMemberId: String(activity.organizerMemberId || ''),
    participantMemberIds: Array.isArray(activity.participantMemberIds) ? activity.participantMemberIds : [],
    sourceModule: 'FAMILY_ACTIVITIES',
    linkedSourceId: String(activity.id),
    version: 1,
    createdAt: Number(activity.createdAt || now),
    updatedAt: now,
    isDeleted: false,
  };

  const existingIdx = store.calendarEvents.findIndex((e) => e.id === calEventId && e.familyId === familyId);
  if (existingIdx >= 0) {
    calRecordData.version = (store.calendarEvents[existingIdx].version || 1) + 1;
    store.calendarEvents[existingIdx] = calRecordData;
  } else {
    store.calendarEvents.push(calRecordData);
  }

  store.synchronizedEntities[`CALENDAR_EVENT:${calEventId}`] = {
    id: calEventId,
    familyId,
    entityType: 'CALENDAR_EVENT',
    version: calRecordData.version,
    isDeleted: false,
    updatedAt: now,
    updatedByUserId: actorUserId,
    data: calRecordData,
  };

  return calEventId;
}

export function registerFamilySectionAndHomeDashboardRoutes(
  app: Express,
  deps: FamilySectionRouteDependencies
): void {
  const {
    requireAuth,
    loadStore,
    withAtomicStoreTransaction,
    bumpWorkspaceVersion,
    mirrorEntityToFirestore,
  } = deps;

  // ============================================================================
  // 1. GET /api/v1/family-section/:familyId — Complete Family Section Hydration
  // ============================================================================
  app.get('/api/v1/family-section/:familyId', requireAuth, (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const store = loadStore();

    const access = resolveServerMembership(store, actor.userAccountId, familyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const caller = access.membership;

    const entities = Object.values(store.synchronizedEntities || {}).filter(
      (e) => e.familyId === familyId && !e.isDeleted
    );

    const albums = entities
      .filter((e) => e.entityType === 'FAMILY_GALLERY_ALBUM')
      .map((e) => ({ ...e.data, id: e.id, version: e.version, updatedAt: e.updatedAt }))
      .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const photos = entities
      .filter((e) => e.entityType === 'FAMILY_GALLERY_PHOTO')
      .filter((e) => {
        const vis = String(e.data.visibility || 'FAMILY').toUpperCase();
        if (vis === 'PRIVATE') {
          return (
            e.data.uploadedByUserId === caller.userAccountId ||
            e.data.uploadedByMemberId === caller.memberProfileId
          );
        }
        if (vis === 'PARENTS_ONLY') {
          return ['OWNER', 'ADMIN'].includes(caller.role);
        }
        return true;
      })
      .map((e) => ({ ...e.data, id: e.id, version: e.version, updatedAt: e.updatedAt }))
      .sort((a: any, b: any) => (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0));

    const constitutionVersions = entities
      .filter((e) => e.entityType === 'FAMILY_CONSTITUTION_VERSION')
      .map((e) => ({ ...e.data, id: e.id, version: e.version, updatedAt: e.updatedAt }))
      .sort((a: any, b: any) => (b.versionNumber || b.version || 0) - (a.versionNumber || a.version || 0));

    const currentConstitution = constitutionVersions[0] || null;

    const traditions = entities
      .filter((e) => e.entityType === 'FAMILY_TRADITION')
      .map((e) => ({ ...e.data, id: e.id, version: e.version, updatedAt: e.updatedAt }))
      .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const sharedActivities = entities
      .filter((e) => e.entityType === 'FAMILY_SHARED_ACTIVITY')
      .map((e) => {
        const copy: Record<string, any> = { ...e.data, id: e.id, version: e.version, updatedAt: e.updatedAt };
        if (!canPerformFinanceMutation(caller.role)) {
          delete copy.budgetCents;
        }
        return copy;
      })
      .sort((a: any, b: any) => String(a.dateIso || '').localeCompare(String(b.dateIso || '')));

    const rules = entities
      .filter((e) => e.entityType === 'FAMILY_RULE')
      .map((e) => ({ ...e.data, id: e.id, version: e.version, updatedAt: e.updatedAt }))
      .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const currentYear = new Date().getFullYear();
    const extendedRelatives = entities
      .filter((e) => e.entityType === 'FAMILY_EXTENDED_RELATIVE')
      .map((e) => {
        const d = e.data || {};
        const computedAge =
          typeof d.birthYear === 'number' && d.birthYear > 1900 && d.birthYear <= currentYear
            ? currentYear - d.birthYear
            : Number(d.age || 35);
        return {
          ...d,
          id: e.id,
          age: computedAge,
          version: e.version,
          updatedAt: e.updatedAt,
        };
      })
      .sort((a: any, b: any) => (b.age || 0) - (a.age || 0));

    const householdStore = getHouseholdStore(familyId);
    const availableRecipes = Array.from(householdStore.recipes.values()).map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
    }));

    res.status(200).json({
      familyId,
      callerRole: caller.role,
      canManageGovernance: canManageMemberships(caller.role),
      albums,
      photos,
      currentConstitution,
      constitutionHistory: constitutionVersions,
      traditions,
      sharedActivities,
      rules,
      extendedRelatives,
      availableRecipes,
    });
  });

  // ============================================================================
  // 2. FAMILY GALLERY — ALBUMS & PHOTOS CRUD
  // ============================================================================
  app.post('/api/v1/family-section/:familyId/albums', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const { title, description = '', category = 'Family Memories', coverPhotoUrl = '' } = req.body || {};

    if (!title || !String(title).trim()) {
      res.status(400).json({ error: 'INVALID_ALBUM_TITLE', message: 'Album title is required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (access.membership.role === 'GUEST') {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'GUEST role cannot create albums.' });
        return;
      }

      const now = Date.now();
      const albumId = `alb-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const cleanTitle = String(title).trim();
      const albumData = {
        id: albumId,
        familyId,
        title: cleanTitle,
        description: String(description || '').trim(),
        category: String(category || 'Family Memories').trim(),
        coverPhotoUrl:
          coverPhotoUrl && String(coverPhotoUrl).trim()
            ? String(coverPhotoUrl).trim()
            : createSampleSvgDataUrl(cleanTitle, String(category || 'Family Album')),
        createdByUserId: actor.userAccountId,
        createdByName: access.membership.displayName,
        createdAt: now,
        updatedAt: now,
      };

      store.synchronizedEntities = store.synchronizedEntities || {};
      const record: SynchronizedEntityRecord = {
        id: albumId,
        familyId,
        entityType: 'FAMILY_GALLERY_ALBUM',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: albumData,
      };
      store.synchronizedEntities[`FAMILY_GALLERY_ALBUM:${albumId}`] = record;
      bumpWorkspaceVersion(store, familyId, now);
      void mirrorEntityToFirestore(record);

      res.status(201).json({ album: albumData });
    });
  });

  app.delete('/api/v1/family-section/:familyId/albums/:albumId', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const albumId = String(req.params.albumId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const key = `FAMILY_GALLERY_ALBUM:${albumId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'ALBUM_NOT_FOUND', message: 'Album not found.' });
        return;
      }

      if (
        existing.data.createdByUserId !== actor.userAccountId &&
        !canManageMemberships(access.membership.role)
      ) {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Only the creator or an admin can delete this album.' });
        return;
      }

      const now = Date.now();
      existing.isDeleted = true;
      existing.version += 1;
      existing.updatedAt = now;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ deleted: true, albumId });
    });
  });

  app.post('/api/v1/family-section/:familyId/photos', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const {
      albumId = '',
      title,
      caption = '',
      eventName = '',
      takenDate = '',
      imageUrl = '',
      fileDataUrl = '',
      dataUrl = '',
      fileName = '',
      taggedMemberIds = [],
      isFavorite = false,
      visibility = 'FAMILY',
    } = req.body || {};

    if (!title || !String(title).trim()) {
      res.status(400).json({ error: 'INVALID_PHOTO_TITLE', message: 'Photo title is required.' });
      return;
    }

    const rawUrl = String(imageUrl || fileDataUrl || dataUrl || '').trim();
    if (!rawUrl) {
      res.status(400).json({
        error: 'IMAGE_FILE_REQUIRED',
        message: 'Gallery uploads require an actual image file.',
      });
      return;
    }

    const isExistingMediaRoute = rawUrl.startsWith(`/api/v1/media/${familyId}/`);
    let uploadValidation: ImageUploadValidationResult | null = null;
    if (!isExistingMediaRoute) {
      uploadValidation = await validateUploadedImageDataUrlAsync(rawUrl);
      if (!uploadValidation.valid) {
        res.status(uploadValidation.httpStatus).json({
          error: uploadValidation.errorCode,
          message: uploadValidation.errorMessage,
        });
        return;
      }
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (access.membership.role === 'GUEST') {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'GUEST role cannot upload photos.' });
        return;
      }

      const now = Date.now();
      const photoId = `pho-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const cleanTitle = String(title).trim();

      store.mediaAssets = store.mediaAssets || {};
      store.synchronizedEntities = store.synchronizedEntities || {};

      let resolvedUrl = rawUrl;
      let persistedMediaId = '';
      let persistedMimeType = '';
      let persistedSizeBytes = 0;

      if (isExistingMediaRoute) {
        const mediaId = rawUrl.slice(`/api/v1/media/${familyId}/`.length).trim();
        const existingAsset = store.mediaAssets[mediaId];
        if (!existingAsset || existingAsset.familyId !== familyId || existingAsset.isDeleted) {
          res.status(400).json({
            error: 'INVALID_MEDIA_REFERENCE',
            message: 'Referenced media asset does not exist in this family.',
          });
          return;
        }
        persistedMediaId = existingAsset.id;
        persistedMimeType = existingAsset.mimeType;
        persistedSizeBytes = existingAsset.sizeBytes;
      } else if (uploadValidation && uploadValidation.valid && uploadValidation.normalizedDataUrl) {
        const mediaId = `media-${now}-${Math.random().toString(36).slice(2, 6)}`;
        const ext = (uploadValidation.mimeType || 'image/png').split('/')[1] || 'png';
        const cleanFileName = String(fileName || `${cleanTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`).trim();
        const mediaUrl = `/api/v1/media/${familyId}/${mediaId}`;
        const asset = {
          id: mediaId,
          familyId,
          ownerMemberId: access.membership.memberProfileId,
          uploadedByUserId: actor.userAccountId,
          visibility: visibility === 'PRIVATE' ? ('PERSONAL' as const) : ('SHARED' as const),
          category: 'FAMILY_PHOTO' as const,
          mimeType: uploadValidation.mimeType!,
          fileName: cleanFileName,
          dataUrl: uploadValidation.normalizedDataUrl,
          sizeBytes: uploadValidation.sizeBytes!,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
        };
        store.mediaAssets[mediaId] = asset;
        store.synchronizedEntities[`MEDIA_ASSET:${mediaId}`] = {
          id: mediaId,
          familyId,
          entityType: 'MEDIA_ASSET',
          version: 1,
          isDeleted: false,
          updatedAt: now,
          updatedByUserId: actor.userAccountId,
          data: {
            id: asset.id,
            familyId: asset.familyId,
            ownerMemberId: asset.ownerMemberId,
            visibility: asset.visibility,
            category: asset.category,
            mimeType: asset.mimeType,
            fileName: asset.fileName,
            sizeBytes: asset.sizeBytes,
            mediaUrl,
          },
        };
        resolvedUrl = uploadValidation.normalizedDataUrl;
        persistedMediaId = mediaId;
        persistedMimeType = asset.mimeType;
        persistedSizeBytes = asset.sizeBytes;
      }

      const familyMembers = (store.familyMembers || []).filter((m) => m.familyId === familyId && !m.isDeleted);
      const validMemberIds = Array.isArray(taggedMemberIds)
        ? taggedMemberIds.map((id) => String(id)).filter((id) => familyMembers.some((m) => m.id === id))
        : [];
      const taggedMemberNames = validMemberIds
        .map((id) => familyMembers.find((m) => m.id === id)?.displayName)
        .filter(Boolean);

      const photoData = {
        id: photoId,
        familyId,
        albumId: String(albumId || '').trim(),
        title: cleanTitle,
        caption: String(caption || '').trim(),
        eventName: String(eventName || '').trim(),
        takenDate: String(takenDate || new Date(now).toISOString().slice(0, 10)).trim(),
        imageUrl: resolvedUrl,
        mediaId: persistedMediaId,
        mimeType: persistedMimeType,
        sizeBytes: persistedSizeBytes,
        taggedMemberIds: validMemberIds,
        taggedMemberNames,
        isFavorite: Boolean(isFavorite),
        visibility: ['FAMILY', 'PARENTS_ONLY', 'PRIVATE'].includes(String(visibility).toUpperCase())
          ? String(visibility).toUpperCase()
          : 'FAMILY',
        uploadedByUserId: actor.userAccountId,
        uploadedByMemberId: access.membership.memberProfileId,
        uploadedByName: access.membership.displayName,
        createdAt: now,
        updatedAt: now,
      };

      const record: SynchronizedEntityRecord = {
        id: photoId,
        familyId,
        entityType: 'FAMILY_GALLERY_PHOTO',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: photoData,
      };
      store.synchronizedEntities[`FAMILY_GALLERY_PHOTO:${photoId}`] = record;
      bumpWorkspaceVersion(store, familyId, now);
      void mirrorEntityToFirestore(record);

      res.status(201).json({ photo: photoData, mediaId: persistedMediaId, persisted: true });
    });
  });

  app.put('/api/v1/family-section/:familyId/photos/:photoId', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const photoId = String(req.params.photoId || '').trim();
    const actor = req.actor!;
    const incoming = req.body || {};

    if (incoming.imageUrl !== undefined) {
      const nextRawUrl = String(incoming.imageUrl || '').trim();
      if (!nextRawUrl.startsWith(`/api/v1/media/${familyId}/`)) {
        const check = await validateUploadedImageDataUrlAsync(nextRawUrl);
        if (!check.valid) {
          res.status(check.httpStatus).json({ error: check.errorCode, message: check.errorMessage });
          return;
        }
      }
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (access.membership.role === 'GUEST') {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'GUEST role cannot edit photos.' });
        return;
      }

      const key = `FAMILY_GALLERY_PHOTO:${photoId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'PHOTO_NOT_FOUND', message: 'Photo not found.' });
        return;
      }

      const now = Date.now();
      const familyMembers = (store.familyMembers || []).filter((m) => m.familyId === familyId && !m.isDeleted);
      const validMemberIds = Array.isArray(incoming.taggedMemberIds)
        ? incoming.taggedMemberIds.map((id: any) => String(id)).filter((id: string) => familyMembers.some((m) => m.id === id))
        : existing.data.taggedMemberIds || [];
      const taggedMemberNames = validMemberIds
        .map((id: string) => familyMembers.find((m) => m.id === id)?.displayName)
        .filter(Boolean);

      const updatedData = {
        ...existing.data,
        title: incoming.title !== undefined ? String(incoming.title).trim() : existing.data.title,
        caption: incoming.caption !== undefined ? String(incoming.caption).trim() : existing.data.caption,
        albumId: incoming.albumId !== undefined ? String(incoming.albumId).trim() : existing.data.albumId,
        eventName: incoming.eventName !== undefined ? String(incoming.eventName).trim() : existing.data.eventName,
        takenDate: incoming.takenDate !== undefined ? String(incoming.takenDate).trim() : existing.data.takenDate,
        isFavorite: incoming.isFavorite !== undefined ? Boolean(incoming.isFavorite) : existing.data.isFavorite,
        visibility: incoming.visibility !== undefined ? String(incoming.visibility).toUpperCase() : existing.data.visibility,
        taggedMemberIds: validMemberIds,
        taggedMemberNames,
        updatedAt: now,
      };

      existing.version += 1;
      existing.updatedAt = now;
      existing.updatedByUserId = actor.userAccountId;
      existing.data = updatedData;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ photo: updatedData });
    });
  });

  app.delete('/api/v1/family-section/:familyId/photos/:photoId', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const photoId = String(req.params.photoId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const key = `FAMILY_GALLERY_PHOTO:${photoId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'PHOTO_NOT_FOUND', message: 'Photo not found.' });
        return;
      }

      const isUploader =
        existing.data.uploadedByUserId === actor.userAccountId ||
        existing.data.uploadedByMemberId === access.membership.memberProfileId;
      if (!isUploader && !canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Only the uploader or a family OWNER/ADMIN can delete this photo.',
        });
        return;
      }

      const now = Date.now();
      existing.isDeleted = true;
      existing.version += 1;
      existing.updatedAt = now;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ deleted: true, photoId });
    });
  });

  // ============================================================================
  // 3. FAMILY CONSTITUTION — VERSIONED GOVERNANCE & MEMBER ACKNOWLEDGMENTS
  // ============================================================================
  app.put('/api/v1/family-section/:familyId/constitution', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Only OWNER or ADMIN roles can revise the Family Constitution.',
        });
        return;
      }

      const existingVersions = Object.values(store.synchronizedEntities || {})
        .filter((e) => e.familyId === familyId && e.entityType === 'FAMILY_CONSTITUTION_VERSION' && !e.isDeleted)
        .map((e) => e.data as Record<string, any>)
        .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));

      const latest = existingVersions[0] || {};
      const nextVersionNumber = Number(latest.versionNumber || 0) + 1;
      const now = Date.now();
      const constId = `const-${familyId}-v${nextVersionNumber}-${now}`;

      const {
        motto,
        missionStatement,
        visionStatement,
        coreValues,
        familyIdentityStatement,
        sharedAspirations,
        memberCommitments,
        legacyStatement,
      } = req.body || {};

      const cleanValues = Array.isArray(coreValues)
        ? coreValues.map((v) => String(v).trim()).filter(Boolean)
        : latest.coreValues || [];
      const cleanAspirations = Array.isArray(sharedAspirations)
        ? sharedAspirations.map((v) => String(v).trim()).filter(Boolean)
        : latest.sharedAspirations || [];
      const cleanCommitments = Array.isArray(memberCommitments)
        ? memberCommitments.map((v) => String(v).trim()).filter(Boolean)
        : latest.memberCommitments || [];

      const newConstitution = {
        id: constId,
        familyId,
        versionNumber: nextVersionNumber,
        motto: motto !== undefined ? String(motto).trim() : String(latest.motto || ''),
        missionStatement:
          missionStatement !== undefined ? String(missionStatement).trim() : String(latest.missionStatement || ''),
        visionStatement:
          visionStatement !== undefined ? String(visionStatement).trim() : String(latest.visionStatement || ''),
        coreValues: cleanValues,
        familyIdentityStatement:
          familyIdentityStatement !== undefined
            ? String(familyIdentityStatement).trim()
            : String(latest.familyIdentityStatement || ''),
        sharedAspirations: cleanAspirations,
        memberCommitments: cleanCommitments,
        legacyStatement:
          legacyStatement !== undefined ? String(legacyStatement).trim() : String(latest.legacyStatement || ''),
        editedByUserId: actor.userAccountId,
        editedByName: access.membership.displayName,
        acknowledgments: [
          {
            memberId: access.membership.memberProfileId,
            userAccountId: actor.userAccountId,
            displayName: access.membership.displayName,
            acknowledgedAt: now,
            versionNumber: nextVersionNumber,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      store.synchronizedEntities = store.synchronizedEntities || {};
      const record: SynchronizedEntityRecord = {
        id: constId,
        familyId,
        entityType: 'FAMILY_CONSTITUTION_VERSION',
        version: nextVersionNumber,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: newConstitution,
      };
      store.synchronizedEntities[`FAMILY_CONSTITUTION_VERSION:${constId}`] = record;

      // Also keep workspace motto, mission, vision, values in sync
      const ws = store.workspaces?.[familyId] || (store.workspace?.id === familyId ? store.workspace : null);
      if (ws) {
        ws.motto = newConstitution.motto;
        ws.mission = newConstitution.missionStatement;
        ws.vision = newConstitution.visionStatement;
        ws.values = newConstitution.coreValues;
        ws.updatedAt = now;
      }

      bumpWorkspaceVersion(store, familyId, now);
      void mirrorEntityToFirestore(record);

      res.status(200).json({
        constitution: newConstitution,
        versionNumber: nextVersionNumber,
      });
    });
  });

  app.post('/api/v1/family-section/:familyId/constitution/acknowledge', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const versions = Object.values(store.synchronizedEntities || {})
        .filter((e) => e.familyId === familyId && e.entityType === 'FAMILY_CONSTITUTION_VERSION' && !e.isDeleted)
        .sort((a, b) => Number(b.data.versionNumber || 0) - Number(a.data.versionNumber || 0));

      const current = versions[0];
      if (!current) {
        res.status(404).json({ error: 'CONSTITUTION_NOT_FOUND', message: 'No family constitution found.' });
        return;
      }

      const now = Date.now();
      const acks = Array.isArray(current.data.acknowledgments) ? [...current.data.acknowledgments] : [];
      const existingIdx = acks.findIndex(
        (a: any) =>
          a.memberId === access.membership!.memberProfileId || a.userAccountId === actor.userAccountId
      );
      const ackEntry = {
        memberId: access.membership.memberProfileId,
        userAccountId: actor.userAccountId,
        displayName: access.membership.displayName,
        acknowledgedAt: now,
        versionNumber: current.data.versionNumber || 1,
      };
      if (existingIdx >= 0) {
        acks[existingIdx] = ackEntry;
      } else {
        acks.push(ackEntry);
      }

      current.data.acknowledgments = acks;
      current.data.updatedAt = now;
      current.version += 1;
      current.updatedAt = now;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ constitution: current.data });
    });
  });

  // ============================================================================
  // 4. FAMILY TRADITIONS & CULTURE CRUD
  // ============================================================================
  app.post('/api/v1/family-section/:familyId/traditions', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const {
      title,
      category = 'Annual Tradition',
      frequency = 'Annually',
      nextPlannedDate = '',
      meaningAndOrigin = '',
      culturalBackground = '',
      linkedRecipeId = '',
      linkedRecipeTitle = '',
      responsibleMemberIds = [],
      memoriesAndNotes = [],
    } = req.body || {};

    if (!title || !String(title).trim()) {
      res.status(400).json({ error: 'INVALID_TRADITION_TITLE', message: 'Tradition title is required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (access.membership.role === 'GUEST') {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'GUEST role cannot create traditions.' });
        return;
      }

      const now = Date.now();
      const tradId = `trad-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const familyMembers = (store.familyMembers || []).filter((m) => m.familyId === familyId && !m.isDeleted);
      const validIds = Array.isArray(responsibleMemberIds)
        ? responsibleMemberIds.map((id) => String(id)).filter((id) => familyMembers.some((m) => m.id === id))
        : [access.membership.memberProfileId];
      const respNames = validIds
        .map((id) => familyMembers.find((m) => m.id === id)?.displayName)
        .filter(Boolean);

      const traditionData = {
        id: tradId,
        familyId,
        title: String(title).trim(),
        category: String(category || 'Annual Tradition').trim(),
        frequency: String(frequency || 'Annually').trim(),
        nextPlannedDate: String(nextPlannedDate || '').trim(),
        meaningAndOrigin: String(meaningAndOrigin || '').trim(),
        culturalBackground: String(culturalBackground || '').trim(),
        linkedRecipeId: String(linkedRecipeId || '').trim(),
        linkedRecipeTitle: String(linkedRecipeTitle || '').trim(),
        responsibleMemberIds: validIds,
        responsibleMemberNames: respNames.length > 0 ? respNames : [access.membership.displayName],
        memoriesAndNotes: Array.isArray(memoriesAndNotes)
          ? memoriesAndNotes.map((n) => String(n).trim()).filter(Boolean)
          : [],
        status: 'ACTIVE',
        createdByUserId: actor.userAccountId,
        createdAt: now,
        updatedAt: now,
      };

      store.synchronizedEntities = store.synchronizedEntities || {};
      const record: SynchronizedEntityRecord = {
        id: tradId,
        familyId,
        entityType: 'FAMILY_TRADITION',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: traditionData,
      };
      store.synchronizedEntities[`FAMILY_TRADITION:${tradId}`] = record;
      bumpWorkspaceVersion(store, familyId, now);
      void mirrorEntityToFirestore(record);

      res.status(201).json({ tradition: traditionData });
    });
  });

  app.put('/api/v1/family-section/:familyId/traditions/:traditionId', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const traditionId = String(req.params.traditionId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (access.membership.role === 'GUEST') {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'GUEST role cannot edit traditions.' });
        return;
      }

      const key = `FAMILY_TRADITION:${traditionId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'TRADITION_NOT_FOUND', message: 'Tradition not found.' });
        return;
      }

      const now = Date.now();
      const inc = req.body || {};
      const familyMembers = (store.familyMembers || []).filter((m) => m.familyId === familyId && !m.isDeleted);
      const validIds = Array.isArray(inc.responsibleMemberIds)
        ? inc.responsibleMemberIds.map((id: any) => String(id)).filter((id: string) => familyMembers.some((m) => m.id === id))
        : existing.data.responsibleMemberIds || [];
      const respNames = validIds
        .map((id: string) => familyMembers.find((m) => m.id === id)?.displayName)
        .filter(Boolean);

      const updatedData = {
        ...existing.data,
        title: inc.title !== undefined ? String(inc.title).trim() : existing.data.title,
        category: inc.category !== undefined ? String(inc.category).trim() : existing.data.category,
        frequency: inc.frequency !== undefined ? String(inc.frequency).trim() : existing.data.frequency,
        nextPlannedDate: inc.nextPlannedDate !== undefined ? String(inc.nextPlannedDate).trim() : existing.data.nextPlannedDate,
        meaningAndOrigin: inc.meaningAndOrigin !== undefined ? String(inc.meaningAndOrigin).trim() : existing.data.meaningAndOrigin,
        culturalBackground: inc.culturalBackground !== undefined ? String(inc.culturalBackground).trim() : existing.data.culturalBackground,
        linkedRecipeId: inc.linkedRecipeId !== undefined ? String(inc.linkedRecipeId).trim() : existing.data.linkedRecipeId,
        linkedRecipeTitle: inc.linkedRecipeTitle !== undefined ? String(inc.linkedRecipeTitle).trim() : existing.data.linkedRecipeTitle,
        responsibleMemberIds: validIds,
        responsibleMemberNames: respNames.length > 0 ? respNames : existing.data.responsibleMemberNames,
        memoriesAndNotes: Array.isArray(inc.memoriesAndNotes)
          ? inc.memoriesAndNotes.map((n: any) => String(n).trim()).filter(Boolean)
          : existing.data.memoriesAndNotes,
        status: inc.status !== undefined ? String(inc.status).toUpperCase() : existing.data.status,
        updatedAt: now,
      };

      existing.version += 1;
      existing.updatedAt = now;
      existing.updatedByUserId = actor.userAccountId;
      existing.data = updatedData;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ tradition: updatedData });
    });
  });

  app.delete('/api/v1/family-section/:familyId/traditions/:traditionId', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const traditionId = String(req.params.traditionId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Only OWNER or ADMIN can delete family traditions.' });
        return;
      }

      const key = `FAMILY_TRADITION:${traditionId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'TRADITION_NOT_FOUND', message: 'Tradition not found.' });
        return;
      }

      const now = Date.now();
      existing.isDeleted = true;
      existing.version += 1;
      existing.updatedAt = now;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ deleted: true, traditionId });
    });
  });

  // ============================================================================
  // 5. SHARED ACTIVITIES — PLANNER + TWO-WAY CALENDAR SYNC + RSVP
  // ============================================================================
  app.post('/api/v1/family-section/:familyId/activities', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const {
      title,
      description = '',
      dateIso = '',
      startTime = '18:00',
      endTime = '20:00',
      location = 'Home',
      category = 'Family Outing',
      participantMemberIds = [],
      budgetCents = 0,
      preparationChecklist = [],
      recurrence = 'NONE',
      status = 'PLANNED',
      memoryNotes = '',
    } = req.body || {};

    if (!title || !String(title).trim()) {
      res.status(400).json({ error: 'INVALID_ACTIVITY_TITLE', message: 'Activity title is required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (access.membership.role === 'GUEST') {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'GUEST role cannot create shared activities.' });
        return;
      }

      const now = Date.now();
      const actId = `act-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const familyMembers = (store.familyMembers || []).filter((m) => m.familyId === familyId && !m.isDeleted);
      const validParticipants =
        Array.isArray(participantMemberIds) && participantMemberIds.length > 0
          ? participantMemberIds.map((id) => String(id)).filter((id) => familyMembers.some((m) => m.id === id))
          : familyMembers.map((m) => m.id);

      const rsvps = validParticipants.map((memberId) => {
        const mem = familyMembers.find((m) => m.id === memberId);
        return {
          memberId,
          displayName: mem?.displayName || 'Family Member',
          status: memberId === access.membership!.memberProfileId ? 'GOING' : 'INVITED',
        };
      });

      const resolvedDateIso = String(dateIso || new Date(now + 86400000).toISOString().slice(0, 10)).trim();
      const calEventId = `cal-act-${actId}`;

      const activityData: Record<string, any> = {
        id: actId,
        familyId,
        title: String(title).trim(),
        description: String(description || '').trim(),
        dateIso: resolvedDateIso,
        startTime: String(startTime || '18:00').trim(),
        endTime: String(endTime || '20:00').trim(),
        location: String(location || 'Home').trim(),
        category: String(category || 'Family Outing').trim(),
        organizerMemberId: access.membership.memberProfileId,
        organizerName: access.membership.displayName,
        participantMemberIds: validParticipants,
        rsvps,
        budgetCents: Math.max(0, Math.round(Number(budgetCents || 0))),
        preparationChecklist: Array.isArray(preparationChecklist)
          ? preparationChecklist.map((item: any, idx: number) => ({
              id: String(item.id || `chk-${now}-${idx}`),
              text: String(item.text || item).trim(),
              completed: Boolean(item.completed),
            }))
          : [],
        status: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(String(status).toUpperCase())
          ? String(status).toUpperCase()
          : 'PLANNED',
        recurrence: String(recurrence || 'NONE').toUpperCase(),
        memoryNotes: String(memoryNotes || '').trim(),
        linkedCalendarEventId: calEventId,
        createdByUserId: actor.userAccountId,
        createdAt: now,
        updatedAt: now,
      };

      syncSharedActivityToCalendar(store, familyId, activityData, actor.userAccountId, false);

      store.synchronizedEntities = store.synchronizedEntities || {};
      const record: SynchronizedEntityRecord = {
        id: actId,
        familyId,
        entityType: 'FAMILY_SHARED_ACTIVITY',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: activityData,
      };
      store.synchronizedEntities[`FAMILY_SHARED_ACTIVITY:${actId}`] = record;
      bumpWorkspaceVersion(store, familyId, now);
      void mirrorEntityToFirestore(record);

      res.status(201).json({
        activity: activityData,
        linkedCalendarEventId: calEventId,
      });
    });
  });

  app.put('/api/v1/family-section/:familyId/activities/:activityId', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const activityId = String(req.params.activityId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (access.membership.role === 'GUEST') {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'GUEST role cannot modify shared activities.' });
        return;
      }

      const key = `FAMILY_SHARED_ACTIVITY:${activityId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'ACTIVITY_NOT_FOUND', message: 'Shared activity not found.' });
        return;
      }

      const now = Date.now();
      const inc = req.body || {};
      const updatedData: Record<string, any> = {
        ...existing.data,
        title: inc.title !== undefined ? String(inc.title).trim() : existing.data.title,
        description: inc.description !== undefined ? String(inc.description).trim() : existing.data.description,
        dateIso: inc.dateIso !== undefined ? String(inc.dateIso).trim() : existing.data.dateIso,
        startTime: inc.startTime !== undefined ? String(inc.startTime).trim() : existing.data.startTime,
        endTime: inc.endTime !== undefined ? String(inc.endTime).trim() : existing.data.endTime,
        location: inc.location !== undefined ? String(inc.location).trim() : existing.data.location,
        category: inc.category !== undefined ? String(inc.category).trim() : existing.data.category,
        budgetCents:
          inc.budgetCents !== undefined
            ? Math.max(0, Math.round(Number(inc.budgetCents)))
            : existing.data.budgetCents,
        preparationChecklist:
          inc.preparationChecklist !== undefined && Array.isArray(inc.preparationChecklist)
            ? inc.preparationChecklist.map((item: any, idx: number) => ({
                id: String(item.id || `chk-${now}-${idx}`),
                text: String(item.text || item).trim(),
                completed: Boolean(item.completed),
              }))
            : existing.data.preparationChecklist,
        status: inc.status !== undefined ? String(inc.status).toUpperCase() : existing.data.status,
        recurrence: inc.recurrence !== undefined ? String(inc.recurrence).toUpperCase() : existing.data.recurrence,
        memoryNotes: inc.memoryNotes !== undefined ? String(inc.memoryNotes).trim() : existing.data.memoryNotes,
        updatedAt: now,
      };

      syncSharedActivityToCalendar(store, familyId, updatedData, actor.userAccountId, false);

      existing.version += 1;
      existing.updatedAt = now;
      existing.updatedByUserId = actor.userAccountId;
      existing.data = updatedData;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ activity: updatedData });
    });
  });

  app.post('/api/v1/family-section/:familyId/activities/:activityId/rsvp', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const activityId = String(req.params.activityId || '').trim();
    const { status = 'GOING', memberId } = req.body || {};
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const key = `FAMILY_SHARED_ACTIVITY:${activityId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'ACTIVITY_NOT_FOUND', message: 'Shared activity not found.' });
        return;
      }

      const targetMemberId = String(memberId || access.membership.memberProfileId);
      const now = Date.now();
      const rsvps = Array.isArray(existing.data.rsvps) ? [...existing.data.rsvps] : [];
      const idx = rsvps.findIndex((r: any) => r.memberId === targetMemberId);
      const mem = (store.familyMembers || []).find((m) => m.id === targetMemberId && m.familyId === familyId);
      const entry = {
        memberId: targetMemberId,
        displayName: mem?.displayName || access.membership.displayName,
        status: ['GOING', 'MAYBE', 'DECLINED'].includes(String(status).toUpperCase())
          ? String(status).toUpperCase()
          : 'GOING',
      };
      if (idx >= 0) {
        rsvps[idx] = entry;
      } else {
        rsvps.push(entry);
      }

      existing.data.rsvps = rsvps;
      existing.data.updatedAt = now;
      existing.version += 1;
      existing.updatedAt = now;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ activity: existing.data });
    });
  });

  app.delete('/api/v1/family-section/:familyId/activities/:activityId', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const activityId = String(req.params.activityId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (access.membership.role === 'GUEST') {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'GUEST role cannot delete shared activities.' });
        return;
      }

      const key = `FAMILY_SHARED_ACTIVITY:${activityId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'ACTIVITY_NOT_FOUND', message: 'Shared activity not found.' });
        return;
      }

      const now = Date.now();
      syncSharedActivityToCalendar(store, familyId, existing.data, actor.userAccountId, true);
      existing.isDeleted = true;
      existing.version += 1;
      existing.updatedAt = now;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ deleted: true, activityId });
    });
  });

  // ============================================================================
  // 6. FAMILY RULES & PRINCIPLES — GOVERNANCE CRUD & ACKNOWLEDGMENTS
  // ============================================================================
  app.post('/api/v1/family-section/:familyId/rules', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const {
      title,
      category = 'Household Conduct',
      principleStatement = '',
      practicalExpectations = [],
      appliesTo = 'All Family Members',
      ownerMemberId,
    } = req.body || {};

    if (!title || !String(title).trim()) {
      res.status(400).json({ error: 'INVALID_RULE_TITLE', message: 'Rule title is required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Only OWNER or ADMIN roles can create or modify Family Rules & Principles.',
        });
        return;
      }

      const now = Date.now();
      const ruleId = `rule-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const resolvedOwnerId = String(ownerMemberId || access.membership.memberProfileId);
      const ownerMem = (store.familyMembers || []).find((m) => m.id === resolvedOwnerId && m.familyId === familyId);

      const ruleData = {
        id: ruleId,
        familyId,
        title: String(title).trim(),
        category: String(category || 'Household Conduct').trim(),
        principleStatement: String(principleStatement || '').trim(),
        practicalExpectations: Array.isArray(practicalExpectations)
          ? practicalExpectations.map((e) => String(e).trim()).filter(Boolean)
          : [],
        appliesTo: String(appliesTo || 'All Family Members').trim(),
        ownerMemberId: resolvedOwnerId,
        ownerName: ownerMem?.displayName || access.membership.displayName,
        status: 'ACTIVE',
        revisionDate: new Date(now).toISOString().slice(0, 10),
        acknowledgments: [
          {
            memberId: access.membership.memberProfileId,
            displayName: access.membership.displayName,
            acknowledgedAt: now,
          },
        ],
        createdByUserId: actor.userAccountId,
        createdAt: now,
        updatedAt: now,
      };

      store.synchronizedEntities = store.synchronizedEntities || {};
      const record: SynchronizedEntityRecord = {
        id: ruleId,
        familyId,
        entityType: 'FAMILY_RULE',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: ruleData,
      };
      store.synchronizedEntities[`FAMILY_RULE:${ruleId}`] = record;
      bumpWorkspaceVersion(store, familyId, now);
      void mirrorEntityToFirestore(record);

      res.status(201).json({ rule: ruleData });
    });
  });

  app.put('/api/v1/family-section/:familyId/rules/:ruleId', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const ruleId = String(req.params.ruleId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Only OWNER or ADMIN roles can edit or archive Family Rules & Principles.',
        });
        return;
      }

      const key = `FAMILY_RULE:${ruleId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'RULE_NOT_FOUND', message: 'Rule not found.' });
        return;
      }

      const now = Date.now();
      const inc = req.body || {};
      const updatedData = {
        ...existing.data,
        title: inc.title !== undefined ? String(inc.title).trim() : existing.data.title,
        category: inc.category !== undefined ? String(inc.category).trim() : existing.data.category,
        principleStatement:
          inc.principleStatement !== undefined
            ? String(inc.principleStatement).trim()
            : existing.data.principleStatement,
        practicalExpectations: Array.isArray(inc.practicalExpectations)
          ? inc.practicalExpectations.map((e: any) => String(e).trim()).filter(Boolean)
          : existing.data.practicalExpectations,
        appliesTo: inc.appliesTo !== undefined ? String(inc.appliesTo).trim() : existing.data.appliesTo,
        status: inc.status !== undefined ? String(inc.status).toUpperCase() : existing.data.status,
        revisionDate: new Date(now).toISOString().slice(0, 10),
        updatedAt: now,
      };

      existing.version += 1;
      existing.updatedAt = now;
      existing.updatedByUserId = actor.userAccountId;
      existing.data = updatedData;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ rule: updatedData });
    });
  });

  app.post('/api/v1/family-section/:familyId/rules/:ruleId/acknowledge', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const ruleId = String(req.params.ruleId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const key = `FAMILY_RULE:${ruleId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'RULE_NOT_FOUND', message: 'Rule not found.' });
        return;
      }

      const now = Date.now();
      const acks = Array.isArray(existing.data.acknowledgments) ? [...existing.data.acknowledgments] : [];
      const idx = acks.findIndex((a: any) => a.memberId === access.membership!.memberProfileId);
      const entry = {
        memberId: access.membership.memberProfileId,
        displayName: access.membership.displayName,
        acknowledgedAt: now,
      };
      if (idx >= 0) {
        acks[idx] = entry;
      } else {
        acks.push(entry);
      }

      existing.data.acknowledgments = acks;
      existing.data.updatedAt = now;
      existing.version += 1;
      existing.updatedAt = now;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ rule: existing.data });
    });
  });

  app.delete('/api/v1/family-section/:familyId/rules/:ruleId', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const ruleId = String(req.params.ruleId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Only OWNER or ADMIN can delete family rules.' });
        return;
      }

      const key = `FAMILY_RULE:${ruleId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'RULE_NOT_FOUND', message: 'Rule not found.' });
        return;
      }

      const now = Date.now();
      existing.isDeleted = true;
      existing.version += 1;
      existing.updatedAt = now;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ deleted: true, ruleId });
    });
  });

  // ============================================================================
  // 6B. EXTENDED FAMILY HERITAGE MAP & RELATIVE RECOGNITION CRUD + GROWTH LEDGER
  // ============================================================================
  app.post('/api/v1/family-section/:familyId/extended-relatives', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const {
      fullName,
      preferredTitle = '',
      lineageSide = 'PATERNAL',
      generationTier = 'PARENTS_AUNTS_UNCLES',
      relationshipToChildren = 'Extended Relative',
      birthYear,
      age,
      occupation = '',
      workplaceOrSpecialty = '',
      city = '',
      country = '',
      regionTag = 'North America',
      mapCoordinates,
      avatarUrl = '',
      bioAndHeritageStory = '',
      sharedInterests = [],
      conversationStarters = [],
      growthAreas = [],
    } = req.body || {};

    if (!fullName || !String(fullName).trim()) {
      res.status(400).json({ error: 'INVALID_RELATIVE_NAME', message: 'Full name is required.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (access.membership.role === 'GUEST') {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'GUEST role cannot add extended family profiles.' });
        return;
      }

      const now = Date.now();
      const currentYear = new Date().getFullYear();
      const relId = `rel-ext-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const cleanName = String(fullName).trim();
      const initials = cleanName
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      const resolvedSide = ['PATERNAL', 'MATERNAL', 'CORE_HOUSEHOLD'].includes(String(lineageSide).toUpperCase())
        ? String(lineageSide).toUpperCase()
        : 'PATERNAL';
      const resolvedTier = ['ELDERS_GRANDPARENTS', 'PARENTS_AUNTS_UNCLES', 'CHILDREN_COUSINS'].includes(
        String(generationTier).toUpperCase()
      )
        ? String(generationTier).toUpperCase()
        : 'PARENTS_AUNTS_UNCLES';

      const parsedAge = age !== undefined && Number(age) > 0 ? Math.round(Number(age)) : 40;
      const parsedBirthYear =
        birthYear !== undefined && Number(birthYear) > 1900
          ? Math.round(Number(birthYear))
          : currentYear - parsedAge;
      const finalAge = currentYear - parsedBirthYear;

      const defaultCoords =
        mapCoordinates && typeof mapCoordinates.xPercent === 'number' && typeof mapCoordinates.yPercent === 'number'
          ? {
              xPercent: Math.min(92, Math.max(8, Number(mapCoordinates.xPercent))),
              yPercent: Math.min(88, Math.max(12, Number(mapCoordinates.yPercent))),
            }
          : resolvedSide === 'PATERNAL'
          ? { xPercent: 46 + (now % 9), yPercent: 30 + (now % 12) }
          : { xPercent: 26 + (now % 9), yPercent: 34 + (now % 12) };

      const resolvedAvatar =
        avatarUrl && String(avatarUrl).trim()
          ? String(avatarUrl).trim()
          : createRelativePortraitSvgDataUrl({
              initials,
              bgHex: resolvedSide === 'PATERNAL' ? '#25443B' : '#173D35',
              ringHex: resolvedSide === 'PATERNAL' ? '#C39A60' : '#2E6F5E',
              skinHex: '#D9A987',
              hairHex: resolvedTier === 'ELDERS_GRANDPARENTS' ? '#D6D3D1' : '#292524',
              shirtHex: resolvedSide === 'PATERNAL' ? '#1E3A8A' : '#0F766E',
              hasGlasses: resolvedTier === 'ELDERS_GRANDPARENTS',
              hasBeard: false,
            });

      const relativeData = {
        id: relId,
        familyId,
        fullName: cleanName,
        preferredTitle: String(preferredTitle || cleanName).trim(),
        lineageSide: resolvedSide,
        generationTier: resolvedTier,
        relationshipToChildren: String(relationshipToChildren || 'Extended Relative').trim(),
        birthYear: parsedBirthYear,
        age: finalAge,
        occupation: String(occupation || 'Family Steward & Mentor').trim(),
        workplaceOrSpecialty: String(workplaceOrSpecialty || '').trim(),
        city: String(city || 'Hometown').trim(),
        country: String(country || '').trim(),
        regionTag: String(regionTag || 'Family Region').trim(),
        mapCoordinates: defaultCoords,
        avatarUrl: resolvedAvatar,
        bioAndHeritageStory: String(bioAndHeritageStory || '').trim(),
        sharedInterests: Array.isArray(sharedInterests)
          ? sharedInterests.map((s) => String(s).trim()).filter(Boolean)
          : [],
        conversationStarters: Array.isArray(conversationStarters)
          ? conversationStarters.map((s) => String(s).trim()).filter(Boolean)
          : [],
        growthAreas: Array.isArray(growthAreas)
          ? growthAreas.map((g: any, idx: number) => ({
              id: String(g.id || `gr-${now}-${idx}`),
              title: String(g.title || '').trim(),
              category: String(g.category || 'FAMILY_BOND').toUpperCase(),
              description: String(g.description || '').trim(),
              howKidsCanSupport: String(g.howKidsCanSupport || '').trim(),
              status: String(g.status || 'ACTIVE_SUPPORT').toUpperCase(),
              addedByName: access.membership!.displayName,
              createdAt: now,
            }))
          : [],
        encouragementNotes: [],
        createdByUserId: actor.userAccountId,
        createdAt: now,
        updatedAt: now,
      };

      store.synchronizedEntities = store.synchronizedEntities || {};
      const record: SynchronizedEntityRecord = {
        id: relId,
        familyId,
        entityType: 'FAMILY_EXTENDED_RELATIVE',
        version: 1,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: relativeData,
      };
      store.synchronizedEntities[`FAMILY_EXTENDED_RELATIVE:${relId}`] = record;
      bumpWorkspaceVersion(store, familyId, now);
      void mirrorEntityToFirestore(record);

      res.status(201).json({ relative: relativeData });
    });
  });

  app.put('/api/v1/family-section/:familyId/extended-relatives/:relativeId', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const relativeId = String(req.params.relativeId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (access.membership.role === 'GUEST') {
        res.status(403).json({ error: 'PERMISSION_DENIED', message: 'GUEST role cannot edit extended family profiles.' });
        return;
      }

      const key = `FAMILY_EXTENDED_RELATIVE:${relativeId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'RELATIVE_NOT_FOUND', message: 'Extended relative profile not found.' });
        return;
      }

      const now = Date.now();
      const currentYear = new Date().getFullYear();
      const inc = req.body || {};

      const nextBirthYear =
        inc.birthYear !== undefined
          ? Math.round(Number(inc.birthYear))
          : inc.age !== undefined
          ? currentYear - Math.round(Number(inc.age))
          : existing.data.birthYear;
      const nextAge = currentYear - Number(nextBirthYear || currentYear - 40);

      const updatedData = {
        ...existing.data,
        fullName: inc.fullName !== undefined ? String(inc.fullName).trim() : existing.data.fullName,
        preferredTitle: inc.preferredTitle !== undefined ? String(inc.preferredTitle).trim() : existing.data.preferredTitle,
        lineageSide: inc.lineageSide !== undefined ? String(inc.lineageSide).toUpperCase() : existing.data.lineageSide,
        generationTier: inc.generationTier !== undefined ? String(inc.generationTier).toUpperCase() : existing.data.generationTier,
        relationshipToChildren:
          inc.relationshipToChildren !== undefined
            ? String(inc.relationshipToChildren).trim()
            : existing.data.relationshipToChildren,
        birthYear: nextBirthYear,
        age: nextAge,
        occupation: inc.occupation !== undefined ? String(inc.occupation).trim() : existing.data.occupation,
        workplaceOrSpecialty:
          inc.workplaceOrSpecialty !== undefined
            ? String(inc.workplaceOrSpecialty).trim()
            : existing.data.workplaceOrSpecialty,
        city: inc.city !== undefined ? String(inc.city).trim() : existing.data.city,
        country: inc.country !== undefined ? String(inc.country).trim() : existing.data.country,
        regionTag: inc.regionTag !== undefined ? String(inc.regionTag).trim() : existing.data.regionTag,
        mapCoordinates:
          inc.mapCoordinates && typeof inc.mapCoordinates.xPercent === 'number'
            ? inc.mapCoordinates
            : existing.data.mapCoordinates,
        avatarUrl: inc.avatarUrl !== undefined && String(inc.avatarUrl).trim() ? String(inc.avatarUrl).trim() : existing.data.avatarUrl,
        bioAndHeritageStory:
          inc.bioAndHeritageStory !== undefined
            ? String(inc.bioAndHeritageStory).trim()
            : existing.data.bioAndHeritageStory,
        sharedInterests: Array.isArray(inc.sharedInterests)
          ? inc.sharedInterests.map((s: any) => String(s).trim()).filter(Boolean)
          : existing.data.sharedInterests,
        conversationStarters: Array.isArray(inc.conversationStarters)
          ? inc.conversationStarters.map((s: any) => String(s).trim()).filter(Boolean)
          : existing.data.conversationStarters,
        updatedAt: now,
      };

      existing.version += 1;
      existing.updatedAt = now;
      existing.updatedByUserId = actor.userAccountId;
      existing.data = updatedData;
      bumpWorkspaceVersion(store, familyId, now);
      void mirrorEntityToFirestore(existing);

      res.status(200).json({ relative: updatedData });
    });
  });

  app.post('/api/v1/family-section/:familyId/extended-relatives/:relativeId/growth', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const relativeId = String(req.params.relativeId || '').trim();
    const actor = req.actor!;
    const {
      action = 'ADD_GROWTH_AREA',
      title = '',
      category = 'EDUCATION_MENTORSHIP',
      description = '',
      howKidsCanSupport = '',
      status = 'ACTIVE_SUPPORT',
      growthAreaId = '',
      message = '',
    } = req.body || {};

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (access.membership.role === 'GUEST') {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'GUEST role cannot modify growth areas or encouragement notes.',
        });
        return;
      }

      const key = `FAMILY_EXTENDED_RELATIVE:${relativeId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'RELATIVE_NOT_FOUND', message: 'Extended relative profile not found.' });
        return;
      }

      const now = Date.now();
      const actionUpper = String(action).toUpperCase();
      const growthAreas = Array.isArray(existing.data.growthAreas) ? [...existing.data.growthAreas] : [];
      const encouragementNotes = Array.isArray(existing.data.encouragementNotes)
        ? [...existing.data.encouragementNotes]
        : [];

      if (actionUpper === 'ADD_GROWTH_AREA') {
        if (!String(title).trim()) {
          res.status(400).json({ error: 'INVALID_GROWTH_TITLE', message: 'Growth area title is required.' });
          return;
        }
        growthAreas.unshift({
          id: `gr-${now}-${Math.random().toString(36).slice(2, 5)}`,
          title: String(title).trim(),
          category: String(category || 'EDUCATION_MENTORSHIP').toUpperCase(),
          description: String(description || '').trim(),
          howKidsCanSupport: String(howKidsCanSupport || '').trim(),
          status: ['EXPLORING', 'ACTIVE_SUPPORT', 'CELEBRATED'].includes(String(status).toUpperCase())
            ? String(status).toUpperCase()
            : 'ACTIVE_SUPPORT',
          addedByName: access.membership.displayName,
          addedByRole: access.membership.role,
          createdAt: now,
        });
      } else if (actionUpper === 'UPDATE_GROWTH_STATUS') {
        const target = growthAreas.find((g: any) => g.id === String(growthAreaId));
        if (!target) {
          res.status(404).json({ error: 'GROWTH_AREA_NOT_FOUND', message: 'Growth area not found.' });
          return;
        }
        target.status = ['EXPLORING', 'ACTIVE_SUPPORT', 'CELEBRATED'].includes(String(status).toUpperCase())
          ? String(status).toUpperCase()
          : 'CELEBRATED';
      } else if (actionUpper === 'ADD_ENCOURAGEMENT_NOTE') {
        if (!String(message).trim()) {
          res.status(400).json({ error: 'INVALID_NOTE_MESSAGE', message: 'Encouragement message is required.' });
          return;
        }
        encouragementNotes.unshift({
          id: `enc-${now}-${Math.random().toString(36).slice(2, 5)}`,
          authorName: access.membership.displayName,
          authorRole: access.membership.role,
          message: String(message).trim(),
          createdAt: now,
        });
      }

      existing.data = {
        ...existing.data,
        growthAreas,
        encouragementNotes,
        updatedAt: now,
      };
      existing.version += 1;
      existing.updatedAt = now;
      existing.updatedByUserId = actor.userAccountId;
      bumpWorkspaceVersion(store, familyId, now);
      void mirrorEntityToFirestore(existing);

      res.status(200).json({ relative: existing.data });
    });
  });

  app.delete('/api/v1/family-section/:familyId/extended-relatives/:relativeId', requireAuth, async (req: Request, res: Response) => {
    const familyId = String(req.params.familyId || '').trim();
    const relativeId = String(req.params.relativeId || '').trim();
    const actor = req.actor!;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }
      if (!canManageMemberships(access.membership.role)) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'Only OWNER or ADMIN can remove extended family profiles.',
        });
        return;
      }

      const key = `FAMILY_EXTENDED_RELATIVE:${relativeId}`;
      const existing = store.synchronizedEntities?.[key];
      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'RELATIVE_NOT_FOUND', message: 'Extended relative profile not found.' });
        return;
      }

      const now = Date.now();
      existing.isDeleted = true;
      existing.version += 1;
      existing.updatedAt = now;
      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({ deleted: true, relativeId });
    });
  });

  // ============================================================================
  // 7. GET /api/v1/home-dashboards/:familyId — Live Aggregated Data for All 7 Home Dashboards
  // ============================================================================
  app.get('/api/v1/home-dashboards/:familyId', requireAuth, (req: Request, res: Response) => {
    try {
    const familyId = String(req.params.familyId || '').trim();
    const store = loadStore();
    const actor = req.actor!;

    const access = resolveServerMembership(store, actor.userAccountId, familyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const caller = access.membership;
    const isFinanceAuthorized = canPerformFinanceMutation(caller.role);
    const isCoupleAuthorized = canAccessCoupleEnclave(caller.role);

    const ws = store.workspaces?.[familyId] || (store.workspace?.id === familyId ? store.workspace : store.workspace);
    const timezone = String(req.query.timezone || ws?.timezone || 'UTC');
    const queryYear = req.query.year ? Number(req.query.year) : undefined;
    const queryMonth = req.query.month ? Number(req.query.month) : undefined;
    const startEpoch = req.query.startEpoch !== undefined ? Number(req.query.startEpoch) : undefined;
    const endEpoch = req.query.endEpoch !== undefined ? Number(req.query.endEpoch) : undefined;

    const rawMembers = (store.familyMembers || []).filter((m) => m.familyId === familyId && !m.isDeleted);
    const members = rawMembers.map((m) => sanitizeMemberForCaller(store, caller, m));

    // 1. Finance Engine Snapshot (Authoritative BigInt calculation module shared with Finance Hub)
    const finStore = getFinanceStore(familyId);
    let financeSummary: Record<string, any> = {
      authorized: false,
      accessStatus: 'RESTRICTED',
      message: 'Access to family financial accounts, balances, and ledgers is restricted for this role.',
      netWorthCents: null,
      netWorthCentsDecimal: null,
      availableCashCents: null,
      availableCashCentsDecimal: null,
      totalAssetsCents: null,
      totalAssetsCentsDecimal: null,
      totalLiabilitiesCents: null,
      totalLiabilitiesCentsDecimal: null,
      monthlyIncomeCents: null,
      monthlyIncomeCentsDecimal: null,
      monthlyExpensesCents: null,
      monthlyExpensesCentsDecimal: null,
      monthlySurplusCents: null,
      monthlySurplusCentsDecimal: null,
      accounts: [],
      budgets: [],
      savingsGoals: [],
      recurringRules: [],
      investments: [],
      recentTransactions: [],
      alerts: [],
    };

    if (isFinanceAuthorized) {
      const accounts = (store.accounts || []).filter((a) => a.familyId === familyId && !(a as any).isArchived);
      const investments = Array.from(finStore.investmentHoldings.values()).filter((i) => !i.isDeleted);
      const netWorthCalc = computeAuthoritativeNetWorth(accounts, investments);

      const transactions = (store.transactions || [])
        .filter((t) => t.familyId === familyId && !(t as any).isDeleted)
        .sort((a: any, b: any) => Number(b.timestamp || b.transactionDate || 0) - Number(a.timestamp || a.transactionDate || 0));

      const cashFlowCalc = computeAuthoritativeCashFlow(transactions, {
        startEpoch,
        endEpoch,
        timezone,
      });

      const budgets = (store.budgets || []).filter((b) => b.familyId === familyId);
      const savingsGoals = Array.from(finStore.savingsGoals.values());
      const recurringRules = Array.from(finStore.recurringRules.values()).filter((r) => r.isActive);
      const recurringForecast = computeAuthoritativeRecurringForecast(recurringRules, {
        year: queryYear,
        month: queryMonth,
        timezone,
      });

      const alerts: Array<{ id: string; severity: 'HIGH' | 'MEDIUM' | 'INFO'; title: string; detail: string }> = [];
      for (const b of budgets) {
        const allocBig = readEntityBigInt(b, 'allocatedCents');
        const spentBig = readEntityBigInt(b, 'spentCents');
        const bStatus = computeAuthoritativeBudgetStatusBigInt(allocBig, spentBig, b.alertThresholdPercentage);
        if (bStatus.status === 'OVER_BUDGET') {
          alerts.push({
            id: `fin-alert-over-${b.id}`,
            severity: 'HIGH',
            title: `${b.category} Budget Exceeded (${bStatus.spentPercentage}%)`,
            detail: `Spent ${formatCentsDecimal(serializeBigIntToDecimalString(spentBig))} of ${formatCentsDecimal(serializeBigIntToDecimalString(allocBig))} allocation.`,
          });
        } else if (bStatus.status === 'WARNING') {
          alerts.push({
            id: `fin-alert-warn-${b.id}`,
            severity: 'MEDIUM',
            title: `${b.category} Approaching Limit (${bStatus.spentPercentage}%)`,
            detail: `${formatCentsDecimal(serializeBigIntToDecimalString(bStatus.remainingCentsBig))} remaining this month.`,
          });
        }
      }

      financeSummary = {
        authorized: true,
        accessStatus: 'AUTHORIZED',
        netWorthCents: toSafeNumberOrNull(netWorthCalc.netWorthCentsBig) ?? 0,
        netWorthCentsDecimal: serializeBigIntToDecimalString(netWorthCalc.netWorthCentsBig),
        availableCashCents: toSafeNumberOrNull(netWorthCalc.availableCashCentsBig) ?? 0,
        availableCashCentsDecimal: serializeBigIntToDecimalString(netWorthCalc.availableCashCentsBig),
        nonInvestmentAssetsCents: toSafeNumberOrNull(netWorthCalc.nonInvestmentAssetsCentsBig) ?? 0,
        nonInvestmentAssetsCentsDecimal: serializeBigIntToDecimalString(netWorthCalc.nonInvestmentAssetsCentsBig),
        investmentHoldingsCents: toSafeNumberOrNull(netWorthCalc.investmentHoldingsCentsBig) ?? 0,
        investmentHoldingsCentsDecimal: serializeBigIntToDecimalString(netWorthCalc.investmentHoldingsCentsBig),
        totalAssetsCents: toSafeNumberOrNull(netWorthCalc.totalAssetsCentsBig) ?? 0,
        totalAssetsCentsDecimal: serializeBigIntToDecimalString(netWorthCalc.totalAssetsCentsBig),
        totalLiabilitiesCents: toSafeNumberOrNull(netWorthCalc.totalLiabilitiesCentsBig) ?? 0,
        totalLiabilitiesCentsDecimal: serializeBigIntToDecimalString(netWorthCalc.totalLiabilitiesCentsBig),
        monthlyIncomeCents: toSafeNumberOrNull(cashFlowCalc.incomeCentsBig) ?? 0,
        monthlyIncomeCentsDecimal: serializeBigIntToDecimalString(cashFlowCalc.incomeCentsBig),
        monthlyExpensesCents: toSafeNumberOrNull(cashFlowCalc.expenseCentsBig) ?? 0,
        monthlyExpensesCentsDecimal: serializeBigIntToDecimalString(cashFlowCalc.expenseCentsBig),
        monthlySurplusCents: toSafeNumberOrNull(cashFlowCalc.netCashFlowCentsBig) ?? 0,
        monthlySurplusCentsDecimal: serializeBigIntToDecimalString(cashFlowCalc.netCashFlowCentsBig),
        projectedMonthlyRecurringIncomeCents: toSafeNumberOrNull(recurringForecast.averageMonthlyIncomeCentsBig) ?? 0,
        projectedMonthlyRecurringIncomeCentsDecimal: serializeBigIntToDecimalString(recurringForecast.averageMonthlyIncomeCentsBig),
        projectedMonthlyRecurringExpenseCents: toSafeNumberOrNull(recurringForecast.averageMonthlyExpenseCentsBig) ?? 0,
        projectedMonthlyRecurringExpenseCentsDecimal: serializeBigIntToDecimalString(recurringForecast.averageMonthlyExpenseCentsBig),
        scheduledMonthRecurringIncomeCents: toSafeNumberOrNull(recurringForecast.scheduledMonthIncomeCentsBig) ?? 0,
        scheduledMonthRecurringIncomeCentsDecimal: serializeBigIntToDecimalString(recurringForecast.scheduledMonthIncomeCentsBig),
        scheduledMonthRecurringExpenseCents: toSafeNumberOrNull(recurringForecast.scheduledMonthExpenseCentsBig) ?? 0,
        scheduledMonthRecurringExpenseCentsDecimal: serializeBigIntToDecimalString(recurringForecast.scheduledMonthExpenseCentsBig),
        periodStartEpoch: cashFlowCalc.startEpoch,
        periodEndEpoch: cashFlowCalc.endEpoch,
        timezone: cashFlowCalc.timezone,
        accounts: accounts.map((a: any) => {
          const balBig = readEntityBigInt(a, 'currentBalanceCents');
          return {
            ...a,
            accountType: a.accountType || a.type || 'CHECKING',
            currentBalanceCents: toSafeNumberOrNull(balBig),
            currentBalanceCentsDecimal: serializeBigIntToDecimalString(balBig),
          };
        }),
        budgets: budgets.map((b: any) => {
          const allocBig = readEntityBigInt(b, 'allocatedCents');
          const spentBig = readEntityBigInt(b, 'spentCents');
          const bStatus = computeAuthoritativeBudgetStatusBigInt(allocBig, spentBig, b.alertThresholdPercentage);
          return {
            ...b,
            allocatedCents: toSafeNumberOrNull(allocBig),
            allocatedCentsDecimal: serializeBigIntToDecimalString(allocBig),
            spentCents: toSafeNumberOrNull(spentBig),
            spentCentsDecimal: serializeBigIntToDecimalString(spentBig),
            remainingCents: toSafeNumberOrNull(bStatus.remainingCentsBig),
            remainingCentsDecimal: serializeBigIntToDecimalString(bStatus.remainingCentsBig),
            status: bStatus.status,
            spentPercentage: bStatus.spentPercentage,
            utilizationPercentage: bStatus.utilizationPercentage,
          };
        }),
        savingsGoals,
        recurringRules,
        investments,
        recentTransactions: transactions.slice(0, 8).map((t: any) => {
          const amtBig = readEntityBigInt(t, 'amountCents');
          return {
            ...t,
            amountCents: toSafeNumberOrNull(amtBig),
            amountCentsDecimal: serializeBigIntToDecimalString(amtBig),
            transactionType: t.transactionType || t.type || 'EXPENSE',
            transactionDate: Number(t.transactionDate || t.timestamp || Date.now()),
          };
        }),
        alerts,
      };
    }

    // 2. Household Engine Snapshot
    const hhStore = getHouseholdStore(familyId);
    const meals = Array.from(hhStore.meals.values()).sort((a, b) => a.planDate - b.planDate);
    const recipes = Array.from(hhStore.recipes.values());
    const chores = Array.from(hhStore.chores.values()).map((c) => {
      const assignedMember = members.find((m) => m.id === c.assignedMemberId);
      return {
        ...c,
        assignedToMemberName:
          (c as any).assignedToMemberName ||
          assignedMember?.displayName ||
          c.description?.replace(/^Assigned to\s+/i, '') ||
          members[0]?.displayName ||
          'Family Member',
        pointsValue: c.rewardPoints ?? (c as any).pointsValue ?? 10,
        rewardPoints: c.rewardPoints ?? (c as any).pointsValue ?? 10,
      };
    });
    const pantry = Array.from(hhStore.pantry.values()).map((p) => ({
      ...p,
      name: p.itemName || (p as any).name || 'Pantry Item',
      itemName: p.itemName || (p as any).name || 'Pantry Item',
      expiryStatus: computeExpiryStatus(p.expiryDate),
    }));
    const groceries = Array.from(hhStore.groceries.values()).map((g) => ({
      ...g,
      name: g.itemName || (g as any).name || 'Grocery Item',
      itemName: g.itemName || (g as any).name || 'Grocery Item',
    }));
    const wardrobe = Array.from(hhStore.wardrobe.values());
    const outfits = Array.from(hhStore.outfits.values());
    const assets = Array.from(hhStore.assets.values());

    // 3. Goals, Projects & Tasks Snapshot
    const visibleGoals = (store.goals || [])
      .filter((g) => canViewGoal(store, caller, g) && !g.isDeleted)
      .map((g) => {
        if (!isFinanceAuthorized) {
          const copy = { ...g };
          delete copy.budgetCents;
          delete copy.currentCents;
          return copy;
        }
        return g;
      });
    const visibleProjects = (store.projects || []).filter((p) => canViewProject(store, caller, p) && !p.isDeleted);
    const visibleTasks = (store.planningTasks || store.tasks || [])
      .filter((t) => canViewTask(store, caller, t) && !t.isDeleted)
      .map((t: any) => ({
        ...t,
        dueDateIso: t.dueDate || t.dueDateIso || t.dueLabel || 'Active',
        dueDate: t.dueDate || t.dueDateIso || null,
      }));
    const visibleMilestones = (store.milestones || []).filter((m) => m.familyId === familyId && !m.isDeleted);
    const visibleChecklists = ((store as any).checklistItems || []).filter((c: any) => c.familyId === familyId && !c.isDeleted);

    // 4. Calendar & Routines Snapshot
    const calendarEvents = (store.calendarEvents || [])
      .filter((e) => e.familyId === familyId && !e.isDeleted)
      .filter((e) => canViewCalendarEvent(store, caller, e))
      .sort((a, b) => (a.eventEpoch || 0) - (b.eventEpoch || 0))
      .map((e: any) => ({
        ...e,
        dateIso: e.eventDate || e.dateIso || e.date || new Date(e.eventEpoch || Date.now()).toISOString().slice(0, 10),
        startTime: e.startTime || (e.isAllDay ? 'All Day' : '09:00'),
      }));

    // 5. Domain Entities (Relationships, Parenting, Life Management, Family Section)
    const domainEntities = Object.values(store.synchronizedEntities || {}).filter(
      (e) => e.familyId === familyId && !e.isDeleted && canCallerReadDomainEntity(store, caller, e)
    );
    const byType = (type: string) =>
      domainEntities
        .filter((e) => e.entityType === type)
        .map((e) => ({ ...e.data, id: e.id, version: e.version, updatedAt: e.updatedAt }));

    const relationshipDashboard = {
      canAccessCoupleEnclave: isCoupleAuthorized,
      checkins: byType('REL_CHECKIN'),
      gratitude: byType('REL_GRATITUDE'),
      couplePlans: isCoupleAuthorized ? byType('REL_COUPLE_PLAN') : [],
      meetings: byType('REL_MEETING'),
      meetingTemplates: byType('REL_MEETING_TEMPLATE'),
      experiences: byType('REL_EXPERIENCE'),
      agreements: byType('REL_AGREEMENT'),
      networkContacts: byType('REL_NETWORK_CONTACT'),
    };

    const parentingDashboard = {
      childProfiles: byType('PAR_CHILD_PROFILE'),
      childRoutines: byType('PAR_CHILD_ROUTINE'),
      routineTemplates: byType('PAR_ROUTINE_TEMPLATE'),
      studyItems: byType('PAR_STUDY_ITEM'),
      personalGrowthGoals: byType('PAR_PERSONAL_GOAL'),
      lessons: byType('PAR_MICRO_LESSON'),
      habits: byType('PAR_HABIT'),
      familyLearningItems: byType('PAR_FAMILY_LEARNING'),
      parentingResources: byType('PAR_RESOURCE'),
    };

    const lifeDashboard = {
      personalTasks: byType('LIFE_PERSONAL_TASK'),
      documents: byType('LIFE_DOCUMENT'),
      personalLists: byType('LIFE_PERSONAL_LIST'),
      contacts: byType('LIFE_CONTACT'),
      trips: byType('LIFE_TRAVEL_PLAN'),
      vehicles: byType('LIFE_VEHICLE'),
      longTermPlans: byType('LIFE_LONG_TERM_PLAN'),
      emergencySupplies: byType('EMERGENCY_SUPPLY'),
    };

    // Upcoming birthdays & anniversaries from member profiles
    const upcomingCelebrations: Array<{ id: string; memberName: string; label: string; dateIso: string; category: string }> = [];
    for (const m of members) {
      if (m.birthDate) {
        upcomingCelebrations.push({
          id: `bday-${m.id}`,
          memberName: m.displayName,
          label: `${m.displayName}'s Birthday`,
          dateIso: m.birthDate,
          category: 'BIRTHDAY',
        });
      }
      for (const dt of m.importantDates || []) {
        upcomingCelebrations.push({
          id: dt.id || `dt-${m.id}-${dt.label}`,
          memberName: m.displayName,
          label: dt.label,
          dateIso: dt.dateIso || (dt as any).date || '',
          category: dt.category || 'MILESTONE',
        });
      }
    }

    res.status(200).json({
      familyId,
      caller: {
        userAccountId: caller.userAccountId,
        memberProfileId: caller.memberProfileId,
        displayName: caller.displayName,
        role: caller.role,
      },
      workspace: {
        id: ws.id,
        name: ws.name,
        motto: ws.motto || 'Together in Stewardship',
        mission: ws.mission || '',
        vision: ws.vision || '',
        values: ws.values || [],
        currencyCode: ws.currencyCode || 'USD',
        announcements: ws.announcements || [],
        reminders: ws.reminders || [],
      },
      members,
      financeDashboard: financeSummary,
      householdDashboard: {
        meals,
        recipes,
        chores,
        pantry,
        groceries,
        wardrobe,
        outfits,
        assets,
      },
      goalsDashboard: {
        goals: visibleGoals,
        projects: visibleProjects,
        tasks: visibleTasks,
        milestones: visibleMilestones,
        checklistItems: visibleChecklists,
      },
      calendarEvents,
      relationshipDashboard,
      parentingDashboard,
      lifeDashboard,
      upcomingCelebrations,
      sharedActivities: byType('FAMILY_SHARED_ACTIVITY'),
    });
    } catch (err: any) {
      console.error('HOME_DASHBOARDS_ERR:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err?.message, stack: err?.stack });
    }
  });
}
