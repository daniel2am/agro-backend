// src/modules/compra-insumo/compra-insumo.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateCompraInsumoDto } from './dto/create-compra.dto';
import { UpdateCompraInsumoDto } from './dto/update-compra.dto';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { createObjectCsvStringifier } from 'csv-writer';
import PDFDocument from 'pdfkit';

@Injectable()
export class CompraInsumoService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Helpers =====
  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({
        data: { usuarioId, acao },
      });
    } catch {
      // não quebra o fluxo se o log falhar
    }
  }

  private async assertAcessoFazenda(fazendaId: string, usuarioId: string) {
    const ok = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!ok) {
      throw new ForbiddenException('Acesso negado à fazenda');
    }
  }

  // ===== CRUD =====
  async create(dto: CreateCompraInsumoDto, user: UsuarioPayload) {
    await this.assertAcessoFazenda(user.fazendaId, user.id);

    const { compra } = await this.prisma.$transaction(async (tx) => {
      // 1) cria compra
      const compra = await tx.compraInsumo.create({
        data: {
          fazendaId: user.fazendaId,
          usuarioId: user.id,
          data: new Date(dto.data),
          insumo: dto.insumo,
          quantidade: dto.quantidade,
          unidade: dto.unidade,
          valor: dto.valor,
          fornecedor: dto.fornecedor ?? null,
        },
      });

      // 2) cria espelho no financeiro (despesa) usando RELAÇÃO (fazenda connect) + vínculo 1–1 com compra
      await tx.financeiro.create({
        data: {
          fazenda: { connect: { id: user.fazendaId } }, // <- trocado de fazendaId: string para connect
          data: new Date(dto.data),
          descricao: `Compra de ${dto.insumo}`,
          valor: dto.valor,
          tipo: 'despesa',
          compraInsumo: { connect: { id: compra.id } },
        },
      });

      return { compra };
    });

    await this.safeLog(
      user.id,
      `compra_criada: id=${compra.id}, insumo=${compra.insumo}, qtd=${compra.quantidade}${compra.unidade ?? ''}, valor=${compra.valor}`,
    );

    return compra;
  }

  async findAll(user: UsuarioPayload) {
    await this.assertAcessoFazenda(user.fazendaId, user.id);

    return this.prisma.compraInsumo.findMany({
      where: { fazendaId: user.fazendaId },
      orderBy: { data: 'desc' },
      include: {
        financeiro: true, // requer schema + `npx prisma generate` após adicionar a relação 1–1
      },
    });
  }

  async update(id: string, dto: UpdateCompraInsumoDto, user: UsuarioPayload) {
    const compra = await this.prisma.compraInsumo.findFirst({
      where: { id, fazendaId: user.fazendaId },
    });
    if (!compra) throw new NotFoundException('Compra não encontrada');

    const novaData = dto.data ? new Date(dto.data) : undefined;

    const atualizada = await this.prisma.$transaction(async (tx) => {
      // 1) atualiza compra
      const compraAtualizada = await tx.compraInsumo.update({
        where: { id },
        data: {
          ...(dto.insumo !== undefined ? { insumo: dto.insumo } : {}),
          ...(dto.quantidade !== undefined ? { quantidade: dto.quantidade } : {}),
          ...(dto.unidade !== undefined ? { unidade: dto.unidade } : {}),
          ...(dto.valor !== undefined ? { valor: dto.valor } : {}),
          ...(dto.fornecedor !== undefined ? { fornecedor: dto.fornecedor } : {}),
          ...(novaData ? { data: novaData } : {}),
        },
      });

      // 2) atualiza financeiro vinculado (1–1) pela UNIQUE compraInsumoId
      await tx.financeiro.update({
        where: { compraInsumoId: id },
        data: {
          ...(novaData ? { data: novaData } : {}),
          ...(dto.valor !== undefined ? { valor: dto.valor } : {}),
          ...(dto.insumo !== undefined ? { descricao: `Compra de ${dto.insumo}` } : {}),
        },
      });

      return compraAtualizada;
    });

    await this.safeLog(
      user.id,
      `compra_atualizada: id=${id}, insumo=${dto.insumo ?? compra.insumo}`,
    );

    return atualizada;
  }

  async remove(id: string, user: UsuarioPayload) {
    const compra = await this.prisma.compraInsumo.findFirst({
      where: { id, fazendaId: user.fazendaId },
      select: { id: true, insumo: true },
    });
    if (!compra) throw new NotFoundException('Compra não encontrada');

    // com onDelete: Cascade no vínculo, ao deletar a compra o financeiro espelhado é apagado
    await this.prisma.compraInsumo.delete({ where: { id } });

    await this.safeLog(user.id, `compra_excluida: id=${id}, insumo=${compra.insumo}`);

    return { message: 'Removido com sucesso' };
  }

  // ===== Exportações =====
  async exportCSV(user: UsuarioPayload): Promise<string> {
    const registros = await this.findAll(user);

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
      data: r.data.toLocaleDateString(),
    }));

    return csv.getHeaderString() + csv.stringifyRecords(records);
  }

  async exportPDF(user: UsuarioPayload): Promise<PDFDocument> {
    const data = await this.findAll(user);
    const doc = new PDFDocument();
    doc.fontSize(16).text('Relatório de Compras de Insumos', { align: 'center' });
    doc.moveDown();

    data.forEach((r) => {
      doc.text(`Data: ${r.data.toLocaleDateString()}`);
      doc.text(`Insumo: ${r.insumo}`);
      doc.text(`Qtd: ${r.quantidade} ${r.unidade}`);
      doc.text(`Valor: R$ ${r.valor.toFixed(2)}`);
      doc.text(`Fornecedor: ${r.fornecedor ?? '-'}`);
      doc.moveDown();
    });

    return doc;
  }
}