import { Module } from '@nestjs/common';
import { ManejoService } from './manejo.service';
import { ManejoController } from './manejo.controller';

@Module({
  controllers: [ManejoController],
  providers: [ManejoService],
})
export class ManejoModule {}
