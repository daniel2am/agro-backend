-- CreateTable
CREATE TABLE "public"."WhatsappVinculo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "telefoneExibicao" TEXT NOT NULL,
    "fazendaPadraoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WhatsappCodigo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappCodigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WhatsappPendente" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "comando" JSONB NOT NULL,
    "resumo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappPendente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WhatsappMensagem" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappVinculo_usuarioId_key" ON "public"."WhatsappVinculo"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappVinculo_telefone_key" ON "public"."WhatsappVinculo"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCodigo_codigo_key" ON "public"."WhatsappCodigo"("codigo");

-- CreateIndex
CREATE INDEX "WhatsappCodigo_usuarioId_idx" ON "public"."WhatsappCodigo"("usuarioId");

-- CreateIndex
CREATE INDEX "WhatsappPendente_telefone_criadoEm_idx" ON "public"."WhatsappPendente"("telefone", "criadoEm");

-- CreateIndex
CREATE INDEX "WhatsappMensagem_telefone_recebidoEm_idx" ON "public"."WhatsappMensagem"("telefone", "recebidoEm");

-- CreateIndex
CREATE INDEX "WhatsappMensagem_recebidoEm_idx" ON "public"."WhatsappMensagem"("recebidoEm");

-- AddForeignKey
ALTER TABLE "public"."WhatsappVinculo" ADD CONSTRAINT "WhatsappVinculo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WhatsappCodigo" ADD CONSTRAINT "WhatsappCodigo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WhatsappPendente" ADD CONSTRAINT "WhatsappPendente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

