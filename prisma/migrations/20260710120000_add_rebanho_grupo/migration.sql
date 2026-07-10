-- CreateTable
CREATE TABLE "public"."Rebanho" (
    "id" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rebanho_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rebanho_fazendaId_idx" ON "public"."Rebanho"("fazendaId");

-- AlterTable
ALTER TABLE "public"."Animal" ADD COLUMN "rebanhoId" TEXT;

-- CreateIndex
CREATE INDEX "Animal_rebanhoId_idx" ON "public"."Animal"("rebanhoId");

-- AddForeignKey
ALTER TABLE "public"."Rebanho" ADD CONSTRAINT "Rebanho_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Animal" ADD CONSTRAINT "Animal_rebanhoId_fkey" FOREIGN KEY ("rebanhoId") REFERENCES "public"."Rebanho"("id") ON DELETE SET NULL ON UPDATE CASCADE;
