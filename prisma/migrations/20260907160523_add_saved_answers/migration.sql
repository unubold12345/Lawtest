-- CreateTable
CREATE TABLE "SavedAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answer" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SavedAnswer_questionId_idx" ON "SavedAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedAnswer_userId_questionId_key" ON "SavedAnswer"("userId", "questionId");
