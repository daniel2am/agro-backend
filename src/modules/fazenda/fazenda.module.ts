import { Module } from '@nestjs/common';
import { FazendaService } from './fazenda.service';
import { FazendaController } from './fazenda.controller';
import { PrismaService } from '../../prisma.service';
import { UsuarioModule } from '../usuario/usuario.module';

@Module({
  imports: [UsuarioModule],
  controllers: [FazendaController],
  providers: [FazendaService, PrismaService],
  exports: [FazendaService],
})
export class FazendaModule {}
