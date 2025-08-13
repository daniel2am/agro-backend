// src/modules/financeiro/financeiro.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
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

  private async assertAcessoFazenda(fazendaId: string, usuarioId: string) {
    const ok = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('Acesso negado à fazenda');
  }

  // ===== CRUD =====
  async create(dto: CreateFinanceiroDto, usuarioId: string) {
    // encontra alguma fazenda do usuário (mesma lógica que você já usava)
    const fazenda = await this.prisma.fazenda.findFirst({
      where: { usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!fazenda) throw new ForbiddenException('Fazenda não encontrada ou acesso negado');

    const registro = await this.prisma.financeiro.create({
      data: {
        ...dto,
        data: new Date(dto.data),
        fazendaId: fazenda.id,
      },
    });

    await this.safeLog(
      usuarioId,
      `financeiro_criado: id=${registro.id}, tipo=${dto.tipo}, valor=${dto.valor}, desc="${dto.descricao ?? ''}"`
    );

    return registro;
  }

  async findAll(usuarioId: string, query: any) {
    const { take = 10, skip = 0, search } = query;

    const fazenda = await this.prisma.fazenda.findFirst({
      where: { usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!fazenda) throw new ForbiddenException('Fazenda não encontrada ou acesso negado');

    const where: any = { fazendaId: fazenda.id };
    if (search) {
      where.descricao = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.financeiro.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { data: 'desc' },
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
    });

    if (!financeiro) throw new NotFoundException('Registro não encontrado');
    return financeiro;
  }

  async update(id: string, dto: UpdateFinanceiroDto, usuarioId: string) {
    const exists = await this.prisma.financeiro.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
    });
    if (!exists) throw new ForbiddenException('Acesso negado');

    const atualizado = await this.prisma.financeiro.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.data ? { data: new Date(dto.data) } : {}),
      },
    });

    await this.safeLog(
      usuarioId,
      `financeiro_atualizado: id=${id}, tipo=${atualizado.tipo}, valor=${atualizado.valor}, desc="${atualizado.descricao ?? ''}"`
    );

    return atualizado;
  }

  async remove(id: string, usuarioId: string) {
    const exists = await this.prisma.financeiro.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
    });
    if (!exists) throw new ForbiddenException('Acesso negado');

    await this.prisma.financeiro.delete({ where: { id } });

    await this.safeLog(usuarioId, `financeiro_excluido: id=${id}, desc="${exists.descricao ?? ''}"`);

    return { message: 'Removido com sucesso' };
  }
}