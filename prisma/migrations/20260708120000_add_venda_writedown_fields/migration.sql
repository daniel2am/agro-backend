-- CreateEnum
CREATE TYPE "public"."StatusAnimal" AS ENUM ('ativo', 'vendido', 'morto');

-- AlterTable
ALTER TABLE "public"."Animal" ADD COLUMN     "status" "public"."StatusAnimal" NOT NULL DEFAULT 'ativo',
ADD COLUMN     "dataSaida" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Financeiro" ADD COLUMN     "animalId" TEXT,
ADD COLUMN     "lavouraId" TEXT,
ADD COLUMN     "areaVendidaHa" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Animal_status_idx" ON "public"."Animal"("status");

-- CreateIndex
CREATE INDEX "Financeiro_animalId_idx" ON "public"."Financeiro"("animalId");

-- CreateIndex
CREATE INDEX "Financeiro_lavouraId_idx" ON "public"."Financeiro"("lavouraId");

-- AddForeignKey
ALTER TABLE "public"."Financeiro" ADD CONSTRAINT "Financeiro_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Financeiro" ADD CONSTRAINT "Financeiro_lavouraId_fkey" FOREIGN KEY ("lavouraId") REFERENCES "public"."Lavoura"("id") ON DELETE SET NULL ON UPDATE CASCADE;
