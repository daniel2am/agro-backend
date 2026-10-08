import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { ChuvaService } from './chuva.service';
import { CreateChuvaDto } from './dto/create-chuva.dto';

function lerAno(v?: string): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new BadRequestException('Ano inválido');
  return n;
}

@UseGuards(JwtAuthGuard)
@Controller('chuvas')
export class ChuvaController {
  constructor(private readonly service: ChuvaService) {}

  @Post()
  registrar(@Body() dto: CreateChuvaDto, @AuthUser() user: UsuarioPayload) {
    return this.service.registrar(dto, user.id);
  }

  @Get()
  listar(@Query('fazendaId') fazendaId: string, @Query('ano') ano: string | undefined, @AuthUser() user: UsuarioPayload) {
    if (!fazendaId) throw new BadRequestException('Informe fazendaId');
    return this.service.listar(fazendaId, user.id, lerAno(ano));
  }

  @Get('resumo')
  resumo(@Query('fazendaId') fazendaId: string, @Query('ano') ano: string | undefined, @AuthUser() user: UsuarioPayload) {
    if (!fazendaId) throw new BadRequestException('Informe fazendaId');
    return this.service.resumo(fazendaId, user.id, lerAno(ano));
  }

  @Delete(':id')
  remover(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.remover(id, user.id);
  }
}
