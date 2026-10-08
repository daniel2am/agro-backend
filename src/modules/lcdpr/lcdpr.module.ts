import { Module } from '@nestjs/common';
import { LcdprController } from './lcdpr.controller';
import { LcdprService } from './lcdpr.service';

@Module({
  controllers: [LcdprController],
  providers: [LcdprService],
})
export class LcdprModule {}
