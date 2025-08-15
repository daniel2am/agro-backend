// src/modules/financeiro/financeiro.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateFinanceiroDto } from './dto/create-financeiro.dto';
import { UpdateFinanceiroDto } from './dto/update-financeiro.dto';

@Injectable()
export class FinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Helpers =====
  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({
        data: { usuarioId, acao },
      });
    } catch {
      // não quebra o fluxo se o log falhar
    }
  }

  private async getFazendaDoUsuario(usuarioId: string) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: { usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!fazenda) throw new ForbiddenException('Fazenda não encontrada ou acesso negado');
    return fazenda;
  }

  // ===== CRUD =====
  async create(dto: CreateFinanceiroDto, usuarioId: string) {
    const fazenda = await this.getFazendaDoUsuario(usuarioId);

    if (!dto.data) throw new BadRequestException('Data é obrigatória');
    const dataLanc = new Date(dto.data);
    if (Number.isNaN(dataLanc.getTime())) throw new BadRequestException('Data inválida');

    const registro = await this.prisma.financeiro.create({
      data: {
        fazendaId: fazenda.id,
        data: dataLanc,
        descricao: dto.descricao ?? '',
        valor: dto.valor,
        tipo: dto.tipo, // 'receita' | 'despesa'
        // NUNCA setamos compraInsumoId diretamente aqui — esse vínculo vem do CompraInsumoService
      },
    });

    await this.safeLog(
      usuarioId,
      `financeiro_criado: id=${registro.id}, tipo=${dto.tipo}, valor=${dto.valor}, desc="${dto.descricao ?? ''}"`
    );

    return registro;
  }

  async findAll(usuarioId: string, query: any = {}) {
    const fazenda = await this.getFazendaDoUsuario(usuarioId);

    const {
      take = 10,
      skip = 0,
      search,
      inicio, // ISO opcional
      fim,    // ISO opcional
      tipo,   // 'receita' | 'despesa' opcional
    } = query;

    const where: any = { fazendaId: fazenda.id };

    if (search) {
      where.descricao = { contains: String(search), mode: 'insensitive' };
    }
    if (tipo) {
      where.tipo = tipo;
    }
    if (inicio || fim) {
      where.data = {
        ...(inicio ? { gte: new Date(inicio) } : {}),
        ...(fim ? { lte: new Date(fim) } : {}),
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.financeiro.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { data: 'desc' },
        // Se quiser enxergar a compra vinculada em alguma tela:
        // include: { compraInsumo: true },
      }),
      this.prisma.financeiro.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string, usuarioId: string) {
    const financeiro = await this.prisma.financeiro.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
      // include: { compraInsumo: true },
    });

    if (!financeiro) throw new NotFoundException('Registro não encontrado');
    return financeiro;
  }

  async update(id: string, dto: UpdateFinanceiroDto, usuarioId: string) {
    // valida posse
    const exists = await this.prisma.financeiro.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
      select: { id: true },
    });
    if (!exists) throw new ForbiddenException('Acesso negado');

    const dataUpdate: any = {
      ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
      ...(dto.valor !== undefined ? { valor: dto.valor } : {}),
      ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
    };
    if (dto.data !== undefined) {
      const d = new Date(dto.data);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Data inválida');
      dataUpdate.data = d;
    }

    const atualizado = await this.prisma.financeiro.update({
      where: { id },
      data: dataUpdate,
    });

    await this.safeLog(
      usuarioId,
      `financeiro_atualizado: id=${id}, tipo=${atualizado.tipo}, valor=${atualizado.valor}, desc="${atualizado.descricao ?? ''}"`
    );

    return atualizado;
  }

  async remove(id: string, usuarioId: string) {
    // valida posse
    const exists = await this.prisma.financeiro.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
      select: { id: true, descricao: true },
    });
    if (!exists) throw new ForbiddenException('Acesso negado');

    // se for espelho de compra, a deleção direta é segura: o vínculo é opcional.
    await this.prisma.financeiro.delete({ where: { id } });

    await this.safeLog(usuarioId, `financeiro_excluido: id=${id}, desc="${exists.descricao ?? ''}"`);

    return { message: 'Removido com sucesso' };
  }
}