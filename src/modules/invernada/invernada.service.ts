// src/modules/invernada/invernada.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateInvernadaDto } from './dto/create-invernada.dto';
import { UpdateInvernadaDto } from './dto/update-invernada.dto';

type LatLng = { latitude: number; longitude: number };
const EPS = 1e-7;
const iguais = (a: LatLng, b: LatLng) =>
  Math.abs(a.latitude - b.latitude) < EPS && Math.abs(a.longitude - b.longitude) < EPS;

// remove duplicados consecutivos e fecha/abre duplicado
function sanitizeCoords(points?: LatLng[]): LatLng[] | undefined {
  if (!Array.isArray(points) || points.length === 0) return undefined;
  const dedup: LatLng[] = [];
  for (const p of points) {
    const last = dedup[dedup.length - 1];
    if (!last || !iguais(last, p)) dedup.push(p);
  }
  if (dedup.length > 1 && iguais(dedup[0], dedup[dedup.length - 1])) dedup.pop();
  return dedup;
}

@Injectable()
export class InvernadaService {
  constructor(private readonly prisma: PrismaService) {}

  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({ data: { usuarioId, acao } });
    } catch {
      // não quebra fluxo se log falhar
    }
  }

  async create(dto: CreateInvernadaDto, usuarioId: string) {
    const safePoly = sanitizeCoords(dto.poligono);
    const criada = await this.prisma.invernada.create({
      data: {
        nome: dto.nome,
        area: dto.area,                 // hectares
        poligono: safePoly ?? undefined, // Json?
        fazendaId: dto.fazendaId,
      },
      include: { _count: { select: { animais: true } } },
    });

    await this.safeLog(
      usuarioId,
      `invernada_criada: id=${criada.id}, nome="${criada.nome}", area=${criada.area}`
    );

    return criada;
  }

  // lista por fazenda com _count
  findAllByFazenda(fazendaId: string) {
    return this.prisma.invernada.findMany({
      where: { fazendaId },
      include: { _count: { select: { animais: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  // lista por usuário (com _count)
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
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
      include: { _count: { select: { animais: true } } },
    });
    if (!invernada) {
      throw new NotFoundException('Invernada não encontrada ou acesso negado');
    }
    return invernada;
  }

  async update(id: string, dto: UpdateInvernadaDto, usuarioId: string) {
    await this.findOne(id, usuarioId);

    const data: any = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.area !== undefined) data.area = dto.area; // hectares
    if (dto.fazendaId !== undefined) data.fazendaId = dto.fazendaId;
    if (dto.poligono !== undefined) data.poligono = sanitizeCoords(dto.poligono) ?? undefined;

    const atualizada = await this.prisma.invernada.update({
      where: { id },
      data,
      include: { _count: { select: { animais: true } } },
    });

    await this.safeLog(
      usuarioId,
      `invernada_atualizada: id=${id}, nome="${atualizada.nome}", area=${atualizada.area}`
    );

    return atualizada;
  }

  async remove(id: string, usuarioId: string) {
    const existente = await this.findOne(id, usuarioId);
    await this.prisma.invernada.delete({ where: { id } });

    await this.safeLog(
      usuarioId,
      `invernada_excluida: id=${id}, nome="${existente.nome}"`
    );

    return { message: 'Invernada removida com sucesso' };
  }
}