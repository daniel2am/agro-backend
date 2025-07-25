/*
  Warnings:

  - You are about to drop the column `dataNascimento` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the column `fotoUrl` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the column `titular` on the `Fazenda` table. All the data in the column will be lost.
  - The `status` column on the `Fazenda` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Invernada` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Lavoura` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `tipo` column on the `Usuario` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[fazendaId,brinco]` on the table `Animal` will be added. If there are existing duplicate values, this will fail.
  - Made the column `brinco` on table `Animal` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `papel` on the `FazendaUsuario` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "StatusFazenda" AS ENUM ('ativa', 'inativa');

-- CreateEnum
CREATE TYPE "StatusInvernada" AS ENUM ('disponivel', 'ocupada', 'inativa');

-- CreateEnum
CREATE TYPE "StatusLavoura" AS ENUM ('ativo', 'inativo');

-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('usuario', 'administrador', 'gestor');

-- CreateEnum
CREATE TYPE "TipoDispositivo" AS ENUM ('bastao', 'balanca', 'antena', 'outro');

-- CreateEnum
CREATE TYPE "TipoLeituraDispositivo" AS ENUM ('brinco', 'peso', 'antena', 'outro');

-- CreateEnum
CREATE TYPE "PapelUsuarioFazenda" AS ENUM ('administrador', 'gestor', 'colaborador');

-- CreateEnum
CREATE TYPE "TipoFinanceiro" AS ENUM ('receita', 'despesa');

-- DropIndex
DROP INDEX "Animal_brinco_key";

-- AlterTable
ALTER TABLE "Animal" DROP COLUMN "dataNascimento",
DROP COLUMN "fotoUrl",
DROP COLUMN "status",
ADD COLUMN     "nascimento" TIMESTAMP(3),
ALTER COLUMN "nome" DROP NOT NULL,
ALTER COLUMN "brinco" SET NOT NULL,
ALTER COLUMN "sexo" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Fazenda" DROP COLUMN "titular",
DROP COLUMN "status",
ADD COLUMN     "status" "StatusFazenda" NOT NULL DEFAULT 'ativa';

-- AlterTable
ALTER TABLE "FazendaUsuario" DROP COLUMN "papel",
ADD COLUMN     "papel" "PapelUsuarioFazenda" NOT NULL;

-- AlterTable
ALTER TABLE "Invernada" DROP COLUMN "status",
ADD COLUMN     "status" "StatusInvernada" NOT NULL DEFAULT 'disponivel';

-- AlterTable
ALTER TABLE "Lavoura" DROP COLUMN "status",
ADD COLUMN     "status" "StatusLavoura" NOT NULL DEFAULT 'ativo';

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoUsuario" NOT NULL DEFAULT 'usuario';

-- CreateTable
CREATE TABLE "MarcaModeloDispositivo" (
    "id" TEXT NOT NULL,
    "fabricante" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "tipo" "TipoDispositivo" NOT NULL,
    "protocolo" TEXT,
    "infoExtra" TEXT,

    CONSTRAINT "MarcaModeloDispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispositivo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "usuarioId" TEXT,
    "fazendaId" TEXT,
    "marcaModeloId" TEXT NOT NULL,
    "numeroSerie" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeituraDispositivo" (
    "id" TEXT NOT NULL,
    "animalId" TEXT,
    "dispositivoId" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "invernadaId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoLeituraDispositivo" NOT NULL,
    "valor" TEXT NOT NULL,
    "dataLeitura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadados" JSONB,

    CONSTRAINT "LeituraDispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sanidade" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sanidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Financeiro" (
    "id" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "tipo" "TipoFinanceiro" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Financeiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Animal_fazendaId_brinco_key" ON "Animal"("fazendaId", "brinco");

-- AddForeignKey
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_marcaModeloId_fkey" FOREIGN KEY ("marcaModeloId") REFERENCES "MarcaModeloDispositivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeituraDispositivo" ADD CONSTRAINT "LeituraDispositivo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeituraDispositivo" ADD CONSTRAINT "LeituraDispositivo_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "Dispositivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeituraDispositivo" ADD CONSTRAINT "LeituraDispositivo_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeituraDispositivo" ADD CONSTRAINT "LeituraDispositivo_invernadaId_fkey" FOREIGN KEY ("invernadaId") REFERENCES "Invernada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeituraDispositivo" ADD CONSTRAINT "LeituraDispositivo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sanidade" ADD CONSTRAINT "Sanidade_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Financeiro" ADD CONSTRAINT "Financeiro_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
