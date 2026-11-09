/**
 * FAMILYOS — SIGNED 64-BIT BIGINT & DECIMAL-STRING FINANCIAL PRECISION ENGINE
 *
 * Strict Financial Integrity & Transport Architecture:
 * 1. Zero floating-point arithmetic on currency or share quantities.
 * 2. Full signed 64-bit integer range enforced (`[-9223372036854775808n, 9223372036854775807n]`),
 *    matching Kotlin `Long` and SQLite `INTEGER` semantics.
 * 3. All internal React and server calculations use `BigInt` so values exceeding
 *    `Number.MAX_SAFE_INTEGER` (9,007,199,254,740,991) never suffer IEEE-754 precision loss.
 * 4. JSON Transport Convention: `BigInt` is never passed raw to `JSON.stringify()`.
 *    Instead, values are serialized at the API boundary as validated decimal strings
 *    (`serializeBigIntToDecimalString`) alongside safe-integer numeric fields when within `MAX_SAFE_INTEGER`.
 */

export const MAX_SIGNED_64_BIGINT = 9223372036854775807n;
export const MIN_SIGNED_64_BIGINT = -9223372036854775808n;
export const MAX_SAFE_INTEGER_BIGINT = 9007199254740991n;
export const MIN_SAFE_INTEGER_BIGINT = -9007199254740991n;
export const MICROSHARES_SCALE_BIGINT = 1000000n;

/**
 * Checks whether a BigInt is within the signed 64-bit integer range `[-2^63, 2^63 - 1]`.
 */
export function isValidSigned64BigInt(value: bigint): boolean {
  return typeof value === 'bigint' && value >= MIN_SIGNED_64_BIGINT && value <= MAX_SIGNED_64_BIGINT;
}

/**
 * Safely parses a `bigint`, decimal `string`, or safe `number` into a validated signed 64-bit `BigInt`.
 * - Rejects unsafe JS `number` values (`!Number.isSafeInteger(value)`) to prevent silent IEEE-754 precision loss.
 * - Rejects strings outside `[-9223372036854775808, 9223372036854775807]`.
 */
