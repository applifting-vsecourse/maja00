-- AlterTable
ALTER TABLE "quack" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "parentId" TEXT,
ALTER COLUMN "text" DROP NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "quack_parentId_createdAt_idx" ON "quack"("parentId", "createdAt");

-- AddForeignKey
ALTER TABLE "quack" ADD CONSTRAINT "quack_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "quack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Not modelled by Prisma (see docs/adr/0001-anonymous-tombstones.md).
-- A quack is either live (text + author) or a tombstone (neither), never half.
-- Every existing row has text and an author and no deletedAt, so it passes.
ALTER TABLE "quack" ADD CONSTRAINT "quack_tombstone_check"
  CHECK (("deletedAt" IS NULL) = ("text" IS NOT NULL AND "userId" IS NOT NULL));

-- A quack can't reply to itself.
ALTER TABLE "quack" ADD CONSTRAINT "quack_not_own_parent_check"
  CHECK ("parentId" IS NULL OR "parentId" <> "id");
