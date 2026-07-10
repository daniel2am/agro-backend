import { Module } from '@nestjs/common';
import { ProcedimentoLavouraController } from './procedimento-lavoura.controller';
import { ProcedimentoLavouraService } from './procedimento-lavoura.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [ProcedimentoLavouraController],
  providers: [ProcedimentoLavouraService, PrismaService],
})
export class ProcedimentoLavouraModule {}
