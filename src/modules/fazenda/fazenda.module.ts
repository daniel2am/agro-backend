import { Module } from '@nestjs/common';
import { FazendaService } from './fazenda.service';
import { FazendaController } from './fazenda.controller';

@Module({
  controllers: [FazendaController],
  providers: [FazendaService],
  exports: [FazendaService],
})
export class FazendaModule {}
