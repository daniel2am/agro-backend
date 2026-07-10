-- AlterTable
ALTER TABLE "public"."Lavoura" ADD COLUMN "semente" TEXT;

-- CreateTable
CREATE TABLE "public"."ProcedimentoLavoura" (
    "id" TEXT NOT NULL,
    "lavouraId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "produto" TEXT,
    "quantidade" TEXT,
    "responsavel" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcedimentoLavoura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcedimentoLavoura_lavouraId_data_idx" ON "public"."ProcedimentoLavoura"("lavouraId", "data");

-- AddForeignKey
ALTER TABLE "public"."ProcedimentoLavoura" ADD CONSTRAINT "ProcedimentoLavoura_lavouraId_fkey" FOREIGN KEY ("lavouraId") REFERENCES "public"."Lavoura"("id") ON DELETE CASCADE ON UPDATE CASCADE;
