// src/modules/ocorrencia/ocorrencia.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateOcorrenciaDto } from './dto/create-ocorrencia.dto';
import { UpdateOcorrenciaDto } from './dto/update-ocorrencia.dto';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { createObjectCsvStringifier } from 'csv-writer';

function toDateOrThrow(v: unknown, msg = 'Data inválida'): Date {
  const d = new Date(v as any);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(msg);
  return d;
}

@Injectable()
export class OcorrenciaService {
  private readonly logger = new Logger(OcorrenciaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===== Helpers =====
  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({ data: { usuarioId, acao } });
    } catch (e) {
      this.logger.warn(`Falha ao registrar log: ${String(e)}`);
    }
  }

  private async assertAcessoFazenda(fazendaId: string, usuarioId: string) {
    const ok = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('Acesso negado à fazenda');
  }

  private async assertAnimalNaMesmaFazenda(
    animalId: string,
    fazendaId: string,
  ) {
    if (!animalId) return;
    const a = await this.prisma.animal.findFirst({
      where: { id: animalId, fazendaId },
      select: { id: true },
    });
    if (!a) {
      throw new ForbiddenException('Animal não pertence a esta fazenda');
    }
  }

  // ===== CREATE =====
  async create(dto: CreateOcorrenciaDto, user: UsuarioPayload) {
    await this.assertAcessoFazenda(user.fazendaId, user.id);
    await this.assertAnimalNaMesmaFazenda(dto.animalId as any, user.fazendaId);

    const data = dto.data ? toDateOrThrow(dto.data) : new Date();

    const criada = await this.prisma.ocorrencia.create({
      data: {
        fazendaId: user.fazendaId,
        animalId: dto.animalId ?? null,
        titulo: dto.titulo,
        descricao: dto.descricao ?? null,
        tipo: dto.tipo ?? null,
        data,
      },
      include: { animal: true },
    });

    // log p/ feed
    await this.safeLog(
      user.id,
      `ocorrencia_criada: id=${criada.id} titulo="${criada.titulo}" tipo=${criada.tipo ?? '-'} animal=${criada.animal?.brinco ?? '-'}`
    );

    return criada;
  }

  // ===== LIST (paginada + busca opcional) =====
  async findAll(user: UsuarioPayload, query: any = {}) {
    const {
      take = 20,
      skip = 0,
      search,
      animalId,
      inicio, // ISO opcional
      fim,    // ISO opcional
    } = query;

    const where: any = {
      fazendaId: user.fazendaId,
      ...(animalId ? { animalId } : {}),
      ...(search
        ? {
            OR: [
              { titulo: { contains: String(search), mode: 'insensitive' } },
              { tipo: { contains: String(search), mode: 'insensitive' } },
              { descricao: { contains: String(search), mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(inicio || fim
        ? {
            data: {
              ...(inicio ? { gte: new Date(inicio) } : {}),
              ...(fim ? { lte: new Date(fim) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.ocorrencia.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { data: 'desc' },
        include: { animal: true },
      }),
      this.prisma.ocorrencia.count({ where }),
    ]);

    return { data, total };
  }

  // ===== GET ONE =====
  async findOne(id: string, user: UsuarioPayload) {
    const ocorrencia = await this.prisma.ocorrencia.findUnique({
      where: { id },
      include: { animal: true },
    });
    if (!ocorrencia || ocorrencia.fazendaId !== user.fazendaId) {
      throw new NotFoundException('Ocorrência não encontrada');
    }
    return ocorrencia;
  }

  // ===== UPDATE =====
  async update(id: string, dto: UpdateOcorrenciaDto, user: UsuarioPayload) {
    const current = await this.findOne(id, user);

    // se trocar animal, valida fazenda
    if (dto.animalId && dto.animalId !== current.animalId) {
      await this.assertAnimalNaMesmaFazenda(dto.animalId, user.fazendaId);
    }

    const atualizado = await this.prisma.ocorrencia.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.animalId !== undefined ? { animalId: dto.animalId } : {}),
        ...(dto.data !== undefined ? { data: toDateOrThrow(dto.data) } : {}),
      },
      include: { animal: true },
    });

    await this.safeLog(
      user.id,
      `ocorrencia_atualizada: id=${id} titulo="${atualizado.titulo}" tipo=${atualizado.tipo ?? '-'} animal=${atualizado.animal?.brinco ?? '-'}`
    );

    return atualizado;
  }

  // ===== REMOVE =====
  async remove(id: string, user: UsuarioPayload) {
    const current = await this.findOne(id, user);
    await this.prisma.ocorrencia.delete({ where: { id } });

    await this.safeLog(
      user.id,
      `ocorrencia_excluida: id=${id} titulo="${current.titulo}" tipo=${current.tipo ?? '-'}`
    );

    return { message: 'Ocorrência removida com sucesso' };
  }

  // ===== EXPORT CSV =====
  async exportCSV(user: UsuarioPayload): Promise<NodeJS.ReadableStream> {
    const { data: ocorrencias } = await this.findAll(user, { take: 10000, skip: 0 });

    const csv = createObjectCsvStringifier({
      header: [
        { id: 'data', title: 'Data' },
        { id: 'titulo', title: 'Título' },
        { id: 'tipo', title: 'Tipo' },
        { id: 'descricao', title: 'Descrição' },
        { id: 'animal', title: 'Animal' },
      ],
    });

    const records = ocorrencias.map((o) => ({
      data: (o.data ?? o['criadoEm'])?.toISOString?.() ?? '',
      titulo: o.titulo,
      tipo: o.tipo ?? '',
      descricao: o.descricao ?? '',
      animal: o.animal?.brinco ?? '',
    }));

    const { Readable } = await import('stream');
    return Readable.from([csv.getHeaderString(), ...csv.stringifyRecords(records)]);
  }
}