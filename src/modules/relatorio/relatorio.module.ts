import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { RelatorioController } from './relatorio.controller';
import { RelatorioService } from './relatorio.service';

@Module({ controllers: [RelatorioController], providers: [RelatorioService, PrismaService] })
export class RelatorioModule {}
