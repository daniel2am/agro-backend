-- CreateTable
CREATE TABLE "public"."Chuva" (
    "id" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "mm" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chuva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chuva_fazendaId_data_idx" ON "public"."Chuva"("fazendaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Chuva_fazendaId_data_key" ON "public"."Chuva"("fazendaId", "data");

-- AddForeignKey
ALTER TABLE "public"."Chuva" ADD CONSTRAINT "Chuva_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

