// src/modules/rebanho/rebanho.service.ts
//
// "Rebanho" aqui é o AGRUPAMENTO de animais (cria, recria, engorda...), não o
// animal em si. Um animal pode pertencer a um rebanho (Animal.rebanhoId).
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateRebanhoDto } from './dto/create-rebanho.dto';
import { UpdateRebanhoDto } from './dto/update-rebanho.dto';

@Injectable()
export class RebanhoService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAcessoFazenda(fazendaId: string, usuarioId: string) {
    const ok = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('Acesso negado à fazenda');
  }

  async create(dto: CreateRebanhoDto, usuarioId: string) {
    await this.assertAcessoFazenda(dto.fazendaId, usuarioId);
    return this.prisma.rebanho.create({
      data: {
        fazendaId: dto.fazendaId,
        nome: dto.nome,
        tipo: dto.tipo ?? null,
        observacoes: dto.observacoes ?? null,
      },
    });
  }

  async findAll(usuarioId: string, fazendaId?: string) {
    return this.prisma.rebanho.findMany({
      where: {
        fazenda: { usuarios: { some: { usuarioId } } },
        ...(fazendaId ? { fazendaId } : {}),
      },
      orderBy: { nome: 'asc' },
      include: { _count: { select: { animais: true } } },
    });
  }

  async findOne(id: string, usuarioId: string) {
    const rebanho = await this.prisma.rebanho.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
      include: { _count: { select: { animais: true } } },
    });
    if (!rebanho) throw new NotFoundException('Rebanho não encontrado');
    return rebanho;
  }

  async update(id: string, dto: UpdateRebanhoDto, usuarioId: string) {
    const atual = await this.prisma.rebanho.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
      select: { id: true },
    });
    if (!atual) throw new ForbiddenException('Acesso negado');

    return this.prisma.rebanho.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes } : {}),
      },
    });
  }

  async remove(id: string, usuarioId: string) {
    const atual = await this.prisma.rebanho.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
      select: { id: true },
    });
    if (!atual) throw new ForbiddenException('Acesso negado');

    // Animais ligados a este rebanho ficam com rebanhoId = null (onDelete: SetNull).
    await this.prisma.rebanho.delete({ where: { id } });
    return { message: 'Rebanho removido com sucesso' };
  }
}
