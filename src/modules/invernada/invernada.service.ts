import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateInvernadaDto } from './dto/create-invernada.dto';
import { UpdateInvernadaDto } from './dto/update-invernada.dto';

@Injectable()
export class InvernadaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInvernadaDto) {
    return this.prisma.invernada.create({ data: dto });
  }

  async findAllByUsuario(usuarioId: string) {
    return this.prisma.invernada.findMany({
      where: {
        fazenda: {
          usuarios: {
            some: { usuarioId },
          },
        },
      },
      include: { fazenda: true },
    });
  }

  async findOne(id: string, usuarioId: string) {
    const invernada = await this.prisma.invernada.findFirst({
      where: {
        id,
        fazenda: {
          usuarios: {
            some: { usuarioId },
          },
        },
      },
    });
    if (!invernada) throw new NotFoundException('Invernada não encontrada ou acesso negado');
    return invernada;
  }

  async update(id: string, dto: UpdateInvernadaDto, usuarioId: string) {
    await this.findOne(id, usuarioId);
    return this.prisma.invernada.update({ where: { id }, data: dto });
  }

  async remove(id: string, usuarioId: string) {
    await this.findOne(id, usuarioId);
    return this.prisma.invernada.delete({ where: { id } });
  }
}