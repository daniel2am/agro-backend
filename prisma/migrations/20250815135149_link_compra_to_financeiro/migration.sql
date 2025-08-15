/*
  Warnings:

  - A unique constraint covering the columns `[compraInsumoId]` on the table `Financeiro` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Financeiro" ADD COLUMN     "compraInsumoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Financeiro_compraInsumoId_key" ON "public"."Financeiro"("compraInsumoId");

-- AddForeignKey
ALTER TABLE "public"."Financeiro" ADD CONSTRAINT "Financeiro_compraInsumoId_fkey" FOREIGN KEY ("compraInsumoId") REFERENCES "public"."CompraInsumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
