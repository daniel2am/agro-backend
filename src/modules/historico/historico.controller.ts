import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { HistoricoService } from './historico.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('historico')
export class HistoricoController {
  constructor(private readonly historicoService: HistoricoService) {}

  @Get(':animalId')
  async getHistorico(@Param('animalId') animalId: string) {
    return this.historicoService.getHistoricoAnimal(animalId);
  }
}
