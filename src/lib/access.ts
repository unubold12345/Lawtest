// Paid plan access rules (single source of truth, client + server safe).
export const FREE_CATEGORY = "1. Нийтийн эрх зүй";
export const PLAN_PRICE = 39900;

export function isFreeCategory(category: string | null | undefined): boolean {
  return (category || "") === FREE_CATEGORY;
}

export function hasFullAccess(opts: { role?: string | null; paidAt?: Date | string | null; hasPaid?: boolean | null }): boolean {
  if (opts.role === "ADMIN") return true;
  if (opts.hasPaid === true) return true;
  return !!opts.paidAt;
}

export function canAccessCategory(category: string | null | undefined, opts: { role?: string | null; paidAt?: Date | string | null; hasPaid?: boolean | null }): boolean {
  if (isFreeCategory(category)) return true;
  return hasFullAccess(opts);
}
