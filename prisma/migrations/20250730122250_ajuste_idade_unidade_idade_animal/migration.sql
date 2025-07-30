/*
  Warnings:

  - You are about to drop the column `nascimento` on the `Animal` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UnidadeIdade" AS ENUM ('dias', 'meses', 'anos');

-- AlterTable
ALTER TABLE "Animal" DROP COLUMN "nascimento",
ADD COLUMN     "idade" INTEGER,
ADD COLUMN     "unidadeIdade" "UnidadeIdade";
