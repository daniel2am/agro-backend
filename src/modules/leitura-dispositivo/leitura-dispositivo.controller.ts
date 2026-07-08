import { Controller, Post, Get, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { LeituraDispositivoService } from './leitura-dispositivo.service';
import { CreateLeituraDispositivoDto } from './dto/create-leitura-dispositivo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('leituras')
export class LeituraDispositivoController {
  constructor(private readonly service: LeituraDispositivoService) {}

  @Post()
  create(@Body() dto: CreateLeituraDispositivoDto, @AuthUser() user: UsuarioPayload) {
    return this.service.create(dto, user.id);
  }

  @Get('fazenda/:fazendaId')
  findAllByFazenda(@Param('fazendaId') fazendaId: string, @AuthUser() user: UsuarioPayload) {
    return this.service.findAllByFazenda(fazendaId, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.findOne(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.remove(id, user.id);
  }
}
