import { notFound } from "next/navigation";
import { getPlan, getEdition, LEGACY_EDITION_ID } from "@/lib/catalog";
import { hasEditionAccess } from "@/lib/access";
import { userAccessScope } from "@/lib/entitlements";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadQuestions } from "@/lib/questions";
import PlanCheckoutContent from "@/components/PlanCheckoutContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Эрх авах",
  description: "Сонгосон шалгалт, оны хувилбарын бүтэн эрх авах",
};



export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const plan = getPlan(planId);
  if (!plan) notFound();
  const edition = getEdition(plan.editionId);
  if (!edition) notFound();
  const freeCount = edition.id === LEGACY_EDITION_ID ? loadQuestions().questions.filter((q) => q.category && edition.freeCategories.includes(q.category)).length : null;
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string })?.id;
  let hasPaid = false;
  let pendingRequest = false;
  if (userId) {
    try {
      hasPaid = hasEditionAccess(edition.id, await userAccessScope(userId));
      if (!hasPaid) {
        const req = await prisma.paymentRequest.findFirst({
          where: { userId, editionId: edition.id, status: "PENDING" },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        pendingRequest = !!req;
      }
    } catch {}
  }
  return <PlanCheckoutContent plan={plan} edition={edition} freeCount={freeCount} authed={!!userId} hasPaid={hasPaid} pendingRequest={pendingRequest} />;
}
