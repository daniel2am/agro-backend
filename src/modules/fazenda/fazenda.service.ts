import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateFazendaDto, UpdateFazendaDto } from './fazenda.dto';
import { exportToCSV, exportToPDF } from '../../utils/export.util';

@Injectable()
export class FazendaService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateFazendaDto, usuarioId: string) {
    const fazenda = await this.prisma.fazenda.create({
      data: {
        ...data,
        usuarios: {
          create: {
            usuarioId,
            papel: 'proprietario',
          },
        },
      },
    });
    return fazenda;
  }

  async findAll(usuarioId: string, params: any = {}) {
    const { take = 20, skip = 0, search } = params;
    const where: any = {
      usuarios: {
        some: {
          usuarioId,
        },
      },
    };
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { cidade: { contains: search, mode: 'insensitive' } },
        { estado: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.fazenda.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.fazenda.count({ where }),
    ]);
    return { data, total };
  }

  async findOne(id: string, usuarioId: string) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: {
        id,
        usuarios: { some: { usuarioId } },
      },
    });
    if (!fazenda) throw new NotFoundException('Fazenda não encontrada ou acesso negado');
    return fazenda;
  }

  async update(id: string, data: UpdateFazendaDto, usuarioId: string) {
    const exists = await this.prisma.fazenda.findFirst({
      where: { id, usuarios: { some: { usuarioId } } },
    });
    if (!exists) throw new ForbiddenException('Acesso negado');
    return this.prisma.fazenda.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, usuarioId: string) {
    const exists = await this.prisma.fazenda.findFirst({
      where: { id, usuarios: { some: { usuarioId } } },
    });
    if (!exists) throw new ForbiddenException('Acesso negado');
    return this.prisma.fazenda.delete({ where: { id } });
  }

  async exportCSV(usuarioId: string) {
    const fazendas = await this.prisma.fazenda.findMany({
      where: { usuarios: { some: { usuarioId } } },
    });
    return exportToCSV(fazendas, 'fazendas');
  }

  async exportPDF(usuarioId: string) {
    const fazendas = await this.prisma.fazenda.findMany({
      where: { usuarios: { some: { usuarioId } } },
    });
    return exportToPDF(fazendas, 'Fazendas');
  }
}
