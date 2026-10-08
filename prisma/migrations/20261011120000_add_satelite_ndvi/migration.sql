-- AlterTable
ALTER TABLE "public"."Lavoura" ADD COLUMN     "poligono" JSONB;

-- CreateTable
CREATE TABLE "public"."NdviMedicao" (
    "id" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "alvoTipo" TEXT NOT NULL,
    "alvoId" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "media" DOUBLE PRECISION,
    "minimo" DOUBLE PRECISION,
    "maximo" DOUBLE PRECISION,
    "desvio" DOUBLE PRECISION,
    "cobertura" DOUBLE PRECISION NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NdviMedicao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NdviMedicao_fazendaId_alvoTipo_alvoId_inicio_idx" ON "public"."NdviMedicao"("fazendaId", "alvoTipo", "alvoId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "NdviMedicao_alvoTipo_alvoId_inicio_key" ON "public"."NdviMedicao"("alvoTipo", "alvoId", "inicio");

-- AddForeignKey
ALTER TABLE "public"."NdviMedicao" ADD CONSTRAINT "NdviMedicao_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

