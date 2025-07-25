import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateOcorrenciaDto } from './dto/create-ocorrencia.dto';
import { UpdateOcorrenciaDto } from './dto/update-ocorrencia.dto';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { Response } from 'express';
import { createObjectCsvStringifier } from 'csv-writer';

@Injectable()
export class OcorrenciaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOcorrenciaDto, user: UsuarioPayload) {
    return this.prisma.ocorrencia.create({
      data: {
        ...dto,
        fazendaId: user.fazendaId,
      },
    });
  }

  async findAll(user: UsuarioPayload) {
    return this.prisma.ocorrencia.findMany({
      where: { fazendaId: user.fazendaId },
      orderBy: { data: 'desc' },
      include: { animal: true },
    });
  }

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

  async update(
    id: string,
    dto: UpdateOcorrenciaDto,
    user: UsuarioPayload,
  ) {
    const ocorrencia = await this.findOne(id, user);
    return this.prisma.ocorrencia.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, user: UsuarioPayload) {
    const ocorrencia = await this.findOne(id, user);
    return this.prisma.ocorrencia.delete({ where: { id } });
  }

  async exportCSV(user: UsuarioPayload): Promise<NodeJS.ReadableStream> {
    const ocorrencias = await this.findAll(user);

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
      data: o.data.toISOString(),
      titulo: o.titulo,
      tipo: o.tipo,
      descricao: o.descricao || '',
      animal: o.animal?.brinco || '',
    }));

    const { Readable } = await import('stream');
    const stream = Readable.from([csv.getHeaderString(), ...csv.stringifyRecords(records)]);
    return stream;
  }
}
