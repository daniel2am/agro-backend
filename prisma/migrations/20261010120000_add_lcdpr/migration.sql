-- AlterTable
ALTER TABLE "public"."Financeiro" ADD COLUMN     "contaBancariaId" TEXT,
ADD COLUMN     "contraparteDoc" TEXT,
ADD COLUMN     "contraparteNome" TEXT,
ADD COLUMN     "documentoNumero" TEXT,
ADD COLUMN     "documentoTipo" INTEGER;

-- CreateTable
CREATE TABLE "public"."ContribuinteRural" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "codMunicipio" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT NOT NULL,
    "contadorNome" TEXT,
    "contadorDoc" TEXT,
    "contadorCrc" TEXT,
    "contadorEmail" TEXT,
    "contadorFone" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContribuinteRural_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImovelRural" (
    "id" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "codItr" TEXT,
    "caepf" TEXT,
    "inscricaoEstadual" TEXT,
    "endereco" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "codMunicipio" TEXT NOT NULL,
    "tipoExploracao" INTEGER NOT NULL DEFAULT 1,
    "participacaoPct" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImovelRural_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContraparteImovel" (
    "id" TEXT NOT NULL,
    "imovelId" TEXT NOT NULL,
    "tipo" INTEGER NOT NULL,
    "documento" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "percentual" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ContraparteImovel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContaBancaria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "nomeBanco" TEXT NOT NULL,
    "agencia" TEXT NOT NULL,
    "numeroConta" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContribuinteRural_usuarioId_key" ON "public"."ContribuinteRural"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ImovelRural_fazendaId_key" ON "public"."ImovelRural"("fazendaId");

-- CreateIndex
CREATE INDEX "ContraparteImovel_imovelId_idx" ON "public"."ContraparteImovel"("imovelId");

-- CreateIndex
CREATE INDEX "ContaBancaria_usuarioId_idx" ON "public"."ContaBancaria"("usuarioId");

-- CreateIndex
CREATE INDEX "Financeiro_contaBancariaId_idx" ON "public"."Financeiro"("contaBancariaId");

-- AddForeignKey
ALTER TABLE "public"."Financeiro" ADD CONSTRAINT "Financeiro_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "public"."ContaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContribuinteRural" ADD CONSTRAINT "ContribuinteRural_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImovelRural" ADD CONSTRAINT "ImovelRural_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContraparteImovel" ADD CONSTRAINT "ContraparteImovel_imovelId_fkey" FOREIGN KEY ("imovelId") REFERENCES "public"."ImovelRural"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContaBancaria" ADD CONSTRAINT "ContaBancaria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

