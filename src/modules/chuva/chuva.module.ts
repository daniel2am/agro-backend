import { Module } from '@nestjs/common';
import { ChuvaController } from './chuva.controller';
import { ChuvaService } from './chuva.service';

@Module({
  controllers: [ChuvaController],
  providers: [ChuvaService],
})
export class ChuvaModule {}
