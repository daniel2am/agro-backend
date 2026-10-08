import { Module } from '@nestjs/common';
import { SateliteController } from './satelite.controller';
import { SateliteService } from './satelite.service';
import { CopernicusProvedor, PROVEDOR_NDVI } from './satelite.provedor';

@Module({
  controllers: [SateliteController],
  providers: [SateliteService, { provide: PROVEDOR_NDVI, useFactory: () => new CopernicusProvedor() }],
})
export class SateliteModule {}
