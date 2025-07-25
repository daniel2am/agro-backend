import { Module } from '@nestjs/common';
import { LeituraDispositivoService } from './leitura-dispositivo.service';
import { LeituraDispositivoController } from './leitura-dispositivo.controller';

@Module({
  controllers: [LeituraDispositivoController],
  providers: [LeituraDispositivoService],
})
export class LeituraDispositivoModule {}