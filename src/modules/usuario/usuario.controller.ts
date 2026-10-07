import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsuarioService } from './usuario.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { ExcluirContaDto } from './dto/excluir-conta.dto';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  // true quando quem pede é administrador global (não o próprio dono do registro)
  private async assertSelfOrAdmin(id: string, user: UsuarioPayload): Promise<boolean> {
    if (id === user.id) return false;
    const solicitante = await this.usuarioService.findOne(user.id);
    if (solicitante?.tipo === 'administrador') return true;
    throw new ForbiddenException('Acesso negado');
  }

  // Criação de usuário é feita via /auth/register (fluxo público de cadastro).
  // Este endpoint fica autenticado para uso administrativo futuro.
  @Post()
  async create(@Body() dto: CreateUsuarioDto) {
    const { senha: _omit, ...safeUser } = (await this.usuarioService.create(dto)) as any;
    return safeUser;
  }

  // Exclui a própria conta. Declarada antes de `:id` para não ser capturada por ele.
  @Delete('me')
  async excluirMinhaConta(@Body() dto: ExcluirContaDto, @AuthUser() user: UsuarioPayload) {
    return this.usuarioService.excluirConta(user.id, dto.senha);
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @AuthUser() user: UsuarioPayload,
  ) {
    const ehAdmin = await this.assertSelfOrAdmin(id, user);
    const usuario = await this.usuarioService.findOne(id);
    // o app usa isto para saber se pede a senha ao excluir a conta
    return ehAdmin ? usuario : { ...usuario, loginSocial: await this.usuarioService.loginSocial(id) };
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUsuarioDto,
    @AuthUser() user: UsuarioPayload,
  ) {
    const ehAdmin = await this.assertSelfOrAdmin(id, user);
    // Quem edita o próprio perfil só mexe em dados de perfil. Sem isso, qualquer
    // usuário se promovia a administrador (`tipo`) e passava a ler/editar todos.
    const permitido = ehAdmin
      ? dto
      : {
          ...(dto.nome !== undefined && { nome: dto.nome }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.senha !== undefined && { senha: dto.senha }),
          ...(dto.fotoUrl !== undefined && { fotoUrl: dto.fotoUrl }),
          ...(dto.termosAceitosEm !== undefined && { termosAceitosEm: dto.termosAceitosEm }),
        };
    return this.usuarioService.update(id, permitido);
  }

  // Só administrador global remove OUTRA conta; a própria conta sai por DELETE /usuarios/me
  // (que confere a senha).
  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @AuthUser() user: UsuarioPayload,
  ) {
    const ehAdmin = await this.assertSelfOrAdmin(id, user);
    if (!ehAdmin) throw new ForbiddenException('Use "Excluir minha conta" para apagar a própria conta');
    return this.usuarioService.remove(id);
  }
}
