import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class HistoricoService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistoricoAnimal(animalId: string) {
    const animal = await this.prisma.animal.findUnique({ where: { id: animalId } });
    if (!animal) throw new NotFoundException('Animal não encontrado');

    const [sanidade, medicamentos, pesagens, ocorrencias, manejos] = await Promise.all([
      this.prisma.sanidade.findMany({
        where: { animalId },
        select: { id: true, data: true, tipo: true, observacoes: true, criadoEm: true },
      }),
      this.prisma.medicamento.findMany({
        where: { animalId },
        select: { id: true, data: true, nome: true, dosagem: true, viaAplicacao: true, observacoes: true, criadoEm: true },
      }),
      this.prisma.pesagem.findMany({
        where: { animalId },
        select: { id: true, data: true, pesoKg: true, criadoEm: true },
      }),
      this.prisma.ocorrencia.findMany({
        where: { animalId },
        select: { id: true, data: true, titulo: true, descricao: true, tipo: true, criadoEm: true },
      }),
      this.prisma.manejo.findMany({
        where: { animalId },
        select: { id: true, data: true, tipo: true, observacao: true, criadoEm: true },
      }),
    ]);

    const timeline = [
      ...sanidade.map(s => ({ tipo: 'sanidade', ...s })),
      ...medicamentos.map(m => ({ tipo: 'medicamento', ...m })),
      ...pesagens.map(p => ({ tipo: 'pesagem', ...p })),
      ...ocorrencias.map(o => ({ tipo: 'ocorrencia', ...o })),
      ...manejos.map(m => ({ tipo: 'manejo', ...m })),
    ];

    // Ordena por data (padrão: mais recentes primeiro)
    timeline.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    return { animalId, historico: timeline };
  }
}
