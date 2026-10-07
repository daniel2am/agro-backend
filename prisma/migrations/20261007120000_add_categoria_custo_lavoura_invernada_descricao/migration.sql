-- AlterTable
ALTER TABLE "public"."Invernada" ADD COLUMN     "descricao" TEXT;

-- AlterTable
ALTER TABLE "public"."Financeiro" ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "custoLavouraId" TEXT;

-- CreateIndex
CREATE INDEX "Financeiro_custoLavouraId_idx" ON "public"."Financeiro"("custoLavouraId");

-- AddForeignKey
ALTER TABLE "public"."Financeiro" ADD CONSTRAINT "Financeiro_custoLavouraId_fkey" FOREIGN KEY ("custoLavouraId") REFERENCES "public"."Lavoura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

