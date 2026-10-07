-- CreateEnum
CREATE TYPE "public"."PlanoTipo" AS ENUM ('basico', 'intermediario', 'avancado');

-- AlterTable
ALTER TABLE "public"."Usuario" ADD COLUMN     "plano" "public"."PlanoTipo" NOT NULL DEFAULT 'basico',
ADD COLUMN     "planoAteEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."ConviteFazenda" (
    "id" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "papel" "public"."PapelUsuarioFazenda" NOT NULL,
    "convidadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConviteFazenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConviteFazenda_email_idx" ON "public"."ConviteFazenda"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ConviteFazenda_fazendaId_email_key" ON "public"."ConviteFazenda"("fazendaId", "email");

-- AddForeignKey
ALTER TABLE "public"."ConviteFazenda" ADD CONSTRAINT "ConviteFazenda_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConviteFazenda" ADD CONSTRAINT "ConviteFazenda_convidadoPorId_fkey" FOREIGN KEY ("convidadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

