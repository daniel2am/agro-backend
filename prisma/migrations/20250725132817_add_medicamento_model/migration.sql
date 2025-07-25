-- CreateTable
CREATE TABLE "Medicamento" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "dosagem" TEXT,
    "viaAplicacao" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medicamento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Medicamento" ADD CONSTRAINT "Medicamento_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
