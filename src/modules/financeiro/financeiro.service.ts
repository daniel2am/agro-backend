import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateFinanceiroDto } from './dto/create-financeiro.dto';
import { UpdateFinanceiroDto } from './dto/update-financeiro.dto';

@Injectable()
export class FinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFinanceiroDto, usuarioId: string) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: {
        usuarios: {
          some: { usuarioId },
        },
      },
    });

    if (!fazenda) {
      throw new ForbiddenException('Fazenda não encontrada ou acesso negado');
    }

    return this.prisma.financeiro.create({
      data: {
        ...dto,
        data: new Date(dto.data),
        fazendaId: fazenda.id,
      },
    });
  }

  async findAll(usuarioId: string, query: any) {
    const { take = 10, skip = 0, search } = query;

    const fazenda = await this.prisma.fazenda.findFirst({
      where: {
        usuarios: {
          some: { usuarioId },
        },
      },
    });

    if (!fazenda) {
      throw new ForbiddenException('Fazenda não encontrada ou acesso negado');
    }

    const where: any = { fazendaId: fazenda.id };
    if (search) {
      where.descricao = {
        contains: search,
        mode: 'insensitive',
      };
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
        fazenda: {
          usuarios: {
            some: { usuarioId },
          },
        },
      },
    });

    if (!financeiro) throw new NotFoundException('Registro não encontrado');
    return financeiro;
  }

  async update(id: string, dto: UpdateFinanceiroDto, usuarioId: string) {
    const exists = await this.prisma.financeiro.findFirst({
      where: {
        id,
        fazenda: {
          usuarios: {
            some: { usuarioId },
          },
        },
      },
    });

    if (!exists) throw new ForbiddenException('Acesso negado');

    return this.prisma.financeiro.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, usuarioId: string) {
    const exists = await this.prisma.financeiro.findFirst({
      where: {
        id,
        fazenda: {
          usuarios: {
            some: { usuarioId },
          },
        },
      },
    });

    if (!exists) throw new ForbiddenException('Acesso negado');

    return this.prisma.financeiro.delete({ where: { id } });
  }
}