-- CreateTable
CREATE TABLE "public"."Notificacao" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Medicamento" ADD CONSTRAINT "Medicamento_notificacaoId_fkey" FOREIGN KEY ("notificacaoId") REFERENCES "public"."Notificacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
