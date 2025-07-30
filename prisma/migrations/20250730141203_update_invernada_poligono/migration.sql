/*
  Warnings:

  - You are about to drop the column `areaHa` on the `Invernada` table. All the data in the column will be lost.
  - Added the required column `area` to the `Invernada` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invernada" DROP COLUMN "areaHa",
ADD COLUMN     "area" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "poligono" JSONB;
