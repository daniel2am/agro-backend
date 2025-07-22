-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "tipo" TEXT NOT NULL DEFAULT 'usuario',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ultimoLogin" TIMESTAMP(3),
    "googleId" TEXT,
    "appleId" TEXT,
    "resetToken" VARCHAR(255),
    "resetTokenExpires" TIMESTAMP(3),
    "termosAceitosEm" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fazenda" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "cadastroIncra" TEXT NOT NULL,
    "car" TEXT,
    "titular" TEXT,
    "areaTotal" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fazenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FazendaUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fazendaId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FazendaUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAcesso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acao" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "LogAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invernada" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "areaHa" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disponivel',
    "fazendaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invernada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lavoura" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cultura" TEXT NOT NULL,
    "areaHa" DOUBLE PRECISION NOT NULL,
    "dataPlantio" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "fazendaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lavoura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_googleId_key" ON "Usuario"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_appleId_key" ON "Usuario"("appleId");

-- CreateIndex
CREATE UNIQUE INDEX "Fazenda_cadastroIncra_key" ON "Fazenda"("cadastroIncra");

-- AddForeignKey
ALTER TABLE "FazendaUsuario" ADD CONSTRAINT "FazendaUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FazendaUsuario" ADD CONSTRAINT "FazendaUsuario_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAcesso" ADD CONSTRAINT "LogAcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invernada" ADD CONSTRAINT "Invernada_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lavoura" ADD CONSTRAINT "Lavoura_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "Fazenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
