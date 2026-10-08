import { Module } from '@nestjs/common';
import { SateliteController } from './satelite.controller';
import { SateliteService } from './satelite.service';
import { CopernicusProvedor, PROVEDOR_NDVI } from './satelite.provedor';
import { SateliteDemoProvedor } from './satelite.demo';

@Module({
  controllers: [SateliteController],
  providers: [SateliteService, { provide: PROVEDOR_NDVI, useFactory: () => (process.env.SATELITE_MODO_DEMO === '1' ? new SateliteDemoProvedor() : new CopernicusProvedor()) }],
})
export class SateliteModule {}
