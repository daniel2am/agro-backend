import { Body, Controller, Delete, Get, Headers, HttpCode, NotFoundException, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { chaveConfere } from '../plano/plano.controller';
import { ParceiroService } from './parceiro.service';
import { AceitarConviteDto, AdicionarMembroDto, CriarConviteDto, CriarParceiroDto } from './dto/parceiro.dto';

/** Cadastro de parceiros: só com a chave administrativa (como o ajuste manual de plano). */
@Controller('admin/parceiros')
export class AdminParceiroController {
  constructor(private readonly service: ParceiroService) {}

  @Post()
  criar(@Headers('x-admin-key') chave: string | undefined, @Body() dto: CriarParceiroDto) {
    if (!process.env.ADMIN_API_KEY) throw new NotFoundException();
    if (!chaveConfere(chave, process.env.ADMIN_API_KEY)) throw new UnauthorizedException('Chave inválida');
    return this.service.criarParceiro(dto);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('parceiros')
export class ParceiroController {
  constructor(private readonly service: ParceiroService) {}

  // ---- produtor (rotas fixas antes das com :id)
  @Get('convite/:codigo')
  previa(@Param('codigo') codigo: string) {
    return this.service.previa(codigo);
  }

  @Post('convite/:codigo/aceitar')
  aceitar(@Param('codigo') codigo: string, @Body() dto: AceitarConviteDto, @AuthUser() user: UsuarioPayload) {
    return this.service.aceitar(codigo, user.id, dto);
  }

  @Get('vinculos')
  meusVinculos(@AuthUser() user: UsuarioPayload) {
    return this.service.meusVinculos(user.id);
  }

  @Delete('vinculos/:id')
  revogar(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.revogar(id, user.id);
  }

  // ---- parceiro
  @Get('meus')
  meus(@AuthUser() user: UsuarioPayload) {
    return this.service.meusParceiros(user.id);
  }

  @Post(':id/membros')
  @HttpCode(200)
  membro(@Param('id') id: string, @Body() dto: AdicionarMembroDto, @AuthUser() user: UsuarioPayload) {
    return this.service.adicionarMembro(id, user.id, dto);
  }

  @Get(':id/convites')
  convites(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.listarConvites(id, user.id);
  }

  @Post(':id/convites')
  criarConvite(@Param('id') id: string, @Body() dto: CriarConviteDto, @AuthUser() user: UsuarioPayload) {
    return this.service.criarConvite(id, user.id, dto);
  }

  @Delete(':id/convites/:conviteId')
  cancelar(@Param('id') id: string, @Param('conviteId') conviteId: string, @AuthUser() user: UsuarioPayload) {
    return this.service.cancelarConvite(id, user.id, conviteId);
  }

  @Get(':id/carteira')
  carteira(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.carteira(id, user.id);
  }
}
