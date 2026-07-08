import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { HistoricoService } from './historico.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('historico')
export class HistoricoController {
  constructor(private readonly historicoService: HistoricoService) {}

  @Get(':animalId')
  async getHistorico(
    @Param('animalId') animalId: string,
    @AuthUser() user: UsuarioPayload,
  ) {
    return this.historicoService.getHistoricoAnimal(animalId, user.id);
  }
}
