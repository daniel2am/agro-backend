import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { AlertasService } from './alertas.service';

@UseGuards(JwtAuthGuard)
@Controller('alertas')
export class AlertasController {
  constructor(private readonly service: AlertasService) {}

  @Get()
  listar(@Query('fazendaId') fazendaId: string, @AuthUser() user: UsuarioPayload) {
    if (!fazendaId) throw new BadRequestException('Informe fazendaId');
    return this.service.listar(fazendaId, user.id);
  }
}
