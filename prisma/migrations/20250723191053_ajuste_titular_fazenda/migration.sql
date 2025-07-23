/*
  Warnings:

  - Made the column `nacionalidade` on table `TitularFazenda` required. This step will fail if there are existing NULL values in that column.
  - Made the column `condicao` on table `TitularFazenda` required. This step will fail if there are existing NULL values in that column.
  - Made the column `percentualDetencao` on table `TitularFazenda` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Fazenda" ADD COLUMN     "titular" TEXT;

-- AlterTable
ALTER TABLE "TitularFazenda" ALTER COLUMN "nacionalidade" SET NOT NULL,
ALTER COLUMN "condicao" SET NOT NULL,
ALTER COLUMN "percentualDetencao" SET NOT NULL;
