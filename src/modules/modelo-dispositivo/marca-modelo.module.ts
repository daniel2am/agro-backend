import { Module } from '@nestjs/common';
import { MarcaModeloService } from './marca-modelo.service';
import { MarcaModeloController } from './marca-modelo.controller';

@Module({
  controllers: [MarcaModeloController],
  providers: [MarcaModeloService],
})
export class MarcaModeloModule {}
