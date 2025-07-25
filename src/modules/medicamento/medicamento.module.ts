import { Module } from '@nestjs/common';
import { MedicamentoService } from './medicamento.service';
import { MedicamentoController } from './medicamento.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [MedicamentoController],
  providers: [MedicamentoService, PrismaService],
})
export class MedicamentoModule {}
