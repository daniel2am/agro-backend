import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateChuvaDto } from './dto/create-chuva.dto';
import { dataSomente, diaIso, resumirChuvas } from './chuva.resumo';

@Injectable()
export class ChuvaService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAcesso(fazendaId: string, usuarioId: string) {
    const ok = await this.prisma.fazendaUsuario.findFirst({ where: { fazendaId, usuarioId }, select: { id: true } });
    if (!ok) throw new ForbiddenException('Acesso negado à fazenda');
  }

  /** Um registro por dia: repetir o dia substitui (também torna seguro reenviar offline). */
  async registrar(dto: CreateChuvaDto, usuarioId: string) {
    await this.assertAcesso(dto.fazendaId, usuarioId);
    const data = dataSomente(dto.data);
    if (!data) throw new BadRequestException('Data inválida (use AAAA-MM-DD)');
    if (data.getTime() > Date.now() + 86_400_000) throw new BadRequestException('A data não pode ser no futuro');

    const registro = await this.prisma.chuva.upsert({
      where: { fazendaId_data: { fazendaId: dto.fazendaId, data } },
      create: { fazendaId: dto.fazendaId, data, mm: dto.mm, observacao: dto.observacao ?? null },
      update: { mm: dto.mm, observacao: dto.observacao ?? null },
    });
    return { ...registro, data: diaIso(registro.data) };
  }

  async listar(fazendaId: string, usuarioId: string, ano?: number) {
    await this.assertAcesso(fazendaId, usuarioId);
    const a = ano ?? new Date().getFullYear();
    const registros = await this.prisma.chuva.findMany({
      where: { fazendaId, data: { gte: new Date(Date.UTC(a, 0, 1)), lt: new Date(Date.UTC(a + 1, 0, 1)) } },
      orderBy: { data: 'desc' },
    });
    return registros.map((r) => ({ id: r.id, data: diaIso(r.data), mm: r.mm, observacao: r.observacao }));
  }

  async resumo(fazendaId: string, usuarioId: string, ano?: number) {
    await this.assertAcesso(fazendaId, usuarioId);
    const a = ano ?? new Date().getFullYear();
    // ano pedido + o anterior (para comparar) + os últimos 30 dias que podem cruzar o ano
    const registros = await this.prisma.chuva.findMany({
      where: { fazendaId, data: { gte: new Date(Date.UTC(a - 1, 0, 1)), lt: new Date(Date.UTC(a + 1, 0, 1)) } },
      select: { data: true, mm: true },
    });
    const atual = resumirChuvas(registros, a);
    const anterior = resumirChuvas(registros, a - 1);
    return { ...atual, anoAnteriorMm: anterior.totalMm };
  }

  async remover(id: string, usuarioId: string) {
    const r = await this.prisma.chuva.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
      select: { id: true },
    });
    if (!r) throw new NotFoundException('Registro não encontrado');
    await this.prisma.chuva.delete({ where: { id } });
    return { removido: true };
  }
}
