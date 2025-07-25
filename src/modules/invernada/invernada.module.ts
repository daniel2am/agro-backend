import { Module } from '@nestjs/common';
import { InvernadaService } from './invernada.service';
import { InvernadaController } from './invernada.controller';

@Module({
  controllers: [InvernadaController],
  providers: [InvernadaService],
})
export class InvernadaModule {}
