-- CreateTable
CREATE TABLE "Manejo" (
    "id" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Manejo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Manejo" ADD CONSTRAINT "Manejo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manejo" ADD CONSTRAINT "Manejo_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
