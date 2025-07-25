import {
  Injectable, NotFoundException, ForbiddenException
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateCompraInsumoDto } from './dto/create-compra.dto';
import { UpdateCompraInsumoDto } from './dto/update-compra.dto';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { Response } from 'express';
import { createObjectCsvStringifier } from 'csv-writer';
import { PDFDocument } from 'pdfkit';

@Injectable()
export class CompraInsumoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompraInsumoDto, user: UsuarioPayload) {
    const compra = await this.prisma.compraInsumo.create({
      data: {
        ...dto,
        data: new Date(dto.data),
        fazendaId: user.fazendaId,
        usuarioId: user.id,
      },
    });

    await this.prisma.financeiro.create({
      data: {
        fazendaId: user.fazendaId,
        data: new Date(dto.data),
        descricao: `Compra de ${dto.insumo}`,
        valor: dto.valor,
        tipo: 'despesa',
      },
    });

    return compra;
  }

  async findAll(user: UsuarioPayload) {
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

    return this.prisma.compraInsumo.update({
      where: { id },
      data: {
        ...dto,
        data: dto.data ? new Date(dto.data) : undefined,
      },
    });
  }

  async remove(id: string, user: UsuarioPayload) {
    const compra = await this.prisma.compraInsumo.findFirst({
      where: { id, fazendaId: user.fazendaId },
    });

    if (!compra) throw new NotFoundException('Compra não encontrada');

    await this.prisma.financeiro.deleteMany({
      where: {
        descricao: `Compra de ${compra.insumo}`,
        data: compra.data,
        valor: compra.valor,
        tipo: 'despesa',
        fazendaId: user.fazendaId,
      },
    });

    return this.prisma.compraInsumo.delete({ where: { id } });
  }

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