export function parseSigned64BigInt(
  input: bigint | number | string | null | undefined
): bigint | null {
  if (input === null || input === undefined) return null;

  if (typeof input === 'bigint') {
    return isValidSigned64BigInt(input) ? input : null;
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || !Number.isSafeInteger(input)) {
      return null;
    }
    const asBig = BigInt(input);
    return isValidSigned64BigInt(asBig) ? asBig : null;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!/^[+-]?\d+$/.test(trimmed)) {
      return null;
    }
    try {
      const asBig = BigInt(trimmed);
      return isValidSigned64BigInt(asBig) ? asBig : null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Reads an authoritative decimal string field first, falling back to a secondary value
 * ONLY if it is a valid signed 64-bit integer (never an unsafe JS Number).
 * Defaults to `0n` if missing or invalid.
 */
export function toBigIntOrZero(
  value: bigint | number | string | null | undefined,
  decimalFallback?: bigint | number | string | null
): bigint {
  // Always prioritize string decimal representation if passed in either position
  if (typeof value === 'string' && value.trim() !== '') {
    const parsedPrimary = parseSigned64BigInt(value);
    if (parsedPrimary !== null) return parsedPrimary;
  }
  if (typeof decimalFallback === 'string' && decimalFallback.trim() !== '') {
    const parsedDec = parseSigned64BigInt(decimalFallback);
    if (parsedDec !== null) return parsedDec;
  }
  const parsedPrimary = parseSigned64BigInt(value);
  if (parsedPrimary !== null) return parsedPrimary;
  const parsedSecondary = parseSigned64BigInt(decimalFallback);
  return parsedSecondary !== null ? parsedSecondary : 0n;
}

export const readAuthoritativeBigInt = toBigIntOrZero;

/**
 * Validates and converts a signed 64-bit integer (`bigint | number | string`) into an exact base-10 string
 * suitable for JSON serialization (`JSON.stringify`) without `BigInt` TypeError or precision loss.
 */
export function serializeBigIntToDecimalString(
  value: bigint | number | string
): string {
  const valid = parseSigned64BigInt(value);
  if (valid === null) {
    throw new RangeError(
      `Financial integer value "${String(value)}" is outside the valid signed 64-bit range or is an unsafe Number.`
    );
  }
  return valid.toString(10);
}

/**
 * Converts a validated signed 64-bit `BigInt` into a JS `number` ONLY if it lies within
 * `[Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]`. Otherwise returns `null` so
 * backward-compatible numeric JSON fields never silently expose rounded IEEE-754 values.
 */
export function toSafeNumberOrNull(value: bigint): number | null {
  if (value < MIN_SAFE_INTEGER_BIGINT || value > MAX_SAFE_INTEGER_BIGINT) {
    return null;
  }
  return Number(value);
}

/**
 * Formats an unsigned BigInt string with US thousands separators using pure string manipulation.
 */
function addThousandsSeparators(unsignedDigits: string): string {
  return unsignedDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats a signed 64-bit integer (e.g., raw microshare count) with thousands separators using pure BigInt/string manipulation.
 */
export function formatSignedIntegerWithCommas(
  value: bigint | number | string | null | undefined
): string {
  const big = parseSigned64BigInt(value);
  if (big === null) return '0';
  const isNeg = big < 0n;
  const abs = isNeg ? -big : big;
  return `${isNeg ? '-' : ''}${addThousandsSeparators(abs.toString(10))}`;
}

/**
 * Formats an integer cents value (`bigint | number | string`) into a human-readable currency string
 * (e.g. `125400n` -> `"$1,254.00"`, `-4505n` -> `"-$45.05"`, `9223372036854775807n` -> `"$92,233,720,368,547,758.07"`).
 * Uses pure `BigInt` division and modulo with zero `Number` conversion.
 */
export function formatCents(
  cents: bigint | number | string | null | undefined,
  currencySymbol = '$'
): string {
  const bigCents = parseSigned64BigInt(cents);
  if (bigCents === null) return `${currencySymbol}0.00`;

  const isNegative = bigCents < 0n;
  const absCents = isNegative ? -bigCents : bigCents;
  const wholeDollars = absCents / 100n;
  const remainderCents = absCents % 100n;

  const formattedDollars = addThousandsSeparators(wholeDollars.toString(10));
  const formattedCents = remainderCents.toString(10).padStart(2, '0');
  return `${isNegative ? '-' : ''}${currencySymbol}${formattedDollars}.${formattedCents}`;
}

export const formatCentsDecimal = formatCents;


/**
 * Parses a user-entered dollar string (e.g. `"125.50"`, `"$1,250.99"`, `"-45.05"`,
 * `"92233720368547758.07"`, `"-92233720368547758.08"`) into an exact signed 64-bit `BigInt` in cents.
 * Returns `null` if malformed or outside signed 64-bit integer bounds.
 */
export function parseDollarsToCentsBigInt(input: string): bigint | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/[$€£,\s]/g, '');
  if (!cleaned) return null;

  const isNegative = cleaned.startsWith('-');
  const unsigned = isNegative || cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  if (!/^\d+(\.\d{0,2})?$/.test(unsigned)) {
    return null;
  }

  const [dollarsPart, centsPart = ''] = unsigned.split('.');
  const normalizedCentsStr = (centsPart + '00').slice(0, 2);

  try {
    const dollarsBig = BigInt(dollarsPart || '0');
    const centsBig = BigInt(normalizedCentsStr);
    const unsignedTotal = dollarsBig * 100n + centsBig;
    const signedTotal = isNegative ? -unsignedTotal : unsignedTotal;
    return isValidSigned64BigInt(signedTotal) ? signedTotal : null;
  } catch {
    return null;
  }
}

/**
 * Parses a user-entered dollar string directly into a validated signed 64-bit decimal string of cents
 * for JSON API transport.
 */
export function parseDollarsToCentsDecimalString(input: string): string | null {
  const big = parseDollarsToCentsBigInt(input);
  return big !== null ? big.toString(10) : null;
}

/**
 * Parses a user-entered dollar string into a safe JS `number` in cents.
 * Returns `null` if the resulting cents value exceeds `Number.MAX_SAFE_INTEGER` or is below `Number.MIN_SAFE_INTEGER`,
 * preventing silent precision loss. Use `parseDollarsToCentsBigInt` for full 64-bit values.
 */
export function parseDollarsToCents(input: string): number | null {
  const big = parseDollarsToCentsBigInt(input);
  if (big === null) return null;
  return toSafeNumberOrNull(big);
}

/**
 * Formats integer microshares (`1 share = 1,000,000 microshares`) into a readable fractional share string
 * using pure `BigInt` arithmetic.
 */
