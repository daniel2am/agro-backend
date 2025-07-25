import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateMarcaModeloDto } from './dto/create-marca-modelo.dto';

@Injectable()
export class MarcaModeloService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateMarcaModeloDto) {
    return this.prisma.marcaModeloDispositivo.create({ data });
  }

  async findAll() {
    return this.prisma.marcaModeloDispositivo.findMany();
  }
}