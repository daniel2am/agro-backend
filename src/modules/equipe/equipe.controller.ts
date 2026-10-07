import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn } from 'class-validator';
import { PapelUsuarioFazenda } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { EquipeService, PAPEIS_CONVIDAVEIS } from './equipe.service';

class ConviteDto {
  @IsEmail()
  email: string;

  @IsIn(PAPEIS_CONVIDAVEIS)
  papel: PapelUsuarioFazenda;
}

class PapelDto {
  @IsIn(PAPEIS_CONVIDAVEIS)
  papel: PapelUsuarioFazenda;
}

@Controller('fazenda/:fazendaId/equipe')
@UseGuards(JwtAuthGuard)
export class EquipeController {
  constructor(private readonly equipe: EquipeService) {}

  @Get()
  listar(@Param('fazendaId', ParseUUIDPipe) fazendaId: string, @AuthUser() u: UsuarioPayload) {
    return this.equipe.listar(fazendaId, u.id);
  }

  @Post()
  convidar(@Param('fazendaId', ParseUUIDPipe) fazendaId: string, @Body() dto: ConviteDto, @AuthUser() u: UsuarioPayload) {
    return this.equipe.convidar(fazendaId, u.id, dto.email, dto.papel);
  }

  @Delete('convites/:conviteId')
  cancelarConvite(
    @Param('fazendaId', ParseUUIDPipe) fazendaId: string,
    @Param('conviteId', ParseUUIDPipe) conviteId: string,
    @AuthUser() u: UsuarioPayload,
  ) {
    return this.equipe.cancelarConvite(fazendaId, u.id, conviteId);
  }

  @Patch(':alvoId')
  alterarPapel(
    @Param('fazendaId', ParseUUIDPipe) fazendaId: string,
    @Param('alvoId', ParseUUIDPipe) alvoId: string,
    @Body() dto: PapelDto,
    @AuthUser() u: UsuarioPayload,
  ) {
    return this.equipe.alterarPapel(fazendaId, u.id, alvoId, dto.papel);
  }

  @Delete(':alvoId')
  remover(
    @Param('fazendaId', ParseUUIDPipe) fazendaId: string,
    @Param('alvoId', ParseUUIDPipe) alvoId: string,
    @AuthUser() u: UsuarioPayload,
  ) {
    return this.equipe.remover(fazendaId, u.id, alvoId);
  }
}