export function formatMicroshares(
  microshares: bigint | number | string | null | undefined,
  trimTrailingZeros = false
): string {
  const bigMicro = parseSigned64BigInt(microshares);
  if (bigMicro === null) return trimTrailingZeros ? '0' : '0.000000';

  const isNegative = bigMicro < 0n;
  const absMicro = isNegative ? -bigMicro : bigMicro;
  const wholeShares = absMicro / MICROSHARES_SCALE_BIGINT;
  const fractionalMicro = absMicro % MICROSHARES_SCALE_BIGINT;

  const formattedWhole = addThousandsSeparators(wholeShares.toString(10));
  const fracStr = fractionalMicro.toString(10).padStart(6, '0');

  if (trimTrailingZeros) {
    const trimmed = fracStr.replace(/0+$/, '');
    return `${isNegative ? '-' : ''}${formattedWhole}${trimmed ? `.${trimmed}` : ''}`;
  }
  return `${isNegative ? '-' : ''}${formattedWhole}.${fracStr}`;
}

/**
 * Parses a decimal share string (e.g. `"15.5"`, `"0.000125"`, `"9223372036854.775807"`)
 * into an exact signed 64-bit `BigInt` of microshares (`10^6` scale).
 */
export function parseSharesToMicrosharesBigInt(input: string): bigint | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/,/g, '');
  if (!cleaned) return null;

  const isNegative = cleaned.startsWith('-');
  const unsigned = isNegative || cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  if (!/^\d+(\.\d{0,6})?$/.test(unsigned)) {
    return null;
  }

  const [wholePart, fracPart = ''] = unsigned.split('.');
  const normalizedFrac = (fracPart + '000000').slice(0, 6);

  try {
    const wholeBig = BigInt(wholePart || '0');
    const fracBig = BigInt(normalizedFrac);
    const unsignedTotal = wholeBig * MICROSHARES_SCALE_BIGINT + fracBig;
    const signedTotal = isNegative ? -unsignedTotal : unsignedTotal;
    return isValidSigned64BigInt(signedTotal) ? signedTotal : null;
  } catch {
    return null;
  }
}

/**
 * Parses a decimal share string directly into a validated signed 64-bit decimal string of microshares.
 */
export function parseSharesToMicrosharesDecimalString(input: string): string | null {
  const big = parseSharesToMicrosharesBigInt(input);
  return big !== null ? big.toString(10) : null;
}

/**
 * Parses a decimal share string into a safe JS `number` of microshares.
 * Returns `null` if outside `[MIN_SAFE_INTEGER, MAX_SAFE_INTEGER]`.
 */
export function parseSharesToMicroshares(input: string): number | null {
  const big = parseSharesToMicrosharesBigInt(input);
  if (big === null) return null;
  return toSafeNumberOrNull(big);
}

/**
 * Formats integer basis points (`100 bps = 1.00%`) into a signed percentage string (e.g. `1031` -> `"+10.31%"`)
 * using pure `BigInt` division and modulo.
 */
export function formatBasisPoints(
  bps: bigint | number | string | null | undefined
): string {
  const bigBps = parseSigned64BigInt(bps);
  if (bigBps === null) return '0.00%';

  const isNegative = bigBps < 0n;
  const isPositive = bigBps > 0n;
  const absBps = isNegative ? -bigBps : bigBps;
  const wholePercent = absBps / 100n;
  const remainderBps = absBps % 100n;

  const prefix = isPositive ? '+' : isNegative ? '-' : '';
  return `${prefix}${addThousandsSeparators(wholePercent.toString(10))}.${remainderBps
    .toString(10)
    .padStart(2, '0')}%`;
}

/**
 * Dynamic Envelope Budget Progress Bar Color Result
 */
export interface DynamicBudgetColorResult {
  hexColor: string;
  gradientStyle: string;
  twTextClass: string;
  twBorderClass: string;
  percentage: number;
  statusLabel: string;
  isWarning: boolean;
  isOverBudget: boolean;
}

/**
 * Dynamically computes visual progress bar color-coding transitioning smoothly from
 * Green (#15803d) -> Yellow (#ca8a04) -> Amber/Orange (#ea580c) -> Red (#dc2626 / #b91c1c)
 * as spending approaches and exceeds defined envelope budget limits.
 *
 * @param spentCents Integer cents spent in category
 * @param allocatedCents Integer cents allocated to category
 * @param alertThresholdPct Threshold percentage for warning alert (default 80%)
 */
