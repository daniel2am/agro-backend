import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateLavouraDto, UpdateLavouraDto } from './dto';

@Injectable()
export class LavouraService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateLavouraDto, usuarioId: string) {
    await this.verificarAcessoAFazenda(data.fazendaId, usuarioId);
    return this.prisma.lavoura.create({ data });
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
    const lavoura = await this.prisma.lavoura.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
    });
    if (!lavoura) throw new ForbiddenException('Acesso negado');
    return this.prisma.lavoura.update({ where: { id }, data });
  }

  async remove(id: string, usuarioId: string) {
    const lavoura = await this.prisma.lavoura.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
    });
    if (!lavoura) throw new ForbiddenException('Acesso negado');
    return this.prisma.lavoura.delete({ where: { id } });
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