import { Module } from '@nestjs/common';
import { AdminParceiroController, ParceiroController } from './parceiro.controller';
import { ParceiroService } from './parceiro.service';

@Module({
  controllers: [AdminParceiroController, ParceiroController],
  providers: [ParceiroService],
})
export class ParceiroModule {}