export function getDynamicBudgetColor(
  spentCents: bigint | number | string | null | undefined,
  allocatedCents: bigint | number | string | null | undefined,
  alertThresholdPct = 80
): DynamicBudgetColorResult {
  const spentBig = parseSigned64BigInt(spentCents) ?? 0n;
  const allocBig = parseSigned64BigInt(allocatedCents) ?? 0n;

  if (allocBig <= 0n) {
    return {
      hexColor: '#15803d',
      gradientStyle: 'linear-gradient(90deg, #16a34a, #15803d)',
      twTextClass: 'text-emerald-800',
      twBorderClass: 'border-emerald-200',
      percentage: 0,
      statusLabel: 'Within Envelope Limit',
      isWarning: false,
      isOverBudget: false,
    };
  }

  const ratio = Number(spentBig) / Number(allocBig);
  const percentage = Math.round(ratio * 100);
  const isOverBudget = spentBig >= allocBig;
  const isWarning = !isOverBudget && percentage >= alertThresholdPct;

  // Dynamic RGB interpolation across 3 smooth color stops:
  // 0% - 50%: Healthy Green (#15803d / RGB 21, 128, 61)
  // 50% - 75%: Warm Gold (#ca8a04 / RGB 202, 138, 4)
  // 75% - 100%: Bright Alert Red (#dc2626 / RGB 220, 38, 38)
  // > 100%: Deep Over-budget Crimson (#b91c1c / RGB 185, 28, 28)
  let r: number, g: number, b: number;

  if (ratio <= 0.5) {
    r = 21; g = 128; b = 61;
  } else if (ratio <= 0.75) {
    const t = (ratio - 0.5) / 0.25;
    r = Math.round(21 + (202 - 21) * t);
    g = Math.round(128 + (138 - 128) * t);
    b = Math.round(61 + (4 - 61) * t);
  } else if (ratio <= 1.0) {
    const t = (ratio - 0.75) / 0.25;
    r = Math.round(202 + (220 - 202) * t);
    g = Math.round(138 + (38 - 138) * t);
    b = Math.round(4 + (38 - 4) * t);
  } else {
    r = 185; g = 28; b = 28;
  }

  const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  const endR = Math.min(255, r + 25);
  const endHex = `#${endR.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  const gradientStyle = `linear-gradient(90deg, ${hexColor}, ${endHex})`;

  let twTextClass = 'text-emerald-800';
  let twBorderClass = 'border-emerald-200';
  let statusLabel = 'Within Envelope Limit';

  if (isOverBudget) {
    twTextClass = 'text-rose-700 font-bold';
    twBorderClass = 'border-rose-300';
    statusLabel = 'OVER BUDGET (≥100%)';
  } else if (isWarning) {
    twTextClass = 'text-amber-800 font-bold';
    twBorderClass = 'border-amber-300';
    statusLabel = `WARNING THRESHOLD REACHED (≥${alertThresholdPct}%)`;
  } else if (percentage >= 50) {
    twTextClass = 'text-amber-700 font-semibold';
    twBorderClass = 'border-amber-200';
    statusLabel = `Moderate Spending (${percentage}%)`;
  }

  return {
    hexColor,
    gradientStyle,
    twTextClass,
    twBorderClass,
    percentage,
    statusLabel,
    isWarning,
    isOverBudget,
  };
}

/**
 * Exact BigInt half-up investment valuation:
 * `ValuationCents = ((QuantityMicroshares * UnitPriceCents) + 500,000) / 1,000,000`
 */
export function computeInvestmentValuationBigInt(
  quantityMicroshares: bigint | number | string,
  unitPriceCents: bigint | number | string
): bigint {
  const q = parseSigned64BigInt(quantityMicroshares);
  const p = parseSigned64BigInt(unitPriceCents);
  if (q === null || p === null || q <= 0n || p <= 0n) return 0n;
  const valuation = (q * p + 500000n) / MICROSHARES_SCALE_BIGINT;
  if (!isValidSigned64BigInt(valuation)) {
    throw new RangeError('Computed investment valuation exceeds signed 64-bit integer range.');
  }
  return valuation;
}

/**
 * Exact BigInt unrealized gain/loss in basis points (`100 bps = 1.00%`) with half-up rounding:
 * `BasisPoints = ((UnrealizedGainLossCents * 10,000) ± (CostBasisCents / 2)) / CostBasisCents`
 */
export function computeGainLossBasisPointsBigInt(
  unrealizedGainLossCents: bigint | number | string,
  costBasisCents: bigint | number | string
): bigint {
  const gain = parseSigned64BigInt(unrealizedGainLossCents);
  const basis = parseSigned64BigInt(costBasisCents);
  if (gain === null || basis === null || basis <= 0n) return 0n;
  const scaled = gain * 10000n;
  const half = basis / 2n;
  const rounded = scaled >= 0n ? (scaled + half) / basis : (scaled - half) / basis;
  return isValidSigned64BigInt(rounded) ? rounded : 0n;
}

