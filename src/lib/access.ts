import { getEdition, getPlan, LEGACY_EDITION_ID, LEGACY_PLAN_ID } from "./catalog";

// Compatibility fields are deliberately scoped to the original 2026 bank.
export const FREE_CATEGORY = getEdition(LEGACY_EDITION_ID)!.freeCategories[0];
export const PLAN_PRICE = getPlan(LEGACY_PLAN_ID)!.price;

export type AccessScope = {
  role?: string | null;
  paidAt?: Date | string | null;
  hasPaid?: boolean | null;
  editionIds?: readonly string[];
};

export function hasEditionAccess(editionId: string, opts: AccessScope): boolean {
  if (!getEdition(editionId)) return false;
  if (opts.role === "ADMIN") return true;
  if (opts.editionIds?.includes(editionId)) return true;
  return editionId === LEGACY_EDITION_ID && (!!opts.paidAt || opts.hasPaid === true);
}

export function isFreeCategory(category: string | null | undefined): boolean {
  return (category || "") === FREE_CATEGORY;
}

export function hasFullAccess(opts: AccessScope): boolean {
  return hasEditionAccess(LEGACY_EDITION_ID, opts);
}

export function canAccessCategory(category: string | null | undefined, opts: AccessScope, editionId = LEGACY_EDITION_ID): boolean {
  const edition = getEdition(editionId);
  if (!edition) return false;
  if (category && edition.freeCategories.includes(category)) return true;
  return hasEditionAccess(editionId, opts);
}
