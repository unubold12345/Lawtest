-- Additive upgrade: existing purchases, IDs, and progress stay intact.
ALTER TABLE "PaymentRequest"
  ADD COLUMN "planId" TEXT NOT NULL DEFAULT 'lawyer-2026-full',
  ADD COLUMN "editionId" TEXT NOT NULL DEFAULT 'lawyer-2026',
  ADD COLUMN "amount" INTEGER NOT NULL DEFAULT 39900,
  ADD COLUMN "pendingKey" TEXT;

CREATE UNIQUE INDEX "PaymentRequest_pendingKey_key" ON "PaymentRequest"("pendingKey");
CREATE INDEX "PaymentRequest_editionId_status_idx" ON "PaymentRequest"("editionId", "status");

CREATE TABLE "ExamEntitlement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamEntitlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExamEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExamEntitlement_userId_editionId_key" ON "ExamEntitlement"("userId", "editionId");
CREATE INDEX "ExamEntitlement_editionId_idx" ON "ExamEntitlement"("editionId");

-- Preserve all paid members; their historical plan belongs only to lawyer 2026.
INSERT INTO "ExamEntitlement" ("id", "userId", "editionId", "planId", "grantedAt")
SELECT 'legacy-2026-' || "id", "id", 'lawyer-2026', 'lawyer-2026-full', "paidAt"
FROM "User" WHERE "paidAt" IS NOT NULL;
