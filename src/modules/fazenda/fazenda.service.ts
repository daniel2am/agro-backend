import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateFazendaDto, UpdateFazendaDto } from './fazenda.dto';
import { exportToCSV, exportToPDF } from '../../utils/export.util';
import { parseCcirPdf } from '../../utils/pdf-ccir.util';

@Injectable()
export class FazendaService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateFazendaDto, usuarioId: string) {
    const { titulares, ...fazendaData } = data;
    const fazenda = await this.prisma.fazenda.create({
      data: {
        ...fazendaData,
        usuarios: {
          create: { usuarioId, papel: 'proprietario' },
        },
        titulares: {
          create: titulares || [],
        },
      },
      include: { titulares: true },
    });
    return fazenda;
  }

  async createFromCcir(buffer: Buffer, usuarioId: string) {
    const data = await parseCcirPdf(buffer);
    return this.create(data, usuarioId);
  }

  async findAll(usuarioId: string, params: any = {}) {
    const { take = 20, skip = 0, search } = params;
    const where: any = {
      usuarios: { some: { usuarioId } },
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
        include: { titulares: true },
      }),
      this.prisma.fazenda.count({ where }),
    ]);
    return { data, total };
  }

  async findOne(id: string, usuarioId: string) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: { id, usuarios: { some: { usuarioId } } },
      include: { titulares: true },
    });
    if (!fazenda) throw new NotFoundException('Fazenda não encontrada ou acesso negado');
    return fazenda;
  }

  async update(id: string, data: UpdateFazendaDto, usuarioId: string) {
    const exists = await this.prisma.fazenda.findFirst({
      where: { id, usuarios: { some: { usuarioId } } },
    });
    if (!exists) throw new ForbiddenException('Acesso negado');

    // Atualiza titulares (remove todos e adiciona novamente)
    if (data.titulares) {
      await this.prisma.titularFazenda.deleteMany({ where: { fazendaId: id } });
    }

    return this.prisma.fazenda.update({
      where: { id },
      data: {
        ...data,
        ...(data.titulares && { titulares: { create: data.titulares } }),
      },
      include: { titulares: true },
    });
  }

  async remove(id: string, usuarioId: string) {
    const exists = await this.prisma.fazenda.findFirst({
      where: { id, usuarios: { some: { usuarioId } } },
    });
    if (!exists) throw new ForbiddenException('Acesso negado');
    await this.prisma.titularFazenda.deleteMany({ where: { fazendaId: id } });
    return this.prisma.fazenda.delete({ where: { id } });
  }

  async exportCSV(usuarioId: string) {
    const fazendas = await this.prisma.fazenda.findMany({
      where: { usuarios: { some: { usuarioId } } },
      include: { titulares: true },
    });
    return exportToCSV(fazendas, 'fazendas');
  }

  async exportPDF(usuarioId: string) {
    const fazendas = await this.prisma.fazenda.findMany({
      where: { usuarios: { some: { usuarioId } } },
      include: { titulares: true },
    });
    return exportToPDF(fazendas, 'Fazendas');
  }
}
