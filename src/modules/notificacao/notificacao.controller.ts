import { Controller, Get, UseGuards } from '@nestjs/common';
import { NotificacaoService } from './notificacao.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('notificacoes')
export class NotificacaoController {
  constructor(private readonly service: NotificacaoService) {}

  @Get()
  listar(@AuthUser() user: UsuarioPayload) {
    return this.service.listar(user.id);
  }
}
