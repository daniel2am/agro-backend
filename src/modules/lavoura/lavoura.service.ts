import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateLavouraDto, UpdateLavouraDto } from './dto';

@Injectable()
export class LavouraService {
  private readonly logger = new Logger(LavouraService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra um log de forma resiliente (não quebra o fluxo se falhar).
   */
  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({
        data: { usuarioId, acao },
      });
    } catch (e) {
      this.logger.warn(`Falha ao registrar log (lavoura): ${String(e)}`);
    }
  }

  async create(data: CreateLavouraDto, usuarioId: string) {
    await this.verificarAcessoAFazenda(data.fazendaId, usuarioId);

    const lavoura = await this.prisma.lavoura.create({ data });

    // log para histórico
    await this.safeLog(
      usuarioId,
      `lavoura_criada id=${lavoura.id} nome=${lavoura.nome} areaHa=${lavoura.areaHa} fazenda=${lavoura.fazendaId}`
    );

    return lavoura;
  }

  async findAll(usuarioId: string) {
    return this.prisma.lavoura.findMany({
      where: {
        fazenda: { usuarios: { some: { usuarioId } } },
      },
      include: { fazenda: true },
    });
  }

  async findOne(id: string, usuarioId: string) {
    const lavoura = await this.prisma.lavoura.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
      include: { fazenda: true },
    });
    if (!lavoura) throw new NotFoundException('Lavoura não encontrada');
    return lavoura;
  }

  async update(id: string, data: UpdateLavouraDto, usuarioId: string) {
    // garante acesso
    const atual = await this.prisma.lavoura.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
    });
    if (!atual) throw new ForbiddenException('Acesso negado');

    const lavoura = await this.prisma.lavoura.update({ where: { id }, data });

    // log para histórico
    await this.safeLog(
      usuarioId,
      `lavoura_atualizada id=${lavoura.id} nome=${lavoura.nome} areaHa=${lavoura.areaHa} fazenda=${lavoura.fazendaId}`
    );

    return lavoura;
  }

  async remove(id: string, usuarioId: string) {
    // pega dados para log e valida acesso
    const lavoura = await this.prisma.lavoura.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
      select: { id: true, nome: true, fazendaId: true, areaHa: true },
    });
    if (!lavoura) throw new ForbiddenException('Acesso negado');

    await this.prisma.lavoura.delete({ where: { id } });

    // log para histórico
    await this.safeLog(
      usuarioId,
      `lavoura_excluida id=${lavoura.id} nome=${lavoura.nome} areaHa=${lavoura.areaHa} fazenda=${lavoura.fazendaId}`
    );

    return { message: 'Lavoura removida com sucesso' };
  }

  private async verificarAcessoAFazenda(fazendaId: string, usuarioId: string) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: {
        id: fazendaId,
        usuarios: { some: { usuarioId } },
      },
    });
    if (!fazenda) throw new ForbiddenException('Acesso negado à fazenda');
  }
}