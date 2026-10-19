import { revalidatePath } from "next/cache";

// Pages whose prerendered question index / pool split must be refreshed after
// an admin edits an answer or a category fix (the only writers are the two
// /api/admin routes below). Keeps their time-based revalidate window long so
// ISR writes stay low on Vercel's Hobby plan.
const CATALOG_PAGES = ["/browse", "/browse/unanswered", "/quiz", "/v2"];

export function revalidateCatalogPages(): void {
  for (const page of CATALOG_PAGES) {
    try {
      revalidatePath(page);
    } catch {
      // outside a request scope (e.g. build) — nothing to invalidate
    }
  }
}
