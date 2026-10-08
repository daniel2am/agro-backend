import { Module } from '@nestjs/common';
import { PecuariaController } from './pecuaria.controller';
import { PecuariaService } from './pecuaria.service';

@Module({
  controllers: [PecuariaController],
  providers: [PecuariaService],
})
export class PecuariaModule {}
