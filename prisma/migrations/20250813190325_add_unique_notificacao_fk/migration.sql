/*
  Warnings:

  - You are about to drop the column `externalId` on the `Notificacao` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `Notificacao` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[notificacaoId]` on the table `Medicamento` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mensagem` to the `Notificacao` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titulo` to the `Notificacao` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Notificacao" DROP COLUMN "externalId",
DROP COLUMN "provider",
ADD COLUMN     "lida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mensagem" TEXT NOT NULL,
ADD COLUMN     "titulo" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Medicamento_notificacaoId_key" ON "public"."Medicamento"("notificacaoId");
