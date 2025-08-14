// src/modules/manejo/manejo.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateManejoDto } from './dto/create-manejo.dto';
import { UpdateManejoDto } from './dto/update-manejo.dto';
import { UsuarioPayload } from 'src/modules/auth/dto/usuario-payload.interface';
import { Parser } from 'json2csv';
import * as PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';

function toDateOrNull(v: unknown): Date | null {
  if (v == null || v === '') return null;
  const d = new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffChanges<T extends Record<string, any>>(
  before: Partial<T>,
  proposed: Partial<T>,
  keys: (keyof T)[]
): string[] {
  const out: string[] = [];
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(proposed, k)) {
      const newVal = (proposed as any)[k];
      const oldVal = (before as any)[k];
      if (!Object.is(newVal, oldVal)) out.push(String(k));
    }
  }
  return out;
}

@Injectable()
export class ManejoService {
  private readonly logger = new Logger(ManejoService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({ data: { usuarioId, acao } });
    } catch (e) {
      this.logger.warn(`Falha ao registrar log (ignorado): ${String(e)}`);
    }
  }

  private async assertAcessoAoAnimal(animalId: string | null | undefined, usuarioId: string) {
    if (!animalId) return null;
    const animal = await this.prisma.animal.findFirst({
      where: { id: animalId, fazenda: { usuarios: { some: { usuarioId } } } },
      select: { id: true, brinco: true, fazendaId: true },
    });
    if (!animal) throw new ForbiddenException('Acesso negado ao animal');
    return animal;
  }

  private async assertAcessoAoManejo(manejoId: string, usuarioId: string) {
    const m = await this.prisma.manejo.findFirst({
      where: { id: manejoId, fazenda: { usuarios: { some: { usuarioId } } } },
      include: { animal: { select: { id: true, brinco: true } } },
    });
    if (!m) throw new NotFoundException('Manejo não encontrado ou acesso negado');
    return m;
  }

  // CREATE
  async create(dto: CreateManejoDto, user: UsuarioPayload) {
    // valida acesso ao animal (quando houver)
    const animal = await this.assertAcessoAoAnimal(dto.animalId as any, user.id);

    const dataManejo = toDateOrNull(dto.data);
    if (!dataManejo) throw new BadRequestException('Data inválida');

    const criado = await this.prisma.manejo.create({
      data: {
        tipo: dto.tipo,
        observacao: dto.observacao ?? null,
        data: dataManejo,
        fazendaId: user.fazendaId,
        animalId: animal?.id ?? null,
      },
      include: { animal: true },
    });

    await this.safeLog(
      user.id,
      `manejo_criado: id=${criado.id} tipo=${criado.tipo} animal=${criado.animal?.brinco ?? '-'} data=${dataManejo.toISOString()}`
    );

    return criado;
  }

  // LIST (com filtros opcionais e paginação)
  async findAll(user: UsuarioPayload, params: any = {}) {
    const {
      take = 50,
      skip = 0,
      search,          // busca em tipo/observacao
      animalId,        // filtra por animal
      tipo,            // filtra por tipo de manejo
      inicio,          // ISO
      fim,             // ISO
    } = params;

    const where: Prisma.ManejoWhereInput = {
      fazendaId: user.fazendaId,
      ...(animalId ? { animalId } : {}),
      ...(tipo ? { tipo: { equals: String(tipo), mode: Prisma.QueryMode.insensitive } } : {}),
      ...(search
        ? {
            OR: [
              { tipo: { contains: String(search), mode: Prisma.QueryMode.insensitive } },
              { observacao: { contains: String(search), mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
      ...((inicio || fim) && {
        data: {
          ...(inicio ? { gte: toDateOrNull(inicio) ?? undefined } : {}),
          ...(fim ? { lte: toDateOrNull(fim) ?? undefined } : {}),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.manejo.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { data: 'desc' },
        include: { animal: true },
      }),
      this.prisma.manejo.count({ where }),
    ]);

    return { data, total };
  }

  // GET ONE
  async findOne(id: string, user: UsuarioPayload) {
    const manejo = await this.prisma.manejo.findFirst({
      where: { id, fazendaId: user.fazendaId },
      include: { animal: true },
    });
    if (!manejo) throw new NotFoundException('Manejo não encontrado');
    return manejo;
  }

  // UPDATE
  async update(id: string, dto: UpdateManejoDto, user: UsuarioPayload) {
    const current = await this.assertAcessoAoManejo(id, user.id);

    // se trocar animal, valida acesso
    if (dto.animalId !== undefined && dto.animalId !== current.animalId) {
      await this.assertAcessoAoAnimal(dto.animalId as any, user.id);
    }

    const novaData = dto.data !== undefined ? toDateOrNull(dto.data) : undefined;
    if (dto.data !== undefined && !novaData) throw new BadRequestException('Data inválida');

    const dataUpdate: Prisma.ManejoUpdateInput = {
      ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
      ...(dto.observacao !== undefined ? { observacao: dto.observacao } : {}),
      ...(dto.animalId !== undefined ? { animalId: dto.animalId ?? null } : {}),
      ...(novaData !== undefined ? { data: novaData } : {}),
    };

    const changes = diffChanges(
      { tipo: current.tipo, observacao: current.observacao, animalId: current.animalId, data: current.data },
      { tipo: dto.tipo, observacao: dto.observacao, animalId: dto.animalId, data: novaData },
      ['tipo', 'observacao', 'animalId', 'data']
    );

    const atualizado = await this.prisma.manejo.update({
      where: { id },
      data: dataUpdate,
      include: { animal: true },
    });

    await this.safeLog(
      user.id,
      `manejo_atualizado: id=${id} tipo=${atualizado.tipo} animal=${atualizado.animal?.brinco ?? '-'} changes=${changes.join(',')}`
    );

    return atualizado;
  }

  // DELETE
  async remove(id: string, user: UsuarioPayload) {
    const check = await this.assertAcessoAoManejo(id, user.id);

    await this.prisma.manejo.delete({ where: { id } });

    await this.safeLog(
      user.id,
      `manejo_excluido: id=${id} tipo=${check.tipo} animal=${check.animal?.brinco ?? '-'}`
    );

    return { message: 'Manejo removido com sucesso' };
  }

  // === Export sem gravar em disco (compatível com o controller atual) ===
  async exportToCSV(user: UsuarioPayload): Promise<string> {
    const { data } = await this.findAll(user, { take: 10000, skip: 0 });
    const parser = new Parser();
    return parser.parse(data);
  }

  async exportToPDF(user: UsuarioPayload): Promise<PDFDocument> {
    const { data: registros } = await this.findAll(user, { take: 10000, skip: 0 });
    const doc = new PDFDocument();

    doc.fontSize(16).text('Relatório de Manejos', { align: 'center' });
    doc.moveDown();

    registros.forEach((m) => {
      const data = new Date(m.data).toLocaleDateString();
      const animalNome = m.animal?.nome ?? m.animal?.brinco ?? '—';
      doc
        .fontSize(12)
        .text(
          `Animal: ${animalNome} | Tipo: ${m.tipo} | Data: ${data} | Obs: ${m.observacao || '-'}`
        );
      doc.moveDown(0.5);
    });

    return doc; // o controller já faz o pipe pra Response
  }
}