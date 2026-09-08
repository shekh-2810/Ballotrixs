-- Add batch metadata used to group the eight Mister/Miss categories.
-- Columns are intentionally added nullable first so existing databases can
-- be populated safely before the application relies on them.
ALTER TABLE "Category"
ADD COLUMN "batchYear" INTEGER,
ADD COLUMN "gender" TEXT;

CREATE UNIQUE INDEX "Category_batchYear_gender_key"
ON "Category"("batchYear", "gender");
