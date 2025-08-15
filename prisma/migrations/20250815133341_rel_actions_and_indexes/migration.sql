-- DropForeignKey
ALTER TABLE "public"."Animal" DROP CONSTRAINT "Animal_fazendaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CompraInsumo" DROP CONSTRAINT "CompraInsumo_fazendaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CompraInsumo" DROP CONSTRAINT "CompraInsumo_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Dispositivo" DROP CONSTRAINT "Dispositivo_marcaModeloId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FazendaUsuario" DROP CONSTRAINT "FazendaUsuario_fazendaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FazendaUsuario" DROP CONSTRAINT "FazendaUsuario_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Financeiro" DROP CONSTRAINT "Financeiro_fazendaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Invernada" DROP CONSTRAINT "Invernada_fazendaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Lavoura" DROP CONSTRAINT "Lavoura_fazendaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LeituraDispositivo" DROP CONSTRAINT "LeituraDispositivo_dispositivoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LeituraDispositivo" DROP CONSTRAINT "LeituraDispositivo_fazendaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LeituraDispositivo" DROP CONSTRAINT "LeituraDispositivo_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LogAcesso" DROP CONSTRAINT "LogAcesso_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Manejo" DROP CONSTRAINT "Manejo_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Manejo" DROP CONSTRAINT "Manejo_fazendaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Medicamento" DROP CONSTRAINT "Medicamento_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Ocorrencia" DROP CONSTRAINT "Ocorrencia_fazendaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Pesagem" DROP CONSTRAINT "Pesagem_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Pesagem" DROP CONSTRAINT "Pesagem_fazendaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Sanidade" DROP CONSTRAINT "Sanidade_animalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TitularFazenda" DROP CONSTRAINT "TitularFazenda_fazendaId_fkey";

-- CreateIndex
CREATE INDEX "Animal_fazendaId_idx" ON "public"."Animal"("fazendaId");

-- CreateIndex
CREATE INDEX "Animal_invernadaId_idx" ON "public"."Animal"("invernadaId");

-- CreateIndex
CREATE INDEX "CompraInsumo_fazendaId_data_idx" ON "public"."CompraInsumo"("fazendaId", "data");

-- CreateIndex
CREATE INDEX "CompraInsumo_usuarioId_data_idx" ON "public"."CompraInsumo"("usuarioId", "data");

-- CreateIndex
CREATE INDEX "Dispositivo_usuarioId_idx" ON "public"."Dispositivo"("usuarioId");

-- CreateIndex
CREATE INDEX "Dispositivo_fazendaId_idx" ON "public"."Dispositivo"("fazendaId");

-- CreateIndex
CREATE INDEX "Fazenda_id_criadoEm_idx" ON "public"."Fazenda"("id", "criadoEm");

-- CreateIndex
CREATE INDEX "FazendaUsuario_usuarioId_fazendaId_idx" ON "public"."FazendaUsuario"("usuarioId", "fazendaId");

-- CreateIndex
CREATE INDEX "Financeiro_fazendaId_data_idx" ON "public"."Financeiro"("fazendaId", "data");

-- CreateIndex
CREATE INDEX "Financeiro_tipo_idx" ON "public"."Financeiro"("tipo");

-- CreateIndex
CREATE INDEX "Invernada_fazendaId_nome_idx" ON "public"."Invernada"("fazendaId", "nome");

-- CreateIndex
CREATE INDEX "Lavoura_fazendaId_dataPlantio_idx" ON "public"."Lavoura"("fazendaId", "dataPlantio");

-- CreateIndex
CREATE INDEX "LeituraDispositivo_fazendaId_dataLeitura_idx" ON "public"."LeituraDispositivo"("fazendaId", "dataLeitura");

-- CreateIndex
CREATE INDEX "LeituraDispositivo_animalId_dataLeitura_idx" ON "public"."LeituraDispositivo"("animalId", "dataLeitura");

-- CreateIndex
CREATE INDEX "LogAcesso_usuarioId_data_idx" ON "public"."LogAcesso"("usuarioId", "data");

-- CreateIndex
CREATE INDEX "Manejo_fazendaId_data_idx" ON "public"."Manejo"("fazendaId", "data");

-- CreateIndex
CREATE INDEX "Manejo_animalId_data_idx" ON "public"."Manejo"("animalId", "data");

-- CreateIndex
CREATE INDEX "Medicamento_animalId_data_idx" ON "public"."Medicamento"("animalId", "data");

-- CreateIndex
CREATE INDEX "Medicamento_proximaAplicacao_idx" ON "public"."Medicamento"("proximaAplicacao");

-- CreateIndex
CREATE INDEX "Ocorrencia_fazendaId_data_idx" ON "public"."Ocorrencia"("fazendaId", "data");

-- CreateIndex
CREATE INDEX "Pesagem_animalId_data_idx" ON "public"."Pesagem"("animalId", "data");

-- CreateIndex
CREATE INDEX "Pesagem_fazendaId_data_idx" ON "public"."Pesagem"("fazendaId", "data");

-- CreateIndex
CREATE INDEX "Sanidade_animalId_data_idx" ON "public"."Sanidade"("animalId", "data");

-- CreateIndex
CREATE INDEX "Usuario_status_idx" ON "public"."Usuario"("status");

-- AddForeignKey
ALTER TABLE "public"."TitularFazenda" ADD CONSTRAINT "TitularFazenda_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FazendaUsuario" ADD CONSTRAINT "FazendaUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FazendaUsuario" ADD CONSTRAINT "FazendaUsuario_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Animal" ADD CONSTRAINT "Animal_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invernada" ADD CONSTRAINT "Invernada_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lavoura" ADD CONSTRAINT "Lavoura_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dispositivo" ADD CONSTRAINT "Dispositivo_marcaModeloId_fkey" FOREIGN KEY ("marcaModeloId") REFERENCES "public"."MarcaModeloDispositivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeituraDispositivo" ADD CONSTRAINT "LeituraDispositivo_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "public"."Dispositivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeituraDispositivo" ADD CONSTRAINT "LeituraDispositivo_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeituraDispositivo" ADD CONSTRAINT "LeituraDispositivo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LogAcesso" ADD CONSTRAINT "LogAcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sanidade" ADD CONSTRAINT "Sanidade_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Financeiro" ADD CONSTRAINT "Financeiro_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Medicamento" ADD CONSTRAINT "Medicamento_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Manejo" ADD CONSTRAINT "Manejo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Manejo" ADD CONSTRAINT "Manejo_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pesagem" ADD CONSTRAINT "Pesagem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "public"."Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pesagem" ADD CONSTRAINT "Pesagem_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ocorrencia" ADD CONSTRAINT "Ocorrencia_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompraInsumo" ADD CONSTRAINT "CompraInsumo_fazendaId_fkey" FOREIGN KEY ("fazendaId") REFERENCES "public"."Fazenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompraInsumo" ADD CONSTRAINT "CompraInsumo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
