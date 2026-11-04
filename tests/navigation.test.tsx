import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionProvider } from "next-auth/react";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import Header from "../src/components/Header";

function header(pathname: string, role?: string) {
  const session = role ? { expires: "2099-01-01T00:00:00.000Z", user: { name: "Member", role } } : null;
  return renderToStaticMarkup(<SessionProvider session={session}><PathnameContext.Provider value={pathname}><Header /></PathnameContext.Provider></SessionProvider>);
}

test("the global header stays identical across home and exam editions", () => {
  for (const role of [undefined, "USER", "ADMIN"]) {
    const home = header("/", role);
    assert.equal(header("/exams/lawyer/2026", role), home);
    assert.equal(header("/exams/another/2027", role), home);
    assert.ok(!home.includes("<nav"));
    assert.ok(!home.includes('href="/exams"'));
    assert.ok(!home.includes("Төлөвлөгөө"));
  }
});

test("Admin appears only in the administrator's account dropdown", () => {
  assert.ok(!header("/", "USER").includes('href="/admin"'));
  assert.ok(!header("/").includes('href="/admin"'));
  const admin = header("/exams/lawyer/2026", "ADMIN");
  const dropdown = admin.slice(admin.indexOf('id="profile-dropdown"'));
  assert.ok(dropdown.includes('href="/admin"'));
  assert.ok(dropdown.includes('data-plan-modal="true"'));
});
