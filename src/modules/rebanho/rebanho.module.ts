import { Module } from '@nestjs/common';
import { RebanhoController } from './rebanho.controller';
import { RebanhoService } from './rebanho.service';

@Module({
  controllers: [RebanhoController],
  providers: [RebanhoService],
})
export class RebanhoModule {}
