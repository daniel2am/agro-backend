/*
  Warnings:

  - You are about to drop the column `titular` on the `Fazenda` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Fazenda" DROP COLUMN "titular";

-- CreateTable
CREATE TABLE "TitularFazenda" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "nacionalidade" TEXT,
    "condicao" TEXT,
    "percentualDetencao" DOUBLE PRECISION,
    "fazendaId" TEXT NOT NULL,

    CONSTRAINT "TitularFazenda_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TitularFazenda" ADD CONSTRAINT "TitularFazenda_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
