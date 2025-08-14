// src/modules/compra-insumo/compra-insumo.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateCompraInsumoDto } from './dto/create-compra.dto';
import { UpdateCompraInsumoDto } from './dto/update-compra.dto';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { createObjectCsvStringifier } from 'csv-writer';
import * as PDFDocument from 'pdfkit'; // ✅ corrige import

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
export class CompraInsumoService {
  private readonly logger = new Logger(CompraInsumoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===== Helpers =====
  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({ data: { usuarioId, acao } });
    } catch (e) {
      this.logger.warn(`Falha ao registrar log (ignorado): ${String(e)}`);
    }
  }

  private async assertAcessoFazenda(fazendaId: string, usuarioId: string) {
    const ok = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('Acesso negado à fazenda');
  }

  private async assertCompra(id: string, fazendaId: string) {
    const compra = await this.prisma.compraInsumo.findFirst({
      where: { id, fazendaId },
    });
    if (!compra) throw new NotFoundException('Compra não encontrada');
    return compra;
  }

  // ===== CREATE =====
  async create(dto: CreateCompraInsumoDto, user: UsuarioPayload) {
    await this.assertAcessoFazenda(user.fazendaId, user.id);

    const dataCompra = toDateOrNull(dto.data);
    if (!dataCompra) throw new BadRequestException('Data inválida');

    const compra = await this.prisma.compraInsumo.create({
      data: {
        insumo: dto.insumo,
        quantidade: Number(dto.quantidade),
        unidade: dto.unidade ?? null,
        valor: Number(dto.valor),
        fornecedor: dto.fornecedor ?? null,
        data: dataCompra,
        fazendaId: user.fazendaId,
        usuarioId: user.id,
      },
    });

    // espelho no financeiro (despesa)
    await this.prisma.financeiro.create({
      data: {
        fazendaId: user.fazendaId,
        data: dataCompra,
        descricao: `Compra de ${dto.insumo}`,
        valor: Number(dto.valor),
        tipo: 'despesa',
      },
    });

    await this.safeLog(
      user.id,
      `compra_criada: id=${compra.id} insumo=${dto.insumo} qtd=${dto.quantidade}${dto.unidade ?? ''} valor=${dto.valor}`
    );

    return compra;
  }

  // ===== LIST =====
  async findAll(user: UsuarioPayload, query: any = {}) {
    await this.assertAcessoFazenda(user.fazendaId, user.id);

    const {
      take = 20,
      skip = 0,
      search,   // filtra por insumo/fornecedor
      inicio,   // ISO
      fim,      // ISO
      min,      // valor mínimo
      max,      // valor máximo
    } = query;

    const where: any = {
      fazendaId: user.fazendaId,
      ...(search && {
        OR: [
          { insumo: { contains: String(search), mode: 'insensitive' } },
          { fornecedor: { contains: String(search), mode: 'insensitive' } },
        ],
      }),
      ...((inicio || fim) && {
        data: {
          ...(inicio ? { gte: toDateOrNull(inicio) ?? undefined } : {}),
          ...(fim ? { lte: toDateOrNull(fim) ?? undefined } : {}),
        },
      }),
      ...((min || max) && {
        valor: {
          ...(min ? { gte: Number(min) } : {}),
          ...(max ? { lte: Number(max) } : {}),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.compraInsumo.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { data: 'desc' },
      }),
      this.prisma.compraInsumo.count({ where }),
    ]);

    return { data, total };
  }

  // ===== GET ONE =====
  async findOne(id: string, user: UsuarioPayload) {
    await this.assertAcessoFazenda(user.fazendaId, user.id);
    const compra = await this.prisma.compraInsumo.findFirst({
      where: { id, fazendaId: user.fazendaId },
    });
    if (!compra) throw new NotFoundException('Compra não encontrada');
    return compra;
  }

  // ===== UPDATE =====
  async update(id: string, dto: UpdateCompraInsumoDto, user: UsuarioPayload) {
    await this.assertAcessoFazenda(user.fazendaId, user.id);
    const atual = await this.assertCompra(id, user.fazendaId);

    const novaData = dto.data !== undefined ? toDateOrNull(dto.data) : undefined;
    if (dto.data !== undefined && !novaData) {
      throw new BadRequestException('Data inválida');
    }

    const dataUpdate = {
      ...(dto.insumo !== undefined ? { insumo: dto.insumo } : {}),
      ...(dto.quantidade !== undefined ? { quantidade: Number(dto.quantidade) } : {}),
      ...(dto.unidade !== undefined ? { unidade: dto.unidade } : {}),
      ...(dto.valor !== undefined ? { valor: Number(dto.valor) } : {}),
      ...(dto.fornecedor !== undefined ? { fornecedor: dto.fornecedor } : {}),
      ...(novaData !== undefined ? { data: novaData } : {}),
    };

    // atualiza compra
    const atualizada = await this.prisma.compraInsumo.update({
      where: { id },
      data: dataUpdate,
    });

    // mantém “espelho” do financeiro sincronizado por descrição/data/valor antigos
    await this.prisma.financeiro.updateMany({
      where: {
        fazendaId: user.fazendaId,
        tipo: 'despesa',
        descricao: `Compra de ${atual.insumo}`,
        data: atual.data,
        valor: atual.valor,
      },
      data: {
        descricao: `Compra de ${dto.insumo ?? atual.insumo}`,
        data: novaData ?? atual.data,
        valor: dto.valor != null ? Number(dto.valor) : atual.valor,
      },
    });

    const changes = diffChanges(
      {
        insumo: atual.insumo,
        quantidade: atual.quantidade,
        unidade: atual.unidade,
        valor: atual.valor,
        fornecedor: atual.fornecedor,
        data: atual.data,
      },
      {
        insumo: dto.insumo,
        quantidade: dto.quantidade != null ? Number(dto.quantidade) : undefined,
        unidade: dto.unidade,
        valor: dto.valor != null ? Number(dto.valor) : undefined,
        fornecedor: dto.fornecedor,
        data: novaData,
      },
      ['insumo', 'quantidade', 'unidade', 'valor', 'fornecedor', 'data']
    );

    await this.safeLog(
      user.id,
      `compra_atualizada: id=${id} insumo=${atualizada.insumo} changes=${changes.join(',')}`
    );

    return atualizada;
  }

  // ===== REMOVE =====
  async remove(id: string, user: UsuarioPayload) {
    await this.assertAcessoFazenda(user.fazendaId, user.id);
    const compra = await this.assertCompra(id, user.fazendaId);

    // remove espelho no financeiro
    await this.prisma.financeiro.deleteMany({
      where: {
        fazendaId: user.fazendaId,
        tipo: 'despesa',
        descricao: `Compra de ${compra.insumo}`,
        data: compra.data,
        valor: compra.valor,
      },
    });

    await this.prisma.compraInsumo.delete({ where: { id } });

    await this.safeLog(user.id, `compra_excluida: id=${id} insumo=${compra.insumo}`);

    return { message: 'Removido com sucesso' };
  }

  // ===== Exportações =====
  async exportCSV(user: UsuarioPayload): Promise<string> {
    const { data: registros } = await this.findAll(user);

    const csv = createObjectCsvStringifier({
      header: [
        { id: 'data', title: 'Data' },
        { id: 'insumo', title: 'Insumo' },
        { id: 'quantidade', title: 'Quantidade' },
        { id: 'unidade', title: 'Unidade' },
        { id: 'valor', title: 'Valor' },
        { id: 'fornecedor', title: 'Fornecedor' },
      ],
    });

    const records = registros.map((r) => ({
      ...r,
      data: new Date(r.data).toLocaleDateString(),
      valor: Number(r.valor).toFixed(2),
    }));

    // stringifyRecords espera somente as linhas (sem header)
    return csv.stringifyRecords(records);
  }

  async exportPDF(user: UsuarioPayload): Promise<PDFDocument> {
    const { data } = await this.findAll(user);
    const doc = new PDFDocument();

    doc.fontSize(16).text('Relatório de Compras de Insumos', { align: 'center' });
    doc.moveDown();

    data.forEach((r) => {
      const dt = new Date(r.data).toLocaleDateString();
      doc
        .fontSize(12)
        .text(`Data: ${dt}`)
        .text(`Insumo: ${r.insumo}`)
        .text(`Qtd: ${r.quantidade} ${r.unidade ?? ''}`)
        .text(`Valor: R$ ${Number(r.valor).toFixed(2)}`)
        .text(`Fornecedor: ${r.fornecedor ?? '-'}`)
        .moveDown();
    });

    return doc;
  }
}