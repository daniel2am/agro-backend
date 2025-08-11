// src/modules/invernada/invernada.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateInvernadaDto } from './dto/create-invernada.dto';
import { UpdateInvernadaDto } from './dto/update-invernada.dto';

@Injectable()
export class InvernadaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInvernadaDto) {
    return this.prisma.invernada.create({
      data: {
        nome: dto.nome,
        area: dto.area,
        poligono: dto.poligono || undefined,
        fazendaId: dto.fazendaId,
      },
    });
  }

  // ✅ listagem por fazenda (com _count)
  findAllByFazenda(fazendaId: string) {
    return this.prisma.invernada.findMany({
      where: { fazendaId },
      include: { _count: { select: { animais: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  // ✅ listagem por usuário (mantendo _count e ordenação)
  async findAllByUsuario(usuarioId: string, fazendaId?: string) {
    return this.prisma.invernada.findMany({
      where: {
        ...(fazendaId && { fazendaId }),
        fazenda: { usuarios: { some: { usuarioId } } },
      },
      include: {
        fazenda: true,
        _count: { select: { animais: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string, usuarioId: string) {
    const invernada = await this.prisma.invernada.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
    });
    if (!invernada) {
      throw new NotFoundException('Invernada não encontrada ou acesso negado');
    }
    return invernada;
  }

  async update(id: string, dto: UpdateInvernadaDto, usuarioId: string) {
    await this.findOne(id, usuarioId);
    return this.prisma.invernada.update({
      where: { id },
      data: { ...dto, poligono: dto.poligono ?? undefined },
    });
  }

  async remove(id: string, usuarioId: string) {
    await this.findOne(id, usuarioId);
    return this.prisma.invernada.delete({ where: { id } });
  }
}