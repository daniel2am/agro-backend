import { Module } from '@nestjs/common';
import { ProcedimentoLavouraController } from './procedimento-lavoura.controller';
import { ProcedimentoLavouraService } from './procedimento-lavoura.service';

@Module({
  controllers: [ProcedimentoLavouraController],
  providers: [ProcedimentoLavouraService],
})
export class ProcedimentoLavouraModule {}
