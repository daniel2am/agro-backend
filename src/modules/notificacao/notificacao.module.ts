import { Module } from '@nestjs/common';
import { NotificacaoController } from './notificacao.controller';
import { NotificacaoService } from './notificacao.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [NotificacaoController],
  providers: [NotificacaoService, PrismaService],
})
export class NotificacaoModule {}
