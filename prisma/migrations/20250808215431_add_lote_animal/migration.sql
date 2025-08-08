/*
  Warnings:

  - You are about to drop the column `Lote` on the `Animal` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Animal" DROP COLUMN "Lote",
ADD COLUMN     "lote" TEXT;
