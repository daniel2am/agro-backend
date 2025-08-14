// src/modules/historico/historico.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

type HistoricoItem = {
  tipo: 'sanidade' | 'medicamento' | 'pesagem' | 'ocorrencia' | 'manejo';
  data: Date;
  descricao: string;
  meta?: {
    ids?: {
      sanidadeId?: string;
      medicamentoId?: string;
      pesagemId?: string;
      ocorrenciaId?: string;
      manejoId?: string;
      animalId?: string;
    };
    sanidade?: { tipo?: string; observacoes?: string | null };
    medicamento?: {
      nome?: string;
      dosagem?: string | null;
      viaAplicacao?: string | null;
      observacoes?: string | null;
      proximaAplicacao?: Date | null;
      lembreteAtivo?: boolean;
    };
    pesagem?: {
      pesoAtual: number;
      pesoAnterior?: number | null;
      dataAnterior?: Date | null;
    };
    ocorrencia?: { titulo?: string; descricao?: string | null; tipo?: string | null };
    manejo?: { tipo?: string; observacao?: string | null };
  };
};

@Injectable()
export class HistoricoService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistoricoAnimal(animalId: string) {
    const animal = await this.prisma.animal.findUnique({ where: { id: animalId } });
    if (!animal) throw new NotFoundException('Animal não encontrado');

    // Carregamentos paralelos
    const [sanidades, medicamentos, pesagensOrdenadas, ocorrencias, manejos] = await Promise.all([
      this.prisma.sanidade.findMany({
        where: { animalId },
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
        select: { id: true, data: true, tipo: true, observacoes: true, criadoEm: true },
      }),
      this.prisma.medicamento.findMany({
        where: { animalId },
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
        select: {
          id: true,
          data: true,
          nome: true,
          dosagem: true,
          viaAplicacao: true,
          observacoes: true,
          proximaAplicacao: true,
          lembreteAtivo: true,
          criadoEm: true,
        },
      }),
      // Pegar TODAS as pesagens do animal em ordem desc para calcular o "anterior" localmente (sem N+1)
      this.prisma.pesagem.findMany({
        where: { animalId },
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
        select: { id: true, data: true, pesoKg: true, criadoEm: true },
      }),
      this.prisma.ocorrencia.findMany({
        where: { animalId },
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
        select: { id: true, data: true, titulo: true, descricao: true, tipo: true, criadoEm: true },
      }),
      this.prisma.manejo.findMany({
        where: { animalId },
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
        select: { id: true, data: true, tipo: true, observacao: true, criadoEm: true },
      }),
    ]);

    // Monta timeline de PESAGENS com “peso anterior” calculado em memória
    const pesagens: HistoricoItem[] = [];
    for (let i = 0; i < pesagensOrdenadas.length; i++) {
      const atual = pesagensOrdenadas[i];
      const anterior = pesagensOrdenadas[i + 1]; // como está desc, o próximo do array é o anterior cronológico
      const data = atual.data ?? atual.criadoEm;
      pesagens.push({
        tipo: 'pesagem',
        data,
        descricao: `Pesagem registrada: ${atual.pesoKg} kg`,
        meta: {
          ids: { pesagemId: atual.id, animalId },
          pesagem: {
            pesoAtual: atual.pesoKg,
            pesoAnterior: anterior?.pesoKg ?? null,
            dataAnterior: (anterior?.data ?? anterior?.criadoEm) ?? null,
          },
        },
      });
    }

    // Demais módulos com descrição legível + meta detalhada
    const itens: HistoricoItem[] = [
      ...sanidades.map<HistoricoItem>((s) => {
        const data = s.data ?? s.criadoEm;
        return {
          tipo: 'sanidade',
          data,
          descricao: `Sanidade: ${s.tipo}`,
          meta: {
            ids: { sanidadeId: s.id, animalId },
            sanidade: { tipo: s.tipo, observacoes: s.observacoes ?? null },
          },
        };
      }),
      ...medicamentos.map<HistoricoItem>((m) => {
        const data = m.data ?? m.criadoEm;
        return {
          tipo: 'medicamento',
          data,
          descricao: `Medicamento: ${m.nome}`,
          meta: {
            ids: { medicamentoId: m.id, animalId },
            medicamento: {
              nome: m.nome,
              dosagem: m.dosagem ?? null,
              viaAplicacao: m.viaAplicacao ?? null,
              observacoes: m.observacoes ?? null,
              proximaAplicacao: m.proximaAplicacao ?? null,
              lembreteAtivo: !!m.lembreteAtivo,
            },
          },
        };
      }),
      ...pesagens,
      ...ocorrencias.map<HistoricoItem>((o) => {
        const data = o.data ?? o.criadoEm;
        return {
          tipo: 'ocorrencia',
          data,
          descricao: `Ocorrência: ${o.titulo}${o.tipo ? ` (${o.tipo})` : ''}`,
          meta: {
            ids: { ocorrenciaId: o.id, animalId },
            ocorrencia: { titulo: o.titulo, descricao: o.descricao ?? null, tipo: o.tipo ?? null },
          },
        };
      }),
      ...manejos.map<HistoricoItem>((m) => {
        const data = m.data ?? m.criadoEm;
        return {
          tipo: 'manejo',
          data,
          descricao: `Manejo: ${m.tipo}`,
          meta: {
            ids: { manejoId: m.id, animalId },
            manejo: { tipo: m.tipo, observacao: m.observacao ?? null },
          },
        };
      }),
    ];

    // Ordena por data desc e retorna
    itens.sort((a, b) => b.data.getTime() - a.data.getTime());

    return {
      animalId,
      historico: itens,
    };
  }
}