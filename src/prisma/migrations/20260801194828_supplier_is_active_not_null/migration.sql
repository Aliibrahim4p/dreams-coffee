/*
  Warnings:

  - Made the column `is_active` on table `supplier` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill existing NULLs before enforcing NOT NULL (null was previously treated as active).
UPDATE "supplier" SET "is_active" = true WHERE "is_active" IS NULL;

-- AlterTable
ALTER TABLE "supplier" ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "is_active" SET DEFAULT true;
