import { Module } from '@nestjs/common';
import { CompraInsumoService } from './compra-insumo.service';
import { CompraInsumoController } from './compra-insumo.controller';

@Module({
  controllers: [CompraInsumoController],
  providers: [CompraInsumoService],
})
export class CompraInsumoModule {}
