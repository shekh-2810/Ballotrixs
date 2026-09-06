/*
  Warnings:

  - You are about to drop the column `phase` on the `PollConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PollConfig" DROP COLUMN "phase",
ADD COLUMN     "votingOpen" BOOLEAN NOT NULL DEFAULT false;
