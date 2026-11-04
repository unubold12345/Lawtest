import assert from "node:assert/strict";
import test from "node:test";
import { canAccessCategory, hasEditionAccess, hasFullAccess, FREE_CATEGORY } from "../src/lib/access";
import { EXAM_EDITIONS, EXAM_PLANS, LEGACY_EDITION_ID, type ExamEdition } from "../src/lib/catalog";
import { loadQuestions } from "../src/lib/questions";
import nextConfig from "../next.config";

test("existing purchases retain 2026 access, without granting other editions", () => {
  const future: ExamEdition = { ...EXAM_EDITIONS[0], id: "another-exam-2027", year: 2027, freeCategories: [] };
  const editions = EXAM_EDITIONS as ExamEdition[];
  editions.push(future);
  try {
    for (const legacy of [{ paidAt: new Date() }, { hasPaid: true }]) {
      assert.equal(hasFullAccess(legacy), true);
      assert.equal(hasEditionAccess(future.id, legacy), false);
      assert.equal(canAccessCategory(FREE_CATEGORY, legacy, future.id), false);
    }
    assert.equal(hasEditionAccess(future.id, { editionIds: [future.id] }), true);
    assert.equal(hasFullAccess({ editionIds: [future.id] }), false);
    assert.equal(hasEditionAccess(future.id, { role: "ADMIN" }), true);
    assert.equal(hasEditionAccess("missing", { role: "ADMIN" }), false);
    assert.equal(hasFullAccess({ editionIds: [LEGACY_EDITION_ID] }), true);
    assert.equal(hasFullAccess({}), false);
    assert.equal(canAccessCategory(FREE_CATEGORY, {}), true);
    assert.equal(canAccessCategory("paid subject", {}), false);
  } finally { editions.pop(); }
});

test("the whole existing question bank belongs only to lawyer 2026", () => {
  const data = loadQuestions();
  assert.equal(data.errors.length, 0, JSON.stringify(data.errors));
  assert.ok(data.questions.length > 0);
  assert.equal(new Set(data.questions.map((q) => q.id)).size, data.questions.length);
  assert.ok(data.questions.every((q) => q.editionId === LEGACY_EDITION_ID));
  assert.equal(data.sources.reduce((sum, source) => sum + source.count, 0), data.questions.length);
});

test("every published plan targets an existing edition and has its own price", () => {
  assert.equal(new Set(EXAM_PLANS.map((p) => p.id)).size, EXAM_PLANS.length);
  for (const plan of EXAM_PLANS) {
    assert.ok(EXAM_EDITIONS.some((e) => e.id === plan.editionId));
    assert.ok(Number.isInteger(plan.price) && plan.price > 0);
  }
});

test("legacy study and checkout URLs redirect into the new structure", async () => {
  const redirects = await nextConfig.redirects!();
  for (const name of ["browse", "quiz", "v2", "history", "calendar"]) {
    assert.ok(redirects.some((r) => r.source === `/${name}/:path*` && r.destination === `/exams/lawyer/2026/${name}/:path*`));
  }
  assert.ok(redirects.some((r) => r.source === "/plan" && r.destination === "/plans/lawyer-2026-full"));
});
