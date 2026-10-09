import { Module } from '@nestjs/common';
import { AdminParceiroController, ParceiroController } from './parceiro.controller';
import { PainelParceiroController } from './painel/painel.controller';
import { ParceiroService } from './parceiro.service';

@Module({
  controllers: [AdminParceiroController, ParceiroController, PainelParceiroController],
  providers: [ParceiroService],
})
export class ParceiroModule {}
