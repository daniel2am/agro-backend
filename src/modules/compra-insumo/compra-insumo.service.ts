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
import { PDFDocument } from 'pdfkit';

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
    // garante acesso
    await this.assertAcessoFazenda(user.fazendaId, user.id);

    // cria compra
    const compra = await this.prisma.compraInsumo.create({
      data: {
        ...dto,
        data: new Date(dto.data),
        fazendaId: user.fazendaId,
        usuarioId: user.id,
      },
    });

    // cria espelho no financeiro (despesa)
    await this.prisma.financeiro.create({
      data: {
        fazendaId: user.fazendaId,
        data: new Date(dto.data),
        descricao: `Compra de ${dto.insumo}`,
        valor: dto.valor,
        tipo: 'despesa',
      },
    });

    // log p/ dashboard
    await this.safeLog(
      user.id,
      `compra_criada: id=${compra.id}, insumo=${dto.insumo}, qtd=${dto.quantidade}${dto.unidade ?? ''}, valor=${dto.valor}`,
    );

    return compra;
  }

  async findAll(user: UsuarioPayload) {
    await this.assertAcessoFazenda(user.fazendaId, user.id);

    return this.prisma.compraInsumo.findMany({
      where: { fazendaId: user.fazendaId },
      orderBy: { data: 'desc' },
    });
  }

  async update(id: string, dto: UpdateCompraInsumoDto, user: UsuarioPayload) {
    const compra = await this.prisma.compraInsumo.findFirst({
      where: { id, fazendaId: user.fazendaId },
    });
    if (!compra) throw new NotFoundException('Compra não encontrada');

    // atualiza espelho no financeiro
    await this.prisma.financeiro.updateMany({
      where: {
        descricao: `Compra de ${compra.insumo}`,
        data: compra.data,
        valor: compra.valor,
        tipo: 'despesa',
        fazendaId: user.fazendaId,
      },
      data: {
        descricao: `Compra de ${dto.insumo ?? compra.insumo}`,
        data: dto.data ? new Date(dto.data) : compra.data,
        valor: dto.valor ?? compra.valor,
      },
    });

    // atualiza compra
    const atualizada = await this.prisma.compraInsumo.update({
      where: { id },
      data: {
        ...dto,
        data: dto.data ? new Date(dto.data) : undefined,
      },
    });

    // log p/ dashboard
    await this.safeLog(
      user.id,
      `compra_atualizada: id=${id}, insumo=${dto.insumo ?? compra.insumo}`,
    );

    return atualizada;
  }

  async remove(id: string, user: UsuarioPayload) {
    const compra = await this.prisma.compraInsumo.findFirst({
      where: { id, fazendaId: user.fazendaId },
    });
    if (!compra) throw new NotFoundException('Compra não encontrada');

    // remove espelho no financeiro
    await this.prisma.financeiro.deleteMany({
      where: {
        descricao: `Compra de ${compra.insumo}`,
        data: compra.data,
        valor: compra.valor,
        tipo: 'despesa',
        fazendaId: user.fazendaId,
      },
    });

    // remove compra
    await this.prisma.compraInsumo.delete({ where: { id } });

    // log p/ dashboard
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

    return csv.stringifyRecords(records);
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