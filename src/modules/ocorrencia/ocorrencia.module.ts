import { Module } from '@nestjs/common';
import { OcorrenciaService } from './ocorrencia.service';
import { OcorrenciaController } from './ocorrencia.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [OcorrenciaController],
  providers: [OcorrenciaService, PrismaService],
})
export class OcorrenciaModule {}
