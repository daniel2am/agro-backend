-- AlterTable
ALTER TABLE "public"."Medicamento" ADD COLUMN     "lembreteAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificacaoId" TEXT,
ADD COLUMN     "proximaAplicacao" TIMESTAMP(3);
