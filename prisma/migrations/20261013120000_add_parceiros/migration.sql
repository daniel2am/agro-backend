-- CreateTable
CREATE TABLE "public"."Parceiro" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParceiroMembro" (
    "id" TEXT NOT NULL,
    "parceiroId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'representante',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParceiroMembro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConviteParceiro" (
    "id" TEXT NOT NULL,
    "parceiroId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nota" TEXT,
    "plano" "public"."PlanoTipo" NOT NULL DEFAULT 'basico',
    "mesesPlano" INTEGER NOT NULL DEFAULT 0,
    "escopos" TEXT[],
    "usosMax" INTEGER NOT NULL DEFAULT 1,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "validoAte" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConviteParceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VinculoParceiro" (
    "id" TEXT NOT NULL,
    "parceiroId" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conviteId" TEXT,
    "escopos" TEXT[],
    "planoConcedido" "public"."PlanoTipo",
    "planoAteEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadoEm" TIMESTAMP(3),

    CONSTRAINT "VinculoParceiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParceiroMembro_usuarioId_idx" ON "public"."ParceiroMembro"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ParceiroMembro_parceiroId_usuarioId_key" ON "public"."ParceiroMembro"("parceiroId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ConviteParceiro_codigo_key" ON "public"."ConviteParceiro"("codigo");

-- CreateIndex
CREATE INDEX "ConviteParceiro_parceiroId_idx" ON "public"."ConviteParceiro"("parceiroId");

-- CreateIndex
CREATE INDEX "VinculoParceiro_parceiroId_revogadoEm_idx" ON "public"."VinculoParceiro"("parceiroId", "revogadoEm");

-- CreateIndex
CREATE INDEX "VinculoParceiro_usuarioId_idx" ON "public"."VinculoParceiro"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoParceiro_parceiroId_fazendaId_key" ON "public"."VinculoParceiro"("parceiroId", "fazendaId");

-- AddForeignKey
ALTER TABLE "public"."ParceiroMembro" ADD CONSTRAINT "ParceiroMembro_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "public"."Parceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParceiroMembro" ADD CONSTRAINT "ParceiroMembro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConviteParceiro" ADD CONSTRAINT "ConviteParceiro_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "public"."Parceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VinculoParceiro" ADD CONSTRAINT "VinculoParceiro_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "public"."Parceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VinculoParceiro" ADD CONSTRAINT "VinculoParceiro_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VinculoParceiro" ADD CONSTRAINT "VinculoParceiro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VinculoParceiro" ADD CONSTRAINT "VinculoParceiro_conviteId_fkey" FOREIGN KEY ("conviteId") REFERENCES "public"."ConviteParceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

