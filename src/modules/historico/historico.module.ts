import { Module } from '@nestjs/common';
import { HistoricoController } from './historico.controller';
import { HistoricoService } from './historico.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [HistoricoController],
  providers: [HistoricoService, PrismaService],
})
export class HistoricoModule {}
