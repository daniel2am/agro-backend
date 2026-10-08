import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { FiscalService } from './fiscal.service';
import { ContaDto, ContribuinteDto, ImovelDto } from './dto/fiscal.dto';

@UseGuards(JwtAuthGuard)
@Controller('fiscal')
export class FiscalController {
  constructor(private readonly service: FiscalService) {}

  @Get('contribuinte')
  obterContribuinte(@AuthUser() user: UsuarioPayload) {
    return this.service.obterContribuinte(user.id);
  }

  @Put('contribuinte')
  salvarContribuinte(@Body() dto: ContribuinteDto, @AuthUser() user: UsuarioPayload) {
    return this.service.salvarContribuinte(user.id, dto);
  }

  @Get('imoveis')
  listarImoveis(@AuthUser() user: UsuarioPayload) {
    return this.service.listarImoveis(user.id);
  }

  @Put('imoveis/:fazendaId')
  salvarImovel(@Param('fazendaId') fazendaId: string, @Body() dto: ImovelDto, @AuthUser() user: UsuarioPayload) {
    return this.service.salvarImovel(user.id, fazendaId, dto);
  }

  @Get('contas')
  listarContas(@AuthUser() user: UsuarioPayload) {
    return this.service.listarContas(user.id);
  }

  @Post('contas')
  criarConta(@Body() dto: ContaDto, @AuthUser() user: UsuarioPayload) {
    return this.service.criarConta(user.id, dto);
  }

  @Delete('contas/:id')
  removerConta(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.removerConta(user.id, id);
  }
}
