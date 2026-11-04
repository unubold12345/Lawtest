import { prisma } from "./prisma";
import type { AccessScope } from "./access";

// Always read live grants on the server. Session/localStorage flags are UI hints.
export async function userAccessScope(userId: string): Promise<AccessScope> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, paidAt: true, entitlements: { select: { editionId: true } } },
  });
  return user ? { role: user.role, paidAt: user.paidAt, editionIds: user.entitlements.map((e) => e.editionId) } : {};
}
