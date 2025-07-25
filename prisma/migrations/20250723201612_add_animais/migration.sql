-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "brinco" TEXT,
    "sexo" TEXT NOT NULL,
    "raca" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "fazendaId" TEXT NOT NULL,
    "invernadaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "fotoUrl" TEXT,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Animal_brinco_key" ON "Animal"("brinco");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_invernadaId_fkey" FOREIGN KEY ("invernadaId") REFERENCES "Invernada"("id") ON DELETE SET NULL ON UPDATE CASCADE;
